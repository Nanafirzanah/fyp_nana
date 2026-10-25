import base64
import time

import bcrypt
import pytest
from fastapi.testclient import TestClient

import dynamodb_client
import s3_client
from dependencies import get_current_employee
from main import app

EMPLOYEE = {"email": "colleague@dept.test", "name": "C", "department": "ops", "role": "employee"}
GOOD = base64.b64encode(bytes(range(32))).decode()
BAD = base64.b64encode(bytes(range(1, 33))).decode()
KDF = {"version": 1, "kdf": "PBKDF2-SHA256", "iterations": 600000, "salt": "c2FsdHNhbHRzYWx0c2E="}


class State:
    def __init__(self):
        self.pw = {
            "department": "ops",
            "file_id": "f1",
            "verifier_hash": bcrypt.hashpw(GOOD.encode(), bcrypt.gensalt(rounds=4)).decode(),
            "iv": "aXZpdml2aXZpdml2",
            "failed_attempts": 0,
        }
        self.audit: list[str] = []
        self.locked = True


@pytest.fixture
def st(monkeypatch):
    s = State()

    def get_document(dept, fid):
        if (dept, fid) != ("ops", "f1"):
            return None
        return {
            "file_id": "f1",
            "display_name": "quote.pdf",
            "s3_key": "ops/f1",
            "content_type": "application/pdf",
            "is_locked": s.locked,
            "lock_kdf": KDF,
        }

    def register_failed_unlock(dept, fid, max_attempts, lockout_seconds):
        s.pw["failed_attempts"] += 1
        if s.pw["failed_attempts"] >= max_attempts:
            s.pw["failed_attempts"] = 0
            s.pw["locked_until"] = int(time.time()) + lockout_seconds
            return {"failed_attempts": 0, "locked_until": s.pw["locked_until"]}
        return {"failed_attempts": s.pw["failed_attempts"], "locked_until": None}

    def clear_failed_unlocks(dept, fid):
        s.pw["failed_attempts"] = 0
        s.pw.pop("locked_until", None)

    monkeypatch.setattr(dynamodb_client, "get_document", get_document)
    monkeypatch.setattr(dynamodb_client, "get_file_password", lambda d, f: s.pw)
    monkeypatch.setattr(dynamodb_client, "register_failed_unlock", register_failed_unlock)
    monkeypatch.setattr(dynamodb_client, "clear_failed_unlocks", clear_failed_unlocks)
    monkeypatch.setattr(
        dynamodb_client, "create_audit_log_entry", lambda **kw: s.audit.append(kw["action"])
    )
    monkeypatch.setattr(s3_client, "generate_download_url", lambda s3_key, filename: f"https://s3/{s3_key}")
    return s


@pytest.fixture
def client():
    app.dependency_overrides[get_current_employee] = lambda: EMPLOYEE
    yield TestClient(app)
    app.dependency_overrides.clear()


def unlock(client, verifier, file_id="f1"):
    return client.post(f"/documents/{file_id}/unlock", json={"verifier": verifier})


def test_correct_verifier_releases_url_and_iv(client, st):
    res = unlock(client, GOOD)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["url"] == "https://s3/ops/f1"
    assert body["iv"] == st.pw["iv"]
    assert body["content_type"] == "application/pdf"
    assert body["lock_kdf"] == KDF
    assert "verifier_hash" not in str(body)
    assert st.audit == ["unlock"]


def test_wrong_verifier_is_rejected_and_counted(client, st):
    res = unlock(client, BAD)
    assert res.status_code == 403
    assert "Invalid password" in res.json()["detail"]
    assert "4 attempt" in res.json()["detail"]
    assert "url" not in res.text
    assert st.pw["failed_attempts"] == 1
    assert st.audit == ["unlock_failed"]


def test_lockout_after_five_failures_blocks_even_the_right_verifier(client, st):
    for i in range(4):
        assert unlock(client, BAD).status_code == 403
    fifth = unlock(client, BAD)
    assert fifth.status_code == 429
    assert "unlock_lockout" in st.audit

    blocked = unlock(client, GOOD)  # correct, but still inside the lockout window
    assert blocked.status_code == 429
    assert "url" not in blocked.text


def test_lockout_expires(client, st):
    st.pw["locked_until"] = int(time.time()) - 1  # already in the past
    assert unlock(client, GOOD).status_code == 200


def test_success_resets_failed_counter(client, st):
    unlock(client, BAD)
    unlock(client, BAD)
    assert st.pw["failed_attempts"] == 2
    assert unlock(client, GOOD).status_code == 200
    assert st.pw["failed_attempts"] == 0


def test_unlocked_file_cannot_be_unlocked(client, st):
    st.locked = False
    assert unlock(client, GOOD).status_code == 400


def test_unknown_or_other_department_file_is_404(client, st):
    assert unlock(client, GOOD, file_id="nope").status_code == 404


def test_malformed_verifier_is_400_and_not_counted(client, st):
    assert unlock(client, "short").status_code == 400
    assert st.pw["failed_attempts"] == 0
