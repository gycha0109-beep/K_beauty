# SEC-05 v2 구현 검증

## 1. 검증 범위

- 기준 브랜치: `codex/survey-input-contract-refactor`
- 검증 유형: review / verification-only
- 검증 대상: SEC-05 v2 token core/helper, `/api/analyze`, `/api/results`, `/api/track`, 관련 client caller, migration, verifier, 진단·구현 문서
- DB/RLS/Auth/Secret 영향 판정: `Y` (정적 검토 대상)
- Production/provider 실행 판정: `N` (production Supabase, OpenAI, 실제 사용자 데이터 미사용)
- 허용 변경: 본 문서와 `.codex/AI_WORK_LOG.md`의 검증 요약만
- 제외: 코드·migration·package 수정, migration 적용, local/remote DB write, production API 호출

최종 판정은 **FIX_REQUIRED**다. Critical/High finding은 없지만 정상 anonymous 흐름과 결과 무결성·result replay 원자성에 영향을 주는 Medium finding 4개가 코드 기준으로 확인됐다.

## 2. 변경 범위 요약

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| SEC-05 범위 밖 권한 추가 | PASS | grant operation은 `result:create`, `track:create` 두 개뿐이며 premium, saved report, check-in, visibility update/delete 권한은 없다. |
| SEC-01과 SEC-05 책임 분리 | PASS | SEC-01 cookie 검증 패턴만 재사용하고 secret, table, RPC, idempotency 상태는 분리했다. |
| v1 발급 제거 | PASS | `/api/analyze`는 legacy header를 발급하지 않는다. |
| v1 저장 제거 | PASS | client는 legacy session key를 읽을 때 삭제한다. |
| v1 검증 거부 | PASS | `/api/results`, `/api/track`은 legacy header가 있으면 401을 반환한다. |
| 로그인 account write 유지 | PARTIAL | 서버 account 분기는 보존됐고 build가 통과했으나 staging account smoke test는 수행하지 못했다. |
| anonymous 정상 write 유지 | FAIL | client가 Supabase anonymous Auth access token을 account token으로 오인해 v2 state를 삭제한다. 별도 result payload allowlist 충돌도 있다. |

`/api/results`와 `/api/track`의 변경량은 크지만 새 grant가 허용하는 DB write는 기존 신규 public result 생성과 recommendation log insert에 한정된다. 기존 share publish 분기는 owner 확인을 계속 사용하며 anonymous grant로 확장되지 않았다.

## 3. Token 계약 결과

| 통제 | 판정 | 확인 근거 |
| --- | --- | --- |
| version 2 고정 | PASS | `anonymous-write-grant-core.js:4`, `197-213` |
| purpose 고정 | PASS | `anonymous-write-grant-core.js:5`, `203` |
| resource type `analysis-run` | PASS | `anonymous-write-grant-core.js:6`, `204-205` |
| server-generated resource ID | PASS | `randomBytes(24)` 사용 (`150-155`, `217-226`) |
| operation 분리 | PASS | result/track payload에 서로 다른 고정 operation (`231-239`) |
| principal hash claim | PASS | write 전용 HMAC hash를 token과 DB grant에 동일하게 사용 (`142-147`, `216-278`) |
| jti entropy | PASS | `randomBytes(24)` (`154-155`, `220-221`) |
| issuedAt/expiresAt | PASS | 정수·순서·최대 24시간·현재 만료 검증 (`209-213`, `313-318`) |
| signature | PASS | HMAC-SHA-256 (`15-18`, `190-194`) |
| timing-safe 비교 | PASS | `timingSafeEqual`과 길이 일치 확인 (`21-25`, `299-303`) |
| unknown version/purpose/resource/operation | PASS (code) | claim allowlist와 token claim validator가 fail-closed한다. 기존 verifier의 해당 테스트 방식은 보완 필요하다. |
| result/track 교환 방지 | PASS | route별 expected operation과 token operation을 비교한다. |
| v1 즉시 거부 | PASS | legacy claim은 v2 validator를 통과하지 못하고 legacy header도 route에서 명시 거부된다. |

Token에 임의 추가 claim이 들어와도 권한 판정은 고정 claim만 사용한다. 현재 서명 secret이 없으면 발급·검증 모두 `unavailable`로 종료하며 임시 fallback은 없다.

## 4. Principal binding 결과

서버 측 principal binding 자체는 PASS다.

