# DATA-AI29C-D5E-D — COSRX Admission + Mixed Shadow v1

## 판정

`D5E_D_COSRX_ADMISSION_HOLD_SUBJECT_IDENTITY_AUTHORITY_LINEAGE_MISMATCH`

D5E-C까지 COSRX는 다음 상태다.

- sunscreen taxonomy shadow assignment: 정상
- exact current Subject: 1
- SPF Current: 50
- UVA Current: PA++++
- UV filter Current: organic
- semantic 12/12 reviewed
- D1B semantic envelope: ready
- finish/tone_up/white_cast: established

하지만 기존 `sunscreen-initial-admission-grant-policy-v1`에 현재 Production snapshot을 그대로 넣으면
`SUNSCREEN_INITIAL_ADMISSION_GRANT`가 나오지 않는다.

## 실제 블로커

현재 Subject:

```text
identity_status             = resolved
current_state               = current
subject serializer          = product-fact-subject-identity-v1
identity_resolution_version = gpt-catalog-machine-subject-v1
```

Admission 정책이 허용하는 Subject resolution lineage:

```text
trust-phase5-admin-subject-review-v1
```

따라서 실제 평가 결과는:

```text
decision = NO_GRANT
reason   = PRODUCT_FACT_SUBJECT_UNRESOLVED_OR_NON_CURRENT
```

정책 reason 문자열은 resolved/current 여부와 accepted authority lineage를 하나의 guard에서 검사하기 때문에
이름이 넓게 잡혀 있다.

이번 Production snapshot에서 실제 불일치는
`identityResolutionVersion` 하나다.

## 다른 admission 조건

다음은 모두 충족한다.

- canonical product identity
- canonical sunscreen taxonomy v1
- Registry v1 checksum
- Subject serializer
- SPF / UVA / UV filter Current
- 세 Fact의 authority/confidence/serializer
- D1B semantic envelope
- category_slot = sunscreen
- semantic uv_filter_type = governed Fact와 일치

검증 스크립트에서는 Production을 변경하지 않고
**Subject resolution version만 가상으로 accepted lineage로 치환한 counterfactual input**도 평가한다.

그 경우 기존 정책이 `SUNSCREEN_INITIAL_ADMISSION_GRANT`를 반환해야 한다.

이 검사는 현재 블로커가 다른 데이터 결함과 섞여 있지 않음을 확인하기 위한 것이며,
Production Subject를 자동 변경하는 승인이 아니다.

## Mixed shadow

실행하지 않았다.

```text
mixed shadow executed = false
reason                = SUNSCREEN_INITIAL_ADMISSION_GRANT_REQUIRED
```

D5E-0의 계획상 grant가 성공하면:

```text
legacy 11 + existing new 3 + COSRX 1 = 15
```

mixed shadow를 수행할 수 있다.

현재는 grant가 없으므로 15개 cohort를 만들지 않는다.

기존 authority-complete mixed proof 14개는 그대로 유지한다.

## 왜 여기서 Subject를 바로 수정하지 않는가

기존 Phase 5B에는 explicit Subject preflight/confirm과
`admin_register_product_fact_subject_v1` writer가 있다.

그러나 이 경로는 governed Subject 등록 경로다.

이미 존재하는 machine-lineage Subject의 authority metadata를
D5E-D 안에서 direct UPDATE하거나 admission policy를 완화하는 것은 허용되지 않는다.

특히 다음을 먼저 확인해야 한다.

- semantic key 동일성
- formulation revision 동일성
- KR market 동일성
- competing current Subject 없음
- 기존 Product Fact 3건의 Subject binding 보존 가능성
- governed registration/preflight와 기존 row의 충돌 여부

## 변경 없음

- Product row
- taxonomy assignment
- Product Fact
- semantic reviews
- D5C/D5D allowlist
- SPF beta switch
- Recommendation admission
- Production ranking
- public activation
- UVA activation
- Water activation

## 다음 gate

`DATA-AI29C-D5E-D-R1_COSRX_SUBJECT_IDENTITY_AUTHORITY_RECOVERY_PREFLIGHT`

**read-only** 단계다.

목표는 기존 exact COSRX Subject의 semantic/formulation identity를 바꾸지 않고
admission이 요구하는 governed identity authority lineage로 복구할 수 있는지 확인하는 것이다.

이 preflight가 PASS하기 전까지 mixed shadow와 D5E-E는 금지한다.
