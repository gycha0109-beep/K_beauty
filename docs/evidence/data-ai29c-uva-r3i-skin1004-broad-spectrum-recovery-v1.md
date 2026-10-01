# DATA-AI29C-UVA-R3I — SKIN1004 Broad Spectrum Second Subject Recovery v1

## 판정

`UVA_R3I_SKIN1004_BROAD_SPECTRUM_SECOND_SUBJECT_PASS`

Day Dew 1건 pilot 뒤 두 번째 exact US Subject로 SKIN1004 Hyalu-Cica Water-Fit Sun Serum UV를 governed Broad Spectrum Fact로 confirmation했다.

## Source authority

현재 SKIN1004 공식 US product page는 exact 제품에 대해 `SPF50 broad-spectrum coverage`를 직접 표기한다.

```text
product   = Hyalu-Cica Water-Fit Sun Serum UV
market    = US
binding   = exact_subject_match / equivalent
authority = product_specific_primary
```

새 frozen source snapshot:

```text
source_id   = 0ef63aa7-f7b6-4ef9-91c4-d2d1b6774910
binding_id  = 21bc2a1d-7634-4746-858a-db7c446b97bb
digest      = b52c1c856baf22b4392d6b2b16de52befb7a1ce9163693a969e199b8300708df
```

## Proposition

```text
registry      = product-fact-registry-cross-category-v2
fact_key      = broad_spectrum
serializer    = product-fact-proposition-schema-v2
value_identity = null
market        = US
proposition   = 07ca68d4f7f55c81f90a5686e861585c4eb2a9c185044a5f97f2029f72244068
```

R3G 계약대로 boolean true 값 자체는 proposition identity에 포함하지 않는다.

## Evidence / confirmation

```text
evidence_id      = ac0ead74-809c-49ce-9d50-733001a00554
assignment_id    = 2e61fee9-3eba-4b29-af0e-c255feede7a3
confirmation_id  = b2f9df90-beab-4f07-a82a-8098618437d8
fact_instance_id = 07bb7628-b2c6-4566-abd0-793863fb2496
value             = true
confidence        = high
authority         = product_specific_primary
```

전체 lifecycle:

`Evidence → queued → under_review → ready_for_confirm → confirmed → Current`

## Existing facts preserved

```text
spf_value       = 50
uv_filter_type  = organic
broad_spectrum  = true
```

기존 SPF/UV-filter Fact Instance와 Confirmation ID는 변경되지 않았다.

## UVA label remains HOLD

`broad_spectrum=true`는 `uva_label`을 대체하지 않는다.

```text
UVA Current  = 0
task         = ba340a0c-17b6-47bb-975e-d2255fccc433
state        = BLOCKED
blocker_code = EVIDENCE_INSUFFICIENT
```

## Production readback

```text
Current Facts           = 94
Broad Spectrum Current  = 2
Governed Water Facts    = 2
SKIN1004 Current Facts  = 3
```

## Recommendation boundary

SKIN1004는 frozen prospective 20에는 존재하지만 `broad_spectrum`은 현재 Recommendation protection contract/projection에서 소비되지 않는다.

따라서 이번 단계로:

- D2 admission 없음
- Recommendation admission 없음
- ranking 변화 없음
- outdoor signal 활성화 없음
- public activation 없음

## 다음 gate

`DATA-AI29C-UVA-R3J — Broad Spectrum Coverage Recon`

두 개의 governed positive Subject를 확보했으므로, 다음 단계는 기존 exact first-party source graph 전체에서 Broad Spectrum recoverable coverage를 재산정한다.
