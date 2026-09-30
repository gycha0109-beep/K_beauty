# DATA-AI29C-D3R1 — Feature-Gated Integrated Sunscreen Shadow v1

## 목적

D3 v1은 semantic unknown이 scorer 결과에 스며드는 것을 막기 위해
scorer가 읽는 semantic 하나라도 unresolved이면 후보 전체를 HOLD했다.

이 방식은 안전하지만 과도했다.

D3R1은 unknown semantic을 두 종류로 분리한다.

```text
A. hard reject 결과를 바꿀 수 있는 unknown
→ 해당 request context에서 후보 HOLD

B. 단순 score bonus / penalty에만 영향을 주는 unknown
→ 후보는 유지
→ 해당 two-sided scoring axis를 cohort 전체에서 OFF
```

핵심 원칙:

`unknown != good`

`unknown != bad`

`unknown => no positive authority / no negative escape advantage`

## 실제 scorer를 그대로 사용

D3R1은 점수식을 새로 만들지 않는다.

기존 구현:

- `filterSunscreenCandidates()`
- `scoreSunscreenProduct()`

를 먼저 실행하고,
그 결과의 sunscreen score breakdown에서
authority가 불완전한 two-sided axis만 cohort 단위로 마스킹한다.

즉 scorer 동작을 복사하지 않고 현재 Production scorer implementation을 그대로 감사한다.

## Hard-reject authority gate

현재 scorer에서 unknown이 hard reject 여부를 바꿀 수 있는 semantic은
request context별로 다음처럼 fail-closed 한다.

| request context | required established semantic |
|---|---|
| sensitive / very sensitive / redness / barrier | `irritation_risk` |
| eye sensitive | `eye_sting` |
| makeup use | `pilling_risk` |
| white-cast hate + no tone-up | `white_cast` |
| dry skin + non-oiliness | `finish` |

해당 field가 unresolved면 scorer에 넘기지 않는다.

Protection delta도 적용하지 않는다.

## Cohort-gated two-sided score axes

현재 scorer에서 값에 따라 bonus와 penalty가 모두 가능한 축:

- finish
- tone_up
- sensitivity_safe
- white_cast
- eye_sting
- pilling_risk

해당 request에서 axis가 relevant하고
**scoring cohort 전 제품에 established authority가 있을 때만** axis를 켠다.

하나라도 unresolved이면:

```text
그 제품만 0점
```

이 아니라:

```text
cohort 전체 해당 축 = 0
```

으로 처리한다.

이렇게 해야 unknown 제품이
"벌점 받을 값이 없어서" 상대적 이익을 얻는 문제가 없다.

## One-sided positive authority

`skin_types`, `concerns`처럼
확정된 match에만 positive authority를 주는 축은 제품별 established semantic을 그대로 사용할 수 있다.

unknown 제품에는 positive 점수를 주지 않는다.

예:

dehydration concern context에서

- Physical Daily Sunmilk: established dehydration → +20
- Jojoba Suncream: established dehydration → +20
- MIN JUNG GI: concern unresolved → +0

unknown을 dehydration=false로 확정한 것이 아니다.
단지 positive match authority가 없으므로 match bonus를 주지 않는다.

## Production-derived current result

### Neutral / non-outdoor

D2 admission authority:

`5/5`

hard-reject authority requirement:

없음

scoreable:

`5/5`

그러나 current corpus는 finish와 tone-up authority가 cohort-complete가 아니다.

따라서:

- finish axis OFF
- tone-up axis OFF
- sensitivity / white-cast / eye / pilling axis not relevant

현재 neutral baseline은 5종 모두 0점이다.

즉:

- integrated score comparison plumbing: READY
- Production order claim: HOLD

baseline tie가 5개이므로
현재 기존 scorer tie-breaker까지 포함한 "실제 Production 순서 변화"를 주장하지 않는다.

### Neutral / outdoor

같은 baseline 뒤에 SPF/UVA protection shadow를 적용한다.

현재 5종 delta:

| product | SPF/UVA delta |
|---|---:|
| Physical Daily Sunmilk | +4 |
| MIN JUNG GI Physical Sun Block | +8 |
| Dr. Troub Zinc Physical | +8 |
| Bio Repair + Suncream | +6 |
| Jojoba Suncream | +6 |

Water:

`0 / HOLD`

baseline top-set은 5종 전체 tie이고,
protection shadow top-set은:

- MIN JUNG GI
- Dr. Troub Zinc Physical

로 좁혀진다.

하지만 baseline에 tie가 있으므로 이 결과는
**protection discrimination evidence**일 뿐 Production order change acceptance는 아니다.

### Dry context

finish가 실제 hard reject에 사용된다.

현재 finish established는 Jojoba만이므로:

- 4 products → hard-reject authority HOLD
- 1 product → scorer 진입

### Sensitive context

`irritation_risk`가 5종 모두 충분히 established되지 않아:

- 5/5 HOLD
- protection applied = 0

### Makeup context

`pilling_risk` authority 부족:

- 5/5 HOLD

### Eye-sensitive context

현재 eye_sting established coverage 기준:

- 1 product HOLD
- 4 products scorer 진입 가능

### White-cast hate + tone-up false

white_cast authority unresolved/conflict 제품:

- 2 products HOLD

## D3R1 판정

`FEATURE_GATED_INTEGRATED_SCORE_COMPARISON_READY_PRODUCTION_ORDER_HOLD`

의미:

- D2 admission authority usable
- D1B established-only projection usable
- request-context hard reject fail-closed usable
- existing sunscreen scorer execution usable
- SPF/UVA post-score protection overlay usable
- 5-product neutral integrated score path usable
- Production order activation evidence는 아직 부족

## 다음 단계

D4 axis-specific activation review로 바로 승격하지 않는다.

먼저 D3R2 calibration에서 최소 다음을 검토한다.

1. baseline tie가 없는 governed scenario 확보 가능 여부
2. scorer tie-breaker까지 shadow에서 재현할지 여부
3. one-sided positive semantic axis의 admission/scoring fairness
4. protection delta가 기존 hard reject/penalty semantics를 압도하지 않는지
5. legacy 11-product invariant와 신규 grant cohort를 한 ranking frame에서 비교할 방법

그 후에야 SPF / UVA axis activation review로 넘어간다.

불변:

- `productionCutoverAuthorized=false`
- `outdoorRankableSignalAuthorized=false`
- `publicActivation=false`
- water disabled
