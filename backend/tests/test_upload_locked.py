import base64

import bcrypt
import pytest
from botocore.exceptions import ClientError
from fastapi.testclient import TestClient

import dynamodb_client
import s3_client
from dependencies import get_current_employee
from main import app

EMPLOYEE = {
    "email": "owner@dept.test",
    "name": "Owner",
    "department": "ops",
    "role": "employee",
}


def b64(n: int) -> str:
    return base64.b64encode(bytes(range(n))).decode()


VERIFIER = b64(32)
GOOD_FORM = {
    "verifier": VERIFIER,
    "kdf_salt": b64(16),
    "kdf_iterations": "600000",
    "iv": b64(12),
    "original_content_type": "application/pdf",
}


class Fakes:
    """Records every storage call so tests can check content and order."""

    def __init__(self):
        self.calls: list[tuple] = []
        self.s3_objects: dict[str, bytes] = {}
        self.fail_on: set[str] = set()

    def _maybe_fail(self, name: str):
        if name in self.fail_on:
            raise ClientError({"Error": {"Code": "Boom", "Message": "x"}}, name)

    def upload_file_by_key(self, fileobj, key, content_type="x"):
        self._maybe_fail("s3_upload")
        self.s3_objects[key] = fileobj.read()
        self.calls.append(("s3_upload", key, content_type))

    def delete_file_by_key(self, key):
        self.s3_objects.pop(key, None)
        self.calls.append(("s3_delete", key))

    def create_file_password(self, department, file_id, verifier_hash, iv, created_by):
        self._maybe_fail("create_file_password")
        self.calls.append(("create_file_password", file_id, verifier_hash, iv))
        return {}

    def delete_file_password(self, department, file_id):
        self.calls.append(("delete_file_password", file_id))

    def create_document(self, **kwargs):
        self._maybe_fail("create_document")
        self.calls.append(("create_document", kwargs))
        return {"file_id": kwargs["file_id"], **kwargs}

    def create_audit_log_entry(self, **kwargs):
        self.calls.append(("audit", kwargs["action"]))

    def names(self):
        return [c[0] for c in self.calls]


@pytest.fixture
def fakes(monkeypatch):
    f = Fakes()
    monkeypatch.setattr(s3_client, "upload_file_by_key", f.upload_file_by_key)
    monkeypatch.setattr(s3_client, "delete_file_by_key", f.delete_file_by_key)
    for name in (
        "create_file_password",
        "delete_file_password",
        "create_document",
        "create_audit_log_entry",
    ):
        monkeypatch.setattr(dynamodb_client, name, getattr(f, name))
    return f


@pytest.fixture
def client():
    app.dependency_overrides[get_current_employee] = lambda: EMPLOYEE
    yield TestClient(app)
    app.dependency_overrides.clear()


def post(client, content: bytes, form=None, filename="report.pdf"):
    return client.post(
        "/documents/upload-locked",
        files={"file": (filename, content, "application/octet-stream")},
        data=form or GOOD_FORM,
    )


def test_locked_upload_stores_ciphertext_and_gate(client, fakes):
    cipher = b"c" * 116  # 100 bytes of plaintext + 16-byte GCM tag
    res = post(client, cipher)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["file_size"] == 100  # plaintext size, not ciphertext size
    assert body["content_type"] == "application/pdf"  # real type stays in metadata
    assert body["lock_kdf"] == {  # public parameters only
        "version": 1,
        "kdf": "PBKDF2-SHA256",
        "iterations": 600000,
        "salt": GOOD_FORM["kdf_salt"],
    }
    assert VERIFIER not in str(body)

    s3_key = next(c[1] for c in fakes.calls if c[0] == "s3_upload")
    assert fakes.s3_objects[s3_key] == cipher
    assert next(c[2] for c in fakes.calls if c[0] == "s3_upload") == "application/octet-stream"

    stored_hash = next(c[2] for c in fakes.calls if c[0] == "create_file_password")
    assert stored_hash != VERIFIER  # never stored in the clear
    assert bcrypt.checkpw(VERIFIER.encode(), stored_hash.encode())


def test_write_order_is_s3_then_password_then_document(client, fakes):
    post(client, b"c" * 20)
    assert fakes.names() == ["s3_upload", "create_file_password", "create_document", "audit"]


def test_rejects_weak_kdf_iterations(client, fakes):
    res = post(client, b"c" * 20, {**GOOD_FORM, "kdf_iterations": "1000"})
    assert res.status_code == 400
    assert fakes.calls == []


@pytest.mark.parametrize(
    "field,value",
    [
        ("verifier", b64(16)),  # wrong length
        ("kdf_salt", b64(8)),
        ("iv", b64(16)),
        ("iv", "not base64!!"),
    ],
)
def test_rejects_malformed_lock_fields(client, fakes, field, value):
    res = post(client, b"c" * 20, {**GOOD_FORM, field: value})
    assert res.status_code == 400
    assert fakes.calls == []


def test_rejects_file_shorter_than_gcm_tag(client, fakes):
    res = post(client, b"c" * 10)
    assert res.status_code == 400
    assert fakes.calls == []


def test_rejects_file_over_locked_limit(client, fakes, monkeypatch):
    import documents

    monkeypatch.setattr(documents, "MAX_LOCKED_FILE_BYTES", 100)
    res = post(client, b"c" * (100 + 16 + 1))
    assert res.status_code == 413
    assert fakes.calls == []
    assert post(client, b"c" * (100 + 16)).status_code == 200  # exactly at the limit


def test_unknown_content_type_falls_back_to_octet_stream(client, fakes):
    res = post(client, b"c" * 20, {**GOOD_FORM, "original_content_type": "evil/type"})
    assert res.json()["content_type"] == "application/octet-stream"


def test_rolls_back_s3_if_password_save_fails(client, fakes):
    fakes.fail_on.add("create_file_password")
    res = post(client, b"c" * 20)
    assert res.status_code == 503
    assert fakes.s3_objects == {}
    assert "create_document" not in fakes.names()


def test_rolls_back_s3_and_password_if_document_save_fails(client, fakes):
    fakes.fail_on.add("create_document")
    res = post(client, b"c" * 20)
    assert res.status_code == 503
    assert fakes.s3_objects == {}
    assert "delete_file_password" in fakes.names()


def test_locked_file_cannot_use_plain_download(client, monkeypatch):
    monkeypatch.setattr(
        dynamodb_client,
        "get_document",
        lambda dept, fid: {"file_id": fid, "display_name": "a.pdf", "s3_key": "k", "is_locked": True},
    )
    res = client.get("/documents/download/abc")
    assert res.status_code == 403
