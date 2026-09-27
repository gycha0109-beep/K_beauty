# CI Consolidation Audits

This directory contains evidence for reducing duplicate CI execution without deleting unique verification coverage.

## Phase A boundary

Phase A is audit-only. It does not delete, rename, merge, or rewrite workflow files.

The audit engine is `scripts/audit-ci-workflow-overlap.mjs`. It reconstructs workflow coverage from the current working tree, expands root npm verifier drivers such as `verify:current`, compares exact coverage units, and emits overlap evidence.

Run:

```bash
node scripts/audit-ci-workflow-overlap.mjs --check
node scripts/audit-ci-workflow-overlap.mjs --json
```

`--check` is fail-closed for workflow/registry inventory drift and for the three protected Mobile required-check compatibility shims. It never auto-classifies a workflow as `RETIRE`.

The checked-in baseline records the audit authority SHA, hard safety rules, priority clusters, and a recent 500-run Actions timing sample. The workflow inventory is frozen separately so a later audit can distinguish repository growth from Phase A evidence.

## Decision vocabulary

- `CANONICAL`: canonical owner already proven.
- `COMPAT_SHIM`: required-check compatibility name; heavy execution is retired but the check remains.
- `PROJECT_WIDE_AUDIT`: project-wide health workflow that may overlap dedicated owners but is not an automatic consolidation target.
- `MANUAL_ONLY_REVIEW`: dispatch-only release/artifact authority that may be inappropriate for routine PR execution.
- `REVIEW`: evidence exists but no consolidation decision is authorized.

`RETIRE` is intentionally not emitted in Phase A.


## Phase B inventory policy

Phase B may change workflow inventory only through `phase-b-policy.json`. The Phase A baseline remains frozen at its original 63-workflow authority snapshot.

The first approved cluster is `taxonomy-ai-data-ai3-5`:

- `data-ai-product-query-static.yml` owns automatic DATA-AI1-5 static verification, architecture guard, dependency installation, and production build.
- `data-ai3-product-query-shadow.yml`, `data-ai4-provider-shadow.yml`, and `data-ai5-activation-readiness.yml` preserve their existing workflow/job names and push-only deployed runtime probes.
- Automatic PR/push checks gate on the same-head canonical static workflow through `scripts/await-ci-workflow.mjs`.
- Manual `workflow_dispatch` retains the prior standalone static verification path so operator-triggered checks do not depend on a separately dispatched canonical run.
- A missing, failed, cancelled, or timed-out canonical same-head run fails closed.

## Phase B-2 DATA-AI25 / PRELAUNCH-01 responsibility split

The `taxonomy-ai-prelaunch` cluster keeps both existing workflow and job identities while removing one direct duplicate verifier execution.

- `data-ai25-operational-readiness.yml` is the sole dedicated workflow owner of the full DATA-AI25 operational-readiness verifier.
- `data-ai-prelaunch-01-product-query-e2e.yml` owns the pre-launch acceptance verifier and hosted-runner syntax checks.
- PRELAUNCH-01 no longer directly executes or path-triggers on `scripts/verify-data-ai25-product-query-operational-readiness.mjs`.
- The PRELAUNCH acceptance verifier still freezes the post-launch evidence boundary through its own contract assertions.
- No workflow is added or retired for this cluster.

## Phase B-3 Current Main canonical delegation

`current-main-health.yml` remains the project-wide final gate, but proven canonical verifier execution is no longer repeated blindly.

- DATA-AI1-5 delegate to `data-ai-product-query-static.yml`.
- DATA-AI25 delegates to `data-ai25-operational-readiness.yml`.
- PRELAUNCH-01 delegates to `data-ai-prelaunch-01-product-query-e2e.yml`.
- Delegation requires the same candidate SHA, the same GitHub event, and a successful canonical conclusion.
- A discovered canonical failure, cancellation, skip, timeout, or other non-success fails Current Main closed.
- If no matching canonical run exists because its path filter did not trigger, or Actions lookup is unavailable, Current Main executes the original verifier locally.
- Local `npm run verify:current` therefore retains full fallback coverage without requiring GitHub API access.
- The overlap audit reports both static coverage overlap and execution duplicate units after accounting for delegated Current Main contracts.
- Workflow inventory remains 64 and the Current Main workflow/job names and triggers are unchanged.

