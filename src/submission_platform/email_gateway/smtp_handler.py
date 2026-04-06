from __future__ import annotations

import asyncio

from aiosmtpd.controller import Controller
from aiosmtpd.handlers import AsyncMessage

from submission_platform.config import get_settings
from submission_platform.domain import email_service, extraction, submissions
from submission_platform.infra.json_store import get_default_store
from submission_platform.infra.logging import get_logger, setup_logging

log = get_logger(__name__)


class SubmissionHandler(AsyncMessage):
    async def handle_message(self, message):
        store = get_default_store()
        settings = get_settings()

        from_addr = message.get("From", "unknown@unknown.com")
        subject = message.get("Subject", "(no subject)")
        message_id = message.get("Message-ID", "")

        # Extract body
        if message.is_multipart():
            body_parts = []
            for part in message.walk():
                if part.get_content_type() == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        body_parts.append(payload.decode("utf-8", errors="replace"))
            body = "\n".join(body_parts)
        else:
            payload = message.get_payload(decode=True)
            body = payload.decode("utf-8", errors="replace") if payload else ""

        log.info("inbound_email_received", from_addr=from_addr, subject=subject)

        # Create submission via domain service
        sub = await submissions.create_submission(
            broker_email=from_addr,
            subject=subject,
            body_text=body,
            message_id=message_id,
            store=store,
        )

        log.info("submission_created", submission_id=sub.id)

        # Send acknowledgment
        ok = await email_service.send_submission_acknowledgment(
            broker_email=from_addr,
            submission_id=sub.id,
            settings=settings,
        )
        if ok:
            log.info("ack_sent", submission_id=sub.id, to=from_addr)
        else:
            log.error("ack_failed", submission_id=sub.id, to=from_addr)

        # Auto-extract
        if settings.anthropic_api_key:
            try:
                await extraction.extract_submission_data(
                    sub.id, store=store, settings=settings
                )
                log.info("auto_extraction_completed", submission_id=sub.id)
            except Exception as e:
                log.error("auto_extraction_failed", submission_id=sub.id, error=str(e))


def run() -> None:
    setup_logging()
    settings = get_settings()
    controller = Controller(
        SubmissionHandler(),
        hostname=settings.inbound_smtp_host,
        port=settings.inbound_smtp_port,
    )
    controller.start()
    log = get_logger("smtp_gateway")
    log.info(
        "inbound_smtp_started",
        host=settings.inbound_smtp_host,
        port=settings.inbound_smtp_port,
    )
    try:
        asyncio.get_event_loop().run_forever()
    except KeyboardInterrupt:
        controller.stop()
