# Admin Product Catalog Review Adoption v1

Status: architecture defined; implementation, Hosted migration, Production writes, Admin activation, and recommendation activation are out of scope.

## 1. Purpose and frozen baseline

This contract defines how an already-existing `public.products` row may adopt a frozen catalog review corpus into the canonical Admin v2 metadata-review envelope without fabricating candidate-import provenance.

Authoritative source corpus:

```text
corpus version: cleanser-catalog-field-review-v1
canonical SHA-256: 9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f
review contract: admin-product-review-v2
metadata schema: cleanser-metadata-v1
review policy: cleanser-metadata-review-policy-v1
```

Frozen corpus result:

```text
reviewed_valid       22
reviewed_unknown      1
reviewed_conflict     3
not_applicable        0

low_ph               10
balanced              0
deep_clean           12
null                  4

high                 20
medium                1
low                   1
unknown               4

eligible_from_current_evidence  22
evidence_upgrade_required        1
schema_mapping_required          3
```

The seven frozen corpus/report/verifier files are immutable inputs to this adoption design. Adoption does not rewrite, normalize, or regenerate them.

The contract boundary is:

```text
existing public.products row
+ frozen catalog corpus
+ explicit authenticated Admin adoption
+ current database pre-state binding
→ canonical product_metadata_field_reviews envelope
```

It is not candidate import or promotion.

## 2. Why import-v2 cannot be reused

`product-review-import-confirm-v2` is intentionally candidate-bound. Its durable contract retains the v1 four-file import bundle, candidate identity, source snapshot, export batch, optimistic-concurrency bindings, and v1 promotion payload. Its confirm RPC validates an `export_batch_id`, binds a nested `product-review-import-confirm-v1` payload, validates candidate/evidence sets, locks candidate/review-queue state, and calls `admin_confirm_product_review_import_batch` before it writes cleanser metadata.

Therefore existing-catalog adoption MUST NOT manufacture any of the following merely to enter that path:

```text
synthetic product_candidate
fake candidate_promotion_review
fake export_batch_id
fake source_snapshot_version
candidate-shaped catalog row
fake approve/create-or-merge result
```

`candidate_id = NULL` alone is insufficient. The current storage and runtime also bind lineage through `export_batch_id`, `product-review-field-evidence-v1`, candidate-bound evidence records, nested v1 payload hashes, candidate/queue stale checks, v1 promotion results, candidate-scoped audit context, and the import-v2 confirmation ledger. Nulling one column would preserve a false operational story.

Decision:

```text
candidate import/promotion != existing catalog review adoption
```

## 3. Contract identity and lineage model

New operational contract:

```text
admin-product-catalog-review-adoption-v1
```

The canonical review semantics remain `admin-product-review-v2`. We do not create a second canonical metadata-review table merely because provenance differs. Instead, `public.product_metadata_field_reviews` is extended with an explicit lineage discriminator and lineage-specific invariants.

Required discriminator:

```text
review_lineage_kind
  candidate_import_v2
  catalog_re_review_v1
```

### 3.1 Candidate lineage

```text
review_lineage_kind = candidate_import_v2
candidate_id         NOT NULL
export_batch_id      NOT NULL
catalog_corpus_version        NULL
catalog_corpus_sha256         NULL
catalog_conflict_mapping_version NULL

evidence_schema_version = product-review-field-evidence-v1
```

All existing v2 rows are backfilled to `candidate_import_v2` during the future migration before the discriminator becomes NOT NULL.

### 3.2 Catalog lineage

```text
review_lineage_kind = catalog_re_review_v1
candidate_id         NULL
export_batch_id      NULL
catalog_corpus_version        NOT NULL
catalog_corpus_sha256         NOT NULL
catalog_conflict_mapping_version nullable only for non-conflict rows

evidence_schema_version = catalog-product-field-evidence-v1
```

The conceptual `catalog_evidence_schema` is represented by the existing canonical `evidence_schema_version` column. A duplicate schema-version column is not added.

Catalog adoption UUIDs MUST NOT be placed into `export_batch_id`. A catalog adoption request is represented by its own request/ledger identity, not by impersonating an export batch.

### 3.3 Canonical table constraints

The future migration should replace candidate-only checks with lineage-aware CHECK constraints. At minimum:

