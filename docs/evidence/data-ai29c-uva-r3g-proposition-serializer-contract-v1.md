# DATA-AI29C-UVA-R3G — Proposition Serializer Contract Repair v1

## 판정

`UVA_R3G_PROPOSITION_SERIALIZER_SCHEMA_V2_PASS_POLICY_LOCKED`

R3F에서 Registry v2를 publish한 뒤 Day Dew Broad Spectrum pilot을 준비하는 과정에서
Registry proposition identity contract와 legacy serializer 동작 간 드리프트를 발견했다.

## 발견된 드리프트

기존 boolean Fact `barrier_support_claim`은 Registry에서:

```text
include_value_identity = false
```

인데 실제 hosted proposition key는:

```text
value_identity = true
```

를 hash에 포함할 때만 재현된다.

실측:

```text
known key
5bd530c0b48f73553f935695d2254d415476b66539a88624c7e4e1d581c8f777

legacy framing + value_identity=true
5bd530c0b48f73553f935695d2254d415476b66539a88624c7e4e1d581c8f777

legacy framing + value_identity=null
5b481132d7b55acd1cba235a7745ea7356aff26b7de6d712bea7cb7169c0749f
```

즉 `product-fact-proposition-pilot-v1`은 Registry의
`include_value_identity=false`를 실제 hash에서 따르지 않는다.

## 왜 즉시 중단했는가

`broad_spectrum` v2 definition도:

```text
include_value_identity = false
```

다.

legacy serializer로 true/false를 각각 hash하면 서로 다른 proposition key가 된다.
이는 Broad Spectrum의 positive/explicit-negative evidence가 동일 proposition에서
충돌/판정돼야 한다는 Registry 의미와 맞지 않는다.

따라서 Product Fact를 쓰기 전에 v2 `broad_spectrum` write policy를 BLOCKED로 전환했다.

잠금 당시:

```text
Evidence       = 0
Open Review    = 0
Fact Instance  = 0
Current        = 0
```

Production Fact 오염은 없었다.

## 새 serializer

`product-fact-proposition-schema-v2`

구현:

`lib/product-fact-proposition-schema-v2.mjs`

핵심 규칙:

1. canonical stable JSON을 SHA-256 한다.
2. subject_semantic_key / registry_version / fact_key를 명시적으로 pin한다.
3. Registry definition의 scope_dimensions 중 non-null 값만 identity scope에 포함한다.
4. qualifier_dimensions만 identity qualifier에 포함한다.
5. `include_value_identity=false`면 실제 Fact 값이 true/false여도
   `value_identity=null`로 고정한다.
6. Broad Spectrum pilot은 parent proposition이 없으므로 null이다.

## Day Dew identity

```text
serializer   = product-fact-proposition-schema-v2
subject      = afce6d4dba5b288999cf087d9827e89e9819be4c99322650ea9e27077778029e
registry     = product-fact-registry-cross-category-v2
fact_key     = broad_spectrum
scope        = { market: US }
qualifier    = {}
value_identity = null
```

결과:

`e653ba036940662aa2e5aad8dd008d1194814923fa72a5cd088a0b585fb6199b`

true와 false 모두 동일 key를 사용한다.

## Full rollback pilot

policy를 transaction 내부에서만 임시 활성화하고 다음 전체 경로를 실행했다.

```text
existing exact BOJ source/binding
→ broad_spectrum Evidence ingest
→ queued review
→ under_review
→ ready_for_confirm
→ confirmation preflight
→ controlled confirmation
→ Current
```

결과:

- Evidence ingest PASS
- review transition PASS
- preflight READY
- confirmation CONFIRMED
- transaction 내부 Current Facts = 93
- Day Dew broad_spectrum = true 확인
- 전체 ROLLBACK

## Rollback 후 Production

```text
broad_spectrum policy = BLOCKED
new lineage           = false
existing lineage      = false

Evidence              = 0
Open Review           = 0
Fact Instance         = 0
Current               = 0
Total Current Facts   = 92
```

## Recommendation boundary

변경 없음:

- Broad Spectrum Recommendation 소비 없음
- sunscreen protection reader 변경 없음
- protection projection 변경 없음
- ranking 변경 없음
- public activation 없음

## 다음 gate

`DATA-AI29C-UVA-R3H — Day Dew Broad Spectrum Governed Fact Pilot`

R3G가 main에 머지된 뒤에만 policy를 다시 활성화하고,
새 serializer version으로 Day Dew 한 건을 실제 Production에 confirmation한다.
