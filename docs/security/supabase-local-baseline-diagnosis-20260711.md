# Supabase Local Baseline 무변경 진단

## 1. 조사 범위

- 작업 유형: 저장소 파일 기반 진단
- 대상 브랜치: `codex/survey-input-contract-refactor`
- 대상 migration: `supabase/migrations/*.sql` 24개
- 대상 shadow 파일: `supabase/local-shadow-test/migrations/00000000000000_local_shadow_bootstrap.sql`
- 보조 근거: shadow 전용 config/seed, 기존 runbook/review, 관련 script, application product read contract
- 판정 표현:
  - **저장소 파일로 확정**: 현재 checkout의 SQL, config, script 또는 문서가 직접 증명한다.
  - **저장소 파일상 강하게 추정**: 여러 독립 파일이 같은 구조를 가리키지만 실제 DB metadata는 확인하지 않았다.
  - **실제 DB 없이는 확인 불가**: remote/local catalog 또는 migration replay가 필요하다.

이번 진단은 일반 Supabase baseline을 만들거나 migration을 실행하는 작업이 아니다.

## 2. 금지한 실행 및 변경

이번 조사에서는 다음을 실행하지 않았다.

- `supabase start`, `stop`, `db reset`, `test db`, migration apply/repair/link
- Docker, `psql`, PostgreSQL 연결 또는 SQL 실행
- production/staging/remote Supabase, Storage, Auth, schema metadata 접근
- 외부 API, OpenAI, package install, network request
- build/test/runtime route 실행
- 코드, migration, package, config, env, seed, shadow bootstrap 수정
- Git index/branch/history를 변경하는 명령

변경 허용 범위는 이 문서와 `.codex/AI_WORK_LOG.md`뿐이다.

## 3. `supabase start` 실패의 직접 원인

제공된 오류와 정확히 대응하는 statement는 첫 production migration의 다음 구문이다.

- 파일: `supabase/migrations/20260410_safe_review_and_promotion_layer.sql`
- 위치: 270행
- statement: `alter table public.products ...`
- migration 순서: 파일명 정렬 기준 24개 중 1번째

이 migration은 11행에서 `public.product_category`, 26행에서 `public.product_texture`, 40행에서 `public.product_finish`, 54행에서 `public.product_review_status`를 조건부 생성한다. 그러나 `public.products` 자체는 생성하지 않는다. 첫 relation-level products statement가 270행의 `ALTER TABLE`이므로 빈 DB에서는 여기서 `relation "public.products" does not exist`가 발생한다.

| 항목 | 결과 | 근거 파일 | 판정 |
|---|---|---|---|
| 최초 products 참조 migration | `20260410_safe_review_and_promotion_layer.sql`, 270행 `ALTER TABLE` | `supabase/migrations/20260410_safe_review_and_promotion_layer.sql` | 저장소 파일로 확정 |
| products 생성 migration 존재 여부 | production migration 24개에는 없음. 저장소 전체 SQL 중 생성문은 shadow bootstrap에만 있음 | `supabase/migrations/*.sql`, shadow bootstrap 6행 | 저장소 파일로 확정 |
| 선행 enum/type 존재 여부 | product category/texture/finish/review status는 첫 migration 내부에서 생성. base table은 미생성 | 첫 migration 3-64행 | 저장소 파일로 확정 |
| 운영 기존 schema 의존 여부 | products/product_candidates/source_rankings를 생성하지 않고 ALTER/UPDATE/%ROWTYPE/FK/view 대상으로 사용 | 첫 migration 270-693행 | 저장소 파일로 확정 |

추가로 첫 migration은 `public.product_candidates`도 생성하지 않은 채 355행부터 ALTER하고, 427행의 view에서 `public.source_rankings`를 참조한다. 따라서 products만 임시 생성해도 전체 체인은 재현되지 않는다.

저장소 root에는 `supabase/config.toml`이 없고, config는 `supabase/local-shadow-test/config.toml`에만 있다. 따라서 사용자가 관찰한 정확한 CLI workdir/명령 문맥은 저장소 파일만으로 확정할 수 없지만, 제공된 SQL 오류의 직접 원인은 위 migration chain으로 확정된다.

