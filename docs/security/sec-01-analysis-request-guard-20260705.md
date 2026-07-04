# SEC-01 분석 요청 가드 구현

## 1. 목적

- 공개 AI 분석 endpoint 비용 남용 방지
- 반복 호출과 중복 제출로 인한 OpenAI 비용 증가 방지
- rate-limit/idempotency guard 실패 시 AI provider 호출 차단
- 범위 제외: premium entitlement, anonymous write token resource binding, 기존 `analysis_results`/`analysis_requests` RLS 보정, Next.js dependency update, 결제 연동

## 2. 보호 대상

- `/api/analyze`
- `/api/face-reading`

첫 화면의 정상 흐름은 분석 의도 1회에서 두 endpoint를 병렬로 각각 1회 호출한다. 따라서 quota는 endpoint별로 따로 소비한다.

## 3. 처리 순서

1. cheap input validation
2. server-side principal resolution
3. Idempotency-Key claim
4. durable quota consume
5. AI provider call
6. idempotency complete/fail
7. 기존 성공 응답 또는 안전한 guard 응답 반환

`/api/analyze`에서는 guard가 OpenAI key 조회, image base64 변환, 제품 snapshot DB 조회보다 먼저 실행된다. `/api/face-reading`에서도 guard가 OpenAI key 조회, image base64 변환, provider 호출보다 먼저 실행된다.

## 4. Principal 정책

| principal | 처리 방식 | 저장 데이터 |
| --- | --- | --- |
| authenticated user | 서버에서 Supabase user를 검증하고 anonymous user는 제외한다. | `ANALYSIS_REQUEST_GUARD_SECRET` 기반 HMAC hash |
| anonymous signed cookie | `visualry_analysis_anon` httpOnly signed cookie를 검증하거나 새로 발급한다. 인증/권한 수단이 아니라 rate limit principal이다. | cookie payload의 HMAC hash |
| IP safety ceiling | `x-forwarded-for` 첫 유효 IP, `x-real-ip`, `cf-connecting-ip`, `fly-client-ip` 순으로 보조 principal을 만든다. header 부재 시 skip하지 않는다. | IP value의 HMAC hash |

raw user id, raw IP, raw anonymous cookie payload, raw idempotency key, request body, 사진/base64, prompt, AI response는 guard DB에 저장하지 않는다.

## 5. Rate limit 정책 표

| endpoint | principal | short window | daily quota |
| --- | --- | ---: | ---: |
| `/api/analyze` | authenticated user | 5 / 1시간 | 15 / 24시간 |
| `/api/analyze` | anonymous cookie | 2 / 1시간 | 4 / 24시간 |
| `/api/analyze` | IP safety ceiling | 5 / 1시간 | 10 / 24시간 |
| `/api/face-reading` | authenticated user | 3 / 1시간 | 8 / 24시간 |
| `/api/face-reading` | anonymous cookie | 1 / 1시간 | 2 / 24시간 |
| `/api/face-reading` | IP safety ceiling | 3 / 1시간 | 5 / 24시간 |

정책 값은 `lib/security/analysis-request-guard-core.js` 한 곳에서 중앙 관리한다. 정상 사용자 흐름은 endpoint당 1회 호출이므로 기본 권장값을 유지했다. 운영 로그에서 429 비율, 정상 재분석 빈도, provider 비용을 보고 조정한다.

## 6. Idempotency 정책

- client는 분석 의도 1회마다 `crypto.randomUUID()` 기반 key를 생성해 `Idempotency-Key` header로 전송한다.
- `/api/analyze`와 `/api/face-reading`은 서로 다른 key를 사용한다.
- 같은 principal + endpoint + key + 같은 fingerprint가 `in_progress`이면 409 `analysis_request_in_progress`를 반환한다.
- 같은 key가 다른 fingerprint로 들어오면 409 `analysis_idempotency_conflict`를 반환한다.
- `completed` key는 AI provider를 다시 호출하지 않고 409 `analysis_request_already_completed`를 반환한다.
- `failed` key는 짧게 유지하고 409 `analysis_request_failed`를 반환한다. 사용자는 새 분석 의도에서 새 key로 재시도한다.
- 현재 `/api/analyze`와 `/api/face-reading`은 canonical result를 guard table에 저장하지 않는다. 민감한 분석 결과를 idempotency table에 중복 저장하지 않기 위한 선택이다.

