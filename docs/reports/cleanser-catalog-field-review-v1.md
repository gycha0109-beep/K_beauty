# Cleanser Catalog Field Review v1

- Repository base SHA: `2fe2b1f8f629b06a65103964a2414aaaeb963fab`
- Corpus version: `cleanser-catalog-field-review-v1`
- Review policy: `cleanser-metadata-review-policy-v1`
- Metadata schema: `cleanser-metadata-v1`
- Field evidence schema: `product-review-field-evidence-v1`
- Evidence access freeze: `2026-08-07T11:45:00+09:00`
- Canonical corpus SHA-256: `2cfa18b985ae76ebd50b7d471f7b242efb633a4e5cbec7cff8e1b8ab823e1f27`

> **CATALOG FIELD REVIEW CORPUS** only. It is not an Admin v2 import bundle. Hosted `products.cleansing_profile` is comparison-only legacy data and was not used as a seed, default, majority vote, or decision input.

## 1. Catalog snapshot

| Metric | Count |
| --- | ---: |
| cleanser rows | 26 |
| unique product IDs | 26 |
| legacy `low_ph` | 10 |
| legacy `balanced` | 7 |
| legacy `deep_clean` | 9 |
| legacy `null` | 0 |

All 26 product identities were locked. Five rows carry renewal/name/size notes; none is a category identity conflict.

## 2. Reviewed result

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

| Legacy comparison | Count |
| --- | ---: |
| legacy unchanged | 17 |
| legacy changed to another valid enum | 5 |
| legacy → null | 4 |
| null → valid | 0 |

## 3. Legacy → reviewed transition matrix

| Legacy | → low_ph | → balanced | → deep_clean | → reviewed_unknown | → reviewed_conflict | → not_applicable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `low_ph` | 9 | 0 | 0 | 0 | 1 | 0 |
| `balanced` | 1 | 0 | 4 | 1 | 1 | 0 |
| `deep_clean` | 0 | 0 | 8 | 0 | 1 | 0 |
| `null` | 0 | 0 | 0 | 0 | 0 | 0 |

## 4. 26-product matrix

