# TRUST-P25 SKIN1004 US Direct PA Source Recovery Boundary

## Status

`NO_ADMISSIBLE_SAME_FORMULATION_DIRECT_PA_LABEL_FOUND`

TRUST-P25 re-runs the unresolved sunscreen inventory after TRUST-P24 closure and freezes the remaining SKIN1004 US `uva_label` admission boundary. It does not create or mutate a Product Fact.

## Target

- Product: `fdf06871-db8e-4e73-a48c-c057c5ce925d`
- SKIN1004 / `히알루-시카 워터핏 선세럼 UV`
- Current Subject: `9dcd611d-e353-47f5-b349-e1f22d73551e`
- Variant: `HYALU_CICA_WATER_FIT_SUN_SERUM_UV_US_50ML`
- Formulation revision: `trust-p17-skin1004-uv-us-current`
- Market: `US`
- Current governed coverage: `SPF Current 1 / UVA Current 0`

## Admission rule

A positive `uva_label` adoption requires a first-party direct PA label that applies to the exact current US `UV` formulation.

The following remain prohibited:

- `Broad Spectrum -> PA` conversion
- `UVA/UVB protection -> PA` conversion
- transfer of `PA++++` from the separate non-UV formulation
- third-party PA claims as positive Product Fact authority
- treating absence of a PA label as a negative Product Fact

## Reviewed exact-US first-party sources

Four first-party presentations applicable to the exact US `UV` product/formulation were reviewed:

1. `https://www.skin1004.com/products/hyalu-cica-water-fit-sun-serum-uv`
   - exact `Hyalu-Cica Water-Fit Sun Serum UV`
   - 50ml
   - `Hydrating Daily SPF50 Sun Serum`
   - `SPF50 broad-spectrum coverage`
   - UVA/UVB protection language
   - active system: Avobenzone 2.7% / Homosalate 13.6% / Octisalate 4.5% / Octocrylene 9%
   - direct PA label recovered: **no**

2. `https://skin1004-us.myshopify.com/products/hyalu-cica-water-fit-sun-serum-uv`
   - exact US Shopify-origin presentation
   - same exact product name / 50ml / SPF50 broad-spectrum presentation
   - direct PA label recovered: **no**

3. `https://www.skin1004.com/products/daily-moisture-routine-duo`
   - official bundle containing exact `Hyalu-Cica Water-Fit Sun Serum UV 50ml`
   - broad-spectrum SPF 50
   - same Avobenzone / Homosalate / Octisalate / Octocrylene active system
   - direct PA label recovered: **no**

4. `https://www.skin1004.com/pages/sun-serum-uv`
   - exact `UV` product landing page
   - `Hydrating Daily SPF50 Sun Serum`
   - direct PA label recovered: **no**

Reviewed same-formulation first-party direct PA hits: **0**.

## Rejected PA-bearing first-party route

The official non-UV route:

`https://www.skin1004.com/products/hyalu-cica-water-fit-sun-serum-spf50-pa`

exposes `SPF50+ PA++++`, but it remains inadmissible for the current US UV Subject because it is a materially different formulation:

- US UV: Avobenzone / Homosalate / Octisalate / Octocrylene
- non-UV: DHHB / Ethylhexyl Triazone / MBBT / Diethylhexyl Butamido Triazone

This preserves the TRUST-P16 formulation boundary.

## Fresh Production boundary

Read at `2026-09-13T19:24:40.248740+09:00`:

- Subjects: 25
- Sources: 26
- Bindings: 26
- Evidence: 58
- Fact Instances: 58
- Evidence Links: 58
- Review Assignments: 58
- Confirmations: 58
- Current: 58

Target:

- Subject: 1
- SPF Current: 1
- UVA Current: 0

Current SPF lineage remains:

- proposition: `6b04db0623d15da37c2cfb58168a41cc00dd735c775d28f7f7a2aa715122075a`
- Fact Instance: `304b8be8-e80a-49a5-9ceb-dfafef6b0828`
- Confirmation: `eea66ab9-abee-46c5-bb57-e3f9f119e5b3`
- value: `SPF50`
- market: `US`
- authority: `product_specific_primary`
- confidence: `high`

## Decision

- `uva_label`: `FACT_SOURCE_RECOVERY_REQUIRED`
- eligible Production UVA write: **false**
- Product Fact writes: **0**
- direct Product Fact DML: **0**
- schema/RPC/Registry changes: **0**
- recommendation/ranking changes: **0**

The next admissible action is source recovery only if new first-party evidence directly labels PA for the exact current US UV formulation.

Source-observation digest: `c9192ac664e6b54b8894190b42c4f45e79e7611b264f3de6302615ca2eefbca9`
