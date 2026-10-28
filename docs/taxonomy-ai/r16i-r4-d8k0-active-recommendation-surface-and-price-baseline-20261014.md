# D8K-0 — 실제 추천 화면과 NULL 가격 보수 기준선

> 2026-10-14 KST · source-level inventory + limited UI price fix · STATUS: SOURCE_MAPPED / CI_PENDING / PRODUCTION_HOLD
> 조사 기준 PR #1255, HEAD cfc91c61f1051f00b3dc15311305515dfe56f652.
> 계획: [D8K 로드맵](r16i-r4-d8k-universal-offer-remediation-roadmap-20261014.md), [D8J 공통 판매처 정책](r16i-r4-d8j-universal-offer-comparison-policy-20261014.md).
> 실제 브라우저 전수 확인이나 운영 DB 적용을 의미하지 않는다.

## 1. 핵심 결론

1. **현재 무료 메인 결과는 Free Result v2**이다. `app/result/page.js`의 `ResultContent.resultSteps`는 5개 순서 중 `recommendation-guide`에서 `FreeResultV2RecommendationGuideStep`에 `buildFreeResultV2TopPick(result?.topPick)`를 넘긴다. 현재 추천 상품은 `preview.product`이며 이름·브랜드·이미지·추천 이유가 있다. **구매처 비교/가격/구매 버튼은 없다.** 파일 아래 선언된 구형 `ProductDecisionCard`와 `CategoryCarousel`는 **이 활성 flow에서 호출되지 않는다**.
2. **현재 풀리포트는 `SkinMatchStepReport`를 통한다**. `SKIN_MATCH_SECTION_ORDER`는 `today-start-hub → morning-routine → product-plan → adjustment-guide → avoid-list` 순서이다. 이 가운데 카탈로그 추천 객체를 카드로 표시하는 활성 경로는 `PremiumRoutineConsultSection`의 AM/PM `step.product`와 `PremiumFunctionalDecisionSection`의 주요/보조/예산 3탭이다. 예전에 만든 `TopPickHeroCard`·`SupportingProductCard`·`BudgetAlternativeCard`·`ProductUsageCard` 등은 선언만 존재하고 **현재 stepMap의 렌더 호출에는 없다**.
3. **공유 링크의 추천 상품은 텍스트로 보인다.** `/r/[shareId] → SharedResultLoader → ResultShareCard`에서 Top Pick과 카테고리 상품을 렌더한다. 보호된 `GET /api/results/[shareId]`는 `lib/analysis-results.js::serializePublicAnalysisResult`로 id/name/brand/step/reason만 projection하며 ID가 빈 문자열일 수 있다. 구매 링크/Offer는 없다. 이 공개 경로에 고권한 Offer 조회를 직접 연결하지 않는다.
4. **MY 저장 내역은 추천 카드가 아니다.** `SavedReportHistory`는 보고서 제목/날짜/`report.href` 열기만 렌더한다. 재진입한 프리미엄은 `savedReportId`를 통해 `/api/full-report`에서 저장 리포트를 가져올 수 있으며, 재분석이 아니라 저장된 Product ID와 현재 Offer를 별도로 연결하는 설계가 필요하다.
5. **NULL → 0원 코드를 발견했다.** `PremiumFunctionalDecisionSection.jsx::priceLabel`은 `Number(null)===0`이므로 미확정 Product 가격이 `0~0원`으로 표현될 수 있었다. 공용 정규화 `normalizeKnownProductPrice` 기반의 `formatKnownProductPriceLabel`을 추가하고 해당 기능성 숫자 표시 경로만 교체했다. 이미 공급된 임의의 `product.priceLabel` 텍스트는 이번 보수 범위 밖의 근거 검증 대상이다.

## 2. 실제 UI slot → Product 데이터 → 가격/CTA → 변경 대상