| # | Product ID | Product | Legacy | Reviewed | State | Confidence | Evidence | Source types | Rationale |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- |
| 1 | `65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc` | YBK 릴리프 하이드레이션 라이트 폼 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official | Exact official mildly-acidic claim. |
| 2 | `6d560546-80f1-4ccf-9d2c-34023722d2a7` | 닥터지 약산성 레드 블레미쉬 클리어 수딩 폼 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official | Exact official mildly-acidic claim. |
| 3 | `cb04b777-9a57-4246-9431-3018638354db` | 라로슈포제 똘러리앙 퓨리파잉 포밍 클렌저 | `balanced` | `null` | `reviewed_unknown` | `unknown` | 1 | official | Natural-pH maintenance does not establish low pH; no explicit deep/pore role; balanced is not a fallback. |
| 4 | `d7bb44e4-d585-41ca-8a74-04781470d1de` | 라운드랩 1025 독도 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official | Official pH 5.0–6.0. |
| 5 | `c8f78d00-85b9-4850-b464-e8a0d815b2d8` | 라운드랩 자작나무 수분 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official | Official pH 5.0–6.0. |
| 6 | `8889342d-d9a2-454b-aa27-60d4934b9978` | 메디필 레드 락토 콜라겐 클리어 폼클렌저 2.0 | `balanced` | `deep_clean` | `reviewed_valid` | `high` | 1 | official | Official pore-impurity cleansing claim. |
| 7 | `51d526de-b127-47c4-83f1-64fc1ec4aa10` | 메디힐 더마 크림 팩 클렌저 마데카소사이드 | `balanced` | `deep_clean` | `reviewed_valid` | `medium` | 2 | documentation | Consistent mask-to-foam deep pore-cleansing positioning. |
| 8 | `0b59cb66-ab03-4a0d-815e-7a94a5c7ae65` | 메이크프렘 세이프 미 클렌징폼 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official | Official pH 5.5 claim. |
| 9 | `5448b8c3-cf87-4561-a699-3baf3dcb3dab` | 비알머드 리커버리 머드 팩투폼 클렌저 | `balanced` | `null` | `reviewed_conflict` | `unknown` | 3 | official, review, conflict | Mildly-acidic and pore/sebum-cleansing evidence support independent enum axes. |
| 10 | `cd3b66be-cddc-47e1-906f-a871dea84412` | 비플레인 녹두 약산성 클렌징폼 | `low_ph` | `null` | `reviewed_conflict` | `unknown` | 3 | official, conflict | Same official page supports pH 5.5 and Deep Pore Cleansing. |
| 11 | `e6c3f88c-6908-401f-83d1-a5164f1dd60a` | 센카 퍼펙트 휩 페이셜 워시 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official | Official claim removes dirt from deep inside pores. |
| 12 | `d0b4789c-bc0a-46e1-8317-ce498377333e` | 션리 다시마 앰플 클렌징폼 | `balanced` | `deep_clean` | `reviewed_valid` | `low` | 2 | documentation, review | Secondary retailer supports pore deep cleansing; exact-product reviews conflict on pH, so no low-pH authority is claimed. |
| 13 | `b46ca581-7a4e-4cf1-b599-b9fdc026885d` | 수이스킨 어린새싹 딥 클렌징폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official | Official deep cleansing and excess-sebum/blackhead role. |
| 14 | `0bced9fe-aa08-4982-bb4a-03fb9ed509c1` | 아누아 어성초 쿼세티놀 모공 딥 클렌징 폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official | Explicit pore deep-cleansing positioning. |
| 15 | `2fddc273-d7ee-4034-a399-3bfd2cfcafd4` | 아렌시아 프레시 그린 떡솝 클렌저 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official | Pore-decongestion, blackhead and sebum-regulation claims. |
| 16 | `f2a697ce-43d9-4a9a-b110-1f332bc29b50` | 아비브 딥 클린 폼 클렌저 수분초 히알루론 폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official | Deep-cleansing and pore-impurity positioning. |
| 17 | `d4f64d02-6d35-435b-8269-b6ed7cd34bad` | 에스네이처 아쿠아 라이스 약산성 클렌징폼 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official | Exact official mildly-acidic product identity. |
| 18 | `635aa0fd-aabb-495e-b68f-42b1135df544` | 에스트라 아토베리어365 포밍 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official | Official mildly-acidic pH cleansing. |
| 19 | `9d47de96-3227-494b-a8aa-2a4a3b7959d8` | 이니스프리 화산송이 모공 클렌징폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official | Official deep cleansing of pore impurities and sebum. |
| 20 | `3f83bb85-cc53-4aa0-a0f0-e08535288749` | 주미소 포어 퓨리파잉 살리실산 클렌저 | `deep_clean` | `null` | `reviewed_conflict` | `unknown` | 3 | official, conflict | Same official page states LOW pH and deep pore cleansing. |
| 21 | `0def9373-087e-4998-8ef1-7f4cbdac40e4` | 코스알엑스 약산성 굿모닝 젤 클렌저 | `low_ph` | `low_ph` | `reviewed_valid` | `high` | 1 | official | Official pH measurement. |
| 22 | `50d8285d-9f90-4437-9427-ecc93e9fa055` | 토리든 다이브인 저분자 히알루론산 클렌징 폼 | `low_ph` | `low_ph` | `reviewed_valid` | `medium` | 2 | official, documentation | Identity re-locked; current specs state pH ≤ 6.5. |
| 23 | `fbe265d2-8457-4c4f-96e2-7a08be0e5073` | 토리든 밸런스풀 시카 포어 클렌징 폼 | `balanced` | `deep_clean` | `reviewed_valid` | `high` | 1 | official | Explicit pore/sebum impurity cleansing. |
| 24 | `63300ce0-9bb7-4ce5-98d5-5c59ae283cda` | 풀리 그린 토마토 클레이 팩 클렌저 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official | Pore-purifying, sebum-control and clay adsorption positioning. |
| 25 | `15420430-2a68-49e2-ab53-716d9c4ff45e` | 프리메이 햇쌀 데일리 폼 클렌저 | `balanced` | `low_ph` | `reviewed_valid` | `low` | 1 | review | Exact-product review corpus supports mildly-acidic cleansing; no direct official pH page found. |
| 26 | `009e0339-fa00-429e-a1c2-2a23eb4707f8` | 한율 어린쑥 클렌징 흡착 팩폼 | `deep_clean` | `deep_clean` | `reviewed_valid` | `high` | 1 | official | Sebum adsorption, pore-impurity removal and blackhead/old-sebum pack use. |

