# D8K-5 — 선택옵션 증거 저장·읽기 계약 / 실제 추천 UI 연결점

> 2026-10-15 · **DRAFT_CODE_READY / SYNTHETIC_VERIFIED / SQL_NOT_EXECUTED / PRICE_PUBLICATION_OFF**
> Repo `gycha0109-beep/K_beauty`; stacked after D8K-4B Draft PR #1325.
> 공급망 문제 #1208 해결 전 병합·배포 금지.

## 1. 확정한 데이터 단위

현재 `public.product_offers`는 `UNIQUE(seller_key,listing_id)` / `UNIQUE(seller_key,listing_url)`에 따라 **한 판매처 페이지/리스팅**을 식별한다. 하나의 listing을 임의의 가짜 listing_id로 나누면 안 된다.

D8K-5는 이 제약을 유지하고 자식 테이블 두 개를 **검토용 SQL**로 설계했다.

| 후보 테이블 | 핵심 키와 내용 | 기록 원칙 |
| --- | --- | --- |
| `product_offer_option_observations` | `observation_id`, `offer_id` FK, `seller_option_key`, SKU variant, 단품/묶음/기획세트, 용량·수량·증정 구성, 선택옵션 금액, nullable 배송비, 출처·관측일 | **새 가격을 append**. 동일 listing의 다른 선택옵션은 별도 child observation. 이전 가격 보존 |
| `product_offer_option_reviews` | observation FK(unique), 검토 결론, reviewer reference, 증거 SHA-256, 검토일 | 관측자가 부여한 단일 `verified` 플래그를 독립 검토로 오인하지 않도록 별도 테이블 |

SQL 후보:
- `docs/taxonomy-ai/sql/d8k5-selected-option-evidence-schema-review-only.sql`
- `docs/taxonomy-ai/sql/d8k5-selected-option-private-read-review-only.sql`

**주의:** 위 경로는 `supabase/migrations`가 아니며 실제 DB에 적용되지 않았다. Supabase CLI migration 생성·PG17 격리 시험·마이그레이션 diff/rollback 및 역할 승인 후 별도 병합 대상이다.

## 2. 서버 조회 계약과 의미

제안 RPC: `read_selected_offer_option_evidence_v1(uuid[])`.

- 기존 `recommendation_admission_runtime` 전용 EXECUTE; `anon`, `authenticated`, `service_role` 직접 실행 차단
- 부모 상품/판매자와 FK로 결합; 선택옵션별 **가장 최근 관측**을 먼저 결정한 뒤 검토 완료인 경우만 반환한다. 최근 기록이 미검토/거부면 오래된 승인 가격으로 조용히 후퇴하지 않는다.
- 한번에 64 Product ID/256 option rows; 과다 입력은 NO_AUTHORITY. `listing_url`, raw 구매 URL, 직접 CTA를 반환하지 않는다.
- 옵션별 `observed_at`, `review_id`, 증거 digest·선택금액·nullable 배송비를 구분한다.
- 미검토 가격, 선물/증정 구성 불확정, 품절, 타사 option 혼입은 구매 권한이 아니다.
- 이 RPC의 반환 자체로 사용자의 **추천 승인**, 검토 원본의 독립적 진실성, URL 안전성, 쇼핑몰 결제 최저가가 확정되지 않는다.

`lib/commerce/product-offer-selected-option-evidence-v1.mjs`는 SQL 후보 반환 형식을 엄격하게 검사하고 64개 단위 주입형 reader를 분할 호출한다. 날짜/가격/구성/증거 ID/중복 검증 및 여러 batch 중 하나라도 실패하면 **전체 HOLD** 처리한다. `maxAgeMs` 없으면 HOLD. 검증 결과는 내부 진단 전용이며 `selectedOptionPriceDisplayAuthorized=false`와 `directCtaAuthorized=false`이다.

**남은 별도 보호 계약:** 실제 서버 role-bound executor, 승인된 추천 Product ID/provenance와 사용자/저장 리포트 접근권 검사, 독립 리뷰·수집 운영, 데이터 이력 TTL 승인. 현재 injected callback은 신뢰된 실행 경로를 증명하지 않는다.

