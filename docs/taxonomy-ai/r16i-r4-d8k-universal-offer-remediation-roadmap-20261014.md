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
