# Scenario 5: Multi-Location Senior Living (High Risk)

**Expected route: MANUAL REVIEW** (4-year loss runs with high severity claims)

## Email

**Subject:**
```
New Submission: Sunrise Senior Living Partners - GL + Professional Liability
```

**Body:**
```
Hi,

Please find attached the application and loss runs for Sunrise Senior Living Partners LLC.
They operate 4 assisted living facilities across Texas (one currently under construction,
expected to open Q3 2026).

They are requesting:
- GL: $2M/$4M limits
- Professional Liability / Abuse & Molestation coverage
- Effective 06/01/2026

Loss runs for the past 4 years are attached. Please note there are 3 open claims,
including one wrongful death claim currently in litigation.

Let me know if you need anything else.

Best regards,
Patricia Vega
Lone Star Risk Advisors
pvega@lonestarrisk.com
(512) 555-0199
```

## Attachments

1. `06_multi_location_high_risk.pdf` -- GL + Professional Liability application (4 facilities)
2. `07_loss_runs_high_severity.pdf` -- Loss run report covering 2022-2026 with high severity claims

## Expected extracted data

| Field | Value |
|-------|-------|
| Insured Name | Sunrise Senior Living Partners LLC |
| FEIN | 84-1234567 |
| Address (Primary) | 2200 Lakewood Blvd, Dallas, TX 75214 |
| Facility 2 | 890 Greenfield Dr, Fort Worth, TX 76107 |
| Facility 3 | 1455 Pecan Valley Rd, San Antonio, TX 78223 |
| Facility 4 (Under Construction) | 3100 Westpark Tollway, Houston, TX 77042 |
| Contact | Margaret Huang, Administrator |
| Broker | Patricia Vega, Lone Star Risk Advisors |
| Broker Email | pvega@lonestarrisk.com |
| Coverage Types | Commercial General Liability, Professional Liability, Abuse & Molestation |
| Effective Date | 06/01/2026 |
| Each Occurrence Limit | $2,000,000 |
| General Aggregate | $4,000,000 |
| Employees | 320 |
| Annual Revenue | $28,500,000 |
| Loss Runs Present | Yes |
| Loss Runs Years | 4 (2022-2026) |
| Total Claims (4yr) | 6 |
| Total Incurred | $1,380,000 |
| Open Claims | 3 |
| Highest Open Claim | Wrongful death -- $850,000 reserve (in litigation) |
| Prior Carrier | Great American Insurance Group |

## Edge cases to test

- Multiple facilities (4 locations) with different addresses across different cities
- One facility is under construction and not yet operational
- 3 open claims, including one in active litigation
- Wrongful death claim with $850K reserve is extremely high severity
- Very high limits requested ($2M/$4M) compared to typical small business
- Professional Liability and Abuse & Molestation coverage requested (specialty lines)
- Senior living / assisted care is a high-risk class of business
- 6 claims in 4 years is a high frequency pattern
- Total incurred of $1.38M indicates significant loss history
- Should route to MANUAL REVIEW due to both loss run presence and risk severity