1. `/api/analyze`의 SEC-01 guard가 signed httpOnly cookie를 검증하거나 새 opaque payload를 생성한다. 새 payload는 response cookie로만 설정된다. `analysis-request-guard.js:174-200`
2. v2 발급은 그 payload를 `ANONYMOUS_WRITE_GRANT_SECRET`으로 다시 HMAC한다. `anonymous-write-grant-core.js:142-147`
3. write route는 기존 SEC-01 cookie만 검증하며 새 cookie를 발급하지 않는다. `analysis-request-guard.js:203-222`
4. token principal hash와 현재 cookie-derived hash를 비교한다. `anonymous-write-grant.js:90-124`
5. raw anonymous payload는 server memory 밖으로 반환·로그·DB 저장되지 않는다.

다만 client의 auth 분류는 FAIL이다. `getBrowserSupabaseAccessToken()`은 anonymous sign-in을 자동 생성하고 anonymous user 여부와 무관하게 access token을 반환한다. 결과·tracking caller는 token 존재만으로 v2 grant state를 삭제하고 bearer만 전송한다. 서버는 같은 user를 account가 아닌 anonymous로 분류하므로 v2 token 누락으로 거부한다. 자세한 내용은 `SEC-05-V01`에 기록한다.

## 5. Result fingerprint 결과

| 항목 | 판정 | 설명 |
| --- | --- | --- |
| field order 안정성 | PASS | `stableSerialize`와 정규화 객체를 사용한다. |
| survey alias/derived outdoor | PASS | verifier가 alias 및 outdoor derivation 동등성을 확인한다. |
| array order | PASS | 사용자 선택·추천 순서가 의미 있으므로 순서를 유지한다. |
| timestamp/UI image 제외 | PASS | fingerprint와 저장 submission에서 preview image가 제외된다. |
| analyze/result 동일 core 사용 | PASS | 발급과 검증 모두 `createAnonymousResultFingerprintHash`를 사용한다. |
| 정상 result transport shape | FAIL | `analysisRunId`가 result 객체 안에 남지만 anonymous result allowlist에 없어 400이 발생한다. |
| 저장 payload 전체 무결성 | FAIL | `meta`, `faceLab*`, `products`, `explanationProducts`, product extra field는 허용·저장되지만 fingerprint에 포함되지 않는다. |
| 보호 owner/public 필드 | PASS | anonymous body는 `user_id`, owner, `is_public`, report type을 직접 설정할 수 없고 server가 public/new result로 고정한다. |
| raw fingerprint input DB 저장 | PASS | DB에는 HMAC hash만 저장한다. |

Synthetic pure check에서 `meta`, `faceLab`, `topPick.score` 및 임의 product field를 변경해도 fingerprint가 동일했다. 동시에 `sanitizeResultForStorage`는 product에서 일부 raw signal key만 삭제한 뒤 나머지 result 전체를 `result_json.result`에 저장한다. 따라서 현재 방어는 “immutable core” 일부에는 유효하지만 허용된 전체 public result payload를 결속하지 않는다.

## 6. Track fingerprint 결과

| 항목 | 판정 | 설명 |
| --- | --- | --- |
| event allowlist | PASS | 9개 event만 허용한다. `track/route.js:17-27` |
| body top-level allowlist | PASS | anonymous body의 unknown key를 400으로 거부한다. `28-40`, `259-267` |
| 의미 필드 포함 | PASS | run ID, event, product/feature/result/question/answer/top-pick/meta를 포함한다. |
| timestamp/session ID 제외 | PASS | 시간·랜덤 tracking session만 달라진 동일 event를 dedupe한다. |
| 동일 event unique | PASS (schema) | grant + fingerprint unique이며 log의 grant-use ID에도 unique index가 있다. |
| 서로 다른 event | PASS (code) | fingerprint가 다르면 max use 내 별도 use row를 만든다. |
| 최대 24회 | PARTIAL | static caller는 15개 call site이고 의미 중복은 dedupe되므로 일반 1회 흐름은 24회 미만으로 예상되나 반복 상호작용 UX는 staging 확인이 필요하다. |
| arbitrary unique event flood | PASS | allowlist와 24-use ceiling으로 무제한 증가는 막는다. meta 변형도 최대 24회로 제한된다. |
| account tracking | NEEDS_STAGING_SMOKE_TEST | account 분기와 기존 feedback dedupe는 남아 있으나 실제 세션/DB smoke test는 수행하지 않았다. |

Track의 DB 중복 방어는 result보다 강하다. 동일 `anonymous_write_grant_use_id`를 가진 log insert는 unique index가 차단하며, insert 응답 유실 뒤 retry도 기존 log를 찾아 complete할 수 있다.

## 7. Migration/RPC 원자성 결과

