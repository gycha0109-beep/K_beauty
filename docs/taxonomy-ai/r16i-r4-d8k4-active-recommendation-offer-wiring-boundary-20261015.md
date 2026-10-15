# D8K-4 — 실제 추천 경로 → 다중 판매처 읽기 준비 (2026-10-15)

> 상태: **EIGHT_ACTIVE_SLOT_TYPES_MAPPED / IDENTITY_CANDIDATE_CODE_READY / LIVE_OFFER_UI_HOLD**
> 코드: `lib/commerce/active-recommendation-offer-slots-v1.mjs`
> 검사: `scripts/product-evidence/verify-d8k4-active-offer-slots-v1.mjs`
> 대상: D8K-3 Draft PR #1321 기반 별도 stacked Draft PR. DB·API·인증·배포 변경 없음.

## 1. 실제 호출되는 결과 화면과 입력

| 유형 | 현재 UI | 주 데이터 경로 | Product ID 신뢰 | 다중 Offer UI |
| --- | --- | --- | --- | --- |
| F-01 | 무료 v2 Top Pick | `app/result/page.js:ResultContent` → `FreeResultV2RecommendationGuideStep(preview.product)` ← `result.topPick` | 객체의 `id` 개별 확인 필요 | 기존 UI에 없음 |
| P-01 | 프리미엄 아침 루틴 | `SkinMatchStepReport` → `PremiumRoutineConsultSection` → canonical `routinePlan.morningSteps[].product` / legacy fallback | canonical step에서도 admission 미증명; legacy는 별도 확인 | 기존 UI에 없음 |
| P-02 | 프리미엄 저녁 루틴 | 동일 `nightSteps[].product` | P-01과 중복 Product 가능 | 기존 UI에 없음 |
| P-03 | 프리미엄 주요 기능성 | `resolvePremiumFunctionalDisplayModel` → `functionalPlan.productCandidates[]` | source canonical/legacy 및 `planMode` 확인 | 기존 UI에 없음 |
| P-04 | 프리미엄 보조 기능성 | `functionalPlan.secondarySolution.products[]` | 동일 | 기존 UI에 없음 |
| P-05 | 프리미엄 예산 후보 | `functionalPlan.budgetAlternatives[]` | 별도 Product 랭킹 보존 | 기존 UI에 없음 |
| S-01 | 공개 공유 Top Pick | `/r/[shareId]` → `SharedResultLoader` → `ResultShareCard.topPick` | 공개 projection에서 ID가 비어 있을 수 있음 | 공개 읽기 권한 없으므로 HOLD |
| S-02 | 공개 공유 카테고리 | `ResultShareCard.categoryPicks` (visibleProducts 제한) | 공개 projection의 각 ID 독립 확인 | HOLD |

*8은 활성 UI 위치 유형이지 모든 사용자에서 렌더되는 실제 상품 수가 아니다.*

**혼동 금지:** 무료 `ProductDecisionCard` 및 프리미엄 `TopPickHeroCard`, `SupportingProductCard`, `BudgetAlternativeCard`, `ProductUsageCard`는 현행 단계 렌더에서 호출하지 않는 legacy 정의이다. 현재 사용 중인 제품, MY 저장 결과 링크, Face Lab, 루틴 설명 텍스트는 새 구매 후보가 아니다. 프리미엄 저장 리포트는 `/api/full-report` 재진입 후 같은 컴포넌트로 표시하나, 오래된 데이터에는 ID/선택옵션 근거가 없을 수 있다.

## 2. 코드로 고정한 연결 경계

`collectActiveRecommendationOfferSlots({freeResult,premiumReport,functionalPlan,publicShare})`는 실제 UI 위치에 맞는 후보를 모으고 UUID가 존재하는지 확인한다. 루틴은 canonical step만 직접 식별하며 **동적 legacy 루틴 재구성을 카탈로그 identity로 추정하지 않는다**. 기능성은 화면에서 이미 계산된 `functionalPlan`을 입력받고, HOLD 모드 제품은 읽기 후보로 올리지 않는다. 공개 공유는 UI 위치만 조사하고 private 읽기 후보에 포함하지 않는다.

같은 Product가 AM/PM/기능성에 반복돼도 candidate ID 목록은 deduplicate한다. 표시 순서는 기존 배열 순서를 바꾸지 않으며 어떤 숫자·상품명·구매 URL도 생성하지 않는다.

이 목록은 `candidateIdsForLaterPrivateAdmission`일 뿐 **실제 DB 조회 요청 권한이 아니다**. 반드시 별도로 Product 추천 admission 및 실제 선택옵션·가격·배송비·시각·링크 검증이 있어야 D8K-1 비교 계산/ D8K-3 UI에 전달할 수 있다. D8K-2 private transport는 현재 원시 선택옵션 근거를 전달하지 않으며, 무허가 서버/브라우저 호출을 만들지 않는다.

## 3. 연결을 막는 정확한 이유

1. `public.product_offers`와 현 RPC에 선택옵션/구성/증정/배송비의 독립 근거가 없다. `offer` 행 존재는 SKU별 가격 확인이 아니다.
2. RPC는 `recommendation_admission_runtime`의 private 권한이며 현 화면은 client component다. 브라우저에서 권한을 확대해 직접 호출하면 안 된다.
3. canonical Product ID는 **추천 노출/선택옵션/가격 신뢰**와 별도. legacy 이름을 fuzzy match 하거나 공개 share를 private endpoint에 연결하면 안 된다.
4. 기존 분석 API·저장 응답에 Offer 배열이 없다. 신규 DTO 또는 읽기 endpoint는 Protected API/Storage/권한 영향 검토 및 사용자 승인 필요.
5. D8K-3 UI 구매 버튼은 영구 비활성이고, 실제 SSR/server-projected 비교 모델·UI hydration·브라우저 E2E는 없다.
6. #1208 Supply Chain 보안 문제 및 #1288 draft, #1255 unmerged 상태에서 병합/배포 금지.

## 4. 이번 변경의 검증 기준

- 정적 소스 수준에서 **8개 활성 UI slot** 및 실제 컴포넌트 경로/저장 리포트/공유 표시 확인
- synthetic UUID(대소문자), 중복, legacy 무ID, 기능성 HOLD, 공개 공유 차단, 보유 중 제품 배제, 순서 불변
- D8K-4 verifier를 기존 `verify-r16i-price-scope-review-v1.mjs` 체인에 연결. GitHub CI는 커밋 HEAD별 별도 판정
- **하지 않은 것:** 브라우저 실화면 검증, 실제 private RPC, 가격·옵션 evidence 확보, 상품/Offer 쓰기, 활성 화면 판매처 컴포넌트 삽입, 공개 share 가격 노출, 구 API/권한/DB 변경

## 5. 다음 구현의 전제와 중단 규칙

- 먼저 승인된 Product 후보를 실제 추천 admission과 join하고, 64 Product / 256 Offer per RPC 범위의 **권한 있는 서버 호출자**를 정한다.
- 선택옵션 식별·구성·배송비 근거 계약 및 seller별 URL 정책에 대한 별도 승인 후, D8K-1 comparator 입력을 서버에서 안전하게 구성한다.
- 이후 F-01, P-01~05 active 컴포넌트에 동일 UI를 연결하고, 저장/공유 경계에 따라 S-01~02의 별도 검증을 수행한다.
- identity만으로 실제 가격/CTA 노출을 추진하거나 보호 API/DB/RLS 변경이 필요해지면 **중단**.
- 100% coverage/browser E2E 및 보안 이슈 통과 전에는 D8K-4 완료/출시라고 보고하지 않는다.
