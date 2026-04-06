# cli/

Command-line interface built with Typer. Provides direct access to all core operations without the API server.

## Structure

```
cli/
└── main.py    # Typer CLI with submission management commands
```

## Commands

```bash
# Create a new submission
uv run python -m submission_platform.cli.main submission create \
  --broker-email "broker@example.com" \
  --subject "New GL Application" \
  --body "Please see attached..."

# List submissions (optional status filter)
uv run python -m submission_platform.cli.main submission list
uv run python -m submission_platform.cli.main submission list --status extracted

# Get submission details
uv run python -m submission_platform.cli.main submission get <id>

# Trigger AI extraction
uv run python -m submission_platform.cli.main submission extract <id>

# Transition status
uv run python -m submission_platform.cli.main submission transition <id> validated
```

## Use Cases

- Quick testing without the frontend
- Scripting and automation
- Debugging individual submissions
- Batch operations