## Phase B-4 Mobile 13 / 14 / 15 responsibility split

The `mobile-release-13-15` cluster separates routine source validation from release-time artifact and signing authority.

- `mobile-13-store-release-preflight.yml` remains manual-only and owns unsigned Android/iOS release evidence.
- `mobile-14-auth-app-links.yml` remains the routine PR/push owner for generated native App Links, Universal Links, and Apple Auth contracts, including inherited MOBILE-13 generated-native checks.
- `mobile-15-distribution-authority.yml` keeps routine source validation for MOBILE-15 but no longer re-executes the MOBILE-14 source verifier.
- MOBILE-15 PR/push no longer trigger solely for the Expo JSI compatibility helper or MOBILE-13/MOBILE-14 verifier changes, because those automatic paths have dedicated owners.
- MOBILE-15 manual signed Android/iOS jobs still prebuild and re-run MOBILE-13/14 platform checks before signing. These checks validate the exact generated native state entering the signing boundary and are not classified as routine duplicate execution.
- Android keystore, Apple certificate/profile, signed AAB/IPA, signature verification, artifact upload, and ephemeral signing-material cleanup remain exclusively under MOBILE-15.
- No workflow is added, retired, or renamed.

## Phase B-5A TRUST 5B-7D runtime audit

B-5A is audit-only. It freezes the current execution authority of the five TRUST workflows before any static prerequisite consolidation.

- All five workflows remain Supabase runtime owners and retain their phase-specific DB/runtime evidence.
- Phase 7C compatibility and Phase 7D relational adoption remain the two replay-baseline materialization owners.
- Repeated static verifier execution is recorded as a later B-5B consolidation candidate only; this phase does not remove or delegate any verifier.
- Supabase init/reset/stop repetition is recorded as an implementation-sharing candidate only; runtime authority remains phase-local.
- No workflow is added, retired, renamed, or trigger-modified by B-5A.

## Phase B-5B TRUST 5B-7D canonical static prerequisites

`trust-phase5b-7d-static.yml` is the canonical automatic owner of the repeated static prerequisite verifier set across TRUST 5B, 6A, 7C compatibility, 7C readiness, and 7D.

- PR/push phase workflows wait fail-closed on the same-head, same-event canonical static run.
- Manual `workflow_dispatch` keeps each phase's previous local static chain as a standalone fallback.
- All five phase workflows continue to own their Supabase DB runtime and phase-specific SQL/runtime evidence.
- Phase 7C compatibility and Phase 7D retain their local replay-baseline materialization because those artifacts are runtime evidence, not static-equivalent coverage.
- No phase workflow is retired or renamed.
- Current Main TRUST delegation is intentionally deferred; this phase canonicalizes the dedicated TRUST workflows first.

## Phase B-5C Current Main TRUST canonical delegation

Current Main now reuses the exact-head, exact-event successful `trust-phase5b-7d-static.yml` result for the 14 TRUST static contracts that the canonical workflow owns.

- The 14 matching Current Main verifier calls use delegated-or-local execution.
- If the TRUST canonical workflow did not trigger for the candidate SHA, Current Main executes all 14 verifiers locally.
- If Actions lookup is unavailable, Current Main preserves local fallback coverage.
- A discovered TRUST canonical non-success fails Current Main closed.
- TRUST Phase 1, Phase 5C, Phase 6B, Phase 8A, and other noncanonical TRUST contracts remain direct Current Main checks.
- Dedicated TRUST phase DB/runtime and replay-baseline responsibilities remain unchanged.

## Phase B-6A TRUST 8B-8G replay runtime audit

B-6A is audit-only and freezes the execution boundary before any replay-baseline setup sharing.

