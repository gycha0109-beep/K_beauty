# Product Data Sufficiency & Decision Evidence Audit v1

## Purpose

`product-data-sufficiency-audit-v1` measures whether raw product rows provide enough evidence for the existing category, functional-profile, safety, sunscreen, ranking, and transport contracts.

The audit is read-only. It accepts a local JSON export and never queries or writes Supabase.

## Non-goals

This phase does not:

- change product rows, schema, migrations, RLS, or API responses;
- synthesize ingredient evidence;
- register unknown functional labels;
- change recommendation scoring or policy thresholds;
- repair transport gaps;
- claim production-dataset coverage from fixtures.

## Evidence layers

The audit keeps the following layers separate:

1. **Source evidence** — values explicitly present in the raw row.
2. **Normalization** — a source value converted into the runtime vocabulary.
3. **Derived/defaulted/coerced values** — runtime values that must not be counted as source evidence.
4. **Transport** — whether a decision-relevant source field is preserved by the recommendation-product and current-product-snapshot contracts.
5. **Decision capability** — whether the existing category and functional-profile resolvers can evaluate the product.

A single overall completeness percentage is intentionally not produced. Results are grouped by product, category, functional axis, source field, transport destination, severity, and remediation type.

## Existing resolvers remain authoritative

The audit calls:

- `resolveProductCategorySemantics()` for strict recommendation eligibility;
- `normalizeProductCategory()` for legacy/current-product category usability;
- `resolveProductFunctionalProfile()` for functional axes, strength, confidence, and caution tags.

The audit does not duplicate their category or functional-axis calculations.

## Capability model

Each product receives independent capability flags for:

- identity readiness;
- recommendation-category readiness;
- current-product category readiness;
- routine-role readiness;
- functional-signal presence;
- recognized-axis and profile evaluability;
- direct-goal and duplicate-axis evaluability;
- safety-value and safety-decision readiness;
- sunscreen protection and preference readiness;
- ranking, commerce, provenance, and transport readiness.

Recommendation eligibility and current-product evaluability are deliberately separate. Legacy `serum`, `ampoule`, and `essence` rows may remain interpretable by the current-product functional profile while being invalid under the strict recommendation category contract.

## Category-specific evidence

- **Cleanser:** routine role can be known without direct functional support; rinse-off limits remain authoritative.
- **Hydration base:** category determines role, while direct functional claims require recognized evidence.
- **Functional leave-on:** recognized functional evidence and explicit safety values are required for decision readiness.
- **Moisturizer/support:** hydration, moisture-lock, barrier-support, and soothing evidence are most relevant; existing profile confidence adjustments are preserved.
- **Sunscreen:** protection readiness requires a recognized UV axis and complete `spf_value`, `uva_label`, and `uv_filter_type`; preference readiness separately requires tone-up, white-cast, eye-sting, pilling, texture, and finish evidence.

## Gap taxonomy

### Critical — structural or transport contract

- identity/category contract failures;
- malformed source JSON;
- duplicate IDs;
- unknown safety values coerced into runtime booleans;
- decision-relevant fields dropped from recommendation or current-product transport.

### Important — decision evidence

- missing or malformed functional evidence;
- unknown functional labels;
- missing active-product safety evidence;
- missing or partial sunscreen protection/preference evidence.

### Quality — ranking, provenance, and commerce

- missing skin type, concern, texture, finish, review, market, provenance, image, link, or price evidence.

## Transport lineage

Transport status is represented independently for:

- `recommendation_product`;
- `current_product_snapshot`.

Possible states are `preserved`, `normalized`, `collapsed`, `defaulted`, `coerced`, `dropped`, and `not_applicable`.

The initial contract intentionally reports current-product sunscreen metadata loss rather than repairing it. Repair belongs in a later adapter/data-remediation phase so the baseline remains observable.

## Determinism

The audit core:

- does not mutate input;
- excludes timestamps;
- canonicalizes keys;
- stable-sorts products, gaps, labels, summaries, and backlog entries;
- computes a SHA-256 dataset hash that is independent of input-row order.

## CLI

```bash
node scripts/audit-product-data-sufficiency.mjs \
  --input <raw-products.json> \
  --output <output-directory>
```

The input may be a JSON array or `{ "products": [...] }`. Existing output files are not overwritten unless `--force` is supplied.

Outputs:

- summary, product, category, axis, field, label, transport, and remediation JSON;
- Markdown report;
- product, gap, and unknown-label CSV files.

CSV cells beginning with `=`, `+`, `-`, or `@` are escaped to prevent spreadsheet formula execution.

## Actual-data execution gate

Fixture verification proves only audit-tool behavior. A production or staging data-quality conclusion requires an explicit raw export containing the documented fields and a separate audit run.

Without that export, the correct status is:

- audit tooling implemented;
- fixture verification completed;
- actual product coverage and remediation volume not established.
