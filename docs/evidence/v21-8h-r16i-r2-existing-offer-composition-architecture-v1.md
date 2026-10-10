# R16I-R2 — 제품·단품·유통 Offer·포뮬러 Subject 경계 설계 v1

> 상태: **DESIGN ONLY / HOLD**  
> 판정: `R16I_R2_REUSE_EXISTING_OFFERS_COMPOSITION_SHADOW_DESIGN_HOLD`  
> 기준: 2026-10-10, main `040d1abac8b6fc045abb4ac09f8497d155d6102a`  
> 제품: 에스네이처 아쿠아 스쿠알란 수분크림, `b639c8b4-6a61-440e-b4db-fac7381593ff`

## 1. 결론 — 기존 인프라 재사용, 새 테이블/워크플로 금지

**`public.product_offers`가 이미 운영 스키마에 존재하고, 연결된 관측·안전한 읽기·오퍼 표시 경계까지 마련돼 있다.** 따라서 새 Offer 테이블을 발명하지 않는다. 다만 현재 스키마에는 세트 구성품 수량·개별 용량·사은품 관계 필드가 없다. **R16I-R2에서는 구성품을 별도 감사 JSON의 review-only 구성(envelope)으로 표현하고, Production 구성 변경은 하지 않는다.**

기존 리포지토리 권한:

- `supabase/migrations/20260910103000_product_offers_shadow_v1.sql`: `product_id`, `seller_key`, `listing_id`, `listing_url`, `price_amount`, `offer_state`, `product_scope_state`. **구성품 없음**.
- `supabase/migrations/20260925121815_product_offers_health_presentation_read_v2.sql`: 제한된 런타임 읽기 RPC.
- `lib/product-offer-read-path.js`: 승인된 출처 조합만 구매 링크로 통과시키며 가격 자동 전파 거부(`priceAuthority: false`). 현재 정책에 **화해 Offer 등록 허용 규칙 없음**.
- `lib/server/product-offer-read-service.js`: 제한 역할(`recommendation_admission_runtime`), 서명된 읽기/제약.
- `docs/architecture/product-fact-subject-formulation-scope-v1.md`: **용량·멀티팩·사은품 세트는 포뮬러 신원과 별개**, 처방 변경을 입증해야 Subject 분리/통합.
- `docs/architecture/product-fact-storage-admin-review-v1.md`: 운영자 권한·정확 사전 상태·감사·낙관적 잠금·쓰기 격리의 기반.

**이번 단계에서는 SQL migration, DB UPDATE/INSERT, RPC 변경, 구매 링크 소스 정책 변경, 추천 스코어 변경을 하지 않는다.**

## 2. 실제 Production 사전 상태

읽기 전용 `SELECT`(2026-10-10):

| 단위 | 관측값 |
|---|---|
| 카탈로그 `products.id` | `b639c8b4-6a61-440e-b4db-fac7381593ff` |
| `products.size_ml` | **160** |
| `price_min/price_max` | **29,900원 / 29,900원** (현재 판매가 재검증 아님) |
| `unit_price_per_10ml` | **1,868.75원** |
| `buy_link` / `source_url` | `https://www.hwahae.co.kr/goods/45194` |
| `product_source_bindings` | 1건, `resolved` + `product_subject_unresolved` |
| `catalog_trust_intake` | 1건, `SUBJECT_CREATION_REQUIRED` + `REVIEW_REQUIRED`; Subject 없음 |
| `product_fact_subjects` | 0건 |
| 전체 `product_offers` | **73건** |
| 이 제품에 연결된 `product_offers` | **0건** |
| 화해 `45194` Offer 중복 | **0건** |

최신 카탈로그 `updated_at=2026-09-10T09:32:38.713599+09:00`; 바인딩 `updated_at=2026-09-10T10:10:29.03509+09:00`; Intake `updated_at=2026-09-21T00:53:57.499289+09:00`. **현재 시간이 아닌 마지막 행 수정 시점이다.** 실제 쓰기 직전 동일성을 다시 판정해야 한다.

## 3. 정확한 분리 모델

| 계층 | 의미 | 확정/제안 |
|---|---|---|
| **Product / Recommendation anchor** | 아쿠아 스쿠알란 수분크림 **제품 계열의 상업 기준점** | 기존 `products.id` 유지 |
| **Product Fact Subject** | 처방 세대/의미적 변형 | 공식 로트·처방 근거 없어 **키 null, 등록 금지** |
| **Single presentation** | 브랜드 공식몰 #151의 **80ml 단품** | 80ml 관측 확정; 동일 로트/처방 세대는 미확정 |
| **Retail Offer** | 화해 `45194`: **80ml 더블 + 세럼 10ml 기획세트** | 판매 제목으로 구성 주장 확인; 현재 DB의 `product_offers`에 행 없음 |
| **Offer components (review-only)** | 주 구성: 크림 **80ml×2 = 160ml**; 별도 사은품: **세럼 10ml×1** | 상품명에 근거한 **제안된 구성**, 실물/바코드 검증 미완료 |

**잘못된 등가식:**
- `Product.size_ml=160` → 160ml 단일 용기임을 뜻한다고 단정하지 않는다.
- `80ml×2 + serum10ml` → 단일 크림 170ml가 아니다.
- `Retail Offer` → 독립 Product Fact Subject가 아니다.
- `Hwahae review_count` → 공식 80ml 단품 리뷰/포뮬러 증거가 아니다.

