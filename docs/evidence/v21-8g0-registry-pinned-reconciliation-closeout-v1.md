# V2.1-8G0 — Registry-Pinned Catalog Trust Reconciliation

## Purpose

This gate repairs the catalog-trust orchestration boundary before Wave 1 Subject identity research begins.

The historical `process_catalog_trust_product_v1(product_id)` automatically selects the latest Product Fact Registry. That is unsafe for the frozen Wave 1 batch because its 26 required research tasks already belong to `product-fact-registry-cross-category-v1`, while the equivalent v2 Fact write policies are currently absent.

V2.1-8G0 therefore adds an explicit-registry processor and a controlled intake identity authority RPC without creating Subjects, Evidence, Current Product Facts, recommendation activation, or public activation.

## Frozen prestate

- Catalog products: **175**
- Adopted products: **32**
- Current Product Facts: **95**
- Selected Wave 1 products: **12**
- Selected Product Fact Subjects: **0**
- Selected catalog-trust intakes with `market IS NULL`: **12**
- Selected required research tasks: **26**
- Selected v2 required research tasks: **0**
- All 26 selected tasks:
  - Registry: `product-fact-registry-cross-category-v1`
  - state: `REVIEW_REQUIRED`
  - blocker: `SUBJECT_CREATION_REQUIRED`
  - attempt_count: `0`
  - subject_id: `NULL`

The eight required Fact keys are:

`barrier_support_claim`, `contains_active`, `deep_cleansing`, `low_ph`, `pad_surface_texture`, `primary_use_role`, `product_format`, and `wipe_off_use`.

For all eight:

- v1 existing lineage: **ALLOWED**
- v1 new lineage: **ALLOWED**
- v2 existing lineage: **POLICY_MISSING**
- v2 new lineage: **POLICY_MISSING**
- v1/v2 definition checksum equality: **0/8**

## New controlled boundaries

### `process_catalog_trust_product_v2(product_id, registry_version)`

The Registry version is mandatory and validated against `product_fact_registry_versions`.

Before the Subject resolver or any research task mutation runs, the function preflights every required Fact for every intake:

1. required Fact policy exists,
2. exact Registry definition exists and matches category scope,
3. operation lineage is classified as `existing` or `new`,
4. `product_fact_controlled_registry_write_admissibility_v2` returns `allowed=true`.

Any missing/blocked policy aborts the full call before resolver/task mutation.

After Subject resolution, the exact task lineage is checked again before update/delete/insert reconciliation.

No "latest Registry" lookup remains in v2.

### `admin_resolve_catalog_trust_intake_identity_v1`

Service-role/admin-reviewed controlled RPC for the future V2.1-8G1 identity stage.

It accepts a concurrency-bound intake prestate plus:

- exact market,
- identity resolution version,
- official HTTPS source locator,
- SHA-256 source content digest,
- resolution reason.

It only updates catalog-trust intake identity authority and audit state. It does **not** create Product Fact Subjects or Facts.

## Production deployment

Migration:

`v21_8g0_registry_pinned_reconciliation_v1`

Production migration version:

`20261002142611`

Initial exact-head CI before deployment passed:

- Canonical Static Contract
- Current Main Health
- Supply Chain Security
- PIE Prospective Shadow
- Database Integration Authority
- Security Boundary

## Runtime probes

### v2 fail-closed probe

A selected cleanser Product was invoked with:

`product-fact-registry-cross-category-v2`

Expected result occurred: the call was rejected by the Registry write-policy preflight with `catalog_trust_registry_write_policy_blocked`.

The rejection happened before resolver/task mutation.

### v1 explicit lineage probe

The same Product was invoked with:

`product-fact-registry-cross-category-v1`

The explicit path executed and returned the pinned v1 Registry contract. The probe intentionally raised inside a PL/pgSQL exception subtransaction after success, rolling all probe mutations back.

## Production readback

After migration and rollback probes:

| Check | Result |
|---|---:|
| Current Product Facts | **95** |
| Selected Subjects | **0** |
| Selected null-market intakes | **12** |
| Selected v1 tasks | **26** |
| Selected v2 tasks | **0** |
| Selected pristine tasks | **26** |
| Frozen exact task IDs matched | **26/26** |
| Frozen task rows unchanged | **26/26** |

Deployed function inspection:

- v2 processor exists: **PASS**
- intake identity RPC exists: **PASS**
- automatic latest-Registry selection absent: **PASS**
- Registry write-policy gate present: **PASS**
- full product preflight before resolver: **PASS**
- official-source identity authority fields present: **PASS**

Privileges:

- service_role execute: **enabled**
- anon execute: **disabled**
- authenticated execute: **disabled**

for both new RPCs.

## Write boundary

```text
Product Fact Current delta = 0
Selected Subject delta     = 0
Selected v1 task delta     = 0
Selected v2 task delta     = 0
Selected task-state delta  = 0
Evidence writes            = 0
Recommendation changes     = 0
publicActivation           = false
```

## Decision

`V21_8G0_PRODUCTION_MIGRATION_READBACK_PASS`

Next gate:

`V2.1-8G1_SELECTED_12_SUBJECT_IDENTITY`

8G1 has not started in this closeout.
