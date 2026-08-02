# 2026-08-03 — #T9 pre-implementation review

## Result

Pre-implementation review completed before source changes.

## Findings corrected in design

1. comparison-group source completeness must be derived from locally stored closed runs rather than caller allowlists;
2. exposure registry heads must prove linear append-only history rather than merely expose a digest;
3. current G4 authority and canonical bytes must be rechecked immediately before final activation;
4. regression baseline registration must remain evidence-only and provide no hidden model/holdout execution path.

## Resolution

ADR 0028 records the corrected contracts. Implementation proceeds on a separate feature branch based on the corrected design head.

- Critical: 0 open
- Important: 0 open
- Minor: 0 open