## 3. 계산기 및 실제 무료·프리미엄 UI 코드

- 기존 `lib/commerce/product-offer-comparison-v1.mjs`는 reviewed child observation/review ID와 digest가 형식상 유효할 때 **같은 실제 listing 아래의 선택옵션들**을 서로 다른 행으로 인정할 수 있게 보수. option key 중복·observation ID 중복·같은 parent와 다른 listing 충돌·legacy parent/child 혼재는 전부 거부. Child 옵션 직접 CTA는 명시적으로 차단.
- `lib/commerce/product-offer-presentation-v1.mjs`는 배송비가 확인되지 않았는데 가짜 `totalPrice`만 있는 경우 배송비 포함 가격으로 표기하지 않는다. Child option row를 고유 UI key로 사용, 영어 금액을 KRW로 표기.
- `RecommendedProductOfferSlot.jsx`를 F-01 무료 Top Pick, P-01/02 프리미엄 AM/PM 루틴, P-03/04/05 프리미엄 기능성 3개 탭 공통 렌더러 위치에 삽입. **하드코딩된 `LIVE_COMPARISON_RELEASE_ENABLED=false` 유지**. 가격·버튼은 렌더되지 않으며 비인가 client props로 켤 수 없다.
- 공개 공유 S-01/02는 제외하고 `ResultShareCard` 변경 없음. 현재 보유 제품·Face Lab·legacy 비활성 카드도 제외. Product 추천 score/rank 순서 변경 없음.

## 4. 독립 검증 및 한계

- `scripts/product-evidence/verify-d8k5-selected-option-evidence-contract-v1.mjs`: 가상 2옵션 한 listing, gift kit, 배송비 unknown/0, null/0/invalid price, stale/future, duplicate, 65-ID batch, 전체 실패시 partial 차단 및 SQL 접근 정적 검증
- `scripts/product-evidence/verify-d8k5-active-offer-slot-coverage-v1.mjs`: 실제 사용 UI 경로 6종 연결점과 하드 OFF, 공개 공유 배제
- 기존 D8K-1/3 테스트에 동일 listing child option 및 배송비 합산 가격 진실성 회귀 추가
- 위 신규 검증을 기존 `verify-r16i-price-scope-review-v1.mjs` 체인에 포함. 기존 마이그레이션·Auth·RLS·API 필드·운영 데이터 직접 변경은 0건.

**완료 아님:** SQL 문법/PG17 RLS 역할 테스트 미실행, 실제 판매처 증거 수집 없음, 전용 서버 RPC 실행 없음, 원본 검토 운영/체크아웃 금액 증명 없음, 브라우저/E2E 없음, 실사용자 비교 카드 0건. 합성 PASS가 실제 데이터 검증이나 출시 승인으로 승격될 수 없다.

## 5. 실행 순서 / 중단 규칙

1. 별도 보호 승인 후 SQL 후보를 Supabase CLI로 정식 migration 생성; 기존 role/RLS과 충돌하지 않는지 PG17 격리 환경에서 negative/positive permission, history/no-fallback, 64/256, rollback 검증
2. 판매처별 선택옵션 관측·검토 독립 작업체계와 근거 기록을 수립하고 샘플 실상품 검증
3. 인증된 서버에서 현재 추천 admission 재확인 → 제한된 내부 DB role로 private option reader 실행 → 필요한 DTO만 반환
4. verified server DTO를 F/P 활성 슬롯에 전달, CTA와 비교 UI feature gate를 독립적으로 승인/활성화, 직접 링크 도메인별 감사
5. 공유 링크는 공개 범위·개인정보 권한을 별도 검증, 100% 카드 coverage/모바일·다크모드/재진입/E2E/CI 통과
6. #1208 공급망 문제 해결 및 별도 Owner 병합·배포 승인 전까지 **HOLD**

**STOP:** `supabase/migrations`, DB/RLS/grants/Auth/API 응답·저장 스키마, 운영 Product/Offer, 가격 공시, 구매 CTA, 배포에는 승인 없는 수정·실행 없음.
