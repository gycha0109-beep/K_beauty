# TRUST-P12A — Beauty of Joseon Original Relief Sun UVA Plan Authority Correction v1

## Status

`A_AUTHORITY_CORRECTION_FREEZE`

This correction supersedes the execution authority of the merged TRUST-P12 Phase A plan **before any Phase B Product Fact write**.

## Correction

Merged TRUST-P12 recorded the existing Subject as:

`subject.market_applicability = "GLOBAL"`

Fresh Production readback at `2026-09-11T06:27:20.37918+09:00` proves the authoritative existing Subject is instead:

`subject.market_applicability = null`

The missing UVA fact remains independently scoped to:

- `fact_key = uva_label`
- value = `PA++++`
- fact market = `GLOBAL`
- variant = `Relief_Sun_Rice_Probiotics`

A null Subject market is not a conflict with a `GLOBAL` evidence/fact market under the existing controlled ingest contract. No Subject mutation or replacement is authorized.

## Retained identity

The correction does **not** change:

- proposition key: `ea34c1e334b846df861b198bd658c3ce1a98d422433e66d0b3e3d7c584915f01`
- source observation digest: `e09425390b1fbf0e9c4eb4c4a3d1b2854f25d6a7de82a99f57a56a575184e7c9`
- canonical evidence digest: `95920464b02a26fa8e31ab057fbbc2157cbb761f0a7eed91d8db7df8121cdb69`

## Fresh Production readback

`Subjects 20 / Sources 20 / Bindings 20 / Evidence 48 / Fact Instances 48 / Evidence Links 48 / Review Assignments 48 / Confirmations 48 / Current 48`

Target state:

- Subject 1
- SPF Current 1
- UVA Current 0
- planned proposition Current 0
- planned source digest rows 0
- planned evidence digest rows 0
- open review assignment 0
- confirmation request conflict 0

## Controlled Phase B boundary

After this correction is merged and merged-main CI is green, execution may use only:

1. `admin_ingest_product_fact_evidence_v1`
2. `admin_prepare_product_fact_review_v1` → `under_review`
3. `admin_prepare_product_fact_review_v1` → `ready_for_confirm`
4. `admin_preflight_product_fact_confirmation_v1`
5. `admin_confirm_product_fact_v1`

No direct Product Fact DML. No Subject registration. No schema/RPC/Registry/recommendation/ranking change.

Plan content SHA-256:

`959ec06947a417864d8a1c5ee86f417a0a0688ab2698a221f3f3c0035245d385`
