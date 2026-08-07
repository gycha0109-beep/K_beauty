# Cleanser Catalog Field Review v1 — Offline Evidence Source Taxonomy Corrected

- Repository base SHA: `2fe2b1f8f629b06a65103964a2414aaaeb963fab`
- Corpus version: `cleanser-catalog-field-review-v1`
- Review policy: `cleanser-metadata-review-policy-v1`
- Metadata schema: `cleanser-metadata-v1`
- Admin v2 field evidence schema reference: `product-review-field-evidence-v1`
- Offline source taxonomy: `cleanser-catalog-source-taxonomy-v1`
- Historical pre-taxonomy-correction SHA-256: `2cfa18b985ae76ebd50b7d471f7b242efb633a4e5cbec7cff8e1b8ab823e1f27`
- Final canonical corpus SHA-256: `73645cbcd9bfecdb559297ed2a7bab3e50d9be560dee33460071eadba09b1241`
- Taxonomy corrected at: `2026-08-07T12:59:00+09:00`

> **CATALOG FIELD REVIEW CORPUS only.** This is not an Admin v2 import bundle. `source_class` describes offline provenance. `admin_v2_evidence_type_candidate` is only a future mapping candidate, never an imported Admin evidence row. `admin_v2_ingestion_eligible=false` means the source must not be used in a legitimate Admin v2 import without replacement or separate mapping approval.

## 1. Review decisions — accepted and unchanged

| State / value | Count |
| --- | ---: |
| `reviewed_valid` | 22 |
| `reviewed_unknown` | 1 |
| `reviewed_conflict` | 3 |
| `not_applicable` | 0 |
| reviewed `low_ph` | 10 |
| reviewed `balanced` | 0 |
| reviewed `deep_clean` | 12 |
| reviewed `null` | 4 |

The accepted decision set is unchanged by this taxonomy correction: BRMUD, beplain, and Jumiso remain `reviewed_conflict`; La Roche-Posay remains `reviewed_unknown`. ShionLe and Torriden receive stronger official source replacements, but their existing profile/state/confidence decisions are intentionally preserved because this task corrects provenance taxonomy rather than re-runs the field review.

## 2. Offline source taxonomy

Allowed `source_class` values:

```text
official_product_page
manufacturer_documentation
official_brand_site_listing
retailer_product_page
marketplace_product_page
price_comparison_product_page
ingredient_list
review_corpus
manual_conflict_record
```

Allowed `admin_v2_evidence_type_candidate` values are the existing Admin v2 evidence types only; `null` is also allowed. Commerce and non-product-specific source classes are not automatically mapped.

| Source class | Count | Admin v2 mapping behavior |
| --- | ---: | --- |
| `official_product_page` | 27 | candidate `official_product_page` when the evidence record is ingestion eligible |
| `manufacturer_documentation` | 0 | candidate `manufacturer_documentation` when the evidence record is ingestion eligible |
| `official_brand_site_listing` | 1 | `null` candidate / ingestion ineligible by default |
| `retailer_product_page` | 1 | `null` candidate / ingestion ineligible by default |
| `marketplace_product_page` | 0 | `null` candidate / ingestion ineligible by default |
| `price_comparison_product_page` | 0 | `null` candidate / ingestion ineligible by default |
| `ingredient_list` | 0 | candidate `ingredient_list` when the evidence record is ingestion eligible |
| `review_corpus` | 3 | candidate `review_corpus` when the evidence record is ingestion eligible |
| `manual_conflict_record` | 3 | candidate `manual_conflict_record` when the evidence record is ingestion eligible |

Historical pre-correction `manufacturer_documentation` count was **4**. Final `manufacturer_documentation` source-class count is **0**; the four former records were audited individually rather than carried forward under an Admin-looking label.

## 3. Misclassified / weakly classified sources corrected

| Product | Historical source | Final treatment | Admin v2 effect |
| --- | --- | --- | --- |
| Mediheal Derma Cream Pack Cleanser Madecassoside | `medihealist.com/` previously `manufacturer_documentation` | `official_brand_site_listing`; the current root listing names the exact cleanser and deep/pore-cleansing claim, but the root URL is not treated as a product-specific evidence address | candidate `null`, ingestion ineligible |
| Mediheal Derma Cream Pack Cleanser Madecassoside | Boots previously `manufacturer_documentation` | `retailer_product_page` | candidate `null`, ingestion ineligible |
| ShionLe Laminaria Ampoule Cleansing Foam | Coupang previously `manufacturer_documentation` | Coupang evidence removed and replaced by exact official ShionLe product page stating sebum adsorption/removal | `official_product_page`, ingestion eligible |
| Torriden Dive-In Cleansing Foam | Danawa previously `manufacturer_documentation` | Danawa evidence removed and replaced by exact official Torriden English product page stating mildly acidic cleansing foam | `official_product_page`, ingestion eligible |

No other commerce source was found under an Admin v2-like `manufacturer_documentation` label in the 35-record corpus.

## 4. Admin v2 ingestion readiness

