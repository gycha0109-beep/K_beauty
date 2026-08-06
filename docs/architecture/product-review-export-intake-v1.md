# Product Review Export & Enrichment Intake v1

## Purpose

ADMIN-PRODUCT-2 creates a controlled file boundary between the raw ranking
candidate queue and the existing administrator Product Candidate Reviews
workbench.

```text
product_candidates + candidate_promotion_reviews
  -> manifest.csv + evidence.jsonl + batch.json + reviewed-template.csv
  -> external human web review
  -> reviewed.csv
  -> strict import dry-run
  -> ADMIN-PRODUCT-3 batch confirmation
```

The export and `--dry-run` paths remain zero-write. Batch confirmation is a
separate ADMIN-PRODUCT-3 contract documented in
`docs/architecture/product-review-import-confirm-v1.md`.

## Runtime boundary

The commands live in the crawler package because that package already owns
ranking collection and `reviews:pending`.

```powershell
cd crawler

npm run reviews:export -- `
  --status queued `
  --out-dir data/review-batches/sample-batch

npm run reviews:import-reviewed -- `
  --file data/review-batches/sample-batch/reviewed.csv `
  --dry-run
```

Paths are repository-root-relative. Absolute paths, `..`, repository escapes,
and symlinked path components are rejected. Export uses a Node-only
service-role client in a read-only module; its query module contains only
`select` operations. The service-role key and database URL are never printed
or included in batch files.

`--confirm` is not an alias for dry-run. It requires an administrator actor UUID
and an operator-supplied idempotency request ID; it is governed by the
ADMIN-PRODUCT-3 contract.

## Export selection

Required options:

- `--status queued|reviewing|deferred`
- `--out-dir <repository-relative-directory>`

Optional options:

- `--limit <1..100>`; default and maximum are 100
- `--candidate-id <uuid>`
- `--overwrite`

The query requires matching review/candidate rows, source external identity,
and a non-final candidate. Candidates already `approved`, `promoted`, or
`rejected` are omitted. A zero-candidate result fails with
`review_export_no_candidates`; it does not create an empty batch.

An existing output directory fails by default. `--overwrite` only accepts a
directory containing the four owned batch filenames. New files are staged in a
sibling temporary directory before the old owned directory is replaced.

## Batch files

All files are UTF-8 without BOM and use LF line endings. Candidate ordering is
ascending UUID. Injected clock and UUID values make the serializer byte-for-byte
deterministic for the same source records.

### batch.json

The exact fields are:

```text
schema_version = product-review-export-v1
export_batch_id
exported_at
exported_by_tool = bejewely-product-review-export/1
source_status
candidate_count
manifest_file = manifest.csv
evidence_file = evidence.jsonl
reviewed_template_file = reviewed-template.csv
manifest_sha256
evidence_sha256
candidate_ids_sha256
source_snapshot_version
```

File hashes cover exact UTF-8 bytes. `candidate_ids_sha256` covers sorted UUIDs,
one per LF-terminated line. `source_snapshot_version` covers a canonical JSON
array of candidate ID, candidate timestamp, review timestamp, and evidence
version.

### manifest.csv

The manifest header order is defined in
`crawler/lib/reviews/review-export-contract.ts`. It contains flat
identification, source, queue, ranking summary, match, snapshot, and integrity
fields.

```text
schema_version
export_batch_id
candidate_id
brand_name
product_name
normalized_brand
normalized_name
source_external_id
source_product_url
source_category_key
source_product_form
review_status
priority_score
review_queue_updated_at
candidate_updated_at
latest_concern_rank
best_concern_rank
concern_observed_dates
distinct_concern_count
latest_popularity_rank
popularity_observed_dates
existing_product_match_id
existing_product_match_confidence
existing_product_normalized_brand
existing_product_normalized_name
evidence_version
evidence_jsonl_ref
row_integrity_hash
```

Spreadsheet formula injection is blocked in external/display strings by
prefixing a leading `=`, `+`, `-`, or `@` with an apostrophe. The raw value is
kept only in the JSON evidence candidate snapshot. Complex arrays and objects
are not placed in manifest cells.

