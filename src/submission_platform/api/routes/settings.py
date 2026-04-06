from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from submission_platform.api.dependencies import get_app_settings
from submission_platform.config import Settings
from submission_platform.domain.extraction import AGENT_SYSTEM_PROMPT, AVAILABLE_MODELS
from submission_platform.domain.schemas import ExtractedSubmission

router = APIRouter(prefix="/settings", tags=["settings"])


class AppSettingsResponse(BaseModel):
    extraction_model: str
    available_models: list[str]
    gmail_address: str
    gmail_reconciler_interval_seconds: int
    extraction_prompt: str
    extraction_schema: dict
    has_anthropic_key: bool
    has_openai_key: bool
    email_from_name: str
    email_from_address: str


class UpdateSettingsRequest(BaseModel):
    extraction_model: str | None = None
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    extraction_prompt: str | None = None
    email_from_name: str | None = None
    email_from_address: str | None = None


# In-memory override for the extraction prompt
_prompt_override: str | None = None


def get_extraction_prompt() -> str:
    return _prompt_override or AGENT_SYSTEM_PROMPT


@router.get("/", response_model=AppSettingsResponse)
async def get_settings_endpoint(settings: Settings = Depends(get_app_settings)):
    return AppSettingsResponse(
        extraction_model=settings.extraction_model,
        available_models=AVAILABLE_MODELS,
        gmail_address=settings.gmail_address,
        gmail_reconciler_interval_seconds=settings.gmail_reconciler_interval_seconds,
        extraction_prompt=get_extraction_prompt(),
        extraction_schema=ExtractedSubmission.model_json_schema(),
        has_anthropic_key=bool(settings.anthropic_api_key),
        has_openai_key=bool(settings.openai_api_key),
        email_from_name=settings.email_from_name,
        email_from_address=settings.email_from_address,
    )


@router.put("/")
async def update_settings_endpoint(
    payload: UpdateSettingsRequest,
    settings: Settings = Depends(get_app_settings),
):
    global _prompt_override

    if payload.extraction_model and payload.extraction_model in AVAILABLE_MODELS:
        settings.extraction_model = payload.extraction_model
    if payload.anthropic_api_key is not None:
        settings.anthropic_api_key = payload.anthropic_api_key
    if payload.openai_api_key is not None:
        settings.openai_api_key = payload.openai_api_key
    if payload.extraction_prompt is not None:
        _prompt_override = payload.extraction_prompt if payload.extraction_prompt.strip() else None
    if payload.email_from_name is not None:
        settings.email_from_name = payload.email_from_name
    if payload.email_from_address is not None:
        settings.email_from_address = payload.email_from_address

    return {
        "extraction_model": settings.extraction_model,
        "has_anthropic_key": bool(settings.anthropic_api_key),
        "has_openai_key": bool(settings.openai_api_key),
        "extraction_prompt": get_extraction_prompt(),
        "email_from_name": settings.email_from_name,
        "email_from_address": settings.email_from_address,
    }


@router.post("/reset-prompt")
async def reset_prompt():
    """Reset extraction prompt to default."""
    global _prompt_override
    _prompt_override = None
    return {"extraction_prompt": AGENT_SYSTEM_PROMPT}
