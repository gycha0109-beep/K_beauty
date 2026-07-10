# Evaluator Boundary Collapsed Hint Integration Design

이 문서는 evaluator boundary collapsed hint 통합 설계 문서이며, runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다.

## Purpose

Phase 26 marked the `recent_instability_active_limited` boundary as `ready_for_boundary_integration_design`. This document defines a design-only integration contract for a possible future evaluator pass plus collapsed hint flow.

This is not runtime wiring. No evaluator hard filter, score, weight, CandidatePolicy, UI, API response, DB, Supabase, product data, capture fixture, `topPick`, `supportingProducts`, or `budgetAlternatives` behavior is changed.

## Phase 16-26 Evidence Summary

Phase 16 introduced the shadow boundary policy. It reviewed 86 high-confidence evaluator hard-block rows and found 52 `downgrade_to_collapsed_candidate`, 33 `preserve_hard_block`, 1 `not_applicable`, and 0 high-risk collapsed rows.

Phase 17 validated synthetic policy gaps:

- active-leaning safe metadata -> collapsed candidate
- active-leaning unsafe metadata -> preserve hard block
- metadata incomplete -> metadata review
- serum safe metadata -> collapsed candidate
- serum strong caution/high-risk -> preserve hard block
- strong caution -> preserve hard block

Phase 18 actual evidence confirmed 10 complete/product_row captures, 1,640 candidate rows, 86 boundary-applicable rows, and 50 safe_low_risk hidden rows. All 50 would become collapsed candidates under the shadow boundary. High-risk collapsed count stayed 0.

Phase 22 pure replay initially failed because the product source was not scorer-compatible.

Phase 24 traced the source issue to direct Node env loading and confirmed the read-only product source can work without service-role access.

Phase 25 pure replay loaded 164 product rows, 164 scorer-compatible rows, and 656 candidate rows. It observed 150 safe_low_risk hidden rows and 168 serum-family rows. High-risk collapsed count stayed 0.

Phase 26 concluded `ready_for_boundary_integration_design`, not runtime approval.

## Collapsed Hint Contract

Design helper:

```js
resolveEvaluatorBoundaryCollapsedHint({
  candidateEvaluation,
  boundaryPolicyResult,
  exposureContext
})
```

The helper is pure and returns:

- `applies`
- `sourceHardFilterReason`
- `boundaryDecision`
- `futureEvaluatorAction`
- `candidatePolicyHint`
- `reasons`
- `integrationContext`
- `runtimeConnected: false`

Allowed future evaluator actions:

- `preserve_hard_block`
- `future_pass_with_collapsed_hint`
- `requires_metadata_review`
- `not_applicable`

Allowed CandidatePolicy hints:

- `collapsed_candidate_hint`
- `hidden_candidate_hint`
- `insufficient_evidence_hint`
- `none`

Mapping:

- `downgrade_to_collapsed_candidate` -> `future_pass_with_collapsed_hint` + `collapsed_candidate_hint`
- `preserve_hard_block` -> `preserve_hard_block` + `hidden_candidate_hint`
- `requires_metadata_review` -> `requires_metadata_review` + `insufficient_evidence_hint`
- `not_applicable` -> `not_applicable` + `none`

Safety guardrail:

- high irritation risk, `sensitivity_safe === false`, or strong caution context cannot receive `collapsed_candidate_hint`
- metadata incomplete cannot receive `collapsed_candidate_hint`
- category alone cannot force hard-block preservation

## Responsibility Boundary

Evaluator responsibility:

- decide whether a candidate is normally hard-blocked
- in a future approved design, allow only the narrow boundary to pass
- attach a collapsed hint only when the boundary policy says `downgrade_to_collapsed_candidate`
- preserve hard block for unsafe or strong-caution cases

CandidatePolicy responsibility:

- receive a hint contract, not raw evaluator internals
- decide final exposure group
- keep collapsed candidate distinct from primary/contextual candidates
- keep insufficient metadata separate from safety hard block