## 4. 현재 migration 체인

현재 production migration 폴더에는 24개 파일이 있다.

- 1-6: 기존 products/candidate 계층 보정, analysis 결과 schema, product signal, premium session, timezone, RPC execute 제한
- 7-15: revisit tables/RLS, category 분화, product insert, anonymous policy, treatment/product form
- 16-22: ranking snapshot, candidate/review queue 및 promotion policy
- 23: SEC-01 analysis request guard
- 24: SEC-05 anonymous write grants

이 체인은 완전한 빈 DB baseline이 아니다. 첫 파일 이전에 적어도 `products`, `product_candidates`, `source_rankings`가 존재해야 하며, 마지막 SEC-05 migration 이전에는 repository migration에 생성문이 없는 `recommendation_logs`가 존재해야 한다.

## 5. Shadow bootstrap object 목록

Shadow bootstrap은 첫 두 주석에서 목적을 직접 선언한다.

- `Test-only disposable local schema for the isolated shadow route harness.`
- production migrations 밖에 있으며 synthetic data만 사용한다고 명시

| Object | 종류 | 포함된 핵심 구조 | 생략된 구조 | shadow 전용 징후 |
|---|---|---|---|---|
| `shadow_audit` | schema | mutation observer 전용 namespace | 운영 domain object | 이름과 목적이 audit harness 전용 |
| `public.products` | table | route scorer에 필요한 24개 기본/신호/sunscreen 필드, text PK | 운영 UUID 계약, normalized/source/import 필드, 운영 constraint/index/grant 전부 | synthetic text ID와 broad nullable field |
| `analysis_request_rate_windows` | table | scope/hash/endpoint/window/count PK | production migration의 전체 check/index/expiry 계약 | route guard 호출을 받기 위한 최소 형태 |
| `analysis_request_idempotency` | table | key/fingerprint/state/expiry PK | production 상태 전이와 상세 constraint/index | route guard 호출을 받기 위한 최소 형태 |
| `premium_report_sessions` | table | session/report/locale/expiry/update | production index와 실제 lifecycle 검증 | route side effect 관찰용 최소 table |
| `shadow_audit.mutation_events` | table | surface/table/operation/normalized identity/count | 운영 기능 없음 | test observer 전용 identity table |
| `shadow_audit.record_mutation()` | trigger function | 세 route mutation surface를 normalized event로 기록 | 운영 로직 없음 | synthetic `md5` identity와 test surface IDs |
| 3개 `local_shadow_*_audit` | trigger | guard/premium table mutation 관찰 | 운영 trigger 없음 | 이름과 대상이 shadow observer 전용 |
| `consume_analysis_rate_limits(jsonb)` | function stub | row count 증가 후 `allowed=true` 반환 | limit enforcement, atomic deny/reset/remaining 계약 | 항상 허용하는 축약 body |
| `claim_analysis_idempotency(...)` | function stub | insert-on-conflict-do-nothing 후 항상 `claimed` | conflict/fingerprint/in-progress/completed 판정 | shadow route 통과용 단순 body |
| `complete_analysis_idempotency(...)` | function stub | state/result reference update | fingerprint를 WHERE에서 검증하는 production 계약 | 최소 update |
| `fail_analysis_idempotency(...)` | function stub | failed/retry update | fingerprint/status 전이 검증 | 최소 update |
| `local_shadow_products_read` | RLS policy | anon/authenticated 전체 products read | 운영 products 정책 및 ownership/role 설계 | synthetic scorer row 공개 읽기용 |
| grants/revokes | privilege | service_role guard/session 접근, products read, RPC PUBLIC revoke | 운영 전체 table/function ACL | route harness 최소 권한 |
| `seed.sql` | test fixture | 5개 synthetic product row | 실제 제품 데이터와 전체 category/field coverage | `shadow-*`, `Synthetic Lab` 명시 |

