# DATA-AI29C-UVA-R3K — Broad Spectrum Phase Closeout v1

## 판정

`UVA_R3K_BROAD_SPECTRUM_PHASE_CLOSEOUT_PASS`

R3A부터 R3J까지의 Broad Spectrum 분리·Registry·serializer·governed Fact·coverage 작업을 하나의 비랭킹 protection Fact phase로 닫는다.

## 최종 Production 상태

```text
Registry                       = product-fact-registry-cross-category-v2
Registry definitions           = 21
Broad Spectrum serializer      = product-fact-proposition-schema-v2
Broad Spectrum Current Subjects= 2
US eligible Subjects           = 2
US coverage                    = 2/2
Current Product Facts          = 94
Governed Water Facts           = 2
```

Governed Broad Spectrum Subjects:

- Beauty of Joseon Day Dew Sunscreen US = true
- SKIN1004 Hyalu-Cica Water-Fit Sun Serum UV US = true

## 의미 경계

`broad_spectrum`은 다음과 동일하지 않다.

- `uva_label`
- PA grade
- UVA-PF
- PPD
- 정량 UVA protection strength

또한 exact market authority 없이 KR/JP/GLOBAL/미지정 Subject로 자동 전이하지 않는다.

## Recommendation 경계

현재 Broad Spectrum은:

```text
Recommendation contract consumption = false
projection consumption              = false
ranking contribution                = 0
Recommendation admission            = false
public activation                   = false
```

따라서 governed Fact가 두 건 생겼다는 이유로 추천 점수나 랭킹은 변하지 않는다.

## 재개 조건

Broad Spectrum phase는 다음 경우에만 재개한다.

1. 새 US current/resolved sunscreen Subject가 catalog에 들어오고 broad_spectrum이 비어 있음
2. 기존 HOLD/negative Subject에 새 exact-market authority가 생김
3. Recommendation이 Broad Spectrum을 별도 의미로 소비하도록 명시적으로 재설계됨
4. proposition identity 또는 market-scope contract가 변경됨

## UVA label handoff

현재 `uva_label` Current Subject는 10개다.

미해결 BLOCKED 3건:

```text
Day Dew Sunscreen                 US  EVIDENCE_INSUFFICIENT
La Roche-Posay Anthelios Fluid    KR  EVIDENCE_INSUFFICIENT
SKIN1004 Hyalu-Cica Sun Serum UV  US  EVIDENCE_INSUFFICIENT
```

`broad_spectrum=true`는 이 세 건의 `uva_label`을 해결하지 않는다.

## 이 단계의 write

R3K 자체 Production write는 0건이다.

## 다음 gate

`DATA-AI29C-UVA-R4 — UVA Label Blocked Subject Reassessment`

세 BLOCKED exact Subject를 최신 first-party authority 기준으로 재평가하되, Broad Spectrum을 PA/UVA-PF로 변환하지 않는다.
