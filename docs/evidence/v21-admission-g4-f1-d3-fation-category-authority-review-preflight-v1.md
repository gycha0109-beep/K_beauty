# V2.1-ADMISSION-G4-F1-D3 — FATION Category Authority Review Preflight

## Decision

`V21_ADMISSION_G4_F1_D3_FATION_CATEGORY_AUTHORITY_REVIEW_PREFLIGHT_PASS`

D3 is read-only. It prepares the exact reviewed category-authority request but does **not** create the reviewed grant.

## Reviewer gate

Production currently has:

```text
active admin memberships       = 1
eligible admin.products.review = 1
eligible role                  = admin_owner
```

The reviewer UUID is deliberately **not** committed to the repository.

D4 must resolve the eligible actor again from Production and stop unless the cardinality is exactly one.

## FATION binding

```text
product_id                 = da5df70c-8cdd-4eb2-93b6-ede46c2f171d
products.category          = NULL
taxonomy_version           = catalog-taxonomy-v1
entity_kind                = cosmetic
domain                     = skincare
recommendation_family      = treatment
category                   = treatment
assignment_state           = shadow
assignment_method          = source_classification
legacy_projection_key      = NULL
candidate_id               = 6a9627b6-a5da-458f-84f7-3a40f91453be
source_rule_key            = catalog-taxonomy-v1:source:hwahae:treatment
assignment snapshot digest = eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39
taxonomy lifecycle         = shadow
taxonomy authority         = shadow_only
```

All values still match the deployed writer's bounded FATION contract.

## Current review state

```text
category review rows           = 0
current rows                   = 0
current established rows       = 0
category review audit events   = 0
protected reader               = NO_AUTHORITY
reader reason                  = CURRENT_CATEGORY_REVIEW_MISSING
```

There is no prior authority to supersede.

## Frozen D4 request

Request ID:

`v21-admission-g4-f1-d4-fation-category-authority-establish-v1`

Actor:

`RESOLVE_AT_EXECUTION_DO_NOT_PERSIST`

Payload:

```json
{
  "product_id": "da5df70c-8cdd-4eb2-93b6-ede46c2f171d",
  "expected_category_term_id": "catalog-taxonomy-v1:category:treatment",
  "expected_assignment_snapshot_digest": "eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39",
  "review_state": "established",
  "supersedes_review_id": null
}
```

Execution must use:

`admin_register_recommendation_category_authority_review_v1(uuid,text,jsonb)`

through the service-role writer boundary. Direct ledger INSERT is forbidden.

## Expected D4 result

A successful review write should return:

```text
status                              = reviewed
review_state                        = established
category                            = treatment
inserted                            = true
idempotent                          = false
product_row_mutated                 = false
taxonomy_assignment_mutated         = false
recommendation_admission_mutated    = false
production_cutover_authorized       = false
```

Post-write:

```text
review rows              = 1
current established      = 1
audit event delta        = +1
protected reader         = CATEGORY_AUTHORITY_RESOLVED
reader category          = treatment
```

Even after D4, this is only **Product-level category authority**. It does not mutate or activate Recommendation admission.

## Stop conditions

Stop before calling the writer if any of these change:

- eligible reviewer cardinality != 1;
- any FATION category-authority row already exists;
- unexpected category-authority audit event exists;
- `products.category` becomes non-null;
- taxonomy assignment is missing/ambiguous;
- assignment digest changes;
- candidate/source-rule binding changes;
- taxonomy leaves `shadow/shadow_only`;
- writer ACL changes;
- pre-review protected-reader state changes.

## D3 authority closure

```text
reviewed category grant write = NOT AUTHORIZED
actor UUID persistence        = NOT AUTHORIZED
products.category mutation    = NOT AUTHORIZED
taxonomy mutation             = NOT AUTHORIZED
Product Fact mutation         = NOT AUTHORIZED
G3 runtime wiring             = NOT AUTHORIZED
Recommendation cutover        = NOT AUTHORIZED
```

Next gate:

`V2.1-ADMISSION-G4-F1-D4_FATION_CATEGORY_AUTHORITY_REVIEW_EXECUTION`