| 통제 | 판정 | 근거 |
| --- | --- | --- |
| table/constraint 정합성 | PASS (static) | version/purpose/resource/operation/hash/expiry/use-count 제약이 있다. |
| jti hash unique | PASS | `anonymous_write_grants.jti_hash unique` |
| raw token/jti/principal/payload 미저장 | PASS | hash와 최소 result reference만 저장한다. |
| RLS enabled | PASS | 두 table 모두 RLS enable |
| direct privilege revoke | PASS | PUBLIC/anon/authenticated table privilege revoke |
| RPC service_role-only | PASS | 함수별 PUBLIC/anon/authenticated execute revoke 후 service_role grant |
| SECURITY DEFINER/search path | PASS | 함수는 SECURITY DEFINER가 아니며 모두 explicit `search_path=public`을 사용한다. |
| dynamic SQL | PASS | 사용하지 않는다. |
| grant pair atomic create | PASS (Postgres 함수 계약) | 두 row를 한 함수 transaction에서 검증·insert하며 중간 예외는 transaction 전체를 실패시킨다. |
| claim row lock | PASS | grant와 existing use를 `FOR UPDATE`한다. |
| result max use | PASS (claim count) | max use 1과 동일 fingerprint unique가 있다. |
| track max use/dedupe | PASS (static) | used count와 grant+fingerprint unique, log use-ID unique가 있다. |
| failed retry count | PASS | 같은 use row만 최대 3 attempt, retry는 used_count를 추가 증가시키지 않는다. |
| stale worker fencing | FAIL | retry claim이 attempt/lease fencing token을 반환·검증하지 않아 이전 worker의 complete/fail 또는 downstream result write를 구분하지 못한다. |
| result DB unique linkage | FAIL | analysis request/result에 grant-use unique reference가 없고 `analysis_requests.session_id`도 unique가 아니다. |
| cleanup lease 보호 | PARTIAL | expiry만 기준으로 삭제하며 active lease/grace를 확인하지 않는다. |
| recommendation_logs 호환 | NEEDS_LOCAL_DB_TEST | nullable FK/index는 기존 row에 비파괴적이지만 repository migration chain에 table 생성이 없어 실제 schema를 확인하지 못했다. |

RPC claim 자체는 row lock으로 원자적이다. 그러나 result downstream write까지 포함한 end-to-end single-use는 증명되지 않는다. 5분 lease 만료 뒤 retry가 시작된 후 이전 worker가 재개되면 두 worker 모두 service-role result insert에 도달할 수 있고, result table에는 track 경로와 같은 unique grant-use linkage가 없다.

Migration은 `begin`/`commit`으로 감싸져 일반적인 apply 실패는 rollback된다. 다만 `create table if not exists`와 `add column if not exists`는 수동 partial schema가 이미 존재할 때 누락 constraint를 복구하지 않으므로 배포 전 metadata 확인이 필요하다. down migration은 없으며 code와 RPC가 함께 의존하므로 migration-first 배포 순서를 유지해야 한다.

## 8. Route 실패·복구 결과

### `/api/analyze`

- SEC-01 guard는 image base64 변환과 AI provider 호출보다 먼저 실행된다. PASS.
- v2 grant pair 생성은 두 AI provider 단계와 decision 생성 이후에 실행된다. grant 실패 시 AI 비용은 이미 발생했고 response는 503으로 유실된다. 이는 fail-closed 보안 선택이지만 운영 비용·UX tradeoff가 남는다.
- grant RPC 실패 시 token을 발급하지 않고 SEC-01 request를 failed 처리한다. PASS.
- 동일 SEC-01 idempotency key는 failed 상태가 되어 client가 새 intent/key로 다시 시작해야 하므로 guard DB 장애 후 재시도 시 AI 비용이 다시 발생할 수 있다. 운영상 알려진 한계로 기록한다.
- grant pair는 한 RPC transaction이므로 result/track 중 하나만 생성되는 정상 commit 상태는 없다. PASS (static).

### `/api/results`

- claim은 `analysis_requests`/`analysis_results` service-role write보다 먼저 수행된다. PASS.
- 정상 write 후 complete 실패 시 503이고, lease retry가 `analysis_requests.session_id=analysisRunId`로 기존 결과를 찾는다. PARTIAL.
- `analysis_requests.session_id`는 기존 nullable text이며 repository 내 다른 analysis request 조회 의미는 확인되지 않았다. 이번 변경은 anonymous run recovery 용도로만 사용한다.
- session ID는 unique가 아니고 lookup은 최신 request 1개만 선택한다. stale worker 또는 orphan request가 있으면 canonical result 선택이 불안정하다.
- completed RPC가 반환하는 `result_reference`를 route가 직접 사용하지 않고 session lookup을 다시 수행한다.

