# Face Lab V2 — Product Completion Roadmap

> 기준일: 2026-10-13
> 현재 코드 기준: `main@0bf7066579fde00c31bf8bb8b97046d2ee5023f7`
> 책임: `face-research`
> 문서 성격: **기존 V2 제품 정의에 대한 구현 현황과 다음 개발 순서의 단일 진입점**. 기존 상세 계약을 대체하지 않는다.
> 현재 위치: **Phase 2 기술적 vertical slice 구현 → Phase 3 실사용 실행/상품 연결로 이동**, 추천 개인화 품질 개선 병행
> 배포/운영 상태: **이 문서만으로 출시 승인이나 Product/Supabase/Provider 권한이 부여되지 않는다.**

## 1. 제품 목표와 최종 완성점

2026-09-24 `페이스랩 정의 V2`에서 고정한 제품 목표를 따른다.

**Face Lab은 얼굴 분류기가 아니라 얼굴 기반 스타일 내비게이터다.**

```text
사진 기반 Current Face Profile
+ 사용자가 직접 선택하거나 찾아낸 Target Style
+ Styling Scope / 변화량 / 현실적 제약
→ Style Delta
→ 복수 Route 제시와 비교
→ 사용자가 명시적으로 한 경로 선택
→ Hair / Makeup / Color / Grooming / Eyewear / Accessories 실행
→ 충돌 검토와 Look Composer
→ 실제로 선택 가능한 행동 / 승인된 제품·옵션 / 착용·적용 경험
→ 하나의 canonical 결과를 저장하고 재진입·경로 변경
```

**최종 완료 정의:** 사용자가 본인의 추구미를 정한 후, 얼굴 근거가 연결된 차별화된 실행안을 이해하고, 경로를 비교해 선택하고, 실제 승인된 선택지(행동 또는 제품/색상)를 실행할 수 있으며, 저장/재진입이 정상 동작한다. 사진 품질 불충분·판정 보류·자료 미승인·사용권 철회는 성공 결과로 위장하지 않는다. 유료 이미지 생성은 별도 승인된 확장 경로다.

Face Lab V2에서 동물상/Archetype은 `funOnly` 보조 정보다. 얼굴형 하나로 스타일을 결정하지 않는다. `FACE_LAB_MASTER_SPEC.md`의 초기 Archetype 중심 목표보다 2026-09-24 V2 제품 방향을 제품 UX·개발 우선순위에서 우선한다. Vision의 관찰 책임, 증거, 개인정보 경계는 유지한다.

## 2. 구현 현황 — 실제 main과 Draft를 분리

판정: `구현`은 코드가 존재하는 상태, `품질 검증`은 실제 Human/현장 수용까지 별도 입증된 상태를 뜻한다.

