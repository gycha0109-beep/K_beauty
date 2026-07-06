# Functional Candidate Exposure Audit

## Purpose

This audit applies the pure ranking, guard, and exposure contracts to a candidate array and separates products into exposure groups:

- primary
- contextual
- collapsed
- hidden
- insufficient evidence

It is shadow-only. It does not change the existing recommendation engine, CandidatePolicy runtime, UI, API response, ranking score, hard filter, or product data.

## Responsibility Chain

Evaluator:

- scores or blocks a candidate using `evaluateFunctionalRankingCandidate()`

Candidate audit:

- applies evaluator to a product array with `buildFunctionalCandidateAudit()`

Recent-instability guard policy:

- classifies safety caution with `resolveRecentInstabilityGuardPolicy()`

Guard exposure policy:

- maps guard states to exposure states with `resolveFunctionalGuardExposurePolicy()`

Future CandidatePolicy:

- may later interpret exposure groups for actual candidate display

This phase stops before CandidatePolicy runtime integration.

## Input Contract

`buildFunctionalCandidateExposureAudit({ products, surveyContract, goalPolicy, currentProductFindings, options })`

Inputs:

- `products`: product snapshots already available to the audit caller
- `surveyContract`: SurveyInputContract-like structure
- `goalPolicy`: resolved functional goal policy
- `currentProductFindings`: optional current routine findings
- `options`: audit-only options

No DB query, Supabase call, UI transformation, or recommendation replacement occurs.

## Output Contract

```js
{
  primaryCandidates,
  contextualCandidates,
  collapsedCandidates,
  hiddenCandidates,
  insufficientEvidenceCandidates,
  candidateReviewRows,
  summary
}
```

Each candidate item contains:

- `productId`
- `category`
- `rank`
- `evaluation`
- `recentInstabilityGuardPolicy`
- `exposurePolicy`

`candidateReviewRows` is the sanitized candidate-level evidence artifact used by readiness review. Each row contains only audit-safe fields:

- `productId`
- `category`
- `exposureStatus`
- `visibilityPriority`
- `userMessageType`
- `evaluationStatus`
- `hardFilterStatus`
- `hardFilterReasons`
- `guardDecision`
- `guardLevel`
- `guardReasons`
- `implementationHint`
- `confidence`
- `safetyMetadataProfile`
- `functionalProfile`
- `rankingGoal`
- `safetyGoal`
- `recommendationGuard`
- `currentProductRelation`

Rows are sorted deterministically by exposure status, category, and product id. Product name, brand, purchase URL, raw review text, raw form, image data, and PII are not included.

## Exposure Groups

Primary:

- `exposureStatus === "primary_candidate"`
- `includeInPrimaryCandidates === true`
- keeps functional candidate rank order

Contextual:

- `exposureStatus === "contextual_candidate"`
- candidate remains primary-eligible with caution context

Collapsed:

- `exposureStatus === "collapsed_candidate"`
- not a top/primary candidate
- future “stabilize first, consider later” group
- not a product-unsuitable judgment

Hidden:

- `exposureStatus === "hidden_candidate"`
- evaluator block or hard guard candidate takes priority
- not a product-quality judgment

Insufficient evidence:

- `exposureStatus === "insufficient_evidence_candidate"`
- separated from hidden
- data/evidence limitation only

## Conflict Priority

1. evaluator hard block
2. recent-instability hard block candidate
3. insufficient data
4. collapsed exposure candidate
5. contextual candidate
6. primary candidate

Hard block wins over collapsed. Insufficient data is not hidden. Current routine context cannot reverse safety grouping.

## Current Product Finding Role

Current product findings are context only:

- `duplicate_axis`: does not hide collapsed candidates and does not promote them to primary
- `supports_goal`: can add compare-later context but does not change exposure group
- `not_in_db` / `unanswered`: neutral, no negative inference
- `not_using`: future add-missing-step context only

## Complete Capture Replay Scope

`scripts/run-functional-candidate-exposure-audit.mjs` reads only complete `product_row` shadow captures from `tmp/functional-shadow-captures`.

It excludes final-results-only fixtures and writes ignored local outputs:

- `tmp/functional-shadow-captures/candidate-exposure-audit.json`
- `tmp/functional-shadow-captures/candidate-exposure-audit.md`

The JSON artifact includes fixture-level `candidateReviewRows` and aggregate reason distributions:

- `candidateReviewRowCount`
- `hiddenReasonDistribution`
- `collapsedReasonDistribution`
- `hiddenBySafetyMetadataProfile`
- `collapsedBySafetyMetadataProfile`

These fields let `review-functional-exposure-readiness.mjs` separate evaluator hard blocks from guard hard-block candidates and explain `safe_low_risk` hidden cases without reading raw product rows.

## Group Distribution Interpretation

Collapsed count answers whether future CandidatePolicy grouping has enough volume to be meaningful. Hidden count reflects safety guard/evaluator conflicts under current audit policy. Insufficient evidence must be interpreted as data coverage, not product quality.

Do not compare group counts as “old engine wrong” or “new engine better.” They are shadow audit signals only.

## Runtime Non-Application

This helper is not imported by:

- `/api/analyze`
- `functional-ranking-contract.js`
- `functional-candidate-policy.js`
- UI components

It does not alter existing `topPick`, `supportingProducts`, or `budgetAlternatives`.

## CandidatePolicy Integration Conditions

Before runtime integration:

- decide whether collapsed exposure is a CandidatePolicy group, evaluator soft-state, or both
- define response/storage boundary checks
- keep collapsed UI as a separate task
- confirm additional samples for gaps

Known gaps:

- `metadata_incomplete`
- `active_leaning` only
- `serum` category
