# Recommendation Follow-up Policy Review v1

## 1. 결론

```text
Recommendation-side status:
RECOMMENDATION_SIDE_READY_WAITING_ADMIN_CONTRACT

Cleanser penalty:
PENALTY_REQUIRES_MORE_EVIDENCE

Balm:
BALM_CANDIDATE_A_REVIEWABLE
NEEDS_BALM_ADMIN_CONTRACT
NEEDS_ROLE_SCHEMA_REVIEW
DO_NOT_ACTIVATE

Sunscreen:
CURRENT_CATALOG_NOOP_POLICY_REVIEWABLE
ADMIN_V2_REQUIRED
NEEDS_SUNSCREEN_COMPLETENESS_CONTRACT
DO_NOT_ACTIVATE
```

이번 검토는 `Recommendation Metadata Transport Shadow` 위에서 추천 엔진이 Admin과 독립적으로 완료할 수 있는 R1~R5를 닫는다. 실제 scorer, candidate eligibility, Top Pick, public response, persistence, Admin, DB, deployment는 변경하지 않는다.

## 2. 원격 기준선과 책임 경계

- Repository: `gycha0109-beep/K_beauty`
- main: `4202bd2c9a83f276436e226aee9d9bbc9ace2a8f`
- Branch: `feature/recommendation-metadata-transport-shadow`
- Review base: `f569e983ad700c07c0957f2a6ae09074ea483ff0`
- Draft PR: `#167`
- Products: 164
- Scenarios: 12
- Existing product-policy rows: 1,908
- Cleanser policy evidence: 26 products × 12 scenarios × 4 authority policies

Recommendation 계보가 소유하는 범위:

- metadata transport와 shadow evidence
- ranking/penalty policy review
- deterministic offline comparison
- activation consumer contract
- 향후 recommendation runtime activation과 배포 검증

이번 검토가 소유하지 않는 범위:

- Admin CSV/parser/dry-run/confirm/UI/audit
- Admin migration/RPC
- reviewer identity와 raw evidence
- 기존 catalog field-level re-review

2026-08-05 원격 감사 시 Cleanser Metadata Admin Contract v2 PR은 존재하지 않았다. `#166`은 Admin Product Review v1 통합이며 cleanser field-level authority 계약을 제공하지 않는다.

## 3. R1 — #167 범위 판정

`#167`은 다음 foundation/evidence 범위에 머문다.

- nullable recommendation metadata transport
- current-product metadata transport
- shadow evaluator
- 164-product fixture와 12-scenario corpus
- offline legacy/shadow replay
- cleanser authority, penalty, balm, sunscreen policy evidence
- Production import-boundary와 result invariance verifier

금지 경계는 유지한다.

- actual scorer activation 0
- actual candidate eligibility mutation 0
- public API/persistence mutation 0
- Admin implementation 0
- migration/DB write 0
- feature flag activation 0
- Preview/Production deployment 0

## 4. R2 — Cleanser `-18` penalty calibration

### 4.1 비교 후보

| 후보 | 적용값 |
|---|---:|
| P0 | 0 |
| P8 | -8 |
| P12 | -12 |
| P18 | -18 |

Detection source는 승인 후보 P2 의미를 사용했다.

```text
structuredDeep = cleansing_profile === "deep_clean"
legacyDeep = existing heuristic
deepDetected = structuredDeep || legacyDeep
```

### 4.2 현재 catalog 결과

| 항목 | P0 | P8 | P12 | P18 |
|---|---:|---:|---:|---:|
| Top Pick 변화 | 0/12 | 0/12 | 0/12 | 0/12 |
| Top 3 변화 | 0/12 | 0/12 | 0/12 | 0/12 |
| 적용 row | 0 | 36 | 36 | 36 |
| 전체 cleanser mean score delta | 0 | -0.9231 | -1.3846 | -2.0769 |
| 최대 전체 rank 이동 | 0 | 3 | 3 | 3 |
| penalty 대상 최대 하락 | 0 | 2 | 2 | 2 |
| rank 불변 penalty row | 0 | 27 | 27 | 27 |
| redness 외 score delta | 0 | 0 | 0 | 0 |

현재 네 redness scenario에서 최상위 `deep_clean` cleanser는 모두 legacy rank 16이다.

| Scenario | Legacy Top 3 cutoff | 최상위 deep score | Top 3까지 gap |
|---|---:|---:|---:|
| U5 | 73.3 | 26.0 | 47.3 |
| U6 | 68.1 | 17.1 | 51.0 |
| U8 | 31.1 | 4.3 | 26.8 |
| U9 | 60.5 | 13.5 | 47.0 |

