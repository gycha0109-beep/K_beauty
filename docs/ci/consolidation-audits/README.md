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
