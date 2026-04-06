# Scenario 3: Incomplete Application

**Expected route: FAIL VALIDATION** (missing required fields)

## Email

**Subject:**
```
GL Application
```

**Body:**
```
Here's an application. Let me know if you need anything else.

- Tom
```

## Attachments

1. `04_incomplete_application.pdf` — Incomplete application with missing fields

## Expected extracted data

| Field | Value |
|-------|-------|
| Insured Name | MISSING |
| Address | 456 Oak St (incomplete) |
| Contact | Tom (no last name) |
| Broker | MISSING |
| Coverage Type | Unclear ("GL I think") |
| Effective Date | MISSING ("ASAP") |
| Limits | MISSING ("standard") |
| Employees | ~10 (approximate) |
| Annual Revenue | MISSING ("not sure, maybe 500k?") |
| Loss Runs Present | Unknown |

## Expected warnings

- Named insured is blank
- No broker information
- No effective date
- No specific limits
- No FEIN
- No phone number
- Prior insurance unknown