| Slot | 현재 실렌더 출처 | Product 객체/ID 상태 | 현재 표시/CTA | D8K 연결 대상 |
| --- | --- | --- | --- | --- |
| **F-01 무료 Top Pick** | `ResultContent.resultSteps.recommendation-guide → FreeResultV2RecommendationGuideStep` | `sessionStorage.skinTestResult` 또는 `pendingSaveReport.freeResult` → `result.topPick` → `preview.product`. catalog ID는 개별 객체 검사 필요 | 이미지/이름/이유, 가격·구매 버튼 없음 | 검증된 Product ID에만 compact 구매처 비교 |
| **P-01 프리미엄 AM 루틴** | `SkinMatchStepReport.morning-routine → PremiumRoutineConsultSection(activeMode=morning)` | 우선 `report.routinePlan.morningSteps[].product`, 없으면 legacy `buildRoutineConsultSteps`. ID 보장 안 됨 | 이름/이미지, CTA 없음 | ID 식별 후 비교. 사용자 소유 CurrentProductSlotNote 제외 |
| **P-02 프리미엄 PM 루틴** | 같은 컴포넌트 `activeMode=night` | `report.routinePlan.nightSteps[].product` 또는 legacy fallback. AM/PM 중복 가능 | 이름/이미지, CTA 없음 | P-01과 같은 Product ID는 배치 조회 재사용 |
| **P-03 프리미엄 주요 기능성** | `SkinMatchStepReport.product-plan → PremiumFunctionalDecisionSection.ProductOptions(primary)` | `resolvePremiumFunctionalDisplayModel` → `plan.productCandidates[]`. canonical 또는 legacy, 최대 3개. UI는 `id || brand-name` 키 사용 | priceLabel 우선 또는 Product price_min/max; 구매처 CTA 없음. HOLD 시 새 사용 권장이 아님 | 검증된 ID+노출 권한이 있을 때 비교 |
| **P-04 프리미엄 보조 기능성** | 같은 컴포넌트 `ProductOptions(secondary)` | `plan.secondarySolution.products[]`, 최대 3개. ID 미증명 | P-03과 동일 | 동일 shared renderer |
| **P-05 프리미엄 예산 후보** | 같은 컴포넌트 `ProductOptions(budget)` | `plan.budgetAlternatives[]`, 최대 3개. canonical/legacy 확인 필요 | P-03과 동일 | **Product 간 budget 대안 선정 유지**, 동일 Product 내 비교 가능한 Offer만 정렬 |
| **S-01 공개 공유 Top Pick** | `/r/[shareId] → ResultShareCard.topPick` | `serializePublicAnalysisResult.topPick`, 공개 projection에서 ID가 비어 있을 수 있음 | 텍스트만, CTA/가격 없음 | 공개/보안/ID 검증이 선행된 read-only 확장 검토 |
| **S-02 공개 공유 category picks** | 동일 `ResultShareCard.visibleProducts` | `serializePublicAnalysisResult.categoryPicks[]`. API 최대 6개, UI visibleProducts 최대 5개 | 텍스트만 | S-01과 동일. 없는 ID를 상품명 fuzzy match로 연결 금지 |

여기의 **8은 활성 코드 slot 유형 수**이며 고정된 사용자 상품 수가 아니다. 실제 분모는 배열 길이, 조건, 결과 재진입과 HOLD 상태에 따라 달라진다. 향후 D8K-4의 100% UI coverage는 고정 fixture와 접근 허가된 브라우저 경로에서 따로 계측한다.

## 3. 활성에서 제외해야 하는 것