| Readiness | Count | Meaning in this corpus |
| --- | ---: | --- |
| `eligible_from_current_evidence` | 22 | At least one current evidence record honestly maps to an existing Admin v2 type and supports the accepted review state/value. |
| `evidence_upgrade_required` | 1 | Offline decision remains accepted, but its decision-supporting evidence is not legitimate Admin v2 ingestion evidence yet. |
| `schema_mapping_required` | 3 | Accepted conflict semantics require explicit mapping/adjudication before legitimate Admin v2 ingestion. |

### Product-level non-ready list

| Product | Review result | Readiness | Reason |
| --- | --- | --- | --- |
| 메디힐 더마 크림 팩 클렌저 마데카소사이드 | `deep_clean` / `reviewed_valid` / `medium` | `evidence_upgrade_required` | Offline deep_clean decision remains accepted, but the exact claim is currently supported only by a brand-site root listing and a retailer page; a product-specific official/manufacturer source is required before legitimate Admin v2 ingestion. |
| 비알머드 리커버리 머드 팩투폼 클렌저 | `null` / `reviewed_conflict` / `unknown` | `schema_mapping_required` | The offline conflict decision is accepted, but pH and cleansing-purpose evidence occupy independent semantic axes; legitimate Admin v2 conflict mapping requires explicit coordinator review. |
| 비플레인 녹두 약산성 클렌징폼 | `null` / `reviewed_conflict` / `unknown` | `schema_mapping_required` | The offline conflict decision is accepted, but pH and cleansing-purpose evidence occupy independent semantic axes; legitimate Admin v2 conflict mapping requires explicit coordinator review. |
| 주미소 포어 퓨리파잉 살리실산 클렌저 | `null` / `reviewed_conflict` / `unknown` | `schema_mapping_required` | The offline conflict decision is accepted, but pH and cleansing-purpose evidence occupy independent semantic axes; legitimate Admin v2 conflict mapping requires explicit coordinator review. |

Therefore this corpus does **not** assert `ADMIN_V2_INGESTION_READY_26_OF_26`.

## 5. 26-product matrix

| # | Product ID | Product | Legacy | Reviewed | State | Confidence | Evidence | Source classes | Ingestion readiness |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- |
| 1 | `65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc` | YBK 릴리프 하이드레이션 라이트 폼 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 2 | `6d560546-80f1-4ccf-9d2c-34023722d2a7` | 닥터지 약산성 레드 블레미쉬 클리어 수딩 폼 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 3 | `cb04b777-9a57-4246-9431-3018638354db` | 라로슈포제 똘러리앙 퓨리파잉 포밍 클렌저 | `balanced` | `null` | `reviewed_unknown` | `unknown` | 1 | official_product_page | `eligible_from_current_evidence` |
| 4 | `d7bb44e4-d585-41ca-8a74-04781470d1de` | 라운드랩 1025 독도 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 5 | `c8f78d00-85b9-4850-b464-e8a0d815b2d8` | 라운드랩 자작나무 수분 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 6 | `8889342d-d9a2-454b-aa27-60d4934b9978` | 메디필 레드 락토 콜라겐 클리어 폼클렌저 2.0 | `balanced` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 7 | `51d526de-b127-47c4-83f1-64fc1ec4aa10` | 메디힐 더마 크림 팩 클렌저 마데카소사이드 | `balanced` | `deep_clean` | `reviewed_valid` | `medium` | 2 | official_brand_site_listing, retailer_product_page | `evidence_upgrade_required` |
| 8 | `0b59cb66-ab03-4a0d-815e-7a94a5c7ae65` | 메이크프렘 세이프 미 클렌징폼 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 9 | `5448b8c3-cf87-4561-a699-3baf3dcb3dab` | 비알머드 리커버리 머드 팩투폼 클렌저 | `balanced` | `null` | `reviewed_conflict` | `unknown` | 3 | manual_conflict_record, official_product_page, review_corpus | `schema_mapping_required` |
| 10 | `cd3b66be-cddc-47e1-906f-a871dea84412` | 비플레인 녹두 약산성 클렌징폼 | `low_ph` | `null` | `reviewed_conflict` | `unknown` | 3 | manual_conflict_record, official_product_page | `schema_mapping_required` |
| 11 | `e6c3f88c-6908-401f-83d1-a5164f1dd60a` | 센카 퍼펙트 휩 페이셜 워시 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 12 | `d0b4789c-bc0a-46e1-8317-ce498377333e` | 션리 다시마 앰플 클렌징폼 | `balanced` | `deep_clean` | `reviewed_valid` | `low` | 2 | official_product_page, review_corpus | `eligible_from_current_evidence` |
| 13 | `b46ca581-7a4e-4cf1-b599-b9fdc026885d` | 수이스킨 어린새싹 딥 클렌징폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 14 | `0bced9fe-aa08-4982-bb4a-03fb9ed509c1` | 아누아 어성초 쿼세티놀 모공 딥 클렌징 폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 15 | `2fddc273-d7ee-4034-a399-3bfd2cfcafd4` | 아렌시아 프레시 그린 떡솝 클렌저 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 16 | `f2a697ce-43d9-4a9a-b110-1f332bc29b50` | 아비브 딥 클린 폼 클렌저 수분초 히알루론 폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 17 | `d4f64d02-6d35-435b-8269-b6ed7cd34bad` | 에스네이처 아쿠아 라이스 약산성 클렌징폼 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 18 | `635aa0fd-aabb-495e-b68f-42b1135df544` | 에스트라 아토베리어365 포밍 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 19 | `9d47de96-3227-494b-a8aa-2a4a3b7959d8` | 이니스프리 화산송이 모공 클렌징폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 20 | `3f83bb85-cc53-4aa0-a0f0-e08535288749` | 주미소 포어 퓨리파잉 살리실산 클렌저 | `deep_clean` | `null` | `reviewed_conflict` | `unknown` | 3 | manual_conflict_record, official_product_page | `schema_mapping_required` |
| 21 | `0def9373-087e-4998-8ef1-7f4cbdac40e4` | 코스알엑스 약산성 굿모닝 젤 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 22 | `50d8285d-9f90-4437-9427-ecc93e9fa055` | 토리든 다이브인 저분자 히알루론산 클렌징 폼 | `low_ph` | `low_ph` | `reviewed_valid` | `medium` | 2 | official_product_page | `eligible_from_current_evidence` |
| 23 | `fbe265d2-8457-4c4f-96e2-7a08be0e5073` | 토리든 밸런스풀 시카 포어 클렌징 폼 | `balanced` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 24 | `63300ce0-9bb7-4ce5-98d5-5c59ae283cda` | 풀리 그린 토마토 클레이 팩 클렌저 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |
| 25 | `15420430-2a68-49e2-ab53-716d9c4ff45e` | 프리메이 햇쌀 데일리 폼 클렌저 | `balanced` | `low_ph` | `reviewed_valid` | `low` | 1 | review_corpus | `eligible_from_current_evidence` |
| 26 | `009e0339-fa00-429e-a1c2-2a23eb4707f8` | 한율 어린쑥 클렌징 흡착 팩폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official_product_page | `eligible_from_current_evidence` |

