# SEC-05 v2 resource-bound anonymous write grant

## 목적과 범위

이 변경은 기존 v1 `x-kbeauty-write-token`의 generic `analysis-write` scope를 폐기하고, anonymous 결과 저장과 tracking write를 각각 analysis-run, operation, signed anonymous browser principal에 결속한다.

대상은 `/api/analyze`, `/api/results`, `/api/track` 및 그 client caller, 새 grant migration이다. Premium, saved report, check-in, 기존 share visibility update, SEC-01 rate/idempotency table/function은 변경하지 않는다.

## v1 즉시 거부

- 기존 `x-kbeauty-write-token`은 더 이상 발급하거나 검증하지 않는다.
- `/api/results`와 `/api/track`은 legacy header가 있으면 anonymous write를 거부한다.
- 브라우저 storage reader는 기존 `skinTestWriteAccessToken` key를 매 read와 새 분석 시작 시 제거한다.
- `WRITE_ACCESS_TOKEN_SECRET`은 premium session의 기존 용도로 남지만 v2 grant 발급/검증에는 사용하지 않는다.

기존 v1 token은 resource/principal binding을 사후 복원할 수 없으므로 호환 기간을 두지 않는다. stale anonymous tab은 새 분석으로 v2 grant를 발급받아야 한다.

## v2 token 계약

`ANONYMOUS_WRITE_GRANT_SECRET`으로 HMAC-SHA-256 signature를 만든다. 이 secret은 server-only이며 `WRITE_ACCESS_TOKEN_SECRET`, `ANALYSIS_REQUEST_GUARD_SECRET`, service role key와 공유하지 않는다. 누락 시 발급과 검증은 fail-closed한다.

공통 claim:

| Claim | 의미 |
| --- | --- |
| `version` | 고정 `2` |
| `purpose` | 고정 `anonymous-analysis-write` |
| `resourceType` | 고정 `analysis-run` |
| `resourceId` | 서버가 생성한 cryptographically secure analysis run ID |
| `principalHash` | write-grant secret으로 파생한 anonymous cookie principal HMAC hash |
| `jti` | cryptographically secure random identifier |
| `issuedAt` / `expiresAt` | 발급/만료 시각. 현재 TTL은 24시간 |
| `operation` | endpoint별 고정 권한 |

별도 response header:

| Header | 고정 operation | 사용 endpoint | 사용 정책 |
| --- | --- | --- | --- |
| `x-kbeauty-result-write-token` | `result:create` | `/api/results` | 1회 저장, canonical result fingerprint 일치 필요 |
| `x-kbeauty-track-write-token` | `track:create` | `/api/track` | 최대 24회, 동일 event fingerprint 1회 |

검증은 token signature, version, purpose, resource type, operation, expiry, token principal hash와 현재 principal hash를 모두 확인한다. result token과 track token은 서로 교환할 수 없다.

## Analysis run과 fingerprint

`/api/analyze`가 anonymous 성공 결과를 만들면 response 전에 analysis run ID와 두 grant를 한 RPC transaction으로 생성한다. response body에는 `analysisRunId`, response header에는 두 token이 포함된다.

Result fingerprint는 server가 이미 생성한 free decision payload와 normalized survey core를 stable serialization 후 HMAC한 값이다. locale, survey core, summary, priority, product 선택, routine, evidence/scoring을 포함한다. timestamp, `meta`, browser image preview, Face Lab의 병렬 supplemental payload는 제외한다.

`/api/results`는 client body의 immutable core fingerprint가 grant의 expected hash와 일치할 때만 진행한다. Face Lab 등 parallel response의 supplemental data는 기존 화면 호환을 위해 top-level allowlist로만 허용한다. 알려지지 않은 result/form field는 anonymous 저장 전에 거부한다.

Track fingerprint는 analysis run ID, allowlisted event name, product/result/question/answer 의미값, top-pick flag, stable meta를 포함하고 timestamp와 random client session ID는 제외한다. 같은 의미의 event는 timestamp만 바꿔도 같은 hash가 된다.

## Anonymous principal binding

SEC-01 signed `visualry_analysis_anon` cookie를 재사용한다.

- `/api/analyze`의 guard는 cookie가 없을 때만 새 cookie를 발급한다.
- write route는 기존 cookie만 검증하고, missing/tampered cookie로 새 principal을 발급하지 않는다.
- opaque cookie payload는 server memory에서만 write-grant secret으로 HMAC한다.
- raw cookie payload, IP, user ID, token, jti, request body는 grant DB나 route log에 저장하지 않는다.
- account user는 기존 Supabase account path를 유지한다. account bearer와 anonymous token을 함께 보내면 혼합 권한으로 거부한다.

