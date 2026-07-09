# Evaluator Boundary Integration What-if - 2026-07-09

This review records Phase 27 what-if shadow evidence for the `recent_instability_active_limited` evaluator boundary. It is not actual runtime behavior.

## Scope

This phase added a pure collapsed hint contract and a what-if runner. It did not connect evaluator runtime behavior, CandidatePolicy, UI, API, DB, Supabase, product data, capture fixtures, or recommendation outputs.

Runtime flags:

- runtimeConnected: false
- routeInvoked: false
- supabaseWriteExecuted: false
- runtimeMutation: false

## Recommended Integration Option

Recommended option: Option B, evaluator pass plus collapsed hint.

Option B keeps the evaluator responsible for the narrow pass/hard-block distinction and keeps CandidatePolicy responsible for final exposure grouping. This is the cleanest next design shape because it preserves safety provenance and avoids immediate runtime output changes.

## Actual Evidence What-if

Source:

- `tmp/functional-shadow-captures/candidate-exposure-audit.json`
- `tmp/evaluator-boundary-actual-coverage.json`

Baseline:

- total rows: 1,640
- hidden before: 185
- collapsed before: 428

What-if:

- hidden after: 133
- collapsed after: 480
- hidden delta: -52
- collapsed delta: +52

Safe_low_risk hidden result:

- observed rows: 50
- collapsed hints: 50
- hidden hints: 0
- metadata review hints: 0

High-risk check:

- high-risk collapsed hint count: 0

## Pure Replay Evidence What-if

Source:

- `tmp/evaluator-boundary-pure-engine-target-replay.json`

Baseline:

- total rows: 656
- hidden before: 332
- collapsed before: 324

What-if:

- hidden after: 176
- collapsed after: 428
- hidden delta: -156
- collapsed delta: +156

Safe_low_risk hidden result:

- observed rows: 150
- collapsed hints: 150
- hidden hints: 0
- metadata review hints: 0

Serum-family result:

- observed rows: 168
- boundary-applicable rows: 66
- collapsed hints: 39
- preserve hard-block hints: 24
- metadata review hints: 0

High-risk check:

- high-risk collapsed hint count: 0

## Safety Regression Check

Passed.

- highRiskCollapsedHintCountActual: 0
- highRiskCollapsedHintCountPureReplay: 0

## Low-risk Collapsed Hint Consistency

Passed.

- actual safe_low_risk hidden: 50/50 collapsed hints
- pure replay safe_low_risk hidden: 150/150 collapsed hints

## Remaining Gaps

Still not observed in actual or pure replay:

- active_leaning only
- metadata_incomplete
- strong caution

These gaps remain covered only by synthetic policy verification and must stay limitations. They do not approve runtime integration.

## Allowed Next Design Scope

Allowed:

- runtime integration plan
- shadow-only hint contract tests
- CandidatePolicy hint receiver design
- what-if shadow coverage expansion

## Still Prohibited

Still prohibited:

- evaluator runtime connection
- CandidatePolicy runtime connection
- `/api/analyze` response changes
- UI exposure changes
- DB/Supabase schema changes
- recommendation result replacement

## Conclusion

The what-if result supports Option B as the next design option. It does not approve runtime policy changes. Phase 28 should either expand shadow coverage for unobserved gaps or design the CandidatePolicy hint receiver without wiring it into runtime.
