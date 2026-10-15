# D8K-4B — 추천 승인과 판매처 조회 사이의 서버 권한 경계

> 2026-10-15 KST · Track: taxonomy-ai · **DIAGNOSTIC_ONLY / PROTECTED_SERVER_READ_HOLD / PRODUCTION_HOLD**
> Base: D8K-4 Draft PR #1324. 이 문서는 DB/RLS/Auth/API/배포 변경을 승인하거나 실행하지 않는다.

## 1. 현재 소스가 증명하는 것

실제 사용자 화면의 SKU별 결제가격을 출력하는 통로는 아직 없다. 확인된 경로는 다음과 같다.

```text
F-01/P-01~05 (실제 무료·프리미엄 추천 UI)
 → collectActiveRecommendationOfferSlots (UUID 형식만 확인)
 → D8K-4B reconcileActiveRecommendationAdmissionForOfferRead [추가: 오프라인 진단]
 → [권한 있는 서버 측 admission/subject 재확인: 미구현·미승인]
 → [recommendation_admission_runtime 내 private RPC 호출: 미구현·미승인]
 → D8K-2 readProductOfferAuthorityTransport (Offer 식별자만 보존, 가격/URL 제거)
 → [선택옵션·구성·증정·배송비·판매가·시각 독립 증거: 현재 스키마에 없음]
 → D8K-1 buildProductOfferComparison (충분한 증거가 있을 때만 의미 있음)
 → D8K-3 ProductOfferComparison (현재 mock-only, 실제 카드 미삽입·CTA 비활성)
```

관련 실행 코드:
- `lib/product-source.js` → `admitRecommendationProducts(data)` → `projectAdmittedRecommendationProducts(...)`. 현재 권한 확인 결과 **summary만 별도 보관**하며, 각 추천 카드가 화면에 렌더된 뒤 해당 admission decision의 서명/출처/현재성을 재증명할 공개 계약이 없다.
- `lib/recommendation-candidate-admission-core.mjs`: decision은 `LEGACY_COMPATIBILITY_ADMISSION`, `INITIAL_ADMISSION_GRANT`, `REJECTED`이다. **추천에 포함할 수 있다는 결정**이지 옵션별 판매가격·직접구매 링크 허가는 아니다.
- `supabase/migrations/20260925121815_product_offers_health_presentation_read_v2.sql`: `read_product_offer_presentation_authority_v2(uuid[])` 실행권한은 `recommendation_admission_runtime` DB role에 제한된다. 브라우저의 anon/authenticated, 통상 service_role 직접 EXECUTE는 허용되지 않는다. 각 호출 64 Product / 256 Offer 상한.
- `lib/commerce/product-offer-authority-read-v1.mjs`: **실제 DB 호출자는 없음**. 가상의 권한 있는 reader 주입을 받더라도 가격/URL을 반환하지 않고 상품·판매자 ID만 HOLD 상태로 돌려준다.
- `lib/commerce/product-offer-comparison-v1.mjs`: `admissionState='admitted'`와 신뢰 가능 선택옵션 증거를 요구하지만, 이 문자열이나 source의 `evidenceStatus='verified'`만으로 권한을 만들어서는 안 된다.

## 2. 이번에 구현한 비보호 사전 검증

`lib/commerce/active-offer-admission-reconciliation-v1.mjs`

