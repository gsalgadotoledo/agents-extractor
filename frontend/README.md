# frontend/ — Admin Dashboard

React admin interface for managing insurance submissions. Used by analysts and representatives to review AI-extracted data, communicate with brokers, and move submissions through the workflow.

## Stack

| Tech | Version |
|------|---------|
| React | 19.2 |
| TypeScript | 5.9 |
| Vite | 8.0 |
| React Router | 7.13 |
| Lucide React | Icons |
| React Markdown | Rendering |

## UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Header                                     [Sync] [Settings]│
├──────────────┬───────────────────────────────┬───────────────┤
│              │                               │               │
│  Submission  │     Submission Detail         │   Sidebar     │
│  List        │                               │               │
│              │  ┌─────────────────────────┐  │  Status       │
│  • Sub 1     │  │ Overview │ Activity │   │  │  Assigned To  │
│  • Sub 2 ◄── │  │ Documents│ Chat     │   │  │  Persona      │
│  • Sub 3     │  │──────────┴──────────│   │  │  Approval     │
│  • ...       │  │                     │   │  │  Validation   │
│              │  │  (tab content)      │   │  │  Details      │
│              │  │                     │   │  │  Portal Link  │
│  340px       │  └─────────────────────┘  │  │  220px        │
│              │         flex               │  │               │
├──────────────┴───────────────────────────────┴───────────────┤
│  Floating Chat Panel (when Chat tab active)                  │
└──────────────────────────────────────────────────────────────┘
```

## Components

```
App.tsx (Router)
└── AppShell
    ├── Header.tsx
    │   ├── Submission count
    │   ├── Last sync time
    │   ├── Sync Gmail button
    │   └── Settings button → SettingsModal.tsx
    │       ├── Theme tab (Light / Midnight dark)
    │       ├── Personas tab (CRUD + AI generate)
    │       ├── Models tab (Sonnet / Opus / Haiku)
    │       ├── Keys tab (API keys, email config)
    │       ├── Prompts tab (extraction prompt editor)
    │       └── Schema tab (read-only JSON schema)
    │
    ├── SubmissionList.tsx (left panel)
    │   └── Status badges, broker email, attachment count
    │
    ├── SubmissionDetail.tsx (center)
    │   ├── Overview tab — extracted data in tiered layout
    │   │   ├── Tier 1: Insured name, DBA, business info
    │   │   ├── Tier 2: Coverage + loss runs summary
    │   │   ├── Tier 3: Broker, FEIN, prior insurance
    │   │   ├── Tier 4: Facilities, claims, contacts
    │   │   └── Tier 5: Missing fields + completion bar
    │   ├── Activity tab — timeline, compose, sent emails
    │   │   ├── EmailComposer.tsx (tone selector, AI draft)
    │   │   └── Original email + attachments
    │   ├── Documents tab — upload, generate, manage
    │   └── Chat tab — AI chat with file/audio support
    │       └── ChatPanel.tsx
    │
    └── Sidebar.tsx (right panel)
        ├── Status badge
        ├── Rep assignment dropdown
        ├── Persona selector
        ├── Approval workflow
        ├── Related submissions
        ├── Validation progress bar
        └── Archive button
```

## Key Features

- **Auto-refresh**: Polls API every 10 seconds
- **Theme system**: Light and Midnight (dark) themes via CSS custom properties
- **AI Chat**: File upload (PDF, CSV, Excel, images), audio recording
- **Email Composition**: Tone selection (professional, friendly, concise, detailed, mirror), AI-assisted drafts
- **Inline editing**: Click missing field chips to edit directly
- **Real-time sync**: Manual Gmail sync trigger from header

## Development

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Expects backend API at `http://localhost:8000` (hardcoded in `api.ts`).
