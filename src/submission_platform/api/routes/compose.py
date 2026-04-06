"""Email composition with AI tone assistance."""
from __future__ import annotations

import json
import operator
from typing import Annotated, TypedDict

from fastapi import APIRouter, Depends, HTTPException
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from pydantic import BaseModel

from submission_platform.api.dependencies import get_app_settings, get_store
from submission_platform.config import Settings
from submission_platform.domain import email_service, submissions
from submission_platform.domain.models import Submission
from submission_platform.infra.json_store import JsonStore
from submission_platform.infra.logging import get_logger

log = get_logger(__name__)
router = APIRouter(prefix="/submissions", tags=["compose"])

TONES = {
    "professional": "Write in a professional, formal business tone. Be courteous and direct.",
    "friendly": "Write in a warm, friendly but professional tone. Be approachable and helpful.",
    "concise": "Write in a brief, to-the-point tone. Minimize pleasantries, focus on the ask.",
    "detailed": "Write in a thorough, detailed tone. Explain exactly what's needed and why.",
    "mirror": "Mirror the tone and communication style of the original email sender.",
}

COMPOSE_PROMPT = """\
You are an insurance underwriting assistant composing a response email.

Context:
- Original email from: {from_addr}
- Subject: {subject}
- Extracted data summary: {extracted_summary}
- Missing fields: {missing_fields}
- Tone instruction: {tone_instruction}

{user_instruction}

Write a complete email reply. Include:
- A greeting
- Acknowledgment of their submission
- Clear list of what additional information is needed (if any)
- Professional closing

Return ONLY the email body text. No subject line, no headers.
"""


class GenerateDraftRequest(BaseModel):
    tone: str = "professional"
    custom_tone: str | None = None
    instruction: str = ""


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body_html: str
    body_text: str


@router.get("/{submission_id}/tones")
async def list_tones():
    return {"tones": TONES}


@router.post("/{submission_id}/compose/draft")
async def generate_draft(
    submission_id: str,
    payload: GenerateDraftRequest,
    store: JsonStore = Depends(get_store),
    settings: Settings = Depends(get_app_settings),
):
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    tone_instruction = payload.custom_tone or TONES.get(payload.tone, TONES["professional"])

    extracted = sub.extracted_data or {}
    missing = extracted.get("missing_fields", [])
    overview = extracted.get("overview", {})

    extracted_summary = json.dumps({
        "insured": overview.get("insured_name", "Unknown"),
        "coverage": extracted.get("coverage", {}).get("policy_type", "Unknown"),
        "confidence": sub.extraction_confidence,
    })

    prompt = COMPOSE_PROMPT.format(
        from_addr=sub.broker_email,
        subject=sub.subject,
        extracted_summary=extracted_summary,
        missing_fields=json.dumps(missing) if missing else "None — all information received",
        tone_instruction=tone_instruction,
        user_instruction=f"Additional instruction: {payload.instruction}" if payload.instruction else "",
    )

    llm = ChatAnthropic(
        model=settings.extraction_model,
        anthropic_api_key=settings.anthropic_api_key,
        temperature=0.3,
        max_tokens=2048,
    )

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    text = response.content if isinstance(response.content, str) else str(response.content)

    return {"draft": text, "tone": payload.tone}


@router.post("/{submission_id}/compose/send")
async def send_composed_email(
    submission_id: str,
    payload: SendEmailRequest,
    store: JsonStore = Depends(get_store),
    settings: Settings = Depends(get_app_settings),
):
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    ok = await email_service.send_email(
        to=payload.to,
        subject=payload.subject,
        body=payload.body_text,
        settings=settings,
    )

    return {"sent": ok, "to": payload.to, "subject": payload.subject}
