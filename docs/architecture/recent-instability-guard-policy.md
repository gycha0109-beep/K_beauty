# Recent Instability Guard Policy

## Problem Definition

The current Phase 1 functional ranking evaluator has a broad safety rule:

- recent skin instability
- redness-oriented safety context
- `stabilize_first`
- active-direction candidate

When those signals align, the evaluator can treat a candidate as too aggressive for current ranking. Phase 8 manual safety review showed that this rule may be appropriate for clearly risky product metadata, but may be overly broad for products with favorable product-level safety metadata.

This document defines a policy-review helper and decision vocabulary only. It does not change runtime hard filters, ranking scores, API responses, UI, DB data, existing recommendations, or product data.

## Phase 8 Evidence Summary

Reviewed high-confidence safety cases:

- `high_sensitivity + treatment`: `irritationRisk: high`, `sensitivitySafe: false`, provisional outcome `guard_appears_appropriate`.
- `recent_instability + toner_pad`: `irritationRisk: low`, `sensitivitySafe: true`, provisional outcome `possible_overblocking`.
- `recent_instability + treatment`: favorable product-level safety metadata, provisional outcome `possible_overblocking`.

Interpretation:

- High sensitivity plus high irritation or explicit non-sensitive-safe metadata remains a hard-block candidate.
- Recent instability alone should not automatically make low-risk, sensitivity-safe products hard-block candidates.
- This is a policy hypothesis for future implementation review, not a runtime change.

## Policy Scope

`resolveRecentInstabilityGuardPolicy({ surveySafety, goalPolicy, product, productProfile })` classifies a candidate into policy-review states:

- It is pure and deterministic.
- It does not fetch products or query Supabase.
- It does not call the existing evaluator.
- It does not change recommendation output.
- Its decisions are future implementation candidates only.

## Input Contract

`surveySafety`:

- `sensitivityRisk`
- `drynessRisk`
- `rednessRisk`
- `recentSkinChange`
- `recentlyChangedProduct`

`goalPolicy`:

- `rankingGoal`
- `safetyGoal`
- `recommendationGuard`

`product`:

- `irritation_risk`
- `sensitivity_safe`
- `category`
- `product_form`

`productProfile`:

- `functionalAxes`
- `cautionTags`
- `categoryRole`
- `evaluable`

## Output Contract

```js
{
  applies,
  guardLevel,
  decision,
  reasons,
  policyContext,
  implementationHint
}
```

`decision` values:

- `no_guard`
- `allow_with_context`
- `soft_penalty_candidate`
- `collapsed_exposure_candidate`
- `hard_block_candidate`
- `insufficient_data`

`implementationHint` values:

- `keep_hard_block`
- `future_soft_penalty`
- `future_collapsed_exposure`
- `collect_more_evidence`
- `needs_metadata_review`

## Hard Block 유지 후보

Keep hard block as a future implementation candidate when product-level metadata clearly conflicts with the safety context:

- `sensitivityRisk === "high"` plus `irritation_risk === "high"`
- `sensitivityRisk === "high"` plus `sensitivity_safe === false`
- recent instability plus `irritation_risk === "high"`
- recent instability plus high sensitivity plus active functional axis plus clearly unfavorable product safety metadata

Policy output:

- `decision: "hard_block_candidate"`
- `guardLevel: "high"`
- `implementationHint: "keep_hard_block"`

## Broad Block 완화 검토 후보

Do not treat the candidate as an automatic hard block when:

- recent instability is present
- `sensitivity_safe === true`
- `irritation_risk` is `low` or `medium`
- functional and safety metadata are available
- the case is not high sensitivity plus high irritation or explicit non-sensitive-safe metadata

Current conservative policy output:

- `decision: "collapsed_exposure_candidate"`
- `guardLevel: "low"` for low irritation, `"medium"` for medium irritation
- `implementationHint: "future_collapsed_exposure"`

