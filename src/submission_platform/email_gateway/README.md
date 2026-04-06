# email_gateway/

Inbound SMTP server for receiving emails directly (alternative to Gmail API).

## Structure

```
email_gateway/
└── smtp_handler.py    # aiosmtpd-based SMTP handler
```

## How It Works

```
Broker Email ──→ SMTP (port 2525) ──→ SubmissionHandler ──→ Create Submission
```

Uses `aiosmtpd` to listen for inbound SMTP connections. When an email arrives, `SubmissionHandler` extracts:
- `From` address
- `Subject` line
- `Body` text (handles multipart MIME)

Then creates a new submission through the standard `submissions.py` pipeline.

## When to Use

- **Gmail API (Pub/Sub)**: Production — real-time push, attachment support, OAuth2
- **SMTP Gateway**: Alternative setup — simpler, no Google dependency, useful for testing with Mailpit

## Configuration

```env
INBOUND_SMTP_HOST=0.0.0.0
INBOUND_SMTP_PORT=2525
```
