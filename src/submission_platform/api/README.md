# api/

FastAPI HTTP layer. Mounts all route modules, manages server lifecycle, and wires up dependencies.

## Structure

```
api/
├── app.py             # FastAPI app, CORS, lifespan (background tasks)
├── dependencies.py    # Dependency injection: get_store(), get_app_settings()
└── routes/
    ├── submissions.py # CRUD, extract, transition, patch extracted data
    ├── email.py       # Send email endpoint
    ├── gmail.py       # Pub/Sub webhook, manual sync, watch registration
    ├── compose.py     # Email draft generation with tone guidance
    ├── chat.py        # Chat with AI, file upload support
    ├── attachments.py # Download attachments, extract PDF text
    ├── personas.py    # Persona CRUD + AI generation
    ├── documents.py   # Document upload, download, AI generation
    ├── settings.py    # App settings get/update, prompt reset
    └── health.py      # Health check endpoint
```

## app.py — Lifecycle & Background Tasks

The FastAPI app starts with a `lifespan` context manager that launches:

1. **Gmail watch renewal** — re-registers Pub/Sub every 24 hours
2. **Reconciliation loop** — polls Gmail every 30 seconds as safety net

```
App Startup
    │
    ├──→ Renew Gmail Watch (every 24h)
    ├──→ Gmail Reconciler (every 30s)
    │
    ▼
  Serving requests...
    │
    ▼
App Shutdown
    └──→ Cancel background tasks
```

## Key Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/submissions/` | List all submissions |
| `GET` | `/submissions/{id}` | Get submission details |
| `POST` | `/submissions/` | Create submission manually |
| `DELETE` | `/submissions/{id}` | Soft-delete (archive) |
| `POST` | `/submissions/{id}/extract` | Trigger AI extraction |
| `POST` | `/submissions/{id}/transition` | Change workflow status |
| `PATCH` | `/submissions/{id}/extracted-data` | Update individual fields |
| `POST` | `/submissions/{id}/chat` | Chat message (supports file upload) |
| `POST` | `/submissions/{id}/compose/draft` | Generate email draft with tone |
| `POST` | `/submissions/{id}/compose/send` | Send composed email |
| `POST` | `/gmail/pubsub/webhook` | Gmail Pub/Sub push receiver |
| `POST` | `/gmail/sync` | Manual Gmail sync trigger |
| `GET` | `/gmail/sync-state` | Last sync timestamp |
| `GET` | `/health` | Health check |

## Dependencies (dependencies.py)

Two shared dependencies injected across all routes:

- **`get_store()`** — Returns `JsonStore` instance for data persistence
- **`get_app_settings()`** — Returns `Settings` instance with all configuration
