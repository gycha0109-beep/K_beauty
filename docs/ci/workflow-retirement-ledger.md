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

## Not retired by this change

`data-ai14-production-canary.yml` remains active. Although historical, it still has a path-scoped PR/push guard over `vercel.json` that rejects reintroduction of superseded Production canary activation keys. It is not equivalent to a manual frozen-evidence workflow and requires a separate migration proof before removal.