## DB 구조와 RPC

Migration: `supabase/migrations/20260711032649_sec_05_anonymous_write_grants.sql`

| 대상 | 역할 |
| --- | --- |
| `anonymous_write_grants` | jti hash, resource/principal/operation, result expected fingerprint, TTL, max use와 aggregate status |
| `anonymous_write_grant_uses` | request/event fingerprint별 in-progress/completed/failed 상태, 최대 3회 제한 retry, lease, canonical reference |
| `recommendation_logs.anonymous_write_grant_use_id` | tracking insert와 grant use를 unique하게 연결해 complete RPC 응답 유실 뒤 duplicate log를 방지 |

모든 새 table은 RLS를 enable하고 `PUBLIC`, `anon`, `authenticated` direct table access를 revoke한다. RPC execute도 service role에만 grant한다. 함수는 `SECURITY INVOKER` 기본 동작과 `set search_path = public`을 사용하며 SECURITY DEFINER를 사용하지 않는다.

RPC:

| RPC | 역할 |
| --- | --- |
| `create_anonymous_write_grants` | 동일 resource/principal/expiry의 result+track grant 두 개를 한 transaction으로 생성 |
| `claim_anonymous_write_grant` | row lock, fingerprint unique, lease, max use를 원자적으로 확인하고 claim |
| `complete_anonymous_write_grant` | 정확한 in-progress claim만 완료. result grant는 completed로 전환 |
| `fail_anonymous_write_grant` | downstream 실패를 failed로 기록하고 같은 fingerprint만 최대 3회 재시도 허용 |
| `cleanup_anonymous_write_grants` | 만료 grant와 cascade use row를 삭제 |

만료는 24시간이고 cleanup scheduler 등록은 이번 범위 밖이다. 운영에서는 최소 하루 한 번 service-role-only cleanup RPC를 실행해야 한다. `recommendation_logs`의 foreign key는 cleanup 때 grant-use reference를 `null`로 바꾸므로 operational log row는 보존된다.

## 상태 전이와 replay 방어

| 상황 | result:create | track:create |
| --- | --- | --- |
| 최초 정상 요청 | `claimed` 후 DB write, `completed` | fingerprint별 `claimed` 후 log insert, `completed` |
| 처리 중 동일 요청 | 409 `anonymous_write_in_progress` | 409 `anonymous_write_in_progress` |
| 완료된 동일 요청 | 기존 canonical share response, 새 row 없음 | `success: true, deduped: true`, 새 log 없음 |
| 다른 fingerprint | 403 resource mismatch | 새 event이면 max use 내 claim, 같은 의미면 unique fingerprint dedupe |
| 다른 operation/resource/principal | write 전 거부 | write 전 거부 |
| downstream known failure | `failed`, 같은 fingerprint만 최대 3회 retry | `failed`, 같은 fingerprint만 최대 3회 retry |
| complete RPC 응답 유실 | `analysis_requests.session_id=analysisRunId`로 기존 result를 찾아 complete | unique `anonymous_write_grant_use_id` log reference를 찾아 complete |

모든 claim은 PostgreSQL row lock과 unique constraint 안에서 이뤄진다. application-level SELECT 후 UPDATE 방식은 사용하지 않는다.

## Route와 client 변경

### `/api/analyze`

anonymous 분석에서 AI 결과를 만든 뒤 grant RPC가 성공해야 두 v2 token과 analysis run ID를 응답한다. RPC/secret/service-role client가 실패하면 provider 결과를 persistence token 없이 반환하지 않고 안전한 `503 anonymous_write_grant_unavailable`으로 종료한다. 이 선택은 이미 발생한 AI 비용을 되돌리지는 못하지만, guard 없는 anonymous persistence를 허용하지 않는다. SEC-01 idempotency는 failed로 기록된다.

### `/api/results`

anonymous path는 result token, existing signed cookie, request body `analysisRunId`, canonical result fingerprint을 확인한 뒤 claim한다. claim 성공 후에만 service-role로 새 public analysis request/result를 만든다. request row의 existing `session_id`에는 analysis run ID를 저장한다. result token은 single-use이며, complete response가 유실된 retry는 기존 share를 재사용한다.

