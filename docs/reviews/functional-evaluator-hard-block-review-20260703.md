# Functional Evaluator Hard Block Review

This is a shadow-only policy review. It does not change evaluator hard filters, scores, CandidatePolicy runtime, UI, API response, DB, or product data.

## Review Scope
- audit version: functional-candidate-exposure-audit-v1
- included confidence: high
- included fixtures: 10
- target criteria: exposureStatus=hidden_candidate; safetyMetadataProfile=safe_low_risk; blockedBy.evaluator=true; hardFilterReasons includes recent_instability_active_limited

## Evidence Source
- tmp/functional-shadow-captures/candidate-exposure-audit.json
- Candidate-level review rows generated from complete product-row shadow captures.

## Evaluator Hard Block Rule Breakdown
- reviewed cases: 50
- safe_low_risk hidden count: 50
- recent_instability_active_limited count: 50
- recent_instability_active_limited rate: 1
- evaluator only count: 50
- guard overlap count: 0
- hard filter reasons:
- recent_instability_active_limited: 50
- guard reasons:
- active_functional_axis: 50
- high_sensitivity_detected: 50
- low_irritation_risk: 50
- recent_instability_detected: 50
- redness_safety_goal: 50
- sensitivity_safe_true: 50
- stabilize_first_guard: 50
- stabilizing_functional_axis: 50
- blocked source:
- evaluator_only: 50

## Category Breakdown
- cleanser: 5
- essence: 9
- moisturizer: 17
- sunscreen: 7
- toner_pad: 8
- treatment: 4

## Functional Profile Breakdown
- mixed: 50

## Safety Context Breakdown
- both: 50

## Product Metadata Coverage
- irritation risk:
- low: 50
- sensitivity safe:
- true: 50
- active axis:
- active_axis_present: 50
- stabilizing axis:
- stabilizing_axis_present: 50
- profile evaluable:
- true: 50
- caution tags:
- exfoliation_overlap_watch: 3
- none: 42
- rinse_off_limit: 5

## Core Policy Questions
- evaluator and guard duplicate blocking: No overlap in target cases; all target cases are evaluator-only blocks.
- `recent_instability_active_limited` appears to be a safety-context plus active-axis evaluator rule in this evidence, not a product-name or brand rule.
- Low irritation plus sensitivity-safe products are still hard-blocked when recent instability, high sensitivity, active axis, and target ranking/safety context align.
- stabilizing profile handling: no stabilizing_leaning-only target cases were observed.
- Future collapsed exposure boundary should be reviewed where product safety metadata is favorable but evaluator blocks only because of recent-instability active-axis policy.
- This evidence is enough to open a targeted policy review question, not enough to change runtime behavior.

## Policy Assessment
- status: possible_evaluator_overblocking
- runtime change approved: false
- This review analyzes shadow candidate evidence only.
- It does not change evaluator hard filters or CandidatePolicy runtime behavior.
- Repeated safe-low-risk evaluator hard blocks are policy review signals, not automatic fixes.

## Explicit Non-actions
- Do not change `lib/functional-ranking-contract.js` in this review.
- Do not change evaluator hard filters, score, or weight.
- Do not connect CandidatePolicy runtime or UI.
- Do not change API response, DB, Supabase, product data, or existing recommendation output.

## Limitations
- caution_tags_absent_or_empty_in_some_cases: true

## Next Action Recommendation
- Open a targeted evaluator hard-block boundary policy review before changing any runtime hard filter.