- `review_lineage_kind` is allowlisted and NOT NULL;
- candidate lineage requires candidate/export provenance and forbids catalog corpus provenance;
- catalog lineage forbids candidate/export provenance and requires exact corpus version/digest;
- evidence schema is valid for the selected lineage;
- existing review-state/value/confidence/evidence invariants remain unchanged;
- `reviewed_valid` requires non-null allowed value and evidence;
- `reviewed_unknown` and `reviewed_conflict` require null value, `unknown` confidence, and evidence;
- `not_applicable` semantics remain unchanged and are not used by the current 26-cleanser adoption.

## 4. Catalog evidence schema

New evidence contract:

```text
catalog-product-field-evidence-v1
```

Minimum canonical record:

```text
catalog_evidence_id
product_id
field
supported_value
source_class
admin_v2_evidence_type
source_reference
catalog_corpus_version
catalog_corpus_sha256
evidence_schema_version
evidence_digest
```

Rules:

1. `candidate_id` is forbidden.
2. `field` is exactly `cleansing_profile` for this contract.
3. Existing `cfrv1-xx-yy` identifiers are preserved verbatim as `catalog_evidence_id`.
4. No UUID is invented merely to fit the candidate evidence schema.
5. `evidence_digest` is SHA-256 over canonical JSON excluding the digest field.
6. `catalog_corpus_version` and `catalog_corpus_sha256` must match the frozen corpus exactly.
7. `source_class` preserves offline source taxonomy; `admin_v2_evidence_type` is the approved operational mapping, not a relabeling of provenance.
8. Evidence that is not Admin-v2-ingestion eligible cannot enter an adopted review envelope.
9. `manual_conflict_record` is adjudication evidence only. Its `supported_value` remains null and it never proves a physical product attribute.
10. Safe HTTPS/source-reference rules and bounded evidence sizes remain mandatory.

Catalog evidence refs should use the preserved `catalog_evidence_id` strings. The existing `evidence_refs jsonb` array can store these strings; catalog lineage must not pretend they are candidate UUIDs.

## 5. Research provenance and final Admin authority

Catalog adoption is not an anonymous backfill.

Both dry-run and confirm require an authenticated active Admin with:

```text
admin.products.review
```

The HTTP server derives the actor from the authenticated Admin session. Client input, corpus JSON, and browser fields MUST NOT supply:

```text
reviewer
reviewed_by
actor_user_id
audit actor
```

The Admin who confirms is the **final approving/adopting Admin**. That actor attests that the frozen corpus, current target state, mapping policy, and planned mutations are acceptable for operational adoption. The actor is not represented as the original offline researcher or evidence author.

Invariant:

```text
research provenance != final Admin adoption authority
```

`reviewed_by` on a catalog-lineage review envelope therefore means final operational adoption authority. Research provenance remains in the corpus/evidence records.

## 6. Separate confirmation ledger

`admin_product_review_import_v2_confirmations` is candidate-import lineage and MUST NOT be reused.

New ledger:

```text
public.admin_product_catalog_review_adoptions
```

Minimum columns:

```text
request_id text primary key
actor_user_id uuid not null
adoption_contract_version text not null
catalog_corpus_version text not null
catalog_corpus_sha256 text not null
conflict_mapping_version text not null
canonical_payload_digest text not null
target_prestate_digest text not null
target_product_count integer not null
adopted_product_count integer not null
blocked_product_count integer not null
result jsonb not null
confirmed_at timestamptz not null
```

Recommended uniqueness:

```text
unique (catalog_corpus_version, catalog_corpus_sha256, conflict_mapping_version)
```

This makes one versioned corpus/mapping adoption authoritative once confirmed.

Idempotency policy:

- same `request_id` + same actor + same corpus + same mapping + same canonical payload digest → return exact prior result, with zero additional writes/audit events;
- same `request_id` with any changed actor/corpus/mapping/payload → fail `catalog_adoption_request_id_conflict`;
- different request for an already-confirmed same corpus+mapping → fail `catalog_adoption_corpus_already_confirmed`; do not silently alias a second request to the first;
- same corpus version with a different SHA or same corpus SHA with a different canonical payload is a hard conflict, not a retry.

## 7. Dry-run contract

Routes are separate from import-v2:

