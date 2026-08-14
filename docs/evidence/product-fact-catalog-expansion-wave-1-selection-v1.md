# V2.1-8F — Catalog Coverage Expansion Wave 1 Selection

> Planning-only repository authority. This artifact selects the next Product Fact evidence-research batch; it does not assert Product Facts, perform external evidence research, or write Hosted data.

## Authority

- Source main: `b1e70c638f0e039c4061986cefd55e8e937f0983`
- Registry: `product-fact-registry-cross-category-v1`
- Selection policy: `catalog-expansion-selection-policy-v1`
- Hosted snapshot digest: `e7cf34642fc6ae8e073e30d852cc829ceb30ba408098e3fe1238d7978d95ee46`
- Generated-at policy: none; canonical output contains no wall-clock timestamp.

## Catalog snapshot

- Catalog products: 164
- Adopted products: 9
- Current Facts: 25
- Facts per adopted product: 2.777778
- Eligible candidate pool: 152
- P0 / P1 / P2: 91 / 61 / 3

## Category coverage

| Category | Total | Adopted | Unadopted | Current Facts | Adoption ratio | Floor gap |
|---|---:|---:|---:|---:|---:|---:|
| cleanser | 26 | 0 | 26 | 0 | 0.000000 | 3 |
| moisturizer_balm | 20 | 1 | 19 | 4 | 0.050000 | 2 |
| moisturizer_cream | 10 | 1 | 9 | 2 | 0.100000 | 2 |
| moisturizer_gel | 10 | 0 | 10 | 0 | 0.000000 | 3 |
| moisturizer_lotion_emulsion | 21 | 0 | 21 | 0 | 0.000000 | 3 |
| sunscreen | 11 | 3 | 8 | 5 | 0.272727 | 0 |
| toner_essence | 24 | 0 | 24 | 0 | 0.000000 | 3 |
| toner_pad | 24 | 1 | 23 | 5 | 0.041667 | 2 |
| treatment | 18 | 3 | 15 | 9 | 0.166667 | 0 |

## Selection policy v1

- Category gap: `40 * max(0, 3 - adopted_product_count) / 3`.
- Recommendation logs: `15 * product_frequency / max_eligible_frequency`.
- Source rankings: 0 in Wave 1 because no defensible current source_rankings → catalog-product canonical mapping exists.
- Identity readiness: normalized brand +3, normalized name +3, HTTPS source_url +3, external source+id +3, disambiguating attribute +3.
- Registry opportunity: `min(15, applicable governed candidate Fact-family count * 3)`.
- Evidence discovery readiness: HTTPS source_url +2, existing external locator +1, external_source +1, external_id +1.
- Nonblocking score penalties: none in policy v1. Brand diversity is a separate global cap of 2 per normalized brand.
- P0: score >= 60. P1: score < 60. P2: hard historical blocker or missing minimum deterministic identity.
- All component and final scores are rounded to 6 decimals. No LLM ranking, random sampling, created_at ordering, or DB implicit ordering is used.

## Exact selected 12-product batch

