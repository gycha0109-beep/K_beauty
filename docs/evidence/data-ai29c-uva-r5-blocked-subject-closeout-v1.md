# DATA-AI29C-UVA-R5 — Blocked Subject Closeout v1

## 판정

`UVA_R5_BLOCKED_SUBJECT_CLOSEOUT_PASS_WATCH_ON_CHANGE`

R4에서 latest first-party source를 다시 확인했음에도 registry-admissible `uva_label`이 회수되지 않은 3개 Subject를 반복검색 대상에서 제외하고 watch-on-change 상태로 닫는다.

## 닫히는 BLOCKED Subject

```text
Day Dew Sunscreen US
La Roche-Posay Anthelios Sun Fluid KR
SKIN1004 Hyalu-Cica Water-Fit Sun Serum UV US

state   = BLOCKED
blocker = EVIDENCE_INSUFFICIENT
```

## Watch fingerprint

각 Subject는 다음 네 축으로 fingerprint를 고정한다.

1. `uva_label` Registry definition checksum
2. `subject_semantic_key` + `formulation_revision_key`
3. latest exact-market exact-subject official source locator
4. latest exact source `content_digest`

동일 fingerprint에서는 동일 official page를 반복 검색하지 않는다.

## 재개 조건

다음 중 하나가 실제로 바뀔 때만 UVA recovery를 다시 연다.

- exact source content digest 변경
- 새 exact/equivalent first-party source에서 PA 또는 UVA-PF 직접 선언 발견
- Subject semantic identity 변경
- formulation revision 변경
- `uva_label` Registry definition checksum/allowed values 변경
- 수동 검토된 product-specific admissible evidence candidate 등장

다음은 재개 조건이 아니다.

- Broad Spectrum 문구만 존재
- SPF 값만 변경
- brand-family generic UVA 주장
- cross-market / cross-formulation 근거

## Closeout coverage

```text
resolved/current sunscreen = 13
SPF                         = 13/13
UVA label                   = 10/13
UVA blocked                 = 3
UV filter type              = 11/13
Water duration              = 2/13
Broad Spectrum Current      = 2
Current Product Facts       = 94
```

## 이 단계의 write

R5 Production write는 0건이다.

- Product Fact 0
- research task 0
- Registry 0
- policy 0

## 다음 gate

`DATA-AI29C-FILTER-R1 — UV Filter Type Missing Subject Recovery`

UVA는 source 변화가 생길 때까지 watch 상태로 두고, 실제 recoverable 미커버리지인 UV filter 2개 Subject를 우선 조사한다.