## 7. DB 구조

Migration: `supabase/migrations/20260704221747_sec_01_analysis_request_guard.sql`

### rate window

- table: `public.analysis_request_rate_windows`
- key: `scope`, `subject_hash`, `endpoint`, `window_key`
- data: count, window start/reset, expiry
- RPC: `public.consume_analysis_rate_limits(jsonb)`
- 동작: 하나의 RPC에서 필요한 row를 deterministic order로 lock하고, 모든 bucket이 허용될 때만 count를 증가시킨다.

### idempotency

- table: `public.analysis_request_idempotency`
- key: `scope`, `subject_hash`, `endpoint`, `idempotency_key_hash`
- data: fingerprint hash, status, optional result reference, expiry
- RPC: `claim_analysis_idempotency`, `complete_analysis_idempotency`, `fail_analysis_idempotency`

### RLS / privilege

- 두 table 모두 RLS enabled
- anon/authenticated table access revoke
- RPC execute는 `public`, `anon`, `authenticated`에서 revoke하고 `service_role`에만 grant
- function은 `set search_path = public`을 명시한다.

### retention

- 모든 row에는 `expires_at`이 있다.
- cleanup RPC: `public.cleanup_analysis_request_guard(timestamptz)`
- scheduler는 이번 작업에서 도입하지 않았다. 운영에서 Supabase cron 또는 별도 job으로 cleanup RPC를 호출해야 한다.

## 8. 응답 계약

| 상태 | HTTP | body error | header |
| --- | ---: | --- | --- |
| quota exceeded | 429 | `analysis_rate_limited` | `Retry-After` |
| duplicate in-progress | 409 | `analysis_request_in_progress` | - |
| idempotency conflict | 409 | `analysis_idempotency_conflict` | - |
| already completed | 409 | `analysis_request_already_completed` | - |
| previous failed key | 409 | `analysis_request_failed` | - |
| guard unavailable | 503 | `analysis_guard_unavailable` | - |
| invalid idempotency key | 400 | `invalid_idempotency_key` | - |

503 사용자 메시지: “분석 요청을 잠시 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.”

## 9. 새 환경변수

| key | 용도 |
| --- | --- |
| `ANALYSIS_REQUEST_GUARD_SECRET` | anonymous cookie signature, principal hash, IP hash, idempotency key hash, request fingerprint hash |

규칙:

- production 필수
- `NEXT_PUBLIC_` prefix 금지
- `WRITE_ACCESS_TOKEN_SECRET` 또는 service role key와 공유 금지
- secret 누락 시 모든 환경에서 fail-closed
- rotation 시 기존 anonymous cookie와 idempotency/rate hash가 새 secret으로 검증되지 않으므로, 짧은 전환 기간의 503/429 패턴을 모니터링한다.

## 10. 배포 전 확인

- migration 적용 전 SQL review
- production/staging에 `ANALYSIS_REQUEST_GUARD_SECRET` 설정
- Supabase service role key가 server-only로 유지되는지 확인
- Vercel/proxy의 client IP header 신뢰 경로 확인
- WAF/CDN level rate limit 보조 설정
- OpenAI spend cap 및 usage alert 별도 설정
- 정상 사용자 1회 흐름이 `/api/analyze` 1회, `/api/face-reading` 1회로 유지되는지 확인
- cleanup RPC를 cron/job에 연결할지 운영 정책 결정

## 11. 알려진 한계

- 분산 bot, IP rotation, cookie reset은 application-level guard만으로 완전히 막을 수 없다.
- WAF/CDN rate limit과 provider spend cap은 별도 필요하다.
- 현재 completed idempotency 요청은 민감 결과 재저장 없이 safe 409를 반환한다.
- 이번 작업은 SEC-02 analysis table RLS/grant verification, SEC-03 Next.js dependency update, SEC-04 premium release mode fail-open 보정, SEC-05 anonymous write token resource binding/replay 방지를 포함하지 않는다.
