# V2.1-ADMISSION-G4-F0 — Recommendation Category Authority Shadow Contract

## Decision

`V21_ADMISSION_G4_F0_CATEGORY_AUTHORITY_SHADOW_CONTRACT_READY`

This is a repository-only shadow contract.

No database migration, reviewed grant write, Recommendation admission change, or taxonomy activation is performed.

## Why this lane proceeds now

FATION's Product Fact Subject lane is blocked by unresolved formulation authority.

Recommendation category authority is a separate Product-level concern.

Therefore the category lane can be specified in parallel without inventing a Product Fact Subject or crossing G3 admission.

## Frozen FATION taxonomy lineage

```text
product_id                 = da5df70c-8cdd-4eb2-93b6-ede46c2f171d
products.category          = NULL
taxonomy_version           = catalog-taxonomy-v1
assignment_state           = shadow
assignment_method          = source_classification
category_term              = catalog-taxonomy-v1:category:treatment
recommendation_family      = catalog-taxonomy-v1:recommendation_family:treatment
legacy_projection_key      = NULL
taxonomy lifecycle         = shadow
taxonomy authority         = shadow_only
candidate_id               = 6a9627b6-a5da-458f-84f7-3a40f91453be
source_rule_key            = catalog-taxonomy-v1:source:hwahae:treatment
assignment snapshot digest = eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39
```

The existing exact-equivalence projection remains non-legacy:

```text
projection_present = false
category_equivalent = null
exact_equivalent = false
```

## Authority model

The category grant is **Product-level**.

It must not depend on Product Fact Subject identity.

A valid grant binds to the exact existing taxonomy assignment using:

- product ID
- taxonomy version
- category term
- assignment snapshot digest
- candidate ID
- source-rule key
- review-policy version
- current established review state

The grant does not mutate:

- `products.category`
- the taxonomy assignment
- taxonomy lifecycle
- taxonomy global authority mode
- Product Fact
- Recommendation admission

## Fail-closed rules

Shadow authority becomes unavailable when any of these drift:

- assignment digest
- candidate
- source rule
- taxonomy version
- assignment state/method
- legacy projection state
- taxonomy lifecycle/authority mode
- supported initial-admission category
- grant current/established status

G4-F0 limits this bridge to the G2 initial-admission category set:

- treatment
- toner_essence
- toner_pad

This does not itself grant G2 admission.

## Security boundary

Future DB transport should reuse the existing narrow Recommendation admission runtime boundary:

`recommendation_admission_runtime`

The runtime must continue to have no raw taxonomy table SELECT.

A future protected reader should be SECURITY DEFINER, product-scoped, owned by a narrow NOLOGIN reader owner, and executable only by the runtime role.

No such DB reader is created in F0.

## Runtime boundary

Current G3 continues unchanged.

Even a valid F0 shadow grant produces only:

`CATEGORY_AUTHORITY_SHADOW_RESOLVED`

with:

```text
recommendationAdmissionMutated = false
productionCutoverAuthorized = false
```

## Next gate

`V2.1-ADMISSION-G4-F1_CATEGORY_AUTHORITY_LEDGER_AND_PROTECTED_READER`

F1 requires separate authorization because it introduces database authority infrastructure.
