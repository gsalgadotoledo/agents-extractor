"""Smart deduplication — determines if an incoming email belongs to an existing submission."""
from __future__ import annotations

import json

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from submission_platform.config import Settings
from submission_platform.domain.models import Submission
from submission_platform.infra.json_store import JsonStore
from submission_platform.infra.logging import get_logger

log = get_logger(__name__)

DEDUP_PROMPT = """\
You are an insurance submission deduplication agent. Given a new incoming email \
and a list of existing submissions, determine if the new email is:

1. A FOLLOW-UP to an existing submission (same broker + same insured/topic)
2. A completely NEW submission

Analyze:
- Sender email address (same broker = strong signal)
- Subject line (Re:, Fwd:, or references to same insured name)
- Email body (mentions same company, policy, or references prior conversation)
- Insured name if extractable

Return JSON:
{{
  "decision": "follow_up" | "new",
  "matched_submission_id": "id-if-follow-up" | null,
  "confidence": 0.0-1.0,
  "reason": "explanation"
}}

Only return "follow_up" if you are reasonably confident (>0.7). When in doubt, return "new".
Return ONLY valid JSON.
"""


async def check_dedup(
    broker_email: str,
    subject: str,
    body_text: str,
    *,
    store: JsonStore,
    settings: Settings,
) -> dict:
    """Check if incoming email matches an existing submission.

    Returns: {"decision": "follow_up"|"new", "matched_submission_id": str|None, "confidence": float, "reason": str}
    """
    existing = store.list_all("submissions", Submission)
    if not existing:
        return {"decision": "new", "matched_submission_id": None, "confidence": 1.0, "reason": "No existing submissions"}

    # Quick check: exact broker email match
    same_broker = [s for s in existing if s.broker_email.lower().strip() == broker_email.lower().strip()
                   or broker_email.lower().strip() in s.broker_email.lower()]

    if not same_broker:
        return {"decision": "new", "matched_submission_id": None, "confidence": 0.9, "reason": "No submissions from this broker"}

    # Build context for the LLM
    existing_summary = []
    for s in same_broker[:10]:  # limit to 10 most relevant
        insured = ""
        if s.extracted_data and "overview" in s.extracted_data:
            insured = s.extracted_data["overview"].get("insured_name", "")
        existing_summary.append({
            "id": s.id,
            "broker_email": s.broker_email,
            "subject": s.subject,
            "insured_name": insured,
            "status": s.status.value,
            "created_at": s.created_at.isoformat(),
            "body_preview": s.body_text[:200] if s.body_text else "",
        })

    prompt = f"""NEW INCOMING EMAIL:
From: {broker_email}
Subject: {subject}
Body: {body_text[:500]}

EXISTING SUBMISSIONS FROM THIS BROKER:
{json.dumps(existing_summary, indent=2)}

Determine if this new email is a follow-up to one of the existing submissions or a new one."""

    if not settings.anthropic_api_key:
        # Fallback: simple heuristic
        return _heuristic_dedup(broker_email, subject, same_broker)

    try:
        llm = ChatAnthropic(
            model=settings.extraction_model,
            anthropic_api_key=settings.anthropic_api_key,
            temperature=0,
            max_tokens=512,
        )
        response = await llm.ainvoke([
            SystemMessage(content=DEDUP_PROMPT),
            HumanMessage(content=prompt),
        ])
        raw = response.content if isinstance(response.content, str) else str(response.content)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(raw)
        log.info("dedup_result", decision=result.get("decision"), confidence=result.get("confidence"), matched=result.get("matched_submission_id"))
        return result
    except Exception as e:
        log.error("dedup_failed", error=str(e))
        return _heuristic_dedup(broker_email, subject, same_broker)


def _heuristic_dedup(broker_email: str, subject: str, same_broker: list[Submission]) -> dict:
    """Simple heuristic fallback when LLM is unavailable."""
    subject_lower = subject.lower().strip()

    # Check for Re: or Fwd: patterns
    is_reply = subject_lower.startswith(("re:", "fwd:", "fw:"))
    if is_reply:
        clean_subject = subject_lower.removeprefix("re:").removeprefix("fwd:").removeprefix("fw:").strip()
        for s in same_broker:
            if clean_subject in s.subject.lower():
                return {
                    "decision": "follow_up",
                    "matched_submission_id": s.id,
                    "confidence": 0.8,
                    "reason": f"Reply/forward to existing submission (subject match: '{s.subject}')",
                }

    # Check for same subject
    for s in same_broker:
        if subject_lower == s.subject.lower().strip():
            return {
                "decision": "follow_up",
                "matched_submission_id": s.id,
                "confidence": 0.7,
                "reason": f"Same subject as existing submission",
            }

    return {"decision": "new", "matched_submission_id": None, "confidence": 0.6, "reason": "No strong match found (same broker, different subject)"}
