# V2.1-ADMISSION-G4-F1-D4 — FATION Category Authority Review Execution

## Decision

`V21_ADMISSION_G4_F1_D4_FATION_CATEGORY_AUTHORITY_REVIEW_ESTABLISHED_PASS`

The bounded FATION Product-level Recommendation category authority has been reviewed and established in Production.

## Execution

Writer:

`admin_register_recommendation_category_authority_review_v1(uuid,text,jsonb)`

Request:

`v21-admission-g4-f1-d4-fation-category-authority-establish-v1`

The reviewer was resolved from Production at execution time as the exactly-one active actor with `admin.products.review`.

The reviewer UUID is not persisted in repository evidence.

The RPC was executed through the `service_role` writer boundary. No direct ledger INSERT was used.

## Writer result

```text
status                           = reviewed
category                         = treatment
review_state                     = established
inserted                         = true
idempotent                       = false
assignment digest                = eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39
product_row_mutated              = false
taxonomy_assignment_mutated      = false
recommendation_admission_mutated = false
production_cutover_authorized    = false
```

## Production poststate

```text
review rows                = 1
current rows               = 1
current established rows   = 1
exact audit events         = 1
products.category          = NULL
taxonomy                   = shadow / shadow_only
Product Fact Subject       = 0
Product Fact Current       = 0
```

The canonical taxonomy assignment digest remains unchanged.

## Protected category reader

The reader was executed under the actual `recommendation_admission_runtime` role with a rollback-only role probe.

Result:

```text
status       = CATEGORY_AUTHORITY_RESOLVED
category     = treatment
contract     = recommendation-category-authority-read-v1
admission    = not mutated
cutover      = not authorized
```

The temporary role-probe grant left zero residue.

## Recommendation boundary

The production G3 admission runtime and its existing authority reader still contain **no reference** to:

`read_recommendation_category_authority_v1`

Therefore D4 establishes only Product-level category authority.

It does not admit FATION into Recommendation.

## Unchanged authority surfaces

- `products.category`
- canonical taxonomy assignment
- global taxonomy lifecycle/authority
- Product Fact
- G3 runtime wiring
- Recommendation admission

## Next gate

`V2.1-ADMISSION-G4-F2_CATEGORY_AUTHORITY_SHADOW_DUAL_READ`

F2 may consume the new category authority only in shadow/dual-read form while the existing G3 production decision remains unchanged.