### evidence.jsonl

There is exactly one canonical-JSON line per candidate:

```text
schema_version
export_batch_id
candidate_id
evidence_version
candidate_snapshot
review_queue_snapshot
ranking_evidence
source_evidence
existing_product_match
proposed_promotion_payload
missing_fields
approve_blockers
evidence_integrity_hash
```

Ranking and promotion objects are explicit allowlists. Ranking observations are
bounded; arbitrary raw review dumps and `latest_raw_source` are excluded.
Promotion URLs must be safe HTTPS URLs or are emitted as `null`. Review queue
notes are excluded. A JSONL line is limited to 128 KiB, the evidence file to
8 MiB, and JSON depth to 20.

Credentials, cookies, authorization headers, connection strings, personal
data, face/image payloads, base64 images, environment dumps, and stack traces
are prohibited.

### reviewed-template.csv

Protected fields:

```text
schema_version
export_batch_id
candidate_id
candidate_updated_at_expected
review_queue_updated_at_expected
evidence_version_expected
row_integrity_hash
evidence_jsonl_ref
```

Reviewer fields:

```text
review_decision
review_confidence
reviewed_at
review_source_urls_json
canonical_brand
canonical_name
canonical_category
product_form
skin_types_json
concerns_json
texture
finish
irritation_risk
sensitivity_safe
official_product_page_status
ingredient_list_status
duplicate_check_status
existing_product_match_id_reviewed
field_evidence_json
field_confidence_json
contradictions_json
defer_reason
block_reason
review_note
```

Blank JSON cells mean “not supplied”; literal `null` remains null; `[]` remains
an explicitly empty array. `sensitivity_safe` accepts `true`, `false`, `null`,
or `unknown`. Approve requires a boolean; unknown evidence must be deferred.

## Integrity

Canonical JSON sorts object keys, preserves array order, distinguishes null
from required values, normalizes timestamps to UTC ISO 8601 and negative zero,
and rejects undefined/non-finite values. SHA-256 is lowercase hex over UTF-8.

`row_integrity_hash` covers:

```text
schema_version
export_batch_id
candidate_id
candidate_updated_at
review_queue_updated_at
evidence_version
source_external_id
source_product_url
normalized_brand
normalized_name
existing_product_match_id
evidence_integrity_hash
```

Reviewer input fields are excluded.

These hashes provide deterministic integrity and accidental-tamper detection,
not cryptographic authorship: they are unkeyed. Intake also compares candidate
identity/source fields, candidate timestamp, review timestamp/status, and
evidence version against the authoritative current database. Batch files must
still be exchanged through a controlled operational channel.

## Strict parsing

The intake parser rejects:

- missing, duplicate, blank, dangerous, or unknown headers
- row/header column-count mismatch and malformed quoting
- invalid UTF-8 and oversized files, rows, lines, cells, or JSON
- deep JSON and `__proto__`, `prototype`, or `constructor` keys
- duplicate or mismatched candidate sets and evidence references
- batch, manifest, evidence, source snapshot, evidence-row, or row hash mismatch

Unknown v1 columns fail closed. A later contract must use a new schema version.

## Decision contract

Allowed common values:

- decision: `approve`, `defer`, `block`
- confidence: `low`, `medium`, `high`
- category: the current service category contract
- treatment form: `serum`, `ampoule`, `essence`, `booster`,
  `peeling_solution`
- skin type: `oily`, `dry`, `combination`, `sensitive`
- concern: `oiliness`, `dehydration`, `acne`, `uneven_tone`, `pores`,
  `redness`, `barrier`
- texture: `watery`, `gel`, `lotion`, `cream`
- finish: `fresh`, `natural`, `dewy`, `soft_matte`
- irritation: `low`, `medium`, `high`

Approve additionally requires canonical identity, category/form, non-empty
skin/concern arrays, texture/finish/irritation/boolean sensitivity, verified
official and ingredient sources, resolved duplicate status, safe HTTPS source
URLs, per-field source and confidence, and no unresolved contradiction.

