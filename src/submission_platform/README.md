# src/submission_platform

Root Python package for the Agents Extractor backend. Contains all server-side logic organized into clearly separated layers.

## Package Layout

```
submission_platform/
├── config.py            # Central settings (Pydantic, loads .env)
├── api/                 # FastAPI HTTP layer
├── domain/              # Business logic, models, AI extraction
├── agent/               # LangGraph automation agent (CLI/API orchestration)
├── email_gateway/       # Inbound SMTP server
├── infra/               # Storage engine & structured logging
└── cli/                 # Typer command-line interface
```

## How the Layers Connect

```
                    ┌──────────────┐
                    │   config.py  │  Settings singleton
                    └──────┬───────┘  (env vars, API keys, paths)
                           │
            ┌──────────────┼──────────────────┐
            │              │                  │
            ▼              ▼                  ▼
     ┌────────────┐ ┌────────────┐    ┌─────────────┐
     │   api/     │ │   cli/     │    │   agent/    │
     │  (FastAPI) │ │  (Typer)   │    │ (LangGraph) │
     └─────┬──────┘ └─────┬──────┘    └──────┬──────┘
           │              │                   │
           └──────────────┼───────────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   domain/   │   Business logic
                   │             │   (models, extraction,
                   │             │    workflow, email, etc.)
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   infra/    │   Persistence layer
                   │             │   (JSON store, logging)
                   └─────────────┘
```

## Key Entry Points

| Surface | Module | Start Command |
|---------|--------|---------------|
| REST API | `api.app:app` | `uv run uvicorn submission_platform.api.app:app --reload` |
| CLI | `cli.main` | `uv run python -m submission_platform.cli.main` |
| SMTP Server | `email_gateway.smtp_handler` | Started programmatically or via CLI |

## config.py

Central `Settings` class (Pydantic BaseSettings) that loads all configuration from `.env`:

- **LLM**: `anthropic_api_key`, `extraction_model` (default: `claude-sonnet-4-20250514`)
- **SMTP**: `smtp_host`, `smtp_port`, `smtp_use_tls`, `email_from_name`, `email_from_address`
- **Gmail**: OAuth2 credentials, Pub/Sub topic, label filters, reconciler interval
- **Slack**: `slack_bot_token`, `slack_channel`
- **Storage**: `data_dir` (default: `data/`)
- **API**: `api_host`, `api_port`
