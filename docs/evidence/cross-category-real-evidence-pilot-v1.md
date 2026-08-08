# Cross-Category Real-Product Evidence Pilot v1

## Scope

This Phase 3B artifact freezes the real-product pilot population **before external evidence research begins**.

- pilot version: `cross-category-real-evidence-pilot-v1`
- baseline main: `e1c9af6ad69e54a6a8d2e614de545e48f4e749b1`
- frozen registry version: `product-fact-registry-cross-category-v1`
- frozen registry blob: `32fdaa2d3a181c9d18888fc48c1343e083ad20f7`
- frozen registry core blob: `4d514f7eff80d299d6893a7f3b1c97d40ce451ba`
- frozen Phase 3A verifier blob: `5020853bc1948e9544d04dcdfe5dde44fe2aa22a`
- frozen inventory audit blob: `8fb808ccdfb51eabd88e550d25e33bd42d293223`
- reference inventory ref: `783afb91a964f5d762f46846f9ef854902b48e95`
- reference inventory path: `fixtures/recommendation-metadata/products-v1.json`
- reference inventory canonical SHA-256: `e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856`

The reference inventory is used only to establish that the selected catalog products exist and to choose hard cases. Every legacy selection hint below has authority `NOT_EVIDENCE_AUTHORITY`. It must not establish a supported Product Fact.

## Frozen pilot population

Exactly 12 current-reference products are selected: three per domain.

| # | current_catalog_product_id | brand | current_catalog_name | domain | selection_reason | legacy_selection_hints |
|---|---|---|---|---|---|---|
| S1 | `0bb742d2-df6b-49a7-8e29-8f76ae62ac0d` | 라운드랩 | 자작나무 수분 선크림 | sunscreen | Stress market-scoped SPF/UVA identity and detect whether regional labeling can remain separated without scope collapse. | `NOT_EVIDENCE_AUTHORITY`; legacy snapshot carries sunscreen protection/filter/wear fields only as selection hints. |
| S2 | `25b2763f-529f-4b2e-a436-2e0776279c55` | 뷰티오브조선 | 맑은쌀 선크림 | sunscreen | Stress coexistence of protection labels, filter/composition information, and product/wear claims without collapsing evidence classes. Exact English/market naming must be resolved before Facts are fused. | `NOT_EVIDENCE_AUTHORITY`; legacy snapshot carries SPF/UVA/filter/wear hints only. |
| S3 | `cbcd06a2-de29-47ca-afd1-ab1d5de93903` | 아넷사 | 퍼펙트 UV 선스크린 스킨케어 밀크 NA | sunscreen | Stress variant/market identity and possible water-resistance-duration evidence, including method/context requirements. | `NOT_EVIDENCE_AUTHORITY`; legacy snapshot contains an 80-minute water-resistance hint and other sunscreen metadata, none authoritative. |
| T1 | `fa5b1f6b-1e55-47b0-bfa1-494be512df07` | 더마팩토리 | 나이아신아마이드 20% 세럼 | treatment | Stress active identity plus subject-bound concentration while preventing concentration from becoming efficacy magnitude. | `NOT_EVIDENCE_AUTHORITY`; product name and legacy concern/ingredient/review fields are selection hints only. |
| T2 | `0b88019a-9eb2-4be9-842d-f1e60e42cf51` | 디오디너리 | 만델릭 애시드 10% + HA 세럼 | treatment | Stress a multi-ingredient/active case where one active may have an established concentration while another may remain concentration-unestablished. | `NOT_EVIDENCE_AUTHORITY`; name and legacy metadata are selection hints only. |
| T3 | `24a339bf-f380-493f-88b5-68e6be887c30` | 아누아 | 피디알엔 히알루론산 캡슐 100 세럼 | treatment | Stress multi-ingredient identity and numeric-name ambiguity; the `100` token must not be treated as concentration or measurement without exact evidence. | `NOT_EVIDENCE_AUTHORITY`; name, ingredient summaries, concerns, and review signals are selection hints only. |
| M1 | `4aa41038-de5b-4125-97b0-a50e7575cc00` | 일리윤 | 세라마이드 아토 집중크림 | moisturizer | Stress full-face moisturizer identity, composition/claim separation, and barrier/hydration claim versus measured effect. | `NOT_EVIDENCE_AUTHORITY`; legacy ingredient/concern/review fields do not establish barrier efficacy or role. |
| M2 | `c67266dd-3706-4929-9196-936d1f61cbc5` | 라로슈포제 | 시카플라스트 밤 B5+ | moisturizer | Stress balm/local-or-multi-area usage role without converting role into efficacy or recommendation policy. | `NOT_EVIDENCE_AUTHORITY`; legacy balm role/tag flags are selection hints only. |
| M3 | `4cbd41f3-1357-42c6-a6c7-6df0e90d54a7` | 닥터지 | 레드 블레미쉬 클리어 수딩 크림 EX | moisturizer | Stress ordinary full-face cream claims and ingredient evidence while preserving sparse facts when quantitative measurements are not established. | `NOT_EVIDENCE_AUTHORITY`; legacy concern/ingredient/review fields are selection hints only. |
| P1 | `d9e40ddb-b1e2-46e4-92db-82744227dfe3` | 아누아 | 어성초 77 히알루론산 수분 진정 토너 | toner_pad | Stress liquid toner format and composition/claim separation without inferring effect magnitude from ingredient identity. | `NOT_EVIDENCE_AUTHORITY`; catalog category/name and legacy signals are selection hints only. |
| P2 | `38dc094e-4148-4566-a743-a09815265f44` | 니들리 | 데일리 토너 패드 | toner_pad | Stress pad format, wipe-off usage, and any source-backed surface characteristic as physical/usage Facts rather than irritation magnitude. | `NOT_EVIDENCE_AUTHORITY`; legacy pad category and aggregate review signals are selection hints only. |
| P3 | `230f1c9c-cbf8-4458-aaac-ea1010a21e8c` | 메디큐브 | 제로 모공 패드 2.0 | toner_pad | Stress exfoliating composition/claim plus pad physical/usage properties without turning ingredients or format into exfoliation intensity. | `NOT_EVIDENCE_AUTHORITY`; legacy concerns and aggregate review signals are selection hints only. |

## Selection freeze rules

- The 12 IDs above are the Phase 3B pilot population unless external research proves an identity is unusable; any replacement must be explicitly recorded as an identity-driven correction, never as convenience sampling.
- No external source has been used to establish a Product Fact in this document at selection-freeze time.
- Search snippets, AI summaries, and legacy catalog metadata cannot establish evidence authority.
- Product identity must be resolved against actual opened source pages before authoritative physical Facts are fused.
- Sparse review is expected: absence of a Fact is not `false` and is not a declaration that the product is globally unknown.
- If real evidence does not fit the frozen registry/core, it is retained and classified as a registry/structural/research gap rather than force-mapped.

## Protected boundaries

This Phase remains offline research/evidence only. No DB schema, migration, Admin runtime, catalog adoption, recommendation scoring, Product Fact runtime consumer, Decision Axis runtime consumer, #167 activation, or #177 activation is introduced.
