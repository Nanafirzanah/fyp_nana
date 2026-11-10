import pytest
from fastapi.testclient import TestClient

import dynamodb_client
from dependencies import get_current_employee
from main import app

EMPLOYEE = {"email": "a@dept.test", "name": "A", "department": "ops", "role": "employee"}


@pytest.fixture
def client():
    app.dependency_overrides[get_current_employee] = lambda: EMPLOYEE
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_rename_passes_the_editor_to_the_database(client, monkeypatch):
    """Regression: the route once called rename_document without modified_by (HTTP 500)."""
    monkeypatch.setattr(
        dynamodb_client,
        "get_document",
        lambda dept, fid: {
            "file_id": fid,
            "display_name": "old.pdf",
            "content_type": "application/pdf",
        },
    )
    calls = []
    monkeypatch.setattr(
        dynamodb_client,
        "rename_document",
        lambda department, file_id, new_name, modified_by: calls.append(
            (department, file_id, new_name, modified_by)
        ),
    )

    res = client.patch("/documents/f1/rename", json={"name": "new name"})

    assert res.status_code == 200, res.text
    assert res.json() == {"file_id": "f1", "display_name": "new name.pdf"}
    assert calls == [("ops", "f1", "new name.pdf", "a@dept.test")]


def test_rename_keeps_the_real_extension(client, monkeypatch):
    monkeypatch.setattr(
        dynamodb_client,
        "get_document",
        lambda dept, fid: {"file_id": fid, "display_name": "x.pdf", "content_type": "application/pdf"},
    )
    monkeypatch.setattr(dynamodb_client, "rename_document", lambda *a, **k: None)
    res = client.patch("/documents/f1/rename", json={"name": "report.docx"})
    assert res.json()["display_name"] == "report.pdf"
