# DATA-AI29C-D5A — SPF Runtime Gate v1

## 결론

D5A는 SPF ranking signal을 Production Recommendation 코드 경로에
**default OFF optional gate**로 연결한다.

이 단계는 public activation 또는 canary가 아니다.

Feature flag contract:

```text
SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED
default=false
```

## Activation conditions

SPF axis는 다음 조건을 모두 만족할 때만 적용 가능하다.

1. runtime gate enabled
2. effective category = sunscreen
3. sunscreen_intent = true
4. outdoor_exposure = true
5. hard reject 이후 남은 ranking cohort 전부에 governed SPF authority 존재

하나라도 실패하면 SPF delta는 cohort 전체에 적용하지 않는다.

특히:

```text
some candidates have SPF + some candidates missing SPF
!=
known candidates get bonus + missing candidates get zero
```

대신:

```text
COHORT_SPF_AUTHORITY_INCOMPLETE
→ SPF axis OFF for the whole cohort
```

이 규칙으로 `missing != low protection`을 유지한다.

## Ordering

Runtime placement:

```text
candidate filtering
→ sunscreen hard reject / penalty-only fallback
→ existing sunscreen scorer
→ SPF runtime gate
→ compareRankedProducts
```

따라서 SPF gate는 rejected candidate를 다시 후보로 만들 수 없다.

## Axis allowlist

D5A에서 활성 가능한 protection axis는 SPF 하나뿐이다.

- SPF: gated
- UVA: disabled
- Water: disabled

기존 protection shadow weight를 그대로 사용한다.

| SPF bucket | delta |
|---|---:|
| spf_50_plus_band | +6 |
| spf_30_49 | +4 |
| spf_15_29 | +2 |
| spf_below_15 | 0 |

새 weight를 만들지 않는다.

## Outdoor rankable signal

기존 Product Query execution contract는 `outdoor_exposure`를
Production rankable signal로 취급하지 않는다.

D5A는 기존 contract 자체를 변경하지 않는다.

대신 SPF gate가 실제로 적용된 request에 한해서 결과의
`rankableSignals`에 `outdoor_exposure`를 추가한다.

즉:

- flag OFF → 기존 behavior
- flag ON + authority incomplete → 기존 behavior
- flag ON + non-outdoor → 기존 behavior
- flag ON + sunscreen/outdoor + complete SPF authority → SPF bounded ranking

## D4 authority prerequisite

D4-SPF comparable corpus:

- legacy = 11
- comparable new = 3
- total = 14
- SPF authority = 14/14

legacy 11종 SPF delta는 모두 +6.

new comparable:

- Physical Daily Sunmilk: +2
- MIN JUNG GI Physical Sun Block: +4
- Jojoba Suncream: +4

D5A verifier는 이 snapshot을 다시 사용한다.

## Important runtime boundary

현재 actual `getRecommendationProducts()` Production corpus는
여전히 legacy sunscreen 11종이다.

D5A는 신규 3종의 live Production admission을 켜지 않는다.

따라서 이번 단계가 하는 일:

- SPF gate implementation: YES
- Product Query ranking path optional integration: YES
- default OFF: YES
- current Production result mutation: NO
- new 3 live admission: NO
- public activation: NO
- canary traffic: NO

신규 3종 live admission은 D5C 직전 별도 bounded wiring/approval 대상이다.

## D5B requirement

D5B는 두 층으로 검증한다.

1. current Production 11 legacy corpus
   - OFF parity
   - ON shadow legacy order invariance
2. frozen D4 mixed 14 corpus
   - SPF authority 14/14
   - new 3 governed rank shift
   - missing authority cohort fail-closed
   - rejected/held resurrection 0

D5B까지 통과해도 실제 canary activation은 하지 않는다.

## Production boundary

계속 false:

- productionCutoverAuthorized
- publicActivation
- liveNewSunscreenAdmission
- canaryTrafficEnabled
- uvaActivated
- waterResistanceApplied
- persistence
