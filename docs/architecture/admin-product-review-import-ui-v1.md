# Admin Product Review Import UI v1

## Status

`ADMIN-PRODUCT-4` stacked implementation contract.

- Base: `feature/admin-product-review-import-confirm`
- Route: `/admin/products/reviews/import`
- Production execution: out of scope
- Hosted Supabase: out of scope
- Main integration: out of scope

## Purpose

The workbench is a web adapter over the existing reviewed intake contract. It does not define a second parser, promotion policy, or product mutation path.

```text
admin session and PRODUCTS_REVIEW capability
→ batch.json + manifest.csv + evidence.jsonl + reviewed.csv
→ bounded multipart boundary
→ shared in-memory reviewed package parser
→ existing reviewed intake dry-run
→ exact file and canonical payload hashes
→ existing atomic confirm RPC
```

The crawler CLI and the web adapter consume the same `ParsedReviewedBatch`, dry-run, confirmation payload, ledger lookup, and atomic confirm domain functions.

## Four-file boundary

Accepted file fields are exactly:

- `batch`
- `manifest`
- `evidence`
- `reviewed`

File names are display metadata only and are not trusted for routing or validation. Duplicate fields, unexpected fields, missing fields, empty files, invalid UTF-8, NUL bytes, oversized individual files, and oversized actual request streams fail closed. `Content-Length` is an early rejection hint, not the byte-count authority.

Uploaded bytes remain in memory for the request lifetime and are not persisted.

## Authentication and request policy

Both routes require:

- same-origin request evaluation before protected work
- authenticated account session
- active admin membership with `PRODUCTS_REVIEW`
- server-derived actor user ID
- Node.js runtime
- dynamic/no-store response handling

The browser cannot provide an actor ID. Unexpected multipart text fields, including actor-spoof fields, are rejected.

Access and origin evaluator exceptions return fixed allowlisted errors. Raw authentication, parser, file, database, RPC, or stack details are not returned.

## Dry-run

`POST /api/admin/product-reviews/import/dry-run`

The route:

1. validates the multipart package,
2. parses the same AP3 reviewed intake contract,
3. loads the current authoritative candidate/review/evidence snapshot,
4. runs the existing dry-run,
5. returns bounded row errors and summary counts,
6. returns reviewed-file and canonical-payload SHA-256 values only when confirm-eligible.

Dry-run products writes are always `0`.

## Confirm

`POST /api/admin/product-reviews/import/confirm`

Confirm requires:

- the same four files,
- the dry-run request ID,
- expected reviewed-file SHA-256,
- expected canonical-payload SHA-256,
- exact confirmation phrase.

The server re-parses the package, verifies the file hash, rebuilds the payload, performs an exact ledger lookup, reruns the current dry-run, verifies the authoritative payload hash, and invokes the existing service-role-only atomic confirm path.

Exact completed retries return the stored confirmation. Reusing a request ID for a different payload and confirming one export batch under a second request fail closed.

## UI state invariants

- any file change invalidates prior dry-run, hashes, confirmation, and result state;
- Reset clears file inputs and all derived state;
- `canConfirm` is a strict Boolean;
- double submit is blocked by an in-flight guard;
- a confirmed summary takes precedence over the dry-run summary;
- confirm retry is enabled only for a server-declared retryable failure and preserves the same request ID;
- request IDs and retryability are visible for operator support without exposing raw errors.

## Verification

Focused verification covers:

- four-file state and reset;
- confirmed-summary precedence;
- strict confirm eligibility and exact retry;
- exact multipart fields;
- duplicate, unexpected, and missing fields;
- actual stream and per-file caps;
- invalid UTF-8 and NUL bytes;
- in-memory package integrity and hash mismatch;
- same-origin and capability boundaries;
- session actor binding;
- no-store and sanitized failures;
- crawler typecheck and AP2/AP3 regressions;
- isolated Supabase dry-run and atomic confirm runtime;
- architecture guard and production build.

## Deferred integration

This stacked branch remains based on the historical AP3 stack. It must not be merged directly to `main`. A separate current-main curated integration must preserve current Security, Auth, Premium, CandidatePolicy, Synthetic Toolkit, mobile camera, deployment policy, package versions, and migration ordering.