따라서 현재 catalog에서는 penalty를 0, 8, 12, 18 중 무엇으로 잡아도 Top Pick과 Top 3가 동일하다. 이는 네 후보가 동등하게 적절하다는 뜻이 아니라, 현재 corpus가 magnitude를 식별하지 못한다는 뜻이다.

### 4.3 Score scale과 margin

현재 주요 score 요소:

- priority-slot hero boost: `+16`
- Perfect Whip hero boost: `+14`
- 일반 cleanser hero boost: `+6`
- 주요 safety penalty: `-22 / -16 / -14 / -18`

Penalty 이후 hero 잔여값:

| 후보 | `+16` 잔여 | `+14` 잔여 |
|---|---:|---:|
| P8 | +8 | +6 |
| P12 | +4 | +2 |
| P18 | -2 | -4 |

`-18`은 priority-slot hero boost를 2점 초과하며 Perfect Whip boost를 4점 초과한다. 반면 P8/P12는 hero 신호를 일부 남긴다. 어느 결과가 정책적으로 정답인지에 대한 승인된 ground truth는 없다.

Adversarial margin은 다음을 증명한다.

- deep-clean 후보가 8점 앞선 경우 P8은 tie이며 기존 ordering이 deep-clean을 유지한다.
- 12점 앞선 경우 P12도 tie로 deep-clean을 유지한다.
- 16점 앞선 경우 P18만 2점 역전한다.
- 18점 앞선 경우 P18도 tie로 deep-clean을 유지한다.
- 18.1점 앞선 경우 모든 후보가 deep-clean Top Pick을 유지한다.

즉 penalty만으로 특정 제품을 항상 강등시키는 계약도 없고, 어느 margin부터 반드시 강등해야 하는지에 대한 승인 기준도 없다.

### 4.4 판정

```text
PENALTY_REQUIRES_MORE_EVIDENCE
```

필요한 추가 근거:

- redness 상태에서 허용 가능한 deep-clean Top Pick/Top3 조건
- 동일 제품의 cleansing benefit과 irritation burden을 비교한 adjudicated fixture
- 최소 demotion margin 또는 score-cap 정책
- penalty와 hero boost의 우선순위 계약
- penalty 적용 후 explanation 의미 검증

이번 단계에서는 `-18`을 유지·축소·확대 어느 쪽으로도 승인하지 않는다.

## 5. R3 — Balm primary-role policy

현재 catalog:

- `moisturizer_balm`: 20
- `is_primary_moisturizer=true`: 7
- `false`: 13
- scope: `full_face 9 / local_area 6 / body_possible 3 / eye_lip 1 / multi_area 1`

### Candidate A

```text
is_primary_moisturizer === false
→ primary moisturizer slot eligibility 제외
```

결과:

- eligibility changes: 156 rows
- Top Pick changes: 2 scenarios
- Top 3 changes: 2 scenarios

### Candidate B

```text
balm_usage_scope in [local_area, eye_lip]
→ primary moisturizer slot eligibility 제외
```

결과:

- eligibility changes: 84 rows
- Top Pick changes: 2 scenarios
- Top 3 changes: 2 scenarios
- `multi_area` non-primary balm은 U11 Top 3에 계속 남음

### 의미 판정

`balm_usage_scope`는 사용 부위이고 `is_primary_moisturizer`는 primary-role authority다. 따라서 다음 추론은 금지한다.

- `full_face` → 무조건 primary
- `multi_area` → primary 가능
- `body_possible` → 얼굴 사용 불가
- `is_primary_moisturizer=false` → 제품 전체 제거

승인 가능한 의미:

```text
is_primary_moisturizer=false
→ primary moisturizer Top Pick/Top3 역할에서만 제외
→ supporting/local/spot use에서는 제품 유지
```

최종 판정:

```text
BALM_CANDIDATE_A_REVIEWABLE
NEEDS_BALM_ADMIN_CONTRACT
NEEDS_ROLE_SCHEMA_REVIEW
DO_NOT_ACTIVATE
```

Candidate B는 보조 guard로는 유효하지만 primary authority가 될 수 없다. Balm metadata 운영 계약은 Cleanser Admin v2와 분리한다.

## 6. R4 — Sunscreen completeness

현재 11개 sunscreen coverage:

