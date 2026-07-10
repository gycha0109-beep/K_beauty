# Runtime Integration Acceptance Criteria

이 문서는 runtime integration acceptance criteria 문서이며, runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다.

## Purpose

Phase 16 through Phase 28 produced boundary policy, collapsed hint, and CandidatePolicy hint receiver evidence for the `recent_instability_active_limited` hard block boundary. This document fixes the gates that must pass before a future task may move from shadow design to a runtime integration plan.

This document does not connect evaluator runtime, CandidatePolicy runtime, `/api/analyze`, UI exposure, DB storage, Supabase schema, product data, or recommendation output.

## Phase 16-28 Summary

- Phase 16-18 established recent-instability boundary shadow evidence and actual complete/product_row coverage.
- Phase 19-25 added targeted replay and read-only product source replay evidence.
- Phase 26 found the boundary ready for integration design, not runtime connection.
- Phase 27 selected Option B: evaluator pass plus collapsed hint, as a shadow what-if design.
- Phase 28 defined a CandidatePolicy hint receiver contract and verified receiver what-if behavior.

## Evidence Roles

Actual evidence:

- Comes from complete/product_row capture artifacts.
- Confirms current captured candidate rows and actual boundary-applicable rows.
- Must not include pure replay product source counts.

Pure replay evidence:

- Comes from `pure_engine_replay`.
- Uses read-only product rows outside `/api/analyze`.
- Must not be counted as actual capture evidence.

Synthetic coverage:

- Validates missing policy branches.
- Is not actual distribution evidence.
- Can only satisfy required contract-test coverage for unobserved gaps.

## Gate A: Safety Regression

Runtime integration planning is blocked if any high-risk collapsed hint or receiver count is above zero.

Required pass condition:

- actual high-risk collapsed hint count is `0`
- pure replay high-risk collapsed hint count is `0`
- actual high-risk collapsed receiver count is `0`
- pure replay high-risk collapsed receiver count is `0`

## Gate B: Low-risk Consistency

Low-risk recent-instability hidden rows must consistently resolve to collapsed hint and receiver acceptance.

Required pass condition:

- actual safe_low_risk hidden rows: `50 / 50` accepted
- pure replay safe_low_risk hidden rows: `150 / 150` accepted

## Gate C: Evidence Separation

Actual capture, pure replay, and synthetic coverage must stay separated.

Required pass condition:

- actual evidence remains labeled `actual_complete_product_row_capture`
- pure replay evidence remains labeled `pure_engine_replay`
- synthetic coverage is not recorded as actual evidence

## Gate D: Serum Category

Serum-family evidence must prove category is not the exposure decision by itself.

Required pass condition:

- serum-family candidates are observed in pure replay
- safe serum-family collapsed hints require boundary downgrade and safe metadata
- high-risk or strong-caution serum-family cases preserve hidden or hard block
- category alone does not decide collapsed or hidden exposure

## Gate E: Metadata Incomplete

Metadata incomplete remains unobserved in actual and pure replay evidence. This does not automatically block planning when synthetic coverage passes, but it creates a mandatory contract test before runtime work.

Required contract test:

- metadata incomplete routes to `insufficient_evidence_candidate`
- metadata incomplete must not become collapsed by assumption

## Gate F: Strong Caution

Strong caution remains unobserved in actual and pure replay evidence. Synthetic coverage must preserve hard block or hidden status, and runtime work requires explicit tests.

Required contract test:

- strong caution preserves hidden or hard block
- strong caution must not become collapsed even when category is otherwise eligible

## Gate G: Active-only

Active-only remains unobserved in actual and pure replay evidence. Synthetic coverage must preserve the safe/unsafe split.

Required contract test:

- active-only plus safe metadata may resolve to collapsed candidate
- active-only plus unsafe metadata preserves hidden or hard block

## Gate H: Runtime Isolation

The acceptance review must remain disconnected from runtime.

Required pass condition:

- `routeInvoked: false`
- `supabaseWriteExecuted: false`
- `runtimeMutation: false`
- `/api/analyze`, evaluator runtime, CandidatePolicy runtime, UI/API/DB files, and product data stay unchanged

## Required Contract Tests Before Runtime

- `metadata_incomplete_routes_to_insufficient_evidence`
- `strong_caution_preserves_hidden_or_hard_block`
- `active_only_safe_collapses_unsafe_preserves_hidden`
- `high_risk_or_sensitivity_unsafe_never_collapses`
- `serum_category_does_not_drive_exposure_by_itself`
- `actual_and_pure_replay_evidence_remain_separate`

## Required Shadow Dry-runs Before Runtime

- Shadow runtime dry-run with evaluator pass plus collapsed hint disabled by default.
- Shadow runtime dry-run records hint receiver decisions without API response changes.
- Shadow runtime dry-run confirms zero high-risk collapsed receiver count.
- Shadow runtime dry-run compares hidden-to-collapsed delta against Phase 27 and Phase 28 baselines.

## Phase 30 Allowed Scope

- Runtime integration plan design
- Shadow runtime dry-run design
- Contract-test plan for unobserved gaps
- Rollback and observability criteria design

## Still Prohibited

- Evaluator runtime connection
- CandidatePolicy runtime connection
- `/api/analyze` result change
- UI exposure change
- DB or Supabase schema change
- Recommendation result replacement

## Runtime Non-application

This criteria document is not runtime approval. A `ready_for_runtime_integration_plan` status only means the next phase may design a plan or shadow dry-run gate. It does not permit implementation of runtime policy changes.
