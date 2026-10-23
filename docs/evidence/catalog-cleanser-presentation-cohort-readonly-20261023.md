# Cleanser 10-product physical presentation / TRUST queue read-only audit — 2026-10-23

Status: **READ-ONLY DIAGNOSTIC — NOT OFFICIAL SKU VERIFICATION, NOT OPERATIONAL APPROVAL**

## Sources and scope

- Connected BEJEWELY Supabase project: `bygrczggxfuisupcevaz`, SELECT-only observations on 2026-10-23 (connection identity is **not** proof of the currently deployed Vercel runtime DB).
- Exact cohort: 10 already-promoted cleanser catalog IDs with intake created on 2026-10-22. **Do not re-register.**
- Historical lead reference: `evidence/trust/cleanser-official-research-leads-20261022-v1.json` on draft PR #1390. This file expressly disclaims exact SKU confirmation, source binding, raw snapshot retention and site-use authorization. No new external requests made.
- Code contract: `lib/cleanser-cohort-presentation-shadow-v1.mjs`; unit and offer projection is separate from PF-1 formulation decision.

## Read-only actual cohort state

| Product anchor (UUID prefix) | Product | `products.size_ml` hint | Unverified detail / identity task |
| --- | --- | ---: | --- |
| `11322a66` | 닥터지 약산성 클렌징 젤 폼 | 200 | Exact source / physical SKU / formula remain unverified |
| `4d5b22c7` | 휩드 머그트리 비건 팩클렌저 130g | null | Product name indicates **130g** only; never coerce to ml |
| `4f918d80` | 마녀공장 퓨어 소이빈 클렌징 폼 | 160 | Exact source / physical SKU / formula remain unverified |
| `63a958c4` | 라로슈포제 에빠끌라 딥 클렌징 포밍 크림 | 125 | Exact source / physical SKU / formula remain unverified |
| `c24a599b` | 블랑네이처 아크네 클렌징 폼 | 150 | Exact source / physical SKU / formula remain unverified |
| `e3ebe3ff` | 라곰 셀럽 젤 투 워터 클렌저 | 170 | Manufacturer-page research **lead suggests 220ml**, source/SKU and formulation equivalence unverified |
| `ed434d86` | 휩드 유자몽 비건 팩클렌저 130g | null | Product name indicates **130g** only |
| `fa793e6b` | 라곰 셀럽 마이크로 폼 클렌저 | 120 | Manufacturer-page research **lead suggests 150ml**, source/SKU and formulation equivalence unverified |
| `fb7ca4ea` | 제로이드 포밍 클렌저 | 240 | Historical official page research lead did **not** verify 240ml exact package |
| `ff9fe0cf` | 휩드 무화버터 비건 팩클렌저 130g | null | Product name indicates **130g** only |

As of read:
- 10 intake records, **all `SUBJECT_CREATION_REQUIRED` / `REVIEW_REQUIRED`**.
- 20 research tasks total, **two per existing Product**.
- Attached Product Fact Subject **0**, attached `product_offers` **0**, resolved `product_source_bindings` **0** for these ten.
- No amount in `products.size_ml`, Product name or research lead has been promoted here to a manufacturer-verified physical presentation.
- With no controlled Subject or official SKU binding, C2 exact-source formulation comparison for these 10 must remain `FORMULA_UNRESOLVED`. Missing `low_ph` / `deep_cleansing` never means `false`.

## Existing governed PF-1 binding compatibility

Live schema uses `product_evidence_source_subject_bindings.presentation_metadata` and `equivalent_presentation_match`; query returned 2 such existing rows outside this ten-product cohort. Legacy examples describe `source_fill_size_ml/target_fill_size_ml` or `bundle_units/presentation_relation`, but do not by themselves include independently verified exact seller SKU-to-presentation scope. The read-only R2 adapter holds these incomplete rows rather than manufacturing exact SKU identity.

## Approval and implementation boundaries

- Catalog Product UUIDs preserved, Product/Offer/Subject/Fact/G2 writes **0** in this track.
- No unauthorized external official-site fetch, migration, approval, recommendation runtime change, or deployment.
- New tables `product_presentations`, `offer_components`, `presentation_formulation_links` **not created**; existing relational owners first.
- R1/C1 code classification and synthetic verification may PASS independently of actual C1 evidence collection. **C1 exact verified SKU intake is still HOLD** for all ten.
- R2/C2 code gates are not actual proof of same/different formulations. Protected R3 enrollment/confirmation and R4/C4 v1-to-v2 runtime behavior require independent authorized inputs and PR #1390 integration.
