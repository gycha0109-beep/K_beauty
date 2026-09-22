# CI Workflow Retirement Ledger

This ledger records workflow removals only after their unique verification behavior has an explicit surviving authority.

## Retirement rule

A workflow may be removed only when all of the following are true:

1. its live runtime or release authority has already been superseded;
2. historical evidence remains represented by a repository contract or immutable evidence record;
3. a surviving canonical verifier checks that evidence or invariant;
4. topology verification prevents the retired workflow from silently returning;
5. the responsibility inventory is updated in the same change.

## Retired workflows

### DATA-AI9 historical hosted Preview evidence

- Retired workflow: `.github/workflows/data-ai9-hosted-preview-acceptance.yml`
- Previous mode: manual-only, contents-read-only, frozen historical evidence reporting
- Live authority: none; the workflow explicitly reported `HISTORICAL_EVIDENCE_FROZEN_BY_DATA_AI10`
- Surviving evidence: `lib/product-query-hosted-preview-acceptance-evidence.mjs`
- Closure authority: `lib/product-query-post-preview-readiness-contract.mjs` (`DATA-AI10`)
- Canonical verifier: `scripts/verify-data-ai9-hosted-preview-acceptance.mjs`, executed by `scripts/verify-current-main-health.mjs`
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs`
- Equivalence result: safe to retire because the removed workflow had no live probe, deployment permission, OIDC permission, credential use, push trigger, pull-request trigger, or schedule. Its only executable verification is retained in canonical current-main health.

### DATA-AI14 historical Production canary guard

- Retired workflow: `.github/workflows/data-ai14-production-canary.yml`
- Previous mode: path-scoped PR/push guard plus manual verification; contents-read-only
- Live authority: none; Production canary execution was already superseded by DATA-AI16
- Preserved invariant: all retired Production canary activation keys must remain absent from `vercel.json`
- Canonical verifier: `scripts/verify-data-ai14-production-canary-harness.mjs`, executed by `scripts/verify-current-main-health.mjs`
- Trigger equivalence: `current-main-health.yml` runs on every PR to `main` and every push to `main`, so the migrated invariant is checked on a strict superset of the old `vercel.json` path-scoped trigger
- Manual equivalence: canonical Current Main Health retains `workflow_dispatch`
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs`
- Equivalence result: safe to retire because the unique fail-closed invariant moved into the canonical verifier without removing the check; the retired workflow had no deployment/OIDC/credential/runtime authority.

### DATA-AI17 authenticated limited-beta design contract

- Retired workflow: `.github/workflows/data-ai17-authenticated-limited-beta-design.yml`
- Previous mode: path-scoped PR/push plus manual contract verification; contents-read-only
- Unique executable check: `node scripts/verify-data-ai17-authenticated-limited-beta-design.mjs`
- Canonical authority: the same verifier is already executed by `scripts/verify-current-main-health.mjs`
- Trigger equivalence: Current Main Health runs on every main PR and main push, a strict superset of the retired workflow path filters, and retains manual dispatch
- Runtime authority: none; no deployment/OIDC/credential/runtime probe existed
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs`
- Equivalence result: exact contract verifier preserved with broader canonical trigger coverage.

### DATA-AI19 authenticated beta activation preflight contract

- Retired workflow: `.github/workflows/data-ai19-authenticated-beta-activation-preflight.yml`
- Previous mode: path-scoped PR/push plus manual contract verification; contents-read-only
- Unique executable check: `node scripts/verify-data-ai19-authenticated-beta-activation-preflight.mjs`
- Canonical authority: the same verifier is already executed by `scripts/verify-current-main-health.mjs`
- Trigger equivalence: Current Main Health runs on every main PR and main push, a strict superset of the retired workflow path filters, and retains manual dispatch
- Runtime authority: none; no deployment/OIDC/credential/runtime probe existed
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs`
- Equivalence result: exact contract verifier preserved with broader canonical trigger coverage.

### TRUST Phase 5 read-only Admin Queue contract

- Retired workflow: `.github/workflows/trust-phase5-admin-queue.yml`
- Previous mode: path-scoped PR/push contract verification; contents-read-only
- Unique executable check: `node scripts/verify-trust-phase5-admin-queue.mjs`
- Canonical authority: the same verifier is already executed by `scripts/verify-current-main-health.mjs`
- Canonical companion gates: Current Main Health also owns the architecture guard and Production build that the retired phase workflow explicitly avoided duplicating
- Trigger equivalence: Current Main Health runs on every main PR and main push, a strict superset of the retired workflow path filters
- Runtime authority: none; no Supabase runtime, deployment, OIDC, credential, browser, artifact, or release job existed
- Retirement guard: the Phase 5 verifier and `scripts/verify-ci-trigger-topology.mjs` both require the retired workflow to remain absent
- Equivalence result: focused static contract coverage is preserved by the canonical health workflow with broader trigger coverage.

### TRUST Phase 5C FATION formulation-conflict HOLD

- Retired workflow: `.github/workflows/trust-phase5c-fation-formulation-conflict.yml`
- Previous mode: path-scoped PR plus historical research-branch push, contents-read-only static evidence verification
- Canonical authority: `scripts/product-evidence/verify-trust-phase5c-fation-formulation-conflict-v1.mjs`, already executed by `scripts/verify-current-main-health.mjs`
- Preserved unique zero-write gate: the workflow's mutation-shaped SQL/code scan is now enforced inside the canonical Phase 5C verifier across the frozen evidence JSON, evidence note, and verifier source
- Phase 5B regression authority: `scripts/verify-trust-phase5b-subject-registration.mjs` remains independently executed by Current Main Health
- Exact-head authority: Current Main Health checks out and attests the candidate SHA before canonical verification
- Runtime authority: none; no Supabase runtime, deployment, OIDC, credential, browser, artifact, or release job existed
- Retirement guard: the Phase 5C verifier and `scripts/verify-ci-trigger-topology.mjs` both require the retired workflow to remain absent
- Equivalence result: all semantic and zero-write checks survive under canonical Current Main Health; only the redundant standalone wrapper is removed.

### TRUST Phase 8A revalidation contract

- Retired workflow: `.github/workflows/trust-phase8a-revalidation-contract.yml`
- Previous mode: path-scoped PR/push plus manual static contract verification; contents-read-only
- Unique executable check: `node scripts/verify-trust-phase8a-revalidation-contract.mjs`
- Canonical authority: the same verifier is now executed by `scripts/verify-current-main-health.mjs`
- Trigger equivalence: Current Main Health runs on every main PR and main push and retains manual dispatch, a strict superset of the retired path filters
- Exact-head authority: Current Main Health already checks out and attests the candidate SHA
- Diff-hygiene preservation: the retired workflow's `git diff --check` gate is promoted into `current-main-health.yml` as a canonical exact-head diff-hygiene step
- Runtime authority: none; no Supabase runtime, deployment, OIDC, credential, browser, artifact, or release job existed
- Retirement guard: the Phase 8A verifier and `scripts/verify-ci-trigger-topology.mjs` both require the retired workflow to remain absent
- Equivalence result: static revalidation-contract coverage and diff hygiene are preserved under broader canonical coverage.