## 5. Conflict / unknown

### `reviewed_conflict`

| Product | Supported values | Classification |
| --- | --- | --- |
| 비알머드 리커버리 머드 팩투폼 클렌저 | `low_ph` + `deep_clean` | cross-source independent-axis support |
| 비플레인 녹두 약산성 클렌징폼 | `low_ph` + `deep_clean` | same official source, independent axes |
| 주미소 포어 퓨리파잉 살리실산 클렌저 | `low_ph` + `deep_clean` | same official source, independent axes |

These are enum-expression conflicts: the current single `cleansing_profile` field cannot safely represent pH and cleansing-purpose axes simultaneously. They are not automatically source errors.

### `reviewed_unknown`

- **라로슈포제 똘러리앙 퓨리파잉 포밍 클렌저** — official material supports gentle daily cleansing and maintenance of natural pH but does not establish a low-pH range, deep/pore-cleansing purpose, or a concrete `balanced` contract.

### Source-integrity note

- **션리 다시마 앰플 클렌징폼** — exact-product review material contains both gently-acidic and slightly-alkaline pH descriptions. Those review statements are therefore recorded as `supported_value = null`; they are not cherry-picked into `low_ph`. `deep_clean` remains only low-confidence because its positive evidence is secondary retailer documentation.
- Official-vs-official factual contradiction requiring `BLOCKED_EVIDENCE_SOURCE_INTEGRITY`: **0**.
- `balanced` was never used as an unknown/default bucket.

## 6. Product identity / renewal notes

| Product | Note |
| --- | --- |
| 닥터지 약산성 레드 블레미쉬 클리어 수딩 폼 | Current official listing is a 200 ml size of the same named formula. |
| 비알머드 리커버리 머드 팩투폼 클렌저 | Hosted/Hwahae uses “Recovery”; current BRMUD material also shows “Relief” renewal/alias wording. Product family and role align. |
| 에스네이처 아쿠아 라이스 약산성 클렌징폼 | Official English page inspected is an 80 ml size of the same formula. |
| 이니스프리 화산송이 모공 클렌징폼 | Current official name adds “BHA”; treated as naming/renewal lineage. |
| 토리든 밸런스풀 시카 포어 클렌징 폼 | Current naming adds “Pore Control”; treated as naming/renewal lineage. |

## 7. Evidence integrity

| Evidence type | Record count |
| --- | ---: |
| `official_product_page` | 25 |
| `manufacturer_documentation` | 4 |
| `ingredient_list` | 0 |
| `review_corpus` | 3 |
| `manual_conflict_record` | 3 |
| all evidence records | 35 |
| unique source URLs | 31 |

The offline verifier checks safe HTTPS URLs, unique offline `catalog_evidence_id` values, exact allowed profile/state/confidence/evidence types, review-state invariants, legacy non-seeding, absence of fake Admin lineage keys, zero production-invariance counters, recomputed summaries, and the canonical logical-corpus SHA-256.

Because Admin v2 has no dedicated retailer evidence type, a small number of trusted retailer/manufacturer-supplied product details are classified as `manufacturer_documentation` **only in this offline corpus**. This corpus is not directly ingestible; the mapping must be revisited when a legitimate candidate/export lineage exists.

## 8. Production invariance

```text
Production DB writes = 0
Hosted migration = 0
Admin v2 activation = 0
recommendation activation = 0
score/ranking delta = 0
#167 delta = 0
runtime application code delta = 0
workflow delta = 0
```

## 9. Schema implication

The three robust conflicts reinforce that `cleansing_profile` currently mixes independent concepts. A future schema may separate `ph_profile`, `cleansing_strength`, and `cleansing_use_cases[]`. This report records that limitation only; it does not implement a schema change.
