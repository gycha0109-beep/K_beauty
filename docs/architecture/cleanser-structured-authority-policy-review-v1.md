# Cleanser Structured Authority Policy Review v1

## 1. 상태와 결론

```text
Policy semantics:
STRUCTURED_POSITIVE_AUTHORITY_REVIEWABLE

Operational readiness:
BLOCKED_ADMIN_CONTRACT

Penalty:
EXISTING_PENALTY_NEEDS_RECALIBRATION

Overall:
POLICY_REVIEW_COMPLETE_NO_ACTIVATION
```

이번 검토는 `cleansing_profile`을 Production scorer에 활성화하지 않는다. 권장 계약은 **P2 — Structured-positive only**다.

```text
cleansing_profile === "deep_clean"
→ structured positive authority

그 외
→ 기존 heuristic 결과 유지

null / absent / invalid
→ heuristic fallback + aggregate observability + review required
```

`low_ph`와 `balanced`는 `not deep_clean`의 확정 근거가 아니다. 현재 enum은 pH, 역할, 세정감, 강도, 목적을 혼합하고 있으므로 완전한 상호배타적 cleansing-strength taxonomy로 취급할 수 없다.

이번 변경은 CandidateExposurePolicy activation이 아니다. 향후 별도 activation 구현은 기존 active scorer의 `redness-deep-clean` **detection authority**만 바꾸며, CandidateExposurePolicy는 계속 ranking authority가 아니다.

## 2. 검토 범위와 기준선

- Repository: `gycha0109-beep/K_beauty`
- Branch: `feature/recommendation-metadata-transport-shadow`
- Draft PR: `#167`
- Baseline main: `4202bd2c9a83f276436e226aee9d9bbc9ace2a8f`
- Review baseline head: `ba6741c2ae0685d50a607456404177664902b332`
- Products fixture: `e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856`
- Scenario fixture: `7aa02ed3f1a264a67aee3d97c916b4a955a713fdbb173844d1727e9cfb1c918e`
- Products: 164
- Cleansers: 26
- Scenarios: 12
- Existing product-policy delta rows: 1,908
- New cleanser policy rows: 1,248 (`26 × 12 × 4`)
- Adversarial fixtures: 12
- Production mutation: 0

Read-only DB drift 확인 결과는 fixture와 다음 범위에서 일치했다.

- 전체 제품 수: 164
- category별 제품 수: fixture와 동일
- cleanser 수: 26
- cleanser `cleansing_profile`: `low_ph 10 / balanced 7 / deep_clean 9 / null 0`
- ordered product ID identity fingerprint: fixture와 동일
- DB latest `updated_at`: fixture export timestamp와 동일

DB export나 fixture overwrite는 수행하지 않았다.

## 3. 현재 Production 동작

현재 `lib/skin-match-decision-engine.js`의 `isDeepCleanser()`는 제품 ID, 이름, notes, standout reason을 하나의 문자열로 합친 뒤 다음 문자열을 검색한다.

```text
deep clean
pore deep
clarified finish
perfect whip
```

redness score가 18 이상이고 heuristic이 true이면 `getHardPenalty()`가 `-18`을 반환한다.

중요한 의미:

```text
-18
→ 후보 제거가 아님
→ score 합산식에 들어가는 음수값
```

따라서 이 문서에서는 이를 hard gate 또는 candidate exclusion으로 표현하지 않는다. 함수명은 `getHardPenalty()`지만 실제 동작은 additive score penalty다.

## 4. Metadata authority 근거

### 4.1 Coverage

현재 26개 cleanser의 coverage는 100%다.

| 값 | 제품 수 |
|---|---:|
| `low_ph` | 10 |
| `balanced` | 7 |
| `deep_clean` | 9 |
| `null` | 0 |
| invalid | 0 |

DB에는 `products_cleansing_profile_check`가 존재하며 허용값을 `low_ph`, `balanced`, `deep_clean`으로 제한한다. 컬럼은 nullable이고 default와 column comment는 없다.

### 4.2 Provenance 한계

현재 DB row 수준에서는 다음 근거가 확인된다.

