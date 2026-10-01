# DATA-AI29C-UVA-R3H — Day Dew Broad Spectrum Governed Fact Pilot v1

## 판정

`UVA_R3H_DAY_DEW_BROAD_SPECTRUM_GOVERNED_FACT_PILOT_PASS`

R3G에서 고정한 schema-aware proposition serializer를 사용해 Beauty of Joseon Day Dew Sunscreen US 한 건을 실제 governed Product Fact로 confirmation했다.

## Governed identity

```text
registry      = product-fact-registry-cross-category-v2
fact_key      = broad_spectrum
serializer    = product-fact-proposition-schema-v2
proposition   = e653ba036940662aa2e5aad8dd008d1194814923fa72a5cd088a0b585fb6199b
value         = true
market        = US
```

`include_value_identity=false` 계약에 따라 proposition value identity는 null이다.
따라서 같은 Subject/market의 explicit negative evidence가 향후 나타나더라도 동일 proposition에서 충돌 판정할 수 있다.

## Evidence

기존 exact BOJ first-party source와 binding을 재사용했다.

```text
source_id   = 38b1662b-9b9c-4869-aa63-eed6ae3074a8
binding_id  = f0cd536b-9a58-4cd0-b6ae-8e5ac3222565
binding     = exact_subject_match / equivalent
claim       = SPF 50 broad spectrum UV protection

evidence_id = 08cc057d-11b1-48bc-bcf1-6ec2ce91887d
class       = product_claim
authority   = product_specific_primary
confidence  = high
direction   = supports
```

## Review / confirmation

```text
assignment_id   = f8158e46-c9a0-460e-9a5f-482a7cc5df1e
review lifecycle = queued → under_review → ready_for_confirm → confirmed

confirmation_id = d110e320-06c6-4e79-9ef3-8eb86f4bba3b
fact_instance_id = 0d4f6352-ff30-441f-88c3-8c0685fca8d2
payload_digest   = 7cf5d53cb784b4f9a4422ffd80cddecdca616b575645e674301ecff33707856f
prestate_digest  = 95c60651955bf84e68c8567f06aa4d5712f771616d5499cf9d2a9a77d91f0553
fusion_digest    = b962d412da0211ea64d7c0faab79a710593172b168d12c62749e980a258512fe
```

## Existing Day Dew facts remain unchanged

```text
spf_value                 = 50
uv_filter_type            = organic
water_resistance_duration = 80 minutes
broad_spectrum            = true
```

기존 SPF / UV filter / Water의 Fact Instance와 Confirmation ID는 모두 변경되지 않았다.

## UVA label remains separate

`broad_spectrum=true`는 `uva_label`을 해결하지 않는다.

기존 UVA task:

```text
task  = 74661ab2-2adb-4255-9c05-0418c1caa105
state = BLOCKED
code  = EVIDENCE_INSUFFICIENT
```

Day Dew `uva_label` Current는 여전히 0건이다.

## Production readback

```text
Current Product Facts        = 93
Day Dew Current Facts        = 4
Broad Spectrum Current       = 1
Governed Water Facts         = 2
SPF authenticated beta       = ON
SPF authorized phase         = DATA-AI29C-D5D
```

## Recommendation boundary

현재 Recommendation protection contract와 projection은 `broad_spectrum`을 읽지 않는다.

Day Dew는 계속:

- D2 initial admission 미편입
- frozen prospective 20 미편입
- frozen Water denominator 재산정 없음
- frozen Water coverage 1/20 유지
- Recommendation admission 없음
- ranking 변화 없음
- public activation 없음

## 다음 gate

`DATA-AI29C-UVA-R3I — Broad Spectrum Second Subject Recovery`

Day Dew 1건 pilot이 닫힌 뒤 exact U.S. first-party authority가 이미 존재하는 두 번째 Subject부터 coverage를 확대한다.
