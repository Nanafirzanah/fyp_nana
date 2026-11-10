import base64

import bcrypt
import pytest
from botocore.exceptions import ClientError
from fastapi.testclient import TestClient

import dynamodb_client
import s3_client
from dependencies import get_current_employee
from main import app

OWNER = {"email": "owner@dept.test", "name": "O", "department": "ops", "role": "employee"}
OTHER = {"email": "colleague@dept.test", "name": "C", "department": "ops", "role": "employee"}
ADMIN = {"email": "admin@dept.test", "name": "A", "department": "ops", "role": "system_admin"}


def b64(n: int) -> str:
    return base64.b64encode(bytes(range(n))).decode()


VERIFIER = b64(32)
FORM = {
    "verifier": VERIFIER,
    "kdf_salt": b64(16),
    "kdf_iterations": "600000",
    "iv": b64(12),
}
PLAIN_SIZE = 100
CIPHER = b"c" * (PLAIN_SIZE + 16)


class World:
    """In-memory stand-in for S3 + DynamoDB that records the order of every write."""

    def __init__(self):
        self.calls: list[tuple] = []
        self.s3 = {"ops/old": b"p" * PLAIN_SIZE}
        self.document = {
            "file_id": "f1",
            "display_name": "quote.pdf",
            "s3_key": "ops/old",
            "uploaded_by": OWNER["email"],
            "content_type": "application/pdf",
            "file_size": PLAIN_SIZE,
            "is_locked": False,
        }
        self.fail: set[str] = set()
        self.conflict = False
        self.password = None

    def maybe_fail(self, name):
        if name in self.fail:
            raise ClientError({"Error": {"Code": "Boom", "Message": "x"}}, name)


@pytest.fixture
def world(monkeypatch):
    w = World()

    monkeypatch.setattr(dynamodb_client, "get_document", lambda d, f: w.document)
    monkeypatch.setattr(s3_client, "get_object_size", lambda key: len(w.s3[key]))

    def upload(fileobj, key, content_type="x"):
        w.maybe_fail("s3_upload")
        w.s3[key] = fileobj.read()
        w.calls.append(("s3_upload", key, content_type))

    def delete(key):
        w.maybe_fail("s3_delete_old") if key == "ops/old" else None
        w.s3.pop(key, None)
        w.calls.append(("s3_delete", key))

    def create_password(department, file_id, verifier_hash, iv, created_by):
        w.maybe_fail("create_password")
        w.password = (file_id, verifier_hash, iv)
        w.calls.append(("create_password", file_id))

    def delete_password(department, file_id):
        w.password = None
        w.calls.append(("delete_password", file_id))

    def lock_doc(department, file_id, new_key, kdf, modified_by):
        if w.conflict:
            raise ClientError(
                {"Error": {"Code": "ConditionalCheckFailedException", "Message": "x"}}, "u"
            )
        w.maybe_fail("lock_doc")
        w.document.update(s3_key=new_key, is_locked=True, lock_kdf=kdf)
        w.calls.append(("lock_doc", new_key, kdf))

    monkeypatch.setattr(s3_client, "upload_file_by_key", upload)
    monkeypatch.setattr(s3_client, "delete_file_by_key", delete)
    monkeypatch.setattr(dynamodb_client, "create_file_password", create_password)
    monkeypatch.setattr(dynamodb_client, "delete_file_password", delete_password)
    monkeypatch.setattr(dynamodb_client, "lock_existing_document", lock_doc)
    monkeypatch.setattr(
        dynamodb_client, "create_audit_log_entry", lambda **kw: w.calls.append(("audit", kw["action"]))
    )
    return w


@pytest.fixture
def client():
    app.dependency_overrides[get_current_employee] = lambda: OWNER
    yield TestClient(app)
    app.dependency_overrides.clear()


def lock(client, cipher=CIPHER, form=None, file_id="f1"):
    return client.post(
        f"/documents/{file_id}/lock",
        files={"file": ("quote.pdf", cipher, "application/octet-stream")},
        data=form or FORM,
    )


