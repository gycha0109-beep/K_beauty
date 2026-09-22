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

### Product Evidence static wrapper set

- Retired workflows: `.github/workflows/free-result-v2-product-evidence-ui.yml`, `.github/workflows/product-evidence-presentation-contract.yml`, `.github/workflows/product-evidence-presentation-provider.yml`, `.github/workflows/product-evidence-review-observation-readiness.yml`
- Previous mode: path-scoped PR/push plus manual, contents-read-only Node verifier wrappers
- Unique executable checks: `verify-free-result-v2-product-evidence-ui.mjs`, `verify-product-evidence-presentation-contract.mjs`, `verify-product-evidence-presentation-provider.mjs`, and `verify-product-evidence-review-observation-readiness.mjs`
- Canonical authority: all four exact verifier scripts are now executed by `scripts/verify-current-main-health.mjs`
- Trigger equivalence: Current Main Health runs on every main PR and main push and retains manual dispatch, a strict superset of all four retired path filters
- Exact-head authority: Current Main Health checks out and attests the candidate SHA before running the canonical suite
- Runtime authority: none of the four workflows used Supabase runtime, deployment, OIDC, credentials, browser automation, artifacts, or release jobs
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs` requires all four wrapper files to remain absent and requires their four verifiers to remain in Current Main Health
- Equivalence result: Product Evidence semantic checks are preserved exactly while four redundant workflow wrappers are removed.

### DATA-AI22 product-query quality evaluation wrapper

- Retired workflow: `.github/workflows/data-ai22-product-query-quality-evaluation.yml`
- Previous mode: path-scoped PR/push plus manual, contents-read-only deterministic Node evaluation with exact-head checkout
- Unique executable checks: `node scripts/verify-data-ai22-product-query-quality.mjs` and `node scripts/run-data-ai22-product-query-quality-evaluation.mjs --expected-baseline`
- Canonical authority: both exact commands are executed by `scripts/verify-current-main-health.mjs`
- Trigger equivalence: Current Main Health runs on every main PR and main push and retains manual dispatch, a strict superset of the retired workflow path filters
- Exact-head authority: Current Main Health checks out and attests the candidate SHA before running the canonical suite
- Runtime authority: none; no Supabase runtime, hosted deployment, Vercel/OIDC, credential, browser, release, or external provider probe existed
- Artifact/persistence authority: none; the baseline runner writes only when an explicit `--output` path is supplied, while the canonical `--expected-baseline` invocation emits deterministic stdout only
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs` requires the wrapper to remain absent and requires both quality commands to remain owned by Current Main Health
- Equivalence result: the complete deterministic quality corpus verification and expected-baseline evaluation survive under broader canonical trigger coverage.

### Product Data Pipeline deterministic crawler wrappers

- Retired workflows: `.github/workflows/legacy-offer-classifier.yml`, `.github/workflows/product-identity-resolution.yml`
- Previous mode: path-scoped main PR/push, contents-read-only deterministic crawler verification
- Unique executable checks: `verify:legacy-offer-classifier`, `verify:legacy-offer-migration`, `verify:identity-resolution`, `verify:identity-adoption-plan`, and `verify:identity-key-repair-plan`
- Shared checks already canonical: crawler dependency installation, `crawler` TypeScript typecheck, exact candidate SHA checkout/attestation, and exact-head diff hygiene
- Canonical authority: all five unique crawler verifier commands are now executed by `scripts/verify-current-main-health.mjs`
- Trigger equivalence: both retired wrappers ran only on path-scoped PRs targeting `main` and path-scoped pushes to `main`; Current Main Health runs on every PR targeting `main` and every push to `main`, a strict trigger superset
- Runtime authority: none; neither wrapper used Supabase runtime, hosted deployment, Vercel/OIDC, credentials, browser automation, artifacts, release operations, or external provider calls
- Side effects: none; both workflows only read repository state and run deterministic crawler tests/typechecks
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs` requires both wrappers to remain absent and requires all five unique commands to remain owned by Current Main Health
- Equivalence result: deterministic Product Data Pipeline validation is preserved while two redundant standalone wrappers are removed.

### Hwahae review capture provenance wrapper

- Retired workflow: `.github/workflows/hwahae-review-capture-provenance.yml`
- Previous mode: path-scoped main PR/push plus manual, contents-read-only deterministic Node contract verification
- Unique executable check: `node scripts/verify-hwahae-review-capture-provenance.mjs`
- Canonical authority: the exact verifier is now executed by `scripts/verify-current-main-health.mjs`
- Trigger equivalence: Current Main Health runs on every PR targeting `main`, every push to `main`, and retains manual dispatch, a strict superset of the retired wrapper trigger set
- Exact-head authority: Current Main Health checks out and attests the candidate SHA before canonical verification and retains exact-head diff hygiene
- Runtime authority: none; no Supabase runtime, hosted deployment, Vercel/OIDC, credentials, browser automation, artifacts, release operations, or external provider calls existed
- Side effects: none; the verifier exercises local provenance/readiness contracts and explicitly enforces zero database authority and zero recommendation-semantic integration
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs` requires the wrapper to remain absent and the exact verifier to remain owned by Current Main Health
- Equivalence result: Hwahae capture-provenance semantics remain fully verified under broader canonical trigger coverage.