| 필드 | known |
|---|---:|
| SPF | 11/11 |
| UVA | 11/11 |
| UV filter type | 11/11 |
| white cast | 11/11 |
| eye sting | 11/11 |
| pilling risk | 11/11 |
| tone up | 11/11 |
| water resistance minutes | 1/11 |

현재 catalog에서 completeness candidate는:

- eligibility delta: 0
- Top Pick delta: 0
- Top 3 delta: 0

Virtual incomplete sunscreen fixture에서는 legacy Top Pick이었던 incomplete 후보가 candidate policy에서 제외되고 다음 완전한 sunscreen이 Top Pick이 됐다.

정책 축은 분리한다.

```text
Protection completeness:
spf_value + uva_label + uv_filter_type

Wear/preference metadata:
white_cast + eye_sting + pilling_risk + tone_up

Optional capability:
water_resistant_minutes
```

`water_resistant_minutes` unknown 또는 preference unknown을 protection incomplete로 취급하지 않는다. 반면 SPF/UVA/filter가 없거나 일부만 있는 신규 제품은 normal Top Pick eligibility를 바로 얻어서는 안 된다.

현재 11개가 complete라는 이유로 active gate를 승인할 수 없다. Admin v1은 sunscreen completeness를 신규 행 promotion 조건으로 강제하지 않는다.

최종 판정:

```text
CURRENT_CATALOG_NOOP_POLICY_REVIEWABLE
ADMIN_V2_REQUIRED
NEEDS_SUNSCREEN_COMPLETENESS_CONTRACT
DO_NOT_ACTIVATE
```

## 7. R5 — Cross-category backlog

### P0 — Fabricated fallback

현재 recommendation source는 결측값을 다음처럼 채운다.

```text
skin_types → ["combination"]
concerns → ["dehydration"]
texture → "watery"
finish → "natural"
irritation_risk → "medium"
sensitivity_safe → false
```

즉 결측과 실제 관찰값이 runtime에서 구분되지 않을 수 있다.

후속 작업:

1. fallback observability
2. nullable canonical contract
3. historical snapshot compatibility
4. Admin import missing-data policy

이번 단계에서 Production 값을 일괄 변경하지 않는다.

### P1 — Toner pad

제품 24개. 아직 구조화되지 않은 축:

- physical friction
- embossing
- wipe-off use
- exfoliation frequency

Metadata/Admin review 계약 전에는 scoring 또는 safety penalty를 추가하지 않는다.

### P1 — Treatment

제품 18개. 필요한 축:

- active identity
- active strength
- recommended frequency
- leave-on / rinse-off
- current-product active overlap

`concern match + ingredient signal + hero boost`가 같은 의미를 중복 가산할 위험이 있다.

### P1 — Score duplication audit

별도 category-level attribution에서 측정한다.

- concern match
- ingredient signal
- review signal
- hero boost
- derived metadata
- market signal

신규 score 조정은 이번 PR에 포함하지 않는다.

## 8. Admin 의존성과 activation 경계

Recommendation activation 전 Admin이 제공해야 하는 최소 의미:

- `cleansing_profile`
- review state
- schema version
- review policy version
- metadata review completeness
- conflict / unknown 상태
- 기존 26개 cleanser re-review 결과

Recommendation이 소비하지 않는 정보:

- reviewer identity/email
- raw evidence URL/body
- 전체 Admin audit

현재 상태:

```text
Cleanser Admin v2: not observed
Existing cleanser re-review: not available
Penalty magnitude: not approved
#133 engine semantic integration: required before activation
```

따라서 activation readiness:

```text
BLOCKED_ADMIN_CONTRACT
BLOCKED_CATALOG_REVIEW
BLOCKED_PENALTY_CALIBRATION
```

## 9. Integration dependency

`#133`은 `app/api/analyze/route.js`와 `lib/skin-match-decision-engine.js`를 변경한다. `#167` 자체는 active engine을 변경하지 않지만, 향후 cleanser activation은 반드시 #133의 최종 engine 의미와 current main을 먼저 반영한 최신 base에서 구현해야 한다.

`#166`은 Admin Product Review v1 foundation이며 Cleanser Metadata Admin v2를 제공하지 않는다.

이번 검토의 종료 상태:

```text
RECOMMENDATION_SIDE_READY_WAITING_ADMIN_CONTRACT
```

다음 단계는 임의의 추가 연구가 아니라:

```text
Admin v2 구현·검증 확인
→ 기존 cleanser cohort re-review 확인
→ penalty adjudication 근거 보강
→ prerequisite 병합·current-main refresh
→ 별도 activation branch
```

이다.