| 구성요소 | 현재 판정 | main 근거 / 주의 |
| --- | --- | --- |
| 사진 관찰 → Current Face Profile | **기술 구현** | `app/api/face-reading/route.js`, `lib/face-lab-v2/current-face-profile.js`, `canonical-composer.js`; 모든 사진에서 품질 보증은 아님 |
| Target Style 선택·Target Finder·설문 | **기술 구현 / UX 보완 필요** | `target-finder.js`, `target-style-mapper.js`, `PremiumFaceLabSection.jsx`; Target Finder A/B 카드는 현재 색 그라데이션과 텍스트 cue, **실제 승인 이미지 레퍼런스는 아님** |
| Style Delta·복수 Route·명시적 선택·비교 | **기술 구현** | `style-delta.js`, `route-generator.js`, `route-choice-evidence.js`, `FaceLabV2Result.jsx`; synthetic end-to-end verifier 존재 |
| Hair·Makeup·Color·Grooming·Eyewear·Accessories·Look Composer | **규칙 기반 실행안 구현** | `domain/*`, `look-composer.js`; 추천 설명/사양의 존재는 실상품 판매/재고/착용 가능성 보증 아님 |
| Premium Face Lab 화면·저장/재진입 | **코드 경로 구현 / 실기기 UAT 미확정** | `PremiumFaceLabSection.jsx`, `app/api/premium/face-lab-v2/route.js`, `persistence-state.js`; 실사용 환경 전체 회귀 완료 주장 금지 |
| vCurrent 얼굴별 개인화 | **동작, 개선 필요** | 8 faces × 12 targets의 합성 평가에서 12 targets 중 6개가 모든 얼굴에 동일 action signature. 이 값은 미적 실패 확정이 아니라 개선 탐색 신호 |
| vCandidate-1 Face Fit 개선 후보 | **진단 코드 구현 / 비활성** | `candidate-style-delta.js`, `personalization/*`, `evaluation/candidate-personalization.js`; production 활성화 금지, Human 검증 0건 |
| Human blind pair 평가 도구 | **기본 builder/contract는 main, 실무 E1/E2는 Draft** | main: `evaluation/human-pairwise-builder.js`, `human-pairwise-contract.js`; [#1242](https://github.com/gycha0109-beep/K_beauty/pull/1242) = 미병합 offline seal/확인 도구. **실제 사람 평가 증거 0건** |
| 독립 Face Lab 실행 후보·미리보기·공개본 읽기 | **순수 함수/가짜 자료 dry-run까지 구현** | `independent-execution-candidate.js`, `independent-look-preview-bridge.js`, `independent-catalog-published-read-core.js`(`dry-run`); 운영 DB를 읽는 서비스가 아님 |
| 실제 제품·Shade·참고 이미지 권한 연결 | **미완료** | 라이선스·상품/호수/option identity·출처·심사·철회·물리 저장·서버 조회·사용자 권한·실물 SKU 검증 필요. [#1233](https://github.com/gycha0109-beep/K_beauty/pull/1233)은 기존 카탈로그 호환 경로 개선 Draft이지 실제 운영 Face Lab 카탈로그 아님 |
| AI Visual Try-On | **시뮬레이션/Render Spec/Provider 내부 검증 경로 구현, 실서비스 연결 미완료** | `visual-try-on-*.js`, `simulation-*.js`, private/test API. 실제 상품 체험 UI·상용 가용성을 별도 증명해야 함 |
| Production 대상 DB/마이그레이션 식별 | **확정되지 않음** | P1-D2C5/8 read-only 감사: 실제 Production DB ref 동등성 HOLD, hosted migration reconciliation HOLD. 승인 없는 운영 DB 변경 금지 |

위 표는 2026-08-12에 고정된 `FACE_LAB_CURRENT_STATE.md`보다 최근 main을 반영한 상태 판정이다. 오래된 상태 문서의 `Style Identity/Look Composer 미구현` 기록을 현재 V2 기능 미구현 판정으로 재사용하지 않는다.

## 3. 로드맵: 원래 확정한 V2 Phase 1~4를 유지

| Phase | 원래 2026-09-24 완료 목표 | 현황 | 다음 확인 |
| --- | --- | --- | --- |
| **1. 제품 정의** | Target taxonomy, Face Lab 설문, Current Face/Delta/Route 계약 | **완료** (계약·현재 코드 확인) | 변경 시 V2 의미 불변식 회귀 |
| **2. Vertical Slice** | 사진 → Target → Delta → Route A/B/C → 최소 Hair/Makeup → Premium UI | **기술 구현, 실제 UX/실기기 인수 검증 남음** | 서버/브라우저/모바일 진입·저장·재진입·오류 상태 검증 |
| **3. 색조/실행 상품 연결** | Product/ Shade/카테고리/source adapter/Fact/실제 SKU matching | **독립 후보 계약과 dry-run까지, 실상품 연결 미완료** | 사용 가능한 후보·색상·출처 및 승인 자료를 실제 서버 조회 경로로 연결 |
| **4. 확장** | Grooming, Glasses, Accessories, Hair reference, 스타일 비교, Visual Conflict, 이미지 기반 Finder | **Grooming/Glasses/Accessories 규칙 실행 일부 구현; 나머지 후속** | 우선순위는 실사용 행동·품질 지표로 결정 |

이 Phase는 출시 허가 순서와 동일하지 않다. Phase 1/2를 과거부터 다시 구현하지 말고 현재 vertical slice를 보존하면서 남은 제품 가치를 채운다.

## 4. 지금부터 할 일 — 단일 순서와 완료 기준

### P0. 완료된 vertical slice를 제품 기준으로 인수 (다음 **즉시 코드 작업**)

범위: 현재 Face Lab Premium 화면과 canonical 상태의 **실제 사용자 흐름**. 보안/상품 스키마/추천 규칙 재작성 금지.

1. `known / partial / unknown` Target 진입 → Finder 5회 선택/양쪽/둘 다 아님/뒤로 → Survey 확인.
2. Route preview 단계에서 사용자가 고르지 않은 실행안·가상 룩·제품 링크가 확정 추천처럼 나오지 않는지 검사.
3. 명시적 Route 선택, Target/Scope 변경, 뒤로 가기, 저장/재진입, 이전 결과 복원, error/hold/unknown 화면을 검증.
4. `FaceLabV2Result.jsx`와 `PremiumFaceLabSection.jsx`를 실제 payload 기준으로 점검하고, 높은 영향도의 UX 결함만 수정한다. 초깃값으로 승인된 시각자료 없는 Finder를 사진 선택으로 표현하지 않는다.
5. 기존 `verify-face-lab-v2-end-to-end-completion.mjs`, `verify-face-lab-v2-premium-wiring.mjs`, `verify-face-lab-v2-uat-polish.mjs`, 브라우저/기기 점검으로 커버리지를 보완한다.

**완료 기준:** 3가지 Target 진입 모드와 선택·저장·재진입 시나리오 통과, 잘못된 미선택 실행 노출 0, 계약상 실패/자료 부족 정직하게 표시. 화면만 존재한다는 이유로 UAT 완료 주장 금지.

### P1. Face Lab 추천 개인화 개선 — 병렬 진행, **현재 작업 재개점은 vCandidate-1 검증**

이미 main에 PR A/B/C/D 상당 부분(리팩터·후보·결정론 진단·Blind pair builder)이 구현돼 있다. 이를 반복 설계하지 않는다.

1. [#1242](https://github.com/gycha0109-beep/K_beauty/pull/1242)의 E1/E2 봉인·Private reveal 도구는 Draft로 보존하고, 보안 차단 해제 전에도 독립 **비운영** 리뷰 준비/회귀는 개발할 수 있다.
2. 별도 동의·독립 평가자·접근 제어된 리뷰 환경을 확보한 뒤에만 진짜 Human Pairwise를 수집한다. `target_fit`, `specificity`, `evidence_action_linkage` 세 차원을 구분하고 불확실·평가불가를 보존한다.
3. 실제 평가가 기존 추천의 genericity를 지지한다면 **Current Styling Baseline vCandidate-2**를 도입한다. 자가 보고 최소 4~5문항, `unknown`이면 기존 방식 유지. 얼굴 해부학을 현재 헤어/메이크업 스타일 상태로 변환하지 않는다.
4. 결정론적 회귀 → Human 판단 → 수정/비교 → 별도 candidate 승격 검토. LLM Judge는 Human calibration 후에만 진단 목적으로 검토.

**완료 기준:** 실제 독립 Human 근거로 후보의 장단점이 차원별 설명 가능하고, target authority/constraints/lineage가 손상되지 않음. **연구 미완료가 vCurrent의 제한적 사용자 경험 개선을 무기한 금지하지는 않지만, 비검증 후보의 자동 활성화는 금지.**

### P2. Face Lab 실행 후보를 실제 사용 가능한 자료로 연결 — Phase 3의 핵심

1. **무료 개발 먼저:** 기존 Face Lab 전용 `independent-*` 순수 계약·미리보기·공개본 dry-run을 검증하고, 호출부의 `ready / blocked / not_ready` 표면을 연결. 샘플을 실상품으로 표시하지 않는다.
2. 메이크업 실행안 → `technique` → `product specification` → **승인된 상품/색상(Shade)** 매핑을 만든다. 비메이크업 Hair/Grooming/안경/액세서리 경로도 남긴다.
3. 실제 자료 원천은 공용 스킨케어 Taxonomy를 필수 선행조건으로 강요하지 않는 **Face Lab 독립 실행 카탈로그**로 한다. 공통 상품 연결이 필요한 경우에만 승인된 읽기 어댑터를 사용한다.
4. 실제 DB/권한/저장/서버 API/참고 이미지 원본 사용권/관리 심사·철회·동시성은 Production 대상 동일성 및 별도 운영 승인 후 실행한다. **기존 fixture 기반 dry-run PASS는 실제 연결 PASS가 아니다.**
5. 출처 불충분, 가짜 Shade, 미승인 reference, 철회, 잘못된 Identity 또는 SKU는 정상 목록에서 차단하며 사용자에게 자료 미준비를 명시한다.

**완료 기준:** 최소 1개 승인된 실제 SKU·Shade 또는 스타일 실행 자료가 올바른 선택 영역에 대응, 표시·선택·철회·재조회·저장/재진입에서 실제 권한·출처 확인. 자료 없는 경우 비어 있는 상태가 정상 처리된다.

### P3. 실행 경험 확장 — Phase 4, 우선순위는 제품 인수 뒤 결정

- 승인된 reference images로 Target Finder 시각 비교 고도화(현재 그라데이션 카드를 실제 이미지라고 주장하지 않음).
- 실제 시도 가능한 Hair 스타일/안경/액세서리와 영역별 행동 카드를 구체화.
- Visual Conflict Detection은 영역 간 충돌 근거가 존재할 때만 알림, 추정 미용 공식 금지.
- Visual Try-On은 이미 있는 Appearance Slot/Render Spec/Provider adapter를 **P2 승인된 자료 경로**와 연결하고, 직접 선택·추천 선택·Before/After·saved look·가상 화장대 재진입 구현.
- 무료/mocked validation → 사용권/Identity/scope review → **명시적으로 승인된 제한적 유료 canary** → 실제 제품 UI. 유료 호출을 개발 편의상 자동 실행하지 않는다.

**완료 기준:** 사용자 선택과 실제 적용 결과의 역할/영역이 일치하고, 얼굴 동일성·선택 영역·복수 제품 공존·자료 권리·비용 제한을 입증. 실기기 수용 확인 전 상용 기능으로 소개하지 않는다.

### Face Lab 공통 촬영 안내 UX 결정 (2026-10-13)

- **안내 대상:** Face Lab 전체(얼굴 구조·인상·스타일·색감·향후 퍼스널 컬러 포함). 퍼스널 컬러만의 독립 경고를 중복하지 않는다.
- **표시 시점:** Face Lab용 사진을 업로드하거나 촬영하기 **직전**, 한곳에 **짧은 2문장**을 안내한다. 일반 피부 분석 사진과 Face Lab 사진을 함께 받는다면 동일 단계에서 한 번만 보여준다. 결과 화면·세부 결과 카드에는 일반적인 촬영 한계 고지를 반복하지 않는다.
- **한국어 사용자 문구:** **“Face Lab은 사진에 나타난 얼굴 특징과 색감을 바탕으로 스타일 방향을 분석합니다. 조명·각도·필터에 따라 결과가 달라질 수 있으니, 가능하면 밝고 고른 빛에서 필터 없이 얼굴이 잘 보이게 촬영해 주세요.”**
- **English:** **“Face Lab analyzes visible facial features and colors in your photo to suggest styling directions. Lighting, angles, and filters can affect the result, so use even lighting, no filters, and a clearly visible face when possible.”**
- **비차단:** 권장 환경 안내이며 촬영 제한·강제 체크박스·동의 게이트·업로드 차단을 추가하지 않는다. 일반 사용자에게 스튜디오 수준의 광원 통제를 요구하지 않는다.
- **결과 진실성:** 촬영 안내를 결과에 되풀이하지 않더라도, 실제 분석 근거가 불충분한 항목의 `unknown / insufficient_evidence / unavailable` 및 추정 상태는 정확하게 전달해야 한다. 퍼스널 컬러 유형의 무근거 확정·가짜 신뢰도 수치는 금지한다.
- **구현 시점:** 공통 사진 업로더의 기존 구성과 Face Lab 진입 경로를 확인한 뒤, Face Lab이 실제로 제공되는 촬영/선택 화면에만 한 번 연결한다. 퍼스널 컬러 신규 기능이 생겨도 경고 배너를 하나 더 만들지 않는다.
- **검증:** 모바일에서 문구가 과도하게 길지 않음, 시작 시점 1회 노출, 사용자 진입 차단 없음, 결과 화면 일반 경고 중복 없음, 실제 `HOLD/UNKNOWN` 상태 보존.

### P4. 출시 후보 인수

- 실제 환경에서 Premium 구매 → 분석 → Target → 경로 선택 → 실행안/실상품 → 저장/재진입 전체 테스트.
- 관찰 및 추천 상태 근거, Free/Premium canonical 일관성, 사진 비저장·동의, 접근권한/철회, 에러 노출, 모바일 UX/성능 검증.
- 필요한 exact-head CI, 실제 자료·Provider 관련 개별 승인, 정식 공급망 보안 검사까지 모두 통과 후 출시 판단.
- 사용자에게 가능 여부를 과장하지 않고 `기능 구현`·`운영 연결`·`실사용 검증`을 구분해 완료 보고.

## 5. 실행 순서 (다음 대화는 여기서 시작)

```text
지금: P0 Premium Face Lab 실제 흐름 UX/상태 검증 및 결함 보수
  ├─ 병렬 P1: vCandidate-1 Human Pilot 준비 / 실제 평가자 확보 시 검증
  └─ 다음 P2: 이미 구현된 independent candidate → 실제 실행 카드의 안전한 준비 상태 연결
       → 별도 승인 후 실상품·Shade·reference 자료 저장/조회
       → P3: 시각 Finder, 다영역 참조/가상 체험, conflict detection
       → P4: 실사용 E2E와 출시 후보 검증
```

**다음 코드 작업의 좁은 단위:** `PremiumFaceLabSection.jsx`·`FaceLabV2Result.jsx`와 canonical 입력/저장 상태를 직접 대조하고, **P0의 재현 가능한 사용자 시나리오 누락**을 1개 PR 단위로 보수한다. 사용자 화면이 깨진 실제 사례가 없다면 무의미한 재설계 대신 P2의 독립 후보 `not_ready`/available UI 경계로 넘어간다.

## 6. 작업·병합·운영 경계

- 개발/로컬 deterministic CI는 계속 진행한다. **미해결 Supply Chain Security #1208**은 별도 보안 트랙이며 이 로드맵의 제품 구현 차단 사유는 아니다.
- 보안 게이트 FAIL, 필수 검사 미통과 또는 운영 권한 미확정 상태에서 해당 PR 병합·출시 진행하지 않는다. GitHub가 `mergeable`이라고 표시해도 필수 검사 PASS를 의미하지 않는다.
- 중단된 PR을 코드처럼 가정하지 않는다. #1242, #1233, #1225, #1209는 각각 별도 미병합 산출물이며 합쳐진 것처럼 착각해 main 작업을 설계하지 않는다.
- 실제 얼굴 이미지·평가자 자료는 Source/PR/CI에 넣지 않는다. Synthetic 평가를 Human 판단으로 바꾸지 않는다.
- 신규 CI workflow를 만들거나 다른 도메인 Security/Trust/Taxonomy 코드를 Face Lab 진행 명목으로 변경하지 않는다. 공유 CI 이슈는 owner PR로 분리한다.
- 모든 구현 PR에는 **목적 → 변경 파일 → 회귀 검증 → 남은 리스크/승인**을 기록한다. 불필요한 상태 보고와 중복 프로토콜은 만들지 않는다.

## 7. 권위 있는 근거·기존 문서

1. 2026-09-24 사용자 확정 `페이스랩 정의 V2`: **최종 제품 정의 / 원래 Phase 1~4 구현 순서**.
2. `FACE_LAB_MASTER_SPEC.md`: 관찰·증거·보안·Free/Premium 불변식 (구형 archetype-first 설명과 V2가 다르면 V2 제품 정의 우선).
3. `face-lab-v2-end-to-end-completion-audit-v1.md`: 현재 기술적 vertical slice 및 그 검증의 한계.
4. `face-lab-v2-vcandidate-personalization-design-v1.md`: 실제 개인화 결함, PR A~G와 Human gate.
5. `face-lab-v2-p1-d2c-independent-execution-catalog-design-v1.md` 및 `face-lab-v2-p1-d2c4-governed-storage-read-boundary-design-v1.md`: 실행 자료 독립성, 승인 경계.
6. `face-lab-v2-visual-try-on-v1.md`: 제품·Shade·참고 이미지·슬롯·유료 canary 순서.
7. `FACE_LAB_CURRENT_STATE.md`: **2026-08-12 과거 스냅샷**. 최신 현재 상태 판정에는 사용하지 말 것.
8. 위 제2절의 **actual main code** 및 아직 미병합인 PR 상태. 런타임/외부 운영 자료 확인이 없으면 최종 완료 주장 불가.

**문서 정지 조건:** 이 로드맵은 제품 구현 재개용이다. 실제 Human 참가자·실상품 권리·Production DB 식별·유료 Provider 호출처럼 외부 실행/승인이 필요한 단계에서는 해당 단계만 HOLD하고, 독립적으로 검증 가능한 P0/P2 제품 코드는 계속 진행한다.
