# Product Decision Axis Cross-category v1

> V2.1-6 offline acceptance and small-sample extension. No Hosted Product Fact writes, catalog adoption, recommendation consumption, or activation.

## Scope

- sunscreen → photo_protection
- treatment → exfoliation_load
- moisturizer family → barrier_support
- toner/pad family → exfoliation_load
- three shared axes cover four domains; Fact growth does not automatically create axis growth.

## Resolver extension

- preserves cardinality-many Current propositions instead of selecting one Fact by fact_key.
- preserves market/region/locale/validity plus Subject variant/formulation scope.
- ambiguous Subject identity is blocked from Current-like projection.
- missing/source-blocked facts remain missing/not-established context, never false.

## Frozen output

- products: 12
- category families: 4
- distinct cross-category axes: 3
- axis outputs: 12
- numeric estimates: 0
- null estimates: 12
- identity-blocked products: 1
- raw signal Fact references: 11
- deduped signal-family contribution units: 8

## Lifecycle

```text
V21_6_ACCEPTANCE_CROSS_CATEGORY_OFFLINE_VERIFIED = YES
PRODUCT_DECISION_AXIS_CROSS_CATEGORY_PRODUCTION_CALIBRATED = NO
PRODUCT_FACT_CATALOG_ADOPTED = NO
CATALOG_ADOPTED = NO
DECISION_AXIS_CONSUMPTION = NO
RECOMMENDATION_ACTIVATED = NO
HOSTED_PRODUCT_FACT_WRITES = 0
```
