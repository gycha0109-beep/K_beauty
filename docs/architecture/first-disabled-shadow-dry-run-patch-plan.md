# First Disabled Shadow Dry-run Patch Plan

이 문서는 first disabled shadow dry-run patch plan 문서이며, runtime 정책 변경 또는 `/api/analyze` 연결 승인이 아니다.

## Phase 37 Result

Phase 37 fixed the first disabled shadow dry-run preflight checklist, runbook, snapshot requirements, kill criteria, and rollback plan. It did not apply a route patch or execute a dry-run.

## Phase 38 Purpose

Phase 38 fixes the minimal implementation patch plan that would be used in Phase 39 if a separate approval allows a first disabled-by-default shadow dry-run patch. Phase 38 does not modify `/api/analyze`, does not add a route flag, and does not connect evaluator or CandidatePolicy runtime.

## Future Patch Scope

The smallest future patch candidate is:

- add a dev-only guarded call site to `app/api/analyze/route.js` in Phase 39 only
- add `lib/shadow-boundary-dry-run-artifact-writer.js` in Phase 39 or later
- reuse `lib/shadow-boundary-dry-run-helper.js`
- reuse `lib/shadow-dry-run-snapshot-contract.js`
- reuse `lib/shadow-runtime-dry-run-artifact-schema.js`
- strengthen snapshot-based verifiers after the future patch

Phase 38 does not make any of those runtime changes.

## Feature Flag Contract

Candidate future flags:

- `SHADOW_RUNTIME_BOUNDARY_DRY_RUN`
- `DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN`

The preferred future flag is `DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN` because the intended first patch is dev-only.

Required rules:

- default off
- production disabled or protected by allowlist/dev-only guard
- flag value is never logged or written
- flag off skips dry-run path
- flag on does not change response, recommendation, or DB behavior
- flag on does not connect evaluator runtime or CandidatePolicy runtime

## Minimal Route Insertion Blueprint

Recommended insertion point: `route_outside_helper_dev_only_artifact_writer`.

Blueprint:

- run only after public decision and recommendation result are final
- run before response return
- pass only sanitized snapshots to helper and writer
- do not merge helper result into API response
- do not add helper result to DB/store payload
- wrap writer failure in non-blocking try/catch
- write local `tmp` artifact only
- block production artifact write unless a strong guard exists
- preserve existing recommendation result objects

## Snapshot Build Sequence

Future Phase 39 patch should build snapshots in this order:

1. `buildBaselineResponseShapeSnapshot(responseLike)`
2. `buildBaselineRecommendationSnapshot(recommendationLike)`
3. `buildShadowBoundaryHintSnapshot(boundaryHintLike)`
4. `buildShadowReceiverSnapshot(receiverLike)`
5. `buildShadowComparisonSnapshot(...)`
6. `buildShadowBoundaryDryRunArtifact(input)`
7. validate shadow runtime dry-run artifact schema
8. call sanitized local artifact writer
9. verify no response or recommendation mutation

## Artifact Writer Plan

Future writer candidate: `lib/shadow-boundary-dry-run-artifact-writer.js`.

Writer rules:

- writer is separate from helper
- local `tmp` only
- no DB/Supabase write
- forbidden field scan before write
- schema validation before write
- write failure is non-blocking
- path is dev-only
- no full response body dump
- no display fields, raw input, media payloads, or secret values

## Required Verifier Chain

After any future Phase 39 patch, run:

- no-response-change verifier
- no-recommendation-change verifier
- no-DB-write verifier
- forbidden artifact field scan
- dry-run helper verifier
- snapshot contract verifier
- artifact schema verifier
- required contract tests
- route insertion static guard review
- final pre-runtime checklist
- `npm run build`
- `git diff --check`

## Kill Criteria

Immediately block or roll back on:

- API response shape diff
- `topPick`, `supportingProducts`, or `budgetAlternatives` diff
- DB write count greater than zero
- high-risk collapsed receiver count greater than zero
- sensitivitySafe false collapsed receiver count greater than zero
- metadata incomplete collapsed receiver count greater than zero
- strong caution collapsed receiver count greater than zero
- forbidden artifact field detected
- writer failure affects response or recommendation
- production guard insufficient
- helper result merged into response or DB/store payload

## Rollback Plan

Rollback sequence:

1. turn flag off
2. disable artifact writer
3. remove or disable route call site
4. clean local `tmp` artifacts if needed
5. reconfirm baseline response and recommendation
6. rerun verifier chain
7. write failure report

## Phase 39 Allowed Scope

Phase 39 may proceed only with separate approval and only as:

- first disabled shadow dry-run minimal patch
- dev-only flag guard addition
- route-outside artifact writer skeleton
- local `tmp` artifact write
- snapshot schema based verifier refinement
- response, recommendation, and DB-write invariance verification

## Still Prohibited

The following remain prohibited:

- evaluator runtime connection
- CandidatePolicy runtime connection
- API response change
- recommendation result change
- UI exposure change
- DB/Supabase schema change
- production activation

## Runtime Non-application

Phase 38 does not call `/api/analyze`, does not edit `/api/analyze`, does not add a route flag, does not change evaluator or CandidatePolicy runtime, does not alter response or recommendation output, and does not write to Supabase.
