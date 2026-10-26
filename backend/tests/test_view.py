import pytest
from fastapi.testclient import TestClient

import dynamodb_client
import s3_client
from dependencies import get_current_employee
from main import app
from preview import preview_content_type

EMPLOYEE = {"email": "a@dept.test", "name": "A", "department": "ops", "role": "employee"}


@pytest.fixture
def client():
    app.dependency_overrides[get_current_employee] = lambda: EMPLOYEE
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def audit(monkeypatch):
    actions: list[str] = []
    monkeypatch.setattr(
        dynamodb_client, "create_audit_log_entry", lambda **kw: actions.append(kw["action"])
    )
    return actions


def serve(monkeypatch, document):
    monkeypatch.setattr(dynamodb_client, "get_document", lambda dept, fid: document)
    urls: list[tuple] = []

    def fake_url(s3_key, content_type, expires_in=300):
        urls.append((s3_key, content_type))
        return f"https://s3/{s3_key}"

    monkeypatch.setattr(s3_client, "generate_view_url", fake_url)
    return urls


def doc(name, **extra):
    return {"file_id": "f1", "display_name": name, "s3_key": "ops/f1", **extra}


@pytest.mark.parametrize(
    "name,expected",
    [
        ("report.PDF", "application/pdf"),
        ("photo.jpg", "image/jpeg"),
        ("photo.jpeg", "image/jpeg"),
        ("logo.png", "image/png"),
        ("notes.txt", "text/plain; charset=utf-8"),
        ("data.csv", "text/plain; charset=utf-8"),
    ],
)
def test_previewable_types(name, expected):
    assert preview_content_type(name) == expected


@pytest.mark.parametrize(
    "name", ["page.html", "image.svg", "script.js", "sheet.xlsx", "letter.docx", "slides.pptx", "noext"]
)
def test_types_that_must_not_be_served_inline(name):
    assert preview_content_type(name) is None


def test_view_returns_an_inline_url_and_audits(client, monkeypatch, audit):
    urls = serve(monkeypatch, doc("report.pdf"))
    res = client.get("/documents/view/f1")
    assert res.status_code == 200
    body = res.json()
    assert body == {
        "file_id": "f1",
        "filename": "report.pdf",
        "content_type": "application/pdf",
        "url": "https://s3/ops/f1",
    }
    assert urls == [("ops/f1", "application/pdf")]
    assert audit == ["view"]


def test_content_type_comes_from_the_extension_not_the_stored_value(client, monkeypatch, audit):
    urls = serve(monkeypatch, doc("data.csv", content_type="application/vnd.ms-excel"))
    assert client.get("/documents/view/f1").status_code == 200
    assert urls[0][1] == "text/plain; charset=utf-8"


def test_locked_file_cannot_be_viewed_through_the_server(client, monkeypatch, audit):
    urls = serve(monkeypatch, doc("secret.pdf", is_locked=True))
    res = client.get("/documents/view/f1")
    assert res.status_code == 403
    assert urls == [] and audit == []


def test_unsupported_type_is_rejected(client, monkeypatch, audit):
    urls = serve(monkeypatch, doc("letter.docx"))
    res = client.get("/documents/view/f1")
    assert res.status_code == 400
    assert urls == [] and audit == []


def test_unknown_file_is_404(client, monkeypatch, audit):
    serve(monkeypatch, None)
    assert client.get("/documents/view/nope").status_code == 404


def test_presigned_url_asks_s3_to_show_the_file_inline(monkeypatch):
    captured = {}

    def fake_presign(operation, Params, ExpiresIn):
        captured.update(operation=operation, params=Params, expires=ExpiresIn)
        return "https://signed"

    monkeypatch.setattr(s3_client._s3, "generate_presigned_url", fake_presign)
    assert s3_client.generate_view_url("ops/f1", "application/pdf") == "https://signed"
    assert captured["operation"] == "get_object"
    assert captured["params"]["ResponseContentDisposition"] == "inline"
    assert captured["params"]["ResponseContentType"] == "application/pdf"
    assert captured["expires"] == 300
