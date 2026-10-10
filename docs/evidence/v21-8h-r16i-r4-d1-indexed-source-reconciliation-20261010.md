# R16I-R4-D1 — 브랜드 단품과 화해 기획세트의 검색 색인 비교

**판정:** `R16I_R4_D1_INDEXED_SOURCE_RECONCILIATION_REVIEW_REQUIRED`. 2026-10-10 자료조사. 본 문서는 판매처 실시간 API 응답, 원본 HTML 아카이브, 실결제 옵션 확인, 추천 운영 승인, 또는 제품의 실제 포뮬러 증거가 **아닙니다**.

## 1. 독립 출처별 상품 단위

| 출처 | 자료 성격 | 판매 단위 | 색인에 표시된 가격 | 주의 |
|---|---|---|---|---|
| [에스네이처 공식몰 상품 #151](https://www.snature.kr/product/detail.html?product_no=151) | 브랜드 상품 페이지의 검색 색인, 조회 시 약 **3주 전 수집** 표기 | 수분크림 **80ml 단품** | 판매가 **₩35,000**, 회원 특가 **₩24,500** | 회원 자격·배송·쿠폰·옵션 선택·최종 결제가 미확인 |
| [화해 상품 #45194](https://www.hwahae.co.kr/goods/45194?af_siteid=940056100) | 화해 상품 페이지의 검색 색인, 조회 시 약 **1주 전 수집** 표기 | 수분크림 **80ml × 2 = 160ml**, 별도 세럼 **10ml** | 화해쇼핑 표시가 **₩29,900** | 색인은 다른 판매 옵션도 있다고 표시, 옵션별 실판매가·사은품 실물/SKU·최종 결제 미확인 |

화해 다른 URL/기간의 색인에서도 리뷰 수 **43,219건, 43,269건, 43,482건** 등 차이가 있다. 이 수치는 개별 색인의 캡처 시점·캐시 차이를 반영할 수 있으며, **43,482건을 최신 확정값이라 주장할 수 없다**. 브랜드 단품의 상품 가격과 화해 기획세트 가격은 서로 대체하거나 평균낼 수 없다.

실제 브랜드 사이트 기본 URL 직접 HTTP 수집은 실패했으며, 화해 원래 URL은 JS/봇 확인 페이지를 반환했다. **원본 HTML SHA-256이나 실제 거래가격의 검증 증거는 없으므로** `raw_html_captured=false`, `actual_checkout_verified=false`로 기록한다.

## 2. Production 기존 상태와 색인 결과의 차이

Product: `b639c8b4-6a61-440e-b4db-fac7381593ff`, 2026-10-10 21:25 KST SELECT 스냅샷 참조 (`barrier-support-p1-r16i-r4-readonly-prestate-20261010.json`).

| 항목 | 기존 Production 값 | 검색 색인에서 관찰된 값 | 결과 |
|---|---:|---:|---|
| 카탈로그 `size_ml` | 160ml | 브랜드 공식 **80ml 단품**, 화해 **80ml×2 기획세트** | 단위 혼합 가능성 유지. 160→80 단독 수정 차단 |
| `price_min / price_max` | 29,900원 | 브랜드 표시가 35,000원, 회원 특가 24,500원; 화해 표시가 29,900원 | 같아 보이는 29,900원은 **기획세트 표시값**으로만 비교 |
| `unit_price_per_10ml` | 1,868.75원 | 표시 기준 브랜드 정가/80ml **4,375원**; 회원 표시가/80ml **3,062.5원**; 화해 29,900원/크림 160ml **1,868.75원** | 참고 산술만 허용. 실결제가 또는 Production/추천 단가로 승격 금지 |
| `market_signals.review_count` | 41,475건 (DB 메타 자체 기록 날짜 2026-05-26) | 화해 단일 색인 결과 43,482건 | 수치 차이 **+2,007건**, 그러나 색인 수집 시점과 포뮬러/구매 단위 귀속 미검증. 자동 대입 금지 |
| `market_signals.rating` | 4.58 | 해당 색인 표시 4.58 | 표면적 일치만, 상품 계열·리뷰모집단 확정 아님 |

**중요:** 검색 색인의 리뷰 증가를 확정하지 않는다. 여러 인덱스 표현의 수치 변동이 있으므로 오직 `INDEXED_LEGACY_DELTA_REVIEW_REQUIRED` 상태의 **검토 신호**다.

## 3. 구현과 실패 차단

- 증거: `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r4-d1-indexed-sources-20261010.json`. 조회일 `2026-10-10`; **정확한 조회 시각은 만들어 넣지 않음**. 검색 색인 URL·상대 수집 시차·상품 단위·표시가격·리뷰 수·확인 불가 항목을 구분한다.
- 모듈: `lib/product-offer-r16i-r4-indexed-source-reconciliation.mjs`, `evaluateR16IR4IndexedSourceReconciliation(snapshot, composition, indexedFixture)`.
- R4-A~C preflight 및 R3 shadow가 `REVIEW_REQUIRED`가 아니면 즉시 `BLOCKED`.
- 공식몰 80ml 단품/화해 80ml×2 세트를 바꾸거나 섞은 입력, 검색색인 내용을 실결제·원본·리뷰 귀속으로 위장한 입력, 불일치하는 상품번호/출처/증거 URL 및 증거 누락을 **BLOCKED**.
- `REVIEW_REQUIRED`인 경우에도 가격/리뷰 델타는 **표시·참고값**일 뿐 `checkout_price_krw=null`, `approved_catalog_price_krw=null`, `review_signal_projection=null`, `production_writes_authorized=false`.
- 검증: `scripts/product-evidence/verify-barrier-support-p1-r16i-r4-indexed-source-reconciliation-v1.mjs`. 기존 `scripts/verify-data-ai3-5-ci-consolidation.mjs`에만 통합. 별도 GitHub workflow·DB 스키마·마이그레이션 없음.

## 4. 다음 실제 차단 요인

1. 상품 원문·옵션·실제 브랜드/판매처 결제가·제품 바코드/세럼 SKU 확보. **현재 상태에서는 임의 승인할 수 없음**.
2. 사용자/운영자가 Product ID 유지/기획세트 분리 방안(A)을 공식 선택하고 각 수정 필드의 신뢰 근거·쓰기 범위를 별도로 승인.
3. 실제 정정 직전 Production 재조회 및 트랜잭션·멱등성·동시성/롤백/정확 readback.
4. 공급망 보안 #1208 해결(브레이스/노드포지 취약점) 및 관련 PR exact-head CI 검증.
5. 기존 비수치 Product Decision Axis 164×12=1,968 회귀·R16B/R16H/ZEROID HOLD 보존.

**최종 범위:** R16I-R4-D1 검색 색인 비교 및 실패 차단 오프라인 구현. 승인/병합/실제 Production 쓰기 없음.

Watchtower-Track: taxonomy-ai
