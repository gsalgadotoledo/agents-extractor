# Scenario 9: Bare Minimum Information

**Expected route: FAIL VALIDATION** (insufficient data for quoting)

## Email

**Subject:**
```
need insurance
```

**Body:**
```
Hey,

I need liability insurance for my lawn care business.
$1M should be fine. Can you start it next Monday?

My name is Tony. Phone is 555-0147.

Thanks
```

## Attachments

1. `11_bare_minimum.pdf` -- Extremely sparse application with almost no fields filled in

## Expected extracted data

| Field | Value |
|-------|-------|
| Insured Name | Tony (last name MISSING) |
| Business Type | Lawn care |
| Address | MISSING |
| FEIN | MISSING |
| Contact Phone | 555-0147 |
| Broker | MISSING (appears to be direct from insured) |
| Broker Email | MISSING |
| Coverage Type | General Liability (inferred) |
| Effective Date | "next Monday" (ambiguous, no specific date) |
| Each Occurrence Limit | $1,000,000 (inferred from "$1M") |
| General Aggregate | MISSING |
| Employees | MISSING (likely sole proprietor) |
| Annual Revenue | MISSING |
| Loss Runs Present | No |
| Prior Insurance | Unknown |

## Edge cases to test

- Almost no structured data provided -- tests extraction resilience
- No formal business name, just a first name
- No FEIN, no address, no last name
- Informal email tone with no broker signature block
- Ambiguous effective date ("next Monday") -- system must flag as unresolvable
- Limit mentioned only as "$1M" with no aggregate specified
- No PDF application or only a nearly blank one
- Appears to be submitted directly by the insured, not through a broker
- Phone number has no area code
- System should generate a comprehensive list of missing required fields
- Should FAIL VALIDATION and trigger a request for more information
- Sole proprietor / small operation with minimal documentation