def test_owner_can_lock_and_the_order_is_new_object_then_record_then_delete_old(client, world):
    res = lock(client)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["is_locked"] is True and body["old_object_deleted"] is True

    new_key = body["s3_key"]
    assert new_key.startswith("ops/") and new_key != "ops/old"
    assert [c[0] for c in world.calls] == [
        "s3_upload",
        "create_password",
        "lock_doc",
        "s3_delete",
        "audit",
    ]
    assert world.calls[0][2] == "application/octet-stream"
    assert world.calls[3] == ("s3_delete", "ops/old")  # the plaintext goes last
    assert world.s3 == {new_key: CIPHER}
    assert world.document["is_locked"] is True and world.document["s3_key"] == new_key
    assert world.document["lock_kdf"]["iterations"] == 600000


def test_verifier_is_stored_only_as_a_bcrypt_hash(client, world):
    lock(client)
    _, stored_hash, iv = world.password
    assert stored_hash != VERIFIER
    assert bcrypt.checkpw(VERIFIER.encode(), stored_hash.encode())
    assert iv == FORM["iv"]


def test_only_the_uploader_may_lock_even_for_admins_and_colleagues(client, world):
    for who in (OTHER, ADMIN):
        app.dependency_overrides[get_current_employee] = lambda who=who: who
        res = lock(client)
        assert res.status_code == 403
    assert world.calls == []
    assert world.s3 == {"ops/old": b"p" * PLAIN_SIZE}


def test_an_already_locked_file_is_refused(client, world):
    world.document["is_locked"] = True
    assert lock(client).status_code == 409
    assert world.calls == []


def test_unknown_file_is_404(client, world, monkeypatch):
    monkeypatch.setattr(dynamodb_client, "get_document", lambda d, f: None)
    assert lock(client).status_code == 404


def test_ciphertext_must_be_stored_size_plus_tag(client, world):
    assert lock(client, cipher=b"c" * (PLAIN_SIZE + 15)).status_code == 400
    assert lock(client, cipher=b"c" * (PLAIN_SIZE + 17)).status_code == 400
    assert lock(client, cipher=b"c" * PLAIN_SIZE).status_code == 400
    assert world.calls == []


def test_files_over_the_locked_limit_are_refused(client, world, monkeypatch):
    import documents

    monkeypatch.setattr(documents, "MAX_LOCKED_FILE_BYTES", 50)  # stored file is 100 bytes
    res = lock(client)
    assert res.status_code == 413
    assert world.calls == []


def test_weak_or_malformed_lock_fields_are_refused(client, world):
    assert lock(client, form={**FORM, "kdf_iterations": "1000"}).status_code == 400
    assert lock(client, form={**FORM, "verifier": b64(16)}).status_code == 400
    assert lock(client, form={**FORM, "iv": "not base64!"}).status_code == 400
    assert world.calls == []


def test_a_failed_s3_upload_changes_nothing(client, world):
    world.fail.add("s3_upload")
    assert lock(client).status_code == 503
    assert world.document["is_locked"] is False and world.s3 == {"ops/old": b"p" * PLAIN_SIZE}


def test_a_failed_password_save_removes_the_new_object(client, world):
    world.fail.add("create_password")
    assert lock(client).status_code == 503
    assert world.s3 == {"ops/old": b"p" * PLAIN_SIZE}
    assert world.document["is_locked"] is False


def test_a_lost_race_rolls_back_and_keeps_the_original(client, world):
    world.conflict = True  # someone locked it between our read and our write
    res = lock(client)
    assert res.status_code == 409
    assert world.s3 == {"ops/old": b"p" * PLAIN_SIZE}
    assert world.password is None
    assert ("s3_delete", "ops/old") not in world.calls


def test_a_failed_record_update_rolls_back(client, world):
    world.fail.add("lock_doc")
    assert lock(client).status_code == 503
    assert world.s3 == {"ops/old": b"p" * PLAIN_SIZE}
    assert world.password is None and world.document["is_locked"] is False


def test_if_the_old_object_cannot_be_deleted_the_lock_stands_but_it_is_reported(client, world):
    world.fail.add("s3_delete_old")
    res = lock(client)
    assert res.status_code == 200
    assert res.json()["old_object_deleted"] is False
    assert world.document["is_locked"] is True