### `/api/track`

- claim은 recommendation log insert보다 먼저 수행된다. PASS.
- insert 성공 후 complete 실패 시 log unique reference를 통해 retry가 기존 row를 복구한다. PASS (static).
- 동일 use ID의 동시 insert는 unique index로 하나만 성공한다. 실제 transaction interleaving은 local DB test가 필요하다.

## 9. Client 흐름 결과

| 흐름 | 판정 | 설명 |
| --- | --- | --- |
| analyze response token/run 수신 | PASS | same-origin fetch에서 두 custom header와 body run ID를 읽는다. CORS expose는 필요 없다. |
| v1 stale key 제거 | PASS | read/write/clear에서 legacy session key를 제거한다. |
| operation별 token 저장 | PASS | result/track/run key가 분리됐다. |
| result token endpoint 분리 | PASS | `/api/results`에만 result header를 보낸다. |
| track token endpoint 분리 | PASS | `/api/track`에만 track header를 보낸다. |
| 정상 anonymous auth 분류 | FAIL | anonymous Supabase bearer를 account bearer로 오인한다. |
| result payload shape | FAIL | analyze response 전체를 result로 저장·전송해 `analysisRunId` allowlist 충돌이 난다. |
| 성공 후 result token 삭제 | PASS | share ID 응답 성공 후에만 삭제한다. |
| retry 시 token 보존 | PASS | 5xx/409에서는 result token을 유지한다. permanent mismatch에서는 삭제한다. |
| page 이동/refresh | PARTIAL | 같은 tab의 sessionStorage에서는 유지된다. 새 tab은 sessionStorage를 공유하지 않으므로 grant를 잃는다. |
| login/account 전환 | PARTIAL | 실제 account bearer에서는 grant를 지우는 방향은 맞지만 anonymous bearer와 구분하지 못한다. |
| URL/log/analytics 노출 | PASS (static) | token을 URL/query/analytics body에 넣거나 raw로 log하지 않는다. |

## 10. 기존 기능 회귀 결과

| 기존 흐름 | 판정 |
| --- | --- |
| anonymous 무료 분석 | NEEDS_STAGING_SMOKE_TEST (build/static guard 통과) |
| anonymous 무료 결과 저장 | FAIL (`SEC-05-V01`, `SEC-05-V02`) |
| anonymous recommendation tracking | FAIL (`SEC-05-V01`) |
| account 사용자 분석 | NEEDS_STAGING_SMOKE_TEST |
| account 사용자 결과 저장 | NEEDS_STAGING_SMOKE_TEST (server 분기 static PASS) |
| 결과 페이지 재열람 | PASS (build), runtime 미실행 |
| full-report 진입 | PASS (build), runtime 미실행 |
| 공유 URL 생성/복사 | FAIL for anonymous 신규 생성; existing/account는 staging 확인 필요 |
| My/saved report | PASS (scope static), staging 미실행 |
| premium session | PASS (scope static), staging 미실행 |
| SEC-01 rate limit/idempotency | PASS (existing verifier) |
| SEC-04 premium fail-closed | PASS (scope/build), staging 미실행 |

## 11. Verifier 충분성 평가

`node scripts/verify-anonymous-write-grant-v2.mjs`는 통과했지만 보안 계약 전체를 증명하지 않는다.

- 실제 함수 실행: 정상 token 서명/검증, operation 교환 거부, expiry, stable fingerprint, timestamp 제외를 pure helper로 실행한다.
- 문자열 검사: migration table/function/revoke/search_path, route claim 순서, client header/key 존재는 단순 `includes`/`indexOf`다.
- false negative: anonymous Supabase session을 account로 오인하는 client 분기를 실행하지 않는다.
- false negative: 실제 `/api/analyze` response shape가 `/api/results` allowlist를 통과하는지 확인하지 않는다.
- false negative: fingerprint에서 제외되지만 저장되는 nested/supplemental field를 변형해 보지 않는다.
- false negative: SQL transaction, concurrent claim, lease expiry, stale worker, complete/fail interleaving을 실행하지 않는다.
- false negative: account path와 normal share/track flow를 실행하지 않는다.
- test defect: verifier의 `signPayload()`는 production token signer와 다른 HMAC purpose domain을 사용한다. 따라서 unknown claim/v1 synthetic token은 claim validator가 아니라 signature 단계에서 거부될 수 있다.

따라서 verifier PASS는 syntax/static contract 신호일 뿐 commit readiness 근거가 아니다.

## 12. Findings

### [SEC-05-V01] Supabase anonymous Auth token을 account token으로 오인해 v2 grant가 삭제됨

