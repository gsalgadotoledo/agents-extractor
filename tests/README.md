# tests/

Unit and integration tests for the Agents Extractor platform.

## Structure

```
tests/
├── conftest.py              # Shared fixtures (tmp_store for isolated JSON storage)
├── test_domain/             # Business logic tests
│   ├── test_submissions.py  # CRUD, status transitions, audit events
│   ├── test_workflow.py     # State machine transition validation
│   ├── test_missing_fields.py # Field completeness calculation
│   ├── test_dedup.py        # Follow-up detection logic
│   ├── test_assignment.py   # Rep auto-assignment
│   ├── test_soft_delete.py  # Archive/restore behavior
│   ├── test_email_skip.py   # Email filtering rules
│   └── test_json_store.py   # Persistence layer
└── test_api/
    ├── test_routes.py       # Basic API endpoints (health, CRUD, transition)
    └── test_advanced_routes.py # Complex endpoint behaviors
```

## Fixtures

```
tests/fixtures/attachments/
├── 01_complete_gl_application.pdf
├── 02_loss_runs_4_years.pdf
├── 03_small_business_application_no_loss_runs.pdf
├── ...
└── 12_contradictory_info.pdf
```

12 PDF attachments corresponding to the test scenarios in `test-files/`.

## Running Tests

```bash
# Run all tests
uv run pytest

# Run specific test file
uv run pytest tests/test_domain/test_workflow.py

# Run with verbose output
uv run pytest -v

# Run specific test
uv run pytest tests/test_domain/test_missing_fields.py::test_empty_data
```

## Key Fixture: `tmp_store`

Defined in `conftest.py`, provides an isolated `JsonStore` instance pointing to a temporary directory. Ensures tests don't pollute each other's data.
