# D8K-9 — 실제 선택옵션 캡처 → 기존 Product / 부모 Offer ID 결속 진단

> 2026-10-15 · Track taxonomy-ai · **DRAFT_OFFLINE_IDENTITY_GATE / HISTORICAL_R16I_HOLD / LIVE_DB_AND_PRICE_HOLD**
>
> 이전 승인: D8K-7 사용자 로컬 PostgreSQL 17 성공, D8K-8 사용자 Windows Node 24 검사 407+21 성공. 이 둘은 실제 판매처 옵션의 SKU/원본 진위·현재 운영 DB ID 결속/추천 승인을 증명하지 않는다.
>
> 이번 구현은 **일반 상품의 read-only Product + Offer 연결 계약**에 한정한다. Auth/DB/RLS/API/배포/가격 공개/구매 CTA를 변경하지 않는다.

## 1. 실제 코드 기준 결속에 필요한 데이터

기존 기준:

- `public.products(id,brand,name,category,size_ml)`: 원본 Product를 식별한다. `size_ml`이 160인 과거 R16I Kit 표기를 80ml 기본 SKU와 자동 동일시하면 안 된다.
- `public.product_offers`: `offer_id` → `product_id` FK, `seller_key`, `seller_name`, `listing_id`, `listing_url`, `offer_state`, `product_scope_state`, `availability_state`, `market_code`, `currency_code`, `link_health_state`.
- `read_product_offer_presentation_authority_v2(uuid[])`: 내부 전용 조회, 64 Product ID·256 Offer 제한, `read_contract_version='product-offer-presentation-authority-read-v2'`. **RPC의 실제 실행은 이번 단계에 포함되지 않는다.** `anon`, `authenticated`, `service_role`에게 임의 실행 권한 추가 금지.
- `lib/product-offer-r16i-r4-d4-db-reader.mjs`의 특정 상품 읽기 패턴: Product ID 조회, `offers_by_product`, `offers_by_listing`, `offers_by_url`을 각각 읽는다. 공통 범용 관리자 API로 재사용하지 않고 **세 종류의 결과를 교차 대조하는 불변 조건**만 재사용한다.
- D8K-8 `inspectManualOptionCapture`의 `sourceLocator`: 그 원본 확인 시 함께 제출된 seller key·seller listing ID·페이지 주소·상품명을 유지하여 이후 검토 단계에서 판매 페이지를 바꿔 끼우기 어렵게 한다. 텍스트 정보 자체는 신뢰된 DB/발행자 증명이 아니다.

새 코드 `lib/commerce/product-offer-parent-identity-reconciliation-v1.mjs`:

`reconcileManualOptionParentIdentity({capture,review,snapshot,nowIso,maxSnapshotAgeMs})`

`snapshot` 계약 (현재는 **운영에서 읽지 않고** 테스트·설계 증거용):

```js
{
  observedAt: "UTC_ISO_TIME",
  queryProductId: "EXISTING_PRODUCT_UUID",
  product: {
    id: "EXISTING_PRODUCT_UUID",
    brand: "EXACT_CANONICAL_BRAND",
    name: "EXACT_CANONICAL_NAME",
    category: "moisturizer_cream",
    size_ml: 80
  },
  offerRead: {
    read_contract_version: "product-offer-presentation-authority-read-v2",
    status: "AUTHORITY_RESOLVED",
    offers: [
      // Raw v2 RPC rows from a genuine, separately authorized server read.
      // includes offer_id, product_id, seller_key/name, listing_id/url,
      // offer_state, product_scope_state, currency_code, market_code,
      // availability_state and link_health_state
    ]
  },
  bySellerListing: [
    // separately read product_offers rows for EXACT (seller_key,listing_id)
  ],
  bySellerUrl: [
    // separately read product_offers rows for EXACT (seller_key,listing_url)
  ]
}
```

예시의 본문은 **타입을 설명**하는 것이지 승인된 server executor는 아니다. `snapshot`은 외부에서 전달한 JSON이므로 `status=AUTHORITY_RESOLVED`가 적혀 있어도 실제 역할·출처가 증명되지 않는다. 새 서버 API·조회 경로를 만들거나 해당 raw JSON을 클라이언트에 보내면 안 된다.

## 2. 실패 차단 규칙

