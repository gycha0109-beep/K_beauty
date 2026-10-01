# DATA-AI29C-WATER-C — ANESSA Controlled Water Product Fact Adoption v1

## 목적

WATER-B1에서 승인한 governed mapping을 실제 Product Fact pipeline으로 검증한다.

대상은 current exact Subject 한 건뿐이다.

```text
product  = ANESSA Perfect UV Sunscreen Skincare Milk NA
product  = cbcd06a2-de29-47ca-afd1-ab1d5de93903
subject  = d1d748c3-8706-4b6c-8719-676f6f317532
market   = JP
variant  = NA
```

이 단계는 **Product Fact adoption**이며 Recommendation activation이 아니다.

## Semantic source

Exact official product claim:

`UV耐水性★★`

Mapping policy:

`sunscreen-water-jcia-label-mapping-v1`

governed projection:

```text
water_resistance_duration = 80 minutes

metric         = SPF_retention_percentage
method_context = ISO_18861_JCIA_UV_water_resistance
timepoint      = after_total_80_min_water_immersion
```

80분은 실사용 효과 보장 시간이 아니라
**JCIA/ISO 18861 standardized water-immersion test condition**이다.

## Controlled execution

새 SQL write path를 만들지 않았다.

기존 Production RPC만 사용했다.

1. `admin_ingest_product_fact_evidence_v1`
2. `admin_prepare_product_fact_review_v1`
3. `admin_preflight_product_fact_confirmation_v1`
4. `admin_confirm_product_fact_v1`

### Evidence

- source id: `afa605ae-dc1c-41ea-b566-59c8e9b26d30`
- binding id: `c6a42da9-4cef-49a8-94a2-67e024a60f68`
- evidence id: `2e118375-6bf8-43a3-abec-2a68400aa76b`
- binding: `exact_subject_match`
- scope: `equivalent`
- evidence class: `product_claim`
- authority: `product_specific_primary`
- confidence: `medium`

JCIA 표준 문서는 exact ANESSA evidence로 저장하지 않았다.
그 표준은 B1 mapping policy의 semantic decoder다.

### Review

assignment:

`c373aa09-7cb8-4fda-ba7e-fdf3346381e9`

전이:

```text
under_review
→ ready_for_confirm
→ confirmed
```

### Preflight

`status = ready`

- payload digest:
  `286cc3c7932d222a9a70e626eb82954c693273120a8adc25b428016a08be2f6e`
- prestate digest:
  `a82541182bfd7a019025d40e0090b939d76e5019e34d62348bfc491357780e05`
- fusion input digest:
  `f4ff3e1a58b34e96981c2bad25902fc66f4568f7c6d2df587732f49d4cfcdd57`

preflight의 expected write set은 정확히:

- Product Fact Instance 1
- Product Fact Current 1
- Confirmation 1
- Evidence Link 1
- Review Event 1
- Review Assignment transition 1

이었다.

## Confirmed Product Fact

```text
proposition = 2b145dff9a002879db9d66c5dda622c6f8fc10d807dae2cf134bed62dbd5b63b
fact        = 39394ff3-3f57-49d6-96ee-2df39f404872
confirmation= 11b9359a-eac4-46e2-afe2-697341743230

semantic_status  = supported
value_type       = number_unit
value_number     = 80
value_unit       = minutes
market           = JP
authority_ceiling= product_specific_primary
fused_confidence = medium
```

Current readback PASS.

supporting evidence link:

`2e118375-6bf8-43a3-abec-2a68400aa76b`

1건만 연결되어 있다.

## Idempotency

동일 request id + 동일 payload + 동일 digest로 confirmation을 다시 실행했다.

결과:

`idempotent = true`

새 Fact / Confirmation은 생성되지 않았다.


## Parallel execution remediation

WATER-C 실행 중 별도 taxonomy-ai 실행이 canonical adoption을 먼저 완료한 상태에서
후발 병렬 confirmation이 같은 `cardinality=one` Subject/fact에
qualifier가 다른 두 번째 proposition을 잠시 Current로 만들었다.

canonical 선행 Fact:

```text
proposition  = 2b145dff9a002879db9d66c5dda622c6f8fc10d807dae2cf134bed62dbd5b63b
fact         = 39394ff3-3f57-49d6-96ee-2df39f404872
confirmation = 11b9359a-eac4-46e2-afe2-697341743230
assignment   = c373aa09-7cb8-4fda-ba7e-fdf3346381e9
```

이 Fact를 canonical로 유지한 이유:

- B1 `mapping_policy_version` 보존
- exact observed label `UV耐水性★★` 보존
- `standardized_test_immersion_condition_not_real_world_effect_duration` 의미 제한 보존
- WATER-C 정식 review/fusion policy 사용

후발 중복:

```text
proposition  = 035a31aceae525e29bcd4dc795be4fe8f65d42aba55b8a39cbe1c03b1c524d29
fact         = ceb0bf3f-bff6-477a-b7b3-1bb0a11ab287
confirmation = 9a319795-795c-41eb-b471-4b3bc7d2854c
assignment   = a03a436e-fdc2-48e8-84ca-c0583e0d3d9f
```

복구는 exact prestate를 검증하는 단일 transaction으로 제한했다.

- 후발 duplicate `product_fact_current` mapping만 제거
- 후발 assignment를 `superseded`로 전환
- immutable Fact / Confirmation / Evidence history는 보존
- review event 및 admin audit 기록

복구 기록:

- review event: `3a1eb4e7-5747-4a92-84ec-f029516feeb4`
- audit: `ac16ba96-77e8-4830-8370-a9e5eb711626`
- request: `data-ai29c-water-c-duplicate-remediation-v1`
- prestate digest:
  `e3a83f1756d07db10c4214dde720a825abc7a6d88d151b86687e099ff84fa187`

복구 후:

```text
current water_resistance_duration Fact count = 1
canonical assignment = confirmed
duplicate assignment = superseded
immutable duplicate history = preserved
```

### 발견된 governance gap

이번 사건은 generic Product Fact preflight/confirmation이
`cardinality=one` definition에 대해
**이미 다른 proposition이 Current인 상태에서 새로운 다른 proposition confirmation을 원자적으로 차단하지 못하는 경로**가 있음을 보여준다.

따라서 WATER-C 이후 우선 작업은 authority 확장보다:

`cardinality-one parallel confirmation guard hardening`

이다.

새 proposition이 기존 Current를 대체해야 한다면
일반 confirmation이 아니라 explicit governed replacement/revalidation path를 사용해야 한다.


## Coverage 변화

WATER-B 이전:

`0 / 20`

WATER-C 이후:

`1 / 20`

현재 eligible product는 ANESSA 한 건뿐이다.

이 값은 아직 ranking readiness가 아니다.

## Production boundary

WATER-C에서 변한 것:

- governed Evidence: +1
- Review Assignment: confirmed +1
- governed Product Fact Current: +1

변하지 않은 것:

- Registry
- live Product Query intent schema
- provider prompt
- recommendation answer contract
- protection scorer wiring
- water axis runtime activation
- Production ranking
- Product Query public activation
- broad cutover authorization
- query persistence
- SPF Production activation

따라서:

`Fact adoption != Recommendation activation`

원칙을 유지한다.

## 판정

`WATER_C_ANESSA_CONTROLLED_FACT_ADOPTION_PASS`

다음 단계는 **Water authority 확장**이다.

1/20만으로 cohort-wide water bonus/penalty를 켜지 않는다.
