from __future__ import annotations

import base64
from email.message import EmailMessage

import aiosmtplib

from submission_platform.config import Settings
from submission_platform.infra.logging import get_logger

log = get_logger(__name__)


def _format_from(settings: Settings) -> str:
    return f"{settings.email_from_name} <{settings.email_from_address}>"


async def send_email(
    to: str,
    subject: str,
    body: str,
    *,
    settings: Settings,
    from_addr: str | None = None,
) -> bool:
    """Send email. Uses Gmail API if OAuth is configured, otherwise SMTP."""
    if settings.google_refresh_token and settings.google_client_id:
        return await _send_via_gmail_api(to, subject, body, from_addr, settings)
    return await _send_via_smtp(to, subject, body, from_addr, settings)


async def _send_via_gmail_api(
    to: str, subject: str, body: str, from_addr: str | None, settings: Settings
) -> bool:
    """Send email using Gmail API with OAuth2 — no App Password needed."""
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=settings.google_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            scopes=["https://www.googleapis.com/auth/gmail.send"],
        )
        service = build("gmail", "v1", credentials=creds)

        msg = EmailMessage()
        msg["From"] = from_addr or _format_from(settings)
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
        service.users().messages().send(
            userId="me",
            body={"raw": raw},
        ).execute()

        log.info("email_sent_gmail_api", to=to, subject=subject)
        return True
    except Exception as e:
        log.error("email_send_failed_gmail_api", to=to, error=str(e))
        return False


async def _send_via_smtp(
    to: str, subject: str, body: str, from_addr: str | None, settings: Settings
) -> bool:
    """Send email via SMTP (Mailpit or authenticated SMTP)."""
    msg = EmailMessage()
    msg["From"] = from_addr or _format_from(settings)
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        kwargs: dict = {
            "hostname": settings.smtp_host,
            "port": settings.smtp_port,
        }
        if settings.smtp_use_tls:
            kwargs["start_tls"] = True
        if settings.smtp_username and settings.smtp_password:
            kwargs["username"] = settings.smtp_username
            kwargs["password"] = settings.smtp_password

        await aiosmtplib.send(msg, **kwargs)
        log.info("email_sent_smtp", to=to, subject=subject)
        return True
    except Exception as e:
        log.error("email_send_failed_smtp", to=to, error=str(e))
        return False


async def send_submission_acknowledgment(
    broker_email: str,
    submission_id: str,
    *,
    settings: Settings,
) -> bool:
    return await send_email(
        to=broker_email,
        subject="Submission Received - We're On It",
        body=(
            f"Thank you for your submission.\n\n"
            f"We have received your request and it is being processed.\n"
            f"Your reference number is: {submission_id}\n\n"
            f"We will follow up shortly.\n\n"
            f"Best regards,\n"
            f"{settings.email_from_name}\n"
        ),
        settings=settings,
    )