명시적 enum, domain, sequence, extension, comment, explicit index는 없다. PK/unique constraint가 만드는 implicit index만 존재한다. bootstrap 자체에는 fixture INSERT가 없고 별도 synthetic `seed.sql`에 있다.

## 6. Products schema 비교

| 항목 | Production migration/runtime가 요구하는 계약 | Shadow bootstrap | 판정 |
|---|---|---|---|
| `id` | promotion 함수의 target/candidate FK가 UUID를 전제 | `text primary key` | 불일치 |
| category | `public.product_category` enum으로 변환되고 이후 값 확장 | `text not null` | 축약 초기형 |
| product form | `public.product_form` enum을 생성하고 products에 추가 | `text` | 타입 불일치 |
| normalized fields | `normalized_name`, `normalized_brand`, unique index 필수 | 없음 | 누락 |
| pricing | `price_min`, `price_max` | 포함 | 부분 일치 |
| purchase/source | `buy_link`, `hwahae_url`, `source_url`, external source/type/id 등이 후속 INSERT/runtime에서 사용됨 | 모두 없음 | 누락 |
| general metadata | `is_mens`, recommendation tier, size/unit-price 등 후속 INSERT가 사용 | 없음 | 누락 |
| sunscreen | runtime의 `uv_filter_type`, `tone_up`, `white_cast`, `eye_sting`, `pilling_risk` | 포함 | route fixture용 부분 일치 |
| signal JSON | review/market/ingredient signals | 포함 | 부분 일치 |
| timestamps | `created_at`, 후속 migration이 `updated_at` 추가/NOT NULL | `created_at`만 포함 | 부분 일치 |
| constraints | enum, normalized uniqueness, skin/concern/irritation checks 등 | PK 외 핵심 constraint 없음 | 누락 |
| RLS/policy | 실제 production 정책은 repository에서 완전 재구성 불가 | RLS + 모두 읽기 policy | 운영 계약 아님 |
| grants | 실제 products grant 전체 계약 미확인 | anon/authenticated/service_role SELECT | harness 전용 |
| indexes | normalized/source/runtime index 필요 | explicit index 없음 | 누락 |

특히 shadow의 `product_form text`는 후속 migration의 `ADD COLUMN IF NOT EXISTS product_form public.product_form`을 건너뛰게 하므로, main migration을 가정상 이어 붙여도 enum 타입으로 정렬되지 않는다. `products.id text` 역시 UUID FK를 추가하는 첫 migration 계약과 맞지 않는다. 이는 shadow schema가 production chain의 timestamp-0 baseline이 아니라 route 호출에 필요한 필드만 모은 독립 schema라는 직접 증거다.

## 7. Migration dependency inventory

