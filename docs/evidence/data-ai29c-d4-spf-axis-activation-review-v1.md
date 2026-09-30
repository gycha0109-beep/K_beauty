# DATA-AI29C-D4-SPF — Axis-Specific Activation Review v1

## 목적

D3R3에서 neutral mixed baseline 비교가 가능한 authority-complete subset을 확보했다.

- legacy sunscreen: 11
- 신규 sunscreen grant: 5
- neutral comparable 신규: 3
- unresolved 신규 HOLD: 2
- mixed comparable corpus: 14

D4-SPF는 SPF 축만 따로 검토한다.

이 단계는 Production 활성화가 아니다.

목표는:

`SPF 축을 D5 bounded activation 후보로 넘겨도 되는가`

를 판정하는 것이다.

## 입력 authority

D3R3 comparable subset만 사용한다.

신규 3종:

- Physical Daily Sunmilk
- MIN JUNG GI Physical Sun Block
- Jojoba Suncream

HOLD 유지:

- Dr. Troub Zinc Physical
- Bio Repair + Suncream

HOLD 제품은 SPF authority가 있어도 mixed shadow에 들어오지 않는다.

즉:

`protection authority != candidate authority`

## SPF authority completeness

14개 comparable candidate 전부:

`SPF bucket authority = 14 / 14`

missing 없음.

legacy 11종은 전부 `spf_50_plus_band`다.

따라서 legacy SPF delta는 모두:

`+6`

이다.

같은 상수를 기존 score에 더하므로
legacy 11종 내부 상대순서는 수학적으로 변하지 않는다.

## Explicit outdoor gate

SPF delta는 다음 조건에서만 적용한다.

`outdoorExposure === true`

동일한 14개 baseline row에 대해
`outdoorExposure=false`로 protection adjustment를 실행하면:

- appliedTotal = 0
- shadowScore = baselineScore
- enabledAxes = []

이어야 한다.

즉 outdoor가 아닌 request에서
SPF authority가 있어도 ranking signal로 쓰지 않는다.

## Axis isolation

D4-SPF review에서 outdoor=true일 때 활성화되는 protection axis:

`spf only`

UVA:

`disabled`

Water resistance:

`disabled`

SPF review를 이유로 UVA 또는 water를 함께 켜지 않는다.

## Candidate resurrection 방지

파이프라인 순서:

```text
candidate admission
→ semantic authority gate
→ sunscreen hard reject
→ baseline score
→ comparable mixed baseline
→ SPF overlay
```

SPF는 candidate를 만들지 않는다.

SPF는 HOLD/rejected candidate를 되살리지 않는다.

D3R3에서 semantic HOLD인 Zinc/Bio는 D4 SPF shadow에 존재하지 않아야 한다.

## Legacy invariance

legacy 11종 delta:

`+6 / +6 / ... / +6`

따라서 relative order invariant.

또한 14종 전체 neutral baseline top-set과 SPF-only shadow top-set이 동일해야 한다.

D3R3 기준 baseline top-set:

- ROUNDLAB Birch Moisture Sun Cream
- La Roche-Posay Anthelios
- ANESSA Perfect UV Milk
- Dr.G Green Mild Up Sun+

D4-SPF는 이 top-set을 유지해야 한다.

## 신규 3종 rank-shift

신규 제품 SPF delta:

| product | SPF bucket | delta |
|---|---|---:|
| Physical Daily Sunmilk | SPF 15–29 | +2 |
| MIN JUNG GI Physical Sun Block | SPF 30–49 | +4 |
| Jojoba Suncream | SPF 30–49 | +4 |

D4는 실제 baseline rank와 SPF shadow rank를 기록한다.

하지만 아직 임의의 `max rank shift <= N` 기준은 만들지 않는다.

이유:

그 threshold는 D5 activation policy다.
D4 review에서 근거 없이 숫자를 발명하면 안 된다.

D4에서는:

- 변화량을 관찰/기록
- legacy invariant 확인
- top-set invariant 확인

까지만 한다.

## D4-SPF gate

다음 조건을 모두 만족해야 PASS다.

1. SPF authority coverage = 14/14
2. non-outdoor delta = 0
3. outdoor에서 SPF만 활성
4. baseline top-set invariant
5. legacy relative order invariant
6. semantic/hard-reject HOLD가 shadow에 유입되지 않음
7. water disabled
8. Production wiring/activation 전부 frozen

PASS 시 판정:

`SPF_AXIS_D4_REVIEW_PASS_D5_MANUAL_APPROVAL_REQUIRED`

## D5 proposal

D4는 runtime flag를 구현하지 않는다.

D5에서 승인될 경우 필요한 bounded gate proposal:

```text
SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED
default=false
trigger=outdoorExposure === true
scope=authority-complete comparable subset only
rollback=flag false
UVA=false
water=false
```

중요:

이 문서는 해당 flag를 승인하거나 구현하지 않는다.

D5는 별도 manual approval 단계다.

## Production boundary

계속 false:

- runtimeFlagImplemented
- productionCandidateAdmissionWired
- productionRankingChanged
- productionCutoverAuthorized
- outdoorRankableSignalAuthorized
- publicActivation
- uvaActivated
- waterResistanceApplied
- persistence
