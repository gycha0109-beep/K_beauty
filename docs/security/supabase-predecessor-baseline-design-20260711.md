# Supabase Predecessor Baseline 설계

## 1. 목적과 기준 시점

목표 기준 시점은 `supabase/migrations/20260410_safe_review_and_promotion_layer.sql` 실행 직전이다. 이번 작업은 linked Supabase project의 현재 `public` schema metadata와 repository migration chronology를 대조해 predecessor baseline 설계 근거를 만들기 위한 진단 단계다.

Baseline SQL은 생성하지 않았다. Current remote schema를 timestamp-0 schema로 복사하지 않았고, row data를 조회하지 않았다.

## 2. Remote 접근 방식

- 기존 `supabase/.temp/project-ref` link metadata만 사용했다.
- project ref 값은 읽거나 기록하지 않았다.
- root `supabase/config.toml`은 현재 repository에 없다.
- 허용된 linked schema-only dump dry-run, linked schema-only dump, linked migration history 조회만 시도했다.
- 새 link, SQL query, RPC, Dashboard, REST, Storage, Auth 접근은 수행하지 않았다.

Supabase CLI는 `2.82.0`이었다. CLI update나 dependency 변경은 하지 않았다.

## 3. 실행한 read-only 명령

| 명령 | 결과 | Remote mutation | 민감 출력 처리 |
|---|---|---|---|
| `supabase db dump --help` | schema/data/role/dry-run flags 확인 | 없음 | 해당 없음 |
| `supabase db dump --linked --schema public --dry-run` | exit 0, `pg_dump` plan과 public schema scope 확인 | 없음 | 내부 connection/credential 전달 구문 원문 미출력 |
| `supabase db dump --linked --schema public --file <OS TEMP path>` | Docker 실행 환경 부재로 실패, 0-byte file만 생성 | 없음 | CLI 원문 미출력 |
| `supabase migration list --linked` | exit 0, 19개 비교 row 확인: 17개 local/remote 정렬, 2개 local-only | 없음 | project/host/credential 원문 미출력 |

실제 schema body는 획득되지 않았다. Dump 실패는 linked/auth dry-run 실패가 아니라 CLI의 일회성 `pg_dump` container 실행 환경 부재였다.

## 4. 실행하지 않은 write 명령

다음은 실행하지 않았다.

- `db push`, `pull`, `reset`, `diff`
- migration new/repair/up/down/squash/fetch
- link/unlink, secrets, functions deploy, start/stop
- SQL Editor, `psql`, SQL/RPC 실행
- INSERT/UPDATE/DELETE/MERGE/TRUNCATE/DDL/GRANT/REVOKE
- schema restore, Docker 직접 명령, local stack 조작
- row count/sample/distinct query, auth/storage data 조회

## 5. Dump 안전성 검사

| 검사 | 결과 |
|---|---|
| Dry-run data-only 여부 | `--data-only`/COPY/INSERT 계획 없음 |
| Dry-run role-only 여부 | role-only 아님 |
| Schema scope | public schema로 제한됨 |
| Mutation command | push/pull/diff/reset/restore 없음 |
| Actual dump file | 0 bytes; schema content 생성 전 실패 |
| COPY/INSERT/value block | file이 비어 있어 존재하지 않음 |
| Auth/storage row data | 조회·생성되지 않음 |
| Credential/host/project ref | 보고서, 로그, Git에 기록하지 않음 |
| Raw dump cleanup | OS TEMP의 0-byte file과 전용 directory 삭제 완료 |

`UNSAFE_DUMP_OUTPUT` 조건은 발생하지 않았다. 다만 schema dump가 생성되지 않았으므로 schema-content 안전성 검사는 완료된 것이 아니라 **대상 없음**이다.

## 6. Remote current schema inventory

Actual schema dump 실패로 필수 네 table의 current remote definition을 확보하지 못했다.

| Object | Current remote definition | Security metadata | Dependency | Raw dump 근거 위치 |
|---|---|---|---|---|
| `public.products` | 미확보 | RLS/policy/grant 미확보 | enum/sequence/function/FK 미확보 | 없음; dump 0 bytes 후 삭제 |
| `public.product_candidates` | 미확보 | RLS/policy/grant 미확보 | products/source rankings/functions 미확보 | 없음 |
| `public.source_rankings` | 미확보 | RLS/policy/grant 미확보 | candidates/ranking snapshots 미확보 | 없음 |
| `public.recommendation_logs` | 미확보 | RLS/policy/grant 미확보 | auth user/grant-use dependency 미확보 | 없음 |

따라서 current columns, ordinal position, exact type/default/nullability, constraints, indexes, triggers, policies, grants를 remote 사실로 단정하지 않는다.

## 7. Repository migration chronology

Linked migration history 비교에서 다음 17개 version은 local/remote 양쪽에 정렬돼 있었다.

`20260506070849`, `20260506092454`, `20260520170737`, `20260524054039`, `20260524054049`, `20260531123349`, `20260613025816`, `20260613030023`, `20260620212309`, `20260620214740`, `20260621030000`, `20260621151304`, `20260621152040`, `20260621155819`, `20260621160633`, `20260622180503`, `20260627224615`.

다음 두 version은 local-only였고 remote history에는 없었다.

- `20260704221747` (SEC-01)
- `20260711032649` (SEC-05)

Remote-only version은 없었다.

Repository의 24개 파일 중 아래 다섯 비표준 filename prefix는 remote history 출력에 나타나지 않았다.

- `20260410_safe_review_and_promotion_layer.sql`
- `20260424_align_analysis_results_share_schema.sql`
- `20260430_add_products_signal_columns.sql`
- `20260507_restrict_promote_product_candidate_execute.sql`
- `20260526_moisturizer_lotion_emulsion_insert.sql`

이 파일들이 수동 적용됐는지, CLI history 밖에서 실행됐는지, 일부만 적용됐는지는 현재 evidence로 확정할 수 없다.

