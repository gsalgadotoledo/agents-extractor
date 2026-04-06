"""Gmail API push notification sync service.

Replaces IMAP polling with:
  - users.watch() registration for push notifications via Pub/Sub
  - history.list() incremental sync using persisted historyId
  - Full sync fallback when historyId expires (404)
"""
from __future__ import annotations

import base64
from datetime import datetime, timezone

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from submission_platform.config import Settings
from submission_platform.domain import dedup, email_service, extraction, submissions
from submission_platform.domain.models import Attachment, GmailSyncState
from submission_platform.infra.json_store import JsonStore
from submission_platform.infra.logging import get_logger

log = get_logger(__name__)

SYNC_STATE_ENTITY = "gmail_sync"
SYNC_STATE_ID = "state"


def _build_gmail_service(settings: Settings):
    """Build an authenticated Gmail API service using OAuth2 refresh token."""
    creds = Credentials(
        token=None,
        refresh_token=settings.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
    )
    return build("gmail", "v1", credentials=creds)


def _load_sync_state(store: JsonStore) -> GmailSyncState | None:
    return store.load(SYNC_STATE_ENTITY, SYNC_STATE_ID, GmailSyncState)


def _save_sync_state(store: JsonStore, state: GmailSyncState) -> None:
    state.updated_at = datetime.now(timezone.utc)
    store.save(SYNC_STATE_ENTITY, SYNC_STATE_ID, state)


# ---------------------------------------------------------------------------
# Watch management
# ---------------------------------------------------------------------------


async def setup_watch(*, store: JsonStore, settings: Settings) -> GmailSyncState:
    """Call users.watch() to register push notifications.

    Returns the updated sync state with historyId and expiration.
    Must be renewed at least every 7 days (we do it daily).
    """
    service = _build_gmail_service(settings)
    result = service.users().watch(
        userId="me",
        body={
            "topicName": settings.gmail_pubsub_topic,
            "labelIds": settings.gmail_label_ids,
        },
    ).execute()

    state = _load_sync_state(store)
    if state is None:
        state = GmailSyncState(
            email_address=settings.gmail_address,
            history_id=result["historyId"],
        )
    elif not state.history_id:
        state.history_id = result["historyId"]

    state.watch_expiration = datetime.fromtimestamp(
        int(result["expiration"]) / 1000, tz=timezone.utc
    )
    _save_sync_state(store, state)
    log.info(
        "gmail_watch_registered",
        history_id=state.history_id,
        expiration=str(state.watch_expiration),
    )
    return state


async def stop_watch(*, settings: Settings) -> None:
    """Stop receiving push notifications."""
    service = _build_gmail_service(settings)
    service.users().stop(userId="me").execute()
    log.info("gmail_watch_stopped")


# ---------------------------------------------------------------------------
# History sync
# ---------------------------------------------------------------------------


async def process_history(*, store: JsonStore, settings: Settings) -> list[str]:
    """Fetch new messages via history.list() since last historyId.

    Returns list of created submission IDs.
    """
    state = _load_sync_state(store)
    if state is None or not state.history_id:
        log.warning("no_sync_state", hint="Call setup_watch first")
        return []

    service = _build_gmail_service(settings)
    submission_ids: list[str] = []

    try:
        new_message_ids = _fetch_history_message_ids(
            service, state.history_id, settings.gmail_label_ids
        )
    except HttpError as e:
        if e.resp.status == 404:
            log.warning("history_expired_doing_full_sync")
            new_message_ids = _full_sync_message_ids(service, max_results=50)
            profile = service.users().getProfile(userId="me").execute()
            state.history_id = profile["historyId"]
            _save_sync_state(store, state)
        else:
            raise

    for msg_id in new_message_ids:
        try:
            sid = await _fetch_and_process_message(
                service, msg_id, store=store, settings=settings
            )
            if sid:
                submission_ids.append(sid)
        except Exception as e:
            log.error("gmail_process_message_failed", message_id=msg_id, error=str(e))

    # Advance historyId after successful processing
    if new_message_ids:
        profile = service.users().getProfile(userId="me").execute()
        state.history_id = profile["historyId"]
        state.last_sync_at = datetime.now(timezone.utc)
        _save_sync_state(store, state)

    return submission_ids