- 심각도: Medium
- 판정: FAIL
- 파일/함수/라인: `lib/supabase/browser-client.js:67-121`; `components/result/ResultShareActions.jsx:182-196`; `app/result/page.js:468-480`; `app/result/full-report/page.js:555-565`; `app/api/results/route.js:78-80,328-332,404-429`; `app/api/track/route.js:42-44,252-256,298-323`
- 재현 조건: 로그인하지 않은 browser에서 `getBrowserSupabaseAccessToken()`이 기존 또는 자동 생성된 Supabase anonymous session token을 반환한 뒤 결과 저장 또는 tracking을 시도한다.
- 실제 영향: client는 v2 result/track token과 run ID를 삭제하고 bearer만 전송한다. 서버는 anonymous Auth user를 account로 인정하지 않아 anonymous grant token 누락으로 결과 저장·tracking을 거부한다.
- 현재 방어: 서버는 real account와 anonymous Auth user를 구분하고 mixed credential을 거부한다.
- 문제 원인: client helper는 session user type을 확인하지 않고 모든 access token을 account bearer로 취급한다.
- 최소 보정 범위: `lib/supabase/browser-client.js`에 real account만 반환하는 helper를 두거나 caller가 session user를 검사하고, `ResultShareActions`, result/full-report tracking caller가 real account에서만 grant state를 삭제하도록 조정한다.
- 필요한 테스트: anonymous session, real account session, no-session 각각에 대해 전송 header와 storage 삭제 여부를 pure/browser test로 검증하고 staging에서 result/track smoke test를 수행한다.
- 구현 전제: SEC-01 signed cookie와 Supabase anonymous Auth는 별도 principal이며 둘을 account entitlement로 혼합하지 않는다.
- 커밋 차단 여부: yes

### [SEC-05-V02] analyze response의 analysisRunId가 result allowlist와 충돌함

- 심각도: Medium
- 판정: FAIL
- 파일/함수/라인: `app/api/analyze/route.js:1521-1533`; `app/page.js:292-326`; `app/result/page.js:2859-2877,3393-3397`; `components/result/ResultShareActions.jsx:220-230`; `app/api/results/route.js:24-49,138-151,436-443`
- 재현 조건: anonymous analyze 성공 response를 client가 그대로 `skinTestResult`에 저장하고 신규 share를 생성한다.
- 실제 영향: result object에 `analysisRunId`가 포함되지만 anonymous result allowlist에는 없으므로 `pickAllowedObject`가 `null`을 반환하고 400 `Invalid analysis result payload`가 발생한다.
- 현재 방어: `analysisRunId`는 별도 request body field로 token resource와 비교된다.
- 문제 원인: transport metadata를 result payload에서도 제거하지 않았고 server allowlist에도 명시적 strip 경로가 없다.
- 최소 보정 범위: client가 analyze response에서 transport field를 결과 객체와 분리하거나 server가 `analysisRunId`를 authority에 사용하지 않는 transport-only field로 명시 제거한 뒤 allowlist를 적용한다. body의 별도 `analysisRunId` 비교는 유지한다.
- 필요한 테스트: 실제 synthetic analyze response shape를 sessionStorage→ResultShareActions body→route validator까지 통과시키는 contract test.
- 구현 전제: resource 권한은 token/DB grant와 별도 body run ID 비교가 결정하며 result JSON에 run ID를 신뢰 필드로 저장하지 않는다.
- 커밋 차단 여부: yes

### [SEC-05-V03] fingerprint 밖 supplemental/nested payload를 public result에 저장할 수 있음

- 심각도: Medium
- 판정: FAIL
- 파일/함수/라인: `lib/security/anonymous-write-grant-core.js:47-76,111-131,158-168`; `app/api/results/route.js:24-49,138-151,436-450`; `lib/analysis-results.js:152-189,277-301`; `app/page.js:310-326`
- 재현 조건: 유효한 본인 result grant와 signed anonymous cookie를 가진 client가 core fingerprint를 유지한 채 `meta`, `faceLab*`, `products`, `explanationProducts` 또는 product의 fingerprint 미포함 field를 변경한다.
- 실제 영향: expected fingerprint는 일치하지만 변경된 supplemental/nested data가 public `result_json.result`에 저장될 수 있다. 타인 resource 접근은 아니지만 공개 분석 결과 무결성 계약이 부분적으로 우회된다.
- 현재 방어: summary, survey core, priority, 제한된 product field, routine/evidence/scoring은 fingerprint에 포함되며 result top-level key는 allowlist다.
- 문제 원인: top-level allowlist만 있고 nested schema/allowlist가 없으며 저장 sanitizer가 result 전체를 spread한다.
- 최소 보정 범위: `/api/results`에서 anonymous 저장용 canonical result schema를 구성해 fingerprint에 포함된 field만 저장하고, Face Lab supplemental data는 별도 server-bound 계약이 생기기 전 제외하거나 별도 fingerprint/resource로 결속한다. product nested field도 명시 allowlist한다.
- 필요한 테스트: 허용 core 정상 저장, meta/faceLab/product extra 변조 거부, raw signal/protected field 거부, 실제 UI 결과 payload 호환 test.
- 구현 전제: Face Lab은 병렬 endpoint 결과이므로 `/api/analyze` result grant가 검증하지 않은 payload를 자동 승계하지 않는다.
- 커밋 차단 여부: yes

