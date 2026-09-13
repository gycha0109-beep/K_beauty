# DATA-TAXONOMY1 — Shadow Catalog Taxonomy Foundation v1

## Status

`catalog-taxonomy-v1` is a **shadow-only catalog taxonomy**. It does not replace `products.category`, `products.product_form`, `public.map_product_category(text)`, candidate promotion authority, Recommendation runtime classification, Product Fact authority, or Offer authority.

Production migrations:

- `20260913201050_data_taxonomy1_shadow_catalog_taxonomy_foundation_v1`
- `20260913201324_data_taxonomy1_shadow_catalog_taxonomy_hardening_v1`

## Why this exists

The legacy catalog currently mixes product role and physical form:

- `treatment` separates `serum / ampoule / essence` through `products.product_form`.
- moisturizer forms are encoded in category values such as `moisturizer_cream`, `moisturizer_gel`, `moisturizer_balm`, and `moisturizer_lotion_emulsion`.
- `toner_pad` embeds a physical format in the category.

Continuing that pattern for masks, makeup, tools, and devices would require repeated enum expansion and would mix category, form, runtime recommendation grouping, and product characteristics.

DATA-TAXONOMY1 therefore adds a registry-backed shadow plane before any runtime cutover.

## Axes

The registry supports independent terms for:

- `entity_kind`
- `domain`
- `recommendation_family`
- `category`
- `form`
- `capability`

The current Product set is mapped as `cosmetic / skincare` and preserves its existing runtime semantics through a legacy bridge.

## Current lossless bridge

The following active legacy combinations are projected without changing `products`:

| Legacy category | Legacy form | Family | Canonical category | Canonical form |
| --- | --- | --- | --- | --- |
| `cleanser` | null | `cleanser` | `cleanser` | null |
| `toner_essence` | null | `toner` | `toner` | null |
| `toner_pad` | null | `toner` | `toner` | `pad` |
| `treatment` | `serum` | `treatment` | `treatment` | `serum` |
| `treatment` | `ampoule` | `treatment` | `treatment` | `ampoule` |
| `treatment` | `essence` | `treatment` | `treatment` | `essence` |
| `moisturizer_lotion_emulsion` | null | `moisturizer` | `moisturizer` | `lotion_emulsion` |
| `moisturizer_gel` | null | `moisturizer` | `moisturizer` | `gel` |
| `moisturizer_cream` | null | `moisturizer` | `moisturizer` | `cream` |
| `moisturizer_balm` | null | `moisturizer` | `moisturizer` | `balm` |
| `sunscreen` | null | `sunscreen` | `sunscreen` | null |

`toner_essence` intentionally keeps canonical form null. The legacy token does not prove that every row is physically an essence, so DATA-TAXONOMY1 does not manufacture a form fact.

## Future vocabulary is reserved, not activated

Future terms are present only to prove that the registry can represent expansion without changing the legacy Postgres enums.

Examples include:

- entity kinds: `tool`, `device`, `accessory`
- domains: `makeup`, `bodycare`, `haircare`
- families/categories: `mask`, `complexion`, `lip_makeup`, `foundation`, `lip_color`, `skincare_tool`, `skincare_device`
- forms: `sheet`, `hydrogel`, `wash_off`, `sleeping`, `patch`, `cushion`, `stick`, `tint`, `roller`, `plate`, `wearable`, `foam`, `oil`
- capabilities: `shade_variant`, `reusable`, `powered_device`

Reserved terms cannot be used by the current 165 shadow assignments. They confer no catalog-admission, Recommendation, Product Fact, or runtime authority.

## Capability semantics

The relation type is `supports_capability`, not `has_capability`.

`supports_capability` means that a taxonomy node can support an attribute or governed fact dimension. It is **not evidence that an individual Product actually possesses that property**.

For example, a category supporting `uv_protection_claim` does not create an SPF or UVA Product Fact. Product Facts continue to require their existing governed evidence, review, confirmation, and Current lifecycle.

## Security boundary

All five new tables have RLS enabled:

- `catalog_taxonomy_versions`
- `catalog_taxonomy_terms`
- `catalog_taxonomy_relations`
- `catalog_taxonomy_legacy_projections`
- `product_catalog_taxonomy_assignments`

`anon` and `authenticated` receive no privileges. `service_role` receives `SELECT` only. The audit view `catalog_taxonomy_shadow_read_v1` is `security_invoker` and is also readable only by `service_role`.

There is no client or Recommendation runtime read path to these objects in DATA-TAXONOMY1.

## Production verification

Immediately before the migration:

- Product count: `165`
- maximum `products.updated_at`: `2026-09-13 03:53:45.699595+09`
- Product taxonomy identity digest: `322e754b46eb0f0a5983750bc4fee9c3`

Immediately after foundation + hardening:

- Product count: `165`
- shadow assignments: `165`
- active legacy projections: `11`
- taxonomy terms: `59`
- reserved terms: `32`
- taxonomy relations: `61`
- exact legacy projection mismatches: `0`
- assignments using reserved/deprecated terms: `0`
- maximum `products.updated_at`: unchanged
- Product taxonomy identity digest: unchanged (`322e754b46eb0f0a5983750bc4fee9c3`)

The Production migration performed zero writes to Product Fact tables and made no Recommendation, ranking, Offer, or application-runtime change.

## Fail-closed invariants

1. The current `product_category` and `product_form` enums remain untouched.
2. `public.map_product_category(text)` remains the current fail-closed legacy classifier.
3. A Product must have one exact active legacy projection before DATA-TAXONOMY1 can backfill it.
4. An unmapped Product aborts the migration rather than being coerced to a nearby category.
5. Shadow assignments may use active terms only.
6. Reserved vocabulary never becomes runtime authority merely because it exists in the registry.
7. `supports_capability` is applicability metadata, not Product Fact evidence.
8. Missing or unresolved form remains null; it is not inferred from a compound legacy label when that inference is not lossless.
9. Catalog taxonomy, Product Fact, Recommendation policy, and Offer authority remain separate planes.
10. New taxonomy vocabulary must not require a new `product_category` enum value.

## Next gate: DATA-TAXONOMY2

DATA-TAXONOMY2 may generalize candidate/manual admission to classify raw source categories into registry terms while keeping Recommendation admission independently gated.

It must not cut Recommendation runtime over to the shadow taxonomy until a separate exact-equivalence gate proves that current Product eligibility and ranking behavior remain unchanged.