### `/api/track`

anonymous path는 track token, existing signed cookie, `analysisRunId`, normalized event fingerprint을 확인한 뒤 claim한다. claim 성공 후에만 service-role log insert를 수행한다. grant-use ID는 recommendation log에 unique하게 기록되어 same-event concurrent/retry insert를 막는다.

### Browser storage

- `skinTestResultWriteAccessToken`: result token
- `skinTestTrackWriteAccessToken`: track token
- `skinTestAnonymousAnalysisRunId`: analysis run ID

result token은 `/api/results` 성공 후 즉시 지운다. track token은 expiry/error 시 또는 account bearer가 확인된 client flow에서 지운다. Token은 여전히 JavaScript-readable `sessionStorage`에 있고 URL, query, cookie, localStorage에는 저장하지 않는다.

## 오류 계약

| 상황 | 코드 | HTTP |
| --- | --- | --- |
| token 누락/invalid/expired | `anonymous_write_token_required`, `anonymous_write_token_invalid`, `anonymous_write_token_expired` | 401 |
| operation/principal/resource mismatch | `anonymous_write_token_scope_mismatch`, `anonymous_write_principal_mismatch`, `anonymous_write_resource_mismatch` | 403 |
| replay/in-progress | `anonymous_write_replayed`, `anonymous_write_in_progress` | 409 또는 safe dedupe response |
| secret/RPC/service-role guard 오류 | `anonymous_write_grant_unavailable` | 503 |

응답과 log에는 raw token, jti, cookie payload, hash, resource 내부 값, SQL detail을 포함하지 않는다.

## 환경변수와 배포 순서

새 환경변수:

`ANONYMOUS_WRITE_GRANT_SECRET`

production과 local development 모두 명시적으로 설정해야 한다. `NEXT_PUBLIC_` prefix, fallback secret, 기존 signing key 재사용은 허용하지 않는다. 현재 repository에는 `.env.example` 또는 별도 환경변수 문서가 없으므로 이 문서가 key 이름과 배포 요구를 기록한다.

안전한 배포 순서:

1. migration을 검토하고 적용한다.
2. `ANONYMOUS_WRITE_GRANT_SECRET`을 production/preview 환경에 설정한다.
3. RLS, direct role grant, RPC execute metadata를 service-role-only로 확인한다.
4. application code를 배포한다.
5. disposable/approved 환경에서 anonymous 분석, result save, tracking smoke test를 수행한다.
6. replay, operation mismatch, principal mismatch를 비침해 방식으로 확인한다.
7. cleanup RPC의 scheduled 운영을 등록한다.

migration 또는 secret 없이 application code가 먼저 배포되면 anonymous grant 발급은 503으로 fail-closed한다. Account write path는 기존 Supabase account auth로 계속 동작한다.

## 검증 결과

- `node scripts/verify-anonymous-write-grant-v2.mjs`: 통과. pure token/fingerprint 계약, v1 거부, migration/RPC privilege, route/client 정적 계약 확인.
- `node scripts/verify-analysis-rls-contract.mjs`: 통과.
- `node --check`로 변경된 server JS/MJS syntax 확인.
- `npm run build`: Next.js 15.5.18 production build 통과.

새 verifier 실행 중 package의 기존 module type 설정으로 `MODULE_TYPELESS_PACKAGE_JSON` warning이 발생한다. 새 package 변경은 범위 밖이므로 수정하지 않았다.

`supabase status --output json`은 local Docker daemon이 실행 중이지 않아 container health를 확인하지 못했다. 따라서 local Supabase/Postgres migration/RPC concurrency integration test는 수행하지 않았다. 실제 migration apply, remote DB write, production API/OpenAI 호출도 수행하지 않았다.

## 남은 위험과 제외 범위

- `sessionStorage` token은 same-origin XSS 또는 device compromise에서 읽을 수 있다. principal/resource binding과 짧은 lifecycle이 피해 범위를 줄이지만 HttpOnly/BFF 전환은 별도 작업이다.
- 분산 bot, cookie 탈취, platform WAF/CDN, observability header redaction은 application grant만으로 완전히 해결되지 않는다.
- 실제 Supabase RLS/grant, `recommendation_logs` existing schema, scheduled cleanup은 배포 환경에서 별도 확인이 필요하다.
- Premium entitlement, saved report source validation, check-in, share visibility, SEC-01 rate-limit 정책은 이번 범위 밖이다.
