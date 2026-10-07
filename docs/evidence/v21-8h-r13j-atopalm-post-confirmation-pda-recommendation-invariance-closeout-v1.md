# V2.1-8H-R13J — ATOPALM Post-Confirmation PDA / Recommendation Invariance

## 종료 판정

`BARRIER_SUPPORT_ATOPALM_P0_POST_CONFIRMATION_PDA_RECOMMENDATION_INVARIANCE_PASS`

R13I에서 확정한 아토팜 `barrier_support_claim=true` 및 `primary_use_role=multi_area`가 barrier-support PDA와 Recommendation shadow 계약에 미친 영향을 읽기 전용으로 재검증했다.

## 귀속 방법

R13I 귀속은 현재 Production 상태와, **R13I에서 생성한 두 proposition만 제외한 counterfactual pre-state**를 동일 mapper로 재계산해 비교했다.

이 방식은 R12H 이후 다른 identity recovery가 누적된 영향을 R13I에 잘못 귀속하지 않는다.

## 대상 변화

R13I 직전:

```text
signal   = GOVERNED_BARRIER_CLAIM_UNKNOWN
coverage = missing_fact
role     = MISSING
```

R13I 직후:

```text
signal   = GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE
coverage = claim_with_usage_role_context
role     = ESTABLISHED(multi_area)
```

즉 이번에는 R12G 에뛰드와 달리 **signal 자체가 실제로 UNKNOWN → TRUE로 이동**했다.

## live 176

R13I 직전:

```text
BLOCKED 47
TRUE     6
UNKNOWN 18
NA      105
```

R13I 직후:

```text
BLOCKED 47
TRUE     7
UNKNOWN 17
NA      105
```

coverage:

```text
claim_with_usage_role_context 6 -> 7
missing_fact                  8 -> 7
identity_blocked             47 -> 47
category_unknown             10 -> 10
not_applicable              105 -> 105
```

R12H 이후 별도 identity recovery가 누적되어 baseline의 BLOCKED/UNKNOWN 분포가 바뀌어 있으므로, 이 수치를 R12H와 단순 차감하지 않고 counterfactual로 R13I 효과를 분리했다.

## frozen 164

R13I 직전:

```text
BLOCKED 47
TRUE     6
UNKNOWN  8
NA      103
```

R13I 직후:

```text
BLOCKED 47
TRUE     7
UNKNOWN  7
NA      103
```

아토팜은 frozen 164 후보에 포함되어 있다.

## frozen 1,968 annotation

9개 barrier/dehydration 관련 시나리오에서 아토팜 1개 후보가:

```text
held_unknown_product_fact
→ positive_claim_context_available
```

로 이동한다.

집계 변화:

```text
positive_claim_context_available 54 -> 63  (+9)
held_unknown_product_fact        72 -> 63  (-9)
blocked                         564 -> 564
not_relevant                     42 -> 42
not_applicable                 1236 -> 1236
total evaluations              1968 -> 1968
```

positive role context:

```text
full_face   9 -> 9
local_area  9 -> 9
multi_area 36 -> 45
```

## Recommendation 불변성

현재 adapter blob은 R7/R12H와 동일한 `095ee315...`이다.

계약은 계속:

```text
numeric_contribution = null
rank_effect          = NONE
eligibility_effect   = NONE
production_consumption = NO
```

따라서 R13I의 Product Fact 확정으로 설명 가능한 PDA context는 증가했지만:

```text
numeric contribution delta = 0
rank effect delta          = 0
eligibility effect delta   = 0
candidate policy authority = unchanged
scoring authority          = unchanged
Recommendation admission  = not authorized
Recommendation activation = false
public activation          = false
production cutover         = false
```

이다.

frozen R7 artifact는 ranked product ID를 저장하지 않으므로 Top1/Top3 상품 목록은 새로 추정하지 않았다.

## Hosted write 경계

R13J 자체는 read-only reconciliation이다.

```text
Product Fact write = 0
PDA write          = 0
Recommendation     = 0
Registry           = 0
```

## 후속 작업

아토팜 Product Fact confirmation 자체는 완료됐다.

남은 별도 P0 HOLD는:

`ZEROID Intensive SOS Plus Balm — FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED`

이다.

Recommendation 활성화는 여전히 별도 권위가 필요하며 R13J 결과로 자동 승인되지 않는다.