| 조건 | 처리 |
| --- | --- |
| D8K-8 캡처·독립 검토·옵션 SKU/해시가 불일치하거나 검토가 거절됨 | `CAPTURE_REVIEW_IDENTITY_INCONSISTENT` |
| 오래됐거나 미래 시각인 Product/Offer 조회 스냅샷, 조회 Product ID 불일치 | HOLD |
| 제품 UUID/브랜드/이름이 캡처와 다름 | HOLD |
| Product 기준 용량이 NULL·없음 또는 선택 단품 단위 용량과 다름 (160ml ↔ 80ml 등) | `CATALOG_UNIT_SIZE_VS_SELECTED_OPTION_CONFLICT` 등 HOLD |
| v2 계약·상태 불일치, 과다/혼입·중복 Offer, 부모 Offer ID 미발견 | HOLD; **새 Offer UUID를 제조하지 않음** |
| 판매처, 정확한 listing ID 또는 URL이 캡처와 다름 | HOLD |
| 부모 Offer가 retired, unresolved, 시장/통화 다름, 재고 확정 불가 또는 링크 상태 미검증 | HOLD |
| 해당 (판매처, listing ID), (판매처, listing URL) 전역 조회가 빠짐·중복됨·부모와 다름 | HOLD |
| 쿠팡 itemId·vendorItemId로 특정 선택옵션을 촬영했지만 부모 listing URL이 단순 제품 URL임 | 두 URL의 제품 경로와 판매처가 **정확히 일치할 때만** 진단 가능; 다른 item/vendor 쿼리는 거절 |
| 모든 진단 항목 형식상 일치 | `PARENT_LISTING_MATCH_DIAGNOSTIC_ONLY` **가격·SKU 원본/DB 실제 출처·인증된 리뷰·생산 write·CTA 권한은 계속 false** |

제품의 `size_ml`이 확인돼도 **실제 Product Fact subject/formulation**의 현재 승인 자체는 증명하지 못한다. 80ml 단품과 80ml × 2 묶음은 부모 listing을 공유할 수 있지만 **기초 상품 SKU·증정 구성의 원본 증거는 별도 검토**가 필요하다.

## 3. 보유했던 R16I 과거 실제 조회 기록으로 판단

`fixtures/recommendation-metadata/r16i-d8f-candidate-d4-readonly-prestate-20261013.json`에서:

- canonical Product `b639c8b4-6a61-440e-b4db-fac7381593ff` / 에스네이처 아쿠아 스쿠알란 수분크림 / `size_ml=160`.
- 상품 소스 바인딩은 `hwahae goods/45194`에 묶여 있으나 `product_scope_state='product_subject_unresolved'`.
- `offers_by_product=[]`, `offers_by_listing=[]`, `offers_by_url=[]`, `subjects=[]`. 따라서 **과거 읽기 시점에는 실제 부모 Offer 행의 존재가 확인되지 않았다**.
- D8K-9 검증기에서 80ml 선택 단품을 제출하면 `CATALOG_UNIT_SIZE_VS_SELECTED_OPTION_CONFLICT`. Product `size_ml`를 *가상으로* 80으로 바꿔도 여전히 `PARENT_OFFER_NOT_FOUND_IN_PRODUCT_SCOPE`.

**이 자료는 2026-10-13 당시의 read-only snapshot이며 2026-10-15 현재 운영 DB의 최신 상태라는 주장이 아니다.** 이후 R16I D8D 교정 SQL 존재만으로 운영 DB에 실제 적용된 것으로 간주하지 않는다. 실제 최신 Product/Offer 결속은 명시적으로 승인된 read-only 실행을 통해 새로 확인해야 한다.

## 4. 검증과 후속 액션

- `scripts/product-evidence/verify-d8k9-parent-offer-identity-binding-v1.mjs`: Product UUID·브랜드/이름/용량, 64/256 v2 계약, 중복 seller/listing/URL, 전역 collision probe 누락·교차 상품 혼입, 링크·재고, 쿠팡 selected item/vendor와 부모 page 구분, 재생/review 변조, R16I 과거 snapshot의 *두 독립 차단 이유*를 모두 검사.
- 기존 `verify-r16i-price-scope-review-v1.mjs` 테스트 체인에 추가. 전 단계 D8K-8 테스트와 병행해 GitHub CI 증거를 기록한다.
- 새 Feature Flag 없음. 공유 링크·추천 랭킹·현재 저장된 결과·브라우저 UI·Product DB·Offer DB·Auth/SQL/RLS/API 변경 없음.
- 실제 Product/Offer/전역 listing·URL collision 결과를 신뢰된 관리자 읽기로 수집하고 독립 리뷰 원본을 확인할 **보호 영역의 실제 서버 호출/확인**은 후속 승인 필요.
- R16I `size_ml=160` vs 단품 80ml 문제·D8D 교정 적용 상태, 새 seller listing 존재 여부가 확인되기 전까진 `source:shadow`를 `verified`로 바꾸거나 무료/프리미엄 가격 비교를 켜지 않는다.
- 공급망 보안 이슈 #1208가 열려 있는 동안 병합·배포는 HOLD.

**완료 범위:** 유효한 상품/리스팅 ID를 조용히 추측하거나 잘못된 판매 페이지를 연결하지 않는 *오프라인 진단 경계*. **미완료:** 실제 판매처 원본의 진정성, 현재 DB live read, 사용자 권한, Product Fact 승인, 서버 저장/조회, 가격/구매 CTA 공개.
