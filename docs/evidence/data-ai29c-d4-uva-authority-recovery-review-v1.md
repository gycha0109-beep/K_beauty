# DATA-AI29C-D4-UVA — Exact-Subject Authority Recovery Review v1

## 목적

D3R3 mixed comparable corpus는 14개다.

현재 UVA authority:

- eligible: 12
- missing: 2

missing:

1. La Roche-Posay Anthelios Sun Fluid
2. SKIN1004 Hyalu-Cica Water-Fit Sun Serum UV

D4-UVA recovery는 이 두 제품의 정확한 현재 Product Fact Subject에
governed `uva_label`을 추가할 수 있는지 재조사한다.

이 단계의 원칙:

`missing != low protection`

`same product name != same formulation`

`official source != exact Subject authority unless identity/scope match`

## Registry

Current Product Fact registry:

`product-fact-registry-cross-category-v1`

`uva_label` allowed values:

- PA+
- PA++
- PA+++
- PA++++
- UVA-PF-declared

Projection:

- PA++++ → uva_high
- PA+++ → uva_medium_high
- UVA-PF-declared → uva_medium_high
- PA++ → uva_medium
- PA+ → uva_low

Production readback:

`UVA-PF-declared` historical/current Product Fact instance count:

`0`

따라서 이 enum의 의미를
Broad Spectrum / generic UVA marking에 임의로 매핑하지 않는다.

## La Roche-Posay

Product:

`9983f167-24e7-4223-bd86-446ce6ced31b`

Current Subject:

`614db853-7865-408b-8f40-a4dcfe6a2ea5`

Variant:

`ANTHELIOS_SUN_FLUID_KR_50ML`

Market:

`KR`

Current governed facts:

- SPF 50
- UV filter = organic
- UVA label = missing

### Exact KR source

Official Korean product page:

`https://www.larocheposay.co.kr/product/view/4833.do`

Exact Korean product identity is established.

그러나 현재 governed text review에서는
registry value로 직접 확정할 수 있는:

- PA label
- numeric UVA-PF
- numeric PPD

를 확보하지 못했다.

### UK source

Official UK UVMune 400 page는 high PPD와 강한 UVA protection을 명시한다.

그러나:

- market가 다름
- exact KR formulation equivalence가 governed하게 확정되지 않음

따라서 다음 전이는 금지한다.

`UK high PPD → KR uva_label`

또한 generic UVA marking을 근거 없이

`UVA-PF-declared`

로 해석하지 않는다.

결론:

`HOLD_EXACT_SUBJECT_UVA_LABEL_NOT_ESTABLISHED`

## SKIN1004

Product:

`fdf06871-db8e-4e73-a48c-c057c5ce925d`

Current Subject:

`9dcd611d-e353-47f5-b349-e1f22d73551e`

Variant:

`HYALU_CICA_WATER_FIT_SUN_SERUM_UV_US_50ML`

Market:

`US`

Current governed facts:

- SPF 50
- UV filter = organic
- UVA label = missing

### Exact US source

TRUST-P18 frozen exact US formulation uses:

- Avobenzone 2.7%
- Homosalate 13.6%
- Octisalate 4.5%
- Octocrylene 9%

Observed UVA claim:

`Broad Spectrum`

TRUST-P18 already freezes:

- `registry_admissible=false`
- `broad_spectrum_to_pa_conversion=false`
- `cross_formula_pa_transfer=false`
- `uva_label_adoption_planned=false`

### Global source

Current global SKIN1004 official page declares:

`SPF50+ PA++++`

하지만 global formula는 다음 UV filters를 사용한다.

- Diethylamino Hydroxybenzoyl Hexyl Benzoate
- Ethylhexyl Triazone
- Methylene Bis-Benzotriazolyl Tetramethylbutylphenol
- Diethylhexyl Butamido Triazone

US formulation과 명백히 다르다.

따라서:

`Global PA++++ → US Subject`

전이는 금지한다.

Broad Spectrum을 PA 또는 `UVA-PF-declared`로
새롭게 해석하는 것도 별도 governed semantic rule 없이는 금지한다.

결론:

`HOLD_CROSS_FORMULA_PA_TRANSFER_FORBIDDEN`

## Governed write 결과

이번 recovery review에서:

- Product Fact confirmations: 0
- Evidence records: 0
- Review assignments: 0
- Registry mutations: 0

근거가 부족한 상태에서 빈칸을 채우지 않았다.

## D4-UVA 판정

`UVA_AXIS_D4_HOLD_EXACT_SUBJECT_AUTHORITY_INCOMPLETE`

현재 coverage:

`12 / 14`

이 HOLD는 UVA 보호력이 낮다는 뜻이 아니다.

정확한 의미는:

> 14개 mixed comparable candidate 모두에게
> 동일한 governed UVA ranking authority를 적용할 수 있을 만큼
> exact-Subject evidence가 아직 완성되지 않았다.

## 다음 허용 경로

둘 중 하나가 필요하다.

1. exact Subject에 직접 귀속되는 first-party PA/UVA-PF claim 확보
2. `UVA-PF-declared`의 의미와 admissible source rule을 별도 registry/governance 단계에서 명시적으로 확정

금지:

- cross-market transfer
- cross-formulation PA transfer
- Broad Spectrum → PA 변환
- missing authority → low protection 처리

## Production boundary

계속 false:

- productFactWritten
- registryChanged
- productionCandidateAdmissionWired
- productionRankingChanged
- productionCutoverAuthorized
- outdoorRankableSignalAuthorized
- publicActivation
- uvaActivated
- waterResistanceApplied