### [SEC-05-V04] result lease 재claim에 fencing과 DB unique linkage가 없어 stale worker 중복 저장 가능

- 심각도: Medium
- 판정: FAIL / NEEDS_LOCAL_DB_TEST
- 파일/함수/라인: `supabase/migrations/20260711032649_sec_05_anonymous_write_grants.sql:288-335,339-404`; `app/api/results/route.js:229-258,456-527`; `supabase/migrations/20260424_align_analysis_results_share_schema.sql:5-19,48-68,129-135`
- 재현 조건: 첫 result request가 claim 후 5분 이상 중단되고, 같은 token/fingerprint retry가 lease를 재claim한 뒤 첫 worker가 다시 실행된다.
- 실제 영향: complete/fail RPC는 attempt/lease identity를 확인하지 않고, analysis request/result에는 grant-use unique linkage가 없다. 두 worker가 각각 public result를 insert할 수 있으며 latest-session recovery도 canonical row를 안정적으로 특정하지 못한다.
- 현재 방어: claim RPC는 grant/use row를 lock하고 active lease 중 두 번째 claim을 차단한다. normal short request와 순차 replay는 차단한다.
- 문제 원인: lease 만료 후 새 attempt를 식별하는 fencing token이 없고 downstream result write가 grant use와 DB unique constraint로 결속되지 않았다.
- 최소 보정 범위: claim이 attempt/fencing value를 반환하고 complete/fail이 동일 값을 요구하게 하며, result path에도 grant-use ID 또는 resource ID 기반 unique DB linkage를 추가한다. 가능하면 claim과 canonical result insert를 한 transaction/RPC 경계로 묶는다.
- 필요한 테스트: 두 DB connection으로 claim→lease expiry→reclaim→old/new complete 및 insert interleaving을 실행해 result row가 정확히 1개인지 확인한다.
- 구현 전제: track의 log use-ID unique 패턴은 참고할 수 있으나 SEC-01 table을 재사용하지 않는다.
- 커밋 차단 여부: yes

### [SEC-05-V05] cleanup이 만료 직전 in-progress grant를 즉시 삭제할 수 있음

- 심각도: Low
- 판정: PARTIAL
- 파일/함수/라인: `supabase/migrations/20260711032649_sec_05_anonymous_write_grants.sql:470-495`
- 재현 조건: token 만료 직전에 claim된 request가 처리 중인 시점에 `cleanup_anonymous_write_grants(now())`가 실행된다.
- 실제 영향: grant/use row가 cascade 삭제되어 downstream write 후 complete가 실패하거나 result/log reference가 분리될 수 있다.
- 현재 방어: 24시간 TTL로 발생 확률은 낮고 token은 claim 시점에 유효해야 한다.
- 문제 원인: cleanup predicate가 `expires_at`만 확인하고 active lease 또는 grace period를 확인하지 않는다.
- 최소 보정 범위: `expires_at < p_before`와 함께 active `in_progress_until`이 없거나 충분히 지난 row만 삭제하고 운영 cleanup에 grace를 둔다.
- 필요한 테스트: expiry와 lease가 겹치는 synthetic row에서 cleanup 전후 상태를 local DB로 확인한다.
- 구현 전제: scheduler는 별도 운영 범위다.
- 커밋 차단 여부: no

### [SEC-05-V06] recommendation_logs schema 호환성을 repository/local DB에서 증명할 수 없음

