# [Face Lab / Skin] S2 증거 → 정책 통합 진단 v1

> **상태:** S2 synthetic 평가 경로만 준비. 실제 피부 상태 타당성·최종 행동 안전성은 Human 평가 전 HOLD. 기준선 `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`. Scope `face-lab-skin`; Style Track 코드 수정 없음.

## 1. 목적과 소비 계약

Skin S2는 `Vision → Skin Projection → photoScore/survey/environment → SharedSkinDecisionContext v4 → Functional/Routine/Condition + cross-domain consistency → effective decision → Premium` 전 과정에서 **근거 누락이나 모순이 안전한 행동으로 둔갑하는지** 평가한다.

이미 존재하는 `skin-match-decision-engine-core.js`, `premium-decision-state.js`, `functional-policy.js`, `routine-policy.js`, `condition-policy.js`를 복제하지 않는다. 이 트랙의 추가 코드는 기존 결과를 재계산하거나 추천을 교체하지 않는 **read-only evaluator**로만 존재한다.

## 2. 진단 코드

- `scripts/facelab/skin/skin-decision-provenance-audit-core.mjs`
- `scripts/facelab/skin/verify-face-lab-skin-s2-provenance.mjs`
- `scripts/verify-current-main-health.mjs`: 기존 공통 CI에 단일 synthetic fixture verifier만 추가

함수 `inspectSkinDecisionProvenance(report)` 입력은 기존 canonical report/freeResult/scoring/decisionBundle 스냅샷. 출력은 `REVIEW_REQUIRED | NO_FLAGGED_INVARIANT` 및 `code,severity,evidencePaths`.

**주의:** `NO_FLAGGED_INVARIANT`는 안전·정확성 통과가 아니다. 이 진단기에 등록된 불변식 위반이 보이지 않는다는 뜻뿐이다. 임의의 피부 고민·제품 추천·사용 허가를 계산하지 않는다.

## 3. 현재 부정 검증

| 진단 코드 | 확인하려는 위험 | 해석/한계 |
| --- | --- | --- |
| PHOTO_FAILURE_PROMOTED_AVAILABLE | explicit photo failure가 v4 `available`로 승격 | S0-03, 좁은 보수 PR #1309과 함께 검증 |
| FALLBACK_COUNTS_AS_PHOTO_EVIDENCE | fallback 객체가 실제 사진 근거로 집계 | S0-03 |
| MIXED_ALIGNMENT_LOST | projector `mixed`가 v4 `partial`로 유지되지 않음 | S0-04 |
| PHOTO_SURVEY_CONFLICT_LOST | 명시적 conflict 정보가 근거 없이 unknown으로 바뀜 | 소비 지점 enum 손실 |
| PHOTO_SCORE_WITHOUT_AXIS_CUE:* | 사진 가산점이 있으나 해당 축 관찰 근거를 찾지 못함 | Vision은 관찰 최대 4개이므로 진단 false positive 가능. 자동 판정 금지 |
| PHOTO_SCORE_LOW_AXIS_CONFIDENCE:* | 사진 가산점이 존재하는데 해당 축 관찰 confidence가 low뿐 | S0-02, 제품 행동 위험도 별도 판단 필요 |
| PHOTO_SCORE_WHEN_UNAVAILABLE:* | unavailable인 사진에 가산점 존재 | 악성/불일치 저장 경로 검출 |
| CRITICAL_CONSISTENCY_RAW_POLICY | critical consistency인데 fallback 미적용 | 실제 effective policy 검사 후보 |
| UNKNOWN_PRODUCT_FORCED_STOP | 미확인 상품을 확정 근거 없이 stop/replace/remove | 기존 unknown product 제약 유지 확인 |

Read-only 진단은 **축별 score=0을 observed-negative로 간주하지 않는다**. Numeric zero는 현재 계약에서 unsupported와 실제로 낮게 관찰됨이 혼재한 값이며, 별도 schema/authority가 없는 이상 적극 활용 금지.

## 4. 기존 시스템 보호

현재 Raw score weights, `applyPhotoWeights()`, SurveyWeight/EnvironmentWeight, product candidate exposure, Top Pick, effective policies, API fields, DB/snapshot schema, Style Track, Provider 비용, authenticated data를 전혀 수정하지 않는다.

- 합성 fixture는 전체 안정성 검증을 대체하지 않는다.
- 파일/필드 진단 결과는 **서버 운영 로그로 자동 수집하거나 개인 데이터를 전송하지 않는다**.
- 평가 결과의 기준은 실제 Human 독립 검증이 있어야 한다.
- #1309가 main에 없으므로 이 평가기는 해당 결함을 **탐지할 뿐 변경을 선행 적용하지 않는다**.

## 5. S2 DoD 차단 조건

1. 독립 피부 관찰 및 사용자 설문 충돌 케이스 Human adjudication.
2. 실제 제품 사용/사용감과 신호의 인과 비약 여부 검증.
3. Unknown/HOLD와 `maintain/reduce/pause_optional` 안전 정책의 별도 승인 및 실측.
4. 기존 164 제품 × 12 상황 결과·응답·저장 계약 불변성 회귀 + PR exact-head.
5. S1 실제 사진 신뢰도 평가, 모바일 화면의 위험 이해도 검증.

**S2 상태:** Synthetic-only 조합 검증 강화, real-photo/user decision validation **HOLD**. 새 진단으로 Production 정책 승격 금지.

Watchtower-Track: face-lab-skin