| Migration | Object | Operation | Before state requirement | After state | Idempotent 여부 | Baseline 영향 |
|---|---|---|---|---|---|---|
| `20260410...` | products | ADD normalized fields; type/nullability/check 변경; backfill; unique index | products와 core columns 존재 | normalized/type/check contract | 부분적 | predecessor 핵심 |
| `20260410...` | product_candidates | 다수 column/FK/index 추가, backfill, promotion RPC/view | candidate base columns와 source_rankings 존재 | review/promotion layer | 부분적 | predecessor 핵심 |
| `20260410...` | source_rankings | evidence view에서 read | source/brand/product/rank/date columns 존재 | view dependency | 아님 | predecessor 핵심 |
| `20260424...` | 네 대상 외 | analysis requests/results CREATE | pgcrypto | analysis schema | 부분적 | baseline 제외 |
| `20260430...` | products | signal JSON columns ADD | products 존재 | 3 signal columns | 예 | 해당 columns baseline 제외 |
| `20260506070849...` | 네 대상 외 | premium sessions CREATE | pgcrypto | premium session | 부분적 | baseline 제외 |
| `20260506092454...` | 네 대상 외 | DB timezone ALTER | database 존재 | timezone | 아님 | baseline object 아님 |
| `20260507...` | promotion function | execute revoke/grant | 20260410 function 존재 | service-role-only execute | 부분적 | function/ACL baseline 제외 |
| `20260520170737...` | 네 대상 외 | revisit tables/RLS CREATE | auth.users | revisit schema | 부분적 | baseline 제외 |
| `20260524054039...` | product_category | enum values ADD | tracked enum 존재 | moisturizer variants | 예 | values baseline 제외 |
| `20260524054049...` | products | category backfill | products/category/mapper | reclassification | DML 비멱등 의미 | initial values 필요 여부 불확실 |
| `20260526...` | products | 15 rows INSERT/ON CONFLICT | 광범위한 product columns/unique conflict target 존재 | seed-like operational rows | DML 포함 | row data baseline 제외; hidden columns provenance 불확실 |
| `20260531123349...` | 네 대상 외 | revisit policies replace | revisit tables/auth JWT | anonymous restriction | 부분적 | baseline 제외 |
| `20260613025816...` | products/type | treatment enum/product_form ADD | products + category enum | product_form column | 부분적 | product_form baseline 제외 |
| `20260613030023...` | products | category/product form backfill | prior type/column | treatment normalization | DML | baseline row data 제외 |
| `20260620212309...` | product_candidates/products | candidate product_form ADD; promotion RPC replace | candidates/products + product_form | promotion contract | 부분적 | added column/function 제외 |
| `20260620214740...` | mapping function | fail-closed replace | tracked type/helper | strict mapper | 예 | function baseline 제외 |
| `20260621030000...` | source_rankings | snapshot/candidate/raw columns ADD, indexes/ACL | source rankings base + candidates | ranking linkage | 부분적 | added columns/index/ACL 제외 |
| `20260621030000...` | product_candidates | external/seen/source columns ADD, index/ACL/backfill | candidate base columns | ranking ingest contract | 부분적 | added components 제외 |
| `20260621151304...` | candidates/source rankings | ingest RPC repair | prior ranking schema | repaired RPC | function replace | baseline 제외 |
| `20260621152040...` | ranking snapshot | truncate revoke | prior table | tighter ACL | 예 | baseline 제외 |
| `20260621155819...` | candidates/source rankings/products | review queue/view/RPC references | ranking/product base | phase 2 queue | 부분적 | created queue objects 제외 |
| `20260621160633...` | ranking snapshot | context repair/backfill | prior table/function | corrected context | DML/function | baseline 제외 |
| `20260622180503...` | candidates/source rankings/products | view/RPC replace; DML guard | full ranking schema | review repair | function replace | baseline 제외 |
| `20260627224615...` | candidates/source rankings/products | view/RPC policy replace | full ranking schema | ranking review v2 | function replace | baseline 제외 |
| `20260704221747...` | 네 대상 외 | SEC-01 tables/RPC/RLS/ACL CREATE | pgcrypto/platform roles | request guard | 부분적 | baseline 제외 |
| `20260711032649...` | recommendation_logs | grant-use FK column + unique index | recommendation_logs table 존재 | SEC-05 linkage | 예 | entire predecessor table required; added linkage 제외 |
| `20260711032649...` | 네 대상 외/analysis_results | SEC-05 tables/RPC/RLS/ACL, result linkage | analysis_results 존재 | v2 grants | 부분적 | SEC-05 objects baseline 제외 |

## 8. Products predecessor schema

Repository가 직접 증명하는 첫 migration 직전 요구사항은 다음과 같다.

### BASELINE_REQUIRED로 확인되는 identifiers

- table `public.products`
- columns referenced before being added: `id`, `name`, `brand`, `category`, `texture`, `finish`, `skin_types`, `concerns`, `irritation_risk`, `sensitivity_safe`, `created_at`, `price_min`, `price_max`, `buy_link`, `image_url`
- `id`는 candidate FK와 promotion RPC의 UUID 변수/parameter에 호환돼야 한다.
- promotion INSERT가 `id`를 생략하므로 server-generated default가 필요했을 가능성이 매우 높다.

### CREATED_BY_TRACKED_MIGRATION

- `normalized_name`, `normalized_brand`, `updated_at`
- normalized brand/name unique index
- irritation/skin-types/concerns checks
- category/texture/finish enum conversion과 NOT NULL 변경
- `review_signals`, `market_signals`, `ingredient_signals`
- `product_form`
- later category enum values

### UNCERTAIN

- predecessor exact type/default/nullability/collation/identity for every base column
- predecessor PK name/expression and `id` default (`gen_random_uuid()` 여부 포함)
- `category`, `texture`, `finish`, arrays의 conversion 이전 exact type
- `buy_link`, price/image fields의 constraints/indexes
- `is_mens`, `recommendation_tier`, `size_ml`, `unit_price_per_10ml`, `hwahae_url`, `external_source/type/id`, `source_url`의 생성 시점
- runtime sunscreen fields와 source metadata의 provenance
- predecessor RLS/policy/grants/triggers

Exact remote metadata가 없으므로 Products baseline SQL을 작성할 수 없다.

## 9. Product candidates predecessor schema

### BASELINE_REQUIRED로 확인되는 identifiers

- table `public.product_candidates`
- first migration view/index/RPC가 요구하는 `id`, `source_name`, `category_path`, `normalized_brand`, `normalized_name`, `created_at`
- later ingest INSERT가 사용하지만 tracked ADD가 없는 `raw_name`, `raw_brand`, `status`, `raw_payload`
- `id`는 UUID parameter/FK와 호환돼야 한다.

