# [Face Lab] BEJEWELY Face Lab V2 — 제품 완결 로드맵

> **상태:** 제품 완결 기준 / 실행 추적용 canonical 로드맵 (2026-10-13)  
> **현황 확인 기준:** `main@5272378c3f561407629e4c91a42d80baa1f520c3`, 최신 Open PR 목록, 현재 Face Lab V2 코드  
> **Owner:** `face-research` / **문서 권위:** 제품 목표는 `페이스랩 정의 V2 (2026-09-24)`, 관찰·보안 불변식은 `FACE_LAB_MASTER_SPEC`, 평가 근거는 `FACE_LAB_EVALUATION_STRATEGY`. 본 문서는 **개발 계획과 수용 기준**이지 운영 승인이나 새 분석 authority가 아님.  
> **최신 의사결정:** 공통 Face Lab 촬영 주의 문구는 **처음 사진 업로드/촬영 화면 한 곳**에만 두 문장으로 안내한다. 퍼스널 컬러 결과 화면에 포괄적 한계 경고를 반복하지 않는다.

## 0. 완성의 정의와 우선순위

**Face Lab = 얼굴 기반 스타일 의사결정 내비게이터.** 외모 평가/관상/성격 진단이 아니라, 사용자가 추구미를 고르고 **현재 얼굴 → 목표 스타일 → 차이 → 비교 가능한 여러 경로 → 근거 있는 실행안 → 승인된 실물 옵션 → 저장/재비교**를 이어갈 수 있어야 한다.

```text
업로드/촬영 (공통 2문장 안내, 선택 강제 아님)
 → 원본 사진 일시 분석·Eligibility/Quality
 → 관찰 근거 기반 Current Face Profile
 + 직접 선택 또는 5-round Finder로 찾은 Target Style
 + Styling Scope / 변화 정도 / 현실 제약
 → Style Delta → Route A/B/C (사용자 선택 전 미확정)
 → Hair / Makeup / Color / Grooming / Glasses / Accessories
 → Route Comparison + Visual Conflict + Look Composer
 → (선택) 사진 기반 Personal Color 추정/팔레트 제안
 → 실제 승인된 제품/색상(Shade), 적용 방법, 참고 이미지/가상 룩
 → Premium 저장·재진입·경로 전환
```

### 제품 완결과 출시 가능은 서로 다른 상태

- **제품 구현 완료:** 아래 M0~M5의 사용자가 직접 이용하는 필수 경험이 동작하고, 검증되지 않은 부가 기능은 비활성/명시적 미제공 상태이며, 실제 기기 수용 테스트가 완료된 상태.
- **릴리스 준비 완료:** 제품 구현 완료에 더해 M6 보안·권한·성능·운영·결제·원본 사진 경계·실제 데이터 및 CI 게이트가 승인된 상태.
- **진행 원칙:** 보안 SCA #1208은 병렬 트랙. **개발·Draft PR 작성은 허용**; 해당 브랜치의 필수 보안 검사 FAIL 상황에서 **병합/운영 배포는 보류**. **SCA-7 전체 종료가 모든 개발의 선행조건은 아님.**
- **비목표:** 외모 점수/순위, 관상·성격·건강·인종 추론, Archetype 기반 강제 추천, 한 장의 일반 사진만으로 계절형 퍼스널 컬러 단정, 비승인 상업용 이미지·제품 생성, 테스트 fixture를 실제 카탈로그로 표시.

## 1. 현재 기준선 — main에 있는 것과 Draft를 구분

