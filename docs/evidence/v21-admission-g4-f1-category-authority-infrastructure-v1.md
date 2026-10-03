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

D1 preflight found that adding a second permissive SELECT policy for the same reader role/action would create a Supabase `multiple_permissive_policies` warning.

The implementation therefore preserves the exact existing D5C three-product scope and extends that same bounded policy to one additional Product: FATION.

The resulting single policy contains exactly four Product IDs:

- the existing three D5C sunscreen canaries;
- FATION `da5df70c-8cdd-4eb2-93b6-ede46c2f171d`.

It is **not** widened to `USING (true)`, a category-wide predicate, or any dynamic catalog predicate.

## Migration output

The migration creates **zero category review rows**.

All ledger foreign keys are indexed for deployment hygiene: Product, Candidate, superseded review, and reviewer.

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
