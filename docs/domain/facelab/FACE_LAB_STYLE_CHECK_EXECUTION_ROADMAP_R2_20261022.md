# BEJEWELY Face Lab Style Check — 실행 로드맵 R2

> 작성일: 2026-10-22 · Track: face-research / Style Check
> 근거: `FACE_LAB_STYLE_CHECK_REVISED_ARCHITECTURE_20261022.md`, `페이스랩 정의 V2 260924.md`, 현재 `main@b5687f3` 및 실제 V2 모듈/기존 평가 도구.
> 상태: 개정 로드맵 제안. **기존 프로덕션 정책·점수·저장 스키마 변경 승인 문서가 아님.**
> 날짜는 시작 순서만 의미하며 기간·출시 날짜를 보장하지 않는다.

## 1. 왜 R2인가
'ROI 생성 모양 개선'은 Style Check 전체 성공조건이 아니다. v3 볼 ROI는 Color/Complexion용 후보 연구로 축소. **Core Value = 전체 얼굴의 관찰 근거 + Target 선택 + 실현 가능한 스타일 변화 경로.**

이미 구현된 `current-face-profile.js`, `target-style-mapper.js`, `style-delta.js`, `route-generator.js`, 도메인 여섯 개, `look-composer.js`, `canonical-composer.js`, 프리뷰·저장 계약을 **재사용**한다. 새 추천 엔진을 병렬 생성하지 않는다.

## 2. 실행 방법 및 승격 규칙

- 작업 단위는 independent PR, one-purpose diff, explicit rollback. 문서/비침습 auditor → 읽기 전용 관측 → shadow proposal → 근거 검증 → opt-in 실제 노출 순.
- 심사 단계: **EXISTS**(파일) → **WIRED**(실제 canonical 호출) → **BOUNDARY_VERIFIED**(안전 게이트/CI) → **USER_EXPOSED**(실제 사용자 UI 확인) → **REAL_VALIDATED**(사진·사람 평가) → **PRODUCTION_AUTHORIZED**(정책 승인). 이 단계는 동일하지 않다.
- `target_forward`는 명시 목표를 보호하되 hard exclusions를 무시할 수 없다. `default_preview`는 사용자 선택이 아니다.
- 테스트 통과가 미적 정확도나 개인화 추천의 우수성을 증명하지 않는다. 평가 cohort와 판정 기준 선행 등록 필수.
- 생성 모델/ROI/Archetype shadow/vCandidate는 근거 없는 프로덕션 판정으로 승격 금지.
- 서비스 이용을 위한 불필요한 확인 체크박스 추가 금지. Target 승인/Route 선택은 진짜 사용자 의사결정이라 유지.

## 3. Workstream과 선후관계

```text
W0 Inventory & authority map
   ↓
W1 Read-only evidence lineage verifier (current P0 implementation)
   ↓
W2 Observation coverage / fail-closed semantics audit
   ↓
W3 Target × Face × constraint route quality shadow comparisons
   ↓
W4 Domain action usefulness + human-photo evaluation
   ↓
W5 Incremental UX/catalog promotion (separate release decision)

Independent research lane: Colour/ROI photographic sampling (not W0–W3 gate)
```

### W0 — 현황표/권한 경계 잠금 [P0; START]

**입력** `main`의 observation→canonical/Target→Style Delta→Route→Domain→Look→presentation/persistence. 2026-08-12 `CURRENT_STATE` 문서는 과거 스냅샷으로 취급.

**산출물**
- 부위별 observation 공급/프로필 소비 매핑(전체 얼굴, 눈, 눈썹 후보, 중앙 배치, 턱/광대, visual language, 사진상 Color)
- `implemented/wired/user_exposed/validated_real/production_authorized` 근거 표
- 알려진 공백: `presentationObservations:null`, `faceSpaceVersion:null`, Color confidence 상수, 미검증 미학적 품질

**완료 게이트** 각 판단 근거에 소스 경로, 소비자, 상태, 유실/보류 원인 연결; 추측값 0.