| 기능 | main 상태 | 완결까지 남은 것 |
| --- | --- | --- |
| 사진 관찰 / 품질·Eligibility / Current Face | **기술 구현**: `app/api/face-reading/route.js`, `lib/face-lab-v2/current-face-profile.js` | 현장 촬영·실기기·오류 인수 |
| Target 선택(known/partial/unknown), 5-round Finder | **기술 구현**: `PremiumFaceLabSection.jsx`, `target-finder.js` | 사용자 행동 검증, 승인된 실물 이미지 reference |
| Target Style / Style Delta / Route 후보·비교·명시적 선택 | **기술 구현**: `target-style-mapper.js`, `style-delta.js`, `route-generator.js`, `route-choice-evidence.js` | 추천 품질·경로 차별화/사람 평가 |
| Hair/Makeup/Color/Grooming/Glasses/Accessories / Look | **규칙 기반 구현**: `domain/*`, `look-composer.js` | 실사용 참조/상품·Shade·영역 간 충돌 UX |
| Premium UI·저장/재진입 | **main 기본 구현** | [#1264](https://github.com/gycha0109-beep/K_beauty/pull/1264)의 복구/취소 보수는 Draft·미병합, 실제 모바일 인수 전 |
| 얼굴별 추천 개인화 | **vCurrent 제공; 실효성 미검증** | 합성 8 faces × 12 targets에서 12 targets 중 6개가 얼굴별 동일 action signature. vCandidate-1 + Human 검증 필요 |
| Blind Pair 사람 평가 | **main에 builder/contract**, 실제 독립 응답 0건 | [#1242](https://github.com/gycha0109-beep/K_beauty/pull/1242) 봉인·리뷰 도구 Draft; 실제 독립 평가·승격 판단 |
| Personal Color 정식 추정 | **미구현** | 품질 기반 색채 관찰·다수 특징·팔레트 및 제한적 유형 후보 추정·평가 |
| Face Lab 실행 카탈로그·공개본 읽기 | **독립 pure/dry-run 계약** | 운영 승인 데이터·Product/Variant/Shade identity·서버 조회·철회 |
| 실제 SKU / Shade / source | **미완료** | 실제 승인된 상품/옵션 데이터, 출처·재고/판매 URL 사실성 |
| Visual Try-On / 가상 룩 | **내부 계약·시뮬레이션·Provider pilot 도구** | 사용자 UI/권한·구매 전후 동선·별도 실제 provider canary·비용·이미지 사용권 |
| Production 대상 동일성 | **HOLD** | Production DB ref와 migration reconciliation의 별도 owner 승인, 실제 읽기/쓰기 |

**중요:** 최신 제품 보수/카탈로그 PR을 main에 합쳐진 기능으로 보고하지 않는다. 검증 PASS인 fixture도 실제 사람 평가, 운영 DB 연결, 판매 가능한 SKU의 증거가 아니다.

## 2. 마일스톤과 의존성

| 순서 | 마일스톤 | 완료 산출물 | 의존 관계 |
| --- | --- | --- | --- |
| **M0** | 기본 플로우·공통 촬영 안내 마감 | 제품 UI와 persistence P0 인수 | 즉시 가능 |
| **M1** | 얼굴별 개인화 추천 품질 | Human 비교에 근거한 현행 유지/후보 승격 결정 | M0 UX 회귀와 병렬, Human 모집 별도 |
| **M2** | 일반 사진 기반 Personal Color | 색채 특징·팔레트·불확실성 보존·사용자 비교 | M0 사진 품질·보안 경계 재사용 |
| **M3** | 실제 실행 카탈로그 / SKU·Shade | 승인된 데이터 1개 이상으로 전 과정 검증 | 독립 자료 및 운영권한 확보 전 mock/dry-run만 |
| **M4** | 사진·상품 시각 경험 및 Try-On | 비교·적용/룩·저장 사용자 경로 | M3 승인 참고/제품, 별도 Provider/비용 승인 |
| **M5** | Premium 제품 인수와 차별화 완성 | 실제 사용자 End-to-End + UX/성능/접근성 기준 | M0~M4의 필수 통과 |
| **M6** | 출시 게이트 | exact-head 운영/보안/데이터/결제/권한 PASS | 독립 승인, SCA 포함 필수 CI 통과 |

**병렬 작업:** M1 Human 평가 준비·M2 순수 알고리즘·M3 비운영 후보 매칭은 동시에 수행할 수 있다. **외부 자료/참가자/Production 권한 미확보 시 해당 단계만 HOLD**하며 다른 단계는 중단하지 않는다.

## 3. M0 — Premium 기본 사용자 여정 마감 (우선 실행)

### M0-A · 공통 사진 진입 안내

- Face Lab 기능이 시작되는 실제 **촬영/사진 선택 지점**을 조사하고 1회만 노출. 피부 분석과 사진 진입을 공유하면 한 곳에서만 노출한다.
- 고정 문구 (ko, **2문장**): **“Face Lab은 사진에 나타난 얼굴 특징과 색감을 바탕으로 스타일 방향을 분석합니다. 조명·각도·필터에 따라 결과가 달라질 수 있으니, 가능하면 밝고 고른 빛에서 필터 없이 얼굴이 잘 보이게 촬영해 주세요.”**
- 영어도 2문장. 안내는 **권장**이지 동의 강제/촬영 차단/품질 게이트가 아니다.
- 결과 화면에 촬영 조건의 일반 한계 배너를 중복하지 않는다. 단 영역별 `unknown / partial / insufficient_evidence / unavailable` 상태 자체는 표시한다.

### M0-B · 승인·편집·재진입

- `known / partial / unknown` 세 진입, Finder `a/b/both/neither/back`, inconclusive → 직접 선택을 모바일에서 테스트.
- Target/Scope 제약 변경은 **확인 시점**에만 새 authority. Route 비교 중 default preview를 실제 선택으로 위장하지 않는다.
- 명시적 Route 선택 → Hair/Makeup/Look/제품 실행 → 저장 → 새로고침/세션 재진입/다른 saved report 전환.
- 취소된 편집은 기존 승인 Target/Scope/Route/시뮬레이션 결과를 복원. 동일 payload 재저장과 비동기 서버 응답 역순을 다룬다.
- 인터넷/인증/localStorage 실패·서버 409 충돌은 정확하게 보여주고 overwrite 금지. 빈 결과·분석 불충분에서 사용자는 수정/재시도 경로를 찾을 수 있어야 한다.
- **현재 코드 작업:** [#1264](https://github.com/gycha0109-beep/K_beauty/pull/1264)를 최신 main에 비파괴 동기화하고 해당 PR 검증·실기기 수용. 별도 승인/CI 해결 전 병합 금지.

**DoD:** 3 진입 모드 × 선택/취소/저장/재진입/연결 끊김 동선 실기기 통과, 미선택 실행/가짜 제품 노출 0, 중복 경고 0, 반응형/접근성/다크모드 확인. **기존 node verifier PASS만으로 UAT PASS 주장 금지.**

## 4. M1 — 진짜 사용자별 추천 개인화

- 기존 `vCurrent`와 비활성 `vCandidate-1`을 동일 사용자/Target/제약 조건에서 쌍으로 비교. 합성 평가가 genericity 신호이지 실제 사람에 대한 정답은 아님.
- E1/E2 [#1242](https://github.com/gycha0109-beep/K_beauty/pull/1242) 봉인된 offline pack → 별도 동의받은 평가자 → blind pair → `target_fit / specificity / evidence_action_linkage` 독립 평가 → consensus / 보류 결과.
- 사용자 얼굴·raw photo·평가 참가자 개인정보를 GitHub/CI fixture에 포함하지 않는다.
- 실제 평가가 지지하는 결함에만 `Current Styling Baseline` 자가 보고(최소 질문, unknown 허용) 등 vCandidate-2를 탐색. 얼굴 해부학 관찰과 이미 하고 있는 메이크업/헤어 상태를 구분한다.
- 추구미가 같은 얼굴들의 Route 결과가 왜 다르거나 같은지 근거와 constraints를 점검. 경로 다양화만을 위한 무근거 다양성 금지.
- candidate 승격은 **별도 실증 및 owner 승인**; 실사용 검증 없는 새 정책의 silent production activation 금지.

**DoD:** 실제 독립 Human 평가 증거·평가자 간 불일치·모델 개선/후퇴 조건이 남고, `Current vs Candidate`의 승인/보류가 명시됨. 저품질 근거의 화려한 개인화를 성공으로 처리하지 않음.

## 5. M2 — 일반 사진 기반 Personal Color (2026-10-13 추가 제품 범위)

> 이 단계는 기존 2026-09-24 V2의 `Color = 추구미를 표현하는 색상 실행 엔진`과 **다른 신규 기능**이다. 기존 `domain/color.js`의 warmCool(추구미) 축을 사용자의 실제 피부 웜·쿨 적합도 진단으로 둔갑시키지 않는다. `FACE_LAB_MASTER_SPEC`의 “한 장의 일반 사진으로 계절형 확정 금지” 유지.

**M2-A · 비차단 입력과 관찰**

- M0 공통 2문장 안내 재사용. 전용 Personal Color 경고/반복 결과 한계 고지 추가 금지.
- 기존 `quality.colorSuitability / whiteBalance / lightingUniformity / filterOrEditing` 활용. 품질 부족해도 **사진 업로드 자체는 진행**하고 판단할 수 없는 채널은 `unknown`으로.
- 얼굴 랜드마크 기반 볼/이마 등 유효 픽셀 영역, 메이크업·눈썹·그림자·배경 제외 규칙. 기기·광원·화이트밸런스 왜곡은 차후 검증 항목이며 완전 자동 보정 성공 주장 금지.
- Lab/LCH에서 밝기·색도·온도 방향과 얼굴 전체 대비를 **관찰 특징**으로 추출. 가능한 경우만 색상 근거 제공; 코사인·RGB 거리만으로 잘 어울림 판정 금지.

**M2-B · 팔레트 및 유형 후보**

- `PersonalColorObservation`(측정된 겉보기 정보), `PersonalColorCandidate`(색상 특성/계절 후보), `StyleColorExecution`(추구미 표현용 색 방향)을 분리한 계약을 먼저 설계.
- 명도/채도/온도의 후보 범위 → 팔레트 제안 → 립/블러셔/헤어 컬러 속성에 연결. 필요 시 사용자 A/B 팔레트 비교를 **선호 피드백**으로 수집할 수 있으나 실제 드레이핑의 피부 반사광 변화와 동일시하지 않는다.
- 충분한 검증 근거가 없는 동안 4계절·12유형을 정확한 정답처럼 필수로 출력하지 않는다. 근거 있는 후보/추정/판단 불가 상태만 표시.
- 결과의 중심은 **팔레트와 실행 방향**. 촬영 조건에 대한 포괄적 사과/한계 배너를 붙이지 않되, 실제 결과 상태·근거 범위는 속이지 않는다.
- 사진 원본/crop/raw Provider output의 새 저장은 별도 개인정보 승인 전 금지; 연구·검증 데이터는 별도 동의.

**M2-C · 검증**

- 동일인 반복 촬영(다른 조명/기기), 피부 명도 범위, 메이크업/필터/음영 시나리오, 전문가 비교 자료가 있을 때의 합치·보류율을 기록.
- 색 추출 재현성, `unknown` 처리, 허위 유형 강제 부여 없음, 동일 사진/시드의 결정론적 재생, 기존 스타일 추천과 authority 충돌 0 검사.

**DoD:** 사진 선택 강제 없이 한 번의 입력으로 근거가 있는 팔레트 후보·액션 제공; 색상 부적합 사진은 억지 유형 확정 없이 안전 처리; 실제 사진/기기 테스트 수행. **전문가 검증 데이터 없는 12유형 정밀 정확도 광고 금지.**

## 6. M3 — 실제 실행 카탈로그와 Product/Variant/Shade

- 실제 사용 가능한 `Hair/Makeup/Grooming/Glasses/Accessories` 실행안 → technique → specification → **승인된** Product/Variant/Shade 연결.
- 색조는 Product와 Shade 별도 identity. 단위는 판매 가능 Variant/Shade; 제품명만 같다고 같은 색상으로 매칭하지 않는다.
- 이미 존재하는 Face Lab 독립 실행 카탈로그 `independent-*`의 `ready/blocked/not_ready` 및 published-read dry-run 활용. 공용 스킨케어 분류를 우회/강요하지 않음.
- 데이터 입수 → candidate → Review → 승인 → 공개 → 철회(접근불가)가 작동해야 하며, 잘못된 Shade·미승인 이미지·미확인 출처를 정상 추천에서 배제.
- [#1233](https://github.com/gycha0109-beep/K_beauty/pull/1233)은 미병합 Subject/Variant 연결 후보. [#1225](https://github.com/gycha0109-beep/K_beauty/pull/1225), [#1209](https://github.com/gycha0109-beep/K_beauty/pull/1209), [#840](https://github.com/gycha0109-beep/K_beauty/pull/840) 은 운영 DB/마이그레이션/권한 문제와 결합되므로 별도 owner 트랙.
- 로컬 승인 fixture로 화면을 검증할 수는 있지만 이를 실제 상품 목록으로 표시하지 않는다. 운영 DB ref·RLS·migration 동등성과 승인 불확실하면 실제 저장/조회는 **HOLD**.

**DoD:** 적어도 1개 검증된 실제 SKU + 정확한 Shade 또는 사용자 실행 스타일 자료가 화면에서 제공되고, 동의한 사용자가 제품/옵션 선택 → 재조회 → 품목 삭제·철회 → 재진입 경로까지 실제 source/권한 확인. 출처가 없으면 정상적인 `not_ready` UI.

## 7. M4 — 비교 시각화, 참고 이미지, AI Try-On

- Target Finder 5-pair의 예시를 실질적인 스타일 비교 경험으로 개선. 이미지가 승인되지 않았으면 기존 설명형 카드를 실제 reference 사진처럼 보이게 하지 않는다.
- Hair/Grooming/Glasses/Accessories 실행 카드에 실제 시도 가능한 레퍼런스/설명/시각 차이를 연결.
- Visual Conflict: Style Delta 근거와 적용 영역이 존재할 때만 상충 주의. 임의의 외모 취향 규칙을 시스템 사실로 추가하지 않는다.
- 기존 `visual-try-on-*`·appearance handoff·Render Spec·private pilot 경로 활용. 사용자가 명시한 Route와 선택한 Product/Shade/영역만 적용.
- Before/After, 경로별 Look 전환, 취소·저장·재진입, 여러 영역 공존, 원본 얼굴 동일성·마스킹, 잘못된 합성 실패 상태를 사용자 흐름으로 완성.
- **비용·권한:** mock/offline → reference/source/사용권 확인 → 별도 승인된 제한적 유료 canary → 실제 사용자 출시. 이미지 생성/사진 저장은 개발 편의상 자동 활성화 금지.

**DoD:** 1개 이상의 승인된 reference/선택된 실제 옵션으로 얼굴 동일성 및 적용 범위 보존, 뷰 전후 비교/다중 룩 전환, 실패·재요청, 비용 상한, 재진입을 실사용 검증. 품질 미입증 기능은 분리된 비활성 상태로 유지.

## 8. M5 — Premium UX / 제품 품질 최종 인수

- **Free/Premium:** 같은 canonical 얼굴 분석을 기반으로 Free teaser ↔ Premium 해금. Premium 구매 후 Face Lab 별도 설문, 비교/선택/실행이 끊기지 않는다. 얼굴 관찰을 사용자의 추구미로 오염시키지 않는다.
- **상태/UX:** ineligible / unavailable / partial / needs_confirmation / source_not_ready / permission_denied / provider_error를 구분하고, 보류/오류를 정상 카드로 변환하지 않는다.
- **모바일:** 실제 Android·브라우저에서 카메라/이미지 방향/파일 선택, 업로드, 얼굴 근거, 추구미, 하단 길이, 경로 비교 표의 가로 스크롤, 다크모드, 접근성, 뒤로·취소·다른 리포트 전환 검증.
- **개인화/정직성:** 같은 추구미에도 얼굴/제약 변화에 따라 적절한 실행 차별화가 있는지 확인. Human 검증 근거를 명시하지 않은 마케팅 수치 금지.
- **기능 수용:** 실제 사용자 E2E 시나리오와 재현 스크립트를 저장하며 회귀 이슈별 P0/P1 구분. 실패/상태/실제 상품 부족은 숨기지 않는다.

**DoD:** 기준 사용자 여정(Free → Premium → 사진 → Target/Finder → Route 선택 → 실행 → 선택 자료 → 저장/재진입/변경) 실제 환경 PASS, Android 실기기 검증, Blocker 0, 근거 기반 중요 품질 결함 조치/명시적 HOLD.

## 9. M6 — 안전한 출시 승인

- **Security/CI:** exact-head Main Health, Face Lab Foundation, PIE, CodeQL, Supply Chain 등 해당 브랜치의 필수 검사 PASS. #1208 종속성 취약점 예외 우회 금지.
- **운영 데이터:** Production identity·migration/RLS/읽기 권한·상품 승인/철회·사용권 확인. 운영 변경은 별도 승인 전 실행 금지.
- **민감정보:** 기본 사진 원본·crop·base64/raw Provider 응답 비저장 경계. Human 연구 활용은 서비스 사용 동의와 별도.
- **Provider:** 실제 분석/합성 호출의 timeout/비용/요금/오류/재시도·게이트와 반환 정합성 검증.
- **결제/릴리스:** Premium unlock·청구·분석 실패 시 recovery, 고객 안내, rollback, 관측성, 정책 준수.
- **결정:** `PRODUCT_READY`와 `RELEASE_READY`를 **별개로 기록**. 제품 개발 결과가 PASS라도 SCA 미해결이면 병합/실배포는 HOLD.

## 10. 바로 다음 실행 백로그 (우선순위 고정)

1. **Now / P0:** 공통 2문장 촬영 안내의 실제 사진 진입 연결; 단일 노출/비차단/ko-en/모바일 회귀. 관련 소스·사진 흐름 진단 먼저.
2. **Now / P0:** [#1264](https://github.com/gycha0109-beep/K_beauty/pull/1264) 저장 실패·수정 취소·미확정 Route 버그의 exact-head 재검증, 실제 브라우저 UAT. 자동 병합 금지.
3. **Parallel / P1:** [#1242](https://github.com/gycha0109-beep/K_beauty/pull/1242) 실제 Human 평가자 모집 전까지 독립 평가 자료·화면 점검, vCandidate-1 prod 비활성.
4. **Next / P1:** M2 Personal Color **관찰 스키마 → 순수 특징 추출 → 테스트 fixture/보류 계약 → 팔레트 UI**. 계절형 정확도를 검증 데이터 없이 강제하지 않는다.
5. **Next / P1:** M3 독립 실행 카탈로그 상태 UI / Product·Shade exact matching dry-run, 운영 데이터 없이도 개발 가능.
6. **After authorization:** 실제 SKU 승인/조회, 참고 이미지 및 Provider 유료 canary, Human 수용, M5/M6.

### 작업 PR 단위

- 한 PR = **한 milestone의 좁은 코드/문서 범위**, 다른 팀/CI/스키마 보호 영역 변경 금지.
- PR마다 `현재 HEAD / 변경 파일 / 재현 조건 / 명령·CI / 제품 검증 범위 / 남은 권한·품질 리스크 / 다음 PR` 기록.
- **새 Face Lab 브랜치:** `face-lab/<type>-<work>-YYYYMMDD` 예: `face-lab/feat-personal-color-observation-20261013`; **PR 제목** `[Face Lab] ...` 필수.
- 이전 PR·브랜치 인덱스 및 안전한 브랜치 전환법은 `FACE_LAB_BRANCH_REGISTRY.md` 참조. 열린 PR의 HEAD를 임의 교체하거나 오래된 브랜치를 지워 이력을 잃지 않는다.

## 11. 확인 근거 / 문서 권위

1. 사용자 확정 **`페이스랩 정의 V2 260924.md`**: 스타일 내비게이터·Free/Premium·Phase 1~4·실행 카탈로그·Shade·Look Composer의 제품 범위.
2. **`FACE_LAB_MASTER_SPEC`**: Vision/추천 책임 분리·사진 저장 및 민감 추론 금지·evidence/status·Free/Premium canonical 공유.
3. **`FACE_LAB_EVALUATION_STRATEGY`**, `face-lab-v2-vcandidate-personalization-design-v1.md`, `face-lab-v2-end-to-end-completion-audit-v1.md`: Human vs synthetic 검증 경계·현재 후보 상태.
4. **`face-lab-v2-p1-d2c-independent-execution-catalog-design-v1.md`**, **`face-lab-v2-visual-try-on-v1.md`**: 승인된 실제 후보와 provider 시각화 단계.
5. 실제 `main` 코드, GitHub Open PR, 관련 verifier; 미병합 PR은 구현 완료된 main이 아님.
6. 2026-10-13 사용자 신규 결정: **일반 사진 비차단 Personal Color 추정(별도 기능)** + **Face Lab 공통 업로드 안내를 시작 시에만 2문장**. 이 추가 범위는 9월 V2 원문에 없으며 원문의 `Color Engine`과 구분한다.

**완료 판정 절차:** 각 M 종료 시 `완료/중요 이슈 없음/외부 자료·실행 필요`를 분리 기록. 확인 불가능한 실제 Human·실기기·운영 데이터는 외부 실행 필요로 종료하고 성공으로 포장하지 않는다.
