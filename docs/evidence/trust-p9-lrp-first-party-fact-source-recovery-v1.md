# TRUST-P9 — La Roche-Posay First-Party Fact Source Recovery v1

> Repository-only evidence freeze. Hosted Product Fact writes = 0.

## Authority

- fresh source main: `cef8a05a333b56f4244fc2d1295200230c97a52c`
- upstream TRUST-P8 merge: `cef8a05a333b56f4244fc2d1295200230c97a52c`
- Production project: `bygrczggxfuisupcevaz`
- target product: `9983f167-24e7-4223-bd86-446ce6ced31b`
- target: 라로슈포제 / 안뗄리오스 선 플루이드 / 50 ml / KR
- research timestamp: `2026-09-11T04:35:10.914222+09:00`
- Product Fact prestate: Subject 0 / Current 0

TRUST-P9 is limited to the existing sunscreen fact keys `spf_value` and `uva_label`. It does not create a Product Fact Subject, ingest Evidence, create review assignments, confirm facts, change Current pointers, mutate Registry/RPC/schema, or alter recommendation/ranking behavior.

## Recovery result

`PARTIAL_FACT_SOURCE_RECOVERY`

| Fact | Result | Reason |
|---|---|---|
| `spf_value` | `RECOVERED_SUPPORTED` | same-formulation first-party source directly exposes `SPF50+` |
| `uva_label` | `FACT_SOURCE_RECOVERY_REQUIRED` | same-formulation source exposes `UVA-PF 46`, but no direct `PA++++` label was recovered |

No `UVA-PF 46 → PA++++` conversion is admitted. `uva_label` remains blocked.

## KR identity authority

Canonical KR source:

`https://www.larocheposay.co.kr/product/view/4833.do`

The current La Roche-Posay Korea machine-readable body resolves:

- `안뗄리오스 선 플루이드`
- 50 ml
- manufactured in France
- UV-protection functional cosmetic status
- current 22-item ingredient disclosure

It still does **not** expose a machine-readable SPF numeric claim or PA label.

## Same-formulation first-party bridge

Recovered source:

`https://www.laroche-posay.si/anthelios/anthelios-nevidni-fluid-spf50-brez-vonja`

La Roche-Posay Slovenia directly exposes:

- `ANTHELIOS INVISIBLE FLUID SPF50+ / UVA-PF 46 NON-PERFUMED`
- 50 ml
- formula code `C227022/1`
- a 22-item INCI disclosure

After Korean ingredient-name to INCI normalization, all 22 KR ingredients match the Slovenia disclosure in the same order with no missing or extra ingredient. The KR page itself does not publish `C227022/1`, so TRUST-P9 does not claim that formula code as a directly published KR identifier. Instead, same brand/line, 50 ml, non-perfumed status and exact ordered ingredient equivalence establish the cross-market formulation bridge used only for the recovered SPF source scope.

The recovered SPF fact is therefore narrowed to the KR subject only. It is not promoted to a global fact.

## Rejected PA-bearing candidates

### Hong Kong UVMUNE 400

`https://www.laroche-posay.hk/anthelios/anthelios-uvmune-400-invisible-fluid-spf50-without-perfume`

This first-party page directly exposes `SPF50+ PA++++`, but also identifies `MEXORYL 400` and publishes a materially different ingredient formula. It is rejected as `FORMULATION_MISMATCH`.

### Thailand UVMUNE 400

`https://www.larocheposay-th.com/anthelios/anthelios-uvmune-400-invisible-fluid-spf50`

This first-party page also directly exposes `SPF50+` and `PA++++`, but is explicitly the newer UVMUNE 400 generation. It is rejected as `FORMULATION_GENERATION_MISMATCH` for the current KR ingredient formulation.

### Japan ANTHELIOS XL Fluid

`https://www.laroche-posay.jp/on/demandware.static/-/Sites-lrp-jp-ng-Library/ja_JP/dw5ece99cc/LRP2024AWCatalog.pdf`

The official Japanese catalog directly exposes `SPF50+・PA++++` for `アンテリオス XL フリュイド` 50mL, but the first-party ingredient disclosure for that product is materially different from the current KR product. Its PA label is therefore not portable to the KR subject.

## Exact boundary

```text
TARGET_PRODUCTS = 1
ALLOWED_FACT_KEYS = 2
RECOVERED_SUPPORTED_FACTS = 1
REMAINING_FACT_SOURCE_GAPS = 1
HOSTED_PRODUCT_FACT_WRITES = 0
DIRECT_PRODUCT_FACT_WRITES = 0
SUBJECT_CREATION_AUTHORIZED = NO
FACT_INGEST_AUTHORIZED = NO
CONFIRMATION_AUTHORIZED = NO
CURRENT_UPDATE_AUTHORIZED = NO
UVA_PF_TO_PA_CONVERSION_ALLOWED = NO
SCHEMA_CHANGE = NO
RPC_CHANGE = NO
REGISTRY_CHANGE = NO
RECOMMENDATION_OR_RANKING_CHANGES = 0
```

## Next gate

Only `spf_value` may advance to a **separate deterministic hosted-adoption plan freeze** using the existing controlled lifecycle. `uva_label` remains in first-party same-formulation direct-PA-label recovery and must not be inferred from `UVA-PF 46`, product imagery, reviews, third-party retailers, or a different Anthelios formulation.
