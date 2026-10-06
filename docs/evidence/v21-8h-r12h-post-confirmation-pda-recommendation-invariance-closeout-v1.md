# V2.1-8H-R12H — Post-Confirmation PDA / Recommendation Invariance Reconciliation

## 종료 판정

`BARRIER_SUPPORT_P0_READY3_POST_CONFIRMATION_PDA_RECOMMENDATION_INVARIANCE_PASS`

R12G에서 확정한 에뛰드 `primary_use_role=multi_area` Product Fact가 barrier-support PDA와 Recommendation shadow 계약에 어떤 영향을 주는지 읽기 전용으로 재검증했다.

## 핵심 결론

R12G가 실제로 바꾼 것은 **usage-role 문맥 1건**뿐이다.

```text
signal state     UNKNOWN -> UNKNOWN
coverage state   missing_fact -> missing_fact
usage role       MISSING -> ESTABLISHED(multi_area)
numeric effect   0
rank effect      0
eligibility      0
```

에뛰드의 `barrier_support_claim`은 아직 Current Fact가 없으므로, barrier-support 신호 자체는 여전히 UNKNOWN이다.

## mapper 계약

대상 카테고리:

`moisturizer_balm`

현재 Subject:

- resolved
- current
- KR

현재 Product Fact:

- `primary_use_role=multi_area`
- `barrier_support_claim` 없음

따라서 현재 mapper 결과:

```text
signal   = GOVERNED_BARRIER_CLAIM_UNKNOWN
coverage = missing_fact
role     = ESTABLISHED(multi_area)
```

adapter 계약은 계속:

```text
numeric_contribution = null
rank_effect          = NONE
eligibility_effect   = NONE
production_consumption = NO
```

이다.

## live 176 재계산

R12G 직전과 직후의 signal / coverage 분포는 동일하다.

### 직전

```text
BLOCKED            48
ESTABLISHED_TRUE    6
UNKNOWN             17
NOT_APPLICABLE     105
```

coverage:

```text
category_unknown                 10
claim_with_usage_role_context     6
identity_blocked                 48
missing_fact                      7
not_applicable                  105
```

### 직후

동일하다.

R12G exact state-count delta = **0**  
R12G exact coverage-count delta = **0**

## frozen 164 × 12 재검증

과거 R7 frozen boundary는 변경하지 않았다.

```text
candidate products = 164
user scenarios     = 12
evaluations        = 1,968
```

R7 당시:

```text
BLOCKED 51
TRUE     6
UNKNOWN  4
NA      103
```

현재 R12G 직전:

```text
BLOCKED 48
TRUE     6
UNKNOWN  7
NA      103
```

R7 → 현재 누적 변화의 `BLOCKED -3 / UNKNOWN +3`은 R12G 1건의 효과가 아니다. 그 사이 Subject coverage 회복이 누적된 결과다.

R12G 직전과 직후 frozen 164 분포는 완전히 동일하다.

## frozen 1,968 annotation 집계

R12G 직전:

```text
blocked                          576
held_unknown_product_fact         63
not_applicable                  1236
not_relevant                      39
positive_claim_context_available  54
```

R12G 직후도 동일하다.

따라서 R12G 귀속 delta:

```text
blocked rows          0
held unknown rows     0
not relevant rows     0
not applicable rows   0
positive rows         0
evaluation count      0
```

이다.

## Recommendation 불변성

에뛰드가 frozen 164 후보에 포함되는 것은 확인됐다.

하지만 R12G로 추가된 Fact는 context-only `primary_use_role`이며 barrier claim을 확정하지 않는다.

따라서:

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

R7 frozen artifact는 ranked product ID를 저장하지 않으므로 top1/top3 제품 목록을 새로 추정하지 않았다.

## Research Task와 evidence gap

READY3 DB task row는 현재도 6개 모두 `RESEARCH_PENDING`이다.

그중 에뛰드 `primary_use_role` 1건은 Product Fact까지 확정됐지만 Confirmation RPC가 연구 Task 상태를 자동 종료하지 않는 계약이므로 그대로 보존했다.

따라서:

```text
DB pending task rows       = 6
unresolved evidence gaps   = 5
```

미해결 gap의 중심은 여전히 `barrier_support_claim` 공식 근거 coverage다.

## 권위 경계

R12H Hosted writes:

```text
Product Fact = 0
PDA          = 0
Recommendation = 0
Registry     = 0
```

R12G의 Fact adoption은 Recommendation activation을 의미하지 않는다.
