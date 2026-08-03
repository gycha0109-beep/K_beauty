# ADMIN-PRODUCT-3 Reviewed Import Confirm

## Scope

Implemented a service-role-only `--confirm` path on
`feature/admin-product-review-import-confirm`, stacked on
`feature/admin-product-review-export-intake`.

Implemented:

- exact dry-run gate for new confirmations
- canonical batch confirm payload and SHA-256
- owner/operator capability revalidation
- service-only confirmation lookup and mutation RPCs
- request and batch advisory serialization
- exact retry, request conflict, and batch conflict handling
- one-transaction approve/create, approve/merge, defer, and block
- reuse of `promote_product_candidate`
- per-row hardened admin audit
- RLS-protected batch confirmation ledger
- fixed client error codes and generalized unexpected errors

Not implemented:

- administrator UI import
- partial batch application
- hosted Supabase migration or production batch operation
- automated research, LLM calls, pricing, or ranking changes

## Commands

```powershell
cd crawler

npm run reviews:import-reviewed -- `
  --file data/review-batches/sample-batch/reviewed.csv `
  --confirm `
  --actor-user-id <admin-uuid> `
  --request-id <request-id>

npm run verify:product-review-intake-confirm
```

From the repository root:

```powershell
npm run verify:admin-product-review-import-confirm
```

## Review fixes

Important fixes made during implementation review:

- Exact retries now consult the service-only ledger before the live dry-run,
  because a successful first transaction intentionally makes its source rows
  final and stale. New requests still require the complete dry-run.
- Confirm identity normalization now mirrors the existing promotion SQL and is
  rechecked in the RPC, preventing dry-run/promotion normalization drift and
  duplicate products.
- The RPC validates allowed arrays/enums, duplicate intent, verified sources,
  field evidence/confidence, and resolved contradictions rather than trusting
  a service caller's payload.
- The compact isolated product fixture now mirrors the production promotion
  normalization contract.

## Local verification

The implementation is verified by the crawler typecheck, export verifier,
dry-run verifier, confirm verifier, admin access/product review regression
verifiers, isolated migration replay, isolated runtime confirm scenarios,
architecture guard, production build, JavaScript syntax checks, and
`git diff --check`.

The isolated runtime covers create, merge, defer, block, exact retry, fixed
capability denial, stale snapshot rejection, request/batch conflict, direct RPC
browser denial, ledger direct-write denial, audit generation, and forced
mid-transaction audit failure with complete rollback. Runtime directories use
OS temporary storage and are removed in `finally`.

Final local results:

- migration replay in final timestamp order: PASS
- confirm runtime verifier: PASS
- forced audit-failure rollback: PASS
- existing admin SQL runtime regression: PASS
- crawler typecheck/export/dry-run/confirm verifiers: PASS
- admin access and Product Candidate Reviews static regression: PASS
- JavaScript syntax: PASS (`1062` checked files in the requested paths)
- architecture guard: PASS
- production build: PASS
- diff check: PASS

## Error log

- The first temporary Supabase project lacked a generated `migrations`
  directory; the isolated setup now creates it explicitly.
- The default local Supabase port was occupied by the existing `BuildMap`
  project. Only generated OS-temporary config copies use ports
  `55320..55322`; the existing project was not stopped or modified.
- The first TypeScript pass did not preserve the reviewed-decision narrowing.
  The builder now captures and validates the decision before constructing the
  typed payload.
- The first CLI retry reran the live dry-run after a successful transaction and
  correctly saw final rows as stale. A service-only exact ledger lookup now
  handles completed and concurrent retries without bypassing dry-run for a new
  request.
- PostgreSQL SQLSTATE `40001` was generalized by the local Data API before the
  fixed stale code reached the CLI. User-level stale checks now use `23514`
  while retaining the explicit stale message.
- The first static verifier expected the wrong source literal for `--confirm`;
  its assertion was corrected and rerun.

No failed run was counted as verification evidence. No hosted database,
production secret, GitHub Actions workflow, commit, push, PR, or deployment was
used.
