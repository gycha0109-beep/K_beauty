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

### W3 — 추천의 목표 적합·다양성 [P1–P2; SC-04 착수 / PR #1395]

- 동일 관찰 × 다른 Target/priority/scope/time/budget 및 같은 Target × 다른 구조 관찰로 반사실 테스트
- target_forward와 face_harmony의 이유 추적, hard exclusion 위반 0
- Hair-led / Makeup-led / Balanced / Low effort 등 가능한 Route의 겹침·실행 비용/유지 가능성 비교
- 단일 Archetype label을 행동 추천 lookup key로 사용 금지

**완료 게이트** route collision/원인 설명 누락/미지원 도메인 거짓 생성 0 (정책 invariant), 미학적 유용성 평가는 W4로 분리.

### W4 — 실제 사진·사람 평가 [P2; W3 이후, 별도 승인된 표본만]

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
| SC-04 | 5 | **반사실적 추천 비교 구현 / PR #1395, CI 확인 중** | SC-02/03 | face/target/constraint contrast suite | 허위 사용자 선택 |
| SC-05 | 6 | 미착수 | SC-04 | human photo/cue/recommendation calibration | 실제 사진 권리 없음 |
| SC-06 | 7 | 미착수 | SC-03/04/05 승인 | Style Check UX/제품 연결 | 미확정 품질의 production 승격 |

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

## 5. 체크리스트/실행 운영

- 각 PR에 `baseline_sha`, affected-domain, source evidence, new hold path, 1-1 regression, rollback 명시
- 첫 구현 CI: 기존 `scripts/verify-face-lab-v2-foundation.mjs`에 *read-only* auditor regression 연결
- SC-02 성공 후 SC-03/SC-04 순서: 근거 없는 자동 스타일 정확도 숫자 표시 제거는 분석 이후 별도 승인 PR
- ROI v1–v3는 `personal-color/*` 독립 research lane. 볼 외 얼굴 전체 분석을 ROI raster로 대체하지 않는다.
- 기술 완료 지표와 사용자/실사진 검증 완료 지표를 반드시 별도 표시한다.
