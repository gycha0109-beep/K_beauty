# Admin Product Review — Cleanser Metadata Contract v2

Status: implemented behind an explicit Admin v2 contract; recommendation activation remains out of scope.

## 1. Admin branch topology

The durable implementation base is `integration/admin-product-current-main` at `4efa74c8ce4c89b03cc592e7edbf93b20c6fd687` (PR #166). PR #168 contains hosted audit and rollback documentation only. PR #169 contains local rehearsal tooling and documentation only. Neither is a functional base. Recommendation PR #167 is an independent policy/evidence lineage and is not imported.

The v2 implementation branch is `feature/admin-product-review-cleanser-metadata-v2`, based directly on the exact #166 head.

## 2. v1 / v2 boundary

v1 remains unchanged:

- `product-review-export-v1`
- `product-review-manifest-v1`
- `product-review-evidence-v1`
- `product-review-reviewed-v1`
- `product-review-import-confirm-v1`
- exact v1 headers, parser, canonical payload hash, dry-run, confirm, create and merge semantics

v2 is selected explicitly:

- export batch: `product-review-export-v2`
- reviewed rows: `product-review-reviewed-v2`
- confirm payload: `product-review-import-confirm-v2`
- review contract: `admin-product-review-v2`

The v2 parser does not infer a contract from extra columns, does not fall back to v1, and does not convert v1 rows. A v1 bundle submitted to the v2 adapter fails closed, and a v2 bundle is not accepted by the v1 adapter.

## 3. Bundle contract

The bundle retains the existing four-file shape:

```text
batch.json
manifest.csv
evidence.jsonl
reviewed.csv
```

`batch.json` carries independent versions for the Admin bundle, cleanser metadata schema, review policy, and field-evidence schema. `manifest.csv` and `evidence.jsonl` retain candidate identity, source snapshot, evidence integrity, and optimistic-concurrency bindings.

The v2 reviewed CSV retains every v1 header and adds exact headers:

```text
review_contract_version
cleansing_profile
cleansing_profile_review_state
cleansing_profile_confidence
cleansing_profile_evidence_refs_json
cleansing_profile_schema_version
cleansing_profile_review_policy_version
cleansing_profile_evidence_schema_version
```

JSON arrays are parsed as JSON. They are never comma-split.

## 4. Cleanser field semantics

Allowed `cleansing_profile` values:

- `low_ph`: pH characteristic only. It is not evidence of gentleness, low irritation, or non-deep cleansing.
- `balanced`: incomplete profile semantics. It is not `moderate` and not non-deep authority.
- `deep_clean`: reviewed structured positive value. Whether recommendation scoring consumes it is a separate policy decision.
- `null`: unresolved, conflicting, absent, or not applicable according to review state.

No normalization maps invalid values to null, null to balanced, low-pH to gentle, balanced to moderate, or deep-clean to strong.

## 5. Review states and confidence

States:

- `reviewed_valid`: cleanser, non-null allowed profile, bounded confidence, matching field evidence, and all required versions.
- `reviewed_unknown`: cleanser, null profile, `unknown` confidence, and evidence showing that the value could not be determined.
- `reviewed_conflict`: cleanser, null profile, `unknown` confidence, and at least two conflicting supported values.
- `not_applicable`: non-cleanser, null profile, `unknown` confidence, and no cleanser evidence.

`invalid` is not a persisted state. It is a parser, dry-run, or confirm failure.

Confidence is one of `high`, `medium`, `low`, or `unknown`. It is preserved for audit and does not control ranking, penalties, or activation.

Deferred and blocked product-review rows do not persist a metadata review envelope. Their v2 metadata values must be empty.

## 6. Field evidence binding

Cleanser field evidence is carried inside the existing `field_evidence_json.cleansing_profile` object as an array of exact records. `cleansing_profile_evidence_refs_json` contains UUID references to those records.

Each evidence record contains:

```text
evidence_id
candidate_id
field = cleansing_profile
supported_value
evidence_type
source_reference
evidence schema version
evidence_digest
```

The digest is SHA-256 over canonical JSON excluding the digest field. Every source reference must be a safe HTTPS URL already present in `review_source_urls_json`.

Validation rejects duplicate evidence IDs, foreign candidate evidence, cross-field evidence, digest mismatch, value mismatch, missing evidence, stale candidate or product identity, unexpected keys, invalid UTF-8, NUL bytes, oversized files/cells/lines, and manifest or candidate-count mismatch.

## 7. Reviewer identity and authority

Reviewer identity is never accepted from CSV, JSONL, or client fields. The HTTP adapter derives the actor from the authenticated Admin session, requires `admin.products.review`, and passes only that server-derived UUID to the security-definer RPC.

The routes preserve the v1 boundaries:

- same-origin mutation policy
- authenticated active Admin
- required capability
- Node runtime
- no-store response policy
- bounded multipart and file sizes
- safe public error projection
- no browser service-role key

Actor, request, contract/schema/policy versions, candidate/product identity, review state, profile, confidence, evidence digest, canonical payload digest, result, and timestamp are stored in the Admin audit trail. Reviewer identity is not exposed by the completeness view or public product serializer.

## 8. Durable storage

The product value remains `public.products.cleansing_profile`. No duplicate profile column is introduced.

`public.product_metadata_field_reviews` stores the versioned review envelope:

- field value and state
- confidence
- evidence refs and records
- evidence digest
- Admin contract, metadata schema, review policy, and evidence schema versions
- candidate and product identity
- export batch, request, canonical payload digest
- server-derived reviewer and timestamps

Direct browser access is revoked. Service role receives read-only access for preflight; writes occur only through the v2 confirm RPC.

`product_metadata_review_completeness_v1` derives:

```text
category = cleanser
AND review_state = reviewed_valid
AND cleansing_profile is valid
AND evidence/version bindings are valid
```

The view describes metadata review completeness only. It does not approve ranking or activate recommendation behavior.

## 9. Dry-run and canonical preflight

Dry-run executes the unchanged v1 product intake preflight and an additional v2 metadata validation layer. It performs zero product, review-envelope, and audit writes.

The dry-run response is bounded and contains:

- reviewed file digest
- canonical confirm payload digest
- create / merge / defer / block counts
- valid / unknown / conflict / not-applicable counts
- metadata review-complete count
- bounded row errors
- target product and existing review pre-state bindings used only in the canonical confirm payload

Any file change invalidates both the reviewed-file digest and canonical payload digest.

## 10. Atomic confirm

`admin_confirm_product_review_import_v2_batch` is one database transaction.

It:

1. validates actor and capability;
2. validates exact top-level and row keys and all four version dimensions;
3. verifies canonical payload and embedded v1 payload hashes;
4. verifies candidate/evidence sets and field-level evidence digests;
5. takes request and batch advisory locks;
6. returns an exact prior result for identical retries;
7. rejects request-ID payload conflict and batch reuse;
8. locks and revalidates candidate, review queue, target product, and existing metadata review pre-state;
9. invokes the existing v1 atomic promotion contract;
10. writes `products.cleansing_profile` and the review envelope;
11. writes actor-bound audit events;
12. stores the v2 idempotency result.

Create and merge use the v1 product identity and promotion path. If any metadata or audit step fails after v1 promotion begins, PostgreSQL rolls the entire function call back, including the delegated v1 writes.

## 11. Existing 26 cleanser products

No existing product is backfilled or promoted to `reviewed_valid`. Existing profile values without a row in `product_metadata_field_reviews` remain legacy values with review metadata absent. No evidence, reviewer, confidence, or policy version is invented.

A separate catalog re-review is required before those products can enter a reviewed structured-authority cohort.

## 12. Relationship to recommendation policy #167

This Admin contract owns only:

- value
- review state
- evidence
- confidence
- versions
- reviewer audit
- metadata review completeness

It does not modify or activate `isDeepCleanser`, hard penalties, `-18`, scores, candidate order, Top Pick, Top 3, CandidateExposurePolicy, Premium persistence, or saved-report reentry.

The future recommendation policy may consume a reviewed `deep_clean` as structured positive authority. `low_ph` and `balanced` are not negative authority. Null, absent, conflict, and invalid states remain outside reviewed structured authority. Activation and penalty recalibration remain separate work.

## 13. Security and rollback

Negative controls cover actor/reviewer spoofing, foreign or cross-field evidence, stale digest/preflight, unknown versions, invalid profile/state combinations, v2-to-v1 fallback, extra/duplicate headers, browser RPC access, and direct metadata-table writes.

Rollback is code rollback plus migration rollback before hosted application. No hosted or Production migration is applied by this work. If a future staging rehearsal detects a storage or contract issue, stop v2 traffic first, preserve the audit/idempotency ledgers, and revert only the v2 branch/migration under a reviewed database rollback plan.

## 14. Validation and future dependency

The permanent workflow runs:

- existing v1 regressions
- v2 parser/contract matrix
- TypeScript
- architecture guard
- production build
- exact-head diff/path invariance
- isolated local Supabase with two clean resets
- create, merge, valid, unknown, conflict, not-applicable
- wrong capability, actor spoof, stale target, partial failure rollback
- exact retry, request/batch conflict, audit, and RLS assertions

Completion of this Admin contract does not make the recommendation policy operationally ready. The next decision is catalog re-review versus penalty recalibration. Because the current 26 cleanser records lack review provenance, catalog re-review is the default next dependency.
