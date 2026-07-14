# AI_WORK_LOG.md

## Entries

### 2026-07-11 / Supabase predecessor baseline safe schema dump intake

- Branch: `codex/survey-input-contract-refactor`
- Scope: diagnosis/design only using the supplied 108,250-byte TEMP public schema-only dump and repository files; no Supabase, Docker, PostgreSQL, remote, build, or test command was run.
- Dump safety: `SAFE_SCHEMA_DUMP`; top-level COPY/INSERT, setval, stdin data blocks, data sections, and credential/connection/JWT patterns were absent. Five indented INSERT statements were PL/pgSQL function-body code, not row data.
- Actual DDL: exact current columns, constraints, indexes, FKs, RLS, policy, grants, triggers, enums, and direct dependencies were extracted for products, product_candidates, source_rankings, and recommendation_logs without copying the raw dump.
- Classification: source_rankings is a required predecessor table because the tracked ranking migration only alters it. Recommendation logs current DDL is the exact pre-SEC-05 state because SEC-05 remains local-only. Tracked normalized/signal/product-form/ranking/grant-use components remain excluded from baseline.
- Gate: `BLOCKED_BY_SCHEMA_UNCERTAINTY` remains. Noncanonical early migrations are absent from linked history, IF NOT EXISTS branches cannot be reconstructed, and products pre-conversion types plus untracked replay dependencies still lack t0 provenance.
- Changes: documentation/work-log only; no code, migration, schema, config, package, test, or DB change.
- Raw dump lifecycle: component evidence and review were completed, then the supplied TEMP dump was deleted; no raw dump copy was created in the repository.
- Next work: locate archived/manual initial schema evidence for product enum/core table/untracked product columns before creating any baseline SQL.

### 2026-07-11 / Supabase remote schema metadata acquisition and predecessor baseline design

- Branch: `codex/survey-input-contract-refactor`
- Task type: security diagnosis/design only; no baseline migration or application/schema change.
- Remote reads: linked public schema dump dry-run succeeded. Linked migration history returned 19 comparison rows: 17 local/remote-aligned versions, with SEC-01 and SEC-05 local-only and no remote-only version. The actual schema-only dump failed before content generation because the local pg_dump container environment was unavailable.
- Data/security: no row query or row export, no remote write, no secret/project host/ref output, and no raw dump was committed. The zero-byte TEMP dump and its directory were deleted.
- Predecessor result: repository chronology proves that products, product_candidates, source_rankings, and recommendation_logs require predecessor definitions, but exact current/initial types, constraints, indexes, RLS, policies, grants, and dependencies were not acquired.
- Gate: `BLOCKED_BY_SCHEMA_UNCERTAINTY`; linked authentication worked, so this is not an auth-configuration finding.
- Next work: rerun the same public schema-only linked dump on a safe workstation with Docker/pg_dump available, extract only the four tables and direct dependencies, then update the predecessor matrix before creating any baseline SQL.

### 2026-07-11 / Supabase Local baseline and shadow bootstrap no-change diagnosis

- Branch: `codex/survey-input-contract-refactor`
- Task type: diagnosis-only; repository files and read-only Git state were inspected without DB, Docker, hosted target, migration, runtime, or network execution.
- Code/migration changes: None. Only `docs/security/supabase-local-baseline-diagnosis-20260711.md` and this work-log entry were added.
- Direct cause: the first production migration, `20260410_safe_review_and_promotion_layer.sql`, first touches `public.products` with `ALTER TABLE` at line 270, while no production migration creates that table. The same chain also assumes pre-existing `product_candidates`, `source_rankings`, and later `recommendation_logs`.
- Shadow bootstrap verdict: `SHADOW_TEST_STUB_ONLY`. Its own comments, isolated config/synthetic seed, text-based products schema, missing production objects/constraints, and simplified guard RPCs prove that it is a route-harness stub rather than a reusable baseline.
- Recommended next work: under separate approval, collect schema-only read-only metadata for the missing predecessor tables, then design a real timestamp-0 baseline and a separately labelled SEC-05 isolated local test project.
- Not executed: Supabase start/reset/test/link, migration apply, Docker, PostgreSQL/psql, remote metadata/data access, build/test, provider/API calls, dependency changes, and Git mutation commands.

### 2026-07-11 / SEC-05 V01-V04 commit-blocking remediation

- Branch: `codex/survey-input-contract-refactor`
- Task type: execution / minimal anonymous write grant hardening after precision verification.
- Scope: permanent-vs-anonymous browser auth helper, anonymous result transport split, canonical persistence fingerprint, result no-reclaim/use-ID linkage in the existing SEC-05 migration, verifier, remediation documentation, and this work log.
- V01/V02: anonymous Supabase sessions no longer clear grants; `analysisRunId` remains transport-only and is not an anonymous stored result field.
- V03: analyze and results share one canonical anonymous result persistence helper. Meta, Face Lab, transport fields, image name, and unknown top-level fields are not stored through anonymous result writes.
- V04: result claims never re-claim after first use. `analysis_results.anonymous_write_grant_use_id` is nullable and unique; replay recovery uses that ID rather than `analysis_requests.session_id`.
- V05: not changed; cleanup lease/grace remains a separate Low-risk follow-up.
- Validation: SEC-05 verifier, analysis RLS verifier, JS/MJS syntax checks, synthetic fingerprint checks, build, and diff checks are required before completion. No migration apply, Supabase write, provider call, or production access is authorized.
- Next work: run disposable local DB concurrency/privilege tests and staging anonymous/account smoke tests before deployment.

### 2026-07-11 / SEC-05 v2 anonymous write grant precision verification

- Branch: `codex/survey-input-contract-refactor`
- Task type: review / verification-only for SEC-05 v2 token, principal, route/client, migration/RPC, and verifier contracts.
- Code changes: None. Only `docs/security/sec-05-anonymous-write-grant-v2-verification-20260711.md` and this work-log entry were added.
- Verdict: `FIX_REQUIRED`. Findings: Critical 0, High 0, Medium 4, Low 1, Info 2.
- Commit blockers: Supabase anonymous Auth tokens are misclassified as account tokens in client callers; `analysisRunId` conflicts with the anonymous result allowlist; supplemental/nested result data can bypass the result fingerprint; result lease retries lack stale-worker fencing and a unique grant-use linkage.
- Validation: SEC-05 v2 verifier, analysis RLS verifier, 14 JS/MJS `node --check` checks, `npm run build`, synthetic fingerprint/shape checks, and `git diff --check` passed. Direct `node --check` for JSX was unsupported by Node and the JSX file compiled in the successful Next.js build.
- Local DB: Not run. `supabase status --output json` could not connect to a Docker engine, so migration apply, RPC concurrency, privilege metadata, and recommendation log schema integration remain unverified.
- Next work: fix the four Medium findings without expanding into premium/saved-report/check-in permissions, then run disposable local Postgres concurrency tests and staging anonymous/account smoke tests.

### 2026-07-11 / SEC-05 v2 anonymous write grant and atomic replay defense

- Branch: `codex/survey-input-contract-refactor`
- Task type: execution / anonymous result and tracking write authorization hardening.
- Changed scope: v2 write-grant core/helper, SEC-01 signed-cookie read-only principal resolver, `/api/analyze`, `/api/results`, `/api/track`, their client callers, anonymous grant migration, static verifiers, SEC-05 implementation document, and this work log.
- v1 removal: legacy `x-kbeauty-write-token` is no longer issued or accepted. Browser storage removes its legacy key without a compatibility period.
- Grant contract: `/api/analyze` creates paired `result:create` and `track:create` v2 grants bound to analysis run ID and a write-secret-derived anonymous principal hash. Result writes are single-use; tracking permits 24 distinct event fingerprints.
- Fail-closed: missing `ANONYMOUS_WRITE_GRANT_SECRET`, grant RPC failure, principal/resource/operation mismatch, or unavailable service-role guard blocks anonymous persistence before service-role result/log writes. Grant issuance failure returns 503 without tokens.
- Validation: `node scripts/verify-anonymous-write-grant-v2.mjs`, `node scripts/verify-analysis-rls-contract.mjs`, server JS/MJS `node --check`, and `npm run build` passed. The new verifier emitted only the existing Node module-type warning. `supabase status --output json` could not inspect local containers because the Docker daemon was unavailable, so no local RPC integration test ran. No migration apply, local/remote Supabase write, production API call, or OpenAI call was performed.
- Follow-up security work: apply the reviewed migration and verify production Supabase RPC/RLS/grant metadata plus cleanup scheduling; sessionStorage bearer-token exposure remains a documented Low risk.

### 2026-07-11 / SEC-05 anonymous write token diagnosis

- Branch: `codex/survey-input-contract-refactor`
- Task type: diagnostic / anonymous write token resource binding and replay review.
- Code changes: None. Only `docs/security/sec-05-anonymous-write-token-diagnosis-20260705.md` and this work-log entry were added/updated.
- Issuance/verification paths: `POST /api/analyze` issues `x-kbeauty-write-token`; `POST /api/results` and `POST /api/track` verify the same default `analysis-write` scope before service-role writes for unauthenticated callers.
- Findings: confirmed 5, likely 0, needs-deployment-verification 3. Highest severity: High.
- Recommendation: bind a versioned token to a server-created analysis-run grant and SEC-01 anonymous principal, then use a separate durable jti/operation consumption table with atomic claim/complete/fail, bounded retention, and fail-closed service-role RPCs. Reuse SEC-01 patterns, not its idempotency records or secret.
- Validation: relevant file inventory and static `rg` searches completed; `git diff --check` and final `git status --short` are recorded with the task result. No token issuance/replay, Supabase read/write, migration apply, external API call, or production access was performed.
- Next work: implement SEC-05 resource-bound anonymous write grants and atomic replay defense after choosing the v1 token rollout policy.

### 2026-07-11 / SEC-04 Premium release mode fail-closed

- Branch: `codex/survey-input-contract-refactor`
- Task type: execution / premium access configuration security fix.
- Changed files: `lib/premium-access.js`, premium access/session routes and client display boundaries, premium flow/security docs, verification script, and this work-log entry.
- Previous behavior: missing, empty, and unknown `PREMIUM_RELEASE_MODE` values fell back to `beta_open`.
- New behavior: explicit `coming_soon`, missing, empty, and unknown values return `premium_unavailable`; premium creation and closed-mode session writes are blocked. Explicit `beta_open` and `paid_only` retain their existing policy semantics.
- Validation: `node scripts/verify-premium-release-mode.mjs`, `node --check` for modified server JS and verifier, `npm run build`, and `git diff --check` passed. The verifier emitted only the sanitized one-time invalid-mode log. No migration, Supabase write, production request, payment action, or external API call was performed.
- Follow-up security work: SEC-05 anonymous write token resource binding/replay 방지.

### 2026-07-11 / SEC-03 Next.js dependency remediation

- Branch: `codex/survey-input-contract-refactor`
- Task type: execution / production dependency security remediation.
- Scope: `package.json`, `package-lock.json`, SEC-03 documentation, and this work-log entry only. No API, DB, migration, auth, environment, or application-code change.
- Changed packages: `next` lockfile `15.5.14` to exact manifest and lockfile `15.5.18`; nested `next > postcss` override to `8.5.10`.
- Production audit: before High 1 and Moderate 1 (total 2); after `npm audit --omit=dev --json` total 0.
- Build: `npm run build` passed on Next.js 15.5.18. `npm run lint` was not configured for non-interactive use and opened the existing ESLint setup prompt; no ESLint configuration was created. No test/typecheck script exists.
- Code changes: None. Only dependency manifest/lockfile and security documentation changed.
- Follow-up security work: SEC-02 analysis table RLS/grant deployment verification.

### 2026-07-10 / Phase 42 isolated route run readiness pack

- Branch: codex/survey-input-contract-refactor
- Task type: limited preparation + test fixture + runbook
- Routing decision: Prepare a fail-closed non-production assertion, tracked synthetic fixtures, mutation-delta contract, and Phase 43 runbook without sending `/api/analyze` or touching runtime policy, response, recommendation, UI, DB schema, or product data.
- Goal: Resolve Phase 41 preparation gaps without assuming the current hosted Supabase target is safe for a route request.
- Changed files: scripts/assert-non-production-supabase-target.mjs, scripts/prepare-isolated-shadow-route-readiness.mjs, scripts/verify-isolated-shadow-route-readiness.mjs, test/fixtures/analyze/analyze-payload.fixture.json, test/fixtures/analyze/test-face-placeholder.png, test/fixtures/analyze/README.md, docs/runbooks/isolated-shadow-route-runbook-20260710.md, docs/reviews/isolated-shadow-route-readiness-20260710.md, .codex/AI_WORK_LOG.md
- Route execution: Not run. The readiness pack performs no `/api/analyze` request or Supabase access/write.
- Target safety: The current hosted target remains fail-closed unless it is local loopback or explicitly marked as both disposable and non-production. No env/secret values are printed.
- Mutation contract: Existing route guard/session/premium writes are baseline observations. Only the separately observed shadow-added Supabase mutation delta must be 0; Phase 42 documents this but does not implement the live observer harness.
- Runtime isolation: Evaluator/CandidatePolicy, API response, recommendation outputs, UI, DB schema, and product data were not changed. Phase 43 may attempt route execution only after an approved disposable target, cleanup contract, and mutation observer are available.

### 2026-07-10 / Phase 41 isolated local flag-on shadow dry-run

- Branch: codex/survey-input-contract-refactor
- Task type: limited execution + shadow verification
- Routing decision: Execute `/api/analyze` only if non-production isolation, disposability/cleanup, safe repo fixtures, identical-input replay, and existing-vs-shadow mutation delta instrumentation are all verified. Otherwise fail closed without a request.
- Goal: Compare flag-off and development flag-on route behavior in an isolated environment, while keeping evaluator/CandidatePolicy runtime, API response, recommendation outputs, DB schema, product data, and production activation unchanged.
- Changed files: scripts/run-first-isolated-shadow-route-check.mjs, scripts/verify-first-isolated-shadow-route-check.mjs, docs/reviews/first-isolated-shadow-route-check-20260710.md, .codex/AI_WORK_LOG.md
- Environment result: The configured Supabase endpoint is remote rather than loopback, with no explicit non-production marker, local Supabase config, disposable cleanup contract, safe repo image/payload fixture, or existing-vs-shadow mutation delta instrumentation verified. No env or secret values were printed.
- Route execution: Not run. Status and skip reason are `isolated_route_run_not_executed_environment_unverified`.
- Evidence handling: Flag-off/flag-on snapshots, artifact deltas, response/recommendation comparisons, existing route mutation count, shadow-added mutation delta, and safety violation counts remain null rather than being inferred from Phase 40 helper evidence.
- Runtime isolation: `/api/analyze`, helper/writer, evaluator, CandidatePolicy, response payload, recommendation outputs, DB/Supabase schema, and product data were not modified. No Supabase write was executed.
- Context promotion candidate: A future isolated route run requires an explicitly disposable non-production Supabase, cleanup/rollback contract, safe tracked fixtures, and separate baseline/flag-on mutation delta instrumentation before any request is sent.

### 2026-07-10 / Phase 40 flag invariance and verifier integrity preflight

- Branch: codex/survey-input-contract-refactor
- Task type: limited verification + shadow/audit
- Routing decision: Verify Phase 39 flag-off/flag-on helper invariance and static verifier integrity without changing the route, writer, evaluator, CandidatePolicy, API response, recommendation outputs, UI, DB/Supabase, product data, or production configuration.
- Goal: Prove disabled flag cases create no artifact or helper/writer attempt, prove isolated development flag-on helper/writer behavior preserves response/recommendation inputs and adds zero DB mutation calls, and test the static guard against intentionally corrupted in-memory source variants.
- Changed files: scripts/review-shadow-flag-invariance-preflight.mjs, scripts/verify-shadow-flag-invariance-preflight.mjs, scripts/verify-shadow-verifier-integrity.mjs, scripts/verify-shadow-dry-run-route-static-guard.mjs, docs/reviews/shadow-flag-invariance-preflight-20260710.md, .codex/AI_WORK_LOG.md
- Flag invariance: Missing env, `0`, `false`, empty, production `1`, and non-exact development `true` samples were disabled with zero artifact delta. Only development plus exact `1` enabled the isolated writer sample.
- Mutation boundary: The existing route guard/session mutation path was not executed. Phase 40 measured the shadow-added mutation delta for the isolated helper/writer path as 0 and did not claim total route writes are 0.
- Verifier integrity: The route static guard was hardened into an importable pure source validator. Ten in-memory negative controls covering production/flag guards, import placement, response/recommendation/store mutation, Supabase mutation calls, output path escape, forbidden fields, and error propagation were all rejected without modifying source files.
- Actual route execution: Not run. Skip reason is `actual_route_execution_not_run_unsafe_or_unverified_environment` because disposable non-production DB isolation, mutation-delta instrumentation, safe fixture, and rollback were not verified.
- Result: `preflightStatus=ready_for_isolated_local_flag_on_run`; this is not a completed flag-on route run and does not approve evaluator/CandidatePolicy runtime connection.
- Context promotion candidate: A future Phase 41 local route run should require explicit evidence of disposable non-production DB isolation, baseline/flag-on mutation delta measurement, safe fixtures, and cleanup/rollback before any request is sent.

### 2026-07-10 / Phase 39 first disabled shadow dry-run minimal patch

- Branch: codex/survey-input-contract-refactor
- Task type: limited implementation + shadow/audit
- Routing decision: High-risk API route touch with explicit user approval, strictly limited to a disabled-by-default development-only shadow call site and a local artifact writer. Evaluator/CandidatePolicy runtime behavior, API response shape, recommendation outputs, DB/Supabase, product data, capture fixtures, UI, and production activation remained out of scope.
- Goal: Apply the Phase 38 minimal patch plan so the existing response and recommendation can be read through sanitized snapshots only when `NODE_ENV` is development and the explicit Phase 39 flag is enabled.
- Changed files: app/api/analyze/route.js, lib/shadow-boundary-dry-run-artifact-writer.js, scripts/verify-shadow-dry-run-route-static-guard.mjs, scripts/verify-first-disabled-shadow-dry-run-minimal-patch.mjs, docs/reviews/first-disabled-shadow-dry-run-minimal-patch-20260709.md, .codex/AI_WORK_LOG.md, and related Phase 24-38 verifier guard compatibility scripts.
- Runtime isolation: The flag defaults off and the route returns before dynamic imports unless both development mode and the explicit flag are present. The helper result is not merged into the public response, recommendation result, premium session payload, guard payload, or DB/store payload.
- Artifact safety: The writer is limited to local `tmp/shadow-boundary-dry-run/`, validates the existing artifact schema and forbidden-field rules before writing, has no Supabase/DB/Storage mutation client, and returns a non-blocking safe summary on write failure.
- Evidence separation: Phase 39 used static checks and sanitized contract samples only. `/api/analyze` was not invoked, no actual response/recommendation evidence was created, and no Supabase write was executed.
- Validation: `node scripts/verify-shadow-dry-run-route-static-guard.mjs` and `node scripts/verify-first-disabled-shadow-dry-run-minimal-patch.mjs` passed before the full required verifier/build/diff suite. Final suite results are recorded in the turn completion report.
- Error log: The first full regression run failed in eight Phase 31-38 verifiers, and the Phase 24-29 follow-up run exposed the same stale assumption in six more checks: those historical verifiers treated any uncommitted `app/api/analyze/route.js` change as forbidden. Phase 39 explicitly authorizes one guarded route change, so the affected review/verifier checks were minimally updated to permit that file only after `verify-shadow-dry-run-route-static-guard.mjs` passes. Evaluator, CandidatePolicy, UI/data, product data, and Supabase protections remain unchanged.
- Findings: Response mutation, recommendation mutation, and DB/Supabase write patterns were not detected. A forbidden-field sample was rejected before write, development flag-off and production samples were disabled, and a simulated filesystem failure returned `artifact_write_failed_non_blocking` without throwing.
- Context promotion candidate: Keep Phase 39 wiring development-only and default-off. Phase 40 should require separate approval for any actual local route dry-run; evaluator/CandidatePolicy runtime connection, public response changes, recommendation changes, DB writes, and production activation remain prohibited.

### 2026-07-10 / Phase 38 first disabled shadow dry-run implementation patch plan

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium future patch plan
- Routing decision: User requested a first disabled shadow dry-run implementation patch plan after Phase 37. Runtime evaluator changes, CandidatePolicy runtime wiring, `/api/analyze` route changes or invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, synthetic samples recorded as actual evidence, and recommendation output changes were out of scope.
- Goal: Read Phase 33-37 dry-run, checklist, helper, snapshot, and static guard artifacts, then freeze the minimal future patch scope, feature flag contract, route insertion blueprint, snapshot sequence, artifact writer plan, verifier chain, kill criteria, and rollback plan before any Phase 39 patch.
- Changed files: scripts/review-first-disabled-shadow-dry-run-patch-plan.mjs, scripts/verify-first-disabled-shadow-dry-run-patch-plan.mjs, docs/architecture/first-disabled-shadow-dry-run-patch-plan.md, docs/reviews/first-disabled-shadow-dry-run-patch-plan-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The patch plan did not call `/api/analyze`.
- Validation: `node scripts/review-first-disabled-shadow-dry-run-patch-plan.mjs`, `node scripts/verify-first-disabled-shadow-dry-run-patch-plan.mjs`, required Phase 37/36/35/34/33/32/31/30/29/28/27/26/25/exposure/shadow/ranking/goal/survey verifier set, `npm run build`, and `git diff --check` are recorded in the turn completion report.
- Findings: Phase 38 fixed the future patch scope only. The recommended future insertion remains `route_outside_helper_dev_only_artifact_writer`; the preferred future flag is `DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN`; future artifact writing must be dev-only, local `tmp` only, schema-validated, forbidden-field-scanned, and non-blocking. Runtime connection remains unapproved.
- Context promotion candidate: Phase 39 may proceed only with separate approval as a first disabled shadow dry-run minimal patch. Evaluator/CandidatePolicy runtime connection, API response changes, recommendation result changes, DB/Supabase changes, and production activation remain prohibited.

### 2026-07-10 / Phase 37 first disabled shadow dry-run plan

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium preflight and runbook plan
- Routing decision: User requested a first disabled shadow dry-run plan after Phase 36. Runtime evaluator changes, CandidatePolicy runtime wiring, `/api/analyze` route changes or invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, synthetic samples recorded as actual evidence, and recommendation output changes were out of scope.
- Goal: Read Phase 30-36 checklist, dry-run, verifier, snapshot, route guard, and helper artifacts, then freeze the preflight checklist, first dry-run runbook, snapshot requirements, kill criteria, and rollback plan before any first disabled shadow dry-run implementation patch plan.
- Changed files: scripts/review-first-disabled-shadow-dry-run-plan.mjs, scripts/verify-first-disabled-shadow-dry-run-plan.mjs, docs/architecture/first-disabled-shadow-dry-run-plan.md, docs/reviews/first-disabled-shadow-dry-run-plan-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The plan did not call `/api/analyze`.
- Error log: Initial `node scripts/review-first-disabled-shadow-dry-run-plan.mjs` execution failed with `ReferenceError: documentsPresent is not defined` because the local variable was named `docsPresent`. Fixed the script to emit `documentsPresent: docsPresent` in `sourceReadiness`.
- Validation: `node scripts/review-first-disabled-shadow-dry-run-plan.mjs`, `node scripts/verify-first-disabled-shadow-dry-run-plan.mjs`, required Phase 36/35/34/33/32/31/30/29/28/27/26/25/exposure/shadow/ranking/goal/survey verifier set, `npm run build`, and `git diff --check` are recorded in the turn completion report.
- Findings: Phase 37 fixed preflight, runbook, snapshot, kill, and rollback criteria only. Runtime connection remains unapproved. Phase 38 may proceed only as a first disabled shadow dry-run implementation patch plan, minimal route insertion proposal, artifact writer skeleton proposal, flag guard implementation plan, or dry-run snapshot verifier refinement.
- Context promotion candidate: Phase 38 should remain plan/proposal only unless a separate approved task explicitly allows a route patch. `/api/analyze` route changes and evaluator/CandidatePolicy runtime connection still require separate approval.

### 2026-07-10 / Phase 36 final pre-runtime integration checklist

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium final checklist artifact
- Routing decision: User requested a final pre-runtime integration checklist after Phase 35. Runtime evaluator changes, CandidatePolicy runtime wiring, `/api/analyze` route changes or invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, synthetic samples recorded as actual evidence, and recommendation output changes were out of scope.
- Goal: Read Phase 26-35 readiness, contract, verifier, route guard, and helper artifacts, then freeze final conditions before a first disabled shadow dry-run plan can be written.
- Changed files: scripts/review-final-pre-runtime-integration-checklist.mjs, scripts/verify-final-pre-runtime-integration-checklist.mjs, docs/architecture/final-pre-runtime-integration-checklist.md, docs/reviews/final-pre-runtime-integration-checklist-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The checklist did not call `/api/analyze`.
- Validation: `node scripts/review-final-pre-runtime-integration-checklist.mjs`, `node scripts/verify-final-pre-runtime-integration-checklist.mjs`, required Phase 35/34/33/32/31/30/29/28/27/26/25/exposure/shadow/ranking/goal/survey verifier set, `npm run build`, and `git diff --check` are recorded in the turn completion report.
- Findings: Checklist status is `ready_for_first_disabled_shadow_dry_run_plan`, meaning Phase 37 may write a first disabled shadow dry-run plan only. Policy readiness, contract readiness, safety verifier readiness, route isolation readiness, and artifact safety readiness are all satisfied in current artifacts. Runtime connection remains unapproved.
- Context promotion candidate: Phase 37 may proceed only as first disabled shadow dry-run plan, disabled shadow dry-run preflight plan, or route-disconnected artifact writer skeleton design. `/api/analyze` route changes and evaluator/CandidatePolicy runtime connection still require a separate approved task.

### 2026-07-10 / Phase 35 disabled-by-default shadow boundary dry-run helper skeleton

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium route-disconnected helper skeleton
- Routing decision: User requested a disabled-by-default shadow boundary dry-run helper skeleton after Phase 34 snapshot contract and static route insertion guard. Runtime evaluator changes, CandidatePolicy runtime wiring, `/api/analyze` route changes or invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, synthetic samples recorded as actual evidence, and recommendation output changes were out of scope.
- Goal: Add a route-disconnected helper skeleton that validates snapshot inputs, returns sanitized artifact payloads, summarizes kill conditions, and remains disabled by default without writing artifacts.
- Changed files: lib/shadow-boundary-dry-run-helper.js, scripts/verify-shadow-boundary-dry-run-helper.mjs, scripts/review-shadow-boundary-dry-run-helper-skeleton.mjs, docs/architecture/shadow-boundary-dry-run-helper.md, docs/reviews/shadow-boundary-dry-run-helper-skeleton-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The helper and review did not call `/api/analyze`.
- Validation: `node scripts/verify-shadow-boundary-dry-run-helper.mjs`, `node scripts/review-shadow-boundary-dry-run-helper-skeleton.mjs`, required Phase 34/33/32/31/30/29/28/27/26/25/exposure/shadow/ranking/goal/survey verifier set, `npm run build`, and `git diff --check` are recorded in the turn completion report.
- Findings: The helper defaults to disabled, returns enabled only for explicit non-production future flag samples, validates Phase 34 snapshots, returns sanitized payloads without writing artifacts, and marks blocked kill conditions for recommendation changes, high-risk collapsed receiver counts, metadata-incomplete collapsed receiver counts, and DB writes. Helper output stays route-disconnected and schema-compatible when adapted to the Phase 31 schema-test evidence type.
- Context promotion candidate: Phase 36 may proceed only as final pre-runtime integration checklist, artifact writer skeleton design, or snapshot-contract-backed verifier refinement. `/api/analyze` route changes and evaluator/CandidatePolicy runtime connection still require a separate approved task.

### 2026-07-10 / Phase 34 dry-run snapshot contract helper and static route insertion guard

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium pure helper and static guard review
- Routing decision: User requested a dry-run snapshot contract helper and static route insertion guard review after Phase 33. Runtime evaluator changes, CandidatePolicy runtime wiring, `/api/analyze` route changes or invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, synthetic samples recorded as actual evidence, and recommendation output changes were out of scope.
- Goal: Add a runtime-disconnected snapshot contract helper, verify sanitized snapshot behavior, statically review future route insertion points, and document guardrails for a future `route_outside_helper_dev_only_artifact_writer` approach.
- Changed files: lib/shadow-dry-run-snapshot-contract.js, scripts/review-shadow-route-insertion-static-guard.mjs, scripts/verify-shadow-dry-run-snapshot-contract.mjs, scripts/verify-shadow-route-insertion-static-guard.mjs, docs/architecture/shadow-dry-run-snapshot-contract.md, docs/reviews/shadow-route-insertion-static-guard-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The review did not call `/api/analyze`.
- Validation: `node scripts/verify-shadow-dry-run-snapshot-contract.mjs`, `node scripts/review-shadow-route-insertion-static-guard.mjs`, `node scripts/verify-shadow-route-insertion-static-guard.mjs`, required Phase 33/32/31/30/29/28/27/26/25/exposure/shadow/ranking/goal/survey verifier set, `npm run build`, and `git diff --check` are recorded in the turn completion report.
- Findings: The snapshot helper builds sanitized baseline response shape, baseline recommendation, shadow boundary hint, shadow receiver, and comparison snapshots without full API body, product display fields, raw form, image/base64, PII, or env/secret values. Static review again recommends `route_outside_helper_dev_only_artifact_writer`, with required guardrails to keep helper output out of response, recommendation, persistence, and CandidatePolicy/evaluator runtime paths.
- Context promotion candidate: Phase 35 may proceed only as disabled-by-default dry-run helper implementation skeleton, snapshot-contract-backed verifier refinement, or final pre-runtime integration checklist. `/api/analyze` route changes and evaluator/CandidatePolicy runtime connection still require a separate approved task.

### 2026-07-10 / Phase 33 disabled-by-default shadow dry-run implementation plan

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium implementation plan artifact
- Routing decision: User requested a disabled-by-default shadow dry-run implementation plan after Phase 32 safety verifier skeletons. Runtime evaluator changes, CandidatePolicy runtime wiring, `/api/analyze` route changes or invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, synthetic samples recorded as actual evidence, and recommendation output changes were out of scope.
- Goal: Add a read-only implementation plan review script, verifier, architecture doc, and review doc for future dry-run flag/snapshot/artifact/verifier/kill-switch planning.
- Changed files: scripts/review-shadow-dry-run-implementation-plan.mjs, scripts/verify-shadow-dry-run-implementation-plan.mjs, docs/architecture/shadow-dry-run-implementation-plan.md, docs/reviews/shadow-dry-run-implementation-plan-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The plan did not call `/api/analyze`.
- Validation: `node scripts/review-shadow-dry-run-implementation-plan.mjs`, `node scripts/verify-shadow-dry-run-implementation-plan.mjs`, required Phase 32/31/30/29/28/27/26/25/exposure/shadow/ranking/goal/survey verifier set, `npm run build`, and `git diff --check` are recorded in the turn completion report.
- Findings: The recommended insertion point is a route-outside pure helper with a dev-only local artifact writer, behind `SHADOW_RUNTIME_BOUNDARY_DRY_RUN` or equivalent disabled-by-default flag. The plan requires baseline response shape, baseline recommendation, shadow boundary hint, shadow receiver, and comparison snapshots; local tmp-only artifact writing; verifier chain enforcement; and immediate blocked status on high-risk, metadata incomplete, strong caution, response diff, recommendation diff, DB write, or forbidden artifact field violations.
- Context promotion candidate: Phase 34 may proceed only as dry-run snapshot contract helper design, future flag contract documentation, snapshot-schema-backed verifier refinement, or static route insertion guard review. Runtime evaluator/CandidatePolicy connection and `/api/analyze` route changes still require a separate approved task.

### 2026-07-10 / Phase 32 shadow safety verifier skeletons

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium verifier skeleton contracts
- Routing decision: User requested no-response-change, no-recommendation-change, and no-DB-write verifier skeletons after Phase 31 schema and required contract tests. Runtime evaluator changes, CandidatePolicy runtime wiring, `/api/analyze` invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, synthetic samples recorded as actual evidence, and recommendation output changes were out of scope.
- Goal: Add three safety verifier skeletons, an integrated verifier, and docs while keeping synthetic skeleton samples separate from actual response, recommendation, and DB evidence.
- Changed files: scripts/verify-shadow-no-response-change-skeleton.mjs, scripts/verify-shadow-no-recommendation-change-skeleton.mjs, scripts/verify-shadow-no-db-write-skeleton.mjs, scripts/verify-shadow-safety-verifier-skeletons.mjs, docs/architecture/shadow-safety-verifier-skeletons.md, docs/reviews/shadow-safety-verifier-skeletons-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The skeletons did not call `/api/analyze`.
- Validation: `node scripts/verify-shadow-no-response-change-skeleton.mjs`, `node scripts/verify-shadow-no-recommendation-change-skeleton.mjs`, `node scripts/verify-shadow-no-db-write-skeleton.mjs`, `node scripts/verify-shadow-safety-verifier-skeletons.mjs`, required Phase 31/30/29/28/27/26/25/exposure/shadow/ranking/goal/survey verifier set, and `npm run build` are recorded in the turn completion report.
- Findings: The response skeleton rejects API response body dumps and forbidden artifact fields. The recommendation skeleton treats topPick/supportingProducts/budgetAlternatives identity or order changes as failures. The DB-write skeleton requires all write counters to remain zero and keeps guard/session mutation tracking separate from shadow dry-run mutation. All skeleton artifacts record `runtimeConnected=false`, `routeInvoked=false`, `supabaseWriteExecuted=false`, `runtimeMutation=false`, and `syntheticTreatedAsActualEvidence=false`.
- Context promotion candidate: Phase 33 may proceed only as disabled-by-default shadow dry-run implementation planning or dry-run snapshot contract design. Runtime evaluator/CandidatePolicy connection still requires a separate approved task after those snapshot contracts and verifiers exist.

### 2026-07-10 / Phase 31 required contract test skeleton and dry-run artifact schema

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium pure helper schema and contract test skeleton
- Routing decision: User requested runtime-disconnected required contract test skeletons and a dry-run artifact schema after Phase 30. Runtime evaluator changes, CandidatePolicy runtime wiring, `/api/analyze` invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, synthetic fixtures recorded as actual evidence, and recommendation output changes were out of scope.
- Goal: Add a pure shadow dry-run artifact schema helper, required contract test skeleton runner, verifiers, and docs while keeping synthetic contract cases separate from actual evidence.
- Changed files: lib/shadow-runtime-dry-run-artifact-schema.js, scripts/run-evaluator-boundary-required-contract-tests.mjs, scripts/verify-evaluator-boundary-required-contract-tests.mjs, scripts/verify-shadow-runtime-dry-run-artifact-schema.mjs, docs/architecture/shadow-runtime-dry-run-artifact-schema.md, docs/reviews/evaluator-boundary-required-contract-tests-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The runner did not call `/api/analyze`.
- Validation: `node scripts/run-evaluator-boundary-required-contract-tests.mjs`, `node scripts/verify-evaluator-boundary-required-contract-tests.mjs`, `node scripts/verify-shadow-runtime-dry-run-artifact-schema.mjs`, required Phase 30/29/28/27/26/25/actual coverage/boundary shadow/exposure/shadow/ranking/goal/survey verifier set, and `npm run build` passed. `git diff --check` is recorded in the turn completion report.
- Findings: All 10 required contract test skeletons passed with `syntheticContractCasesUsed=true` and `syntheticTreatedAsActualEvidence=false`. The schema helper requires baseline/shadow separation, evidence separation, no API response body dump, no recommendation result changes, no DB writes, no high-risk or metadata-incomplete collapsed receiver counts, and forbidden artifact field rejection.
- Context promotion candidate: Phase 32 may proceed only as no-response-change, no-recommendation-change, or no-DB-write verifier skeleton/design. Runtime evaluator/CandidatePolicy connection still requires a separate approved task after those verifier gates exist and pass.

### 2026-07-10 / Phase 30 shadow runtime dry-run design and required contract test plan

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium dry-run plan and contract test checklist
- Routing decision: User requested design-only shadow runtime dry-run planning after Phase 29 returned `ready_for_runtime_integration_plan`. Runtime evaluator changes, CandidatePolicy runtime wiring, `/api/analyze` invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, and recommendation output changes were out of scope.
- Goal: Read Phase 29 acceptance and Phase 27-28 what-if artifacts, define disabled-by-default dry-run gates, baseline-vs-shadow comparison requirements, kill conditions, required contract tests, and Phase 31 allowed/prohibited scope.
- Changed files: scripts/review-shadow-runtime-dry-run-plan.mjs, scripts/verify-shadow-runtime-dry-run-plan.mjs, docs/architecture/shadow-runtime-dry-run-design.md, docs/architecture/evaluator-boundary-required-contract-tests.md, docs/reviews/shadow-runtime-dry-run-plan-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The review did not call `/api/analyze`.
- Validation: `node scripts/review-shadow-runtime-dry-run-plan.mjs`, `node scripts/verify-shadow-runtime-dry-run-plan.mjs`, required Phase 29/28/27/26/25/actual coverage/boundary shadow/exposure/shadow/ranking/goal/survey verifier set, and `npm run build` passed. `git diff --check` is recorded in the turn completion report.
- Findings: The dry-run plan is disabled by default, requires an explicit future flag, records only sanitized observations, keeps baseline and shadow sections separate, and blocks expansion on high-risk/sensitivity-unsafe/strong-caution/metadata-incomplete collapsed receiver counts, response shape changes, recommendation result changes, DB writes, production flag failures, or forbidden artifact fields. Required contract tests now include metadata incomplete, strong caution, active-only, high-risk/sensitivity unsafe, serum category, evidence separation, API response shape, recommendation result, DB write, and artifact sanitization tests.
- Context promotion candidate: Phase 31 may proceed only as contract test skeleton/pure helper unit test design or dry-run schema/verifier design. Runtime evaluator/CandidatePolicy connection still requires a separate approved task after those gates are implemented and pass.

