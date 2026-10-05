# V2.1-8H-R12C — READY3 Controlled Evidence Ingest Closeout

## 종료 판정

`BARRIER_SUPPORT_P0_READY3_CONTROLLED_EVIDENCE_INGEST_PASS`

R12B에서 사전검증한 에뛰드 직접 근거 1건만 Production 통제 RPC로 실제 ingest했다.

대상:

- 제품: 에뛰드 순정 판텐소사이드™ 10 시카 밤 50ml
- 작업: `39449932-6c41-4762-bf39-e6848c9ad09a`
- Fact: `primary_use_role`
- 값: `multi_area`
- Evidence class: `usage_instruction`

## 실제 Production 결과

RPC:

`admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)`

Request ID:

`v21-8h-r12c-etude-role-ingest`

결과:

```text
status = evidence_recorded
source_inserted = true
binding_inserted = true
evidence_inserted = true
```

생성 ID:

- Source: `e6b24da7-5f48-43a1-a2ba-f46fad063cf2`
- Binding: `15bf791d-a36a-4214-b7ce-f1b38559ae11`
- Evidence: `45b57536-0637-44e0-b427-bb55923c4812`
- Audit: `f92570f5-d00e-4f49-b1dd-21db1a28cd1f`

생성 시각:

`2026-10-05T22:08:18.431129+09:00`

## Source

공식 출처:

`https://www.amoremall.com/kr/ko/product/detail?onlineProdCode=110090000337&onlineProdSn=60201`

고정 값:

- publisher = `AMOREPACIFIC / ETUDE`
- source kind = `official_product_bundle_page`
- market = `KR`
- source content digest = `a7eb1b96d8551cc88727abedfda7a758e801d5a78eec4acee1de040d970846dc`

R12 frozen source capture에서 유래하며 live page byte hash로 오인하지 않는다.

## Binding

동일 50ml 단위 2개 구성 페이지이므로:

- `binding_state = equivalent_presentation_match`
- `scope_relation = equivalent`
- `bundle_units = 2`
- `exact_unit_match = yes`

로 기록했다.

Subject:

`84beae6f-72c8-424e-b561-c2c067fef9e0`

Subject semantic key:

`028945101121562f1f5470a44fd1a7974477a7c8a50cd6954102993fb087650d`

처방 버전 키:

`v21-8h-r10:a8a01568cf96737549c033542599a2d94e843367d0c876774262f0b409125327`

## Evidence

Registry:

`product-fact-registry-cross-category-v1`

Proposition serializer:

`product-fact-proposition-pilot-v1`

Proposition key:

`379a68e4b599cbcc5583b0a830b3718c3f5af0fc52ec62d4d823a728626834d2`

Canonical Evidence digest:

`fee6031cbf1683f03de5792d3521dd25b5257deca9b64160656de3453f7ddab9`

내용:

- `proposition_value_identity = multi_area`
- `evidence_authority = product_specific_primary`
- `confidence = high`
- `support_direction = supports`
- `negative_admissibility = not_applicable`
- `market = KR`

## Review Event / Audit

Review Event:

- event kind = `evidence_ingested`
- reason = `controlled_ingest`

Audit:

- capability = `admin.products.review`
- action = `admin.product_fact.evidence_ingested`
- target = 생성된 Evidence ID
- request ID = `v21-8h-r12c-etude-role-ingest`

## Product Fact 불변

실행 전:

```text
Evidence Records = 107
```

실행 후:

```text
Evidence Records = 108
```

반면:

```text
Product Fact Subject = 50
Product Fact Current = 104
Fact Instance = 105
Confirmation = 105

target Subject Fact Instance = 0
target Subject Current Fact = 0
target Evidence Link = 0
```

따라서 이번 단계에서 물질화된 것은 Source / Binding / Evidence와 이에 대한 Event/Audit뿐이다.

기존 연구 Task도:

- `RESEARCH_PENDING`
- `attempt_count=0`
- `blocker_code=null`

상태를 유지한다.

## 권위 경계

이번 단계가 수행한 것:

```text
Source write = 1
Binding write = 1
Evidence write = 1
Review Event = 1
Audit = 1
```

수행하지 않은 것:

```text
Fact Instance write = 0
Product Fact Current write = 0
Confirmation write = 0
Evidence Link = 0
Recommendation write = 0

review preparation = not authorized
confirmation preflight = not authorized
confirmation = not authorized
recommendation activation = false
public activation = false
```

즉:

```text
Evidence != Fact
Fact != Decision Axis
Fact adoption != Recommendation activation
```

경계를 유지한다.

## 다음 단계

`V2.1-8H-R12D — READY3 Review Preparation Preflight`

다음 단계에서도 바로 Confirmation으로 가지 않는다.

먼저 생성된 Evidence `45b57536-0637-44e0-b427-bb55923c4812`가 기존 통제 Review Preparation 경로에 정확히 들어갈 수 있는지만 사전검증한다.

R12C 종료 자체는 **Review Preparation / Confirmation을 승인하지 않는다.**
