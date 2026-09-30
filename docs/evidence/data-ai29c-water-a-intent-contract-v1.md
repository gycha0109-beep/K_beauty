# DATA-AI29C-WATER-A — Canonical Water-Intent Contract v1

## 목적

D4-WATER의 두 blocker 중 하나인 **user intent contract 부재**를 먼저 해결한다.

현재 water resistance 축에는 두 개의 독립 blocker가 있다.

1. governed Product Fact authority = `0/20`
2. canonical user intent contract = 없음

WATER-A는 **2번의 의미만 고정**한다.

이 단계에서 하지 않는 것:

- Product Query provider schema 변경
- provider prompt 변경
- recommendation answer 변경
- water Product Fact 생성
- scorer wiring
- runtime flag 구현
- Production ranking 변경
- water activation

즉 이 단계는 **semantic contract only**다.

---

## Canonical field

Provider-facing canonical field:

`water_resistance_needed`

Recommendation-facing key:

`waterResistanceNeeded`

Type:

`boolean | null`

### `true`

사용자가 선크림에 **물 또는 많은 땀을 견디는 성능을 명시적으로 요구**한다.

허용 예:

- 수영할 때 쓸 워터프루프 선크림
- 물놀이용
- 땀에 잘 안 지워지는 선크림
- 워터 레지스턴트 제품이 필요함

핵심은 activity 명칭 자체가 아니라 **water/sweat resistance requirement가 query에서 명시적으로 성립하는가**다.

### `false`

사용자가 water resistance가 필요 없다고 명시한다.

예:

- 워터프루프는 필요 없어

중요:

`water_resistance_needed = false`

는 제품이 non-waterproof라는 뜻이 아니다.

이 값은 오직 **사용자 요구**를 표현한다.

### `null`

water resistance 필요 여부가 명시되지 않았거나 안전하게 확정할 수 없다.

`missing != false`

원칙을 유지한다.

---

## Outdoor와 분리

기존 Product Query에는:

`outdoor_exposure`

가 있다.

WATER-A에서는 다음을 금지한다.

```text
outdoor_exposure = true
→ water_resistance_needed = true
```

야외 활동은 SPF/UVA exposure와 관련될 수 있지만,
water resistance 필요성을 자동으로 만들지 않는다.

반대도 독립적이다.

`water_resistance_needed=true`라고 해서 반드시
`outdoor_exposure=true`여야 하는 것도 아니다.

두 field는 서로 다른 semantic ownership을 가진다.

---

## Conservative context rules

### Beach

`해변`, `beach` 단어만으로는 `true`가 아니다.

사용자가 물에 들어가는지,
단순히 해변에서 햇빛을 받는지 알 수 없기 때문이다.

따라서:

`beach alone → null`

### Sports

`운동`, `sports`, `running`만으로는 `true`가 아니다.

다만 query가 다음처럼 **땀 저항 요구를 직접 표현**하면 true가 가능하다.

- 땀에 안 지워지는
- sweat resistant
- sweat-proof

즉:

`sports alone → null`

`explicit sweat resistance → true`

### Swimming / water activity

수영, 물놀이처럼 물 접촉이 use case 자체에 내재되어 있고
제품 요구가 그 상황에 직접 묶여 있으면
future parser가 `true`로 표현할 수 있다.

하지만 WATER-A는 parser 구현 단계가 아니다.

---

## Runtime control 의미

계약의 정규화 상태:

| input | state | future ranking intent |
|---|---|---|
| true | required | available |
| false | not_required | unavailable |
| null | unknown | unavailable |

block reason:

- false → `water_resistance_not_requested`
- null → `water_resistance_intent_not_available`

현재 Production scorer는 이 계약을 import하지 않는다.

기존 water axis는 계속:

`waterResistance:water_resistance_intent_not_available`

로 차단된다.

---

## Product Fact와의 분리

이 contract가 생겼다고 water ranking이 활성화되지 않는다.

future water ranking에는 최소한:

```text
water intent = true
AND
governed water Product Fact authority available
AND
water axis rankingUseful = true
AND
separate activation gate PASS
```

가 필요하다.

현재 Product Fact authority는:

`0 / 20`

이므로 WATER-A만 완료되어도 scoring은 계속 OFF다.

---

## 판정

`WATER_A_CANONICAL_INTENT_CONTRACT_FROZEN_RUNTIME_NOT_WIRED`

다음 허용 작업:

`WATER-B governed water Product Fact evidence recovery`

WATER-B에서도 이 contract를 Production schema/scorer에 연결하지 않는다.

---

## Production boundary

계속 false:

- `productQueryIntentSchemaMutated`
- `providerPromptMutated`
- `recommendationAnswersMutated`
- `protectionScorerWired`
- `waterAxisActivated`
- `productionRankingChanged`
- `productionCutoverAuthorized`
- `outdoorRankableSignalAuthorized`
- `publicActivation`
- `persistence`
