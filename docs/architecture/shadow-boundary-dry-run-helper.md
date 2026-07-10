# Shadow Boundary Dry-run Helper

이 문서는 shadow boundary dry-run helper skeleton 문서이며, runtime 정책 변경 또는 `/api/analyze` 연결 승인이 아니다.

## Phase 33/34 Summary

Phase 33 recommended a future `route_outside_helper_dev_only_artifact_writer` approach. Phase 34 added a sanitized snapshot contract and static route insertion guard review. Phase 35 adds a route-disconnected helper skeleton that can assemble those snapshots into a shadow dry-run artifact payload.

This helper is not imported by `/api/analyze`, evaluator runtime, CandidatePolicy runtime, UI, or DB code.

## Why The Helper Skeleton Is Needed

Before any runtime route touch, the project needs a pure helper that proves the shape of future dry-run inputs and outputs. The helper skeleton fixes how baseline snapshots, shadow hint snapshots, receiver snapshots, comparison summaries, and kill conditions will be assembled without changing runtime behavior.

## Helper Responsibilities

The helper may:

- evaluate whether a future dry-run flag would be enabled from an env-like object
- validate sanitized snapshot inputs
- keep baseline and shadow sections separate
- summarize response, recommendation, safety, and DB-write kill conditions
- return a sanitized artifact payload

## What The Helper Does Not Do

The helper does not:

- connect to `/api/analyze`
- add a route flag
- call evaluator runtime
- call CandidatePolicy runtime
- change API response
- change recommendation results
- write artifacts to disk
- write to DB/Supabase
- print env or secret values

## Disabled-by-default Gate

The default state is disabled.

`isShadowBoundaryDryRunEnabled(envLike)` returns true only for explicit future flag samples in non-production env-like inputs. It returns false for empty input, false values, and production.

The helper does not print flag values.

## Input Snapshot Contract

Required input:

- `baselineResponseShapeSnapshot`
- `baselineRecommendationSnapshot`
- `shadowBoundaryHintSnapshot`
- `shadowReceiverSnapshot`
- `comparisonSnapshot`
- `dryRunContext`

`dryRunContext` must include:

- `evidenceType`
- `dryRunOnly: true`
- `runtimeConnected: false`
- `routeInvoked: false`
- `supabaseWriteExecuted: false`
- `runtimeMutation: false`

## Output Artifact Contract

`buildShadowBoundaryDryRunArtifact(input)` returns a sanitized payload with:

- `schemaVersion`
- `helperVersion`
- `evidenceType: shadow_boundary_dry_run_helper_skeleton`
- `dryRunOnly: true`
- `runtimeConnected: false`
- `routeInvoked: false`
- `supabaseWriteExecuted: false`
- `runtimeMutation: false`
- separated `baseline` and `shadow`
- `comparison`
- `killConditionSummary`
- `artifactSanitization`
- `artifactWritten: false`

The helper returns payload only. Artifact writing remains a separate future responsibility.

## Kill Condition Summary

Kill conditions include:

- highRiskCollapsedReceiverCount greater than zero
- sensitivityUnsafeCollapsedReceiverCount greater than zero
- metadataIncompleteCollapsedReceiverCount greater than zero
- strongCautionCollapsedReceiverCount greater than zero
- responseShapeChanged true
- recommendationChanged true
- dbWriteCount greater than zero
- forbiddenFieldDetected true

Any kill condition marks `blocked: true`.

## Forbidden Fields

The helper rejects:

- product name or brand
- purchase URL or buy link
- review text
- raw form data
- image or base64 payload
- PII
- env/secret/token/API key values
- full API response body dump

## Artifact Writer Boundary

The helper intentionally does not write artifacts. A future artifact writer must:

- remain disabled by default
- be dev-only or internally guarded
- write local `tmp` only
- validate schema before write
- never affect API response or recommendation result if writing fails

## Route Insertion Still Prohibited

Phase 35 does not authorize route insertion. `/api/analyze` must remain unchanged until a separate approved runtime task exists.

## Phase 36 Allowed Scope

Phase 36 may proceed as:

- final pre-runtime integration checklist
- artifact writer skeleton design
- snapshot-contract-backed verifier refinement

## Still Prohibited

The following remain prohibited:

- `/api/analyze` route change
- shadow flag added to route
- evaluator runtime connection
- CandidatePolicy runtime connection
- API response change
- recommendation result change
- DB/Supabase write or schema change
- product data change