- 26개 모두 review, ingredient, market aggregate signal 존재
- 16개는 external source와 source URL 존재
- 10개는 external source와 source URL 부재
- 일부 제품은 Hwahae product identity와 연결됨

그러나 `cleansing_profile` **필드 자체**에 대해 다음 정보는 저장돼 있지 않다.

- 어떤 공식 설명 또는 리뷰 근거로 값이 결정됐는지
- 누가 검토했는지
- 어떤 rubric/version으로 분류했는지
- conflicting evidence가 있었는지
- field-level confidence
- reviewed timestamp와 lineage

따라서 `DB에 값이 있다`는 사실만으로 full enum authority를 승인할 수 없다. 현재 근거가 지지하는 범위는 `deep_clean`의 positive detection 보강까지다.

### 4.3 Heuristic의 목적과 한계

기존 heuristic은 소수의 영어 문자열에 의존한다.

현재 catalog에서는:

```text
structured deep_clean: 9
heuristic true: 0
structured positive / heuristic negative: 9
heuristic positive / structured non-deep: 0
```

즉 현재 제품명과 메타데이터 표현을 충분히 포착하지 못한다. 특히 한글 제품명, spacing, 번역, notes 미존재, 이름 변형에 취약하다.

반면 heuristic은 metadata가 없을 때도 문자열 단서가 있으면 작동한다. Admin v1 기간의 null/absent 제품을 완전히 fail-open으로 만들지 않는 보호 역할은 유지할 가치가 있다.

## 5. Enum 의미 판정

### `deep_clean`

**positive authority only**

`deep_clean`은 현재 enum 중 기존 `redness-deep-clean` detection과 의미적으로 직접 연결되는 유일한 값이다. 9개 현재 제품 모두 heuristic false negative였고, 구조화 positive를 사용하면 이 누락을 보완한다.

단, field-level provenance가 완전하지 않으므로 실제 activation 전에는 현재 9개 값에 대한 승인된 review snapshot이 필요하다.

### `low_ph`

**not non-deep authority**

`low_ph`는 pH 특성이다. 낮은 pH와 강한 세정력, 흡착, 각질 제거, 높은 세정 목적은 동시에 존재할 수 있다.

금지되는 해석:

```text
low_ph → gentle
low_ph → low irritation
low_ph → not deep_clean
```

### `balanced`

**not non-deep authority**

`balanced`는 현재 계약에서 pH, 세정감, 사용 목적, 강도 중 무엇을 의미하는지 고정돼 있지 않다.

금지되는 해석:

```text
balanced → moderate strength
balanced → safe for redness
balanced → not deep_clean
```

### 전체 enum

**insufficient semantic contract for full enum authority**

현재 enum은 완전한 mutually exclusive cleansing-strength taxonomy가 아니다. 따라서 P1과 P3처럼 `low_ph`와 `balanced`로 heuristic positive를 무효화하는 정책은 승인하지 않는다.

장기 schema 후보는 별도 단계에서 다음처럼 축을 분리해야 한다.

```text
ph_profile
cleansing_strength
cleansing_use_cases[]
physical_exfoliation
```

P2는 `deep_clean` positive만 사용하므로 이 migration을 방해하지 않는다.

## 6. 비교 정책

| 정책 | Detection | 핵심 장점 | 핵심 위험 | 판정 |
|---|---|---|---|---|
| P0 | heuristic only | 현재 Production과 동일 | 9/9 false negative | 기준선 |
| P1 | valid enum full authority, null/invalid heuristic fallback | metadata가 완전한 taxonomy라면 단순 | `low_ph/balanced`를 non-deep으로 과해석 | 비권장 |
| P2 | `structuredDeep || heuristicDeep` | positive 누락 보완, non-deep 과해석 없음, absence fallback | heuristic false positive를 structured non-deep으로 교정 불가 | **권장** |
| P3 | valid enum only, absence unknown/no penalty | heuristic 의존 제거 | metadata absence가 fail-open, Admin v1 신규 제품 보호 상실 | 비권장 |

## 7. 현재 catalog 결과

현재 catalog에는 null, invalid, heuristic positive가 없으므로 P1, P2, P3는 수치상 동일하다. 이 동일성은 정책 의미가 동일하다는 뜻이 아니다.

