# DATA-TAXONOMY3 — Product taxonomy exact-equivalence gate v1

## Decision

DATA-TAXONOMY3 proves exact equivalence between current legacy Product classification and the `catalog-taxonomy-v1` shadow assignment plane before any Recommendation runtime cutover.

Runtime authority remains unchanged:

```text
products.category / products.product_form = current Recommendation authority
catalog-taxonomy-v1 = shadow_only
Recommendation runtime cutover = false
```

## Fresh baseline

Repository main at issue creation:

```text
82506c0bd0256a26eebccf9c6fe82a63f980fe8d
```

Production readback:

```text
Products = 165
Product taxonomy assignments = 165
candidate taxonomy classifications = 190
active legacy projections = 14
resolver/refresh/sync trigger = present
Product Fact Current = 58
```

Direct Product → assignment → active legacy projection comparison:

```text
joined rows = 165
category mismatch = 0
form mismatch = 0
```

## Gate

This track must remain read-only with respect to Product, Recommendation, Product Fact, and Offer authority.

Acceptance requires:

```text
Products = assignments = equivalent rows
missing assignment = 0
missing projection = 0
category mismatch = 0
form mismatch = 0
non-active assigned term = 0
catalog taxonomy lifecycle = shadow
catalog taxonomy authority_mode = shadow_only
Recommendation runtime cutover = false
```

A later DATA-TAXONOMY4 may evaluate Recommendation shadow parity only after this gate closes.
