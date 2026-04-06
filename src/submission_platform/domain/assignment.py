"""Rep assignment and approval logic."""
from __future__ import annotations

import random
from datetime import datetime, timezone

from submission_platform.domain.models import Submission
from submission_platform.infra.json_store import JsonStore
from submission_platform.infra.logging import get_logger

log = get_logger(__name__)

# Representatives pool
REPRESENTATIVES = [
    {"id": "rep-1", "name": "Sarah Chen", "role": "underwriter"},
    {"id": "rep-2", "name": "Marcus Johnson", "role": "underwriter"},
    {"id": "rep-3", "name": "Diana Reyes", "role": "underwriter"},
    {"id": "rep-4", "name": "James Park", "role": "senior_underwriter"},
]

APPROVERS = [
    {"id": "mgr-1", "name": "Robert Williams", "role": "manager"},
    {"id": "mgr-2", "name": "Lisa Thompson", "role": "director"},
]

ALL_USERS = {u["id"]: u for u in REPRESENTATIVES + APPROVERS}


def auto_assign(submission: Submission, store: JsonStore) -> str:
    """Auto-assign a representative to a submission. Returns the rep name."""
    if submission.assigned_to:
        return submission.assigned_to

    rep = random.choice(REPRESENTATIVES)
    submission.assigned_to = rep["id"]
    submission.chat_history.append({
        "role": "system",
        "content": f"Assigned to {rep['name']} ({rep['role']})",
        "activity_type": "assignment",
        "actor": rep["name"],
        "actor_role": rep["role"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    store.save("submissions", submission.id, submission)
    log.info("submission_assigned", submission_id=submission.id, rep=rep["name"])
    return rep["name"]


def reassign(submission_id: str, rep_id: str, store: JsonStore) -> dict:
    """Reassign a submission to a different rep."""
    sub = store.load("submissions", submission_id, Submission)
    if sub is None:
        return {"error": "Submission not found"}

    user = ALL_USERS.get(rep_id)
    if not user:
        return {"error": f"Unknown user: {rep_id}"}

    old = ALL_USERS.get(sub.assigned_to, {}).get("name", sub.assigned_to)
    sub.assigned_to = rep_id
    sub.chat_history.append({
        "role": "system",
        "content": f"Reassigned from {old} to {user['name']}",
        "activity_type": "reassignment",
        "actor": user["name"],
        "actor_role": user["role"],
        "from_actor": old,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    sub.updated_at = datetime.now(timezone.utc)
    store.save("submissions", sub.id, sub)
    return {"ok": True, "assigned_to": rep_id, "name": user["name"]}


def approve(submission_id: str, approver_id: str, store: JsonStore) -> dict:
    """Approve a submission."""
    sub = store.load("submissions", submission_id, Submission)
    if sub is None:
        return {"error": "Submission not found"}

    approver = ALL_USERS.get(approver_id)
    if not approver:
        return {"error": f"Unknown approver: {approver_id}"}

    if approver["role"] not in ("manager", "director"):
        return {"error": f"{approver['name']} is not an approver"}

    sub.approved_by = approver_id
    sub.approved_at = datetime.now(timezone.utc)
    sub.chat_history.append({
        "role": "system",
        "content": f"Approved by {approver['name']} ({approver['role']})",
        "activity_type": "approval",
        "actor": approver["name"],
        "actor_role": approver["role"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    sub.updated_at = datetime.now(timezone.utc)
    store.save("submissions", sub.id, sub)
    log.info("submission_approved", submission_id=sub.id, approver=approver["name"])
    return {"ok": True, "approved_by": approver_id, "name": approver["name"]}
