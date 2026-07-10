# Functional Candidate Audit

Date: 2026-07-03
Branch: `codex/survey-input-contract-refactor`
Phase: Ranking Engine Phase 2

This document defines the candidate-set audit layer that applies the Phase 1 single-candidate evaluator to a local product array. It is audit-only and does not replace any existing recommendation result.

## 1. Responsibility

`buildFunctionalCandidateAudit()` evaluates a provided product array and separates each item into:

- `rankedCandidates`
- `blockedCandidates`
- `insufficientDataCandidates`
- `summary`

It does not fetch products, query Supabase, call the existing recommendation engine, create UI cards, or update `topPick`, `supportingProducts`, `budgetAlternatives`, saved reports, premium reports, or API responses.

## 2. Input Contract

```js
buildFunctionalCandidateAudit({
  products,
  surveyContract,
  goalPolicy,
  currentProductFindings,
  options
})
```

Inputs:

- `products`: product rows or snapshots to audit. Empty arrays are allowed.
- `surveyContract`: output from `buildSurveyInputContract()`.
- `goalPolicy`: output from `resolveFunctionalGoalPolicy()`.
- `currentProductFindings`: optional current routine findings; absence is neutral.
- `options`: audit output controls only.

Options:

```js
{
  maxRankedCandidates: 20,
  includeBlocked: false,
  includeInsufficientData: true,
  categoryAllowlist: null,
  categoryDenylist: null,
  debug: false
}
```

Options cannot bypass hard filters or change recommendation policy.

## 3. Output Contract

```js
{
  rankedCandidates: [
    {
      product,
      evaluation,
      rank,
      sortKey
    }
  ],
  blockedCandidates: [
    {
      productId,
      category,
      hardFilterReasons,
      rankingContext,
      confidence
    }
  ],
  insufficientDataCandidates: [
    {
      productId,
      category,
      hardFilterReasons,
      rankingContext,
      confidence
    }
  ],
  summary
}
```

The ranked `product` is a minimal audit identity, not a UI-ready product card. It keeps id/category/form only.

## 4. Evaluator Separation

Array audit does not duplicate scoring policy. For each valid, in-scope product it:

1. checks product validity
2. resolves `resolveProductFunctionalProfile(product)`
3. calls `evaluateFunctionalRankingCandidate()`
4. separates the result by `hardFilterStatus`

If `productProfile.evaluable` is false, the array audit does not label the product as unsuitable by itself. It respects the single-candidate evaluator result.

## 5. Sorting Rules

Only candidates with all of the following are ranked:

- `evaluation.eligible === true`
- `hardFilterStatus === "pass"`
- numeric `totalScore`

Sort priority:

1. `totalScore` descending
2. `confidence`: `high > medium > low`
3. `functionalFit.score` descending
4. `safetyFit.score` descending
5. `evidenceQuality.score` descending
6. `reviewSignal.score` descending as a small tie-break
7. `productId` ascending for deterministic fallback

`rank` starts at 1. `maxRankedCandidates` limits the returned list only; `summary.rankedCount`, `returnedRankedCount`, and `truncatedRankedCount` preserve the full count.

## 6. blocked / insufficient_data / skipped

- `blocked`: hard filter failed. It is excluded from ranked candidates and counted in `hardFilterReasonDistribution`.
- `insufficient_data`: structured evidence is not enough. It is not ranked and does not mean the product is bad.
- `skipped`: malformed input or category-filter exclusion before evaluation. It is counted in `skippedCount` and `skippedReasonDistribution`, not in blocked counts.

## 7. Summary Distributions

`summary` includes:

- input/evaluated/ranked/blocked/insufficient/skipped counts
- score distribution with an `unscored` bucket
- confidence distribution
- category distribution split by ranked, blocked, insufficient data, and skipped
- stable hard-filter reason distribution
- compact ranking context: `rankingGoal`, `safetyGoal`, `recommendationGuard`, `hasTension`
- policy notes that the result is audit-only

## 8. Category Policy

Category filtering controls audit scope only:

- `categoryDenylist` wins over `categoryAllowlist`
- allowlist excludes categories not listed
- excluded products are skipped, not blocked
- missing category is left to evaluator and usually becomes `insufficient_data`
- no category winner, top pick, or category-specific recommendation is generated

## 9. Relationship To Existing Recommendation Engine

The audit layer does not call or replace `recommendation-scoring.ts`, `skin-match-decision-engine.js`, product fetching, or result payload assembly. It can be used later for shadow-mode comparison against existing free-result recommendations.

## 10. Next Phase

Phase 3 candidates:

- adapter from existing candidate source into audit input
- shadow-mode comparison with current `topPick`, `supportingProducts`, and `budgetAlternatives`
- delta report between existing ranking and functional audit ranking
- CandidatePolicy visibility integration
- UI connection only after API/payload boundaries are separately approved
