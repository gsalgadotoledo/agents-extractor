from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from submission_platform.api.routes import attachments, chat, compose, documents, email, gmail, health, personas, settings, submissions
from submission_platform.config import get_settings
from submission_platform.infra.json_store import get_default_store
from submission_platform.infra.logging import get_logger, setup_logging

log = get_logger(__name__)


async def _watch_renewal_loop():
    """Renew Gmail watch every 24 hours."""
    from submission_platform.domain import gmail_push

    store = get_default_store()
    settings = get_settings()
    while True:
        try:
            await gmail_push.setup_watch(store=store, settings=settings)
            log.info("watch_renewed")
        except Exception as e:
            log.error("watch_renewal_failed", error=str(e))
        await asyncio.sleep(86400)  # 24 hours


async def _reconciler_loop():
    """Safety-net: process_history every N minutes regardless of push."""
    from submission_platform.domain import gmail_push

    store = get_default_store()
    settings = get_settings()
    interval = settings.gmail_reconciler_interval_seconds
    while True:
        await asyncio.sleep(interval)
        try:
            ids = await gmail_push.process_history(store=store, settings=settings)
            if ids:
                log.info("reconciler_found_messages", count=len(ids))
        except Exception as e:
            log.error("reconciler_failed", error=str(e))


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    tasks = []
    if settings.google_refresh_token and settings.gmail_pubsub_topic:
        tasks.append(asyncio.create_task(_watch_renewal_loop()))
        tasks.append(asyncio.create_task(_reconciler_loop()))
        log.info("gmail_push_background_started")
    else:
        log.info("gmail_push_not_configured_skipping_background_tasks")
    yield
    for t in tasks:
        t.cancel()


def create_app() -> FastAPI:
    setup_logging()
    app = FastAPI(
        title="Submission Platform",
        description="Email-driven insurance submission platform",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:5174"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(submissions.router)
    app.include_router(email.router)
    app.include_router(gmail.router)
    app.include_router(settings.router)
    app.include_router(attachments.router)
    app.include_router(chat.router)
    app.include_router(compose.router)
    app.include_router(documents.router)
    app.include_router(personas.router)
    return app


app = create_app()


def run() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "submission_platform.api.app:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )
