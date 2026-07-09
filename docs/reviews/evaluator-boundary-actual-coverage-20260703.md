# Evaluator Boundary Actual Coverage

This document records actual complete-capture coverage for the evaluator recent-instability boundary policy.

This document is based on current `tmp/functional-shadow-captures` complete/product-row artifacts. It is not runtime policy approval and does not change evaluator hard filters, ranking score, CandidatePolicy, UI, API response, DB, Supabase, product data, capture fixtures, or existing recommendations.

## Purpose

Phase 16 introduced a shadow boundary for candidates hard-blocked by `recent_instability_active_limited`.

Phase 17 used synthetic fixtures to validate missing policy matrix cells:

- active-leaning only profile
- metadata incomplete profile/product metadata
- serum category
- strong caution metadata

Phase 18 checks whether those synthetic gaps are actually present in the current complete/product-row capture evidence.

## Phase 16 Shadow Result Summary

Phase 16 actual shadow result:

- reviewed evaluator `recent_instability_active_limited` rows: 86
- preserve hard block: 33
- downgrade to collapsed candidate: 52
- metadata review: 0
- not applicable: 1
- safe-low-risk hidden target slice: 50 / 50 downgraded to collapsed candidate
- high-risk collapsed count: 0

## Phase 17 Synthetic Coverage Summary

Phase 17 synthetic validation showed:

- active-leaning only with safe metadata can downgrade to collapsed candidate
- active-leaning only with unsafe metadata preserves hard block
- metadata-incomplete cases route to metadata review
- serum category alone does not preserve hard block
- serum plus strong caution preserves hard block
- empty caution tags alone do not force hard block or metadata review

Synthetic validation is controlled policy coverage. It is not actual user or product distribution evidence.

## Phase 18 Actual Coverage Scope

Collector:

- `scripts/collect-evaluator-boundary-actual-coverage.mjs`

Artifacts:

- `tmp/evaluator-boundary-actual-coverage.json`
- `tmp/evaluator-boundary-actual-coverage.md`

Capture scope:

- complete/product-row fixtures used: 10
- total high-confidence candidate rows: 1,640
- boundary applicable rows: 86
- reviewed rows: 86

Excluded:

- final-results-only fixtures
- replay/summary/review JSON artifacts
- synthetic verifier fixtures
- malformed or non-capture JSON

## Actual Capture Evidence vs Synthetic Fixture Validation

Actual capture evidence:

- uses current complete/product-row capture artifacts
- reflects the product rows and candidate source available in this repo state
- can show whether a gap exists in the current actual candidate distribution

Synthetic fixture validation:

- constructs controlled product/profile inputs
- validates policy invariants for missing matrix cells
- does not prove those cases exist in current product/capture distribution

These evidence types must remain separate. A synthetic pass does not approve runtime policy changes.

## Active-Leaning Only Actual Observation

Status:

- `not_observed_in_current_actual_captures`

Observed rows:

- total: 0
- boundary applicable: 0

Interpretation:

- The current complete captures do not contain active-leaning-only candidate rows in the reviewed evidence.
- Phase 17 synthetic coverage remains useful, but actual high-confidence coverage is still missing.

## Metadata-Incomplete Actual Observation

Status:

- `not_observed_in_current_actual_captures`

Observed rows:

- total: 0
- boundary applicable: 0

Interpretation:

- Current complete captures did not include metadata-incomplete candidate rows in the reviewed evidence.
- The metadata-review branch is synthetically validated, but actual product/profile coverage remains unproven.

## Serum Category Actual Observation

Status:

- `not_observed_in_current_actual_captures`

Observed rows:

- total: 0
- boundary applicable: 0

Interpretation:

- Current complete captures did not include serum-category candidate rows in the reviewed evidence.
- Serum behavior remains a synthetic coverage result only.

## Strong Caution Metadata Actual Observation

Status:

- `not_observed_in_current_actual_captures`

Observed rows:

- total: 0
- boundary applicable: 0

Interpretation:

- Current complete captures did not include strong-caution metadata candidates in the reviewed evidence.
- Strong-caution preservation remains synthetically validated, not actual-capture validated.

## Safe-Low-Risk Hidden Reconfirmation

Status:

- `observed_in_current_actual_captures`

Observed rows:

- total: 50
- boundary applicable: 50
- decision distribution: `downgrade_to_collapsed_candidate: 50`

Interpretation:

- Phase 16's safe-low-risk hidden target slice is still present.
- All 50 still route to future collapsed-candidate treatment under the shadow boundary.
- No row in this slice was reclassified as high risk.

## High-Risk Protection

Result:

- high-risk collapsed count: 0
- passed: true

Interpretation:

- The current actual coverage did not show high-risk candidates being downgraded to collapsed by the boundary policy.

## Limitations

Current missing actual coverage:

- active-leaning only candidate rows
- metadata-incomplete candidate rows
- serum category candidate rows
- strong-caution metadata candidate rows

General limitations:

- Current complete captures may not represent real user or product distribution.
- The result depends on available local shadow captures and product source coverage.
- Not observed does not mean impossible.
- This coverage collection does not approve runtime policy changes.

## Runtime Non-Application

No runtime changes were made.

Unchanged:

- `/api/analyze`
- `lib/functional-ranking-contract.js`
- existing evaluator hard filters
- score and weight logic
- `lib/functional-candidate-policy.js`
- UI and API response
- DB/Supabase/migrations
- topPick/supportingProducts/budgetAlternatives
- product data
- capture fixture source files

## CandidatePolicy / Evaluator Connection Conditions

Before connecting evaluator pass plus collapsed hint in runtime, the project still needs:

- actual complete-capture evidence for active-leaning-only candidates
- actual complete-capture evidence for metadata-incomplete candidates
- actual complete-capture evidence for serum category candidates
- actual complete-capture evidence for strong-caution metadata candidates
- a separately approved evaluator/CandidatePolicy integration task
- regression checks that existing API response and recommendation payloads remain unchanged
