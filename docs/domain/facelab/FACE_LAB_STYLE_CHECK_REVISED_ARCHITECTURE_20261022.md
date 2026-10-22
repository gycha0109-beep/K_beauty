# BEJEWELY Face Lab — Style Check 전체 개정 설계 R1

> 날짜: 2026-10-22
> 상태: **PRODUCT / ARCHITECTURE REVISION PROPOSAL — 검토용**
> 범위: Face Lab V2 Style Check의 제품 흐름·관찰 근거·의사결정·실행·검증. Skin Match 및 Face Lab ROI v1–v3 연구와 책임 분리.
> 구현 확인 기준: `K_beauty main@b5687f322bd33d5bdaad61c07eeee4a47544d15d` (2026-10-22).
> 효력: 기존 생산 코드·계약·배포를 변경하지 않는 설계안. 승인 전 canonical schema 또는 추천 정책의 새 production authority가 아니다.

## 0. 개정 이유와 확정된 범위

### 직접 원인
ROI v1–v3 연구는 *볼 피부 표본 후보의 위치*에 관한 실험이며 Face Lab 전체 Style Check의 품질을 대표하지 않는다. 기존의 작은 원 → 큰 탐색 직사각형 → 내부 볼 메시 다각형은 '기하학적 후보'를 점진적으로 바꾸었을 뿐, 사진에서 유효 피부를 분리했다거나 사용자의 추구미에 맞는 스타일을 평가하지 않았다. 알고리즘 간 IoU(예: 19–26%)는 **피부 정확도/스타일 정확도가 아니다**.

### 유지하는 상위 제품 정의
2026-09-24 「FACE LAB 정의 V2」의 방향은 유지한다: **현재 얼굴의 시각적 특성 + 사용자가 원하는 추구미 + 현실 제약 → Style Delta → 복수 Route → 사용자의 선택 → Hair / Makeup / Color / Grooming / Accessories 실행**. 하나의 대표 상/외모 점수/관상 판정이 목표가 아니다.

### 본 개정으로 바꾸는 것
1. 전체 스타일 결정 경로와 하위 이미지 ROI 실험의 **경계를 분리**한다.
2. 눈·눈썹·얼굴 전체·턱/광대·이목구비 배치·표현 대비 등을 관찰하는 **다영역 근거 맵**을 도입한다.
3. 현재 존재하는 엔진을 '없음'으로 오판하지 않고 **구현 존재 / 실행 연결 / 사용자 제공 / 품질 검증 / production authority**를 따로 기록한다.
4. 스타일 추천의 각 action을 **관찰 근거 + Target 근거 + 제약 + 정책 버전**으로 역추적한다.
5. v3 ROI는 Color/Complexion 연구 하위로 격리한다. Style Delta, Hair, Brow, Glasses, Look Composer의 prerequisite이 아니다.

## 1. 설계·구현 authority

| 소스 | 역할 | 한계 |
|---|---|---|
| `페이스랩 정의 V2 260924.md` (프로젝트 제공, 2026-09-24) | 제품 목적, Target Style, Route/Domain 실행, Free/Premium | 구현 완료의 증거가 아님 |
| `docs/domain/facelab/FACE_LAB_MASTER_SPEC.md` | 공통 Vision/evidence/privacy/hold 및 canonical 경계 | 옛 'Archetype → Core/Alternative'의 중심성은 신제품 방향에 맞춰 해석 필요 |
| `docs/domain/facelab/FACE_LAB_EVALUATION_STRATEGY.md` | synthetic/real/human 합의·승격 authority | 합성 fixture를 사용자 정확도로 승격 불가 |
| `docs/domain/facelab/FACE_LAB_CURRENT_STATE.md` (2026-08-12 기준) | 당시 기준선 | **현재 구현 상태 설명으로는 오래됨**; 최신 main에 V2 모듈 다수 존재 |
| `face-lab-v2-end-to-end-completion-audit-v1.md` 및 최신 V2 contract | 결정론적 파이프라인 연결·선택·저장 왕복 | 미적 추천 품질이나 사진/실기기 검증 아님 |
| 2026-10-22 `main` 실제 코드 | **현재 구현 여부 판정의 1차 근거** | 파일 존재만으로 운영 UI 활성화/실사용 품질을 확정할 수 없음 |

