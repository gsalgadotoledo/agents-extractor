"""Slack notification service — posts submission updates to #submissions channel."""
from __future__ import annotations

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from submission_platform.config import Settings
from submission_platform.domain.assignment import ALL_USERS
from submission_platform.domain.models import Submission
from submission_platform.infra.logging import get_logger

log = get_logger(__name__)


def _get_client(settings: Settings) -> WebClient | None:
    if not settings.slack_bot_token:
        return None
    return WebClient(token=settings.slack_bot_token)


async def notify_new_submission(
    submission: Submission,
    *,
    settings: Settings,
) -> bool:
    """Post a notification to #submissions after extraction + assignment."""
    client = _get_client(settings)
    if client is None:
        log.info("slack_skipped", reason="no bot token configured")
        return False

    extracted = submission.extracted_data or {}
    overview = extracted.get("overview", {})
    coverage = extracted.get("coverage", {})
    loss_runs = extracted.get("loss_runs", {})

    insured = overview.get("insured_name", "Unknown")
    policy_type = coverage.get("policy_type", "N/A")
    occ_limit = coverage.get("each_occurrence_limit", "N/A")
    confidence = f"{submission.extraction_confidence:.0%}" if submission.extraction_confidence else "N/A"
    rep = ALL_USERS.get(submission.assigned_to, {})
    rep_name = rep.get("name", "Unassigned")
    rep_role = rep.get("role", "")
    has_loss_runs = "Yes" if loss_runs.get("present") else "No"
    years = loss_runs.get("years_covered", 0)

    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": "New Submission Received"}
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Client*\n{insured}"},
                {"type": "mrkdwn", "text": f"*Coverage*\n{policy_type}"},
                {"type": "mrkdwn", "text": f"*Limit*\n{occ_limit}"},
                {"type": "mrkdwn", "text": f"*Confidence*\n{confidence}"},
                {"type": "mrkdwn", "text": f"*Assigned*\n{rep_name} ({rep_role})"},
                {"type": "mrkdwn", "text": f"*Loss Runs*\n{has_loss_runs} ({years}yr)"},
            ]
        },
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"Broker: {submission.broker_email} | Ref: {submission.id[:8]} | <http://localhost:5173/submissions/{submission.id}|View in app>"}
            ]
        },
    ]

    try:
        client.chat_postMessage(
            channel=settings.slack_channel,
            blocks=blocks,
            text=f"New submission from {submission.broker_email}: {insured} — {policy_type} {occ_limit}",
        )
        log.info("slack_notification_sent", submission_id=submission.id, channel=settings.slack_channel)
        return True
    except SlackApiError as e:
        log.error("slack_notification_failed", error=str(e), submission_id=submission.id)
        return False