### 2026-07-09 / Phase 29 runtime integration acceptance criteria

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium acceptance criteria and gate checklist
- Routing decision: User requested design-only runtime integration acceptance criteria after Phase 16-28 boundary, collapsed hint, and CandidatePolicy receiver evidence. Runtime evaluator changes, CandidatePolicy runtime wiring, `/api/analyze` invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, and recommendation output changes were out of scope.
- Goal: Read Phase 26-28 artifacts, keep actual capture, pure replay, and synthetic coverage evidence separate, and freeze gate criteria for when a future runtime integration plan may be considered.
- Changed files: scripts/review-runtime-integration-acceptance-criteria.mjs, scripts/verify-runtime-integration-acceptance-criteria.mjs, docs/architecture/runtime-integration-acceptance-criteria.md, docs/reviews/runtime-integration-acceptance-review-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The acceptance review did not call `/api/analyze`.
- Validation: `node scripts/review-runtime-integration-acceptance-criteria.mjs` and `node scripts/verify-runtime-integration-acceptance-criteria.mjs` passed. Required Phase 28/27/26/25/actual coverage/boundary shadow/exposure/shadow/ranking/goal/survey verifier set, `npm run build`, and `git diff --check` are recorded in the turn completion report.
- Findings: Acceptance status is `ready_for_runtime_integration_plan`, meaning Phase 30 may design a runtime integration plan or shadow runtime dry-run only. Gate A/B/C/D/H passed; Gate E/F/G are conditional required contract tests because metadata-incomplete, strong-caution, and active-only remain unobserved in actual and pure replay evidence. High-risk collapsed hint and receiver counts remain 0, low-risk consistency remains actual 50/50 and pure replay 150/150, and evidence types remain separated.
- Context promotion candidate: Phase 30 may proceed only as runtime integration plan design or shadow runtime dry-run design. Runtime evaluator/CandidatePolicy connection still requires a separate approved task after required contract tests and dry-run gates are defined.

### 2026-07-09 / Phase 28 CandidatePolicy hint receiver design

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium CandidatePolicy receiver contract and what-if review
- Routing decision: User requested design-only CandidatePolicy hint receiver work after Phase 27 evaluator pass plus collapsed hint design. Runtime CandidatePolicy wiring, evaluator runtime changes, score/weight/hard-filter changes, `/api/analyze` invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, and recommendation output changes were out of scope.
- Goal: Add a pure CandidatePolicy hint receiver contract, apply it to the Phase 27 integration what-if artifact, and document how future CandidatePolicy logic should interpret `collapsed_candidate_hint`, `hidden_candidate_hint`, and `insufficient_evidence_hint`.
- Changed files: lib/candidate-policy-hint-receiver-contract.js, scripts/run-candidate-policy-hint-receiver-whatif.mjs, scripts/verify-candidate-policy-hint-receiver-design.mjs, docs/architecture/candidate-policy-hint-receiver.md, docs/reviews/candidate-policy-hint-receiver-whatif-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The what-if runner did not call `/api/analyze`.
- Validation: `node scripts/run-candidate-policy-hint-receiver-whatif.mjs`, `node scripts/verify-candidate-policy-hint-receiver-design.mjs`, Phase 27/26/25/actual coverage/boundary shadow/exposure/shadow/ranking/goal/survey verifier set, `npm run build`, and `git diff --check` passed. `git diff --check` only reported existing LF-to-CRLF warnings for two review docs.
- Findings: Actual receiver what-if accepts 52/52 collapsed hints, preserves 33 hidden hints, moves hidden -52 and collapsed +52, and has 0 high-risk collapsed receiver violations. Pure replay receiver what-if accepts 156/156 collapsed hints, preserves 99 hidden hints, moves hidden -156 and collapsed +156, accepts 39 serum-family collapsed hints, and has 0 high-risk collapsed receiver violations. Actual capture, pure replay, and synthetic coverage evidence remain separated.
- Context promotion candidate: Phase 29 may design shadow-only receiver test coverage or runtime integration acceptance criteria. CandidatePolicy/evaluator runtime connection still requires a separate approved task.

### 2026-07-09 / Phase 27 evaluator pass plus collapsed hint integration design

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit design / Medium integration contract and what-if review
- Routing decision: User requested design-only evaluator pass plus collapsed hint integration and what-if shadow calculation after Phase 26 readiness. Runtime evaluator changes, CandidatePolicy runtime wiring, `/api/analyze` invocation, UI/API response changes, DB/Supabase writes or schema changes, product data edits, capture fixture source edits, and recommendation output changes were out of scope.
- Goal: Add a pure collapsed hint contract helper, compare integration options, and calculate actual vs pure replay what-if effects without connecting runtime paths.
- Changed files: lib/evaluator-boundary-collapsed-hint-contract.js, scripts/run-evaluator-boundary-integration-whatif.mjs, scripts/verify-evaluator-boundary-integration-design.mjs, docs/architecture/evaluator-boundary-collapsed-hint-integration.md, docs/reviews/evaluator-boundary-integration-whatif-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The what-if runner did not call `/api/analyze`.
- Validation: `node scripts/run-evaluator-boundary-integration-whatif.mjs` and `node scripts/verify-evaluator-boundary-integration-design.mjs` passed. The what-if artifact records `evidenceType=integration_whatif_shadow`, `runtimeConnected=false`, `routeInvoked=false`, `supabaseWriteExecuted=false`, and `runtimeMutation=false`.
- Findings: Recommended option is Option B, evaluator pass plus collapsed hint. Actual what-if moves 52 rows from hidden to collapsed, including 50/50 safe-low-risk hidden rows, with 0 high-risk collapsed hints. Pure replay what-if moves 156 rows from hidden to collapsed, including 150/150 safe-low-risk hidden rows and 39 serum-family collapsed hints, with 0 high-risk collapsed hints. Actual capture, pure replay, and synthetic coverage evidence remain separated.
- Context promotion candidate: Phase 28 may design CandidatePolicy hint receiver or expand shadow coverage, but runtime evaluator/CandidatePolicy integration still requires a separate approved task.

### 2026-07-09 / Phase 26 boundary replay readiness review

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit diagnostic / Medium readiness review
- Routing decision: User requested a read-only readiness review across Phase 16-25 evidence for the `recent_instability_active_limited` boundary. Runtime changes, evaluator pass implementation, collapsed hint implementation, CandidatePolicy wiring, `/api/analyze` invocation, UI/API response changes, DB/Supabase writes, product data edits, capture fixture source edits, and synthetic product creation were out of scope.
- Goal: Separate actual complete/product_row capture evidence, pure engine replay evidence, and synthetic policy coverage, then decide whether the boundary can move to design-only Phase 27 work.
- Changed files: scripts/review-evaluator-boundary-readiness.mjs, scripts/verify-evaluator-boundary-readiness-review.mjs, docs/reviews/evaluator-boundary-readiness-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator hard-filter/score/weight, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The review did not call `/api/analyze`.
- Validation: `node scripts/review-evaluator-boundary-readiness.mjs` and `node scripts/verify-evaluator-boundary-readiness-review.mjs` passed. The readiness artifact records actual capture and pure replay evidence separately, keeps synthetic coverage out of actual evidence, and reports `routeInvoked=false`, `supabaseWriteExecuted=false`, and `runtimeMutation=false`.
- Findings: Readiness status is `ready_for_boundary_integration_design`. Actual evidence has 10 complete/product_row captures, 1,640 candidate rows, 86 boundary-applicable rows, 50 safe-low-risk hidden rows, 50/50 collapsed, and 0 high-risk collapsed rows. Pure replay evidence has `evidenceType=pure_engine_replay`, 164 product rows, 164 scorer-compatible rows, 656 candidate rows, 258 boundary-applicable rows, 150 safe-low-risk hidden rows, 150/150 collapsed, and 0 high-risk collapsed rows. Serum-family rows were observed in pure replay; active-leaning-only, metadata-incomplete, and strong-caution rows remain unobserved in actual and pure replay evidence.
- Context promotion candidate: Phase 27 may proceed only as design/what-if shadow work for evaluator pass plus collapsed hint and CandidatePolicy hint contract. Runtime evaluator/CandidatePolicy integration still requires a separate approved task.

### 2026-07-09 / Phase 25 pure engine replay with read-only product source

- Branch: codex/survey-input-contract-refactor
- Task type: shadow/audit diagnostic / Medium pure engine replay evidence expansion
- Routing decision: User requested rerunning Phase 22 pure engine replay using the Phase 24 read-only Supabase product source. Runtime changes, `/api/analyze` invocation, evaluator hard-filter/score/weight changes, CandidatePolicy wiring, UI/API response changes, DB/Supabase writes, product data edits, capture fixture source edits, synthetic products, and actual capture mixing were out of scope.
- Goal: Safely load `.env.local` without printing values, use `getRecommendationProducts()` as the read-only scorer-compatible product source, and rerun the four Phase 19 target scenarios as `pure_engine_replay` evidence only.
- Changed files: scripts/run-pure-engine-target-scenario-replay.mjs, scripts/verify-pure-engine-target-scenario-replay.mjs, scripts/verify-pure-engine-replay-readonly-source.mjs, docs/reviews/evaluator-boundary-pure-engine-readonly-replay-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, topPick/supportingProducts/budgetAlternatives runtime, or recommendation output change. The runner does not call `/api/analyze`.
- Validation: `node scripts/run-pure-engine-target-scenario-replay.mjs`, `node scripts/verify-pure-engine-target-scenario-replay.mjs`, and `node scripts/verify-pure-engine-replay-readonly-source.mjs` passed. The replay artifact records `routeInvoked=false`, `apiAnalyzeInvoked=false`, `supabaseWriteExecuted=false`, `runtimeMutation=false`, `envValuesPrinted=false`, `productSource=getRecommendationProducts_read_only`, and `syntheticProductsUsed=false`. Node emitted existing direct-ESM `--experimental-loader` and `MODULE_TYPELESS_PACKAGE_JSON` warnings.
- Findings: Read-only source loaded 164 product rows and 164 scorer-compatible rows. All four target scenarios succeeded with 164 candidate rows each, 656 total candidate rows, and 258 boundary-applicable rows. `safeLowRiskHidden` was observed with 150 rows, all `downgrade_to_collapsed_candidate`; `serumCategory` was observed with 168 rows and 66 boundary-applicable rows; `activeLeaningOnly`, `metadataIncomplete`, and `strongCaution` remained not observed. `highRiskCollapsedCount` stayed 0.
- Context promotion candidate: Phase 25 replay evidence can inform the next boundary review, but it remains pure replay evidence and must not be counted as actual complete/product_row capture evidence. Runtime evaluator/CandidatePolicy integration still requires a separate approved task.

### 2026-07-09 / Phase 24 product source config trace and read-only availability