**문서 충돌 처리:** 제품 의도는 9/24 V2, 현재 동작은 main 코드·최신 컴포넌트 계약, 보안/평가 제한은 MASTER·EVALUATION. 본 문서는 이 관계를 기술한 *개정안*이며 불확정 사항을 자동으로 확정하지 않는다.

## 2. 현재 구현 현황 재분류 (2026-10-22)

| 모듈/단계 | 코드에서 확인된 사실 | 추가 확인/개선 필요 |
|---|---|---|
| Eligibility/Quality/Observation | 기존 `face-lab-analysis-bundle`, 통합 observation, quality·pose·occlusion·outline·vertical·eyes·featureLayout·visualLanguage·colorAppearance 기반 | 부위별 evidence coverage, 부분 사진, 포즈/편집/색품질 hold |
| Current Face Profile | `current-face-profile.js` 구현. 얼굴선·턱각·세로균형·눈 방향·집중도·선/윤곽/대비 등 keyFeatures | `presentationObservations:null`, `representationRef:null`, `faceSpaceVersion:null` 확인; 연속형 구조 정보·피처 coverage/가중치 검증 |
| Target Finder / Survey | `target-finder.js`, `survey-contract.js`, `target-style-mapper.js` 존재. 6축 Target Style, scope, changeTolerance, constraints | 카드·질문·확인 UX의 실제 접근성, 취향 추정과 명시적 확인 구분 |
| Target Intent | `face_harmony` 기본, `target_forward` 선택 가능. 사용자 우선순위는 hard exclusion 위로 오지 않음 | mode별 추천 차이와 UI 설명, 취향이 외모 '정답'으로 변하지 않는지 |
| Style Delta | `style-delta.js`와 `target-action-pool.js`, Current Face modifier 존재 | 각 action의 실제 얼굴 근거·중복·반대 근거·override trace, face-fit candidate와 current 구분 |
| Routes | `route-generator.js` 구현: hair/makeup/balance/grooming/low effort 후보에서 최대 3개, 비교 축 있음 | 다각화 품질, 한 영역 unavailable일 때 처리, route 선택 근거와 목표 axis coverage |
| Domain execution | `domain/hair.js`, `makeup.js`, `color.js`, `grooming.js`, `eyewear.js`, `accessories.js` 존재 | 각 영역의 세부 품질·근거·실사용 호환성 별도 평가 필요 |
| Color | `domain/color.js`는 Target/Route action 기반 색 표현 방향. 피부색 정답이나 season 진단이 아님. 현 `confidence: 0.64` 상수 | confidence 의미 재정의/보정, photo-color suitability 게이트, 무보정 피부 RGB 확정 금지 |
| Look Composer | `look-composer.js` 구현. 충돌 일부 검출 | 헤어/메이크업/색/안경 시각 무게 충돌의 커버리지와 다양성 QA |
| Canonical/presentation | `canonical-composer.js`는 V2 downstream 실행을 조립, `result-contract.js`는 `face-lab-canonical-v2`, presentation/저장 계층 존재 | Free/Premium 동일 authority와 재진입·실제 UI 왕복 종단 검증 |
| Route selection | 사용자 명시 선택 `user_selected`와 `default_preview` 분리; 선택 증거·왕복 감사 계약 존재 | default preview를 실제 사용자 선택으로 오표시하지 않을 것 |
| Archetype | `archetype-fun.js` 보조 경로 존재 | 재미용만. shadow scorer/비검증 taxonomy를 스타일 추천 원인으로 승격 금지 |
| Face Fit candidate | `candidate-style-delta.js`의 `productionActive:false` | candidate 실험을 현재 production 의사결정에 섞지 않음 |
| 볼 ROI 연구 | `personal-color/*` v3 실험/테스트 페이지 | 독립 피부 마스크/사진 품질/색측정 calibration 미검증. Style Check의 중심 지표가 아님 |
| E2E audit | 8개 구조화 얼굴 × 12개 목표, 두 우선 모드, 192개 preview 흐름 검증 설계/감사 | 기술적 wiring 근거일 뿐 취향 맞춤 유용성·미학적 우수성 근거 아님 |

