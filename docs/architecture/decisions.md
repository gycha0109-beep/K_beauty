# Decisions

Short records for architecture and domain decisions that future changes should
not accidentally reverse.

## 2026-06-20 - Remove Legacy Special Current-Products Group

Status: accepted

Scope: domain, current-products, DB/UI compatibility

Decision:

- The old `special` current-products concept is removed and should not be
  restored.
- Do not introduce another separate special current-products domain group for
  legacy serum, ampoule, and essence categories.
- Keep `products.category = treatment` as the canonical DB model.
- Use `products.product_form` for serum, ampoule, essence, booster, peeling
  solution, or unknown detail.
- Target direction is to treat treatment-family categories through shared
  treatment behavior, but current code is not fully there yet.

Reason:

- The DB migration consolidated serum, ampoule, and essence under
  `treatment`.
- Recreating a separate current-products special group would make future agents
  think serum, ampoule, and essence are canonical DB categories again.
- The UI still needs user-friendly labels and compatibility handling, but those
  should be display or alias behavior, not new domain concepts.
- Current code still has separate current-product categories and slot handling
  for `serum`, `ampoule`, `essence`, and `treatment`.
- In particular, `essence` remains known category drift: DB migration direction
  maps it to `treatment + product_form`, while current app behavior still routes
  it through prep/toner behavior.

Impacted areas:

- Current-products selector and sanitizer.
- Product category normalization.
- Result and full-report display labels.
- Product import/review-signal scripts that map serum, ampoule, and essence
  sources into treatment-family records.

Compatibility:

- `serum` and `ampoule` may still appear as current-products compatibility
  inputs.
- `essence` may still appear in current-products, but it should be treated as
  known drift until category behavior is unified.
- `serum_ampoule` may still appear as a result/display or DB import/legacy
  mapping term, but it is not accepted by `sanitizeCurrentProducts()` today.
- They should not be introduced as new canonical DB categories.

Update required:

- Update `domain-map.md` and `contracts.md` if accepted current-products
  categories, treatment aliases, or product snapshot fields change.
