# Face Lab Style Check — SC-06 전체 22필드 영향도 실측 결과

> 2026-10-23 (KST) · **synthetic sensitivity evidence ONLY** · Baseline GitHub CI: `39815134570` (Foundation), `39815135269` (PIE), exact SHA `2ded897e9f3b91954a874bb69f3302bba442c930`.
> 목적: 원천 관찰→Profile→Style Delta→Route→Hair/Makeup/Color/기타 최종 실행안에서 실제로 값이 달라지는 경로를 분리.
> **실제 사진, 실제 사용자 평가, 스타일 정확도, 정책 승격을 의미하지 않음.**

## 1. 검증의 출처와 범위

- `lib/face-lab-v2/evaluation/style-check-field-impact-audit.js`의 결과를 GitHub Foundation 실행 로그에서 직접 확인.
- 22개 관찰 필드, 6개 원천 그룹, **합성 얼굴 2개 × 고정 Target 12개** = 24개 baseline.
- 각 field의 정의된 다른 값으로 교체하는 **1,332회 통제된 비교**. 단일 관찰 외 Target/제약은 유지.
- Candidate Style Delta는 별도 read-only shadow, `candidatePolicy.productionActive === false`; 실제 서비스 결과에 쓰지 않음.
- CI 두 개 모두 `completed/success`; raw 사진/사용자 표본은 0.

## 2. 단계별로 실제로 변한 관찰 필드 수

| 검사 단계 | 영향 필드 수 | 해석 |
|---|---:|---|
| Current Face Profile: 대표 특징 | 8 | 개인화 근거로 보일 수 있는 feature projection |
| Current Face Profile: 구조 값 | 16 | 구조 데이터에 들어옴. 이 자체는 추천 사용 증거가 아님 |
| Style Delta | **4** | Current-authorized action modifier로 행동 값·근거 변화 |
| Route | **4** | Style Delta 변동이 Route로 전파 |
| Hair/Makeup/Color/Grooming/Eyewear/Accessories/Look 최종 execution `value` | **9** | 네 action modifier 외에도 Hair 구조 주의사항이 일부 반응함 |
| Candidate Delta / Route | 4 / 4 | 이 2-face cohort에서는 **candidate 자체 활성화가 0회**여서, 현재 4개 규칙으로부터 상속된 차이일 뿐 candidate 효과라고 주장 금지 |

## 3. 실제 최종 실행에 영향 준 정확한 9필드

### A. Style Delta·Route에 직접 반영: 4개

| Field | 관찰 대체 테스트 중 Style Delta 변화 |
|---|---:|
| `eyes.eyeDirection` | 8 |
| `visualLanguage.straightCurveBalance` | 6 |
| `visualLanguage.contourDefinition` | 4 |
| `visualLanguage.featureContrast` | 3 |

이 숫자는 각 테스트의 변화 건수이지 사람 수나 정확도 아니다. 실제 서비스의 Target/Hard Exclusion/Face Harmony 등에 따라 적용 조건이 달라진다.

### B. Style Delta는 안 바뀌지만 최종 Hair 실행 `value`에 영향: 5개

| Field | 관찰 대체 테스트 중 최종 실행 변화 |
|---|---:|
| `outline.faceShape` | 24 |
| `outline.jawWidthVsCheek` | 24 |
| `vertical.faceLengthBalance` | 48 |
| `vertical.foreheadHeight` | 36 |
| `featureLayout.featureConcentration` | 24 |

코드 근거: `domain/hair.js`의 `buildStructuralModeration(currentFaceProfile)`는 `avoidOrModerate`를 생성한다. 이는 **헤어 구조 관련 주의사항 반영**이지 새 헤어 액션/Route 선택을 수행한다는 뜻은 아니다. 이 5개를 Style Delta 얼굴 modifier 5개로 잘못 계산하지 않는다.

### C. 실제 스타일 실행에 변화가 없는 필드: 13개 (이 코호트 한정)

- 프로필 구조값에는 들어가지만 실제 Style Delta·Route·최종 실행 `value` 변화가 없는 필드:
  `outline.foreheadWidthVsCheek`, `outline.jawlineAngularity`, `outline.jawTaper`, `outline.cheekboneProminence`,
  `vertical.midfaceLength`, `vertical.lowerFaceLength`, `eyes.eyeLength`, `eyes.eyeOpenness`,
  `featureLayout.featureScale`, `featureLayout.focalFeatures`.
