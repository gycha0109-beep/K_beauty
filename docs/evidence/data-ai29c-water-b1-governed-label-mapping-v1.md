# DATA-AI29C-WATER-B1 — Governed JCIA Label → Duration Mapping v1

## 목적

WATER-B에서 ANESSA exact JP Subject에 대해 다음 조합을 확인했다.

```text
exact official product claim = UV耐水性★★
JCIA official label semantics = 80 min total water immersion condition
```

문제는 숫자 `80`이 제품 페이지에 직접 적혀 있지 않다는 점이다.

B1은 이 변환을 **명시적인 governed semantic mapping policy**로 고정한다.

이 단계도 Product Fact write는 하지 않는다.

---

## 핵심 분리

### Product evidence

ANESSA 공식 제품 페이지가 Product-specific primary evidence다.

`https://www.shiseido.co.jp/anessa/products/suncare/perfect_uv_sm/`

이 source는 exact current JP Subject에:

`UV耐水性★★`

라는 product claim을 제공한다.

### Semantic decoder

JCIA 공식 표준은 ANESSA라는 제품의 evidence가 아니다.

따라서 Product Fact evidence table에서
JCIA 표준을 ANESSA exact Subject에 `exact_subject_match`로 묶지 않는다.

JCIA의 역할은 오직:

`UV耐水性★★ → standardized 80-minute immersion condition`

이라는 **label semantics decoder**다.

정책 버전:

`sunscreen-water-jcia-label-mapping-v1`

---

## Mapping

JCIA ISO 18861 기반 기준:

| label | test water immersion condition |
|---|---:|
| UV耐水性★ / ☆ | 40 min = 20 min × 2 |
| UV耐水性★★ / ☆☆ | 80 min = 20 min × 4 |

판정 기준은 SPF retention percentage 평균의
90% 단측 신뢰구간 하한이 50% 이상인 것이다.

따라서 policy가 허용하는 numeric projection:

```text
value_type = number_unit
value_number = 80
value_unit = minutes

qualifier.metric = SPF_retention_percentage
qualifier.method_context = ISO_18861_JCIA_UV_water_resistance
qualifier.timepoint = after_total_80_min_water_immersion
```

---

## 중요한 의미 제한

이 `80 minutes`는:

> 표준 시험에서 사용된 총 water-immersion condition

이다.

다음 의미가 아니다.

> 실제 사용자가 물에 들어간 뒤 정확히 80분 동안 항상 보호 효과가 보장된다.

JCIA Q&A도 실제 사용 조건은 서로 다르므로
일률적인 실제 지속 시간을 제시할 수 없다고 설명한다.

따라서 mapping policy는:

`standardized_test_immersion_condition_not_real_world_effect_duration`

으로 의미를 고정한다.

또한 JCIA `UV耐水性`는 sweat resistance 표시가 아니다.

따라서:

```text
UV耐水性★★
→ sweat resistance 80 min
```

변환은 금지한다.

---

## Admissibility gate

label → duration mapping은 다음을 모두 만족할 때만 허용한다.

1. market = `JP`
2. current resolved exact Subject
3. official product claim
4. exact/equivalent source binding
5. recognized JCIA label
6. 현재 mapping policy version을 명시

하나라도 없으면 fail closed.

generic:

- waterproof
- super waterproof
- water resistant

문구에는 이 mapping을 적용하지 않는다.

---

## ANESSA 결과

Production Subject:

`d1d748c3-8706-4b6c-8719-676f6f317532`

Observed exact claim:

`UV耐水性★★`

Mapping result:

```text
water_resistance_duration = 80 minutes
qualifier:
  metric = SPF_retention_percentage
  method_context = ISO_18861_JCIA_UV_water_resistance
  timepoint = after_total_80_min_water_immersion
```

Product source authority:

`product_specific_primary`

Evidence class:

`product_claim`

### 현재 허용 상태

`controlledEvidenceIngestEligible = true`

하지만:

`autoConfirmationEligible = false`

이다.

즉 policy가 Fact를 자동 생성하지 않는다.

기존 controlled Product Fact pipeline을 그대로 통과해야 한다.

---

## 기존 governance와 호환

Production에는 이미:

- `admin_ingest_product_fact_evidence_v1`
- `admin_prepare_product_fact_review_v1`
- `admin_preflight_product_fact_confirmation_v1`
- `admin_confirm_product_fact_v1`

가 존재한다.

새 write path를 만들 필요가 없다.

기존 confirmation preflight는:

- exact/current Subject
- latest registry
- supported typed value
- allowed unit
- current evidence
- evidence authority ceiling
- review assignment state
- payload/prestate digest

를 재검증한다.

WATER-C는 이 기존 governed path만 사용한다.

---

## B1 판정

`WATER_B1_GOVERNED_LABEL_MAPPING_PASS_CONTROLLED_ADOPTION_CANDIDATE`

다음:

`WATER_C_CONTROLLED_ANESSA_FACT_ADOPTION`

WATER-C에서 처음으로:

1. exact product evidence ingest
2. review assignment
3. preflight
4. controlled confirmation
5. Current readback

을 수행할 수 있다.

---

## Production boundary

B1 자체에서는 계속 false:

- Product Fact write
- Evidence write
- Review write
- Confirmation
- Registry mutation
- live Product Query schema mutation
- scorer wiring
- water activation
- public activation
- production cutover

SPF Production beta도 변경하지 않는다.
