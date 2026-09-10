# TRUST-P6 — Sunscreen Product Fact Subject Coverage Authority

## Scope

TRUST-P6 is a read-only authority audit. It does not create Product Fact Subjects, ingest Product Fact Evidence, confirm Facts, change Current pointers, or change recommendation/ranking behavior.

The frozen Production snapshot was captured from Supabase project `bygrczggxfuisupcevaz` at `2026-09-10T18:34:39.154035+09:00` against repository authority `8448f65f5126e3ac56a354ef134e1ea3d8a3822f`.

The database-side sunscreen snapshot SHA-256 is:

`7d801e49d502beba698b492230102c736c263a5a19fd8c4be7a6088c6a480aaa`

The repository artifact snapshot SHA-256 is:

`5fdc3e909cf371faef64315872af6f1e6dc8b5895a082d7b214dca815dec0a3c`

## Fresh Production result

| Metric | Result |
|---|---:|
| Sunscreen catalog products | 11 |
| Resolved/current Product Fact Subject products | 3 |
| Subject gaps | 8 |
| Mechanically subject-creatable | 0 |
| Duplicate normalized identities | 0 |
| Blank brand/normalized identity rows | 0 |
| Product Fact Subject rows at capture | 16 |
| Product Fact Current rows at capture | 41 |

The earlier handoff snapshot is historical context only. The current Production catalog was re-read and frozen rather than reusing old product UUIDs or old duplicate/promo-set assumptions.

## Existing covered authority

Three sunscreen products already have resolved/current Product Fact Subjects and Current Facts:

- Round Lab `자작나무 수분 선크림`: 2 Current Facts
- Beauty of Joseon `맑은쌀 선크림`: 1 Current Fact
- Anessa `퍼펙트 UV 선스크린 스킨케어 밀크 NA`: 2 Current Facts

TRUST-P6 does not mutate or supersede these Subjects.

## Eight uncovered products

| Product | P6 authority state | Why it is not mechanical |
|---|---|---|
| La Roche-Posay 안뗄리오스 선 플루이드 | `SOURCE_IDENTITY_RESEARCH_READY` | Current official KR 50 ml product page exists, but Stage B must freeze exact formulation and binding. |
| Beauty of Joseon 맑은쌀 선크림 아쿠아프레쉬 | `SOURCE_IDENTITY_RESEARCH_READY` | Official exact 50 ml page exists, but KR applicability/formulation must still be frozen. |
| AESTURA 더마 UV365 레드 카밍 톤업 선스크린 | `SOURCE_IDENTITY_RESEARCH_READY` | Official 40 ml page uses `레드진정`; localized-name equivalence must be adjudicated before Subject registration. |
| AESTURA 더마UV365 장벽수분 무기자차 선크림 | `SOURCE_IDENTITY_RESEARCH_READY` | Official exact KR 40 ml page exists, but exact formulation binding still belongs to Stage B. |
| SKIN1004 히알루-시카 워터핏 선세럼 UV | `MARKET_FORMULATION_SCOPE_REVIEW_REQUIRED` | Official `UV` and non-`UV` routes expose materially different market/formulation presentations. |
| Isntree 히아루론산 워터리 선젤 | `MARKET_SCOPE_REVIEW_REQUIRED` | Official global exact 50 ml page exists, but region/market applicability must be frozen for a KR Subject. |
| Torriden 다이브인 워터리 모이스처 선크림 | `IDENTITY_FORMULATION_REVISION_REVIEW_REQUIRED` | Current official 60 ml page uses `다이브인 모이스처 선크림`, while a legacy official route still exposes `워터리 모이스처` naming. |
| Dr.G 그린 마일드 업 선 플러스 | `SOURCE_FORMULATION_DISCOVERY_REQUIRED` | A current exact official Dr.G 50 ml product page was not established in this P6 pass; older corporate references are insufficient for current formulation identity. |

Classification totals:

```text
SOURCE_IDENTITY_RESEARCH_READY                  4
MARKET_FORMULATION_SCOPE_REVIEW_REQUIRED       1
MARKET_SCOPE_REVIEW_REQUIRED                   1
IDENTITY_FORMULATION_REVISION_REVIEW_REQUIRED  1
SOURCE_FORMULATION_DISCOVERY_REQUIRED           1
MECHANICAL_SUBJECT_CREATION_ELIGIBLE            0
```

## Discovery sources

These URLs are discovery inputs only. Their presence is not Product Fact Evidence admission and does not authorize a Subject.

- La Roche-Posay Korea: `https://www.larocheposay.co.kr/product/view/4833.do`
- Beauty of Joseon: `https://beautyofjoseon.com/products/relief-sun-aqua-fresh`
- AESTURA Red: `https://www.aestura.com/web/product/view.do?prdSeq=1108`
- AESTURA Barrier: `https://www.aestura.com/web/product/view.do?prdSeq=1107`
- SKIN1004 UV: `https://www.skin1004.com/products/hyalu-cica-water-fit-sun-serum-uv`
- SKIN1004 non-UV market route: `https://www.skin1004.com/products/hyalu-cica-water-fit-sun-serum-spf50-pa`
- Isntree Global: `https://isntree-global.com/products/isntree-hyaluronic-acid-watery-sun-gel-50ml`
- Torriden current: `https://www.torriden.com/goods/goods_view.php?goodsNo=252`
- Torriden legacy-name route: `https://www.torriden.com/goods/goods_view.php?goodsNo=183`

## Existing path reuse

No parallel Subject materialization system is required. The existing governed path remains authoritative:

```text
product-fact-catalog-selection-v1
→ product-fact-catalog-evidence-research-wave-1-v1
→ Product/variant/formulation/market identity gate
→ frozen materialization
→ product-fact-catalog-hosted-adoption-wave-1-v1
→ controlled RPC preflight / stale rejection / confirm / idempotency / readback
```

Controlled Product Fact operations remain:

- `admin_register_product_fact_subject_v1`
- `admin_ingest_product_fact_evidence_v1`
- `admin_prepare_product_fact_review_v1`
- `admin_preflight_product_fact_confirmation_v1`
- `admin_confirm_product_fact_v1`

Direct Product Fact table mutation remains forbidden.

## Next gate

The next safe gate is `TRUST-P7-targeted-sunscreen-subject-identity-freeze`.

Start with only the four `SOURCE_IDENTITY_RESEARCH_READY` products. Run the existing Stage B research/identity machinery and freeze exact source↔subject applicability. A source mismatch, formulation mismatch, market mismatch, or identity ambiguity must downgrade the row to a review/block state rather than promote it for coverage.

The other four products remain explicitly blocked on their stated identity/source boundary until separately resolved.

## Closure invariants

```text
HOSTED_PRODUCT_FACT_WRITES = 0
DIRECT_PRODUCT_FACT_WRITES = 0
RECOMMENDATION_OR_RANKING_CHANGES = 0
SUBJECT_CREATION_AUTHORIZED_BY_P6 = NO
FACT_INGEST_AUTHORIZED_BY_P6 = NO
OLD_HANDOFF_SNAPSHOT_USED_AS_CURRENT_AUTHORITY = NO
NEW_PARALLEL_MATERIALIZATION_PATH_REQUIRED = NO
```
