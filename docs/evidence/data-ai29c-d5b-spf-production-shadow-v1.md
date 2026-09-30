# DATA-AI29C-D5B — SPF Production-Equivalent Shadow v1

## 목적

D5B는 D5A에서 구현한 default-OFF SPF runtime gate를
현재 Recommendation Production corpus와 동일한 입력 경로에서 검증한다.

이 단계는 사용자 트래픽에 연결하지 않는다.

핵심 비교는 두 층이다.

### Current Production control

현재 `getRecommendationProducts()`의 sunscreen corpus를 그대로 사용한다.

현재 기대값:

- Production sunscreen = frozen legacy 11
- governed SPF authority = 전부 존재
- SPF bucket = 전부 `spf_50_plus_band`
- SPF delta = 전부 +6

따라서 SPF shadow가 켜져도 legacy 내부 상대순서는 변하지 않아야 한다.

### Frozen mixed comparison

D4 authority-complete mixed corpus:

- legacy 11
- new comparable 3
- total 14

여기서는 신규 제품의 SPF 차등이 실제 discrimination을 만든다.

- Physical Daily Sunmilk: +2
- MIN JUNG GI Physical Sun Block: +4
- Jojoba Suncream: +4

Zinc/Bio semantic HOLD는 여전히 제외한다.

## Server-only shadow service

추가 서비스:

`lib/server/product-query-spf-production-shadow-service.js`

이 서비스는 다음 Production-equivalent authority를 재사용한다.

1. `getRecommendationProducts()`
2. `readRecommendationSunscreenProtectionAuthorities()`
3. `projectSunscreenProtectionAuthority()`
4. `rankStructuredProductQueryFromProducts()`
5. D5A `spfRuntimeGate`

별도의 scorer를 만들지 않는다.

## OFF parity

기존에 이미 rankable한 고정 structured request를 사용한다.

예:

- category = sunscreen
- skin_type = oily
- sunscreen_intent = true
- outdoor_exposure = true

비교:

```text
baseline
vs
explicit SPF gate OFF
```

안정 projection이 완전히 동일해야 한다.

확인:

- status
- effective category
- candidate count
- rankable signals
- constraint status
- unresolved terms
- product IDs
- scores

즉 D5A merge 자체가 current Production behavior를 바꾸지 않았음을 증명한다.

## ON shadow

같은 Production corpus와 같은 scorer에
D5A gate만 ON으로 전달한다.

필수:

- authority resolved count = current sunscreen corpus count
- SPF eligible count = current sunscreen corpus count
- axisApplied = true
- missingProductIds = []
- UVA = false
- Water = false
- legacy delta = uniform +6
- orderInvariant = true
- maxRankShift = 0

현재 11종만으로는 SPF가 discrimination을 만들지 않는다.

이것은 오류가 아니다.

모두 같은 SPF50+ bucket이기 때문이다.

실제 discrimination evidence는 D4 mixed 14에서 이미 존재한다.

## Outdoor-only shadow

D5A의 새로운 bounded capability를 별도로 확인한다.

```text
category=sunscreen
sunscreen_intent=true
outdoor_exposure=true
other rankable intent 없음
```

OFF:

`insufficient_supported_intent`

ON + complete SPF authority:

`ranked`

이때에만 결과 `rankableSignals`에
`outdoor_exposure`가 추가될 수 있다.

이 검증 역시 server-only shadow이며 사용자 요청 경로가 아니다.

## Missing authority

한 제품이라도 SPF authority가 없으면:

```text
COHORT_SPF_AUTHORITY_INCOMPLETE
```

전체 SPF axis를 OFF한다.

known candidate만 보너스를 받고 missing candidate가 +0을 받는 방식은 금지한다.

## API / traffic boundary

D5B service는 API route에 연결하지 않는다.

즉:

- user traffic = 0
- arbitrary raw query = 불가
- provider invocation = 없음
- profile/history read = 없음
- recommendation log write = 없음
- Production write = 없음

fixed structured intent만 사용한다.

## 신규 3종 live admission

D5B에서도 신규 3종을 `getRecommendationProducts()`에 넣지 않는다.

따라서:

`liveNewSunscreenAdmission=false`

신규 3종은 mixed shadow comparison에서만 검증한다.

live admission + canary는 다음 별도 approval 단계다.

## 판정

Static/Production-equivalent contract가 통과할 경우:

```text
D5B_PRODUCTION_EQUIVALENT_SHADOW_CONTRACT_READY_NO_ACTIVATION
```

실제 server runtime에서 current 11의 authority/read/parity 결과가 통과할 경우:

```text
D5B_CURRENT_PRODUCTION_SHADOW_PASS
```

D5B 자체는 후자를 사용자 트래픽으로 노출하지 않는다.

## 다음 단계

D5C 진입 전 별도 수동 승인 필요.

D5C 범위:

1. 신규 comparable 3종의 bounded runtime admission/projection
2. internal/canary-only request path
3. exact deployment evidence
4. immediate rollback
5. no public rollout

## Production boundary

계속 false:

- liveNewSunscreenAdmission
- productionRankingChanged
- productionCutoverAuthorized
- outdoorRankableSignalAuthorized
- publicActivation
- uvaActivated
- waterResistanceApplied
- persistence