## 6. Manual conflict record semantics

`manual_conflict_record` remains an allowed offline source class and an Admin v2 type candidate, but it is **not physical-product evidence**. Each record explicitly states that it is only a manual adjudication record documenting why independently supported values are not collapsed into the single `cleansing_profile` enum. Its `supported_value` is always `null`.

The three accepted conflicts remain:

- BRMUD Recovery Mud Pack to Foam — `low_ph` + `deep_clean`
- beplain Mung Bean pH-Balanced Cleansing Foam — `low_ph` + `deep_clean`
- Jumiso Pore-Purifying Salicylic Acid Cleanser — `low_ph` + `deep_clean`

## 7. Evidence integrity summary

| Metric | Count |
| --- | ---: |
| evidence records | 35 |
| unique source URLs | 31 |
| Admin candidate `official_product_page` | 27 |
| Admin candidate `manufacturer_documentation` | 0 |
| Admin candidate `ingredient_list` | 0 |
| Admin candidate `review_corpus` | 3 |
| Admin candidate `manual_conflict_record` | 3 |
| Admin candidate `null` | 2 |

All `source_reference` values remain HTTPS. `catalog_evidence_id` is offline-corpus identity only and is never reused as Admin v2 `evidence_id` or `candidate_id`.

## 8. Verifier contract

The offline verifier now checks:

- explicit allowed `source_class` taxonomy;
- allowed `admin_v2_evidence_type_candidate` or `null`;
- boolean `admin_v2_ingestion_eligible`;
- commerce and non-product-specific brand-site sources remain unmapped/ineligible;
- ingestion-eligible evidence has a non-null, source-honest Admin v2 type candidate;
- `eligible_from_current_evidence` has ingestion-eligible evidence supporting the accepted state/value;
- `evidence_upgrade_required` does not already possess ingestion-eligible evidence supporting its reviewed value;
- `schema_mapping_required` is tied to accepted conflict semantics;
- manual conflict records remain adjudication-only with `supported_value=null`;
- accepted 26-product decisions, legacy comparison, safe HTTPS, forbidden fake Admin lineage, production invariance, and canonical digest remain valid.

## 9. Production invariance

```text
Production DB writes = 0
Hosted migration = 0
products.cleansing_profile writes = 0
Admin v2 import/confirm = 0
Admin activation = 0
recommendation activation = 0
score/ranking delta = 0
#167 delta = 0
runtime application code delta = 0
workflow delta = 0
```

## 10. Freeze status

```text
CLEANSER_CATALOG_REVIEW_DECISIONS_ACCEPTED
OFFLINE_EVIDENCE_SOURCE_TAXONOMY_CORRECTED
ADMIN_V2_INGESTION_READINESS_CLASSIFIED
CATALOG_REVIEW_READY_FOR_FINAL_MERGE_APPROVAL
```

Not asserted:

```text
ADMIN_V2_INGESTION_READY_26_OF_26
```
