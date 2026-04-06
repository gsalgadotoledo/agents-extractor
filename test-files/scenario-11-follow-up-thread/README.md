# Scenario 11: Follow-Up Email Thread (Dedup Test)

**Expected route: FOLLOW-UP linked to original submission**

## Test Steps

### Step 1: Send the original email

**Subject:**
```
New Submission: Riverdale Plumbing Services - GL Renewal
```

**Body:**
```
Hi,

We need to renew GL coverage for Riverdale Plumbing Services Inc.
Current limits are $1M/$2M with Midwest Mutual.
Policy expires 06/01/2026.

I'll send the loss runs separately - still waiting on the carrier.

Thanks,
Mike Torres
Allied Commercial Brokers
mtorres@alliedbrokers.com
```

**Attachments:** None (intentionally - loss runs coming later)

### Step 2: Wait 1-2 minutes, then send the follow-up

**Subject:**
```
Re: New Submission: Riverdale Plumbing Services - GL Renewal
```

**Body:**
```
Hi,

Following up on Riverdale Plumbing. Attached are the loss runs
we were waiting on - only 2 years available because the prior
carrier went out of business.

Also, the insured added a new service vehicle to the fleet,
so please note they now have 3 service trucks.

Thanks,
Mike Torres
```

**Attachments:** `05_loss_runs_2_years_partial.pdf`

## Edge cases

- System should detect the Re: email as a follow-up to the original
- Should link both submissions together (related_submission_ids)
- Auto-reply should send broker a status update
- Loss runs from the follow-up should be extractable
- Missing info from the first email gets supplemented by the second
- The note about "3 service trucks" is new info not in any form