| 화면/컴포넌트 | 분모 제외 근거 | 이후 처리 |
| --- | --- | --- |
| 무료 `ProductDecisionCard`, `CategoryCarousel`, `RecommendedProductsStep` | 컴포넌트는 있지만 실제 `ResultContent.resultSteps`에서 렌더하지 않음 | 이전 화면 재활성화 여부 확인 전 수정하지 않음 |
| 풀리포트 `TopPickHeroCard`, `SupportingProductCard`, `AlternativeCarousel`, `BudgetAlternativeCard`, `ProductUsageCard`, `AlternativeBudgetPlanStep` | 해당 함수들은 존재하나 현재 `SkinMatchStepReport.stepMap`에서 호출하지 않음; 예전 `buy_link` 구매 버튼은 dormant | 실노출로 오인하지 않음, 재활성화 시에만 적용 |
| 풀리포트 허브 `TodayStartPlanStep` / `CurrentProductsSummaryCard` | 첫 화면의 안내와 현재 보유 제품 | 카탈로그 구매 비교 UI를 허브에 강제로 넣지 않음 |
| `PremiumConditionResponseSection` / `AvoidListStep` | 상태·주의 등 텍스트/행동 정보 | 제품명 언급만으로 Offer 연결 금지 |
| `SavedReportHistory` | 리포트 링크 목록 | 재진입한 보고서의 실제 추천 카드에만 적용 |
| Face Lab | 별도의 Product identity/노출 권한 체계 | 자동 판매 CTA 확장 안 함 |
| `/en/result` / `/en/result/full-report` / 개발용 테스트 페이지 | 본 화면 재사용 wrapper/fixture | 공용 렌더 로직 1개 유지, ko/en 회귀 포함 |

## 4. 기존 Product/Offer read 경로와 제약

| 계층 | 실제 소스 | 현재 결론 |
| --- | --- | --- |
| Product normalization | `lib/product-source.js::buildRecommendationProductFromSource` | id, nullable price_min/max, price_range, 허용된 1개 buy_link. **offers 배열 없음** |
| Analyze API | `app/api/analyze/route.js` | Product 응답 buy_link 정제, 예산 대안 nullable price_min/max. **판매처별 Offer DTO 없음** |
| Premium 저장/재진입 | `app/api/full-report/route.js` + `FullReportPageContent` | 기존 premium session/저장 리포트 계약 사용. canonical과 legacy 둘 다 처리 |
| Public share | `app/api/results/[shareId]/route.js`, `lib/analysis-results.js` | 인증/공개 guard + 제한된 product projection, 가격/구매 URL 미포함 |
| Offer 저장소 | `public.product_offers` | seller/listing/amount/상태/관측 시각 있음. 다중 선택옵션·증정 구성·배송비 필드는 없음; seller/listing 단위 unique |
| Offer read RPC | `read_product_offer_presentation_authority_v2(uuid[])` | private `recommendation_admission_runtime` EXECUTE, Product ID <=64, Offer <=256. 건강 상태는 CTA 권한이 아님 |
| **이미 존재하는 Offer 소비 로직** | `lib/product-offer-read-path.js` | `selectCurrentProductOffer` / `projectProductWithOfferAuthority` / `collectRecommendationProductIds` / `applyProductOfferReadPath`. **새 D8K-1 projector 설계 전에 중복 기능 점검 필수**, 다중 옵션 최저가 UI 자체는 구현 안 됨 |
| 링크 신뢰 | `lib/product-purchase-link.js`, `lib/commerce/safe-commerce-fetch.mjs` | 일부 올영/화해/공식 브랜드만 직접 허용. 쿠팡/브랜드 임의 host 자동 신뢰 불가 |

## 5. NULL 가격 재현과 회귀 baseline

수정 전 프리미엄 기능성의 핵심 코드는:

```js
const min = Number(product?.price_min);
const max = Number(product?.price_max);
if (Number.isFinite(min) || Number.isFinite(max)) { /* present price */ }
```

숫자 양쪽이 NULL일 때 **실수로 0~0원 가격을 출력할 수 있다**. 발생량은 브라우저/운영 관측하지 않았다.

