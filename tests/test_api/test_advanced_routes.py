"""Advanced API route tests — assignment, approval, missing fields, soft delete."""
from __future__ import annotations

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


def _create(client: TestClient, email: str = "b@t.com", subject: str = "Test") -> dict:
    resp = client.post("/submissions/", json={"broker_email": email, "subject": subject, "body_text": "Body"})
    assert resp.status_code == 200
    return resp.json()


class TestAssignment:
    def test_list_users(self, client: TestClient):
        resp = client.get("/submissions/meta/users")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["representatives"]) > 0
        assert len(data["approvers"]) > 0

    def test_assign_submission(self, client: TestClient):
        sub = _create(client)
        resp = client.post(f"/submissions/{sub['id']}/assign", json={"rep_id": "rep-1"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_assign_unknown_rep(self, client: TestClient):
        sub = _create(client)
        resp = client.post(f"/submissions/{sub['id']}/assign", json={"rep_id": "unknown"})
        assert resp.status_code == 400


class TestApproval:
    def test_approve_by_manager(self, client: TestClient):
        sub = _create(client)
        resp = client.post(f"/submissions/{sub['id']}/approve", json={"approver_id": "mgr-1"})
        assert resp.status_code == 200

    def test_approve_by_underwriter_fails(self, client: TestClient):
        sub = _create(client)
        resp = client.post(f"/submissions/{sub['id']}/approve", json={"approver_id": "rep-1"})
        assert resp.status_code == 400


class TestMissingFields:
    def test_missing_fields_no_data(self, client: TestClient):
        sub = _create(client)
        resp = client.get(f"/submissions/{sub['id']}/missing-fields")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_required"] > 0
        assert data["completion_pct"] == 0.0

    def test_missing_fields_not_found(self, client: TestClient):
        resp = client.get("/submissions/nonexistent/missing-fields")
        assert resp.status_code == 404


class TestSoftDelete:
    def test_delete_hides_from_list(self, client: TestClient):
        sub1 = _create(client, email="a@t.com", subject="A")
        sub2 = _create(client, email="b@t.com", subject="B")
        # Delete sub1
        resp = client.delete(f"/submissions/{sub1['id']}")
        assert resp.status_code == 200
        # List should only show sub2
        list_resp = client.get("/submissions/")
        ids = [s["id"] for s in list_resp.json()]
        assert sub1["id"] not in ids
        assert sub2["id"] in ids

    def test_delete_still_accessible_by_id(self, client: TestClient):
        sub = _create(client)
        client.delete(f"/submissions/{sub['id']}")
        resp = client.get(f"/submissions/{sub['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True


class TestPatchExtractedData:
    def test_patch_field(self, client: TestClient):
        sub = _create(client)
        # Set some extracted data first
        sid = sub["id"]
        # Manually set extracted_data via transition to have data
        # For now just test that endpoint exists
        resp = client.patch(f"/submissions/{sid}/extracted-data", json={"path": "overview.fein", "value": "12-345"})
        # Will fail because no extracted data yet
        assert resp.status_code == 400  # No extracted data to patch

    def test_patch_nonexistent_submission(self, client: TestClient):
        resp = client.patch("/submissions/nonexistent/extracted-data", json={"path": "x", "value": "y"})
        assert resp.status_code == 404


class TestTransitionEdgeCases:
    def test_transition_nonexistent(self, client: TestClient):
        resp = client.post("/submissions/nonexistent/transition", json={"new_status": "ack_sent"})
        assert resp.status_code == 404

    def test_transition_invalid_status(self, client: TestClient):
        sub = _create(client)
        resp = client.post(f"/submissions/{sub['id']}/transition", json={"new_status": "completed"})
        assert resp.status_code == 400  # Invalid transition from received to completed

    def test_full_transition_path(self, client: TestClient):
        sub = _create(client)
        sid = sub["id"]
        for status in ["ack_sent", "parsing", "extracting", "extracted", "validated", "auto_policy_ready", "policy_created"]:
            resp = client.post(f"/submissions/{sid}/transition", json={"new_status": status})
            assert resp.status_code == 200, f"Failed transition to {status}: {resp.text}"
