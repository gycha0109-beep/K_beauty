# Shadow Safety Verifier Skeletons

이 문서는 shadow safety verifier skeleton 설계 문서이며, runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다.

## Phase 31 Summary

Phase 31 fixed the required contract test skeleton and the shadow runtime dry-run artifact schema. The schema requires separated `baseline` and `shadow` sections, explicit runtime isolation flags, evidence type separation, zero DB writes, no recommendation mutation, and no forbidden artifact fields.

## Phase 32 Purpose

Phase 32 adds three verifier skeleton contracts that a future disabled-by-default shadow runtime dry-run must satisfy before any runtime integration can be considered:

- no-response-change verifier skeleton
- no-recommendation-change verifier skeleton
- no-DB-write verifier skeleton

The skeletons use synthetic schema samples only. They do not call `/api/analyze`, do not execute Supabase reads or writes, and do not treat synthetic samples as actual evidence.

## No-response-change Verifier Skeleton

The no-response-change skeleton defines how a future dry-run must prove the API response shape stayed unchanged.

Required future inputs:

- baseline response shape snapshot
- shadow-enabled response shape snapshot
- evidence that the shadow artifact was not injected into the API response
- evidence that the full API response body was not dumped into the artifact

Failure conditions:

- shadow dry-run artifact appears in the API response
- full API response body dump appears in the artifact
- response shape keys, nested shapes, field presence, field types, or order-sensitive arrays change
- forbidden artifact fields are present

## No-recommendation-change Verifier Skeleton

The no-recommendation-change skeleton defines how a future dry-run must prove recommendation results stayed unchanged.

Required future inputs:

- baseline recommendation summary snapshot
- shadow-enabled recommendation summary snapshot

Comparison is order-sensitive for:

- `topPick`
- `supportingProducts`
- `budgetAlternatives`

Any identity or order change is treated as a recommendation result change. Shadow-only evaluator hints and CandidatePolicy receiver results must not mutate recommendations.

## No-DB-write Verifier Skeleton

The no-DB-write skeleton defines how a future dry-run must prove it did not write to Supabase, storage, analytics, or log sinks.

Required future write counters:

- insert count
- update count
- delete count
- upsert count
- RPC mutation count
- storage write count
- analytics/log write count

All counts must remain zero. Existing guard/session mutation tracking must be separated from shadow dry-run mutation tracking.

## Future Baseline/After Snapshot Principle

The skeletons intentionally do not use actual runtime snapshots yet. A future dry-run must provide paired baseline and shadow-enabled snapshots for response shape, recommendation result, and write counters. The verifier compares those pairs without mixing them with actual capture, pure replay, or synthetic coverage evidence.

## Synthetic Samples vs Actual Evidence

Synthetic skeleton samples only validate the contract shape and failure behavior. They are not actual `/api/analyze` evidence, not recommendation evidence, and not DB evidence.

Required separation:

- `syntheticSkeletonSampleUsed: true`
- `syntheticTreatedAsActualEvidence: false`
- `routeInvoked: false`
- `supabaseWriteExecuted: false`
- `runtimeMutation: false`

## Forbidden Fields

Artifacts must not contain product display fields, raw inputs, image payloads, PII, env values, secret values, or full API response body dumps.

Forbidden classes include:

- product name or brand
- purchase URL or buy link
- review text
- raw form data
- image or base64 payloads
- PII
- env/secret/token/API key values
- full API response body dumps

## Runtime Preconditions

Before runtime connection is considered, the following must exist:

- disabled-by-default dry-run flag design
- response shape baseline/after snapshot contract
- recommendation result baseline/after snapshot contract
- DB write counter snapshot contract
- artifact sanitization verifier
- contract tests from Phase 31 passing
- safety verifier skeletons from Phase 32 passing

## Phase 33 Allowed Scope

Phase 33 may design a disabled-by-default shadow dry-run implementation plan or a dry-run snapshot contract.

Allowed:

- dry-run snapshot schema design
- baseline/after snapshot capture contract design
- no-response-change verifier implementation plan
- no-recommendation-change verifier implementation plan
- no-DB-write verifier implementation plan
- dev-only sanitized artifact routing design

## Still Prohibited

The following remain prohibited:

- evaluator runtime connection
- CandidatePolicy runtime connection
- `/api/analyze` response changes
- UI exposure changes
- recommendation result changes
- DB/Supabase schema or write changes
- product data changes