| Migration | 참조 object | 참조 방식 | 생성 migration 존재 | Shadow bootstrap 제공 | 누락/불완전 |
|---|---|---|---|---|---|
| `20260410_safe_review_and_promotion_layer` | products, product_candidates, source_rankings | ALTER/UPDATE/FK/view/RPC | 없음 | products만 축약 제공 | 세 base object와 products 실제 계약 누락 |
| `20260424_align_analysis_results_share_schema` | analysis_requests/results, pgcrypto | CREATE/ALTER/FK/index | 자체 생성 | 미제공 | main chain 기준 self-contained |
| `20260430_add_products_signal_columns` | products | ALTER | 없음 | 축약 products가 signal 필드 선제공 | actual base 누락 |
| `20260506070849_create_premium_report_sessions` | premium_report_sessions, pgcrypto | CREATE/RLS/index | 자체 생성 | 축약 제공 | shadow index/정확한 contract 생략 |
| `20260506092454_set_database_timezone` | database `postgres` | ALTER DATABASE | platform object | platform 제공 전제 | runtime DB 없이는 확인 불가 |
| `20260507_restrict_promote...` | promote_product_candidate | revoke/grant | 첫 migration이 생성 | 미제공 | 첫 migration 실패 시 도달 불가 |
| `20260520170737_add_revisit_core_tables` | auth.users, profiles, skin_profiles, saved_reports, daily_checkins, routine_logs | CREATE/FK/RLS/policy/trigger | public tables 자체 생성 | 미제공 | auth schema는 Supabase platform 전제 |
| `20260524054039_split_moisturizer_categories` | product_category | ALTER TYPE | 첫 migration이 생성 | 미제공 | first migration 선행 필요 |
| `20260524054049_reclassify...` | products, product_category, normalize helper | UPDATE/function | base products 없음 | 축약 products만 제공 | actual type/table contract 누락 |
| `20260526_moisturizer...insert` | products와 다수 기존 column/type | INSERT/ON CONFLICT | products/다수 column 생성문 없음 | 필요한 column 다수 미제공 | 운영 기존 schema 강한 의존 |
| `20260531123349_restrict_anonymous...` | revisit 5 tables, auth.uid/jwt | policy 교체 | 20260520에서 public tables 생성 | 미제공 | Supabase Auth runtime 전제 |
| `20260613025816_add_treatment_product_form` | product_category, products | ALTER TYPE/TABLE | type은 첫 migration, products 없음 | products 있으나 product_form 타입 불일치 | 일반 baseline 부적합 |
| `20260613030023_migrate_treatment_forms` | products, product types/functions | UPDATE/function | 일부 선행 migration | 축약 products | 실제 type alignment 불가 |
| `20260620212309_candidate_product_form...` | product_candidates/products/product_form | ALTER/RPC/INSERT/UPDATE | candidate/products base 없음 | 미제공 | base tables 누락 |
| `20260620214740_fail_closed_map...` | product_category/normalize helper | function replace | 선행 migration | 미제공 | first migration 선행 필요 |
| `20260621030000_phase1_ranking_snapshot` | ranking_snapshots, source_rankings, product_candidates | CREATE + ALTER/FK/RPC | ranking_snapshots만 자체 생성 | 미제공 | source_rankings/product_candidates base 누락 |
| `20260621151304_repair_phase1...` | ranking snapshots/source rankings/candidates | ALTER/RPC | 일부 선행 | 미제공 | base 누락이면 실행 불가 |
| `20260621152040_repair...truncate` | ranking_snapshots | revoke | 20260621030000 | 미제공 | chain 선행 필요 |
| `20260621155819_phase2...` | ranking snapshots, candidates, source rankings | table/view/trigger/RPC | candidate reviews 자체 생성 | 미제공 | 두 preexisting base table 누락 |
| `20260621160633_repair_phase2...` | ranking_snapshots | function/update | 20260621030000 | 미제공 | chain 선행 필요 |
| `20260622180503_repair_review_queue...` | candidates/source rankings/products/reviews | view/RPC/DML | products/candidates/source base 없음 | 미제공 | base 누락 |
| `20260627224615_ranking_review_v2...` | 동일 ranking/product 계층 | view/RPC/DML | 일부 선행 | 미제공 | base 누락 |
| `20260704221747_sec_01...` | guard tables/RPC | CREATE/RLS/ACL/functions | 자체 생성 | 축약 동명 objects/functions | shadow 구현은 production semantics가 아님 |
| `20260711032649_sec_05...` | analysis_results, recommendation_logs | ALTER/FK/index + grant tables/RPC | analysis_results는 20260424, recommendation_logs는 없음 | 모두 미제공 | fresh chain은 recommendation_logs에서 추가 실패 가능 |

Storage schema 참조는 production migration에서 확인되지 않았다. Auth schema는 revisit tables의 `auth.users` FK와 RLS 함수에서 사용하며, 이는 Supabase platform 제공 object다.

## 8. 저장소 내 초기 schema 근거