- Branch: codex/survey-input-contract-refactor
- Task type: diagnostic / Medium product source missing_config trace
- Routing decision: User requested diagnosis of why Phase 23 `getRecommendationProducts()` returned `missing_config`, plus read-only availability checking. Runtime changes, `/api/analyze` invocation, evaluator changes, CandidatePolicy wiring, UI/API response changes, DB/Supabase writes, product data edits, capture fixture source edits, synthetic products, and Phase 25 replay execution were out of scope.
- Goal: Trace the product source config path, identify required env key names without printing values, compare route vs direct script product loading, and verify whether current checkout can load read-only scorer-compatible product rows.
- Changed files: scripts/trace-product-source-config.mjs, scripts/verify-product-source-config-trace.mjs, docs/reviews/product-source-config-trace-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, or recommendation output change. The Phase 24 runner does not call `/api/analyze`.
- Validation: `node scripts/trace-product-source-config.mjs` passed and wrote trace artifacts with `routeInvoked=false`, `apiAnalyzeInvoked=false`, `supabaseWriteExecuted=false`, `runtimeMutation=false`, and `syntheticProductsUsed=false`. `node scripts/verify-product-source-config-trace.mjs` passed after narrowing a false-positive secret-leak verifier pattern that matched the allowed key name `SUPABASE_SERVICE_ROLE_KEY`. Node emitted existing direct-ESM `--experimental-loader` and `MODULE_TYPELESS_PACKAGE_JSON` warnings.
- Findings: `getSupabaseConfig()` needs one URL key (`SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`) and one anon key (`SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Product read-only source does not require service role. `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` key names, but direct Node Phase 23 did not load `.env.local`, causing `phase23_direct_node_process_env_missing_product_source_config`. Loading `.env.local` values without printing them made the read-only source available: 164 rows read, 164 scorer-compatible, service role not required.
- Context promotion candidate: Phase 25 can rerun pure engine replay using the existing read-only `getRecommendationProducts()` source if the direct Node runner safely loads the URL/anon key env file without printing values. Continue to keep replay evidence separate from actual `/api/analyze` captures.

### 2026-07-09 / Phase 23 read-only scorer-compatible product source extraction

- Branch: codex/survey-input-contract-refactor
- Task type: diagnostic / Medium read-only product source boundary inspection
- Routing decision: User requested investigation of the legacy decision engine scorer product-row contract and whether an existing read-only product source can provide scorer-compatible rows. Runtime changes, `/api/analyze` invocation, evaluator changes, CandidatePolicy wiring, UI/API response changes, DB/Supabase writes, product data edits, synthetic products, and mixing actual capture with replay evidence were out of scope.
- Goal: Identify current scorer-compatible product row requirements and add a no-write verifier for `getRecommendationProducts()` source extraction.
- Changed files: scripts/inspect-read-only-scorer-compatible-product-source.mjs, scripts/verify-read-only-scorer-compatible-product-source.mjs, docs/reviews/read-only-scorer-compatible-product-source-20260709.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, evaluator, CandidatePolicy runtime, UI, DB/schema/migration/policy, Supabase write, product data, actual capture fixture, or recommendation output change. The Phase 23 runner does not call `/api/analyze`.
- Validation: `node scripts/inspect-read-only-scorer-compatible-product-source.mjs` passed and wrote a diagnostic artifact with `routeInvoked=false`, `apiAnalyzeInvoked=false`, `supabaseWriteExecuted=false`, `runtimeMutation=false`, and `syntheticProductsUsed=false`. `node scripts/verify-read-only-scorer-compatible-product-source.mjs` passed and confirmed runtime files do not reference the inspection script. Node emitted existing direct-ESM `--experimental-loader` and `MODULE_TYPELESS_PACKAGE_JSON` warnings.
- Findings: The scorer-compatible minimum is `id`, `name`, `brand`, and an authorized recommendation category resolved by `getProductCategorySlot`; `product_form` participates in serum/moisturizer subcategory authorization when present. Current local read-only source extraction returned `product_source_unavailable:missing_config`, so actual scorer-compatible rows were not obtained in this checkout and target scenario replay with extracted rows was skipped.
- Context promotion candidate: Phase 23 should remain a source-availability gate. Do not treat source-unavailable or zero-row read-only extraction as functional policy evidence; rerun in an environment where `getRecommendationProducts()` can read product rows before expanding pure engine replay coverage.

### 2026-07-09 / evaluator boundary actual coverage collection phase 18

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium actual capture coverage collection
- Routing decision: User requested actual complete/product-row capture coverage collection for Phase 16-17 evaluator boundary gaps. Runtime evaluator logic, hard-filter/score/weight changes, CandidatePolicy runtime wiring, route/API/UI/DB/Supabase changes, existing recommendation output, topPick/supporting/budget payloads, capture fixture source edits, and product data changes were out of scope.
- Goal: Collect whether active-leaning-only, metadata-incomplete, serum category, and strong-caution metadata gap cases are present in current actual complete capture evidence, while keeping synthetic fixture validation separate from actual capture evidence.
- Changed files: scripts/collect-evaluator-boundary-actual-coverage.mjs, scripts/verify-evaluator-boundary-actual-coverage.mjs, docs/reviews/evaluator-boundary-actual-coverage-20260703.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, stored payload, DB/schema/migration/policy, Supabase query, existing recommendation engine, functional-ranking evaluator behavior, hard-filter/score/weight, CandidatePolicy runtime, UI, product data, capture fixture source, or user-facing recommendation changes.
- Validation: `node scripts/collect-evaluator-boundary-actual-coverage.mjs` and `node scripts/verify-evaluator-boundary-actual-coverage.mjs` passed. Existing Phase 16-17 boundary, evaluator hard-block, exposure/readiness, recent-instability matrix/policy, guard exposure, shadow comparison/capture, candidate audit, ranking, goal, and survey verifier scripts passed. `npm run build` and `git diff --check` passed. Node emitted existing MODULE_TYPELESS_PACKAGE_JSON warnings for ES-module-style files.
- Findings: Current actual complete/product-row captures used 10 fixtures, 1,640 high-confidence candidate rows, and 86 boundary-applicable rows. Active-leaning-only, metadata-incomplete, serum category, and strong-caution metadata gap cases were not observed in current actual captures. The safe-low-risk hidden target slice was reconfirmed at 50 rows, all `downgrade_to_collapsed_candidate`. High-risk collapsed count remained 0.
- Context promotion candidate: Not-observed gaps should be treated as current product/capture distribution limitations. Evaluator pass plus collapsed hint remains a separate approved task after actual high-confidence coverage is expanded.

### 2026-07-09 / evaluator boundary coverage gap validation phase 17

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium synthetic policy coverage validation
- Routing decision: User requested synthetic fixture validation for Phase 16 coverage gaps. Runtime evaluator logic, hard-filter/score/weight changes, CandidatePolicy runtime wiring, route/API/UI/DB/Supabase changes, existing recommendation output, topPick/supporting/budget payloads, capture fixture source edits, and product data changes were out of scope.
- Goal: Validate `resolveEvaluatorRecentInstabilityBoundaryPolicy()` against synthetic active-leaning-only, metadata-incomplete, serum category, and strong-caution metadata cases before any future runtime integration discussion.
- Changed files: scripts/verify-evaluator-boundary-coverage-gaps.mjs, docs/reviews/evaluator-boundary-coverage-gaps-20260703.md, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, stored payload, DB/schema/migration/policy, Supabase query, existing recommendation engine, functional-ranking evaluator behavior, hard-filter/score/weight, CandidatePolicy runtime, UI, product data, capture fixture source, or user-facing recommendation changes.
- Validation: `node scripts/verify-evaluator-boundary-coverage-gaps.mjs` passed. Existing Phase 16 boundary verifier/runner, evaluator hard-block review, exposure audit/readiness, recent-instability matrix/policy, guard exposure, shadow comparison/capture, candidate audit, ranking, goal, and survey verifier scripts passed. `npm run build` and `git diff --check` passed. Node emitted existing MODULE_TYPELESS_PACKAGE_JSON warnings for ES-module-style files.
- Findings: Synthetic active-leaning-only safe metadata routes to `downgrade_to_collapsed_candidate`; active-leaning unsafe metadata and strong caution metadata preserve hard block; metadata gaps route to `requires_metadata_review`; serum category alone does not preserve hard block. This is synthetic policy coverage, not real runtime/user/product distribution evidence.
- Context promotion candidate: Runtime evaluator/CandidatePolicy integration still needs separate approval plus actual high-confidence complete-capture coverage for active-leaning-only, metadata-incomplete, serum, and strong-caution cases.

### 2026-07-09 / evaluator recent-instability boundary shadow policy phase 16

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium shadow-only evaluator boundary policy
- Routing decision: User requested a pure boundary policy and shadow reclassification audit for evaluator `recent_instability_active_limited` hard blocks. Runtime evaluator logic, hard-filter/score/weight changes, CandidatePolicy runtime wiring, route/API/UI/DB/Supabase changes, existing recommendation output, topPick/supporting/budget payloads, capture fixture source edits, and product data changes were out of scope.
- Goal: Add `resolveEvaluatorRecentInstabilityBoundaryPolicy()` plus a local shadow runner/verifier to classify existing recent-instability evaluator hard blocks as `preserve_hard_block`, `downgrade_to_collapsed_candidate`, `requires_metadata_review`, or `not_applicable`.
- Changed files: lib/evaluator-recent-instability-boundary-policy.js, scripts/run-evaluator-recent-instability-boundary-shadow.mjs, scripts/verify-evaluator-recent-instability-boundary-policy.mjs, docs/architecture/evaluator-recent-instability-boundary-policy.md, docs/reviews/evaluator-recent-instability-boundary-shadow-20260703.md, scripts/run-functional-candidate-exposure-audit.mjs, scripts/run-recent-instability-guard-matrix.mjs, scripts/replay-functional-shadow-captures.mjs, .codex/AI_WORK_LOG.md
- Protected areas: No route/API response field, stored payload, DB/schema/migration/policy, Supabase query, existing recommendation engine, functional-ranking evaluator behavior, hard-filter/score/weight, CandidatePolicy runtime, UI, product data, capture fixture source, or user-facing recommendation changes.
- Validation: Boundary runner and verifier passed. Existing evaluator hard-block review, exposure audit/readiness, recent-instability matrix/policy, guard exposure, shadow comparison/capture, candidate audit, ranking, goal, and survey verifier scripts passed. `npm run build` and `git diff --check` passed. Node emitted existing MODULE_TYPELESS_PACKAGE_JSON warnings for ES-module-style files.
- Findings: Reviewed 86 high-confidence evaluator `recent_instability_active_limited` hard-block rows. Shadow decisions: preserve hard block 33, downgrade to collapsed 52, metadata review 0, not applicable 1. The safe-low-risk hidden target slice was 50/50 downgraded to collapsed candidate and 0/50 preserved. High-risk/unsafe rows were not downgraded to collapsed.
- Context promotion candidate: The boundary is deterministic enough for a future evaluator/CandidatePolicy policy task, but runtime changes still require separate approval and more coverage for active-leaning-only, metadata-incomplete, serum, and strong-caution comparison samples.

### 2026-07-09 / premium engine architecture documentation

- Branch: codex/survey-input-contract-refactor
- Task type: design / documentation-only architecture boundary
- Routing decision: User requested Premium Engine Architecture documentation only. Runtime code changes, evaluator/hard-filter/score/weight changes, CandidatePolicy runtime wiring, UI/API response changes, DB/schema/migration/Supabase changes, existing recommendation output changes, Face Lab implementation, Condition engine implementation, and Routine engine implementation were out of scope.
- Goal: Define `SkinMatchPremiumCore` as the shared premium judgment layer and fix responsibility boundaries for Routine, Functional, Condition, and Face Lab engines before returning to Phase 16.
- Changed files: docs/architecture/premium-engine-architecture.md, .codex/AI_WORK_LOG.md
- Protected areas: No runtime code, UI, API response fields, stored payload structure, DB/schema/migration/policy, Supabase query, existing recommendation engine, topPick/supporting/budget payload, evaluator behavior, CandidatePolicy runtime, product data, or Face Lab/Condition/Routine implementation changes.
- Validation: `npm run build` passed. `git diff --check` passed.
- Findings: The architecture now treats functional ranking, guard, exposure, candidate audit, shadow capture, and divergence review modules as parts of the future `SkinMatchPremiumCore` judgment/audit layer rather than an independent premium sector. Face Lab is explicitly separate and may consume only `skinStyleSignals` from the core.
- Resume point: Return to Phase 16, `Evaluator Recent-Instability Hard Block Boundary Shadow Policy`, to shadow-validate `preserve_hard_block` vs `downgrade_to_collapsed_candidate` for low-risk / sensitivity-safe mixed-profile candidates blocked by `recent_instability_active_limited`.

### 2026-07-06 / evaluator hard block boundary review phase 15

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium shadow policy review helper and report
- Routing decision: User requested analysis of `safe_low_risk` hidden candidates blocked by evaluator `recent_instability_active_limited`. Runtime evaluator changes, hard-filter/score/weight changes, CandidatePolicy runtime changes, route/API/UI/DB/Supabase changes, product edits, capture fixture source mutation, and existing recommendation output changes were out of scope.
- Goal: Add a pure `reviewFunctionalEvaluatorHardBlocks()` helper, runner, verifier, and review document to classify whether the current evaluator hard-block boundary looks appropriate, overbroad, metadata-limited, or under-evidenced.
- Changed files: lib/functional-evaluator-hard-block-review.js, scripts/review-functional-evaluator-hard-blocks.mjs, scripts/verify-functional-evaluator-hard-block-review.mjs, docs/reviews/functional-evaluator-hard-block-review-20260703.md, lib/functional-candidate-exposure-audit.js, scripts/run-functional-candidate-exposure-audit.mjs, scripts/replay-functional-shadow-captures.mjs, scripts/run-recent-instability-guard-matrix.mjs, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, existing recommendation engine, functional-ranking runtime evaluator behavior, hard-filter/score/weight, existing `functional-candidate-policy.js` runtime behavior, Functional Plan UI, product data, topPick/supporting/budget, or raw capture fixture source changes.
- Validation: `node scripts/review-functional-evaluator-hard-blocks.mjs`, `node scripts/verify-functional-evaluator-hard-block-review.mjs`, exposure audit/readiness scripts, shadow/matrix/safety/ranking/goal/survey verifier scripts, `npm run build`, and `git diff --check` passed. Node emitted existing MODULE_TYPELESS_PACKAGE_JSON warnings for ES-module-style files.
- Findings: Target reviewed cases: 50. `recent_instability_active_limited` rate: 1.0. All target cases are evaluator-only hard blocks with no guard hard-block overlap. Category distribution: moisturizer 17, essence 9, toner_pad 8, sunscreen 7, cleanser 5, treatment 4. Functional profile: mixed 50. Safety context: both high sensitivity and recent instability 50. Product metadata is favorable in the target slice: irritation risk low 50, sensitivity safe true 50, profile evaluable true 50. Assessment: `possible_evaluator_overblocking`.
- Context promotion candidate: Do not change the evaluator yet. Open a targeted evaluator hard-block boundary policy task before any runtime hard-filter adjustment.

### 2026-07-06 / candidate-level exposure evidence artifact phase 14

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium shadow artifact evidence enrichment
- Routing decision: User requested candidate-level review rows for exposure audit artifacts so readiness review can analyze safe-low-risk hidden and collapsed reason breakdowns. Route/API changes, existing recommendation changes, runtime CandidatePolicy changes, functional evaluator hard-filter/score/weight changes, UI/DB/Supabase/product edits, capture fixture mutation, and user-facing ranking exposure were out of scope.
- Goal: Add sanitized `candidateReviewRows` to `buildFunctionalCandidateExposureAudit()`, persist them in `candidate-exposure-audit.json`, and update readiness review to consume candidate-level reason evidence.
- Changed files: lib/functional-candidate-exposure-audit.js, scripts/run-functional-candidate-exposure-audit.mjs, lib/functional-exposure-readiness-review.js, scripts/review-functional-exposure-readiness.mjs, scripts/verify-functional-candidate-exposure-audit.mjs, scripts/verify-functional-exposure-readiness-review.mjs, docs/architecture/functional-candidate-exposure-audit.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, existing recommendation engine, functional-ranking runtime evaluator behavior, hard-filter/score/weight, existing `functional-candidate-policy.js` runtime behavior, Functional Plan UI, product data, or capture fixture source mutation.
- Validation: `node scripts/run-functional-candidate-exposure-audit.mjs`, `node scripts/review-functional-exposure-readiness.mjs`, exposure audit/readiness verifier scripts, existing shadow/matrix/safety/ranking/goal/survey verifier scripts, `npm run build`, and `git diff --check` passed. Node emitted the existing MODULE_TYPELESS_PACKAGE_JSON warnings for ES-module-style files.
- Context promotion candidate: Candidate-level exposure evidence is shadow artifact data only. Runtime CandidatePolicy integration still requires separate approval and must not infer product quality from hidden or insufficient-evidence buckets.

### 2026-07-05 / SEC-01 analysis request guard

- Branch: codex/survey-input-contract-refactor
- Task type: execution / High public AI endpoint security fix with Supabase migration written but not applied.
- Routing decision: User explicitly requested SEC-01 only. Scope stayed limited to `/api/analyze`, `/api/face-reading`, client idempotency headers, guard helper, guard migration, verification script, security docs, and this work-log entry. Premium entitlement, anonymous write-token binding, existing analysis table RLS/grants, dependency updates, payment, and production service calls were out of scope.
- Target endpoints: `/api/analyze`, `/api/face-reading`
- Changed files: app/api/analyze/route.js, app/api/face-reading/route.js, app/page.js, lib/security/analysis-request-guard-core.js, lib/security/analysis-request-guard.js, supabase/migrations/20260704221747_sec_01_analysis_request_guard.sql, scripts/verify-analysis-request-guard.mjs, docs/security/sec-01-analysis-request-guard-20260705.md, .codex/AI_WORK_LOG.md
- Quota policy: `/api/analyze` user 5/hour and 15/day, anonymous 2/hour and 4/day, IP 5/hour and 10/day. `/api/face-reading` user 3/hour and 8/day, anonymous 1/hour and 2/day, IP 3/hour and 5/day.
- Fail-closed: `ANALYSIS_REQUEST_GUARD_SECRET`, service-role Supabase client, idempotency RPC, or rate-limit RPC failure returns safe 503 before OpenAI/provider calls.
- Validation: `node scripts/verify-analysis-request-guard.mjs` passed with a Node module-type warning only; `node --check` passed for the new guard files, touched routes, page, and verifier; `git diff --check` passed with CRLF warnings only; `npm run build` passed. No Supabase migration apply, DB write, production API call, or OpenAI live call was performed.
- Follow-up security work: SEC-02 analysis table RLS/grant deployment verification, SEC-03 Next.js dependency update, SEC-04 premium release mode fail-open 보정, SEC-05 anonymous write token resource binding/replay 방지.

### 2026-07-05 / OWASP security audit

- Branch: codex/survey-input-contract-refactor
- Task type: diagnostic / High security audit with protected-area constraints and no code changes.
- Routing decision: Repository-wide OWASP audit requested with explicit no-code-change, no migration, no env/auth/API contract changes, no destructive commands, no external attack testing. Scope stayed limited to read-only static review, dependency audit, report generation, remediation backlog, and this work-log entry.
- Goal: Produce a Korean OWASP Top 10:2025, ASVS 5.0, and OWASP API Security Top 10:2023 audit for Next.js, Supabase/Auth/RLS assumptions, upload/AI analysis, premium access, sharing, My/check-in, product links, crawler/import, deployment configuration, and dependencies.
- Changed files: docs/security/owasp-audit-20260705.md, docs/security/owasp-remediation-backlog-20260705.md, .codex/AI_WORK_LOG.md
- Code changes: None. No DB migration, package update, env/auth policy, API response, deployment setting, Supabase write, or external service setting was changed.
- Result summary: Critical 0, High 3, Medium 6, Low 3, Info 1. Deployment-environment verification checklist items: 13.
- Validation: `git branch --show-current`, `git status --short`, route/file inventory via `rg`, `.env.local` key-name-only inventory, `npm ls next @supabase/supabase-js @supabase/ssr react react-dom --depth=0`, `npm audit --omit=dev --json`, and static pattern scans were performed. `npm run lint` was not completed because `next lint` opened an interactive ESLint configuration prompt.
- Next recommended work: First address SEC-01 by adding durable quota/rate limiting before public AI provider calls, then verify analysis table RLS/grants before applying production-facing changes.

### 2026-07-05 / test result browser comments UI fixes

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium UI behavior and layout fixes, explicitly approved on the current branch after branch-purpose mismatch was reported.
- Routing decision: User requested direct browser-comment fixes for `/test-result` and the in-app browser was on `/test-full-report`. Scope stayed limited to result header behavior, free-result priority accordion default state, and photo evidence callout layout/wires. No API, DB, auth, stored payload, recommendation, product, migration, environment, or deployment changes.
- Goal: Open only the first care-priority row by default, remove unintended navigation from the small top result/full-report header text, and make photo evidence wires connect toward the visible callout text boxes without mobile overflow.
- Changed files: app/result/page.js, app/result/full-report/page.js, components/result/free-v2/FreeResultV2DiagnosisStep.jsx, components/result/free-v2/FreeResultV2EvidenceStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: No protected-area edits. Auth display components and menu actions were left intact; only the header text wrapper was changed from link to non-link.
- Validation: `npm run build` passed. `git diff --check` passed with existing LF-to-CRLF warnings only. In-app browser verification on `http://localhost:3001/test-result` confirmed the header is not a link, priority row 1 is `aria-expanded=true`, rows 2 and 3 are `false`, and the evidence wire overlay is visible after revealing photo signals. Mobile viewport verification confirmed the right callout text boxes fit inside the viewport after the grid/photo width adjustment. `http://localhost:3001/test-full-report` header text was also confirmed non-link.
- Findings: The original photo evidence grid could overflow on mobile because the center image column forced side callouts outside the viewport. The mobile-specific grid and image max-width adjustment keeps the callouts inside while preserving larger-screen sizing.
- Context promotion candidate: None.

### 2026-07-03 / functional candidate exposure audit phase 12

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium shadow-only exposure grouping
- Routing decision: User requested a shadow-only bridge from functional candidate audit results to future CandidatePolicy exposure groups. Route/API changes, existing CandidatePolicy runtime behavior changes, existing recommendation changes, ranking score/weight changes, hard-filter changes, UI/DB/Supabase/product changes, capture fixture mutation, user-facing ranking exposure, and topPick/supporting/budget changes were out of scope.
- Goal: Add a pure `buildFunctionalCandidateExposureAudit()` helper, verifier, complete-capture runner, and architecture documentation that group candidates into primary/contextual/collapsed/hidden/insufficient-evidence exposure buckets without changing runtime behavior.
- Changed files: lib/functional-candidate-exposure-audit.js, scripts/verify-functional-candidate-exposure-audit.mjs, scripts/run-functional-candidate-exposure-audit.mjs, docs/architecture/functional-candidate-exposure-audit.md, scripts/replay-functional-shadow-captures.mjs, scripts/run-recent-instability-guard-matrix.mjs, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, existing recommendation engine, functional-ranking runtime evaluator behavior, hard-filter/score/weight, existing `functional-candidate-policy.js` runtime behavior, Functional Plan UI, product data, or user-facing ranking exposure changes.
- Validation: Phase 12 verifier and complete-capture runner passed. Existing guard exposure, recent-instability matrix/policy, safety case, packet, divergence, shadow/candidate/ranking/goal/survey verifier scripts passed. `npm run build` and `git diff --check` passed.
- Findings: Complete capture runner used 10 complete product-row captures, excluded 10 final-results-only captures, and evaluated 1640 product rows. Exposure groups: primary 656, contextual 371, collapsed 428, hidden 185, insufficient evidence 0. Collapsed candidates remain a future CandidatePolicy exposure group, not a score or hard-filter change.
- Context promotion candidate: Candidate exposure grouping is shadow-only. Runtime CandidatePolicy integration, collapsed group UI, or evaluator changes require a separate approved task after reviewing group distribution and safety behavior.

### 2026-07-03 / functional guard exposure policy phase 11

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium responsibility design and pure policy helper
- Routing decision: User requested a design-only bridge from recent-instability guard states to future CandidatePolicy exposure behavior. Runtime evaluator changes, existing CandidatePolicy behavior changes, route/API changes, existing recommendation changes, ranking score/weight changes, hard-filter changes, UI/DB/Supabase/product changes, shadow fixture changes, user-facing exposure, and topPick/supporting/budget changes were out of scope.
- Goal: Add a pure `resolveFunctionalGuardExposurePolicy()` helper, verifier, and architecture documentation defining how guard decisions map to primary/contextual/collapsed/hidden/insufficient-evidence exposure states for future CandidatePolicy integration.
- Changed files: lib/functional-guard-exposure-policy.js, scripts/verify-functional-guard-exposure-policy.mjs, docs/architecture/functional-guard-exposure-policy.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, existing recommendation engine, functional-ranking runtime evaluator behavior, hard-filter/score/weight, existing `functional-candidate-policy.js` runtime behavior, Functional Plan UI, product data, or user-facing ranking exposure changes.
- Validation: `node scripts/verify-functional-guard-exposure-policy.mjs` passed. Required recent-instability matrix/policy, safety case, packet, divergence, replay, summary, shadow/candidate/ranking/goal/survey verifier scripts passed. `npm run build` and `git diff --check` passed with expected LF-to-CRLF warnings only.
- Findings: `hard_block_candidate` and evaluator `blocked` map to `hidden_candidate`; `collapsed_exposure_candidate` maps to future `collapsed_candidate`; `allow_with_context` maps to contextual primary exposure; `no_guard` maps to normal primary exposure; `insufficient_data` maps to `insufficient_evidence_candidate` without hiding. Current-product findings add context only and do not reverse safety exposure.
- Context promotion candidate: Collapsed exposure is a future CandidatePolicy exposure state, not a score adjustment or runtime UI state. Wiring it requires a separate approved implementation task.

### 2026-07-03 / recent instability guard matrix phase 10

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium policy validation matrix
- Routing decision: User requested complete shadow-candidate-source reuse plus synthetic safety-context validation for `resolveRecentInstabilityGuardPolicy()`. Runtime evaluator hard-filter changes, score/weight changes, existing recommendation changes, UI/API/DB/Supabase changes, CandidatePolicy runtime wiring, Functional Plan UI, product data edits, fixture deletion/mutation, user-facing exposure, and policy-application conclusions were out of scope.
- Goal: Validate recent-instability guard policy behavior across 10 complete product-row shadow captures, 12 synthetic policy contexts, and product safety/category/functional profile buckets; generate review docs and tmp matrix outputs.
- Changed files: scripts/run-recent-instability-guard-matrix.mjs, scripts/verify-recent-instability-guard-matrix.mjs, docs/reviews/recent-instability-guard-matrix-20260703.md, scripts/replay-functional-shadow-captures.mjs, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, existing recommendation engine, functional-ranking runtime evaluator behavior, hard-filter/score/weight, CandidatePolicy runtime, Functional Plan UI, product data, topPick/supporting/budget payloads, or user-facing ranking exposure changes.
- Validation: `node scripts/run-recent-instability-guard-matrix.mjs` generated ignored tmp JSON/MD plus a tracked review doc. `node scripts/verify-recent-instability-guard-matrix.mjs` passed. Required recent-instability policy, safety case, packet, divergence, replay, summary, shadow/candidate/ranking/goal/survey verifier scripts passed. `npm run build` and `git diff --check` passed with expected LF-to-CRLF warnings only.
- Findings: Matrix used 10 complete captures and excluded 10 final-results-only captures. Unique products: 164; total matrix evaluations: 19680. Safety metadata profiles: safe_low_risk 118, safe_medium_risk 2, unsafe_high_risk 1, mixed_or_uncertain 43, metadata_incomplete 0. `unsafe_high_risk` hard-block rate was 1.0, `safe_low_risk` collapsed-exposure rate was 1.0, `safe_low_risk` hard-block rate was 0, and baseline no-guard rate was 1.0. Policy validation status: `policy_behavior_consistent`.
- Context promotion candidate: Even with policy behavior consistency, synthetic matrix validation is not runtime approval; CandidatePolicy/evaluator connection needs a separate approved task and additional high-confidence coverage for metadata-incomplete and underrepresented product profiles.

### 2026-07-03 / recent instability guard policy phase 9

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium policy helper and documentation
- Routing decision: User requested a targeted policy review for `recent_instability + stabilize_first` broad blocking. Existing hard-filter runtime changes, functional evaluator changes, ranking score/weight changes, UI/API/DB/Supabase changes, existing recommendation output changes, CandidatePolicy runtime wiring, Functional Plan UI, product data edits, shadow capture structure changes, user-facing exposure, packet mutation, and automatic policy application were out of scope.
- Goal: Define a pure policy helper and architecture note that separate hard-block candidates from broad-block relaxation candidates using product-level safety metadata.
- Changed files: lib/recent-instability-guard-policy.js, scripts/verify-recent-instability-guard-policy.mjs, docs/architecture/recent-instability-guard-policy.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, existing recommendation engine, functional-ranking evaluator behavior, score/weight, CandidatePolicy runtime, Functional Plan UI, product data, or shadow fixture contract changes.
- Validation: `node scripts/verify-recent-instability-guard-policy.mjs` passed. Required existing safety case, packet, divergence, replay, summary, shadow/candidate/ranking/goal/survey verifier scripts passed. `npm run build` and `git diff --check` passed; Node emitted the existing MODULE_TYPELESS_PACKAGE_JSON warnings for ES-module-style files.
- Findings: The policy keeps hard-block candidacy for high sensitivity plus high irritation or explicit non-sensitive-safe metadata. Recent instability with low/medium irritation and `sensitivity_safe === true` is classified as a future collapsed-exposure candidate, not a hard block. Missing metadata is classified as `insufficient_data` with metadata review, not product unsuitability.
- Context promotion candidate: `recent_instability` broad-block changes should not be applied until a separate CandidatePolicy/evaluator task chooses soft penalty vs collapsed exposure and validates additional high-confidence samples.

### 2026-07-03 / functional safety case analysis phase 8

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium manual safety divergence case analysis
- Routing decision: User requested case-by-case analysis of high-confidence `existing_selected_but_blocked` safety packet cases. Hard-filter changes, ranking score/weight changes, existing recommendation changes, UI/API/DB/product data changes, CandidatePolicy runtime wiring, Functional Plan UI, user-facing exposure, raw form/media/PII output, and writing outcomes back to runtime or packet data were out of scope.
- Goal: Generate a structured safety case analysis report, provisional outcome recommendations, aggregate pattern assessment, follow-up sample matrix, and verifier without changing runtime recommendation behavior.
- Changed files: scripts/review-functional-safety-cases.mjs, scripts/verify-functional-safety-case-review.mjs, docs/reviews/functional-safety-review-20260703.md, scripts/replay-functional-shadow-captures.mjs, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, existing recommendation engine, functional hard-filter/score/weight policy, CandidatePolicy runtime, Functional Plan UI, product data, topPick/supporting/budget payloads, or user-facing ranking exposure changes.
- Validation: `node scripts/review-functional-safety-cases.mjs` generated the review document and ignored tmp analysis JSON. `node scripts/verify-functional-safety-case-review.mjs`, safety packet/divergence/shadow/candidate/ranking/goal/survey verifier scripts, replay, summarize, review-divergence runner, and `npm run build` passed. `git diff --check` passed with existing LF-to-CRLF warnings only.
- Findings: Three high-confidence safety cases were reviewed. One high-sensitivity treatment case is provisionally `guard_appears_appropriate` and not policy-change eligible. Two recent-instability cases with favorable product-level safety metadata are provisionally `possible_overblocking` and eligible only for a separate targeted policy review task. Aggregate next action is `open_targeted_policy_review_task`, not implementation.
- Context promotion candidate: Safety case recommended outcomes are Codex analysis recommendations only. Runtime outcome, hard-filter, and score changes require a separate approved task after manual review and additional samples.

### 2026-07-03 / functional safety review packet phase 7

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium manual safety evidence packet
- Routing decision: User requested a manual review packet for high-confidence `existing_selected_but_blocked` safety divergences. UI changes, API response changes, DB/schema/migration work, Supabase queries, existing recommendation engine changes, ranking score/weight changes, hard filter changes, CandidatePolicy runtime wiring, Functional Plan UI, product data edits, topPick/supporting/budget changes, new ranking exposure, raw form/image/PII storage, fuzzy matching, and automatic correctness conclusions were out of scope.
- Goal: Build a pure safety packet helper, generator, verifier, and documentation that turn eligible safety divergences into human-reviewable case packets with sanitized context, fixed allowed outcomes, review questions, aggregate counts, metadata readiness, and no automatic policy change.
- Changed files: lib/functional-safety-review-packet.js, scripts/generate-functional-safety-review-packet.mjs, scripts/verify-functional-safety-review-packet.mjs, docs/architecture/functional-safety-review-packet.md, scripts/replay-functional-shadow-captures.mjs, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, existing recommendation engine, recommendation-scoring, functional score/weight/hard filter policy, CandidatePolicy runtime, Functional Plan UI, product data, topPick/supporting/budget payloads, user-facing exposure, raw form/image/base64/file/session/email/cookie/user-agent/product name/brand/purchase URL/raw review storage, or production behavior changes.
- Validation: `node scripts/verify-functional-safety-review-packet.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/verify-functional-divergence-policy-review.mjs`, `node scripts/replay-functional-shadow-captures.mjs`, `node scripts/summarize-functional-shadow-captures.mjs`, `node scripts/review-functional-shadow-divergences.mjs`, `node scripts/generate-functional-safety-review-packet.mjs`, existing candidate source/shadow/candidate/ranking/goal/survey verifier scripts, and `npm run build` passed.
- Findings: Safety packet contains 3 eligible high-confidence cases. Hard-filter reason distribution: `high_sensitivity` 2, `recent_instability` 2. Category distribution: treatment 2, toner_pad 1. Ranking goals: redness 1, acne 2. Safety goal: redness 3. Recommendation guard: stabilize_first 3. Metadata blockers: none; readiness true. Initial outcomes remain null and require manual review.
- Context promotion candidate: Safety divergence packet review should happen before any hard-filter or score policy change. Only manually confirmed repeated `possible_overblocking` or `insufficient_product_metadata` outcomes should create a separate implementation task.

### 2026-07-03 / functional divergence policy review phase 6

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium pure analysis framework
- Routing decision: User requested a high-confidence divergence review framework based on replay summaries. UI changes, API response changes, DB/schema/migration work, Supabase queries, existing recommendation scoring changes, functional score/weight changes, hard filter changes, CandidatePolicy runtime wiring, Functional Plan UI, product data edits, shadow capture structure changes, topPick/supporting/budget overwrite, automatic superiority claims, and low-confidence evidence promotion were out of scope.
- Goal: Add a pure `reviewFunctionalDivergencePolicy()` helper, review runner, verifier, and architecture documentation that classify high-confidence divergence as observation-only, policy-review candidate, safety-review required, or comparison-limit without changing runtime policy.
- Changed files: lib/functional-divergence-policy-review.js, lib/functional-shadow-comparison.js, scripts/replay-functional-shadow-captures.mjs, scripts/verify-functional-divergence-policy-review.mjs, scripts/review-functional-shadow-divergences.mjs, docs/architecture/functional-divergence-policy-review.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, existing recommendation-scoring, existing free-result recommendation output, functional ranking score/weight, hard filter policy, CandidatePolicy runtime wiring, Functional Plan UI, product data, shadow capture fixture contract changes, auth/payment/deploy/env, production data, or raw form/image/PII output changes.
- Validation: `node scripts/verify-functional-divergence-policy-review.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/replay-functional-shadow-captures.mjs`, `node scripts/summarize-functional-shadow-captures.mjs`, and `node scripts/review-functional-shadow-divergences.mjs` passed and wrote ignored tmp review artifacts. Existing candidate source, shadow capture/comparison, candidate audit, ranking contract, goal policy, and survey contract verifier scripts passed with existing warning pattern. `npm run build` passed.
- Findings: Review included 10 high-confidence comparisons and excluded 10 low-confidence comparisons. Top-pick mismatch was 8/10, existing selected lower rank occurred in 9/10 cases with 18 occurrences, functional top missing occurred in 10/10 cases with 20 occurrences, and existing-selected blocked produced 3 safety conflicts in 2/10 cases. Policy candidates are manual review questions only; next action is manual safety review before any policy change.
- Context promotion candidate: Future policy changes should only use high/medium-confidence divergence review outputs, and selected-but-blocked safety collisions require manual review before changing hard filters.

### 2026-07-03 / existing candidate source boundary phase 5

- Branch: codex/survey-input-contract-refactor
- Task type: execution / High read-only recommendation candidate source boundary
- Routing decision: User requested a source boundary so dev-only shadow capture can store the existing free-result engine's real candidate pool instead of final results only. UI changes, API response changes, DB/schema/migration work, Supabase queries, existing score/filter/sort changes, topPick/supporting/budget payload changes, new ranking exposure, Functional Plan wiring, storage changes, product data edits, photo analysis changes, production capture, fuzzy matching, new product fetches, raw form/image/PII storage, and policy changes were out of scope.
- Goal: Expose the existing engine's already-computed `scoredProducts` as an opt-in `post_score_candidate_pool` diagnostic, preserve existing runtime behavior when disabled, pass that source into dev shadow capture, extend fixture/replay metadata, verify old fixture compatibility, and run actual dev 10-case capture again.
- Changed files: app/api/analyze/route.js, lib/skin-match-decision-engine.js, lib/existing-recommendation-candidate-source.js, lib/functional-shadow-capture.js, lib/functional-shadow-adapter.js, lib/functional-shadow-comparison.js, scripts/verify-existing-recommendation-candidate-source.mjs, scripts/replay-functional-shadow-captures.mjs, scripts/summarize-functional-shadow-captures.mjs, docs/architecture/existing-recommendation-candidate-source.md, docs/architecture/functional-shadow-capture.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, existing recommendation scoring/filter/sort behavior, topPick/supporting/budget payload, Functional Plan UI, premium/currentProducts storage, photo analysis, product data, production runtime capture, raw form/image/base64/file/session/email/cookie/user-agent storage, product name/brand/purchase URL capture, or committed tmp fixture changes.
- Validation: `node scripts/verify-existing-recommendation-candidate-source.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. Existing shadow/candidate/ranking/goal/survey verifier scripts passed with the same warning pattern. Actual dev runtime ran 10 `/api/analyze` requests with `FUNCTIONAL_SHADOW_CAPTURE=1`; all returned 200, no response leaked shadow/capture/diagnostic fields, and each wrote one fixture. New fixtures were 10/10 `complete`, `post_score_candidate_pool`, `product_row`, sourceCount 164, with no forbidden data tokens found. Replay over old+new fixtures processed 20 captures with 0 failed/skipped and high/medium/low confidence 10/0/10. `npm run build` passed.
- Findings: The boundary successfully changed new runtime captures from `final_results_only` to `complete`. New high-confidence sample divergences were topPick mismatch 8, existing selected ranked lower 18, existing selected but blocked 3, and functional top candidate missing from existing 20. These are observations only and not policy changes.
- Context promotion candidate: Future ranking policy review should use high/medium-confidence captures from the `post_score_candidate_pool`; low-confidence final-result-only captures should remain background evidence only.

### 2026-07-03 / functional shadow capture runtime sample

- Branch: codex/survey-input-contract-refactor
- Task type: verification / Medium dev-only runtime shadow capture sampling
- Routing decision: User requested actual development `/api/analyze` runtime validation and sample capture collection for Ranking Engine Phase 4. UI changes, API response changes, DB/schema/migration work, existing recommendation changes, new ranking exposure, Functional Plan wiring, product data edits, production execution, raw form/image/PII storage, and policy changes from divergence were out of scope.
- Goal: Run dev server with `FUNCTIONAL_SHADOW_CAPTURE=1`, submit 10 real multipart `/api/analyze` cases with the test image and new survey fields, verify response isolation, confirm sanitized capture fixture generation, replay captures, aggregate divergence signals, and run the required verifier/build/diff checks.
- Changed files: .codex/AI_WORK_LOG.md only. Runtime capture fixtures and replay/aggregate summaries were written under ignored `tmp/functional-shadow-captures/`.
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, existing recommendation engine, topPick/supporting/budget payloads, Functional Plan UI, premium/currentProducts storage, photo analysis, product data, production runtime, raw form/image/base64/file/session/email/cookie/user-agent storage, product name/brand/purchase URL capture, or committed tmp fixtures.
- Validation: Dev server ran on `http://localhost:3001` with `NODE_ENV=development` and `FUNCTIONAL_SHADOW_CAPTURE=1`. All 10 `/api/analyze` requests returned 200 and generated one capture each. No response contained `surveyInputContract`, `contract`, `debugContract`, `shadow`, `capture`, or `functionalAudit`. Fixture key and forbidden-token checks passed. Replay processed 10 captures with 0 failed/skipped. Aggregate summary passed. All required verifier scripts passed with existing Node MODULE_TYPELESS_PACKAGE_JSON warnings. `npm run build` passed.
- Findings: Candidate source completeness was `final_results_only` for 10/10 captures, so comparison confidence was low for 10/10. Replay observed topPick mismatch 7, existing selected but insufficient data 23, existing selected ranked lower 4, existing selected but blocked 2, and candidate source incomplete 10. These are observations only; low confidence means they should not drive policy changes yet.
- Context promotion candidate: Next work should strengthen read-only candidate source handoff before ranking policy tuning, because final-results-only captures cannot support full candidate-set comparison.

### 2026-07-03 / functional shadow capture phase 4

- Branch: codex/survey-input-contract-refactor
- Task type: execution / High dev-only API shadow capture with protected response/storage boundaries
- Routing decision: User requested opt-in development capture and offline replay for existing free-result recommendations versus functional ranking audit. UI changes, API response changes, DB/schema/migration work, existing recommendation replacement, topPick/supporting/budget payload changes, production capture, raw form/image/PII storage, and user-facing exposure were out of scope.
- Goal: Add a dev-only `FUNCTIONAL_SHADOW_CAPTURE=1` capture gate, sanitize real `/api/analyze` shadow fixtures, replay captures through the functional candidate audit and shadow comparison, aggregate divergence signals, verify no-op/PII/replay behavior, and document the capture contract.
- Changed files: app/api/analyze/route.js, lib/functional-shadow-capture.js, scripts/verify-functional-shadow-capture.mjs, scripts/replay-functional-shadow-captures.mjs, scripts/summarize-functional-shadow-captures.mjs, docs/architecture/functional-shadow-capture.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, existing recommendation engine replacement, free-result product output changes, topPick/supporting/budget payload changes, Functional Plan UI, premium/currentProducts storage, photo analysis, auth/payment/deploy/env files, production data, raw form/image/base64/file/session/email/cookie/user-agent storage, product name/brand/purchase URL capture, or production tmp writes.
- Validation: `node scripts/verify-functional-shadow-capture.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/verify-functional-shadow-comparison.mjs` passed with the existing warning. `node scripts/verify-functional-candidate-audit.mjs` passed with the existing warning. `node scripts/verify-functional-ranking-contract.mjs` passed with the existing warning. `node scripts/verify-functional-goal-policy.mjs` passed with the existing warning. `node scripts/verify-survey-input-contract.mjs` passed with the existing warning. `FUNCTIONAL_SHADOW_CAPTURE_DIR=tmp/functional-shadow-capture-verify node scripts/replay-functional-shadow-captures.mjs` and summarizer passed, producing ignored tmp replay/aggregate summaries. `npm run build` passed.
- Issues/risks: `/api/analyze` capture is opt-in and dev-only, and uses a dynamic import so production avoids capture module loading unless the gate is true. Candidate source completeness still controls comparison confidence; final-results-only captures remain low confidence and should not drive replacement decisions.
- Context promotion candidate: Shadow captures must remain sanitized, opt-in, and replay-only until enough high/medium-confidence fixtures show repeated divergence; response and stored payload changes require a separate approved phase.

### 2026-07-03 / functional shadow audit phase 3

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium shadow comparison audit
- Routing decision: User requested an audit-only shadow adapter and comparison layer for existing recommendation snapshots versus functional candidate audit output. UI changes, API response changes, DB/schema/migration work, Supabase query changes, existing recommendation replacement, topPick/supporting/budget payload changes, Functional Plan UI wiring, premium/currentProducts storage changes, product data edits, photo analysis changes, user-facing exposure, and production auto execution were out of scope.
- Goal: Add read-only existing recommendation snapshot extraction, candidate source resolution, functional shadow comparison, verifier coverage, local fixture runner, tmp summary output, and architecture documentation.
- Changed files: lib/functional-shadow-adapter.js, lib/functional-shadow-comparison.js, scripts/verify-functional-shadow-comparison.mjs, scripts/run-functional-shadow-audit.mjs, docs/architecture/functional-shadow-audit.md, tmp/functional-shadow-audit/summary.json, tmp/functional-shadow-audit/summary.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, recommendation-scoring replacement, existing free result changes, topPick/supporting/budget payload changes, Functional Plan UI, premium/currentProducts storage, product data, photo analysis, auth/payment/deploy/env, production data, raw form/image/PII tmp storage, or production auto-run changes.
- Validation: `node scripts/verify-functional-shadow-comparison.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/run-functional-shadow-audit.mjs` passed and wrote local tmp summary JSON/MD. `node scripts/verify-functional-candidate-audit.mjs` passed with the existing warning. `node scripts/verify-functional-ranking-contract.mjs` passed with the existing warning. `node scripts/verify-functional-goal-policy.mjs` passed with the existing warning. `node scripts/verify-survey-input-contract.mjs` passed with the existing warning. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: Shadow comparison confidence depends on candidate source completeness. If only final selected products are available, the comparison intentionally reports low confidence and a candidate-source-incomplete divergence.
- Context promotion candidate: Existing-vs-functional ranking comparison must remain product-ID based, read-only, and audit-only until a later dev-only shadow mode accumulates real fixture comparisons.

### 2026-07-03 / functional candidate audit phase 2

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium pure candidate-set audit layer
- Routing decision: User requested Ranking Engine Phase 2 as an audit-only array layer over `evaluateFunctionalRankingCandidate()`. UI changes, API response changes, DB/schema/migration work, Supabase queries, existing recommendation replacement, topPick/supporting/budget payload changes, Functional Plan UI wiring, premium/currentProducts storage changes, product data edits, photo analysis changes, and user-facing exposure were out of scope.
- Goal: Add `buildFunctionalCandidateAudit()` to evaluate product arrays, separate ranked/blocked/insufficient/skipped candidates, provide deterministic sorting and summary distributions, add verifier coverage, and document the audit-only contract.
- Changed files: lib/functional-candidate-audit.js, scripts/verify-functional-candidate-audit.mjs, scripts/run-functional-candidate-audit.mjs, docs/architecture/functional-candidate-audit.md, tmp/functional-candidate-audit/summary.json, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, product data, existing recommendation scoring replacement, existing free result payload, Functional Plan UI, premium report storage, currentProducts storage, photo analysis, auth/payment/deploy/env, or production data changes.
- Validation: `node scripts/verify-functional-candidate-audit.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/run-functional-candidate-audit.mjs` passed and wrote a local tmp summary. `node scripts/verify-functional-ranking-contract.mjs` passed with the existing warning. `node scripts/verify-functional-goal-policy.mjs` passed with the existing warning. `node scripts/verify-survey-input-contract.mjs` passed with the existing warning. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: The audit layer returns limited ranked candidates but keeps full ranked/truncation counts in summary. Category-filtered products are counted as skipped, not blocked. The module is intentionally not imported by `/api/analyze`, the existing recommendation engine, or UI.
- Context promotion candidate: Candidate-set audit should remain shadow/audit-only until a later adapter compares it against existing candidate sources and free-result product choices without overwriting them.

### 2026-07-03 / functional ranking contract phase 1

- Branch: codex/survey-input-contract-refactor
- Task type: design / Medium pure Ranking Engine Phase 1 contract
- Routing decision: User requested a ranking input/output contract and explainable `scoreBreakdown` pure evaluator before any runtime candidate ranking. UI changes, API response changes, DB/schema/migration work, Supabase queries, product data edits, existing recommendation replacement, Functional Plan UI wiring, currentProducts/premium storage changes, and photo analysis changes were out of scope.
- Goal: Add `evaluateFunctionalRankingCandidate()` for one product snapshot, define pass/blocked/insufficient-data policy, keep `rankingGoal` user-intent based while safety guards remain separate, and verify score breakdown/confidence behavior with local fixtures.
- Changed files: lib/functional-ranking-contract.js, scripts/verify-functional-ranking-contract.mjs, docs/architecture/functional-ranking-contract.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, Supabase query, product data, existing topPick/supporting/budget logic, Functional Plan UI, currentProducts or premium save structure, photo analysis, auth/payment/deploy/env, or production data changes.
- Validation: `node scripts/verify-functional-ranking-contract.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/verify-functional-goal-policy.mjs` passed with the existing warning. `node scripts/verify-survey-input-contract.mjs` passed with the existing warning. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: Phase 1 only evaluates a single product. It does not sort arrays or replace actual recommendations. The documented score weights use `functionalFit: 30` instead of the initial 35 proposal so all breakdown max values sum to exactly 100 while preserving a 5-point review signal bucket.
- Context promotion candidate: Ranking should evaluate candidates with `rankingGoal` from explicit user goal, but safety hard filters/penalties and visibility guards must stay controlled by `safetyGoal`, `recommendationGuard`, and structured safety metadata.

### 2026-07-03 / functional goal policy separation draft

- Branch: codex/survey-input-contract-refactor
- Task type: design / Medium pre-ranking policy separation
- Routing decision: User requested policy design and documentation before Ranking Engine Phase 1. UI changes, API response changes, saved payload changes, DB/schema/migration work, ranking implementation, Functional Plan UI wiring, product recommendation logic, and photo analysis changes were out of scope.
- Goal: Define how explicit `primaryConcern` and existing `freeResult.priority.axis` coexist when they differ, document tension handling, and add an unconnected pure helper/verifier for future ranking and safety policy.
- Changed files: docs/architecture/survey-input-contract.md, lib/functional-goal-policy.js, scripts/verify-functional-goal-policy.mjs, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, stored payload structure, DB/schema/migration/policy, recommendation ranking runtime, Functional Plan UI, product recommendation logic, photo analysis, auth/payment/deploy/env, or production data changes.
- Validation: `node scripts/verify-functional-goal-policy.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/verify-survey-input-contract.mjs` passed with the existing warning. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: The helper is intentionally not wired into `/api/analyze`, Functional Plan, CandidatePolicy, or ranking. Future integration must keep `primaryConcern` as ranking intent while allowing `priority.axis` and safety to guard visibility/copy.
- Context promotion candidate: Treat `primaryConcern !== priority.axis` as tension, not conflict; ranking starts from user intent, while safety/routine copy starts from detected priority and risk.

### 2026-07-02 / survey input contract UI supplement v1

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium survey UI and form contract supplement
- Routing decision: User requested the first UI refactor to address runtime-audit contract gaps: explicit `primaryConcern`, `recentSkinChange`, `recentlyChangedProduct`, and sunscreen answered/skipped metadata. DB/schema/migration, recommendation ranking, Functional Plan UI, premium/currentProducts storage, product recommendation logic, API response exposure, raw dev audit storage, and photo analysis were out of scope.
- Goal: Add contract-only survey inputs, include them in the form payload and `/api/analyze` normalized form, update `SurveyInputContract` normalization, and extend verifier/audit fixtures while keeping legacy response/storage behavior intact.
- Changed files: components/onboarding/SurveyFlow.js, components/onboarding/constants.js, app/page.js, app/api/analyze/route.js, lib/survey-input-contract.js, scripts/verify-survey-input-contract.mjs, scripts/audit-survey-input-contract-against-free-result.mjs, docs/architecture/survey-input-contract.md, tmp/survey-input-contract-audit/summary.json, tmp/survey-input-contract-audit/summary.md, .codex/AI_WORK_LOG.md
- Protected areas: No DB/schema/migration/policy, recommendation ranking engine implementation, Functional Plan UI wiring, premium report storage structure, currentProducts storage structure, product recommendation logic, API response `surveyInputContract` exposure, dev audit raw form/image/gender storage, photo analysis logic, auth/payment/deploy/env, or production data changes.
- Validation: `node scripts/verify-survey-input-contract.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/audit-survey-input-contract-against-free-result.mjs` passed and rewrote fixture audit summaries. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: New fields are now included in the submitted survey form and session survey snapshot for compatibility with future contract work, but API response and recommendation output remain unchanged. Runtime audit should be rerun next to confirm fallback/ambiguity rates drop in real UI submissions.
- Context promotion candidate: Keep legacy free-result `mainConcern` compatibility separate from contract `primaryConcern` until ranking is explicitly migrated.

### 2026-07-02 / survey input contract runtime audit sample fill

- Branch: codex/survey-input-contract-refactor
- Task type: verification / Medium runtime audit sampling
- Routing decision: User requested development-only E2E/API sampling to fill `SurveyInputContract` runtime audit data through real `/api/analyze` calls, with no UI, API response, storage payload, DB/schema, ranking, Functional Plan, free-result logic, or premium storage changes.
- Goal: Start the local dev server, use browser automation/Playwright to load localhost, submit 10 distinct multipart `/api/analyze` survey scenarios with the project test image, verify response success, generate runtime audit summaries, and analyze contract/runtime mismatches.
- Changed files: tmp/survey-input-contract-runtime-audit/events.jsonl, tmp/survey-input-contract-runtime-audit/e2e-run-results.json, tmp/survey-input-contract-runtime-audit/summary.json, tmp/survey-input-contract-runtime-audit/summary.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, survey question additions/deletions, API response field names, saved payload structure, DB/schema/migration/policy, recommendation ranking, Functional Plan UI, premium report storage, production runtime file write, raw form storage, image data storage, or gender preference audit storage.
- Validation: Dev server ran on `http://localhost:3001`. `agent-browser` CLI was unavailable on PATH, so Playwright was used. All 10 `/api/analyze` calls returned 200. Runtime audit `events.jsonl` contains 10 events. `node scripts/summarize-survey-input-contract-runtime-audit.mjs` passed and wrote summary JSON/MD. API responses contained no `surveyInputContract`, `contract`, or `debugContract` fields. `git diff --check` passed with LF-to-CRLF warnings only.
- Findings: `unresolvedPrimaryConcern` was 10/10 because `/api/analyze` still passes no explicit `primaryConcern` into the contract and falls back to `mainConcerns[0]`. Warnings were `primaryConcern_missing_fallback_used` 10/10 and `sunscreen_boolean_false_ambiguous` 10/10. Missing fields were `recentSkinChange` 10/10 and `recentlyChangedProduct` 10/10. Primary concern and existing priority diverged in `pores_oil_outdoor_whitecast` and `acne_redness_sensitive`, both due to scoring/safety signals overriding the first selected concern.
- Context promotion candidate: Before wiring the contract into ranking, add an explicit primary concern/goal input and answered-state metadata for sunscreen booleans; keep safety risks separate from user-stated concerns because scoring can legitimately promote redness/barrier/UV/oiliness beyond selected concerns.

### 2026-07-02 / survey input contract dev runtime audit collector

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium development-only API audit collector
- Routing decision: User requested a scoped development-only collector for `SurveyInputContract` summaries generated inside `/api/analyze`. UI changes, survey question changes, API response changes, saved payload changes, DB/schema work, ranking integration, Functional Plan UI wiring, free-result logic changes, premium storage changes, and production file writes were explicitly out of scope.
- Goal: Append sanitized contract summary events to `tmp/survey-input-contract-runtime-audit/events.jsonl` during development, provide a local summary script, and keep production as no-op.
- Changed files: app/api/analyze/route.js, lib/survey-input-contract-dev-audit.js, scripts/verify-survey-input-contract.mjs, scripts/summarize-survey-input-contract-runtime-audit.mjs, docs/architecture/survey-input-contract.md, tmp/survey-input-contract-runtime-audit/summary.json, tmp/survey-input-contract-runtime-audit/summary.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, survey question additions/deletions, API response field names, stored payload structure, DB/schema/migration/policy, recommendation ranking, Functional Plan UI, premium report storage, auth/payment/deploy/env, production data, raw form storage, image data storage, or gender preference audit storage.
- Validation: `node scripts/verify-survey-input-contract.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/audit-survey-input-contract-against-free-result.mjs` passed and rewrote the fixture audit summaries. `node scripts/summarize-survey-input-contract-runtime-audit.mjs` passed with zero runtime events and wrote summary JSON/MD. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: Runtime audit summaries remain local tmp artifacts only. The summary report is empty until real development `/api/analyze` requests append events. Existing route logs outside the new collector were not changed.
- Context promotion candidate: Development audit collectors for survey contracts must store sanitized summary-only JSONL, no raw form/image/profile data, and must no-op in production.

### 2026-07-02 / survey input contract api analyze parallel generation

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium API-internal survey contract audit hook
- Routing decision: User requested a runtime validation-only step inside `/api/analyze` that builds `SurveyInputContract` from the normalized form without UI changes, survey question changes, API response changes, saved payload changes, DB/schema work, ranking integration, Functional Plan UI wiring, free-result logic changes, or premium storage changes.
- Goal: Generate `SurveyInputContract` beside the existing free analysis path for development-only audit logging, while preserving the existing `freeResult`, premium session report, cookies, headers, and response JSON shape.
- Changed files: app/api/analyze/route.js, scripts/verify-survey-input-contract.mjs, docs/architecture/survey-input-contract.md, .codex/AI_WORK_LOG.md
- Protected areas: No API response field names, stored payload structure, DB/schema/migration/policy, UI, survey questions, recommendation ranking, Functional Plan UI, premium report storage, auth/payment/deploy/env, or production data were changed.
- Validation: `node scripts/verify-survey-input-contract.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/audit-survey-input-contract-against-free-result.mjs` passed and rewrote the tmp audit summaries. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: The audit hook intentionally runs only when `NODE_ENV === "development"` and logs a summary rather than the raw contract. Production does not create or log this dev-only contract. Existing `/api/analyze` logs outside this hook were not changed.
- Context promotion candidate: Runtime contract validation should stay summary-only and response/storage-neutral until a separate task explicitly wires the contract into ranking or premium policy.

### 2026-07-02 / survey input contract parallel audit

- Branch: codex/survey-input-contract-refactor
- Task type: verification / Medium survey contract parallel audit
- Routing decision: User requested a validation-only step that generates `SurveyInputContract` from local fixture forms and audits it against existing free-result priority/scoring expectations without UI wiring, ranking integration, API response changes, saved payload changes, or DB/schema work.
- Goal: Add a local audit script that compares current form fixtures, `buildSurveyInputContract(form)`, legacy-style freeResult priority/scoring, contract primary/secondary concerns, safety risks, warnings, and missing fields.
- Changed files: scripts/audit-survey-input-contract-against-free-result.mjs, tmp/survey-input-contract-audit/summary.json, tmp/survey-input-contract-audit/summary.md, lib/survey-input-contract.js, .codex/AI_WORK_LOG.md
- Protected areas: No UI, survey question additions/deletions, API response or request payload shape, stored payload structure, DB/schema/migration/policy, ranking implementation, Functional Plan UI connection, premium save structure, external API call, image analysis call, or Supabase write.
- Validation: `node scripts/verify-survey-input-contract.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/audit-survey-input-contract-against-free-result.mjs` passed and wrote summary JSON/MD. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only, including ignored tmp summaries via forced intent-to-add.
- Issues/risks: The audit did not import the live free-result engine because that path is tied to app alias/product-source imports; instead it uses a local survey/environment scoring mirror copied from `lib/skin-match-decision-engine.js` rules with photo score fixed at zero. The dry/dehydration fixture shows barrier as a high secondary score not present in contract concerns, which is expected from skinType/post-wash weighting and should be considered when later mapping safety/supporting goals.
- Context promotion candidate: Before runtime integration, compare contract goals against both priority axis and high secondary concern scores; high safety/supporting axes can be absent from explicit concerns and still matter.

### 2026-07-02 / survey input contract adapter

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium pure survey contract adapter
- Routing decision: User requested only a pure current-form-to-`SurveyInputContract` adapter plus Node verification script. UI changes, survey question changes, `app/page.js`, `SurveyFlow`, API payload changes, DB/schema/migration changes, recommendation ranking, Functional Plan UI wiring, premium saved payload changes, and package config changes were out of scope.
- Goal: Add `buildSurveyInputContract(form, options)` that normalizes current survey fields into `skinState`, `goals`, `safety`, `behavior`, `preferences`, `sunscreen`, `profile`, and `metadata` without connecting it to runtime flows.
- Changed files: lib/survey-input-contract.js, scripts/verify-survey-input-contract.mjs, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response/request shape, stored payload structure, DB/schema/migration/policy, ranking engine behavior, Functional Plan UI, premium report storage, auth/payment/deploy/env, or package changes.
- Validation: `node scripts/verify-survey-input-contract.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning for ESM `.js` imports. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: The adapter can only warn about current optional default ambiguity; it cannot know whether default-looking optional values were skipped or explicitly selected until the UI supplies answered/skipped metadata.
- Context promotion candidate: Keep `genderPreference` profile/eligibility-only and keep sunscreen false booleans marked ambiguous until the survey captures explicit answered state.

### 2026-07-02 / survey input contract audit

- Branch: codex/survey-input-contract-refactor
- Task type: design / Medium survey input contract audit
- Routing decision: User requested a pre-UI-refactor investigation and contract draft only. UI changes, DB/schema/migration changes, ranking implementation, Functional Plan UI wiring, saved payload shape changes, and question add/delete implementation were out of scope.
- Goal: Audit the current 11-question survey field/value inventory, free/premium payload flow, scoring/priority generation, sunscreen and gender field handling, photo/no-photo behavior, and currentProducts premium entry linkage; propose a future `SurveyInputContract` split into skinState, goals, safety, behavior, preferences, sunscreen, profile, and metadata.
- Changed files: docs/architecture/survey-input-contract.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, DB/schema/migration/policy, storage payload structure, recommendation ranking, current-products policy, premium UI connection, auth/payment/deploy/env, or package changes.
- Validation: `git diff --check` passed with LF-to-CRLF warnings only. Build was not run because this is a documentation-only change.
- Issues/risks: Current optional survey defaults erase skipped/unknown state; current free result does not expose `answers`, so premium current-products verdicts entered after free analysis lose full survey context; no-photo analysis is not currently implemented.
- Context promotion candidate: Survey contracts should preserve skipped/unknown state separately from legacy defaults before feeding ranking, functional decisions, or premium current-product policy.

### 2026-06-30 / premium beta flow

- Branch: feature/premium-beta-flow
- Task type: execution / High premium access, private save, and My reopen flow
- Routing decision: User requested implementation after a read-only audit of free CTA -> premium route -> login/access -> current products -> full-report API -> saved_reports -> My latest reopen, while excluding payment integration, DB migrations, public premium sharing, Face Lab generation, scoring/ranking, My diary/check-in, and protected production data.
- Goal: Let beta-open account users create a premium report from the free result, choose current products before opening it, save the premium snapshot privately, and reopen the latest premium report from My without requiring creation entitlement for existing reports.
- Changed files: app/api/full-report/route.js, app/api/premium/access/route.js, app/result/full-report/page.js, app/result/page.js, components/my/MyDashboard.jsx, components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx, docs/architecture/premium-beta-flow-v1.md, lib/my/dashboard.js, lib/premium-access.js, lib/premium-current-products.js, .codex/AI_WORK_LOG.md
- Protected areas: No payment provider integration, DB schema/migration, public premium share route, Face Lab algorithm/prompt/input contract, recommendation scoring/ranking, current-products verdict policy, My diary/check-in/trend feature, auth callback policy, or product metadata rewrite.
- Validation results: `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only. Local dev smoke on port 3002 verified `/result/full-report` at 390px shows the current-products premium entry with horizontal overflow false, `/result/full-report?access=payment_required` shows the official-open notice, and console/page errors were 0 in the smoke. `/api/premium/access` unauthenticated returned `login_required` with default `beta_open`; a separate dev server with `PREMIUM_RELEASE_MODE=paid_only` returned `login_required` and `paid_only`. Free `/api/analyze` returned 200 without public `premiumReport`, `faceLabSummary`, or `faceLab`.
- Notes/risks: Premium creation access is server-enforced in `/api/full-report`; saved premium reopen is owner-only through `saved_reports.user_id` and does not call the creation access resolver. Entitlement currently uses trusted Supabase `app_metadata` because no existing paid entitlement table was found. Full account-login E2E save/reopen and paid/admin entitlement E2E were not completed because no non-anonymous test account/session was available in this workspace.
- Context promotion candidate: Premium creation gating and saved premium reopen permission are separate: release mode blocks new generation only, while owner saved reports remain reopenable.

### 2026-06-30 / premium beta preview copy follow-up

- Branch: feature/premium-beta-flow
- Task type: execution / Medium premium preview UI state correction
- Routing decision: User requested a scoped preview UI correction on the existing premium beta branch. Access resolver, premium save, currentProducts verdict logic, payment, DB schema, and stored premium reopen permission were out of scope except for reusing the existing route.
- Goal: Remove the stale coming-soon/disabled paid-report preview state from the free result and show an active Premium Beta CTA that enters the existing premium route.
- Changed files: app/result/full-report/page.js, components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: No payment integration, DB migration, access resolver rewrite, premium save rewrite, currentProducts verdict policy, Face Lab logic, recommendation/scoring, or My saved-report reopen logic changes.
- Validation results: Initial `npm run build` failed because `useSearchParams()` in `app/result/full-report/page.js` needed a Suspense boundary after the previous branch implementation. Added a Suspense fallback around `FullReportPageContent`; rerun `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only. Fresh dev server on port 3005 verified actual `/result` after seeding a real result session: step 5 shows `PREMIUM BETA`, active `이 결과를 루틴으로 정리하기`, no `곧 공개 예정` / `준비 중입니다` / `Coming soon`, disabled button count 0, horizontal overflow false, console/page errors 0. CTA click while logged out opens Google OAuth with `next=/result/full-report`; direct `/result/full-report` at 390px shows currentProducts entry, overflow false, console/page errors 0. `/result/full-report?access=payment_required` shows the paid-only beta-ended copy.
- Notes/risks: Non-anonymous login E2E remains unverified in this workspace, as noted in the parent premium beta flow log.
- Context promotion candidate: NULL

### 2026-06-30 / local auth redirect origin guard

- Branch: feature/premium-beta-flow
- Task type: diagnostic execution / auth redirect origin consistency
- Routing decision: User reported that logged-in local flows were ending on the Vercel deployment origin. The task was scoped to diagnosis and minimum code changes, with Supabase Dashboard, Google OAuth settings, DB migrations, premium access policy, and payment out of scope.
- Goal: Ensure client-started Google OAuth redirects are built only from the current browser origin so localhost flows do not fall back to `NEXT_PUBLIC_SITE_URL`.
- Changed files: app/result/page.js, components/auth/LoginButtons.jsx, components/result/SaveReportCTA.jsx, .codex/AI_WORK_LOG.md
- Protected areas: No Supabase URL configuration, Google OAuth configuration, DB schema/migration, premium access resolver, currentProducts, saved report, or API response contract changes.
- Validation results: `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only. Static search now shows client OAuth helpers no longer read `NEXT_PUBLIC_SITE_URL`; only `app/layout.js` uses it for metadata. A direct Supabase OAuth URL generated from local env includes `redirect_to=http://localhost:3001/auth/callback?next=%2Fresult` and does not include the Vercel host. However, actual in-app browser login from `http://localhost:3001/result` still returns to `https://k-beauty-two.vercel.app/?code=...`, which indicates Supabase Auth is rewriting/rejecting the localhost callback outside app code.
- Notes/risks: Code now removes the `NEXT_PUBLIC_SITE_URL` fallback from client OAuth redirect origin helpers. The remaining localhost-to-Vercel redirect is not fixed by code because the app is already sending `redirect_to=http://localhost:3001/auth/callback`; Supabase must allow that callback URL for local login E2E to complete.
- Context promotion candidate: NULL

### 2026-06-29 / free analysis loading layout

- Branch: feature/free-analysis-loading-layout
- Task type: execution / Medium onboarding loading layout fix
- Routing decision: User requested a scoped loading-only layout adjustment after clean main sync and branch creation. Survey flow, analysis API, result rendering, Face Lab, premium report, My Skin, auth, recommendation logic, score formula, DB, and migrations were out of scope.
- Goal: Center the free analysis loading card in the header-adjusted viewport, remove the nested card visual from the spinner, and keep spinner, loading title, helper text, and progress dots in one clear waiting panel.
- Changed files: app/page.js, components/onboarding/LoadingStep.js, .codex/AI_WORK_LOG.md
- Protected areas: No API route, SurveyFlow, free result, full report, My Skin, auth, recommendation engine, DB/schema, Face Lab, or analysis state/response logic changes.
- Validation results: `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only. Playwright verified the `/en` onboarding flow at 390px and desktop widths: loading card sits near viewport center below the header, spinner/title/body/dots render, nested loading card count is 0, horizontal overflow false, console/page errors 0, and mocked analysis completion navigates to the result page. A real local `/api/analyze` POST returned 200 and preserved the expected free result response shape.
- Notes/risks: Loading viewport uses `100svh` plus a loading-only flex wrapper so mobile browser chrome changes are less jumpy than fixed margins.
- Context promotion candidate: NULL

### 2026-06-29 / premium Face Lab section

- Branch: feature/premium-face-lab-section
- Task type: execution / Medium premium report companion-section connection
- Routing decision: User requested a scoped paid full-report Face Lab section and data contract while explicitly excluding `/api/face-reading` algorithm/prompt/input changes, Skin Match survey/result calculation changes, recommendation/product/payment changes, and DB schema migration.
- Goal: Add a premium-safe Face Lab adapter and full-report section that renders existing image + locale based Face Lab results when available and shows a quiet fallback for missing or legacy premium reports.
- Changed files: app/api/analyze/route.js, app/api/full-report/route.js, app/result/full-report/page.js, components/full-report/PremiumFaceLabSection.jsx, docs/architecture/premium-face-lab-contract-v1.md, lib/premium-face-lab.js, .codex/AI_WORK_LOG.md
- Protected areas: No `/api/face-reading` algorithm, prompt, or input contract changes. No Skin Match survey, priority/score generation, recommendation scoring/ranking, Top Pick/supportingProducts, sunscreen scoring, currentProductVerdicts, functionalDecisions, conditionResponses, payment flow, DB schema/migration, image upload flow, or free result UI changes.
- Validation results: `npm run build` passed. `git diff --check` passed with existing LF-to-CRLF warnings only. Playwright at 390px verified `/en/test-full-report` Face Lab available fixture renders image, title/summary, 4 keywords max, 3 style directions max, no horizontal overflow, no undefined text, no purchase/price/store copy, no banned medical/fortune/personality words, console errors 0, page errors 0. Playwright at 390px verified an `/en/result/full-report` legacy/missing Face Lab fixture shows the quiet unavailable fallback, no broken images, no undefined text, other full-report shell still renders, no horizontal overflow, console errors 0, page errors 0. Free `/api/analyze` POST returned 200 without `premiumReport`, `faceLabSummary`, `faceLab`, or paid-only decision fields in the public JSON.
- Notes/risks: Saved premium report requery was verified by code path: `premium_report_sessions.premium_report.faceLabSummary` is sanitized when present, old `faceLab` payloads can be adapted, and missing legacy fields fall back to unavailable. Current authenticated E2E save/requery was not run. Initial Playwright scripts failed from local script encoding/selector timing, then were corrected and passed.
- Context promotion candidate: Paid Face Lab should remain an image + locale companion section and must not consume Skin Match survey, score, priority axis, current products, or recommendation outputs as Face Lab generation input.

### 2026-06-29 / premium Face Lab P2 audit fixes

- Branch: feature/premium-face-lab-section
- Task type: focused execution / P2 audit follow-up
- Routing decision: User requested only the two read-only audit P2 fixes: prevent empty raw Face Lab objects from becoming available, and persist newly derived valid `faceLabSummary` into the existing premium report session when authorized.
- Goal: Require a real display signal before `available`, and merge a sanitized available `faceLabSummary` into `premium_report_sessions.premium_report` without changing Face Lab generation, Skin Match, recommendation, payment, or DB schema.
- Changed files: lib/premium-face-lab.js, app/api/full-report/route.js, lib/premium-report-session.js, docs/architecture/premium-face-lab-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No `/api/face-reading`, app/page.js, SurveyFlow, free result UI, recommendation engine, score formula, DB schema/migration, image upload, Face Lab prompt, currentProductVerdicts, functionalDecisions, conditionResponses, or payment flow changes.
- Validation results: `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only. Adapter-level checks confirmed `{}`, `{ base_data: {} }`, `{ features: {} }`, `{ base_data: {}, features: {} }`, and image-only return `unavailable`; non-empty `base_data.impressionTitle`, keyword, styleDirection, and legacy raw Face Lab text return `available`. 390px Playwright verified `/test-full-report` available and custom unavailable, legacy-missing, and legacy-faceLab cases with no broken images, no overflow, console errors 0, page errors 0. Free `/api/analyze` 200 response did not include `faceLabSummary`, `faceLab`, or `premiumReport`.
- Notes/risks: Persist behavior was verified by code path, not live authenticated E2E. The update helper reuses the signed premium report cookie, re-verifies the session id, and updates only the merged `premium_report` JSON. Stored available summaries are not overwritten; invalid request Face Lab does not write unavailable over stored data.
- Context promotion candidate: Persist derived premium Face Lab summaries only after signed premium session verification, and only when the stored summary is missing/unavailable and the derived summary is available.

### 2026-06-28 / premium current products verdicts

- Branch: feature/premium-current-products-verdicts
- Task type: execution / High premium report data-contract addition
- Routing decision: User requested a scoped paid full-report feature that adds usage verdicts for current products without changing free result, survey, recommendation ranking, score formula, product DB, currentProducts input, Face Lab, payment, or DB schema.
- Goal: Add paid-report-only current product verdict data and render small verdict summaries near existing routine consult current product slot notes while preserving currentProducts registration status semantics.
- Changed files: app/api/analyze/route.js, app/result/full-report/page.js, components/full-report/PremiumRoutineConsultSection.jsx, components/result/premium/CurrentProductSlotNote.jsx, docs/architecture/current-products-verdict-contract-v1.md, lib/current-product-verdicts.js, lib/skin-match-decision-engine.js, lib/test-result-fixture.js, .codex/AI_WORK_LOG.md
- Protected areas: No Top Pick, supportingProducts, product ranking, score formula, product-source, category semantics, review-signals definitions, sunscreen hard filter/score, currentProducts input or slot-building logic, free result, SurveyFlow, Face Lab, payment, DB/schema, or replacement-product CTA changes.
- Validation results: `npm run build` passed. `git diff --check` passed. Helper-level fixtures produced `keep`, `adjust`, conservative `hold`, `check_needed` for selected snapshot null, `check_needed` for `not_in_db`, and no verdict for `not_using`. Korean 390px Playwright `/test-full-report` opened the paid report, navigated to routine consult, switched AM/PM, verified sunscreen `not_in_db` remains in the protection step with `check_needed`, cleanser selected shows `adjust`, moisturizer `not_using` keeps the empty slot with no verdict badge, horizontal overflow false, console errors 0, page errors 0.
- Notes/risks: The verdict engine intentionally uses only premium-report-available current product fields plus survey/priority context. Strong `hold` is conservative; missing DB or snapshot information falls back to `check_needed`. A selected `productSnapshot: null` visible-slot fallback was verified by helper code path because treatment visible-slot rendering still requires existing product form semantics, and that slot-building rule was intentionally left unchanged.
- Context promotion candidate: NULL

### 2026-06-28 / premium current products verdict safety follow-up

- Branch: feature/premium-current-products-verdicts
- Task type: execution / focused verdict safety fix
- Routing decision: User requested only two fixes after read-only audit: remove product name/brand based `hold` triggers and make verdict slot resolution reuse the existing currentProducts semantics without changing slot-building rules.
- Goal: Restrict `hold` to structured active metadata/signals plus barrier/redness/acne conflict, and avoid orphan verdicts by generating verdicts only for slots resolved by `lib/current-products.js`.
- Changed files: lib/current-product-verdicts.js, lib/current-products.js, lib/test-result-fixture.js, docs/architecture/current-products-verdict-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No app/api/analyze, full-report UI components, skin-match decision engine call site, recommendation scoring, Top Pick, supportingProducts, sunscreen scoring, free result, SurveyFlow, DB/schema, or currentProducts slot-building rule changes.
- Validation results: `npm run build` passed. `git diff --check` passed. Helper-level checks confirmed product name-only `Retinol Cream` and `AHA Toner` do not produce `hold`; structured `key_ingredients: ["retinol"]` plus barrier priority still produces `hold`; barrier priority without structured active signal produces `adjust`, not `hold`; visible cleanser/moisturizer/sunscreen slot keys match UI slot keys; treatment with missing `product_form` produces no verdict; `not_in_db` and sunscreen `not_in_db` produce `check_needed`; `not_using` and sunscreen `not_using` produce no verdict. Korean 390px Playwright `/test-full-report` verified AM/PM switch, 3 cards per mode, existing sunscreen `check_needed` and cleanser `adjust` displays, moisturizer `not_using` without verdict, overflow false, console errors 0, page errors 0.
- Notes/risks: Node helper checks use the existing local alias loader because the verdict module imports app aliases. The test fixture keeps the missing-form treatment current product input but no longer has active slot verdicts for it.
- Context promotion candidate: NULL

### 2026-06-28 / premium routine section refactor

- Branch: feature/premium-routine-section-refactor
- Task type: execution / Medium premium full report structure refactor
- Routing decision: User requested a scoped structural split of only the paid full report routine consult section. Recommendation engine, currentProducts verdict logic, premium payload shape, saved report flow, free result, survey, Face Lab, DB/schema, and unrelated sections were left untouched.
- Goal: Move routine consult AM/PM state, step cards, current product slot notes, and CTA rendering out of `app/result/full-report/page.js` into a premium-specific component while keeping the existing UI result and data preparation path.
- Changed files: app/result/full-report/page.js, components/full-report/PremiumRoutineConsultSection.jsx, .codex/AI_WORK_LOG.md
- Protected areas: No Top Pick, supportingProducts, score formula, product ranking, routineStructure generation, currentProducts slot-building rules, premium report shape, saved-report schema, payment flow, functional judgment, condition response, Face Lab, free result, survey, or DB/schema changes.
- Validation results: `npm run build` passed. `git diff --check` passed. 390px Playwright full report flow opened `/test-full-report`, entered routine consult, verified AM/PM tab switch, 3 routine cards per mode, no horizontal overflow, console errors 0, page errors 0. Fixture covered `sunscreen not_in_db`, `moisturizer not_using`, `cleanser selected`, and `serum selected` with null `productSnapshot`; rendered text confirmed sunscreen `not_in_db` stays in the protection step as currently using and moisturizer `not_using` renders as an empty moisture finish step.
- Notes/risks: In-app browser viewport override bottomed out at 520px, so the 390px verification was completed with local Playwright against the same dev server. Direct Node import of `buildCurrentProductRoutineSlots` was blocked by the app `@/` alias outside Next runtime, so `productSnapshot` fallback was checked by code path plus rendered fixture behavior rather than standalone function import.
- Context promotion candidate: NULL

### 2026-06-28 / survey contract cleanup v1

- Branch: feature/survey-contract-cleanup-v1
- Task type: execution / Medium survey contract cleanup
- Routing decision: User requested a scoped cleanup of free Skin Match survey UI, payload, recommendation gender scoring, legacy compatibility, cleansingFrequency contract confirmation, and a new architecture contract doc. Existing crawler/ranking and previous branch changes were present before this task and were left untouched.
- Goal: Remove 신규 무료 설문의 `fragranced`, 일반 `pilling`, and gender question; stop sending/using `genderPreference` in new free analysis requests; remove gender-based product score adjustment; preserve legacy payload tolerance and sunscreen `makeupUse` + `pilling_risk`; document the survey contract.
- Changed files: app/api/analyze/route.js, app/page.js, app/result/page.js, components/onboarding/BasicSurveyStep.js, components/onboarding/SurveyFlow.js, components/onboarding/constants.js, docs/architecture/survey-contract-v1.md, lib/recommendation-scoring.ts, lib/skin-match-decision-engine.js, lib/skin-profile-summary.js, .codex/AI_WORK_LOG.md
- Protected areas: No product-source, product-category-normalizer, review-signals, category semantics, product DB/schema, Face Lab API/calculation, premium report UI, routineStructure generation, or sunscreen hard filter/score changes.
- Validation results: `npm run build` passed. `git diff --check` passed. Korean 390px Playwright survey flow completed without the gender question, without `fragranced` or general `pilling` options, with no horizontal overflow and console/page errors 0. New free analyze FormData did not include `genderPreference`. `/api/analyze` returned 200 for new no-gender payload and legacy `genderPreference`, `mostDislikedFeel: fragranced`, and `mostDislikedFeel: pilling` payloads. `cleansingFrequency: 3_plus` preserved the existing barrier +3 and dehydration +2 score delta. Function-level scoring check confirmed female/male/unspecified scores are identical and sunscreen `makeupUse` + high `pilling_risk` remains rejected.
- Notes/risks: `review-signals.js` still has its pre-existing legacy `mostDislikedFeel: pilling` path and was intentionally not edited because the user marked review-signals out of scope.
- Context promotion candidate: NULL

### 2026-06-28 / free result Decision Bundle display audit fixes

- Branch: feature/free-result-decision-bundle-alignment
- Task type: execution / small scoped display and payload fix
- Routing decision: User requested edits only in the free-result Decision Bundle display scope. Existing recommendation/category semantics changes were explicitly out of scope and were not modified, staged, restored, stashed, reset, or committed.
- Goal: Make Top 1 priority title prefer API `priority.label`, minimize free API `scoring` payload to `concernScores[axis].total`, and make incomplete AM/PM routine preview data fall back per time period instead of rendering empty cards.
- Changed files: app/api/analyze/route.js, app/result/page.js, lib/result/free-result-v2-static-builders.js, .codex/AI_WORK_LOG.md
- Protected areas: No recommendation score formula, Top Pick, supportingProducts, product candidate pool, routineStructure generation, premium report shape, currentProducts, survey, Face Lab, DB/schema, or category/review-signal files were edited.
- Validation results: `npm run build` passed. `git diff --check` passed. Korean 390px Playwright verification passed with API `priority.label` visible as the Top 1 title, free API `scoring` containing only `concernScores` and per-axis `total`, AM/PM routine preview showing 3 cards each, incomplete AM routineStructure falling back only on the morning side, overflow false, console errors 0, page errors 0.
- Notes/risks: Per-period routine fallback uses legacy static preview only for the incomplete AM or PM side; valid API-derived side remains intact.
- Context promotion candidate: NULL

### 2026-06-27 / free result Decision Bundle display alignment

- Branch: feature/free-result-decision-bundle-alignment
- Task type: execution / Medium result display data-source alignment
- Routing decision: User requested a scoped free-result display change after a clean main sync and feature branch creation. API generation logic, recommendation scoring, Top Pick, supportingProducts, premium report structure, currentProducts, survey questions, Face Lab, DB, env, auth, payment, deployment config, and `docs/architecture/survey-calculation-audit.md` were out of scope.
- Goal: Make free-result priority TOP 3, skin radar/status tags, and routine preview prefer the actual `/api/analyze` Decision Bundle source fields: `priority`, `scoring.concernScores`, and `routineStructure`.
- Changed files: app/api/analyze/route.js, app/result/page.js, components/result/free-v2/FreeResultV2DiagnosisStep.jsx, lib/result/free-result-v2-static-builders.js, .codex/AI_WORK_LOG.md
- Protected areas: No env, DB schema/migration/policy, auth, payment, production data, deployment config, product DB, recommendation formula, Top Pick/supportingProducts selection, premium report shape, currentProducts, survey copy/options, Face Lab, or routineStructure generation edits. API response pass-through was limited to exposing already-computed `decision.scoring.concernScores` because the requested UI source-of-truth requires that field.
- Validation results: `npm run build` passed. 390px Playwright verification passed on `/en/result` for 8 API-generated survey combinations with TOP 3 labels matched to API `priority` + sorted `scoring.concernScores`, radar labels present from API scores, AM/PM routine preview matched `routineStructure.am/pm.label` and `strategyLine`, horizontal overflow false, console errors 0, page errors 0. `git diff --check` passed.
- Notes/risks: Free radar maps API scores into five display axes; sensitivity uses the higher of API redness/acne totals. Legacy saved results without `scoring.concernScores`, `priority`, or `routineStructure` still use existing local/static fallbacks.
- Context promotion candidate: NULL

### 2026-06-27 / free result routine preview step-card restore

- Branch: feature/free-result-decision-bundle-alignment
- Task type: execution / Medium free-result UI display fix
- Routing decision: User requested the browser comment fix first, scoped to the free result routine preview UI. Recommendation engine, score formula, Top Pick, supportingProducts, routineStructure generation, API analyze calculation, premium report shape, currentProducts, survey payload/questions, Face Lab, DB, and broad design changes were out of scope.
- Goal: Keep API `routineStructure` as the source for AM/PM mode and strategy, but restore 2-3 user-facing routine step cards instead of rendering internal labels such as `아침 전략` as a single card.
- Changed files: lib/result/free-result-v2-static-builders.js, .codex/AI_WORK_LOG.md
- Protected areas: No API calculation, routineStructure generation, recommendation, product ranking, premium report, currentProducts, DB, auth, env, deployment, or survey changes.
- Validation results: `npm run build` passed; `git diff --check` passed. Korean 390px `/test-result` legacy fallback showed morning steps `가볍게 정돈 / 수분 유지 / 자외선 차단` and night steps `순한 세안 / 수분 보충 / 장벽 안정`, overflow false, console/page errors 0. Korean 390px `/result` with a fresh `/api/analyze` result showed API routine modes `fresh_control / pore_texture_care`, morning steps `가볍게 정돈 / 유분 조절 / 답답함 줄이기`, night steps `순하게 정리 / 모공·결 정돈 / 진정 보습`, overflow false, console/page errors 0.
- Notes/risks: Current public `routineStructure` does not expose detailed step arrays, so the free preview uses explicit step intent/purpose arrays when present and otherwise maps API AM/PM `mode` into short action labels. Insufficient legacy structures fall back to the existing static preview.
- Context promotion candidate: NULL

### 2026-06-22 / Hwahae ranking Top 50 gateway collector

- Branch: main
- Task type: execution / Medium crawler collector change
- Routing decision: User requested investigation and implementation for extending verified Hwahae ranking collection from JSON-LD Top 20 to Top 50. No DB schema change was needed; existing migrations and products data were not modified.
- Goal: Reuse the `review_prepare` Chrome/CDP profile approach for investigation, verify Korean Hwahae ranking pagination for essence/ampoule/serum All and Trouble, then enable only those verified Top 50 jobs.
- Changed files: crawler/hwahae.ts, crawler/config/ranking-jobs.json, .codex/AI_WORK_LOG.md
- Protected areas: No .env edits, no migration edits, no auth/payment/policy/deployment edits, no products insert/update/delete path added, no promotion/enrich execution.
- Validation results: Korean `.co.kr` page opened through `npm run review_prepare` Chrome remote debugging profile. Scroll triggered `https://gateway.hwahae.co.kr/v14/rankings/{themeId}/details?page=2..5&page_size=20`. Direct normal browser dry-runs and `--cdp-url=http://127.0.0.1:9222` dry-run collected 50/50 for verified jobs. Top 50 snapshots had contiguous ranks 1-50 and duplicate product count 0. JSON-LD first 20 matched gateway page 1 order by product/goods URL id. `npm run test:ranking-ingest` passed, `npm run typecheck` passed, `npm run crawl -- --dry-run` passed, `git diff --check` passed. products count stayed 164 before/after.
- Error log: Initial investigation incorrectly used English `/en` page; corrected to Korean `.co.kr` after user feedback because locale can affect DOM/URL/payload. Initial implementation used `page.evaluate(fetch(...))` and dry-run failed with `TypeError: Failed to fetch` from Hwahae browser fetch wrappers; collector was changed to `page.request.get(...)` with referer while still using the browser context.
- Notes/risks: The Top 50 collector depends on Hwahae gateway `v14/rankings/{themeId}/details` response shape. Existing JSON-LD Top 20 remains fallback for jobs with requested_limit <= 20 or pages where JSON-LD already satisfies the requested limit.
- Context promotion candidate: For Hwahae rankings, Korean `.co.kr` should be the source of truth for URL/pagination verification unless a task explicitly targets global `/en` pages.

### 2026-06-22 / Hwahae category concern job matrix

- Branch: main
- Task type: execution / Medium crawler config and validation change
- Routing decision: User explicitly requested a fixed Hwahae ranking job matrix and validation, with no products writes and no existing migration edits. DB schema/migration changes were not needed.
- Goal: Replace ad hoc Hwahae ranking jobs with a 9 category x 9 ranking context matrix, preserve essence/ampoule/serum as one source category, and keep jobs disabled unless URL/filter/pagination/parser verification is complete.
- Changed files: crawler/config/ranking-jobs.json, crawler/lib/supabase.ts, crawler/lib/review.ts, crawler/test-ranking-ingest.ts, .codex/AI_WORK_LOG.md
- Protected areas: No .env edits, no migration edits, no auth/payment/policy/deployment edits, no production data writes, no products insert/update/delete path added, no promotion/enrich execution.
- Validation results: `npm run test:ranking-ingest` passed, `npm run typecheck` passed after one test-only null narrowing fix, `git diff --check` passed, `npm run crawl -- --dry-run` passed with products writes 0 and 0 enabled jobs, products count stayed 164 before/after. Playwright checks for essence/ampoule/serum All theme_id 4174 and Blemishes theme_id 4181 returned HTTP 200 twice, page H1/category matched, JSON-LD ItemList had rank positions 1-20 only.
- Error log: Initial Playwright verification waited for JSON-LD scripts with default visible state and timed out even though locator resolved to 3 script tags; rerun used `state: attached` and passed. Initial products-write rg command had a PowerShell quoting regex parse error; rerun with fixed patterns returned no matches. Initial typecheck failed with `test-ranking-ingest.ts(340,15): 'config.disabledReason' is possibly 'null'`; fixed test assertion with optional chaining.
- Notes/risks: Hwahae Next data reports pagination metadata but page=2 URL and Next data URL still returned page 1 / first 20, so Top 50/100 pagination remains unverified. Gel, balm, and sunscreen do not expose all requested concern themeIds in the observed rankingsCategories tree, so those matrix jobs are retained disabled with explicit reasons.
- Context promotion candidate: Ranking jobs may preserve source_product_form as source observation metadata even when service_category already encodes the form; review/enrichment should decide product_form finalization separately from ranking collection.

### 2026-06-21 / Hwahae ranking Phase 1 snapshot pipeline

- Branch: redesign-bejewely-first-screen
- Task type: limited implementation
- Routing decision: High DB schema/data-flow change with explicit user approval for a forward-only migration. Existing migration files, promotion RPC behavior, products data, auth, payment, policies, and deployment config were not modified.
- Goal: Implement Phase 1 ranking collection so Hwahae ranking results accumulate through ranking_snapshots -> source_rankings -> product_candidates without direct products writes.
- Changed files: supabase/migrations/20260621030000_phase1_ranking_snapshot_pipeline.sql, crawler/hwahae.ts, crawler/lib/supabase.ts, crawler/lib/ranking-config.ts, crawler/lib/snapshot.ts, crawler/lib/ranking-ingest.ts, crawler/config/ranking-jobs.json, crawler/test-ranking-ingest.ts, crawler/package.json, crawler/README.md, data/hwahae/README.md, docs/ranking-pipeline.md, .gitignore, .codex/AI_WORK_LOG.md
- Protected areas: No .env edits, no auth/payment/policy/deployment edits, no production data write, no products insert/update path added, no promotion RPC change, no automatic promotion or automatic product tag finalization.
- Validation plan: crawler ranking ingest smoke test, crawler typecheck, SQL/code search for products writes in the Phase 1 crawler path, and dry-run command if browser/network dependencies allow it.
- Notes/risks: Existing source_rankings/product_candidates base table creation migration is not present in the repo, so the Phase 1 migration extends existing deployed tables with if-not-exists DDL. Fallback candidate identity without external_id remains non-unique by design and unresolved multiple matches are reported as pending identity collisions.
- Context promotion candidate: Candidate rule to keep rankingFilter as source observation metadata, not product concern/tag metadata.

## 목적

이 문서는 AI 에이전트 작업 이력을 단순 보관하지 않고, 성공한 작업 패턴과 에러·실패·회귀에서 얻은 교훈을 함께 수집해 재사용 가능한 운영 규칙과 상위 문서 승격 후보를 추출하기 위한 로그다.

작업 유형의 판단 기준은 `.codex/AI_ROUTER.md`를 따른다.

---

## 기록 대상

Medium 이상 작업 또는 문제가 발생한 작업만 기록한다.

기록 대상:
- 라우팅 판단
- 변경 범위
- 보호 구역
- 검증 결과
- 문제/주의점
- 재사용할 규칙
- 규칙 승격 후보
- Context 반영 후보

---

## 작업 로그 형식

### YYYY-MM-DD / 작업명

- 브랜치:
- 작업 유형:
- 라우팅 판단:
- 목표:
- 변경 파일:
- 보호 구역:
- 검증 결과:
- 문제/주의점:
- 다음 작업:
- 재사용할 규칙:
- 규칙 승격 후보:

### 2026-06-20 / Bejewely first screen design guide application

- 브랜치: redesign-bejewely-first-screen
- 작업 유형: 실행형
- 라우팅 판단: 첨부 디자인 가이드의 시스템을 기존 첫 화면에 적용하는 Medium UI 작업. API, DB, 저장 데이터 구조, 인증, 결제, 배포 설정은 범위에서 제외.
- 목표: 첫 화면에서 피부 분석 서비스, 촬영 필요, 맞춤 제품 추천 제공을 3초 안에 이해하도록 제목/얼굴 가이드/CTA/보조 버튼/스텝/촬영 조건의 시각 우선순위를 재정렬.
- 변경 파일: app/globals.css, app/page.js, components/onboarding/PhotoUploadStep.js, .codex/AI_WORK_LOG.md
- 보호 구역: .env, 인증/권한/리다이렉트, DB schema/migration/policy, 결제, 개인정보/production data, API response field names, 저장 데이터 구조, 배포 설정, 패키지 대규모 변경은 수정하지 않음.
- 검증 결과: `npm run build` 성공. `npm run lint`는 프로젝트 ESLint 설정 부재로 Next 대화형 설정 프롬프트가 떠서 중단됨. 로컬 dev 서버 `http://localhost:3001` 200 확인. Playwright 390px 검증에서 라이트/다크 모두 BEJEWELY, 제목, 촬영 CTA, 사진 선택, Step 1-3, 촬영 조건 노출 확인, Next 오류 오버레이 0, console error 0. 스크린샷 `.codex/light-first-screen.png`, `.codex/dark-first-screen.png` 확인.
- 문제/주의점: Playwright MCP REPL은 다른 Playwright 캐시를 참조해 브라우저 실행에 실패하여 프로젝트 `node` 컨텍스트에서 검증 스크립트를 실행함. `.codex/first-screen-verify.json`은 검증 산출물.
- 다음 작업: 실제 기기 카메라 권한 플로우는 브라우저 보안 정책/디바이스 권한에 따라 별도 수동 확인 필요.
- 재사용할 규칙: 첫 화면 CTA는 촬영/사진 선택을 주 행동으로 두고, 다음 단계 CTA는 사진 선택 후에만 노출한다.
- 규칙 승격 후보: Candidates

### 2026-06-20 / Bejewely first screen brand reinforcement

- 브랜치: redesign-bejewely-first-screen
- 작업 유형: 실행형
- 라우팅 판단: 기존 첫 화면 레이아웃과 CTA 우선순위는 유지하고 브랜드 컬러 체감만 높이는 Medium UI 미세 조정. API, DB, 저장 로직, 인증, 결제, 배포 설정은 범위에서 제외.
- 목표: 가독성 90과 CTA 존재감을 유지하면서 Light Mode의 브랜드성 부족을 보완.
- 변경 파일: app/globals.css, components/onboarding/PhotoUploadStep.js, .codex/AI_WORK_LOG.md
- 보호 구역: .env, 인증/권한/리다이렉트, DB schema/migration/policy, 결제, 개인정보/production data, API response field names, 저장 데이터 구조, 배포 설정, 패키지 대규모 변경은 수정하지 않음.
- 검증 결과: 첫 `npm run build`는 실행 중인 Next dev/build 산출물 충돌로 `.next/server/pages-manifest.json` ENOENT 발생. 프로젝트 Next 프로세스만 종료하고 `.next` 생성물을 정리한 뒤 `npm run build` 성공. `git diff --check -- app/globals.css components/onboarding/PhotoUploadStep.js` 통과. dev 서버는 3001 대신 3125 포트로 기동되어 `http://127.0.0.1:3125` 200 확인. Playwright 390px 검증에서 라이트/다크 모두 브랜드명, 제목, 촬영 CTA, 사진 선택, Step, 촬영 조건 노출 확인, Next 오류 오버레이 0, console error 0. 스크린샷 `.codex/light-first-screen-brand-v2.png`, `.codex/dark-first-screen-brand-v2.png` 확인.
- 문제/주의점: 다크 전환 시 Light background-image가 남는 문제가 한 차례 확인되어 `ui-page-shell`의 dark 배경도 gradient로 명시해 수정함.
- 다음 작업: 실제 기기 카메라 권한 플로우는 별도 수동 확인 필요.
- 재사용할 규칙: Light Mode 브랜드 강화는 배경/링/스텝 라인/브랜드명 강도만 올리고, CTA 크기와 정보 구조는 유지한다.
- 규칙 승격 후보: Candidates

### 2026-06-21 / survey flow architecture split and optional result path

- 브랜치: redesign-bejewely-first-screen
- 작업 유형: 실행형
- 라우팅 판단: 설문 화면의 기존 디자인 톤과 흐름은 유지하고 컴포넌트 경계, required helper, optional result action, current products wrapper를 추가하는 Medium UI/architecture 작업. 첫 화면 PhotoUploadStep, 추천 로직, API 응답, DB, 인증, 결제, 저장 데이터 구조는 범위에서 제외.
- 목표: 설문 질문 카드/선택지/진행률/팁/푸터 액션을 분리 가능한 컴포넌트 단위로 정리하고, 필수 질문 완료 후 선택 질문에서 결과 보기 흐름을 지원할 수 있게 준비.
- 변경 파일: components/onboarding/SurveyFlow.js, components/onboarding/SurveyCurrentProducts.jsx, app/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: .env, 인증/권한/리다이렉트, DB schema/migration/policy, 결제, 개인정보/production data, API response field names, 저장 데이터 구조, 배포 설정, 추천 로직은 수정하지 않음.
- 검증 결과: `npm run build` 성공. `git diff --check -- components/onboarding/SurveyFlow.js components/onboarding/SurveyCurrentProducts.jsx app/page.js` 통과. dev 서버 `http://localhost:3001` 200 확인. Playwright 390px에서 사진 업로드 -> 설문 진입 -> 필수 질문 3개 선택 -> 선택 질문 진입 확인. 필수 완료 전 `결과 보기` 미노출, 필수 완료 후 선택 질문에서 `결과 보기` 노출 확인. 이전 버튼으로 필수 질문 복귀 확인. progress bar width 증가 확인. Current products 영역 렌더링 확인. Light/Dark screenshot 확인, Next error overlay 0, console error 0.
- 문제/주의점: 현재 사용 중 제품 API/추천 반영 로직은 건드리지 않고 래퍼 컴포넌트로만 분리함. `preferredTexture`는 현재 추천 normalize 기본값이 있어 이번 작업에서는 required로 승격하지 않음.
- 다음 작업: 선택 질문 그룹을 실제 유료/프리미엄 설문으로 옮길 때는 `SurveyCurrentProducts` 렌더 위치와 `PREMIUM_REPORT_ENABLED` 정책만 조정하면 됨.
- 재사용할 규칙: 설문 필수/선택 분리는 질문 데이터의 `required` 플래그와 `areRequiredQuestionsComplete` helper를 기준으로 처리하고, UI 흐름은 `SurveyFooterActions`에서만 분기한다.
- 규칙 승격 후보: Candidates

### 2026-06-18 / paid full-report release gate and Step5 coming-soon lock

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 리포트 상세 구현을 삭제하지 않고 production 진입만 잠그며 무료 결과 Step5 문구/UI를 준비 중 상태로 바꾸는 Medium UI/flow guard 작업. 추천 알고리즘, 제품 DB, 결제, 저장 로직, DB schema, API 응답 필드는 범위에서 제외.
- 목표: development에서는 기존 유료 리포트 접근을 유지하고, production 기본값에서는 Step5와 `/result/full-report` 직접 접근을 준비 중 안내로 차단한다.
- 변경 파일: app/result/page.js, app/result/full-report/page.js, components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 점수식, 제품 DB, 결제, 저장 로직, DB schema/migration/policy, API response field names는 수정하지 않음.
- 검증 결과: 시작 전 working tree clean 확인 후 `git fetch origin --prune`, `git merge origin/main` 실행 결과 `Already up to date`. merge 후 `npm run build` 성공. 변경 후 `npm run build` 성공. production `next start -p 3002`에서 `/result/full-report` 직접 접근 시 준비 중 안내 표시, 개발자 버튼 미노출, 로딩 브리지 미노출, `/api/full-report` resource 요청 없음, console error 0, overflow 없음 확인. development `http://localhost:3001/result/full-report` 직접 접근은 기존 로딩 브리지로 진입 가능하고 준비 중 gate가 아님을 확인.
- 문제/주의점: `/test-result`의 Step 이동 UI가 텍스트 없는 dot 중심이라 자동 브라우저 클릭으로 Step5까지 안정적으로 접근하지 못했다. Step5 컴포넌트 코드와 production direct gate는 검증했으며, 실제 Step5 화면은 후속 눈검수 여지가 있다.
- 다음 작업: 유료 리포트 공개 시 `NEXT_PUBLIC_PREMIUM_REPORT_ENABLED=true`, 결제/권한 확인, 준비 중 카피 제거, 개발자용 진입 버튼 제거, `/result/full-report` 직접 접근 권한 검증을 순서대로 처리.
- 재사용할 규칙: release 전 숨김 처리는 CSS hidden이 아니라 조건부 렌더링으로 production DOM에서 제거하고, route gate는 hook 순서가 깨지지 않도록 wrapper/content 구조로 나눈다.
- 규칙 승격 후보: Candidates

### 2026-06-18 / paid Skin Match 루틴 상담 스크롤 플로우 애니메이션

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 Skin Match `루틴 상담` 내부 카드 표시 방식만 조정하는 Medium UI 작업. 메인 꽃잎 허브, 기능성 판단/컨디션 대응/Face Lab, 추천 알고리즘, DB, 결제, 저장 로직은 범위에서 제외.
- 목표: AM/PM 스위치 구조와 상단/하단 CTA는 유지하면서 루틴 단계 카드가 스크롤 진입 시 좌우 번갈아 부드럽게 등장하는 루틴 플로우처럼 보이게 정리.
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 점수식, DB schema/migration/policy, 결제, 인증, 저장 로직, API 응답 필드, 메인 꽃잎 허브 구조는 수정하지 않음.
- 검증 결과: `npm run build` 성공. `git diff --check -- app/result/full-report/page.js .codex/AI_WORK_LOG.md` 통과(CRLF warning만 있음). in-app Browser 390px에서 루틴 화면 AM 카드 좌/우 방향 속성, 3단계 스크롤 진입 상태, PM 전환 후 카드 리셋 상태, 기능성 판단 CTA, 가로 overflow 없음, console error 0을 확인. 자동 좌표 검수 중 버튼 위치가 반복적으로 변해 일부 클릭 재시도가 있었음.
- 문제/주의점: in-app Browser 백그라운드 상태에서 Framer `whileInView`와 `useInView`가 PM 전환 후 관찰을 안정적으로 다시 걸지 못해, 카드 내부에 `IntersectionObserver`와 즉시 viewport 계산 fallback을 함께 적용했다. 중간 수정 과정에서 제거한 `scheduleCheck` 참조가 cleanup에 남아 `ReferenceError: scheduleCheck is not defined` 런타임 에러가 발생했고, 이 에러가 full-report error boundary로 전달되어 “분석을 완료하지 못했어요” 화면이 표시됐다. 남은 참조를 `revealIfVisible`로 교체하고 `Select-String scheduleCheck`, `npm run build`, reload로 복구를 확인했다.
- 다음 작업: 실제 사용자 세션에서 스크롤 감도와 카드 등장 타이밍을 눈검수하고, 필요하면 카드 간 여백/상단 고정 영역 위치만 미세 조정.
- 재사용할 규칙: 스크롤 진입 애니메이션은 reduced motion 대응과 observer fallback을 같이 두고, 제품 정보는 단계 카드 안의 낮은 위계로 유지한다.
- 규칙 승격 후보: NULL

### 2026-06-18 / paid Skin Match 루틴 상담 AM-PM 전환 2차 리팩토링

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 Skin Match의 `루틴 상담` 내부 화면만 정보 구조와 UI 위계를 조정하는 Medium UI 작업. 메인 꽃잎 허브, 기능성 판단/컨디션 대응/Face Lab 상세, 추천 알고리즘, 제품 점수식, DB schema, 결제, 저장 로직은 범위에서 제외.
- 목표: 루틴 상담을 제품 추천 목록이 아니라 오늘 기준 기본 루틴 상담 화면으로 보이게 하고, AM/PM을 한 페이지 안에서 전환하도록 정리.
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 DB/점수식, DB schema/migration/policy, 결제, 인증, 저장 로직, API 응답 필드, 메인 꽃잎 허브 구조는 수정하지 않음.
- 검증 결과: `npm run build` 성공. `git diff --check -- app/result/full-report/page.js` 통과(CRLF warning만 있음). in-app Browser 390px `/test-full-report`에서 AM 기본 상태, PM 전환, PM CTA의 기능성 판단 이동, 상태 뱃지, 보조 제품 표시, 판매처 CTA 미노출, 가로 overflow 없음, console/page error 0 확인.
- 문제/주의점: PM 전환 직후 짧은 fade/slide 애니메이션 동안 자동 계측이 카드 렌더를 너무 빨리 읽을 수 있어 1초 대기 후 DOM으로 재확인함. 실제 화면/DOM에서는 PM 단계 카드가 정상 표시됨.
- 다음 작업: 기능성 판단, 컨디션 대응, Face Lab 상세 화면을 같은 상담형 위계로 단계적으로 정리. 루틴 상담의 실제 로그인/저장 데이터 케이스에서도 제품 이미지 누락과 긴 제품명 표시를 추가 확인.
- 재사용할 규칙: 유료 Skin Match 상세 섹션은 제품 카드보다 상담 단계와 행동 기준을 상위 위계로 두고, 제품은 단계 안의 보조 정보로 표시한다.
- 규칙 승격 후보: NULL

### 2026-06-15 / paid Skin Match hub 상담 맵 1차 리팩토링

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 Skin Match 메인 허브의 카피/정보 구조/라우팅만 조정하는 Medium UI 작업. 내부 상세 섹션, 추천/점수식, DB schema, 결제, 저장/세션, API 응답 필드, Face Lab 분석 로직은 범위에서 제외.
- 목표: 기존 꽃잎형 프리미엄 허브를 유지하면서 제품 추천 메뉴가 아니라 퍼스널 피부 상담 맵으로 보이도록 중앙 카피와 4개 섹터명을 정리.
- 변경 파일: app/result/full-report/page.js, components/full-report/TodayStartPlanStep.jsx, jsconfig.json, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 DB/점수식, DB schema/migration/policy, 결제, 인증, 저장 로직, API 응답 필드, 저장 데이터 구조는 수정하지 않음.
- 검증 결과: 첫 `npm run build`는 `jsconfig.json`의 `@/* -> ./src/*` alias 때문에 기존 import인 `@/app/result/full-report/page`, `@/app/result/page`, `@/components/full-report/TodayStartPlanStep` 등을 찾지 못해 실패. `jsconfig.json`을 `baseUrl: "."`, `@/*: ["./*"]`로 복구한 뒤 `npm run build` 성공. `git diff --check -- app/result/full-report/page.js components/full-report/TodayStartPlanStep.jsx jsconfig.json`은 CRLF warning만 있고 통과. Playwright 390px `/test-full-report` 검증에서 가로 overflow 없음, 필수 허브 문구 표시, 금지 허브 표현 없음, console/page error 0. Face Lab 꽃잎은 Face Lab 탭으로 전환되고, 루틴 상담 꽃잎은 기존 아침 루틴 섹션으로 연결됨.
- 문제/주의점: Browser plugin screenshot capture가 1회 timeout되어 로컬 Playwright screenshot(`tmp-skin-match-hub-390.png`, `tmp-skin-match-hub-390-full.png`)으로 시각 검수함. 내부 상세 페이지는 이번 범위 밖이라 기존 제품/루틴 문구와 step indicator가 남아 있음.
- 다음 작업: 내부 상세 섹션을 루틴 상담, 기능성 판단, 컨디션 대응, Face Lab 기준으로 단계적으로 재정리하되 추천/저장/DB 로직은 계속 분리.
- 재사용할 규칙: 빌드에서 광범위한 `@/` module-not-found가 발생하면 앱 import를 바꾸기 전에 `jsconfig.json` alias를 먼저 확인한다.
- 규칙 승격 후보: NULL

### 2026-06-12 / 유료 리포트 Skin Match 첫 화면 허브형 구조 전환
- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: `app/result/full-report/page.js` 안의 유료 리포트 첫 화면/상단 Skin Match 흐름을 허브형 UI로 재배치하는 작업이며, 추천/API/DB/결제/인증/저장 로직은 보호 구역으로 제외했다.
- 목표: 기존 숫자형 첫 화면 대신 중앙 `오늘 시작` 허브 카드와 `루틴 / 제품 / 주의 / 조정` 빠른 진입 카드를 제공하고, 기존 아침/저녁 루틴, 피해야 할 것, 조정법, 제품 콘텐츠는 유지한다.
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 로직, 제품 데이터, API 응답 필드, DB schema/migration/policy, 결제, 인증/리다이렉트, 저장 로직, 무료 결과 페이지, Step5 유료 전환 로직, Face Lab 데이터/분석 로직은 수정하지 않았다.
- 검증 결과: `npm run build` 성공, `git diff --check -- app/result/full-report/page.js` 성공(CRLF warning만 있음), in-app Browser에서 CSS 390px 모바일 다크/라이트 모두 허브/빠른 진입 카드/CTA 표시 및 가로 오버플로 없음 확인, CSS 1440px 데스크톱 다크 확인, 라이트 모드 CTA가 코랄-피치 그라데이션으로 표시됨 확인, 브라우저 콘솔 에러 없음 확인, 빠른 진입 카드 4개 클릭 시 루틴 2/6, 제품 6/6, 주의 4/6, 조정 5/6 콘텐츠로 이동 확인.
- 문제/주의점: 브라우저 스크린샷 저장 시 `Page.captureScreenshot` timeout이 발생해 파일 저장은 하지 못했다. DOM/스타일/클릭 동작 기반 검증은 완료했다.
- 다음 작업: 실제 사용자 세션에서 제품 카드 이미지 로딩 상태와 저장/재확인 안내 카드의 문구 톤을 최종 눈검수하면 좋다.
- 재사용할 규칙: 유료 리포트 첫 화면은 숫자형 진행보다 `오늘 먼저 볼 것` 중심의 허브로 두고, 상세 콘텐츠는 빠른 진입 카드와 기존 단계 CTA로 연결한다.
- 규칙 승격 후보: `NULL`

### 2026-06-12 / 유료 리포트 전용 물방울 로딩 화면 추가
- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 리포트 진입 전용 `/result/full-report/loading` UI 라우트 추가와 무료 결과의 전체 리포트 CTA 목적지만 변경하는 작업이며, 추천/API/DB/결제/인증/저장 로직은 보호 구역으로 제외했다.
- 목표: Skin Match 유료 플랜 생성 과정을 물방울 게이지, 단계 문구, 완료 상태, 물방울 터치 후 파문 전환으로 보여주고 완료 후 기존 허브형 `/result/full-report`로 이동시킨다.
- 변경 파일: app/result/full-report/loading/page.js, app/en/result/full-report/loading/page.js, app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 로직, 제품 데이터, API 응답 필드, DB schema/migration/policy, 결제, 인증/리다이렉트, 저장 로직, 무료 결과 로딩 페이지, Face Lab 분석 로직은 수정하지 않았다. 무료 결과 페이지는 전체 리포트 CTA 목적지만 `/result/full-report/loading`으로 변경했다.
- 검증 결과: `npm run build` 성공 및 `/result/full-report/loading`, `/en/result/full-report/loading` 라우트 생성 확인. Playwright로 390px 모바일 다크/라이트, 1440px 데스크톱 라이트 확인, 진행률 증가와 단계 문구 표시 확인, 완료 문구/터치 안내/보조 CTA 표시 확인, 물방울 클릭 후 ripple class 적용 및 `/result/full-report` 이동 확인, 로딩 화면 가로 오버플로 없음과 콘솔 에러 없음 확인. 이동 후 `/result/full-report`에서 세션 부재로 401 리소스 에러가 찍히는 것은 테스트 환경의 프리미엄 세션 없음 때문이며 로딩 라우트 에러는 아니었다.
- 문제/주의점: 첫 Playwright 검증은 PowerShell 파이프 인코딩으로 한국어 selector가 깨져 실패했고, 다음 검증은 Node 실행 옵션 오류로 실패했다. 검증 스크립트만 수정해 재검증 성공. 파문 전환 중 일시 가로 오버플로가 확인되어 로딩 페이지에 `overflow-x: hidden`을 추가했다.
- 다음 작업: 실제 결제 완료 세션에서 로딩 후 `/result/full-report`가 세션 에러 없이 허브로 이어지는지 최종 확인하면 좋다.
- 재사용할 규칙: 유료 리포트 전용 진입 연출은 데이터 생성 스토리를 보여주되, 실제 결과 조회/API/결제 흐름과 분리하고 완료 후 기존 리포트 화면으로만 넘긴다.
- 규칙 승격 후보: `NULL`

### 2026-06-11 / 유료 리포트 Skin Match 5단계 루틴 리포트 전환
- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 리포트 `app/result/full-report/page.js` 내부의 정보 구조, 화면 흐름, 카피, 컴포넌트 배치 변경이며 추천/API/DB/결제/저장 로직은 보호 구역으로 제외했다.
- 목표: 기존 Skin Match 6단계 흐름을 `현재 피부 기준 -> 하루 루틴 가이드 -> 제품별 사용 가이드 -> 상황별 조정법 -> 최종 요약` 5단계 루틴 리포트로 재정렬한다.
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 점수식, 제품 DB, API 응답 필드, DB schema/migration/policy, 결제, 인증/리다이렉트, 저장 로직, production data는 수정하지 않았다.
- 검증 결과: `npm run build` 성공, `git diff --check -- app/result/full-report/page.js` 성공(CRLF warning만 있음), in-app Browser CSS 390px 기준 1/5~5/5 순서/라벨/콘텐츠 전환 확인, AM/PM이 2/5 한 화면에 함께 표시됨 확인, 3/5 제품 사용 기준과 보조 판매처 링크 확인, 4/5 상황별 조정 기준 확인, 5/5 저장 CTA와 안전 문구 확인, 가로 오버플로 없음, 콘솔 에러 없음, 금지 카피(14일/실행 플랜/처방/치료/개선 보장 계열) 화면 노출 없음 확인.
- 문제/주의점: 초기 브라우저 검증에서 step header는 바뀌지만 본문이 1단계에 머무는 전환 문제가 있어 `AnimatePresence mode="wait"` 래퍼를 제거하고 keyed `motion.div`로 전환했다. 재검증에서 1/5~5/5 본문 전환이 정상 동작했다.
- 다음 작업: 실제 로그인/저장 세션에서 `내 루틴 저장하기`가 현재 프로젝트의 My 페이지 경험과 자연스럽게 이어지는지 확인하면 좋다.
- 재사용할 규칙: 유료 Skin Match는 제품 구매보다 루틴 순서, 사용량, 생략/축소 기준을 먼저 보여주고, 구매 링크는 제품별 사용 가이드 안의 보조 액션으로 둔다.
- 규칙 승격 후보: `NULL`

### 2026-06-11 / 유료 리포트 Skin Match 첫 장 색감 보정
- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: `app/result/full-report/page.js`의 Skin Match 첫 장 색상 토큰과 보조 포인트만 조정하는 UI 작업이며, 정보 구조와 추천/API/DB/결제/저장 로직은 범위에서 제외했다.
- 목표: 이미지 시안에서 따라온 보라색 네온 톤을 낮추고, Be Jewely 스킨케어 리포트 톤에 맞춰 코랄, 피치, 로즈 브라운 중심으로 색감을 보정한다.
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 DB, API 응답 필드, DB schema/migration/policy, 결제, 인증/리다이렉트, 저장 로직, Step5/무료 결과 로직은 수정하지 않았다.
- 검증 결과: `npm run build` 성공, `git diff --check -- app/result/full-report/page.js` 성공(CRLF warning만 있음). 첫 장의 섹션 제목, 히어로 강조 텍스트, 중심 제품 카드 하이라이트, 우선 실행 배지, 상세 버튼, 체크 포인트 아이콘, AI 판단 장식 그래픽에서 보라색 계열을 코랄/피치/로즈 계열로 교체했다.
- 문제/주의점: in-app Browser가 `http://localhost:3001/result/full-report` 검증 중 URL policy 차단을 반환해 모바일 390px 다크/라이트 화면, 콘솔 에러, 가로 오버플로는 이번 턴에서 직접 확인하지 못했다. 이 실패는 코드 문제가 아니라 브라우저 검증 도구 접근 차단으로 기록한다.
- 다음 작업: 브라우저 접근이 가능해지면 390px 다크/라이트에서 첫 장 색감과 CTA 코랄/피치 유지 여부를 눈으로 최종 확인한다.
- 재사용할 규칙: 유료 리포트 첫 장에서 보라색은 주조색으로 쓰지 않고, 필요한 경우 탭/작은 보조 포인트 수준으로 제한한다.
- 규칙 승격 후보: `NULL`

### 2026-06-11 / 유료 리포트 Skin Match 1-6 첫 장 재배치 및 레이아웃 고도화

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 수정 대상이 `app/result/full-report/page.js`의 Skin Match 1/6 UI와 문구로 한정되고, 추천/API/DB/결제/인증 변경 없이 정보 배치와 카드 위계만 조정하는 Medium UI 작업이므로 실행형으로 처리
- 목표: 1/6 `오늘 시작 플랜`을 현재 피부 기준 → 중심 제품 → AI 판단 → 우선 실행 3가지 → 체크 포인트 → 다음 루틴 CTA 흐름으로 재배치하고, 참고 이미지 톤에 맞춰 큰 히어로/2열 상단/강조 AI 판단/3카드 실행/체크 포인트 레이아웃으로 고도화
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 로직, API, DB schema/migration/policy, 결제, 인증/리다이렉트, 제품 데이터, Skin Match 2/6~6/6 순서, Face Lab 구조 미수정
- 검증 결과: npm run build 성공, git diff --check 성공(CRLF warning만 있음), in-app Browser에서 390px 기준 1/6 표시/섹션 순서/가로 오버플로 없음/콘솔 에러 없음 확인, 진행 점 클릭으로 1/6~6/6 순서 유지 확인
- 문제/주의점: 초기 `npm run build`가 `ENOENT: no such file or directory, open '.next\server\app\_not-found\page.js.nft.json'`로 2회 실패했다. `.next` 삭제만으로는 해결되지 않았고, 남아 있던 build 관련 node 프로세스 종료 후 재실행하자 성공했다. in-app Browser viewport override는 장치 배율 영향이 있어 CSS innerWidth 390px가 되도록 보정해 확인함
- 다음 작업: 실제 유료 데이터 세션에서 제품 이미지가 있는 경우 중심 제품 카드의 시각 밀도를 최종 확인
- 재사용할 규칙: 유료 리포트 첫 장은 무료 진단을 반복하지 않고 현재 기준, 플랜 앵커, 판단, 실행, 체크 기준, 다음 CTA 순서로 연결한다.
- 규칙 승격 후보: `NULL`

### 2026-06-11 / my page i18n route completion

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 진단형 후 실행형
- 라우팅 판단: `/my`의 locale route와 UI copy 누락 원인 확인이 먼저 필요해 진단형으로 시작했고, 원인이 `/en/my` route 부재와 `components/my` 하드코딩 문구로 좁혀져 실행형으로 전환
- 목표: `/my`, `/ko/my`, `/en/my`와 check-in 하위 흐름에서 ko/en UI copy를 동일 key 구조로 제공하고, `/my` 하위 컴포넌트의 한국어 하드코딩을 제거
- 변경 파일: lib/my/i18n.js, app/my/page.js, app/my/check-in/page.js, app/en/my/page.js, app/en/my/check-in/page.js, app/ko/my/page.js, app/ko/my/check-in/page.js, components/my/MyDashboard.jsx, components/my/MyDashboardMenu.jsx, components/my/TodayCheckInPrompt.jsx, components/my/TodayRoutineCard.jsx, components/my/SkinProfileSummaryCard.jsx, components/my/DailyCheckInForm.jsx, components/auth/AuthNav.jsx, .codex/AI_WORK_LOG.md
- 보호 구역: DB schema/migration/policy, 저장 데이터 구조, API 응답 필드, 추천 로직, 결제 로직은 수정하지 않음. 인증/리다이렉트 로직은 직접 변경하지 않고 UI 링크와 route wrapper의 기존 미인증 redirect 대상만 locale copy로 연결
- 검증 결과: npm run build 성공, `/en/my`, `/en/my/check-in`, `/ko/my`, `/ko/my/check-in` route 생성 확인, `ko/en` copy key/type shape 일치 확인, `/my` import 경로의 한국어 하드코딩 검색 결과 없음, 비로그인 브라우저에서 `/my`/`/ko/my`는 `/`, `/en/my`는 `/en`으로 이동 확인
- 문제/주의점: 첫 빌드는 실행 중인 Next dev/start 프로세스와 `.next` 산출물 충돌로 `/opengraph-image.png`의 `webpack-runtime.js` 누락, 이후 `_not-found/page.js.nft.json` 누락 에러가 발생함. 프로젝트 Next 프로세스를 종료하고 `.next`를 정리한 뒤 재빌드 성공. 현재 브라우저에 로그인 세션과 저장된 테스트 데이터가 없어 실제 저장 결과 없음/있음 대시보드 상태는 UI 코드 경로와 build로만 확인했고, DB 원문 데이터는 이번 작업 범위상 번역하지 않음
- 다음 작업: 실제 로그인 세션에서 저장 결과 없음, 저장 결과 있음, today check-in 완료/미완료 상태를 `/my`와 `/en/my`에서 최종 화면 확인
- 재사용할 규칙: locale route를 추가할 때 page route만 만들지 말고 해당 화면의 menu/auth link/check-in 하위 경로까지 같은 copy source로 연결한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-11 / my locale route policy cleanup

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 진단형 후 제한 실행형
- 라우팅 판단: `/en/my`를 공식 경로로 유지하면서 `/ko/my` alias와 인증 보호 경로를 정리하는 작업이며, 인증 middleware의 리다이렉트 조건을 포함하므로 기존 구조 확인 후 제한 실행
- 목표: `/ko/my`와 `/ko/my/check-in`은 공식 한국어 경로로 redirect하고, `/en/my`와 `/en/my/check-in`을 보호 경로에 포함하며, 내부 `/my` 링크가 locale 정책을 따르도록 정리
- 변경 파일: app/ko/my/page.js, app/ko/my/check-in/page.js, lib/supabase/middleware.js, components/result/SaveReportCTA.jsx, app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 인증 middleware는 사용자 명시 요청 범위 안에서 보호 경로와 미인증 redirect 대상만 변경. DB schema/migration/policy, 저장 데이터 구조, API 응답 필드, 결제, 추천 로직은 수정하지 않음
- Locale routing policy: Korean uses unprefixed routes (`/my`, `/result`). English uses `/en` prefixed routes (`/en/my`, `/en/result`). `/ko` prefixed routes are not official public routes. If `/ko` aliases exist, they should redirect to the unprefixed Korean route.
- 검증 결과: `npm run build` 성공. `git diff --check` 성공(CRLF warning만 있음). `/ko/my` 내부 링크 검색 결과 없음. 비로그인 redirect 확인: `/my` -> `/`, `/my/check-in` -> `/`, `/en/my` -> `/en`, `/en/my/check-in` -> `/en`, `/ko/my` -> `/my`, `/ko/my/check-in` -> `/my/check-in`
- 문제/주의점: `/ko`는 공식 public route가 아니므로 wrapper 구현을 유지하지 않고 redirect만 수행. 첫 `npm run build`는 실행 중인 Next 서버가 `.next` 산출물을 사용 중인 상태에서 `ENOENT: no such file or directory, open '.next\server\pages-manifest.json'`로 실패했고, 프로젝트 Next 서버를 종료한 뒤 `.next`를 삭제하고 재실행해 성공
- 다음 작업: 실제 로그인 세션에서 `/en/my`와 `/en/my/check-in` 진입 시 공통 구현이 영어 UI로 유지되는지 최종 화면 확인
- 재사용할 규칙: locale 정책이 unprefixed ko + `/en` prefix라면 `/ko` 구현을 만들지 말고 필요한 경우 redirect alias로만 둔다.
- 규칙 승격 후보: Locale routing policy 항목은 `.codex/AI_CONTEXT.md` Bridge 후보
- Context 반영 후보: Bridge

### 2026-06-11 / my check-in local date alignment

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 진단형 후 실행형
- 라우팅 판단: 현재 브랜치 목적 불일치로 1차 중단했으나, 사용자가 현재 브랜치 작업을 명시 승인했고, DB schema/migration 없이 `/my` check-in/routine 날짜 조회 기준만 맞추는 제한 작업으로 실행
- 목표: daily check-in 저장 날짜와 `/my` 대시보드 조회 날짜를 사용자 브라우저 local date 기준으로 맞추고, Asia/Seoul 고정 today 계산을 제거
- 변경 파일: components/my/DailyCheckInForm.jsx, components/my/MyDashboard.jsx, app/api/my/check-in/route.js, app/api/my/dashboard/route.js, lib/my/dashboard.js, lib/my/local-date.js, .codex/AI_WORK_LOG.md
- 보호 구역: DB schema/migration/policy, 저장 테이블 구조, API 기존 응답 필드, 인증/권한/결제/추천 로직은 수정하지 않음. check-in API 저장 경로는 사용자 승인 범위 안에서 형식/범위 검증만 추가
- 검증 결과: npm run build 성공, git diff --check 통과(CRLF warning만 있음), app/components/lib 내 Asia/Seoul 고정 조회 코드 없음 확인, in-app Browser로 `/my` 접근 시 미인증 상태에서 `/` redirect 및 런타임 표시 확인
- 문제/주의점: 인증 세션이 없어 실제 `/my` 대시보드의 todayCheckin/todayRoutine DB 조회 결과는 브라우저에서 직접 확인하지 못함
- 다음 작업: 실제 로그인 세션에서 다른 timezone 브라우저 기준으로 `/my/check-in` 저장 후 `/my` today check-in/routine 노출을 확인
- 재사용할 규칙: 사용자 달력 날짜와 UTC 이벤트 타임스탬프는 역할을 분리하고, 저장/조회 날짜 컬럼은 같은 local date context를 사용한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-11 / my check-in local date self-review

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 리뷰형 후 제한 실행형
- 라우팅 판단: 직전 daily check-in localDate 변경 결과의 자체 점검 요청이며, source of truth와 fallback 주석만 최소 보강
- 목표: `/my` 서버 props와 클라이언트 재조회 데이터 흐름, localDate fallback, UTC 기준 ±2일 검증, 날짜 역할 문서화를 점검
- 변경 파일: components/my/MyDashboard.jsx, lib/my/local-date.js, .codex/AI_WORK_LOG.md
- 보호 구역: DB schema/migration/policy, API 응답 필드, UI 구조, 인증/권한/결제/추천 로직 미수정
- 검증 결과: npm run build 성공, git diff --check 통과(CRLF warning만 있음), `rg "Asia/Seoul|getKoreaDateString" app components lib -n` 결과 없음. `npm run lint`는 ESLint 미설정 프로젝트라 Next.js가 설정 프롬프트를 띄우며 종료되어 수행 불가
- 문제/주의점: `/my` 첫 서버 렌더는 UTC fallback payload를 쓰고, 클라이언트 refresh 성공 후 브라우저 localDate payload가 source of truth가 된다. 이 흐름을 코드 주석으로 명확히 함
- 다음 작업: 실제 로그인 세션에서 `/my/check-in` 저장 후 `/my` 클라이언트 재조회 payload가 같은 localDate를 쓰는지 확인
- 재사용할 규칙: 서버 렌더 fallback과 클라이언트 보정 payload가 공존할 때는 어떤 payload가 최종 source of truth인지 코드에 남긴다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-22 / result 저장 CTA 위치 조정

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: 수정 대상과 목표가 명확하고, 저장 CTA 표시 위치 중심의 제한된 UI 작업이므로 실행형으로 처리
- 목표: /result 저장 CTA를 무료 결과 마지막 step 아래 1회만 노출하고, 공유 액션은 최하단 compact group으로 유지
- 변경 파일: app/result/page.js, components/result/ResultOverviewStep.jsx, components/result/SaveReportCTA.jsx
- 보호 구역: 저장 API 로직, 저장 데이터 구조, 공유 액션 로직, 기존 워킹트리의 무관한 변경 파일
- 검증 결과: npm run build 성공, git diff --check 성공, /test-result 390px overflow 없음, 마지막 step에서 저장 CTA 1회 노출 확인, 저장 후 ✓ 저장됨 및 My skin 링크 확인
- 문제/주의점: 기존 워킹트리에 이전 변경 파일이 남아 있어 해당 파일은 되돌리지 않음
- 다음 작업: 필요 시 최종 모바일 스크린샷 기준으로 spacing만 추가 조정
- 재사용할 규칙: CTA 위치 조정 작업은 저장/API 로직과 분리하고, 표시 조건과 레이아웃만 수정한다.
- 규칙 승격 후보: UI 작업에서 기존 워킹트리 변경 파일이 있으면 되돌리지 않고 작업 범위 밖으로 명시한다.
- Context 반영 후보: `NULL`

### 2026-05-22 / result 저장 후 floating nudge

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: 저장 완료 이후의 안내 UI 표시 조건 조정이며, 저장/API 로직 변경 없이 상태 기반 UI만 수정하므로 실행형으로 처리
- 목표: 저장 완료 후 마지막 step이 아닌 화면에서만 My skin 이동 floating nudge를 제공
- 변경 파일: app/result/page.js, components/result/SaveReportCTA.jsx
- 보호 구역: 저장 API 로직, 저장 성공 판정 로직, 결과 데이터 구조, 라우팅 목적지
- 검증 결과: npm run build 성공, git diff --check 성공, /test-result 390px overflow 없음, 저장 전 floating 없음 확인, 저장 후 마지막 step [이전]/[저장된 결과 보러가기] 확인, 이전 step floating nudge 확인, floating 클릭 시 /my 이동 확인
- 문제/주의점: 저장 성공 alert는 기존 저장 완료 상태 전환 직후 노출되며 저장/API 로직은 변경하지 않음
- 다음 작업: 실제 모바일 화면에서 floating 위치가 하단 OS UI와 겹치면 bottom spacing만 추가 조정
- 재사용할 규칙: 상태 기반 안내 UI는 저장 전, 저장 중, 저장 후, 현재 화면 위치 조건을 분리해서 처리한다.
- 규칙 승격 후보: 저장 이후 안내 UI는 핵심 저장 로직과 분리하고, 상태값과 화면 위치 조건만으로 제어한다.
- Context 반영 후보: `NULL`

### 2026-05-26 / 비주얼리 에러 빈 상태 UI 정리

- 브랜치: main
- 작업 유형: 실행형
- 라우팅 판단: 공통 에러/빈 상태 컴포넌트와 관련 화면 교체가 목표로 명확하고, 저장/API/인증/결제 로직을 건드리지 않는 UI 중심 작업이므로 실행형으로 처리
- 목표: Next.js 기본 에러 느낌을 제거하고 light/dark 브랜드 로고를 사용하는 에러/빈 상태 UI로 통일
- 변경 파일: components/common/ErrorState.jsx, app/error.js, app/not-found.js, app/result/page.js, app/result/full-report/page.js, public/images/brand/bejewely-icon-light.png, public/images/brand/bejewely-icon-dark.png
- 보호 구역: 인증/권한, DB schema/migration/policy, 결제 로직, API response field names, 저장 데이터 구조, 배포 설정
- 검증 결과: npm run build 성공, git diff --check 성공, 390px Playwright 확인에서 404/result empty/analysis failed/full-report empty/error boundary 화면 overflow 없음, light 로고와 dark 로고 분기 확인, 버튼 href 확인
- 문제/주의점: 요청은 main 작업이었지만 기존 feature 브랜치에 미커밋 변경이 있어 `codex-preserve-before-main-error-state` stash로 보존 후 main으로 전환함. `/my` 라우트는 main에 없어 새 화면을 만들지 않고 기존 결과 없음 상태만 교체함.
- 다음 작업: 저장 결과 목록 화면이 추가되면 result_empty 보조 액션을 `/my`로 연결할 수 있음
- 재사용할 규칙: 공통 에러 UI는 개발자용 에러 문자열을 직접 노출하지 않고, 행동 가능한 CTA와 브랜드 로고를 우선한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-26 / feature 브랜치 main merge 반영

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: 사용자가 main 반영 방식을 merge로 명확히 지정했고, commit/push 없이 병합 결과와 검증만 수행하는 제한 작업이므로 실행형으로 처리
- 목표: feature/revisit-core-db에 main 최신 변경사항을 반영하되 merge commit은 만들지 않고 build/diff 검증까지 확인
- 변경 파일: main merge 반영 파일 전체, 기존 stash 복원 파일(.gitignore, AGENTS.md, components/result/SaveReportCTA.jsx, img/Bejewely_icon.png, img/bejewely-icon-dark.png, img/bejewely-icon-light.png), data/hwahae-review-signals/categories/moisturizer/balm/.gitkeep, data/hwahae-review-signals/categories/moisturizer/gel/.gitkeep
- 보호 구역: commit/push 미수행, merge commit 생성 방지를 위해 --no-commit --no-ff 사용, 인증/DB/결제/배포 설정 수동 수정 없음
- 검증 결과: git merge --no-commit --no-ff main 충돌 없음, git stash pop 충돌 없음, npm run build 성공, git diff --check 성공, git diff --cached --check 성공, git diff HEAD --check 성공
- 문제/주의점: main에서 들어온 .gitkeep 두 파일에 trailing whitespace가 있어 제거 후 staging함. 현재 MERGE_HEAD가 남아 있어 사용자가 commit 또는 merge abort로 마무리해야 함.
- 다음 작업: 수동 리뷰 대상 파일 확인 후 문제가 없으면 merge commit 생성, 문제가 있으면 git merge --abort 또는 필요한 파일만 조정
- 재사용할 규칙: commit 금지 조건이 있는 merge 작업은 --no-commit --no-ff로 병합 결과만 만들고 검증한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-26 / my 햄버거 메뉴 연결

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: /my 헤더 UI에서 로그아웃 버튼 노출 위치만 변경하는 요청이며, 인증/로그아웃 로직과 라우트는 그대로 유지하므로 실행형으로 처리
- 목표: /my 상단의 노출된 로그아웃 버튼을 제거하고 햄버거 메뉴 안으로 이동
- 변경 파일: components/my/MyDashboard.jsx, components/my/MyDashboardMenu.jsx
- 보호 구역: /api/auth/signout 라우트, 인증 세션 처리, dashboard payload, DB/API 로직
- 검증 결과: npm run build 성공, git diff --check 성공, /my에서 헤더 로그아웃 버튼 미노출 확인, 햄버거 메뉴 open 시 로그아웃 href가 /api/auth/signout인 것 확인
- 문제/주의점: 로그아웃 동작 자체는 기존 href를 그대로 사용하며 직접 클릭 검증은 세션 종료를 유발하므로 수행하지 않음
- 다음 작업: /my 메뉴에 추가 항목이 필요하면 result/full-report 메뉴와 항목 체계를 맞춰 확장
- 재사용할 규칙: 계정 액션은 화면 주요 CTA처럼 노출하지 않고, 필요 시 compact menu 안으로 이동한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-26 / 공용 햄버거 메뉴 컴포넌트 정리

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: result/full-report/my 헤더 메뉴 UI의 중복 구현을 공용 컴포넌트로 묶는 제한된 UI 구조 정리이며, 인증/저장/API 로직 변경 없이 표시 컴포넌트만 조정하므로 실행형으로 처리
- 목표: 화면별로 달라진 햄버거 메뉴 구성을 언어, 계정, 화면 모드, 보조 액션 구조로 통일
- 변경 파일: components/navigation/AppHamburgerMenu.jsx, components/my/MyDashboardMenu.jsx, components/my/MyDashboard.jsx, app/result/page.js, app/result/full-report/page.js
- 보호 구역: 인증 세션 처리, /api/auth/signout 라우트, 저장/공유/full-report 데이터 로직, DB/API 로직
- 검증 결과: npm run build 성공, git diff --check 성공, /my 헤더에서 노출 로그아웃 제거 확인, /my 메뉴 open 시 언어/계정/화면 모드/무료 진단 시작하기 확인, /test-result 메뉴 open 시 언어/계정/화면 모드/다시 테스트하기 확인, /test-full-report 메뉴 open 시 언어/계정/화면 모드/무료 결과로 돌아가기/다시 테스트하기 확인, 425px viewport overflow 없음 확인
- 문제/주의점: /my는 영어 전용 대시보드 라우트가 없어 English 메뉴는 /en 랜딩으로 보낸다.
- 다음 작업: /en/my가 생기면 MyDashboardMenu의 English href를 /en/my로 교체
- 재사용할 규칙: 동일 헤더 메뉴는 화면마다 직접 복사하지 말고 공용 컴포넌트로 구성만 주입한다.
- 규칙 승격 후보: 공통 메뉴/헤더 UI는 한 컴포넌트에 모으고 화면별 액션만 props로 분리한다.
- Context 반영 후보: Candidates

### 2026-05-27 / result UX main merge 전 최종 점검

- 브랜치: feature/revisit-core-db
- 작업 유형: 진단형
- 라우팅 판단: main merge 전 변경 범위, 빌드, diff, 모바일 회귀를 확인하는 점검 작업이며 새 기능/UI 변경 없이 검증 중심으로 처리
- 목표: revisit/result UX 변경이 main 병합 가능한 상태인지 확인
- 변경 파일: docs/Bejewely-revisit-db-erd-v0.2.md, docs/Bejewely-revisit-implementation-plan-v0.2-fixed.md, docs/Bejewely-revisit-usecase-v0.2.md, .codex/AI_WORK_LOG.md
- 보호 구역: result/auth/save/share/full-report 로직 및 UI 재배치 미수정, DB schema 미수정
- 검증 결과: npm run build 성공, git diff --check 성공(CRLF warning만 남음), main 기준 diff-check trailing whitespace 3건 제거, /result 390px overflow 없음, hamburger/language/theme/save/floating/full-report/share page/image save 수동 확인, build 성공 후 /result smoke 재확인
- 문제/주의점: 최초 npm run build는 dev server가 살아있는 상태에서 Next.js 15.5.14 초기 출력 이후 9분 이상 추가 로그 없이 멈췄다. dev server와 build 프로세스를 모두 종료한 뒤 재실행하자 17.8초에 정상 완료되어, 코드 정적 렌더 hang이 아니라 concurrent dev/build 실행 영향으로 판단한다.
- 다음 작업: merge 전 build를 다시 실행할 때는 dev server를 먼저 종료한다.
- 재사용할 규칙: main merge 전 점검은 작업 브랜치 diff뿐 아니라 origin/main 기준 diff-check도 함께 확인한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-31 / Supabase anonymous user data policy hardening

- Branch: main
- Task type: diagnostic with limited execution
- Routing decision: Supabase RLS/auth policy work is High risk, but user explicitly requested applying only the anonymous-user policy restriction and committing/pushing it.
- Goal: Block Supabase anonymous-auth users from owner-scoped My Skin data policies while preserving permanent authenticated-user access.
- Changed files: supabase/migrations/20260531123349_restrict_anonymous_user_data_policies.sql
- Protected areas: DB policy touched with explicit user instruction; no env/auth redirect/deployment config changes.
- Validation: Applied SQL to linked Supabase project with `supabase db query --linked --file ...`; verified affected policies include `is_anonymous = false`; `supabase db advisors --linked --type security --level warn -o json` now reports only `auth_leaked_password_protection`.
- Notes/risks: Existing unrelated working-tree changes were not staged or modified. Leaked password protection remains a dashboard/plan-dependent Auth setting.
- Reusable rule: When anonymous Supabase sign-in is enabled, `to authenticated` RLS policies for account-owned data should explicitly exclude anonymous users with the JWT `is_anonymous` claim.
- Context promotion candidate: Bridge

### 2026-05-31 / 무료 결과 v2 흐름 실험

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: 무료 결과 페이지의 UI/UX 흐름 조정이며, 수정 대상과 목표가 명확하고 API/DB/유료 리포트 구조를 건드리지 않는 제한된 UI 작업이므로 실행형으로 처리
- 목표: 무료 결과를 핵심 진단, 판단 근거, 우선순위, 추천 방향, Top Pick 미리보기, 루틴 방향, Face Lab 프리뷰, Full Report CTA 순서로 펼쳐 실제 화면 검토가 가능하게 만들기
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 유료 리포트 페이지, 추천 알고리즘, DB/API 응답 구조, 저장 데이터 구조, 인증/권한, 배포 설정 미수정
- 검증 결과: npm run build 성공, git diff --check 성공(CRLF warning만 있음), Browser로 /test-result 1/5~5/5 이동 확인, 390px Playwright 확인에서 5개 step 모두 가로 overflow 없음 및 console/page error 없음
- 문제/주의점: 기존 워킹트리에 데이터/스크립트/package.json 관련 사용자 변경이 있어 건드리지 않음. 사진/설문/Face Lab 구조화 값이 부족한 경우 무료 UI 표시용 fallback과 TODO 주석으로 처리함.
- 다음 작업: 실제 사용자 결과 화면 기준으로 카드 병합/삭제, 문구 압축, 모바일 첫 화면 정보량 조정
- 재사용할 규칙: 무료 결과 UI 실험은 API 응답 구조와 유료 리포트 구조를 바꾸지 않고, 기존 결과 데이터와 표시용 fallback helper만으로 먼저 검증한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-31 / 무료 결과 v2 문구 직관화

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: 무료 결과 v2 화면의 1/5, 2/5, 4/5 문구와 표시 방식만 조정하는 UI 작업이며, 기능 로직/API/DB/유료 리포트 구조 변경이 없으므로 실행형으로 처리
- 목표: 핵심 진단은 체감 묘사를 먼저 보여주고, 판단 근거는 사진/설문 신호를 해석 문장으로 연결하며, 루틴 방향은 긴 설명 대신 AM/PM 단계형 흐름으로 압축
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, API 응답 구조, DB/저장 데이터, Full Report 페이지, 인증/권한, 배포 설정 미수정
- 검증 결과: npm run build 성공, git diff --check 성공(CRLF warning만 있음), /test-result 390px Playwright 확인에서 1/5 체감 문장/진단명, 2/5 해석 문장/종합 해석, 4/5 AM/PM pill 흐름과 gate 문구 확인, 가로 overflow 없음, console/page error 없음
- 문제/주의점: 기존 5단계 시퀀스와 카드 구성은 유지하고 텍스트 밀도만 낮춤
- 다음 작업: 실제 결과 데이터별로 1/5 체감 문장의 분기 문구가 과하게 일반적이지 않은지 샘플별로 비교
- 재사용할 규칙: 무료 결과 첫 문장은 분류명보다 사용자가 체감할 상태 묘사를 우선하고, 분류명은 보조 태그로 낮춘다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-01 / 무료 결과 v2 AI 리포트감 보강

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: 2/5, 4/5, 5/5 무료 결과 화면의 시각 표현 보강이며, API/추천 로직/Step 수/저장 구조 변경 없이 단일 결과 UI 파일 중심으로 제한되는 작업이라 실행형으로 처리
- 목표: 판단 근거 사진에 AI 분석 오버레이를 추가하고, 루틴 방향을 미니 흐름 다이어그램으로 보강하며, 전체 리포트 프리뷰 항목에 썸네일 미리보기를 추가
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 추천 로직, Step 수, 저장 데이터 구조, 인증/권한, DB/배포 설정 미수정
- 검증 결과: git diff --check 통과(CRLF warning만 있음), npm run build 성공, Browser로 390px 모바일 폭에서 2/5·4/5·5/5 진행 확인, Playwright 390px dark screenshot 3장 생성, 2/5·4/5·5/5 scrollWidth 390 및 console/page error 없음 확인
- 문제/주의점: in-app Browser fullPage screenshot은 CDP capture timeout이 발생해, Browser 상태 검증 후 별도 Playwright로 동일 localhost 390px 스크린샷을 생성함
- 다음 작업: 실제 사용자 사진 비율이 다양한 경우 오버레이 라벨 위치가 얼굴을 과하게 가리지 않는지 샘플별로 미세 조정
- 재사용할 규칙: 무료 결과의 리포트감 강화는 분석/추천 데이터 구조를 바꾸지 않고, 기존 표시 데이터 위에 시각적 근거와 미리보기 레이어를 얹어 먼저 검증한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`
### 2026-06-01 / free result v2 step 1 summary cleanup

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI/UX cleanup in `app/result/page.js` only; API, DB, recommendation logic, storage, auth, and full-report routes were out of scope.
- Goal: Refocus 1/5 on the skin summary by removing repeated Face Lab and recommendation direction content from Step 1, then moving those sections to Step 4.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright smoke passed for 1/5 through 4/5; Step 1 scrollWidth/clientWidth stayed 390/390, console/page errors were empty, and Step 1 scrollHeight reduced from the prior 1842px check to 1272px.
- Notes/risks: Existing unrelated dirty files remained untouched. Step 4 is longer because it now carries the moved recommendation direction and Face Lab preview.
- Reusable rule: The free result first step should remain a summary page; recommendation direction and style/mood previews belong later in the flow.
- Context promotion candidate: Candidates

### 2026-06-01 / free result v2 step 3 recommendation guide merge

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 and Step 3/4 UI structure cleanup in `app/result/page.js` only; API, DB, recommendation logic, storage, auth, and full-report routes were out of scope.
- Goal: Move the Face Lab summary back into Step 1 as secondary information, merge Top Pick and routine usage into a new Step 3 recommendation/use guide, and leave Step 4 as an expected-change placeholder.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright smoke passed for 1/5 through 4/5; Step 1/3/4 scrollWidth/clientWidth stayed 390/390, console/page errors were empty.
- Notes/risks: Step 4 is intentionally a placeholder for the next expected-change task. Existing unrelated dirty files remained untouched.
- Reusable rule: Free result v2 should keep roles separated by step: 1 summary, 2 evidence, 3 recommendation plus use direction, 4 expected change, 5 premium continuation.
- Context promotion candidate: Candidates

### 2026-06-01 / free result v2 step 3 density refinement

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 3 UI density and copy refinement in `app/result/page.js` only; API, DB, recommendation logic, step count, and other result steps were out of scope.
- Goal: Improve the Step 3 recommendation/use guide layout using the reference for hierarchy and density while preserving the current information structure.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 3 with scrollWidth/clientWidth 390/390 and no console/page errors.
- Notes/risks: The in-app browser control path had a click-runtime issue, so the 390px verification used Playwright directly against the same localhost page.
- Reusable rule: Step 3 should keep Top Pick compact, make the use routine the visual focus, and phrase locked cards as decisions the user can resolve.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 3 mobile readability cleanup

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 3 UI-only cleanup in `app/result/page.js`; recommendation logic, API, DB, data fields, step structure, and other steps were out of scope.
- Goal: Make Step 3 easier to scan on mobile by emphasizing the core product role, changing AM/PM routines to a clearer vertical flow, and compressing locked cards.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 3 with scrollWidth/clientWidth 390/390 and no console/page errors.
- Notes/risks: Verification used Playwright directly against localhost:3001; no API/DB/recommendation code was changed.
- Reusable rule: On mobile, Step 3 roles should distinguish core vs supporting roles, routines should read vertically, and locked cards should use compact decision-oriented rows.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 4 management checkpoints

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 4 UI role rebuild in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and full-report pages were out of scope.
- Goal: Replace the temporary routine/expected-change Step 4 with a management checkpoint page focused on observation, maintenance, and caution signals after applying the recommendation.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 4 with scrollWidth/clientWidth 390/390, no console/page errors, required checkpoint sections present, and forbidden Step 3 repeats absent.
- Notes/risks: Step 4 now has a clearer management role, but the final flow still needs the next UX decision for whether Step 4 should become expected-change content later or keep the checkpoint role.
- Reusable rule: Step 4 should avoid Top Pick, AM/PM routine, Face Lab, current-priority, and recommendation-direction repeats; it should focus on management, observation, and caution.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 4 recommendation validation

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 4 UI-only role change in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and full-report pages were out of scope.
- Goal: Reframe Step 4 from management checkpoints into a recommendation validation page that helps the user judge whether the recommended routine fits their skin.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 4 with scrollWidth/clientWidth 390/390, no console/page errors, required validation sections present, and Step 3 repeats absent.
- Notes/risks: Section 1 uses four fit signals, so Step 4 is slightly longer than the reference. The hierarchy is clearer, but the Step 4-to-Step 5 CTA wording may still need tuning after Step 5 is finalized.
- Reusable rule: Step 4 should answer "how do I know this recommendation fits?" with positive fit signals and adjustment signals, not repeat recommendation product, AM/PM routine, Face Lab, or priority content.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 3 structure compression

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 3 UI structure refactor in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and full-report pages were out of scope.
- Goal: Compress Step 3 by merging product tags and role information, switching AM/PM routine display to a single tabbed routine card, and consolidating paid prompts into one preview list.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 3 with scrollWidth/clientWidth 390/390, no console/page errors, default morning tab visible, night tab switch working, and Step 4 validation content absent from Step 3.
- Notes/risks: Step 3 is shorter and less lock-heavy, but the product image placeholder still limits the visual polish until a real product image is available.
- Reusable rule: Step 3 should show one recommendation, one active routine view, and one consolidated premium preview box; avoid separate lock cards and repeated fit/role tags.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 4 signal toggle compression

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 4 UI-only refactor in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and other result steps were out of scope.
- Goal: Compress Step 4 into the same toggle pattern as Step 3, showing either fit signals or adjustment signals while consolidating the full-report preview into one list box.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 4 with scrollWidth/clientWidth 390/390, no console/page errors, fit tab default active, adjustment tab switching correctly, and full-report items rendered as one list box.
- Notes/risks: Step 4 is now much shorter, but the visual balance depends on whether the full-report CTA remains below this step or moves into Step 5 copy later.
- Reusable rule: Step 4 validation signals should use one toggle card and one consolidated full-report preview; do not show fit and adjustment groups simultaneously.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 5 execution guide conversion

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 5 UI-only premium conversion refactor in `app/result/page.js`, with display-label support in `components/result/SaveReportCTA.jsx`; API, DB, payment, recommendation logic, Full Report, and Step 1-4 content were out of scope.
- Goal: Replace the final locked-card list with a compact "my skin execution guide" conversion screen focused on order, frequency, avoided combinations, and alternatives.
- Changed files: app/result/page.js, components/result/SaveReportCTA.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Auth/save behavior was not changed; `SaveReportCTA` only received optional label/helper text overrides for the final free-save presentation.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px in-app browser check passed on localhost:3002 with scrollWidth/clientWidth 390/390, required Step 5 copy present, old large AM/PM cards absent, no new console/page errors, and a clean Playwright screenshot saved.
- Notes/risks: localhost:3001 was an older long-running Next server, so latest UI verification used a separate localhost:3002 dev server. Production `next start` cannot verify `/test-result` because that route redirects in production mode.
- Reusable rule: Step 5 should close the free flow with one execution-guide card, one blurred routine preview, one compact included-items list, and one primary action-oriented CTA.
- Context promotion candidate: Candidates

### 2026-06-04 / free result v2 step 2 evidence signal flip toggle

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: /test-result Step 2의 판단 근거 카드 표시 방식만 바꾸는 제한된 UI 작업이며, API/DB/추천 로직/저장 구조/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: Step 3 루틴 카드처럼 사진/설문 신호를 토글로 전환하고, 신호 카드 영역 클릭 시 뒤집히는 애니메이션으로 두 신호 묶음을 확인하게 만들기
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, in-app Browser에서 `/test-result` Step 2 진입 후 사진/설문 탭 각각 1개 노출 확인, 설문 탭 전환과 카드 클릭 후 사진 탭 복귀 확인, scrollWidth/clientWidth 380/380, console error 없음
- 문제/주의점: in-app Browser viewport screenshot 캡처는 CDP timeout으로 실패했지만, DOM/상태/폭/콘솔 검증은 완료함
- 다음 작업: 실제 모바일 화면에서 flip 전환이 너무 빠르거나 느리면 duration만 미세 조정
- 재사용할 규칙: 무료 결과의 병렬 근거 정보는 한 화면에 모두 펼치기보다 탭과 단일 active card로 압축해 텍스트 밀도를 낮춘다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 2 photo cue reveal animation

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: /test-result Step 2 사진 분석 카드의 설명 노출 방식만 조정하는 제한된 UI 작업이며, API/DB/추천 로직/저장 구조/인증/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: 사진 분석 설명 텍스트를 기본 숨김 상태로 두고, 사진을 누르면 유도 문구가 사라지며 설명 callout들이 튀어나오는 애니메이션을 적용
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, Playwright 390px에서 Step 2 진입 확인, 사진 CTA `눌러보세요!` 기본 노출 확인, 사진 클릭 후 `aria-expanded=true` 및 유도 문구 제거 확인, scrollWidth/clientWidth 390/390, console/page error 없음
- 문제/주의점: in-app Browser 현재 탭에서는 하단 CTA 클릭이 step을 이동시키지 않아, 동일 localhost에 대해 별도 Playwright로 상호작용 검증함
- 다음 작업: 실제 모바일 화면에서 callout 튀어나오는 강도가 과하면 spring stiffness/damping만 미세 조정
- 재사용할 규칙: 사진 위 분석 설명은 처음부터 전부 노출하지 않고, 클릭 유도와 reveal 애니메이션으로 단계적으로 열어 모바일 밀도를 낮춘다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 2 photo cue persistence

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: Step 2 사진 분석 카드의 reveal 상태와 점선 오버레이 노출만 조정하는 UI 상태 작업이며, API/DB/추천 로직/저장 데이터/인증/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: 사진을 한 번 누른 뒤 다른 step이나 새로고침 후 돌아와도 분석 설명이 펼쳐진 상태로 유지되고, 점선 동그라미도 설명과 함께 나타나도록 조정
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정. UI reveal 여부만 sessionStorage에 저장
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, Playwright 390px에서 기본 상태 `aria-expanded=false`, CTA 노출, 점선 오버레이 `aria-hidden=true`/opacity 0 확인. 클릭 후 `aria-expanded=true`, CTA 제거, 점선 오버레이 `aria-hidden=false`/opacity 1 확인. Step 3 이동 후 이전 및 새로고침 후 Step 2 재진입에서도 펼쳐진 상태 유지 확인. scrollWidth/clientWidth 390/390, console/page error 없음
- 문제/주의점: 없음
- 다음 작업: 실제 모바일 화면에서 sessionStorage 유지 범위가 과하면 브라우저 세션 한정 대신 parent state로 좁힐 수 있음
- 재사용할 규칙: 인터랙션으로 한 번 연 분석 보조 정보는 같은 결과 확인 세션 안에서는 다시 접히지 않게 유지해 반복 클릭 부담을 줄인다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 2 bridge CTA lead-in

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: Step 2 마지막에 Step 3 CTA를 연결하는 단일 UI 요소를 추가하는 작업이며, API/DB/추천 로직/저장 데이터/인증/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: CTA 직전에 정보 카드보다 가벼운 bridge 영역을 추가해 "이 분석을 바탕으로 가장 적합한 제품과 활용 방법을 정리했습니다." 문구로 Step 2에서 Step 3로 자연스럽게 연결
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, Playwright 390px에서 bridge 문구 노출, `종합 해석` 미노출 유지, bridge가 CTA 바로 위에 배치됨 확인, bridge 높이 66px, scrollWidth/clientWidth 390/390, console/page error 없음
- 문제/주의점: 없음
- 다음 작업: 실제 기기에서 CTA보다 bridge가 강하게 보이면 border/background opacity만 낮춰 조정
- 재사용할 규칙: Step 간 연결 문구는 독립 정보 카드가 아니라 CTA 직전의 낮은 무게 bridge로 처리해 다음 행동을 방해하지 않는다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 1 diagnosis structure polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI-only polish in `app/result/page.js`; API, DB, recommendation logic, payment, result step count, and Step 2-5 structures were out of scope.
- Goal: Promote the one-line diagnosis, combine photo and compact pentagon parameters, reduce Face Lab into an auxiliary chip strip, and tighten priority TOP 3 with a subtle core badge.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reload confirmed required Step 1 texts and no console errors; Playwright 390px checks passed for light and dark themes with scrollWidth/clientWidth 390/390 and required Step 1 labels/CTA present.
- Notes/risks: The top global result header still sits above Step 1, so the CTA is not guaranteed to be in the first viewport from absolute page top at 390px. Step 1 itself keeps the diagnosis first within the step and does not change data/recommendation behavior.
- Reusable rule: Step 1 should prioritize a large diagnosis statement, keep the photo plus pentagon as one compact visual summary, keep Face Lab as auxiliary chips, and show priority TOP 3 as the execution order.
- Context promotion candidate: NULL

### 2026-06-04 / free result v2 step 1 radar help modal

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 i-button copy and popover behavior in `app/result/page.js`; API, DB, recommendation logic, saved data, payment, and result step count were out of scope.
- Goal: Make the skin-state pentagon understandable by renaming axes to care-attention terms and connecting the i button to a compact explanatory modal.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px light/dark checks confirmed the renamed axes, help modal title/body/axis list/footer copy, close button, outside-click close, scrollWidth/clientWidth 390/390, and no console/page errors.
- Notes/risks: The radar values remain display-only derived UI values. They should continue to be framed as care-priority signals, not exact skin scores.
- Reusable rule: When a visual summary uses derived skin axes, axis names and help copy should make the direction explicit: farther outward means stronger current care signal, not a medical measurement.
- Context promotion candidate: NULL

### 2026-06-04 / free result v2 step 1 mobile compression polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI compression and interaction polish in `app/result/page.js`; API, DB, recommendation logic, payment, saved data, and result step count were out of scope.
- Goal: Shorten radar labels, make the i button more discoverable without competing with CTA, organize Face Lab as grouped auxiliary info, remove the priority helper link, and collapse priority descriptions behind a simple accordion.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reload confirmed short radar labels, Face Lab groups, removed priority helper link, and no browser errors; Playwright 390px light/dark checks confirmed short labels, help modal, grouped Face Lab, collapsed priority descriptions, first priority accordion open, scrollWidth/clientWidth 390/390, and no console/page errors.
- Notes/risks: The priority accordion defaults to all rows collapsed, so users must tap a priority row to read the short description.
- Reusable rule: Step 1 should keep derived radar labels short on the graph and move explanatory detail into help; priority text should default to title-first and reveal short detail only on tap.
- Context promotion candidate: NULL

### 2026-06-04 / free result v2 step 1 photo and radar structure split

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI-only structure rearrangement in `app/result/page.js`; API, DB, recommendation logic, payment, saved data, result step count, and Step 2-5 flow were out of scope.
- Goal: Keep the Step 1 information set while moving Face Lab beside a larger photo, separating the skin radar into its own card, and keeping priority TOP 3 below the radar.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px checks confirmed the larger photo, standalone radar with legend, unclipped/non-overlapping radar labels, collapsed priority list, CTA visibility path, and scrollWidth/clientWidth parity.
- Notes/risks: Step 1 becomes taller because the photo/mood card and radar card are split. This improves photo and radar readability at the cost of slightly more vertical scroll.
- Reusable rule: When Step 1 has both face mood and skin-state visualization, keep Face Lab attached to the photo as auxiliary face mood context and keep the pentagon as a separate skin snapshot card.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 conclusion card experiment

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI-only experiment in `app/result/page.js`; recommendation logic, API, DB, payment, Face Lab, radar structure, result step count, and Step 2-5 flow were out of scope.
- Goal: Replace the free-form one-line diagnosis block with a compact conclusion card that makes the core result easier to notice without modal/position/absorption animation.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser 390-ish dark viewport confirmed conclusion card, photo/radar/priority order, no horizontal overflow, and no radar label clipping/overlap.
- Notes/risks: The conclusion card improves first-read clarity while reducing the large headline height, but it is visually less dramatic than the previous oversized text treatment by design.
- Reusable rule: Step 1 conclusion emphasis should use a lightweight static card plus one-time opacity/Y entrance only; avoid central popups, position movement, repeated animation, scale, and CTA-level visual weight.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 loading reveal test flow

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Development-only test route addition in `app/loading/page.js`; recommendation logic, API response shape, DB, payment, saved data, and existing Step 1-5 result flow were out of scope.
- Goal: Add a 15-second forced loading UX that changes analysis-stage copy, then reveals a one-line diagnosis completion screen with CTA into the existing `/test-result` Step 1 flow.
- Changed files: app/loading/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed and generated `/loading`; Playwright 390px light flow confirmed 0-5s/5-10s/10-15s active loading details, 15s completion reveal, CTA click to `/test-result`, Step 1 `RESULT STEP` 1/5, and no horizontal overflow; Playwright 390px dark completion screen confirmed completion copy, diagnosis, CTA, and no horizontal overflow; in-app Browser `/loading` flow confirmed 15s reveal and CTA navigation to `/test-result`.
- Notes/risks: `/loading` is a development verification route and redirects to `/` in production via client effect. It does not call analysis APIs or seed/write result data directly; `/test-result` continues to handle fixture seeding.
- Reusable rule: Result-entry experiments should be isolated on development routes first, use fixture-backed navigation, and avoid modifying production analysis or result data flow.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 radar dashboard polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 skin-state radar card internal UI polish in `app/result/page.js`; Step 1 overall structure, Face Lab, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Make the pentagon card read as an interpretable skin-state dashboard by adding a concise interpretation sentence, status sublabels, compact TOP3 signal chips, a slightly larger chart, and a quieter guide legend.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reload confirmed the new radar interpretation and TOP3 chips with no label clipping/overlap; Playwright 390px light/dark checks confirmed interpretation text, signal chips, legend, SVG size 247x242, scrollWidth/clientWidth 390/390, no SVG label overlap/clipping, and no console/page errors.
- Notes/risks: The radar card is taller because it now includes interpretation and signal chips, but the chart remains below hero scale and the priority card remains the action-order section.
- Reusable rule: Radar cards should separate current-state signals from management priority: chart/chips summarize current signal strength, while priority TOP 3 remains the care order.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 radar card final spacing

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 internal UI polish and selected conclusion-card removal in `app/result/page.js`; Face Lab, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Finish the skin-state radar card by removing the strong divider, removing the repeated `핵심 신호 TOP3` label, moving the legend directly under the graph, keeping the chips lightweight, and removing the selected `AI 진단 결과` conclusion card.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px light/dark checks confirmed the conclusion card and `핵심 신호 TOP3` label are removed, legend appears before chips, chips remain visible, SVG size remains 247x242, scrollWidth/clientWidth 390/390, no SVG label overlap/clipping, and no console/page errors; in-app Browser `/test-result` reload confirmed the same with scrollWidth/clientWidth 380/380.
- Notes/risks: Removing the conclusion card reduces repeated messaging and shortens Step 1, but the one-line diagnosis no longer appears as a separate card inside Step 1.
- Reusable rule: If Step 1 already has a clear heading and radar interpretation, avoid adding a separate conclusion card that competes with the photo/radar flow.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 face lab card polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 photo plus Face Lab card internal UI polish in `app/result/page.js`; Step 1 overall structure, skin radar card, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Make Face Lab read more clearly as a photo-derived face mood summary by renaming the title to `Face Lab · 얼굴 분위기` and changing the rows into icon, label, and value mini-list items.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px light/dark checks confirmed the new title, `대표 무드`/`톤/컬러`/`스타일 방향` labels, values, preserved photo size at 156x195, scrollWidth/clientWidth 390/390, and no console/page errors; in-app Browser `/test-result` reload confirmed Face Lab, radar, priority, and no horizontal overflow at the current viewport.
- Notes/risks: The longer style value wraps naturally to multiple lines on 390px, which increases the Face Lab side panel height slightly without shrinking the photo.
- Reusable rule: Face Lab should stay tied to the photo as face-mood context, using compact icon rows for scanability while avoiding skin-state terminology and new interactions.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 face lab vertical carousel

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 photo plus Face Lab card internal interaction polish in `app/result/page.js`; Step 1 overall structure, skin radar card, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Replace the side-by-side Face Lab panel with one large photo followed by a single Face Lab lens value that advances by mobile swipe, desktop arrows, or dots.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check -- app/result/page.js` passed with CRLF warning only; `npm run build` passed; Playwright checks confirmed 390px dark photo size 251x314, no horizontal overflow, mobile arrows hidden, mobile swipe 1/3 -> 2/3 -> 3/3, 390px light no horizontal overflow, desktop 900px arrows visible, desktop next arrow 1/3 -> 2/3, and no console/page errors.
- Notes/risks: The larger photo makes the Face Lab card taller. This matches the requested photo-first direction but pushes the priority card lower on 390px screens.
- Reusable rule: Face Lab interaction should stay inside the photo card, with the photo as the primary object and only one face-mood lens value visible at a time; use mobile swipe and desktop arrows without turning Step 1 into a full carousel.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 face lab carousel final polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 Face Lab card and priority rank circle UI-only polish in `app/result/page.js`; skin radar, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Reduce the Face Lab photo by 10%, remove the visible `1 / 3` counter, move desktop arrows beside the value text, remove the Face Lab icon, enlarge Face Lab text, move the one-time hint animation from the photo to the text, and shrink priority rank circles by about 15%.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check -- app/result/page.js` passed with CRLF warning only; `npm run build` passed; Playwright 390px dark check confirmed no horizontal overflow, no visible `1 / 3`, no Face Lab icon, photo 225x282, mobile arrows hidden, priority circle 27x27, and mobile swipe advanced the active Face Lab dot; Playwright 703px dark check confirmed desktop arrows visible beside the value text and next arrow advanced the active dot; 390px light screenshot confirmed no layout break.
- Notes/risks: The Face Lab card remains taller than the pre-carousel design, but the latest photo reduction shortens it while keeping the photo visually dominant.
- Reusable rule: For this Face Lab carousel, keep visible progress in dots only, keep mobile swipe hint on the text area, and keep desktop arrows adjacent to the value text rather than in the card header.
- Context promotion candidate: NULL

### 2026-06-07 / free result v2 final step main handoff

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Result final-step UI handoff from `main` into `feature/free-result-flow-v2`; v2 Steps 1-4, API, DB, payment, saved data shape, auth/redirect logic, and branch merge/delete/create operations were out of scope.
- Goal: Replace the v2 final premium-preview step with the `main` result final step structure and restore the final save CTA wording to the `main` behavior.
- Changed files: app/result/page.js, components/result/SaveReportCTA.jsx, .codex/AI_WORK_LOG.md
- Protected areas: No API, DB, payment, stored data, env, or auth/redirect logic changed. `SaveReportCTA` was limited to removing v2-only UI override props and restoring existing default labels/helper copy.
- Validation: `git diff --check -- app/result/page.js components/result/SaveReportCTA.jsx` passed with CRLF warnings only; `npm run build` passed; in-app Browser `/test-result` confirmed Step 5 shows the `main` full-report preview copy/items, `전체 리포트 보기`, default save CTA, and share area; CTA navigated to `/result/full-report`; `/en/test-result` confirmed the English final step and `See Full Report` navigated to `/en/result/full-report`.
- Notes/risks: Branch merge, feature branch deletion, and `feature/premium-report-flow-v1` creation were intentionally not performed until the user completes visual confirmation.
- Reusable rule: When free-result v2 borrows a result step from `main`, copy the step data, wrapper, card component behavior, and final CTA copy together so the step does not mix v2-specific and main-specific messaging.
- Context promotion candidate: NULL

### 2026-06-07 / premium report Skin Match action-plan restructure

- Branch: feature/premium-report-flow-v1
- Task type: diagnostic -> execution
- Routing decision: Medium UI refactor after diagnosis. The paid Skin Match report surface, section order, copy, CTA strength, and Face Lab entry hierarchy were in scope; recommendation logic, API, DB, payment, saved data, and free result steps were protected.
- Goal: Reorder paid Skin Match from a detail-heavy report into a 6-step post-payment action plan: start today, morning routine, evening routine, avoid list, adjustment guide, and alternative/budget plan.
- Changed files: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- Protected areas: No recommendation engine, API route, DB schema/migration/policy, payment, auth/redirect, env, product data, saved-data structure, free Step1-4, or Step5 file changes.
- Validation: `npm run build` passed; in-app Browser `/test-full-report` confirmed Skin Match opens first at 390px CSS width, `1/6` today-start plan is first, 2/6 through 6/6 advance in the requested order, no horizontal overflow, 1/6 has no `판매처 보기`, 6/6 includes store CTA and Face Lab ready handoff, Face Lab handoff opens the Face Lab report, and browser console errors were 0; `git diff --check` passed with CRLF warning only.
- Notes/risks: The UI additions are concentrated in `app/result/full-report/page.js`, which already owns this screen. No production payment/API flow was exercised because this was verified through the development fixture route.
- Reusable rule: Paid report CTAs should follow the user value sequence: decision and routine first, purchase links as light support inside routine steps, and the strongest store CTAs in the final alternative/budget section.
- Context promotion candidate: NULL

### 2026-06-07 / premium report Skin Match micro polish

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Second-pass paid report UI polish with the existing 6-step Skin Match structure preserved. Only copy, card hierarchy, routine display text, final CTA grouping, and Face Lab handoff copy were in scope.
- Goal: Make the paid Skin Match report feel more immediately actionable after payment without adding new product, recommendation, API, DB, payment, auth, free-result, or Step5 behavior.
- Changed files: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- Protected areas: This task did not edit recommendation/API/DB/payment/auth/free result files. During final verification, separate dirty files were detected in `lib/product-source.js`, `lib/recommendation-scoring.ts`, `lib/skin-match-decision-engine.js`, `lib/product-category-utils.js`, and `supabase/migrations/*.sql`; those were not modified or reverted in this task.
- Validation: `npm run build` passed; in-app Browser `/test-full-report` at CSS `innerWidth: 390` confirmed Skin Match opens first, 1/6 dashboard summaries are visible with no store CTA, 2/6 and 3/6 show compressed action-first routine copy, 4/6 has a clear `가장 먼저 피할 것` card, 5/6 common safe boundary uses adjustment-guide wording, 6/6 has store links plus `추천 제품 모아보기`, Face Lab handoff copy is strengthened, no horizontal overflow, and console errors were 0; `git diff --check` passed with CRLF warnings only.
- Notes/risks: The final worktree includes protected-area dirty files from outside this UI task, so final review should separate the paid-report UI diff from those existing recommendation/DB changes before commit.
- Reusable rule: Second-pass paid-report polish should tighten hierarchy and copy inside existing sections rather than adding new report structure or new purchase behavior.
- Context promotion candidate: NULL

### 2026-06-07 / moisturizer subcategory recommendation and DB insert

- Branch: feature/premium-report-flow-v1
- Task type: diagnostic -> execution
- Routing decision: User explicitly approved protected DB/migration work after backup-branch diagnosis. Scope was limited to Supabase moisturizer subcategory migrations, the 15-item lotion/emulsion insert, recommendation slot support for moisturizer subcategories, and local backup branch cleanup.
- Goal: Preserve the useful `codex/local-leftovers-backup` changes for moisturizer subcategories, apply the missing Supabase insert, avoid risky package changes, and remove the backup branch.
- Changed files: lib/product-category-utils.js, lib/product-source.js, lib/recommendation-scoring.ts, lib/skin-match-decision-engine.js, supabase/migrations/20260524054039_split_moisturizer_categories.sql, supabase/migrations/20260524054049_reclassify_existing_moisturizers.sql, supabase/migrations/20260526_moisturizer_lotion_emulsion_insert.sql, .codex/AI_WORK_LOG.md
- Protected areas: DB/migration changes were performed only after explicit user approval. No package, auth, payment, env, API response field, or saved-data structure changes were made.
- Validation: `npm run build` passed; `git diff --check` passed for the changed recommendation/migration files; Supabase insert target count returned 15/15; `moisturizer_lotion_emulsion` product count increased to 20; `supabase migration repair 20260526 --status applied --linked --yes` marked the executed data migration as applied remotely.
- Notes/risks: Existing unrelated dirty files were present before this task: `app/result/full-report/page.js` and prior `.codex/AI_WORK_LOG.md` edits. Older local-only Supabase migrations still appear in `supabase migration list`; they were not touched.
- Reusable rule: When a data migration is executed directly with `supabase db query --linked --file`, repair the remote migration history for that exact migration only after verifying the target rows exist.
- Context promotion candidate: NULL

### 2026-06-12 / premium report main hub ripple redesign

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium UI layout refactor limited to the paid report main hub in `app/result/full-report/page.js`; loading core, recommendation logic, product data, API, DB, payment, auth, free result, Step5, and Face Lab logic were out of scope.
- Goal: Replace the ordinary central-card plus 2x2 quick-card menu with a ripple/circular hub where `Start Today` is the central node and Routine/Product/Caution/Adjust are surrounding action areas.
- Changed files: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `npm run build` passed; Playwright `/test-full-report` checks passed for 390px light/dark and 1440px light/dark with no horizontal overflow, no console/page errors, 4 accessible hub action buttons, no ordinary grid button structure, no same-column card overlap, and preserved click navigation for routine/product/caution/adjust.
- Notes/risks: Verification used the fixture route `/test-full-report` because the real `/result/full-report` route requires a premium session.
- Reusable rule: Paid report entry hubs should keep the central decision/first-action as the strongest visual node, with secondary destinations arranged around it and wired to existing step navigation rather than new routes or API calls.
- Context promotion candidate: NULL

### 2026-06-12 / premium report main hub final polish

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Low/Medium UI polish limited to the paid report main hub in `app/result/full-report/page.js`; the central hub plus surrounding 4-action structure was preserved.
- Goal: Remove the repeated top `Start Today` title, reduce hub/card visual crowding, soften light/dark borders and ripple lines, and change the central CTA copy.
- Changed files: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Loading core, recommendation logic, product data, API, DB schema, payment, auth, free result, Step5, Face Lab logic, and detailed paid report content were not touched.
- Validation: `npm run build` passed; Playwright `/test-full-report` checks passed for 390px light/dark and 1440px light/dark with no horizontal overflow, no console/page errors, top title changed to `Skin Match 플랜`, central `오늘 시작` kept, CTA changed to `오늘 할 일 먼저 보기`, 4 accessible action buttons preserved, and routine/product/caution/adjust plus central CTA navigation still moved off the hub.
- Notes/risks: Visual verification used the fixture route `/test-full-report` because the production full-report route requires a premium session.
- Reusable rule: For paid report hub polish, adjust hierarchy, spacing, opacity, and copy inside the existing hub layout before considering structural changes.
- Context promotion candidate: NULL

### 2026-06-12 / premium report loading flow history cleanup

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium UI/navigation bug fix limited to full-report loading transition. Recommendation logic, API response shape, DB, payment, auth, env, and saved-data structure were out of scope.
- Goal: Keep the full-report URL on `/result/full-report`, show the original droplet loading process until 100%, reveal the existing tap-to-open state, and show the existing ripple transition before rendering the report. Prevent `/result/full-report/loading` from remaining in browser history.
- Changed files: app/result/page.js, app/result/full-report/page.js, app/result/full-report/loading/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `npm run build` passed.
- Notes/risks: The existing droplet loading route remains available, but normal result CTA now goes directly to `/result/full-report`; direct loading-route open uses `router.replace` when moving to the report.
- Reusable rule: Full-report loading animation should be rendered as a transient UI state on the report route, not as a history-visible intermediate route in the normal CTA flow.
- Context promotion candidate: NULL

### 2026-06-15 / Hwahae review signal treatment folder split

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium filesystem/script path update scoped to `data/hwahae-review-signals` treatment raw structure and review-signals script path resolution. Supabase, SQL, tag values, DB writes, API fields, and other category structures were out of scope.
- Goal: Move applied treatment product raw JSON files from `categories/treatment/raw/` into product-form `raw/` folders, create the requested `concerns` folder shells, keep treatment batch files at the treatment category root, and keep `npm run review_in_supabase` from writing treatment raw output to the old path. Follow-ups in the same scope made treatment batches accept mixed serum/ampoule/essence rows, use live `products.product_form` first when choosing the product-form raw folder, and made newly generated non-treatment product raw JSON write into each category's `raw/` folder while keeping batch/plan/fixture files at category roots.
- Changed files: data/hwahae-review-signals/categories product raw JSON locations, data/hwahae-review-signals/README.md, scripts/review-signals/review-in-supabase.mjs, scripts/review-signals/prepare-hwahae-review-raw-batch.mjs, .codex/AI_WORK_LOG.md
- Protected areas: No `.env*`, auth, DB schema/migration/policy, payment, production data, API response field names, stored JSON content, deployment config, or package changes were touched.
- Validation: Confirmed `data/hwahae-review-signals/categories/treatment/raw` was removed after becoming empty; confirmed treatment root still contains `hwahae-serum-essence-ampoule-review-signals.batch.json`, `.jsonl`, and `notes.md`; confirmed existing non-treatment product JSON files that were outside `raw/` remain outside `raw/` because they are not known applied outputs; confirmed the 8 moved treatment product JSON blobs match their previous HEAD content hashes; `node --check` passed for both touched review-signals scripts; `git diff --check` passed with existing LF-to-CRLF warnings only; a temp `prepare-hwahae-review-raw-batch.mjs --no-verify-supabase` plan-only run confirmed mixed serum/ampoule/essence treatment rows output to `categories/treatment/{serum,ampoule,essence}/raw`; a temp `review-in-supabase.mjs --plan-only --category treatment` run confirmed the wrapper includes all 3 mixed rows in the treatment plan, then the generated temp plan was removed; a temp cleanser plan-only run confirmed newly generated non-treatment output resolves to `categories/cleanser/raw`.
- Notes/risks: Empty folders such as `concerns/*` and `treatment/unknown/raw` exist in the working tree but are not represented by Git unless placeholder files are added later. Full `npm run review_in_supabase` was not run because it can reach browser extraction and Supabase import stages.
- Reusable rule: When a category folder changes from `category/raw` to `category/product-form/raw`, keep generated batch/fixture files at the category root and route only per-product raw extraction output into the product-form raw folders.
- Context promotion candidate: NULL

### 2026-06-13 / premium report TodayStartPlanStep extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium refactor/move-only task limited to extracting the TodayStartPlanStep UI bundle from `app/result/full-report/page.js`; UI copy, class names, navigation step order, router/session/API/tracking logic, other Step UI, and protected areas were out of scope.
- Goal: Move `SkinMatchHubIcon`, `SkinMatchHubQuickCard`, and `TodayStartPlanStep` into `components/full-report/TodayStartPlanStep.jsx`, with page-level data helpers remaining in `page.js` and values/callbacks passed as props.
- Changed files: app/result/full-report/page.js, components/full-report/TodayStartPlanStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: Normalized source comparison confirmed the moved block matches the original except for exports, removed internal data computations, and prop passing; `git diff --check -- app/result/full-report/page.js components/full-report/TodayStartPlanStep.jsx` passed with a CRLF warning only; `npm run lint` could not run because `next lint` opened the ESLint configuration prompt; `npm run build` passed.
- Notes/risks: `SkinMatchHubQuickCard` is named-exported from the new component file so the existing `LegacyTodayStartPlanStep` reference in `page.js` keeps the same runtime target if that legacy path is ever invoked.
- Reusable rule: When extracting a full-report UI subcomponent, keep shared data helpers in the page and pass computed values/callbacks as props unless the helper is private to the extracted UI bundle.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 primitives extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to free result V2 primitive UI and pure icon components in `app/result/page.js`; step structure, data builders, recommendation logic, tracking/API/sessionStorage/auth/save/share logic, and legacy components were out of scope.
- Goal: Move `FreeResultV2StepFrame`, `FreeResultV2Card`, `FreeResultV2Pill`, `FreeResultV2LockIcon`, and pure V2 icon components into `components/result/free-v2/FreeResultV2Primitives.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2Primitives.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --stat` showed `app/result/page.js` reduced by 343 deleted lines with 13 import lines added; the new untracked primitive file is 308 lines and listed separately by `git status`; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2Primitives.jsx` passed with a CRLF warning only; `npm run build` passed.
- Notes/risks: `FreeResultV2FaceLabMoodIcon` was moved into the primitive file but not imported back into `page.js` because the current page does not call it. No browser visual verification was run for this move-only task.
- Reusable rule: For free result V2 extraction, move primitive UI and pure SVG icons before step components, and leave step assembly plus display-data builders in `page.js` until they are targeted explicitly.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 diagnosis step extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to `FreeResultV2DiagnosisStep` and its Step 1-only photo, Face Lab carousel, radar, and priority display UI; step assembly, `currentResultStep`, data builders, recommendation logic, tracking/API/sessionStorage/auth/save/share logic, copy maps, and legacy components were out of scope.
- Goal: Move `FreeResultV2DiagnosisStep` and Step 1-only pure display helpers into `components/result/free-v2/FreeResultV2DiagnosisStep.jsx`, importing shared primitives from `FreeResultV2Primitives.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2DiagnosisStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: Normalized source comparison confirmed the moved Step 1 block matches the original except for module imports, local `uniqueItems` helper copy, and default export; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2DiagnosisStep.jsx` passed with a CRLF warning only; `npm run build` passed.
- Notes/risks: `git diff --stat` reports `app/result/page.js` only while the new file is untracked; no browser visual verification was run for this move-only task.
- Reusable rule: When extracting free result V2 step components, keep the step's props contract and result step assembly unchanged, and only copy tiny local helpers when the shared helper remains in `page.js` for other code.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 evidence step extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to `FreeResultV2EvidenceStep` and its Step 2-only evidence photo card, signal card, reason note helper, and bridge UI; step assembly, `currentResultStep`, data builders, recommendation logic, tracking/API/auth/save/share logic, copy maps, and legacy components were out of scope.
- Goal: Move `FreeResultV2EvidenceStep` and Step 2-only pure display helpers into `components/result/free-v2/FreeResultV2EvidenceStep.jsx`, importing shared primitives from `FreeResultV2Primitives.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2EvidenceStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Tracking/API/auth/save/share logic was not touched; the Step 2 reveal `sessionStorage` behavior was moved unchanged with its UI card.
- Validation: Normalized source comparison confirmed the moved Step 2 block matches the original except for module imports and default export; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2EvidenceStep.jsx` passed with a CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reloaded successfully with main content rendered, no horizontal overflow, and console error logs 0.
- Notes/risks: `git diff --stat` reports `app/result/page.js` only while the new file is untracked.
- Reusable rule: When extracting free result V2 step components, keep props contract and step assembly unchanged, and move UI-local browser state only with the UI block it belongs to.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 recommendation guide step extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to `FreeResultV2RecommendationGuideStep` and its Step 3-only top pick, role pill, tabbed routine preview, premium preview, and fallback UI; step assembly, `currentResultStep`, recommendation logic, product normalization, data builders, tracking/API/sessionStorage/auth/save/share logic, purchase CTA behavior, and legacy components were out of scope.
- Goal: Move the free result V2 Step 3 recommendation guide UI into `components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx`, importing shared primitives from `FreeResultV2Primitives.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: Normalized source comparison confirmed the moved Step 3 block matches the original except for module imports, default export, and a private Step 3 product thumbnail helper needed because shared `SmallProductThumb` remains in `page.js`; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx` passed with a CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reached Step 3 with guide title, TOP PICK card, routine tabs, no horizontal overflow, and console error logs 0.
- Notes/risks: The new file duplicates the display-only product thumbnail markup for Step 3 so the shared page-level `SmallProductThumb` is not moved away from other legacy/current product cards.
- Reusable rule: When an extracted free result V2 step depends on a page-local helper that is shared with other sections, keep the shared helper in `page.js` and use a private display-only duplicate only when it avoids changing step props or broader file ownership.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 recommendation validation step extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to `FreeResultV2RecommendationValidationStep` and its Step 4-only tabbed signal UI and locked full-report preview card; step assembly, `currentResultStep`, recommendation logic, data builders, copy maps, tracking/API/sessionStorage/auth/save/share logic, and CTA behavior were out of scope.
- Goal: Move the free result V2 Step 4 recommendation validation UI into `components/result/free-v2/FreeResultV2RecommendationValidationStep.jsx`, importing shared primitives from `FreeResultV2Primitives.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2RecommendationValidationStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: Normalized source comparison confirmed the moved Step 4 block matches the original except for module imports and default export; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2RecommendationValidationStep.jsx` passed with a CRLF warning only; `npm run build` passed after restoring one adjacent legacy lock-row line affected during extraction; in-app Browser `/test-result` reached Step 4 with validation title, fit/adjust signal tabs, no horizontal overflow, and console error logs 0.
- Notes/risks: The extraction briefly broke an adjacent legacy `FreeResultV2RoutineFaceLabStep` lock row during block removal, then restored it before final validation.
- Reusable rule: For move-only extraction near legacy unused blocks, verify the adjacent before/after function boundaries after deletion because older blocks may remain interleaved around the active V2 steps.
- Context promotion candidate: NULL

### 2026-06-19 / premium current products MVP-A

- Branch: feature/premium-current-products-mvp
- Task type: execution
- Routing decision: Medium feature addition with a protected API/data boundary. DB schema/migration, free result shape, payment, auth, recommendation topPick/supportingProducts/routine recalculation, Face Lab, and saved DB schema were out of scope.
- Goal: Add first-pass current product selection context for paid Skin Match reports, pass sanitized `currentProducts` through `/api/analyze`, store it only inside `premiumReport`, and show a current-products summary block in `/result/full-report`.
- Changed files: app/api/current-products/products/route.js, components/current-products/CurrentProductsSelector.jsx, lib/current-products.js, lib/product-source.js, app/page.js, app/api/analyze/route.js, lib/skin-match-decision-engine.js, app/result/full-report/page.js, lib/test-result-fixture.js, .codex/AI_WORK_LOG.md
- Protected areas: No DB schema/migration/policy, payment, auth, free result payload shape, topPick selection, supportingProducts, full routine recalculation, AM/PM automatic rebalance, condition response, functional decision, or Face Lab behavior changed.
- Validation: `npm run build` passed; `GET /api/current-products/products?category=sunscreen` returned only `id, brand, name, category, product_form, image_url`; unsupported category returned 400; Playwright 390px `/test-full-report` confirmed `scrollWidth=390`, current-products block visible, selected product visible, sunscreen `not_in_db` copy visible, `not_using` copy visible, and console error logs 0.
- Issues/risks: The selector is a compact MVP section on the existing survey screen, not a polished separate onboarding step. Product display names in PowerShell output can look mojibake because of terminal encoding, while browser rendering is UTF-8. Product details in premium report are resolved from the recommendation product catalog; if a selected product id is not in that catalog, the report can still show the product id but not brand/name.
- Context promotion candidate: NULL

### 2026-06-19 / premium current products snapshot stabilization

- Branch: feature/premium-current-products-mvp
- Task type: execution
- Routing decision: Medium stabilization scoped to the paid full-report current-products summary block and its premium-only payload. Recommendation ranking, supporting products, routine structure, AM/PM slot placement, DB schema, and free-result shape were out of scope.
- Goal: Ensure selected current products display from a minimal Supabase productSnapshot instead of depending on the recommendation catalog.
- Changed files: lib/product-source.js, lib/current-products.js, lib/skin-match-decision-engine.js, app/api/analyze/route.js, app/result/full-report/page.js, lib/test-result-fixture.js, .codex/AI_WORK_LOG.md
- Protected areas: No DB schema/migration/policy, auth, payment, environment, topPick/supportingProducts/routineStructure, AM/PM rebalance, or free-result payload changes.
- Validation: `npm run build` passed. Playwright mobile verification on `/en/test-full-report` at 390px confirmed the current-products block renders, selected productSnapshot brand/name displays, productSnapshot null fallback displays, not_in_db and not_using stay distinct, sunscreen not_in_db copy stays distinct, document/body scrollWidth remained 390, and console error count was 0.
- Notes/risks: productSnapshot fetch uses the same minimal current-product field set as the selector API; lookup failure is intentionally represented as productSnapshot null.
- Context promotion candidate: NULL

### 2026-06-19 / premium current products feature gate safety check

- Branch: feature/premium-current-products-mvp
- Task type: diagnostic with minimal execution
- Routing decision: Medium gate/payload stabilization scoped to `CurrentProductsSelector` exposure and `/api/analyze` currentProducts submission. DB schema, recommendation logic, routine slots, paid report rendering, and free result shape were out of scope.
- Goal: Align current-products selector exposure and currentProducts FormData submission with the existing premium report gate before merge.
- Changed files: app/page.js, .codex/AI_WORK_LOG.md
- Protected areas: No DB schema/migration/policy, auth/payment, recommendation topPick/supportingProducts/routineStructure, full-report feature gate, or free-result payload shape changes.
- Validation: Production flag-off build with `NEXT_PUBLIC_PREMIUM_REPORT_ENABLED=false npm run build` passed; production `next start` at 390px confirmed selector absent on the survey step, `/api/analyze` multipart body did not include `currentProducts`, scrollWidth remained 390, and console error count was 0. Development `next dev` at 390px confirmed selector present, selected/not_in_db/not_using controls visible, selecting `not_in_db` sent `currentProducts` JSON to `/api/analyze`, scrollWidth remained 390, and console error count was 0. `/api/current-products/products?category=sunscreen` returned only `id, brand, name, category, product_form, image_url`; `git diff --check` passed with CRLF warnings only.
- Notes/risks: The current-products API remains callable in production, but it exposes only the agreed minimal public product fields. Selector UI and analyze payload are now gated behind the same premium flag as the paid report.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 premium preview step extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to the free result V2 Step 5 premium-preview display UI; `goToFullReport`, step assembly, `currentResultStep`, `ResultBottomCTA`, `SaveReportCTA`, data builders, copy maps, tracking/API/sessionStorage/auth/save/share logic, and legacy preview helpers were out of scope.
- Goal: Move the active Step 5 wrapper, premium preview lead display, `ResultPreviewMaskCard`, and its internal CTA button JSX into `components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched; the full-report CTA still receives the page-level `goToFullReport` callback via `onFullReportClick`.
- Validation: Normalized comparison confirmed `ResultPreviewMaskCard` matches the original and the Step 5 wrapper/callback contract is preserved; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx` passed with a CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reached Step 5 with premium preview text and CTA, no horizontal overflow, console error logs 0; clicking `전체 리포트 보기` navigated to `/result/full-report` and rendered the premium report handoff state.
- Notes/risks: `FreeResultV2PremiumPreviewLead` keeps the active Step 5 rendered output without moving `resultCopy`; legacy preview helpers (`ResultPreviewThumb`, `ResultPreviewLargeVisual`, `ResultPreviewHighlightCard`, `ResultPreviewLockedRow`) remain in `page.js`.
- Reusable rule: For final-step extraction, pass page-owned navigation/tracking callbacks down as props and keep save/login/session behavior at the page or dedicated CTA component boundary.
- Context promotion candidate: NULL

### 2026-06-13 / free result legacy UI quarantine

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to legacy/inactive UI components that are not directly used by the active free result V2 Step 1-5 `resultSteps` path; step structure, active Step components, display data builders, copy maps, sessionStorage/auth/API/tracking/save/share logic, and deletion were out of scope.
- Goal: Move inactive legacy UI groups into `components/result/legacy/ResultLegacySections.jsx` as named exports while leaving active free result V2 rendering untouched.
- Changed files: app/result/page.js, components/result/legacy/ResultLegacySections.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `rg` confirmed moved legacy components now live only in `ResultLegacySections.jsx`; normalized source comparison confirmed the moved legacy UI block matches the original except for module imports and named exports; `git diff --check -- app/result/page.js components/result/legacy/ResultLegacySections.jsx` passed with a CRLF warning only; `npm run build` passed; in-app Browser `/test-result` confirmed Steps 1-5 render with no horizontal overflow and console error logs 0.
- Notes/risks: `PhotoObservationCard`, `CategoryCarousel`, and `ProductDecisionCard` stayed in `page.js` because they depend on page-level display builders, product helpers, and tracking. Smaller legacy helpers `FreeResultV2RoleCard`, `FreeResultV2CompactRoutineFlow`, and `FreeResultV2Step3LockCard` also stayed because they were outside the confirmed move group.
- Reusable rule: Legacy UI quarantine should move only self-contained inactive UI bundles; leave candidates with display-builder or tracking dependencies in `page.js` until their helper contracts are explicitly extracted.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 static display builder extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to three self-contained free result V2 display builders; copy maps, product/evidence/diagnosis helpers, step assembly, recommendation logic, sessionStorage/auth/API/tracking/save/share logic, and CTA behavior were out of scope.
- Goal: Move `buildFreeResultV2RoutinePreview`, `buildFreeResultV2FaceLabPreview`, and `buildFinalReportPreviewSections` into `lib/result/free-result-v2-static-builders.js`, then import them from `app/result/page.js` without changing call sites.
- Changed files: app/result/page.js, lib/result/free-result-v2-static-builders.js, .codex/AI_WORK_LOG.md
- Protected areas: `resultCopy`, `displayMap`, `topPickHeadlineMap`, Diagnosis/Evidence/Top Pick builders/helpers, `currentResultStep`, `resultSteps`, sessionStorage/auth/API/tracking/save/share, and recommendation logic were not changed.
- Validation: Normalized source comparison reported all three moved functions as `same`; `git diff --check -- app/result/page.js` passed with a CRLF warning only; new-file whitespace check passed; `npm run build` passed; in-app Browser verified `/test-result` Step 1-5 rendering, Step 3 night routine tab, Step 5 premium preview, no horizontal overflow, and console error logs 0.
- Notes/risks: The dev server was initially not running, so Browser first saw connection refused. Started `npm run dev` on port 3001 and verified via `http://127.0.0.1:3001/test-result`. Step 5 showed the previous animated body immediately after advancing, then settled to the premium preview after the transition completed.
- Reusable rule: For display builder move-only work, compare normalized moved function bodies against the original before relying on build/browser checks.
- Context promotion candidate: NULL

### 2026-06-13 / products treatment category migration draft

- Branch: feature/premium-report-flow-v1
- Task type: diagnostic to limited execution
- Routing decision: High DB schema/data migration task. Protected production data was not modified directly; work was limited to local migration files and read-only linked Supabase checks.
- Goal: Add `treatment` as the high-level category for serum/ampoule/essence products, preserve the original form in `product_form`, and provide verification SQL without touching recommendation, crawler, tagging, or duplicate-key logic.
- Changed files: supabase/migrations/20260613025816_add_treatment_product_form.sql, supabase/migrations/20260613030023_migrate_treatment_product_forms.sql, data/hwahae/products_schema(SQL 생성시 참조 파일).csv, .codex/AI_WORK_LOG.md
- Protected areas: No `.env*`, auth, RLS policy, payment, API response field names, recommendation logic, crawler logic, product tagging logic, or normalized brand/name unique index changes.
- Validation: Confirmed linked Supabase `products.category` is `USER-DEFINED product_category`; confirmed `product_form` does not yet exist; confirmed current enum values do not include `treatment`; confirmed current target rows are exactly 9 (`serum` 3, `ampoule` 3, `essence` 3) and listed their ids/names; `git diff --check` passed for changed files with only the existing LF-to-CRLF warning on the CSV.
- Issues/risks: Supabase MCP failed to handshake, so CLI was used for read-only checks. Local Supabase DB could not be started because Docker is not installed. `supabase db push --dry-run` did not validate pending migrations because remote migration history contains versions missing locally (`20260506070849`, `20260506092454`); do not push until migration history is reconciled.
- Next work: Reconcile remote/local migration history, then apply migrations and run the verification queries in the migration comment block.
- Reusable rule: For Postgres enum migrations that add and then use a new enum value, split enum DDL and data updates into separate migration files to avoid same-transaction enum visibility problems.
- Context promotion candidate: NULL

### 2026-06-13 / treatment category local safety patch

- Branch: feature/premium-report-flow-v1
- Task type: limited execution
- Routing decision: High DB-related change limited to local migration SQL and app interpretation helpers. No remote DB write, migration push, repair, crawler edit, or broad recommendation redesign was performed.
- Goal: Preserve the remote `map_product_category()` search_path attribute in the local migration and make app/result/analyze category interpretation treat `treatment` plus legacy `serum`/`ampoule`/`essence` as the serum/ampoule routine family.
- Changed files: supabase/migrations/20260613030023_migrate_treatment_product_forms.sql, lib/product-category-utils.js, lib/recommendation-scoring.ts, app/result/page.js, app/result/full-report/page.js, app/api/analyze/route.js, .codex/AI_WORK_LOG.md
- Protected areas: Remote DB, migration history, Python import scripts, crawler logic, auth, payment, policy, and large scoring formula changes were not touched.
- Validation: `git diff --check` passed for touched migration/app files with CRLF warnings only; `npm run build` passed. Search confirmed requested app-scope serum-family branches include `treatment` and legacy `essence`.
- Issues/risks: `lib/review-signals.js`, crawler, and Hwahae import scripts still contain serum/ampoule/essence assumptions and remain intentionally unchanged for a later step. Remote migration history still has missing local versions `20260506070849` and `20260506092454`.
- Next work: Resolve migration history mismatch before any push, then apply migrations only after approval and run verification SELECTs.
- Reusable rule: When category enum semantics shift, update all display/slot/LLM category-family normalizers before applying the data migration.
- Context promotion candidate: NULL

### 2026-06-13 / Hwahae treatment import product_form inference

- Branch: feature/premium-report-flow-v1
- Task type: limited execution
- Routing decision: Medium pipeline change scoped to Hwahae import preparation and final candidate field passthrough. Remote DB, migration files, app recommendation logic, and crawler/Python outside the import package were out of scope.
- Goal: Route treatment category files through `category=treatment`, stop emitting serum/ampoule/essence as categories from the batch wrapper, and infer `product_form` from product names for treatment candidates.
- Changed files: scripts/hwahae-import/prepare_hwahae_batch.py, scripts/hwahae-import/build_hwahae_import_package.py, .codex/AI_WORK_LOG.md
- Protected areas: No remote DB write, migration edit, app code edit, recommendation scoring change, or crawler change.
- Validation: `python -m py_compile scripts/hwahae-import/prepare_hwahae_batch.py scripts/hwahae-import/build_hwahae_import_package.py` passed; `python -X utf8 scripts/hwahae-import/prepare_hwahae_batch.py --dry-run` mapped current `각질.json` to `treatment` and printed product_form counts `ampoule=2, essence=1, peeling_solution=1, serum=6`; temporary `treatment.json` dry-run produced the same treatment mapping and counts; temporary `클렌저.json` dry-run still mapped to `cleanser`; local temp build confirmed final new candidates preserve `category`, `inferredCategory`, `product_form`, and `productForm`.
- Issues/risks: The repo currently has `data/hwahae/각질.json`, not `data/hwahae/treatment.json`; `treatment.json` behavior was verified with a temporary copy. Product form inference follows the requested keyword order, so names containing both an ampoule/serum word and acid keywords resolve to the earlier form keyword.
- Context promotion candidate: NULL

### 2026-06-19 / premium current products routine slots MVP-B

- Branch: feature/premium-current-products-slots
- Task type: limited execution
- Routing decision: Medium UI/data-display change scoped to paid full-report routine consultation and currentProducts display model. Recommendation scoring, topPick/supportingProducts selection, routineStructure generation, free result payload/UI, DB schema/migration, payment, and saved data structure were out of scope.
- Goal: Show `premiumReport.currentProducts` selections as compact current-product rows inside the paid Skin Match routine consultation AM/PM slots without changing recommendation logic.
- Changed files: app/result/full-report/page.js, lib/current-products.js, .codex/AI_WORK_LOG.md
- Protected areas: Recommendation algorithms, product DB, API response field names, DB schema/migrations, payment/session structure, free result payload/UI, main flower hub, active judgment, condition response, and Face Lab structure were not changed.
- Validation: `buildCurrentProductRoutineSlots` direct check confirmed `sunscreen not_in_db` appears as currently using in protect and `sunscreen not_using` appears as an empty morning protection slot; `git diff --check` passed with CRLF warnings only; `npm run build` passed; Playwright 390px `/test-full-report` flow opened the paid report, entered routine consultation, confirmed selected fallback/current product, sunscreen not-in-DB, moisturizer not-using, PM functional note, no horizontal overflow, and console/page errors 0.
- Follow-up: Compact UI cleanup changed the existing routine product label to `이 단계 추천 제품`, lowered currentProducts rows to thin border-left helper rows, and reduced the bottom `현재 제품 반영` block to short guidance plus status counts. User-facing MVP/development copy was removed.
- Follow-up: currentProducts rows were raised from border-left helper text to small inset status boxes with muted background/border, still smaller than the recommendation product card. The bottom summary count was condensed to a single `DB 제품 2 · DB 미등록 1 · 사용 안 함 1` line.
- Follow-up: Moved currentProducts display JSX out of `app/result/full-report/page.js` into `components/result/premium/CurrentProductSlotNote.jsx` and `components/result/premium/CurrentProductsSummaryCard.jsx`. Page-level responsibility is now limited to building slot data and rendering the two components.
- Follow-up: Full-report loading handoff now uses `fullReportOpenedAt`, written only when `내 플랜 열기` is clicked. First generated entry still shows the water-drop handoff after loading; later entries with that key skip the handoff and render the report body directly.
- Follow-up: Replaced the top `Skin Match / Face Lab` segmented control with a single `메인 허브로 이동` button. The button switches back to the Skin Match tab and resets the Skin Match stepper to the main hub; Face Lab remains reachable from the existing hub/CTA path.
- Notes/risks: The in-app Browser plugin could not open local URLs, so verification used local Playwright. `/test-full-report` starts from the existing premium loading handoff on first open and requires clicking `내 플랜 열기` once before later direct entry.
- Context promotion candidate: NULL

### 2026-06-20 / current-products legacy group removal

- Branch: main
- Task type: execution
- Routing decision: Medium current-products UI/API cleanup. Read-only live Supabase category check was required before editing; DB schema, migrations, production data, auth, payment, API response field names, and saved data structure were not modified.
- Goal: Remove the legacy current-products group after confirming no live `products.category` rows use the legacy group key, `spot`, or `mask`, while keeping `treatment` as a real selectable category in the serum/treatment group.
- Changed files: lib/current-products.js, components/current-products/CurrentProductsSelector.jsx, lib/product-source.js, .codex/AI_WORK_LOG.md
- Protected areas: No `.env*` edits, DB writes, schema/migration edits, policy changes, auth/payment changes, or API response field-name changes.
- Validation: Read-only Supabase anon query found no rows for the legacy group key, `spot`, or `mask`, and found `treatment=18` across 164 products. `npm run build` passed. Local current-products API returned categories without the legacy group key and with `treatment`; requesting the removed category returned 400 Unsupported category; requesting `treatment` returned 18 treatment products. Search confirmed no legacy group references remain in current-products selector/source/API files; remaining hits are unrelated English copy, migration/normalizer option-word filters, or an unrelated local `Select-String` artifact.
- Notes/risks: Production build has premium report selector hidden unless the premium flag is enabled; selector-specific verification therefore relied on source-level group inspection plus API checks instead of completing the photo upload flow in-browser.
- Context promotion candidate: NULL

### 2026-07-09 / Phase 19 evaluator boundary target capture plan

- Branch: codex/survey-input-contract-refactor
- Task type: limited execution / shadow audit planning
- Routing decision: Medium audit artifact and documentation work scoped to target actual capture planning for evaluator boundary coverage gaps. Runtime evaluator logic, CandidatePolicy runtime, API route, UI/API response, DB/Supabase, product data, existing capture fixtures, and existing recommendation outputs were out of scope.
- Goal: Identify whether active-only, metadata-incomplete, serum category, and strong caution metadata gaps can be observed from current complete/product_row captures, and produce SurveyInputContract-compatible target scenarios for future dev-only actual capture.
- Changed files: scripts/plan-evaluator-boundary-target-captures.mjs, scripts/verify-evaluator-boundary-target-capture-plan.mjs, docs/reviews/evaluator-boundary-target-capture-plan-20260703.md, .codex/AI_WORK_LOG.md
- Protected areas: No route, evaluator, hard filter, score, CandidatePolicy runtime, UI/API response, DB/Supabase, product data, or capture fixture originals were modified.
- Validation: `node scripts/plan-evaluator-boundary-target-captures.mjs`, `node scripts/verify-evaluator-boundary-target-capture-plan.mjs`, actual coverage collector/verifier, evaluator boundary shadow/policy/coverage verifiers, functional exposure audit/readiness review/verifiers, recent-instability/guard/shadow/ranking/goal/survey verifiers, `npm run build`, and `git diff --check` passed. `git diff --check` reported CRLF normalization warnings only.
- Notes/risks: Synthetic fixtures were not treated as actual evidence. The current complete/product_row captures expose 1,640 candidate rows but none of the four missing gap classes. Dev capture execution was not performed by the planner and remains a separate opt-in action with existing `/api/analyze` runtime dependencies.
- Context promotion candidate: Targeted actual capture planning must distinguish actual complete capture evidence from synthetic policy coverage; missing gap observation is a product/candidate distribution limitation, not a policy approval.

### 2026-07-09 / Phase 20 dev-only target scenario capture attempt

- Branch: codex/survey-input-contract-refactor
- Task type: limited execution / guarded runtime capture attempt
- Routing decision: Medium dev-only capture runner and review artifact work. Runtime evaluator logic, CandidatePolicy runtime, API route, UI/API response, DB/Supabase schema, product data, existing fixture originals, and existing recommendation outputs were out of scope.
- Goal: Attempt Phase 19 target scenarios through the existing dev-only `/api/analyze` capture path, then re-check actual coverage gaps.
- Changed files: scripts/run-dev-target-scenario-captures.mjs, scripts/verify-dev-target-scenario-captures.mjs, docs/reviews/evaluator-boundary-dev-target-captures-20260703.md, .codex/AI_WORK_LOG.md
- Protected areas: No route, evaluator, hard filter, score, CandidatePolicy runtime, UI/API response, DB/Supabase schema, product data, or capture fixture originals were modified.
- Result: Actual API execution was skipped with `capture_run_not_executed_db_mutating_guard_path` because the route path invokes analysis guard RPCs and premium report session store writes/prunes. New complete/product_row captures: 0. Actual coverage remains 10 complete captures, 1,640 candidate rows, 86 boundary-applicable rows, and the four Phase 18 gaps still unobserved. `safe_low_risk hidden` remains 50/50 `downgrade_to_collapsed_candidate`; high-risk collapsed count remains 0.
- Validation: `node scripts/run-dev-target-scenario-captures.mjs`, `node scripts/verify-dev-target-scenario-captures.mjs`, Phase 19 planner/verifier, actual coverage collector/verifier, evaluator boundary shadow/policy/coverage verifiers, functional exposure audit/readiness review/verifiers, recent-instability/guard/shadow/ranking/goal/survey verifiers, `npm run build`, and `git diff --check` passed. `git diff --check` reported CRLF normalization warnings only.
- Notes/risks: Synthetic fixtures were not treated as actual evidence. A future run requires an approved isolated dev DB/write path or an approved no-write dev route/guard bypass.
- Context promotion candidate: Dev-only actual capture execution must not silently mutate guard/session stores when a task forbids DB/Supabase mutation; skipped capture with a precise reason is preferable to fabricating evidence.

### 2026-07-09 / Phase 21 analyze no-write capture boundary design

- Branch: codex/survey-input-contract-refactor
- Task type: diagnostic / architecture documentation
- Routing decision: Medium static boundary investigation scoped to `/api/analyze` no-write capture design. Runtime route behavior, evaluator logic, hard filters, ranking scores, CandidatePolicy runtime, UI/API response, DB/Supabase schema, product data, existing fixture originals, and existing recommendation outputs were out of scope.
- Goal: Explain why Phase 20 stopped at `capture_run_not_executed_db_mutating_guard_path`, identify pure analysis/recommendation boundaries versus DB/session mutation boundaries, and compare future no-write capture options.
- Changed files: scripts/inspect-analyze-no-write-boundary.mjs, scripts/verify-analyze-no-write-boundary.mjs, docs/architecture/analyze-no-write-capture-boundary.md, .codex/AI_WORK_LOG.md
- Protected areas: No `/api/analyze` runtime change, evaluator change, CandidatePolicy connection, UI/API response change, DB/Supabase change, product data change, capture fixture edit, actual API request, or Supabase remote write was performed.
- Validation: `node scripts/inspect-analyze-no-write-boundary.mjs`, `node scripts/verify-analyze-no-write-boundary.mjs`, Phase 20 dev target verifier, actual coverage collector/verifier, evaluator boundary shadow/policy/coverage verifiers, functional exposure audit/readiness review/verifiers, recent-instability/guard/shadow/ranking/goal/survey verifiers, `npm run build`, and `git diff --check` passed. `git diff --check` reported CRLF normalization warnings only.
- Notes/risks: Static inspection found analysis guard RPC mutations before recommendation generation and premium report store insert/prune before the current shadow capture call. Recommended next step is a script-only pure engine replay runner before considering a route-level no-write mode.
- Context promotion candidate: Future target capture work should prefer script-only pure engine replay for no-write evidence expansion unless exact route parity is explicitly required and a route-level no-write or isolated dev DB path is approved.

### 2026-06-22 / Hwahae ranking all-jobs and matrix audit

- Branch: main
- Task type: execution
- Routing decision: Medium crawler operation change scoped to explicit all-enabled ranking selection, Korean browser context, and config matrix audit. DB schema/migrations, products table writes, promotion/enrich commands, and unrelated app files were out of scope.
- Goal: Add `npm run crawl -- --all` as an explicit all-enabled job mode, add `npm run jobs:matrix` for 9 category x 9 context audit, and confirm `essence_ampoule_serum` snapshots persist as `service_category=treatment`.
- Changed files: crawler/hwahae.ts, crawler/jobs-matrix.ts, crawler/package.json, .codex/AI_WORK_LOG.md
- Protected areas: No `.env*`, DB schema/migration/policy, auth/payment/deploy config, products INSERT/UPDATE/DELETE, promotion/enrich execution, or API response field-name changes.
- Validation: `npm run test:ranking-ingest` passed; `npm run typecheck` passed; `npm run jobs:matrix` passed with total=81, enabled=5, disabled=76; `npm run crawl -- --all --job-ids=hwahae-skincare-toner-category-all --dry-run` failed closed with the expected conflict error; `npm run crawl -- --all --dry-run --delay-ms=1000` passed for 5 enabled jobs with 160 prepared ranking observations and products writes 0; `npm run crawl -- --all --delay-ms=1000` passed for 5 enabled jobs with 5 snapshots, 160 source_rankings rows, 0 new candidates, 160 reobserved candidates, review refresh inserted 50, products writes 0. Products row count stayed 164 before and after. Latest DB `ranking_snapshots` rows for both essence jobs show `source_category_key=essence_ampoule_serum`, `service_category=treatment`, `source_product_form=null`.
- Issues/risks: Two intermediate `rg` proof commands failed from PowerShell quoting/regex escaping, then products direct write checks were rerun with fixed-string searches and returned no matches. Crawl still depends on live Hwahae availability and the configured Top 50 gateway behavior.
- Context promotion candidate: NULL

### 2026-06-22 / review queue same-day rerun diagnosis and migration draft

- Branch: main
- Task type: diagnostic to limited execution
- Routing decision: High DB/RPC queue-rule change. User approved local implementation and read-only expected-impact analysis, but not DB migration application, queue refresh, or commit.
- Goal: Draft a forward-only repair so repeated same-concern evidence requires distinct KST observed dates >= 2, latest concern rank <= 15 drives top-15 evidence, and same-day rerun-only queued/reviewing rows are retained with priority 0 and explicit ineligible evidence.
- Changed files: supabase/migrations/20260622093000_repair_review_queue_distinct_observed_dates.sql, crawler/test-ranking-review-rules.ts, crawler/reviews-pending.ts, crawler/package.json, .codex/AI_WORK_LOG.md
- Protected areas: Existing migrations were not edited. No DB migration was applied, no queue refresh was executed, no products INSERT/UPDATE/DELETE was added, and no commit was created.
- Validation: `npm run test:ranking-review-rules` passed; `npm run typecheck` passed; `git diff --check` passed. Read-only DB simulation predicted 50 queued/reviewing rows remain status-kept, 15 remain eligible by latest Top 15, 35 become priority 0, 0 qualify by distinct-date same-concern persistence, products count before remains 164.
- Follow-up: After approval, applied the migration to linked Supabase with MCP `apply_migration`, then ran `refresh_candidate_promotion_reviews('ranking-review-v2')`. Result: 50 queued rows retained, 15 remain priority > 0, 35 changed to priority 0 with `currently below queue threshold under ranking-review-v2`, products stayed 164, and RPC returned `products_written=0`.
- Validation follow-up: `npm run reviews:pending` showed Top 1-15 priority retained and rank 16-50 same-day rerun rows marked ineligible with observations/observed_dates/first_date/last_date. `npm run test:ranking-review-rules`, `npm run test:ranking-ingest`, `npm run typecheck`, and `git diff --check` passed.
- Issues/risks: Supabase CLI is not installed on this PC, so the forward-only migration file was created manually instead of with `supabase migration new`.
- Context promotion candidate: Same-day ranking reruns must never count as persistence evidence; persistence requires KST distinct observed dates.

### 2026-06-29 / premium functional decision section

- Branch: feature/premium-functional-decision
- Task type: limited execution
- Routing decision: Medium premium report data/UI addition scoped to the paid Skin Match full report functional decision section. Free result, recommendation ranking, Top Pick, supportingProducts, score formula, currentProducts input/slot building, routineStructure generation, payment, Face Lab, DB schema, and product DB were out of scope.
- Goal: Add paid-report-only `premiumReport.functionalDecisions` so the full report explains which functional skin goals are appropriate now, later, or temporarily paused.
- Changed files: app/api/analyze/route.js, app/result/full-report/page.js, components/full-report/PremiumFunctionalDecisionSection.jsx, lib/premium-functional-decisions.js, lib/skin-match-decision-engine.js, lib/test-result-fixture.js, docs/architecture/premium-functional-decision-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No DB schema/migration, storage API schema, product ranking algorithm, score formula, Top Pick/supportingProducts selection, sunscreen scoring, currentProducts input, free result UI, SurveyFlow, payment, or Face Lab changes.
- Validation: `npm run build` passed; `git diff --check` passed with CRLF warnings only; helper-level cases confirmed barrier without active burden produces now/later but no pause, barrier plus current-product hold can pause texture/exfoliation, and pores with low sensitivity can mark sebum/pore now. 390px `/test-full-report` verified functional section entry, 3 cards with now/later/pause fixture states, no horizontal overflow, next CTA to adjustment/condition guide, no purchase/price text, console/page errors 0. Free `/api/analyze` 200 response did not include `functionalDecisions`, `currentProductVerdicts`, or `premiumReport`.
- Issues/risks: The exact 390px browser verification used local Playwright because the in-app browser viewport override reported a 500px client width. Saved premium report requery was verified by code path through existing `premium_report_sessions.premium_report` storage and `/api/full-report` spread behavior, not with a live authenticated session.
- Follow-up: Tightened `sanitizeFunctionalDecisionsForPremium` so `title` and `summary` must be non-empty strings, `nextAction` only keeps a non-empty string or null, and `reasons` keeps only non-empty string entries. No helper, UI, free response, or storage path change.
- Context promotion candidate: Paid functional goal decisions should remain goal-level, premium-only, and separate from product recommendation or current-product verdict logic.

### 2026-06-29 / premium condition response section

- Branch: feature/premium-condition-response
- Task type: limited execution
- Routing decision: Medium premium report data/UI addition scoped to the paid Skin Match full report condition response section. Free result, SurveyFlow, recommendation ranking, score formula, Top Pick/supportingProducts, sunscreen scoring, currentProducts input/slot building, currentProductVerdicts rules, functionalDecisions rules, payment, Face Lab calculation, DB schema, and product DB were out of scope.
- Goal: Add paid-report-only `premiumReport.conditionResponses` so the full report explains temporary routine adjustments for unstable skin days.
- Changed files: app/api/analyze/route.js, app/result/full-report/page.js, components/full-report/PremiumConditionResponseSection.jsx, lib/premium-condition-responses.js, lib/skin-match-decision-engine.js, lib/test-result-fixture.js, docs/architecture/premium-condition-response-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No DB schema/migration, storage API route, product ranking algorithm, score formula, Top Pick/supportingProducts selection, sunscreen hard filter/score, currentProducts input/slot building, free result UI, SurveyFlow, payment, or Face Lab calculation changes.
- Validation: `npm run build` passed; `git diff --check` passed with CRLF warnings only; helper-level cases confirmed barrier without active burden keeps hydration/barrier maintain and active/texture reduce without avoid_for_now, barrier/redness plus hold/pause allows active_load avoid_for_now without making every card avoid_for_now, pores with low sensitive risk keeps texture maintain, cleansingFrequency 3_plus plus tight makes cleansing_load reduce, environment heat/mask makes environment_recovery reduce, and missing currentProductVerdicts/functionalDecisions does not crash. 390px `/test-full-report` verified condition section entry, 3 fixture cards with maintain/reduce/avoid_for_now, no horizontal overflow, no purchase or banned medical words, Face Lab CTA reaches the Face Lab content, and console/page errors 0. Free `/api/analyze` 200 response did not include `conditionResponses`, `functionalDecisions`, `currentProductVerdicts`, or `premiumReport`.
- Issues/risks: Exact 390px verification used local Playwright because the in-app browser viewport override reported a 500px client width. Saved premium report requery was verified by code path through existing `premium_report_sessions.premium_report` storage and `/api/full-report` spread behavior, not with a live authenticated session.
- Context promotion candidate: Paid condition responses should remain temporary routine-adjustment guidance, premium-only, non-medical, and separate from product verdicts and functional goal decisions.

### 2026-06-29 / is_mens female hard filter

- Branch: fix/is-mens-female-hard-filter
- Task type: limited execution
- Routing decision: Medium survey/recommendation eligibility change scoped to free Skin Match `genderPreference` restoration and pre-scoring product candidate filtering. Premium report, Face Lab, My Skin, DB schema/migration, auth, payment, currentProducts, and score formula changes were out of scope.
- Goal: Restore the free survey product-profile question and exclude `is_mens === true` products from all recommendation candidates only when `genderPreference === "female"`.
- Changed files: app/page.js, app/api/analyze/route.js, components/onboarding/SurveyFlow.js, components/onboarding/constants.js, lib/recommendation-scoring.ts, lib/skin-match-decision-engine.js, docs/architecture/survey-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No product data deletion, DB migration, API response expansion, premium report, Face Lab, My Skin, auth, payment, currentProducts, Top Pick formula, supportingProducts formula, ranking comparator, or score-weight changes.
- Validation: `npm run build` passed; `git diff --check` passed with CRLF warnings only; static path checks confirmed `genderPreference` defaults, payload append, API normalization, normalized recommendation answers, and pre-scoring `is_mens` eligibility filtering. Local `/api/analyze` multipart calls for `female`, `male`, `unspecified`, and missing `genderPreference` all returned 200 and did not expose `genderPreference` or `premiumReport` in the public response. 390px Playwright verified the gender question renders, female selection persists, no horizontal overflow, mocked analysis reaches result route, and console/page errors 0.
- Issues/risks: Korean source text displays garbled in PowerShell, so the restored Korean gender question was added as a small separate preference screen to avoid broad rewrites of existing encoded copy.
- Context promotion candidate: `genderPreference` should remain a pre-scoring eligibility filter only; never reintroduce `is_mens` score bonuses or penalties.

### 2026-06-29 / My daily care simplification

- Branch: feature/my-daily-care-simplification
- Task type: limited execution
- Routing decision: Medium My Skin UI/data display change scoped to daily check-in, memo visibility, and routine-log presentation. Premium report, full-report components, Face Lab, free result, SurveyFlow, recommendation scoring, current product verdicts, functional decisions, condition responses, DB schema, auth, and payment were out of scope.
- Goal: Make My Skin a daily execution surface by compressing today routine guidance and surfacing saved check-in memo as a user record.
- Changed files: components/my/MyDashboard.jsx, components/my/TodayRoutineCard.jsx, lib/my/dashboard.js, lib/my/i18n.js, docs/architecture/my-daily-care-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No premium report/full-report file edits, no Face Lab edits, no free result edits, no recommendation or decision-engine edits, no DB migration/RLS/auth/payment changes.
- Validation: `npm run build` passed; `git diff --check` passed with CRLF warnings only. Helper-level low/high check-in comparison showed existing high-intensity routine arrays can expand to keep=14, reduce=6, avoid=7 while the compressed display is limited to two adjustments plus one caution. Logged-in browser session saved a check-in memo through `/my/check-in`, returned to `/my`, and displayed the memo with date in the dashboard. My page showed today's care, today's adjustments, no current-product verdict or functional-decision labels, horizontal overflow false in the authenticated browser session, and console error logs 0 during the save check.
- Issues/risks: Authenticated in-app browser viewport override reported 500px+ client width, so exact 390px My dashboard verification was not completed. Slider high-intensity browser input could not be set through the in-app browser automation; high-intensity compression was verified helper-level instead.
- Follow-up: Extended the My home toward the diary architecture reference. AM/PM routine details are no longer repeated on the home; the card keeps only compressed care actions plus a check-in/routine logging link. Dashboard payload now includes latest 7 user-scoped daily check-ins, and the home renders a single-metric SVG trend preview plus the latest 2-3 diary rows with date, state label, makeup/outdoor tags, and memo preview. The contract doc now states that My is a record/trend/diary home, not a free-result routine replay or premium reasoning surface.
- Follow-up: Removed the standalone recent memo card because the same note is already visible in the diary preview. Memo remains stored in `daily_checkins.memo` and shown only in dated diary rows.
- Follow-up: Tightened three My home UI details. The today care footer now uses a user-facing basic-routine reminder with no fake CTA because the My payload has no safe saved-result route. Diary rows now show up to two highest non-zero check-in values using irritation/redness/breakout/dryness/oiliness tie priority. The analysis baseline card now omits long skin/photo summaries and keeps only skin type, sensitivity, concerns, and a real saved/profile date.
- Context promotion candidate: My Skin should remain daily check-in and execution guidance only; premium reasoning and product/functionality verdicts should stay in the paid full report.

### 2026-06-30 / My check-in event tags

- Branch: feature/my-checkin-event-tags
- Task type: limited execution
- Routing decision: Medium My Skin check-in/data-display extension scoped to `daily_checkins.context.checkinEvents`, check-in form toggles, and diary preview tags. Premium report, full-report components, Face Lab, free result, SurveyFlow, recommendation scoring, DB schema/migration/RLS, auth, and payment were out of scope.
- Goal: Let users record lightweight daily events alongside skin sliders and memo, then show those events in My diary rows without causal interpretation.
- Changed files: app/my/check-in/page.js, app/api/my/check-in/route.js, components/my/DailyCheckInForm.jsx, components/my/MyDashboard.jsx, lib/my/checkin-events.js, lib/my/i18n.js, docs/architecture/my-daily-care-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No premium/full-report, Face Lab, free result, SurveyFlow, recommendation engine, DB migration/RLS, auth, payment, or product DB changes.
- Validation: `npm run build` passed; `git diff --check` passed with CRLF warnings only. Helper-level checks confirmed null/empty/unexpected context normalizes missing or invalid event keys to false, and context merge preserves unrelated object keys while replacing only `checkinEvents` plus source. Authenticated browser verified the check-in form renders six new event toggles with no sensitive health tags, multiple-event save shows three diary tags plus `+1`, zero-event save removes event chips without rendering an empty memo label, one-event save shows only `새 제품 사용`, re-entry restores that single event, and console/page errors 0. Browser viewport checks reported no horizontal overflow, though the in-app viewport override reported 520px when set to 390px.
- Follow-up: Unified makeup/outdoor with the six context events into one compact two-column check-in event chip grid. This was UI-only: `makeup_today`, `outdoor_today`, and `context.checkinEvents` storage contracts were not changed.
- Follow-up fix: Stabilized the My trend default metric so it is selected from the latest 7-day aggregate instead of the latest single check-in, with a fixed redness fallback when all recent values are zero. Also hardened `context.checkinEvents` normalization for object/null/stringified JSON inputs so dashboard diary tags and check-in form restore share the same parsing contract.
- Browser-comment follow-up: Removed the My home latest-report card and routine footer reminder, moved the latest report action to a top header button when a public `/r/{shareId}` result exists, changed trend preview to metric tabs with the latest 7-day aggregate metric selected by default, converted diary preview to a compact calendar with memo markers/tooltips, and localized profile baseline values through My i18n maps.
- Follow-up: Changed saved free reports to create a private `analysis_results.share_id` at save time and link `saved_reports.source_type/source_session_id` to that share id. `/r/{shareId}` now allows owner access when private and external access only after `is_public=true`; result share/copy actions publish the existing share id instead of creating a duplicate row when one is already cached for the current result.
- Follow-up fix: Unified `/r/{shareId}` and `/api/results/{shareId}` access through a shared analysis-result owner/public helper. `/api/results` publish now resolves the owner from bearer or server cookies for existing `shareId` rows, and ResultShareActions can publish an existing share id without requiring the old analysis write session. E2E verified private owner page/API 200, anonymous private page/API 404, publish keeps the same share id and flips the single row to public, and anonymous public page/API 200.
- Issues/risks: Exact authenticated 390px measurement is limited by the in-app browser viewport override reporting 520px inner width. Check-in page initial restore uses the latest user check-in and applies it only when it matches the browser-local date after mount.
- Context promotion candidate: My check-in events are observation tags only and must not become causal claims or premium-style product/functionality judgments in My.

### 2026-07-04 / functional exposure readiness review

- Branch: codex/survey-input-contract-refactor
- Task type: limited execution
- Routing decision: Medium shadow-analysis/reporting addition scoped to Phase 13 exposure readiness review. Runtime, UI, API response fields, DB/Supabase, product data, evaluator hard filters, ranking scores, and existing CandidatePolicy behavior were out of scope.
- Goal: Add a pure readiness helper, runner, verifier, and review note for judging whether Phase 12 `collapsed_candidate` shadow grouping is ready for a future shadow CandidatePolicy integration.
- Changed files: lib/functional-exposure-readiness-review.js, scripts/review-functional-exposure-readiness.mjs, scripts/verify-functional-exposure-readiness-review.mjs, scripts/run-functional-candidate-exposure-audit.mjs, scripts/replay-functional-shadow-captures.mjs, docs/reviews/functional-exposure-readiness-20260703.md, .codex/AI_WORK_LOG.md
- Protected areas: app/api/analyze/route.js, functional-ranking-contract runtime logic, functional-candidate-policy runtime behavior, UI files, API response contracts, DB/Supabase, capture fixture originals, product data, and existing topPick/supporting/budget outputs were not modified.
- Validation: `node scripts/verify-functional-exposure-readiness-review.mjs` passed; `node scripts/review-functional-exposure-readiness.mjs` passed and produced `insufficient_evidence` because the default `tmp/functional-shadow-captures` has 0 high-confidence complete captures; `node scripts/replay-functional-shadow-captures.mjs` and `node scripts/run-functional-candidate-exposure-audit.mjs` passed with 0 captures; guard/recent-instability/candidate/ranking/goal/survey helper verifiers passed; `npm run build` passed; `git diff --check` passed with CRLF warnings only.
- Validation limits: `verify-functional-candidate-exposure-audit.mjs` failed only at its default fixture-count assertion expecting `completeCaptureCount: 10`; current workspace has no default Phase 12 capture fixtures. `verify-recent-instability-guard-matrix.mjs` failed because no complete product-row shadow captures are available. `verify-functional-safety-case-review.mjs` failed because `safety-review-packet.json` is absent. `verify-top-pick-strict-semantics.mjs`, `verify-recommendation-strict-semantics.mjs`, and `verify-current-product-active-semantics.mjs` failed on pre-existing `@/lib` alias resolution in direct Node execution.
- Review result: high-confidence review scope is 0 captures, safe_low_risk hidden count is 0, collapsed count is 0, and integration readiness is `insufficient_evidence`.
- Notes/risks: The readiness logic supports hidden/collapsed/reason analysis when Phase 12 audit output contains sanitized `candidateReviews`, but the current checkout cannot answer the requested "50 safe_low_risk hidden" question without the missing capture artifacts.
- Context promotion candidate: Functional exposure readiness must stay shadow-only; even a ready status should lead to shadow CandidatePolicy integration, not runtime/UI/API wiring.

### 2026-07-09 / Phase 22 pure engine target scenario replay

- Branch: codex/survey-input-contract-refactor
- Task type: limited execution / shadow audit artifact
- Routing decision: Medium audit-only runner addition scoped to route-outside pure engine replay. `/api/analyze`, evaluator hard filters, ranking score/weight, CandidatePolicy runtime, UI/API response, DB/Supabase, product data, existing capture fixture originals, and existing topPick/supporting/budget outputs were out of scope.
- Goal: Attempt Phase 19 target scenarios through a no-write pure engine path and keep the evidence separate from actual `/api/analyze` complete/product_row captures.
- Changed files: scripts/node-next-alias-loader.mjs, scripts/run-pure-engine-target-scenario-replay.mjs, scripts/verify-pure-engine-target-scenario-replay.mjs, docs/reviews/evaluator-boundary-pure-engine-target-replay-20260703.md, .codex/AI_WORK_LOG.md
- Protected areas: No route, evaluator, CandidatePolicy runtime, UI/API response, DB/Supabase, product source data, or capture fixture original changes. The runner did not call `/api/analyze` and reports `supabaseWriteExecuted: false`.
- Result: The pure engine runner attempted all 4 target scenarios, but succeeded 0 and failed 4 with `candidate_source_empty_after_pure_engine_replay`. The live product source path returned `Recommendation products are temporarily unavailable`; fallback complete-capture product rows were sanitized and not sufficient for the legacy decision engine field filter, so total replay candidate rows remained 0.
- Evidence separation: Output is `evidenceType: pure_engine_replay`, `routeInvoked: false`, `runtimeMutation: false`, and must not be counted as actual complete/product_row capture evidence.
- Validation: `node scripts/run-pure-engine-target-scenario-replay.mjs`, `node scripts/verify-pure-engine-target-scenario-replay.mjs`, analyze boundary, target plan, actual coverage, boundary shadow/policy, exposure audit/readiness, recent-instability, shadow comparison/audit, ranking, goal, and survey verifiers passed; `npm run build` passed; `git diff --check` passed.
- Issues/risks: Node direct ESM execution emitted non-fatal `--experimental-loader` and `MODULE_TYPELESS_PACKAGE_JSON` warnings. The replay did not expand active-only, metadata-incomplete, serum, or strong-caution evidence because no candidate rows were produced.
- Context promotion candidate: Pure engine replay evidence should stay separate from actual `/api/analyze` captures unless a read-only product source with full scorer-compatible rows is provided.

### 2026-07-05 / SEC-02 analysis data RLS grant verification

- Branch: codex/survey-input-contract-refactor
- Task type: diagnostic / limited documentation and verification
- Goal: Verify Supabase RLS, grants, policies, functions, and Storage metadata for analysis data assets without production/local DB writes or policy changes.
- Code 변경 여부: No runtime feature code changed. Added SEC-02 verification documentation and a static verification script only.
- Remote metadata 검증 가능 여부: Possible. Checked connected Supabase metadata only; no user/report/image rows or secrets were read.
- Results: confirmed 0, likely 0, deployment verification 3.
- Migration 작성 여부: Not written. Connected metadata showed `analysis_requests`, `analysis_results`, and `premium_report_sessions` RLS enabled with service-role-only grants, My data owner policies present, and no current Storage bucket target.
- Validation: `node scripts/verify-analysis-rls-contract.mjs` passed; related route/helper JS `node --check` passed; `git diff --check` passed with CRLF conversion warning only; `npm run build` passed.
- Follow-up: Verify SEC-01 guard migration deployment state and service-role-only RPC grants before production rollout.

### 2026-07-10 / Phase 43 isolated shadow route controlled-run harness

- Branch: codex/survey-input-contract-refactor
- Task type: limited execution environment setup / shadow invariance diagnosis
- Routing decision: High-risk fail-closed harness work. Production runtime, evaluator, CandidatePolicy, response, UI, schema/migration, and product data changes were prohibited.
- Goal: Reproduce a disposable local route environment, isolate the external provider, observe baseline versus flag-on mutation deltas, and run the controlled comparison only if every safety gate passed.
- Changed files: scripts/lib/shadow-route-mutation-observer.mjs, scripts/lib/shadow-route-provider-isolation.mjs, scripts/setup-isolated-shadow-route-environment.mjs, scripts/teardown-isolated-shadow-route-environment.mjs, scripts/run-isolated-shadow-route-comparison.mjs, scripts/verify-isolated-shadow-route-comparison.mjs, docs/runbooks/isolated-shadow-route-execution-20260710.md, docs/reviews/isolated-shadow-route-controlled-run-20260710.md, .codex/AI_WORK_LOG.md
- Environment result: Supabase CLI and Docker were available, but local config/seed were absent and the 23 migrations alter `public.products` without creating it. A fresh local schema was therefore not reproducible.
- Provider result: No production provider call was made. Development key resolution can fall back to `.env.local`, and no approved test adapter exists, so process env clearing cannot guarantee provider-call count zero.
- Mutation observer: Enumerated analysis guard RPCs, premium session delete/insert, Storage, and local filesystem surfaces. Observer coverage remained incomplete and no mutation delta was measured.
- Execution result: Current `hosted_unknown` target was not used. No local stack or database command was started, no `/api/analyze` request was sent, no Supabase write occurred, and measured comparison fields remain null. Final status: `blocked_local_schema_not_reproducible`.
- Corrections: An initial migration search used a Windows-incompatible wildcard, the first setup call passed a directory where the target assertion expected an env-file path, and Node process lookup initially missed the PowerShell-installed Supabase CLI. The search path, assertion call, and cross-platform command lookup were corrected before final validation; none of these attempts invoked the route, provider, or database.
- Cleanup: No isolated resources were created. The no-resource teardown completed successfully; full DB/Storage cleanup verification remains pending a reproducible local environment.
- Runtime scope: Evaluator and CandidatePolicy remain disconnected. API response, recommendation output, UI, DB schema/migrations, product data, route runtime, and shadow runtime helpers were not modified.
- Next condition: Obtain approval for a reproducible local base schema/config and a default-off test-only external-provider isolation seam, then install the ephemeral mutation observer before any route request.
- Context promotion candidate: Controlled route evidence must remain fail-closed when a fresh local schema, provider isolation, complete mutation observation, or cleanup proof is missing; unmeasured deltas must remain null rather than zero.

### 2026-07-11 / Phase X AI Context Architecture and documentation hierarchy audit

- Branch: codex/survey-input-contract-refactor
- Task type: read-only repository diagnosis + documentation plan
- Routing decision: Apply the user-confirmed AI Context Architecture to the existing `.codex/`, `docs/`, runbook, review, and verifier structure without changing features, protected runtime surfaces, or current operating files.
- Existing `.codex` investigated: Yes; router, context, review checklist, revisit guidance, work log, sync rules, hooks/config role, and artifact/log mixing were reviewed.
- L0-L5 hierarchy plan: Yes.
- Domain lazy creation design: Yes; no individual domain document was created.
- Domain user approval requirement: Yes; eligibility permits a proposal only and first creation requires explicit approval.
- Loose document coupling: Yes; domains are optional, references are non-blocking, and no fixed domain enum is proposed.
- Entry-point principle: `.codex` is the AI operating-context home, not a source of truth; actual code, schema, config, and verifier output take precedence.
- Conditional loading: SECURITY_BOUNDARIES and VERIFY_RULES are routed by task delta and relevant section; full reads are reserved for cross-cutting or high-risk ambiguity.
- Broken-reference fallback: Yes; bounded path/sibling check, then code/schema/config/verifier evidence and a separate Reference Maintenance Issue.
- Model handoff reduction: Yes; handoff contains L0 entry, delta, decisions, scope, security routing, verifier set, and open uncertainty only.
- Read-only command output controls: Yes; depth-first, scoped, count/heading/path summaries, capped output, and stop-on-parser-error rules are included.
- `.codex` role separation: Yes; L0-L2 operating context, L4 work/resource audit logs, and tool configuration are distinguished inside `.codex`.
- Baseline measured: Yes; `docs/` 90 files/18,375 lines, core `.codex` Markdown 6 files/2,660 lines, 63 verifier files/12,147 lines.
- Changed files: docs/architecture/ai-context-architecture-and-document-hierarchy-plan.md, .codex/AI_WORK_LOG.md
- Actual move/delete/archive: None.
- Actual `.codex` restructure implementation: Not performed.
- Feature/runtime code changes: None.
- Next phase: bounded implementation of the approved `.codex` operating-document restructure.

### 2026-07-11 / Phase X+1 minimal Codex context entry implementation

- Model / reasoning: Terra / high.
- Task type: bounded documentation implementation.
- L0 entry: Added `.codex/README.md`; `AGENTS.md` now directs startup to the README and canonical `AI_ROUTER.md`.
- Canonical router: Reused and updated `.codex/AI_ROUTER.md`; no `CONTEXT_ROUTER.md` was created.
- Conditional routing: The router classifies the delta, applies `Y` for direct, indirect, or ambiguous DB/Auth/RLS/Storage/Provider/Payment/Secret/Production impact, and loads only relevant protection and verification evidence.
- Existing-rule reuse: `AI_CONTEXT.md`, `AI_REVIEW_CHECKLIST.md`, `PROJECT_SYNC_RULES.md`, `AI_WORK_LOG.md`, and hooks/config remain conditional or detailed references; their content was not copied into L0.
- Domain handling: No `.codex/domains/` directory or domain document was created.
- Previous-record correction: The Phase X design document now records the user-reported actual execution profile as Sol with high reasoning.
- Scope boundary: No existing file moved/deleted, no feature code changed, and no route, runtime, Supabase, Docker, provider, DB, or production operation was run.
- Resource usage: `AI_RESOURCE_USAGE_LOG.md` remains absent and was not created; no unobserved usage was estimated.
- Validation: static path, heading, fence, duplicate-heading, whitespace, scope-boundary, and `git diff --check` results are recorded in the completion report.
- Next candidate: after user approval, consolidate only the needed L1 execution/verification/security rule surfaces without creating domain documents.

### 2026-07-11 / Phase X+2 minimal Codex L1 rules and resource usage log

- Model / reasoning: Terra / high.
- Canonical L1: added `AI_EXECUTION_RULES.md` and `SECURITY_BOUNDARIES.md`; reused and minimally extended `AI_REVIEW_CHECKLIST.md` as canonical verification rules.
- Router/README: linked all three L1 surfaces conditionally; work/resource logs remain audit-only, not default reads.
- Existing-rule reuse: `AGENTS.md`, `PROJECT_SYNC_RULES.md`, `AI_CONTEXT.md`, hooks/config, and detailed verifier/scripts remain referenced rather than copied.
- Resource log: added append-only `AI_RESOURCE_USAGE_LOG.md` and backfilled user-observed Phase X/X+1 values; Phase X+2 usage is `not_observable`.
- Scope boundary: no domain document/directory, file move/delete, feature code, package, runtime, Supabase, Docker, provider, DB, or hosted operation.
- Validation: canonical paths, links, structure, entry counts, audit exclusion, scope boundary, sensitive-value patterns, and `git diff --check` are recorded in the completion report.
- Work-log structure: added the missing `Entries` level so the existing audit headings are structurally valid.
- Next candidate: only after approval, reconcile remaining detailed L1 source documents without expanding into domain or archive work.

### 2026-07-11 / Phase X+3 legacy Codex context reconciliation and resource log friction reduction

- Model / reasoning: Terra / high.
- Legacy roles: `AI_CONTEXT.md` is a conditional reference; `PROJECT_SYNC_RULES.md` is a detailed supporting rule; `AI_REVISIT.md` is a tool/workflow-specific reference.
- Default reads: all three legacy documents are excluded from mandatory startup reads and do not replace canonical L1 or actual source evidence.
- L0/L1 links: README and router now route each legacy file only for its applicable continuity/recovery context.
- Resource policy: resource log entries are optional observed evidence, not a per-task completion condition or `not_observable` placeholder requirement.
- Phase X+2 correction: kept the append-only Phase entry and added a concise correction recording 8% from `user_observed`.
- Scope boundary: no domain document/directory, file move/delete, feature code, package, runtime, Supabase, Docker, provider, DB, or hosted operation.
- Validation: role metadata, canonical links, resource policy/backfill, structure, scope boundary, sensitive-value patterns, and `git diff --check` are recorded in the completion report.
- Next candidate: review legacy product/workflow assertions against current source only when a bounded related task requires it.

### 2026-07-11 / Phase 44 local shadow runtime reproducibility and provider isolation

- Model / reasoning: Terra / high.
- Local bootstrap: added test-only `supabase/local-shadow-test/` config, synthetic seed, route dependency tables/RPCs, and ephemeral normalized audit triggers; production migrations were not changed.
- Provider isolation: added a default-off development loopback/disposable stub seam before the OpenAI env resolver so `.env.local` fallback and external fetch are bypassed when enabled.
- Harness: setup/teardown and comparison verifiers now recognize a prepared local preflight without invoking `/api/analyze`.
- Verification result: static target, syntax, provider seam, bootstrap markers, and fail-closed setup passed; Docker CLI/daemon is unavailable, so no local stack, DB command, observer installation, seed replay, cleanup replay, route request, provider call, or hosted target access occurred.
- Final blocker: `blocked_local_bootstrap_contract_gap` due unavailable Docker runtime; fresh local reproducibility remains unverified.

### 2026-07-13 / Local shadow setup diagnostics hardening

- Replaced full Supabase CLI stdout equality with parsed seed count and digest summaries; count verification and deterministic digest verification are independent predicates.
- Added stage-specific setup reason codes, per-command exit/timeout/sanitized-stderr evidence, and structured observer summary parsing.
- Hardened provider seam checks against line-ending and indentation changes while preserving local-only and hosted/production fail-closed gates.
- Teardown can resolve the safe run directory from setup evidence when no explicit directory is supplied.
- Validation was static only: no Supabase, Docker, setup, teardown, RPC, route, verifier, or build command was executed.

### 2026-07-13 / Phase 45 controlled local route comparison implementation

- Replaced the preparation-only comparison placeholder with a fail-closed runner for one flag-off and one flag-on route invocation against the disposable loopback stack.
- Both conditions require the existing local provider stub; the shadow flag is the only intended runtime difference. Evidence retains response shape and recommendation identifiers only, plus normalized DB/Storage/audit counts.
- The runner resets between conditions, uses setup evidence for teardown, validates flag-on local artifacts, and fails closed when the public response cannot expose supporting/budget recommendation groups.
- No runtime command was executed while implementing the runner. Hosted targets, external providers, evaluator runtime, CandidatePolicy runtime, route response shape, migrations, and product data remain outside scope.

### 2026-07-13 / Phase 45 local recommendation evidence surface

- Added a dev-only local recommendation snapshot for both comparison conditions under the verified setup run directory. It stores only product IDs and array order for top-pick, supporting, and budget groups.
- Capture requires the existing local provider stub, local/disposable marker, loopback target, UUID comparison ID, and an allowlisted flag condition. Writes are exclusive and non-blocking to the route.

### 2026-07-13 / Phase 46.1 disabled-by-default policy shadow execution

- Added an engine-owned evaluator -> boundary collapsed hint -> CandidatePolicy receiver shadow path for the existing scored candidates. The route only applies the development/local gates and writes sanitized local evidence after normal response construction.
- Policy shadow execution requires both `DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN=1` and `DEV_ONLY_BOUNDARY_POLICY_SHADOW=1`, plus the existing local provider-stub, disposable-marker, and loopback protections. Disabled paths neither evaluate nor dynamically load the policy shadow helper.
- The local policy artifact records candidate IDs, decision codes, safe aggregate counts, and independent safety violations only. It never changes CandidatePolicy exposure, recommendations, response payloads, DB/Storage, evaluator runtime, or CandidatePolicy runtime.
- This phase was statically reviewed only. No Supabase, Docker, setup, route, comparison runner, verifier, build, or hosted command was executed.
- The controlled comparison runner uses those snapshots instead of treating absent public response groups as empty arrays; the verifier checks the sanitized schema, file counts, run identity, expected path, and residual-file observation captured before teardown.
- No Supabase, Docker, setup, teardown, route, verifier, build, hosted, or provider command was executed for this implementation.

### 2026-07-14 / Phase 46.2 default-off CandidatePolicy runtime exposure integration

- Added an engine-owned, default-off evaluator-to-collapsed-hint-to-receiver runtime path before top-pick, supporting-product, and budget-alternative selection.
- `ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME=1` is required; `DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME=1` is the independent immediate kill switch. The disabled path does not dynamically import or execute policy modules.
- Runtime diagnostics remain separate from Phase 46.1 shadow diagnostics. They record candidate IDs, receiver decisions, exposure groups, aggregate counts, and rejection reason codes only.
- Receiver-approved non-unchanged outcomes are removed from the visible candidate pool. Unknown receiver output and invariant violations fail closed; no response schema, DB, Storage, migration, route decision logic, evaluator scoring, or CandidatePolicy scoring was changed.
- This phase is static only. No Supabase, Docker, setup, teardown, route, comparison runner, verifier, build, hosted, or provider command was executed.

### 2026-07-14 / Phase 46.2 actual CandidatePolicy runtime evidence

- Added isolated local comparison artifacts under `route-comparison/<comparisonRunId>/runtime/` for both flag states. They contain candidate IDs, receiver decision codes, exclusion reasons, aggregate safety counts, and recommendation ID/order snapshots only.
- Shadow policy artifacts remain under `policy/`; actual runtime artifacts use a distinct evidence type, schema, directory, and durable-copy path.
- The comparison runner enables the runtime flag only for flag-on, distinguishes policy-driven recommendation deltas from unexpected deltas, and the verifier independently validates durable raw runtime evidence and receiver-to-exposure mappings.
- This phase is static only. No Supabase, Docker, setup, teardown, route, comparison runner, verifier, build, hosted, or provider command was executed.

### 2026-07-14 / Phase 46.3a production rollout observability contract

- Added a default-off production canary control contract with `DISABLE` precedence and an explicit deployment-canary scope requirement for production enablement.
- Added non-blocking aggregate runtime telemetry for enabled/executed/connected state, candidate counts, unexpected receiver/exposure count, five safety counts, runtime error/latency aggregates, and kill-switch suppression evidence. Product and user details, request/response bodies, URLs, and credentials are rejected by an allowlisted schema.
- Added a synthetic baseline/canary stop contract covering safety violations, unexpected receiver/recommendation/DB/Storage deltas, response-schema changes, forbidden fields, SLO regression, and execution after disablement.
- Updated current state to the observed Phase 46.2 local PASS. No production flag, hosted environment, route, runner, verifier, build, Supabase, Docker, DB, Storage, or provider command was executed.

### 2026-07-14 / Phase 46.3b synthetic canary and kill-switch propagation contract

- Added an aggregate-input synthetic baseline/canary probe runner contract. It compares response-schema and recommendation signatures, DB/Storage mutation counts, error rates, P95 latency, runtime telemetry, and the shared synthetic fixture identity without storing response or recommendation details.
- Added bounded kill-switch propagation evidence and a verifier contract requiring a post-disable request with enabled/executed/connected all false before the timeout. Canary stop reasons produce an explicit rollback verdict.
- The contract is not connected to deployment tooling, hosted environment changes, production traffic, route execution, Supabase, Docker, DB, Storage, or provider calls. No runner, verifier, build, or hosted command was executed.

### 2026-07-14 / Phase 46.3c production deployment dry-run contract

- Added a sanitized Vercel/GitHub deployment-plan generator and short canary runbook. The plan covers default-off baseline, Preview validation, separately approved `main` production deployment, DISABLE-first rollback, and prior known-good deployment fallback.
- The plan reuses the synthetic probe, kill-switch propagation verifier, and production-observability verifier. It makes no API calls and cannot deploy, edit environment variables, change traffic, or activate production runtime.
- Weighted traffic splitting and the concrete deployment-level canary isolation mechanism remain unconfirmed; the plan treats them as a stop condition rather than assuming a rollout percentage or adapter behavior.

### 2026-07-14 / CandidatePolicy Preview kill-switch probe

- Added a Preview-only internal GET probe for the `codex/local-shadow-runtime-validation` branch. It requires an explicit probe flag and otherwise returns 404 without emitting telemetry.
- The probe reuses the aggregate CandidatePolicy runtime observability contract to report enable/disable/scope state and emits the same sanitized telemetry to `[candidate-policy-runtime]` without executing evaluator, CandidatePolicy, provider, Supabase, DB, or Storage code.
- Production and `main` Preview deployments remain fail-closed. The public `/api/analyze` route, recommendation output, deployment settings, and environment values were not changed.
- Focused probe and production-observability contract checks passed. `npm run build` was attempted once but produced no output before the 124-second command timeout, so build completion remains unverified and was not retried.

### 2026-07-14 / CandidatePolicy Preview runtime execution probe

- Added a Preview-only internal GET probe that dynamically executes the actual evaluator boundary policy runtime against the existing synthetic contract candidate shape and emits aggregate telemetry only.
- The probe requires the validation branch, explicit probe and runtime flags, deployment-canary scope and marker, and no active DISABLE switch. Every other environment returns 404 before runtime import or telemetry emission.
- No `/api/analyze`, provider, Supabase, DB, Storage, public response, deployment setting, or production runtime path was changed or invoked.
- Focused probe and production-observability contract tests, JavaScript syntax checks, and `npm run build` passed.

### 2026-07-14 / Production environment Preview readiness probe

- Added a Preview-only internal readiness probe for the validation branch. It reports only boolean contract checks and stop-reason field names for the analysis guard secret, anonymous grant secret, and explicit `beta_open` premium mode.
- Secret checks require canonical base64url values representing at least 32 bytes, distinct guard/grant values, and no reuse of the legacy write token, Supabase service-role, or OpenAI secrets. Secret values, lengths, hashes, prefixes, and suffixes are never returned or logged.
- Production, `main`, other branches, and missing probe flags return 404 without logging. The probe does not call providers, Supabase, DB, Storage, RPC, or public API routes and does not change deployment environment variables.
- Initial focused verification falsely treated the required `SUPABASE_SERVICE_ROLE_KEY` comparison name as a Supabase call. The verifier was narrowed to actual import/client/call patterns before rerunning; the readiness contract itself was unchanged.

### 2026-07-14 / Shadow route static verifier maintenance

- Corrected stale route static checks that assumed one global artifact-writer import and an obsolete premium-session assignment shape. Current imports must now occur exactly within the three recognized development/local guarded helpers, and insertion boundaries are validated in their current response, guard-completion, recommendation-evidence, and return order.
- Expanded verifier integrity controls to reject an import placed before its guard and a dry-run call moved before response construction. Existing controls were updated to current call shapes and made line-ending independent where needed.
- Runtime code, route behavior, flags, probes, response contracts, and environment-variable contracts were unchanged. Required contract, CandidatePolicy receiver, observability, Preview probe, and kill-switch focused checks passed.
- During verification, two negative-control mutation targets were found stale or CRLF-sensitive. Only the synthetic mutation builders were corrected; baseline safety checks were not relaxed.

### 2026-07-14 / Run-scoped synthetic canary evidence

- Preserved the legacy synthetic canary evidence and exclusive-create collision behavior while requiring a safe explicit run ID for every fresh probe and propagation verification.
- Fresh evidence now writes under `tmp/evaluator-boundary-policy-synthetic-canary-runs/<runId>/` with `wx`; traversal, absolute paths, whitespace, control characters, and non-allowlisted run IDs are rejected.
- A sandbox negative-control confirmed that reusing the same run ID still fails with `EEXIST`. The fresh run completed once with the existing aggregate fixture, passed propagation and related policy verifiers, and did not reference or overwrite the legacy evidence.
