# Scenario 12: Duplicate Submission From Different Broker

**Expected route: NEW submission but FLAGGED as possible duplicate**

## Test Steps

### Prerequisite
You must have already sent Scenario 01 (Acme Healthcare Solutions)
from your email. That submission should exist in the system.

### Send this email from a DIFFERENT email address if possible, or same address

**Subject:**
```
GL Quote Request: Acme Healthcare Solutions LLC
```

**Body:**
```
Good morning,

I represent Acme Healthcare Solutions LLC and would like to request
a quote for Commercial General Liability coverage.

- Insured: Acme Healthcare Solutions LLC
- Location: 1234 Medical Pkwy, Suite 200, Austin, TX 78701
- Coverage: $1M/$2M GL
- Effective: 05/01/2026
- 45 employees, approximately $4.2M annual revenue
- They are an outpatient medical clinic

Loss runs are available upon request. The current carrier is
National Indemnity.

Please let me know what additional information you need.

Best regards,
Sandra Williams
Premier Insurance Solutions
swilliams@premierins.com
(737) 555-0222
```

**Attachments:** None

## Edge cases

- Same insured name "Acme Healthcare Solutions LLC" as Scenario 01
- DIFFERENT broker (Sandra Williams / Premier Insurance Solutions vs David Johnson / Johnson & Associates)
- Same coverage type and limits
- Same facility address
- System should detect the similarity but NOT auto-merge
- Should create a new submission with related_submission_ids linking to the original
- The relation_reason should mention "possible duplicate" or similar
- A human should decide whether to merge or keep separate
- This could be a legitimate second broker submitting, or a duplicate
