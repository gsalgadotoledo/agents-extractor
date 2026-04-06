# Scenario 8: Multiple Entities / Holding Company

**Expected route: MANUAL REVIEW** (complex entity structure, very high limits)

## Email

**Subject:**
```
New Submission: Pinnacle Property Holdings - Wrap-Up GL + Umbrella (Multiple Entities)
```

**Body:**
```
Hi,

Attached is the application for Pinnacle Property Holdings and its subsidiaries.
They need a wrap-up GL policy covering the parent and 4 subsidiary companies.

Named Insureds:
1. Pinnacle Property Holdings LLC (parent)
2. Pinnacle Office Management Inc
3. Pinnacle Retail Ventures LLC
4. Pinnacle Residential Partners LP
5. Pinnacle Mixed-Use Development Corp

Managed properties:
- Downtown office tower (18 floors)
- Eastgate Shopping Mall
- Sunset Ridge Apartments (220 units)
- Westfield Business Park
- The Market at Central -- food hall / retail incubator

Requesting:
- GL: $5M/$10M
- Umbrella: $25M
- Effective 08/01/2026

Each entity has its own FEIN. Full details in the attached application.

Thanks,
Helen Park
Westcoast Commercial Brokerage
hpark@westcoastcommercial.com
(310) 555-0256
```

## Attachments

1. `10_multiple_entities.pdf` -- Wrap-up application covering parent + 4 subsidiaries

## Expected extracted data

| Field | Value |
|-------|-------|
| Named Insured (Primary) | Pinnacle Property Holdings LLC |
| FEIN (Primary) | 91-7654321 |
| Subsidiary 1 | Pinnacle Office Management Inc |
| Subsidiary 2 | Pinnacle Retail Ventures LLC |
| Subsidiary 3 | Pinnacle Residential Partners LP |
| Subsidiary 4 | Pinnacle Mixed-Use Development Corp |
| Address (Primary) | 800 Wilshire Blvd, 25th Floor, Los Angeles, CA 90017 |
| Contact | Richard Nakamura, VP Risk Management |
| Broker | Helen Park, Westcoast Commercial Brokerage |
| Broker Email | hpark@westcoastcommercial.com |
| Coverage Type | Commercial General Liability (Wrap-Up), Commercial Umbrella |
| Effective Date | 08/01/2026 |
| Each Occurrence Limit | $5,000,000 |
| General Aggregate | $10,000,000 |
| Umbrella | $25,000,000 |
| Total Employees | 450 |
| Total Annual Revenue | $67,000,000 |
| Managed Properties | 5 (office tower, shopping mall, apartments, business park, food hall) |
| Loss Runs Present | TBD (check application) |

## Edge cases to test

- Multiple named insureds with separate FEINs -- system must capture all entities
- Parent/subsidiary corporate structure with different entity types (LLC, Inc, LP, Corp)
- Wrap-up policy structure covers multiple entities under one program
- Very high limits ($5M/$10M GL + $25M umbrella) indicate large account complexity
- Diverse property types: commercial office, retail, residential, mixed-use
- 5 managed properties each with different risk profiles
- $67M revenue and 450 employees make this a large account
- System should not create separate submissions per entity
- Food hall / retail incubator is an unusual operation type
- Multiple addresses and locations to capture