This does not mean the candidate should be shown normally. It means the product should be considered for a future soft/collapsed treatment instead of a blanket hard block.

## Metadata 부족 처리

If core product/profile data is missing, classify the case as evidence-limited:

- missing `irritation_risk`
- missing `sensitivity_safe`
- missing `functionalAxes`
- missing `cautionTags` field
- `productProfile.evaluable === false`

Policy output:

- `decision: "insufficient_data"`
- `implementationHint: "needs_metadata_review"`

Information gaps are not treated as product unsuitability.

## Active Axis 해석 원칙

More caution:

- `exfoliation`
- `acne_care`
- `tone_care`
- `wrinkle_care`

More stabilization-friendly:

- `hydration`
- `moisture_lock`
- `barrier_support`
- `soothing`

This classification is not an absolute risk judgment. Product-level `irritation_risk` and `sensitivity_safe` must remain stronger evidence than category or axis generalization. Category alone must not create a new hard block.

## Soft Penalty vs Collapsed Exposure

### Soft Penalty

Meaning:

- Keep the product in the candidate set.
- Reduce score.
- Allow ranking, but lower priority.

Pros:

- Avoids hiding low-risk, sensitivity-safe products.
- Preserves user goal and choice.
- Reduces excessive exclusion while evidence is still developing.

Risks:

- A product may remain too prominent for an unstable skin state.
- Requires strong safety copy and warning design.

### Collapsed Exposure

Meaning:

- Keep the product eligible for comparison.
- Move it into a lower-priority or “consider after stabilizing” group.
- Avoid calling it unsuitable.

Pros:

- Preserves safety-first behavior.
- Avoids product-quality judgments.
- Allows explanation of current skin state and product context.

Risks:

- Requires CandidatePolicy/UI design.
- Larger runtime surface than a score-only adjustment.

Current policy-helper default is `collapsed_exposure_candidate` for favorable safety metadata under recent instability because it is the more conservative future path. This is not applied at runtime.

## Policy Review Questions

1. Is it appropriate to hard block low-risk, sensitivity-safe products based only on recent instability?
2. Should high sensitivity and recent instability have equal safety strength?
3. Should hard block require high irritation or explicit non-sensitive-safe metadata?
4. For low irritation and sensitivity-safe products, should the future treatment be soft penalty or collapsed exposure?
5. Should toner pads and treatments be treated at the same strength?
6. If an active axis is present but hydration/barrier support is stronger, should the product be handled separately?
7. Should metadata-incomplete products go to `insufficient_data` instead of hard block?
8. What sample coverage is required before runtime application?

## Runtime 미적용 원칙

The helper is not imported by `/api/analyze`, `functional-ranking-contract.js`, or UI/CandidatePolicy runtime. It exists for policy review and verifier coverage only.

Future runtime application requires a separate approved task that defines:

- exact evaluator connection point
- CandidatePolicy handling for collapsed exposure
- score/penalty behavior if soft penalty is chosen
- response and storage boundary checks
- additional high-confidence shadow evidence

## Additional Sample Matrix

Safety context:

- recent instability only
- high sensitivity only
- both
- neither

Product safety metadata:

- low irritation plus sensitivity safe true
- medium irritation plus sensitivity safe true
- high irritation plus sensitivity safe false
- incomplete metadata

Category:

- treatment
- toner_pad
- serum
- essence
- moisturizer
- sunscreen

Functional axis:

- exfoliation
- acne_care
- tone_care
- hydration
- barrier_support
- soothing

Current evidence is only 3 treatment/toner-pad-centered cases. It is sufficient to define a targeted policy review question, not sufficient to change runtime behavior.

## Next Step Conditions

Proceed to implementation design only after:

- additional high-confidence captures cover the sample matrix
- manual review confirms repeated possible overblocking or guard appropriateness
- the team chooses soft penalty or collapsed exposure explicitly
- CandidatePolicy/runtime connection is approved as a separate task
