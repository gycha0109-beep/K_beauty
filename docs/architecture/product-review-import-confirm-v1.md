# Product Review Import Confirm v1

## Purpose

ADMIN-PRODUCT-3 confirms one reviewed batch only after the ADMIN-PRODUCT-2
parser and authoritative dry-run pass:

```text
reviewed.csv
  -> strict file and row validation
  -> current candidate/review/evidence dry-run
  -> service-role-only batch RPC
  -> approve / defer / block in one transaction
  -> per-row audit + batch confirmation ledger
```

This contract does not add an administrator UI, hosted migration, automated
research, ranking-policy change, or production batch operation.

## CLI

From `crawler/`:

```powershell
npm run reviews:import-reviewed -- `
  --file data/review-batches/sample-batch/reviewed.csv `
  --confirm `
  --actor-user-id <admin-uuid> `
  --request-id <operator-generated-id>
```

Exactly one of `--dry-run` and `--confirm` is required. Confirm requires a UUID
actor and an 8..120 character request ID. The CLI parses the same batch files,
reconstructs the canonical confirm payload, and checks an exact prior
confirmation before running a new dry-run. A new confirmation is never sent
unless the dry-run is `PASS`.

An exact completed retry returns the stored result. This lookup is necessary
because the original candidate and queue snapshots are final after the first
transaction and would correctly look stale to a new dry-run. If a concurrent
confirmation finishes during dry-run, the CLI performs the exact lookup again.

## Service boundary

`admin_get_product_review_import_confirmation` and
`admin_confirm_product_review_import_batch` are `security definer` RPCs granted
only to `service_role`. `anon` and `authenticated` cannot execute them. The
Node CLI never places the service key in browser code, files, output, errors, or
audit metadata.

Both RPCs revalidate the actor against the active `admin_memberships` ledger and
the `admin.products.review` capability. `admin_operator` and `admin_owner` may
confirm; viewer/privacy-only and inactive memberships cannot.

The confirmation ledger has RLS enabled and no direct table privilege,
including for `service_role`; it is accessible only through the bounded RPCs.

## Confirm payload and integrity

The canonical payload schema is `product-review-import-confirm-v1`. It includes
the export batch ID, source snapshot hash, exact manifest/evidence/reviewed file
hashes, candidate ID hash, reviewed decisions, protected snapshot values, and
the allowlisted current candidate/review evidence needed for DB revalidation.

The CLI hashes sorted-key canonical JSON as lowercase SHA-256 over UTF-8. The DB
recomputes the same payload, candidate-ID, and source-snapshot hashes before
locking rows. Unknown top-level payload keys, invalid sizes, and sensitive
token/cookie/secret-shaped content fail closed.

The normalized identity used by intake mirrors the existing
`normalize_brand_key` / `normalize_product_key` promotion contract. The RPC
recomputes those keys and rejects drift before invoking promotion.

## Transaction and concurrency

One RPC call is one PostgreSQL transaction. It:

1. validates actor, payload, hashes, batch size, and duplicate candidates;
2. takes transaction advisory locks for request ID and export batch ID;
3. returns an exact prior request or rejects request/batch conflicts;
4. locks candidate and queue rows in sorted candidate order;
5. revalidates candidate timestamp/source/identity/promotion state;
6. revalidates queue timestamp/status/rule/evidence hash;
7. applies each reviewed decision;
8. writes one bounded audit event per row;
9. inserts the batch ledger only after every row succeeds.

Any exception rolls back products, candidates, queue rows, audit rows, and the
ledger together. Different payloads cannot reuse a request ID, and a confirmed
export batch cannot use a second request ID.

## Decision effects

Approve:

- requires canonical identity, current category/form enums, allowed product
  arrays/enums, boolean sensitivity, verified official/ingredient evidence,
  field evidence/confidence, safe source references, resolved contradictions,
  and a consistent duplicate decision;
- updates the candidate enrichment payload;
- marks it approved, calls the existing `promote_product_candidate`, and accepts
  only `inserted` or `merged`;
- marks the queue approved with the returned product ID.

Defer:

- requires an allowlisted defer reason;
- updates only candidate and queue review state;
- writes no product.

Block:

- requires an allowlisted block reason;
- duplicate blocks require a validated existing product;
- updates only candidate and queue review state;
- writes no product.

Every row records `admin.product_review_import.confirmed` through the hardened
admin audit writer. The client cannot supply the audit actor or action.

## Error contract

Expected failures are mapped to fixed codes, including:

```text
review_import_access_required
review_import_capability_required
review_import_request_id_conflict
review_import_batch_already_confirmed
review_import_payload_hash_mismatch
review_import_source_snapshot_hash_mismatch
review_import_stale_candidate
review_import_stale_review_queue
review_import_row_already_processed
review_import_existing_product_identity_conflict
review_import_duplicate_product_create
review_import_normalization_contract_mismatch
review_import_confirm_failed
```

Unexpected database details are generalized to
`review_import_confirm_failed`. Payloads, SQL, stack traces, URLs, and secrets
are not printed.

## Non-targets

- administrator UI import
- per-row partial commit
- hosted Supabase migration or production data operation
- bulk approve outside one reviewed batch
- automated web research, LLM calls, or price collection
- crawler ranking policy changes
- deployment
