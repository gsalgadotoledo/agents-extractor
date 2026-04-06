# 🤖 Agents Extractor

**AI-powered insurance submission processing platform** — Agentic AI reads broker emails, extracts structured data from PDFs, runs business rules, and manages the full processing workflow autonomously.

> Built to demonstrate how LLM agents with tool-use (ReAct pattern) can replace manual data entry in insurance operations, cutting processing time from hours to seconds.

![Python](https://img.shields.io/badge/Python-3.13-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.135-green?logo=fastapi)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![LangGraph](https://img.shields.io/badge/LangGraph-ReAct_Agent-purple)
![Claude](https://img.shields.io/badge/Claude_Sonnet_4-Anthropic-orange)

---

## 🎯 What It Does

When a broker sends an email with insurance applications attached, Agents Extractor:

1. **Ingests** the email via Gmail API (Pub/Sub) or SMTP
2. **Deduplicates** — LLM detects if it's a follow-up to an existing submission
3. **Extracts** structured data using a ReAct agent that reads PDFs, validates against schemas, and self-corrects
4. **Validates** completeness and flags missing fields
5. **Notifies** the team via Slack with extracted summary
6. **Assigns** to an analyst and manages the review workflow
7. **Auto-replies** to brokers with acknowledgment and status updates

```
Email arrives → AI reads PDFs → Structured data extracted → Business rules applied → Team notified
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS                             │
│   Gmail API (Pub/Sub)  ·  SMTP Inbound  ·  REST API            │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
                   ┌────────────────┐
                   │  Deduplication  │  LLM-based follow-up detection
                   └───────┬────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CORE PIPELINE                                  │
│                                                                   │
│  Create → Download Attachments → AI Extraction (ReAct Agent)     │
│       → Validate → Notify (Slack) → Assign Rep → Human Review   │
└──────────────────────────────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     Admin Frontend   Client Portal     CLI
     (React 19)       (React 19)       (Typer)
```

## 🧠 The AI Agent (Key Differentiator)

The extraction agent isn't a simple prompt → response. It's a **LangGraph ReAct agent** with tools:

| Tool | Purpose |
|------|---------|
| `read_email` | Read full email + extracted PDF text |
| `read_attachment` | Deep-dive into specific PDF attachments |
| `get_extraction_schema` | Understand the exact Pydantic output schema |
| `submit_extraction` | Submit + validate extraction (auto-rejects invalid data) |

**The agent loop:**
1. Reads the email and all PDF attachments
2. Fetches the extraction schema (30+ structured fields)
3. Extracts data across multiple categories: insured info, broker details, facilities, coverages, loss runs
4. Submits extraction → if rejected, reads the error, fixes, and resubmits
5. Achieves 0.85-0.95 confidence on well-structured submissions

This multi-pass, self-correcting approach significantly outperforms single-shot extraction.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI · Python 3.13 · Pydantic v2 |
| **AI/LLM** | LangGraph · LangChain · Anthropic Claude Sonnet 4 |
| **Email In** | Gmail API (OAuth2 + Pub/Sub) · SMTP (aiosmtpd) |
| **Email Out** | Gmail API · SMTP (aiosmtplib) |
| **Notifications** | Slack SDK |
| **Storage** | JSON file store with atomic writes + file locking |
| **Frontend** | React 19 · TypeScript · Vite |
| **CLI** | Typer + Rich |
| **PDF Parsing** | pypdf |

## 📁 Project Structure

```
agents-extractor/
├── src/submission_platform/
│   ├── agent/           # LangGraph ReAct agent + tools
│   │   ├── graph.py     # Agent state graph (tool-calling loop)
│   │   ├── tools.py     # 8 agent tools (CRUD, email, extraction)
│   │   └── prompts.py   # System prompts
│   ├── domain/          # Business logic (pure, no framework deps)
│   │   ├── models.py    # Pydantic models (Submission, Policy, etc.)
│   │   ├── schemas.py   # 30+ field extraction schema
│   │   ├── extraction.py # Multi-pass agentic extraction
│   │   ├── workflow.py  # State machine transitions
│   │   ├── dedup.py     # LLM-based deduplication
│   │   ├── assignment.py # Auto-assignment logic
│   │   └── personas.py  # AI-generated email personas
│   ├── api/             # FastAPI routes
│   │   └── routes/      # Submissions, email, chat, gmail, etc.
│   ├── infra/           # JSON store, logging
│   ├── cli/             # Typer CLI
│   └── email_gateway/   # SMTP inbound handler
├── frontend/            # Admin dashboard (React 19 + TS)
├── portal/              # Client-facing portal (React 19 + TS)
├── tests/               # Domain + API tests
└── test-files/          # 12 realistic test scenarios with PDFs
```

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/gsalgadotoledo/agents-extractor.git
cd agents-extractor

# Setup Python
uv sync

# Configure
cp .env.example .env
# Add your ANTHROPIC_API_KEY

# Run API
uv run uvicorn submission_platform.api.app:app --reload

# Run Frontend
cd frontend && npm install && npm run dev

# Run CLI
uv run submission --help
```

## 🧪 Test Scenarios

Includes 12 realistic insurance submission scenarios:

| # | Scenario | Tests |
|---|----------|-------|
| 01 | Complete GL application with loss runs | Full extraction pipeline |
| 02 | New business, no loss history | Missing data handling |
| 03 | Incomplete application | Validation + missing fields |
| 04 | Partial loss runs | Incomplete data extraction |
| 05 | Multi-location, high risk | Complex facility extraction |
| 06 | Renewal with changed limits | Change detection |
| 07 | Spanish language submission | Multi-language support |
| 08 | Multiple business entities | Entity disambiguation |
| 09 | Bare minimum info | Low-confidence handling |
| 10 | Contradictory information | Conflict detection |
| 11 | Follow-up email thread | Dedup + thread linking |
| 12 | Duplicate from different broker | Cross-broker dedup |

## 📊 Workflow States

```
received → ack_sent → parsing → extracting → extracted → validated
    → needs_review OR auto_policy_ready → policy_created
    → outbound_email_pending → completed
```

Each transition is validated by a deterministic state machine — the AI agent handles extraction, but business rules are code, not prompts.

## 🐳 Deploy (Docker)

```bash
# Local
docker compose up -d
# → http://localhost:8000 (API + Frontend)
# → http://localhost:8000/docs (Swagger)

# With Mailpit for email testing
docker compose --profile dev up -d
# → http://localhost:8025 (Mailpit UI)
```

### AWS (EC2)

```bash
# On a fresh EC2 instance:
curl -sL https://raw.githubusercontent.com/gsalgadotoledo/agents-extractor/main/deploy/setup-ec2.sh | bash
# Then edit .env, add ANTHROPIC_API_KEY, and: docker compose up -d
```

See [`deploy/setup-ec2.sh`](deploy/setup-ec2.sh) for details.

## 🎥 Demo

> 🎬 Video walkthrough coming soon — watch the agent process a real submission end-to-end.

## 📝 Key Design Decisions

- **Agentic extraction over single-shot**: Multi-pass with self-correction gives 20-30% better accuracy
- **Deterministic workflow + AI extraction**: Business rules are code, not LLM output — predictable and auditable
- **Multi-entry architecture**: Gmail Pub/Sub for production, SMTP for local dev, REST API for testing
- **JSON file store**: Zero-config storage for MVP — swap for PostgreSQL in production
- **Persona system**: AI-generated email personalities for natural broker communication

## 👤 Author

**Gustavo Salgado** — AI Product Manager | Full Stack Engineer

- 🔗 [LinkedIn](https://www.linkedin.com/in/gustavo-salgado-javascript-developer/)
- 🐙 [GitHub](https://github.com/gsalgadotoledo)

---

*Built with Claude, LangGraph, and a passion for making insurance less painful.*
