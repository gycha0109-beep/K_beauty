# DATA-AI29C-UVA-R3A — Broad Spectrum Semantic Contract v1

## 판정

`BROAD_SPECTRUM_SEPARATE_FACT_SEMANTICS_PASS`

기존 `uva_label`에 U.S. `Broad Spectrum`을 넣지 않는다.

이번 단계는 **semantic contract only / zero-write**다.

- Registry publish 없음
- Product Fact write 없음
- Recommendation authority 변경 없음
- Protection projection 변경 없음
- UVA ranking 변경 없음
- Production activation 없음

## 왜 별도 Fact인가

현재 `uva_label`은 다음 enum만 허용한다.

```text
PA+
PA++
PA+++
PA++++
UVA-PF-declared
```

그리고 현재 protection projection은 이 값을 곧바로:

```text
PA++++          -> uva_high
PA+++           -> uva_medium_high
UVA-PF-declared -> uva_medium_high
PA++            -> uva_medium
PA+             -> uva_low
```

로 바꾼다.

따라서 exact U.S. 제품의 `Broad Spectrum` claim을
`UVA-PF-declared` 또는 PA 값으로 변환하면 단순 데이터 정규화가 아니라
**추천 보호강도 bucket까지 바꾸는 의미론 오류**가 된다.

## FDA 의미

현재 U.S. FDA OTC sunscreen framework에서 Broad Spectrum은
UVA/UVB 범위 보호에 관한 별도 표시다.

OTC Monograph M020의 Broad Spectrum test는 UV 흡광 스펙트럼의
critical wavelength를 사용하고, mean critical wavelength가 370 nm 이상이면
broad spectrum protection으로 분류한다.

참조:

`https://www.accessdata.fda.gov/drugsatfda_docs/omuf/monographs/OTCMonograph_M020-SunscreenDrugProductsforOTCHumanUse.pdf`

따라서 Broad Spectrum은 그 자체로:

- PA grade가 아니다.
- numeric UVA-PF가 아니다.
- PPD 값이 아니다.
- `uva_high / medium` 같은 정량 ranking bucket이 아니다.

## Proposed Fact

```text
fact_key: broad_spectrum
value_type: boolean
cardinality: one
domain_scope: sunscreen
required_scope: market
```

semantic:

> Market-scoped declaration that the exact product is labeled or explicitly
> claimed to provide broad-spectrum UV protection under the applicable market
> framework.

이 Fact는 UVA 강도를 표현하지 않는다.

### Positive

초기 contract에서 허용:

```text
exact Subject
+ exact market
+ product-specific first-party product claim
```

초기 permitted evidence class:

`product_claim`

Measurement 직접 채택은 이번 R3A에서 열지 않는다.
현재 generic measurement evidence contract가 metric/method_context/timepoint를
요구하므로 Broad Spectrum test 측정치까지 같이 열면 별도 measurement semantics가 필요하다.

### Negative

`missing != false`

`false`는 explicit negative authority가 있을 때만 허용한다.

## Exact candidate observations

### Day Dew US

- Product: `6852eeda-eb1d-4c4e-8bea-b30a26126a9c`
- Subject: `4f64fa1b-6af7-4767-b818-f1178d4fe986`
- Market: US
- First-party: Beauty of Joseon
- Claim: `SPF 50 broad spectrum UV protection`

향후 Registry가 안전하게 존재할 경우:

`broad_spectrum = true`

의 semantic candidate가 될 수 있다.

현재 단계에서는 Fact를 쓰지 않는다.

### SKIN1004 US

- Product: `fdf06871-db8e-4e73-a48c-c057c5ce925d`
- Subject: `9dcd611d-e353-47f5-b349-e1f22d73551e`
- Market: US
- First-party exact U.S. formulation
- Claim: `SPF50 broad-spectrum coverage`

이 역시 향후:

`broad_spectrum = true`

후보다.

기존 Global `PA++++` formulation과는 계속 분리한다.

### La Roche-Posay KR

exact KR Subject에는 현재 동일 semantic의 exact Broad Spectrum label을
확정하지 않는다.

외국 market claim을 KR Subject로 전이하지 않는다.

## Recommendation boundary

현재 Recommendation protection contract가 읽는 Fact key는 오직:

```text
spf_value
uva_label
water_resistance_duration
```

이다.

R3A는 이 목록을 변경하지 않는다.

따라서 proposed `broad_spectrum`은:

```text
Fact-only
ranking bucket = null
score contribution = 0
Recommendation admission authority = 없음
```

이다.

## 금지

- Broad Spectrum -> PA
- Broad Spectrum -> UVA-PF-declared
- Broad Spectrum -> PPD
- SPF 50 -> Broad Spectrum 추론
- cross-market transfer
- cross-formulation transfer
- missing -> false
- broad_spectrum -> Decision Axis 자동 생성
- broad_spectrum -> Recommendation score 자동 생성

## 다음 gate

R3A semantic contract는 PASS지만 Registry publish는 아직 금지한다.

다음:

`DATA-AI29C-UVA-R3B — Registry Version Compatibility Audit`

에서 기존 v1 Product Fact / research / review / confirmation 흐름에
새 Registry version이 미치는 영향을 먼저 닫는다.
