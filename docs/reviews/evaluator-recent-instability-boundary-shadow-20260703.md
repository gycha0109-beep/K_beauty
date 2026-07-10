# Evaluator Recent-Instability Boundary Shadow Review

This is a shadow-only policy review. It does not change evaluator hard filters, score, CandidatePolicy runtime, UI, API response, DB, Supabase, product data, or existing recommendations.

## Review Scope
- source: tmp/functional-shadow-captures/candidate-exposure-audit.json
- included confidence: high
- target: evaluator blocked candidates with `recent_instability_active_limited`
- reviewed count: 86

## Actual Evidence
- safe_low_risk hidden reviewed: 50
- preserved hard block: 33
- downgraded to collapsed candidate: 52
- metadata review: 0
- not applicable: 1
- high-risk collapsed count: 0

## Virtual Reclassification Result
- safe_low_risk hidden:
  - preserve_hard_block: 0
  - downgrade_to_collapsed_candidate: 50
  - requires_metadata_review: 0
  - not_applicable: 0

## Category Distribution
- cleanser: {"downgrade_to_collapsed_candidate":5,"preserve_hard_block":10}
- essence: {"downgrade_to_collapsed_candidate":9,"preserve_hard_block":1}
- moisturizer: {"downgrade_to_collapsed_candidate":18,"preserve_hard_block":7}
- sunscreen: {"downgrade_to_collapsed_candidate":7,"preserve_hard_block":2}
- toner_pad: {"downgrade_to_collapsed_candidate":9,"preserve_hard_block":6}
- treatment: {"downgrade_to_collapsed_candidate":4,"not_applicable":1,"preserve_hard_block":7}

## Functional Profile Distribution
- mixed: {"downgrade_to_collapsed_candidate":52,"not_applicable":1,"preserve_hard_block":33}

## Safety Metadata Profile Distribution
- mixed_or_uncertain: {"preserve_hard_block":33}
- safe_low_risk: {"downgrade_to_collapsed_candidate":50}
- safe_medium_risk: {"downgrade_to_collapsed_candidate":2}
- unsafe_high_risk: {"not_applicable":1}

## Reason Distribution
- active_functional_axis: 85
- high_sensitivity_context: 85
- independent_hard_filter_reason_present: 1
- low_irritation_risk: 51
- medium_irritation_risk: 34
- recent_instability_active_limited_block: 85
- recent_instability_context: 85
- sensitivity_safe_false: 33
- sensitivity_safe_true: 52
- stabilizing_functional_axis: 85

## Limitations
- active_leaning_only_profile_not_observed
- metadata_incomplete_cases_not_observed
- serum_category_not_observed

## Runtime Conclusion
- No runtime policy was applied.
- The shadow boundary can deterministically identify candidates where broad recent-instability blocking conflicts with favorable product-level safety metadata.
- This is evidence for a future policy task, not proof that the existing evaluator is wrong.

## Next Conditions
- Add active-leaning-only comparison samples.
- Add metadata-incomplete comparison samples.
- Add serum category samples.
- Add high-risk or strong-caution metadata samples to verify preservation behavior.

## Case Sample
- cleanser / mixed_or_uncertain / mixed -> preserve_hard_block
- cleanser / mixed_or_uncertain / mixed -> preserve_hard_block
- cleanser / safe_low_risk / mixed -> downgrade_to_collapsed_candidate
- cleanser / mixed_or_uncertain / mixed -> preserve_hard_block
- cleanser / mixed_or_uncertain / mixed -> preserve_hard_block
- cleanser / safe_low_risk / mixed -> downgrade_to_collapsed_candidate
- cleanser / mixed_or_uncertain / mixed -> preserve_hard_block
- cleanser / safe_low_risk / mixed -> downgrade_to_collapsed_candidate