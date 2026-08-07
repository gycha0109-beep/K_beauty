# Cleanser Catalog Field Review v1

- Repository base SHA: `2fe2b1f8f629b06a65103964a2414aaaeb963fab`
- Corpus version: `cleanser-catalog-field-review-v1`
- Review policy: `cleanser-metadata-review-policy-v1`
- Metadata schema: `cleanser-metadata-v1`
- Field evidence schema: `product-review-field-evidence-v1`
- Evidence access freeze: `2026-08-07T11:45:00+09:00`
- Canonical corpus SHA-256: `02f5c3f6909dd8e0d51a4e13bc798379d9839f1560d8b60dac54585a04a41658`
- Physical layout: `cleanser-field-review-v1.json` index + 4 immutable product shards; verifier assembles one logical 26-product corpus before digest validation.

> This is a **CATALOG FIELD REVIEW CORPUS**, not an Admin v2 import bundle. Legacy `products.cleansing_profile` values were retained only as comparison fields and were not used to seed review decisions. No Production/Hosted write or migration is part of this review.

## 1. Catalog snapshot

| Metric | Count |
| --- | ---: |
| cleanser rows | 26 |
| unique product IDs | 26 |
| legacy `low_ph` | 10 |
| legacy `balanced` | 7 |
| legacy `deep_clean` | 9 |
| legacy `null` | 0 |

## 2. Reviewed result

| State / value | Count |
| --- | ---: |
| `reviewed_valid` | 21 |
| `reviewed_unknown` | 1 |
| `reviewed_conflict` | 4 |
| `not_applicable` | 0 |
| reviewed `low_ph` | 10 |
| reviewed `balanced` | 0 |
| reviewed `deep_clean` | 11 |
| reviewed `null` | 5 |

### Legacy comparison

| Comparison | Count |
| --- | ---: |
| legacy unchanged | 17 |
| legacy changed to another valid enum | 4 |
| legacy → null | 5 |
| null → valid | 0 |

## 3. Legacy → reviewed transition matrix

| Legacy | → low_ph | → balanced | → deep_clean | → reviewed_unknown | → reviewed_conflict | → not_applicable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `low_ph` | 9 | 0 | 0 | 0 | 1 | 0 |
| `balanced` | 1 | 0 | 3 | 1 | 2 | 0 |
| `deep_clean` | 0 | 0 | 8 | 0 | 1 | 0 |
| `null` | 0 | 0 | 0 | 0 | 0 | 0 |

## 4. 26-product review matrix