### CREATED_BY_TRACKED_MIGRATION

- service category, canonical name/brand, match/duplicate IDs
- review status/notes/actor/timestamps/flags/promotion payload/version
- candidate `product_form`
- external type/id/source URL, first/last seen, seen count, latest price/raw source
- tracked indexes, checks, grants/revokes

### UNCERTAIN

Base columns의 exact type/default/nullability, PK/sequence, legacy `status` contract, constraints, indexes, RLS/policies/grants가 모두 미확정이다.

## 10. Source rankings predecessor schema

### BASELINE_REQUIRED로 확인되는 identifiers

- table `public.source_rankings`
- first evidence view가 요구하는 `id`, `source_name`, `category_path`, `brand_name`, `product_name`, `collected_at`, `rank_position`
- later ingest INSERT가 사용하지만 tracked ADD가 없는 `price_text`, `product_url`, `raw_payload`

### CREATED_BY_TRACKED_MIGRATION

- `snapshot_id`, `candidate_id`, `raw_item`
- snapshot/rank/candidate indexes
- service-role grants와 anon/authenticated write revoke

### UNCERTAIN

모든 predecessor column의 exact type/default/nullability, PK/FK/check/index, RLS/policy/grants가 미확정이다.

## 11. Recommendation logs predecessor schema

Repository migration에는 table CREATE가 없다. SEC-05는 다음만 추가한다.

- nullable `anonymous_write_grant_use_id uuid`
- `anonymous_write_grant_uses(id) ON DELETE SET NULL` FK
- non-null row에 대한 partial unique index

Current route는 predecessor에서 최소 `id`, `event_name`, `timestamp`, `session_id`, `product_id`, `feature_name`, `result_type`, `question_id`, `answer`, `is_top_pick`, `meta_json`, `user_id`를 기대한다.

이 목록은 application contract 근거일 뿐 current remote DDL 근거가 아니다. Exact type/default/nullability/PK/FK/RLS/policy/grant/index 및 table 생성 시점은 모두 `UNCERTAIN`이다.

## 12. Type·sequence·function dependency

| Dependency | Classification | Baseline 처리 |
|---|---|---|
| `product_category`, `product_texture`, `product_finish`, `product_review_status` | tracked first migration이 조건부 생성 | 기본적으로 baseline 제외; preexistence 여부는 remote metadata 필요 |
| `product_form` | tracked 20260613 생성 | baseline 제외 |
| `pgcrypto` | later tracked migrations가 생성하지만 products predecessor UUID default에 필요했을 수 있음 | exact default 확인 전 결정 불가 |
| products/candidates PK sequence/default | remote dump 부재 | 결정 불가 |
| normalization/map/promotion functions | tracked migrations가 생성/교체 | baseline 제외 |
| source/candidate trigger functions | current remote metadata 부재 | provenance 확인 전 제외 |

## 13. RLS·policy·grant predecessor 상태

Remote dump가 없으므로 네 table의 current RLS/FORCE RLS, policy, table/sequence/function grants를 확보하지 못했다. Current state를 predecessor에 복사하지 않는다.

Tracked chronology가 명시하는 later ACL만 baseline에서 제외할 수 있다.

- product candidate/source ranking ranking-pipeline grants/revokes
- SEC-05 grant table/RPC ACL
- SEC-05 linkage index/FK

Products와 recommendation logs의 predecessor security contract는 baseline replay 정확성과 보안에 직접 영향을 주므로 추측할 수 없다.

## 14. Current schema를 그대로 baseline으로 사용할 수 없는 이유

Actual current dump는 없지만 tracked migrations만으로도 current-state baseline 복사가 잘못임을 확인할 수 있다.

- first migration이 생성하는 enums/functions/index/check가 이미 존재해 provenance가 뒤섞인다.
- normalized/signal/product_form/ranking/SEC-01/SEC-05 columns가 선행 생성된다.
- backfill과 type conversion이 이미 완료된 state에서 다시 실행돼 역사적 의미가 사라진다.
- current policies/grants를 선행 적용하면 privilege tightening chronology가 왜곡된다.
- SEC-01/SEC-05는 현재 history상 local-only다. Current remote dump에 수동 생성 흔적이 있는지 확인하지 못했으므로 baseline에 선행 포함하면 안 된다.
- ranking snapshot/review queue/functions/views가 중복된다.
- 비표준 filename 다섯 개의 remote 적용 여부를 숨겨 false-positive replay PASS를 만들 수 있다.

## 15. Predecessor classification matrix

| Object component | Current remote state | First tracked operation | Predecessor classification | Baseline state | Confidence | Evidence |
|---|---|---|---|---|---|---|
| products table | 미확보 | ALTER | BASELINE_REQUIRED | create 필요, exact DDL 미확정 | 높음/구조 낮음 | migration 270행 |
| products core columns | 미확보 | UPDATE/ALTER/RPC use | BASELINE_REQUIRED 또는 MODIFIED | identifier만 확인, old type/default 미확정 | 중간 | 20260410 |
| products normalized fields | 미확보 | ADD | CREATED_BY_TRACKED_MIGRATION | 제외 | 높음 | 20260410 |
| products signal fields | 미확보 | ADD | CREATED_BY_TRACKED_MIGRATION | 제외 | 높음 | 20260430 |
| products product_form | 미확보 | ADD | CREATED_BY_TRACKED_MIGRATION | 제외 | 높음 | 20260613 |
| product_candidates table/base | 미확보 | ALTER | BASELINE_REQUIRED | create 필요, exact DDL 미확정 | 높음/구조 낮음 | 20260410 |
| candidate review/promotion columns | 미확보 | ADD | CREATED_BY_TRACKED_MIGRATION | 제외 | 높음 | 20260410 |
| candidate ranking columns | 미확보 | ADD | CREATED_BY_TRACKED_MIGRATION | 제외 | 높음 | 20260621 |
| source_rankings table/base | 미확보 | SELECT/view then ALTER | BASELINE_REQUIRED | create 필요, exact DDL 미확정 | 높음/구조 낮음 | 20260410/20260621 |
| source ranking linkage columns | 미확보 | ADD | CREATED_BY_TRACKED_MIGRATION | 제외 | 높음 | 20260621 |
| recommendation_logs table/base | 미확보 | ALTER in SEC-05 | BASELINE_REQUIRED for full replay, historical timing UNCERTAIN | exact DDL 미확정 | 중간 | SEC-05 + route |
| recommendation grant-use linkage | 미확보 | ADD/FK/index | CREATED_BY_TRACKED_MIGRATION | 제외 | 높음 | SEC-05 |
| predecessor PK/FK/check/index | 미확보 | mixed | UNCERTAIN | remote metadata 필요 | 낮음 | dump 실패 |
| predecessor RLS/policies/grants | 미확보 | mixed | UNCERTAIN | remote metadata 필요 | 낮음 | dump 실패 |

