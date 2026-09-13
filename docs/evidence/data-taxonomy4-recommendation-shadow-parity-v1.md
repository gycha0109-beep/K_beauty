# DATA-TAXONOMY4 — Recommendation taxonomy shadow parity v1

## Decision

DATA-TAXONOMY4 proves that the current `catalog-taxonomy-v1` shadow projection produces no Recommendation category-sensitive behavior delta relative to the existing legacy Product `category` / `product_form` authority.

This track does **not** cut over Recommendation runtime authority.

```text
products.category / products.product_form = current Recommendation authority
catalog-taxonomy-v1 = shadow_only
Recommendation runtime cutover = false
```

## Fresh baseline

Repository `main` at branch creation:

```text
d3c472e1a0e103795595fa34de0d28061e333851
```

Production source:

```text
public.catalog_taxonomy_product_exact_equivalence_v1
```

Production readback at `2026-09-14 00:01:21.253781+09`:

```text
Products = 165
equivalence classes = 11
exact-equivalent rows = 165
non-exact rows = 0
category mismatch = 0
product_form mismatch = 0
taxonomy lifecycle = shadow
taxonomy authority_mode = shadow_only
```

## Production equivalence classes

| legacy category | legacy product_form | projected category | projected product_form | products |
| --- | --- | --- | --- | ---: |
| cleanser | null | cleanser | null | 26 |
| moisturizer_balm | null | moisturizer_balm | null | 20 |
| moisturizer_cream | null | moisturizer_cream | null | 10 |
| moisturizer_gel | null | moisturizer_gel | null | 10 |
| moisturizer_lotion_emulsion | null | moisturizer_lotion_emulsion | null | 21 |
| sunscreen | null | sunscreen | null | 12 |
| toner_essence | null | toner_essence | null | 24 |
| toner_pad | null | toner_pad | null | 24 |
| treatment | ampoule | treatment | ampoule | 5 |
| treatment | essence | treatment | essence | 3 |
| treatment | serum | treatment | serum | 10 |
| **Total** | | | | **165** |

## Runtime replay

The verifier does not reimplement Recommendation category logic. It imports the current runtime modules directly:

```text
lib/product-category-normalizer.js
  resolveProductCategorySemantics()

lib/recommendation-scoring.ts
  getProductCategorySlot()
  getProductCategoryPriority()
  scoreCanonicalProduct()
  compareRankedProducts()
```

The 11 Production equivalence classes are expanded by their observed multiplicity to a 165-row category-sensitive replay corpus. Non-category inputs are deterministic and identical between the legacy and projected sides.

Eight concern/context scenarios exercise category priority and sunscreen-specific scoring:

```text
oiliness
pores
acne
dehydration
barrier
redness
uneven_tone
uv + outdoor + explicit sunscreen intent
```

For every replay row and scenario, acceptance requires:

```text
semantic authorization delta = 0
Recommendation slot delta = 0
category-priority delta = 0
score delta = 0
outdoor sunscreen bonus delta = 0
full ranked-order delta = 0
Top1 delta = 0
Top3 delta = 0
```

## Safety boundary

This is a read-only/shadow proof.

```text
Product mutation = false
Product Fact mutation = false
Offer mutation = false
Recommendation runtime mutation = false
Production business-data mutation = false
```

A later cutover track must make an independent authority decision. Passing DATA-TAXONOMY4 alone does not authorize taxonomy as the Recommendation runtime source.
