from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid.uuid4())


class SubmissionStatus(str, enum.Enum):
    RECEIVED = "received"
    ACK_SENT = "ack_sent"
    PARSING = "parsing"
    EXTRACTING = "extracting"
    EXTRACTED = "extracted"
    VALIDATED = "validated"
    NEEDS_REVIEW = "needs_review"
    AUTO_POLICY_READY = "auto_policy_ready"
    POLICY_CREATED = "policy_created"
    OUTBOUND_EMAIL_PENDING = "outbound_email_pending"
    COMPLETED = "completed"
    FAILED = "failed"


class Attachment(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"
    size_bytes: int = 0
    storage_path: str = ""


class Submission(BaseModel):
    id: str = Field(default_factory=_new_id)
    status: SubmissionStatus = SubmissionStatus.RECEIVED
    message_id: str = ""
    broker_email: str
    broker_name: str | None = None
    subject: str
    body_text: str
    body_html: str | None = None
    attachments: list[Attachment] = []
    extracted_data: dict | None = None
    extraction_confidence: float | None = None
    validation_result: dict | None = None
    review_required: bool = False
    review_reason: str | None = None
    application_id: str | None = None
    policy_id: str | None = None
    related_submission_ids: list[str] = []
    relation_reason: str | None = None
    assigned_to: str | None = None
    persona_id: str | None = None
    approved_by: str | None = None
    approved_at: datetime | None = None
    sent_emails: list[dict] = []
    chat_history: list[dict] = []
    deleted: bool = False
    deleted_at: datetime | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class Policy(BaseModel):
    id: str = Field(default_factory=_new_id)
    submission_id: str
    status: str = "draft"
    effective_date: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    created_by: str = "system"
    draft_email_id: str | None = None


class Review(BaseModel):
    id: str = Field(default_factory=_new_id)
    submission_id: str
    type: str = "manual_review"
    reason: str = ""
    assigned_to: str | None = None
    status: str = "pending"
    decision: str | None = None
    notes: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class OutboundEmail(BaseModel):
    id: str = Field(default_factory=_new_id)
    submission_id: str
    to: str
    subject: str
    body_text: str
    body_html: str | None = None
    status: str = "draft"
    approval_required: bool = True
    approved_by: str | None = None
    approved_at: datetime | None = None
    sent_at: datetime | None = None
    created_at: datetime = Field(default_factory=_utcnow)


class AuditEvent(BaseModel):
    id: str = Field(default_factory=_new_id)
    entity_type: str
    entity_id: str
    event_type: str
    timestamp: datetime = Field(default_factory=_utcnow)
    payload: dict = {}


class ExtractionResult(BaseModel):
    data: dict = {}
    missing_fields: list[str] = []
    confidence: float = 0.0
    evidence: list[dict] = []
    warnings: list[str] = []


class GmailSyncState(BaseModel):
    """Persisted state for Gmail push notification sync."""
    email_address: str = ""
    history_id: str = ""
    watch_expiration: datetime | None = None
    last_sync_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
