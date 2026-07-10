# Final Pre-runtime Integration Checklist

이 문서는 final pre-runtime integration checklist 문서이며, runtime 정책 변경 또는 `/api/analyze` 연결 승인이 아니다.

## Phase 16-35 Summary

Phase 16-25 established boundary policy evidence across actual capture, pure replay, and synthetic coverage. Phase 26-29 converted that evidence into readiness and runtime integration acceptance criteria. Phase 30-32 fixed disabled-by-default dry-run design, required contract tests, artifact schema, and safety verifier skeletons. Phase 33-35 added the implementation plan, snapshot contract, static route insertion guard review, and route-disconnected dry-run helper skeleton.

No phase has connected evaluator runtime, CandidatePolicy runtime, `/api/analyze`, UI response, recommendation result replacement, or DB/Supabase writes.

## Why This Checklist Exists

The first disabled shadow dry-run will be the first point where a future route touch might be considered. This checklist fixes the last pre-runtime approval criteria before writing that plan. It does not approve route changes.

## Policy Readiness

Required:

- boundary readiness status is `ready_for_boundary_integration_design`
- runtime acceptance status is `ready_for_runtime_integration_plan`
- actual and pure replay high-risk collapsed counts are zero
- actual and pure replay low-risk collapsed consistency is preserved

## Contract Readiness

Required contracts:

- boundary policy helper
- collapsed hint contract
- CandidatePolicy hint receiver contract
- dry-run artifact schema
- dry-run snapshot contract
- route-outside dry-run helper skeleton
- required contract tests with 10 passing cases

## Safety Verifier Readiness

Required:

- no-response-change verifier skeleton
- no-recommendation-change verifier skeleton
- no-DB-write verifier skeleton
- forbidden artifact field verifier behavior
- shadow safety verifier skeleton passing
- kill condition list present

## Route Isolation Readiness

Required:

- `/api/analyze` remains unchanged
- recommended insertion point is `route_outside_helper_dev_only_artifact_writer`
- static route insertion guard review is present
- helper is not imported by route, evaluator runtime, or CandidatePolicy runtime

## Artifact Safety Readiness

Required:

- artifact output remains local `tmp` only
- DB persistence is forbidden
- API response merge is forbidden
- full response body dump is forbidden
- product display fields are forbidden
- env/secret output is forbidden
- artifact writer failure is non-blocking for response and recommendation results

## First Disabled Shadow Dry-run Allow Conditions

All must be true before a first disabled shadow dry-run plan can be considered:

- flag default off
- production disabled or allowlist/dev-only guard
- response snapshot and recommendation snapshot separated
- baseline and shadow sections separated
- no API response shape change verifier runs
- no recommendation result change verifier runs
- no DB write verifier runs
- forbidden field verifier runs
- required contract tests run
- high-risk, metadata-incomplete, and strong-caution collapsed receiver kill conditions active
- artifact writer separated from helper
- artifact writer failure cannot affect response or recommendation

## Block Conditions

Any of these blocks first disabled shadow dry-run connection:

- high-risk collapsed receiver count greater than zero
- sensitivitySafe false collapsed receiver count greater than zero
- metadata incomplete collapsed receiver count greater than zero
- strong caution collapsed receiver count greater than zero
- API response shape diff
- topPick, supportingProducts, or budgetAlternatives diff
- DB write count greater than zero
- forbidden artifact field detected
- production flag guard insufficient
- route helper result merged into public response
- helper result written to DB or store payload

## Phase 37 Allowed Scope

Phase 37 may proceed only as:

- first disabled shadow dry-run plan
- disabled shadow dry-run preflight plan
- route-disconnected artifact writer skeleton design

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

## Runtime Non-application

This checklist does not call `/api/analyze`, does not add a route flag, does not connect runtime paths, does not change response or recommendation results, and does not write to Supabase.
