# agent/

LangGraph automation agent for orchestrating submissions via tool calls. This is a higher-level agent that can create submissions, trigger extraction, manage workflow, and send emails — used by the CLI and API for automated operations.

> **Not to be confused with the extraction agent** in `domain/extraction.py`, which is a per-submission agent focused on data extraction from emails/PDFs.

## Structure

```
agent/
├── graph.py     # LangGraph agent graph definition
├── prompts.py   # System prompt for the automation agent
└── tools.py     # 8 tools the agent can invoke
```

## Agent Graph

```
         ┌──────────┐
         │  START   │
         └────┬─────┘
              │
              ▼
         ┌──────────┐
    ┌───→│  AGENT   │←──────────┐
    │    │ (Claude)  │           │
    │    └────┬─────┘           │
    │         │                 │
    │    tool_calls?            │
    │    ├── YES ──→ TOOLS ─────┘
    │    └── NO  ──→ END
    │
    └── (loop until done)
```

## Available Tools

| Tool | Purpose |
|------|---------|
| `create_submission` | Create a new submission from broker details |
| `list_submissions` | List submissions with optional status filter |
| `get_submission` | Fetch full submission details by ID |
| `extract_submission` | Trigger AI extraction on a submission |
| `transition_submission` | Change submission workflow status |
| `send_email` | Send an email via SMTP or Gmail |
| `sync_gmail` | Fetch new emails from Gmail |
| `register_gmail_watch` | Setup/renew Gmail Pub/Sub push notifications |

## System Prompt (prompts.py)

Defines the agent's role as a submission platform operator at Apex Insurance Group. The agent understands the workflow states, extraction process, and can autonomously manage the full submission lifecycle.
