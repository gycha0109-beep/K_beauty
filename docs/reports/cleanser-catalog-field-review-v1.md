# Cleanser Catalog Field Review v1 — Confidence / Evidence Authority Finalized

- Repository base SHA: `2fe2b1f8f629b06a65103964a2414aaaeb963fab`
- Corpus version: `cleanser-catalog-field-review-v1`
- Offline source taxonomy: `cleanser-catalog-source-taxonomy-v1`
- Confidence rubric: `cleanser-catalog-confidence-rubric-v1`
- Historical pre-taxonomy-correction SHA-256: `2cfa18b985ae76ebd50b7d471f7b242efb633a4e5cbec7cff8e1b8ab823e1f27`
- Historical pre-confidence-finalization SHA-256: `73645cbcd9bfecdb559297ed2a7bab3e50d9be560dee33460071eadba09b1241`
- Final canonical corpus SHA-256: `9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f`
- Confidence finalized at: `2026-08-07T13:53:00+09:00`

> **CATALOG FIELD REVIEW CORPUS only.** This finalization does not re-run the 26-product field review, change recommendation behavior, or perform Admin v2 ingestion. It only aligns frozen confidence with the authority of the already-frozen evidence.

## 1. Accepted review profile/state invariance

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

BRMUD, beplain, and Jumiso remain `reviewed_conflict`. La Roche-Posay remains `reviewed_unknown`. No `reviewed_profile` or `review_state` changed in this confidence finalization.

## 2. Locked confidence rubric

- `high`: exact-product `official_product_page` or real `manufacturer_documentation` is ingestion eligible and directly supports the `reviewed_profile`.
- `medium`: the profile remains supported, but direct high-authority support is absent or the official evidence is indirect/needs corroboration; the reason high is not warranted must be recorded.
- `low`: the profile is supported but positive support depends on secondary evidence such as retailer/marketplace/review corpus; direct ingestion-eligible official/manufacturer support must be absent.
- `unknown`: required for `reviewed_unknown`, `reviewed_conflict`, and `not_applicable`.

Confidence is evidence-authority metadata only. It does not activate ranking, penalties, recommendation policy, or Admin ingestion.

## 3. 22 reviewed_valid confidence audit

| # | Product | Profile | Final confidence | Direct ingestion-eligible official/manufacturer support | Audit |
| ---: | --- | --- | --- | --- | --- |
| 1 | YBK 릴리프 하이드레이션 라이트 폼 클렌저 | `low_ph` | `high` | yes: official_product_page | PASS |
| 2 | 닥터지 약산성 레드 블레미쉬 클리어 수딩 폼 | `low_ph` | `high` | yes: official_product_page | PASS |
| 3 | 라운드랩 1025 독도 클렌저 | `low_ph` | `high` | yes: official_product_page | PASS |
| 4 | 라운드랩 자작나무 수분 클렌저 | `low_ph` | `high` | yes: official_product_page | PASS |
| 5 | 메디필 레드 락토 콜라겐 클리어 폼클렌저 2.0 | `deep_clean` | `high` | yes: official_product_page | PASS |
| 6 | 메디힐 더마 크림 팩 클렌저 마데카소사이드 | `deep_clean` | `medium` | no | PASS |
| 7 | 메이크프렘 세이프 미 클렌징폼 | `low_ph` | `high` | yes: official_product_page | PASS |
| 8 | 센카 퍼펙트 휩 페이셜 워시 | `deep_clean` | `high` | yes: official_product_page | PASS |
| 9 | 션리 다시마 앰플 클렌징폼 | `deep_clean` | `high` | yes: official_product_page | PASS |
| 10 | 수이스킨 어린새싹 딥 클렌징폼 | `deep_clean` | `high` | yes: official_product_page | PASS |
| 11 | 아누아 어성초 쿼세티놀 모공 딥 클렌징 폼 | `deep_clean` | `high` | yes: official_product_page | PASS |
| 12 | 아렌시아 프레시 그린 떡솝 클렌저 | `deep_clean` | `high` | yes: official_product_page | PASS |
| 13 | 아비브 딥 클린 폼 클렌저 수분초 히알루론 폼 | `deep_clean` | `high` | yes: official_product_page | PASS |
| 14 | 에스네이처 아쿠아 라이스 약산성 클렌징폼 | `low_ph` | `high` | yes: official_product_page | PASS |
| 15 | 에스트라 아토베리어365 포밍 클렌저 | `low_ph` | `high` | yes: official_product_page | PASS |
| 16 | 이니스프리 화산송이 모공 클렌징폼 | `deep_clean` | `high` | yes: official_product_page | PASS |
| 17 | 코스알엑스 약산성 굿모닝 젤 클렌저 | `low_ph` | `high` | yes: official_product_page | PASS |
| 18 | 토리든 다이브인 저분자 히알루론산 클렌징 폼 | `low_ph` | `high` | yes: official_product_page | PASS |
| 19 | 토리든 밸런스풀 시카 포어 클렌징 폼 | `deep_clean` | `high` | yes: official_product_page | PASS |
| 20 | 풀리 그린 토마토 클레이 팩 클렌저 | `deep_clean` | `high` | yes: official_product_page | PASS |
| 21 | 프리메이 햇쌀 데일리 폼 클렌저 | `low_ph` | `low` | no | PASS |
| 22 | 한율 어린쑥 클렌징 흡착 팩폼 | `deep_clean` | `high` | yes: official_product_page | PASS |

