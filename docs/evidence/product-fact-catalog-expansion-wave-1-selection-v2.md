# V2.1-8F-R1 — Catalog Coverage Expansion Wave 1 Planning Refresh

> Planning-only refresh authority. Historical V2.1-8F/v1 artifacts remain immutable. This stage selects the next exact Product Fact research batch only; it does not perform evidence research or Hosted writes.

## Refresh authority

- Base main: `541f0cc033eba31d4c03f55c08471b7b19fedf63`
- Production project: `bygrczggxfuisupcevaz`
- Snapshot captured: `2026-10-02T13:33:54.772408+09:00`
- Registry: `product-fact-registry-cross-category-v2`
- Registry digest: `6cc67db348f2847b6e35b17067e7e13cc6476b0988ba0d3ceae9d8fdc880e4b9`
- Candidate-pool digest: `b706172a2951da3e0e20c6b372d68b8dca5d80df6af26db37a3e641523214066`
- Selection policy: `catalog-expansion-selection-policy-v2`

Historical v1 remains frozen at 164 catalog products / 9 adopted products / 25 Current Facts. This refresh does not rewrite that evidence.

## Live planning snapshot

| Category | Total | Adopted | Unadopted | Floor gap |
|---|---:|---:|---:|---:|
| cleanser | 26 | 2 | 24 | 1 |
| moisturizer_balm | 20 | 1 | 19 | 2 |
| moisturizer_cream | 10 | 1 | 9 | 2 |
| moisturizer_gel | 10 | 1 | 9 | 2 |
| moisturizer_lotion_emulsion | 21 | 1 | 20 | 2 |
| sunscreen | 13 | 13 | 0 | 0 |
| toner_essence | 24 | 2 | 22 | 1 |
| toner_pad | 24 | 2 | 22 | 1 |
| treatment | 18 | 3 | 15 | 0 |

Additional catalog state:

- Catalog products: **175**
- Adopted products: **32**
- Current Product Facts: **95**
- Eligible non-sunscreen/non-null unadopted pool: **140**
- Uncategorized: 9 total / 6 adopted / 3 unadopted → `CATEGORY_HYGIENE_BACKLOG`
- Sunscreen: 13/13 adopted → excluded from this planning wave

## Selection policy v2

Priority score:

```text
category floor gap            0–20
category coverage gap         0–20
recommendation relevance      0–25
identity readiness            0–15
Registry opportunity          0–15
evidence discovery readiness  0–5
known identity/scope risk     negative
```

Recommendation relevance uses only product-level aggregate counts from `recommendation_logs`. Raw user/session/question/answer/meta fields are not frozen.

`recommendation_tier` is intentionally not scored in v2 because the current vocabulary is heterogeneous.

Source readiness is a research-priority signal only:

```text
first-party seed  = 5
secondary seed    = 3
identity only     = 1
none              = 0
```

A source seed is **not** Evidence authority.

`SUBJECT_CREATION_REQUIRED` is not a planning penalty. It is the expected downstream bottleneck for the current unadopted catalog. Actual identity / variant / formulation risk remains penalized.

Tie-break is deterministic:

1. priority score DESC
2. recommendation relevance DESC
3. category adopted count ASC
4. identity readiness DESC
5. Registry opportunity DESC
6. normalized brand UTF-8 byte ASC
7. normalized name UTF-8 byte ASC
8. product ID ASC

## Allocation

Representative floor=3 is filled first.

```text
cleanser                     1
moisturizer_balm             2
moisturizer_cream            2
moisturizer_gel              2
moisturizer_lotion_emulsion  2
toner_essence                1
toner_pad                    1
-------------------------------
floor slots                 11
flex slots                   1
total                       12
```

The single flex slot is selected globally from the remaining deterministic frontier.

## Exact selected batch

| Slot | Product ID | Brand | Product | Category | Class | Score |
|---|---|---|---|---|---|---:|
| floor | `cd3b66be-cddc-47e1-906f-a871dea84412` | 비플레인 | 녹두 약산성 클렌징폼 | cleanser | P1 | 57.13 |
| floor | `c2bb9ffd-f261-4f9b-91ed-23f6cea9ada1` | 아토팜 | MLE 크림 스틱 밤 | moisturizer_balm | P0 | 64.33 |
| floor | `d5093dae-ce2f-4681-9811-2052e1779ff3` | 닥터지 | 더모이스처 배리어.D 멀티 밤 | moisturizer_balm | P0 | 63.33 |
| floor | `b639c8b4-6a61-440e-b4db-fac7381593ff` | 에스네이처 | 아쿠아 스쿠알란 수분크림 | moisturizer_cream | P0 | 66.33 |
| floor | `15b45c92-8b35-493a-8329-bc6b4ab5a53d` | 웰라쥬 | 리얼 히알루로닉 수딩크림 | moisturizer_cream | P0 | 66.33 |
| floor | `173c63a8-a40d-4d1e-acb6-a7944d66ec43` | 브링그린 | 알로에 수딩 젤 | moisturizer_gel | P0 | 68.33 |
| floor | `d0319209-502b-4c85-be54-392600ff6b23` | 그린핑거 | 판테딘 엠디 더마 수딩젤 | moisturizer_gel | P0 | 64.33 |
| floor | `97deb2cc-2fae-4dbb-8253-03170e197002` | 러베 | 5중 세라마이드 로션 | moisturizer_lotion_emulsion | P0 | 69.38 |
| floor | `65a4c320-4815-4488-b031-b0a06b4702ca` | 에뛰드 | 순정 10무 수분 에멀전 | moisturizer_lotion_emulsion | P0 | 68.38 |
| floor | `dfc4b232-9997-4584-a886-bc7074b6f247` | 닥터트웬티프로젝트 | 나인 토너 | toner_essence | P1 | 56.00 |
| floor | `4de82c5d-9cb4-4163-a225-953e744f934c` | 듀이트리 | AC 딥 진정 모공 패드 | toner_pad | P0 | 60.00 |
| flex | `deaacf29-585c-4e1b-a7c3-73a243e69c2e` | 싸이닉 | 더 심플 데일리 로션 | moisturizer_lotion_emulsion | P0 | 67.38 |

P1 candidates are allowed only where the representative floor cannot be filled by a P0 candidate in the frozen frontier. The flex slot is P0.

Candidate Fact families in the JSON artifact are **Stage-B research targets**, not Product Fact assertions.

## Subject boundary

All selected products currently require governed Subject resolution before adoption. Stage A does not create Subjects.

```text
Product selection
→ future Subject identity/formulation resolution
→ future official evidence research
→ future Fact/blocker adjudication
```

No later step is implied by selection.

## Invariants

```text
Hosted Product Fact writes = 0
Hosted Subject writes      = 0
Hosted Evidence writes     = 0
External evidence research = 0

missing != false
Fact adoption != Recommendation activation
productionCutoverAuthorized = false
publicActivation = false
```

## Stage closeout

Decision:

`V21_8F_R1_CATALOG_EXPANSION_PLANNING_REFRESH_PASS`

Next gate is reserved as:

`V2.1-8G_RESEARCH_EXACT_SELECTED_12_ONLY`

V2.1-8G is **not started** by this planning refresh.
