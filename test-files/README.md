# test-files/

12 end-to-end test scenarios simulating real-world insurance submission emails. Each scenario includes PDF attachments and a README describing the expected email content, extraction output, and routing decision.

## Scenarios

| # | Scenario | PDFs | Expected Outcome |
|---|----------|------|-----------------|
| 01 | Complete GL app + 4yr loss runs | 2 | MANUAL REVIEW (loss runs trigger review) |
| 02 | New business, no loss runs | 1 | AUTO POLICY |
| 03 | Incomplete application | 1 | FAIL VALIDATION (missing fields) |
| 04 | Partial loss runs (2yr) | 1 | AUTO POLICY (below 4yr threshold) |
| 05 | Multi-location, high risk | 2 | MANUAL REVIEW (high severity) |
| 06 | Renewal with changed limits | 1 | MANUAL REVIEW (limit increase + umbrella) |
| 07 | Spanish submission | 1 | AUTO POLICY (agent handles Spanish) |
| 08 | Multiple entities (holding co.) | 1 | MANUAL REVIEW (complex structure) |
| 09 | Bare minimum info | 1 | FAIL VALIDATION (almost no data) |
| 10 | Contradictory info | 1 | MANUAL REVIEW (conflicting data) |
| 11 | Follow-up thread | 1 | DEDUP/ENRICH (links to existing) |
| 12 | Duplicate from different broker | 0 | FLAG DUPLICATE (same insured, different broker) |

## What Each Scenario Contains

```
scenario-XX-description/
├── README.md              # Email text, expected extraction, expected routing
├── XX_document_name.pdf   # Simulated insurance application or loss run PDF
└── (optional more PDFs)
```

## Using These for Testing

1. **Manual testing**: Use the email text from each README as input to `POST /submissions/`
2. **Extraction testing**: Attach the PDFs and verify the AI extracts the expected fields
3. **Workflow testing**: Verify the system routes each scenario to the correct outcome
4. **Edge cases**: Scenarios 07 (Spanish), 09 (bare minimum), 10 (contradictions) test agent robustness
