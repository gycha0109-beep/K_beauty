# Functional Exposure Readiness Review

## Review Scope

- phase: 13
- scope: high-confidence complete shadow exposure grouping review
- target: decide whether `collapsed_candidate` is ready for future CandidatePolicy shadow integration
- runtime approval: no
- runtime/API/UI/recommendation changes: no

Evidence sources:

- `tmp/functional-shadow-captures/candidate-exposure-audit.json`
- `tmp/functional-shadow-captures/replay-summary.json`
- `tmp/functional-shadow-captures/exposure-readiness-review.json`

## Hidden Breakdown

The readiness review must count hidden candidates separately from collapsed candidates.

Required hidden checks:

- total hidden count
- evaluator hard filter reason distribution
- recent-instability guard reason distribution
- `safe_low_risk` hidden count
- `safe_low_risk` hidden reason distribution
- category distribution for `safe_low_risk` hidden
- functional profile distribution for `safe_low_risk` hidden
- high sensitivity / recent instability / both / neither split
- evaluator blocked vs guard hard-block candidate split

Interpretation rule:

- `safe_low_risk` hidden is not automatically a bug.
- It can still be explained by evaluator hard block, current safety context, category role, or current-condition rules.
- Repeated broad hidden reasons should open a targeted hidden-reason policy review, not a direct runtime change.

## Collapsed Breakdown

The readiness review must verify that collapsed candidates are separable from hidden candidates.

Required collapsed checks:

- total collapsed count
- safety metadata profile ratios: `safe_low_risk`, `safe_medium_risk`, `mixed_or_uncertain`, `unsafe_high_risk`
- category distribution and ratio
- functional profile distribution and ratio
- high-confidence capture-level collapsed rate variation
- collapsed/hidden overlap count
- whether current product `duplicate_axis` or `supports_goal` context flipped collapsed candidates to hidden

Policy interpretation:

- `collapsed_candidate` can be read as normal recommendation exclusion plus stabilization-first consideration only when it remains distinct from hidden.
- It is not a product-unsuitable judgment.
- It is not a score change.
- It is not a UI group in this phase.

## Integration Readiness

Allowed readiness statuses:

- `ready_for_shadow_candidate_policy_integration`
- `needs_hidden_reason_policy_review`
- `needs_metadata_or_coverage_expansion`
- `insufficient_evidence`

Readiness does not approve runtime application.

Even if the status is `ready_for_shadow_candidate_policy_integration`, the next step is only shadow CandidatePolicy integration. Runtime wiring, UI grouping, API response changes, DB writes, and existing recommendation replacement stay out of scope.

## Still Not Allowed

- Do not change `/api/analyze`.
- Do not change evaluator hard filters, scoring, or ranking.
- Do not change `functional-candidate-policy.js` runtime behavior.
- Do not change UI exposure.
- Do not change API response fields.
- Do not change DB, Supabase, product data, or capture fixtures.
- Do not alter existing `topPick`, `supportingProducts`, or `budgetAlternatives`.

## Sample Limitations

The review must call out insufficient coverage before any integration confidence is raised.

Known areas requiring caution:

- `active_leaning` only profile coverage
- `serum` category coverage
- metadata-incomplete cases
- whether `insufficient_evidence` count 0 reflects real coverage or complete-source fixture bias
- whether treatment / toner_pad exposure behavior can share policy with moisturizer / sunscreen

## Next Step Conditions

Shadow CandidatePolicy integration can be considered only when:

- high-confidence complete capture count meets the minimum threshold
- collapsed group count meets the minimum threshold
- hidden and collapsed have no overlap
- `safe_low_risk` hidden reasons are explainable or separately reviewed
- category and functional profile gaps are explicitly accepted or filled

If these conditions are not met, collect more high-confidence complete captures or open a targeted hidden-reason policy review first.
