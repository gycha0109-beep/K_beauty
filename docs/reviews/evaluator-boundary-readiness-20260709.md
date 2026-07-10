# Evaluator Boundary Readiness Review - 2026-07-09

이 문서는 boundary policy readiness review이며, runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다.

## Scope

This review combines Phase 16 through Phase 25 evidence for the `recent_instability_active_limited` hard-block boundary. It decides whether the boundary can move to the next design phase only.

It does not change:

- `/api/analyze`
- evaluator hard filters, score, or weight
- CandidatePolicy runtime behavior
- UI or API response
- DB, Supabase schema, migration, or product data
- `topPick`, `supportingProducts`, or `budgetAlternatives`

## Phase 16-25 Flow

Phase 16 added a shadow-only boundary policy and reviewed existing `recent_instability_active_limited` rows. It found 86 reviewed rows, 52 `downgrade_to_collapsed_candidate`, 33 `preserve_hard_block`, 1 `not_applicable`, and 0 high-risk collapsed rows.

Phase 17 used synthetic policy coverage for missing matrix cells. It validated active-leaning safe/unsafe cases, metadata-incomplete review routing, serum safe/strong-caution cases, and empty cautionTags behavior.

Phase 18 collected actual complete/product_row coverage. It reconfirmed 50 safe-low-risk hidden rows and 50/50 `downgrade_to_collapsed_candidate`, with 0 high-risk collapsed rows. Active-leaning only, metadata-incomplete, serum category, and strong-caution cases were not observed in actual captures.

Phase 20 did not execute `/api/analyze` actual capture because that route has guard/session mutation boundaries. Phase 21 concluded no-write capture is not suitable on the current route and recommended pure engine replay.

Phase 22 implemented pure engine replay but produced 0 candidate rows because the fallback sanitized capture rows were not scorer-compatible product rows.

Phase 23 showed that the scorer-compatible row contract needs product identity and category fields sufficient for the legacy scorer path.

Phase 24 traced product source configuration and found the direct Node runner needed `.env.local` loading for the existing read-only product source. It did not require service-role access for product reads.

Phase 25 reran pure engine replay with the read-only product source. It loaded 164 product rows, 164 scorer-compatible rows, and produced 656 candidate rows.

## Actual Capture Evidence

Source:

- `tmp/evaluator-boundary-actual-coverage.json`

Summary:

- complete/product_row captures: 10
- total high-confidence candidate rows: 1,640
- boundary applicable rows: 86
- safe_low_risk hidden rows: 50
- safe_low_risk hidden decision: 50/50 `downgrade_to_collapsed_candidate`
- highRiskCollapsedCount: 0

Actual capture gaps:

- active_leaning only: not observed
- metadata_incomplete: not observed
- serum category: not observed
- strong caution: not observed

This remains actual complete/product_row evidence only. It is not mixed with pure replay rows.

## Pure Engine Replay Evidence

Source:

- `tmp/evaluator-boundary-pure-engine-target-replay.json`

Summary:

- evidenceType: `pure_engine_replay`
- routeInvoked: false
- supabaseWriteExecuted: false
- runtimeMutation: false
- productRowsLoaded: 164
- scorerCompatibleRows: 164
- scenariosAttempted: 4
- scenariosSucceeded: 4
- total candidate rows: 656
- boundary applicable rows: 258
- safe_low_risk hidden rows: 150
- safe_low_risk hidden decision: 150/150 `downgrade_to_collapsed_candidate`
- highRiskCollapsedCount: 0

Scenario boundary rows:

- `target_active_acne_recent_instability`: 86
- `target_redness_barrier_recent_instability`: 0
- `target_pores_tone_active_recent_instability`: 86
- `target_serum_tone_acne_recent_instability`: 86

Pure replay gaps:

- active_leaning only: not observed
- metadata_incomplete: not observed
- serum category: observed, 168 serum-family rows and 66 boundary-applicable rows
- strong caution: not observed

The serum gap is now partially covered by pure replay evidence. The replay showed serum-family candidates without making category alone a hard-block preservation rule.

