# V2.1-ADMISSION-G4-F1-P0 — Category Authority Ledger / Protected Reader Preflight

## Decision

`V21_ADMISSION_G4_F1_P0_LEDGER_READER_PREFLIGHT_READY`

This stage freezes the database contract **without creating the database objects**.

No migration is added or applied in P0.

## Why P0 exists

G4-F0 proved the pure Product-level shadow authority contract.

F1 is the first step that would create durable authority infrastructure:

- a reviewed category-authority ledger;
- an Admin writer;
- a protected Recommendation runtime reader;
- additional narrow taxonomy read privileges for the existing reader-owner.

That is a material governance boundary, so schema and ACL details are frozen before implementation.

## Existing security boundary

The existing Recommendation admission runtime is preserved:

```text
recommendation_admission_runtime
  LOGIN
  NOINHERIT
  BYPASSRLS = false
  raw Product Fact SELECT = denied
```

Protected reader owner:

```text
recommendation_admission_reader_owner
  NOLOGIN
  NOINHERIT
  BYPASSRLS = false
```

The existing Product Fact reader remains:

`read_recommendation_admission_authority_v1(uuid)`

owned by the reader-owner and executable only by the runtime role.

## Existing taxonomy policy must not be widened

DATA-AI29C-D5C already grants the same reader-owner access to taxonomy assignment rows for exactly three bounded sunscreen canary products.

F1 must **not** replace that policy with `USING (true)`.

Instead:

- keep the D5C policy unchanged;
- add a second permissive SELECT policy for exactly the FATION product ID.

This preserves the existing three-product boundary while adding one reviewed frontier.

## Proposed ledger

Table:

`public.recommendation_category_authority_reviews`

The table is reusable, but F1 writer and reader are initially allowlisted to:

`da5df70c-8cdd-4eb2-93b6-ede46c2f171d`

The ledger freezes the exact taxonomy assignment used by the human review:

- Product
- taxonomy version
- entity/domain/family/category terms
- assignment state/method
- legacy projection snapshot
- source snapshot
- assignment snapshot digest
- candidate ID
- source rule
- review policy
- current/supersession lineage
- reviewer/time
- request/payload digest

Exactly one current review row per Product is allowed.

RLS is mandatory.

Direct access is revoked from:

- public
- anon
- authenticated
- service_role
- recommendation_admission_runtime

Only the reader-owner receives bounded SELECT access.

## Admin writer

Proposed RPC:

`admin_register_recommendation_category_authority_review_v1(uuid,text,jsonb)`

Execution:

```text
service_role only
```

The function must call:

`admin_require_product_review_actor(actor, 'admin.products.review')`

For an `established` review the writer must recompute the taxonomy assignment snapshot from Production and reject any client-supplied mismatch.

It must prove:

```text
products.category = NULL
taxonomy_version = catalog-taxonomy-v1
assignment_state = shadow
assignment_method = source_classification
entity_kind = cosmetic
domain = skincare
recommendation_family = treatment
category = treatment
legacy_projection_key = NULL
candidate = 6a9627b6-a5da-458f-84f7-3a40f91453be
source_rule = catalog-taxonomy-v1:source:hwahae:treatment
taxonomy lifecycle = shadow
taxonomy authority = shadow_only
snapshot digest = eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39
```

The supplied digest is never trusted as authority; it is only an optimistic-lock expectation.

### Revocation

Revocation must remain possible even after taxonomy drift.

Therefore a `revoked` row requires the exact current review as `supersedes_review_id`, but does not require the taxonomy assignment to remain valid.

## Protected reader

Proposed RPC:

`read_recommendation_category_authority_v1(uuid)`

Contract:

`recommendation-category-authority-read-v1`

Owner:

`recommendation_admission_reader_owner`

Execute:

`recommendation_admission_runtime only`

Initial scope:

FATION only.

It reads no Product Fact Subject and creates no Product Fact dependency.

A resolved result may expose only the bounded authority needed by G3:

- Product ID
- category = treatment
- taxonomy version
- exact taxonomy binding
- current review ID
- assignment snapshot digest

It never returns reviewer identity, source body, admin metadata, or mutation capability.

## ACL additions

### product_catalog_taxonomy_assignments

Keep existing D5C policy.

Add column SELECT to reader-owner only for fields additionally required by the category reader:

- assignment_method
- legacy_projection_key
- source_snapshot

Add one new FATION-only RLS SELECT policy.

### catalog_taxonomy_versions

Grant reader-owner only:

- version
- lifecycle_state
- authority_mode

RLS policy:

`version = 'catalog-taxonomy-v1'`

### ledger

Reader-owner receives only the columns required by the protected reader and only for the FATION row through RLS.

Runtime receives no raw table SELECT.

## Fail-closed behavior

The reader returns no authority on:

- missing or ambiguous review
- revoked current review
- non-target Product
- legacy category appearance
- taxonomy assignment drift
- taxonomy lifecycle/authority drift
- unsupported category
- digest/source-snapshot mismatch
- candidate/source-rule mismatch

## P0 authority closure

```text
database migration        = NOT AUTHORIZED
ledger creation           = NOT AUTHORIZED
writer deployment         = NOT AUTHORIZED
protected reader deploy   = NOT AUTHORIZED
reviewed grant write      = NOT AUTHORIZED
G3 runtime wiring         = NOT AUTHORIZED
Recommendation cutover    = NOT AUTHORIZED
```

Next gate:

`V2.1-ADMISSION-G4-F1_CATEGORY_AUTHORITY_LEDGER_AND_PROTECTED_READER_IMPLEMENTATION`
