# ADMIN-PRODUCT-2 Review Export & Enrichment Intake

## Scope

Implemented the file-based review export and reviewed intake dry-run on
`feature/admin-product-review-export-intake`, stacked on
`feature/admin-product-candidate-reviews` at
`33b26f3c95486d69251ebdc37a32fa2554e51abf`.

Implemented:

- read-only `queued|reviewing|deferred` candidate export
- deterministic four-file batch
- strict reviewed CSV parser and batch/evidence integrity verification
- authoritative candidate/review/evidence stale comparison
- approve/create, approve/merge, defer, block, and invalid planning
- fixed error codes and zero-write summary
- fixture and local verifier coverage

Not implemented in ADMIN-PRODUCT-2 itself:

- reviewed import confirm (implemented separately by ADMIN-PRODUCT-3)
- product, candidate, review queue, audit, or confirmation-ledger writes
- hosted Supabase migration or production batch
- admin UI import
- automated web review, LLM, price collection, or crawler policy changes

## Commands

From `crawler/`:

```powershell
npm run reviews:export -- `
  --status queued `
  --out-dir data/review-batches/sample-batch

npm run reviews:import-reviewed -- `
  --file data/review-batches/sample-batch/reviewed.csv `
  --dry-run

npm run verify:product-review-export
npm run verify:product-review-intake-dry-run
```

`--confirm` is now governed by the ADMIN-PRODUCT-3 contract; `--dry-run`
retains the zero-write behavior documented here.

## Implementation

The implementation separates:

- contract constants and types
- canonical JSON, SHA-256, URL, and JSON safety
- strict CSV parsing/serialization
- read-only Supabase selection/snapshot queries
- batch serialization
- file/path/overwrite boundary
- reviewed input validation
- dry-run DB comparison, identity planning, summary, and error mapping
- CLI parsing and process entry points

The dry-run dependency graph contains no candidate/product mutation method, RPC,
audit writer, or confirmation helper.

## Review fixes

Critical: none.

Important fixes made during self-review:

- Candidate stale detection no longer relies only on `updated_at`. It compares
  current external/source/raw/canonical/category/form/match/review-flag/promotion
  state and a promotion-payload hash because historical candidate updates do
  not have one universal timestamp trigger.
- Evidence export now uses explicit ranking/promotion allowlists and observation,
  line, file, depth, and URL bounds instead of forwarding an arbitrary DB JSON
  object.
- Overwrite stages a complete replacement first and rejects directories with
  non-owned files.
- Source URL validation rejects credentials, unsafe schemes, local/private
  addresses, trailing-dot hosts, and punycode labels.
- Source snapshot hash is recomputed from manifest rows during intake.

Minor fixes:

- The local reviewed fixture now stamps review time after the live export time.
- The reviewed contract uses a lightweight local enum contract so the CLI does
  not load unrelated image-policy runtime code through the legacy review-prep
  module.

## Verification

Local static/runtime:

- `npm ci --no-audit --no-fund` in crawler: PASS
- crawler typecheck: PASS
- export verifier: PASS
- intake dry-run verifier: PASS
- admin access verifier: PASS
- admin product candidate review verifier: PASS
- architecture guard: PASS
- production build: PASS
- JavaScript `node --check`: PASS
- `git diff --check`: PASS
- untracked-file whitespace/final-LF check: PASS

Isolated Supabase/Postgres:

- CLI `2.109.1`, isolated ports `56320..56329`
- product foundation fixture replay: PASS
- admin access migration replay: PASS
- all three admin product review migrations replay: PASS
- ADMIN-PRODUCT-2 five-candidate fixture replay: PASS
- existing admin SQL runtime matrix: PASS
- real service-role read-only export: 5 candidates, four files
- real reviewed intake dry-run: 5/5 valid
- planned create: 1
- planned merge: 1
- planned defer: 2
- planned block: 1
- stale candidate mutation: correctly failed
- `--confirm`: correctly failed
- before/after row counts:
  - products: 2 -> 2
  - product_candidates: 5 -> 5
  - candidate_promotion_reviews: 5 -> 5
  - admin_audit_logs: 0 -> 0
  - admin_product_review_confirmations: 0 -> 0
- isolated containers and runtime files removed: PASS

Negative fixture coverage includes row hash and batch ID tampering, duplicate
candidate and create identity, invalid enum, missing treatment form, invalid
sensitivity, unsafe source URL, existing-product conflicts, malformed/oversized
JSON, CSV formula input, candidate/review/evidence staleness, manifest hash
tampering, and confirm rejection.

## Error log

- The first intake verifier runtime imported the legacy `review.ts` module,
  which pulled an incompatible root image-policy module export. The reviewed
  contract was isolated from that unrelated runtime dependency; typecheck and
  both verifiers then passed.
- A final local overwrite attempt correctly failed because the target contained
  the extra operator-created `reviewed.csv`, which is not one of the four owned
  export files. Verification used a fresh batch directory.
- The first live reviewed fixture used a fixed timestamp earlier than the new
  export and correctly failed `reviewed_at_before_export`. The local fixture
  helper now uses the current UTC timestamp; the rerun passed.
- Docker Desktop was initially stopped. It was started locally, all isolated
  verification passed, and the isolated project was removed.
- `npm ci` reported the environment's allow-scripts notice for esbuild. The
  installed toolchain still passed typecheck and both runtime verifiers.

## Residual risk

The v1 SHA-256 values are deterministic integrity hashes, not keyed signatures.
They detect accidental or unsophisticated tampering, while authoritative DB
snapshot comparison protects current candidate/review/evidence state. Batch
exchange still requires a controlled operational channel. A signed batch
envelope is an optional future hardening, not a blocker for this dry-run stage.

No production batch, external reviewer file, hosted Supabase connection, or
production data was used.
