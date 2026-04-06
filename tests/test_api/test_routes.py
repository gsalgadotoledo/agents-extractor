from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from submission_platform.api.app import create_app
from submission_platform.api.dependencies import get_store
from submission_platform.infra.json_store import JsonStore


@pytest.fixture
def client(tmp_path: Path):
    app = create_app()
    tmp_store = JsonStore(base_dir=tmp_path)
    app.dependency_overrides[get_store] = lambda: tmp_store
    return TestClient(app)


def test_health(client: TestClient):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_create_submission(client: TestClient):
    resp = client.post(
        "/submissions/",
        json={
            "broker_email": "broker@test.com",
            "subject": "Test Policy",
            "body_text": "Please quote.",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["broker_email"] == "broker@test.com"
    assert data["status"] == "received"
    assert data["id"]


def test_list_submissions(client: TestClient):
    client.post(
        "/submissions/",
        json={"broker_email": "a@t.com", "subject": "A", "body_text": "A"},
    )
    client.post(
        "/submissions/",
        json={"broker_email": "b@t.com", "subject": "B", "body_text": "B"},
    )
    resp = client.get("/submissions/")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_submission(client: TestClient):
    create_resp = client.post(
        "/submissions/",
        json={"broker_email": "a@t.com", "subject": "A", "body_text": "A"},
    )
    sid = create_resp.json()["id"]
    resp = client.get(f"/submissions/{sid}")
    assert resp.status_code == 200
    assert resp.json()["id"] == sid


def test_get_submission_not_found(client: TestClient):
    resp = client.get("/submissions/nonexistent")
    assert resp.status_code == 404


def test_transition_submission(client: TestClient):
    create_resp = client.post(
        "/submissions/",
        json={"broker_email": "a@t.com", "subject": "A", "body_text": "A"},
    )
    sid = create_resp.json()["id"]
    resp = client.post(
        f"/submissions/{sid}/transition",
        json={"new_status": "ack_sent"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ack_sent"