**상태 용어를 다섯 가지로 분리한다:** `implemented`, `wired`, `user_exposed`, `validated_real`, `production_authorized`. 각 모듈별 boolean/receipt로 확인하며 임의로 '완료'라고 묶지 않는다.

## 3. 개정된 end-to-end 엔진 책임

~~~text
Photo ─→ Eligibility/Quality ─→ Unified FaceLabObservationAnalysis
                                         │
                          source-specific observation ledger
                                         │
                    Current Face Profile / Face Space adapter
                                         │
       ┌─ Target Finder / Survey / explicit preference ─────┐
       │                                                     │
       └──────── Target Style (confirmed, scoped) ───────────┘
                                         │
           Recommendation Priority (face_harmony|target_forward)
                            + Hard Scope/Constraints
                                         │
             Style Delta (action/evidence/conflict trace)
                                         │
                Route Generator + Comparator
                                         │
             explicit route choice / default_preview
                                         │
                  ┌──────────┼───────────┐
                  ↓          ↓           ↓
                 Hair     Makeup/Brow    Color
                  ↓          ↓           ↓
              Grooming    Eyewear    Accessories
                  └──────────┼───────────┘
                         Look Composer
                              │
             Canonical Face Lab V2 + Evidence/Lineage
                  ┌───────────┼───────────┐
                  ↓           ↓           ↓
                Free        Premium      permitted snapshot
                              │
                 execution cues / catalog binding
~~~

**관찰 ≠ 판단 ≠ 스타일 실행 ≠ 제품 추천 ≠ 연구 실험.**
Archetype Fun/비활성 Shadow Scorer는 별도 sidebar 기능이며 Style Delta 입력의 필수 조건이 아니다. Skin Match는 피부/스킨케어 제약 제공자이며 스타일 목표 결정자는 아니다.

## 4. '얼굴 전체' 관찰·해석 맵

| 관찰군 | 추출/검증 대상 | Style Check 활용 | 보류 조건 |
|---|---|---|---|
| Image eligibility | 실사 단일 얼굴 여부, 해상도, 흐림, 과노출, 가림·각도 | 판단 가능 범위 설정 | 얼굴/표정/가림/품질 부적합 |
| Overall contour | 폭·세로 균형, 턱선 각도, 광대/하관 폭 관계 | Hair 외곽 볼륨, 가르마, 옆선 노출, 안경 비율 | 헤어로 외곽 가림, 포즈/왜곡 |
| Eyes | 방향, 폭, 간격, 개방감, 좌우 근거 | eye technique, brow/eyeliner emphasis | 속눈썹·화장·눈감음·각도 |
| Brows (확장 후보) | 눈썹 방향/굵기/범위와 얼굴 눈 구조 사이 관계 | brow technique/grooming | 눈썹 가림, 메이크업, 관찰 스키마 미지원 |
| Central feature layout | 이목구비의 집중·분산, 코·입 주위의 상대 배치 | 스타일 시각 중심·립/아이 포인트 균형 | 원근 왜곡, 관찰 불확실 |
| Lower face / lips (확장 후보) | 하관선과 입술 윤곽의 관찰 가능 특성 | lip 강조 강도·실루엣 균형 | 가림/표정, 근거 부족 |
| Visual language | 선·곡선감, 윤곽 정의, feature contrast | 스타일 변화 방향/강도 | 색조·조명/사진 보정 |
| Color appearance | 관찰 가능한 **사진상** 대비·색 경향 | Color 표현 옵션·대비 방향 | 화이트밸런스/조명/필터 부적합 |
| Hair state/context | 머리 길이/볼륨/앞머리/질감 (필요시 사용자 입력) | Hair execution feasibility | 사진만으로 세팅·모발 상태 확정 불가 |
| User intent/constraints | 추구미, 사용 범위, 강도, 시간·비용·금지사항 | Route의 authority | 사용자가 확정하지 않은 추구미 |

