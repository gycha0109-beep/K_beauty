# R16I-R4-D2 — 판매 근거 출처/신선도 검증 (2026-10-11)

**결과:** `REVIEW_REQUIRED`. 제품 정정·가격 갱신·리뷰수 대입·Subject/Offer 발급 및 실제 운영 승인 **없음**.

## 확인된 사실과 한계

- [공식 에스네이처 상품 #151](https://snature.kr/product/detail.html?cate_no=1&display_group=3&product_no=151): 에스네이처 *자사몰 도메인*의 수집된 페이지 텍스트에서 **80ml 단품**, 표시가 **35,000원**, 회원 특가 표시 **24,500원**을 확인. 검색 수집 메타는 약 **9개월 전**의 사본. 해당 페이지 자체에서 최종 할인·결제예정금액은 주문 시 확인하라고 명시하므로 현재 결제가·재고·SKU를 확정할 수 없음. 이 도구에서 **원본 HTML 바이트 저장이나 SHA-256은 수행하지 않았음**.
- [화해 판매 #45194](https://www.hwahae.co.kr/goods/45194): 상품 제목의 **크림 80ml×2(크림 총 160ml)+세럼10ml 별도**, 색인 표시 판매가 **29,900원**. URL 직접 조회 시 JavaScript/봇 검증만 노출되어 실판매 옵션/결제가 확인 실패. 제목의 10ml 세럼과 색인마다 달라지는 프로모션 사은품(추가 마스크 등)은 서로 다른 정보다.
- 리뷰수는 **동일 상품번호의 서로 다른 검색 색인**에서 43,222/43,257/43,269/43,482건으로 관측됨. 차이 **260건**은 색인 간 편차이며, 최고 수치를 '현재 최신 리뷰'로 확정하지 않는다. DB 값 41,475건과의 차이는 각각 +1,747 ~ +2,007건이지만 Product Fact Subject 귀속 및 리뷰 수집 시점이 불확실하다.
- 2026-10-11 **00:44:59.236503 KST** Production `SELECT` 재조회: 대상 Product `b639c8b4-6a61-440e-b4db-fac7381593ff` 160ml, price_min/price_max 29,900원, 10ml당 1,868.75원, 리뷰 41,475건, linked Offer 0, Subject 0, Binding 1, Intake 1; 제품 updated_at은 2026-09-10 09:32:38.713599 KST로 동일. 이 SELECT는 **거래용 락/미래 쓰기 승인 아님**.

## 구현

- 근거 파일: `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r4-d2-source-readiness-20261011.json`
- 오프라인 판정기: `lib/product-offer-r16i-r4-d2-source-readiness.mjs` — R4-D1(색인 비교)→R4-A~C(과거 사전상태)의 기존 `REVIEW_REQUIRED` 계약이 선행조건. 자사몰의 낡은 캐시와 화해 검색 색인을 **서로 다른 신뢰 수준**으로 분류하며, '페이지 원본 확보', '현재 판매가 확인', '리뷰 귀속'의 허위 승격을 `BLOCKED`로 거부.
- 부정검증: `scripts/product-evidence/verify-barrier-support-p1-r16i-r4-d2-source-readiness-v1.mjs` — Product/가격/리뷰 count/프로모션/선택옵션/출처·시점 변조, 가짜 원본/최신값/운영승인 등의 실패 차단.
- 기존 `scripts/verify-data-ai3-5-ci-consolidation.mjs`에 한 번만 등록, 신규 CI 워크플로·DB 마이그레이션·런타임 코드·권한 허용 없음.

## 다음 실제 운영 게이트

1. 자사몰/화해의 **현재 시점 선택 옵션 + 결제 직전 가격 + 원문/원본 시점·해시**를 실제 검증.
2. 화해 **80ml×2 + 세럼10ml** 구성의 정확한 화장품 SKU와 성분/전성분(Subject 범위)을 검증. 리뷰가 어느 제품/기획세트 모집단에 귀속되는지 확인.
3. 운영 책임자가 기존 Product ID 유지 A안, Product/Offer/Subject 경계를 필드별로 승인.
4. *그때만* 새로운 Production readback 및 동시성·롤백·멱등성/추천 164×12 회귀를 거쳐 R4-E 검토.
5. 공급망 보안 #1208은 독립적으로 해결 (현재 기존 CI 보안 FAIL을 성공으로 재분류하지 않음).

**운영 판정:** `R16I_R4_D2_EVIDENCE_GAPS_LOCATED_NOT_RESOLVED`, Production 쓰기 0, 프로그램에서 자동 가격·리뷰 투영 0.

Watchtower-Track: taxonomy-ai
