# infra/

Infrastructure layer — persistence and observability. No business logic here.

## Structure

```
infra/
├── json_store.py    # Atomic JSON file persistence with file locking
└── logging.py       # structlog configuration (JSON-structured output)
```

## JSON Store (json_store.py)

File-based persistence engine used by all domain modules. Each entity type gets its own directory under `data/`.

```
data/
├── submissions/          # One JSON file per submission
│   ├── {uuid}.json
│   └── ...
├── personas/             # Email author profiles
│   └── {uuid}.json
├── audit_events/         # Immutable event log
│   └── {uuid}.json
├── gmail_sync/           # Pub/Sub sync state
│   └── state.json
└── attachments/          # Binary files (PDFs, images)
    └── {submission_id}/
        └── {filename}
```

### Key Features

- **Atomic writes**: Uses `tempfile` + `os.replace()` — no partial writes
- **File locking**: `fcntl` locks prevent concurrent corruption
- **Pydantic integration**: `load()` validates data against model classes
- **Operations**: `save()`, `load()`, `list_all()`, `delete()`, `exists()`

### Why JSON Files?

This is a hackathon/prototype project. JSON file storage provides:
- Zero infrastructure (no database to set up)
- Human-readable data (easy debugging)
- Sufficient for single-instance deployments

For production, swap `JsonStore` for a database-backed implementation with the same interface.

## Logging (logging.py)

Configures `structlog` for structured JSON logging with:
- Timestamps, log levels, logger names
- Context variables (request IDs, submission IDs)
- Consistent format across all modules