### W1 — 근거 추적 sidecar & 자동 계약 검사 [P0; IMPLEMENTATION STARTED]

**첫 PR 범위(현 작업)** canonical 자체를 바꾸지 않는 `evaluation/style-check-lineage-audit.js`와 CI 검증:
- action evidence를 `target_axis:*`, `face_feature:*`, 기타로 분리
- target-only action을 '얼굴 맞춤'이라고 허위 승격하지 않음
- face modifier의 `face_feature:key=value`가 실제 Current Face Profile `keyFeatures`와 일치하는지 검증
- allowed vs blocked가 Route로 섞이지 않는지, Route action의 target/face evidence lineage가 style-delta action에서 왔는지 확인
- committed Route·Look·available Domain의 `routeId` 정합성 검증 (preview의 internal route와 user selection 분리)
- 순수한 건수·코드만 반환; 얼굴 원본, 관찰값, 응답/파일, Target 개인 선호 내용 저장 금지
- 정상 fixture + 의도적으로 오염된 fixture가 검증기를 실패시키는 회귀 테스트

**완료 게이트** synthetic cohort 전수 0 contract violation, mutation detection 통과, 기존 canonical/Free/Premium snapshot 결과 변경 없음, CI 전부 정상.
**한계** action provenance 계약 검증 = 미적 품질 검증 아님.

### W2 — 관찰값 coverage & 권한 보류 [P1; SC-03 구현 착수 / PR #1394]

- field/area별 source evidence + quality/pose/occlusion 필터의 가용성 매트릭스 구축
- 눈썹/입술/하관 상세 필드는 observation contract에 실제 존재하는지 검증하고, 미지원이면 `unavailable`
- `keyFeatures`에 미존재할 경우 face modifier 불가; 누락 face evidence를 자동 생성 금지
- Color의 `confidence: 0.64` 및 Hair/Makeup 상수는 calibration 전 descriptive/uncalibrated로 분리하는 shadow 설계. production 숫자 일괄 수정 금지.
- Free vs Premium, target unapproved / partial photo / unsupported scope 각각 똑같은 source authority 검증.

**완료 게이트** observation key coverage ledger, hold reason coverage, baseline compatibility, 불가능한 영역에 추천 근거 생성 0.

### W3 — 추천의 목표 적합·다양성 [P1–P2; SC-04 코드·Foundation/PIE 통과 / PR #1395]

- 동일 관찰 × 다른 Target/priority/scope/time/budget 및 같은 Target × 다른 구조 관찰로 반사실 테스트
- target_forward와 face_harmony의 이유 추적, hard exclusion 위반 0
- Hair-led / Makeup-led / Balanced / Low effort 등 가능한 Route의 겹침·실행 비용/유지 가능성 비교
- 단일 Archetype label을 행동 추천 lookup key로 사용 금지

**완료 게이트** route collision/원인 설명 누락/미지원 도메인 거짓 생성 0 (정책 invariant), 미학적 유용성 평가는 W4로 분리.

### W4 — 실제 사진·사람 평가 [P2; SC-05 평가 사전검증 착수 / PR #1396, 실사진 평가는 미착수]

- 인물 동의·사용 권한이 확인된 사진의 서로 다른 조명·촬영각도·헤어/메이크업/필터·가림을 구조화한 cohort
- 2인 이상 독립 평가자, blinded 구조 cue 검토 및 action/route pairwise 유용성 평가
- 재촬영 안정성·평가자 일치율·부위별 hold/coverage를 별도 보고
- 매개변수/합격 수치 선행 등록 전 정확도·만족도·미학적 품질 합격 선언 금지
- 얼굴 데이터 장기 저장/원본 재활용은 새 근거/권한 없이는 금지

**완료 게이트** dataset provenance/권한, 리뷰 프로토콜과 이견 해소, fail/hold 분석, 제품 의사결정 서명.

### W5 — 상품화/UI 경험과 제품 연결 [P3; W2–W4 결과에 따라]

