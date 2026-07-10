# Evaluator Boundary Coverage Gap Validation

This is a synthetic fixture validation for the Phase 16 evaluator recent-instability boundary policy. It does not change runtime evaluator logic, hard filters, score, CandidatePolicy, UI, API response, DB, Supabase, product data, capture fixtures, or existing recommendations.

## Phase 16 Coverage Gaps

Phase 16 actual complete-capture evidence was useful for safe-low-risk mixed profiles, but it did not cover these areas well enough for future integration review:

- active-leaning only profile
- metadata incomplete profile or product safety fields
- serum category
- strong caution metadata

## Purpose

The goal of this validation is to check whether `resolveEvaluatorRecentInstabilityBoundaryPolicy()` behaves consistently in the missing matrix cells before any runtime integration is considered.

This is not real user behavior evidence. Synthetic fixture validation is not a substitute for actual high-confidence complete candidate-source captures.

## Actual Capture Evidence vs Synthetic Coverage

Actual capture evidence:

- comes from dev `/api/analyze` shadow captures
- preserves the existing candidate source and evaluator output
- is suitable for observing real divergence patterns in the current test flow

Synthetic coverage validation:

- constructs controlled product/profile fixtures
- targets gaps not present in current captures
- validates decision boundaries and invariants
- does not prove real product/category distribution or recommendation quality

The two evidence types must not be combined as if they have the same strength.

## Active-Leaning Only Result

Synthetic case:

- recent instability: yes
- high sensitivity: yes
- evaluator hard filter reason: `recent_instability_active_limited`
- product metadata: `irritation_risk: low`, `sensitivity_safe: true`
- profile: evaluable, active functional axis only

Result:

- `downgrade_to_collapsed_candidate`
- not `preserve_hard_block`

Interpretation:

- active axis alone does not preserve hard block for low-risk, sensitivity-safe products
- category and active-axis generalization are not enough to keep a hard block
- this remains a future collapsed-exposure candidate, not a runtime change

Unsafe active-leaning control:

- `irritation_risk: high`
- `sensitivity_safe: false`
- active axis only

Result:

- `preserve_hard_block`
- high-risk candidates are not downgraded to collapsed

## Metadata-Incomplete Result

Synthetic missing metadata cases:

- missing `irritation_risk`
- missing `sensitivity_safe`
- `productProfile.evaluable === false`
- missing functional axes

Result:

- `requires_metadata_review`

Interpretation:

- missing evidence is not treated as product risk
- missing evidence is not treated as safe enough for collapsed exposure
- metadata gaps are separated for review

## Serum Category Result

Safe serum case:

- category: `serum`
- `irritation_risk: low`
- `sensitivity_safe: true`
- profile evaluable
- mixed or active functional axes

Result:

- `downgrade_to_collapsed_candidate`

Interpretation:

- serum category alone does not preserve hard block
- safe metadata can still route to future collapsed exposure

Strong-caution serum case:

- category: `serum`
- strong caution tag present
- high irritation or non-sensitive-safe metadata

Result:

- `preserve_hard_block`

Interpretation:

- product-level risk metadata takes priority over category

## Strong Caution Metadata Result

Synthetic case:

- strong product caution tag present
- otherwise low-risk metadata
- category not used as the deciding factor

Result:

- `preserve_hard_block`

Interpretation:

- strong product-level caution is a valid hard-block preservation reason
- strong caution has priority over collapsed exposure

## CautionTags Empty Result

Synthetic case:

- `cautionTags: []`
- `irritation_risk: low`
- `sensitivity_safe: true`
- profile evaluable
- active axis present

Result:

- `downgrade_to_collapsed_candidate`
- confidence may be lower

Interpretation:

- empty caution tags are not evidence of safety
- empty caution tags are not evidence of risk
- empty caution tags alone do not trigger hard block or metadata review

## Runtime Non-Application

No runtime path imports or calls the coverage verifier.

The validation does not modify:

- `/api/analyze`
- `lib/functional-ranking-contract.js`
- existing evaluator hard filters
- score or weight logic
- `lib/functional-candidate-policy.js`
- UI
- API response
- DB or Supabase
- topPick/supporting/budget results
- capture fixture sources
- product data

## Remaining Limits

- Synthetic fixtures do not represent real user or product distribution.
- Actual high-confidence captures still need active-leaning-only examples.
- Actual high-confidence captures still need metadata-incomplete examples.
- Actual high-confidence captures still need serum examples.
- Actual high-confidence captures still need strong-caution metadata examples.
- CandidatePolicy and evaluator integration remain separate approved tasks.

## CandidatePolicy / Evaluator Integration Conditions

Before connecting this boundary to runtime, the project should have:

- actual complete-capture evidence covering the synthetic matrix cells
- confirmation that high-risk and strong-caution products remain hard-blocked
- a defined collapsed exposure UX/CandidatePolicy contract
- separate approval for evaluator behavior change
- regression verification that API response and existing recommendation payloads remain unchanged
