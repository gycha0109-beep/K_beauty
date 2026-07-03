# Functional Ranking Contract

Date: 2026-07-03
Branch: `codex/survey-input-contract-refactor`
Phase: Ranking Engine Phase 1

This document defines the pure ranking contract used before any product fetch, sorting, UI wiring, or top-pick replacement. Phase 1 evaluates one product snapshot at a time and returns an explainable score contract.

## 1. Ranking Engine Responsibility

Phase 1 is responsible for evaluating whether a single product can be treated as a functional recommendation candidate for the current survey contract.

It does:

- combine `SurveyInputContract`, goal policy, product functional profile, and current-product findings
- distinguish hard filters from soft score penalties
- return `scoreBreakdown`, `reasons`, `penalties`, `confidence`, and `rankingContext`
- keep `rankingGoal` based on the user's explicit `primaryConcern`
- keep `safetyGoal` and `recommendationGuard` based on skin-state and safety constraints

It does not:

- fetch products
- query Supabase
- sort candidate arrays
- replace existing `topPick`, `supportingProducts`, or `budgetAlternatives`
- connect to UI
- infer product functionality from product or brand names
- expose raw ingredient counts as user-facing scores

## 2. Input Contract

Pure function:

```js
evaluateFunctionalRankingCandidate({
  product,
  surveyContract,
  goalPolicy,
  productProfile,
  currentProductFindings
})
```

Inputs:

- `product`: product row or product snapshot with structured fields such as `id`, `category`, `product_form`, `skin_types`, `concerns`, `texture`, `finish`, `irritation_risk`, `sensitivity_safe`, `ingredient_signals`, `review_signals`, `market_signals`, and sunscreen metadata.
- `surveyContract`: output from `buildSurveyInputContract()`.
- `goalPolicy`: output from `resolveFunctionalGoalPolicy()`, especially `rankingGoal`, `safetyGoal`, `recommendationGuard`, and `hasTension`.
- `productProfile`: output from `resolveProductFunctionalProfile(product)`. If omitted, Phase 1 may resolve it from the provided product snapshot only.
- `currentProductFindings`: output from `buildCurrentProductFindings()`, used only for conservative duplicate/current-routine context.

## 3. Output Contract

```js
{
  productId,
  eligible,
  hardFilterStatus,
  hardFilterReasons,
  totalScore,
  scoreBreakdown,
  reasons,
  penalties,
  confidence,
  rankingContext
}
```

Output meanings:

- `productId`: normalized product id, or `null`.
- `eligible`: `true` only when `hardFilterStatus === "pass"`.
- `hardFilterStatus`: `"pass"`, `"blocked"`, or `"insufficient_data"`.
- `hardFilterReasons`: structured but user-safe reasons for pass/block/insufficient state.
- `totalScore`: `0-100` only for pass. `blocked` and `insufficient_data` return `null` so `0` is not mistaken for product quality.
- `scoreBreakdown`: explainable score buckets.
- `reasons`: positive user-safe reasons derived from scored buckets.
- `penalties`: user-safe caution/penalty reasons derived from penalties.
- `confidence`: `"high"`, `"medium"`, or `"low"` based on data completeness, not product efficacy.
- `rankingContext`: compact policy context for downstream ranking/copy.

## 4. Hard Filter vs Soft Score

Hard filters are only for cases that should not enter normal candidate ranking:

- missing product snapshot, id, or category
- product profile and product fields too sparse to evaluate
- high sensitivity with high irritation risk
- stabilize-first guard with a new active-direction product that lacks stabilizing support
- recent instability plus high dryness/redness/sensitivity with active acne, pore, or tone-care direction
- answered sunscreen preferences that directly conflict with high eye sting, high white cast, or high pilling risk

Soft scores and penalties handle preference, fit, duplicate routine context, moderate risk, and incomplete evidence. Missing data is not treated as false or unsafe by itself.

## 5. ScoreBreakdown