```text
POST /api/admin/product-reviews/catalog-adoption/dry-run
POST /api/admin/product-reviews/catalog-adoption/confirm
```

Dry-run input is bounded and identifies only the frozen corpus contract and expected digest. The server reads the corpus from the trusted repository/deployed package boundary; the client does not upload a replacement corpus body.

Required input meaning:

```text
adoption_contract_version = admin-product-catalog-review-adoption-v1
catalog_corpus_version = cleanser-catalog-field-review-v1
expected_catalog_corpus_sha256 = 9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f
conflict_mapping_version = cleanser-catalog-conflict-mapping-v1
```

Dry-run performs **zero Production writes**.

For every one of the 26 corpus products it reads and canonicalizes at least:

```text
product_id
category
brand/name identity
normalized identity
current cleansing_profile
product updated_at (or stronger immutable row snapshot)
existing product_metadata_field_reviews row or null
```

The canonical pre-state binds all 26 products, including Mediheal even though Mediheal is blocked from mutation. This follows the fail-closed batch rule: if any dry-run target changes before confirm, the batch no longer represents the state the Admin reviewed.

Per-product pre-state includes:

```text
product_id
identity digest
category
current cleansing_profile
product updated_at
existing review lineage/digest/updated_at or null
planned adoption classification
planned scalar result
planned review-envelope result
```

`target_prestate_digest` is SHA-256 over the sorted canonical array of all 26 pre-states.

Dry-run output must include at minimum:

```text
corpus digest
total products = 26
adoptable
blocked
reviewed_valid
reviewed_unknown
reviewed_conflict
profile changes
profile nullifications
existing-review replacements
structured-review-complete after adoption
canonical payload digest
target pre-state digest
database writes = 0
```

A corpus digest mismatch, product identity/category mismatch, unsupported evidence mapping, unexpected existing catalog lineage, or malformed review envelope fails closed.

### Existing review replacement rule

Catalog adoption may replace an existing `candidate_import_v2` metadata review only when the exact existing row is disclosed by dry-run, bound into the pre-state digest, counted as an `existing-review replacement`, and the Admin confirms that exact canonical payload. A different existing `catalog_re_review_v1` corpus/mapping is a blocker and requires a future explicit re-review/supersession contract; v1 adoption does not silently overwrite prior catalog adoption.

## 8. Adoption cohort

The frozen corpus has 22 `eligible_from_current_evidence` rows. They are direct catalog-adoption inputs, not automatic writes.

Those 22 consist of:

```text
21 reviewed_valid
1 reviewed_unknown (La Roche-Posay)
```

Mediheal is the one `reviewed_valid` row excluded from v1 adoption because it is `evidence_upgrade_required`.

With conflict mapping Option A approved by `cleanser-catalog-conflict-mapping-v1`, the corpus-level maximum cohort is:

```text
22 direct evidence eligible
+ 3 reviewed_conflict mapping approved
= 25 adoptable

1 Mediheal
= blocked pending evidence upgrade
```

This is a corpus-level maximum. A future Production dry-run can reduce the actual ready-to-confirm cohort if DB identity, category, stale state, or existing-review preconditions fail; it can never increase it beyond 25 under v1.

Crucially:

```text
25 adopted != 25 structured-authority complete
```

Expected completeness after a clean first adoption is exactly:

```text
21 reviewed_valid adopted = complete
1 reviewed_unknown adopted = incomplete
3 reviewed_conflict adopted = incomplete
1 Mediheal blocked = incomplete
```

## 9. Mediheal handling

Mediheal Derma Cream Pack Cleanser Madecassoside remains:

```text
evidence_upgrade_required
```

Dry-run classification:

```text
BLOCKED_FROM_ADOPTION
reason = evidence_upgrade_required
```

Catalog Adoption v1 MUST NOT create or replace a metadata review envelope for Mediheal and MUST NOT change its scalar during this adoption.

It remains:

```text
legacy cleansing_profile preserved
metadata review envelope absent/unchanged
structured_metadata_review_complete = false
```

A later product-specific evidence upgrade and explicit re-review may produce a new eligible single-product or later-corpus adoption. The current frozen corpus is not modified to accomplish that.

## 10. Conflict mapping decision

Decision: **Option A**.

