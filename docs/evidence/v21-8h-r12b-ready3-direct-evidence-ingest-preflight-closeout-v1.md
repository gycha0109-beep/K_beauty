# V2.1-8H-R12B — READY3 Direct Evidence Ingest Preflight

## 종료 판정

`BARRIER_SUPPORT_P0_READY3_DIRECT_EVIDENCE_INGEST_PREFLIGHT_PASS`

R12에서 확보된 직접 근거 1건만 기존 통제 Evidence ingest 경로에 넣을 수 있는지 Production에서 사전검증했다.

대상:

- 제품: 에뛰드 순정 판텐소사이드™ 10 시카 밤 50ml
- 작업: `39449932-6c41-4762-bf39-e6848c9ad09a`
- Fact: `primary_use_role`
- 제안값: `multi_area`
- Evidence class: `usage_instruction`

이번 단계는 **사전검증 전용**이며 커밋된 Production 쓰기는 0건이다.

## 근거 계보

부모 연구:

- R12: `BARRIER_SUPPORT_P0_READY3_OFFICIAL_EVIDENCE_RESEARCH_DIRECT1_INSUFFICIENT5`
- R12A: `BARRIER_SUPPORT_P0_READY3_OFFICIAL_SOURCE_GAP_RECOVERY_0_OF_5`

R12에서 에뛰드 공식 KR 50ml 두 개 구성 페이지의 사용법이:

- 진정이 필요한 부위
- 또는 얼굴 전체

사용을 명시해 `multi_area` 직접 근거로 판정됐다.

R12A에서도 이 1건은 그대로 유지됐고 추가 직접 근거는 회수되지 않았다.

## 대상 상태

Production readback:

- Subject: `84beae6f-72c8-424e-b561-c2c067fef9e0`
- Subject semantic key: `028945101121562f1f5470a44fd1a7974477a7c8a50cd6954102993fb087650d`
- 처방 버전 키: `v21-8h-r10:a8a01568cf96737549c033542599a2d94e843367d0c876774262f0b409125327`
- 시장: `KR`
- 식별 상태: `resolved`
- 현재 상태: `current`
- 연구 작업: `RESEARCH_PENDING`
- 시도 횟수: 0
- 차단 코드: null

대상 Subject에는 사전검증 전:

- 동일 Source: 0
- Subject Binding: 0
- 동일 Fact Evidence: 0
- Fact Instance: 0
- Current Fact: 0

이었다.

## Registry 호환성

Registry:

`product-fact-registry-cross-category-v1`

`primary_use_role`은:

- value type = enum
- `multi_area` 허용
- `usage_instruction` 허용
- positive evidence requirement = product-specific evidence
- deprecated = false

상태다.

## proposition identity

기존 serializer를 그대로 사용했다.

`product-fact-proposition-pilot-v1`

고정 material:

```text
subject semantic key = 028945101121562f1f5470a44fd1a7974477a7c8a50cd6954102993fb087650d
registry              = product-fact-registry-cross-category-v1
fact                  = primary_use_role
value identity        = multi_area
scope                 = market KR
qualifier             = {}
parent                = null
```

계산된 proposition key:

`379a68e4b599cbcc5583b0a830b3718c3f5af0fc52ec62d4d823a728626834d2`

## Evidence digest

기존 `v21-8g3-evidence-v1` digest contract를 재사용했다.

R12의 frozen `etude_bundle_kr` source capture digest:

`a7eb1b96d8551cc88727abedfda7a758e801d5a78eec4acee1de040d970846dc`

계산된 canonical Evidence digest:

`fee6031cbf1683f03de5792d3521dd25b5257deca9b64160656de3453f7ddab9`

## Source / Binding 경계

공식 출처:

`https://www.amoremall.com/kr/ko/product/detail?onlineProdCode=110090000337&onlineProdSn=60201`

이 페이지는 동일한 50ml 제품 2개 구성이다.

따라서 Binding은 과장된 `exact_subject_match`가 아니라:

- `equivalent_presentation_match`
- `scope_relation=equivalent`

로 계획했다.

presentation metadata에:

- exact unit match
- bundle units = 2
- 동일 KR 시장
- 동일 Subject semantic key
- 동일 처방 버전 키

를 고정한다.

## 통제 RPC

허용 RPC:

`admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)`

Production 함수 SHA-256:

`c5bf2429801f3f5811c41d3c39fbddff3eca2914bccb59f100321f369264b481`

권한:

- anon: 실행 불가
- authenticated: 실행 불가
- service_role: 실행 가능
- actor: `admin.products.review` capability 필요

기존 통제 ingest 경계가 그대로 유지되고 있다.

## Rollback probe

정확한 R12C 예정 payload를 Production에서 한 트랜잭션 안에 실행했다.

```text
RPC attempted = 1
RPC accepted  = 1

transaction 내부:
Source   = 1
Binding  = 1
Evidence = 1
Fact Instance = 0
Current Fact  = 0
```

이후 즉시 ROLLBACK했다.

post-rollback:

```text
Source = 0
Binding = 0
Evidence = 0
Review Event = 0
Audit = 0
Fact Instance = 0
Current Fact = 0
```

Production residue는 없다.

## 권위 경계

R12B가 승인하지 않는 것:

- review preparation
- confirmation preflight
- confirmation
- Fact adoption
- Recommendation mutation
- public activation

따라서:

```text
Evidence != Fact
Fact != Decision Axis
Fact adoption != Recommendation activation
```

경계를 유지한다.

## 다음 단계

`V2.1-8H-R12C — READY3 Controlled Evidence Ingest`

R12C에서 허용 가능한 것은 정확히 1건이다.

- task: `39449932-6c41-4762-bf39-e6848c9ad09a`
- RPC: `admin_ingest_product_fact_evidence_v1`
- Evidence: `primary_use_role=multi_area`

R12C는 Evidence materialization까지만 허용한다.

**Review preparation / Confirmation / Recommendation activation은 계속 금지한다.**
