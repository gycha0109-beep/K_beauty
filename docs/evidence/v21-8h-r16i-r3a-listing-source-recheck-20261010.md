# R16I-R3A — 에스네이처 판매 단위 재검증 (2026-10-10)

상태: REVIEW_REQUIRED / 연구·읽기 전용 / Production 변경 승인 아님

## 기준
- main HEAD: `8755bb6e5faa010c9e9e4dae8775da61628fca20`; #1207 병합 확인.
- 제품 ID: `b639c8b4-6a61-440e-b4db-fac7381593ff`
- 브랜드 단품: https://www.snature.kr/product/detail.html?product_no=151
- 유통 기획세트: https://www.hwahae.co.kr/goods/45194
- 근거 상태: 검색 엔진이 보유한 판매 페이지 색인/상품 썸네일과 Production SELECT. 화해 페이지 직접 열람은 자바스크립트/봇 확인으로 차단됐고 브랜드 공식몰 직접 본문 가져오기도 실패했다. 원본 HTML 파일·결제 영수증·실물 바코드·상품 이미지를 로컬 아카이브한 것으로 주장하지 않는다. 따라서 해당 원본의 파일 해시도 없음.

## 확인된 상품 범위
| 출처 | 관측 | 확정 가능한 범위 |
|---|---|---|
| 에스네이처 공식몰 #151 검색 색인 | 아쿠아 스쿠알란 수분크림 80ml, 일반 판매가 35,000원, 회원 특가 24,500원 | 브랜드의 80ml **단품 판매 표현**, 현행 결제 최종 가격 아님 |
| 화해 상품 #45194 검색 색인 | [only화해] 아쿠아 스쿠알란 수분크림 80ml 더블+세럼 10ml 세트, 29,900원, 정가 160ml / 75,000원, 판매 중 표시 | **판매처 상품 제목과 색인의 판매가**, 결제·옵션 실시간 상태 아님 |
| 화해 #45194 판매 썸네일 | 크림 튜브 2개와 소형 드로퍼 용기 1개가 이미지에 나타남 | 마케팅 상품 이미지 수준이며 실제 배송 구성/바코드 검수 아님 |
| 화해 #45194 후기 색인 | 후기 약 43,000건대(색인 시점 따라 변동), 평점 4.58 | 해당 페이지의 노출값. 리뷰별 단품/기획세트 구매 경로 및 처방 신원 미확정 |
| GitHub Advisory GHSA-vfj7-8cjw-p6xm | 영향 <= braces 3.0.3, 게시된 patched version 없음(확인 시점) | 보안 이슈 #1208 잔존; 단순 임시 허용 연장 불가 |

상품 이미지 URL(원본 아카이브 아님):
https://img.hwahae.co.kr/commerce/goods/20251223_094901_thumb_%EC%95%84%EC%BF%A0%EC%95%84%20%EC%8A%A4%EC%BF%A0%EC%95%8C%EB%9E%80%20%EC%88%98%EB%B6%84%ED%81%AC%EB%A6%BC%2080ml%20%EB%8D%94%EB%B8%94%2B%EC%84%B8%EB%9F%BC%2010ml%20%EC%84%B8%ED%8A%B8.png

## 2026-10-10 Production SELECT readback
- 제품: name=아쿠아 스쿠알란 수분크림, size_ml=160, price_min=price_max=29900, unit_price_per_10ml=1868.75, buy_link/source_url/hwahae_url=https://www.hwahae.co.kr/goods/45194.
- `products.updated_at=2026-09-10T09:32:38.713599+09:00` (확인 행의 수정 시각).
- `market_signals`은 화해 표기 4.58/41,475건, 내장 갱신 날짜 2026-05-26. 현재 검색 색인 리뷰 건수와의 차이는 관측 시점/집계 범위 차이일 수 있고, 리뷰 귀속은 별도 검증 필요.
- 연결 Offer 0건, Product Fact Subject 0건, 동일 normalized brand/name의 Product 행 1건. 전체 Offer 73건.
- Trust Intake: id=ee3b675d-1b92-4144-88e0-2a984b3d7cec, identity_state=SUBJECT_CREATION_REQUIRED, trust_state=REVIEW_REQUIRED, subject_id=null.
- 2026-10-10 이전 #1204에서 출처 바인딩 1건 `resolved / product_subject_unresolved` 확인. 이 재검증 단계에서 바인딩을 독립 재조회하지 않았으므로 R4 실행 직전 다시 SELECT 필요.

## 해석과 금지 사항
1. 80ml×2=크림 160ml. 세럼 10ml는 별도 제품이고 크림 분모에 합치지 않는다.
2. 기존 29,900원/160ml=1,868.75원/10ml는 **레거시 카탈로그의 산식**으로만 확인. 공식몰 80ml 단품 35,000원(회원가 24,500원)과 비교하거나 서로 덮어쓰지 않는다.
3. 최근 화해 검색 색인에도 세트 가격 29,900원이 표시됐으나 결제 옵션과 현재 판매가의 신뢰 가능한 원본 영수증이 없으므로 Product/Offer runtime price authority를 부여하지 않는다.
4. 세럼 10ml의 공식 상품명/SKU, 바코드, 옵션별 배송 수량, 리뷰가 단품에 공유되는 범위, 최근 기획 구성 변경 여부는 UNKNOWN.
5. 유통사 제목·이미지는 제조사 처방/Subject 판단 근거가 아니다.
6. 제품/Offer/Subject/Source Binding/Intake/시장 신호/랭킹/추천/링크/가격 Production 쓰기 0건.
7. R16H는 별도 젤크림으로 분리하며 R16B/ZEROID HOLD 유지.

## R16I-R4 승인 준비
- **기본 검토 방향 A**: 기존 Product ID를 제품계열 anchor로 유지하고 80ml 단품 presentation 및 80ml×2+세럼10ml Retail Offer를 분리. B(카탈로그 단품 정정), C(기존 특정 Offer 의미 유지)도 승인 전에 영향 비교.
- **승인 전 신규 readback**: products 행 전체/updated_at, product_source_bindings 및 출처 scope, product_offers 상품/판매자/ID 중복, product_fact_subjects/Current/Intake, review/market signals, 현재 추천 결과 및 가격/구매 링크.
- **사전 차단**: Product/Offer/Subject 권한 중첩·중복이 없고 판매 옵션별 가격·수량/리뷰 scope가 독립 검증될 것. 정정안별 diff, 낙관적 잠금, 멱등성, 롤백안 및 변경 후 정확 readback 준비.
- **쓰기 게이트**: 운영자의 명시적인 단위/소스/필드별 승인 전에는 어떤 Production 행도 수정하지 않는다.
- **런타임 게이트**: 화해는 현재 trusted Offer 링크 정책에 없고 priceAuthority=false. 신규 링크/가격 투영 및 추천·랭킹 변경 없음.
- **보안**: #1208 공급망 실패는 taxonomy-ai의 도메인 검증 성공으로 상쇄하지 않음.

종료 상태: R16I_R3A_SOURCE_RECHECK_REVIEW_REQUIRED; 실제 웹 페이지 원본/결제/바코드/리뷰 귀속은 계속 HOLD.
