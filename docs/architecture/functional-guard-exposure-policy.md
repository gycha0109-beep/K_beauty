# Functional Guard Exposure Policy

## Why Separate Guard Judgment From Exposure

Ranking evaluator and guard policy answer: “How cautious should we be with this product under the current skin state?”

CandidatePolicy answers: “How should that caution level change product exposure in the recommendation surface?”

Keeping these responsibilities separate prevents safety metadata, score calculation, candidate grouping, and UI copy from becoming one coupled decision. Phase 11 defines a pure bridge contract only; it does not connect runtime code or change existing recommendations.

## Responsibility Boundaries

### Evaluator / Guard Policy

Inputs:

- survey safety signals
- goal policy
- product safety metadata
- product functional profile

Outputs:

- candidate risk or caution state
- guard level
- hard-block candidate state
- collapsed-exposure candidate state
- insufficient-data state

Does not decide:

- UI group names
- candidate array movement
- exposure order
- user-facing copy

### CandidatePolicy

Inputs:

- candidate evaluation
- guard policy output
- ranking context
- current product finding
- recommendation guard

Outputs:

- candidate exposure status
- primary/collapsed/hidden inclusion flags
- visibility priority
- message type

Does not:

- recompute risk
- reinterpret product safety metadata
- recalculate ranking score
- reverse evaluator hard blocks

## Helper Contract

`resolveFunctionalGuardExposurePolicy({ candidateEvaluation, recentInstabilityGuardPolicy, goalPolicy, currentProductFinding })`

Returns:

```js
{
  exposureStatus,
  includeInPrimaryCandidates,
  includeInCollapsedCandidates,
  includeInHiddenCandidates,
  visibilityPriority,
  userMessageType,
  reasons,
  policyContext,
  implementationBoundary
}
```

## Exposure Status

### `primary_candidate`

Normal candidate exposure. Used when guard decision is `no_guard` and the candidate is eligible.

### `contextual_candidate`

Candidate remains in primary consideration, but future UI may attach a caution notice. Used for `allow_with_context` and low/medium guard conditions that are not collapsed or blocked.

### `collapsed_candidate`

Candidate is not a normal top recommendation. It remains available for a future “consider after stabilizing” or similar group. This does not mean the product is bad or unsuitable.

### `hidden_candidate`

Candidate is excluded from normal exposure because evaluator hard block or guard hard-block candidate takes priority. Hidden is a safety/exposure state, not a product-quality judgment.

### `insufficient_evidence_candidate`

Candidate is not actively promoted because structured evidence is not enough. This is not hidden and not a negative product judgment.

## Policy Priority

Deterministic priority:

1. evaluator hard block
2. recent-instability hard-block candidate
3. insufficient data
4. collapsed exposure candidate
5. current routine duplicate/supports-goal context
6. contextual caution
7. normal primary candidate

Rules:

- hard block wins over collapsed candidate
- insufficient data is evidence-limited, not hidden
- duplicate-axis current routine context cannot reverse safety
- current routine status cannot reverse safety
- high score cannot reverse hard block

## Collapsed Candidate Meaning

`collapsed_candidate` is the future interpretation of `collapsed_exposure_candidate`:

- remove from normal primary/top recommendation group
- keep as a lower-priority candidate
- frame as “stabilize first, consider later” in a future UI
- do not call it unsafe or poor quality

It is not:

- top-pick replacement
- score adjustment
- implemented UI state
- runtime behavior in this phase

## Insufficient Evidence Meaning

`insufficient_evidence_candidate` means the policy does not have enough structured evidence to promote the product strongly.

It does not mean:

- the product is bad
- the product is unsafe
- the product should be removed from the catalog

Future UI may explain that safety or functional evidence was incomplete.

## Current Product Finding Role

Current product findings are only exposure context:

- `duplicate_axis`: do not promote collapsed candidates into primary; do not hide by itself
- `supports_goal`: can support compare-later interpretation; no replacement judgment
- `not_in_db` / `unanswered`: neutral, no negative inference
- `not_using`: future add-missing-step context only; no score or safety change here

## User Message Types

`none`:

- no special exposure message

`stabilize_first_notice`:

- current skin state should be stabilized first
- product itself is not judged as bad

`contextual_caution`:

- caution may be needed under the current context
- no medical diagnosis or treatment wording

`insufficient_evidence_notice`:

- structured evidence is insufficient for active promotion

`hard_safety_guard_notice`:

- current input conditions and product safety signals conflict with normal exposure
- avoid “dangerous” or “do not use” wording

## Runtime Non-Application

`functional-guard-exposure-policy.js` is not imported by:

- `/api/analyze`
- `functional-ranking-contract.js`
- `functional-candidate-policy.js`
- UI components

This phase does not change runtime hard filters, ranking scores, recommendation payloads, or UI exposure.

## Future CandidatePolicy Integration Conditions

Before wiring:

- approve whether collapsed exposure belongs in CandidatePolicy or evaluator soft state
- collect/confirm additional samples for missing matrix cells
- define response/storage boundary checks
- keep UI grouping as a separate task after policy integration

Known sample gaps from Phase 10:

- `metadata_incomplete` was absent in complete capture products
- pure `active_leaning` products were absent
- `serum` category was not independently represented in the matrix summary

## Next Step Conditions

This helper can only be connected in a separate approved implementation task. That task must state whether `collapsed_candidate` becomes a CandidatePolicy group, evaluator non-blocking status, or both. Existing recommendation results must remain unchanged until that separate task is explicitly approved and verified.
