# Recent Instability Guard Matrix Review

## Purpose
Validate the pure `resolveRecentInstabilityGuardPolicy()` helper against complete shadow candidate sources and synthetic safety contexts. This does not change runtime ranking behavior.

## Actual High-Confidence Capture Observation
- source: Phase 8 safety review analysis
- high-confidence safety cases: 3
- finding: One high-sensitivity product-risk case supported keeping hard-block candidacy; two recent-instability cases with favorable product safety metadata suggested possible overblocking.

## Synthetic Matrix Validation Method
- Reused complete product-row shadow capture candidate sources.
- Replayed 12 synthetic policy contexts across each candidate row.
- Called product functional profile resolution and recent-instability policy helper only.

## Source Scope
- included complete captures: 10
- excluded fixtures: 10
- unique candidate products: 164
- total capture product rows: 1640
- total matrix evaluations: 19680

### Safety Metadata Profile Coverage
- mixed_or_uncertain: 43
- safe_low_risk: 118
- safe_medium_risk: 2
- unsafe_high_risk: 1

### Category Coverage
- cleanser: 26
- essence: 24
- moisturizer: 61
- sunscreen: 11
- toner_pad: 24
- treatment: 18

### Functional Profile Coverage
- mixed: 86
- stabilizing_leaning: 78

## Context Decision Results
### baseline_no_instability__acne_redness
- total evaluations: 1640
- hard_block_candidate: 0
- collapsed_exposure_candidate: 0
- insufficient_data: 0
- no_guard: 1640

### baseline_no_instability__dehydration_redness
- total evaluations: 1640
- hard_block_candidate: 0
- collapsed_exposure_candidate: 0
- insufficient_data: 0
- no_guard: 1640

### baseline_no_instability__redness_redness
- total evaluations: 1640
- hard_block_candidate: 0
- collapsed_exposure_candidate: 0
- insufficient_data: 0
- no_guard: 1640

### both_high_sensitivity_and_recent_instability__acne_redness
- total evaluations: 1640
- hard_block_candidate: 440
- collapsed_exposure_candidate: 1200
- insufficient_data: 0
- no_guard: 0

### both_high_sensitivity_and_recent_instability__dehydration_redness
- total evaluations: 1640
- hard_block_candidate: 440
- collapsed_exposure_candidate: 1200
- insufficient_data: 0
- no_guard: 0

### both_high_sensitivity_and_recent_instability__redness_redness
- total evaluations: 1640
- hard_block_candidate: 440
- collapsed_exposure_candidate: 1200
- insufficient_data: 0
- no_guard: 0

### high_sensitivity_only__acne_redness
- total evaluations: 1640
- hard_block_candidate: 440
- collapsed_exposure_candidate: 0
- insufficient_data: 0
- no_guard: 0

### high_sensitivity_only__dehydration_redness
- total evaluations: 1640
- hard_block_candidate: 440
- collapsed_exposure_candidate: 0
- insufficient_data: 0
- no_guard: 0

### high_sensitivity_only__redness_redness
- total evaluations: 1640
- hard_block_candidate: 440
- collapsed_exposure_candidate: 0
- insufficient_data: 0
- no_guard: 0

### recent_instability_only__acne_redness
- total evaluations: 1640
- hard_block_candidate: 10
- collapsed_exposure_candidate: 1200
- insufficient_data: 0
- no_guard: 0

### recent_instability_only__dehydration_redness
- total evaluations: 1640
- hard_block_candidate: 10
- collapsed_exposure_candidate: 1200
- insufficient_data: 0
- no_guard: 0

### recent_instability_only__redness_redness
- total evaluations: 1640
- hard_block_candidate: 10
- collapsed_exposure_candidate: 1200
- insufficient_data: 0
- no_guard: 0

## Policy Behavior Judgment
- status: policy_behavior_consistent
- unsafeHighRiskHardBlockRate: 1
- safeLowRiskCollapsedExposureRate: 1
- safeLowRiskHardBlockRate: 0
- safeMediumRiskCollapsedExposureRate: 1
- metadataIncompleteInsufficientDataRate: 0
- baselineNoGuardRate: 1
- highSensitivityOnlySafeLowHardBlockRate: 0

## Potential Overblocking Observation
- safe_low_risk hard block rate in recent contexts: 0
- high-sensitivity-only safe_low_risk hard block rate: 0

## Metadata Coverage Limitation
- metadata incomplete products: 0
- metadata incomplete insufficient-data rate: 0

## Insufficient Matrix Coverage
- Synthetic safety contexts are policy validation inputs, not observed user outcomes.
- Actual high-confidence capture observations and synthetic matrix results must not be merged as equivalent evidence.
- Complete candidate sources can repeat the same product rows across captures.
- The fixture pool comes from development captures and may not represent production distribution.
- A policy-consistent matrix does not approve runtime application.

## Runtime Non-Application Principle
- This matrix validates policy-helper branching only.
- It does not change hard filters, evaluator score, existing recommendations, API responses, or UI.
- CandidatePolicy or evaluator connection requires a separate approved task.

## Conditions Before CandidatePolicy/Evaluator Wiring
- Additional high-confidence captures should cover missing category and metadata cells.
- The team must choose soft penalty or collapsed exposure explicitly.
- Runtime response/storage boundary checks must be specified before implementation.

## Next Step
- Use this matrix as evidence for a separate collapsed-exposure design task only; do not apply runtime changes from this phase.