## Synthetic Coverage Evidence

Source:

- `docs/reviews/evaluator-boundary-coverage-gaps-20260703.md`
- `scripts/verify-evaluator-boundary-coverage-gaps.mjs`

Synthetic policy outcomes:

- active_leaning only safe metadata -> `downgrade_to_collapsed_candidate`
- active_leaning only unsafe metadata -> `preserve_hard_block`
- metadata_incomplete -> `requires_metadata_review`
- serum safe metadata -> `downgrade_to_collapsed_candidate`
- serum strong caution/high-risk -> `preserve_hard_block`
- strong caution -> `preserve_hard_block`
- cautionTags empty plus low/safe metadata does not force hard block or metadata review

This is controlled policy coverage. It is not actual capture evidence and not product distribution evidence.

## Gap Status

### active_leaning only

Actual capture: not observed.

Pure replay: not observed.

Synthetic coverage: safe metadata downgrades to collapsed candidate, unsafe metadata preserves hard block.

Readiness impact: does not block design if kept as a documented distribution limitation and if Phase 27 preserves the unsafe/high-risk invariant.

### metadata_incomplete

Actual capture: not observed.

Pure replay: not observed.

Synthetic coverage: routes to `requires_metadata_review`.

Readiness impact: does not block design if the metadata review branch remains part of the hint contract and is not silently treated as safe.

### serum category

Actual capture: not observed.

Pure replay: observed. Serum-family rows appeared in read-only replay, including 168 total rows and 66 boundary-applicable rows.

Synthetic coverage: safe metadata can downgrade to collapsed candidate; strong caution/high-risk preserves hard block.

Readiness impact: supports moving to design because category-only hard-block generalization was not observed in pure replay.

### strong caution

Actual capture: not observed.

Pure replay: not observed.

Synthetic coverage: preserves hard block.

Readiness impact: does not block design if strong caution remains a required hard-block preservation invariant.

## Safety And Consistency

High-risk protection:

- actual highRiskCollapsedCount: 0
- pure replay highRiskCollapsedCount: 0
- safety regression check: passed

Low-risk collapsed consistency:

- actual safe_low_risk hidden: 50/50 collapsed
- pure replay safe_low_risk hidden: 150/150 collapsed
- consistency check: passed

## Readiness Status

`ready_for_boundary_integration_design`

Reasons:

- safe_low_risk hidden rows consistently downgrade to collapsed candidate in actual and pure replay evidence.
- high-risk collapsed count remains 0 in actual and pure replay evidence.
- serum-family candidates were observed in pure replay.
- remaining active_leaning only, metadata_incomplete, and strong-caution non-observations are documented distribution limitations with synthetic policy coverage.

This status only means Phase 27 can design the integration boundary. It does not approve runtime behavior changes.

## Phase 27 Allowed Scope

Allowed:

- evaluator pass plus collapsed hint design
- integration design document
- shadow-only what-if runner
- CandidatePolicy hint contract design

## Phase 27 Prohibited Scope

Still prohibited:

- evaluator runtime change
- CandidatePolicy runtime connection
- `/api/analyze` result change
- UI exposure change
- DB storage or schema change
- recommendation result replacement

## Runtime Non-Application

Phase 26 did not invoke `/api/analyze`, did not execute Supabase write, and did not mutate runtime behavior.

Runtime flags:

- routeInvoked: false
- supabaseWriteExecuted: false
- runtimeMutation: false

## Remaining Limitations

- actual capture and pure engine replay are different evidence types.
- synthetic coverage is not actual product distribution evidence.
- active_leaning only remains unobserved in actual and pure replay evidence.
- metadata_incomplete remains unobserved in actual and pure replay evidence.
- strong caution remains unobserved in actual and pure replay evidence.
- pure engine replay does not exercise route guard/session/premium-store mutation boundaries.
- read-only product source availability is environment-dependent.

## Phase 27 Return Point

Start from `ready_for_boundary_integration_design` and produce a design-only evaluator pass plus collapsed hint contract. Keep it shadow/what-if until a separate runtime integration task is explicitly approved.
