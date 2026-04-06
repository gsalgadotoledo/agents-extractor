from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM
    anthropic_api_key: str = ""
    extraction_model: str = "claude-sonnet-4-20250514"
    openai_api_key: str = ""

    # SMTP outbound
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = False
    email_from_name: str = "Underwriting Team at Apex Insurance"
    email_from_address: str = "underwriting@apex-demo.com"

    # Mailpit API
    mailpit_api_url: str = "http://localhost:8025/api/v1"

    # App
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "DEBUG"

    # Inbound SMTP
    inbound_smtp_host: str = "0.0.0.0"
    inbound_smtp_port: int = 2525

    # Gmail API (Push via Pub/Sub)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_refresh_token: str = ""
    gmail_address: str = ""
    gmail_pubsub_topic: str = ""
    gmail_label_ids: list[str] = ["INBOX"]
    gmail_reconciler_interval_seconds: int = 30
    gmail_pubsub_verification_token: str = ""

    # Slack (Phase 5+)
    slack_bot_token: str = ""
    slack_app_token: str = ""
    slack_signing_secret: str = ""
    slack_channel: str = "#submissions"

    # Storage
    data_dir: Path = Path("data")


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
