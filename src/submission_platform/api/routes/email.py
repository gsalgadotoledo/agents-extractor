from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from submission_platform.api.dependencies import get_app_settings
from submission_platform.config import Settings
from submission_platform.domain import email_service

router = APIRouter(prefix="/email", tags=["email"])


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str


class SendEmailResponse(BaseModel):
    success: bool


@router.post("/send", response_model=SendEmailResponse)
async def send_email_endpoint(
    payload: SendEmailRequest,
    settings: Settings = Depends(get_app_settings),
):
    ok = await email_service.send_email(
        to=payload.to,
        subject=payload.subject,
        body=payload.body,
        settings=settings,
    )
    return SendEmailResponse(success=ok)
