# TRUST-P21 Torriden KR Sunscreen Hosted Adoption Plan v1

## Phase

`A_DETERMINISTIC_PLAN_FREEZE`

This track freezes the controlled Product Fact adoption plan for Torriden `다이브인 모이스처 선크림 60ml` (`57e4a5ec-115d-4322-85a1-7976db669700`) after TRUST-P20 recovered the current KR identity boundary and direct first-party `SPF50+ PA++++` source.

Phase A performs **zero Production writes**.

## Upstream authority

- TRUST-P20 merge SHA: `5091cba4e33ac181dacea7d0d1de00882f3bf2e9`
- P20 artifact blob SHA: `80e4e003edffb36434622997afa8a3c4cf631659`
- P20 result: `KR_CURRENT_IDENTITY_REVISION_AND_DIRECT_SPF_PA_SOURCE_RECOVERED`
- Current fact route: `https://www.torriden.com/goods/goods_view.php?goodsNo=252`
- Legacy catalog identity route: `goodsNo=173` is identity context only.
- Distinct `다이브인 무기자차 마일드 선크림 60ml` remains disjoint.

No historical pre-upgrade formulation equivalence and no cross-product fact transfer are asserted.

## Deterministic subject

- variant: `DIVE_IN_MOISTURE_SUN_CREAM_KR_60ML`
- formulation revision: `trust-p20-torriden-252-current-upgraded`
- market: `KR`
- subject semantic key: `3f1b752bc8e1c7829f04bbc11fec3dd9b0c6646e481a3088d4214ec3b7dac03f`
- identity status: `resolved`
- current state: `current`

## Source binding

The current official `goodsNo=252` route directly matches the planned current KR subject:

- binding state: `exact_subject_match`
- scope relation: `equivalent`
- source content digest: `4ae0a6ccaa7cb8870a05326e68cc1a327bff562d3fee2e6a02c256eba397dcbd`
- evidence authority: `product_specific_primary`

## Planned propositions

1. `spf_value = 50`, raw claim `SPF50+`, qualifier `{"plus_modifier":"plus"}`
   - proposition: `6e87dc1448e6518a599a3e17e62e98e1c13e4a73ab01ab5596f8c8df34521385`
   - canonical evidence: `a9b7ecc5f5e9523ad44db9b13ecd2f015423e60ccac3488cd215d7ec76a5f7ea`
2. `uva_label = PA++++`
   - proposition: `06a9b17ca27c9cb350f75f8f20db7507c1be52f0063896d64f1a3ab22425d1bd`
   - canonical evidence: `6012054072e89a502d617bc3009552c6497a3b5e5a01cf97b05413daa7529933`

## Fresh Production prestate

At `2026-09-13T03:42:54.383113+09:00`:

`Subjects 22 / Sources 23 / Bindings 23 / Evidence 52 / Fact Instances 52 / Evidence Links 52 / Review Assignments 52 / Confirmations 52 / Current 52`

All target collisions are zero: target subject, subject semantic key, current source locator/content identity, both evidence digests, both proposition-current rows, open assignments, and planned confirmation request IDs.

Admin actor `e1a59349-fe13-43ff-86ce-078c2dce0d99` is active with role `admin_owner`.

## Phase B contract

Only after this plan merges and merged-main CI passes may a separate controlled execution invoke:

`admin_register_product_fact_subject_v1 → admin_ingest_product_fact_evidence_v1 → admin_prepare_product_fact_review_v1 → admin_preflight_product_fact_confirmation_v1 → admin_confirm_product_fact_v1`

Both SPF and UVA confirmation preflights must be `ready` before either confirmation is executed. Runtime IDs must be server-returned only. Direct Product Fact table DML is prohibited.

Planned Production delta:

`+1 Subject / +1 Source / +1 Binding / +2 Evidence / +2 Fact Instances / +2 Evidence Links / +2 Review Assignments / +2 Confirmations / +2 Current`

No Registry, schema, RPC, recommendation, or ranking mutation is included.

Plan SHA-256: `4919e32931538bc284d33b9db63fe85ad8f9a241a9b3e405f48ecae0944a9428`