The Phase 1 weights sum to exactly 100. The initial 35/20/20/10/10/5/5 proposal summed to 105, so `functionalFit` is set to 30 while keeping review signal available.

```js
{
  functionalFit: { score: 0, max: 30, reasons: [] },
  skinFit: { score: 0, max: 20, reasons: [] },
  safetyFit: { score: 0, max: 20, reasons: [] },
  preferenceFit: { score: 0, max: 10, reasons: [] },
  routineFit: { score: 0, max: 10, reasons: [] },
  evidenceQuality: { score: 0, max: 5, reasons: [] },
  reviewSignal: { score: 0, max: 5, reasons: [] },
  penalties: { score: 0, reasons: [] },
  totalBeforePenalty: 0,
  totalAfterPenalty: 0
}
```

Scoring principles:

- `functionalFit`: uses `rankingGoal` and `productProfile.functionalAxes`. Product `concerns` are secondary evidence only. Rinse-off products are capped for active functional fit.
- `skinFit`: uses skin type, post-wash feel, afternoon change, skin type metadata, texture, finish, and hydration/oil comfort signals.
- `safetyFit`: starts conservative and adjusts for irritation risk, `sensitivity_safe`, recent changes, and profile caution tags.
- `preferenceFit`: uses texture, disliked feel, and answered sunscreen preferences. Preference cannot override safety.
- `routineFit`: uses current-product findings only to avoid over-boosting duplicate or already-owned products. It does not make replacement decisions.
- `evidenceQuality`: measures how complete the structured basis is. It is not product quality.
- `reviewSignal`: uses only structured `market_signals` when present. It is a small confidence/user-experience signal, not proof of efficacy.

## 6. Confidence

`confidence` describes whether the ranking explanation has enough structured data:

- `high`: evaluable profile plus multiple evidence/safety/category fields.
- `medium`: enough structured data for a cautious recommendation.
- `low`: sparse product/profile data or insufficient evaluation basis.

Confidence is not an efficacy score and must not be presented as "this product works better."

## 7. Blocked And Insufficient Data

Policy:

- `blocked`: `eligible: false`, `totalScore: null`, `confidence` still computed from available data.
- `insufficient_data`: `eligible: false`, `totalScore: null`, `confidence: "low"`.
- `pass`: `eligible: true`, `totalScore` is `0-100`, with `scoreBreakdown` and reason arrays.

Returning `null` for non-pass avoids the false interpretation that a blocked or unknown product is a "0-point bad product."

## 8. primaryConcern / priority / safety Separation

Ranking continues the Phase 0 policy:

- `rankingGoal` comes from explicit `primaryConcern` first.
- `safetyGoal` comes from `priority.axis` first.
- `recommendationGuard` comes from safety/skin-state constraints.
- `primaryConcern !== priority.axis` is `tension`, not a conflict.
- Tension preserves `rankingGoal` while allowing `safetyGoal` to affect hard filters, penalties, candidate visibility, and copy caution.

## 9. CurrentProductFinding Connection

Current-product findings are only conservative routine context in Phase 1:

- same product already selected: lower routine fit
- duplicate axis or existing support: lower new-product priority
- empty slot: small add-step fit bonus
- not-in-db or unanswered: neutral or confidence down, not negative inference

Phase 1 does not decide replacement, removal, or routine migration.

## 10. Not In This Phase

This phase intentionally avoids:

- UI changes
- API response changes
- DB/schema/migration changes
- Supabase queries
- product data edits
- existing recommendation engine replacement
- existing top pick or supporting product replacement
- Functional Plan UI wiring
- currentProducts or premium save structure changes
- photo analysis changes

## 11. Phase 2

Phase 2 can build on this contract to:

- evaluate actual candidate arrays
- sort candidates
- split top pick, alternatives, and budget candidates
- connect `CandidatePolicy` visibility rules
- connect to Functional Plan decision surfaces
- run runtime audits comparing Phase 1 scores against existing free-result products
- eventually wire UI only after response/storage contracts are separately approved
