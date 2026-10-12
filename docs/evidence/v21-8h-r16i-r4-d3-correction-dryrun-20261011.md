# R16I-R4-D3 — Product/Offer 구분 정정 시뮬레이션 (2026-10-11)

## 판정

**`REVIEW_REQUIRED` / 실제 운영 쓰기 0건**. 구조적 A안은 `SCHEMA_FITS_READ_ONLY_NOT_WRITE_READY`이며 **실제 정정 완료가 아니다**.

## 확인된 신규 자료

- 2026-10-11 **06:04:51.876455 KST** Production 읽기 전용 `SELECT`: 제품 ID `b639c8b4-6a61-440e-b4db-fac7381593ff`, 160ml, 29,900원, 10ml당 1,868.75원, 화해 구매 링크 #45194, 리뷰 41,475건, 연결 Offer 0 / Subject 0 / 해당 상품 또는 listing #45194 충돌 Offer 0 / Binding 1. 기존 제품 수정시각 2026-09-10 09:32:38.713599 KST. **읽기 관측이지 쓰기 락이 아님**.
- [에스네이처 공식 모바일몰 #151](https://m.snature.kr/product/detail.html?cate_no=0&display_group=0&product_no=151)의 검색 캐시는 **80ml 단품**, 표시가 35,000원 및 회원 특가 24,500원. 수집은 약 **3주 전**, 현재 선택 옵션·재고·주문 결제가 검증된 것 아님.
- [화해 #45194](https://www.hwahae.co.kr/goods/45194)의 2026-10-11 검색 색인: **80ml 크림 2개 + 세럼 10ml 세트**, 표시가 29,900원, 평점 4.58, **리뷰 43,612건**(검색 색인에서 '오늘 수집' 표시). 여러 판매옵션 존재. **43,612건은 실시간 리뷰 총계·크림 하나의 고유 리뷰 모집단으로 확정된 것이 아님**. 직접 페이지 요청은 JavaScript/봇 인증으로 원문 및 선택 옵션·결제가 확인되지 않음.
- Supabase `information_schema`, `pg_indexes`, `pg_constraint` SELECT로 기존 `public.product_offers`의 `product_id` FK, `(seller_key,listing_id)` 및 `(seller_key,listing_url)` 유일성, `price_amount NULL`, `availability_state=unknown`, `product_scope_state=product_subject_unresolved` 허용을 확인. **DB 테이블 추가가 필요하지 않음.** 다만 기존 테이블에 기획세트 구성 항목별 수량·SKU 컬럼은 없으므로, 추후 명확한 컴포넌트 지속 저장이 필요하면 해당 모델의 적합성을 별도로 검토해야 함.

## 3안 비교

| 옵션 | 시뮬레이션 결과 | 실행 가능 여부 |
|---|---|---|
| **A — 기존 Product ID 유지 + Offer 별도 표현** | 기존 Product 행의 id·용량·가격·리뷰·링크를 **시뮬레이션에서 그대로 둠**. 브랜드 단품 80ml와 판매처 크림 80ml×2+세럼 10ml는 독립된 presentation으로만 표시. **Offer 테이블 컬럼에 맞춘 후보 형태**는 생성하되 가격 `null`, 재고 `unknown`, formulation 범위 `product_subject_unresolved`. 승인·Offer ID·실제 등록은 없음. | **추천하는 구조**, 그러나 Product 행에 남는 세트 용량/가격의 의미 문제는 여전히 미해결. 운영 승인 전 사용 불가. |
| **B — 기존 Product 용량 160→80 직접 교정** | 29,900원을 그대로 옮기면 **10ml당 3,737.5원**이라는 잘못된 단품 가격이 됨. 올바른 80ml 단품의 현재가·연결 출처·리뷰 귀속이 없어 허용하지 않음. | 차단 |
| **C — 기존 Product가 기획세트 전체를 의미하도록 유지** | Product(고정 제품 엔터티)와 Offer(판매 단위) 정체성이 섞임. 독립 단품·제품 사실 Subject를 정확히 연결할 근거가 없음. | 보류 |

**중요:** A안의 현재 `products.size_ml=160`, `price_min=29900`, `buy_link=화해`가 아직 실제로 정정되지 않은 상태에서 완료된 것으로 간주해서는 안 됨. 시뮬레이션의 `product_after_preview=product_before`는 기존 추천 운영을 손상시키지 않는 관찰 전용 모형이며 최종 제품 데이터가 아님.

## 구현 및 검증

- `lib/product-offer-r16i-r4-d3-correction-dryrun.mjs`: 기존 R4-A~D2 `REVIEW_REQUIRED`를 전제로 schema/정확 source identity/DB revision을 검사한 뒤 **메모리상의 A/B/C 비교만 작성**.
- `scripts/product-evidence/verify-barrier-support-p1-r16i-r4-d3-correction-dryrun-v1.mjs`: 검증되지 않은 source의 승인 승격, 가격 80ml 단순 이전, 가짜 결제가, 예상치 못한 Offer 충돌, DB revision drift, 리뷰수 오염 등의 negative 테스트.
- 근거 `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r4-d3-dryrun-input-20261011.json`.
- 기존 `scripts/verify-data-ai3-5-ci-consolidation.mjs`에 **한 번만** 추가. 새 GitHub Actions workflow/DB migration/API/SQL 코드 없음.
- 실제 `product_offers` insert, `products` update, subject 발급, source binding 승격, 리뷰수·랭킹 추천 반영 **모두 0건**.
- 출시 준비 `false`, 운영 승인 `null`, 실행 SQL/롤백 SQL/락 `null`.

## 다음 단계: R4-D 운영 결정 및 E 사전 조건

1. 브랜드/화해의 선택한 실제 옵션, 결제 직전 가격·재고, 세럼 정식 SKU, 원문·타임스탬프·해시를 확보 (장바구니/결제 화면 접근이 필요한 경우 운영자 캡처 필요).
2. **기존 Product ID의 제품 자체 용량·가격·구매링크를 어떻게 취급할지** 개별 필드 before→after, 가격 표시 정책 및 리뷰 데이터 귀속을 운영 책임자가 승인.
3. 실제 기존 `product_offers` 스키마에 세트 구성의 정식 귀속 모델이 충분한지 검토 (필요 시 별도 설계; 추측으로 테이블 추가 금지).
4. 기존 `product_source_bindings`의 `product_subject_unresolved`를 무근거로 `product`으로 승격하지 않음. 공식 제품 전성분/처방이 확인되기 전 Subject 생성 금지.
5. 실제 수정 전 fresh SELECT + 동시성·충돌·트랜잭션·롤백·멱등성, 추천 **164×12** 결과 및 구매 링크 회귀를 별도 입증.
6. 공급망 보안 이슈 [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208)은 별도 해결. 기존 FAIL 상태를 통과로 전환하지 않음.

관련: [R16I 운영 정정 #1204](https://github.com/gycha0109-beep/K_beauty/issues/1204).

**실제 종료 상태:** `R16I_R4_D3_SEPARATION_SIMULATED_NOT_AUTHORIZED`

Watchtower-Track: taxonomy-ai
