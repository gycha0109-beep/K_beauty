# DATA-AI29C-UVA-R4 — Blocked Subject Reassessment v1

## 판정

`UVA_R4_BLOCKED_SUBJECT_REASSESSMENT_HOLD_NO_NEW_REGISTRY_ADMISSIBLE_UVA_LABEL`

Broad Spectrum phase closeout 후 `uva_label` EVIDENCE_INSUFFICIENT 3건을 최신 first-party official page 기준으로 다시 확인했다.

Registry `uva_label` 허용값:

```text
PA+
PA++
PA+++
PA++++
UVA-PF-declared
```

`Broad Spectrum`은 허용값이 아니며 PA/UVA-PF/PPD로 변환하지 않는다.

## Day Dew Sunscreen US

공식 페이지에는 SPF 50 broad spectrum UV protection이 직접 표기돼 있다.
그러나 PA grade, UVA-PF, PPD는 확인되지 않았다.

결론: `HOLD_EVIDENCE_INSUFFICIENT`

## La Roche-Posay Anthelios Sun Fluid KR

현재 KR exact 공식 상품 페이지 searchable text에서 PA++++ / UVA-PF / PPD 또는 Registry 허용 UVA label을 확인하지 못했다.

결론: `HOLD_EVIDENCE_INSUFFICIENT`

## SKIN1004 Hyalu-Cica Water-Fit Sun Serum UV US

공식 US product page는 SPF50 broad-spectrum coverage를 직접 주장한다.
그러나 PA grade, UVA-PF, PPD는 확인되지 않았다.

결론: `HOLD_EVIDENCE_INSUFFICIENT`

## 결과

```text
reassessed              = 3
recovered uva_label     = 0
remain BLOCKED          = 3
blocker                 = EVIDENCE_INSUFFICIENT
```

R4 자체 Production write는 0건이다.

## 다음 gate

`DATA-AI29C-UVA-R5 — Blocked Subject Closeout`

동일 공식 근거를 반복 재검색하지 않도록 closeout/watch 조건을 고정하고 다른 protection-axis 작업으로 복귀한다.
