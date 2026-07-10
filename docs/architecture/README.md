# Architecture Maps

This folder keeps the small project maps that should prevent ghost concepts,
dead-end flows, and hidden domain drift during future AI-assisted changes.

Keep these files short. Update the smallest relevant section instead of turning
them into broad design documents.

## Map Files

| File | Purpose |
| --- | --- |
| `domain-map.md` | Canonical domain concepts, compatibility aliases, and removed concepts. |
| `contracts.md` | API, DB, and UI payload contracts that must stay compatible. |
| `decisions.md` | Short decision records for non-obvious product or architecture choices. |
| `premium-functional-plan-db.md` | Draft DB and engine contract for Premium Functional Plan functional catalog and product mapping. |

Planned but not created yet:

- `data-flow-map.md`
- `file-responsibility-map.md`
- `ghost-code-audit.md`

## When To Update

Update these maps after a Codex task when externally consumed or cross-file
behavior changes any of the following:

- Domain vocabulary, category names, product taxonomy, or result sections.
- API request or response fields.
- DB enum, table, JSON payload, or storage source of truth.
- UI assumptions about product/result/current-products payloads.
- A non-obvious decision that future agents could accidentally reverse.

Low-risk copy or style changes usually do not need an architecture map update.

## First Concrete Example

Current rule:

- `products.category = treatment` is the canonical DB category for treatment
  products.
- `products.product_form` preserves the detailed form, such as `serum`,
  `ampoule`, or `essence`.
- `serum` and `ampoule` still appear in current-products compatibility paths.
- `essence` is known drift: DB migration direction treats it as
  `treatment + product_form`, while current app normalization and
  current-products slots still route it through prep/toner behavior.
- `serum_ampoule` is a result/display or DB import/legacy mapping term. It is
  not in `CURRENT_PRODUCT_CATEGORIES` and is not accepted by
  `sanitizeCurrentProducts()` today.

Removed special case:

- Do not create a separate current-products special group that treats legacy
  serum, ampoule, and essence categories as new canonical domain concepts.
- Use the shared treatment-family mapping instead.

## Ghost-Code Audit Checklist

Before finishing a medium or high-risk Codex task, check:

- Did the task introduce a new domain term that is missing from
  `domain-map.md`?
- Did it add an alias without documenting canonical vs compatibility behavior?
- Did it duplicate category or result normalization that already has an owner?
- Did API response fields change without updating `contracts.md`?
- Did UI code start relying on fields that the API or DB does not guarantee?
- Did DB enum or check-constraint assumptions change?
- Did a removed concept reappear as a fallback, label, branch, script path, or
  special case?
- Does current-products treatment behavior still match
  `treatment + product_form`?