- 사진상 Color 3개(`colorAppearance.apparentTemperature`, `apparentBrightness`, `apparentSaturation`)는 Current Face Profile 및 현재 추천 Action/Route 경로를 소비하지 않는다.

**주의:** '변화 없음'은 synthetic field perturbation에 대한 trace sensitivity 0을 뜻한다. 관찰값이 쓸모없다는 결론, 정적 UI의 미사용, 또는 사진 Color 엔진 전체 미존재 주장으로 확대하면 안 된다.

## 4. Candidate Face Fit 교차검증

**문제:** 작은 SC-06 코호트에서는 `candidateActivations=0`. 반면 기존 `human-pairwise-builder`는 8개 activation boundary/route mutation review sample과 5개 route mutation sample을 생성하도록 명시돼 있다.

**조치 및 실제 확인:** `verify-face-lab-style-check-field-impact-sc06.mjs`에 기존 `runFaceLabV2CandidatePersonalizationEvaluation()`를 positive control로 추가. **8 synthetic face × 12 Target = 96건에서 Candidate 활성화 8건, 선택 Route 변경 5건, Current와 Candidate 모두 Target action signature가 완전 동일한 Target 6개**를 확인. SC-06 작은 24건 baseline의 candidateActivations=0과 모순이 아니며 cohort coverage 차이임. 새 회귀 검사 포함 SHA `434f9782c5aeb44c92e1be6cff21658fd4d5da05`의 Foundation [39881306759](https://github.com/gycha0109-beep/K_beauty/actions/runs/39881306759) 및 PIE [39881306875](https://github.com/gycha0109-beep/K_beauty/actions/runs/39881306875) **PASS**.

**해석 규칙:**
- 작은 코호트 candidate=0 → 후보 규칙이 무용하다고 결론내지 않음.
- 큰 코호트 candidate>0 → 후보의 *경계 내 활성화와 코드 작동*만 입증.
- 어느 경우에도 사용자 선호·실사진 적합성이나 현재 프로덕션 승격 근거가 아님.

## 5. 구체적인 다음 조치 (우선순위)

1. **SC-06 회귀 기준 강화**: CI에서 위 9개 실행 영향 필드와 4개 Delta 영향 필드의 목록을 비교한다. 의도하지 않은 경로 제거 시 CI 실패. 후보 96-case positive control 성공 여부 별도로 기록.
2. **SC-06 다음 평가 후보**: Hair 구조 주의사항에 영향을 준 5필드의 권고가 실제로 유용한지, 각 주의사항이 지나치게 규범적이지 않은지 Human Review. 10개 구조값-only 관찰에는 신규 룰을 성급히 도입하지 않고 사용자 목표·도메인 해당성에 따른 rule hypothesis 설계.
3. **Color**: 현재 `domain/color.js`는 Target-driven style color direction이며 사진상 3필드로 피부 tone/shade를 측정한다고 주장하지 않는다. 사진 색상 적합성이 검증되기 전 photo-derived Color를 활성화하지 않음.
4. **SC-05 실제 사진**: 수집 권리/철회/삭제/holdout을 운영자가 확인한 뒤 사람 평가 별도 진행. 계획 검사와 실제 Human judgment는 서로 다른 gate.
5. **SC-07 UX/제품**: Human 승인 이전 `22개를 모두 개인화에 쓴다`는 문구, 근거 없는 confidence·계절형 퍼스널컬러 확정 표시는 금지. 근거가 입증된 변화만 표시하는 설계.

## 6. 적용 상태

- 코드 변경 위치: `lib/face-lab-v2/evaluation` 및 `scripts/verify-face-lab-v2-foundation.mjs`의 read-only verification import.
- **PR #1397**는 #1396 위에 쌓인 Draft. #1393/1394/1395/1396/1397 체인과 별도 설계 PR #1392는 미병합.
- Current Canonical V2, production hairstyle/makeup recommendations, API, saved report, 사진 저장 정책, database 모두 변경하지 않음.
