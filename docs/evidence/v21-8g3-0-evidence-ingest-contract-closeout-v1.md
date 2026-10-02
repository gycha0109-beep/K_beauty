# V2.1-8G3-0 — Evidence Ingest Contract Preflight Closeout

## Decision

`V21_8G3_0_EVIDENCE_INGEST_CONTRACT_PREFLIGHT_PASS`

The exact six DIRECT Wave 1 research results are compatible with the existing controlled Product Fact Evidence ingest boundary.

This phase performs **zero committed Production writes**.

Preflight authority main: `f5f49f1cabfcea951688d7d0a30feee193a512fe`

Integration main after unrelated Face Lab backoff changes: `7faafd3571cf047ba299f12db0e66f2c64578f08`.

## Handoff

The next gate may ingest exactly:

```text
Sources   = 4
Bindings  = 4
Evidence  = 6

Review Assignments   = 0
Fact Instances       = 0
Product Fact Current = +0
```

The six Evidence candidates are:

| Product | Fact | Value | Evidence class |
| --- | --- | --- | --- |
| 비플레인 녹두 약산성 클렌징폼 | low_ph | true | product_claim |
| 아토팜 MLE 크림 스틱 밤 | barrier_support_claim | true | measurement |
| 아토팜 MLE 크림 스틱 밤 | primary_use_role | local_area | usage_instruction |
| 닥터트웬티프로젝트 나인 토너 | product_format | liquid | physical_characteristic |
| 닥터지 더모이스처 배리어.D 멀티 밤 | barrier_support_claim | true | product_claim |
| 닥터지 더모이스처 배리어.D 멀티 밤 | primary_use_role | multi_area | usage_instruction |

## Controlled RPC compatibility

Production `admin_ingest_product_fact_evidence_v1` is service-role only and requires the existing `admin.products.review` actor capability.

The contract preserves:

- exact resolved Subject binding
- exact/equivalent scope
- Registry v1 fact definition
- permitted Evidence class
- KR market compatibility
- product-specific primary authority
- high confidence
- positive support only
- `negative_admissibility = not_applicable`
- digest-based source and Evidence idempotency

Registry v2 coexistence does not make the frozen v1 lineage stale. Current review/preflight helpers use the registry write-admissibility policy; all four required v1 Fact keys allow both new and existing lineage.

## Proposition and Evidence identity

Proposition keys use the established Hosted serializer:

`product-fact-proposition-pilot-v1`

Evidence uses a new frozen digest material contract:

`v21-8g3-evidence-v1`

The 8G2 source capture digest is explicitly treated as:

> SHA-256 of the canonical frozen 8G2 source capture, **not** a byte hash of the live webpage.

The source metadata preserves that basis so provenance is not overstated.

For Dr.twentyproject `product_format=liquid`, the ingest source is the official toner/mist category page because that source directly establishes the physical-format proposition. The exact official product page remains frozen research corroboration and is not separately ingested by this six-Evidence batch.

## Rollback probe

All six exact planned ingest calls were executed inside one transaction and then rolled back.

```text
RPC calls attempted = 6
RPC calls accepted  = 6
ROLLBACK             = PASS

post-rollback:
Product Fact Current = 95
target Sources       = 0
target Bindings      = 0
target Evidence      = 0
probe audit rows     = 0
probe review events  = 0
```

The first post-rollback diagnostic query referenced the singular table name `admin_audit_log`; the actual table is `admin_audit_logs`. This diagnostic-name error occurred after the rollback and created no Production residue. Corrected readback confirmed zero residue.

## Current Production prestate

```text
Product Fact Current       = 95
READY Registry v1 tasks    = 16
Pristine READY v1 tasks    = 16
READY Registry v2 tasks    = 0
READY Evidence records     = 0
READY Fact instances       = 0
exact target Sources       = 0
exact target Bindings      = 0
exact target Evidence      = 0
GPT task-claim RPC         = absent
GPT catalog-ingest RPC     = absent
```

## Boundaries

```text
Evidence != Fact
Fact != Decision Axis
Fact adoption != Recommendation activation
missing != false

8G3-0 committed Evidence writes = 0
review preparation authorized   = false
confirmation preflight          = false
confirmation                    = false
Recommendation activation       = false
publicActivation                 = false
```

## Next gate

`V2.1-8G3-A_CONTROLLED_EVIDENCE_INGEST`

8G3-A may execute only the six frozen Evidence payloads through the controlled RPC and must stop before review preparation.
