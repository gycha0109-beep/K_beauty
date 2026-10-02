# V2.1-8G1 — Wave 1 Subject Identity Closeout

## Decision

`V21_8G1_SUBJECT_IDENTITY_PRODUCTION_PASS_READY8_HOLD4`

The frozen 12-product Wave 1 selection remains unchanged. Subject identity was resolved only where current exact KR identity/presentation authority was sufficient.

## Final split

- READY: **8**
- HOLD: **4**
- Frozen selection: **12**
- Replacement products added: **0**

READY products now have one resolved/current, KR, product-scoped Product Fact Subject each and their pre-existing Registry v1 research tasks were reconciled onto those Subjects.

HOLD products were not mutated.

## Production result

| Check | Result |
| --- | ---: |
| Selected Subjects | 8 |
| READY current/resolved KR product-scoped Subjects | 8 |
| HOLD Subjects | 0 |
| null-market selected intakes | 4 |
| Registry v1 tasks | 26 |
| Registry v2 tasks | 0 |
| frozen task IDs preserved | 26/26 |
| READY RESEARCH_PENDING tasks | 16 |
| HOLD pristine REVIEW_REQUIRED tasks | 10 |
| READY EXACT_SUBJECT_FOUND intakes | 8 |
| HOLD intakes untouched | 4 |
| Product Fact Current total | 95 |
| selected Evidence records | 0 |
| selected Fact instances | 0 |
| selected Current Facts | 0 |

## Identity authority preservation

V2.1-8G0's controlled intake identity RPC records the exact official source locator and frozen source-content digest. The legacy Subject resolver replaces `identity_resolution_detail`, so V2.1-8G1 adds:

`process_catalog_trust_product_v3(product_id, registry_version)`

It wraps the Registry-pinned v2 processor, snapshots governed identity authority before Subject reconciliation, and restores it under `identity_resolution_detail.identity_authority` after reconciliation.

The function remains service-role only.

Production migration:

`20261002153238_v21_8g1_identity_authority_preservation_v1`

## Rollback probe

Before the real batch write, the complete Beplain path was executed inside a rollback subtransaction:

1. controlled intake identity authority
2. controlled Subject registration
3. explicit Registry v1 processing through `process_catalog_trust_product_v3`
4. exact existing task-ID reconciliation
5. official-source authority preservation
6. Product Fact Current and v2-task invariance checks
7. forced rollback

Post-probe readback returned exactly to:

- Subject count: 0
- pristine task count: 2
- v2 task count: 0
- Product Fact Current: 95

## Actual mutation

The eight READY products were processed in one database transaction. Any assertion failure would have rolled back the whole batch.

Each product passed:

- exact prestate timestamp check
- market = KR controlled intake authority write
- immutable controlled Subject registration
- explicit Registry v1 reconciliation
- `EXACT_SUBJECT_FOUND`
- `RESEARCH_PENDING`
- original task IDs retained
- attempt_count = 0
- no Registry v2 task
- nested official-source identity authority retained

## READY

- 비플레인 — 녹두 약산성 클렌징폼 160ml
- 아토팜 — MLE 크림 스틱 밤 10g
- 닥터지 — 더모이스처 배리어.D 멀티 밤 50ml
- 웰라쥬 — 리얼 히알루로닉 수딩 크림 80ml
- 브링그린 — 알로에 97% 수딩젤 300ml
- 러베 — 5중 세라마이드 아기로션 200ml
- 닥터트웬티프로젝트 — 나인 토너 300ml
- 싸이닉 — 더 심플 데일리 로션 300ml

## HOLD

### S.NATURE 아쿠아 스쿠알란 수분크림

`PRESENTATION_SCOPE_UNRESOLVED`

The selected catalog row is 160ml while the current official KR pages established during this gate expose other presentations. No exact 160ml first-party presentation/formulation authority was adopted.

### 그린핑거 판테딘 엠디 더마 수딩젤

`FIRST_PARTY_SKU_AUTHORITY_MISSING`

The exact 120ml SKU was not established with a first-party exact SKU page.

### 에뛰드 순정 10무 수분 에멀전

`CURRENT_FORMULATION_AUTHORITY_MISSING`

No current exact first-party authority was established for the selected 130ml formulation.

### 듀이트리 AC 딥 진정 모공 패드

`CATALOG_PRESENTATION_CONFLICT`

The selected catalog row has `size_ml=415`, while the exact official product page describes 60 pads / 180g. The mismatch was not normalized away.

## Registry and authority boundaries

```text
Registry lineage                 = product-fact-registry-cross-category-v1
Frozen research tasks            = 26/26 preserved
Registry v2 tasks                = 0
Evidence research                = NOT STARTED
Evidence writes                  = 0
Fact instance writes             = 0
Product Fact Current delta       = 0
Recommendation changes           = 0
publicActivation                 = false
missing != false                 = preserved
```

The newly merged GPT catalog-intake path on main was reviewed before mutation. It blocks normalized duplicate Products and requires explicit product-scoped task claims, so it does not automatically enroll or mutate this frozen existing-product Wave 1 batch.

At this readback, that GPT catalog-intake migration was not yet applied to Production. This is recorded as main/Production migration state, not treated as Wave 1 Subject authority.

## Next gate

`V2.1-8G2_REQUIRED_FACT_RESEARCH_READY8_ONLY`

Only the 16 `RESEARCH_PENDING` tasks on these eight exact Subjects are eligible for the next research gate. HOLD products remain frozen and are not replaced mid-wave.

8G2 has not started in this closeout.
