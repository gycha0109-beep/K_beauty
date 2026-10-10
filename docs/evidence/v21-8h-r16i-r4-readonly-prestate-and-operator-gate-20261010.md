# R16I-R4-A~C — Production 사전상태 고정 및 수정 승인 전 차단 (2026-10-10)

**판정:** `R16I_R4_PRESTATE_RECORDED_PREFLIGHT_REVIEW_REQUIRED_NO_WRITE`

**변경 범위:** 오프라인 판정기 + 기존 통합 CI 테스트 + 선택된 Production 읽기 전용 증거 JSON. 신규 테이블·DDL/RPC·Production 쓰기·실제 단품/Offer 등록·Product Fact Subject 발급·추천/가격/링크 반영 모두 **없음**.

## 1. 근거와 적용 범위

- 대상 Product ID: `b639c8b4-6a61-440e-b4db-fac7381593ff` — 에스네이처 아쿠아 스쿠알란 수분크림.
- 브랜드 공식 단품 표현: https://www.snature.kr/product/detail.html?product_no=151 (80ml).
- 화해 판매처 세트 표현: https://www.hwahae.co.kr/goods/45194 (80ml×2 + 세럼 10ml; 구성·현행 결제가·리뷰의 귀속은 독립 인증 전).
- 선행 #1207은 R16I-R2/R3 구성의 읽기 전용 설계·검증. #1211은 exact listing·구성 변조 차단 PR이며 작성 시 아직 main 미병합. 본 R4 검증기는 **main에 존재하는 R3 evaluator**의 반출값을 입력으로 받으며, #1211 병합 여부와 관계없이 실행 가능.
- Issue #1204 운영자 승인 게이트; Issue #1208 `braces@3.0.3` 관련 기존 공급망 보안 차단 별도 유지.
- 이번 검증은 **판매처 원본 검증이 아니며 판매 가격·세럼 SKU·바코드·실제 배송 구성에 관한 새로운 권위를 만들지 않는다.**

## 2. R4-A — 사전상태 스냅샷

2026-10-10 **21:25:21.686838 KST**, Supabase 프로젝트 `bygrczggxfuisupcevaz`에서 SELECT만 실행. 증거:
`evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r4-readonly-prestate-20261010.json`.

| 단위 | 당시 조회값 |
|---|---|
| Product | 160ml, 29,900원, 1,868.75원/10ml, `updated_at=2026-09-10T09:32:38.713599+09:00` |
| 바인딩 | 1건, 화해 #45194, `resolved/product_subject_unresolved`, `updated_at=2026-09-10T10:10:29.03509+09:00` |
| Offer | 대상 Product 또는 같은 화해 Seller/Listing 범위 0건 (전체 73건 참고) |
| Subject | 대상 0건 |
| Intake | 1건, `SUBJECT_CREATION_REQUIRED/REVIEW_REQUIRED`, `subject_id=null`, `updated_at=2026-09-21T00:53:57.499289+09:00` |
| 시장 신호 | 화해 기반 4.58점/41,475건, 스냅샷 내부 출처 날짜 2026-05-26 (최신 리뷰 현황 아님) |

해시 함수 `digestR16IR4Prestate`는 선택된 Product/Binding/Offer/Subject/Intake 데이터를 JSON 키 정렬 후 SHA-256으로 요약한다. **증거 무결성 비교용**이며 암호학적 서명, DB 락, Production 트랜잭션 ID, 외부 원본 파일 SHA-256 또는 사용자 승인 토큰이 아니다. 현재 코드에서 이 값으로 쓰기 잠금을 획득하지 않는다.

전체 테이블을 무단으로 덤프하지 않는다. Production 쓰기 전에는 운영자가 승인한 정확한 필드 범위의 별도 SELECT/readback을 새 트랜잭션 경계 내에서 다시 수행해야 한다. 이 문서의 과거 SELECT는 쓰기 직전 상태 증명이 아니다.

## 3. R4-B — 운영자 정정 대안

