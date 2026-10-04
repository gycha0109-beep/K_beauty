# V2.1-8H-R10 — P0 READY3 Subject Identity Preflight

## 종료 판정

`BARRIER_SUPPORT_P0_READY3_SUBJECT_IDENTITY_PREFLIGHT_PASS`

R9 READY 3개에 대해 실제 Subject 등록 전 Production 사전상태, 공식 캡처 digest, formulation revision key, Subject semantic key, 기존 task 계보, 등록 함수 권한과 payload를 읽기 전용으로 고정했다.

## 대상

- 에뛰드 — 순정 판텐소사이드™ 10 시카 밤 50ml
- 마녀공장 — 판테토인 인리치드 밤 80ml
- 더하르나이 — 시카이드 밤 100ml

R9 HOLD 2개는 포함하지 않는다.

## Production 사전상태

세 제품 모두 동일한 구조다.

- 기존 Product Fact Subject: **Subject 0**
- catalog trust intake: **intake 1**
- Registry v1 연구 task: **task 2**
- source candidate: 0
- intake market: null
- intake identity: `SUBJECT_CREATION_REQUIRED`
- intake trust: `REVIEW_REQUIRED`
- task state: `REVIEW_REQUIRED`
- task blocker: `SUBJECT_CREATION_REQUIRED`
- task attempt_count: 0

전체 Product Fact Subject는 47개다. 새 semantic key 및 formulation revision key에 대한 기존 충돌은 **충돌 0**이다.

## 키 계산

공식 R9 캡처를 canonical JSON으로 직렬화해 SHA-256을 계산한다.

- 더하르나이 capture: `e769b508ecdcf0f6f652a00da3434867364ef5d04cc627c9bec65163b641e4de`
- 에뛰드 capture: `a8a01568cf96737549c033542599a2d94e843367d0c876774262f0b409125327`
- 마녀공장 capture: `c48757c1795e8fc7afe01fb3d479c7ff3c87753ab20e28e51894dee04fbd4a60`

`formulation_revision_key = v21-8h-r10:<capture_digest>`로 고정한다.

Subject semantic identity는 각 제품에 대해:

- product_id
- variant_key = null
- formulation_revision_key
- market_applicability = KR
- region_applicability = null
- valid_from = null
- valid_to = null

만 포함해 기존 `product-fact-subject-identity-v1` 계약과 같은 canonical SHA-256을 사용한다.

## 다음 쓰기 단계의 순서

R10에서는 실행하지 않는다. R11에서만 다음 순서를 허용한다.

1. `admin_resolve_catalog_trust_intake_identity_v1`
   - 현재 intake `updated_at`을 optimistic lock으로 사용
   - KR market 및 공식 source locator/capture digest 기록
2. `admin_register_product_fact_subject_v1`
   - frozen semantic key와 immutable identity payload 등록
3. `process_catalog_trust_product_v3`
   - Registry v1 명시
   - 기존 task ID를 새 Subject로 reconciliation
   - official identity authority 보존

세 함수 모두 현재 Production에서 anon/authenticated 실행 불가, service_role 실행 가능 상태다.

## 불변성

- intake 쓰기: 0
- Subject 쓰기: 0
- task 쓰기: 0
- Evidence 쓰기: 0
- Product Fact 쓰기: 0
- Recommendation 변화: 0
- public activation: false
- missing != false

## 다음 단계

`V2.1-8H-R11 — P0 READY3 Controlled Subject Registration`

R11은 이 preflight payload를 변경하지 않고 READY 3개만 하나의 원자적 batch로 등록하는 단계다. 실행 직전 Production prestate가 R10과 다르면 쓰지 않고 중단해야 한다.
