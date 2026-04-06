# portal/ — Client-Facing Portal

Read-only submission status page for brokers and applicants. Provides a clean, branded view of where their submission stands in the workflow — no login required, accessed via direct link.

## Stack

| Tech | Version |
|------|---------|
| React | 19.2 |
| TypeScript | 5.9 |
| Vite | 8.0 |
| React Router | 7.13 |

## What It Shows

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Apex Insurance                                       │
│                                                          │
│  ──────────────────────────────────────────────────────  │
│                                                          │
│  Insured Name                                            │
│  Submission #abc123 · Submitted Mar 25, 2026             │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Progress                                           │ │
│  │                                                     │ │
│  │  [✓] Received → [✓] Under Review → [●] Quoting     │ │
│  │                             → Approved → Completed  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  !! Information Needed                              │ │
│  │  • Loss runs for the past 4 years                   │ │
│  │  • Updated facility addresses                       │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  Coverage Requested        │  Applicant Information      │
│  ─────────────────         │  ────────────────────       │
│  Policy: General Liability │  Name: Acme Corp            │
│  Effective: 2026-04-01     │  Type: Manufacturing        │
│  Limits: $1,000,000        │  Employees: 150             │
│                            │  Revenue: $12,500,000       │
│                                                          │
│  Broker Information        │  Loss Runs                  │
│  ─────────────────         │  ─────────                  │
│  John Smith                │  4 years covered            │
│  ABC Insurance Agency      │  3 claims, $45K incurred    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Route

```
/portal/:submissionId
```

Accessed via direct link shared by the admin dashboard (Sidebar -> "Client Portal" section).

## Components

```
App.tsx (Router)
├── Logo — Apex Insurance branding
└── SubmissionView.tsx
    ├── ProgressStepper — visual workflow steps with checkmarks
    ├── Missing Information — highlighted fields needed from client
    ├── Coverage Requested — policy type, dates, limits
    ├── Applicant Info — insured, business type, employees, revenue
    ├── Broker Info — name and company
    └── Loss Runs — years, claims summary, loss ratio
```

## Development

```bash
cd portal
npm install
npm run dev        # http://localhost:5174
```

Expects backend API at `http://localhost:8000`.
