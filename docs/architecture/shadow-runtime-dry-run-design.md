# Shadow Runtime Dry-run Design

이 문서는 shadow runtime dry-run 설계 문서이며, runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다.

## Phase 29 Summary

Phase 29 produced `acceptanceStatus: ready_for_runtime_integration_plan`.

That status means the evidence is sufficient to design a future runtime integration plan or shadow runtime dry-run. It does not approve evaluator runtime changes, CandidatePolicy runtime connection, API response changes, UI exposure changes, DB/Supabase changes, or recommendation result replacement.

## Why Shadow Runtime Dry-run Is Needed

Phase 27 and Phase 28 what-if evidence was produced outside runtime. Before any runtime connection is considered, a disabled-by-default dry-run design must prove the future runtime path can observe the same boundary and receiver decisions without changing user-visible behavior or stored data.

The dry-run must answer these questions:

- Does the baseline evaluator result remain unchanged?
- Does the baseline CandidatePolicy or exposure result remain unchanged?
- Does the boundary hint what-if match the expected collapsed hint contract?
- Does the receiver what-if preserve high-risk and insufficient-evidence guardrails?
- Are API response, recommendation result, and DB write behavior unchanged?

## Disabled-by-default Principle

The dry-run must be off by default.

Required gate:

- default state: off
- explicit environment flag required
- production default: disabled
- production requires an additional guard before any execution
- dry-run output is never added to API response
- dry-run output never changes recommendation results
- dry-run output is never persisted to DB/Supabase
- dry-run output is limited to sanitized artifact or dev-only log
- env values are never printed

Recommended flag name for future design discussion:

- `SHADOW_RUNTIME_BOUNDARY_DRY_RUN`

This document does not add that flag to runtime.

## Dry-run Flag Design

A future flag must be evaluated before any shadow dry-run work is attempted. The dry-run must not execute when the flag is missing, false, malformed, or production-disallowed.

The flag must not enable:

- evaluator runtime behavior changes
- CandidatePolicy runtime behavior changes
- public API fields
- UI exposure changes
- DB writes
- recommendation result mutation

## Observation Scope

Allowed dry-run fields:

- `productId`
- `category`
- `baselineExposureGroup`
- `whatIfExposureGroup`
- `boundaryDecision`
- `candidatePolicyHint`
- `receiverDecision`
- `highRiskCollapsedReceiverCount`
- `safeLowRiskCollapsedReceiverCount`
- `reasonKeys`
- `evidenceType`
- `runtimeConnected`
- `dryRunOnly`

Forbidden dry-run fields:

- product name
- brand
- purchase URL
- review text
- raw form
- image/base64
- PII
- env/secret values
- full API response body dump

## Baseline vs Shadow Comparison

Dry-run artifacts must keep baseline and shadow sections separate.

Required comparisons:

- baseline evaluator result
- baseline CandidatePolicy/exposure result
- boundary hint what-if result
- receiver what-if result
- hidden to collapsed delta
- collapsed to hidden regression
- high-risk collapsed violation
- metadata incomplete routing result
- API response shape diff
- recommendation result diff
- DB write attempt count

Baseline data must not be overwritten by shadow output.

## API Response Non-change

The dry-run must not add, remove, rename, or reorder public response fields. A future verifier must compare response shape with the dry-run disabled and enabled, while keeping response body content out of artifacts except sanitized shape metadata.

## Recommendation Result Non-change

The dry-run must not alter:

- `topPick`
- `supportingProducts`
- `budgetAlternatives`
- selected product order
- selected product count
- existing recommendation explanation fields

Future dry-run comparison may record only sanitized group counts and stable IDs required for diffing.

## DB Write Prohibition

The dry-run must not execute insert, update, delete, upsert, or mutation RPC calls. Any DB write attempt is a kill condition and blocks dry-run expansion.

## Artifact Sanitization

Artifacts may include IDs, category, exposure group, decision enum, hint enum, receiver enum, reason keys, evidence type, and aggregate counts.

Artifacts must exclude display text, URLs, raw survey or product forms, images, review text, PII, env values, secrets, and full API response dumps.

## Kill Conditions

These kill conditions are mandatory stop rules.

Runtime connection or dry-run expansion is blocked when any of these occurs:

- high-risk collapsed receiver count is greater than zero
- sensitivity-safe false collapsed receiver count is greater than zero
- strong caution collapsed receiver count is greater than zero
- metadata incomplete collapsed receiver count is greater than zero
- API response shape changes
- topPick, supportingProducts, or budgetAlternatives change
- DB write occurs
- production flag is missing, malformed, or misconfigured
- artifact contains forbidden fields

## Phase 31 Allowed Scope

- Contract test skeleton or pure helper unit tests
- Shadow dry-run flag design document refinement
- Dry-run artifact schema design
- No-response-change verifier design
- No-DB-write verifier design

## Still Prohibited

- Evaluator runtime connection
- CandidatePolicy runtime connection
- `/api/analyze` response change
- UI exposure change
- DB or Supabase schema change
- Recommendation result replacement

## Runtime Non-application

Phase 30 does not implement a flag, dry-run runtime path, evaluator pass, CandidatePolicy receiver wiring, API response field, UI exposure, DB storage, or recommendation result change.
