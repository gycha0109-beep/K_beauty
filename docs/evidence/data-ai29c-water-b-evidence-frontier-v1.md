# DATA-AI29C-WATER-B — Governed Evidence Frontier v1

## 목적

WATER-A에서 water intent의 의미만 고정했다.

WATER-B는 다음 blocker를 조사한다.

`governed water Product Fact authority = 0`

이 단계는 **evidence frontier research only**다.

Product Fact를 만들지 않는다.

---

## Production baseline

현재 Production:

```text
water_resistance_duration Product Fact instances = 0
supported instances = 0
product_specific_primary instances = 0
current facts = 0
evidence records = 0
review assignments = 0
```

Prospective sunscreen corpus:

`20`

현재 water eligible:

`0 / 20`

즉 기존 authority를 보강하는 작업이 아니라 사실상 최초 water authority를 만드는 작업이다.

## Registry requirement

현재 registry:

```text
fact_key = water_resistance_duration
value_type = number_unit
unit = minutes
semantic = Established water-resistance duration with explicit time unit.
positive evidence = product-specific evidence
evidence class = product_claim | measurement
qualifier required context =
  metric
  method_context
  timepoint
```

따라서 다음은 단독으로 Fact value가 될 수 없다.

- waterproof
- super waterproof
- 지속내수성
- water resistant
- sweat resistant

숫자 duration 또는 governance된 label semantics가 필요하다.

---

## Candidate 1 — ANESSA Perfect UV Sunscreen Skincare Milk NA

Production exact current Subject:

```text
product = cbcd06a2-de29-47ca-afd1-ab1d5de93903
subject = d1d748c3-8706-4b6c-8719-676f6f317532
variant = NA
market = JP
formulation = pilot-freeze-81e7ff0bf60b506d8c326970f8d930ea
```

Shiseido / ANESSA 공식 페이지:

`https://www.shiseido.co.jp/anessa/products/suncare/perfect_uv_sm/`

exact 제품에 다음 표시가 있다.

`UV耐水性★★`

하지만 제품 페이지 자체에는 `80 minutes`라는 숫자 duration이 직접 쓰여 있지 않다.

### JCIA 공식 label semantics

Japan Cosmetic Industry Association의 ISO 18861 기반 자율기준은:

```text
UV耐水性★  = total water immersion 40 min = 20 min x 2
UV耐水性★★ = total water immersion 80 min = 20 min x 4
```

로 정의한다.

판정 조건은 SPF retention percentage의 평균에 대한
90% 단측 신뢰구간 하한이 50% 이상인 것이다.

따라서 exact ANESSA product claim:

`UV耐水性★★`

와 official JCIA semantics를 결합하면
다음 **candidate projection**은 만들 수 있다.

```text
water_resistance_duration = 80 minutes

qualifier candidate:
metric = SPF_retention_percentage
method_context = ISO_18861_JCIA_UV_water_resistance
timepoint = after_total_80_min_water_immersion
```

그러나 이는 제품 페이지가 숫자 80을 직접 선언한 경우와 다르다.

`product claim label + external normative label semantics → numeric Fact`

라는 변환 자체를 governance해야 한다.

따라서 현재:

`directConfirmationEligible = false`

`governedSemanticMappingCandidate = true`

판정:

`REVIEW_LABEL_TO_DURATION_MAPPING_BEFORE_FACT_ADOPTION`

---

## Candidate 2 — BUSHMAN Waterproof Pro Suncream

Production exact current Subject:

```text
product = 4608b3b4-8b51-4464-b46e-380b05c1a3d7
subject = 0b5963bb-67d6-4738-a620-32ec86c1e3d0
market = KR
formulation = data-ai29c-c5-bushman-waterproof-pro-current
```

BUSHMAN 공식 제품 페이지는 exact 제품명을:

`워터프루프 프로 선크림 SPF50+ PA++++ 50ml`

로 표시한다.

그러나 현재 first-party machine-readable page에서는
duration minute claim을 확보하지 못했다.

따라서:

```text
"Waterproof"
→ 40 minutes
→ 80 minutes
→ any numeric duration
```

전부 금지한다.

판정:

`HOLD_NO_EXPLICIT_DURATION_AUTHORITY`

---

## Out-of-corpus discovery — Beauty of Joseon Day Dew

Beauty of Joseon 공식 Day Dew Sunscreen 페이지에는 직접:

`Water Resistance (80 min)`

가 있고, FDA 2021 guideline 하 human study를 명시한다.

또 FAQ도 water resistant up to 80 minutes라고 명시한다.

하지만 Production catalog에는 현재:

- Relief Sun Rice + Probiotics
- Relief Sun Aqua Fresh

두 제품만 있고 Day Dew product/Subject는 없다.

따라서 Day Dew의 80분 authority를 기존 BOJ Subject에 옮길 수 없다.

판정:

`CATALOG_EXPANSION_CANDIDATE_NOT_TRANSFERABLE_TO_EXISTING_BOJ_SUBJECTS`

별도 catalog expansion 시에는 직접 numeric water authority seed로 가치가 있다.

---

## Sweat와 water 분리

JCIA는 `UV耐水性`가 물 접촉 후 UV protection 유지에 관한 표시이며
땀에 대한 성능을 나타내지 않는다고 명시한다.

따라서:

```text
UV耐水性★★
!= sweat resistant 80 min
```

WATER-A의 sweat-related user intent와
Product Fact의 water-resistance measurement semantics를 혼합하지 않는다.

---

## WATER-B 판정

현재 current Subject에서:

```text
direct confirmation eligible = 0
governed semantic mapping candidate = 1
hold = 1
catalog expansion candidate = 1
```

최종:

`WATER_B_EVIDENCE_FRONTIER_PASS_SEMANTIC_MAPPING_REVIEW_REQUIRED`

다음 단계:

`WATER-B1_GOVERNED_LABEL_TO_DURATION_MAPPING_REVIEW`

B1에서 검토할 것은 단 하나다.

> exact product의 `UV耐水性★★` claim과
> JCIA official label semantics를 결합하여
> `water_resistance_duration = 80 minutes`라는
> governed Product Fact proposition으로 채택할 수 있는가?

B1이 PASS하기 전에는 ANESSA Product Fact write를 하지 않는다.

## Production boundary

계속 false:

- productFactWritten
- evidenceRecordWritten
- confirmationWritten
- registryChanged
- productQueryIntentSchemaMutated
- protectionScorerWired
- waterAxisActivated
- productionRankingChanged
- productionCutoverAuthorized
- outdoorRankableSignalAuthorized
- publicActivation
- persistence

SPF authenticated Production beta는 변경하지 않는다.