- 화면: 내 얼굴 근거 → 목표 선택 → 변화를 설명하는 action → 2–3개 실행 경로 → 선택 Look → 검증된 SKU/스펙
- 헤어 가르마/볼륨, 눈썹·아이라인·립 기술, 컬러 표현, 안경·액세서리 제약의 실행 상세 강화
- `appearance-handoff`/catalog matcher 규칙을 재사용, shade·SKU 허위 생성 금지
- 모델 업데이트/실제 UI A/B / 모바일 재진입 롤백 절차를 별도 릴리스 PR로 정의

**완료 게이트** 사용자 의도와 선택 유지, 저장/재진입, UI 실기기, 우회 추천/오인용 문구 0, 승인된 production release.

## 4. Dependency & 우선순위 표

| ID | 순서 | 상태 | 필수 선행 | 전달물 | 차단 조건 |
|---|---|---|---|---|---|
| SC-00 | 1 | 개정 설계 작성 | 기존 V2 정의 | 전체 책임 경계 | 없음 |
| SC-01 | 2 | **착수** | SC-00, 실제 main | 근거·상태 재감사 | provenance 누락 |
| SC-02 | 3 | **코드·CI 검증 완료 / PR #1393, 미병합** | SC-01 병행 가능 | read-only lineage auditor + mutation CI | canonical 의미 변경 |
| SC-03 | 4 | **coverage 감사 구현·Foundation CI 통과 / PR #1394, 미병합** | SC-01/02 | observation coverage + 후보 hold audit | missing field 무단 보충 |
| SC-04 | 5 | **반사실적 추천 비교 구현·Foundation/PIE 통과 / PR #1395, 미병합** | SC-02/03 | face/target/constraint contrast suite | 허위 사용자 선택 |
| SC-05 | 6 | **평가 계획 검증·Human 권한 게이트 구현 / PR #1396, 실제 사진·사람 평가는 미실시** | SC-04 | human photo/cue/recommendation calibration | 실제 사진 권리 없음 |
| SC-06 | 7 | **22필드 영향도 실측·회귀·Foundation/PIE 통과 / PR #1397, 미병합** | SC-03/04/05 사전검증 | full-face sensitivity matrix (Profile→Action→Route→Domain) | 미검증 영향도를 스타일 정확도로 과장 |\n| SC-06B | 7b | **3개 구조 후보 Shadow 실험·96건 Foundation PASS / PR #1398, 미병합** | SC-06 필드 영향 분석 | 실험용 후보 3개와 96-case feasibility / 개인화 가설 평가 | 사람 검증 전 운영 추천으로 전파 |\n| SC-06C | 7c | **블라인드 A/B 7쌍·분리 내보내기 구현 / PR #1399, Foundation PASS·PIE 확인 중** | SC-06B | 기존 Human 계약, 기본 미리보기 7개 비교쌍, 운영자 매핑 분리 | 평가자·후보 역할 노출, 무허가 인물 수집 |\n| SC-07 | 8 | 미착수 | SC-05 실사진·Human 평가 및 SC-06 승인 | Style Check UX/제품 연결 | 검증 전 추천 규칙 활성화 |

### 2026-10-22 진행 상태 (SC-03)

- `FACE_LAB_OBSERVATION_DEFINITIONS`에서 실제로 정의된 필드는 **6개 그룹/22개**. Current Face Profile 대표 Key Feature는 **8개**, Structural Profile 값은 **16개**이며, 사진 색상 3개 항목은 프로필의 대표 특징·구조 필드로 소비되지 않는다. 이는 미구현 전체 진단이 아니라 **현재 제공/소비 범위의 구분**이다.
- 눈썹 구체적 형태/두께, 입술 윤곽/볼륨, 모발 상태, 보정된 피부 톤은 현재 독립 관찰 계약이 아니다. Style Check가 이를 이미 측정했다고 서술하지 않는다.
- SC-03 read-only 검사에는 수신 보류/누락, source evidence, key-feature 및 structural projection, 미등록 스키마 주입, pose/quality 별도 hold, 사진색 부적합 시 color 누락을 포함한다.
- PR #1393 (SC-02)은 base `main`, PR #1394 (SC-03)은 base `SC-02 branch`에 쌓인 상태. **CI green 전 적용·배포 불가**. 보고서의 회귀 성공은 실제 사진·스타일 적합성의 증거가 아니다.

