# DATA-AI29C-D5E-D-R3 — COSRX Subject Identity Authority Upgrade Implementation v1

## 판정

`D5E_D_R3_SUBJECT_IDENTITY_AUTHORITY_UPGRADE_IMPLEMENTATION_READY_NOT_DEPLOYED`

R2 계약을 실제 migration/RPC로 구현했다.

**아직 Production DB에는 적용하지 않았다.**

따라서 현재 Production Subject authority와 Recommendation 상태는 그대로다.

## 구현

Migration:

`supabase/migrations/20261006110000_data_ai29c_d5e_d_r3_subject_identity_authority_upgrade_v1.sql`

세 함수가 추가된다.

1. 내부 read-only plan builder
   `product_fact_subject_identity_authority_upgrade_plan_v1`

2. 관리자 read-only preflight
   `admin_preflight_product_fact_subject_identity_authority_upgrade_v1`

3. 관리자 explicit confirmation
   `admin_upgrade_product_fact_subject_identity_authority_v1`

## 허용 transition

```text
gpt-catalog-machine-subject-v1
→ trust-phase5-admin-subject-review-v1
```

Subject에서 실제로 변경 가능한 업무 필드는:

`identity_resolution_version`

하나뿐이다.

시스템 필드 `updated_at`만 함께 갱신한다.

## Identity 불변성

confirmation 전에 DB가 직접 semantic key를 다시 계산한다.

다음 값은 현재 Subject와 관리자 reviewed identity가 정확히 같아야 한다.

- product
- variant
- formulation revision
- formulation label
- market
- region
- validity

재계산된 semantic key가 저장된 Subject semantic key와 다르면 즉시 실패한다.

즉 이 RPC는 제품/처방 변경 기능이 아니다.

## Catalog authority 검증

source candidate는 다음을 모두 만족해야 한다.

- promoted
- resolved
- 동일 product
- official HTTPS locator
- SHA-256 official content digest
- Product Fact write authority = false

catalog identity 자체를 Product Fact authority로 오인하지 않는다.

## stale-prestate

preflight는 다음 전체를 정렬된 canonical snapshot으로 묶어 digest를 만든다.

- Subject
- catalog identity source
- 동일 applicability의 current Subject 집합
- Product Fact Current
- Product Fact Instances
- Research Tasks
- Source Bindings
- Evidence Records
- current Sunscreen Semantic Reviews

confirmation 직전 같은 digest를 다시 계산한다.

중간에 Fact/Evidence/Semantic lineage가 하나라도 바뀌면 stale로 거부한다.

## 동시성

confirmation은:

1. Subject ID advisory lock
2. Subject row lock
3. prestate 재계산
4. digest exact-match
5. write

순서로 실행한다.

## 멱등성

기존 `admin_audit_logs`의 request identity를 재사용한다.

같은 request + 같은 digest의 성공 replay만 idempotent success로 허용한다.

같은 request에 다른 Subject/source/digest가 들어오면 fail-closed한다.

## 성공 write set

정확히:

```text
product_fact_subjects       = 1 row
  identity_resolution_version
  updated_at

product_fact_review_events  = 1 row
admin_audit_logs            = 1 row
```

다음 write는 0이다.

- Product Fact
- Evidence
- Source Binding
- Research Task
- Semantic Review
- Taxonomy
- Recommendation
- D5C/D5D allowlist

## ACL

내부 plan builder는 service role에서도 직접 실행할 수 없다.

preflight/confirmation RPC만 service role에 노출한다.

anon/authenticated에는 execute 권한이 없다.

service role의 Subject 테이블 직접 UPDATE 권한은 계속 금지한다.

## 현재 단계 경계

이번 단계에서 하지 않은 것:

- Production migration 적용
- Production preflight
- Subject authority 실제 승격
- admission 재평가
- mixed shadow
- runtime allowlist 변경

## 다음 단계

`DATA-AI29C-D5E-D-R3-P_COSRX_PRODUCTION_PREFLIGHT`

R3 PR merge + CI PASS 후:

1. migration 배포
2. 권한/보안 검증
3. COSRX exact prestate 재확인
4. read-only preflight 실행
5. `status=ready`와 digest/write set 확인
6. **STOP**

explicit confirmation은 그 다음 별도 단계에서만 실행한다.