| 근거 파일 | 포함 schema | 신뢰도 | 일반 baseline 활용 가능성 |
|---|---|---|---|
| `20260410_safe_review_and_promotion_layer.sql` | product enums, normalization, products/candidate ALTER, promotion RPC | 높음 | base가 아니라 기존 schema 위의 보정 layer |
| `20260424_align_analysis_results_share_schema.sql` | analysis_requests/results 초기 create | 높음 | 해당 두 table에는 재사용 가능하나 전체 baseline 아님 |
| revisit/ranking/SEC-01/SEC-05 migrations | 각 기능별 후속 schema | 높음 | 해당 시점 이후 delta로만 활용 가능 |
| shadow bootstrap | route dependency 최소 schema, mutation observer, simplified RPC | 높음 | 일반 baseline 불가 |
| shadow seed | synthetic product 5개 | 높음 | test fixture일 뿐 schema 근거 아님 |
| isolated-shadow runbook/review | products base migration/config 부재와 test-only 목적 명시 | 높음 | intent/evidence 문서, executable baseline 아님 |
| application `lib/product-source.js` | products runtime read fields | 중간 | runtime field 존재 기대 근거, CREATE/constraint 근거 아님 |
| `20260526...insert.sql` | 운영 products에 존재한다고 전제한 광범위한 column 목록 | 중간-높음 | 기존 schema 의존 증거, baseline 생성문 아님 |
| manual QA/implementation docs | SQL Editor/Table Editor 수동 확인·적용 언급 | 낮음-중간 | 적용 이력이나 exact schema 증거가 아님 |
| generated Supabase types/schema dump | 발견되지 않음 | 해당 없음 | 활용 불가 |
| local-shadow-test 외 bootstrap/baseline | 발견되지 않음 | 해당 없음 | 활용 불가 |

## 9. 누락된 baseline object

저장소의 production migration 체인을 빈 DB에서 재현하려면 최소 다음 authoritative predecessor가 필요하다.

- `public.products`: 실제 UUID/column/type/constraint/index/RLS/grant 계약
- `public.product_candidates`: 첫 migration 및 ranking pipeline이 전제하는 초기 columns/constraints
- `public.source_rankings`: 첫 view와 ranking migration이 전제하는 초기 columns/constraints
- `public.recommendation_logs`: SEC-05가 ALTER하는 실제 schema/RLS/grants

추가로 products에는 migration에서 생성하지 않고 DML/runtime이 사용하는 `buy_link`, source/import metadata, recommendation metadata, sunscreen fields 등의 기원이 필요하다. 어떤 필드가 remote에서 수동 생성되었는지 또는 누락 migration에서 생성되었는지는 저장소만으로 확정할 수 없다.

## 10. Shadow bootstrap 적합성 판정

**판정: `SHADOW_TEST_STUB_ONLY`**

판정 근거:

1. 파일 자체가 test-only disposable isolated shadow route schema라고 명시한다.
2. production migration 폴더 밖의 별도 Supabase workdir/config/seed다.
3. products는 text ID, text category/product_form과 최소 nullable fields를 사용해 production 타입·constraint와 다르다.
4. product_candidates, source_rankings, recommendation_logs, analysis_results 등 전체 migration replay에 필요한 object가 없다.
5. SEC-01 동명 RPC body가 실제 quota/idempotency 보안 semantics를 구현하지 않고 route를 통과시키는 축약 stub이다.
6. broad products read policy와 synthetic seed는 운영 schema가 아니라 isolated route fixture 목적이다.
7. existing runbook/work log도 production migrations를 변경하지 않은 test-only bootstrap으로 기록한다.

따라서 이 파일을 timestamp-0 production baseline으로 복사하거나 main migration 앞에 삽입하면 migration replay와 SEC-05 검증 모두에서 거짓 PASS를 만들 수 있다.

## 11. 저장소만으로 확인할 수 없는 항목

다음은 실제 DB 없이 확인할 수 없다.

- remote products/product_candidates/source_rankings/recommendation_logs의 exact columns와 types
- PK/FK/check/unique/index, RLS, policies, grants/default privileges
- remote functions/views/triggers 및 실제 signature
- 수동 SQL Editor로 생성된 object와 migration history
- 현재 production/staging migration 적용 순서와 drift
- 운영 `products.id`의 실제 타입과 legacy row 호환성
- SEC-05 migration의 실제 target DB 적용 가능성

향후에는 별도 승인된 read-only schema-only dump 또는 catalog metadata capture가 필요하다. row data, secret, hosted URL은 필요하지 않다.

