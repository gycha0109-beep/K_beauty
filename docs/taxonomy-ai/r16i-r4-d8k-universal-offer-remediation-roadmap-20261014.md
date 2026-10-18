# BEJEWELY / taxonomy-ai — D8K 전 추천 상품 구매처 비교 보수·적용 로드맵 v1

> 작성: 2026-10-14 KST · 작업 유형: **설계·보수 계획** · 트랙: `taxonomy-ai` · 상태: **ROADMAP_READY / IMPLEMENTATION_NOT_STARTED / PRODUCTION_HOLD**
> 코드 기준: `gycha0109-beep/K_beauty` PR [#1255](https://github.com/gycha0109-beep/K_beauty/pull/1255) head `18cbf755063ecec1edcb1b1df984ad63284f9660` (작성 시작 시 검증한 기준점).
> 사용자 확정 정책: [D8J — 모든 추천 상품 구매처 비교](r16i-r4-d8j-universal-offer-comparison-policy-20261014.md).
> 별도 상품 정정: [R16I-R4 로드맵](r16i-r4-product-correction-roadmap-v1.md), [D8I/D8D v2](r16i-r4-d8i-representative-price-dual-offer-cutover-design-20261014.md).
> Related: [#1208 Supply Chain](https://github.com/gycha0109-beep/K_beauty/issues/1208), [#1288 security draft](https://github.com/gycha0109-beep/K_beauty/pull/1288).

## 0. 목적·범위·중단 원칙

**최종 사용자 경험:** 비주얼리에서 추천된 **모든 유효한 카탈로그 상품**에 대해 공식몰·쿠팡·올리브영·화해 중 실제로 확인된 구매 옵션만 가격·구성·가격 관측 시각·구매 링크와 함께 보여준다. 지원 판매처는 확장 가능하며 판매처 4개가 필수 입력은 아니다. 무료 Top Pick, 카테고리/보조 추천, 무료-v2 노출 지점, 프리미엄 Top Pick·보조/대안·루틴·기능성 추천·예산별 대안과 **실제로 추천 카드를 렌더링하는 공유 결과**가 적용 후보이다.

- **서로 다른 정렬 축:** 피부 적합도 추천 랭킹은 현행 엔진을 유지한다. *한 Product 내부의 비교 가능한 seller Offer*만 가격 기준으로 정렬한다. 기존 예산별 대안 Product 간 비교는 별도 admission/policy 계약으로 유지·검증한다.
- **동일 선택옵션 비교:** Product/variant identity, 구성/수량/용량, 통화가 같은 Offer만 동일 비교 그룹에 둔다. 80ml 단품과 80ml×2+증정 세럼은 최저가 경쟁 대상이 아니다. 증정 구성 및 배송비 미상은 명확히 표시하고 임의로 가정하지 않는다.
- **진실성 우선:** 가격/재고/링크/소유자 검증 여부를 추정하지 않는다. 가격 관측과 직접 클릭 안전성, Product Fact 신뢰, 리뷰 모집단은 서로 별도 권한이다. `UNKNOWN`/`HOLD` 후보를 단순히 구매 링크가 있다는 이유로 노출하지 않는다.
- **운영 변경 금지:** 이 문서는 Product·Offer 운영 데이터를 변경하지 않는다. Auth/RLS, 스키마·마이그레이션, API 응답 필드, 저장 데이터, 호스팅·배포 변경은 각 별도 보호 범위 검토·명시 승인 이후에만 실행한다. D8D v2 gate OFF, PR 미병합 상태 유지.
- **결정과 미결 구분:** 사용자는 **전 추천 상품 공통 비교 UX 및 4개 우선 판매처**를 확정했다. 개별 SNATURE Product 160ml→80ml/가격 NULL, 리뷰·소스 귀속, 직접 CTA allowlist, 지원 채널별 링크 수집 권한, 운영 전환을 이 사실만으로 승인받았다고 간주하지 않는다.

## 1. 저장소 조사로 확인한 현행 구조 및 결함 후보

| ID | 실제 소스/관측 | 보수 이유 | 확정 수준 |
| --- | --- | --- | --- |
| C-01 | `app/result/page.js` `getPurchaseLinkInfo`, `ProductDecisionCard` 등 여러 구매 버튼이 `buy_link` 및 네이버쇼핑 검색 fallback 기반 | 각 추천 카드에서 판매처별 목록 부재, 페이지별 변경 시 누락 위험 | 코드 확인 |
| C-02 | `app/result/full-report/page.js` 별도 `getPurchaseLinkInfo`, `TopPickHeroCard`, `SupportingProductCard`, `ProductUsageCard` 및 기타 CTA | 무료/프리미엄 중복 링크 판단, 프리미엄 내부 추천 위치 누락 위험 | 코드 확인 |
| C-03 | `components/full-report/PremiumFunctionalDecisionSection.jsx` `priceLabel`에서 `Number(product?.price_min/max)` 수행 | `Number(null)===0`; 미확정 가격의 `0원` 오표시 가능. 실제 노출 경로는 회귀 테스트로 재현해야 함 | 코드상 결함 후보 |
| C-04 | `components/full-report/PremiumRoutineConsultSection.jsx` 루틴의 추천 `step.product`는 별도 카드이며 현재 가격·Offer 비교 UI가 없음 | '모든 추천 상품' 범위에서 누락될 수 있음. 현재 사용 중인 개인 보유 제품과 반드시 구별 | 코드 확인 |
| C-05 | `lib/product-source.js` `buildRecommendationProductFromSource`는 `id`, `price_min/max/range`, 허가된 단일 `buy_link`를 출력하며 Offer 배열은 출력하지 않음 | 추천 엔진 내 Product와 commerce Offer를 혼합하면 추천 점수가 오염될 위험 | 코드 확인 |
| C-06 | `app/api/analyze/route.js` 프리미엄 product sanitize에 `buy_link`/ `price_range`는 있지만 Seller Offer 목록 없음 | 저장된/프리미엄 결과 등 형식·전송·개인정보/API 계약을 별도 검토해야 함 | 코드 확인 |
| C-07 | `public.product_offers`: seller/listing URL/amount/availability/scope/current 필드, `(seller_key,listing_id)` 및 URL 고유 인덱스 | 선택옵션 ID, 구성·증정, 배송비, 옵션별 가격 구조 없음. **한 listing의 여러 선택옵션을 현 스키마로 독립 Offer 생성 불가** | 마이그레이션 확인 |
| C-08 | `read_product_offer_presentation_authority_v2(uuid[])`: <=64 Product ID, <=256 Offer, private `recommendation_admission_runtime` EXECUTE, health와 원시 Offer JSON 반환 | 기존 읽기 계약은 재사용 후보이나 서비스 호출권한·입력 분할·소비자 DTO 변환 확인 필요; 결과가 곧 CTA 허가는 아님 | 마이그레이션 확인 |
| C-09 | `lib/product-purchase-link.js` 직접 URL은 올리브영·화해·일부 브랜드 공식몰만 검증; `lib/commerce/safe-commerce-fetch.mjs`의 seller 정책은 현재 올리브영 중심 | 쿠팡/임의 공식몰 URL을 단순 seller_key만으로 직접 열면 안전 경계 이탈. SSRF·리다이렉트 등 도메인별 감사를 별도 수행 | 코드 확인 |
| C-10 | D8D v2 SQL은 SNATURE 하나 + 공식몰/화해 두 Offer 원자적 정정용, gate OFF | 범용 4채널 읽기/선택옵션/입수·갱신 파이프라인 아님. 해당 단일 Product 교정과 전 상품 구매처 비교를 **분리**해야 함 | 코드·설계 확인 |
| C-11 | PR #1255 최신 기준 CI Supply Chain Security 실패, issue #1208 OPEN, 보안 초안 PR #1288 미병합 | 롤아웃 병합/운영 전환 차단. 예외 기한을 늘려 우회하지 않음 | GitHub 확인 |
| C-12 | `app/api/results/*`, `app/api/full-report/*` 및 공유 링크 경로 존재 | 저장 결과 재진입/공유와 Offer 데이터의 최신성·권한 경계는 추가 경로 추적 필요 | 경로 존재만 확인, 전달 계약 미검증 |

### 공통 판단 우선순위

1. **Recommendation Product ID & exposure authority** (추천 여부·보류 상태)
2. **Seller Offer evidence & exact option identity** (가격 출처·시각·묶음 구성)
3. **Offer read + filtering projection** (표시 가능 여부·동일 구성 정렬)
4. **Direct CTA trust/health** (링크 클릭 허가 — 가격 표시와 독립)
5. **Shared UX/analytics** (동일 컴포넌트·노출 상태·클릭 측정)

누락된 단계를 다음 단계에서 추측으로 보충하지 않는다.

## 2. 마일스톤 / 의존성 / 우선순위

| 단계 | 우선 | 목적 | 의존성 | 보호 범위 | 완료 정의 |
| --- | --- | --- | --- | --- | --- |
| **D8K-0: Inventory & correctness baseline** | P0 | 모든 추천 카드와 DTO 경로 실사, NULL 가격·fallback 오류 재현 | 없음 | 읽기·순수 테스트 | 소스별 매핑 100%, 미확정/보류 케이스 검증 |
| **D8K-1: Offer 표시 계약/정렬 엔진** | P0 | Product ID → 판매처 Option DTO, 비교 그룹/상태·정렬 pure projector | D8K-0 | 순수 라이브러리, API/DB 무변경 | fixture + 악성 입력/옵션 구분 테스트 통과 |
| **D8K-2: 실제 Offer 읽기·옵션 증거 적합성** | P0 | 기존 RPC 재사용 가능성·옵션/배송비 부족분 확정, 승인된 DTO 설계 | D8K-0,1 | DB/RLS/API **설계 후 별도 승인** | 접근 권한·64/256 상한·증거-옵션 모델과 HOLD 정리 |
| **D8K-3: 공통 구매처 UI** | P1 | 소형/상세 공통 컴포넌트, 빈 데이터/묶음표시/상태 | D8K-1 | UI만, mock Offer 사용 | 모바일/다크모드/ko-en/접근성 스냅샷 통과 |
| **D8K-4: 전 추천 경로 연결** | P1 | 무료+프리미엄+루틴+기능성+예산 대안의 재사용 UI 연결 | D8K-2,3 | API read/결과 계약 변경 여부 별도 승인 | **유효 추천 카드 100% 커버**, 기존 추천 score/rank 보존 |
| **D8K-5: 판매처 증거 수집·운영 관리** | P1 | 4채널 URL/옵션 식별, 수동/자동 갱신·신선도·링크 상태 | D8K-2,4 | 수집 권한·DB 저장·외부 호출 별도 승인 | 검증된 제안→승인→제공, 실패 시 즉시 차단 |
| **D8K-6: 보안/회귀/격리 전수 검증** | P0 release gate | 스코어 분리·CTA 차단·재진입·운영 역호환 | D8K-1~5 + #1208 해결 | CI/보호 경계 | 모든 필수 검증 green, 드리프트 0 |
| **D8K-7: 점진 노출·운영 감시** | P2 release gate | 읽기전용→제한된 실제 노출→전체 추천 확대 | D8K-6, 운영 승인 | 배포/Production **명시 승인** | 롤백 실행 가능성·실계측 검증·이상 0 |

**설계/테스트는 보안 이슈 #1208 해결과 병렬 가능**하나 **병합·호스팅/운영 노출은 독립 차단**. D8D v2 단일 Product 실제 교정·전용 롤백은 D8K의 범용 구매처 읽기와 병렬 진행하되 서로의 승인/완료를 대체하지 않는다.

## 3. 단계별 보수 작업과 검증 시나리오

### D8K-0 — 기존 추천/저장 결과 흐름 동결 및 전수 매핑 (첫 실행 단위)

**변경 예정 영역(진단 우선):** `app/result/page.js`, `app/result/full-report/page.js`, `components/result/**`, `components/full-report/**`, `app/api/analyze/route.js`, `app/api/full-report/route.js`, `app/api/results/**`, `lib/product-source.js`.

- [ ] **카드 inventory matrix** 작성: UI 위치, 원본 data path, `product.id` 유무, 노출 권한, 현 가격 소스, 현 CTA 소스, 결과 재진입/공유 여부, 교체 예상 컴포넌트.
- [ ] 무료 추천(Top Pick·카테고리·서포팅·free-v2 포함), 프리미엄 Top Pick·서포팅·기능성(주요/보조/예산)·AM/PM 루틴·다른 실제 추천 카드, 공유 결과/저장 재진입을 **실제 실행 분기**로 확인. 단지 파일 경로 존재는 커버리지로 계산하지 않음.
- [ ] 현재 보유 제품/사용 기록·미확정 추천·`HOLD`/ `UNKNOWN` 후보·단순 상품 언급은 구매처 비교 표시 대상과 구분.
- [ ] **NULL/0 버그 fixture**: `Number(null)` 경로를 비롯해 `undefined`, `""`, `0`, `NaN`, 정상 24,500, 구간 표시. 실제 0원 허위 출력 발견 시 API 없이 pure/shared price formatter로 고칠 수 있는지 선행 판단.
- [ ] 엔진 baseline 저장: 기존 164×12=1,968 점수쌍과 166×12=1,992 구조 후보, core rank/top1/top3, U10 budget alternative의 정책상 변화 비교(기존 D8H 검증 근거 재확인). **예산 목록 변화까지 무조건 0건이라고 요구하지 않음.**

**Exit G0:** source→render→CTA 대응표; null 값·hold 표시 현황; 정확한 수정 대상 파일과 테스트 명령. Product/Offer 운영 쓰기 0.

### D8K-1 — 범용 Offer projector, comparator, fail-closed policy

**권장 비보호 신설 모듈:** `lib/commerce/product-offer-comparison-contract.mjs`, `lib/commerce/product-offer-comparison-projector.mjs`; 단독 검증 `scripts/product-evidence/verify-d8k-offer-comparison-v1.mjs`. 이름은 구현 시 기존 모듈 중복 여부 확인 후 확정.

- 입력은 `{productId, admissionState, offers[]}`. catalog Product ID 문자열/UUID를 보수적으로 검증하고 **무ID·중복·다른 Product ID** Offer를 배제한다.
- 표시 DTO: `sellerKey`, `sellerName`, `offerId`, `listingId`, `optionIdentity`, `packComposition`, `currency`, `observedAmount`, `shippingKnown`, `shippingAmount`, `observedAt`, `availability`, `offerState`, `scopeState`, `linkHealth`, `ctaAdmission`, `comparisonGroup`. 근거 없는 필드는 **null/HOLD**, 상품명에서 수량·SKU 추론 금지.
- 비교 가능성을 먼저 partition: **동일 Product / 선택옵션·용량·묶음수·증정/세트 의미 / KRW**까지 검증된 경우만 같은 그룹. 배송비를 포함한 총 결제금액이 완전히 확인된 Offer끼리 *총액* 정렬; 미확인 배송비에서는 '확인된 상품/옵션 가격순'이라고 표현하되 총액 최저가 표시 금지. gift kit과 단품은 별도 섹션.
- `price_amount=0/null`은 정상 최저가 후보로 처리하지 않음(0원 이벤트/무료 증정 별도 검증 전 HOLD). `unknown` 재고는 품절도 재고있음도 아니다.
- **유효시간**은 원본 `observedAt`과 정책 설정으로 검사. 초기 제안: 7일 초과를 '가격 재확인 필요', '최저가' 배지는 최대 24시간 이내 + 동종 비교 그룹 완전성 + 배송비 확인 조건. **이 숫자는 정책 후보이며 OWNER/운영 실측으로 확정 전 운영 배지에 사용하지 않는다.**
- 판매처 우선순위는 채널 노출 순서일 뿐 신뢰도 점수가 아니다. 가격 동률 시 공식몰→올리브영→화해→쿠팡 순은 **제안값**, 확정 전 고정 우대와 추천 점수 연결 금지.
- 링크는 `href` 승인 가능할 때만 반환하며, `listing_url` 확보와 직접 CTA 허가를 분리한다. 신뢰/정합성 확인 못한 링크는 비활성 표시; 네이버 검색 fallback은 '상품 검색'으로 명확히 분리.

**Exit G1:** 순수 함수 테스트가 0/1/2/4/5개 판매처, 동일/다른 옵션, 묶음+증정, 무료·유료 배송, stale/품절/unknown, 중복 URL, ID 충돌, 악성 URL, null 가격, 0원, 임의 seller를 포함. Rank/Score 입력/출력 변경 0.

### D8K-2 — 데이터·옵션 정체성·read authority 정합

**우선 기존 것을 재사용:** `public.product_offers` + `read_product_offer_presentation_authority_v2(uuid[])`. 새 schema/RPC를 만들기 전에 현 기능의 한계를 검증한다.

- [ ] 실제 서비스가 호출할 신뢰 경로의 `recommendation_admission_runtime` 역할/권한, service_role 직접 RPC 불가 여부, RLS/SECURITY DEFINER 소유자/검색 경로를 재감사. 브라우저에 고권한 DB 접근·비밀키 제공 금지.
- [ ] 64 Product ID·256 Offer limit를 **명시적 실패/분할 계획**으로 다루고 초과를 조용히 누락하지 않는다. N+1 호출 금지; 결과 Product ID 기준 배치 매핑.
- [ ] 기존 `seller_key+listing_id` unique는 동일 페이지의 다른 옵션(단품/세트/용량)을 각각 저장할 수 없는 구조. **새 option identity key 또는 별도 옵션 엔터티가 필요한지** 판매처별 실증 후 결정. 임의로 listing ID에 접미사를 붙여 우회 금지.
- [ ] `selected_option`, 구성 수량·증정 SKU, 배송비/총액, 가격 캡처 근거·관측 시각/업데이트 원천을 **저장할 정규화 필드가 실제 있는지** 검증. 없다면 migration/API/storage protected proposal 작성(즉시 실행 금지).
- [ ] 관측 출처 `source_name`과 판매처 `seller_key` 혼동 금지. 공식몰 브랜드별 도메인 소유 관계, 쿠팡 판매자·옵션, 올리브영 goodsNo, 화해 listing ID를 별도 증빙.
- [ ] 가격 변동/품절 시 무엇을 `retire`하고 무엇을 versioned evidence로 남기는지 감사·이력 계약을 따로 설계. 현재 `product_offers`는 **완전한 가격 히스토리 테이블이 아님**.
- [ ] 서비스 응답에 Offer를 추가하는 방식은 **새 보호 API 계약** 또는 기존 서버 저장/조회 read projection 중 근거 기반 선택. 기존 `/api/analyze` 응답 필드나 저장된 결과 JSON을 임의 변경하지 않음. 저장된 리포트는 **추천 Product ID를 기준으로 후속 최신 Commerce read**, 신규 분석/재점수 실행을 강요하지 않는 설계 우선.

**Exit G2:** canonical Product-ID 연결·seller/listing/option 근거·읽기 권한·배치 상한·보존/히스토리 스키마 결론과 차단 사항 문서화. 미검증 채널 데이터는 HOLD.

### D8K-3 — 공통 제품 구매처 UI (컴포넌트 선행)

**컴포넌트 목표:** `ProductOfferComparison` 공통 표현(기본 compact + expanded 상세), 모바일 최적화. **무료/프리미엄에서 로직을 복사하지 않는다.**

- 기본: 상품마다 '구매처 비교' 토글/확장, verified seller 1~4+ 개 row, 가격과 구성·배송비 여부·관측 시각. compact 추천 카드에는 개별 4개 버튼을 모두 강제 배치하지 않음.
- 상품 추천 적합도/주의/HOLD 카드와 판매처 옵션 UI의 시각적 위계 분리. 프리미엄 '오늘의 리포트' **허브에는 쇼핑 대시보드 추가하지 않음**.
- 80ml 단품 그룹의 '최저가'와 2팩·증정 기획세트의 '다른 구성'을 명확하게 구분. 옵션 미확인 행은 가격만 보여주더라도 허위 최저가/직접 CTA를 부여하지 않음.
- 비어 있음: '확인된 구매처 없음/가격 확인 중'과 네이버 검색 fallback을 별도 표기. 부분 데이터(공식몰만 있는 경우)에도 다른 3곳의 존재를 허위 암시하지 않음.
- UX: ko/en, 원/통화 레이블, 320~390px 모바일, dark/light, keyboard/focus, screen reader, 새 창 rel, 긴 옵션명, 저모션, 링크 비활성 상태.

**Exit G3:** 고정 fixture 화면 스냅샷과 UI/접근성 검증, 비즈니스 랭킹·API 응답·DB 무변경.

### D8K-4 — 전체 추천 화면 결합 / 저장 재진입 / 클릭 계측

1. `app/result/page.js` Top Pick 및 category/supporting card, expanded modal, 무료-v2 화면의 실제 추천 카드에 **동일 Offer 컴포넌트 삽입**; 단일 `buy_link` 직접 구매 CTA는 승인 정책에 따라 명확히 대체하거나 안전 fallback 유지.
2. `app/result/full-report/page.js` Top Pick Hero, Supporting, 대안/Usage, `components/full-report/PremiumFunctionalDecisionSection.jsx` 주요/보조/예산 탭, `PremiumRoutineConsultSection.jsx` AM/PM `step.product`에 동일 계약 적용.
3. `app/api/results/**`, `app/api/full-report/**`, 공유 링크 `app/r/[shareId]` 및 프리미엄 재진입에서 **실제로 노출되는 모든 추천 Product ID**를 식별. 오래된 저장 결과에서 `buy_link`만 남았을 때도 안전하고 의미가 정확한 fallback.
4. `Product ID 없는 추천 후보`·`HOLD/UNKNOWN`·현재 사용중인 제품·비추천 참고 예시를 구분해 과도한 구매 CTA 부착 금지.
5. `click_buy_link` 이벤트는 기존 소비자를 깨지 않게 유지하며, **sellerKey/offerId/selectedOption/comparisonGroup/link kind** 등 신규 attribution은 별도 분석 계약 승인 후 확장. 링크 클릭 이벤트가 Product 카드 클릭으로 중복 처리되지 않는지 확인.

**정량 완료 조건:** (a) 테스트 fixture에서 추출한 *실제 유효 추천 카드 수*를 분모로, Offer 비교 렌더 적용률 **100%**; (b) data 없는 카드도 안전한 empty state 100%; (c) '잘못된 판매처 직접 URL' **0건**; (d) 기존 추천 순위/점수 불변(별도 승인된 budget admission 예외는 diff로 분리).

### D8K-5 — 판매처 운영 파이프라인 및 초기 데이터 확대

- 채널: **공식몰, 쿠팡, 올리브영, 화해** 우선 지원, 그 외 채널은 allowlist/정규화 확장 가능한 설계. 각 상품 4곳이 반드시 있어야 하는 것은 아님.
- 먼저 수동 검증 가능한 **작은 파일럿군(제안: 여러 카테고리에 걸친 약 10개 추천 상품)**을 뽑아 Product identity, SKU/옵션, seller/listing, 스크린샷·관측 시간, 실결제 가격, 링크 상태, 증정/배송 여부를 증빙. **10개는 검증 규모 제안, 현재 데이터 존재 주장 아님.**
- 쿠팡: 실제 판매자/옵션/동일 상품 여부 구분. 공식몰: 브랜드별 도메인+옵션 검증; 올영: 정확한 상품 goods ID; 화해: 기획세트 범위·구성 확인.
- 수집 방법/빈도/약관·robots·외부 도구 권한/요청 제한을 검토하기 전 대량 크롤링 금지. `safe-commerce-fetch`는 현재 올영 중심이므로 4채널 공통 크롤러가 이미 있다고 주장하지 않는다.
- 승인된 가격만 표시, 갱신 실패 시 기존 가격을 '현재가'로 계속 노출하지 않고 시점과 재확인 필요 상태로 후퇴. 링크 건강 검사 `403/429`는 곧바로 품절이나 404로 오판하지 않음.
- 가격 이력·선택 옵션·소스 캡처 보존, seller별 누락률, 의심 링크율, 품절/오류 유형을 관리자 화면에서 볼 수 있는 read-only 운영 패널은 확장 후보.

**Exit G5:** 첫 데이터 코호트의 verified identity/option/price/link 관측 증빙과 갱신·비활성 경로를 재현, 임의 판매처 가격·URL 생성 0.

### D8K-6 — 회귀·보안·릴리스 Gate

필수 테스트 계층:
- **단위:** 표시/비교 그룹/가격 null/운송비/통화/옵션·URL sanitization; Property-style 중복·비정상 데이터.
- **엔진:** 기존 164×12(1,968) 및 166×12(1,992) real-engine replay에서 추천 score/rank/top1/top3 변화 0. 기존 U10 budget alternative 1/12 변화는 Price-null 처리로 설명 가능한 변화인지 별도 명시.
- **경로:** free Top Pick/Supporting/Modal, free-v2, premium Top/Supporting/AM-PM/Functional primary-secondary-budget, usage/alternatives, 저장 결과 재진입/공유. `NULL`/가격 미확인에서 `0원` 노출 0.
- **보안:** `lib/product-purchase-link.js`, `safe-commerce-fetch.mjs` 차단 규칙과 실제 4채널 allowlist를 별도 심사. DNS rebinding, internal IP/SSRF, cross-host redirect, 임의 스킴, ID spoof, open redirect, 403/429, expired listing, CAPTCHA/동적페이지를 직접 URL 신뢰로 승격하지 않음.
- **DB/Auth:** RLS/owner/service-role 최소권한·읽기전용 경계; 64/256 초과와 0/1/다중 Offer; nonce/tenant/session 누출 없음을 격리 PG17 및 관련 DB CI에서 확인.
- **사용성:** 모바일·데스크톱 light/dark, ko/en, 느린/오프라인, 가격 조회 실패, 링크 새 창. 최신 Offer 조회 오류가 분석 결과 자체를 죽이면 차단.
- **CI:** Database Integration Authority, Current Main Health, Security Boundary, Admin integration, canonical & shadow, mobile API, **Supply Chain Security #1208 해결**. 실패/skip을 PASS로 계산하지 않는다.

**Exit G6:** 모든 mandatory checks PASS, owner-승인된 변경 범위 내 회귀 0, 보안 예외 임의 연장 0, Production DB identity·rollback·관찰 계획 근거 확보.

### D8K-7 — 안전한 배포·전환

- 개발/preview에서는 mock→격리 검증→기존 DB 역할 확인된 read-only shadow→작은 사용자 코호트 → 100% 추천 화면의 순으로 전환하되 **승인되지 않은 호스팅/Production 실행은 진행하지 않음**.
- 권장 독립 스위치: `offerComparisonUI`(화면)와 `offerDirectCTA`(외부 링크 허가) 분리. 둘의 독립 OFF 경로 검증. 설정/배포 자체는 별도 Protected 승인 후 구현.
- 1차 모니터링: 추천 응답 정상률, Offer adapter 오류/지연/누락, 안전하지 않은 URL 차단 건수, 가격 데이터 freshness, SKU 비교 불가 비율, CTA 오류·클릭/구매처별 전환, free/premium 렌더 에러.
- 치명 오류 시 **CTA OFF → Offer 비교 UI OFF → 기존 추천 및 분리된 안전 검색 fallback 복귀**. 이미 변경된 DB 데이터를 임의 덮어쓰지 않고 버전드 ledger/승인된 롤백 경로만 사용.
- D8D v2 SNATURE Product correction gate는 이 공통 commerce UI rollout 스위치와 **독립 유지**, 특정 상품 정정 미완료를 시스템 전체 seller UI 배포의 자동 승인/거부로 오해하지 않는다. 다만 잘못된 Product identity가 드러난 SKU는 개별 차단한다.

## 4. 첫 구현 PR 분할안 (과설계·대형 PR 회피)

| PR 묶음 | 포함할 최소 변경 | 금지/제외 | 선행 Gate |
| --- | --- | --- | --- |
| **PR-A / D8K-0~1** | UI slot/DTO 인벤토리, Product NULL 가격 재현 테스트, 순수 Offer projector·negative tests | DB/API/seller allowlist/운영 호출 없음 | G0 |
| **PR-B / D8K-3** | shared component + mock fixtures + responsive/accessibility | 실제 URL/가격을 mock 근거로 출시하지 않음 | G1 |
| **PR-C / D8K-2~4** | 확인된 read authority·Product ID batch adapter·free/premium integration | 새 DB schema/API/Auth 필요 시 분리 승인 PR, 코어 점수 미수정 | G2~3 |
| **PR-D / D8K-5** | 판매처별 verified evidence/data ops·link health, 필요한 경우 독립 schema proposal | 단일 SNATURE D8D v2를 범용 크롤러로 개조 금지 | G2, G4 |
| **PR-E / D8K-6~7** | 종합 regression, release packet, 단계별 rollout and rollback runbook | Security #1208 실패 상태 병합/배포 금지 | G6 |

현 PR #1255는 기존 R16I 교정·D8D v2 검증과 보안 차단을 가진다. D8K 실제 UI/API 구현은 **별도 소형 PR 권장**. 이 로드맵 파일을 #1255에 인덱싱하는 것이 곧 대형 구현을 같은 PR에 누적한다는 뜻은 아니다.

## 5. 중단 규칙 / 의사결정 대기표

| 차단 상황 | 강제 처리 |
| --- | --- |
| 무ID/불명 Product, SKU/옵션·묶음 identity 불명 | 해당 Offer `HOLD`, 임의 유사 상품 연결 금지 |
| 대표 Product NULL·legacy price, 무료/프리미엄 `0원` 렌더 | 가격 미확정 표시, 위조 fallback 가격 금지, 단계 G0 회귀 작성 |
| 링크 host/option/redirect 신뢰 검증 불가 | 직접 CTA 비활성, 검색 fallback은 검색이라고 명시 |
| `read_product_offer_presentation_authority_v2` 실행권한/64·256 초과 등 불명 | 안전한 read adapter 진단·보호 API 별도 승인, browser DB role 확대 금지 |
| schema/권한/Auth/API response/저장 포맷 변경 필요 | 소스·위험·migration/rollback 명시한 **별도 승인** 전 보류 |
| 판매처 수집 약관·RateLimit·captcha·403/429 | 공격적 우회 금지, 해당 seller 자동 수집 HOLD |
| Product Fact/리뷰 정체성 충돌, 미확정 추천·HOLD 제품 | 상품 단위 구매처 노출 차단, 추천 엔진 등급 승격 금지 |
| 핵심 추천·저장/공유/결제·안전 경계 CI 실패 | 원인 단위로 차단/복구, 무관한 리팩터링 금지 |
| Supply Chain #1208 실패 또는 Production DB identity 미증명 | 실제 병합/배포/데이터 APPLY HOLD; 로컬·격리 설계/테스트만 진행 |

### 아직 승인되지 않은 선택

1. 동일 판매처 다중 옵션을 표현할 **스키마 정규화 방식** 및 가격 이력 보존 수준.
2. 실제 가격 TTL/갱신 빈도, 배송비 미확정 상태의 정렬 및 최저가 배지 기준.
3. 가격 동률 시 채널 표기 우선순위, 쿠팡 제3자 판매자 허용 조건.
4. 전용 UI와 직접 CTA 각각의 운영 릴리스 권한/데이터 소스 및 서버 API 설계.
5. SNATURE 대상 Product 80ml identity/리뷰 모집단과 D8D v2 실제 정정 요청/승인.

### 가장 먼저 실행할 다음 작업

**D8K-0 — 소스 기반 `추천 UI slot → Product ID/data source → 현재 가격·CTA → 공통 Offer adapter` 매핑표를 실제 브랜치 코드로 작성하고, NULL/0 가격 및 기존 추천·저장 재진입 회귀 baseline을 고정한다.** 이 단계는 운영 DB 접근·마이그레이션·배포 없이 진행 가능하다.

## 6. 검증·기록 방식

- 각 PR/phase 종료 보고: **목적, 변경 파일, source of truth, 실행한 검증, 결과, 미완료 HOLD, 다음 단계, rollback/stop 상태**.
- ROADMAP status는 **NOT_STARTED → DESIGN_READY → CODE_READY → VERIFIED_ISOLATED → RELEASE_HOLD → RELEASED**만 근거 기반 변경. '설계 완료'와 '운영 데이터 적용'은 절대 같은 완료 상태가 아니다.
- 연결된 외부 도구·Production 관측이 필요하지만 허가나 접근이 없는 경우, 확인하지 못한 항목을 `UNATTESTED`로 기록하고 다음 차단 조건으로 남긴다.
- 문서 경로/근거: `AGENTS.md`, `.codex/AI_ROUTER.md`, `.codex/SECURITY_BOUNDARIES.md`, `docs/taxonomy-ai/r16i-r4-d8j-universal-offer-comparison-policy-20261014.md`, 현재 페이지/DB 소스. 이 문서의 숫자 제안(TTL, pilot)은 실측/운영 승인 아님.

## 7. D8K-0 실행 checkpoint (2026-10-14 KST)

- **실제 화면 기준선/데이터 연결표**: [D8K-0 active-surface & null-price baseline](r16i-r4-d8k0-active-recommendation-surface-and-price-baseline-20261014.md). 현재 무료 결과는 `FreeResultV2RecommendationGuideStep`의 Top Pick **1 slot**; 프리미엄 `SkinMatchStepReport`는 AM/PM `step.product` 2 slot + 기능성 주요/보조/예산 3 slot; 공유 결과 Top Pick/category picks 2 slot = **8개 종류의 실제 코드 slot**. 사용자별 상품 수가 8개라는 뜻 아님.
- **중요한 재분류**: 구형 무료 `ProductDecisionCard`·프리미엄 `TopPickHeroCard`/`SupportingProductCard`/`BudgetAlternativeCard`/`ProductUsageCard` 등은 현재 실제 flow에서 **미호출**. 구현 범위에 잘못 포함하지 않는다. MY 저장 이력은 리포트 링크 목록으로 별도 추천 카드가 아님.
- **구현 보수**: `lib/product-price-read-contract.mjs::formatKnownProductPriceLabel` 도입, `components/full-report/PremiumFunctionalDecisionSection.jsx`에서 `Number(null)` 가격 오표시 교체. numeric Product 가격만 수정, 임의 입력 `product.priceLabel` 우선 표시 근거는 후속 실사 HOLD.
- **새 실행 검증**: `scripts/product-evidence/verify-d8k0-active-surface-null-price-baseline-v1.mjs`를 D8F offline verifier에 연결. 18개 비정상 값×2개 언어 등 **160 price assertions**. Database Integration Authority의 실제 D8K0 stage PASS 확인 — [CI run #38533727203](https://github.com/gycha0109-beep/K_beauty/actions/runs/38533727203), 해당 run은 중간 코드 HEAD 4e6d3d24aafdf95026834d896ecdb715e69f921a 기준이다. **최종 문서 HEAD CI 별도 확인 필요.**
- **엔진**: 기존 D8H 164×12(1,968), 166×12(1,992) replay 재사용. NULL 가격 가정에서 core score/rank/top1/top3 delta 0, U10 budget 대안 1/12 변동은 삭제/무시 금지. D8K-0 자체는 가격 데이터/랭킹을 수정하지 않음.
- **상태**: D8K-0 **SOURCE_MAPPED + PRICE_FIX_VERIFIED_OFFLINE**, 실제 추천 Product ID per-row attestation·브라우저 E2E 100%·seller Option authority는 후속 단계까지 HOLD. 따라서 범용 Offer UI 기능 완료/Production ready라고 표시하지 않음.
- **D8K-1 최우선 주의**: `lib/product-offer-read-path.js`에 `selectCurrentProductOffer` / `applyProductOfferReadPath`가 **이미 존재**함. 새 다중 Offer comparator를 만들기 전에 기존 single-offer 선택·link trust를 중복 구현하지 않도록 재사용 차이를 먼저 검토.

## 8. D8K-1 판매처 가격 비교 계산기 구현 checkpoint (2026-10-14)

- 상태: **CODE_READY / VERIFIED_OFFLINE WHEN CI GREEN / REAL_DATA_AND_UI_HOLD**. [구현 및 검증 설명](r16i-r4-d8k1-four-seller-option-comparison-implementation-20261014.md).
- 구현: `lib/commerce/product-offer-comparison-v1.mjs` (순수 read projection, DB/API/추천 점수 무변경). **공식몰·쿠팡·올리브영·화해**를 우선 지원하되 확장 판매처도 검증된 데이터로 표현할 수 있음. 정렬은 같은 SKU/구성/수량/증정 품목의 동일 그룹만 허용.
- 확인된 선택가격은 관측금액 기준이며 배송비 확인된 그룹만 합산 총 결제금액 기준 정렬. **최저가 배지 기본 비허가**(누락 채널/시점 등 실데이터 불충분). 80ml 단품 vs 80ml×2+세럼 10ml 증정은 분리. 실제 제품 가격·링크 수집/사용자 화면 노출은 아직 연결 안 됨.
- 보안: 기존 `lib/product-purchase-link.js::resolveProductPurchaseLink`를 재사용. seller/URL 출처 불일치, 미확인 재고·링크·가격 시점, 쿠팡처럼 새 도메인 allowlist 미승인 때 직접 CTA 차단. source data TRUE flag는 DB/근거 authority 대체가 아님.
- 기존 `public.product_offers`는 한 seller+listing ID에 한 행으로 제한되므로, 같은 listing의 여러 옵션을 서로 다른 실제 Offer로 우회 생성 금지. schema/RPC 보호 영역은 **변경하지 않음**, D8K-2에서 독립 조사/approval.
- 테스트: `scripts/product-evidence/verify-d8k1-four-seller-comparison-v1.mjs` (0/1/2/4/5 sellers, 다중 옵션·증정 구성·배송비·중복 listing/ID, 악성 직접링크, null/0, 과거/미래 가격), 기존 `verify-r16i-price-scope-review-v1.mjs` CI 체인에서 실행. **운영 데이터 쓰기 0건 / API 변경 0건 / 엔진 랭킹 수정 0건**.
- D8K-2 다음 단계: 승인된 Product ID, 상품/선택옵션/배송비/판매처/관측시간 근거가 실제 데이터에 존재하는지 읽기-only로 실사; 64 Product/256 Offer RPC 제한 및 서비스 권한 확인; 운영 사용/스키마 변경은 별도 승인. D8K-3 UI 구현 및 D8K-4 무료·프리미엄 전체 활성 카드 연결까지 아직 남음. #1208과 별도 release gate 유지.

## 9. D8K-2 bounded private Offer transport checkpoint (2026-10-15)

- **Status: CODE_READY / SYNTHETIC_OFFLINE_VERIFIED / AUTHORIZED_REAL_DB_READ_HOLD.** Audit: [D8K-2 private Offer read and evidence audit](r16i-r4-d8k2-private-offer-read-evidence-audit-20261015.md).
- Existing private RPC has a 64 Product / 256 Offer per-call limit. New read-only module groups explicitly selected, valid recommended Product UUIDs; de-duplicates and splits requests, checks exact returned Product/Offer identities, declines partial/malformed responses and denies total rows >256. No direct database client or new role/privilege is created.
- **Existing schema insufficient:** selected option ID, unit/quantity/pack, kit gifts, shipping, verified checkout composition and provenance are not represented. Unique seller+listing ID/URL prevents multiple selectable options under one page being persisted as separate Offer records. Do not invent rows or claim verified prices.
- Current read transport returns seller/offer identifiers as unverified diagnostics only; no raw URL or amount, no price/comparison/CTA authority. Unlike D8K-1 synthetic full-option fixtures this does not establish any actual four-seller Offer.
- Offline synthetic verifier: scripts/product-evidence/verify-d8k2-offer-authority-read-v1.mjs; linked into existing D8F/DB gate. **Exactly pinned new branch CI is required** before VERIFIED_ISOLATED can be claimed. 23 synthetic cases observed in local Node draft execution; actual RPC, Product IDs, protected API, browser UI and seller evidence remain UNATTESTED.
- Next no-protection work is D8K-3 reusable mock component. D8K-4 real routing/data/permissions, D8K-5 evidence collection, DB option schema/RLS/API and #1208 safety gate continue independent HOLD. Existing R16I D8D v2 owner approval OFF.

## 10. D8K-3 shared mock commerce UI checkpoint (2026-10-15)

- **Status: CODE_READY / NODE_SYNTHETIC_VERIFIED / BROWSER_AND_REAL_SELLER_DATA_HOLD.** See [D8K-3 shared mock UI](r16i-r4-d8k3-shared-comparison-mock-ui-20261015.md).
- Added a shared bilingual renderer and pure, D8K-1-output-only view model at components/commerce/ProductOfferComparison.jsx and lib/commerce/product-offer-presentation-v1.mjs. Visual grouping by single/multipack/kit; explicit shipping status, observation date, no false cheapest badge. Mobile-first 1-column to desktop 2-column, light/dark and accessible status markup.
- No live product pages were modified, no operational seller prices were attached, and **purchase buttons are hard-disabled** in this UI stage, even when passed a synthetic fixture with CTA flags. No actual user-facing offer card exists yet.
- Added synthetic-only presentation verifier, included in existing database integration chain. Local Node draft: 14 scenarios PASS; full browser visual/a11y/keyboard and PR-specific CI pending separate checks.
- D8K-4 live recommendation wiring remains **not started** because Product IDs/actual seller options/authorized RPC caller and public share boundaries are not attested. Protected DB/API/Auth/RLS changes remain subject to separate approval; #1208 still blocks merge/release.

## 11. D8K-4 active recommendation identity boundary checkpoint (2026-10-15)

- **Status: SOURCE_BOUNDARY_CODE_READY / SYNTHETIC_CI_PENDING / LIVE_WIRING_HOLD.** See [D8K-4 actual slot-to-ID boundary](r16i-r4-d8k4-active-recommendation-offer-wiring-boundary-20261015.md).
- Added `lib/commerce/active-recommendation-offer-slots-v1.mjs` to enumerate the actual eight source slot types (free F-01, premium routine P-01~02, premium functional P-03~05, public share S-01~02). It only validates/deduplicates syntactic Product UUID candidates; public share, HOLD plan and absent IDs remain blocked.
- `scripts/product-evidence/verify-d8k4-active-offer-slots-v1.mjs` checks synthetic ID/HOLD/duplicate/share limits and source anchors; imported to the existing read-only D8F CI gate.
- **Explicit non-completion:** There is no private database caller, per-SKU price/shipping evidence, real Product admission, browser integration, active `ProductOfferComparison` rendering or CTA. API/DB/Auth/RLS/saved results unchanged. #1208 continues to block merge/release; user approval needed before protected server/API/schema changes.

## 12. D8K-4B admission-to-Offer server read preflight (2026-10-15)

- **Status: SOURCE_AND_ADMISSION_CONTRACT_RECONCILED_OFFLINE / SERVER_ROLE_AND_OPTION_EVIDENCE_HOLD.** See [D8K-4B guarded admission/Offer boundary](r16i-r4-d8k4b-admission-to-offer-server-read-approval-boundary-20261015.md).
- Added `lib/commerce/active-offer-admission-reconciliation-v1.mjs`. It checks eight mounted recommendation slot types and candidate UUIDs against the existing recommendation admission decision envelope, decision types, counts and G2/legacy markers. A matched snapshot produces only `DIAGNOSTIC_MATCH_ONLY`; no real admission proof, SQL/RPC caller, seller price or CTA authority.
- Read batch sizes are previewed through the existing D8K-2 64-ID bounded planner. Rejection, stale/missing/duplicate/malformed decisions, public share, tampered privileges, over-limit candidates and unexpected authority are HOLD. Synthetic D8K-2 read handoff discards mocked price/URL.
- Offline test `scripts/product-evidence/verify-d8k4b-active-offer-admission-reconciliation-v1.mjs` imported into the existing D8F chain. Draft in-memory test execution 174 assertions PASS; exact PR HEAD CI remains separately evidenced.
- Crucial missing protected approvals: verified server read/provenance, `recommendation_admission_runtime` role binding, real selected-option/pack/shipping evidence, additional schema/API fields and public-share safety, blocked release #1208. **No active UI activation or protected edits.**

## 13. D8K-5 selected option evidence storage/read + actual UI OFF-gated mount (2026-10-15)

- **Status: DRAFT_SCHEMA_AND_READER_CONTRACT / SYNTHETIC_TESTED / SQL_NOT_APPLIED / ACTIVE_UI_RELEASE_OFF.** Detailed [D8K-5 evidence & UI checkpoint](r16i-r4-d8k5-selected-option-evidence-storage-read-ui-20261015.md).
- Reviewed the `product_offers` seller+listing uniqueness; proposed separate append-only selected-option observations plus independent reviewer events under one actual parent Offer. Draft SQL files in `docs/taxonomy-ai/sql/`, **NOT** `supabase/migrations`. No schema, RLS, grants or Product/Offer data writes executed.
- Proposed bounded private option SQL reader with latest-observation-before-review filtering, 64 Product / 256 options and no broad client permissions/URL/CTA; server read role and protected runtime still await independent approval.
- Added `lib/commerce/product-offer-selected-option-evidence-v1.mjs`: strict DTO, timestamps, optional shipping, review digest, selected pack and 64-batch/256-total fail-closed transport with all price/CTA authority OFF.
- Adapted D8K-1 comparator for two independently reviewed child options under same seller listing while preserving collisions/legacy denial and child CTA block; tightened D8K-3 total-with-shipping arithmetic.
- Added `RecommendedProductOfferSlot` mount to actual F-01, P-01/P-02, P-03/P-04/P-05 components. Live comparison release hardcoded OFF; public share S-01/S-02 not modified. Linked focused tests to existing D8F chain.
- Hold: SQL/PG17 permission tests, actual seller options/reviewer evidence, live server role/admission, actual browser/checkout, #1208 issue/PR #1288 security, no merge/deploy.

## 14. D8K-6 revocable selected-option review and shipping evidence baseline (2026-10-15)

- **Status: REVIEW_REJECTION_AND_SOURCE_SEPARATION_SHADOW_READY / PG17_NOT_EXECUTED / RELEASE_OFF.** Evidence: [D8K-6 review history + shipping acceptance](r16i-r4-d8k6-review-revocation-shipping-evidence-preflight-20261015.md).
- Found D8K-5 proposal could not append rejection after initial verification because `observation_id` was unique in reviewer table. Corrected proposal to append-only review events with `unique(observation_id,reviewed_at)` and rank **latest observation then latest review** before verdict/filter. Latest rejection suppresses prior valid price; new unreviewed observation does not silently fall back.
- Proposed digest/actor separation `source_evidence_sha256`, `collector_actor_key`, `reviewer_actor_key`; private read requires latest review digest == raw source digest and reviewer != collector (actual identity/auth still unproven).
- Added explicit `shipping_price_basis`: `unknown`→NULL, `seller_published_flat`→non-null integer including 0. DTO rejects inconsistent shipping status.
- New pure `product-offer-review-history-shadow-v1.mjs` and D8K-6 regression imported into existing CI. Synthetic in-memory tests: 107 assertions D8K-6 PASS, 274 D8K-5 PASS. **No real PostgreSQL execution or release approval.**
- The existing offer/option/parent schema remains unchanged; SQL only in docs, no migrations/API/Auth/RLS/grants/production mutation. #1208 still blocks merge/deploy.

## 15. D8K-7 disposable local Docker PG17 acceptance handoff (2026-10-15)

- **Status: LOCAL_PG17_RUNNER_PREPARED / STATIC_GUARDS_PASS / USER_LOCAL_SQL_RUN_PENDING.** See [D8K-7 Windows Docker runbook](r16i-r4-d8k7-local-docker-pg17-acceptance-20261015.md).
- Discovered the D8K-6 review-only SQL schema had unexpectedly grown to 19KB with repeated/truncated `collector_actor_key` and reviewer digest CHECK fragments. It was not executable despite prior keyword-based checks. Rebuilt the schema review proposal to ~5KB, exactly 2 tables and 1 transaction.
- Added `scripts/product-evidence/run-d8k7-local-pg17.mjs`: creates/removes its **own** local Postgres 17 container with `--network=none`, no port/bind/volume, ephemeral tmpfs and no `.env`/Supabase access. Before running, user manually pulls `postgres:17`. On Windows PowerShell: `node scripts/product-evidence/run-d8k7-local-pg17.mjs`.
- Local fixture uses existing minimal Product/Offer and restricted owner role baseline; checks real PG17 schema/negative role grants/RLS, 65-product and 257-option caps, option revocation, source/actor separation, and shipping CHECK constraints.
- D8K7 static verifier imported into existing D8F CI: 44 source/harness assertions PASS in isolated JS. Real PG17 test **has not been run by assistant**; user will run locally and return `D8K7_LOCAL_DOCKER_PG17_PASS` or first error.
- No hosted DB, protected migrations/API/Auth, production data, price display, purchase CTA or deployment modified; #1208 still blocks merge/release.

### D8K-7 실제 로컬 PostgreSQL 17 실행 근거 접수 (2026-10-15)

- **상태 갱신: USER_REPORTED_LOCAL_PG17_PASS / PRODUCTION_RELEASE_HOLD.** 사용자가 Windows Docker Desktop `postgres:17` 격리 컨테이너로 fixture 7/7을 실행한 콘솔 전체 결과를 제공했다. `D8K7_CHECK_FILES_PASS`, `D8K7_PG17_SQL_ACCEPTANCE_PASS`, `D8K7_LOCAL_DOCKER_PG17_PASS`, 거절 검증 7건 및 `Removed disposable local PG17 container.` 관측.
- 근거 기록: [D8K-7 실행 안내 §7](r16i-r4-d8k7-local-docker-pg17-acceptance-20261015.md). 이는 이전 synthetic/static만에서 **실제 사용자의 격리 PG17 SQL runtime 통과**로 증거 수준이 상승한 것이다. 보낸 로그에 로컬 `git rev-parse HEAD`는 없어 정확한 로컬 체크아웃 SHA까지 independently attested된 것은 아니다.
- 다음 실질 단계: **D8K-8 진짜 판매처 선택옵션 증거 수집→독립 검토 경계**, 기존 R16I admin read-only 검토 워크벤치 및 Offer source-binding 계약 우선 재사용. 이 단계가 해결되기 전에는 해당 데이터의 display/CTA 권한을 생성하지 않는다.
- 실제 운영 DB/RLS migration, 브라우저/서버 role binding, 인증된 actor, 실제 제품 가격·구매 링크, #1208 보안 이슈 해결은 미완료. 모든 병합·배포 계속 HOLD.

## 16. D8K-8 real-seller option evidence capture/review intake (2026-10-15)

- **Status: LOCAL_ACTUAL_SOURCE_INPUT_PATH_READY / PUBLIC_SOURCE_DISCOVERY_ONLY / VERIFIED_SELLER_PRICES_ZERO / PRODUCTION_RELEASE_HOLD.** [D8K-8 manual intake review handoff](r16i-r4-d8k8-manual-selected-option-evidence-intake-20261015.md).
- Located real candidate seller pages for R16I 80ml (official snature.kr product_no=151; Hwahae goods/35905, **distinct** from prior goods/45194; Coupang product 8393759227 selected itemId+vendorItemId), without promoting cached display prices as checkout observations. Exact Olive Young goodsNo and verified parent Offer ID still missing.
- Reused R16I's existing seven evidence-review questions as contract guidance, existing `resolveProductPurchaseLink` offline official/OliveYoung/Hwahae source URL identity, and D8K-6 latest-review shadow consistency. No generic admin page or new privileged API created; R16I workbench remains a fixed-product route.
- Added `lib/commerce/product-offer-manual-review-intake-v1.mjs` to fail closed on archive SHA-256 mismatch, SKU/kit/shipping/option/source URL/age mismatch, same collector+reviewer, incomplete seven-field review, source listing crossbind. It produces **private** SQL-compatible observation/review event candidates only; authenticated actor and actual source truth are still unproven.
- Added local-only `prepare-d8k8-local-option-review-v1.mjs`: reads an operator-provided screenshot/HTML/PDF and capture + separate review JSON, computes SHA-256 from file bytes, prints redacted status only. No network, external seller fetch, database, file write, price or URL output, or CTA.
- Synthetic V8 direct contract tests **403 assertions PASS** (URL parser shim only for isolated test harness). Node local file smoke verifier is checked into repo; not yet run against an actual local filesystem in this assistant runtime. Real seller capture bytes/independent reviewer evidence have **not** been received.
- Existing D8F verifier import chain extended for both D8K8 tests. D8K7 owner-reported real PG17 gate remains passed, but DB write/API/Auth/RLS/admission/merge/deploy authorization all HOLD; security #1208 remains open.

### D8K-8 Windows Native Node 24 CLI failure + repair checkpoint (2026-10-15)

- Owner: original HEAD `bf74be69` D8K8 metadata test **403 PASS**; native tempfile CLI fails at intentionally invalid PNG scenario (line 98), before subsequent symlink tests. Root cause: CLI emitted expected redacted `HOLD` JSON to stderr, which contained Node module type warning; verifier parsed combined warning+JSON as one object.
- Current repair: CLI success and HOLD both emit one JSON object to stdout; HOLD still exits with status 1; verifier reads only stdout and no private path/content is logged. Added four regressions, fetched-source isolated synthetic **407 PASS**.
- **Owner native Windows/Node rerun STILL PENDING.** Need both D8K8 focus tests after fetching latest branch; prior 403 PASS does not imply fixed native test PASS. No product/offer writes, public prices, CTA, schema/API/migration/secret/production changes; #1208 OPEN.

### D8K-8 Windows Node 24 fixed-head acceptance (2026-10-15)

- **USER_REPORTED_NATIVE_LOCAL_PASS:** Owner updated to `HEAD 40890e5a`, ran both D8K-8 focused verifiers: contract metadata **407 assertions PASS**; tempfile/CLI SHA-256 and review **21 assertions PASS**. Prior intentional invalid PNG / mixed Node warning JSON failure is repaired and locally verified.
- Evidence recorded in [D8K-8 runbook §7](r16i-r4-d8k8-manual-selected-option-evidence-intake-20261015.md). Node `MODULE_TYPELESS_PACKAGE_JSON` warning persists without test failure; not an excuse to alter project-wide ESM configuration.
- **D8K-8 implementation complete at synthetic/local-file acceptance grade**, not actual merchant offer evidence grade. CLI says `realSellerEvidence=false`, `sourceVisualContentExamined=false`, `reviewerIdentityAuthenticated=false`, `productionDbWrites=0`, `pricePublished=false`.
- Remaining D8K-9 real-world operator evidence: authenticated independent capture/reviewer, actual Product + parent Offer lookup/selected-option binding, original source archive and checkout/stock/shipping conditions. No deployment, DB migration/RLS/API/CTA until separately approved; security #1208 open.

## 17. D8K-9 canonical Product / parent Offer / seller selected-option binding boundary (2026-10-15)

- **Status: OFFLINE_PARENT_IDENTITY_RECONCILIATION_READY / LIVE_DB_AUTHORITATIVE_ORIGIN_HOLD / PRICE_CTA_OFF.** [D8K-9 Product/parent Offer binding audit](r16i-r4-d8k9-canonical-product-parent-offer-binding-20261015.md).
- D8K-8 manual capture packet previously lost seller/listing identity after a checksum/metadata match; added an immutable (still untrusted) `sourceLocator` to retain exact seller key/name, listing ID/URL, brand, productName for cross-stage anti-swap checks. No stored schema or API change.
- New `lib/commerce/product-offer-parent-identity-reconciliation-v1.mjs` requires a Product record, exact product-scoped `read_product_offer_presentation_authority_v2` response plus **independent** seller+listing-ID and seller+listing-URL collision probe rows. Checks one parent UUID, Product ID, brand/name, base unit (not bundle total), current/product-scoped KRW/KR, in-stock and healthy link, selected Coupang item/vendor versus bare parent URL, duplicate/cross-seller collisions and fresh timestamp. No new DB/API/Auth/role changes; raw price or URL never projected.
- Replayed real **historical** `fixtures/recommendation-metadata/r16i-d8f-candidate-d4-readonly-prestate-20261013.json` in synthetic test. R16I `size_ml=160` vs 80ml selected unit holds; if size were hypothetically 80, offers[] absent so parent Offer still not found. No invented parent Offer ID and no inference that 2026-10-13 prestate equals current operational state.
- `scripts/product-evidence/verify-d8k9-parent-offer-identity-binding-v1.mjs`: fetched-source in-memory V8 **468 assertions PASS**; D8K-8 synthetic regression **407 PASS**. Full native Node CI on exact PR HEAD must be separately confirmed. New test imported into D8F price review chain. No actual Supabase RPC, seller source bytes or browser flow executed.
- D8K-9 owner/protected gate pending: authenticate current Product/source/formulation and existing parent Offer real IDs with explicitly authorized read-only operator, independent observed screenshot/selected SKU + reviewer, DB role-bound RPC, 100% active recommendation slot E2E; open #1208 continues to block merge/deploy.

### D8K-9 사용자 Native Node 검증 완료 (2026-10-15)

- **USER_REPORTED_NATIVE_NODE_PASS, 468 assertions**: Windows PowerShell에서 정확한 `HEAD c462f2b8`, `D8K9_CANONICAL_PRODUCT_PARENT_OFFER_COLLISION_BINDING_SHADOW` PASS 확인.
- 기록: [D8K-9 문서 §5](r16i-r4-d8k9-canonical-product-parent-offer-binding-20261015.md). 이전 단독 V8 synthetic 검증에 더해 Windows Native Node 런타임 테스트 완료. `MODULE_TYPELESS_PACKAGE_JSON`은 비차단 경고.
- 이번 검사는 `offlineSyntheticOnly=true`, 실제 서버 RPC/실제 seller 증빙/Product Fact/live admission/운영 DB 변경·가격/CTA 전부 NOT VERIFIED/NOT AUTHORIZED. **D8K-9 로컬 검증 완료 ≠ 실제 판매 가격 비교 출시 가능.**
- 별도 Git 오류 `origin/fix/migration-composer-form-disambiguation`는 D8K-9 정상 fetch/check-out 이후 검증 PASS와 무관. 해당 다른 브랜치의 문제는 여기서 임의 수정하지 않음.
- 다음 실질 게이트는 권한 승인된 **현재 DB 읽기 전용 Product/Offer 3-way 실사** + 실제 선택옵션 캡처·독립 검토다. #1208 OPEN, stacked Draft PR 유지, merge/deploy 금지.

## 18. D8K-10 operational Supabase SELECT-only reality check — 2026-10-15

- **Status: USER_APPROVED_HOSTED_DB_SELECT_COMPLETED / EXISTING_R16I_EVIDENCE_AVAILABLE_BUT_UNVERIFIED / COMMERCE_RELEASE_HOLD.** [D8K-10 operational read-only audit](r16i-r4-d8k10-operational-select-only-audit-20261015.md); [redacted structured snapshot](../../fixtures/recommendation-metadata/r16i-d8k10-live-select-only-snapshot-20261015.json).
- Actual connected Seoul-region Supabase PG17.6 at 16:47 KST: R16I Product `b639c8b4-6a61-440e-b4db-fac7381593ff` still `size_ml=160`; `product_fact_subjects=[]`, trust intake `SUBJECT_CREATION_REQUIRED/REVIEW_REQUIRED`, `product_source_bindings` `hwahae:45194` `product_subject_unresolved`.
- **R16I parent product_offers=0; by seller/listing ID=0; by seller/listing URL=0**. No matching Offer for seller candidate `hwahae:35905`, Coupang product 8393759227, or SNATURE product 151. No approved proposal, review decision, application, or enabled R16I release gate.
- Important positive discovery: **R16I already has 2 archived evidence rows** (official single 80ml and Hwahae 80ml×2+serum10ml). Both have object path and SHA-256 reference but are currently `UNVERIFIED`; no image file/body read. Avoid asking to re-capture everything; independently review existing records first.
- Across all **73** actual Product Offer rows: 72 OliveYoung are `product_subject_unresolved` with unknown stock/link; 1 Torriden official is product-scoped/in_stock but `link_health_state=unchecked`. D8K-9 current/product-scoped/in-stock/healthy/KR/KRW **0 eligible**, before even checking option evidence.
- Existing restricted RPC `read_product_offer_presentation_authority_v2(uuid[])` exists with execution restricted to `recommendation_admission_runtime`; new option child tables/RPC do **not** exist on hosted DB. Did **NOT** call RPC or alter data, RLS, role, Auth, Storage, API or migrations.
- **Next protected hinge:** authorize controlled READ of the two existing restricted Storage originals and independent authenticated owner review (separate from prior SELECT-only approval), then design correction/approval and real parent Offer; schema/DB writes/price display/merge/deploy remain unapproved. Supply-chain #1208 still OPEN.

## 19. D8K-11 existing archived capture checksum / independent reviewer preflight (2026-10-15)

- **Status: OFFLINE_ARCHIVE_PREFLIGHT_PREPARED / HISTORIC_TWO_EVIDENCE_ROWS_EXIST / UNVERIFIED / STORAGE_PRIVATE_ACCESS_HOLD / OWNER_SELF_REVIEW_GUARD_MISSING.** [D8K-11 operator review runbook](r16i-r4-d8k11-existing-archive-independent-review-preflight-20261015.md).
- D8K-10 actual Supabase SELECT established two existing private R16I capture records (official 80ml single and Hwahae 80ml×2+serum10ml), file path+digest recorded but **both UNVERIFIED**. Current admin UI already has private GET evidence and 60-second signed-image preview, plus existing OWNER owner-verdict POST. No new admin UI/API needed.
- **Security gap**: `reviewR16IEvidence` currently SELECTs only `evidence_id,product_id`, then writes `reviewer_id=actorId`; it does not compare evidence `submitted_by` to reviewer account, re-hash bytes, or server-verify seven fields. OWNER can potentially self-approve, so legacy `VERIFIED` does not meet D8K independent reviewer guarantee. **Auth/API/writer changes require separate explicit user approval; NOT modified here**.
- Pure `lib/product-intelligence/r16i-d8k11-existing-evidence-preflight.mjs` validates exact existing R16I official+seller pair, selected SKU text, SKU/pack distinction, captured-to-stored-to-reviewed chronology, private archive SHA256/magic/length/path extension, different submitter/reviewer metadata and seven source-review fields. Returns no raw prices, URLs, hashes, private actor IDs, signed links, buyer data, and NO production price/CTA/write authority even if metadata matches.
- Added `scripts/product-evidence/check-d8k11-local-existing-archives-v1.mjs` for future **owner-authorized local copies** of the two archived originals, using explicit file paths and private JSON. Network/db/Storage access absent; HOLD until actual raw bytes and auth provenance are available. New synthetic tempfile Node CLI smoke test.
- Fetched-source isolated V8 pure contract tests: **462 assertions PASS** with a stand-in hash/Buffer (not native Node SHA). CLI and Node-focused tester passed static syntax parsing, but **native Node child-process and real original screenshots not tested**. Added two focused tests to existing D8F verification chain.
- D8K-10 SELECT permission cannot be interpreted as permission to download private Storage objects or POST review verdicts. No scope increase, DB schema/Auth/role/production data price updates, merges or deployments. #1208 remains open.

- **Additional protected ledger revocation gap:** `supabase/migrations/20261012172837_taxonomy_ai_r16i_correction_approval_ledger_v1.sql` declares `evidence_id uuid NOT NULL UNIQUE`, so a later append-only REJECTED verdict cannot revoke an earlier VERIFIED verdict on the same original capture. This differs from D8K-6 latest-review revocation. This D8K-11 track only flags it; no DB/role/DDL/API/owner verdict mutation is approved.

### D8K-11 owner Windows native Node acceptance (2026-10-15)

- **USER_REPORTED_NATIVE_NODE_PASS** at exact `HEAD ccfef7e8`. Existing R16I archive/reviewer structural verifier **462 assertions PASS**; local tempfile SHA-256+child-process CLI smoke **21 assertions PASS**. Node typeless-package warning did not block.
- [D8K-11 audit §7](r16i-r4-d8k11-existing-archive-independent-review-preflight-20261015.md) records result. Native Node execution replaces earlier V8-only hash shimming as the execution-level grade for synthetic tests. Actual private Storage originals / merchant authenticity / authenticated independent reviewer remain NOT TESTED.
- Existing `reviewR16IEvidence` self-review prevention **NOT ENFORCED** and legacy ledger UNIQUE evidence verdict revocation limitation still need separately approved protected fixes. Two existing R16I evidence records remain UNVERIFIED; don't grant product/offer/price/CTA authority or use D8K-11 PASS as evidence of launch readiness. #1208 open.

## 20. D8K-12 OWNER 자기 승인 차단 + 승인 철회(2026-10-15)

- **상태: 관리자 코드·격리 DB 변경안 준비 / 운영 DB·서비스 미적용 / 릴리스 HOLD.** [D8K-12 보수 설계·검증](r16i-r4-d8k12-owner-review-revocation-20261015.md).
- OWNER 권한을 가진 제출자라도 본인이 올린 캡처는 승인·반려할 수 없도록 새 보호 DB 함수에서 **제출자 UUID와 로그인 검토자 UUID**를 대조. 데이터 확인·잠금은 상품→원본→현재 판정 순서로 진행하여 기존 D8D 상품 변경과 승인 철회를 직렬화.
- 증빙 판정은 기존 v1 단일 현재상태를 유지하면서 새로운 RLS 적용의 **변경 불가능한 v2 감사 이력**에 초기 VERIFIED/REJECTED, 후속 REVOKED 사건을 순서대로 기록. 철회 시 현재 VERIFIED→REJECTED를 원자적으로 수행해 기존 D8C/D8D 검증에서 과거 승인이 다시 쓰이지 않도록 함. 반려/철회된 동일 캡처 재승인 불가.
- 서비스 역할의 기존 verdict INSERT 권한을 철회하고, OWNER·원본 제출자 확인을 수행하는 한정 함수로만 심사 기록을 허용. 일반 로그인/비회원 함수 실행 권한 없음. 기존 관리 화면에 철회 버튼·이유·시각 이력 노출. 고객/가격/상품/Offer API 미변경.
- **기존 원장에 판정 행이 한 건이라도 있으면 변경 적용을 거절**: 기존 승인 재해석·임의 덮어쓰기를 방지하는 의도적인 사용자 확인 절차. D8K-10 캡처 UNVERIFIED는 별도 원장 0건의 증거가 아님.
- 기존 D8C, D8K11 검사와 새 D8K12 테스트를 연결. 새 가상 검증과 역할/승인 철회/옛 승인 재사용을 포함한 **로컬 Docker PostgreSQL17 실제 검사**를 준비했으나 로컬 실행과 운영 활성화는 별도 확인 필요.
- 별도 승인 전 운영 Supabase migration, 리뷰 본문/Storage 열람, 관리자 승인 POST, 상품 교정/Offer 쓰기, 가격 노출, PR 병합·배포 금지. 보안 #1208 미해결.

## 21. D8K-13 최신 이관 checkpoint — 2026-10-17

- **현재 단계:** `SEC05_CLAIM_COMPLETE_FAIL_RANKING_SCOPED_SYNTHETIC_PG17_PASS / HISTORICAL_PROVENANCE_P0_OPEN / PRODUCTION_HOLD`. 2026-10-17 21:16 KST 사용자가 전달한 8개 Git blob 고정 Windows PostgreSQL17 러너 최종 PASS를 후속 증거로 수락했다. 기록된 원시 로그가 이 채팅에 없어 독립 로그 재해시 및 SQL statement별 증명은 하지 않았다. [최신 SEC-05 home 결과](r16i-r4-d8k13-home-sec05-acl-pg17-acceptance-20261017.md).
- **신규 metadata-only 증거 및 오프라인 보강:** `d8k13-sec05-extended-home-pg17-acceptance-20261017.json`, fail-closed Git blob 검증 모듈, D8K-13 3개 HOLD verifier. 테스트 고정 8개 코드 SHA 모두 GitHub 현 blob과 대조됨. 이후 metadata/docs/verifier 변경은 과거 Windows 시험의 코드 핀을 변경하지 않는다.
- **P0 READ-only 재확인:** 연결된 PostgreSQL17의 178건 applied history, `source_rankings` 언급 6건, `product_candidates` 언급 40건. 직접 `CREATE TABLE` 및 `GRANT/REVOKE` 좁은 패턴은 둘 다 0건이나 전체 최초 출처의 부재 증명이 아니다. 현재 두 테이블의 RLS/일반 역할 직접 접근 차단은 확인. Taxonomy8의 예외 1건은 `promoted`·`resolved` 후보 한 건과 연결됐지만 canonical assignment 0건이고 product_form도 NULL이다. [P0 감사](r16i-r4-d8k13-crawler-tax8-source-ranking-lineage-20261017.md).
- **차단 게이트:** 전체 migration clean replay, historical ACL 생성 출처, Crawler native parser, taxonomy8 누락 원인, 실제 백업/PITR 복원, 독립 OWNER·Security Advisor, 보안 #1208 및 owner 별도 적용 승인. D8K-5~7 구매처 UX/운영 자동화가 릴리스된 것으로 해석하지 않는다. **D8D v2 게이트 OFF / Product·Offer·가격·CTA 적용 0 / PR #1341 Draft / `--enforce-release` 코드 3 / RELEASE HOLD.**

## 22. D8K-13 P0 최초 스키마 출처·Taxonomy8 writer 경계 (2026-10-17 후속)

- **추가 SELECT-only 실증:** 최초 운영 적용 migration `20260410`에 `product_candidates` ALTER, `source_rankings` 참조 view가 존재하지만 두 테이블 최초 CREATE가 없다. 178개 저장 이력의 명시적 직접 CREATE/ACL REVOKE·GRANT 패턴도 미확인. 따라서 **기록 이전/외부 bootstrap provenance를 독립 복원해야 한다**. 현재 공개 역할 SELECT/INSERT는 차단되고 RLS ON; 이것을 초기 보안 이력 증명으로 해석하지 않는다.
- **Taxonomy8 단일 누락의 경로:** 후발 상품 1건은 `crawler-canonical-product-structural-adoption-v1`의 `inserted` Product이다. Candidate에는 shadow manual legacy 분류가 있지만 Product assignment가 0. 현재 structural writer는 category만 쓰며 assignment를 만들지 않는 반면 catalog-only writer는 assignment를 쓴다. Product INSERT의 활성 트리거도 assignment를 생성하지 않는다. 원인 경로는 구체화됐지만, **structural writer의 정책 수정/자동 보정은 승인되지 않았다.**
- **검증 자료:** `scripts/product-evidence/sql/d8k13-p0-acl-taxonomy-provenance-readonly-v1.sql`은 운영 SELECT-only로 성공했으며, 비식별 JSON baseline과 source-pin fail-closed verifier를 `verify-d8k13-hosted-provenance-v1.mjs`에 연결했다. [P0 상세](r16i-r4-d8k13-crawler-tax8-source-ranking-lineage-20261017.md) §8.
- **순서 유지:** D8K-13 운영 migration lineage·보안·백업 복원 P0가 우선이며, 모든 구매처 비교 D8K-5~7 또는 D8D v2 판매 UI 적용을 출시 승인으로 오해하지 않는다. #1208 OPEN / 백업·독립 OWNER·배포 DB 동일성 등 미입증 / **PR #1341 Draft·HOLD / 운영 DB write 0 / `--enforce-release` exit 3**.

## 23. D8K-13 pre-ledger 기반 복원 준비 게이트 (2026-10-17)

- 조사 추가: 초기 Git 트리(2026-04-08)에는 bootstrap SQL이 없으며 2026-04-10 초기 migration SQL은 기초 테이블을 사전 존재 객체로 간주한다. 현재 운영의 두 기본 테이블/ACL 집계 증거만으로는 과거 권한 또는 migration replay의 시작 상태를 인증할 수 없다.
- 운영 SELECT-only 스키마 프로필 검사 PASS. 적용 SQL 178건 복원 전 11개 prerequisite를 JSON 증거 및 fail-closed 분석기로 고정했고 전체 마이그레이션 진단기에 연결했다. 인증되지 않은 초기 schema를 임의 생성하거나 `migration repair`를 통한 거짓 정상화 금지.
- 다음은 **초기 bootstrap/배포 artifact 독립 확보 → SQL 순서·이력 정합 인증 → 격리 PG17 clean replay → backup/PITR 실복원과 독립 보안 승인**이다. Taxonomy8 structural writer는 발견된 불일치 경로의 의도 확인 및 별도 검토 승인 전 유지한다.
- 보안 #1208 OPEN / D8D v2 OFF / Product·Offer·가격·CTA 변경 0 / PR #1341 Draft / 릴리스 HOLD 지속.

## 24. D8K-13 PG17 시작점 경계 실제 재현 (2026-10-18)

- 실제 GitHub Actions #39059702566: Native Node 22 preledger/ACL/Taxonomy8 source pin 및 릴리스 exit 3 PASS. 별도 PostgreSQL17.6 임시 DB에서 초기 applied migration `20260410`은 **원본 `public.products`가 없어 예상대로 실패**, transaction rollback PASS.
- 초기 Git README는 최초부터 `source_rankings`, `product_candidates`, `crawl_jobs` 저장을 전제로 하나 원본 DDL/GRANT 자체는 없다. 기존 178개 migration history가 이를 생성하지 않는다는 진단과 결합하면 **초기 bootstrap artifact 미확보가 재현 가능한 진짜 선행 차단 조건**이다.
- 실증 결과를 날짜·원본 tested SHA·workflow run/job IDs·범위/제한까지 비식별 JSON에 고정. **전체 replay PASS와 혼동 금지**; #1208, OWNER, 초기 ACL, restore drill 미확인. 운영 DB write 0 / 보정·머지·배포 HOLD.

## 25. D8K-13 synthetic PG17 첫 단계 양방향 검증 (2026-10-18)

- **추가 실증:** 별도 PostgreSQL17.6 synthetic DB에서 설계된 테스트 전용 기초 테이블 `products`, `product_candidates`, `source_rankings`와 각 1행을 먼저 넣고 최초 `20260410` SQL의 타입 변환/뷰/FK/backfill 성공을 확인. 병렬 음성 대조에서는 빈 DB의 예상 실패·롤백 확인. 둘 다 실제 GitHub Actions #39062707665.
- **결정 경계:** 이는 첫 이력 SQL의 최소 호환성 입증이지, **실제 초기 스키마 CREATE/GRANT 출처 확보도 전체 178건 replay 완료도 아니다**. `local-shadow` bootstrap의 `products.id text`는 초기 migration 요구 UUID FK와 달라 역사적 출처 증명이 될 수 없다.
- 첫 단계 양성/음성 증거와 고정 Git blob을 재검증기에 연결. 다음 항목은 실제 초기 schema/ACL 및 과거 178건 원문 승인된 추출·복원, isolated real-history replay, 실제 restore drill, OWNER/security #1208. **HOLD 유지, 운영 DB write 0.**

## 26. D8K-13 최초 bootstrap 원본 확보 전용 intake (2026-10-18)

- 최초 프로젝트 생성일 **2026-03-21 UTC** 확인: 최초 GitHub commit(2026-04-08 UTC)보다 앞서므로 원본 CREATE/GRANT 출처는 Git 초기 이전 수동 설치 또는 별도 archive 가능성. GitHub 검색/타 repository / Google Drive / Supabase 메타데이터 조사에서 **인증 가능한 원본 SQL·백업 미확보**.
- 공식 Supabase 일반 백업/통상 PITR 보존기간은 수개월 전 초기 상태의 자동 복원을 보장하지 않는다. 조직의 요금제·백업 실제 목록은 **미조회**이며 독립 장기보관 아카이브 확인 필요.
- 외부 비공개 SQL을 SHA-256/size 확인 후에도 **CANDIDATE_ONLY_NOT_ATTESTED**로 판정하는 오프라인 intake 및 9개 자기검증을 CI에 추가. SQL 덤프 Git commit, 민감값 출력, 자동 replay는 금지. 기존 11개 preledger gate 계속 false, #1208 OPEN, PR #1341 Draft/HOLD.
- 후속 의사결정: 실제 원본 archive + timestamp/execution evidence + ACL/Owner provenance 확보 시에만 독립 전문가 검토 후 합성 fixture를 보조 비교로 유지하며 **별도 격리 PostgreSQL17 전체 이력 복원**에 착수. 운영 변경은 별도 승인 전 금지.

## 27. D8K-13 현재 운영 DB 기준 복구 우선순위 전환 (2026-10-18)

**사용자 지시로 운영 복구 목표의 우선순위를 변경한다.** 초기 2026년 bootstrap SQL 추적 및 178 migration 원문 복구는 별도의 역사성 감사 과제로 유지하되, **서비스 재해 복구**는 현재 실제 운영 DB의 승인된 시점 기준 스냅샷·덤프를 활용한다. 원본 178 재현을 완료해야만 현상태 복구를 검증할 수 있다는 가정은 폐기한다. 이것은 이력 결함의 삭제나 release gate 자동 통과를 의미하지 않는다.

실제 운영 DB에서 SELECT-only로 관측한 `public` 메타데이터: PostgreSQL 17, 테이블 101, 뷰 6, 컬럼 1,425, 기본키 101, 외래키 233, 함수 187(SECURITY DEFINER 135), RLS enabled 101/forced 4, 정책 58, 트리거 23, enum 5. 기록: `d8k13-current-public-recovery-inventory-20261018.json`. **이는 메타데이터 기준선이지 스키마 SQL/행 백업이 아니다.**

실제 CI [#39109843279](https://github.com/gycha0109-beep/K_beauty/actions/runs/39109843279)에서 PostgreSQL17.6 합성 3개 테이블/3개 테스트 행을 **schema-only+data-only dump**하고 새 격리 DB에 트랜잭션 복원, catalog와 synthetic data/view 값을 비교해 PASS. `d8k13-current-recovery-synthetic-restore-drill-20261018.json`으로 고정. 임시 dump는 종료 시 삭제하고 운영 DB는 접근하지 않았다.

**다음 P0:** 승인된 비공개 장소에서 실제 현재 schema/roles/data dump를 획득(원문·자격증명을 저장소/CI에 노출하지 않음), object storage/Auth/암호화 의존성 포함 여부 검토, 격리 PG17에 복원, 구조·데이터·ACL/RLS 동등성 검증, Owner/Security 독립 승인. **운영 DB writes 0, #1208 OPEN, PR Draft, release HOLD**. 실행 절차: `docs/taxonomy-ai/r16i-r4-d8k13-current-state-recovery-runbook-20261018.md`.
