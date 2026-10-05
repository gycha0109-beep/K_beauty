# DATA-AI29C-D5E-C — COSRX Sunscreen Semantic Bundle v1

## 판정

`D5E_C_COSRX_SEMANTIC_REVIEW_PASS_D1B_ENVELOPE_READY_NEUTRAL_COMPARABLE`

COSRX Ultra-Light Invisible Sunscreen의 sunscreen Recommendation semantic 12개 필드를
기존 Production review RPC로 전부 review했다.

새 semantic writer나 새 enum은 만들지 않았다.

## Production 결과

```text
required fields                = 12
reviewed fields                = 12
established                    = 7
reviewed_not_established       = 5
conflict                       = 0
not_reviewed                   = 0
```

established:

- category_slot = sunscreen
- skin_types = [sensitive]
- concerns = [dehydration, oiliness]
- finish = fresh
- uv_filter_type = organic
- tone_up = false
- white_cast = none

reviewed_not_established:

- texture
- sensitivity_safe
- irritation_risk
- eye_sting
- pilling_risk

## 근거 경계

공식 COSRX 페이지는 다음을 직접 명시한다.

- sheer / transparent formula
- refreshing, hydrated finish
- invisible on all skin tones
- no white cast
- non-greasy
- hydration boost
- sensitive skin target
- niacinamide controls sebum

`uv_filter_type=organic`은 D5E-B에서 확정된 governed Product Fact Current를 사용했다.

### 의도적으로 확정하지 않은 값

`texture`

공식 페이지의 light / sheer / fast-absorbing은
현재 controlled enum `watery / gel / lotion / cream` 중 하나를 고르기에 부족하다.

`sensitivity_safe`

sensitive-skin target은 절대적인 안전성 boolean과 동일하지 않다.

`irritation_risk`

공식 soothing/sensitive 문구만으로 low/medium/high risk를 정량화하지 않는다.

`eye_sting`

공식 페이지 사용자 리뷰에 초기 stinging 사례가 있으나
low/medium/high 전체 위험도를 확정할 정도의 aggregate authority는 아니다.

`pilling_risk`

현재 공식 근거만으로 makeup/pilling risk를 low/medium/high로 확정하지 않는다.

## Raw bundle complete와 D1B envelope의 차이

Production raw reader 결과:

`SEMANTIC_BUNDLE_INCOMPLETE`

이다.

이는 D1 table의 strict complete 정의가 **12/12 established**를 요구하기 때문이다.

그러나 D1B projection은 의도적으로 다른 기준을 쓴다.

D1B envelope:

1. exact current Subject
2. bundle contract v1
3. 12개 전부 review
4. not_reviewed = 0
5. category_slot established
6. uv_filter_type established

COSRX는 이 조건을 전부 충족한다.

따라서:

```text
raw bundle complete = false
D1B envelope ready  = true
```

이며 이것은 설계된 동작이다.

## Contextual fail-closed

현재 eligible:

- neutral
- finish-relevant
- tone-up-relevant
- white-cast-relevant

현재 fail-closed:

- sensitivity-relevant
- eye-sting-relevant
- pilling-relevant
- texture-relevant

즉 unresolved 값을 false/low/medium/default로 바꾸지 않는다.

## Production boundary

변경:

- sunscreen semantic review current +12

변경 없음:

- Product row
- Product Fact
- canonical taxonomy
- D5C/D5D live 3-product allowlist
- SPF beta switch
- Recommendation admission
- Production ranking
- public search activation
- UVA ranking
- Water ranking

COSRX는 아직 Production live allowlist에 들어가지 않았다.

## 다음 gate

`DATA-AI29C-D5E-D_COSRX_ADMISSION_AND_MIXED_SHADOW`

D5E-C 실행 증거 merge + CI PASS 이후에만 진행한다.

D5E-D에서 처음으로 기존
`evaluateSunscreenInitialAdmissionGrant()`
정책에 COSRX의 현재 Product Fact / taxonomy / Subject / semantic envelope를 넣어
grant 여부를 재평가하고, grant인 경우에만 mixed shadow를 수행한다.
