# OpporCheck Hackathon Demo Scenario (Synthetic)

All names, numbers, and documents below are fictional and invented for
demonstration. Any resemblance to real people or employers is coincidental.
Corridor: Singapore (15 sources, `sources_verified` 2026-11-19).

## Cast and premise

Dewi, an Indonesian job seeker, received a WhatsApp job ad for restaurant
work in Singapore, then a more detailed conditions document. She wants to
understand the offer before committing — not to be told it is a scam.

## Material 1 — Job advertisement (paste into Review)

```
URGENT HIRING!! Service Crew for Marina Bay Restaurant Singapore
Salary SGD 2,100 monthly + overtime 1.5x!! Accommodation provided.
Working hours 44 hours per week. 2 years contract.
Contact Mr. Daniel +6581234567 now!! Limited slots!!
Passport number E1234567 for work permit processing.
```

Demo notes: the ad contains two Privacy Check detections (phone number,
passport-style identifier) and realistic pressure language ("URGENT",
"Limited slots"). Expected analysis: salary/hours/duration extracted;
pressure language flagged as a concern with quoted evidence; missing
information includes exact overtime terms and employer identity.

## Material 2 — Employment conditions (second document for Compare)

```
DRAFT EMPLOYMENT CONDITIONS — Marina Bay Restaurant
Position: Service Crew. Salary: SGD 2,100 per month.
Working hours: 44 hours per week.
Overtime is compensated with time off in lieu.
Accommodation: shared housing provided, SGD 300 monthly deduction.
Contract period: 24 months. Probation terms to be confirmed.
```

Planned comparison points (present neutrally — clarification, not fraud):

- DISCREPANCY: the ad promises overtime at 1.5x pay; the conditions
  document offers time off instead. The demo shows the mismatch and
  suggests asking which applies.
- UNCLEAR: probation terms ("to be confirmed") are missing from both
  documents and should appear as missing information.
- CONSISTENT: salary SGD 2,100, 44-hour week, 24-month duration and
  accommodation appear in both and should align.

## Expected walkthrough (8 steps, ~6 minutes)

1. Register/sign in, open Review. Paste Material 1.
2. Run Privacy Check: review the phone + passport detections, redact
   both, approve the cleaned text.
3. Analyze: structured report appears (terms, concerns with quotes,
   missing info, next action) with an on-device/cloud source line.
4. Save the investigation; open it from My investigations.
5. Open Compare; paste Material 1 as Document A and Material 2 as
   Document B; complete per-document Privacy Checks.
6. Extract, then compare: expect the overtime discrepancy plus the
   probation gap, with page attribution on every term.
7. From the saved investigation, run the evidence check against
   Singapore sources; review supported/conflicting/insufficient items.
8. Revisit the investigation from history to close the loop.

## What NOT to claim on stage

- No fraud verdicts, no employer verification, no legal advice.
- Detection assists review; it does not anonymize.
- AI output quality depends on the live model and cannot be rehearsed
  word-for-word; the flows, guards, and attribution are the demo.