Defer reason codes:

```text
missing_official_source
missing_ingredient_evidence
identity_unresolved
category_unresolved
contradiction_unresolved
needs_manual_research
```

Block reason codes:

```text
duplicate_product
invalid_identity
out_of_scope
unsafe_source
source_removed
```

A duplicate block requires an existing product ID. Defer and block do not
require a complete canonical payload and always have zero planned product
writes.

## Existing product policy

Dry-run distinguishes `create_new`, `merge_existing`, `deferred`, `blocked`,
and `invalid`.

The reviewed existing product ID must exactly echo the exported match. A
change, including adding a match where export had none, is a conflict and
requires a new authoritative export. The product must exist and its normalized
identity must match reviewed canonical identity.

An approve row with no reviewed match fails if its normalized identity already
exists. Two create rows with the same identity both fail. Multiple candidates
may merge into the same product only when every row independently echoes the
same exported match and identity; v1 reports separate planned merges.

## Snapshot and zero-write boundary

Dry-run reads current candidate identity/source/raw identity/status/timestamp,
review status/timestamp/rule/evidence, and referenced or normalized products.

Dedicated stale codes:

```text
reviewed_row_stale_candidate
reviewed_row_stale_review_queue
reviewed_row_stale_evidence
```

The dry-run imports no mutation, promotion RPC, admin confirm RPC, audit writer,
or confirmation-ledger helper. Every result prints:

```text
Products writes: 0
Database writes: 0
```

Any invalid row makes the entire v1 batch `FAIL` and exits non-zero.

## Error codes

File and batch failures use fixed codes including:

```text
review_batch_schema_invalid
review_batch_row_count_mismatch
review_batch_candidate_ids_mismatch
review_batch_source_snapshot_mismatch
review_manifest_hash_mismatch
review_evidence_hash_mismatch
review_evidence_integrity_mismatch
review_manifest_row_integrity_mismatch
reviewed_csv_duplicate_header
reviewed_csv_missing_header
reviewed_csv_unknown_header
reviewed_csv_malformed
reviewed_candidate_set_mismatch
reviewed_duplicate_candidate_id
```

Row contract and security failures include:

```text
reviewed_protected_field_mismatch
reviewed_row_integrity_mismatch
reviewed_json_cell_invalid
reviewed_json_cell_too_large
reviewed_formula_injection
reviewed_source_url_unsafe
reviewed_decision_invalid
reviewed_category_invalid
reviewed_product_form_required
reviewed_sensitivity_safe_invalid
reviewed_field_evidence_missing
reviewed_contradiction_unresolved
```

Snapshot and identity failures include:

```text
reviewed_row_stale_candidate
reviewed_row_stale_review_queue
reviewed_row_stale_evidence
reviewed_row_already_processed
reviewed_existing_product_match_conflict
reviewed_existing_product_not_found
reviewed_existing_product_identity_conflict
reviewed_batch_duplicate_product_create
```

CLI and environment failures expose only bounded codes such as
`review_export_database_read_failed`, `review_database_configuration_missing`,
and `review_import_dry_run_failed`. Raw Supabase or filesystem messages are not
part of the public command contract.

## Security boundary

- only HTTPS source URLs are accepted
- credentials, local/private addresses, userinfo, trailing-dot hosts, and
  internationalized/punycode host labels are rejected
- formula prefixes in reviewed scalar text are rejected
- exact object/column allowlists prevent prototype and dynamic-merge abuse
- errors expose fixed codes/messages, not raw DB errors, payloads, secrets, or
  stack traces
- hashes use timing-safe comparison after format validation
- Windows and Linux receive identical LF/UTF-8 hash inputs

## Non-targets

- confirmation behavior beyond the linked ADMIN-PRODUCT-3 v1 contract
- products, review queue, audit, or confirmation-ledger mutation
- hosted Supabase migration or production batch creation
- administrator UI import or bulk approve
- automated web research, LLM calls, or price collection
- crawler ranking policy changes
- deployment
