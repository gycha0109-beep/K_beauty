# R16I-R3 — 세트 구성 읽기 전용 검증 구현

**상태: 구현·오프라인 검증만 / Production 쓰기 금지**

기존 `product_offers` 스키마나 추천 엔진을 변경하지 않고, `lib/product-offer-composition-shadow.js`에서 검토 중인 판매세트의 수량과 용량을 검사한다.

## 입력 근거

- `product_id=b639c8b4-6a61-440e-b4db-fac7381593ff`: 에스네이처 아쿠아 스쿠알란 수분크림
- 브랜드 #151: **80ml 단품**
- 화해 #45194: **80ml 더블 + 세럼 10ml 세트** (제목 근거)
- 현재 DB 레거시: `size_ml=160`, `price_min=price_max=29900`, `unit_price_per_10ml=1868.75`
- 화해 기획세트 실물 사진/세럼 바코드/현행 결제가 재검증되지 않았으므로 **REVIEW_REQUIRED**, **현재가 미확인**

## 판단 범위

| 검증 | 결과 |
|---|---|
| 기본 수분크림 80ml × 2 | 총 크림 **160ml** |
| 세럼 사은품 10ml × 1 | 별도 10ml, **크림 용량에 미합산** |
| 29,900원 ÷ 크림 160ml × 10 | **1,868.75원/10ml** — 과거 가격 산식 검산 전용 |
| 29,900원 ÷ 단품 80ml × 10 | **3,737.5원/10ml** — 잘못된 단품 가격 전이 |
| 검증된 현행 판매가 | **없음**, 사용자 표시/가격 투영 `null` |
| 카탈로그 권위 있는 단품 크기 갱신 | **금지 (`null`)** |
| Offer 등록, Product Fact Subject 발급 | **모두 금지** |

`lib/product-offer-composition-shadow.js`는 외부 네트워크, 데이터베이스, 서버 권한을 사용하지 않는다. 검토용 `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r3-offer-composition-shadow-fixture-v1.json`만 입력으로 사용한다. 판매처/목적지 호스트/상품번호/문자열/구성 수량/용량/가격·등록 승인 상태가 틀리면 **BLOCKED**.

`scripts/product-evidence/verify-barrier-support-p1-r16i-r3-offer-composition-shadow-v1.mjs`에서 정상 시나리오와 부정 시나리오를 검증하고, 기존 `scripts/verify-data-ai3-5-ci-consolidation.mjs`에 테스트를 추가했다. **새 CI나 별도 워크플로 없음.**

## 후속 작업

1. 실제 화해 판매페이지 원본에서 80ml×2, 세럼 10ml, 판매가·상품번호·바코드 등 구성 출처 확보
2. 최신 판매가 및 프로모션 상태 확인: 본 문서의 29,900원은 과거 DB 기록
3. 운영 소유자가 상품은 단품 anchor/판매세트는 Offer로 나누는 방식을 승인할 때까지 런타임 활성화 금지
4. 이후 별도 승인으로 **Production 사전상태 → 검토 → 쓰기 → readback**을 진행; 권한 없이 값 수정 금지

**남은 제약:** 보안 CI는 별도 GHSA-vfj7-8cjw-p6xm 임시 예외 만료로 차단되며, 일자를 연장해 해소해서는 안 된다. 별도 [이슈 #1208](https://github.com/gycha0109-beep/K_beauty/issues/1208)의 보안 소유자가 취약점 해소 방안을 검토해야 한다. 이 설계 자체는 단독으로 Production 등록을 승인하지 않는다.

**종료 판정:** `R16I_R3_OFFLINE_BUNDLE_SHADOW_IMPLEMENTED_REVIEW_REQUIRED`. R16B/R16H/ZEROID HOLD, 비수치 PDA 164×12=1968 불변. 카탈로그/Offer/Subject/추천/랭킹 **쓰기는 0**.