| Rank | Product ID | Brand | Product | Category | Class | Score | Gap | Rec. | Identity | Registry | Discovery | Research target families |
|---:|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | `24103bd1-c7ba-4cc9-b9b9-8129c6452232` | 라운드랩 | 자작나무 수분 수딩젤 | moisturizer_gel | P0 | 72.756303 | 40.000000 | 0.756303 | 15.000000 | 12.000000 | 5.000000 | primary_use_role, barrier_support_claim, contains_active, active_concentration |
| 2 | `173c63a8-a40d-4d1e-acb6-a7944d66ec43` | 브링그린 | 알로에 수딩 젤 | moisturizer_gel | P0 | 72.504202 | 40.000000 | 0.504202 | 15.000000 | 12.000000 | 5.000000 | primary_use_role, barrier_support_claim, contains_active, active_concentration |
| 3 | `97deb2cc-2fae-4dbb-8253-03170e197002` | 러베 | 5중 세라마이드 로션 | moisturizer_lotion_emulsion | P0 | 72.126050 | 40.000000 | 0.126050 | 15.000000 | 12.000000 | 5.000000 | primary_use_role, barrier_support_claim, contains_active, active_concentration |
| 4 | `c4a5f510-8d9e-46bd-a31c-3c0a34fee331` | 닥터지 | 레드 블레미쉬 10-시카 캡슐 수딩 토너 | toner_essence | P0 | 72.000000 | 40.000000 | 0.000000 | 15.000000 | 12.000000 | 5.000000 | product_format, contains_active, recommended_use_frequency, wipe_off_use |
| 5 | `dfc4b232-9997-4584-a886-bc7074b6f247` | 닥터트웬티프로젝트 | 나인 토너 | toner_essence | P0 | 72.000000 | 40.000000 | 0.000000 | 15.000000 | 12.000000 | 5.000000 | product_format, contains_active, recommended_use_frequency, wipe_off_use |
| 6 | `59b149d0-5ffa-4610-8141-c0a501b60565` | 라보레브 | 피치마이크로바이옴 78 피디알엔 토너 | toner_essence | P0 | 72.000000 | 40.000000 | 0.000000 | 15.000000 | 12.000000 | 5.000000 | product_format, contains_active, recommended_use_frequency, wipe_off_use |
| 7 | `1f20944c-5a86-4748-8daf-7d57259ea6c0` | 라운드랩 | 소나무 진정 시카 로션 | moisturizer_lotion_emulsion | P0 | 72.000000 | 40.000000 | 0.000000 | 15.000000 | 12.000000 | 5.000000 | primary_use_role, barrier_support_claim, contains_active, active_concentration |
| 8 | `65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc` | YBK | 릴리프 하이드레이션 라이트 폼 클렌저 | cleanser | P0 | 69.000000 | 40.000000 | 0.000000 | 15.000000 | 9.000000 | 5.000000 | low_ph, deep_cleansing, fragrance_declared |
| 9 | `8889342d-d9a2-454b-aa27-60d4934b9978` | 메디필 | 레드 락토 콜라겐 클리어 폼클렌저 2.0 | cleanser | P0 | 69.000000 | 40.000000 | 0.000000 | 15.000000 | 9.000000 | 5.000000 | low_ph, deep_cleansing, fragrance_declared |
| 10 | `51d526de-b127-47c4-83f1-64fc1ec4aa10` | 메디힐 | 더마 크림 팩 클렌저 마데카소사이드 | cleanser | P0 | 69.000000 | 40.000000 | 0.000000 | 15.000000 | 9.000000 | 5.000000 | low_ph, deep_cleansing, fragrance_declared |
| 11 | `0b59cb66-ab03-4a0d-815e-7a94a5c7ae65` | 메이크프렘 | 세이프 미 클렌징폼 | cleanser | P0 | 69.000000 | 40.000000 | 0.000000 | 15.000000 | 9.000000 | 5.000000 | low_ph, deep_cleansing, fragrance_declared |
| 12 | `be8a590e-e5cb-4af4-84e7-99c7e121f45a` | 구달 | 어성초 히알루론 수딩 클리어패드 | toner_pad | P0 | 61.792717 | 26.666667 | 0.126050 | 15.000000 | 15.000000 | 5.000000 | product_format, contains_active, pad_surface_texture, wipe_off_use, recommended_use_frequency |

Candidate Fact families above are Stage-B research targets from the governed Registry, **not Product Fact assertions**.

## Wave 1 quota and diversity proof

- cleanser: 4
- toner_essence: 3
- moisturizer_lotion_emulsion: 2
- moisturizer_gel: 2
- toner_pad: 1

Brand-cap relaxations: 0
- ybk: 1
- 구달: 1
- 닥터지: 1
- 닥터트웬티프로젝트: 1
- 라보레브: 1
- 라운드랩: 2
- 러베: 1
- 메디필: 1
- 메디힐: 1
- 메이크프렘: 1
- 브링그린: 1

## Historical blocker ledger

- `d9e40ddb-b1e2-46e4-92db-82744227dfe3` — EXCLUDED_FORMULATION_CONFLICT — FORMULATION_SCOPE_CONFLICT
- `38dc094e-4148-4566-a743-a09815265f44` — EXCLUDED_IDENTITY_BLOCKED — IDENTITY_BLOCKED
- `4cbd41f3-1357-42c6-a6c7-6df0e90d54a7` — EXCLUDED_VARIANT_CONFLICT — VARIANT_SCOPE_CONFLICT

## Invariants

- Hosted Product Fact writes: 0
- products/source_rankings/recommendation_logs writes: 0
- External product evidence research: 0
- Product Fact semantic assertions generated: 0
- Production runtime consumption: false
- V2.1-8G: not started