def _fetch_history_message_ids(
    service,
    start_history_id: str,
    label_ids: list[str],
) -> list[str]:
    """Use history.list to get message IDs added since startHistoryId."""
    message_ids: list[str] = []
    request = service.users().history().list(
        userId="me",
        startHistoryId=start_history_id,
        historyTypes=["messageAdded"],
        labelId=label_ids[0] if label_ids else "INBOX",
    )
    while request is not None:
        response = request.execute()
        for record in response.get("history", []):
            for msg_added in record.get("messagesAdded", []):
                message_ids.append(msg_added["message"]["id"])
        request = service.users().history().list_next(request, response)
    return list(dict.fromkeys(message_ids))  # deduplicate, preserve order


def _full_sync_message_ids(service, max_results: int = 50) -> list[str]:
    """Fallback: list recent messages from INBOX."""
    result = (
        service.users()
        .messages()
        .list(userId="me", labelIds=["INBOX"], maxResults=max_results)
        .execute()
    )
    return [m["id"] for m in result.get("messages", [])]


# ---------------------------------------------------------------------------
# Message processing
# ---------------------------------------------------------------------------


async def _fetch_and_process_message(
    service,
    message_id: str,
    *,
    store: JsonStore,
    settings: Settings,
) -> str | None:
    """Fetch a single message by ID via Gmail API and create a submission."""
    msg = (
        service.users()
        .messages()
        .get(userId="me", id=message_id, format="full")
        .execute()
    )

    headers = {h["name"].lower(): h["value"] for h in msg["payload"]["headers"]}
    from_addr = headers.get("from", "")
    subject = headers.get("subject", "(no subject)")
    gmail_message_id = headers.get("message-id", message_id)

    # Skip system/bounce emails that should not be processed
    SKIP_SUBJECTS = [
        "delivery status notification",
        "undeliverable",
        "mail delivery failed",
        "returned mail",
        "failure notice",
        "auto-reply",
        "automatic reply",
        "out of office",
        "submission received",
    ]
    subject_lower = subject.lower()
    from_lower = from_addr.lower()
    if any(skip in subject_lower for skip in SKIP_SUBJECTS) or "mailer-daemon" in from_lower or "postmaster" in from_lower:
        log.info("email_skipped", subject=subject, from_addr=from_addr, reason="system/bounce email")
        return None

    body_text = _extract_body_from_payload(msg["payload"], "text/plain")
    body_html = _extract_body_from_payload(msg["payload"], "text/html")

    # Smart dedup: check if this email belongs to an existing submission
    dedup_result = await dedup.check_dedup(
        broker_email=from_addr,
        subject=subject,
        body_text=body_text or "",
        store=store,
        settings=settings,
    )

    if dedup_result["decision"] == "follow_up" and dedup_result.get("matched_submission_id"):
        matched_id = dedup_result["matched_submission_id"]
        from submission_platform.domain.models import Submission as SubModel
        matched = store.load("submissions", matched_id, SubModel)
        if matched:
            log.info("dedup_follow_up", matched_id=matched_id, reason=dedup_result.get("reason"))
            # Create the new submission but link it
            sub = await submissions.create_submission(
                broker_email=from_addr,
                subject=subject,
                body_text=body_text or "",
                body_html=body_html,
                message_id=gmail_message_id,
                store=store,
            )
            # Link both ways
            sub.related_submission_ids = [matched_id]
            sub.relation_reason = dedup_result.get("reason", "Follow-up detected")
            # Add chat history entry about the link
            sub.chat_history.append({
                "role": "system",
                "content": f"This submission was automatically linked to {matched_id[:8]} — {dedup_result.get('reason', 'follow-up detected')} (confidence: {dedup_result.get('confidence', 0):.0%})",
            })
            store.save("submissions", sub.id, sub)

            if matched_id not in matched.related_submission_ids:
                matched.related_submission_ids.append(sub.id)
                matched.chat_history.append({
                    "role": "system",
                    "content": f"New follow-up email received and linked as {sub.id[:8]} — {subject}",
                })
                store.save("submissions", matched.id, matched)

            # Auto-reply to broker with status of the matched submission
            try:
                from submission_platform.domain.auto_reply import generate_auto_reply
                await generate_auto_reply(
                    matched, subject, body_text or "",
                    store=store, settings=settings,
                )
            except Exception as e:
                log.error("auto_reply_failed", error=str(e))
        else:
            # Matched ID not found, treat as new
            sub = await submissions.create_submission(
                broker_email=from_addr, subject=subject, body_text=body_text or "",
                body_html=body_html, message_id=gmail_message_id, store=store,
            )
    else:
        sub = await submissions.create_submission(
            broker_email=from_addr,
            subject=subject,
            body_text=body_text or "",
            body_html=body_html,
            message_id=gmail_message_id,
            store=store,
        )
        if dedup_result.get("matched_submission_id") and dedup_result.get("confidence", 0) > 0.4:
            # Low confidence match — link but don't merge
            sub.related_submission_ids = [dedup_result["matched_submission_id"]]
            sub.relation_reason = f"Possible duplicate (confidence: {dedup_result.get('confidence', 0):.0%})"
            store.save("submissions", sub.id, sub)

    # Download attachments
    attachments = _download_attachments(service, message_id, msg["payload"], sub.id, store)
    if attachments:
        sub.attachments = attachments
        store.save("submissions", sub.id, sub)

    # Auto-assign representative
    from submission_platform.domain.assignment import auto_assign
    auto_assign(sub, store)

    # Send acknowledgment
    ok = await email_service.send_submission_acknowledgment(
        broker_email=from_addr,
        submission_id=sub.id,
        settings=settings,
    )
    if ok:
        log.info("ack_sent", submission_id=sub.id)

    # Auto-extract structured data using Claude
    if settings.anthropic_api_key:
        try:
            await extraction.extract_submission_data(
                sub.id, store=store, settings=settings
            )
            log.info("auto_extraction_completed", submission_id=sub.id)

            # Reload submission with extracted data and notify Slack
            sub = store.load("submissions", sub.id, Submission)
            if sub:
                from submission_platform.domain import slack_service
                await slack_service.notify_new_submission(sub, settings=settings)
        except Exception as e:
            log.error("auto_extraction_failed", submission_id=sub.id, error=str(e))

    return sub.id


