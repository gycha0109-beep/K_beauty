# R16I-R4-D4 — 운영자 실데이터 정정 검토 (2026-10-11)

## 구현 범위

- 관리자 `GET /api/admin/products/r16i-correction-review`: **정확한 R16I Product 한 건 전용**, `admin.products.review` 권한 검증 후 서버 Supabase SELECT만 8번 호출. 타 상품 식별자는 입력받지 않음. 응답은 private/no-store, 실행·승인·DB 변경 API 없음.
- `lib/product-offer-r16i-r4-d4-db-reader.mjs`: Product, 해당 Product의 Binding, 같은 출처 ID에 연결된 *다른 Product*의 Binding 충돌, Product Offer, 동일 판매처 listing ID/URL Offer 충돌, Product Fact Subject, Intake의 선택된 컬럼을 조회.
- `lib/product-offer-r16i-r4-d4-live-review.mjs`: 2026-09-10 기준 Product/Binding/Intake 리비전과 가격·용량·시장 신호를 재검사. 소스 정체성, 수정시각, 판매 Offer 충돌, 제품 사실 Subject가 조금이라도 바뀌면 `BLOCKED` 및 빈 검토 행 반환.
- 예상대로 유지되면 `REVIEW_REQUIRED` 및 **20개 필드별 검토 행** 반환. `before`는 *현재* SELECT 값이며, `after=null`, `field_approved=false`, `write_set=null`과 추천·Offer·Subject/Production 쓰기 모두 false. 실제 선택 가능한 수정 완료값은 아직 없음.
- 운영 검토 우선 구조: **기존 Product ID 유지 + 단품 80ml, 화해 크림 80ml×2 + 별도 세럼10ml 구분**. Offer 후보 가격 null, 재고 unknown, Product Fact 범위 unresolved. 이를 실제 생성하거나 Product를 160→80으로 바꾸지는 않음.
- 신규 CI 워크플로/DDL/RPC/권한/DB 테이블 없음. 기존 통합 CI 내 1회 검증.

## 읽기 전용 근거

2026-10-11 09:45:42 KST Production SELECT:

- Product `b639c8b4-6a61-440e-b4db-fac7381593ff`: 160ml, price_min/max 29,900원, 10ml당 1,868.75원, 리뷰 41,475건, 화해 구매링크 #45194.
- 연결 Offer 0건, Subject 0건, 바인딩 1건, Intake 1건. Product 수정 시각 2026-09-10 09:32:38 KST 그대로.
- [화해 #45194](https://www.hwahae.co.kr/goods/45194) 검색 색인은 세트와 옵션 목록/표시가 29,900원을 보여 주지만 실결제 시점 선택옵션과 금액 증명은 아님. 리뷰 색인의 시점 차도 해소되지 않음.
- 공식 80ml 단품 정보 역시 현재 회원할인·재고·옵션 결제를 직접 검증한 것이 아님.

## 실제 정정 전에 반드시 확인

1. 운영자가 화해/공식몰에서 **선택한 정확한 옵션 + 결제 직전 금액·재고·구성 SKU**와 캡처 시각/원본 출처를 확보.
2. Product의 `size_ml,price_min,price_max,unit_price_per_10ml,buy_link,source/external identity,market_signals` 등 필드마다 **변경 전후 값 및 가격 표시 정책**을 결정하고 서명 가능한 승인 기록에 연결.
3. Source Binding `product_subject_unresolved`와 Intake `REVIEW_REQUIRED`은 공식 처방/성분 근거 없이는 유지. 43,000대 검색 색인 리뷰를 41,475 리뷰/제품 사실 Subject에 덮어쓰지 않음.
4. 필드 승인 **이후** 최신 Production 재조회, 동시성·충돌·트랜잭션·롤백·멱등성, 추천 164×12 불변성과 실제 링크 검증을 수행.
5. 공급망 보안 [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208)은 독립적으로 해소.

**종료 상태:** `R16I_R4_D4_LIVE_FIELD_REVIEW_AVAILABLE_NOT_APPROVED`. 운영자 읽기 전용 도구 구현까지, Product/Offer/Subject Production 쓰기 0건.

Watchtower-Track: taxonomy-ai
