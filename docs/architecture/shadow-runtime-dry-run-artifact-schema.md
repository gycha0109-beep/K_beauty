# Shadow Runtime Dry-run Artifact Schema

이 문서는 shadow runtime dry-run artifact schema 문서이며, runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다.

## Phase 30 Summary

Phase 30 fixed the disabled-by-default shadow runtime dry-run plan. The dry-run must not change API response shape, recommendation results, DB state, UI exposure, evaluator runtime, or CandidatePolicy runtime.

Phase 31 turns that plan into a schema contract and validation helper for future dry-run artifacts.

## Why This Schema Exists

The future dry-run will compare baseline behavior with shadow behavior. Without a strict artifact schema, diagnostics could accidentally mix evidence types, leak product display fields, or blur the line between shadow data and user-visible runtime behavior.

This schema exists to prevent those failures before runtime work begins.

## Required Fields

Required top-level fields:

- `schemaVersion`
- `evidenceType`
- `runtimeConnected`
- `dryRunOnly`
- `routeInvoked`
- `supabaseWriteExecuted`
- `runtimeMutation`
- `baseline`
- `shadow`
- `comparison`
- `evidenceSeparation`
- `artifactSanitization`

Allowed `evidenceType` values:

- `shadow_runtime_dry_run`
- `shadow_runtime_dry_run_schema_test`

## Allowed Fields

Allowed observation fields are limited to sanitized identifiers, enum decisions, reason keys, and aggregate counts.

Examples:

- `productId`
- `category`
- `baselineExposureGroup`
- `whatIfExposureGroup`
- `boundaryDecision`
- `candidatePolicyHint`
- `receiverDecision`
- `reasonKeys`
- `highRiskCollapsedReceiverCount`
- `safeLowRiskCollapsedReceiverCount`
- `evidenceType`
- `runtimeConnected`
- `dryRunOnly`

## Forbidden Fields

Forbidden fields include:

- product name
- brand
- purchase URL
- review text
- raw form
- image/base64
- PII
- env/secret values
- full API response body

The schema helper rejects both direct forbidden field names and common aliases such as `productName`, `buyLink`, `imageUrl`, `apiResponseBody`, and `responseBody`.

## Baseline vs Shadow Separation

Artifacts must keep `baseline` and `shadow` as separate sections.

Required separation:

- baseline evaluator result is not overwritten by shadow result
- baseline exposure result is not overwritten by shadow result
- shadow boundary hint result remains in the shadow section
- receiver decision remains in the shadow section
- comparison deltas are recorded under `comparison`

## Evidence Type Separation

Artifacts must keep actual, pure replay, and synthetic evidence separate.

Required fields:

- `actualEvidenceBucket`
- `pureReplayEvidenceBucket`
- `syntheticCoverageBucket`
- `syntheticTreatedAsActualEvidence: false`

Synthetic contract cases are never actual capture evidence.

## API Response Non-change

The schema requires:

- `comparison.apiResponseShapeChanged: false`
- `artifactSanitization.fullApiResponseBodyDumped: false`

Dry-run artifacts may record sanitized shape status, not response body dumps.

## Recommendation Result Non-change

The schema requires:

- `comparison.recommendationResultChanged: false`
- `comparison.topPickChanged: false`
- `comparison.supportingProductsChanged: false`
- `comparison.budgetAlternativesChanged: false`

Dry-run shadow data must not mutate selected recommendation groups.

## DB Write Prohibition

The schema requires:

- `supabaseWriteExecuted: false`
- `comparison.dbWriteCount: 0`

Any write attempt fails schema validation and blocks dry-run expansion.

## Schema Validation Failure Conditions

Validation fails when:

- a required top-level field is missing
- evidence type is invalid
- `runtimeConnected` is true
- `dryRunOnly` is not true
- `supabaseWriteExecuted` is true
- `runtimeMutation` is true
- baseline or shadow section is missing
- synthetic evidence is treated as actual evidence
- actual and pure replay buckets are mixed
- API response shape changed
- recommendation result changed
- DB write count is nonzero
- high-risk collapsed receiver count is nonzero
- metadata incomplete collapsed receiver count is nonzero
- forbidden fields or values are present

## Phase 32 Allowed Scope

- No-response-change verifier skeleton
- No-recommendation-change verifier skeleton
- No-DB-write verifier skeleton
- Dry-run artifact schema refinement
- Additional pure helper contract tests

## Still Prohibited

- Evaluator runtime connection
- CandidatePolicy runtime connection
- `/api/analyze` response change
- UI exposure change
- DB or Supabase schema change
- Product data changes
- Recommendation result replacement

## Runtime Non-application

Phase 31 only defines and verifies schema behavior. It does not execute a shadow runtime dry-run or connect runtime code.
