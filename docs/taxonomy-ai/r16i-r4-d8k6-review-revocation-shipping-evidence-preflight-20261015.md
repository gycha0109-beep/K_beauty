# D8K-6 — 최신 가격 검토 철회·원본 증거 분리·배송비 근거

> 2026-10-15 KST · taxonomy-ai
> **DRAFT_SQL_REVIEW_ONLY / SHADOW_VERIFIED / PG17_NOT_EXECUTED / PRICE_GATE_OFF**
> Branch after D8K-5 PR #1327; parent PRs all unmerged. Supply-chain #1208 blocks merge/release.

## 1. 실제 저장소에서 확인한 결함과 수정

### A. 검토 판정의 철회 불능

D8K-5 초안에서 `product_offer_option_reviews.observation_id`는 UNIQUE였다. 한 번 `verified`로 저장하면 변경 없는 이력 형태에서 나중에 `rejected` 판정으로 철회할 방법이 없었다. 인덱스 또한 `where verdict='verified'`여서 최신 거절이 이전 승인을 막는 계약을 입증하지 못했다.

수정: observation 1:N review events, `unique(observation_id,reviewed_at)`, 전체 verdict 최신 인덱스. 제안 SQL reader는 **옵션별 최신 observation을 먼저 고른 뒤, 해당 observation의 최신 review를 다시 고른 다음 verdict 검증**을 수행한다.

최신 판정이 거절·취소되면 더 오래된 승인 가격으로 돌아가지 않는다. 검토하지 않은 새로운 관측이 나오면 오래된 승인 관측으로 돌아가지 않는다. 검토 이력은 삭제·갱신하지 않고 보존한다.

### B. 동일 수집자·검토자 및 조작된 증거

기존 초안은 서명 없는 텍스트 `reviewer_reference`와 digest만 있었다. 같은 수집자가 스스로 승인하는 문제를 읽기 단계에서도 막지 못했다.

후보 관측에 `collector_actor_key`, `source_evidence_sha256`을 추가하고 검토에 `reviewer_actor_key`를 추가했다. 제안 private reader는 **최신 review actor와 collector actor가 달라야 하고, 원본 관측 SHA-256과 검토 digest가 동일**해야 반환한다. 일치하지 않으면 유효하지 않은 최신 기록을 이전 승인으로 대체하지 않는다.

**한계:** 여기서 actor ID는 텍스트 필드다. 실제 독립 검토의 증명은 향후 **인증된 수집자/검토자 서비스**, 원본 아카이브 접근권, 감사 로그, 해시 재계산이 필요하다. 임의 입력한 actor ID나 해시만으로 신뢰를 승인하지 않는다. 이번 변경에는 실제 수집·검토 DB writer grants가 없다.

### C. 배송비 미확인을 0원으로 취급할 위험

`shipping_price_krw`가 nullable인 것만으로는 유료/무료 배송 증거의 종류를 밝히기 어렵다.

- `shipping_price_basis='unknown'`: 금액 NULL만 허용.
- `shipping_price_basis='seller_published_flat'`: 관측된 배송비 정수 (0원 포함)만 허용.
- 주소/회원/쿠폰/무료배송 조건은 판매처가 고정 금액을 증명하지 않았다면 unknown으로 기록해야 한다.
- 이 금액으로 계산하는 합계는 **관측 옵션가격+판매처 게시 배송비**일 뿐 실제 최종 결제 최저가가 아니다.

후보 SQL에 check를 넣었고, `lib/commerce/product-offer-selected-option-evidence-v1.mjs`에서 SQL 반환의 배송비·basis 상충을 전부 HOLD 처리한다.

## 2. 추가한 읽기 전용 코드와 검증

- `lib/commerce/product-offer-review-history-shadow-v1.mjs`: 옵션별 최신 관측과 최신 검토 이벤트를 선택하는 **순수 오프라인 검사**. 동일 actor, digest 불일치, 최신 거절, 미검토 최신 관측, 오래된 시각, 중복 이벤트, 수량 상한을 검증한다. 가격·URL은 출력하지 않고 `pricePublicationAuthorized=false`.
- `scripts/product-evidence/verify-d8k6-option-review-history-shadow-v1.mjs`: 최신 검토 판정, 취소 후 재승인, 미검토 최신 관측/과거 가격 후퇴 방지, actor 분리, digest, timestamp와 SQL 계약을 synthetic 검사.
- 기존 `verify-d8k5-selected-option-evidence-contract-v1.mjs`: 새 다대일 리뷰 구조 및 배송비 세분화 검사 추가.
- `scripts/product-evidence/verify-r16i-price-scope-review-v1.mjs`에 D8K-6 검증을 포함.