| # | Product ID | Product | Legacy | Reviewed | State | Confidence | Evidence | Source types | Decision rationale |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- |
| 1 | `65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc` | YBK 릴리프 하이드레이션 라이트 폼 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | Direct official mildly-acidic/pH claim supports low_ph; gentle/hydrating language is not used as the decision basis. |
| 2 | `6d560546-80f1-4ccf-9d2c-34023722d2a7` | 닥터지 약산성 레드 블레미쉬 클리어 수딩 폼 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | The exact official product name and tags explicitly state mildly acidic cleansing. |
| 3 | `cb04b777-9a57-4246-9431-3018638354db` | 라로슈포제 똘러리앙 퓨리파잉 포밍 클렌저 | `balanced` | `null` | `reviewed_unknown` | `unknown` | 1 | official_product_page | Official material says it maintains natural pH but gives no low-pH range and does not establish a deep/pore-cleaning role. Balanced is not a fallback, so the field remains unknown. |
| 4 | `d7bb44e4-d585-41ca-8a74-04781470d1de` | 라운드랩 1025 독도 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | Official pH 5.0–6.0 directly supports low_ph. |
| 5 | `c8f78d00-85b9-4850-b464-e8a0d815b2d8` | 라운드랩 자작나무 수분 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | Official pH 5.0–6.0 directly supports low_ph. |
| 6 | `8889342d-d9a2-454b-aa27-60d4934b9978` | 메디필 레드 락토 콜라겐 클리어 폼클렌저 2.0 | `balanced` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | Official 99.4% pore-impurity cleansing claim is a direct pore-cleansing purpose, supporting deep_clean. |
| 7 | `51d526de-b127-47c4-83f1-64fc1ec4aa10` | 메디힐 더마 크림 팩 클렌저 마데카소사이드 | `balanced` | `deep_clean` | `reviewed_valid` | `medium` | 2 | manufacturer_documentation | Product documentation consistently positions this mask-to-foam cleanser for deep pore cleansing; no low-pH evidence was found. |
| 8 | `0b59cb66-ab03-4a0d-815e-7a94a5c7ae65` | 메이크프렘 세이프 미 클렌징폼 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | Official pH 5.5 mildly acidic claim directly supports low_ph. |
| 9 | `5448b8c3-cf87-4561-a699-3baf3dcb3dab` | 비알머드 리커버리 머드 팩투폼 클렌저 | `balanced` | `null` | `reviewed_conflict` | `unknown` | 3 | manual_conflict_record, official_product_page, review_corpus | Official mildly-acidic positioning and independent pore/sebum-cleansing evidence coexist. The current enum conflates pH and cleansing-use axes, so no single value is selected. |
| 10 | `cd3b66be-cddc-47e1-906f-a871dea84412` | 비플레인 녹두 약산성 클렌징폼 | `low_ph` | `null` | `reviewed_conflict` | `unknown` | 3 | manual_conflict_record, official_product_page | The official page itself supports pH 5.5 and Deep Pore Cleansing. The current enum cannot encode both axes, so this is reviewed_conflict. |
| 11 | `e6c3f88c-6908-401f-83d1-a5164f1dd60a` | 센카 퍼펙트 휩 페이셜 워시 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | Official SENKA documentation states the standard Perfect Whip removes dirt from deep inside pores, supporting deep_clean. |
| 12 | `d0b4789c-bc0a-46e1-8317-ce498377333e` | 션리 다시마 앰플 클렌징폼 | `balanced` | `null` | `reviewed_conflict` | `unknown` | 3 | manual_conflict_record, manufacturer_documentation, review_corpus | Retail/product documentation supports pore deep cleansing while exact-product review evidence supports mildly acidic cleansing. With no authoritative source resolving the two axes, the field is conflict rather than a forced value. |
| 13 | `b46ca581-7a4e-4cf1-b599-b9fdc026885d` | 수이스킨 어린새싹 딥 클렌징폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | Official Suiskin product documentation explicitly defines deep cleansing and removal of excess sebum/blackheads/dead skin. |
| 14 | `0bced9fe-aa08-4982-bb4a-03fb9ed509c1` | 아누아 어성초 쿼세티놀 모공 딥 클렌징 폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | The official product identity and positioning explicitly center pore deep cleansing. |
| 15 | `2fddc273-d7ee-4034-a399-3bfd2cfcafd4` | 아렌시아 프레시 그린 떡솝 클렌저 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | Official pore-decongestion, blackhead and sebum-regulation claims support deep_clean. |
| 16 | `f2a697ce-43d9-4a9a-b110-1f332bc29b50` | 아비브 딥 클린 폼 클렌저 수분초 히알루론 폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | Official deep-cleansing positioning and pore-impurity performance support deep_clean. |
| 17 | `d4f64d02-6d35-435b-8269-b6ed7cd34bad` | 에스네이처 아쿠아 라이스 약산성 클렌징폼 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | The official product name itself explicitly states mildly acidic cleansing. |
| 18 | `635aa0fd-aabb-495e-b68f-42b1135df544` | 에스트라 아토베리어365 포밍 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | Official AESTURA documentation explicitly states mildly acidic pH cleansing. |
| 19 | `9d47de96-3227-494b-a8aa-2a4a3b7959d8` | 이니스프리 화산송이 모공 클렌징폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | Current official Innisfree documentation explicitly says deep cleansing of pore impurities and sebum. |
| 20 | `3f83bb85-cc53-4aa0-a0f0-e08535288749` | 주미소 포어 퓨리파잉 살리실산 클렌저 | `deep_clean` | `null` | `reviewed_conflict` | `unknown` | 3 | manual_conflict_record, official_product_page | The same official product page says LOW pH and deeply cleanses pores. These are independent supported axes that cannot be represented together in the current enum. |
| 21 | `0def9373-087e-4998-8ef1-7f4cbdac40e4` | 코스알엑스 약산성 굿모닝 젤 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | Official COSRX pH measurement directly supports low_ph. |
| 22 | `50d8285d-9f90-4437-9427-ecc93e9fa055` | 토리든 다이브인 저분자 히알루론산 클렌징 폼 | `low_ph` | `low_ph` | `reviewed_valid` | `medium` | 2 | manufacturer_documentation, official_product_page | Official identity was re-locked and current product specifications state pH ≤ 6.5. Because the pH statement is secondary documentation rather than direct Torriden text, confidence is medium. |
| 23 | `fbe265d2-8457-4c4f-96e2-7a08be0e5073` | 토리든 밸런스풀 시카 포어 클렌징 폼 | `balanced` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | Official Balanceful documentation explicitly targets pore/sebum impurity cleansing, supporting deep_clean. |
| 24 | `63300ce0-9bb7-4ce5-98d5-5c59ae283cda` | 풀리 그린 토마토 클레이 팩 클렌저 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | Official pore-purifying, sebum-control and clay adsorption positioning supports deep_clean. |
| 25 | `15420430-2a68-49e2-ab53-716d9c4ff45e` | 프리메이 햇쌀 데일리 폼 클렌저 | `balanced` | `low_ph` | `reviewed_valid` | `low` | 1 | review_corpus | No official product page with machine-readable pH evidence was found, but the exact-product review corpus repeatedly identifies the cleanser as mildly acidic. This is valid but low-confidence secondary/review evidence. |
| 26 | `009e0339-fa00-429e-a1c2-2a23eb4707f8` | 한율 어린쑥 클렌징 흡착 팩폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | Official Hanyul documentation describes sebum adsorption, pore-impurity removal and blackhead/old-sebum pack use, supporting deep_clean. |

