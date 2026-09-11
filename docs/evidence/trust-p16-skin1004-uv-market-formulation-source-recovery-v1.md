# TRUST-P16 — SKIN1004 Hyalu-Cica Water-Fit Sun Serum UV Market/Formulation Source Recovery v1

## Status

`PARTIAL_FACT_SOURCE_RECOVERY_MARKET_SCOPE_BLOCKED`

Target:

- product: `fdf06871-db8e-4e73-a48c-c057c5ce925d`
- catalog: `스킨1004 히알루-시카 워터핏 선세럼 UV 50mL`
- English catalog identity: `Hyalu-Cica Water-Fit Sun Serum UV`
- Production prestate: Subject `0` / Current `0`

## Exact first-party UV route

Current official SKIN1004 page:

`https://www.skin1004.com/products/hyalu-cica-water-fit-sun-serum-uv`

matches the catalog's exact `UV` identity and 50mL size. The reviewed body directly publishes:

- `Hydrating Daily SPF50 Sun Serum`
- `SPF50 broad-spectrum coverage`
- a reformulation statement with Panthenol and rice/oat/soybean extracts
- active ingredients `Avobenzone 2.7% / Homosalate 13.6% / Octisalate 4.5% / Octocrylene 9%`

This is admissible first-party product-specific support for the numeric SPF value `50`. The label is **SPF50**, not SPF50+, so the recovered qualifier is `plus_modifier=none`.

## Separate non-UV formulation

Current official SKIN1004 non-UV presentation:

`https://www.skin1004.com/products/hyalu-cica-water-fit-sun-serum-spf50-pa`

publishes `SPF50+ PA++++`, but it omits the `UV` suffix and exposes a materially different UV-filter system:

- Diethylamino Hydroxybenzoyl Hexyl Benzoate
- Ethylhexyl Triazone
- Methylene Bis-Benzotriazolyl Tetramethylbutylphenol
- Diethylhexyl Butamido Triazone

The reviewed non-UV formula has 42 ingredients, while the UV route uses a separate four-active US-style sunscreen system. Claims from this non-UV route therefore cannot be transferred to the catalog's exact UV target.

## Market and registry blockers

`spf_value` requires a `market` scope in `product-fact-registry-cross-category-v1`. The reviewed exact UV first-party body does not itself freeze an explicit market applicability value. Therefore `SPF50` is recovered as a value but **not yet write-authorized**.

The exact UV route's UVA-facing claim is `broad-spectrum`. Current `uva_label` allowed values are only:

`PA+ / PA++ / PA+++ / PA++++ / UVA-PF-declared`

`Broad Spectrum` is not an allowed registry enum. It must not be converted into a PA label. The separate non-UV formulation's `PA++++` must also not be transferred across formulation boundaries.

## Production boundary

Fresh Production readback at `2026-09-11T09:42:18.107981+09:00`:

`Subjects 21 / Sources 22 / Bindings 22 / Evidence 51 / Fact Instances 51 / Evidence Links 51 / Review Assignments 51 / Confirmations 51 / Current 51`

Target remains:

- Subject `0`
- Current `0`
- official source locator rows `0`

This stage performs **zero Product Fact writes**.

## Adjudication

- exact UV route identity: resolved at product/formulation route level
- market applicability: unresolved
- `spf_value`: `RECOVERED_VALUE_MARKET_SCOPE_BLOCKED`
- `uva_label`: `REGISTRY_AND_FORMULATION_BLOCKED`
- production write authorized: `false`

Next gate:

`RESOLVE_UV_MARKET_APPLICABILITY_OR_ADD_MARKET_SPECIFIC_FIRST_PARTY_SOURCE`

Research content SHA-256:

`8fc6ad03600e500e0966da67951507ca475b690444db2a10dd79d5ef03752243`