## 12. SEC-05 Local DB 검증 영향

- main migration 전체 reset은 첫 migration의 products 부재로 차단된다.
- products만 stub으로 추가해도 product_candidates/source_rankings/recommendation_logs 의존성이 이어서 실패한다.
- existing shadow bootstrap에는 SEC-05 grant tables/RPC와 analysis_results/recommendation_logs linkage가 없다.
- shadow의 simplified SEC-01 RPC는 SEC-05 concurrency/privilege test의 predecessor로 신뢰할 수 없다.
- 따라서 현재 shadow workdir에서 SEC-05 RPC 동시성 검증을 수행해도 production migration compatibility를 증명하지 못한다.

## 13. 해결 선택지 비교

| 선택지 | 정확성 | SEC-05 적합성 | 운영 재현성 | 비용 | 위험 | 권장 여부 |
|---|---|---|---|---|---|---|
| A. 전체 운영 baseline 복원 | 높음 | 높음 | 높음 | 높음 | schema dump 정제·민감 metadata 검토 필요 | 장기 권장 |
| B. SEC-05 isolated local test schema | SEC-05 범위에서는 높음 | 높음 | 낮음 | 중간 | 운영 migration 전체 PASS로 오인하면 안 됨 | 단기 권장, 명확히 분리 |
| C. existing local-shadow-test 확장 | 낮음 | 현재는 부적합 | 낮음 | 겉보기에는 낮음 | stub 누적과 false confidence | 비권장 |
| D. remote staging 검증 | 실제 target 정확성 높음 | 높음 | staging 범위 | 중간-높음 | 원격 접근·cleanup·권한 승인 필요 | 별도 승인 이후 보조 수단 |

권장 순서는 다음과 같다.

1. 별도 승인 아래 missing base tables의 schema-only metadata를 read-only로 확보한다.
2. 장기적으로 실제 predecessor를 반영한 timestamp-0 baseline을 복원한다.
3. SEC-05 검증이 급하면 그와 별개인 isolated local test project를 만들되, 운영 migration replay 증거가 아니라 SEC-05 RPC/동시성 증거로만 분류한다.

## 14. 권장 다음 작업

다음 작업은 **missing predecessor schema의 read-only evidence 수집 및 baseline 설계**다.

예상 범위:

- products/product_candidates/source_rankings/recommendation_logs schema-only metadata
- columns/types/defaults/PK/FK/check/unique/index/RLS/policy/grant/function dependency
- row data 제외
- remote write, migration apply, repair 제외
- 확보한 evidence와 current migration chain의 column-level diff
- baseline과 isolated SEC-05 test schema를 서로 다른 artifact로 설계

## 15. 절대 하면 안 되는 임시 조치

- products만 임시 생성해 첫 오류를 숨기기
- shadow bootstrap을 production migrations에 복사
- text ID/category/product_form을 운영 계약으로 승인
- `IF EXISTS`로 실패 statement를 건너뛰기
- migration timestamp 또는 순서 변경
- product_candidates/source_rankings/recommendation_logs를 추측으로 stub 처리
- simplified shadow RPC를 production SEC-01/SEC-05 contract로 간주
- shadow workdir PASS를 production migration replay PASS로 보고

## 16. 결론

제공된 `relation "public.products" does not exist` 오류는 production migration 체인의 첫 파일 270행이 빈 DB에 존재하지 않는 `public.products`를 ALTER하기 때문에 발생한다. production migration 폴더에는 products 생성문이 없으며, product_candidates/source_rankings/recommendation_logs의 초기 생성문도 없다.

`00000000000000_local_shadow_bootstrap.sql`은 일반 baseline이 아니다. 파일 주석, 별도 workdir, synthetic seed, 축약 table/RPC, production type/constraint 불일치가 모두 특정 isolated shadow route 검증용 stub임을 직접 증명한다. 판정은 `SHADOW_TEST_STUB_ONLY`이며 SEC-05 production-equivalent local DB 검증에 그대로 사용할 수 없다.

코드, migration, DB, Docker, Supabase 상태는 변경하지 않았다.