def _extract_body_from_payload(payload: dict, mime_type: str) -> str | None:
    """Recursively extract body of a given MIME type from Gmail API payload."""
    if payload.get("mimeType") == mime_type and payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode(
            "utf-8", errors="replace"
        )
    for part in payload.get("parts", []):
        result = _extract_body_from_payload(part, mime_type)
        if result:
            return result
    return None


def _download_attachments(
    service,
    message_id: str,
    payload: dict,
    submission_id: str,
    store: JsonStore,
) -> list[Attachment]:
    """Download attachments from a Gmail message."""
    attachments = []
    for part in payload.get("parts", []):
        filename = part.get("filename")
        if not filename:
            continue
        attachment_id = part.get("body", {}).get("attachmentId")
        if not attachment_id:
            continue

        att_data = (
            service.users()
            .messages()
            .attachments()
            .get(userId="me", messageId=message_id, id=attachment_id)
            .execute()
        )
        raw_bytes = base64.urlsafe_b64decode(att_data["data"])

        attach_dir = store._base_dir / "attachments" / submission_id
        attach_dir.mkdir(parents=True, exist_ok=True)
        attach_path = attach_dir / filename
        attach_path.write_bytes(raw_bytes)

        attachments.append(
            Attachment(
                filename=filename,
                content_type=part.get("mimeType", "application/octet-stream"),
                size_bytes=len(raw_bytes),
                storage_path=str(attach_path),
            )
        )
        log.info("attachment_saved", filename=filename, size=len(raw_bytes))

    return attachments
