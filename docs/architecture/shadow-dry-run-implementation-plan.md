# Shadow Dry-run Implementation Plan

이 문서는 shadow dry-run implementation plan 문서이며, runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다.

## Phase 30-32 Summary

Phase 30 fixed the disabled-by-default dry-run design and required contract test plan. Phase 31 added the required contract test skeleton and shadow dry-run artifact schema. Phase 32 added no-response-change, no-recommendation-change, and no-DB-write verifier skeletons.

The current state is still design-only. No evaluator runtime, CandidatePolicy runtime, `/api/analyze` response, recommendation result, DB/Supabase path, product source, or capture fixture source has been changed.

## Why This Plan Exists

A future shadow runtime dry-run needs a narrow implementation plan before any route touch. The plan must prove that enabling shadow observation cannot change:

- API response shape
- recommendation result groups
- DB/Supabase writes
- product data
- runtime evaluator or CandidatePolicy behavior

## Feature Flag Plan

The future dry-run must be disabled by default.

Flag plan:

- default state: off
- recommended flag name: `SHADOW_RUNTIME_BOUNDARY_DRY_RUN`
- alternate candidates: `ANALYZE_SHADOW_BOUNDARY_DRY_RUN`, `DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN`
- flag value must never be printed
- production default: disabled
- production activation requires an additional allowlist or dev-only guard

Behavior:

- flag off: dry-run code path must not execute
- flag on: only sanitized shadow snapshots and local artifacts may be produced
- flag on must not change API response or recommendation results
- flag on must not write to DB/Supabase

## Route Insertion Point Candidates

### After Public Decision Created

Advantages:

- final recommendation groups are available
- response shape snapshot can be captured near payload construction

Risks:

- accidental mutation of the public response object
- accidental mutation of recommendation groups

Required guardrails:

- read-only snapshot
- no mutation of `publicDecision`
- no shadow fields appended to response

### After Candidate Source Diagnostics Created

Advantages:

- candidate source and scorer-compatible rows can be observed without rerunning the route
- shadow diagnostics can stay separated from actual evidence

Risks:

- final response shape may not yet be available
- recommendation snapshot still needs a separate final baseline capture

Required guardrails:

- read-only diagnostics snapshot
- separated baseline recommendation snapshot
- local tmp artifact only

### Before Premium Store

Advantages:

- can compare baseline snapshots before persistence boundaries
- DB write guard can be positioned near the persistence boundary

Risks:

- artifact write failure could be confused with persistence failure
- stored payload mutation risk must be explicitly blocked

Required guardrails:

- strict no-persistence dry-run branch
- artifact writer isolated from store payload
- no mutation of stored report object

### Before Response Return, Sanitized Comparison Only

Advantages:

- final response shape is available
- final recommendation result is available

Risks:

- late insertion creates accidental response attachment risk
- artifact write must not block response return

Required guardrails:

- firewalled local artifact writer
- non-blocking write failure handling
- no response object append

### Route-outside Helper With Dev-only Artifact Writer

Advantages:

- keeps shadow logic outside the route body
- makes no-response/no-recommendation/no-DB-write verifiers easier to scope
- artifact schema validation can sit at the writer boundary

Risks:

- still requires a future route touch to call the helper
- static guard review must prove the helper result is not merged into response or persisted

Required guardrails:

- flag gate before helper execution
- pure snapshot inputs only
- local tmp artifact only
- artifact write failure must not affect response or recommendation result

## Recommended Insertion Point

Recommended: route-outside helper with a dev-only local artifact writer.

Rationale: it keeps the future shadow dry-run as a pure helper fed by sanitized baseline snapshots and candidate diagnostics. The helper output can be schema-validated and written only to local `tmp` under an explicit disabled-by-default flag. This has the lowest response, recommendation, and DB-write risk among the candidate insertion points.

## Snapshot Contract Plan

Required future snapshots:

- `baselineResponseShapeSnapshot`
- `baselineRecommendationSnapshot`
- `shadowBoundaryHintSnapshot`
- `shadowReceiverSnapshot`
- `comparisonSnapshot`

`baselineRecommendationSnapshot` may contain only ids and order for:

- topPick
- supportingProducts
- budgetAlternatives

`comparisonSnapshot` must include:

- responseShapeChanged
- recommendationChanged
- hiddenToCollapsedDelta
- collapsedToHiddenRegressionCount
- highRiskCollapsedReceiverCount
- metadataIncompleteCollapsedReceiverCount
- strongCautionCollapsedReceiverCount
- dbWriteCount

## Artifact Write Plan

Artifact writes must be local and sanitized.

Allowed path candidates:

- `tmp/shadow-runtime-dry-run/<run-id>.json`
- `tmp/shadow-runtime-dry-run/latest.json`

Required:

- artifact schema from `lib/shadow-runtime-dry-run-artifact-schema.js`
- local `tmp` only
- no DB persistence
- no production artifact write without a strong internal guard
- artifact write failure must not change response or recommendations

Required artifact flags:

- `evidenceType`
- `dryRunOnly`
- `runtimeConnected`
- `routeInvoked`
- `supabaseWriteExecuted`
- `runtimeMutation`

## Verifier Chain Plan

Future implementation must run:

- no-response-change verifier
- no-recommendation-change verifier
- no-DB-write verifier
- forbidden artifact field verifier
- required contract tests
- dry-run artifact schema verifier
- high-risk collapsed receiver kill condition
- metadata incomplete collapsed receiver kill condition
- strong caution collapsed receiver kill condition

Any failure blocks runtime connection.

## Kill Switch / Rollback Plan

Kill switch:

- set the dry-run flag off
- stop local artifact writer
- discard shadow artifacts from decision flow
- keep existing recommendation and response path

Immediate blocked statuses:

- high-risk collapsed receiver violation
- response shape diff
- recommendation result diff
- DB write detection
- metadata incomplete collapsed receiver violation
- strong caution collapsed receiver violation
- forbidden artifact field detection

Artifact write failure must not affect response or recommendation results.

## Forbidden Fields

Artifacts and snapshots must not include:

- product name or brand
- purchase URL or buy link
- review text
- raw form data
- image or base64 payload
- PII
- env or secret values
- full API response body dump

## Phase 34 Allowed Scope

Phase 34 may do:

- dry-run snapshot contract helper design
- future flag contract documentation
- no-response/no-recommendation/no-DB-write verifier refinement against a snapshot schema
- route insertion point static guard review

## Still Prohibited

The following remain prohibited:

- `/api/analyze` route change
- evaluator runtime connection
- CandidatePolicy runtime connection
- API response change
- recommendation result change
- DB/Supabase change

## Runtime Non-application

This plan does not add a flag to `/api/analyze`, does not call `/api/analyze`, does not write to Supabase, and does not connect evaluator or CandidatePolicy runtime paths.