### Aggregate

| 항목 | P0 | P1 | P2 | P3 |
|---|---:|---:|---:|---:|
| deep detected products | 0 | 9 | 9 | 9 |
| newly detected products | 0 | 9 | 9 | 9 |
| penalty product-scenario rows | 0 | 36 | 36 | 36 |
| affected unique products | 0 | 9 | 9 | 9 |
| Top Pick changed scenarios | 0 | 0 | 0 | 0 |
| Top 3 changed scenarios | 0 | 0 | 0 | 0 |
| mean score delta, all 312 rows | 0 | -2.0769 | -2.0769 | -2.0769 |
| largest adverse score delta | 0 | -18 | -18 | -18 |
| mean absolute rank movement | 0 | 0.0833 | 0.0833 | 0.0833 |
| max absolute rank movement, all products | 0 | 3 | 3 | 3 |
| largest penalized-product rank drop | 0 | 2 | 2 | 2 |

`max absolute rank movement = 3`은 penalty를 받은 제품의 하락뿐 아니라 다른 제품이 위로 이동한 결과도 포함한다. penalty 대상 제품 자체의 최대 하락은 2단계다.

### Scenario 영향

실질 score 또는 rank 변화:

```text
U5
U6
U8
U9
```

변화 없음:

```text
U1
U2
U3
U4
U7
U10
U11
U12
```

redness 조건이 없는 scenario의 score delta는 정확히 0이다. cleanser 외 category 변화도 0이다.

### Top Pick / Top 3

- Top Pick 변경: 0/12 scenario
- Top 3 구성 변경: 0/12 scenario
- penalty 적용 후 Top 3에 남는 deep-clean 제품: 0
- U1에서 deep-clean 제품이 기존 Top 3에 존재하지만 redness 조건이 없어 penalty는 0

### Rank 변화

- penalty 적용 row: 36
- penalty가 적용됐지만 rank가 변하지 않은 row: 27
- 모든 redness scenario에서 rank가 항상 변하지 않은 deep-clean 제품: 6/9
- 최대 penalty 대상 하락: 2단계
- 최대 전체 절대 이동: 3단계

### Margin

- 전체 cleanser adjacent legacy score 최소 margin: 0
- exact tie: 17개
- 최소 positive adjacent margin: 0.1
- redness scenario 최소 adjacent margin: 0.1
- 최소 Top 1 / Top 2 margin: 0.2

현재 결과는 Top Pick과 Top 3가 안정적이지만, score ordering에 작은 margin과 tie가 존재한다. 따라서 12개 corpus의 무변화만으로 `-18` magnitude가 보편적으로 calibration됐다고 결론낼 수 없다.

## 8. Adversarial fixture 결과

`penaltyApplied`는 모든 fixture에서 redness condition이 active라고 가정한다.

표기:

```text
D = deepDetected
P = penaltyApplied
F = fallbackUsed
U = unknown
I = invalid
R = reviewRequired
```

| Fixture | 조건 | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|
| A | deep_clean / heuristic false | D0 P0 | D1 P1 | D1 P1 | D1 P1 |
| B | deep_clean / heuristic true | D1 P1 | D1 P1 | D1 P1 | D1 P1 |
| C | low_ph / heuristic true | D1 P1 R1 | D0 P0 R1 | D1 P1 R1 | D0 P0 R1 |
| D | balanced / heuristic true | D1 P1 R1 | D0 P0 R1 | D1 P1 R1 | D0 P0 R1 |
| E | low_ph / heuristic false | D0 P0 | D0 P0 | D0 P0 | D0 P0 |
| F | balanced / heuristic false | D0 P0 | D0 P0 | D0 P0 | D0 P0 |
| G | null / heuristic true | D1 P1 U1 | D1 P1 F1 U1 | D1 P1 F1 U1 | D0 P0 U1 |
| H | null / heuristic false | D0 P0 U1 | D0 P0 F1 U1 | D0 P0 F1 U1 | D0 P0 U1 |
| I | invalid / heuristic true | D1 P1 I1 | D1 P1 F1 I1 | D1 P1 F1 I1 | D0 P0 I1 |
| J | invalid / heuristic false | D0 P0 I1 | D0 P0 F1 I1 | D0 P0 F1 I1 | D0 P0 I1 |
| K | absent / heuristic true | D1 P1 U1 | D1 P1 F1 U1 | D1 P1 F1 U1 | D0 P0 U1 |
| L | absent / heuristic false | D0 P0 U1 | D0 P0 F1 U1 | D0 P0 F1 U1 | D0 P0 U1 |

