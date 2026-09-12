# TRUST-P18 — SKIN1004 Hyalu-Cica Water-Fit Sun Serum UV US SPF Hosted Adoption Plan v1

## Status

`PHASE_A_FREEZE_ONLY`

This stage freezes a deterministic controlled Product Fact adoption plan for exactly one fact:

- product: `fdf06871-db8e-4e73-a48c-c057c5ce925d`
- product identity: `Hyalu-Cica Water-Fit Sun Serum UV 50mL`
- market: `US`
- fact: `spf_value=50`
- qualifier: `plus_modifier=none`

No Product Fact write is authorized by this Phase A artifact.

## Upstream authority

TRUST-P17 recovered the narrow market boundary required by the registry:

- exact UV product on SKIN1004's US storefront
- same-host Country / Region directory with an explicit `US` row
- `SPF50 broad-spectrum coverage`
- same four-active UV formulation
- KR applicability: not recovered
- GLOBAL applicability: not recovered
- UVA label: blocked

Upstream P17 merge: `33d03ea91b59b314f0d9725905e812767ebc1b5c`  
Upstream P17 blob: `b204ed68eadacecf384b82e256f6b6a4d67eb8b7`

The official US product and stores pages were rechecked during Phase A preparation and remained current. Phase B must recheck them again immediately before any Production write.

## Deterministic identity

Subject identity:

- variant: `HYALU_CICA_WATER_FIT_SUN_SERUM_UV_US_50ML`
- formulation revision: `trust-p17-skin1004-uv-us-current`
- market applicability: `US`
- Subject semantic key: `6ea35ff44d90264c4cb8f845b1f04f28adc794872220f41e4cc9e03d13561320`

Source:

- canonical locator: `https://skin1004-us.myshopify.com/products/hyalu-cica-water-fit-sun-serum-uv`
- publisher: `SKIN1004`
- source kind: `official_product_page`
- market: `US`
- binding: `exact_subject_match / equivalent`
- source observation digest: `e30e828daffd28c7656b63e8bf0bfa2555c9590ab9647c29eba6c2695a6c0603`

SPF proposition:

- raw claim: `SPF50`
- value: `50`
- qualifier: `{"plus_modifier":"none"}`
- proposition key: `6b04db0623d15da37c2cfb58168a41cc00dd735c775d28f7f7a2aa715122075a`
- canonical evidence digest: `d4d15e6142f9c6a64b4cf7531169ef0aeeb49d2b6edc21650d5e361c8415eb6c`

All four deterministic hashes were independently reproduced by Production `product_fact_controlled_sha256_json_v1`.

## Fresh Production prestate

Captured at `2026-09-13T02:17:24.159555+09:00`:

`Subjects 21 / Sources 22 / Bindings 22 / Evidence 51 / Fact Instances 51 / Evidence Links 51 / Review Assignments 51 / Confirmations 51 / Current 51`

Target-specific checks:

- target Subjects: `0`
- Subject semantic-key rows: `0`
- exact source identity rows: `0`
- source locator rows: `0`
- SPF evidence-digest rows: `0`
- SPF proposition Current rows: `0`
- open assignment rows: `0`

Admin actor `e1a59349-fe13-43ff-86ce-078c2dce0d99` is active with role `admin_owner`.

## Planned Phase B delta

Only after this plan is merged and exact-head/merged-main gates are green:

- Subjects `+1`
- Sources `+1`
- Bindings `+1`
- Evidence `+1`
- Fact Instances `+1`
- Evidence Links `+1`
- Review Assignments `+1`
- Confirmations `+1`
- Current `+1`

Expected resulting global counts: `22 / 23 / 23 / 52 / 52 / 52 / 52 / 52` plus `Current 52`.

Phase B must use only the controlled RPC lifecycle. Runtime UUIDs must be server-returned. Confirmation is permitted only after a fresh `ready` preflight using fresh digests.

## UVA boundary

TRUST-P18 does **not** plan a `uva_label` write.

- `Broad Spectrum` is not a current `uva_label` enum.
- No `Broad Spectrum -> PA` conversion is permitted.
- No `PA++++` claim from the distinct non-UV formulation may be transferred.
- No KR or GLOBAL market scope is inferred from this US-scoped plan.

Plan content SHA-256:

`e0a6d654b85179b1031a6c95b13d28d731747b831bfeeb57a66b4a5527f95b96`