### 2026-10-22 진행 상태 (SC-04)

- 기존 `target-responsiveness.js`는 **같은 얼굴에서 Target만 바꾸는 E3 비교**를 이미 실행하고, `axis-consumption.js`는 6개 Target 축 소비를 검사한다. 이를 재구현하거나 기존 통과 수치를 '스타일 품질'로 주장하지 않는다.
- 새 SC-04 (`evaluation/style-check-contrast-audit.js`)는 기존 Current-Contract 얼굴 modifier **4개**의 관찰 필드만 하나씩 바꿔 Face Harmony 경로와 Target Forward 경로의 차이를 확인한다. 적용할 action이 없는 경우에는 억지로 차이를 만들어내지 않고 **applicable=0**으로 기록한다.
- **검증 포인트:** 얼굴만 변경해도 Target 벡터는 불변, Target Forward의 Action/Route 의미는 불변, 적용 가능한 Face Harmony action은 수정·근거 추적, `hair_disabled/makeup_disabled`는 모든 Route action 및 도메인 실행을 차단한다.
- PR #1395는 #1394 위에 쌓인 Draft. SC-02/03/04 전부 비침습 evaluation-only이며 서로 선행 병합·재검증 없이 운영 릴리스하지 않는다.
- 실제 사용자 얼굴과 헤어·메이크업 스타일의 적합성 및 추천 유용성 판정은 다음 SC-05에서 독립 human protocol로만 수행한다.

### SC-04 첫 CI 계측치 (2026-10-22; 합성 fixture만)