- 심각도: Info
- 판정: NEEDS_LOCAL_DB_TEST
- 파일/함수/라인: `supabase/migrations/20260711032649_sec_05_anonymous_write_grants.sql:50-56`; repository `supabase/migrations/**`
- 재현 조건: migration chain만으로 fresh database를 구성하거나 target DB의 `recommendation_logs` column/constraint를 모르는 상태에서 migration을 적용한다.
- 실제 영향: repository migration에는 `recommendation_logs` 생성문이 없어 fresh apply가 실패할 수 있다. 실제 target에 table이 있으면 nullable FK/index는 기존 row와 account insert를 보존할 가능성이 높다.
- 현재 방어: migration 전체가 transaction으로 감싸져 일반 apply failure는 rollback된다.
- 문제 원인: table source-of-truth가 repository migration 밖에 있다.
- 최소 보정 범위: 구현 변경 전 local/target metadata에서 table existence, PK/type, existing row와 index compatibility를 확인하고 migration provenance를 정리한다.
- 필요한 테스트: fresh local migration apply와 existing-row fixture에 대한 alter/index 적용 test.
- 구현 전제: production metadata는 코드만으로 단정하지 않는다.
- 커밋 차단 여부: no (단, 배포 차단)

### [SEC-05-V07] 기존 verifier가 정상 client와 DB 동시성 결함을 탐지하지 못함

- 심각도: Info
- 판정: PARTIAL
- 파일/함수/라인: `scripts/verify-anonymous-write-grant-v2.mjs:45-54,216-273`
- 재현 조건: 현재 verifier를 그대로 실행한다.
- 실제 영향: `SEC-05-V01`~`V04`가 존재해도 verifier는 PASS를 반환해 commit readiness를 과대평가할 수 있다.
- 현재 방어: pure token/fingerprint와 static marker/순서 검사는 제공한다.
- 문제 원인: browser auth/route contract/SQL concurrency를 실행하지 않고, altered token signer가 production signer와 다른 HMAC purpose를 사용한다.
- 최소 보정 범위: 실제 signer를 이용한 claim mutation test, real analyze response fixture→result validator test, anonymous/account client state test, local Postgres concurrency integration test를 추가한다.
- 필요한 테스트: 위 네 category를 CI에서 분리 실행하고 local DB가 없으면 integration 미실행을 명시적으로 실패/skip 상태로 보고한다.
- 구현 전제: 문자열 존재 검사는 보조 guard이며 동작 증명이 아니다.
- 커밋 차단 여부: no (Medium finding 보정과 함께 verifier 보강 필요)

## 13. Local DB에서 반드시 검증할 항목

현재 `supabase status --output json`은 Docker engine pipe가 없어 실행되지 않았다. migration/RPC apply 및 DB write test는 수행하지 않았다. 수정 후 disposable local DB에서 다음을 검증해야 한다.

1. Fresh migration chain이 `recommendation_logs` 의존성을 포함해 성공한다. 기대: migration transaction commit, 두 table/RPC와 FK/index 존재.
2. `anon`, `authenticated`, `PUBLIC`의 table DML 및 RPC execute가 거부된다. 기대: permission denied.
3. service_role create pair가 정확히 2개 row를 만들고 한 row 오류 시 0개가 남는다.
4. result 동시 claim 2개 중 하나만 `claimed`, 다른 하나는 `in_progress`다.
5. lease 만료 후 reclaim 시 old attempt complete/fail이 거부되고 new attempt만 완료할 수 있다.
6. 같은 result grant로 concurrent downstream insert를 실행해 analysis result가 정확히 1개다.
7. track 동일 fingerprint concurrent claim/insert가 use 1개, log 1개를 만든다.
8. track 서로 다른 24개 event는 허용되고 25번째는 `max_uses`다.
9. failed retry는 같은 fingerprint에서 attempt만 증가하고 used_count를 추가 소비하지 않는다.
10. cleanup은 active lease row를 보존하고 grace 이후 만료 row만 삭제한다.
11. complete/fail이 다른 grant/use/fingerprint를 변경하지 않는다.
12. raw token, raw jti, raw cookie payload, 전체 result/event payload가 guard table에 존재하지 않는다.

동시성 test는 서로 다른 두 DB connection과 명시적 barrier를 사용해야 한다. 단일 connection의 순차 호출은 race 방어를 증명하지 못한다.

## 14. Staging에서 반드시 검증할 항목

1. anonymous 분석 후 response에 두 header와 run ID가 있고 signed cookie가 설정된다.
2. Supabase anonymous Auth session이 있는 상태에서도 result caller가 v2 result token을 유지·전송한다.
3. anonymous 신규 share가 1회 성공하고 재시도는 같은 canonical share를 반환한다.
4. anonymous result payload가 실제 free result + Face Lab 조합에서 schema/fingerprint 계약을 통과한다.
5. track token으로 result route, result token으로 track route가 거부된다.
6. 다른 browser/cookie에서 복사 token이 principal mismatch로 거부된다.
7. 동일 track event가 timestamp만 달라도 DB row 1개다.
8. 실제 정상 result/full-report 상호작용이 24-use ceiling을 과도하게 소모하지 않는다.
9. real account 분석·result 저장·tracking·My/saved report가 anonymous grant 없이 유지된다.
10. premium release mode fail-closed와 premium session 생성 조건이 변하지 않는다.
11. migration/secret 없이 code만 배포된 경우 anonymous write가 503으로 fail-closed한다.

