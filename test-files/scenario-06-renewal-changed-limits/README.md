# Scenario 6: Renewal with Changed Limits

**Expected route: MANUAL REVIEW** (renewal with significant limit increases)

## Email

**Subject:**
```
Renewal Submission: Apex Construction Group - GL + Umbrella (Increased Limits)
```

**Body:**
```
Hi,

Apex Construction Group is coming up for renewal and needs increased limits.

Current policy: $1M/$2M GL with National Trust Insurance
Policy #: NTI-GL-2025-04821
Expiring: 07/15/2026

They just won a city infrastructure contract that requires:
- GL: $2M/$5M (up from $1M/$2M)
- Umbrella: $5M (new, not currently carried)
- Effective 07/15/2026 (no lapse)

Application is attached with updated exposure info.
Please reference the current policy for loss history -- they've been claims-free for 3 years.

Thanks,
Robert Marsh
Capitol Insurance Group
rmarsh@capitolins.com
(202) 555-0342
```

## Attachments

1. `08_renewal_changed_limits.pdf` -- Renewal application with updated limits and exposures

## Expected extracted data

| Field | Value |
|-------|-------|
| Insured Name | Apex Construction Group Inc |
| Address | 5500 Industrial Pkwy, Suite 300, Arlington, VA 22203 |
| Contact | Frank DeLuca, CFO |
| Broker | Robert Marsh, Capitol Insurance Group |
| Broker Email | rmarsh@capitolins.com |
| Coverage Type | Commercial General Liability, Commercial Umbrella |
| Submission Type | Renewal |
| Current Policy # | NTI-GL-2025-04821 |
| Current Carrier | National Trust Insurance |
| Current Limits | $1,000,000 / $2,000,000 |
| Requested Occurrence Limit | $2,000,000 |
| Requested Aggregate | $5,000,000 |
| Requested Umbrella | $5,000,000 |
| Effective Date | 07/15/2026 |
| Employees | ~85 |
| Annual Revenue | $12,000,000 |
| Loss Runs Present | No (references claims-free history on current policy) |
| Reason for Increase | City infrastructure contract requirement |

## Edge cases to test

- This is a renewal, not new business -- system must recognize renewal context
- Limits are increasing significantly (doubling occurrence, more than doubling aggregate)
- Umbrella is being added for the first time (not currently carried)
- Reference to existing policy number that system should capture
- No loss runs attached -- broker references claims-free status on current policy
- Construction is a high-hazard class of business
- City contract requirement drives the limit increase (contractual obligation)
- System should flag the gap between current and requested limits
- Effective date must align with expiring policy to avoid lapse
