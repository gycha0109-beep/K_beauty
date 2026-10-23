# Face Lab Style Check — SC-06B 구조 개인화 후보 실험

> 작성: 2026-10-23 · 상태 **SHADOW PROPOSAL / NOT HUMAN VALIDATED / NOT PRODUCTION**
> 선행: `FACE_LAB_STYLE_CHECK_SC06_FIELD_IMPACT_FINDINGS_20261023.md`, 기존 `face-lab-v2-recommendation-human-pairwise-contract-v1.md` 및 SC-05 실사진 Human 프로토콜
> 코드: `lib/face-lab-v2/evaluation/style-check-structural-shadow.js`

## 1. SC-06 실측에서 확인된 공백

- 22개 관찰 필드 중, 4개는 Style Delta / Route를 바꾸고, 추가 5개는 Hair 실행의 `avoidOrModerate` 내용이 바뀐다.
- 나머지 13개는 검사한 synthetic 두 얼굴 × 12 Target에서 현재 실행 `value` 변화가 없었다. 그중 3개 `colorAppearance`는 별도 Photo Color 실험 대상으로 격리.
- 이번 범위는 잔여 10개 **얼굴 구조/눈/배치 관찰**만 해당. 이 필드들이 실제 스타일 개선에 필수라는 주장은 아니다.

잔여 관찰 10개:

| 그룹 | 관찰 필드 |
|---|---|
| outline | `foreheadWidthVsCheek`, `jawlineAngularity`, `jawTaper`, `cheekboneProminence` |
| vertical | `midfaceLength`, `lowerFaceLength` |
| eyes | `eyeLength`, `eyeOpenness` |
| featureLayout | `featureScale`, `focalFeatures` |

주의: `jawlineAngularity`는 **Current Face Profile Key Feature**로는 사용하지만 현재 Style Delta 및 실행 변화까지 도달하지 않는 필드다. 프로필 미사용으로 오기하지 않는다.

## 2. 첫 3개 Shadow 가설 (코드로 실험, 미적 사실 아님)

| 가설 ID | 구조 관찰 | 기존 Target action (정확 일치 시) | 비교 대안 | 사람 평가 질문 |
|---|---|---|---|---|
| SC-STRUCT-001 | `jawlineAngularity=angular` | `eyewear.angularity` / softSharp high | `moderate → light` | 각진 턱선에 각진 안경테 강조를 완화한 안이 실제 Target에 더 적합한가? |
| SC-STRUCT-002 | `eyeOpenness=wide` | `makeup.outerEyeEmphasis` / softSharp high | `moderate → light` | 눈 개방감이 큰 경우 바깥쪽 눈매 강조를 완화해도 추구미를 더 잘 살리는가? |
| SC-STRUCT-003 | `featureScale=large` | `makeup.selectedFeatureContrast` / minimalStatement high | `strong → light` | 크기 특징이 뚜렷할 때 포인트 대비를 낮추는 안이 유용한가? |

임의 미학적 규칙의 **옳음이 아니라 검증 가능성**을 확인한다. 어떤 인물의 자연적 얼굴 특징도 교정 필요 대상으로 취급하지 않는다. 비강제적 선택지를 비교하며, 사용자 Target 우선과 금지 조건을 유지한다.

### 입력/행동 조건

1. 원천 observation 계약에 실제 존재하는 필드만 사용한다. 구조 Profile 값이 해당 trigger와 정확히 일치해야 한다.
2. **사용자 승인 Target**과 `face_harmony` 모드에서만 후보 효과를 시험한다. `target_forward` 시 현재 Style Delta와 완전히 동일해야 한다.
3. `constraintState="allowed"` 이며 `domain/parameter/direction/reason`이 기존 Target action과 정확 일치한 경우에만 기존 action 강도 **축소** 가능. blocked/no action 시 새로운 행동을 만들지 않는다.
4. 이 변경은 `lib/face-lab-v2/evaluation` 내부에서만 존재한다. `candidatePolicy.productionActive:false` 및 `permissionToReplaceCanonical:false`.
5. `candidate_relation:SC-STRUCT-*` / `candidate_structural:*`은 *실험 추적*이며 production Face Lab observation의 검증된 `face_feature:*`가 아니다.
6. 이미지·피부색 측정·단독 계절형 진단·임상 판단을 도입하지 않는다.

