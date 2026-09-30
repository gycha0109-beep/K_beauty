# DATA-AI29C-D3R3 — Semantic Authority Recovery + Comparable Subset Shadow v1

## 목적

D3R2는 신규 5종 전체를 legacy 11종과 한 ranking frame에 넣기 위해
finish/tone-up 축을 mask하면 두 문제가 충돌함을 확인했다.

1. 신규에만 mask → cross-cohort unfair
2. mixed 전체 mask → legacy behavior invariance 파괴

D3R3는 unknown을 강제로 채우는 대신,
**현재 scorer가 실제로 요구하는 semantic authority가 완성된 신규 subset만**
legacy와 같은 scorer에 투입한다.

## Production governed recovery

Production project:

`bygrczggxfuisupcevaz`

기존 Admin review RPC:

`admin_register_sunscreen_recommendation_semantic_field_v1()`

만 사용했다.

직접 table update/insert는 하지 않았다.

### Physical Daily Sunmilk

`finish`

- previous: `reviewed_not_established`
- current: `established = dewy`
- confidence: medium

근거:

- 공식 SIDMOOL 페이지: milk formula, moist and soft wear
- Hwahae aggregate/review samples: hydrating/moisturizing/oily signals and explicit dewy/rich descriptions

`tone_up`

- previous: `reviewed_not_established`
- current: `established = true`
- confidence: medium

근거:

- Hwahae aggregate: Evens Out Skin Tone
- repeated recent/long-term review samples: subtle/natural brightening

### MIN JUNG GI Physical Sun Block

`finish`

- previous: `reviewed_not_established`
- current: `established = soft_matte`
- confidence: medium

근거:

- Hwahae aggregate: Matte Finish 115 / Not Oily 340 / Soft and Airy 126
- repeated review samples: matte, very matte, powdery and drying finish

### HOLD 유지

Dr. Troub Zinc Physical:

`finish = reviewed_not_established`

Bio Repair + Suncream:

`finish = reviewed_not_established`

둘은 glow/oily/dewy/natural/dry 묘사가 섞여 있어
현재 근거만으로 단일 finish enum을 확정하지 않는다.

## Neutral current-scorer authority contract

현재 neutral sunscreen score에서 cross-cohort 비교 전에 반드시 established여야 하는 semantic:

1. category_slot
2. uv_filter_type
3. finish
4. tone_up

sensitivity / white-cast / eye / pilling은 neutral request에서는
해당 score/hard-reject axis가 활성화되지 않는다.

skin_types / concerns는 one-sided positive authority다.
neutral context에서는 match request가 없으므로 비교 authority에 필요하지 않다.

## 신규 authority-complete subset

Production readback 이후:

| product | finish | tone_up | neutral comparable |
|---|---|---:|---|
| Physical Daily Sunmilk | dewy | true | YES |
| MIN JUNG GI Physical Sun Block | soft_matte | true | YES |
| Jojoba Suncream | natural | true | YES |
| Dr. Troub Zinc Physical | unknown | true | HOLD |
| Bio Repair + Suncream | unknown | true | HOLD |

결과:

`3 / 5` 신규 제품이 neutral mixed scorer에 진입 가능.

## Mixed baseline

legacy frozen sunscreen:

`11`

new authority-complete:

`3`

mixed baseline:

`14`

이번에는 finish/tone-up mask를 사용하지 않는다.
14개 모두 해당 request에서 실제로 사용되는 semantic authority를 가진 상태에서
기존 `filterSunscreenCandidates()` + `scoreSunscreenProduct()`를 그대로 사용한다.

neutral baseline top-set은 기존 legacy control top-set과 동일하다.

- ROUNDLAB Birch Moisture Sun Cream
- La Roche-Posay Anthelios
- ANESSA Perfect UV Milk
- Dr.G Green Mild Up Sun+

즉 신규 subset 도입을 위한 shadow에서
legacy neutral baseline을 왜곡하지 않는다.

## SPF authority

14개 comparable mixed subset에서:

`SPF bucket authority = 14 / 14`

SPF-only protection shadow를 적용해도 neutral top-set은 유지된다.

판정:

`spfMixedRankingSafe=true`

이 결과는 SPF Production activation 승인이 아니다.
D4 SPF review에 넘길 수 있는 비교 근거가 생겼다는 뜻이다.

## UVA authority

14개 mixed subset에서:

`UVA bucket authority = 12 / 14`

missing:

- La Roche-Posay Anthelios
- SKIN1004 Hyalu-Cica Water-Fit Sun Serum UV

naive UVA shadow에서 missing authority를 +0으로 처리하면
La Roche-Posay가 기존 top-set에서 탈락한다.

즉:

`missing UVA authority != low UVA protection`

따라서 현재 UVA를 그대로 ranking delta로 쓰면
missing을 사실상 낮은 보호력으로 취급하는 효과가 생긴다.

판정:

`uvaMixedRankingSafe=false`

## D3R3 결론

`AUTHORITY_COMPLETE_SUBSET_READY_SPF_COMPARABLE_UVA_HOLD`

의미:

- neutral legacy/new baseline comparability: READY, 단 authority-complete 3종 subset
- SPF authority coverage in comparable subset: COMPLETE
- SPF-only shadow top-set invariance: PASS
- UVA authority coverage: INCOMPLETE
- UVA activation evidence: HOLD
- Water: HOLD

## 다음 단계

D4를 axis-specific으로 분리한다.

### D4-SPF

review candidate.

검증해야 할 것:

- SPF delta가 hard reject 뒤에만 적용되는지
- legacy order invariant 범위
- new subset rank-shift 범위
- explicit outdoor intent only
- instant rollback / flag boundary
- Production activation은 별도 D5 승인

### D4-UVA

HOLD.

먼저 LRP / SKIN1004 UVA authority recovery 또는
missing-authority exclusion policy가 필요하다.

### D4-Water

계속 HOLD.

## 불변

- Product row mutation = false
- generic admission policy change = false
- Production candidate admission wiring = false
- Production ranking change = false
- productionCutoverAuthorized = false
- outdoorRankableSignalAuthorized = false
- publicActivation = false
- water resistance applied = false
