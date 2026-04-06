"""Gmail push notification routes.

Endpoints:
  POST /gmail/pubsub/webhook  -- receives Pub/Sub push notifications
  POST /gmail/sync            -- manual trigger for history.list sync
  POST /gmail/watch           -- register/renew push notification watch
  GET  /gmail/sync-state      -- inspect current historyId & expiration
"""
from __future__ import annotations

import base64
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from submission_platform.api.dependencies import get_app_settings, get_store
from submission_platform.config import Settings
from submission_platform.domain import gmail_push
from submission_platform.domain.models import GmailSyncState
from submission_platform.infra.json_store import JsonStore
from submission_platform.infra.logging import get_logger

log = get_logger(__name__)
router = APIRouter(prefix="/gmail", tags=["gmail"])


class SyncResponse(BaseModel):
    submission_ids: list[str]
    count: int


class WatchResponse(BaseModel):
    history_id: str
    expiration: str | None


# --- Pub/Sub webhook (production: receives push from Google) ---


@router.post("/pubsub/webhook")
async def pubsub_webhook(
    request: Request,
    store: JsonStore = Depends(get_store),
    settings: Settings = Depends(get_app_settings),
):
    """Receive push notification from Google Pub/Sub.

    Google POSTs: {"message": {"data": base64(...), ...}, "subscription": "..."}
    The data field decodes to: {"emailAddress": "...", "historyId": "..."}
    We use our stored historyId (not the notification's) as startHistoryId.
    """
    body = await request.json()

    # Optional: verify token
    if settings.gmail_pubsub_verification_token:
        token = request.query_params.get("token")
        if token != settings.gmail_pubsub_verification_token:
            raise HTTPException(status_code=403, detail="Invalid verification token")

    # Decode notification for logging
    message = body.get("message", {})
    data_b64 = message.get("data", "")
    if data_b64:
        data = json.loads(base64.b64decode(data_b64))
        log.info(
            "pubsub_notification",
            email=data.get("emailAddress"),
            history_id=data.get("historyId"),
        )

    # Process via history.list
    ids = await gmail_push.process_history(store=store, settings=settings)
    log.info("pubsub_processed", count=len(ids))

    # Must return 200 to acknowledge the Pub/Sub message
    return {"ok": True, "processed": len(ids)}


# --- Manual sync trigger ---


@router.post("/sync", response_model=SyncResponse)
async def gmail_sync_endpoint(
    store: JsonStore = Depends(get_store),
    settings: Settings = Depends(get_app_settings),
):
    """Trigger a manual sync via history.list."""
    ids = await gmail_push.process_history(store=store, settings=settings)
    return SyncResponse(submission_ids=ids, count=len(ids))


# --- Watch management ---


@router.post("/watch", response_model=WatchResponse)
async def register_watch(
    store: JsonStore = Depends(get_store),
    settings: Settings = Depends(get_app_settings),
):
    """Register or renew Gmail push notification watch."""
    state = await gmail_push.setup_watch(store=store, settings=settings)
    return WatchResponse(
        history_id=state.history_id,
        expiration=str(state.watch_expiration) if state.watch_expiration else None,
    )


@router.get("/sync-state")
async def get_sync_state(
    store: JsonStore = Depends(get_store),
):
    """Inspect current Gmail sync state (historyId, expiration, last sync)."""
    state = store.load("gmail_sync", "state", GmailSyncState)
    if state is None:
        raise HTTPException(
            status_code=404, detail="No sync state. Call POST /gmail/watch first."
        )
    return state.model_dump()
