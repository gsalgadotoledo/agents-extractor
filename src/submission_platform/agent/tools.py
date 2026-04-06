from __future__ import annotations

from langchain_core.tools import tool

from submission_platform.config import get_settings
from submission_platform.domain import email_service, extraction, gmail_push, submissions
from submission_platform.domain.models import SubmissionStatus
from submission_platform.infra.json_store import get_default_store


@tool
async def create_submission_tool(
    broker_email: str, subject: str, body_text: str
) -> str:
    """Create a new insurance submission from broker email details.

    Args:
        broker_email: The broker's email address.
        subject: The email subject line.
        body_text: The full email body text.
    """
    store = get_default_store()
    result = await submissions.create_submission(
        broker_email=broker_email, subject=subject, body_text=body_text, store=store
    )
    return f"Created submission {result.id} (status: {result.status.value})"


@tool
async def list_submissions_tool(status: str | None = None) -> str:
    """List insurance submissions, optionally filtered by status.

    Args:
        status: Filter by status (received, ack_sent, extracting, extracted, etc).
    """
    store = get_default_store()
    status_enum = SubmissionStatus(status) if status else None
    items = await submissions.list_submissions(store=store, status=status_enum)
    if not items:
        return "No submissions found."
    lines = [
        f"- {s.id[:8]}: [{s.status.value}] from {s.broker_email} -- {s.subject}"
        for s in items
    ]
    return "\n".join(lines)


@tool
async def get_submission_tool(submission_id: str) -> str:
    """Get details of a specific submission by ID.

    Args:
        submission_id: The submission UUID.
    """
    store = get_default_store()
    sub = await submissions.get_submission(submission_id, store=store)
    if not sub:
        return f"No submission found with ID {submission_id}"
    return sub.model_dump_json(indent=2)


@tool
async def send_email_tool(to: str, subject: str, body: str) -> str:
    """Send an email through the platform's SMTP relay.

    Args:
        to: Recipient email address.
        subject: Email subject line.
        body: Email body text.
    """
    settings = get_settings()
    ok = await email_service.send_email(to=to, subject=subject, body=body, settings=settings)
    return "Email sent successfully." if ok else "Failed to send email."


@tool
async def extract_submission_tool(submission_id: str) -> str:
    """Extract structured data from a submission using AI.

    Args:
        submission_id: The submission UUID to extract data from.
    """
    store = get_default_store()
    settings = get_settings()
    result = await extraction.extract_submission_data(
        submission_id, store=store, settings=settings
    )
    return result.model_dump_json(indent=2)


@tool
async def transition_submission_tool(submission_id: str, new_status: str) -> str:
    """Transition a submission to a new workflow status.

    Args:
        submission_id: The submission UUID.
        new_status: Target status (received, ack_sent, extracting, extracted, etc).
    """
    store = get_default_store()
    try:
        result = await submissions.transition_submission(
            submission_id, SubmissionStatus(new_status), store=store
        )
        return f"Submission {result.id[:8]} transitioned to {result.status.value}"
    except Exception as e:
        return f"Error: {e}"


@tool
async def sync_gmail_tool() -> str:
    """Sync Gmail inbox for new emails using the Gmail API history sync.

    Fetches any messages that arrived since the last sync point
    and creates submissions from them.
    """
    store = get_default_store()
    settings = get_settings()
    ids = await gmail_push.process_history(store=store, settings=settings)
    if not ids:
        return "No new emails found in Gmail."
    return f"Processed {len(ids)} email(s). Submission IDs: {', '.join(i[:8] for i in ids)}"


@tool
async def register_gmail_watch_tool() -> str:
    """Register or renew Gmail push notification watch.

    Sets up Google to send notifications when new emails arrive.
    Should be called once at setup; auto-renews daily when the API server runs.
    """
    store = get_default_store()
    settings = get_settings()
    state = await gmail_push.setup_watch(store=store, settings=settings)
    return (
        f"Watch registered. historyId={state.history_id}, "
        f"expires={state.watch_expiration}"
    )


ALL_TOOLS = [
    create_submission_tool,
    list_submissions_tool,
    get_submission_tool,
    send_email_tool,
    extract_submission_tool,
    transition_submission_tool,
    sync_gmail_tool,
    register_gmail_watch_tool,
]