- All six workflows independently materialize the same governed Product Fact replay baseline exactly once.
- The materializer is repository-local and deterministic: it reads a governed fixture manifest, a fixed Git migration tree, compatibility bridges, and sentinels; it does not own Supabase startup, DB verification, or remote commands.
- Each phase then appends its own migration/fixture tail and remains the owner of its own Supabase runtime and SQL evidence.
- TRUST 8G keeps its production canary capture, semantic probes, controlled batch probes, and claim-asset verification operations.
- Shared artifact/cache/helper work may target only the common replay-baseline materialization boundary unless later equivalence evidence proves more.
- No workflow execution, trigger, retirement, rename, or runtime delegation is changed by B-6A.

## Phase B-6B TRUST 8B-8G replay consolidation decision

The replay-baseline review is closed with **local materialization preserved**.

A successful Phase 8G reference run (`36287673316`) showed the common replay materializer completing in about 0.22 seconds, while the following isolated Supabase runtime occupied about 97 seconds. This is a cost signal, not a universal benchmark, but it is sufficient to reject additional cross-workflow orchestration at the current scale.

- The existing Node materializer is already the shared implementation.
- Each workflow materializes locally immediately before appending phase-specific migrations and starting its isolated database.
- No canonical replay-artifact workflow is added.
- No upload/download cache layer, Actions run-id coupling, extra permissions, or artifact-expiry dependency is introduced.
- All six replay calls, six Supabase runtime authorities, six phase semantic verifiers, and TRUST 8G operational probes remain intentionally local.
- Reconsider this decision only if future measurements show replay materialization becoming materially expensive or shared artifacts become independently necessary for correctness.

## Phase C-1 execution-aware overlap semantics

The overlap auditor now distinguishes static coverage from runtime execution semantics.

- `duplicate_units` remains the broad static coverage-overlap metric.
- `automatic_execution_duplicate_units` counts only units that can actually execute on `pull_request` or `push`, after evaluating job/step `if:` conditions and Current Main canonical delegation.
- `execution_duplicate_units` is retained as a compatibility alias of `automatic_execution_duplicate_units`.
- `manual_fallback_units` records explicit `workflow_dispatch` fallback coverage inside workflows that also have automatic triggers.
- `manual_only_units` records workflow-dispatch-only execution coverage.
- DATA-AI3/4/5 and TRUST 5B-7D local fallback verifier chains therefore remain visible as coverage but are no longer counted as automatic duplicate execution.
- The metric is evidence only; it does not authorize workflow retirement.
- `automatic_verification_duplicate_units` narrows automatic overlap to verifier/check/audit/validate/guard contracts and excludes generic runtime capabilities and setup helpers.
- Transitive script expansion now requires actual `child_process`/`spawnSync` execution evidence, preventing structural source assertions such as quoted `run(...)` examples from being counted as child execution.
- Execution metrics collapse pure one-script npm aliases into their resolved script unit, avoiding double-counting `npm:verify:*` and the same underlying verifier; compound or nested npm tasks remain distinct.
- Executable driver scripts now contribute their statically declared npm child calls as execution units; `--prefix` package calls are namespaced so crawler/root tasks with the same script name are not conflated.

## Phase C-4 Current Main DATA-AI16/18/20-24 delegation

Current Main now reuses exact-head, exact-event successful dedicated workflow results for seven additional DATA-AI verifier contracts.

- DATA-AI16 delegates to `data-ai16-production-canary-closure.yml`.
- DATA-AI18 delegates to `data-ai18-authenticated-beta-runtime.yml`.
- DATA-AI20 delegates to `data-ai20-authenticated-beta-controlled-activation.yml`.
- DATA-AI21 delegates to `data-ai21-limited-beta-evidence-closure.yml`.
- DATA-AI22 live-provider acceptance delegates to `data-ai22-live-provider-acceptance.yml`.
- DATA-AI23 delegates to `data-ai23-authenticated-beta-ux.yml`.
- DATA-AI24 delegates to `data-ai24-operational-observability.yml`.
- DATA-AI22 product-query quality evaluation and its expected-baseline runner remain direct Current Main checks.
- Same-head owner success skips the duplicate Current Main verifier; missing owner runs or Actions lookup failures preserve local fallback; discovered owner failures fail closed.
- Dedicated push-only Production probe jobs remain owned by their existing workflows and are not moved into Current Main.