Audit result: all 22 `reviewed_valid` products satisfy the locked confidence rubric against the current frozen evidence.

## 4. Confidence changes

| Product | Old | Final | Reason |
| --- | --- | --- | --- |
| ShionLe 다시마 앰플 클렌징폼 | `low` | **`high`** | Exact official ShionLe product evidence is ingestion eligible and directly supports `deep_clean` through sebum adsorption/removal and dead-skin removal. The retained Hwahae pH corpus remains internally inconsistent but does not weaken the separate `deep_clean` authority. |
| Torriden Dive-In 저분자 히알루론산 클렌징 폼 | `medium` | **`high`** | Exact official Torriden product evidence directly states mildly acidic cleansing foam and supports `low_ph`; the former Danawa dependency is absent from the frozen corpus. |

No other confidence value changed.

### Mediheal retained at medium

Mediheal remains `medium`: the official brand-site root listing and Boots retailer detail support the accepted `deep_clean` decision, but the frozen corpus has no product-specific ingestion-eligible `official_product_page` or `manufacturer_documentation` supporting `deep_clean`. The product remains `evidence_upgrade_required`, so `high` would overstate authority.

### Premay retained at low

Premay remains `low`: current positive `low_ph` support is `review_corpus` only. No ingestion-eligible official product page or manufacturer documentation directly supports the reviewed value in the frozen corpus.

## 5. Final confidence counts

| Confidence | Count |
| --- | ---: |
| `high` | **20** |
| `medium` | **1** |
| `low` | **1** |
| `unknown` | **4** |

`unknown = 4` exactly matches `1 reviewed_unknown + 3 reviewed_conflict + 0 not_applicable`.

## 6. Admin v2 ingestion readiness — unchanged

| Readiness | Count |
| --- | ---: |
| `eligible_from_current_evidence` | 22 |
| `evidence_upgrade_required` | 1 |
| `schema_mapping_required` | 3 |

Non-ready products remain unchanged: Mediheal = `evidence_upgrade_required`; BRMUD, beplain, and Jumiso = `schema_mapping_required`. Confidence finalization does not imply `ADMIN_V2_INGESTION_READY_26_OF_26`.

## 7. Source taxonomy — unchanged

| Source class | Count |
| --- | ---: |
| `official_product_page` | 27 |
| `manufacturer_documentation` | 0 |
| `official_brand_site_listing` | 1 |
| `retailer_product_page` | 1 |
| `marketplace_product_page` | 0 |
| `price_comparison_product_page` | 0 |
| `ingredient_list` | 0 |
| `review_corpus` | 3 |
| `manual_conflict_record` | 3 |

The taxonomy correction remains in force: commerce sources are not manufacturer documentation; `manual_conflict_record` is adjudication-only and does not prove a physical product attribute.

## 8. Verifier confidence assertions

`scripts/verify-cleanser-catalog-field-review-v1.mjs` now additionally enforces:

- `reviewed_valid + high` requires at least one ingestion-eligible `official_product_page` or `manufacturer_documentation` whose `supported_value` equals `reviewed_profile`.
- `reviewed_valid + low` fails if such direct authority exists.
- `reviewed_valid + medium` fails if direct authority already exists and requires a non-empty confidence/readiness rationale explaining why high is not warranted.
- all non-valid review states require `confidence=unknown`.
- recomputed `confidence_counts` must equal the corpus summary, and `unknown` must equal the total non-valid state count.
- existing source-taxonomy, ingestion-readiness, URL-safety, legacy-seed, conflict, invariance, and canonical-digest checks remain enforced.

Expected verifier result:

```text
PASS verify-cleanser-catalog-field-review-v1
products=26 unique_product_ids=26
reviewed_valid=22 reviewed_unknown=1 reviewed_conflict=3 not_applicable=0
reviewed_low_ph=10 reviewed_balanced=0 reviewed_deep_clean=12 reviewed_null=4
confidence_high=20 confidence_medium=1 confidence_low=1 confidence_unknown=4
ingestion_eligible=22 evidence_upgrade_required=1 schema_mapping_required=3
source_official_product_page=27 source_manufacturer_documentation=0 source_retailer_product_page=1 source_marketplace_product_page=0 source_price_comparison_product_page=0
evidence_records=35 unique_source_urls=31
canonical_sha256=9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f
```

## 9. Production invariance

- `db_writes` = 0
- `hosted_migrations` = 0
- `admin_activation` = 0
- `recommendation_activation` = 0
- `score_ranking_delta` = 0
- `pr_167_delta` = 0

No Hosted migration, Production DB write, Admin import/confirm, recommendation activation, score/ranking change, or PR #167 change is part of this finalization.

## 10. Merge gate status

The corpus may declare:

```text
CLEANSER_CATALOG_REVIEW_DECISIONS_ACCEPTED
OFFLINE_EVIDENCE_SOURCE_TAXONOMY_CORRECTED
REVIEW_CONFIDENCE_EVIDENCE_CONSISTENCY_VERIFIED
ADMIN_V2_INGESTION_READINESS_CLASSIFIED
CATALOG_REVIEW_READY_FOR_FINAL_MERGE_APPROVAL
```

It does not declare `ADMIN_V2_INGESTION_READY_26_OF_26`. PR #176 must remain Draft and unmerged until coordinator approval.