정확한 `authoritySource`, `fallbackUsed`, `unknown`, `invalid`, `reviewRequired`는 machine-readable evidence에 모두 기록한다.

### 정책별 adversarial 해석

- P1은 C와 D에서 heuristic positive를 무효화한다. 현재 enum 의미로는 과도한 non-deep authority다.
- P2는 A의 false negative를 보완하고 C/D의 heuristic positive를 유지한다.
- P2는 G/I/K에서 heuristic fallback으로 Admin v1 metadata absence를 fail-open으로 만들지 않는다.
- P2는 향후 heuristic false positive를 `low_ph/balanced`로 교정할 수 없다. 이는 현재 schema 의미가 불충분한 상태에서 의도한 보수적 제한이다.
- P3는 G/I/K에서 penalty를 제거하므로 metadata absence가 안전 fail-open으로 작동한다.

## 9. 기존 `-18` 판정

```text
EXISTING_PENALTY_NEEDS_RECALIBRATION
```

### 의미적으로 유효한 부분

redness burden이 높은 사용자에게 deep-cleansing 목적 제품의 우선순위를 낮추는 정책 의도는 현재 reason code와 일치한다. 기존 penalty를 structured positive detection에 적용하는 것은 완전히 다른 의미의 penalty를 새로 만드는 것은 아니다.

### calibration이 부족한 부분

repository에서 `-18`의 최초 설계 근거, calibration corpus, 승인 문서, policy version을 확인하지 못했다.

현재 동일 score scale의 주요 값:

| 항목 | 값 |
|---|---:|
| priority slot hero boost | +16 |
| Perfect Whip hero boost | +14 |
| toner-pad hero boost | +12 |
| moisturizer / calming serum hero boost | +10 |
| redness deep-clean penalty | -18 |
| weak-barrier toner penalty | -16 |
| dehydration soft-matte penalty | -14 |
| high-sensitivity irritation penalty | -22 |

`-18`은 단순 보정값이 아니라 priority-slot `+16`을 상쇄하고도 남는 큰 값이다. 현재 corpus에서는 Top Pick/Top 3 churn이 없었지만, scenario 수와 margin 분포만으로 magnitude를 승인할 수 없다.

### Activation 계약

detection source의 정책 승인은 가능하지만, `-18` 재사용은 다음 별도 검증을 요구한다.

- 정책 버전 고정
- 현재 12개 corpus 회귀
- 추가 redness/deep-clean edge corpus
- Preview/shadow에서 Top Pick·Top 3 churn 검토
- 승인된 churn과 unexpected churn 분리
- score scale 변경 시 재검토

이번 단계에서는 값을 변경하지 않는다.

## 10. Null, invalid, absent, legacy 처리 계약

| 상태 | P2 처리 | Observability | 운영 상태 |
|---|---|---|---|
| valid `deep_clean` | structured positive OR heuristic | structured positive count/conflict | authority 가능 |
| valid `low_ph` | heuristic 유지 | non-positive structured value | non-deep authority 아님 |
| valid `balanced` | heuristic 유지 | non-positive structured value | non-deep authority 아님 |
| null | heuristic fallback | unknown + fallback | review required |
| invalid enum | heuristic fallback | invalid + fallback | review required |
| field absent | heuristic fallback | unknown + fallback | review required |
| Admin v1 imported product | field absent 가능, heuristic fallback | Admin-origin unknown | metadata review 필요 |
| legacy historical snapshot | 저장 당시 결과 유지 | 신규 authority 재판정 금지 | 재열람 불변 |

금지:

```text
null → balanced
invalid → non-deep
low_ph → gentle
balanced → moderate
unknown → safe
```

## 11. Admin 운영 계약

PR #166의 Admin Product Review v1 reviewed input과 confirm payload는 다음 필드를 처리한다.

