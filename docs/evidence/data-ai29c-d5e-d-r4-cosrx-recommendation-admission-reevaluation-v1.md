# DATA-AI29C-D5E-D-R4 — COSRX Recommendation Admission 재평가 v1

## 판정

`D5E_D_R4_COSRX_RECOMMENDATION_ADMISSION_REEVALUATION_PASS`

기존 D5E-D의 유일한 blocker였던 Subject identity authority lineage를 governed 관리자 경로로 승격한 뒤,
현재 Production authority를 기존 `sunscreen-initial-admission-grant-policy-v1`에 다시 넣어 읽기 전용으로 평가했다.

결과:

```text
decision = SUNSCREEN_INITIAL_ADMISSION_GRANT
grant    = true
reason   = SUNSCREEN_IDENTITY_PROTECTION_AND_SEMANTIC_AUTHORITY_COMPLETE
```

이번 단계에서 Production write는 0이다.

## 이전 HOLD와 달라진 값

이전 D5E-D:

```text
identity_resolution_version = gpt-catalog-machine-subject-v1
decision                    = NO_GRANT
```

현재:

```text
identity_resolution_version = trust-phase5-admin-subject-review-v1
decision                    = SUNSCREEN_INITIAL_ADMISSION_GRANT
```

Admission 입력에서 바뀐 권위 값은 위 Subject lineage 하나다.

다음은 그대로다.

- Product ID
- Subject ID
- Subject semantic key
- formulation revision
- market / variant / region
- taxonomy assignment
- Registry checksum
- Product Fact 3건
- semantic review 12건

## Governed authority upgrade lineage

관리자 confirmation 기록:

```text
event_kind  = subject_identity_authority_upgraded
reason      = controlled_identity_authority_upgrade
request     = data-ai29c-d5e-d-r3p-d2d54525-f441-48c5-b4a2-b35a56d9796d
executed_at = 2026-10-06T19:56:32.72353+09:00
```

직접 Subject UPDATE나 admission policy 완화로 우회하지 않았다.

## Production readback

현재 exact COSRX Subject:

- resolved / current
- KR
- variant = null
- formulation revision = `official-snapshot:c0ea336524925d3d493d73c43e49207e`
- identity authority = `trust-phase5-admin-subject-review-v1`

Frozen dependency cardinality:

```text
Product Fact Current              = 3
Product Fact Instances            = 3
Research Tasks                    = 3
Source Bindings                   = 2
Evidence Records                  = 3
Current Semantic Reviews          = 12
Exact Current Applicability Subject = 1
```

Admission-critical Current Fact:

```text
SPF       = 50
UVA       = PA++++
UV filter = organic
```

세 Fact 모두 supported / product_specific_primary / high confidence 상태를 유지한다.

## Semantic 경계

12개 필드는 모두 review 완료다.

Established 7:

- category_slot
- skin_types
- concerns
- finish
- uv_filter_type
- tone_up
- white_cast

Reviewed-not-established 5:

- texture
- sensitivity_safe
- irritation_risk
- eye_sting
- pilling_risk

따라서 D1B envelope는 ready지만,
위 5개가 필요한 context에서는 기존 fail-closed가 그대로 유지된다.

Admission grant를 safety 보증이나 범용 protection authority로 확대 해석하지 않는다.

## Production 경계

변경 없음:

- 기존 D5C/D5D allowlist = 3
- COSRX live allowlist 미포함
- authenticated beta activation = DATA-AI29C-D5D 그대로
- Recommendation ranking 변경 없음
- public activation 없음
- UVA axis activation 없음
- Water resistance activation 없음
- mixed shadow 실행 없음

즉 이번 grant는 다음 bounded 검증 단계로 진입할 수 있는 admission authority일 뿐이다.

## 다음 gate

`DATA-AI29C-D5E-E_COSRX_4_PRODUCT_INTERNAL_CANARY`

기존 3-product canary에 COSRX를 더한 4-product 내부 canary가 다음 단계다.

D5E-E 검증 전에는 D5E-F authenticated beta allowlist 확장을 실행하지 않는다.
