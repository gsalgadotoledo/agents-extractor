"""Auto-reply service — responds to broker follow-up emails with status updates."""
from __future__ import annotations

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from submission_platform.config import Settings
from submission_platform.domain import email_service
from submission_platform.domain.models import Submission
from submission_platform.infra.json_store import JsonStore
from submission_platform.infra.logging import get_logger

log = get_logger(__name__)

AUTO_REPLY_PROMPT = """\
You are an insurance submission status assistant. A broker has sent a follow-up \
email about their submission. Write a brief, professional reply with the current status.

Do not use emojis. Keep the tone business-casual and helpful.

SUBMISSION DETAILS:
- Insured: {insured_name}
- Status: {status}
- Assigned to: {assigned_to}
- Confidence: {confidence}
- Missing items: {missing_count}
- Approved: {approved}
- Created: {created}

BROKER'S FOLLOW-UP EMAIL:
Subject: {subject}
Body: {body}

Write a reply that:
1. Acknowledges their follow-up
2. Gives the current status in plain language
3. If there are missing items, briefly mention what is still needed
4. If assigned, mention their submission is being reviewed by the team
5. Provide a realistic expectation of next steps

Return ONLY the email body text. No subject line, no headers. Keep it under 150 words.
"""


async def generate_auto_reply(
    submission: Submission,
    follow_up_subject: str,
    follow_up_body: str,
    *,
    store: JsonStore,
    settings: Settings,
) -> str | None:
    """Generate and send an automatic status reply to a broker follow-up."""
    if not settings.anthropic_api_key:
        return None

    from submission_platform.domain.assignment import ALL_USERS

    overview = (submission.extracted_data or {}).get("overview", {})
    missing = (submission.extracted_data or {}).get("missing_fields", [])
    assigned_name = ALL_USERS.get(submission.assigned_to, {}).get("name", "our team")

    prompt = AUTO_REPLY_PROMPT.format(
        insured_name=overview.get("insured_name", "your submission"),
        status=submission.status.value,
        assigned_to=assigned_name,
        confidence=f"{submission.extraction_confidence:.0%}" if submission.extraction_confidence else "pending",
        missing_count=len(missing),
        approved="Yes" if submission.approved_by else "No",
        created=submission.created_at.strftime("%B %d, %Y"),
        subject=follow_up_subject,
        body=follow_up_body[:500],
    )

    try:
        llm = ChatAnthropic(
            model=settings.extraction_model,
            anthropic_api_key=settings.anthropic_api_key,
            temperature=0.3,
            max_tokens=512,
        )
        response = await llm.ainvoke([
            SystemMessage(content="You write concise professional emails. No emojis."),
            HumanMessage(content=prompt),
        ])
        reply_body = response.content if isinstance(response.content, str) else str(response.content)

        # Send the reply
        ok = await email_service.send_email(
            to=submission.broker_email,
            subject=f"Re: {follow_up_subject}",
            body=reply_body,
            settings=settings,
        )

        if ok:
            submission.sent_emails.append({
                "to": submission.broker_email,
                "subject": f"Re: {follow_up_subject}",
                "body": reply_body,
                "sent_at": submission.created_at.isoformat(),
                "auto_reply": True,
            })
            submission.chat_history.append({
                "role": "system",
                "content": f"Auto-reply sent to {submission.broker_email} in response to follow-up: \"{follow_up_subject}\"",
            })
            store.save("submissions", submission.id, submission)
            log.info("auto_reply_sent", submission_id=submission.id, to=submission.broker_email)
            return reply_body

    except Exception as e:
        log.error("auto_reply_failed", submission_id=submission.id, error=str(e))

    return None
