# CandidatePolicy Hint Receiver What-if Review

## Scope

This Phase 28 review applies the CandidatePolicy hint receiver contract to the Phase 27 integration what-if artifact. It is shadow-only design evidence.

It does not connect CandidatePolicy runtime, change evaluator runtime behavior, call `/api/analyze`, write to Supabase, change API response fields, change UI exposure, or modify product data.

## Evidence Boundary

- actual evidence receiver what-if: computed from actual complete/product_row capture summary in the Phase 27 what-if artifact.
- pure replay evidence receiver what-if: computed from `pure_engine_replay` summary in the Phase 27 what-if artifact.
- synthetic coverage: retained only as policy branch coverage for still-unobserved gaps.

Actual capture evidence and pure replay evidence are not mixed.

## Actual Receiver What-if

- Received collapsed hints: 52
- Accepted collapsed hints: 52
- Preserved hidden hints: 33
- Insufficient evidence hints: 0
- Expected hidden delta: -52
- Expected collapsed delta: +52
- High-risk collapsed receiver violations: 0

safe_low_risk hidden receiver result:

- Observed rows: 50
- Accepted collapsed hints: 50
- Receiver decision: `accept_collapsed_candidate_hint`

## Pure Replay Receiver What-if

- Received collapsed hints: 156
- Accepted collapsed hints: 156
- Preserved hidden hints: 99
- Insufficient evidence hints: 0
- Expected hidden delta: -156
- Expected collapsed delta: +156
- High-risk collapsed receiver violations: 0

safe_low_risk hidden receiver result:

- Observed rows: 150
- Accepted collapsed hints: 150
- Receiver decision: `accept_collapsed_candidate_hint`

## Serum-family Result

Actual evidence:

- Observed rows: 420
- Boundary-applicable rows: 22
- Received collapsed hints: 13
- Accepted collapsed hints: 13
- Preserved hidden hints: 8

Pure replay evidence:

- Observed rows: 168
- Boundary-applicable rows: 66
- Received collapsed hints: 39
- Accepted collapsed hints: 39
- Preserved hidden hints: 24

The receiver does not use category alone to preserve hidden status or accept collapsed exposure. The accepted serum-family collapsed hints still require the boundary downgrade and safe metadata conditions from the hint contract.

## Safety Check

- Actual high-risk collapsed receiver count: 0
- Pure replay high-risk collapsed receiver count: 0
- Metadata incomplete collapsed receiver count: 0

The receiver preserves hidden candidates when a high-risk, sensitivity-unsafe, or strong-caution guardrail is present. Metadata incomplete is routed to `insufficient_evidence_candidate`, not collapsed.

## Remaining Gaps

- `active_leaning_only` remains unobserved in actual capture and pure replay evidence.
- `metadata_incomplete` remains unobserved in actual capture and pure replay evidence.
- `strong_caution` remains unobserved in actual capture and pure replay evidence.

These gaps remain documented limitations. Synthetic coverage supports the branch behavior but is not actual evidence.

## Allowed Next Scope

- CandidatePolicy hint receiver test design
- Shadow-only receiver coverage expansion
- Runtime integration acceptance criteria design

## Still Prohibited

Still prohibited runtime work remains out of scope:

- CandidatePolicy runtime connection
- Evaluator runtime connection
- `/api/analyze` response change
- UI exposure change
- DB or Supabase schema change
- Recommendation result replacement

## Conclusion

The what-if result supports continuing design work for a CandidatePolicy hint receiver. It does not approve runtime policy changes or CandidatePolicy connection.
