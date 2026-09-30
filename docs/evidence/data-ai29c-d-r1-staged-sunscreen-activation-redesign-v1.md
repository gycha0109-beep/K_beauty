# DATA-AI29C-D-R1 — Sunscreen Activation Redesign

## 결론

DATA-AI29C-D는 기존의 단일 `all protection gates pass → activation` 구조를 폐기하고, 아래 5단계로 분리합니다.

```
D0  Protection Axis Readiness
D1  Sunscreen Recommendation Semantic Authority
D2  Sunscreen Initial Admission Authority
D3  Integrated Recommendation + Protection Shadow
D4  Axis-specific Activation Review
D5  Bounded Production Activation
```

현재 상태는 **D0 PASS / D1 BLOCKED**입니다.

SPF/UVA가 prospective corpus에서 이미 `READY_FOR_SHADOW_SCORING`이어도 신규 catalog-only 제품은 Recommendation corpus에 자동 진입하지 않습니다.

## 왜 재설계가 필요한가

C6 이후 canonical sunscreen corpus는 20개이고:

- SPF: 18/20, 90%, 3 scoring buckets
- UVA: 16/20, 80%, 3 scoring buckets
- Subject ambiguity: 0
- Water: 0/20

따라서 SPF/UVA 자체는 discrimination 가능한 축입니다.

하지만 실제 Production Recommendation sunscreen corpus는 11개이고, deployed protection shadow는 여전히:

- readyAxes = []
- enabledAxes = []
- ranking delta = 0

입니다.

두 상태는 모순이 아닙니다.

```
Product Fact corpus readiness
!= Recommendation admission readiness
!= Production rank activation
```

## 기존 admission이 신규 sunscreen을 받을 수 없는 이유

현재 canonical initial admission policy `initial-admission-grant-policy-v1`은 sunscreen을
`INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT`로 분류합니다.

기존 G2 path는 exfoliation PDA를 가진 treatment / toner_essence / toner_pad 전용입니다.

따라서 D에서는 G2를 억지 확장하지 않고 sunscreen 전용 권위를 별도로 둡니다.

Target authority:

`SUNSCREEN_INITIAL_ADMISSION_GRANT`

Target policy:

`sunscreen-initial-admission-grant-policy-v1`

향후 runtime 합성은 다음 형태입니다.

```
LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1 member
OR valid INITIAL_ADMISSION_GRANT
OR valid SUNSCREEN_INITIAL_ADMISSION_GRANT
→ existing Recommendation candidate pipeline
```

이 단계에서도 Grant는 rank/safety/approval을 의미하지 않습니다.

## D1 — Sunscreen Recommendation Semantic Authority

C6 primary 5종은 현재 Product Fact protection authority는 있지만 Recommendation scorer용 필드가 없습니다.

Production readback 기준 5종 모두 다음 raw Product fields가 null입니다.

- category
- skin_types
- concerns
- texture
- finish
- sensitivity_safe
- irritation_risk
- tone_up
- white_cast
- eye_sting
- pilling_risk

추가로 `uv_filter_type` Product Fact는 5종 중 3종만 established 상태입니다.

이 상태에서 admission을 먼저 허용하면 scorer의 기존 null semantics 때문에 unknown 정보가 하드리젝트/페널티 없이 흘러갈 수 있습니다. 이를 금지합니다.

새 authority:

`sunscreen-recommendation-semantic-bundle-v1`

각 필드는 최소한 아래 상태 중 하나를 가져야 합니다.

- established
- reviewed_not_established
- conflict
- not_reviewed

v1 initial admission에서는 **required field 전부 established**만 허용합니다.

raw Product null은 `reviewed_not_established`가 아닙니다.

`missing != false`를 그대로 유지합니다.

### Required semantic bundle

- category_slot
- skin_types
- concerns
- texture
- finish
- uv_filter_type
- sensitivity_safe
- irritation_risk
- tone_up
- white_cast
- eye_sting
- pilling_risk

이 bundle은 Product row를 덮어쓰는 것이 아니라 runtime projection authority입니다.

## D2 — Sunscreen Initial Admission Authority

Positive Grant 최소 조건:

1. canonical product UUID
2. `catalog-taxonomy-v1:category:sunscreen` governed assignment
3. resolved/current Product Fact Subject
4. supported/current/product_specific_primary SPF
5. supported/current/product_specific_primary UVA
6. supported/current/product_specific_primary UV filter type
7. complete `sunscreen-recommendation-semantic-bundle-v1`
8. no stale/conflicting authority

Water resistance는 **sunscreen admission의 필수 조건이 아닙니다.**

즉 SPF/UVA activation path와 Water activation path를 분리합니다.

## D3 — Integrated Shadow

D2 Grant를 받은 신규 sunscreen만 existing recommendation scorer에 projection합니다.

중요한 규칙:

- raw catalog-only Product를 직접 scorer에 넣지 않음
- Recommendation semantic bundle에서 category/사용감/안전축을 projection
- Product Fact authority에서 SPF/UVA/UV filter를 projection
- 기존 baseline scorer는 변경하지 않음
- protection delta는 `outdoor_exposure=true`일 때 SPF/UVA ready axis만 적용
- non-outdoor protection delta = 0
- water delta = 0
- rejected candidate resurrection 금지

## D4 — Axis-specific Activation Review

기존 `allProtectionGatesPass`를 Production activation의 단일 조건으로 사용하지 않습니다.

Activation unit을 axis로 변경합니다.

현재 후보:

- SPF → eligible after D3 acceptance
- UVA → eligible after D3 acceptance
- Water → HOLD

SPF/UVA는 Water 0% 때문에 자동으로 막히지 않습니다.

단, D3 integrated shadow를 통과하기 전에는 `outdoor_exposure`를 Production rankable signal로 승격하지 않습니다.

## D5 — Production Activation

별도 수동 승인 이후에만 가능합니다.

필수:

- feature flag
- immediate rollback path
- exact deployment evidence
- no legacy behavior regression
- no rejected candidate resurrection
- no safety/penalty semantic unknowns
- activation axis allowlist = SPF/UVA
- Water disabled

현재:

```
productionCutoverAuthorized = false
outdoorRankableSignalAuthorized = false
recommendationAdmissionMutated = false
productionRankingChanged = false
```

## 다음 실제 작업

`DATA-AI29C-D1-SUNSCREEN-SEMANTIC-AUTHORITY`

C6 primary 5종의 scorer-compatible semantic bundle을 governed evidence/review 기반으로 구축합니다.

이 작업이 끝나기 전에는 D2 admission implementation을 시작하지 않습니다.
