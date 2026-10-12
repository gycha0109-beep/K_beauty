# R16I-R4-D5 — 관리자 화면에서 실제 원본 수집·검토 (2026-10-12)

## 목적

R4-D4의 `GET /api/admin/products/r16i-correction-review`가 존재해도 실제 운영자는 API 주소를 열어 JSON을 읽어야 했습니다. D5는 **동일한 권한 경계와 검증된 D4 Production SELECT** 결과를 관리자 UI에 표시하는 작업입니다. 대량의 검증기나 신규 테이블을 추가하지 않습니다.

## 구현

- 관리자 화면: `/admin/products/r16i-correction-review`
- SSR에서 `admin.products.review` capability 확인 후 정확 R16I Product에 한정해 `readR16IR4D4Review` 호출. 권한 실패는 redirect/notFound, DB 장애 시 데이터 은닉된 오류 화면. `force-dynamic`, `revalidate=0`.
- D4 결과 `REVIEW_REQUIRED`이면 **기존 DB 값 20개**와 수정후 `미확정` 및 보류 사유를 표로 표시. Product 변경·충돌을 탐지한 `BLOCKED`이면 값 제공 대신 차단 사유만 표시.
- 화해 [#45194](https://www.hwahae.co.kr/goods/45194)와 [공식몰 #151](https://www.snature.kr/product/detail.html?product_no=151)로 이동해 실제 옵션, 가격, 증정 세럼 SKU, 리뷰 귀속을 대조.
- *7개 원본 수집 필드*를 가진 **로컬 메모**를 작성하여 클립보드로 JSON 복사 → [R16I 정정 이슈 #1204](https://github.com/gycha0109-beep/K_beauty/issues/1204)에 운영자가 별도로 근거 파일·원본 URL·시각과 함께 붙여넣을 수 있음. **메모는 서버·DB에 저장되지 않고 검증/승인으로 간주되지 않음**. 복사 JSON에는 `UNVERIFIED_NOT_APPROVED`, `operator_approval:false`, `production_write_authorized:false`.
- 관리자 API 권한·GET 전용·D4 모델 및 실제 추천은 **변경하지 않음**. 새 DB 테이블·RPC·승인 기능·권한·마이그레이션·CI workflow 0건.

## 현재 근거의 한계

- 기존 Production SELECT 기준: 160ml, 29,900원, 리뷰 41,475건, 연결 Offer 0건, Product Fact Subject 0건.
- 화해 페이지는 검색 색인상 80ml×2 + 세럼 10ml의 기획세트와 표시가 29,900원을 보여 줌. 직접 원본 요청은 봇 확인(JavaScript 필요)으로 실패하고 실제 결제 전 최종 선택 옵션/가격을 검증할 수 없음.
- 공식몰 검색 캐시의 80ml 단품 현재 옵션/재고/결제가는 확인되지 않음.
- 후기 수의 증감 또는 가격 색인값을 `Product Fact Subject`, 실제 선택옵션 및 상품 단품 가격으로 자동 연결하지 않음.

## 작업 후 검증할 사항

1. 기존 통합 CI + 실제 Next production build에서 새 UI/접근 경계 PASS.
2. 관리자 권한 없는 사용자에게 리포트/기존 Product row 노출 금지.
3. `BLOCKED` 시 페이지의 변화 전후 필드 표가 제거되는지 확인.
4. 브라우저 저장소/네트워크 POST/서버 영속화 없음. 메모는 운영 확인 이전 초안.
5. 별도 보안 이슈 #1208 해결과 운영자가 제출할 실제 가격/옵션/원본은 미완료.

**완료 조건:** 관리자 UI를 운영자가 열어 현재 DB/보류 이유를 확인할 수 있고, 실제 판매증거 수집을 완료하는 데 필요한 수집 항목을 전달한다. **실제 운영 데이터 정정은 여전히 미실행**.

Watchtower-Track: taxonomy-ai
