# DATA-AI29C-PROTECTION-R1 — Protection Gap Watch Closeout v1

## Decision

`PROTECTION_R1_PHASE_CLOSEOUT_PASS_TRIGGERED_REOPEN_ONLY`

현재 sunscreen protection recovery를 active-search 상태에서 watch 상태로 전환한다.

## Production snapshot

```text
resolved/current sunscreen = 13
Current Product Facts      = 95
SPF value                  = 13/13
UVA label                  = 10/13
UVA BLOCKED                = 3
UV filter type             = 12/13
UV filter HOLD             = 1
Water duration             = 2/13
Broad Spectrum Current     = 2
US Broad Spectrum eligible = 2/2
```

## Axis state

- SPF: current scope 13/13 complete.
- UVA label: R5의 3 BLOCKED Subject는 source/Subject/Registry fingerprint 변화 시에만 reopen.
- UV filter type: FILTER-R2의 Round Lab renewed KR 1건은 exact KR formulation authority 변화 시에만 reopen.
- Water duration: numeric duration의 직접 authority가 새로 생길 때만 reopen. frozen prospective 20 coverage는 1/20 유지.
- Broad Spectrum: US eligible 2/2 complete. Recommendation consumer와 ranking에는 연결하지 않음.

## Boundaries

```text
productionCutoverAuthorized = false
outdoorRankableSignalAuthorized = false
publicActivation = false
missing != false
Broad Spectrum != uva_label
Fact adoption != Recommendation activation
Water resistance = independent axis
```

## Writes

이번 closeout은 Production mutation이 없다.

```text
Product Fact = 0
research task = 0
Registry = 0
policy = 0
Recommendation = 0
ranking change = false
public activation = false
```

## Next state

`TRIGGERED_REOPEN_ONLY_NO_AUTOMATIC_PROTECTION_RESEARCH_WAVE`

새 admissible authority trigger가 실제 발생하기 전에는 동일 source를 반복 검색하거나 coverage 수치만으로 Fact를 추가하지 않는다.
