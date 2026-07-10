# CandidatePolicy Hint Receiver Design

이 문서는 CandidatePolicy hint receiver 설계 문서이며, runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다.

## Purpose

Phase 27 designed an evaluator pass plus collapsed hint contract for the `recent_instability_active_limited` boundary. Phase 28 defines how a future CandidatePolicy layer should receive that hint and translate it into a future exposure group.

This is a design-only and shadow-only contract. It does not import into or modify runtime CandidatePolicy.

## Phase 27 Summary

Phase 27 recommended Option B: evaluator pass plus collapsed hint.

What-if summary:

- actual evidence: 52 collapsed hints, 50 safe_low_risk hidden rows accepted, 0 high-risk collapsed hints
- pure replay evidence: 156 collapsed hints, 150 safe_low_risk hidden rows accepted, 39 serum-family collapsed hints, 0 high-risk collapsed hints

The Phase 27 output remains `integration_whatif_shadow`, not runtime behavior.

## Why A Receiver Is Needed

The evaluator boundary hint says a blocked candidate may be a narrow exception. CandidatePolicy still needs its own receiver guardrail before assigning the final exposure group.

The receiver prevents these failures:

- treating all evaluator exceptions as collapsed candidates
- collapsing high-risk, sensitivity-unsafe, or strong-caution candidates
- treating metadata-incomplete candidates as safe
- exposing internal reason keys directly to UI

## Responsibility Boundary

### Evaluator

- decides hard block status
- may mark a narrow future pass candidate
- may attach `collapsed_candidate_hint`
- preserves hard block for unsafe or strong-caution cases

### Boundary Hint Contract

- carries the narrow exception result from boundary policy
- does not decide final exposure UI group
- does not replace CandidatePolicy
- remains runtime-disconnected in Phase 28

### CandidatePolicy Hint Receiver

- receives `collapsed_candidate_hint`, `hidden_candidate_hint`, or `insufficient_evidence_hint`
- translates the hint into a future exposure group
- preserves hidden candidates when safety guardrails fail
- routes metadata gaps to insufficient evidence

### UI

- does not display receiver internal reason keys directly
- uses a future UI/copy layer for user-facing text
- does not get any new response field in Phase 28

## Receiver Contract

Design helper:

```js
resolveCandidatePolicyHintReceiver({
  candidateEvaluation,
  collapsedHintResult,
  currentExposureDecision,
  guardExposurePolicy
})
```

Returns:

- `applies`
- `receivedHint`
- `receiverDecision`
- `futureExposureGroup`
- `visibilityPriority`
- `userMessageType`
- `reasons`
- `receiverContext`
- `runtimeConnected: false`

Receiver decisions:

- `accept_collapsed_candidate_hint`
- `preserve_hidden_candidate`
- `route_to_insufficient_evidence`
- `keep_existing_exposure`
- `not_applicable`

Future exposure groups:

- `collapsed_candidate`
- `hidden_candidate`
- `insufficient_evidence_candidate`
- `unchanged`

## Hint Handling

`collapsed_candidate_hint`:

- accepted only when boundary decision is `downgrade_to_collapsed_candidate`
- accepted only with low/medium irritation risk and sensitivity-safe metadata
- maps to `collapsed_candidate`

`hidden_candidate_hint`:

- preserves hidden status
- maps to `hidden_candidate`

`insufficient_evidence_hint`:

- does not become collapsed or hidden by assumption
- maps to `insufficient_evidence_candidate`

`none`:

- keeps existing exposure unchanged

## High-risk Guardrail

The receiver must never produce `collapsed_candidate` when any of these are present:

- `unsafe_high_risk`
- high irritation risk
- `sensitivitySafe === false`
- strong caution signal

## Metadata Incomplete Principle

Metadata incomplete is not enough for collapsed exposure. The receiver routes metadata-incomplete cases to `insufficient_evidence_candidate`.

## Evidence Separation

Actual capture evidence and pure replay evidence remain separate:

- actual evidence comes from complete/product_row capture artifacts
- pure replay evidence comes from `pure_engine_replay`
- synthetic policy coverage validates missing branches only

Synthetic coverage is not recorded as actual evidence.

## Runtime Non-application

Phase 28 does not change or connect:

- `/api/analyze`
- `lib/skin-match-decision-engine.js`
- `lib/functional-ranking-contract.js`
- `lib/functional-candidate-policy.js`
- UI/API response
- DB/Supabase schema or migration
- product data
- recommendation output

## Phase 29 Return Point

Phase 29 can design shadow-only receiver tests or runtime acceptance criteria. Actual evaluator/CandidatePolicy wiring still requires a separate approved task.
