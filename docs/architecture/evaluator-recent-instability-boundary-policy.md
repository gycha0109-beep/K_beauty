# Evaluator Recent-Instability Boundary Policy

Date: 2026-07-09
Branch: `codex/survey-input-contract-refactor`
Status: Shadow policy only. No runtime integration.

## Problem Definition

The current functional evaluator can hard-block candidates with `recent_instability_active_limited` when recent skin instability, high sensitivity, and active functional direction align. Phase 15 showed a repeated target slice where the evaluator hard-blocked safe-low-risk products:

- high-confidence complete fixture count: 10
- candidate review rows: 1,640
- safe-low-risk hidden rows: 50
- evaluator blocked: 50 / 50
- hard filter reason: `recent_instability_active_limited` in 50 / 50
- product-level safety metadata: `irritation_risk: low`, `sensitivity_safe: true`, `profileEvaluable: true`
- profile shape: mixed active and stabilizing axes in 50 / 50
- guard hard-block overlap: 0

The policy question is whether all such candidates must remain evaluator hard blocks, or whether some should later pass evaluator hard filtering with a collapsed-exposure hint for CandidatePolicy.

This document defines a pure boundary policy and shadow audit only. It does not change `evaluateFunctionalRankingCandidate()`, hard filters, scores, CandidatePolicy runtime behavior, UI, API response, DB, Supabase, product data, or existing recommendations.

## Evaluator vs Guard Policy Responsibility

Evaluator responsibility:

- decide whether a candidate can enter normal functional ranking
- distinguish hard filter, insufficient data, and pass
- preserve conservative safety blocks where product-level risk metadata supports the block

Guard / exposure policy responsibility:

- describe how cautious the product should be under current skin conditions
- translate caution into future exposure states such as contextual or collapsed
- avoid treating hidden, collapsed, or insufficient evidence as product-quality judgments

This boundary policy sits between the two. It asks whether a specific evaluator hard block should remain a hard block in a future implementation, or whether it is a candidate for future evaluator pass plus collapsed exposure.

## Helper Contract

`resolveEvaluatorRecentInstabilityBoundaryPolicy({ candidateEvaluation, surveySafety, goalPolicy, product, productProfile })`

Input roles:

- `candidateEvaluation`: evaluator output, especially `hardFilterStatus` and `hardFilterReasons`
- `surveySafety`: sensitivity and recent-instability safety context
- `goalPolicy`: ranking goal, safety goal, recommendation guard, and optional safety context flags
- `product`: structured safety metadata such as `irritation_risk`, `sensitivity_safe`, and category
- `productProfile`: functional axes, caution tags, category role, and evaluability

Output:

```js
{
  applies,
  boundaryDecision,
  confidence,
  reasons,
  policyContext,
  futureIntegrationHint
}
```

`boundaryDecision`:

- `preserve_hard_block`
- `downgrade_to_collapsed_candidate`
- `requires_metadata_review`
- `not_applicable`

`futureIntegrationHint`:

- `keep_evaluator_hard_block`
- `future_evaluator_pass_with_collapsed_hint`
- `needs_product_metadata_review`
- `no_evaluator_change`

## Preserve Hard Block Boundary

Preserve hard block when product-level evidence supports the evaluator block:

- `irritation_risk === "high"`
- `sensitivity_safe === false`
- a strong product-level caution signal is present
- high sensitivity plus recent instability plus product safety metadata is clearly unfavorable
- the hard filter is explained by an independent product-level risk reason, not only active-axis presence

The future integration hint is `keep_evaluator_hard_block`.

## Downgrade To Collapsed Candidate Boundary

Treat a candidate as future collapsed-exposure eligible only when all of these are true:

- evaluator hard-blocked it with `recent_instability_active_limited`
- recent instability and high sensitivity context are present
- `irritation_risk` is `low` or `medium`
- `sensitivity_safe === true`
- product profile is evaluable
- functional axes are present
- no explicit strong high-risk caution signal is present

Active axis presence alone is not enough to preserve hard block. A mixed active plus stabilizing profile may still be a collapsed-exposure candidate when product-level safety metadata is favorable.

The future integration hint is `future_evaluator_pass_with_collapsed_hint`.

## Metadata Review Boundary

Use `requires_metadata_review` when the evaluator boundary cannot be reviewed safely because core metadata is missing:

- `irritation_risk` missing
- `sensitivity_safe` missing
- `productProfile.evaluable === false`
- functional axes missing

Information gaps must not be converted into either product unsuitability or automatic safety.

The future integration hint is `needs_product_metadata_review`.

## Not Applicable Boundary

Use `not_applicable` when:

- the evaluator did not hard-block with `recent_instability_active_limited`
- recent-instability or high-sensitivity context is absent
- another independent hard-filter reason is the primary cause

The future integration hint is `no_evaluator_change`.

## CautionTags Empty Principle

An empty `cautionTags` array is not evidence of safety and not evidence of risk.

It may lower confidence, but it must not automatically cause:

- `preserve_hard_block`
- `requires_metadata_review`
- `downgrade_to_collapsed_candidate`

The boundary decision still depends on explicit safety metadata, functional axes, and evaluator hard-filter reasons.

## Category And Active Axis Principle

Category alone must not decide the boundary.

Active axis alone must not decide the boundary.

The boundary can consider active axes only together with product-level safety metadata, profile evaluability, strong caution tags, and recent-instability/high-sensitivity context.

## Shadow-Only Principle

This policy is not wired into:

- `/api/analyze`
- `evaluateFunctionalRankingCandidate()`
- existing hard filters
- existing score or weight logic
- `functional-candidate-policy.js`
- UI
- API response
- DB/Supabase
- existing recommendation results

The shadow runner only computes a virtual reclassification of existing audit rows.

## Runtime Integration Conditions

Before any runtime integration, the project needs:

- high-confidence samples with active-leaning-only profiles
- metadata-incomplete comparison samples
- serum category coverage
- explicit high-risk and strong-caution metadata comparison samples
- a separate approved evaluator/CandidatePolicy integration task
- verification that high-risk or unsafe candidates remain hard-blocked
- UI/CandidatePolicy design for collapsed exposure, if used

## Current Limitation

The current target evidence is strong for safe-low-risk mixed profiles but weak for:

- active-leaning only
- metadata incomplete
- serum category
- candidates with explicit strong caution metadata

Therefore the current output is a policy boundary and shadow evidence artifact, not approval to change runtime evaluator behavior.
