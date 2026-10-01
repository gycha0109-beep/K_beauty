# DATA-AI29C-UVA-R3F — Broad Spectrum Registry Controlled Publish v1

## 판정

`UVA_R3F_BROAD_SPECTRUM_REGISTRY_CONTROLLED_PUBLISH_PASS`

R3E rollback preflight에서 검증한 동일한 21-key Registry snapshot을 Production에 실제 publish했다.

## Published Registry

```text
source Registry       = product-fact-registry-cross-category-v1
published Registry    = product-fact-registry-cross-category-v2
definitions           = 21
carried forward       = 20
new fact_key          = broad_spectrum

Registry checksum
= 923256ca2468b2af31e1b7026655739408035daf62d3ff40a7132eca22afddd7

broad_spectrum definition checksum
= c888474e8970f787dee3f71bdcc505a779400b0ebf438901bbc5fd7f2dc32dc9
```

publish 후 global latest Registry는 v2다.

## Per-fact write authority

v2에서 write authority가 열린 key는 `broad_spectrum` 하나뿐이다.

```text
broad_spectrum
  policy_state             = active
  new_lineage_allowed      = true
  existing_lineage_allowed = true
  authorized_phase         = DATA-AI29C-UVA-R3F
```

v2에 snapshot으로 복제된 기존 20개 key에는 policy row를 만들지 않았다.

예:

```text
v2 spf_value new lineage
→ allowed = false
→ reason  = POLICY_MISSING
```

반면 기존 v1 `spf_value`는 계속 `ALLOWED`다.

즉 Registry publish가 기존 Fact key의 write authority migration을 의미하지 않는다.

## Production readback

```text
Registry versions       = 2
latest Registry         = product-fact-registry-cross-category-v2
v2 definitions          = 21

write-policy rows       = 21
v1 policy rows          = 20
v2 policy rows          = 1
v2 non-broad policies   = 0

Current Facts           = 92
broad_spectrum Current  = 0
Water Current           = 2

active v1 research      = 371
  EVIDENCE_CANDIDATE    = 28
  REVIEW_REQUIRED       = 343
```

SPF authenticated beta도 기존 상태를 유지한다.

```text
enabled          = true
authorized_phase = DATA-AI29C-D5D
```

## Recommendation boundary

R3F는 Registry와 write authority만 연다.

변경하지 않은 것:

- Recommendation sunscreen protection reader
- protection projection
- ranking bucket
- public activation
- SPF/UVA/Water 기존 Fact lineage

`broad_spectrum` Product Fact는 아직 0건이다.

## 다음 gate

`DATA-AI29C-UVA-R3G — Day Dew Broad Spectrum Governed Fact Pilot`

R3G에서 Day Dew US exact Subject 한 건만 Evidence → review → confirmation → Current 경로로 pilot한다.
Recommendation ranking에는 연결하지 않는다.
