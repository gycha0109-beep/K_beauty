# Read-only Scorer-compatible Product Source Extraction - 2026-07-09

This is Phase 23 diagnostic evidence. It does not invoke `/api/analyze`, does not write to Supabase, and does not change runtime recommendation behavior.

## Scope

- Evidence type: `read_only_scorer_compatible_product_source`
- Route invoked: `false`
- `/api/analyze` invoked: `false`
- Supabase write executed: `false`
- Runtime mutation: `false`
- Synthetic products used: `false`

## Scorer-compatible Product Row Contract

Current code inspection shows the legacy decision engine scorer requires these fields for a row to survive the existing scorer boundary:

- `id`: required by `buildSkinMatchDecisionBundle()` before scoring.
- `name`: required by `buildSkinMatchDecisionBundle()` before scoring.
- `brand`: required by `buildSkinMatchDecisionBundle()` before scoring.
- Authorized recommendation category: required by `getProductCategorySlot()` before category priority and slot selection can work.
- `product_form`: used with category semantics for serum and moisturizer subcategory authorization when present.

The read-only `getRecommendationProducts()` source normalizes these scorer inputs before rows reach `buildSkinMatchDecisionBundle()`:

- `skin_types`
- `concerns`
- `texture`
- `finish`
- `irritation_risk`
- `sensitivity_safe`
- `price_min`
- `price_max`
- `review_signals`
- `market_signals`
- `ingredient_signals`
- sunscreen metadata (`uv_filter_type`, `tone_up`, `white_cast`, `eye_sting`, `pilling_risk`)

Optional fields such as `recommendation_tier`, `is_mens`, review signals, ingredient signals, market signals, and sunscreen metadata affect score modifiers, evidence, sunscreen fit, or explanation quality. Missing optional fields should not be treated as the same failure as missing scorer-required fields.

## Extraction Result

The Phase 23 runner attempted the existing read-only product source:

```text
sourceMode=getRecommendationProducts_read_only
status=unavailable
unavailableReason=missing_config
totalRows=0
scorerCompatibleCount=0
```

Because the current environment has no Supabase product-source config available to `getRecommendationProducts()`, no actual scorer-compatible product rows were extracted in this checkout.

## Target Scenario Replay

Target scenario replay with extracted rows was skipped because the extracted source row count was `0`.

```text
scenariosAttempted=0
totalCandidateRows=0
totalAuditRows=0
```

This is a source availability limitation, not a functional policy conclusion.

## Boundary Conclusion

Phase 23 identified the scorer-compatible product row contract and added a read-only extraction verifier. However, current local evidence does not yet prove that a real read-only product source can provide scorer-compatible rows in this environment.

Do not mix this result with actual `/api/analyze` captures or Phase 22 pure replay evidence. The next useful step is to run the same read-only verifier in an environment where `getRecommendationProducts()` can read product rows, then inspect the row count, category distribution, and target scenario candidate rows.

## Validation

- `node scripts/inspect-read-only-scorer-compatible-product-source.mjs` passed.
- `node scripts/verify-read-only-scorer-compatible-product-source.mjs` passed.
- The verifier confirms:
  - `routeInvoked=false`
  - `apiAnalyzeInvoked=false`
  - `supabaseWriteExecuted=false`
  - `runtimeMutation=false`
  - `syntheticProductsUsed=false`
  - runtime files do not import or reference the Phase 23 inspection script

Node emitted the existing direct-ESM `--experimental-loader` and `MODULE_TYPELESS_PACKAGE_JSON` warnings.