The current implementation only models this boundary in what-if shadow output.

## Option Comparison

### Option A: evaluator hard filter relaxation

Description:

- Relax the evaluator hard filter directly.

Benefits:

- single decision point
- simple downstream exposure model

Risks:

- highest runtime behavior blast radius
- easiest path to changing existing recommendations immediately
- harder to audit hidden safety semantics after relaxation

Required guardrails:

- separate runtime approval
- high-risk preservation invariant
- API response regression checks

Recommendation:

- not recommended for the next step

### Option B: evaluator pass plus collapsed hint

Description:

- evaluator passes only the narrow boundary and attaches a collapsed hint
- CandidatePolicy decides final exposure group

Benefits:

- keeps evaluator and exposure responsibilities explicit
- preserves high-risk hard-block behavior
- supports shadow what-if validation before runtime wiring
- aligns with Phase 26 readiness result

Risks:

- requires a stable hint contract
- requires CandidatePolicy integration approval later

Required guardrails:

- collapsed hint only for boundary `downgrade_to_collapsed_candidate`
- metadata incomplete routes to review
- unsafe or strong-caution context remains hidden
- actual capture and pure replay evidence stay separate

Recommendation:

- recommended design option

### Option C: exposure-layer post-process

Description:

- evaluator stays blocked and exposure layer post-processes blocked candidates.

Benefits:

- does not alter evaluator output
- can remain exposure-only in shadow

Risks:

- blurs responsibility between evaluator and exposure layers
- can duplicate boundary policy logic
- blocked candidate provenance becomes harder to interpret

Required guardrails:

- blocked reason provenance retained
- no public exposure without runtime approval
- strict evidence separation

Recommendation:

- acceptable only as a temporary shadow analysis shape, not preferred for integration design

## Recommended Option

Option B: evaluator pass plus collapsed hint.

The reason is narrowness. The boundary policy already separates low-risk collapsed candidates, high-risk hard blocks, metadata review, and not-applicable cases. Option B preserves that separation in a contract that CandidatePolicy can consume later, without changing runtime now.

## High-risk Guardrail

A candidate cannot receive `collapsed_candidate_hint` if any of these are true:

- high irritation risk
- explicit non-safe sensitivity metadata
- strong caution signal
- unsafe high-risk safety metadata profile

The Phase 27 what-if output found 0 high-risk collapsed hints in actual evidence and 0 in pure replay evidence.

## Metadata Incomplete Principle

Metadata incomplete is neither safe enough for collapsed exposure nor unsafe enough for hard-block preservation by itself. It must route to `requires_metadata_review` and `insufficient_evidence_hint`.

Current actual and pure replay evidence did not observe metadata-incomplete rows. This remains a limitation and a required invariant for future design work.

## Evidence Separation

Actual capture evidence:

- comes from complete/product_row shadow captures
- has 10 complete captures and 1,640 candidate rows
- has 50 safe_low_risk hidden rows

Pure replay evidence:

- has `evidenceType: pure_engine_replay`
- does not call `/api/analyze`
- has 164 product rows and 656 candidate rows
- has 150 safe_low_risk hidden rows

Synthetic coverage:

- validates missing matrix cells
- is not actual capture evidence
- is not counted as product distribution evidence

## Runtime Non-application

Phase 27 does not connect this helper to:

- `/api/analyze`
- `lib/skin-match-decision-engine.js`
- `lib/functional-ranking-contract.js`
- `lib/functional-candidate-policy.js`
- UI or API response
- DB/Supabase schema or migration
- product data

## Phase 28 Return Point

If approved, Phase 28 should remain shadow-only unless explicitly scoped otherwise:

- expand what-if coverage for active-leaning only, metadata-incomplete, and strong-caution rows
- design CandidatePolicy hint receiver tests
- define runtime integration acceptance criteria

Runtime wiring still requires a separate approval task.
