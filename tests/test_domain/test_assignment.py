"""Assignment and approval tests."""
from __future__ import annotations

from pathlib import Path

import pytest

from submission_platform.domain.assignment import (
    ALL_USERS, APPROVERS, REPRESENTATIVES,
    approve, auto_assign, reassign,
)
from submission_platform.domain.models import Submission
from submission_platform.infra.json_store import JsonStore


@pytest.fixture
def store(tmp_path: Path) -> JsonStore:
    return JsonStore(base_dir=tmp_path)


@pytest.fixture
def submission(store: JsonStore) -> Submission:
    sub = Submission(broker_email="test@test.com", subject="Test", body_text="Body")
    store.save("submissions", sub.id, sub)
    return sub


class TestAutoAssign:
    def test_assigns_a_rep(self, submission: Submission, store: JsonStore):
        name = auto_assign(submission, store)
        assert name in [r["name"] for r in REPRESENTATIVES]
        assert submission.assigned_to is not None

    def test_does_not_reassign_if_already_assigned(self, submission: Submission, store: JsonStore):
        submission.assigned_to = "rep-1"
        store.save("submissions", submission.id, submission)
        name = auto_assign(submission, store)
        assert submission.assigned_to == "rep-1"

    def test_adds_chat_history_entry(self, submission: Submission, store: JsonStore):
        auto_assign(submission, store)
        assert len(submission.chat_history) > 0
        assert "Assigned" in submission.chat_history[-1]["content"]


class TestReassign:
    def test_reassign_to_valid_rep(self, submission: Submission, store: JsonStore):
        auto_assign(submission, store)
        result = reassign(submission.id, "rep-2", store)
        assert result.get("ok") is True
        reloaded = store.load("submissions", submission.id, Submission)
        assert reloaded.assigned_to == "rep-2"

    def test_reassign_unknown_rep(self, submission: Submission, store: JsonStore):
        result = reassign(submission.id, "unknown-id", store)
        assert "error" in result

    def test_reassign_nonexistent_submission(self, store: JsonStore):
        result = reassign("nonexistent", "rep-1", store)
        assert "error" in result

    def test_reassign_records_in_history(self, submission: Submission, store: JsonStore):
        auto_assign(submission, store)
        reassign(submission.id, "rep-2", store)
        reloaded = store.load("submissions", submission.id, Submission)
        system_msgs = [h for h in reloaded.chat_history if h["role"] == "system"]
        assert any("Reassigned" in h["content"] for h in system_msgs)


class TestApprove:
    def test_approve_by_manager(self, submission: Submission, store: JsonStore):
        result = approve(submission.id, "mgr-1", store)
        assert result.get("ok") is True
        reloaded = store.load("submissions", submission.id, Submission)
        assert reloaded.approved_by == "mgr-1"
        assert reloaded.approved_at is not None

    def test_approve_by_director(self, submission: Submission, store: JsonStore):
        result = approve(submission.id, "mgr-2", store)
        assert result.get("ok") is True

    def test_underwriter_cannot_approve(self, submission: Submission, store: JsonStore):
        result = approve(submission.id, "rep-1", store)
        assert "error" in result

    def test_unknown_approver(self, submission: Submission, store: JsonStore):
        result = approve(submission.id, "unknown", store)
        assert "error" in result

    def test_approve_records_in_history(self, submission: Submission, store: JsonStore):
        approve(submission.id, "mgr-1", store)
        reloaded = store.load("submissions", submission.id, Submission)
        system_msgs = [h for h in reloaded.chat_history if h["role"] == "system"]
        assert any("Approved" in h["content"] for h in system_msgs)
        # Check structured metadata
        approval_entry = next(h for h in system_msgs if "Approved" in h["content"])
        assert approval_entry.get("activity_type") == "approval"
        assert approval_entry.get("actor") == "Robert Williams"
