# TRUST-P17 — SKIN1004 Hyalu-Cica Water-Fit Sun Serum UV US Market Applicability Recovery v1

## Status

`US_MARKET_APPLICABILITY_AND_SPF_SOURCE_RECOVERED`

Target:

- product: `fdf06871-db8e-4e73-a48c-c057c5ce925d`
- catalog identity: `Hyalu-Cica Water-Fit Sun Serum UV`
- size: `50mL`
- upstream P16: exact UV formulation and SPF50 recovered, market scope previously unresolved

## First-party US market authority

Exact product on SKIN1004's US Shopify-origin storefront:

`https://skin1004-us.myshopify.com/products/hyalu-cica-water-fit-sun-serum-uv`

The product observation matches P16 exactly:

- `Hyalu-Cica Water-Fit Sun Serum UV`
- 50mL
- `Hydrating Daily SPF50 Sun Serum`
- `SPF50 broad-spectrum coverage`
- active system: Avobenzone 2.7% / Homosalate 13.6% / Octisalate 4.5% / Octocrylene 9%

The same first-party storefront exposes its country/region retailer directory:

`https://skin1004-us.myshopify.com/pages/stores`

Under `AMERICA`, the directory explicitly contains a `US` row and labels official malls / authorized sellers, including Amazon, TikTok Shop, Ulta Beauty and other US channels.

Together these first-party observations establish **US market applicability** for the exact UV formulation. They do not establish KR or GLOBAL applicability.

## Fact recovery

For `market=US`:

- `spf_value = 50`
- qualifier: `{"plus_modifier":"none"}`
- raw claim: `SPF50`
- authority: `product_specific_primary`
- confidence: `high`

`uva_label` remains blocked. The exact UV route publishes `Broad Spectrum`, which is not an allowed current registry enum, and no PA conversion is permitted. The separate non-UV formulation's PA++++ remains non-transferable.

## Production boundary

Fresh Production readback at `2026-09-11T09:52:06.019175+09:00`:

`Subjects 21 / Sources 22 / Bindings 22 / Evidence 51 / Fact Instances 51 / Evidence Links 51 / Review Assignments 51 / Confirmations 51 / Current 51`

Target remains:

- Subject `0`
- Current `0`
- US product locator rows `0`
- US retailer-directory locator rows `0`

This stage performs **zero Product Fact writes**.

## Adjudication

- US market applicability: `RECOVERED`
- KR market applicability: not recovered
- GLOBAL market applicability: not recovered
- US-scoped SPF50: `RECOVERED_SUPPORTED_FOR_US_SCOPE`
- UVA: `REGISTRY_BLOCKED`
- Production write authorized: `false`

Next gate:

`SEPARATE_DETERMINISTIC_US_SPF_HOSTED_ADOPTION_PLAN`

Research content SHA-256:

`0c609b521c7a251ee6add980962caeaf4dadad4be4ce767feaa5583a65ae1fae`