```text
skin_types
concerns
texture
finish
irritation_risk
sensitivity_safe
```

`cleansing_profile`은 reviewed header, field-evidence requirement, promotion payload에 없다. 따라서 신규 cleanser는 review/confirm을 통과해도 `cleansing_profile`이 absent 또는 null일 수 있다.

### 질문에 대한 답

```text
Admin v2가 P2 의미 안전성의 절대 선행 조건인가?
→ 아니다. null/absent/invalid가 heuristic fallback이므로 P3와 같은 fail-open은 피한다.

Admin v2 또는 동등한 metadata review gate가 지속 운영 activation의 선행 조건인가?
→ 그렇다.
```

P2는 Admin v1 기간을 **제한적으로 견딜 수 있다**. 그러나 신규 deep-clean 제품이 heuristic에도 누락되면 구조화 positive 보완이 작동하지 않는다. 현재 Admin v1에는 이를 review-required 또는 primary eligibility 제한으로 연결하는 계약이 없다.

따라서 현재 운영 판정은:

```text
BLOCKED_ADMIN_CONTRACT
```

해제 방법은 다음 중 하나다.

1. Admin v2가 cleanser에 `cleansing_profile`, field evidence, confidence, reviewer, policy version을 입력·검증한다.
2. 동등한 pre-publish gate가 신규 cleanser의 metadata review 완료를 강제한다.
3. 제한 activation 동안 catalog를 고정하고 신규 cleanser를 activation cohort에 포함하지 않는다.

3번은 제한된 검증 수단이지 장기 운영 계약이 아니다.

## 12. 권장 authority 정책

```text
policyVersion = cleanser-structured-positive-authority-v1

structuredDeep =
  cleansing_profile === "deep_clean"

legacyDeep =
  existing isDeepCleanser heuristic

deepDetected =
  structuredDeep || legacyDeep
```

### Conflict contract

| Structured | Heuristic | 처리 |
|---|---|---|
| deep_clean | false | 승인 가능한 structured-positive enrichment |
| deep_clean | true | corroborated positive |
| low_ph/balanced | true | unapproved conflict, heuristic 유지 + review required |
| null/absent/invalid | true | fallback positive + review required |
| null/absent/invalid | false | unknown + review required |

`low_ph/balanced + heuristic=true`는 자동으로 어느 한쪽을 정답 처리하지 않는다. P2는 사용자 보호를 위해 heuristic positive를 유지하되 운영 검토 대상으로 분류한다.

## 13. Activation 전제조건

실제 activation 구현은 별도 작업이며 다음 조건을 모두 machine-verifiable하게 충족해야 한다.

### Data

- activation cohort의 cleanser metadata coverage = 100%
- invalid enum = 0
- unknown metadata = 0
- current approved conflict type는 `structured deep_clean / heuristic false`만 허용
- `structured low_ph|balanced / heuristic true` = 0 또는 제품별 승인 evidence 존재
- products fixture digest = `e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856`
- scenario fixture digest = `7aa02ed3f1a264a67aee3d97c916b4a955a713fdbb173844d1727e9cfb1c918e`

### Policy and engine identity

- policyVersion 고정
- active engine version 고정
- penalty policy version 고정
- fixture/scenario corpus version 기록
- exact-head source SHA 기록

### Regression

- 12개 corpus에서 non-redness scenario score delta = 0
- cleanser 외 category fingerprint 변화 = 0
- public response schema 변화 = 0
- explanation/persistence/reentry semantic hash 변화 = 0
- CandidateExposurePolicy fingerprint 변화 = 0
- actual rank change는 승인된 cleanser policy effect 외 0

### Operations

- Admin v2 또는 동등한 pre-publish metadata gate
- aggregate-only observability
- structured authority kill switch
- legacy heuristic 즉시 복귀 경로
- shadow comparison 유지
- Preview 또는 제한 cohort 검증
- saved-report compatibility 확인
- raw user/image/survey/product row telemetry 금지

## 14. Observability 계약

Production telemetry는 aggregate-only다.

필수 dimension:

```text
policyVersion
engineVersion
catalogSnapshotVersion
```

필수 metric:

