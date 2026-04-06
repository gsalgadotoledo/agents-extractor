# domain/

Core business logic layer. Contains all models, the AI extraction pipeline, email handling, workflow rules, and integrations with external services. No framework dependencies — this is pure domain logic that the API, CLI, and agent layers call into.

## Module Map

```
domain/
├── models.py          # Pydantic models: Submission, Attachment, Persona, etc.
├── schemas.py         # Extraction schema: ExtractedSubmission and sub-schemas
├── workflow.py        # State machine: valid transitions between statuses
├── workflow_rules.md  # Human-readable business rules documentation
├── submissions.py     # CRUD operations, status transitions, audit logging
├── extraction.py      # AI extraction agent (ReAct, LangGraph, Claude)
├── dedup.py           # Follow-up detection (LLM or heuristic)
├── assignment.py      # Representative auto-assignment from pool
├── auto_reply.py      # AI-generated status replies to follow-ups
├── email_service.py   # Send emails via Gmail API or SMTP
├── gmail_oauth.py     # One-time OAuth2 consent flow for Gmail
├── gmail_push.py      # Gmail Pub/Sub push sync + attachment download
├── missing_fields.py  # Dynamic field completeness calculation
├── personas.py        # Email author profiles (tone, signature, greeting)
└── slack_service.py   # Slack #submissions notifications
```

## Data Model

```
Submission
├── id: UUID
├── status: SubmissionStatus (enum, 11 states)
├── message_id: str (Gmail message ID)
├── broker_email, broker_name, subject
├── body_text, body_html
├── attachments: [Attachment]
│   └── filename, content_type, size_bytes, storage_path
├── extracted_data: dict (ExtractedSubmission once extracted)
├── extraction_confidence: float (0.0 – 1.0)
├── assigned_to: str (rep ID)
├── persona_id: str
├── chat_history: [dict]
├── sent_emails: [dict]
├── related_submission_ids: [str]
├── deleted: bool (soft delete)
├── created_at, updated_at
└── approved_by, approved_at
```

## Extraction Schema (schemas.py)

What the AI agent extracts from each email:

```
ExtractedSubmission
├── overview: OverviewData
│   └── insured_name, dba, fein, business_type, year_established,
│       employees, revenue, sic_code, naics_code
├── broker: BrokerData
│   └── name, company, email, phone
├── facilities: [FacilityData]
│   └── address, city, state, zip, facility_type, notes
├── coverage: CoverageData
│   └── policy_type, effective_date, expiration_date, limits,
│       aggregate, deductible, additional_coverages
├── loss_runs: LossRunsData
│   └── present, years_covered, periods[], summary
├── prior_insurance: PriorInsuranceData
│   └── carrier, policy_number, expiration, premium
├── claims_history: [ClaimData]
│   └── date, description, amount, status
├── contacts: [ContactData]
│   └── name, role, email, phone
├── missing_fields, warnings, confidence
```

## AI Extraction Pipeline (extraction.py)

The heart of the system. Uses a ReAct agent pattern via LangGraph:

```
┌──────────────────────────────────────────────────────────┐
│                  EXTRACTION AGENT                         │
│                                                          │
│  ┌─────────┐     ┌───────────┐     ┌─────────┐         │
│  │  AGENT  │────→│  TOOLS    │────→│  AGENT  │──→ ...  │
│  │ (Claude)│     │           │     │ (Claude)│         │
│  └─────────┘     └───────────┘     └─────────┘         │
│       │                                    │             │
│       │         Available Tools:           │             │
│       │         • read_email()             │             │
│       │         • read_attachment(file)    │             │
│       │         • get_extraction_schema()  │             │
│       │         • submit_extraction(json)  │             │
│       │                                    │             │
│       └─── Loops until valid extraction ───┘             │
│                                                          │
│  Model: Claude Sonnet 4 | Temp: 0 | Max tokens: 8192   │
└──────────────────────────────────────────────────────────┘

Steps:
1. Pre-extract text from all PDF attachments (pypdf)
2. Build combined email + attachment content
3. Agent reads email → reads attachments → gets schema
4. Agent submits structured JSON extraction
5. Validate against Pydantic schema
6. If invalid → agent retries with error feedback
7. Output: ExtractedSubmission + confidence + warnings
```

## Key Modules

### submissions.py
CRUD operations on submissions. Creates audit events for every change. Handles soft delete, status transitions, and the auto-assign + ACK flow on creation.

### workflow.py
Strict state machine with `VALID_TRANSITIONS` dictionary. Every status change goes through `validate_transition()`. Invalid transitions raise errors.

### dedup.py
Determines if an inbound email is a follow-up to an existing submission or a new one. Uses Claude LLM when available, falls back to heuristic (checks Re:/Fwd: prefix, same subject, same sender). Links related submissions.

### gmail_push.py
Handles Gmail Pub/Sub push notifications for real-time email ingestion:
- `setup_watch()` — register with Google Pub/Sub
- `process_history()` — fetch new messages since last `historyId`
- `_download_attachments()` — fetch and store email attachments
- Safety-net reconciler polls every 30 seconds
- Watch auto-renews every 24 hours

### email_service.py
Sends outbound emails via Gmail API (OAuth2) or SMTP (Mailpit for dev, authenticated relay for prod). Handles ACK emails and broker correspondence.

### slack_service.py
Posts formatted Block Kit cards to `#submissions` when a new submission is extracted. Includes insured name, coverage type, limits, confidence, assigned rep, and loss run status.

### missing_fields.py
Dynamically computes which fields are filled vs missing from extracted data. Returns required vs recommended missing items and a completion percentage. Used by the UI to show validation progress.

### assignment.py
Pool of 4 default representatives (Sarah, Marcus, Diana, James). `auto_assign()` picks one randomly. Also handles approval workflows.

### personas.py
Manages email author profiles with customizable tone, signature, greeting style, and closing style. 3 default personas are seeded. Used when composing outbound emails.