**추가 한계 보수:** SQL 집계는 적격 결과를 최대 257개만 JSON으로 구성한 뒤 256개 초과를 거부한다. 다만 그 이전 관측·검토 이력을 정렬하는 비용은 여전히 PG17에서 데이터량별 성능 시험이 필요하다.

**이번 환경에서 실행한 검증**: GitHub에서 읽은 최신 JS 구현을 격리 V8으로 실행하여 D8K-6 리뷰 이력 107 assertion PASS, D8K-5 DTO/SQL 정적 274 assertion PASS. 실제 PG17 SQL 실행, SQL AST parse, 역할 전환, 전체 Next 빌드, 브라우저, 라이브 판매처 가격은 확인되지 않았다.

## 3. 별도 격리 PG17 검증 매트릭스 (아직 미실행)

| 시나리오 | 기대 결과 |
| --- | --- |
| 기존 부모 `product_offers` 고유 제약 유지 | 동일 판매 URL/리스팅 1개 + 여러 자식 옵션 관측 보관 |
| 관측 1차 검토 승인 → 후속 검토 거절 | 결과에서 제거; 기존 승인으로 fallback 금지 |
| 새 관측 미검토·거절 | 이전 관측이 검토 완료여도 결과에서 제거 |
| 검토자와 수집자 동일 / digest 미일치 | 읽기 후보에서 제거 |
| 원본/검토 미래 시각, 역순, 중복 타임스탬프 | 거부 또는 행 제외 |
| 배송비 unknown/NULL, published_flat/0, published_flat/양수 | 유효 |
| 배송비 unknown/0, published_flat/NULL | 데이터 CHECK 위반 및 DTO HOLD |
| `anon`·`authenticated`·`service_role` raw SELECT 및 EXECUTE | 거부 |
| `recommendation_admission_runtime` 자체 raw SELECT | 거부 |
| 전용 DB definer/owner RLS 지정 경로, <=64 Products/<=256 rows | 계약대로 제한적 결과 |
| 65 Product, 257 option rows, null/empty input | NO_AUTHORITY; partial disclosure 금지 |
| 저장 리포트/공유 결과, 위조된 admission DTO | 공용 가격 노출·특권 상승 없음 |
| 롤백 및 이전 리포트/가격 링크 | 기존 Product/Offer 및 purchase link unchanged |

검증 DB는 운영 Supabase와 완전히 분리해야 하며 별도 role/DB privileges를 재현해야 한다. 후보 SQL은 현재 `docs/taxonomy-ai/sql/`의 두 파일이고 **`supabase/migrations`가 아니다**. 마이그레이션 파일 생성·실행·권한 승격·운영 DB 변경은 별도 명시 승인 전 금지. 이 환경에는 사용 가능한 `postgres`/`initdb`/`psql` 서버 실행 파일이 없었고 패키지 저장소 접속도 실패했다. 호스팅된 Supabase를 우회 실험 대상으로 사용하지 않았다.

## 4. 남은 승인 및 중단 규칙

1. 실제 격리 PG17 인스턴스 제공 및 별도 실행 승인 후 후보 SQL 역할/행/검토 철회를 **실제로** 검증하고 정식 CLI migration을 생성.
2. 인증된 수집자·검토자 이중 통제, 판매처별 관측 원본 아카이브, SKU/선택옵션 대조, shipping conditions, 증거 hash 재계산과 reviewer audit 계약.
3. 실제 인증/추천 admission 재검증과 서버 전용 reader/DTO/CTA 독립 승인. public 공유 경로는 별도 격리.
4. 실제 원본 가격 표기와 UI 활성화, 전체 빌드/모바일·다크모드/E2E 및 출시 전 보안 #1208 해결.

**STOP:** 운영 데이터, Auth/RLS, migration, DB grants, protected API/storage, 구매 CTA, 배포 변경을 이번 Draft PR에서 수행하지 않는다.
