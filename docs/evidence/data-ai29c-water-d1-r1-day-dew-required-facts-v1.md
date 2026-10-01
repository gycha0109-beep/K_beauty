# DATA-AI29C-WATER-D1-R1 — Day Dew Required Sunscreen Facts v1

## 판정

`WATER_D1_R1_DAY_DEW_REQUIRED_FACTS_PARTIAL_PASS_UVA_HOLD`

WATER-D1에서 governed `water_resistance_duration = 80 minutes`까지 확보한
**Beauty of Joseon Day Dew Sunscreen — U.S.**의 남은 required sunscreen facts를 별도 governed review로 처리했다.

결과:

```text
spf_value      = 50       → CONFIRMED
uv_filter_type = organic  → CONFIRMED
uva_label                 → HOLD / EVIDENCE_INSUFFICIENT
water          = 80 min   → 기존 Current 유지
```

이 작업은 Recommendation admission이나 Water activation이 아니다.

## Exact Product / Subject

- Product: `6852eeda-eb1d-4c4e-8bea-b30a26126a9c`
- Subject: `4f64fa1b-6af7-4767-b818-f1178d4fe986`
- Subject semantic key: `afce6d4dba5b288999cf087d9827e89e9819be4c99322650ea9e27077778029e`
- Market: US
- variant_key: null
- formulation: `data-ai29c-water-d1-boj-day-dew-us-current`
- identity: resolved / current

## First-party authority

공식 Beauty of Joseon Day Dew 페이지:

`https://beautyofjoseon.com/products/day-dew-sunscreen`

exact U.S. 제품에서 확인한 직접 claim:

- Day Dew Sunscreen
- 50 mL / 1.69 FL. OZ.
- `SPF 50 broad spectrum UV protection`
- `chemical sunscreen`
- active filters
  - Avobenzone 3.0%
  - Homosalate 7.0%
  - Octisalate 5.0%
  - Octocrylene 5.0%
- Water Resistance (80 min)

이번 R1용 frozen observation은 SPF/filter claim을 별도로 동결했다.

- source = `38b1662b-9b9c-4869-aa63-eed6ae3074a8`
- exact Subject binding = `f0cd536b-9a58-4cd0-b6ae-8e5ac3222565`
- market = US
- locale = en-US
- scope = equivalent

WATER-D1에서 Water claim만 동결한 기존 source observation을
SPF/filter evidence로 소급 재해석하지 않았다.

## SPF Product Fact

Registry:

`product-fact-registry-cross-category-v1 / spf_value`

Registry semantic은 **labeled SPF numeric value**다.

따라서 임상 측정값 `SPF 94.7±13.6` 또는 `SPF 52`를 Product Fact value로 쓰지 않고,
제품 라벨 claim `SPF 50`을 사용했다.

Current:

```text
value_number       = 50
plus_modifier      = none
market             = US
locale             = en-US
authority          = product_specific_primary
confidence         = high
fact               = 5d51819b-4542-44da-a4ab-01f8903b59de
confirmation       = 6f9aac4e-4cb8-4f7d-b436-a236122987f4
evidence           = 2cec6fa0-59c4-4bee-9ac7-36c653800f5d
```

## UV filter Product Fact

Registry:

`product-fact-registry-cross-category-v1 / uv_filter_type`

공식 페이지가 exact U.S. 제품을 직접 `chemical sunscreen`이라고 선언하고,
FDA active filter 4종을 직접 공개한다.

현재 Registry enum의 대응값:

`organic`

Current:

```text
value_enum         = organic
market             = US
locale             = en-US
authority          = product_specific_primary
confidence         = high
fact               = 91490849-519b-408a-9d03-1efb3b17629f
confirmation       = 5f35b0c6-76b6-42e2-961e-e7d9f4821c92
evidence           = 865dd465-0574-4fe1-91ad-989ac1fca15c
```

## UVA HOLD

공식 페이지는 `broad-spectrum SPF 50`을 선언한다.

하지만 현재 `uva_label` Registry는:

- PA+
- PA++
- PA+++
- PA++++
- UVA-PF-declared

중 하나의 product-specific market-scoped authority를 요구한다.

현재 exact U.S. Day Dew source에서 위 enum에 직접 대응하는 값은 확정되지 않았다.

따라서 계속 금지:

- Broad Spectrum → PA
- Broad Spectrum → `UVA-PF-declared` 임의 변환

research task:

`74661ab2-2adb-4255-9c05-0418c1caa105`

결과:

`BLOCKED / EVIDENCE_INSUFFICIENT`

이는 Day Dew의 UVA 보호력이 낮다는 뜻이 아니다.
현재 Registry semantics로 exact 값을 확정할 authority가 없다는 뜻이다.

## Fail-closed preflight

초기 confirmation preflight에서 잘못 구성한 fusion input digest가
`product_fact_confirmation_fusion_input_stale`로 차단됐다.

해당 preflight는 zero-write였고 Product Fact business write는 발생하지 않았다.

이후 현재 Product Evidence row를 preflight 구현과 동일한 schema로 canonicalize하여
fusion digest를 다시 계산했고:

- SPF preflight = READY
- UV filter preflight = READY

를 확인한 뒤에만 두 Fact를 confirmation했다.

## Research task closeout

```text
spf_value      → ALREADY_COVERED
uv_filter_type → ALREADY_COVERED
uva_label      → BLOCKED / EVIDENCE_INSUFFICIENT
```

## 기존 Water Fact

WATER-D1의 Water Fact는 변경하지 않았다.

```text
water_resistance_duration = 80 minutes
fact         = 55c80191-fa13-4c9f-a594-d8b26f3cada8
confirmation = 923c7799-a1ae-44c7-9ddc-9ccb03acb7a6
```

전체 governed Water Current Fact 수도 여전히 2건이다.

## Recommendation boundary

Day Dew는 여전히:

- D2 initial admission fixture에 없음
- frozen prospective 20-product corpus에 없음

따라서:

```text
frozen prospective corpus = 20
frozen Water eligible      = 1
frozen Water coverage      = 1/20
denominator rebased        = false
Recommendation admission   = NOT GRANTED
```

Product Fact completion은 Recommendation admission을 자동으로 만들지 않는다.

## Production invariants

변경 없음:

```text
SPF authenticated beta = ON
SPF phase              = DATA-AI29C-D5D
SPF Production state   = unchanged

Water axis activation  = OFF
Water ranking wiring   = OFF

productionCutoverAuthorized      = false
outdoorRankableSignalAuthorized  = false
publicActivation                 = false
```

## 다음 gate

Day Dew를 Recommendation corpus에 넣는 작업은 이번 단계에서 수행하지 않는다.

향후 필요 조건은 별도 review다.

1. D2-style Recommendation admission review
2. UVA exact authority 회복 또는 `UVA-PF-declared` semantics의 별도 governed 정의

둘 중 어느 것도 이번 R1 Product Fact completion으로 자동 승인되지 않는다.