위 '확장 후보'는 현재 Vision contract가 아직 같은 수준으로 제공한다는 뜻이 아니다. **기존 observation field로 가능한 항목은 그대로 사용**하고 미지원 항목은 new contract/fixture/실사진 평가 없이는 `unavailable`로 유지한다. 스타일링을 위해 얼굴 원본을 추가로 저장하거나 두 번째 모델 호출을 자동 요구하지 않는다.

### Field-level 계약 제안 (기존 canonical을 대체하지 않는 candidate metadata)

~~~json
{
  "featureKey": "eyeDirection",
  "group": "eyes",
  "status": "available",
  "value": "upturned",
  "source": "vision_observation",
  "evidence": ["provider_observation:eyes.eyeDirection"],
  "confidence": 0.81,
  "imageSuitability": "usable",
  "limitations": [],
  "schemaVersion": "observation_contract_version"
}
~~~

숫자·값은 shape 예시다. 실제 상수 또는 calibration 결과가 아니다. `confidence`는 source가 산출하지 않았으면 `null`; 신뢰도를 임의로 채우지 않는다.

## 5. Style Delta 및 근거 전파 정책

### Action-level requirements
최소 `actionId/domain/parameter/direction/strength/targetAxisRefs/observationRefs/constraintRefs/expectedEffect/conflicts/authorityClass/ruleVersion`을 (초기엔 sidecar ledger로) 표현한다. 기존 `style-delta.js` action shape를 무단 변경하지 않는다.

검사할 질문:
1. 이 변화는 **Target** 때문인가, **얼굴 관찰** 때문인가, 둘 다인가?
2. Current Face modifier가 Target action을 완화·변경했다면 어떤 관찰값이 결정적이었는가?
3. 사용자 `target_forward`가 explicit하면 얼굴 조화 heuristic보다 우선하되 hard exclusion은 준수하는가?
4. 근거가 없으면 action을 `insufficient_evidence`/보류하며 일반론을 증거처럼 쓰지 않는가?
5. 추천 행동이 '얼굴형/성격의 객관적인 정답'처럼 표시되지 않는가?

`Style Delta = 단순 Vector 차`가 아니라 **실행 가능한 표현 레버의 이동 경로**다. 예: Eye emphasis/eyebrow structure/hair width/parting/blush placement/color contrast. 실제 action은 scope·hard exclusion에 맞아야 한다.

### Authority/trace
- Observation evidence = visible photo-derived source.
- Target evidence = user-selected/confirmed preference (사진에서 추론 금지).
- Constraint evidence = 명시적 예산/시간/금지.
- Styling heuristics = 정책 버전의 제안(검증 전 자동 객관화 금지).
- Candidate/Archetype-fun/ROI research evidence는 production Action authority가 아니다.

## 6. Route, Domain execution, Look Composer 정책

- **추천 경로 2–3개**(실행 가능한 만큼): Hair-led, Makeup-led, Balanced, Grooming-led, Low-effort를 기존 Generator 후보에서 다양성/제약으로 선별한다. 강제 3개 생성 금지.
- 비교 항목은 현 `comparisonAxes` (changeMagnitude, dailyEffort, maintenance, costBand, reversibility)를 유지하고 목표 axis coverage·faceEvidence·constraintFit·선택 예상 부담을 함께 읽을 수 있게 한다.
- 다수 경로일 때 `default_preview`는 추천 미리보기일 뿐 **사용자 선택이 아니다**. 선택 전에는 committed Look/SKU/실행 요약을 선택된 것처럼 표시하지 않는다. 1개 경로 자동 선택은 기존 `single_route_auto` 계약을 따른다.
- Hair: 파트/앞머리/측면 볼륨/길이/노출/비주얼 무게. 얼굴 구조는 방향을 제안할 뿐 'X형 얼굴에는 Y 필수' 룩업 금지.
- Makeup: 먼저 technique (눈썹·아이라인·블러셔·립), 다음 product specification, 마지막 catalog SKU/shade binding. 미검증 제품 사실은 생성하지 않는다.
- Color: 계절형 퍼스널 컬러 대신 현재 목표의 명도/채도/색 대비 조절에 집중. 사진의 색 적합성이 낮으면 *photo-derived color* 판단은 hold; Target-driven 표현 옵션은 명시적으로 분리해 제공 가능.
- Grooming/Glasses/Accessories: 필수 메이크업 전제 없음; 안경/수염/헤어는 사용 범위에 따라 `not_applicable` 또는 `not_requested` 가능.
- Look Composer: 도메인 간 시각 무게, 강조점 경쟁, 색·선 방향, 사용자 제약 충돌 점검. 일부 unavailable을 가짜 추천으로 보완 금지.
- Skin Match ↔ Face Lab: 피부 상태/트러블·제품 적합성은 Skin Match에서 제한 조건으로만 읽는다. Skin Match가 Face Lab 추구미를, Face Lab이 의료·피부 상태를 독자적으로 판정하지 않는다.