- Commit `21a4c8a4`, Face Lab Foundation [39768586364](https://github.com/gycha0109-beep/K_beauty/actions/runs/39768586364)와 PIE [39768586638](https://github.com/gycha0109-beep/K_beauty/actions/runs/39768586638) **성공**.
- `syntheticInputCases=24`, `currentFaceRelations=4`, `faceModifiersTriggered=11`, `hardExclusionChecks=31`.
- `targetSwitchComparisons=12` 중 `targetSwitchChangedStyleDeltas=11`. 비교에 포함된 동일 Target 자기 비교 1건은 차이가 나면 오히려 오류다.
- 세부 applicability: `eyeDirection 3/24`, `featureContrast 2/24`, `contourDefinition 2/24`, `straightCurveBalance 4/24`. 각 applicable 건에서 face evidence와 실제 modifier 변화가 모두 확인됐고 `target_forward`는 각 24쌍에서 불변.
- **제품상 주의:** 이것은 네 가지 Current Contract 규칙의 실행 여부만 추적한 것이다. 얼굴 전체 22개 관찰 필드가 각각 스타일 추천을 개인화한다는 근거가 아니다. 해당 코호트에서 총 96개의 변경 기회 중 11개가 실제 적용 조건을 충족했지만, 이를 모집단 개인화율이나 스타일 만족도라고 해석하지 않는다.
- SC-05에서는 원본 사진 근거/실사용성 및 추천 다양성을 사람 평가로 확인해야 한다. 이 CI 기록으로 `validated_real` 또는 `production_authorized`를 올리지 않는다.

### 2026-10-22 진행 상태 (SC-05)

- **이미 존재**: `human-pairwise-contract.js`의 `target_fit / specificity / evidence_action_linkage`, uncertainty/hold, sealed Human response, operator-only A/B role reveal; 14개 synthetic pair reviewer packet builder.
- **이번 추가**: `evaluation/style-check-real-study-readiness.js` (PR #1396)은 sample-plan의 연구 목적 동의·이용 권한 **operator attestation**, 철회·삭제 프로세스 버전, subject/derivation-family dev/holdout 분리, 6개 얼굴 관찰 그룹 및 촬영조건 범위, locked holdout 과제당 독립 평가자 최소 2명 배정, blind contract/역할 매핑 비공개를 검사.
- **중요한 HOLD**: operator attestation JSON은 실제 법적 동의의 입증이 아니며, 예정된 reviewer assignment는 sealed Human judgment가 아니다. 원본 사진 접근 및 개인 연구자료 수집을 자동 수행하지 않는다. 새 계약은 `pilotExecutionAuthorized=false`, `productionAuthorization=false`.
- 상세 프로토콜: `FACE_LAB_STYLE_CHECK_SC05_REAL_PERSON_EVALUATION_PROTOCOL_20261022.md` (PR #1396). 실사진 수집·권리·독립 판정·locked holdout·평가 수치 사전등록·실서비스 승격은 각각 별도 실행/승인 과제다.

### 2026-10-23 진행 상태 (SC-06) — 전체 필드 영향도 분리

- **개정 이유:** SC-04의 `4개 Current-Contract face modifier`는 Style Delta의 action 보정에 관한 것이다. 별도 `domain/hair.js::buildStructuralModeration`은 `faceShape`, `jawWidthVsCheek`, `featureConcentration`, `faceLengthBalance`, `foreheadHeight`를 직접 참조한다. 따라서 기존 4개만 집계하면 최종 Hair 권고에 나타나는 일부 개인화를 누락한다.
- SC-06: 22개 필드의 정규화된 enum 값들을 하나씩 변경하여 **Current Face Profile Key + Structural → allowed Style Delta → Route → Domain 실행(Hair·Makeup·Color·Grooming·Eyewear·Accessories·Look)**에 전파되는지 각각 검사한다. 동일 얼굴 2개 × 12개 고정 Target = 24개 synthetic baseline. 가능한 대체 enum은 모두 순회하고, 각 필드별 실제 비교 건수·영향 건수를 기록한다.
- `candidate-style-delta.js`의 기존 `productionActive:false` Face Fit 후보는 현재 엔진과 구분해 **shadow-only** 병렬 검사한다. 기존 후보를 임의 활성화하지 않고 새 face-fit 규칙도 만들지 않는다.
- 사진상 `colorAppearance`는 현재 CurrentFaceProfile로 전달되지 않는 사실을 명시한다. 이 사실만으로 Color UX나 사진 측정 전체가 부재한다고 단정하지 않는다.
- **중요:** 민감도 0 = 해당 synthetic 구성에서 관찰 변경의 추적 가능한 downstream 영향 0. 반드시 불필요한 관찰이라는 의미는 아니다. 민감도 양성 = 변경 탐지이지 미적 적합성/정확도 통과가 아니다.
- 연구 파일: `lib/face-lab-v2/evaluation/style-check-field-impact-audit.js`; PR #1397는 #1396 위의 read-only 테스트 PR이다.
- 기존 `SC-06` 제품 연결·승격 과제는 **SC-07**로 이월한다. 기존 P3 제품 구현 착수는 Human 평가와 별도 release authorization 전까지 보류한다.

### SC-06 CI 최종 계측치 (2026-10-23)

- [Foundation #39815134570](https://github.com/gycha0109-beep/K_beauty/actions/runs/39815134570) + [PIE #39815135269](https://github.com/gycha0109-beep/K_beauty/actions/runs/39815135269): **PASS**.
- 22개 필드 × 2개 합성 얼굴 × 12 Target(24 baseline)의 **1,332개 필드 대체 검증**: Profile key 8, structural 16, Style Delta 및 Route 각각 4, 최종 실행 `value` 9.
- 최종 실행 영향 9개 = 네 action modifier `eyeDirection`, `straightCurveBalance`, `contourDefinition`, `featureContrast` + Hair 구조 `faceShape`, `jawWidthVsCheek`, `faceLengthBalance`, `foreheadHeight`, `featureConcentration`. 구조-only 라벨은 잘못된 표현: 이 5개 중 일부는 Key Feature에도 들어간다.
- Color appearance 3개는 현재 Current Face Profile/Style Delta/Route에서 `value` 변화가 0. 이는 photo-derived 피부색 정확도가 검증됐다는 뜻이 아니다.
- 작은 SC-06 cohort 후보 `candidateActivations=0`; **기존 96-case positive-control**에서 `candidateActivatedCaseCount=8`, `selectedRouteChangedCaseCount=5`, 완전 action 동일 Target 6개. Foundation [#39881306759](https://github.com/gycha0109-beep/K_beauty/actions/runs/39881306759), PIE [#39881306875](https://github.com/gycha0109-beep/K_beauty/actions/runs/39881306875) **PASS**. 후보 엔진은 여전히 `productionActive=false`.
- 정확한 필드별 수치 및 사용 목적·한계는 `FACE_LAB_STYLE_CHECK_SC06_FIELD_IMPACT_FINDINGS_20261023.md` (PR #1397). **자동 회귀 통과는 추천의 사람 선호도/실사진 정확도/출시 승인 아님**.
- 단계 구분: SC-06 *연구용 프로필·실행 민감도* 완료, SC-05 실사진·사람의 독립 평가 미실행, SC-07 UI·운영 반영 보류.

### 2026-10-23 진행 상태 (SC-06B) — 실행 영향 없는 구조 관찰의 가설 실험

- SC-06 결과에서 **Style Delta 4개 + Hair 실행 주의사항 5개 = 총 9개** 필드가 최종 실행에 영향을 미쳤다. 그 외 **구조/눈/배치 10개**는 당시 synthetic 테스트에서 execution 변화가 없었고 **Color appearance 3개**는 별도 하위 연구.
- 새 연구 PR #1398은 이 10개 중 *턱선 각도(`jawlineAngularity`), 눈 개방감(`eyeOpenness`), 특징 크기(`featureScale`)* 세 가설을 `evaluation/*` 연구 전용으로 생성한다. 기존 action의 `strength`만 낮추는 대안이며 **'어울린다'는 단정이나 신규 production heuristic이 아니다**.
- **게이트**: 승인된 Target + `face_harmony` + 현재 관찰값 가용 + 기존 action 정확 일치 + 허용된 scope/constraints. `target_forward`, 미승인 Target, 삭제된 관찰값, hard exclusion에서는 후보 효과가 없어야 한다.
- 테스트: **8 synthetic face × 12 Target = 96건**, 각 후보별 적용/Route 변화 카운트, 통제 가능한 양성 사례 및 suppression 회귀. 사람 평가·실사진 적합성이 검증되지 않았으므로 `productionActive:false` 보존.
- 세부 설계: `FACE_LAB_STYLE_CHECK_SC06B_STRUCTURAL_SHADOW_20261023.md` (PR #1398). 나머지 7개 미반응 구조 관찰은 임의 규칙 확장 전 Human 평가 질문과 정책 근거를 요구한다.
- SC-06B 이후에도 **SC-07 운영 화면/실제 추천 반영은 Human evidence·릴리스 승인 전 보류**.

### SC-06B 첫 실측치 (2026-10-23)

- [Foundation #39882857476](https://github.com/gycha0109-beep/K_beauty/actions/runs/39882857476), 8개 합성 얼굴 × 12 추구미 = 96건: Shadow action 변화 14건, route 구성 변화 9건, `target_forward` 변경 0/96.
- 세 후보: 턱선 각도→안경 각도 강조 조절 **10건(그중 Route 5)**, 눈 개방감→눈 바깥쪽 강조 조절 **4건(Route 4)**, 이목구비 크기→포인트 대비 **0건(Route 0)**. 세 번째는 isolated positive control에서 작동하지만 해당 코호트에 적용 사례가 없음.
- 수치는 **전부 synthetic feasibility**. A/B 사람 평가, 실제 인물 동의/표본, styling validity는 0이며 전부 `productionActive:false`.
- 자료: PR #1398의 `FACE_LAB_STYLE_CHECK_SC06B_STRUCTURAL_SHADOW_20261023.md`. 사람 평가 전 권고 정책의 자동 반영 없음.
- **로드맵 보고 기준**: PR·CI 기준 기술 단계의 완료와 실제 사람 검증·production 승인/병합은 별도 축으로 시각화한다. 단순 '7/8 완료'로 제품 출시 준비도를 과장하지 않는다.

### 2026-10-23 진행 상태 (SC-06C) — 구조 후보 사람 평가 자료 생성

- 기존 Face Lab Human Pairwise 계약을 재사용한다. `target_fit`, `specificity`, `evidence_action_linkage`, `tie/uncertain/not_assessable` 유지.
- **9건 Route 차이 ≠ 9개 reviewer-visible 비교쌍**. SC-06B의 14건 candidate 변화 중 **기본 선택 Route의 A/B 추천이 다른 7쌍**만 blind packet에 포함; 나머지 7건은 선택 경로가 같으므로 평가 왜곡 방지를 위해 제외.
- 리뷰어 packet과 operator manifest에 각각 SHA-256 digest 적용. 후보 relation ID, 실험용 설명과 `current/candidate` 매핑은 reviewer 측에서 제거; current 역할 A/B 배치는 균형을 맞춤.
- `SC-STRUCT-003`은 기존 96건 코호트 활성화 0이므로 별도 긍정 통제 테스트에서 기술적 실행 가능성만 확인. **사람 평가 표본으로 위장하지 않음**.
- **실제 Foundation #39884553269 PASS**: Reviewer 7쌍(턱선 각도 5·눈 개방감 2), 역할 A current 4개/B current 3개, SHA-256 무결성·변조·역할 누출 검사 통과. `SC-STRUCT-003` 활성화 표본 0건은 포함하지 않음. 최종 PIE는 별도 확인한다.
- 실사진·Human judgment는 0건. 실사진 연구 동의/권리·sealed 판단·실사용 적합성/효용 검증은 미실행. SC-07 운영 릴리스 보류.

### SC-06C 두 결과물의 실행 가능 계약

- `scripts/export-face-lab-style-check-structural-human-packets-sc06c.mjs`: CLI로 합성 reviewer packet / confidential operator mapping을 서로 다른 **저장소 밖** 디렉터리에 `wx` write-once 생성, 기존 파일 덮어쓰기 금지, 같은 폴더/저장소 내부 출력 금지, 부분 실패 시 reviewer 파일 삭제.
- 두 JSON을 평가자에게 함께 전달하면 blinding 무효. CLI의 분리는 안전한 **파일 생성 가드**일 뿐 연구자/평가자 실제 권한 통제를 대신하지 않는다.
- 기존 Human 판단·sealed review·role reveal·real photo validation은 미실시. **이 항목은 7쌍의 평가자료 준비 완료**이며 Human 선호도 점수는 0건.
- 구현 PR: [#1399](https://github.com/gycha0109-beep/K_beauty/pull/1399), 상세 문서 `FACE_LAB_STYLE_CHECK_SC06C_BLIND_HUMAN_PACKET_20261023.md`.

## 5. 체크리스트/실행 운영

- 각 PR에 `baseline_sha`, affected-domain, source evidence, new hold path, 1-1 regression, rollback 명시
- 첫 구현 CI: 기존 `scripts/verify-face-lab-v2-foundation.mjs`에 *read-only* auditor regression 연결
- SC-02 성공 후 SC-03/SC-04 순서: 근거 없는 자동 스타일 정확도 숫자 표시 제거는 분석 이후 별도 승인 PR
- ROI v1–v3는 `personal-color/*` 독립 research lane. 볼 외 얼굴 전체 분석을 ROI raster로 대체하지 않는다.
- 기술 완료 지표와 사용자/실사진 검증 완료 지표를 반드시 별도 표시한다.
