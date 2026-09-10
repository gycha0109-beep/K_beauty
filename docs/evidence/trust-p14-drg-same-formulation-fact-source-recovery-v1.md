# TRUST-P14 — Dr.G Green Mild Up Sun Plus Same-Formulation Fact-Source Recovery v1

## Status

`SAME_FORMULATION_FIRST_PARTY_FACT_SOURCE_RECOVERED`

Target:

- product: `dc1ef3f3-db1b-4c3f-954a-b18343e3d9f3`
- catalog: `닥터지 그린 마일드 업 선 플러스 50mL`
- market: `KR`
- Production prestate: Subject `0` / Current `0`

## Current first-party identity

Dr.G current official product page:

`https://www.dr-g.co.kr/item/9637`

identifies the exact target as `그린 마일드 업 선 플러스 50mL` and a zinc-oxide mineral UV product.

The reviewed machine-readable body does not directly expose the SPF/PA enum, so this page is identity authority, not the direct fact source.

## Same-formulation bridge

Current official 50mL*2 page:

`https://www.dr-g.co.kr/item/5174`

and current official 35mL page:

`https://www.dr-g.co.kr/item/4415`

both disclose:

- manufacturer: `한국콜마㈜`
- country: `한국`
- the same **36 ingredients in the same order**
- ingredient-order SHA-256: `307d5eb4714f4b015f7a8aeb135a6622a0cbd61ed417076ce059b7e2d7e8e6b8`

The only reviewed distinction is fill size/package quantity. This establishes a first-party same-formulation bridge from the direct-claim 35mL presentation to the target 50mL presentation.

## Direct fact recovery

The current Dr.G 35mL page directly publishes:

`SPF50+ PA++++`

Because the 35mL and target 50mL official disclosures are formulation-identical, the recovered facts for the target formulation are:

- `spf_value = 50`, qualifier `{"plus_modifier":"plus"}`
- `uva_label = PA++++`

Authority ceiling: `product_specific_primary`. Confidence: `high`.

## Production boundary

Fresh Production readback at `2026-09-11T08:35:20.508595+09:00`:

`Subjects 20 / Sources 21 / Bindings 21 / Evidence 49 / Fact Instances 49 / Evidence Links 49 / Review Assignments 49 / Confirmations 49 / Current 49`

Target remains:

- Subject `0`
- Current `0`
- official source locators registered `0`

This stage performs **zero** Product Fact writes.

## Adjudication

`SAME_FORMULATION_FIRST_PARTY_FACT_SOURCE_RECOVERED`

Both sunscreen facts are research-supported, but this artifact does **not** authorize Subject registration, evidence ingest, review preparation, or confirmation.

Next gate:

`SEPARATE_DETERMINISTIC_HOSTED_ADOPTION_PLAN`

Research content SHA-256:

`45fef40117bdf347bff542dbc4d19f9058be7bf82a1ed3dd341bc96a6f922f8c`