| 대안 | 판단 | 필드 의미·리스크 |
|---|---|---|
| A: 기존 Product anchor 보존 + 80ml 단품/화해 기획세트 Offer 분리 | **기본 검토 방향, 미승인** | Product ID·추천 기준 보존. 구성과 단품 판매가격이 독립 검증돼야 하고 가격/링크·리뷰 scope는 별도 승인 필요 |
| B: 기존 Product 상품행을 공식 단품 80ml 의미로 정정 | **HOLD** | `size_ml`만 80으로 변경 불가. 29,900원/160ml=1,868.75원/10ml → 29,900원/80ml=3,737.5원/10ml 왜곡. 가격/링크/표시/리뷰/추천을 원자적으로 재검증해야 함 |
| C: 기존 카탈로그 행을 기획세트 의미로 남김 | **HOLD** | Product/추천 ID가 제품 계열인지 판매 기획인지 혼재할 위험. 독립 단품 표시·처방 Subject 귀속·판매·리뷰 scope 재검토 필수 |

**A도 쓰기 계획이 아닙니다.** 각 대안은 `write_set=null`, 가격·용량·링크의 승인된 신규값 `null`을 명시한다. 세럼 10ml는 크림 160ml에 합산하거나 독립 Product Fact Subject로 추론하지 않는다.

## 4. R4-C — 차단 경계 및 테스트

`lib/product-offer-r16i-r4-readonly-preflight.mjs`:
- `evaluateR16IR4Preflight(snapshot, compositionDecision)`: 입력 계약, 쓰기/승인 FALSE, DB 관측 시각, Product 식별/가격/링크/리뷰/수정시각, Binding 1건/출처/상태/수정시각, Intake 1건/상태/수정시각, 대상 Offer/Subject 0건, 기존 구성 shadow의 REVIEW_REQUIRED/80ml×2+10ml 안전 출력을 점검.
- 드리프트 또는 권한 변조 발생 시 `decision=BLOCKED`. 역사적 SELECT 입력이 일치하더라도 `decision=REVIEW_REQUIRED`이고 `live_readback_verified=false`, `production_writes_authorized=false`.
- 테스트: `scripts/product-evidence/verify-barrier-support-p1-r16i-r4-readonly-preflight-v1.mjs`. 바인딩/Intake drift, 허위 승인, URL·가격·크기 왜곡, 대상 Offer/Subject 신규 생성을 모두 부정 검증.
- 기존 `scripts/verify-data-ai3-5-ci-consolidation.mjs` 목록에 **1회만** 추가. 새로운 GitHub Actions workflow 생성 금지.
- 이 판정기는 SQL Executor/DB 클라이언트가 아니며, 실제 수정 쿼리·롤백 SQL이나 승인 토큰을 발행하지 않는다.

**현재 별도 작업:** R16B, R16H, ZEROID HOLD와 비수치 PDA 164×12=1,968 회귀 범위 보존. R16I 변경은 추천 런타임에 연결하지 않음.

## 5. R4-D/E 및 R5 진행 게이트 (이번 범위 밖)

1. 원본 페이지·실제 옵션별 판매 구성/사은품/독립 SKU·가격·리뷰 귀속 검증.
2. 운영자 A/B/C 선택 및 Product/Offer/Binding/Intake/리뷰·시장 신호 등 **필드별 before→after 승인**. 권한 확인 및 승인 로그.
3. 승인된 변경에 한해, 새 Production SELECT의 스냅샷·행 버전·수정시각 비교와 낙관적 잠금, 멱등 키, 트랜잭션 범위, 조건부 실패 시 rollback, 정확 readback 설계. 동시성 충돌이면 즉시 재검토.
4. 공식몰 단품 80ml 가격과 화해 기획세트 가격은 독립 판매단위이며, 단품 원/10ml을 세트 가격에서 재계산해서는 안 됨.
5. 공급망 보안 #1208 해결 및 exact-head CI 정상화, 별도 추천/랭킹 1,968케이스 회귀와 오퍼 read-path 신뢰 출처 검토.
6. 별도 운영자 명시 승인이 없으면 실제 Production INSERT/UPDATE/DELETE/UPSERT/RPC·배포/가격/추천 반영 **금지**.

**종료 의미:** R4-A~C의 *오프라인·무쓰기 사전검증 구현*. 실제 R4 운영 정정 승인 또는 R4-E 실행 완료를 의미하지 않는다.

Watchtower-Track: taxonomy-ai