## 7. ROI 연구의 정확한 위치

`/face-lab-roi-test`와 `personal-color/*`의 v1–v3는 **Color/Complexion의 선택적 Research Appendix**다.

- v3의 청록/분홍 마스크는 '볼 표면의 기하 후보'다. 육안상 형태가 좋아도 실제 무화장 피부의 정확한 구간/조명 적합성을 증명하지 않는다.
- IoU는 기존 작은 원과 연구 후보의 **상대적 겹침 정도**다. 19%도 70%도 정확도 점수가 아니다.
- Hair/Makeup/Brow/Route는 해당 ROI 실험이 없어도 **지원되는 observation과 사용자 target**으로 동작해야 한다.
- 피부색·퍼스널컬러·색조 shade의 정량 확정은 독립 human masks, 재촬영 반복성, 조명/화이트밸런스 calibration, photo-quality gate를 거치기 전까지 금지.
- 브라우저 로컬 테스트와 실제 Face Lab 분석 API는 개인정보 처리 경계가 다르므로 UX 문구에서 혼동하지 않는다.
- ROI 실험의 성공/실패를 전체 스타일 추천의 서비스 성공/실패로 확대 해석하지 않는다.

## 8. Canonical V2/UX 설계

### API 계약 재사용
현재 `face-lab-canonical-v2`, `buildFaceLabV2Canonical()`, `buildFaceLabV2ResultPresentation()`, persistence normalizer를 **재사용**한다. 새로운 v3 canonical을 병렬 신설하지 않는다. sidecar/ledger 검증 후 필요할 경우 별도 schema migration+버전 호환성 계획.

### 결과 화면 (허브 + 세부 실행)
1. **지금 얼굴에서 읽힌 특징**: outline/eyes/visualLanguage + 각 feature의 사진 근거·판단 보류 (볼 패치 전면 배치 금지).
2. **원하는 방향**: 추구미 선택/찾기, `face_harmony|target_forward`, changeTolerance, scope/constraints.
3. **핵심 Style Delta**: 추구미로 가기 위한 영향 큰 3–5개 *실행 가능한* 변화, 각 변화의 근거.
4. **여러 Route 비교**: Hair 중심/Makeup 중심/가벼운 변화 등. 시간·비용·난이도·되돌림·유지 난이도.
5. **선택한 Route의 실행안**: Hair, Brow/Makeup, Color, Grooming, Eyewear, Accessories 중 해당되는 도메인만.
6. **Look Composer**: 선택 룩의 조화/충돌/실행 순서와 수정 가능한 항목.
7. **제품/저장/재진입**: 확인된 catalog product/shade만. 별도 사진 재분석 없이 현재 canonical projection 재사용.
8. **Archetype Fun (선택적)**: 재미·공유용. 의사결정에 입력 금지.

### UX 상호작용 규칙
- 본인 사진 분석을 시작할 때 불필요한 **동의 체크박스/승인 버튼을 덧붙이지 않는다**. 필요한 파일 선택/분석 실행만 제공.
- 사용자의 **추구미 확정과 Route 선택**은 진짜 의사결정이므로 남긴다. 연구 데이터셋 재활용 동의는 서비스 기능과 분리해 선택적으로 다룬다.
- 품질이 부족한 사진은 이유와 개선 촬영 가이드를 제공하되, 얼굴 정보 전체를 일괄 차단하지 않는다. 사용 가능한 관찰군은 partial.
- 무료/유료 차이는 *표시·실행 깊이*에 두며, 동일 canonical 분석에서 정반대 얼굴 판단을 생성하지 않는다.

