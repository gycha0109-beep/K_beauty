# DATA-TAXONOMY2 — candidate/manual catalog taxonomy classification v1

## Decision

DATA-TAXONOMY2 extends `catalog-taxonomy-v1` only as a **shadow candidate classification plane**.

It does not replace or weaken any current authority:

```text
product_candidates.service_category / product_form
→ promote_product_candidate(...)
→ products.category / products.product_form
→ existing Recommendation admission/runtime
```

The legacy path above remains the Product-promotion and Recommendation authority. The new classification is sidecar metadata only.

## Fresh baseline

Repository baseline:

```text
main = d0fcf6e36984053a621df74aa1a63e46e0581dea
DATA-TAXONOMY1 = merged
catalog taxonomy version = catalog-taxonomy-v1
catalog taxonomy lifecycle = shadow
catalog taxonomy authority_mode = shadow_only
```

Fresh read-only Production observations before applying this migration:

```text
Production Product count: `165`
Production Product shadow assignments: `165`
Production candidate count: `190`

Hwahae `cleanser`: `25`
Hwahae `sunscreen`: `37`
Hwahae `toner_essence`: `26`
Hwahae `treatment`: `102`

candidate service_category/product_form:
- null / null: 189
- sunscreen / null: 1

Production full-row Product digest MD5: `c7ec481493af9075f891d4a089b53302`

Protected function definition MD5 baselines:
- map_product_category(text): `364282a34496ed047c74bf7d354d443f`
- promote_product_candidate(uuid,text): `88096291b54e626615dc81ce679baa79`
- admin_enqueue_product_candidate_structural_review_v1(...): `6363c54ab4cfc2a4662ec489218fd843`
- admin_confirm_product_review_import_batch(...): `f228d90b5dcd85e3a7dbf7163d60fa46`
```

Production migration applied: `false`

No Production DDL/DML is claimed by this evidence file.

## Current promotion gap discovered

The governed candidate approval/promotion contract currently permits legacy candidate combinations that DATA-TAXONOMY1 did not need for its current-Product backfill:

```text
moisturizer / null
treatment / booster
treatment / peeling_solution
```

DATA-TAXONOMY1 had 11 active legacy projections because those were sufficient for the 165 current Products. Without a shadow bridge for the three combinations above, a future candidate that is valid under the existing promotion contract could become a Product while lacking an exact taxonomy projection.

DATA-TAXONOMY2 therefore adds exactly three shadow legacy projections. This does **not** add a new legacy enum value and does not change what `promote_product_candidate` accepts.

## Candidate classification model

Two classification sources are deliberately distinct.

### 1. Exact raw-source classification

New candidates with no governed legacy review classification use exact source rules:

```text
source_name + category_path
→ exact catalog_taxonomy_candidate_source_rules row
→ registry term IDs
→ product_candidate_catalog_taxonomy_classifications
```

Current governed source rules are intentionally narrow:

| Source | Raw category | Family | Category | Form |
| --- | --- | --- | --- | --- |
| hwahae | cleanser | cleanser | cleanser | null |
| hwahae | sunscreen | sunscreen | sunscreen | null |
| hwahae | toner_essence | toner | toner | null |
| hwahae | treatment | treatment | treatment | null |

`toner_essence` does **not** manufacture an `essence` form fact.

`treatment` does **not** manufacture serum/ampoule/essence/booster/peeling form identity. Form remains null until a separate governed review classification exists.

### 2. Governed manual legacy projection

Once a candidate already has `service_category` / `product_form` from the existing governed review path, candidate shadow classification prefers an exact `catalog_taxonomy_legacy_projections` row:

```text
candidate.service_category + candidate.product_form
→ exact legacy projection
→ registry term IDs
```

There is no fallback from a missing manual legacy projection back to raw source classification. A missing exact projection becomes `unresolved`.

That rule prevents a reviewer-selected category/form from being silently replaced by weaker source-path inference.

## Fail-closed states

Candidate classification states are:

```text
active_shadow
reserved_shadow
blocked_deprecated
unresolved
```

Rules:

- all referenced registry terms active → `active_shadow`
- one or more referenced terms reserved → `reserved_shadow`
- one or more referenced terms deprecated → `blocked_deprecated`
- unknown/unmapped raw category, missing exact manual projection, invalid version, or invalid registry term contract → `unresolved`

An unknown/unmapped raw category is never coerced to toner, treatment, moisturizer, or another nearby category.

Reserved future vocabulary is representable by the same registry-bound rule structure, but `reserved_shadow` is explicitly non-admissible.

## Authority firewall

Every candidate classification row permanently carries:

```text
product_write_allowed = false
product_promotion_allowed = false
recommendation_admission_allowed = false
```

The table also enforces those values with a CHECK constraint.

Recommendation runtime cutover: `false`

The migration does not create or replace:

```text
public.map_product_category(text)
public.promote_product_candidate(uuid,text)
public.admin_confirm_product_candidate_review(...)
public.admin_confirm_product_review_import_batch(...)
```

It does not mutate `public.products`, Product Fact tables, Product Offers, recommendation scoring, or ranking inputs.

## Continuous shadow synchronization

The classification sidecar refreshes only after candidate fields that can change taxonomy interpretation change:

```text
source_name
category_path
service_category
product_form
```

The trigger writes only `product_candidate_catalog_taxonomy_classifications`.

Existing candidates are backfilled once. Unknown categories remain as explicit `unresolved` rows rather than blocking ingestion or being coerced.

## Security boundary

Both new tables:

```text
catalog_taxonomy_candidate_source_rules
product_candidate_catalog_taxonomy_classifications
```

have RLS enabled.

Privileges:

```text
anon          = none
authenticated = none
service_role  = SELECT only on tables
```

Classification mutation is available only through a SECURITY DEFINER refresh function granted to `service_role`. The internal trigger helper is not executable by application roles.

No browser/client role gains direct taxonomy read or write authority.

## Production boundary

This repository change includes a migration because candidate taxonomy persistence is a DB concern. Repository rules classify DB schema/RLS and Production as protected surfaces.

Therefore this artifact intentionally records:

```text
Production migration applied: `false`
```

The migration must not be applied to Production without explicit Production DB authorization after exact-head CI and fresh-main review.

## Acceptance disposition

```text
candidate raw category → shadow registry classification = IMPLEMENTED IN MIGRATION
current four Production raw categories → exact active rules = IMPLEMENTED IN MIGRATION
manual reviewed legacy category/form → exact legacy projection = IMPLEMENTED IN MIGRATION
unknown/unmapped raw category → unresolved fail-closed = IMPLEMENTED IN MIGRATION
reserved registry term → reserved_shadow, non-admissible = IMPLEMENTED IN MIGRATION
Product writes from taxonomy classification = 0
Recommendation semantic writes = 0
legacy promotion authority remains unchanged
Recommendation runtime cutover = false
Production migration applied = false
```

The next authority gate after Production application/readback is a separate exact-equivalence decision before any Recommendation runtime consumer may read this shadow taxonomy.