`REMOVED_BY_TRACKED_MIGRATION`으로 확정되는 column은 repository SQL에서 발견되지 않았다. 그러나 비표준 migration 적용/history와 current remote DDL을 대조하지 못했으므로 삭제·rename 부재를 remote 사실로 확정할 수는 없다.

## 16. Baseline 포함 object

현재 evidence로 **포함 필요성만** 확정되는 object는 다음 네 table이다.

| Baseline object | 포함 여부 | 필요한 초기 상태 | 후속 migration과의 관계 | 근거 | 불확실성 |
|---|---|---|---|---|---|
| products | 필요 | tracked ADD 이전 core columns | first migration ALTER/backfill target | direct SQL | exact DDL/security 미확정 |
| product_candidates | 필요 | first view/RPC/index가 요구하는 base | first/ranking migration ALTER target | direct SQL | exact DDL/security 미확정 |
| source_rankings | 필요 | first evidence view와 ranking ingest base | ranking migration ALTER target | direct SQL | exact DDL/security 미확정 |
| recommendation_logs | full replay에는 필요 | SEC-05 전 predecessor | SEC-05 ALTER target | migration + route | 생성 시점/exact DDL 미확정 |

이 표는 baseline migration 작성 승인이 아니다. Exact schema 미확보 때문에 구현 Gate를 통과하지 못한다.

## 17. Baseline 제외 object

- tracked migration이 생성하는 product enums와 functions
- normalized/signal/product_form/ranking linkage columns
- analysis requests/results, premium/revisit/ranking/review queue tables
- SEC-01/SEC-05 tables, RPC, indexes, policies, grants
- candidate review/promotion/ranking columns와 indexes
- product seed rows와 recommendation event rows
- Auth/Storage managed objects
- shadow schema, synthetic seed, audit triggers, simplified RPC
- provenance가 확인되지 않은 current-only fields/indexes/policies

## 18. Exact object creation order

Exact DDL은 아직 작성할 수 없다. 다음 구현 단계의 순서 계약만 고정한다.

1. Remote metadata에서 실제 predecessor default가 요구하는 extension/domain/sequence 확인
2. Tracked migration이 만들지 않는 predecessor types/domains만 생성
3. Products와 PK/default 생성
4. Product candidates 생성
5. Source rankings 생성 및 predecessor FK 연결
6. Recommendation logs의 역사적 생성 시점이 t0인지 별도 확인 후 배치
7. Predecessor check/unique/index 생성
8. Predecessor trigger/function dependency 생성
9. Predecessor RLS/FORCE RLS/policies 적용
10. Exact predecessor grants/revokes 적용
11. 이후 repository migration을 filename chronology대로 replay

Identifier, expression, FK action, index predicate, policy expression은 remote dump 확보 전 채우지 않는다.

## 19. Migration replay 충돌 분석

| Migration | Current-state baseline 사용 시 충돌 | Severity | Baseline에서 제외/복원할 항목 |
|---|---|---|---|
| 20260410 | enum/function/index/check/type conversion 중복 및 backfill 무의미 | High | tracked components 제외, old column types 복원 |
| 20260430 | signal columns 선행 존재 | Medium | 3 signal columns 제외 |
| 20260524-20260613 | enum values/product_form 선행 존재 | High | later enum values/product_form 제외 |
| 20260620-20260627 | candidate/ranking columns/index/view/RPC 선행 존재 | High | tracked ranking/promotion components 제외 |
| 20260704 | history상 local-only; baseline에 선행 포함하면 pending migration 의미 상실 | High | SEC-01 전체 제외; manual drift는 dump로 확인 |
| 20260711 | history상 local-only; baseline에 선행 포함하면 pending migration 의미 상실 | High | SEC-05 전체 제외; manual drift는 dump로 확인 |
| 비표준 5개 파일 | remote history에 없어서 적용 여부를 current DDL로만 역증명해야 함 | High | exact current dump와 normalized SQL 대조 필요 |

## 20. 확인된 불확실성

1. 네 remote table의 current exact DDL 전체
2. predecessor exact column type/default/nullability/collation/identity/generated state
3. PK/FK/check/unique/index 및 constraint names/actions
4. products/candidates sequence/default와 pgcrypto dependency
5. predecessor RLS/FORCE RLS/policy/grants
6. trigger/function/view/materialized view/publication dependencies
7. 비표준 migration 다섯 개의 실제 적용 방식과 시점
8. recommendation_logs가 첫 migration 이전부터 존재했는지 여부
9. tracked SQL에 없는 source/sunscreen/recommendation columns의 provenance
10. remote current state와 repository HEAD 사이 drift

이 항목들은 baseline replay 의미에 직접 영향을 주므로 선택적 개선이 아니다.

## 21. SEC-05 Local DB 검증 영향

SEC-05 RPC 자체의 isolated test schema를 별도 설계하는 것은 가능하지만, 현재 evidence로 production predecessor baseline을 만들 수는 없다. 특히 recommendation logs exact DDL과 predecessor ACL/RLS가 없어 SEC-05 migration apply compatibility를 증명할 수 없다.

따라서 SEC-05 Local DB 검증은 다음 중 하나가 선행돼야 한다.

- Docker/pg_dump가 가능한 안전한 local toolchain에서 동일 linked schema-only dump 재실행
- 별도 승인된 schema-only metadata 취득 수단

## 22. Baseline 구현 Gate

**`BLOCKED_BY_SCHEMA_UNCERTAINTY`**

판정 이유:

- linked/auth dry-run과 migration history 조회는 성공했다.
- actual schema dump는 Docker 환경 부재로 생성되지 않았다.
- 필수 predecessor table의 exact type/default/constraint/index/security metadata를 확보하지 못했다.
- baseline을 작성하면 추측이 필요하고 migration replay 의미가 달라질 수 있다.