## 5. Conflict / unknown

### Reviewed conflicts

| Product | Supported values | Relationship | Why null |
| --- | --- | --- | --- |
| 비알머드 리커버리 머드 팩투폼 클렌저 | `low_ph`, `deep_clean` | `official_product_page_vs_review_corpus` | Official mildly-acidic positioning coexists with review-corpus pore/sebum cleansing evidence; no factual source error was established. |
| 비플레인 녹두 약산성 클렌징폼 | `low_ph`, `deep_clean` | `same_official_source` | The same official page states pH 5.5 and Deep Pore Cleansing. |
| 션리 다시마 앰플 클렌징폼 | `low_ph`, `deep_clean` | `retailer_documentation_vs_review_corpus` | Retail product documentation positions pore deep cleansing while exact-product review material describes mildly acidic cleansing; authority is insufficient to choose one axis. |
| 주미소 포어 퓨리파잉 살리실산 클렌저 | `low_ph`, `deep_clean` | `same_official_source` | The same official page states LOW pH and deep pore cleansing. |

### Reviewed unknowns

- **라로슈포제 똘러리앙 퓨리파잉 포밍 클렌저** — Official evidence establishes gentle daily cleansing and maintenance of natural pH, but not a low-pH range, deep/pore-cleansing purpose, or a concrete balanced-profile contract. Balanced is not used as a default.

## 6. Semantic conflict classification

- `enum_axis_conflict`: evidence supports independent pH and cleansing-purpose axes that the current single enum cannot represent together. This is a schema-expression problem, not automatically a bad source.
- `source_and_enum_axis_conflict`: lower-priority sources disagree or support different axes and there is not enough authority to select one.
- No official-vs-official factual contradiction requiring a source-integrity blocker was identified in this cohort.
- `balanced` was never used as a residual bucket. No product received `balanced` in this review.

## 7. Product identity / renewal notes

| Product | Status | Note |
| --- | --- | --- |
| 닥터지 약산성 레드 블레미쉬 클리어 수딩 폼 | `identity_locked_with_note` | The current official page is a 200 ml large-size listing of the same named cleanser; the size variant does not change field identity. |
| 비알머드 리커버리 머드 팩투폼 클렌저 | `identity_locked_with_note` | Hosted/Hwahae identity uses 'Recovery'; current BRMUD product information uses 'Relief' while URLs/marketing retain Recovery wording. Brand, pack-to-foam product family, size lineage and product role align; recorded as a renewal/name alias rather than a category mismatch. |
| 에스네이처 아쿠아 라이스 약산성 클렌징폼 | `identity_locked_with_note` | The official English page inspected is an 80 ml size of the same Aqua Rice Mildly Acidic Cleansing Foam; size differs from some catalog offers but field identity is unchanged. |
| 이니스프리 화산송이 모공 클렌징폼 | `identity_locked_with_note` | The current official Korean name includes 'BHA' (Volcanic BHA Pore Cleansing Foam) while Hosted uses the shorter legacy Volcanic Pore Cleansing Foam name. This is treated as current naming/renewal lineage, not a separate category. |
| 토리든 밸런스풀 시카 포어 클렌징 폼 | `identity_locked_with_note` | Current Torriden naming uses 'Balanceful Cica Pore Control Cleansing Foam'; Hosted stores 'Balanceful Cica Pore Cleansing Foam'. Product line and cleansing role align; recorded as naming/renewal drift. |

## 8. Evidence integrity

| Evidence type | Record count |
| --- | ---: |
| `official_product_page` | 25 |
| `manufacturer_documentation` | 4 |
| `ingredient_list` | 0 |
| `review_corpus` | 3 |
| `manual_conflict_record` | 4 |
| all evidence records | 36 |
| unique source URLs | 31 |

All evidence `source_reference` values are expected to be HTTPS and are re-validated by the offline verifier. `catalog_evidence_id` values belong only to this offline corpus and are not Admin v2 `evidence_id` values.

Because the current Admin v2 evidence type enum has no dedicated retailer type, a small number of trusted retailer/manufacturer-supplied product-detail records are classified as `manufacturer_documentation`. This corpus is not directly ingestible; that mapping must be revisited when a legitimate Admin v2 candidate/export lineage is created.

## 9. Production invariance

```text
Production DB writes = 0
Hosted migration = 0
Admin v2 activation = 0
recommendation activation = 0
score/ranking delta = 0
#167 delta = 0
```

## 10. Schema implication

The conflicts found here reinforce that `cleansing_profile` currently mixes at least two independent concepts. A future schema may separate `ph_profile`, `cleansing_strength`, and `cleansing_use_cases[]`; this report records the limitation only and does not implement that schema.