## 15. 커밋 가능 여부

**FIX_REQUIRED / 커밋 금지**

- Critical: 0
- High: 0
- Medium: 4
- Low: 1
- Info: 2

정상 anonymous result/track 흐름이 코드상 실패하고, result fingerprint와 stale-worker single-use 보장이 완료 기준을 충족하지 않는다. Local DB test가 없다는 사실만으로 차단한 것이 아니라 코드에서 재현 가능한 Medium finding이 있으므로 `BLOCKED_PENDING_LOCAL_DB_TEST`가 아닌 `FIX_REQUIRED`다.

## 16. 최소 보정 작업 목록

1. `lib/supabase/browser-client.js`, `ResultShareActions.jsx`, result/full-report caller: anonymous Auth session과 real account session을 분리하고 anonymous grant state 삭제 조건을 보정한다.
2. `app/page.js` 또는 `ResultShareActions.jsx`, `app/api/results/route.js`: `analysisRunId`를 result transport payload에서 분리하고 실제 analyze response fixture contract test를 추가한다.
3. `anonymous-write-grant-core.js`, `/api/results`, `analysis-results.js`: anonymous public result의 nested canonical schema와 fingerprint/storage field를 일치시킨다.
4. SEC-05 migration, grant helper, `/api/results`: result attempt fencing과 grant-use/resource unique linkage를 추가한다.
5. cleanup RPC: active lease/grace 보호를 추가한다.
6. verifier: 실제 signer, anonymous/account client, response-shape, local DB concurrency test를 추가한다.

보정은 premium, saved report, check-in, visibility, SEC-01 table로 확장하지 않는다.

## 17. 결론

v2 token의 HMAC 서명, version/purpose/resource/operation claim, signed-cookie principal binding, service_role-only RPC privilege, claim row lock, track dedupe/max-use는 정적 코드 기준으로 올바른 방향이다. 그러나 현재 client는 anonymous Auth bearer를 account로 오인하고, 정상 analyze response shape는 result allowlist와 충돌한다. 또한 public result의 일부 저장 payload가 fingerprint 밖에 있으며 result lease retry에는 stale worker fencing이 없다.

따라서 현재 구현은 **FIX_REQUIRED**이며 보정 전 커밋하면 안 된다. 먼저 네 Medium finding을 최소 범위로 수정한 뒤 disposable local Postgres 동시성 test와 staging anonymous/account smoke test를 통과시켜야 한다.

## 18. 2026-07-11 보정 후 상태

아래 상태는 본 검증 보고서 작성 뒤 적용한 `SEC-05 V01~V04 보정`의 코드·정적 verifier 결과다. 기존 본문의 FAIL은 보정 전 증거로 유지한다.

| Finding | 상태 | 근거 |
| --- | --- | --- |
| SEC-05-V01 | FIXED | `is_anonymous === false`인 영구 account만 bearer로 사용하며 anonymous session은 grant state를 유지한다. |
| SEC-05-V02 | FIXED | `analysisRunId`는 별도 transport field로만 보내고 anonymous persistence object에서 제거한다. |
| SEC-05-V03 | FIXED | analyze/results가 동일 canonical result/survey persistence helper를 사용하고, fingerprint 검증 뒤 canonical object만 insert한다. Face Lab/meta는 anonymous persistence에서 거부한다. |
| SEC-05-V04 | FIXED / NEEDS_LOCAL_DB_TEST | result use는 재claim하지 않고, `analysis_results.anonymous_write_grant_use_id` unique linkage로 canonical row를 복구한다. 실제 Postgres 동시성은 local DB 검증이 남는다. |
| SEC-05-V05 | REMAINS | cleanup lease/grace Low finding은 이번 범위에서 보정하지 않았다. |
| SEC-05-V06 | NEEDS_LOCAL_DB_TEST | repository 밖 `recommendation_logs` schema와 migration apply 호환성 확인이 필요하다. |
| SEC-05-V07 | FIXED | verifier가 client classification, canonical payload, no-reclaim, use-ID linkage를 검사하도록 강화됐다. |

코드 기준 Critical/High/Medium known finding은 남지 않았다. Local DB와 staging smoke test는 배포 전 필수 검증으로 유지한다.
