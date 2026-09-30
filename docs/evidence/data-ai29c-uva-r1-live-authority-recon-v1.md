# DATA-AI29C-UVA-R1 — Live Authority Recon v1

## 목적

D5D-R1 SPF Production recovery가 완료된 뒤 UVA 축을 다시 다루기 전에,
과거 D4-UVA의 `12/14` HOLD 상태가 현재 Hosted authority에서도 그대로인지 재확인한다.

이 단계는 **read-only recon**이다.

- Product Fact write 없음
- Evidence write 없음
- Registry mutation 없음
- Recommendation mutation 없음
- UVA activation 없음
- SPF Production 상태 변경 없음

## 실행 기준

- repository: `gycha0109-beep/K_beauty`
- observed main: `b0c73f7d65422feb5793a105ae88733921d2c500`
- Production Supabase: `bygrczggxfuisupcevaz`
- registry: `product-fact-registry-cross-category-v1`
- fact: `uva_label`

## Live read 결과

D3R3 mixed comparable corpus 14개를 exact current Product Fact Subject 기준으로 다시 읽었다.

```text
comparable corpus = 14
UVA current authority = 12
missing = 2
complete = false
```

현재 UVA label 분포:

| label | count |
|---|---:|
| PA++++ | 9 |
| PA+++ | 1 |
| PA++ | 2 |

missing은 과거 D4와 동일하다.

### 1. La Roche-Posay Anthelios Sun Fluid

- product: `9983f167-24e7-4223-bd86-446ce6ced31b`
- subject: `614db853-7865-408b-8f40-a4dcfe6a2ea5`
- variant: `ANTHELIOS_SUN_FLUID_KR_50ML`
- formulation: `trust-p7-lrp-4833-current`
- market: `KR`
- current `uva_label`: missing

### 2. SKIN1004 Hyalu-Cica Water-Fit Sun Serum UV

- product: `fdf06871-db8e-4e73-a48c-c057c5ce925d`
- subject: `9dcd611d-e353-47f5-b349-e1f22d73551e`
- variant: `HYALU_CICA_WATER_FIT_SUN_SERUM_UV_US_50ML`
- formulation: `trust-p17-skin1004-uv-us-current`
- market: `US`
- current `uva_label`: missing

## Registry recon

현재 `uva_label` definition:

- semantic definition: `Market-scoped UVA protection label.`
- value type: `enum`
- allowed:
  - `PA+`
  - `PA++`
  - `PA+++`
  - `PA++++`
  - `UVA-PF-declared`
- positive evidence: `product-specific evidence`
- required scope: `market`
- definition checksum:
  `11f1d398e1c460c8597357a162725c708c019d4efc8f3a42b312b5e46bfe43ae`

Production 전체 `UVA-PF-declared` Fact Instance count는 여전히 `0`이다.

따라서 R1에서 새 semantic interpretation은 만들지 않는다.

## D4 continuity

과거 판정:

`UVA_AXIS_D4_HOLD_EXACT_SUBJECT_AUTHORITY_INCOMPLETE`

현재 live read와 비교:

- corpus 14: 동일
- UVA eligible 12: 동일
- missing 2: 동일
- exact missing Subject: 동일
- registry version: 동일
- `UVA-PF-declared` 사용 이력 0: 동일

따라서 D4 HOLD를 깨뜨릴 새 Product Fact authority는 아직 존재하지 않는다.

## R1 판정

`UVA_R1_LIVE_RECON_PASS_R2_EXACT_SUBJECT_RESEARCH_REQUIRED`

R2 허용 범위는 누락된 두 exact Subject의 **first-party exact-subject evidence research**뿐이다.

R2에서도 금지:

- cross-market transfer
- cross-formulation PA transfer
- Broad Spectrum → PA 변환
- generic UVA wording → `UVA-PF-declared` 임의 매핑
- missing authority → low protection 처리

## Production boundary

계속 false:

- `productionCutoverAuthorized`
- `outdoorRankableSignalAuthorized`
- `publicActivation`
- `uvaActivated`
- `waterResistanceApplied`

SPF authenticated beta의 현재 Production 상태는 이 작업에서 변경하지 않는다.