### Catalog Taxonomy canonical static wrapper

- Retired workflow: `.github/workflows/data-taxonomy-ci.yml`
- Previous mode: path-scoped main PR/push plus manual, contents-read-only deterministic Node verification
- Unique executable checks: eleven DATA-TAXONOMY contract verifiers plus four runtime-module syntax checks
- Canonical authority: all fifteen exact commands are now executed by `scripts/verify-current-main-health.mjs`
- Trigger equivalence: Current Main Health runs on every PR targeting `main`, every push to `main`, and manual dispatch, a strict superset of the retired path-scoped trigger set
- Exact-head authority: both paths attest the candidate SHA; Current Main Health additionally enforces exact-head diff hygiene
- Runtime authority: none; the wrapper used no Supabase runtime, hosted deployment, Vercel/OIDC, credentials, browser automation, artifacts, release operations, or external provider calls
- Verifier side effects: none; all eleven contract verifier scripts are deterministic local readers with no fetch, Supabase client, child process, filesystem write, environment-secret, or network dependency
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs` requires the wrapper to remain absent and all fifteen commands to remain owned by Current Main Health
- Equivalence result: canonical catalog-taxonomy contract and syntax coverage is preserved under broader canonical trigger coverage.

### Face Lab neutral review operator static wrappers

- Retired workflows: `.github/workflows/face-lab-neutral-review-operator-v1.yml`, `.github/workflows/face-lab-neutral-review-operator-vercel-cli-compat-v1.yml`
- Previous mode: path-scoped main PR plus manual, contents-read-only deterministic Node verification
- Unique executable checks: neutral-review operator safety, three operator/compatibility syntax checks, and Vercel CLI compatibility contract verification
- Canonical authority: all five exact checks are now executed by `scripts/verify-current-main-health.mjs`
- Trigger equivalence: Current Main Health runs on every PR targeting `main`, every push to `main`, and manual dispatch, a strict superset of both retired wrappers
- Exact-head and diff authority: Current Main Health retains exact candidate SHA checkout/attestation and exact-head diff hygiene
- Runtime authority: none; neither wrapper used deployment lookup, OIDC, credentials, browser automation, artifacts, release operations, Supabase runtime, or external provider calls
- Vercel compatibility semantics: verifier execution is local and dependency-injected; Vercel CLI calls and deployment URLs are mocked test fixtures rather than live deployment authority
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs` requires both wrappers to remain absent and all five canonical checks to remain owned by Current Main Health
- Equivalence result: Face Lab operator safety and Vercel CLI compatibility coverage is preserved without standalone wrapper duplication.

### Product Offer runtime observability static wrapper

- Retired workflow: `.github/workflows/data-offer17-offer-runtime-observability.yml`
- Previous mode: path-scoped main PR/push plus manual, contents-read-only deterministic Node verification
- Unique executable coverage: offer-runtime observability contract plus syntax checks for the verifier, observability module, and offer read service
- Canonical authority: the contract verifier was already owned by Current Main Health; all three syntax checks are now canonical there as well
- Trigger equivalence: Current Main Health runs on every PR targeting `main`, every push to `main`, and manual dispatch, a strict superset of the retired wrapper
- Exact-head and diff authority: Current Main Health retains exact candidate SHA checkout/attestation and exact-head diff hygiene
- Runtime authority: none; despite the historical display name, this wrapper performed no deployed runtime probe, OIDC, credential use, Supabase runtime, browser automation, artifacts, or external provider calls
- Verifier side effects: none; the observability verifier has no fetch, Supabase client, child process, filesystem write, environment-secret, or network dependency
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs` requires the wrapper to remain absent and all four checks to remain owned by Current Main Health
- Equivalence result: DATA-OFFER17 observability contract coverage remains intact while the actual controlled deployed RPC diagnostic stays standalone.

### Face Lab neutral face-count shared-stage static wrapper

- Retired workflow: `.github/workflows/face-lab-neutral-face-count-shared-stage-v1.yml`
- Previous mode: path-scoped main PR/push plus manual, contents-read-only Node verification
- Unique executable coverage: neutral face-count shared-stage verifier, six touched-runtime syntax checks, and three hosted-set/response/UI contract checks
- Existing canonical overlap: target-axis, Human cue protocol, archetype scoring, Human evaluation, synthetic workspace, and architecture guard were already owned by Current Main Health
- Canonical authority: all unique checks are now executed by `scripts/verify-current-main-health.mjs`; the overlapping checks remain canonical there
- Trigger equivalence: Current Main Health runs on every PR targeting `main`, every push to `main`, and manual dispatch, a strict superset of the retired path-scoped trigger set
- Exact-head and diff authority: Current Main Health retains exact candidate SHA checkout/attestation and exact-head diff hygiene
- Runtime authority: none; the wrapper did not start Supabase, connect to a database, use credentials, execute browser automation, deploy, upload artifacts, or call an external provider
- Verifier side effects: none; the neutral-stage verifier reads repository authority and fixtures only. Its `fetch(DATA.submitEndpoint` occurrence is a source-code needle, not a network call
- Retirement guard: `scripts/verify-ci-trigger-topology.mjs` requires the wrapper to remain absent and the complete canonical coverage set to remain in Current Main Health
- Equivalence result: Face Lab neutral face-count static coverage is preserved under the broader canonical health authority.
