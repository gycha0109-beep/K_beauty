# DATA-AI29C-D5E-D-R1 — COSRX Subject Identity Authority Recovery Preflight v1

## 판정

`D5E_D_R1_COSRX_SUBJECT_AUTHORITY_RECOVERY_PREFLIGHT_HOLD_EXISTING_PATH_SEMANTIC_KEY_CONFLICT`

이번 단계는 read-only다. Production write는 0건이다.

## 핵심 결론

COSRX의 현재 Subject는 제품·처방·시장 정체성 자체가 틀린 것이 아니다.

현재 Subject의 semantic identity:

```text
product_id                   = 888eca86-af25-4a12-b9ea-47922d83f520
variant_key                  = null
formulation_revision_key     = official-snapshot:c0ea336524925d3d493d73c43e49207e
market_applicability         = KR
region_applicability         = null
valid_from                   = null
valid_to                     = null
subject_semantic_key         = db6a09f788a6b6008881525d1b409d3c16d8b3132006c8a0f174607516133501
```

현재 값을 그대로 관리자 review identity로 넣어 Phase 5B proposal을 재구성하면
**동일한 subject_semantic_key**가 나온다.

즉 새 제품/새 처방/새 시장 Subject가 필요한 상황이 아니다.

## 실제 차이

기존 Subject와 관리자 proposal의 payload 차이는 정확히 하나다.

```text
identity_resolution_version

현재     = gpt-catalog-machine-subject-v1
proposal = trust-phase5-admin-subject-review-v1
```

따라서 D5E-D에서 확인한 admission HOLD는 semantic identity 문제가 아니라
**identity authority provenance 문제**다.

## 기존 Phase 5B 경로를 그대로 재사용할 수 없는 이유

기존 controlled writer:

`admin_register_product_fact_subject_v1`

은 immutable Subject registration boundary다.

동일 `subject_semantic_key`가 이미 존재할 때:

- 전체 payload가 동일하면 idempotent replay
- payload가 하나라도 다르면 semantic-key conflict

로 동작한다.

현재는 의미 키가 같지만 `identity_resolution_version`이 다르므로
기존 preflight/confirm 경로는:

`trust_subject_registration_semantic_key_conflict`

로 fail-closed되어야 한다.

따라서 기존 등록 경로는 **authority upgrade 경로가 아니다**.

## DB guard

Production 제약도 우회 생성을 막는다.

- `subject_semantic_key` UNIQUE
- current applicability:
  `product_id + variant_key + market + region`
  UNIQUE
- service_role direct INSERT/UPDATE/DELETE 권한 없음

따라서:

1. 같은 의미 키로 두 번째 Subject 생성
2. 같은 KR/current applicability로 병렬 current Subject 생성
3. service role direct UPDATE

모두 허용된 복구 방식이 아니다.

## 기존 Subject에 이미 연결된 권위 데이터

현재 Subject에는 이미 다음이 연결돼 있다.

```text
Product Fact Current       = 3
Product Fact Instance      = 3
Research Task              = 3
Source Binding             = 2
Evidence Record            = 3
Current Semantic Review    = 12
```

새 Subject를 억지로 만들어 재바인딩하는 것은 D5E-D-R1 권한 밖이며
불필요한 identity migration 위험을 만든다.

## 복구 판단

현재 안전하게 말할 수 있는 것은 다음이다.

```text
semantic identity         = 그대로 보존 가능
formulation identity      = 그대로 보존 가능
market                    = 그대로 보존 가능
existing Subject id       = 보존해야 함
기존 Phase 5B 등록 경로   = authority upgrade에는 사용 불가
direct UPDATE             = 금지
admission policy 완화     = 금지
```

따라서 별도의 **governed Subject identity authority upgrade contract**가 필요하다.

이 계약은 일반 Subject 수정 기능이 되어서는 안 된다.

허용 범위는 기존 Subject의 semantic identity를 그대로 둔 채,
관리자 검증을 통해 identity authority provenance만 승격하는 것으로 제한해야 한다.

## 다음 gate

`DATA-AI29C-D5E-D-R2_COSRX_SUBJECT_IDENTITY_AUTHORITY_UPGRADE_CONTRACT`

설계 전용 단계다.

필수 조건:

1. 기존 subject_id 유지
2. semantic key / formulation / variant / market / region / validity 변경 금지
3. stale-prestate guard
4. 관리자 review capability 필수
5. audit event 필수
6. 기존 Fact/Evidence/Semantic binding 불변성 검증
7. COSRX 한정 bounded execution부터 시작
8. 실제 authority upgrade 후 admission policy를 다시 실행해 grant 여부 확인
9. grant 전 mixed shadow 금지