`NEEDS_USER_LOCAL_AUTH_CONFIGURATION`은 선택하지 않았다. 기존 link와 dry-run, migration history 조회가 성공해 인증 자체가 확인됐기 때문이다.

## 23. 권장 다음 작업

Docker daemon과 CLI가 사용 가능한 안전한 workstation에서 같은 linked project를 대상으로 다음 하나만 수행한다.

**`public` schema-only dump 재취득 후 네 table metadata를 현재 문서의 classification matrix에 채우는 read-only 후속 작업.**

Password를 command argument나 문서에 노출하지 말고, raw dump는 OS TEMP에서 분석 후 삭제해야 한다. Baseline migration 생성은 그 후 별도 작업이다.

## 24. 결론

Linked migration history 비교 19개 row는 확보했다. 이 중 17개는 local/remote 정렬, SEC-01과 SEC-05 두 개는 local-only였지만 actual schema body는 확보하지 못했다. Repository chronology로 네 predecessor table의 존재 필요성과 tracked migration이 추가한 components는 구분했으나, exact predecessor DDL과 security metadata는 복원할 수 없다.

Current schema를 baseline으로 복사하지 않았고, baseline SQL도 생성하지 않았다. Row data와 credential은 조회·기록하지 않았으며 remote write는 없었다. 내부 재검토 종료 조건은 **C: 외부 schema metadata 없이는 해결할 수 없는 uncertainty만 남음**이다.

## Safe Schema Dump 재수집 결과

기존 실패 이력은 유지한다. 후속으로 `C:\Users\hun\AppData\Local\Temp\kbeauty-public-schema-only-20260711.sql`에서 108,250-byte public schema-only dump를 제공받았고, 이번 단계에서는 이 저장 파일과 repository만 읽었다. Supabase, Docker, PostgreSQL, remote endpoint에는 다시 접근하지 않았다.

Dump에는 네 대상 table의 current `CREATE TABLE`과 분리된 PK/FK/index/RLS/policy/grant/trigger DDL이 모두 존재했다. SEC-01과 SEC-05 object는 dump에 없으며, 이전 linked history에서 두 migration이 local-only였던 결과와 일치한다.

## Dump 안전성 확정

**`SAFE_SCHEMA_DUMP`**

| 검사 | 결과 |
|---|---|
| 파일 | 존재, 108,250 bytes, repository 밖 TEMP, read 가능 |
| 행 시작 `COPY` | 0 |
| 행 시작 `INSERT INTO` | 0 |
| `COPY ... FROM stdin` | 0 |
| `pg_catalog.setval` | 0 |
| data-only section marker | 0 |
| 들여쓰기된 `INSERT INTO` | 5; 모두 PL/pgSQL 함수 body 내부 |
| credential/connection/JWT pattern | 0 |
| `service_role` | PostgreSQL role 및 GRANT identifier만 존재 |

Row data와 credential은 발견되지 않았다. Raw dump 전체나 function body 전체를 repository 문서로 복사하지 않았다.

Component 단위 근거 반영과 내부 재검토를 마친 뒤 지정된 TEMP dump를 삭제했고, 같은 경로가 더 이상 존재하지 않음을 확인했다. Repository에는 raw dump 사본을 만들지 않았다.

## Actual Current DDL Inventory

다음 inventory는 dump의 current state다. Predecessor state와 동일하다고 간주하지 않는다. 네 table 모두 explicit identity/generated/collation/sequence column은 없고 UUID PK default는 `gen_random_uuid()`다. Dump에는 FORCE RLS 문이 없다.

### `public.products`

| # | Column | Exact current definition |
|---:|---|---|
| 1 | `id` | `uuid DEFAULT gen_random_uuid() NOT NULL` |
| 2 | `name` | `text NULL` |
| 3 | `brand` | `text NULL` |
| 4 | `category` | `public.product_category NOT NULL` |
| 5 | `price_min` | `integer NULL` |
| 6 | `price_max` | `integer NULL` |
| 7 | `buy_link` | `text NULL` |
| 8 | `image_url` | `text NULL` |
| 9 | `created_at` | `timestamptz DEFAULT now() NULL` |
| 10 | `skin_types` | `text[] NOT NULL` |
| 11 | `concerns` | `text[] NOT NULL` |
| 12 | `texture` | `public.product_texture NOT NULL` |
| 13 | `finish` | `public.product_finish NOT NULL` |
| 14 | `irritation_risk` | `text NOT NULL` |
| 15 | `sensitivity_safe` | `boolean NOT NULL` |
| 16 | `normalized_name` | `text NOT NULL` |
| 17 | `normalized_brand` | `text NOT NULL` |
| 18 | `updated_at` | `timestamptz DEFAULT now() NOT NULL` |
| 19 | `is_mens` | `boolean DEFAULT false NOT NULL` |
| 20 | `recommendation_tier` | `text NULL` |
| 21 | `size_ml` | `numeric NULL` |
| 22 | `unit_price_per_10ml` | `numeric NULL` |
| 23 | `cleansing_profile` | `text NULL` |
| 24 | `uv_filter_type` | `text NULL` |
| 25 | `spf_value` | `text NULL` |
| 26 | `uva_label` | `text NULL` |
| 27 | `water_resistant_minutes` | `integer NULL` |
| 28 | `white_cast` | `text NULL` |
| 29 | `eye_sting` | `text NULL` |
| 30 | `pilling_risk` | `text NULL` |
| 31 | `tone_up` | `boolean NULL` |
| 32 | `review_signals` | `jsonb DEFAULT '{}'::jsonb NULL` |
| 33 | `hwahae_url` | `text NULL` |
| 34 | `market_signals` | `jsonb DEFAULT '{}'::jsonb NULL` |
| 35 | `ingredient_signals` | `jsonb DEFAULT '{}'::jsonb NULL` |
| 36 | `external_source` | `text NULL` |
| 37 | `external_type` | `text NULL` |
| 38 | `external_id` | `text NULL` |
| 39 | `source_url` | `text NULL` |
| 40 | `balm_functional_tags` | `text[] NULL` |
| 41 | `balm_usage_scope` | `text NULL` |
| 42 | `balm_type` | `text NULL` |
| 43 | `is_primary_moisturizer` | `boolean NULL` |
| 44 | `balm_caution_tags` | `text[] NULL` |
| 45 | `balm_research_confidence` | `text NULL` |
| 46 | `product_form` | `public.product_form NULL` |

