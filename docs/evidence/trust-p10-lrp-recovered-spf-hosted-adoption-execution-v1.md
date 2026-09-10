# TRUST-P10 — La Roche-Posay Recovered SPF Hosted Adoption Execution v1

## Status

`PRODUCTION_CONFIRMED`

Phase A plan authority is merged at `d38d169059f32c97a1814b2dd4454ca50bf66c6b` with plan SHA-256 `ea9e640baf878c0f2fa8298c01a251dd0d240105f6958e567a389ffeba48d8d5`.

## Controlled execution

Production project: `bygrczggxfuisupcevaz`.

No Product Fact table direct DML was used. The exact controlled path was:

`admin_register_product_fact_subject_v1 → admin_ingest_product_fact_evidence_v1 → admin_prepare_product_fact_review_v1 (under_review) → admin_prepare_product_fact_review_v1 (ready_for_confirm) → admin_preflight_product_fact_confirmation_v1 → admin_confirm_product_fact_v1`

Only `spf_value` was executed. `uva_label` remained blocked throughout.

## Authoritative runtime IDs

- product: `9983f167-24e7-4223-bd86-446ce6ced31b`
- subject: `614db853-7865-408b-8f40-a4dcfe6a2ea5`
- source: `5cd09ce3-bd09-474a-bd8e-f2253a455116`
- binding: `c2dbf1ad-cc8e-46b6-bebd-94860613705c`
- evidence: `cef172e8-6ca1-479f-a4fa-29834288809c`
- assignment: `ad0e839e-7d14-4893-9caa-99c809db5286`
- confirmation: `31a872bb-983c-4d68-9c6e-8883f4f4729b`
- fact instance / Current pointer: `35822d3f-4036-41c2-80fe-8fe6d0148004`

## Exact fact

- `fact_key = spf_value`
- `semantic_status = supported`
- `value_type = number`
- `value_number = 50`
- qualifier = `{"plus_modifier":"plus"}`
- fact market = `KR`
- authority ceiling = `product_specific_primary`
- fused confidence = `high`
- proposition = `9be0d8a4cc57d8738b45955565fc7023761087ee7f50b55e7ea0d2223cdbf515`
- fusion input digest = `e04ee4affcee6f9014f89957af3c1cb45bfc1c0a2e96a30d56ab53098b30baa1`

The first-party fact source is the La Roche-Posay Slovenia page, bound `narrower` to the exact KR subject established by the companion La Roche-Posay Korea identity source.

## Confirmation authority

- fresh preflight: `ready`
- payload digest: `f114f829d90933dac972bf203df7e157ec94b0cecfe1aa95d53c9d171db2b258`
- prestate digest: `e6b617e7c11b0ed42fa2862c9e85b1da9ca668e579c43c31f293dda96c296e8f`
- result digest: `8e6c57c0273e76e42c1c7eca8bedc2af73b6c16c8473b0bffbd368d001577458`
- previous Current: `null`

## Production counts

Before Phase B:

`Subjects 19 / Sources 19 / Bindings 19 / Evidence 47 / Fact Instances 47 / Review Assignments 47 / Confirmations 47 / Current 47`

After exact readback at `2026-09-11T04:52:06.884026+09:00`:

`Subjects 20 / Sources 20 / Bindings 20 / Evidence 48 / Fact Instances 48 / Evidence Links 48 / Review Assignments 48 / Confirmations 48 / Current 48`

Target product is now Subject 1 / Current 1, consisting only of SPF. `uva_label` Current remains exactly 0.

## Invariants

```text
CONTROLLED_RPC_ONLY = YES
DIRECT_PRODUCT_FACT_TABLE_DML = NO
PLANNED_DELTA_EXACT = YES
RUNTIME_IDS_SERVER_RETURNED = YES
CURRENT_LINEAGE_EXACT = YES
SPF_VALUE_EXACT = YES
UVA_LABEL_WRITE = NO
UVA_PF_TO_PA_CONVERSION = NO
SCHEMA_CHANGE = NO
RPC_CHANGE = NO
REGISTRY_CHANGE = NO
RECOMMENDATION_OR_RANKING_CHANGE = NO
```