## 3. 자동 평가 계획

- **8개 synthetic face × 12 Target = 96 baseline**에서 후보별 입력/Target action 동시 만족 건수, 실제 strength 변화, Route 구성 변화 집계.
- 별도 통제 사례: 각 가설 trigger를 설정하고 미적 진위를 주장하지 않는 상태에서 후보 강도 변화가 발생하는지 확인.
- `target_forward` 96건에서는 후보 효과 0, hard exclusion 적용 시 0, 구조 field 누락 시 0, 사용자 Target 미승인 시 0.
- 원본 `currentFaceProfile`, `targetStyle`, Canonical V2·현재 Style Delta·기존 플로우/보고서에 side effect 0.
- 이미 존재하는 `human-pairwise-contract.js`를 차기 블라인드 리뷰에 그대로 활용. 기존 14쌍은 **다른 vCandidate**에 대한 비교이므로 이 새 세 가설에 대한 사람 평가로 재포장하지 않는다.

## 3.1. 첫 CI 계측 결과 — synthetic 96건 (2026-10-23)

- 커밋 `b1ac85a89df4f2d40b310153b69e61f99def31f0`, [Foundation #39882857476](https://github.com/gycha0109-beep/K_beauty/actions/runs/39882857476): **PASS**
- `baselineCases=96`, `activatedCases=14`, `routeChangedCases=9`, `targetForwardHeldCases=96`.
- `SC-STRUCT-001` 턱선 각도: matching + changed action **10건**, Route 변화 **5건**.
- `SC-STRUCT-002` 눈 개방감: matching + changed action **4건**, Route 변화 **4건**.
- `SC-STRUCT-003` 특징 크기: matching + changed action **0건**, Route 변화 **0건**. **별도 통제 테스트에서는 동작을 확인**했으나 이번 synthetic 기저 코호트에 실제 동시 조건 충족 사례가 없었으므로 개인화 유용성 결론 금지.
- 위 수치는 합성 입력에서 action strength를 바꿀 *기회*와 추천 경로의 조건부 변화 건수. **추천이 더 좋아졌다는 의미가 아니다.**
- `humanJudgments=0`, `realPhotoReviewed=0`, `productionAuthorization=false` 유지.

## 4. 결과 해석/출시 조건

- Candidate 활성화 건수 > 0은 **코드 실행 및 비교 가능성**만 증명한다. 스타일 효용·얼굴 관찰 신뢰성은 미검증.
- 현재 Engine보다 단순히 추천이 더 많이 달라졌다는 이유로 신규 Candidate를 우수하다고 판정하지 않는다.
- 신규 후보의 Human A/B를 따로 설계하여 `target_fit / specificity / evidence_action_linkage`에 대한 평가를 수행한다. 미적 선호·실용성은 별도 사전 등록 rubric.
- 실사진 연구 목적 동의, 보관·삭제·접근권한, subject-level split, 2명 이상 독립 평가자의 sealed human 응답을 확보하기 전 `SC-07` 운영 승격 금지.
- 촬영 환경/가림/화장에 따른 필드의 `insufficient_evidence`는 후보 불활성 처리. 합성 구조값만으로 실사진 정확도 선언 금지.

## 5. 개발 상태와 후속 과제

- 이번 단계: **SC-06B 3개 후보 + 96 synthetic feasibility + 회귀 테스트**.
- 그 외 7개 비색상 필드는 *대기*: Target 실행 action과 의미 있게 연결되는 근거 및 Human 평가 계획이 있기 전 새 규칙을 만들지 않는다.
- Color appearance 3개는 별도 검증 대상, ROI 볼 패치와 전 얼굴 Style Check 통합 근거 아님.
- User-facing 스크린/Production 추천/새 Canonical v3/장기 원본 저장/DB/API는 변경하지 않는다.