Current constraints/index/security:

- PK: `products_pkey (id)`; not deferrable, initially immediate.
- Checks: cleansing profile; concerns allowed; eye sting; irritation risk; pilling risk; skin types allowed; UV filter type; white cast.
- Unique indexes: `products_external_unique (external_source, external_type, external_id)` with all-three-non-null predicate; `products_normalized_brand_name_key (normalized_brand, normalized_name)`.
- Trigger: `trg_products_updated_at` before update -> `public.set_updated_at()`.
- Comment: `products.product_form` treatment sub-form 설명; tracked 20260613 provenance.
- RLS enabled, FORCE RLS absent.
- Policy: `Public can read products`, SELECT, roles `authenticated`,`anon`, `USING (true)`.
- Grants: service_role ALL; anon/authenticated SELECT.

### `public.product_candidates`

| # | Column | Exact current definition |
|---:|---|---|
| 1 | `id` | `uuid DEFAULT gen_random_uuid() NOT NULL` |
| 2 | `source_name` | `text NOT NULL` |
| 3 | `category_path` | `text NULL` |
| 4 | `product_name_raw` | `text NOT NULL` |
| 5 | `brand_name_raw` | `text NULL` |
| 6 | `normalized_name` | `text NULL` |
| 7 | `normalized_brand` | `text NULL` |
| 8 | `matched_product_id` | `uuid NULL` |
| 9 | `status` | `text DEFAULT 'new'::text NOT NULL` |
| 10 | `created_at` | `timestamptz DEFAULT now() NOT NULL` |
| 11 | `updated_at` | `timestamptz DEFAULT now() NOT NULL` |
| 12 | `service_category` | `public.product_category NULL` |
| 13 | `canonical_name` | `text NULL` |
| 14 | `canonical_brand` | `text NULL` |
| 15 | `duplicate_of_product_id` | `uuid NULL` |
| 16 | `review_status` | `public.product_review_status DEFAULT 'new'::public.product_review_status NOT NULL` |
| 17 | `review_notes` | `text NULL` |
| 18 | `reviewed_at` | `timestamptz NULL` |
| 19 | `reviewed_by` | `text NULL` |
| 20 | `promotion_payload` | `jsonb NULL` |
| 21 | `match_method` | `text NULL` |
| 22 | `match_confidence` | `numeric NULL` |
| 23 | `review_flags` | `text[] NULL` |
| 24 | `promotion_version` | `text DEFAULT 'v1'::text NULL` |
| 25 | `product_form` | `public.product_form NULL` |
| 26 | `external_type` | `text NULL` |
| 27 | `external_id` | `text NULL` |
| 28 | `source_url` | `text NULL` |
| 29 | `first_seen_at` | `timestamptz DEFAULT now() NULL` |
| 30 | `last_seen_at` | `timestamptz DEFAULT now() NULL` |
| 31 | `seen_count` | `integer DEFAULT 0 NOT NULL` |
| 32 | `latest_price` | `numeric NULL` |
| 33 | `latest_raw_source` | `jsonb NULL` |

- PK: `product_candidates_pkey (id)`.
- Checks: `status IN ('new','matched','ignored')`; `seen_count >= 0`.
- FKs: duplicate ID -> products, NO ACTION; matched ID -> products, ON DELETE SET NULL.
- Indexes: normalized brand/name; review status+created desc; service category+review status; partial unique source/external identity; source+normalized identity.
- Trigger: `trg_product_candidates_updated_at` -> `public.set_updated_at()`.
- Comments: `product_form`, `external_id`, source-normalized-name index 설명; 모두 해당 tracked product-form/ranking component에 종속.
- RLS enabled, FORCE RLS absent, no policy in dump; service_role ALL only.

### `public.source_rankings`

| # | Column | Exact current definition |
|---:|---|---|
| 1 | `id` | `uuid DEFAULT gen_random_uuid() NOT NULL` |
| 2 | `source_name` | `text NOT NULL` |
| 3 | `category_path` | `text NOT NULL` |
| 4 | `rank_position` | `integer NOT NULL` |
| 5 | `product_name` | `text NOT NULL` |
| 6 | `brand_name` | `text NULL` |
| 7 | `rating` | `numeric(3,2) NULL` |
| 8 | `review_count` | `integer NULL` |
| 9 | `thumbnail_url` | `text NULL` |
| 10 | `source_url` | `text NULL` |
| 11 | `collected_at` | `timestamptz DEFAULT now() NOT NULL` |
| 12 | `snapshot_id` | `uuid NULL` |
| 13 | `candidate_id` | `uuid NULL` |
| 14 | `raw_item` | `jsonb NULL` |

- PK: `source_rankings_pkey (id)`.
- FKs: candidate -> product_candidates, snapshot -> ranking_snapshots; default NO ACTION.
- Indexes: candidate; snapshot; partial unique snapshot/candidate; partial unique snapshot/rank position.
- RLS enabled, FORCE RLS absent, no policy; service_role ALL only.

### `public.recommendation_logs`

| # | Column | Exact current definition |
|---:|---|---|
| 1 | `id` | `uuid DEFAULT gen_random_uuid() NOT NULL` |
| 2 | `event_name` | `text NOT NULL` |
| 3 | `timestamp` | `timestamptz DEFAULT now() NOT NULL` |
| 4 | `product_id` | `text NULL` |
| 5 | `is_top_pick` | `boolean DEFAULT false NOT NULL` |
| 6 | `question_id` | `text NULL` |
| 7 | `answer` | `text NULL` |
| 8 | `session_id` | `text NULL` |
| 9 | `feature_name` | `text NULL` |
| 10 | `result_type` | `text NULL` |
| 11 | `meta_json` | `jsonb DEFAULT '{}'::jsonb NULL` |
| 12 | `user_id` | `uuid NULL` |

- PK: `recommendation_logs_pkey (id)`.
- FK: user -> `auth.users(id)`, ON DELETE SET NULL, ON UPDATE NO ACTION.
- Indexes: event name; product ID; timestamp DESC; user ID+timestamp DESC.
- RLS enabled, FORCE RLS absent, no policy; service_role ALL only.
- SEC-05 grant-use column/FK/unique index는 current dump에 없다.

## Products Component Provenance