The three `schema_mapping_required` products are adoptable as the existing Admin v2 semantic state:

```text
review_state = reviewed_conflict
field_value = null
confidence = unknown
```

Both independently supported values (`low_ph` and `deep_clean`) remain in catalog evidence. This state means the current single `cleansing_profile` scalar cannot express both independently supported facts; it does not mean one fact is false.

The mapping is explicit and versioned as:

```text
cleanser-catalog-conflict-mapping-v1
```

Option B—defer all conflict review adoption until separate `ph_profile` and `cleansing_strength` axes exist—remains semantically clean but unnecessarily discards legitimate Admin v2 conflict provenance that the current envelope can already represent. Option A is selected because it preserves facts, preserves incompleteness, nulls false scalar authority, and requires no claim that the current enum is sufficient.

No generic automatic conversion from arbitrary multi-axis evidence to `reviewed_conflict` is authorized. Only the three identifiers frozen in the mapping contract are covered by v1.

## 11. Product scalar write semantics

Future confirm semantics:

```text
reviewed_valid
→ products.cleansing_profile = reviewed_profile

reviewed_unknown
→ products.cleansing_profile = null

reviewed_conflict
→ products.cleansing_profile = null

Mediheal blocked
→ no scalar write
```

Leaving a legacy scalar populated for an adopted unknown/conflict row would make the product scalar assert an authority that the canonical review envelope explicitly denies. Nullification is therefore required in the same atomic transaction as the review-envelope write.

No scalar write occurs in this architecture PR.

## 12. Atomic confirm design

Catalog confirm MUST NOT invoke:

```text
admin_confirm_product_review_import_batch
admin_confirm_product_review_import_v2_batch
promote_product_candidate
candidate queue mutation
```

Future RPC:

```text
admin_confirm_product_catalog_review_adoption_v1(...)
```

One PostgreSQL transaction performs:

1. derive/validate actor and `admin.products.review` capability;
2. validate exact contract/corpus/mapping versions and canonical payload digest;
3. take request advisory lock;
4. take corpus+mapping advisory lock;
5. perform idempotency lookup and exact-retry handling;
6. sort all 26 product IDs and lock target `products` rows in deterministic order;
7. lock any existing `product_metadata_field_reviews` rows for those targets;
8. recompute identity/category/scalar/review pre-state for all 26 targets;
9. recompute `target_prestate_digest` and fail if it differs from dry-run;
10. revalidate all evidence digests, corpus bindings, readiness, and conflict mapping;
11. enforce Mediheal blocked/no-write invariant;
12. write/null the 25 adoptable product scalars according to review state;
13. insert/update exactly the 25 catalog-lineage metadata review envelopes;
14. write actor-bound per-product audit events with before/after state;
15. write one batch adoption audit event;
16. insert the adoption ledger result;
17. verify write counts and final scalar/review-envelope values;
18. return bounded result.

Any failure rolls back scalar writes, review envelopes, audit rows, and the adoption ledger together. Partial adoption is forbidden.

The result must not expose raw reviewer UUIDs in ordinary UI/API projection.

## 13. Storage migration design

Preferred design: **one canonical `product_metadata_field_reviews` table with explicit lineage**, not a second catalog-review table.

Why:

- review state/value/confidence/completeness semantics are the same business concept;
- a second table would require conflict resolution whenever candidate and catalog review both exist for the same `(product_id, field_name)`;
- downstream completeness would need cross-table precedence rules;
- audit/provenance differences can be modeled safely with an explicit discriminant and lineage-specific constraints.

Future additive migration sequence:

1. add nullable `review_lineage_kind`;
2. add nullable `catalog_corpus_version`;
3. add nullable `catalog_corpus_sha256`;
4. add nullable `catalog_conflict_mapping_version`;
5. backfill existing rows to `review_lineage_kind='candidate_import_v2'`;
6. drop candidate-only `export_batch_id NOT NULL` and replace it with lineage-aware CHECK constraints;
7. retain `candidate_id` nullable at column level but require it for candidate lineage and forbid it for catalog lineage;
8. expand `evidence_schema_version` allowlist to `product-review-field-evidence-v1 | catalog-product-field-evidence-v1` with lineage matching;
9. replace fixed evidence-schema CHECK with lineage-aware constraints;
10. make `review_lineage_kind` NOT NULL;
11. create `admin_product_catalog_review_adoptions` ledger, RLS/revokes/grants, and future service-role RPC boundaries;
12. create a new completeness projection version after validation.

