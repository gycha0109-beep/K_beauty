# First Disabled Shadow Dry-run Plan

이 문서는 first disabled shadow dry-run plan 문서이며, runtime 정책 변경 또는 `/api/analyze` 연결 승인이 아니다.

## Phase 36 Result

Phase 36 produced `ready_for_first_disabled_shadow_dry_run_plan`. That status means the project may write a plan for the first disabled-by-default shadow dry-run. It does not approve a route patch, evaluator runtime change, CandidatePolicy runtime connection, API response change, recommendation result change, or DB/Supabase write.

## Why This Plan Exists

The first disabled shadow dry-run is the first future step where a route touch could be proposed. Before that happens, the preflight checklist, runbook, required snapshots, kill criteria, and rollback criteria must be fixed in writing. The dry-run must remain disabled by default, response-neutral, recommendation-neutral, and DB-write-free.

## Preflight Checklist

Before any future first dry-run connection is proposed, all of these must be confirmed:

- branch is clean or contains only explicitly intended dry-run planning changes
- `/api/analyze` route change scope is described in a separate approved phase
- feature flag defaults to off
- production is disabled or protected by allowlist/dev-only guard
- helper and artifact writer are separate
- artifact writer failure is non-blocking for response and recommendation
- artifact path is local `tmp` only
- schema validation happens before any artifact write
- dry-run result is not merged into API response
- dry-run result does not mutate recommendations
- dry-run does not perform DB/Supabase writes
- forbidden fields block artifact creation
- required contract tests pass
- no-response-change, no-recommendation-change, and no-DB-write verifier skeletons are executable

## First Dry-run Runbook

The future first dry-run should follow this order. Phase 37 does not execute these steps.

1. Prepare a baseline run plan.
2. With the future flag off, capture baseline response shape and recommendation snapshots.
3. Enable only the explicit non-production dry-run flag.
4. Check response shape diff.
5. Check recommendation diff for `topPick`, `supportingProducts`, and `budgetAlternatives`.
6. Check DB write count.
7. Validate the artifact schema before write.
8. Scan forbidden fields.
9. Check high-risk, sensitivity unsafe, metadata incomplete, and strong caution collapsed receiver counts.
10. Turn the flag off and confirm rollback.

## Snapshot Requirements

The first dry-run must produce only sanitized snapshots:

- `baselineResponseShapeSnapshot`
- `baselineRecommendationSnapshot`
- `shadowBoundaryHintSnapshot`
- `shadowReceiverSnapshot`
- `comparisonSnapshot`
- `dbWriteSummary`
- `forbiddenFieldScanSummary`
- `killConditionSummary`

The snapshots must not contain a full API response body dump, product display fields, raw input, media payloads, PII, or env/secret values.

## Kill Criteria

Any one of these blocks the dry-run from proceeding or expanding:

- API response shape diff
- `topPick`, `supportingProducts`, or `budgetAlternatives` diff
- DB write count greater than zero
- high-risk collapsed receiver count greater than zero
- sensitivitySafe false collapsed receiver count greater than zero
- metadata incomplete collapsed receiver count greater than zero
- strong caution collapsed receiver count greater than zero
- forbidden artifact field detected
- artifact writer failure affects response or recommendation
- production guard is insufficient
- helper result is merged into public response or store payload

## Rollback Plan

Rollback must be simple and immediate:

1. Turn the flag off.
2. Disable artifact writer independently from the helper.
3. Remove local `tmp` artifacts if needed for investigation.
4. Remove or disable the future route dry-run block.
5. Reconfirm response and recommendation baseline snapshots.
6. Rerun no-response, no-recommendation, no-DB-write, forbidden-field, and contract verifiers.
7. Write a failure report and do not expand runtime connection.

## Phase 38 Allowed Scope

Phase 38 may only plan or propose:

- first disabled shadow dry-run implementation patch plan
- route insertion minimal patch proposal
- artifact writer skeleton proposal
- flag guard implementation plan
- dry-run snapshot verifier refinement

## Still Prohibited

The following remain prohibited:

- actual `/api/analyze` route change
- evaluator runtime connection
- CandidatePolicy runtime connection
- API response change
- recommendation result change
- DB/Supabase change
- product data change
- existing capture fixture source change

## Runtime Non-application

Phase 37 does not call `/api/analyze`, does not add a route flag, does not connect evaluator or CandidatePolicy runtime, does not change API response or recommendation output, and does not write to Supabase.
