# DATA-AI29C-UVA-R2 — Exact-Subject Evidence Research v1

## 목적

R1에서 Production UVA authority가 여전히 `12/14`이고, 누락 exact Subject가 과거 D4와 동일함을 확인했다.

R2는 누락된 두 Subject에 대해 **현재 first-party exact-subject evidence만** 다시 조사한다.

이 단계는 research-only다.

- Product Fact write 없음
- Evidence record write 없음
- review / confirmation 없음
- Registry 변경 없음
- Recommendation 변경 없음
- SPF Production 상태 변경 없음
- UVA activation 없음

## Registry boundary

현재 `uva_label`:

```text
registry = product-fact-registry-cross-category-v1
semantic = Market-scoped UVA protection label.
positive evidence = product-specific evidence
allowed =
  PA+
  PA++
  PA+++
  PA++++
  UVA-PF-declared
```

중요:

`UVA-PF-declared`가 enum에 존재한다는 사실은
Broad Spectrum, UVA circle, generic UVA wording을 자동으로 이 값에 매핑할 권한을 만들지 않는다.

## 1. La Roche-Posay Anthelios Sun Fluid — KR

Exact Subject:

```text
product = 9983f167-24e7-4223-bd86-446ce6ced31b
subject = 614db853-7865-408b-8f40-a4dcfe6a2ea5
variant = ANTHELIOS_SUN_FLUID_KR_50ML
formulation = trust-p7-lrp-4833-current
market = KR
```

현재 공식 한국 페이지:

`https://www.larocheposay.co.kr/product/view/4833.do`

확인된 것:

- exact Korean product identity
- exact current ingredient list
- 자외선 차단 기능성
- 초장파 자외선 차단을 강조하는 공식 claim

그러나 현재 first-party product text에서 Registry enum에 직접 대응하는:

- `PA+`
- `PA++`
- `PA+++`
- `PA++++`

를 확정하지 못했다.

또한 generic UVA protection wording이나 UVA mark를 `UVA-PF-declared`로 해석하는 별도 governed semantic rule도 없다.

외부 Korean retail/review/editorial source에서 보이는 PA 표기는 Product Fact positive authority로 승격하지 않는다.

다른 국가 La Roche-Posay 제품의 PPD/UVA claim도 KR Subject로 옮기지 않는다.

### 판정

`HOLD_EXACT_SUBJECT_FIRST_PARTY_UVA_LABEL_NOT_ESTABLISHED`

`candidateValue = null`

`confirmationEligible = false`

---

## 2. SKIN1004 Hyalu-Cica Water-Fit Sun Serum UV — US

Exact Subject:

```text
product = fdf06871-db8e-4e73-a48c-c057c5ce925d
subject = 9dcd611d-e353-47f5-b349-e1f22d73551e
variant = HYALU_CICA_WATER_FIT_SUN_SERUM_UV_US_50ML
formulation = trust-p17-skin1004-uv-us-current
market = US
```

Exact US formulation first-party page:

`https://www.skin1004.com/products/hyalu-cica-water-fit-sun-serum-uv?variant=51261874995446`

공식 claim:

`SPF50 broad-spectrum coverage`

공식 active ingredients:

- Avobenzone 2.7%
- Homosalate 13.6%
- Octisalate 4.5%
- Octocrylene 9%

이 source에는 exact US formulation에 대한 PA label이 없다.

반면 공식 Global product:

`https://www.skin1004.com/products/hyalu-cica-water-fit-sun-serum-spf50-pa`

는 `SPF50+ PA++++`를 선언한다.

하지만 Global formulation의 UV filters는:

- Diethylamino Hydroxybenzoyl Hexyl Benzoate
- Ethylhexyl Triazone
- Methylene Bis-Benzotriazolyl Tetramethylbutylphenol
- Diethylhexyl Butamido Triazone

으로 exact US formulation과 다르다.

따라서:

```text
Global PA++++
→ US exact Subject
```

전이는 금지한다.

Broad Spectrum 역시 PA로 변환하지 않는다.

### 판정

`HOLD_EXACT_US_FORMULATION_UVA_LABEL_NOT_ESTABLISHED`

`candidateValue = null`

`confirmationEligible = false`

---

## R2 결과

```text
recovered = 0
confirmation eligible = 0
remaining missing = 2
projected UVA coverage = 12 / 14
```

따라서 R3 Product Fact adoption으로 넘어갈 대상이 없다.

R3를 억지로 실행하지 않는다.

## 최종 판정

`UVA_R2_HOLD_NO_EXACT_SUBJECT_REGISTRY_ADMISSIBLE_UVA_LABEL`

이 HOLD는 두 제품의 UVA 보호력이 낮다는 의미가 아니다.

정확한 의미는:

> 현재 Product Fact governance가 요구하는 exact Subject + market scope + product-specific evidence 기준으로는 두 제품의 `uva_label` 값을 확정할 수 없다.

## 이후 허용 경로

현재 UVA activation track은 여기서 정지한다.

향후 다시 열 수 있는 경로:

1. 해당 exact Subject의 새로운 first-party PA/UVA-PF evidence가 실제로 발행됨
2. `UVA-PF-declared` 의미와 admissible source semantics를 별도 governance track에서 정의하고 검증함

2번은 R2에서 우회 적용하지 않는다.

## 불변조건

계속 금지:

- Broad Spectrum → PA
- Broad Spectrum → `UVA-PF-declared` 임의 변환
- Global PA → US exact formulation
- non-KR claim → LRP KR Subject
- retailer/review PA → Product Fact
- missing → low protection

Production boundary:

```text
productionCutoverAuthorized = false
outdoorRankableSignalAuthorized = false
publicActivation = false
uvaActivated = false
waterResistanceApplied = false
```

현재 SPF authenticated Production beta 상태는 변경하지 않는다.