- D8K-4의 8개 UI 위치 종류/행/후보 ID 목록이 서로 일치하는지 검사한다. 공개 share, 보류된 플랜, 무ID는 private read 후보에 포함시키지 않는다.
- 기존 admission envelope의 `contractVersion`, decision/product UUID, reason codes, `g2` 최소 구조, summary 카운트·오류 여부를 대조한다. 같은 ID의 중복·거절·미제출·형식 불일치라면 **전체 HOLD**.
- 정확히 일치하는 경우에도 결과는 `DIAGNOSTIC_MATCH_ONLY`이다. 64개 단위 read batch의 **크기만 미리 산출**하고, API/DB 호출·권한 부여·구매 링크 생성은 하지 않는다.
- 모든 출력에서 `privateRpcReadAuthorized=false`, `privateRpcReadInvoked=false`, `sellerPriceAuthorized=false`, `directCtaAuthorized=false`; raw Offer·URL·가격 데이터가 없다.
- 512개 초과 후보는 기존 D8K-2 조회 상한을 그대로 적용해 HOLD.
- **중요:** 임의 전달받은 admission JSON은 서명이 있는 실제 서버 근거가 아니다. 가짜로 만들 수 있는 `g2` 객체를 승인 토큰처럼 사용하지 않는다. 이 모듈은 코드 계약 회귀 진단이며, 서버 권한 또는 네트워크 송신 권한을 만들어 주지 않는다.

검증:
`node scripts/product-evidence/verify-d8k4b-active-offer-admission-reconciliation-v1.mjs`
기존 `scripts/product-evidence/verify-r16i-price-scope-review-v1.mjs`에 추가해 오프라인 CI 경로에 포함한다.

## 3. 서버 측 실제 읽기/결제 가격에 필요한 **별도 승인 대상**

| 경계 | 현재 공백 | 보호 작업 제안 · 이번 변경에 포함하지 않음 |
| --- | --- | --- |
| 추천 결정 provenance | UI의 Product ID와 당시 승인 결정의 서버 결합 부재, legacy 저장 리포트 ID 미보장 | 서버에서 추천 결과 ID와 admission/subject authority를 재확인하는 계약. 임의 client JSON 신뢰 금지 |
| RPC 실행 | 지정 DB role만 EXECUTE, 일반 Supabase client 역할과 다름 | 기존 역할을 공유하게 할 것이 아니라 승인된 제한적 서버 실행 경로·권한/감사를 별도 설계 |
| 옵션 저장 | `product_offers`에 선택옵션 ID, variant/구성/증정/배송 증거 없음; listing ID·URL unique | 단일 listing 아래 옵션을 별도 식별하는 additive schema/evidence 관계. 운영 migration은 승인 후 |
| 금액 사실성 | Product 대표가 vs 판매처 옵션가격/배송비/쿠폰/회원조건의 구분 부족 | timestamp/source/provenance 포함 option-level 확인 정책, 누락은 미확인 표시 |
| 인증/공유 결과 | 클라이언트 결과·저장 리포트·공개 share별 권한 차이 | 서버-only read DTO 또는 별도 endpoint의 접근 제약/field contract 승인. 공유 링크는 독립 개인정보·공개 범위 평가 |
| 구매 CTA | 판매처 domain allowlist 일부만 존재, 쿠팡/일반 브랜드 링크 미허가 | seller/redirect/옵션 정합성·관측 freshness 검증 및 독립 CTA 전환 승인 |
| 출시 | #1208 Supply Chain 보안 이슈, PR #1288 미병합 | 전체 검증/브라우저/CI·feature OFF+rollback 이후 Owner 승인. 병합/배포는 그 전까지 HOLD |

권장 순서: (1) DB/API를 쓰지 않는 실제 카탈로그/화면 ID 실사 → (2) Owner가 저장 스키마·서버 역할/출력 계약을 별도 승인 → (3) PG17 격리 권한/RLS/role 검사와 additive migration 드라이런 → (4) 서버 전용 DTO와 D8K-1 증거 연결 → (5) F-01/P-01~05 기존 추천 순서 보존하면서 UI 연결 및 공개 공유 별도 검증 → (6) 100% active card/E2E/비교·CTA 2단계 OFF gate → (7) 공급망 보안 해결 후 별도 배포 승인.

**중단:** API 필드명·저장 데이터·DB schema/migration·RLS/grants·Auth/role·production Product/Offer·배포·직접 CTA allowlist를 사용자 승인 없이 수정하지 않는다.
