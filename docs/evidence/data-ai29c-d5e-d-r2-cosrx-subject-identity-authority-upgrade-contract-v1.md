# DATA-AI29C-D5E-D-R2 — COSRX Subject Identity Authority Upgrade Contract v1

## 판정

`D5E_D_R2_SUBJECT_IDENTITY_AUTHORITY_UPGRADE_CONTRACT_READY_DESIGN_ONLY`

이번 단계는 **설계 전용**이다.

Production Subject / Product Fact / Recommendation write는 0건이다.

## 문제 정의

현재 COSRX Subject의 semantic identity는 이미 정확하다.

D5E-D-R1에서 확인한 차이는 오직:

```text
identity_resolution_version
gpt-catalog-machine-subject-v1
→ trust-phase5-admin-subject-review-v1
```

이다.

기존 Subject 등록 RPC는 immutable registration boundary이므로
동일 semantic key에 이 값만 바꾼 payload를 replay하면 conflict가 난다.

따라서 신규 계약은 **Subject 재등록 계약이 아니라 identity authority provenance 승격 계약**이어야 한다.

## 설계 원칙

1. 기존 `subject_id` 유지
2. semantic key 유지
3. 처방/variant/market/validity 유지
4. 기존 Fact/Evidence/Semantic binding 유지
5. admission policy 변경 없음
6. direct UPDATE 금지
7. 관리자 명시적 승인
8. preflight와 confirmation 분리
9. stale-prestate digest 필수
10. 감사 로그 필수

## 제안 RPC

### 1. Read-only preflight

`admin_preflight_product_fact_subject_identity_authority_upgrade_v1`

입력:

- actor_user_id
- subject_id
- source_candidate_id
- reviewed_identity

출력:

- 현재/목표 authority version
- semantic key
- payload digest
- prestate digest
- 예상 write set
- explicit confirmation 필요 여부

write = 0.

### 2. Explicit confirmation

`admin_upgrade_product_fact_subject_identity_authority_v1`

입력:

- actor_user_id
- request_id
- payload
- expected_payload_digest
- expected_prestate_digest

confirmation 직전 prestate를 다시 계산해
조금이라도 달라졌으면 stale로 거부한다.

## 허용되는 Subject 변경

정확히 하나다.

```text
identity_resolution_version
```

v1 허용 transition:

```text
from = gpt-catalog-machine-subject-v1
to   = trust-phase5-admin-subject-review-v1
```

추가로 `updated_at`만 시스템 시각으로 갱신한다.

그 외 Subject 필드는 전부 byte-equivalent 의미로 보존되어야 한다.

## 관리자 review 검증

승격은 단순 문자열 교체가 아니다.

기존 `buildTrustSubjectIdentityProposal()`과 같은 reviewed identity semantics를 사용해
관리자가 검토한 identity를 다시 canonicalize해야 한다.

그 결과의:

`subject_semantic_key`

가 기존 Subject와 정확히 같아야 한다.

따라서 제품, variant, formulation, market, region, validity 중 하나라도 달라지면
authority upgrade가 아니라 새 identity 문제이므로 fail-closed한다.

## Catalog authority source

현재 COSRX source candidate는 다음 조건을 만족해야 한다.

- promoted
- identity resolved
- 동일 product
- official HTTPS source
- official content SHA-256 digest
- Product Fact write authority = false

catalog source 자체를 Product Fact authority로 승격하지 않는다.

관리자 검토가 **Subject identity authority attestation**을 생성하는 것이다.

## stale-prestate digest

단순 Subject row만 해시하지 않는다.

다음 전체를 canonical snapshot으로 묶는다.

### Subject

- immutable identity fields 전체
- 현재 identity resolution version
- updated_at

### Catalog identity source

- source candidate
- resolved 상태/version
- official locator
- content digest
- authority boundary

### Existing dependent authority

- Product Fact Current
- Fact Instances
- Research Tasks
- Source Bindings
- Evidence Records
- current Semantic Reviews

각 항목은 ID/digest를 정렬한 뒤 해시한다.

따라서 preflight 이후 Fact/Evidence/Semantic lineage가 바뀌어도 confirmation이 stale로 차단된다.

## 현재 동결 cardinality

```text
Product Fact Current      = 3
Product Fact Instances    = 3
Research Tasks            = 3
Source Bindings           = 2
Evidence Records          = 3
Current Semantic Reviews  = 12
Exact current Subject     = 1
```

R3 실행 전 이 상태가 바뀌면 preflight를 새로 받아야 한다.

## 정확한 write set

confirmation 성공 시 허용:

### product_fact_subjects

1 row:

- identity_resolution_version
- updated_at

### product_fact_review_events

1 row:

```text
event_kind  = subject_identity_authority_upgraded
reason_code = controlled_identity_authority_upgrade
```

### admin_audit_logs

1 row:

```text
action      = admin.product_fact.subject_identity_authority_upgraded
target_type = product_fact_subject
```

그 외 write = 0.

## 감사 정보

감사 이벤트에는 최소 다음을 남긴다.

- request_id
- subject/product/source candidate
- semantic key
- 이전/다음 authority version
- official source locator/digest
- reviewed identity
- payload digest
- prestate digest

actor UUID는 시스템 내부 감사 정보이며 일반 evidence/report에는 노출하지 않는다.

## 멱등성과 rollback 방향

같은 request_id + 같은 transition + 같은 digest replay는 idempotent success 허용.

같은 request_id에 다른 payload는 거부한다.

이미 목표 authority로 승격된 상태라면
모든 provenance가 동일한 경우에만 `already_upgraded`로 read-only 처리한다.

downgrade는 v1에서 금지한다.

## 금지

- Subject ID 변경
- semantic key 변경
- formulation/variant/market 변경
- 새 Subject 생성
- 기존 Fact 재바인딩
- Evidence 변경
- Semantic Review 변경
- taxonomy 변경
- admission policy 완화
- Recommendation 변경
- D5C/D5D allowlist 확대

## 다음 단계

`DATA-AI29C-D5E-D-R3_COSRX_SUBJECT_IDENTITY_AUTHORITY_UPGRADE_IMPLEMENTATION`

R3에서만 migration/RPC를 구현한다.

R3의 순서:

1. migration + static verifier
2. PR/CI
3. merge/deploy
4. COSRX Production **preflight만 실행**
5. STOP
6. 별도 승인 후 explicit confirmation

즉 R2는 실제 authority upgrade를 승인하지 않는다.
