from __future__ import annotations

from submission_platform.config import Settings, get_settings
from submission_platform.infra.json_store import JsonStore, get_default_store


def get_store() -> JsonStore:
    return get_default_store()


def get_app_settings() -> Settings:
    return get_settings()