## 9. 데이터 계약과 실패 동작

- 전역 상태: `available / partial / insufficient_evidence / unavailable`; 영역별로 기존 `not_requested / not_applicable` 유지.
- Field-level `source, evidence, confidence, value, unavailableReason` 지원. 추천 action 근거가 target-only면 `target_only`로 표시, 얼굴 근거인 척하지 않는다.
- 분석 불가 사진, 부분 얼굴 근거 부족, upstream Provider 실패, Target 미확정, Route 미선택, Catalog 미일치, Evaluation HOLD는 **서로 다른 상태**다.
- 원본 사진, crop, 생얼/피부 마스크, raw provider response를 canonical·Premium snapshot·Route Choice Evidence에 저장하지 않는다. 연구용 사진/주석은 별도 권리/목적 경계가 필요하다.
- `candidate-style-delta.js` / uncalibrated Face Fit relations / Archetype shadow는 `productionActive:false`를 유지한다.

## 10. 개선 로드맵 (중복 구현 방지)

### P0 — 현재 동작·권한·UI 슬롯 재감사 (즉시)
- 2026-08-12 `FACE_LAB_CURRENT_STATE.md`의 '전부 미구현' 상태를 현재 main 기준으로 재검증해 **historical**로 표시, 실제 모듈 현황 별도 문서로 작성.
- observation field → current-face-profile key → action parameter → Route → domain execution → Look/appearance product handoff까지 **전수 lineage 매핑**.
- 영역별 `implemented/wired/user_exposed/validated_real/production_authorized` 증거 링크, 실패/보류 사례, 누락 슬롯을 기록.

### P1 — end-to-end 근거 계약 검증
- 빈/partial/모순 observation에 대한 action suppression. '자기 얼굴 근거' 없는 Target-only action에 올바른 레이블.
- Route preview/explicit selection과 저장 왕복은 기존 감사 재사용; 무료/유료에서 동일 결론 유지 검증.
- `color.js`의 임의 fixed confidence 및 photo-color suitability와 Target-driven color 표현을 분리하는 **candidate policy 설계/테스트**. 기존 production 수치 즉시 변경 금지.
- `presentationObservations`/Face Space/null 필드에 새 데이터를 무단 보충하지 않고 provenance/필요성이 입증된 관찰부터 단계적 확장.

### P2 — 실제 Style Check 가치 검증
- 최소 대표 사진군(전면/약간 회전/가림/저화질/다양한 조명·헤어·화장 여부)을 권한 확보 후, **사진 관찰의 사람 간 일치도**를 검사한다.
- 같은 관찰과 서로 다른 추구미 입력에서 Route·Hair·Makeup 제안이 의미 있게 달라지는지 pairwise 인간평가 실시.
- 얼굴 구조를 바꿀 수 없는 조건에서도 User Intent 우선권을 지키는지 평가. 관련 문구가 외모 우열/성격 추론으로 흐르지 않는지 점검.
- 실제 사용자 선택/수정/포기 사유를 선택적으로 기록하되 과신한 신뢰도 추정 금지.

### P3 — 도메인 심화 및 catalog 연결
- Hair reference·Makeup technique→spec→SKU/shade facts, eyewear/grooming feasibility 등 미지원 슬롯 개선.
- Catalogue match는 verified Product/Variant authority를 따라 실행, 매칭 실패 시 unavailable.
- ROI/Photo Color는 인간 검수·조명 데이터가 확보되기 전까진 내부 연구 유지.

## 11. 수락/회귀 기준 (실행 가능한 테스트 설계)

