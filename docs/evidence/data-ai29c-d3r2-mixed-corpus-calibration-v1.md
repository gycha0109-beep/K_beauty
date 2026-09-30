# DATA-AI29C-D3R2 — Mixed-Corpus Calibration v1

## 목적

D3R1은 신규 sunscreen 5종 안에서 다음 경계를 만들었다.

- hard-reject authority unknown → candidate HOLD
- two-sided score axis authority incomplete → new cohort 전체 axis OFF
- one-sided positive authority → established match만 사용
- existing sunscreen scorer 실행
- SPF/UVA protection은 baseline 뒤에만 적용

D3R2는 이 구조가 **Production legacy sunscreen 11종과 같은 ranking frame에서 비교 가능한지**를 검증한다.

## Production legacy baseline

Production project:

`bygrczggxfuisupcevaz`

Frozen legacy corpus:

`LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1`

현재 exact legacy sunscreen:

`11`

C6 prospective의 `legacy_category=12`와 다른 이유는
Torriden mild mineral sunscreen 1종이 legacy category row이지만 frozen legacy recommendation corpus에는 없기 때문이다.

D3R2 fixture는 Production의 11개 legacy sunscreen Product semantic rows를 동결한다.

## 핵심 문제 — Cross-cohort comparability dilemma

Neutral context에서 신규 5종은:

- finish authority incomplete
- tone_up authority incomplete

이므로 D3R1은 두 축을 신규 cohort 전체에서 OFF 한다.

이 상태에서 mixed ranking을 만드는 방법은 두 가지다.

### A. 신규 cohort에만 mask 적용

Legacy 11종은 기존 scorer의 finish/tone-up contribution을 유지하고,
신규 5종만 두 축을 0으로 만든다.

문제:

legacy 제품에는 실제로 finish/tone-up의 non-zero contribution이 존재한다.

따라서 unresolved 신규 제품은
known legacy mismatch penalty를 받지 않으면서 상대적으로 유리해질 수 있다.

판정:

`newOnlyMaskCrossCohortComparable=false`

### B. mixed cohort 전체에 동일 mask 적용

비교 공정성을 위해 legacy도 finish/tone-up을 0으로 만든다.

문제:

기존 Production legacy scorer 결과가 바뀐다.

Neutral 기준:

- legacy score changed: 5 / 11
- 기존 legacy top-set: 4종
- fair-mask legacy top-set: 11종 전체

즉 cross-cohort axis fairness는 개선되지만
legacy behavior invariance를 잃는다.

판정:

`wholeMixedMaskPreservesLegacyControl=false`

## Neutral mixed baseline

Legacy 11 + 신규 5 = 16개.

공통 fair mask 적용 시:

`16-way numeric tie`

따라서 현재 mixed baseline은
existing Production order와 직접 비교할 수 있는 ranking authority가 아니다.

현재 Production comparator의 tie-breaker를 그대로 재사용하지 않는다.

이유:

current comparator는 score 외에도

- texture
- finish match
- sensitivity-safe
- irritation risk

등을 tie-break에 사용한다.

D3R2에서 이미 authority 부족으로 꺼놓은 semantic을
tie-breaker에서 다시 사용하면 mask를 우회하게 된다.

따라서:

`productionTieBreakerShadowed=false`

## Protection shadow

공통 fair baseline 뒤에서 SPF/UVA를 적용하면
legacy와 신규 모두 protection delta를 받을 수 있다.

현재 mixed outdoor top score는
SPF50+/high-UVA authority가 있는 legacy 9종이다.

하지만 baseline이 16-way tie이므로,
이 결과는 보호축 discrimination 증거이지
Production order acceptance가 아니다.

Water는 계속 0/HOLD다.

## Tie-free baseline 가능성 전수 탐색

신규 5종이 모두 scoreable한 안전 context만 대상으로
48개 scenario matrix를 계산한다.

축:

- skinType: not_sure / oily / combination
- concern: none / dehydration / redness / oiliness / barrier / uneven_tone / pores / acne
- toneUpWanted: false / true

고정:

- sensitivity low
- whiteCastHate false
- eyeSensitive false
- makeupUse false
- outdoor false

결과:

- scenarios: 48
- 5/5 scoreable scenarios: 48
- tie-free five-product baseline scenarios: 0

현재 authority에서 score-signature equivalence가 유지되는 pair:

1. Physical Daily Sunmilk ≡ Jojoba Suncream
2. Dr. Troub Zinc Physical ≡ Bio Repair + Suncream

MIN JUNG GI는 별도 signature다.

즉 현재 governed semantics만으로는
신규 5종의 완전한 tie-free baseline ranking을 만들 수 없다.

## D3R2 판정

`MIXED_CORPUS_CALIBRATION_HOLD_CROSS_COHORT_COMPARABILITY`

이 HOLD의 의미:

- D2 admission authority 문제 아님
- D3R1 scorer plumbing 문제 아님
- SPF/UVA discrimination 문제 아님
- mixed legacy/new baseline comparability가 아직 부족함

## 다음 복구 조건

D4로 바로 진행하지 않는다.

다음 D3R3에서는
**rank-differentiating semantic authority recovery**를 최소 범위로 수행한다.

우선순위는 현재 equivalence pair를 깨는 정보다.

### Pair A

Physical Daily Sunmilk vs Jojoba Suncream

후보 differentiation axes:

- finish
- tone_up
- texture
- white_cast / eye_sting 등 user-context axis

단, official/review evidence가 실제로 enum을 확정할 수 있을 때만 승격한다.

### Pair B

Dr. Troub Zinc Physical vs Bio Repair + Suncream

후보 differentiation axes:

- finish
- texture
- white_cast
- other governed semantic

Safety/pilling은 근거 부족 시 억지 establishment 금지.

## Production boundary

변경 없음.

- production candidate admission wiring = false
- production ranking change = false
- production tie-breaker shadow = false
- production cutover authorization = false
- outdoor rankable authorization = false
- public activation = false
- water resistance application = false