Existing candidate-import rows and RPC behavior must remain valid throughout this migration.

## 14. Completeness projection

Recommendation: preserve `product_metadata_review_completeness_v1` for backward compatibility and introduce:

```text
product_metadata_review_completeness_v2
```

Reason: v1 currently hard-codes `evidence_schema_version = product-review-field-evidence-v1`. Replacing v1 in place would silently change the meaning of an already-shipped view. A v2 projection can make provenance validation explicit while preserving the same business completeness semantics.

`structured_metadata_review_complete = true` only when:

```text
category = cleanser
review_state = reviewed_valid
field_value in (low_ph, balanced, deep_clean)
review/evidence/schema/policy versions valid
lineage-specific provenance valid
evidence digest valid
```

For candidate lineage, provenance validation requires candidate/export/evidence bindings. For catalog lineage, it requires frozen corpus/evidence-schema bindings and no candidate/export lineage.

Always false for:

```text
reviewed_unknown
reviewed_conflict
not_applicable
evidence_upgrade_required / no envelope
invalid or mismatched lineage
```

Completeness remains metadata-governance status only. It is not recommendation activation authority.

## 15. API/auth boundary and confirmation UX

New routes remain separate; import-v2 does not receive a mode flag.

Both routes preserve:

```text
server-only
Node runtime
force-dynamic / no-store
same-origin mutation policy
authenticated active Admin
admin.products.review
server-derived actor
bounded request/response
safe public error projection
no browser service-role key
```

Confirm additionally requires the exact user-entered confirmation string:

```text
CONFIRM_CATALOG_REVIEW_ADOPTION_V1
```

The phrase is validated by the server-side HTTP adapter before RPC invocation. It is not a substitute for actor/capability checks, payload digest binding, or stale-state protection.

Dry-run UX must surface at least:

```text
corpus digest
total products
adoptable
blocked
reviewed_valid
reviewed_unknown
reviewed_conflict
profile changes
profile nullifications
existing-review replacements
structured complete after adoption
```

Raw reviewer UUIDs are not shown.

## 16. Stale protection and canonical payload

The server-generated confirm payload contains no candidate/export fiction. It includes at least:

```text
schema_version = admin-product-catalog-review-adoption-v1
catalog_corpus_version
catalog_corpus_sha256
conflict_mapping_version
request_id
target_prestate_digest
rows[26]
```

Each row binds identity, current scalar, current review digest/null, adoption classification, and planned result. The canonical payload SHA-256 binds the exact sorted payload.

Confirm fails closed if any one of the 26 product rows or existing review envelopes differs from the dry-run pre-state, even if the changed row is Mediheal and is not planned for mutation.

No client-supplied actor, evidence replacement, profile override, or target list may be accepted.

## 17. Hosted migration and activation sequence

No step below is executed by this design PR.

Required future order:

```text
A. Admin v2 base Hosted migrations
B. Catalog Adoption extension migration
C. schema / constraint / RLS / capability validation
D. application deployment with catalog-adoption routes disabled-by-unavailability until schema checks pass
E. Production read-only Catalog Adoption dry-run
F. coordinator approval of the exact dry-run digest and cohort
G. atomic Catalog Adoption confirm
H. post-write scalar / envelope / ledger / audit / completeness verification
I. recommendation remains inactive
```

If Hosted lacks the Admin v2 base chain, A and B should preferably be applied in the same controlled maintenance window before catalog-adoption routes are made reachable. The extension must be backward compatible with existing candidate-import code so ordinary production traffic between A and B cannot produce catalog-lineage rows or invalidate candidate-import rows.

Risk between A and B:

- after A only, Admin v2 is candidate-lineage-only and cannot legitimately adopt the frozen catalog;
- deploying catalog-adoption application code before B would produce schema/RPC mismatch and must fail closed;
- partial migration visibility is avoided by applying each migration transactionally and withholding route readiness until C passes.

No manual SQL backfill substitutes for the adoption RPC.

## 18. Rollback

### Pre-confirm

Before any real adoption confirm:

