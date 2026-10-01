# DATA-AI29C-WATER-D2A-R1 — FULLY Official Source Recovery v1

## 판정

`WATER_D2A_R1_FULLY_SOURCE_RECOVERY_PASS_NO_DURATION_AUTHORITY`

D2A에서 유일한 first-party source gap으로 남았던 **FULLY Rice Ceramide Moisture Sun Cream**의 exact KR official product source를 회수하고 governed source graph에 연결했다.

이 단계는 **source identity recovery**다.

Water Product Fact recovery가 아니다.

## Target

- Product: `df32d800-2f16-4511-8efa-dc353ea1c2ef`
- Subject: `d677c25a-508d-42f8-a0e4-e76d6f9abb0c`
- Market: KR
- variant_key: null
- formulation: `data-ai29c-c5-fully-rice-ceramide-current`
- catalog candidate: `1eae1cd9-ede3-41c8-87e2-c8bab93ff9e0`

기존 catalog-only boundary는 그대로 유지한다.

- identity_state = EXACT_SUBJECT_FOUND
- candidate = promoted / resolved
- sunscreen taxonomy = shadow
- recommendation admission = false
- Product Fact write authority = false

## First-party exact source

공식 FULLY product page:

`https://www.full-y.co.kr/product/detail.html?cate_no=49&display_group=1&product_no=117`

확인한 exact identity:

- 제품명: 풀리 쌀 세라 수분 선크림
- 용량: 50ml / 1.69 fl.oz.
- 기능성: 자외선차단/미백/주름개선 3중 기능성 화장품
- 책임판매업자: (주)어댑트
- 제조: 한국

현재 source observation에서 **명시적인 water-resistance duration은 확인되지 않았다.**

따라서 이 공식 source를 찾았다는 사실 자체를
`water_resistance_duration` positive authority로 변환하지 않는다.

## Governed source registration

기존 `admin_ingest_product_fact_evidence_v1` boundary를 사용했다.

중요:

`evidence = null`

로 호출하여 Source + exact Subject binding만 등록했다.

결과:

- source = `be715dd9-f911-4366-b2cd-b3dda7e4e68a`
- evidence subject binding = `7fbd65af-60fa-47a7-bd84-85727da51888`
- audit = `75214dc4-ef9b-4d10-8e47-2ea1d668868a`
- binding_state = exact_subject_match
- scope_relation = equivalent
- Evidence record write = 0

## Catalog operational projection

이미 governed source authority가 생긴 뒤 기존 C5D projection만 재사용했다.

`admin_project_catalog_trust_official_source_v1`

결과:

- source_name = `fully_official`
- operational binding = `8794939d-ed96-48df-b659-09c6edd24c4e`
- review = `08f26b89-e396-43bf-aa56-00d8464d0c04`
- audit = `553fa9d8-a6d1-489b-9646-b1e670da216f`

projection 결과가 명시적으로 보존한 경계:

```text
product_fact_authority_mutated = false
recommendation_authority_mutated = false
production_cutover_authorized = false
```

## D2A delta

D2A:

```text
first-party bound target = 18 / 19
source gap = 1
FULLY = HOLD_FIRST_PARTY_SOURCE_NOT_ESTABLISHED
```

R1 이후:

```text
first-party bound target = 19 / 19
source gap = 0
FULLY source identity = recovered
FULLY water duration authority = still missing
```

따라서 FULLY의 상태는 이제 source gap이 아니라:

`HOLD_NO_EXPLICIT_DURATION_AUTHORITY`

로 좁혀진다.

## Production readback

write 직후 authoritative readback:

```text
Current governed Water Facts = 2
FULLY Current Water Fact     = 0

frozen prospective corpus    = 20
frozen Water eligible        = 1
frozen Water coverage        = 1/20

SPF authenticated beta       = ON
SPF phase                    = DATA-AI29C-D5D
```

즉 Water ranking coverage는 전혀 변하지 않았다.

## Semantic boundary

계속 금지:

- official source 존재 → Water Fact 자동 생성
- source identity → Product Fact authority
- missing duration → 0 minutes
- missing duration → non-waterproof
- frozen denominator 20 → 21
- Day Dew를 frozen prospective corpus에 편입

## 다음 gate

D2B adoption은 열지 않는다.

이유:

```text
new duration authority = 0
new confirmation eligible = 0
```

다음 작업은 source recovery와 분리된 Product Fact research다.
