# Domain Map

This file defines canonical concepts and allowed compatibility terms. Prefer
updating this file over inventing new names in code.

## Product Category Taxonomy

### Treatment Family

Canonical DB category:

- `products.category = treatment`

Detailed product form:

- `products.product_form = serum`
- `products.product_form = ampoule`
- `products.product_form = essence`
- `products.product_form = booster`
- `products.product_form = peeling_solution`
- `products.product_form = unknown`

Compatibility, display, and known-drift terms:

- `serum`
- `ampoule`
- `essence`
- `serum_ampoule`

Rules:

- New DB product rows should use `category = treatment` for treatment-family
  products.
- Use `product_form` to preserve whether the product is a serum, ampoule,
  essence, booster, or peeling solution.
- `serum` and `ampoule` may be accepted as current-products compatibility
  categories today.
- `essence` is known category drift. DB migration direction maps essence to
  `category = treatment` with `product_form = essence`, but current app
  normalization still maps essence to `toner_essence`, and current-products
  slots still place essence in prep.
- `serum_ampoule` is a result/display or DB import/legacy mapping term, not a
  DB category and not a currently accepted current-products input category.
- `serum_ampoule` is not in `CURRENT_PRODUCT_CATEGORIES`, so
  `sanitizeCurrentProducts()` rejects it today.
- Do not reintroduce separate canonical DB categories for serum, ampoule, or
  essence.
- Verify the essence drift before future category or treatment-family refactors.

Current-products example:

- A selected treatment product may arrive from UI as `treatment`, `serum`, or
  `ampoule`.
- Sanitization should normalize it into an accepted current-products category.
- `essence` is currently handled separately from serum/ampoule/treatment in
  current-products slots and should not be assumed to behave like treatment
  until the category drift is resolved.
- Display may show the user-facing step as Serum, Ampoule, Essence, or
  Treatment when a product snapshot provides `product_form`.
- Detailed fit checks require a DB product snapshot. `not_in_db` items are
  context only.

Removed special case:

- The legacy current-products group for serum, ampoule, and essence should not
  become a separate domain model.
- Target direction is shared treatment-family behavior across current-products,
  result display, and recommendation category normalization, but current code is
  not fully unified because of the essence drift above.

## Category Families

| Canonical concept | DB category examples | Display/result family |
| --- | --- | --- |
| Cleanser | `cleanser` | `cleanser` |
| Toner and prep | `toner_essence`, `toner_pad` | `toner_essence` |
| Treatment | `treatment` | `serum_ampoule` |
| Moisturizer | `moisturizer`, `moisturizer_cream`, `moisturizer_gel`, `moisturizer_balm`, `moisturizer_lotion_emulsion` | `moisturizer` |
| Sunscreen | `sunscreen` | `sunscreen` |

## Current Products

Current products are user-provided routine context. They are not the same as a
recommendation result.

Statuses:

- `selected`: user selected a DB product.
- `not_in_db`: user uses a product that is not in the DB.
- `not_using`: user does not use this step.

Rules:

- `selected` requires `productId`.
- `not_in_db` can affect routine context but must not claim detailed product
  fit.
- `not_using` keeps an empty slot visible where the routine needs it.
- Duplicate categories should be dropped by sanitization.