| 레벨 | 핵심 시험 | 성공 기준 |
|---|---|---|
| S1 계약 | canonical v2를 거치며 관찰/Target/Route/action evidence lineage 보존 | 근거 없는 정상 action 0, 상태 혼합 0 |
| S2 엔진 | 같은 얼굴 × 서로 다른 Target/priority/scope | 의미 있는 action/route 차이, hard exclusion 위반 0 |
| S3 다양성 | hair_disabled·makeup_disabled·color_not_usable·limited pose | 도메인별 합당한 `not_requested/partial/unavailable`, 가짜 fallback 0 |
| S4 선택권 | 다중 Route default preview → 사용자가 선택 → save/rehydrate | 미선택 Route를 사용자 선택으로 오표시 0, 선택 lineage 동일 |
| S5 프리미엄 | 같은 canonical Free/Premium projections | 모순된 얼굴 진단·추구미 결론 0 |
| S6 사람 평가 | 근거 있는 구조 cue와 스타일 조정의 평가자 비교 | 기준값은 사전 합의한 인간평가 프로토콜로만 확정, synthetic alone 불가 |
| S7 개인정보 | 얼굴 원본/원본 Provider/ROI 픽셀 저장 경로 | 기존 비저장 경계 유지, 연구자료 분리 |
| S8 브라우저 | 모바일 업로드/진단/Target Finder/Route/Look/재진입 | 실제 브라우저·기기에서 재현성, 실패 안내 검증 |

통계적 품질 지표(정확도, 사용자 선호도, 만족도)의 합격 임계값은 **임의로 정하지 않는다**. Human reviewer와 실사진 cohort 프로토콜에 따라 선행 등록한다. Synthetic wiring 192 flows가 S6의 대체 근거가 될 수 없다.

## 12. 개발 파일별 조치 매핑

| 기존 코드 | 조치 |
|---|---|
| `lib/face-lab-v2/current-face-profile.js` | feature coverage/field-level lineage audit, 불필요한 Face Space 추정치 발행 금지 |
| `lib/face-lab-v2/target-style-mapper.js`, `survey-contract.js` | 승인된 Target과 추천 우선순위/제약 normalization 보존 |
| `lib/face-lab-v2/style-delta.js`, `target-action-pool.js`, `personalization/*` | current/candidate 분리, 새 근거 추적은 sidecar로 시작 |
| `lib/face-lab-v2/route-generator.js`, `route-choice-evidence.js` | route diversity/constraint fit/실제 사용자 선택 진단 |
| `lib/face-lab-v2/domain/{hair,makeup,color,grooming,eyewear,accessories}.js` | 각 domain의 상태, evidence, usability 평가 |
| `lib/face-lab-v2/look-composer.js`, `appearance-handoff.js` | 충돌·룩·제품 handoff 모순 검사 |
| `lib/face-lab-v2/canonical-composer.js`, `result-contract.js`, `result-presentation.js` | Free/Premium 동등성, 미선택-route 가드, 기존 schema 호환 |
| `lib/face-lab-v2/personal-color/*` | Color Research만; Style Check score/Route gate로 승격 금지 |
| `docs/domain/facelab/FACE_LAB_CURRENT_STATE.md` | 날짜형 snapshot임을 강조하고 최신 범위/검증별 상태로 갱신 제안 |

## 13. 비목표 및 승인 경계

- 이 문서만으로 모델 weight, taxonomy, confidence, 인간평가 임계값, 피부 tone, 대표 상 decision을 활성화하지 않는다.
- 관상/건강/인종/성격/외모 점수/셀럽 신원 유사성 판정을 Style Check에 추가하지 않는다.
- 촬영 시 불필요한 checkbox를 되살리거나 별도 Vision 분석을 반복하지 않는다.
- 사용자 UX 개선을 핑계로 Product/Catalog/Skin Match production DB·security boundary를 바꾸지 않는다.
- **ROI v4 연구만 계속하는 것을 Style Check 개선으로 보고하지 않는다.**
- 적용/배포는 별도 코드 PR, 근거 기반 CI, 제품 수락 후 추진한다.

## 14. 이 개정의 완료 기준

설계 검토 완료는 다음이 모두 연결되었을 때 선언한다.

1. 실제 main 모듈과의 일대일 매핑이 있다.
2. observation→action→Route→domain→Look→Free/Premium의 책임과 evidence 경계가 정의됐다.
3. 모든 하위 스타일 영역과 Skin Match/ROI의 격리 위치가 분명하다.
4. 인간 평가·실사용 검증과 기술 wiring을 동일한 성공으로 혼동하지 않는다.
5. 다음 구현자는 *새 엔진을 복제하지 않고* P0/P1의 누락 계약을 찾아 개선할 수 있다.
