from __future__ import annotations

from datetime import datetime, timezone

from submission_platform.domain.models import (
    AuditEvent,
    Submission,
    SubmissionStatus,
)
from submission_platform.domain.workflow import validate_transition
from submission_platform.infra.json_store import JsonStore

ENTITY_TYPE = "submissions"


async def create_submission(
    broker_email: str,
    subject: str,
    body_text: str,
    *,
    store: JsonStore,
    broker_name: str | None = None,
    message_id: str = "",
    body_html: str | None = None,
) -> Submission:
    """Create a new submission from an inbound email or manual entry."""
    # Duplicate detection by message_id
    if message_id:
        for existing in store.list_all(ENTITY_TYPE, Submission):
            if existing.message_id == message_id:
                return existing

    submission = Submission(
        broker_email=broker_email,
        broker_name=broker_name,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        message_id=message_id,
    )
    store.save(ENTITY_TYPE, submission.id, submission)

    # Audit
    store.save(
        "audit_events",
        None,
        AuditEvent(
            entity_type=ENTITY_TYPE,
            entity_id=submission.id,
            event_type="submission_created",
            payload={"broker_email": broker_email, "subject": subject},
        ),
    )

    return submission


async def get_submission(
    submission_id: str,
    *,
    store: JsonStore,
) -> Submission | None:
    """Look up a submission by ID."""
    return store.load(ENTITY_TYPE, submission_id, Submission)


async def list_submissions(
    *,
    store: JsonStore,
    status: SubmissionStatus | None = None,
    broker_email: str | None = None,
) -> list[Submission]:
    """List submissions, optionally filtering by status or broker. Excludes soft-deleted."""
    all_subs = store.list_all(ENTITY_TYPE, Submission)
    all_subs = [s for s in all_subs if not s.deleted]
    if status is not None:
        all_subs = [s for s in all_subs if s.status == status]
    if broker_email is not None:
        all_subs = [s for s in all_subs if s.broker_email == broker_email]
    return all_subs


async def transition_submission(
    submission_id: str,
    new_status: SubmissionStatus,
    *,
    store: JsonStore,
) -> Submission:
    """Move a submission to a new status (validates legal transitions)."""
    submission = store.load(ENTITY_TYPE, submission_id, Submission)
    if submission is None:
        raise ValueError(f"Submission {submission_id} not found")

    validate_transition(submission.status, new_status)

    old_status = submission.status
    submission.status = new_status
    submission.updated_at = datetime.now(timezone.utc)
    store.save(ENTITY_TYPE, submission.id, submission)

    # Audit
    store.save(
        "audit_events",
        None,
        AuditEvent(
            entity_type=ENTITY_TYPE,
            entity_id=submission.id,
            event_type="status_changed",
            payload={"from": old_status.value, "to": new_status.value},
        ),
    )

    return submission
