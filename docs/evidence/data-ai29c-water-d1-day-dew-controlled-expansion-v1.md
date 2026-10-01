# DATA-AI29C-WATER-D1 — Beauty of Joseon Day Dew controlled Water expansion

## 판정

`WATER_D1_DAY_DEW_GOVERNED_WATER_FACT_PASS_RANKING_COHORT_UNCHANGED`

Beauty of Joseon **Day Dew Sunscreen**의 exact U.S. Product / Subject를 신규 catalog expansion으로 만들고,
공식 브랜드 페이지의 직접적인 `Water Resistance (80 min)` claim을
`water_resistance_duration = 80 minutes` Product Fact로 governed confirmation했다.

이 작업은 Water ranking activation이 아니다.

## First-party authority

공식 source:

`https://beautyofjoseon.com/products/day-dew-sunscreen`

확인한 exact product scope:

- Beauty of Joseon
- Day Dew Sunscreen
- U.S. market
- 50 mL / 1.69 FL. OZ.
- Water Resistance (80 min)
- FDA 2021 guideline 기반 human study
- Eurofins CRL USA Study No. 624-N23059-27

Sephora US는 동일 브랜드/제품/50 mL identity convergence 확인에만 사용했다.

`https://www.sephora.com/product/day-dew-sunscreen-exclusive-50ml-P517678`

Sephora claim은 Product Fact positive authority로 사용하지 않았다.

## Catalog identity

Candidate:

`55776e72-af11-4859-8090-880445b9a8e1`

Canonical Product:

`6852eeda-eb1d-4c4e-8bea-b30a26126a9c`

Structural adoption은 Product 생성까지만 수행했고 Recommendation admission은 부여하지 않았다.

## Subject correction

처음 등록한 Subject는 presentation size를 variant처럼 표현했다.

`984c6078-1bcb-4354-bf4f-eedfe1a1e86e`

`variant_key = DAY_DEW_SUNSCREEN_US_50ML`

하지만 이 Product 자체가 이미 exact U.S. 50 mL presentation을 나타낸다.
또한 이 시점에는 Evidence / Fact / Current / research authority가 전혀 붙지 않았다.

따라서 authority attachment 전에 presentation-only variant를 identity-correction으로 정리했다.

Current Subject:

`4f64fa1b-6af7-4767-b818-f1178d4fe986`

- variant_key = null
- market = US
- identity_status = resolved
- current_state = current
- predecessor = `984c6078-1bcb-4354-bf4f-eedfe1a1e86e`
- supersession_kind = `identity_correction`

predecessor는 immutable history로 historical 상태에 남아 있다.

## TRUST intake

Intake:

`a9c1152c-f934-4f57-8f13-110740212b50`

공식/Sephora 두 provider가 모두 U.S. scope로 수렴한 identity evidence를 근거로
intake market을 `US`로 명시적으로 binding했다.

resolver 결과:

```text
identity_state = EXACT_SUBJECT_FOUND
subject_id     = 4f64fa1b-6af7-4767-b818-f1178d4fe986
trust_state    = RESEARCH_PENDING
presentation_relation_proven = true
```

## Governed Water Product Fact

Registry:

`product-fact-registry-cross-category-v1 / water_resistance_duration`

Current Fact:

- proposition: `2fc99f6e8e53147bacb631c9e99f5c163ec9107901055f4f3d2a82ecd7eed3dd`
- evidence: `e243efc6-d6b9-4e2b-8f25-4c07453e187b`
- fact: `55c80191-fa13-4c9f-a594-d8b26f3cada8`
- confirmation: `923c7799-a1ae-44c7-9ddc-9ccb03acb7a6`
- value: `80 minutes`
- authority: `product_specific_primary`
- confidence: `high`
- market: `US`

Qualifier:

```text
metric         = water_resistance_duration
method_context = FDA_2021_water_resistance_human_study
timepoint      = 80_minutes
interpretation = direct_product_specific_water_resistance_duration_claim
```

현재 governed `water_resistance_duration` Current Fact는 전체 DB에서 2건이다.

1. ANESSA JP
2. Beauty of Joseon Day Dew US

## Prospective ranking cohort 경계

여기서 **2/21이라고 D4 coverage를 재계산하지 않는다.**

기존 prospective protection corpus는 frozen 20종이다.
Day Dew는 해당 fixture에 포함되어 있지 않다.

Day Dew의 required sunscreen facts는 현재:

- `spf_value` → RESEARCH_PENDING
- `uva_label` → RESEARCH_PENDING
- `uv_filter_type` → RESEARCH_PENDING

따라서:

```text
frozen prospective corpus = 20
frozen prospective water eligible = 1
frozen prospective water coverage = 1/20
Day Dew ranking-cohort admission = false
```

Day Dew의 Water Fact가 생겼다고 기존 prospective denominator를 임의로 21로 늘리지 않는다.

## Production invariants

변경 없음:

- SPF authenticated beta = ON
- SPF phase = DATA-AI29C-D5D
- Water axis activation = OFF
- Water ranking wiring = OFF
- productionCutoverAuthorized = false
- outdoorRankableSignalAuthorized = false
- publicActivation = false

## 다음 gate

두 방향 모두 activation과 분리한다.

1. 다른 exact-subject first-party Water duration authority를 계속 확장
2. Day Dew의 required sunscreen facts를 별도 governed research로 완성

Day Dew가 prospective Recommendation cohort에 들어가려면 Water 하나가 아니라
기존 D2 admission authority를 다시 통과해야 한다.
