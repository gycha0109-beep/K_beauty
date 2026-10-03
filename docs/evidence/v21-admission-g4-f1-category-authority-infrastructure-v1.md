# V2.1-ADMISSION-G4-F1 — Category Authority Infrastructure

## Decision

`V21_ADMISSION_G4_F1_REPOSITORY_IMPLEMENTATION_READY`

F1 implements the reviewed category-authority ledger and protected reader in a migration, but **does not apply that migration to Production**.

## Implemented objects

- `public.recommendation_category_authority_reviews`
- `admin_register_recommendation_category_authority_review_v1(uuid,text,jsonb)`
- `read_recommendation_category_authority_v1(uuid)`

Initial Product scope is exactly:

`da5df70c-8cdd-4eb2-93b6-ede46c2f171d`

## Writer

The Admin writer is `SECURITY DEFINER`, gated by:

`admin_require_product_review_actor(actor, 'admin.products.review')`

It recomputes the current taxonomy assignment snapshot server-side and requires the frozen optimistic-lock digest:

`eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39`

Establishment fails closed on Product/category/taxonomy/candidate/source-rule drift.

Revocation remains possible even after taxonomy drift by superseding the exact current established review.

## Reader

The protected reader is owned by:

`recommendation_admission_reader_owner`

and executable only by:

`recommendation_admission_runtime`

The runtime retains no raw SELECT on the new ledger, taxonomy assignments, or taxonomy versions.

The reader is Product-level and has no Product Fact Subject dependency.

## Existing D5C boundary

The existing three-product D5C taxonomy RLS policy is preserved unchanged.

F1 adds a separate FATION-only permissive policy. It does not replace the old policy with a broad predicate.

## Migration output

The migration creates **zero category review rows**.

It performs no:

- Product category backfill
- taxonomy assignment mutation
- global taxonomy activation
- Product Fact mutation
- Recommendation admission mutation
- G3 runtime wiring

## Deployment boundary

Repository implementation is ready, but:

```text
Production migration apply = NOT AUTHORIZED
reviewed grant write        = NOT AUTHORIZED
G3 runtime wiring           = NOT AUTHORIZED
Recommendation cutover      = NOT AUTHORIZED
```

Next gate:

`V2.1-ADMISSION-G4-F1-D1_PRODUCTION_MIGRATION_PREFLIGHT`