```text
productsEvaluated
structuredDeepCount
heuristicDeepCount
structuredOnlyDeepCount
heuristicOnlyDeepCount
metadataConflictCount
metadataUnknownCount
metadataInvalidCount
fallbackUsedCount
penaltyAppliedCount
topPickChangedCount
top3ChangedCount
maxRankDelta
```

추가 권장 metric:

```text
unapprovedConflictCount
runtimeExceptionCount
nonRednessDeltaCount
nonCleanserFingerprintChangeCount
publicResponseInvariantViolationCount
persistenceInvariantViolationCount
```

금지:

- 사용자 ID
- 사진
- raw survey text
- session token
- cookie
- 제품 전체 row
- review 원문
- ingredient 원문
- 외부 URL
- raw recommendation response
- 제품명 단위 Production telemetry

제품 단위 debugging은 제한된 offline evidence 또는 bounded diagnostic에서만 수행한다.

## 15. 중단과 rollback 기준

다음 중 하나라도 발생하면 activation을 중단하고 structured authority를 비활성화한다.

- invalid metadata 발견
- activation cohort coverage가 승인 baseline보다 감소
- 승인되지 않은 heuristic-only positive 발생
- `structured low_ph|balanced / heuristic deep` 충돌 발생
- non-redness scenario score 변화
- cleanser 외 category fingerprint 변화
- public response schema 또는 semantic response 변화
- persistence/reentry semantic hash 변화
- CandidatePolicy fingerprint 변화
- 승인되지 않은 Top Pick 또는 Top 3 churn
- runtime exception
- fallback count가 승인 baseline보다 증가
- policy/engine/fixture version 불일치

Rollback 동작:

```text
structured authority off
→ legacy heuristic 복귀
→ shadow comparison은 유지
→ aggregate incident evidence 보존
→ 제품 단위 분석은 offline diagnostic으로 분리
```

Rollback은 score를 임의 보정하거나 metadata를 `balanced`로 덮어쓰지 않는다.

## 16. CandidatePolicy 관계

CandidateExposurePolicy는 현재:

```text
shadow-only
Production hard-disabled
ranking authority 아님
```

Cleanser structured authority activation은 CandidateExposurePolicy activation이 아니다.

향후 cleanser activation에서는 CandidatePolicy가 사후 fingerprint observer로 다음을 계속 확인해야 한다.

- candidate order fingerprint
- public response fingerprint
- persistence fingerprint
- policy-off legacy parity
- policy-on approved delta 범위

CandidatePolicy 코드와 activation 상태는 이번 작업에서 변경하지 않는다.

## 17. Production 불변성

이번 정책 리뷰에서 다음은 변경되지 않는다.

```text
actual score
actual rank
actual Top Pick
actual Top 3
actual alternatives
actual explanation
public response
persistence
reentry
CandidatePolicy fingerprint
```

새 evidence와 verifier는 Production route/scorer에서 import되지 않는다.

## 18. 최종 판정

### Policy semantics

```text
STRUCTURED_POSITIVE_AUTHORITY_REVIEWABLE
```

`deep_clean` positive는 구조화 authority로 검토 가능하다. `low_ph`와 `balanced`는 non-deep authority가 아니다. null, absent, invalid는 heuristic fallback이다.

### Operational readiness

```text
BLOCKED_ADMIN_CONTRACT
```

P2는 Admin v1 기간을 fail-open 없이 제한적으로 견딜 수 있지만, 신규 cleanser metadata의 생성·검수·증거·version 계약이 없으므로 지속 운영 activation은 승인하지 않는다.

### Penalty

```text
EXISTING_PENALTY_NEEDS_RECALIBRATION
```

현재 `-18`은 후보 제거가 아니며, 의미는 유지 가능하지만 magnitude의 최초 설계 근거와 calibration evidence가 부족하다.

### Overall

```text
POLICY_REVIEW_COMPLETE_NO_ACTIVATION
```

다음 순서만 허용한다.

```text
정책 승인
→ Admin 또는 동등한 운영 계약 충족
→ -18 calibration 검토
→ 별도 activation implementation
→ Preview/제한 검증
→ Production 활성화 여부 결정
```