- disable/remove the new routes;
- roll back application code;
- evaluate migration rollback only if no catalog-lineage data exists and existing candidate-import invariants can be restored losslessly;
- preserve any existing Admin ledgers/audit records.

### Post-confirm

After catalog adoption has created review/audit lineage, a plain migration-down or DELETE is forbidden.

A future reviewed compensation contract must:

1. reference the original adoption ledger/request;
2. require an authenticated capable Admin;
3. lock the same product/review rows;
4. verify expected current post-adoption state;
5. restore explicitly captured prior scalar/review states where restoration is still valid;
6. append reversal audit events;
7. mark or append rollback status without deleting the original adoption/audit ledger;
8. roll back atomically or not at all.

The original adoption event remains historical fact.

## 19. Recommendation boundary

This contract changes metadata governance only. Even after future implementation and confirmation:

```text
recommendation activation = 0
PR #167 merge/activation = 0
isDeepCleanser unchanged
getHardPenalty unchanged
deep-clean -18 unchanged
CandidatePolicy activation = 0
```

`structured_metadata_review_complete=true` is not an implicit ranking switch. Recommendation consumption requires a separate explicit policy/activation decision.

## 20. Explicit answers to design questions

**Why can import-v2 not be reused?** Because its package, evidence, stale checks, audit, idempotency, and confirm transaction all describe candidate import/promotion and invoke v1 promotion. Reusing it would require fictitious provenance.

**Why is `candidate_id=NULL` insufficient?** Because `export_batch_id`, evidence schema, nested v1 payload, candidate/queue locks, promotion result, and confirmation ledger still encode candidate lineage.

**How are catalog evidence IDs preserved?** Existing `cfrv1-xx-yy` strings are retained as `catalog_evidence_id` and evidence refs; no UUID conversion.

**What does the final adopting Admin mean?** The actor is the final operational approver of the frozen corpus against current DB state, not the offline researcher.

**How are the 22 direct-ready rows handled?** They are eligible inputs requiring explicit Admin confirm: 21 valid plus one unknown.

**Why is Mediheal excluded?** Its frozen positive support lacks a product-specific ingestion-eligible official/manufacturer evidence address; it remains `evidence_upgrade_required` and receives no adoption write.

**Can the three conflicts be adopted?** Yes, only under `cleanser-catalog-conflict-mapping-v1`, as `reviewed_conflict / null / unknown` with both supported physical values preserved in evidence.

**Are legacy scalars cleared for unknown/conflict?** Yes. Once a review envelope says no single authoritative scalar exists, leaving the legacy scalar populated would contradict it.

**One review table or two?** One canonical table with explicit lineage constraints. A second table creates competing canonical-review sources.

**What is the idempotency key?** `request_id` is the retry key; corpus version+SHA+mapping version is separately unique so a confirmed corpus mapping cannot be re-adopted under a different request.

**How are stale products blocked?** Dry-run hashes all 26 product identities/categories/scalars/updated-at/existing-review prestates; confirm locks and recomputes them before any write.

**How are partial writes prevented?** One security-definer PostgreSQL transaction performs all 25 mutations, audits, and ledger insertion; any failure rolls back the entire call.

**What is the Hosted order?** Base Admin migrations → adoption extension → schema/security validation → application readiness → read-only dry-run → coordinator approval → atomic confirm → post-write verification; recommendation remains inactive.

**How is post-confirm rollback handled?** By a separate actor-bound compensating transaction with before-state restoration and append-only reversal audit, never by deleting lineage.

## 21. Current architecture state

This document defines architecture only.

```text
CATALOG_ADOPTION_V1_ARCHITECTURE_DEFINED
NO_FAKE_CANDIDATE_LINEAGE
NO_FAKE_REVIEWER_LINEAGE
CATALOG_CONFLICT_MAPPING_DECISION_DEFINED
HOSTED_MIGRATION_SEQUENCE_DEFINED
READY_FOR_CATALOG_ADOPTION_IMPLEMENTATION_REVIEW
```

It does not declare:

```text
CATALOG_ADOPTION_IMPLEMENTED
HOSTED_MIGRATION_APPLIED
ADMIN_V2_HOSTED_ACTIVE
CATALOG_ADOPTION_CONFIRMED
RECOMMENDATION_ACTIVATED
```