D8K-0 보수:
- `lib/product-price-read-contract.mjs`: 표시 전용 함수 `formatKnownProductPriceLabel(priceMin,priceMax,locale)` 추가.
- `components/full-report/PremiumFunctionalDecisionSection.jsx`: 숫자 필드에 함수 사용. NULL, undefined, 공백, NaN, 0은 미확정, 알려진 24,500/29,900만 숫자 표시, 역전된 범위는 미확정.
- 임의의 `product.priceLabel` 문자열 우선권은 보존했다. 이 선표시 문구의 출처 권한은 D8K-2에서 점검할 필요가 있다.
- API 필드, DB schema/migration, 저장 결과 포맷, 순위 계산, link allowlist는 변경하지 않았다.

검증 명령 (프로젝트 루트에서 실행):

```bash
node scripts/product-evidence/verify-d8k0-active-surface-null-price-baseline-v1.mjs
node scripts/product-evidence/verify-r16i-d8h-price-consumer-contract-v1.mjs
node scripts/product-evidence/verify-r16i-d8h-null-price-engine-replay-v1.mjs
node scripts/product-evidence/verify-r16i-d8h-null-price-candidate-admission-shadow-v1.mjs
```

신규 테스트는 직접 pure price helper를 실행하여 NULL/0/정상 24,500/정상 구간, ko/en 등을 확인하고 free/premium/shared source contract를 검사한다. 기존 `verify-r16i-r4-d8f-candidate-d4-readonly-prestate.mjs` → `verify-r16i-price-scope-review-v1.mjs` 호출 체인에서 신규 테스트를 CI 실행하도록 연결했다.

**가격 정책의 과거 합성 replay 기준:**
- 164×12=1,968 점수쌍, 166×12=1,992 구조 후보: Price NULL 가정에서도 score/rank/top1/top3 변화 0.
- U10 budget alternative 12개 시나리오 중 1개 변화. **실제 Product 변경이 아니라 가상 시나리오**이며 0건 변화로 보고하면 안 된다.
- 새 단계 자체는 Product 가격/재고를 수정하지 않는다. 호스팅 런타임/실제 무료·프리미엄 테스트 완료라고 주장하지 않는다.

## 6. 종료 게이트·남은 HOLD

| Gate | 확인 항목 | 판정 |
| --- | --- | --- |
| G0-A | active/source Product UI slot → 현재 가격/CTA → 다음 Offer adapter 매핑 | **SOURCE_MAPPED (정적)** |
| G0-B | legacy 선언/UI와 실제 렌더 구분 | **SOURCE_MAPPED** |
| G0-C | Number(null) 숫자 화면 버그 제거 및 fixture | **PATCHED / CI CHECK REQUIRED** |
| G0-D | 기존 164×12/166×12 및 U10 baseline | **EXISTING VERIFIERS WIRED / EXACT HEAD CI REQUIRED** |
| G0-E | 실제 추천 Product ID·HOLD/UNKNOWN·리뷰/옵션 authority | **UNATTESTED** |
| G0-F | 웹/모바일 실제 브라우저 모든 상품 100% 커버리지 | **NOT RUN; D8K-4 E2E** |
| G0-G | Product/Offer Production 쓰기·배포·병합 | **0 / HOLD** |

**다음 구현:** D8K-1은 무조건 새 projector를 만들기 전에 `lib/product-offer-read-path.js`의 기존 candidate selection 및 trusted-link policy와 새 **다중 seller/선택옵션 비교** 요구 간 차이를 검토해야 한다. 출처 없는 가격·선택옵션은 null/HOLD. D8K-2에서 저장·RPC 권한·SKU 정체성 실증 전에 직접 CTA를 추가하지 않는다.

**STOP:** Owner의 전 추천 UX 정책 승인만으로 D8D v2 상품 정정, 운영 DB 동일성, 권한 확장, API fields, 공개 공유 링크 직접 상거래, 운영 배포가 승인된 것은 아니다. 별도 #1208 공급망 실패 동안 PR 병합·배포 HOLD.