| Component | First tracked operation | Classification | Predecessor/baseline decision |
|---|---|---|---|
| table, id, name, brand, price, buy/image, created_at, sensitivity | first migration reads/writes | BASELINE_REQUIRED | current exact definition을 후보 predecessor로 사용 |
| category/texture/finish | 20260410 type conversion | MODIFIED_BY_TRACKED_MIGRATION | predecessor exact type가 current dump에서 복원되지 않음 |
| skin_types/concerns | 20260410 `USING map_*(column::text)` | MODIFIED_BY_TRACKED_MIGRATION | current array는 post-state; predecessor representation 불확실 |
| irritation_risk | 20260410 text conversion/check | MODIFIED_BY_TRACKED_MIGRATION | predecessor exact type 불확실 |
| normalized fields, updated_at | 20260410 ADD IF NOT EXISTS/backfill | CREATED_BY_TRACKED_MIGRATION 또는 preexisting | minimal baseline 제외; historical provenance 불확실 |
| normalized unique, irritation/skin/concern checks | 20260410 drop/create/index | CREATED_BY_TRACKED_MIGRATION | baseline 제외 |
| three signal columns | 20260430 ADD | CREATED_BY_TRACKED_MIGRATION | baseline 제외 |
| product_form | 20260613 ADD | CREATED_BY_TRACKED_MIGRATION | baseline 제외 |
| is_mens/tier/size/hwahae/external/source fields | 20260526 DML requires, ADD migration 없음 | REMOTE_UNTRACKED_CURRENT_STATE | full replay에는 선행 필요; t0 시점 불확실 |
| products_external_unique | tracked CREATE/use 없음 | REMOTE_UNTRACKED_CURRENT_STATE | current exact index지만 t0 baseline 근거 없음 |
| cleansing/sunscreen/balm fields/checks | tracked SQL 참조 없음 | REMOTE_UNTRACKED_CURRENT_STATE | t0 baseline 제외 후보; 별도 provenance 필요 |
| RLS/policy/grants, update trigger | tracked products DDL 없음 | REMOTE_UNTRACKED_CURRENT_STATE | current exact state 확인, t0 시점 불확실 |

Current concerns check는 10개 값을 허용하지만 20260410 tracked expression은 7개만 허용하므로 tracked 이후 별도 변경된 remote-untracked state다.

## Product Candidates Component Provenance

| Component | Classification | Predecessor state |
|---|---|---|
| table, base identity/raw/status/timestamps | BASELINE_REQUIRED | current base definitions 후보 |
| PK, status check | BASELINE_REQUIRED 또는 REMOTE_UNTRACKED_CURRENT_STATE | tracked 생성 없음; baseline 포함 후보 |
| service/canonical/match/review/promotion columns | CREATED_BY_TRACKED_MIGRATION 또는 preexisting | ADD IF NOT EXISTS로 historical exactness 불확실; minimal baseline 제외 |
| product_form | CREATED_BY_TRACKED_MIGRATION | baseline 제외 |
| external/seen/source/latest columns와 check/index | CREATED_BY_TRACKED_MIGRATION | baseline 제외 |
| matched FK ON DELETE SET NULL | REMOTE_UNTRACKED_CURRENT_STATE | 20260410 tracked FK는 NO ACTION이므로 별도 변경 |
| RLS/service_role ALL/update trigger | REMOTE_UNTRACKED_CURRENT_STATE | current exact state 확인, t0 시점 불확실 |

## Source Rankings Component Provenance

`20260621030000_phase1_ranking_snapshot_pipeline.sql`은 table을 생성하지 않고 기존 `source_rankings`에 세 column과 indexes/FKs를 추가한다. 따라서 table 자체는 baseline 포함 대상이다.

| Component | Classification | Predecessor state |
|---|---|---|
| first 11 columns | BASELINE_REQUIRED | current exact definitions |
| PK | BASELINE_REQUIRED | `source_rankings_pkey (id)` |
| snapshot_id/candidate_id/raw_item | CREATED_BY_TRACKED_MIGRATION | baseline 제외 |
| linkage indexes/FKs | CREATED_BY_TRACKED_MIGRATION | baseline 제외 |
| RLS/service_role ALL | REMOTE_UNTRACKED_CURRENT_STATE | tracked RLS enable 없음; t0 provenance 불확실 |

## Recommendation Logs Component Provenance

SEC-05는 local-only이고 current dump에는 grant-use linkage가 없다. 따라서 dump는 exact **SEC-05 이전 current state**다.

| Component | Classification | Predecessor state |
|---|---|---|
| 12 columns | BASELINE_REQUIRED for full replay | current exact definitions |
| PK/auth FK/four indexes | BASELINE_REQUIRED 또는 REMOTE_UNTRACKED_CURRENT_STATE | tracked CREATE 없음; baseline 포함 후보 |
| RLS/service_role ALL/no policy | BASELINE_REQUIRED 또는 REMOTE_UNTRACKED_CURRENT_STATE | exact pre-SEC-05 current state |
| anonymous grant-use linkage | CREATED_BY_TRACKED_MIGRATION | baseline 제외 |

## Direct Dependency Inventory

| Dependency | Current DDL | Provenance/baseline decision |
|---|---|---|
| product_category | 13-value enum | tracked moisturizer four values와 treatment 제외 후에도 toner_pad/ampoule/essence untracked |
| product_texture | watery/gel/lotion/cream | 20260410 conditional create; predecessor column type 불확실 |
| product_finish | fresh/natural/dewy/soft_matte | 20260410 conditional create; predecessor column type 불확실 |
| product_review_status | six values | 20260410 create candidate; baseline 제외 |
| product_form | six values | 20260613 create; baseline 제외 |
| gen_random_uuid()/now() | UUID/timestamp defaults | explicit sequence 없음; dump에 extension DDL 없음 |
| public.set_updated_at() | PL/pgSQL, search_path `pg_catalog, public`, NEW.updated_at=now(); anon/authenticated/service_role EXECUTE ALL | products/candidates trigger dependency, tracked provenance 없음 |
| auth.users | recommendation user FK | Supabase managed; baseline에서 auth table 생성 금지 |
| ranking_snapshots | source snapshot FK | tracked migration이 생성; baseline 제외 |
| product_candidate_evidence_summary / promote_product_candidate | candidates/products/source direct dependency | 20260410 tracked view/function; baseline 제외 |
| candidate_ranking_evidence_summary / ingest_ranking_snapshot | candidates/source/ranking direct dependency | 20260621 이후 tracked view/function; baseline 제외 |

