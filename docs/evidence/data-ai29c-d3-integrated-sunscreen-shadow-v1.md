# DATA-AI29C-D3 — Integrated Recommendation + Protection Shadow v1

## 목적

D3는 D2에서 admission authority가 생긴 비-legacy sunscreen을 실제 Production 후보군에 넣는 단계가 아니다.

목표는 다음 순서를 **shadow-only**로 실제 현재 Recommendation scorer에 연결해 검증하는 것이다.

```text
SUNSCREEN_INITIAL_ADMISSION_GRANT
→ D1B request-context semantic gate
→ established semantic projection only
→ existing sunscreen hard reject
→ existing sunscreen baseline scorer
→ SPF/UVA protection shadow delta
→ shadow-only numeric score comparison
```

## 불변 경계

D3에서 다음은 모두 false다.

- Production candidate admission wiring
- Production ranking change
- Production cutover authorization
- outdoor_exposure rankable authorization
- public activation
- water resistance application
- hard-rejected candidate resurrection
- raw Product null/default fallback
- Production tie-breaker claim

## 왜 D1B context gate를 scorer 앞에 둬야 하는가

현재 sunscreen scorer는 unresolved 값을 단순히 "아무 영향 없음"으로만 처리하지 않는다.

특히:

- `tone_up`은 사용자가 원할 때뿐 아니라 원하지 않을 때도 +/- 조정에 사용한다.
- finish는 명시적 선호가 없어도 `natural` 방향으로 expectation이 만들어진다.
- dry/oily 조건에서는 finish가 hard reject 또는 strong penalty에 사용된다.
- sensitivity / eye / white cast / pilling은 해당 사용자 조건에서 hard reject 또는 조정에 사용된다.

따라서 D3는 raw null을 scorer에 넘기지 않는다.

실제 scorer가 해당 요청에서 읽는 semantic이 unresolved이면 후보를 그 scoring scenario에서 fail-closed 한다.

이것은 제품 자체를 영구 reject하는 것이 아니다.

`admission authority != request-context scoring authority`

## 실제 기존 scorer 사용

D3는 점수식을 복사하지 않는다.

다음 현재 구현을 직접 호출한다.

- `filterSunscreenCandidates()`
- `scoreSunscreenProduct()`

즉 hard reject 순서와 baseline sunscreen score는 현재 Recommendation 구현 그대로다.

보호 축은 baseline score 뒤에서만 적용한다.

`buildSunscreenProtectionShadowAdjustment()`

## Production-derived 5종 결과

D2 primary 5종은 모두 admission authority가 있다.

`5/5 SUNSCREEN_INITIAL_ADMISSION_GRANT`

그러나 현재 D1 semantic coverage를 실제 scorer relevance와 결합하면 결과가 달라진다.

### neutral / non-outdoor

현재 scorer는 tone_up과 finish를 항상 읽으므로:

- admitted: 5
- semantic-context scoreable: 1
- scored: 1
- scoreable product: Jojoba Suncream
- protection delta: 0
- integrated ranking ready: NO

Jojoba baseline score:

`4`

### neutral / outdoor

같은 semantic gate 후 Jojoba만 scoreable.

- baseline: 4
- SPF/UVA delta: +6
- shadow: 10
- water delta: 0
- integrated ranking ready: NO

### sensitive context

현재 5종 모두 `sensitivity_safe + irritation_risk` pair가 완전 established가 아니다.

따라서:

- admitted: 5
- semantic-context scoreable: 0
- protection applied: 0

Unknown safety를 safe/medium/default로 변환하지 않는다.

### makeup context

현재 5종 모두 pilling authority가 충분하지 않다.

따라서:

- semantic-context scoreable: 0
- protection applied: 0

## Hard reject ordering

D3는 다음 순서를 고정한다.

```text
semantic authority available
→ hard reject evaluation
→ baseline score
→ protection delta
```

검증 fixture에서 white_cast=high인 scoreable 후보를 만들어
`whiteCastHate=true` 조건을 적용하면:

- hard reject 발생
- baseline score 없음
- protection delta = 0
- shadow ranking에 포함되지 않음

따라서 protection score로 hard-rejected candidate를 부활시키지 않는다.

## D3 판정

현재 판정:

`HOLD_SEMANTIC_COVERAGE_INSUFFICIENT_FOR_INTEGRATED_RANKING`

이 HOLD는 D2 admission failure가 아니다.

원인:

- 5/5 admission authority는 확보됨
- 그러나 실제 scorer가 요구하는 request-context semantics 중 finish/tone-up/safety/pilling coverage가 부족함
- 현재 Production-derived corpus에서 동시에 비교 가능한 후보가 2개 이상 나오지 않음

따라서 현 시점에서 protection overlay가 실제 Recommendation order를 어떻게 바꾸는지에 대한 통합 acceptance를 주장하면 안 된다.

## 다음 복구 방향

D4로 바로 넘어가지 않는다.

먼저 D3 blocker recovery로:

1. finish authority 보강
2. tone_up authority 보강
3. safety pair는 근거가 없으면 억지 establishment 금지
4. pilling도 review evidence가 충분할 때만 establishment
5. 최소 2개 이상 후보가 동일 user context에서 baseline scorer까지 안전하게 들어오는 시나리오 확보

후에 D3 integrated shadow를 재실행한다.

Water는 계속 HOLD다.
