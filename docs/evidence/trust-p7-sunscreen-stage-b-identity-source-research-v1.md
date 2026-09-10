# TRUST-P7 — Sunscreen Stage B Identity / Source Research Freeze

## Scope

TRUST-P7 executes the P6 next gate for only the four `SOURCE_IDENTITY_RESEARCH_READY` sunscreen products. It freezes first-party identity/source adjudication and determines whether each row may proceed to the existing hosted Product Fact adoption **preflight**.

It does not register Product Fact Subjects, ingest Product Fact Evidence, confirm Facts, change Current pointers, or change recommendation/ranking behavior.

Fresh repository authority at research capture: `30a11e00273462391374dcc7efb16325cf018fcb`.
Upstream P6 merge: `e655c1102998dfa769a1a8fb200d7fe5e0c60d66`.
Research timestamp: `2026-09-10T21:12:00+09:00`.
Latest-main integration base before final PR verification: `eac724ebc1476b81669adbcbd6270d51321b3081`.

## Result

| Product | Identity result | First-party fact support | P7 disposition |
|---|---|---|---|
| Beauty of Joseon 맑은쌀 선크림 아쿠아프레쉬 50 ml | exact current product resolved | SPF50+ / PA++++ | `ADOPTION_PREFLIGHT_ELIGIBLE` |
| AESTURA 더마 UV365 레드 카밍 톤업 선스크린 40 ml | `레드 카밍` ↔ `레드진정` ↔ `Red Calming` localized alias resolved | SPF50+ / PA++++ | `ADOPTION_PREFLIGHT_ELIGIBLE` |
| AESTURA 더마UV365 장벽수분 무기자차 선크림 40 ml | exact current product resolved | SPF50+ / PA++++ | `ADOPTION_PREFLIGHT_ELIGIBLE` |
| La Roche-Posay 안뗄리오스 선 플루이드 50 ml | exact KR current product resolved | no admissible machine-readable SPF/PA claim in current first-party body | `FACT_SOURCE_RECOVERY_REQUIRED` |

All four identities are resolved. Only three have sufficient first-party machine-readable support for the already-registered sunscreen proposition kinds `spf_value` and `uva_label`.

## First-party sources

### Beauty of Joseon

`https://beautyofjoseon.com/products/relief-sun-aqua-fresh`

The current official body identifies `Relief Sun Aqua-Fresh : Rice + B5`, size `50 mL`, and directly exposes `SPF50+ PA++++`.

### AESTURA Red Calming / 레드진정

KR identity source:
`https://www.aestura.com/web/product/view.do?prdSeq=1108`

International fact-bearing source:
`https://int.aestura.com/products/derma-uv365-red-calming-tone-up-sunscreen`

The KR page identifies `더마UV365 레드진정 톤업 선크림`, 40 ml. The international first-party page identifies `DERMA UV365 Red Calming Tone-up Sunscreen`, 40 ml, `SPF 50+`, `PA++++`, with corresponding ingredient ordering. This resolves the catalog `레드 카밍` label as a localized alias rather than a separate product.

### AESTURA Barrier Hydro Mineral

KR identity source:
`https://www.aestura.com/web/product/view.do?prdSeq=1107`

International fact-bearing source:
`https://int.aestura.com/products/derma-uv365-barrier-hydro-mineral-sunscreen`

The KR and international first-party pages agree on the current 40 ml Barrier Hydro Mineral identity/formulation, while the international body directly exposes `SPF 50+` and `PA++++`.

### La Roche-Posay

`https://www.larocheposay.co.kr/product/view/4833.do`

The current KR official body resolves `안뗄리오스 선 플루이드` 50 ml and exposes the ingredient list, but the machine-readable body does not directly expose an SPF numeric claim or PA label. TRUST-P7 does not infer those values from imagery, reviews, Hwahae, or a non-adjudicated overseas Anthelios variant.

## Fact boundary

TRUST-P7 permits research only for the two existing sunscreen Product Fact keys already proven in Production:

- `spf_value`
- `uva_label`

No new filter-type, mineral/chemical, ingredient, texture, eye-sting, white-cast, or recommendation-policy fact kind is introduced here.

## Existing path reuse

No parallel materialization path is created. Eligible rows may proceed only through:

```text
product-fact-catalog-evidence-research-wave-1-v1
→ identity / scope / formulation freeze
→ product-fact-catalog-hosted-adoption-wave-1-v1
→ controlled RPC preflight
→ stale/mismatch rejection
→ explicit confirmation path
→ readback
```

The three eligible rows are **preflight-eligible, not write-authorized**. A live source, scope, formulation, stale-state, or RPC preflight mismatch must stop the row.

La Roche-Posay moves to a separate first-party fact-source recovery gate. Identity resolution alone is not sufficient to create useful Product Fact coverage.

## Closure invariants

```text
P6_RESEARCH_READY = 4
P7_RESEARCHED = 4
IDENTITY_RESOLVED = 4
ADOPTION_PREFLIGHT_ELIGIBLE = 3
FACT_SOURCE_RECOVERY_REQUIRED = 1
MECHANICAL_SUBJECT_CREATION_ELIGIBLE = 0
HOSTED_PRODUCT_FACT_WRITES = 0
DIRECT_PRODUCT_FACT_WRITES = 0
SUBJECT_CREATION_AUTHORIZED_BY_P7 = NO
FACT_INGEST_AUTHORIZED_BY_P7 = NO
CONFIRMATION_AUTHORIZED_BY_P7 = NO
RECOMMENDATION_OR_RANKING_CHANGES = 0
```