네 대상 table을 명시적으로 추가한 publication DDL은 dump에서 발견되지 않았다. Explicit sequence/domain/exclusion constraint도 없다.

Current enum 역적용으로 얻는 `product_category` predecessor 후보 값은 `cleanser`, `toner_essence`, `toner_pad`, `serum`, `ampoule`, `essence`, `moisturizer`, `sunscreen`이다. 네 moisturizer 세부값은 20260524, `treatment`는 20260613이 추가한다. 다만 enum과 products.category가 20260410 직전에 이미 enum이었는지 text였는지는 dump만으로 확정할 수 없다.

## Migration Chronology 역적용

| Migration | Reverse result | Remaining ambiguity |
|---|---|---|
| 20260410 | normalized/type/check/review/functions 제거 | IF NOT EXISTS preexistence, old products types |
| 20260430 | signal columns 제거 | 없음 |
| 20260524 | moisturizer enum additions 제거 | DML row state 제외 |
| 20260526 | rows 제외 | required untracked columns/index 생성 시점 |
| 20260613 | treatment/product_form 제거 | untracked enum three values provenance |
| 20260620 | candidate product_form/promotion replacement 제거 | 없음 |
| 20260621 | candidate/source linkage components 제거 | predecessor RLS/ALL grant provenance |
| 20260621-27 | ranking/review views/functions/queue 제거 | 없음 |
| 20260704/11 | dump에 없음, baseline 제외 | local-only |

비표준 filename 5개가 linked history에 없으므로 current dump만으로 각 IF NOT EXISTS branch가 create했는지 skip했는지 역증명할 수 없다.

## Exact Predecessor Schema

Actual current DDL은 exact하게 확보했지만 20260410 직전 historical schema는 다음 최소 contract까지만 확정된다.

1. `products`, `product_candidates`, `source_rankings`는 20260410 전 존재한다.
2. `recommendation_logs`는 SEC-05 전에 존재하며 full replay에서 선행 제공돼야 한다.
3. 네 table의 UUID PK/default와 base columns가 필요하다.
4. Source snapshot/candidate/raw linkage는 20260621이 추가한다.
5. Recommendation grant-use linkage는 SEC-05가 추가한다.
6. Tracked normalized/signal/product-form/review/ranking components는 baseline에 선행 포함하지 않는다.

Exact historical state를 막는 항목은 products conversion 이전 types, IF NOT EXISTS 대상의 preexistence, untracked enum/20260526 dependencies, current-only fields/security/trigger의 최초 시점이다. 따라서 exact timestamp-0 SQL은 아직 확정되지 않았다.

## Baseline 포함 대상

- four predecessor tables와 required base columns/UUID PK defaults
- product category predecessor enum의 untracked 필수값, 단 old column type 결정 필요
- 20260526 replay가 요구하는 untracked product columns, 단 역사적 위치 결정 필요
- recommendation logs PK/auth FK/four indexes/RLS/service-role ACL
- source/candidate/products predecessor RLS/ACL은 provenance 결정 후 포함

`source_rankings`는 **포함** 대상이다.

## Baseline 제외 대상

- 20260410 normalized/review/promotion components
- 20260430 signal fields
- tracked moisturizer/treatment enum additions와 product_form
- candidate/source ranking linkage components
- ranking snapshots/review queue/views/RPC
- SEC-01/SEC-05 objects/linkage
- shadow bootstrap, row data
- provenance 없는 cleansing/sunscreen/balm fields/checks는 timestamp-0 baseline에서 보류

## Current-State Baseline 충돌

| Collision | Severity | 이유 |
|---|---|---|
| current products 복사 | High | tracked normalized/signal/product_form/type/check 선행 생성 |
| current candidates 복사 | High | tracked review/promotion/product-form/ranking 선행 생성 |
| current source rankings 복사 | High | 20260621 linkage/FK/index 선행 생성 |
| current category enum 복사 | High | tracked moisturizer/treatment values 선행 반영 |
| current functions/views 복사 | High | replacement chronology와 privileges 왜곡 |
| current RLS/grants 전체 복사 | Medium | predecessor/tracked security 경계 상실 |
| SEC-01/SEC-05 포함 | High | dump에는 없지만 repository HEAD를 합치면 local-only migration 중복 |
| current-only fields 무조건 t0 포함 | Medium | historical provenance 없는 false-positive replay |

## 남은 Uncertainty

1. 20260410 변환 이전 products six-column type/value representation
2. noncanonical migration 5개의 실제 실행 방식과 IF NOT EXISTS branch
3. product category toner_pad/ampoule/essence 최초 DDL
4. 20260526 필수 untracked columns 최초 DDL
5. current-only cleansing/sunscreen/balm provenance
6. products/candidates trigger, set_updated_at, RLS/ACL의 t0 존재 여부
7. candidate matched FK SET NULL 변경 provenance
8. broad default privileges가 current ACL에 미친 영향

1-4는 migration replay 정확성에 직접 영향을 준다.

## Updated Implementation Gate

**`BLOCKED_BY_SCHEMA_UNCERTAINTY` 유지**

- `SAFE_SCHEMA_DUMP`와 네 table current exact DDL 확보는 완료됐다.
- Source rankings 포함 여부와 recommendation logs pre-SEC-05 state는 확정됐다.
- 그러나 products predecessor type과 untracked replay dependency의 t0 provenance가 확정되지 않았다.
- 비표준 migration이 history에 없어 reverse create/skip branch를 결정할 수 없다.
- Baseline SQL에 추측이 필요하므로 READY/PARTIALLY_READY 조건을 충족하지 않는다.

## 권장 다음 작업

Baseline migration 작성이 아니라 **비표준 초기 SQL provenance 수집**을 먼저 수행한다.

1. 20260410 이전 schema source 또는 archived initial SQL 확보
2. Manual SQL 기록에서 product enum/core table/untracked product fields 생성 DDL 확인
3. Current dump와 대조해 IF NOT EXISTS branch와 old types 확정
4. 그 후 Gate 재판정 및 별도 baseline migration 작업

내부 재검토 종료 조건은 **C: dump와 repository만으로 해소할 수 없는 uncertainty만 남음**이다.

종료 처리에서 지정된 TEMP raw dump 삭제와 repository 내 raw dump 부재를 확인했다.