### 리뷰용 Offer 구성 envelope — 스키마 초안 (이번에는 DB 저장 금지)

```json
{
  "contract_version": "retailer-offer-composition-review-v1",
  "product_id": "b639c8b4-6a61-440e-b4db-fac7381593ff",
  "seller_key_candidate": "hwahae",
  "listing_id": "45194",
  "listing_url": "https://www.hwahae.co.kr/goods/45194",
  "component_authority": "RETAILER_TITLE_ONLY",
  "primary_product": {"unit_volume_ml": 80, "quantity": 2, "aggregate_volume_ml": 160},
  "gift_other_product": {"product_id": null, "description": "세럼", "unit_volume_ml": 10, "quantity": 1},
  "review_state": "REVIEW_REQUIRED",
  "offer_id": null,
  "subject_semantic_key": null
}
```

나중에 세트 구성의 지속적 DB 질의·검증 수요가 확인되면 별도 구성품 관계 테이블을 **후보**로 평가할 수 있다. 아직 `product_offers`에 컬럼 추가하거나 `seller_listing_observations`/추천 메타 JSON에 구성품을 끼워 넣지 않는다.

## 4. 가격과 링크의 적용 범위

```text
상품 행의 과거 표시:
29,900원 / 160ml × 10ml = 1,868.75원 / 10ml

160ml → 80ml만 수정하면:
29,900원 / 80ml × 10ml = 3,737.5원 / 10ml   [잘못된 범위 전이]
```

세트의 **29,900원**을 단품 80ml의 판매가로 해석하면 안 된다. 그 값은 최신 확인된 판매가도 아니라 마지막 DB 저장값이다. 10ml당 가격을 표시하는 경우 **확정된 해당 Offer의 기본 크림 총용량 160ml를 분모로만 사용**하되, 사은품 세럼 10ml는 별개다. `170ml`로 나눠 크림의 단가를 계산해서도 안 된다.

`products.price_min/max/unit_price_per_10ml/buy_link`은 현재 레거시 값이므로 R16I-R2에서 그대로 둔다. 읽기 경로가 새 화해 Offer를 자동 허용할 수 없고, Offer가 0건인 지금은 가격·구매링크 투영 변경을 **아무것도 승인하지 않는다**.

## 5. 선택지 비교 및 채택

| 대안 | 판단 | 이유 |
|---|---|---|
| **A: 160→80 수치만 수정** | **거부** | 가격/단가 두 배 왜곡, 구매 세트 수량·URL·리뷰 범위 불일치 |
| **B: 새 Offer 테이블 설계·마이그레이션** | **거부** | 현재 73건이 있는 `product_offers` 재사용 가능 |
| **C: 현재 `product_offers` + 구성품 review-only 계약** | **채택(설계 단계)** | 패키지·단품 분리, 현행 운영 권한 존중, 무중단 |
| **D: 즉시 Offer row 생성·UI 노출** | **보류** | 현재 화해 Source 정책 미승인, 구성·최신 가격·링크 검증 필요 |
| **E: 세트마다 별도 Product Fact Subject** | **거부** | 세트 구성은 포뮬러 세대가 아님 |

## 6. 후속 실행 게이트

| 게이트 | 작업 | 종료/승인 조건 |
|---|---|---|
| **R16I-R2 (지금)** | Product·Subject·Single·Offer 경계, 영향범위·필드 소유권 계약 | 설계 검증 + PR CI, **Production 쓰기 0** |
| R16I-R3 | 대상 Offer 원본 재확인, 현행 판매 구성·가격·바코드, 스테이징/오프라인 shadow dry-run | 출처 권한·단품/세트 가격·리뷰·링크가 명확, 후보 생성만 |
| R16I-R4 | 관리자 판정 및 최소 변경 승인, 최신 DB 사전상태·잠금·멱등성·롤백 | **명시적 운영자 승인**, 변경 전/후 readback, 충돌 없을 것 |
| R16I-R5 | Offer 표시/구매 링크 별도 공개 범위 검증, 추천 결과 회귀 | 구매 링크 출처 정책·위험 제어·추천 불변성 통과 |

추가 필수 조건:
- 카탈로그 행을 **제품 계열 기준**으로 유지할지, **특정 Offer 기준**으로 해석할지 운영자가 확정.
- Offer 구성을 실제 판매페이지·원본 사진 등으로 확인하며 사은품 세럼은 정식 크림 Subject에 포함시키지 않는다.
- 가격·단위환산·리뷰 `market_signals` 범위를 개별 승인받고, 이전 리뷰를 **다른 상품/포뮬러**로 승격하지 않는다.
- `product_offers.product_scope_state`는 Subject/처방 증명이 없으면 보수적으로 유지.
- R16B 아누아/160ml HOLD, R16H 젤크림 80/90ml HOLD, ZEROID HOLD, 비수치 PDA **164×12=1,968** 검증 불변.

## 7. 종료 판정

`R16I_R2_REUSE_EXISTING_OFFERS_COMPOSITION_SHADOW_DESIGN_HOLD`: **설계 완료 / 즉시 수정 권한 없음**.

원본 출처와 의미 범위, 기존 DB 실측은 `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r2-existing-offer-composition-design-v1.json` 참고. 새로운 Product Fact Subject, Offer, 제품 필드, Binding, Intake, 추천·랭킹 변경 **0**.
