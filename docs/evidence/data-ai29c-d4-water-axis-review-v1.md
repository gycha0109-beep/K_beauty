# DATA-AI29C-D4-WATER — Axis Hold Review v1

## 목적

D4의 마지막 protection axis인 water resistance를 독립적으로 검토한다.

SPF/UVA와 분리해서 판단한다.

Water HOLD는 SPF D4 PASS를 취소하거나 막지 않는다.

## Authority 상태

C6 authoritative prospective sunscreen audit:

- sunscreen corpus: 20
- water eligible: 0
- coverage: 0%
- distinct scoring buckets: 0
- gate pass: false

즉 현재 governed Product Fact corpus에는
ranking authority로 사용할 water resistance duration이 한 건도 없다.

D3R3 comparable mixed corpus:

- total: 14
- water bucket eligible: 0
- missing: 14

따라서 mixed ranking에도 water authority가 없다.

## Missing 의미

`missing water fact != not waterproof`

다음 해석은 금지한다.

- missing → false
- missing → 0 minutes
- missing → non-waterproof
- missing → low water protection

현재는 단순히:

`authority unavailable`

이다.

## Runtime intent boundary

현재 protection shadow runtime은
water resistance weight table 자체는 가지고 있다.

하지만 적용값은 항상:

`waterResistance = 0`

이다.

block reason:

`waterResistance:water_resistance_intent_not_available`

즉 water axis는 Fact authority뿐 아니라
사용자 request에서 water-resistance preference/intention을 표현하는
canonical input contract도 아직 없다.

D4-WATER에서 audit를 가상으로 rankingUseful=true로 주더라도
runtime은 water score를 적용하지 않아야 한다.

## 두 개의 독립 blocker

Water activation에는 둘 다 필요하다.

### 1. Governed Product Fact authority

최소한 comparable corpus에서
water resistance duration/등급을 동일 규칙으로 비교할 수 있어야 한다.

현재:

`0 / 14`

Prospective 20 corpus에서도:

`0 / 20`

### 2. User intent contract

예:

- waterResistanceNeeded
- swimming / beach / sports context
- sweat-heavy outdoor context

등 어떤 canonical signal을 쓸지 별도 설계가 필요하다.

현재 임의로 `outdoorExposure=true`를
water intent로 간주하지 않는다.

`outdoor != water-resistant need`

## D4-WATER 판정

`WATER_AXIS_D4_HOLD_NO_AUTHORITY_OR_INTENT_CONTRACT`

이 HOLD는 독립적이다.

현재 D4 상태:

- SPF: PASS → D5 manual approval candidate
- UVA: HOLD → exact-Subject authority incomplete
- Water: HOLD → authority 0 + intent contract 없음

## 다음 허용 단계

Water를 다시 열려면:

1. governed water Product Fact recovery
2. explicit water-intent canonical contract
3. 별도 mixed-corpus shadow calibration
4. 별도 D4 activation review

가 필요하다.

SPF D5 검토는 이 작업을 기다릴 필요가 없다.

## Production boundary

계속 false:

- missingTreatedAsNonWaterproof
- waterIntentImplemented
- waterAxisActivated
- productionRankingChanged
- productionCutoverAuthorized
- publicActivation
- persistence
