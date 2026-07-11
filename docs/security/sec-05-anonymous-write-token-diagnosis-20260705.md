# SEC-05 Anonymous write token 진단

## 1. 목적 및 범위

이 문서는 현재 anonymous write token의 발급, 브라우저 보관, 재전송, 서버 검증, service-role write까지의 실제 경로를 정적 코드로 확정하고 resource binding 및 replay 위험을 판정한다.

- 기준 브랜치: `codex/survey-input-contract-refactor`
- 직접 대상: `lib/write-access.js`, `/api/analyze`, `/api/results`, `/api/track` 및 해당 클라이언트
- 연관 경계: Supabase service-role client, `analysis_requests`, `analysis_results`, `recommendation_logs`, premium session, My 저장/체크인
- 수행 방식: 파일 inventory, `rg` 정적 검색, route/helper/migration 직접 검토
- 제외: 실제 token 발급 또는 재전송, DB 조회/write, Supabase 정책 변경, 외부 API 호출, migration 작성/적용, SEC-05 구현
- 비밀정보 처리: 환경 파일은 존재 여부와 관련 key 이름만 확인했으며 값은 읽어 보고하지 않았다.

이번 진단에서 말하는 anonymous write token은 Supabase anonymous Auth JWT나 SEC-01의 signed anonymous cookie가 아니다. `x-kbeauty-write-token` 헤더로 전달되는 별도 HMAC token만을 뜻한다.

## 2. 현재 token 생명주기

1. 브라우저가 한 번의 분석 의도로 `/api/analyze`와 `/api/face-reading`을 병렬 호출한다. 두 endpoint는 각각 SEC-01 durable guard를 통과한다. `app/page.js:258-301`
2. `/api/analyze`는 guard 통과 후 `createWriteAccessToken()`을 호출한다. 이 시점에는 `analysis_requests` 또는 `analysis_results` row가 생성되지 않는다. `app/api/analyze/route.js:1345-1374`
3. 분석 성공 응답에 token 원문이 `x-kbeauty-write-token` response header로 추가된다. `/api/face-reading`은 이 token을 발급하지 않는다. `app/api/analyze/route.js:1506-1518`
4. 브라우저는 header를 읽어 `sessionStorage.skinTestWriteAccessToken`에 token 원문을 저장한다. 새 분석 시작 시 이전 token을 지운다. `app/page.js:57-65`, `app/page.js:289-296`, `lib/write-access-client.js:1-25`
5. 결과 화면과 full-report 화면의 tracking caller가 token을 `/api/track`에 전송한다. 공유 동작은 같은 token을 `/api/results`에 전송한다. `app/result/page.js:450-485`, `app/result/full-report/page.js:537-572`, `components/result/ResultShareActions.jsx:171-211`
6. 두 route는 인증 사용자를 확인하지 못한 경우 같은 기본 scope인 `analysis-write`로 token을 검증한다. `app/api/results/route.js:194-202`, `app/api/track/route.js:95-107`
7. 검증이 성공하면 service-role client가 DB write를 수행한다. `/api/results`는 새 `analysis_requests`와 public `analysis_results`를 만들고, `/api/track`은 `recommendation_logs`를 insert한다.
8. token은 production 24시간, development 7일 후 만료된다. 별도 revoke, consume, 사용 횟수 또는 사용 기록은 없다. `lib/write-access.js:6-8`, `lib/write-access.js:78-89`

현재 token은 성공한 `/api/analyze` 응답과 함께 발급되지만, 성공 결과의 ID나 결과 fingerprint와 연결되지 않는다. 따라서 “분석 A의 token”이라는 서버측 resource 관계가 실제로 생성되지 않는다.

## 3. 실제 관련 파일과 함수

| 파일 | 함수/위치 | 역할 |
| --- | --- | --- |
| `lib/write-access.js` | `getWriteAccessSecret`, `createWriteAccessToken`, `verifyWriteAccessToken` (`19-91`) | HMAC 서명 token 발급/검증 |
| `lib/write-access.js` | `getRequestClientKey`, `consumeRateLimit` (`95-131`) | IP 문자열 기반 process-memory 제한. token consume과 무관 |
| `lib/write-access-client.js` | 전체 (`1-25`) | raw token을 `sessionStorage`에 저장/조회/삭제 |
| `app/api/analyze/route.js` | `POST` (`1249-1579`), token 발급 (`1373`, `1516-1518`) | 성공한 무료 분석 응답 header로 token 전달 |
| `app/page.js` | `runAnalyze` (`258-339`) | token 수신 및 browser 저장, 새 분석 시 이전 token 삭제 |
| `app/api/results/route.js` | `POST` (`116-266`) | anonymous token 검증 후 public analysis request/result 생성 |
| `app/api/track/route.js` | `POST` (`95-245`) | anonymous token 검증 후 recommendation log 생성 |
| `components/result/ResultShareActions.jsx` | `saveResult` (`171-236`) | `/api/results`에 token과 client-held result/submission 전송 |
| `app/result/page.js` | `trackEvent` (`450-485`) | `/api/track`에 token과 tracking payload 전송 |
| `app/result/full-report/page.js` | `trackEvent` (`537-572`) | premium 화면 tracking에도 같은 token 사용 |
| `lib/analysis-results.js` | row builders (`244-312`) | client result/submission을 정리해 DB row로 변환; owner/public/ID는 서버가 설정 |
| `lib/supabase-admin.js` | `createSupabaseAdminClient` (`4-29`) | service role client 생성; browser import는 `server-only`로 차단 |
| `lib/premium-report-session.js` | `getSecret` (`12-17`) | premium session이 write token과 같은 secret fallback chain 사용 |
| `lib/analysis-result-access.js` | `getAnalysisResultForShare` (`30-58`) | public 결과 또는 owner가 확인된 private 결과만 조회 |
| `supabase/migrations/20260424_align_analysis_results_share_schema.sql` | `5-155` | analysis request/result schema와 share ID unique index |
| `supabase/migrations/20260704221747_sec_01_analysis_request_guard.sql` | 전체 | SEC-01 durable rate limit/idempotency 패턴. write token consume은 포함하지 않음 |

## 4. Anonymous write 전체 흐름

### 실제 사용자 흐름

- anonymous 분석: `/api/analyze`와 `/api/face-reading`이 AI 결과를 반환한다. 애플리케이션의 canonical `analysis_results` row는 이 단계에 생성되지 않는다.
- 결과 보관: 결과와 설문은 브라우저 `sessionStorage`에 저장된다. 이미지 preview도 browser session에 남지만 anonymous DB save builder는 inline image를 제거하고 DB `image_url`을 `null`로 둔다.
- 결과 저장/공유: 공유 버튼이 browser-held `result`와 `submission` 전체를 `/api/results`에 다시 보내며, token 검증 후 새 request/result row를 public 상태로 생성한다.
- 결과 조회: `/r/[shareId]` 또는 `/api/results/[shareId]`가 public row를 조회한다. private row는 owner 검증이 필요하다.
- 결과 수정/보강: anonymous token으로 기존 result를 update하는 route는 확인되지 않았다. 기존 share publish branch는 account owner ID가 필요하다.
- tracking: free result와 premium 화면에서 같은 token으로 `/api/track` event를 여러 번 기록한다.
- My 저장: `/api/my/save-report`는 non-anonymous account를 요구하며 token을 받지 않는다. `skin_profiles`, private `analysis_results`, `saved_reports`를 account user ID로 생성한다.
- premium session/full report: 별도 signed httpOnly cookie와 `premium_report_sessions`를 사용한다. write token은 full-report 생성/저장 권한으로 사용되지 않고 UI tracking에만 사용된다.
- check-in/diary: `/api/my/check-in`은 Supabase user와 user-scoped DB query/RLS 경계를 사용하며 write token을 받지 않는다.
- 현재 제품 입력: `/api/analyze` 및 `/api/full-report` payload에 포함되지만 write token이 해당 입력 권한을 부여하지 않는다.

### Write 경로 표

| Write 경로 | Endpoint/function | 인증 사용자 | Anonymous 허용 | 사용 token | 대상 table | 대상 resource ID | 서버 ownership 검증 | 재사용 방지 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI guard 상태 | `/api/analyze` -> `guardAnalysisRequest` | 허용 | 허용 | SEC-01 idempotency key/cookie, write token 아님 | `analysis_request_rate_windows`, `analysis_request_idempotency` | principal/endpoint/key hash | SEC-01 principal 검증 | SEC-01 request idempotency만 존재 |
| free result 신규 저장/공개 | `POST /api/results` | 허용 | 허용 | `analysis-write` token | `analysis_requests`, `analysis_results` | 서버 신규 UUID/share ID | account는 user ID 설정; anonymous는 owner resource 없음 | 없음 |
| 기존 private share 공개 전환 | `POST /api/results`의 `publishExistingShare` | owner account만 | token만으로 불가 | account bearer/session | `analysis_results` | client `shareId` | `share_id`와 `user_id` 동시 조건 | token replay와 무관 |
| recommendation event | `POST /api/track` | 허용 | 허용 | 동일 `analysis-write` token | `recommendation_logs` | client `session_id` 등 | account user ID는 서버 설정; anonymous resource owner 없음 | `feedback_response` 일부 best-effort lookup 외 없음 |
| My report 저장 | `POST /api/my/save-report` | non-anonymous account만 | 불가 | Supabase session | `skin_profiles`, `analysis_requests`, `analysis_results`, `saved_reports` | 서버 ID + account user ID | `isAccountUser`, user ID 고정 | token과 무관 |
| premium report session 생성 | `/api/analyze` -> `createPremiumReportSession` | premium access 정책 | 익명 beta 정책에서는 별도 premium gate 기준 | premium cookie token | `premium_report_sessions` | 서버 random session ID | premium access + 별도 scope | stateful session 검증 |
| full report 생성/재조회/저장 | `POST /api/full-report` | account 또는 허용 premium session | release policy가 허용한 session만 | premium cookie, account bearer | `premium_report_sessions`, `saved_reports` | premium session ID/saved report ID | premium access와 `user_id` 조건 | write token과 무관 |
| 체크인/diary | `POST /api/my/check-in` | Supabase user | anonymous write token으로 불가 | Supabase cookie session | `daily_checkins`, `routine_logs` | account user/date | `user_id` 고정 및 RLS 전제 | date unique upsert, token과 무관 |

## 5. Token payload·서명·검증 구조

### 발급 구조

| 항목 | 확인 결과 |
| --- | --- |
| 형식 | base64url JSON payload + `.` + base64url HMAC signature |
| 알고리즘 | HMAC-SHA-256 (`crypto.createHmac`) |
| secret | `WRITE_ACCESS_TOKEN_SECRET`; 없으면 `SUPABASE_SERVICE_ROLE_KEY`; development에서는 다시 고정 local fallback |
| server-only | `lib/write-access.js`가 `server-only` import. 직접 import는 API route에 한정 |
| random/entropy | `randomBytes(12)` nonce, 96-bit. `Math.random()`은 token 발급에 사용하지 않음 |
| TTL | production 24시간, development 7일 |
| 발급 주체/시점 | `/api/analyze`, SEC-01 guard 통과 후 결과 생성 전 |
| 전달 | 성공 response의 `x-kbeauty-write-token` header |
| browser 저장 | raw token을 `sessionStorage.skinTestWriteAccessToken`에 저장 |
| DB/log 저장 | raw token 또는 nonce를 DB에 저장하는 코드는 확인되지 않음. raw token을 명시적으로 log하는 코드도 확인되지 않음 |

### Payload/claim

| Claim | 서명 payload 포함 | 검증에 사용 | 판정 |
| --- | --- | --- | --- |
| token version | 아니오 | 아니오 | legacy/new 형식 구분 불가 |
| `scope` | 예 | 예상 scope와 exact 비교 | 기본값 `analysis-write`; 두 write endpoint가 공유 |
| purpose | 별도 없음 | 아니오 | scope가 넓은 purpose 역할을 겸함 |
| subject/account/anonymous identity | 아니오 | 아니오 | browser/principal binding 없음 |
| analysis request ID | 아니오 | 아니오 | 발급 시 canonical request row 자체가 없음 |
| analysis result ID | 아니오 | 아니오 | 발급 시 canonical result row 자체가 없음 |
| saved report/premium session ID | 아니오 | 아니오 | 해당 resource에는 token이 사용되지 않음 |
| resource type | 아니오 | 아니오 | results와 tracking을 구분하지 않음 |
| allowed operation | 아니오 | 아니오 | create result와 insert event를 구분하지 않음 |
| issued at | 아니오 | 아니오 | expiration만 존재 |
| `exp` | 예 | 현재 시각과 비교 | 만료 후 fail-closed |
| `nonce` | 예 | 존재/형식/사용 여부 미검증 | random이지만 replay 방어로 사용되지 않음 |
| request fingerprint | 아니오 | 아니오 | 다른 body 제출을 구분하지 않음 |

### 검증 구조

- secret 누락 시 `misconfigured`로 거부한다.
- token shape, HMAC signature, JSON parse, `exp`, exact `scope`를 확인한다.
- signature 비교는 길이 확인 후 `timingSafeEqual`을 사용한다.
- malformed, 변조, 만료, scope 불일치는 fail-closed다.
- resource ID/type, operation, version, principal, request fingerprint는 확인하지 않는다.
- `nonce`/jti consumption 조회, already-used 거부, revoke는 없다.

## 6. Resource binding 분석

### 가설 A: 다른 분석 결과에 재사용

**판정: 기존 타인 결과 B 직접 변경은 not-reproducible, 임의의 새 결과 B 생성은 confirmed.**

- token에는 분석 A의 request/result ID 또는 fingerprint가 없다.
- `/api/results` 신규 저장 query는 client body의 `result`와 `submission`을 사용해 server-generated request ID/share ID를 만든다.
- 한 token으로 payload를 바꾸어 여러 새 public result를 생성할 수 있다.
- 반면 client `shareId=B`로 기존 share를 publish하는 branch는 token 검증 branch보다 먼저 account owner를 구하고, update query에 `share_id=B AND user_id=currentUser`를 적용한다. token만으로 기존 타인 row를 update하지는 못한다. `app/api/results/route.js:86-103`, `172-202`

### 가설 B: 다른 resource type에 재사용

**판정: `/api/results`와 `/api/track` 사이 재사용은 confirmed. 나머지는 not-applicable.**

- 같은 기본 `analysis-write` scope가 public result 생성과 recommendation log insert에 사용된다.
- `saved_reports`, premium session/full report, check-in/diary는 별도 account/premium session 경계를 사용하고 write token을 검증하지 않는다.

### 가설 C: 다른 operation에 재사용

**판정: create-public-result와 insert-tracking-event 교차 사용은 confirmed.**

- token에 operation claim이 없다.
- existing result update/delete, visibility publish는 write token만으로 허용되지 않는다.
- protected DB column은 route/builder가 정한다. anonymous `user_id`는 `null`, `share_id`는 서버 생성, `is_public`은 `true`, `image_url`은 `null`이다.
- 다만 `result_json.result`, survey form, summary, product metadata 등의 내용은 client-held payload에서 만들어지므로, token은 canonical AI output임을 보증하지 않는다. `lib/analysis-results.js:244-312`

### 가설 D: 다른 익명 브라우저에서 재사용

**판정: confirmed.**

token은 account, SEC-01 signed anonymous cookie principal, browser cookie, IP와 결속되지 않는다. token 원문을 복사한 다른 unauthenticated browser는 TTL 내 같은 `/api/results`와 `/api/track` 검증을 통과할 수 있다. IP in-memory limiter는 token identity가 아니며 browser 변경 또는 serverless instance 분산에서 안정적인 binding이 아니다.

### 가설 E: 로그인 후 anonymous token 사용

**판정: account impersonation은 not-reproducible, token 잔존/재사용은 confirmed.**

- route가 유효한 account bearer user를 확인하면 token을 검증하지 않고 account user ID로 처리한다.
- anonymous token은 로그인으로 account resource에 귀속되거나 폐기되지 않는다. 같은 tab의 `sessionStorage`에 남아 만료 전까지 유효하다.
- token 자체로 account-owned result, saved report 또는 premium entitlement를 얻는 경로는 확인되지 않았다.

## 7. Replay 분석

| 상태 | 현재 예상 동작 | 근거/제약 |
| --- | --- | --- |
| 완전히 동일한 `/api/results` 재전송 | 매번 새 request/result/share 생성 가능 | token consume, idempotency, body fingerprint 없음 |
| 같은 token + 다른 result/submission | shape 조건을 만족하면 새 public result 생성 가능 | token과 payload 관계 없음 |
| 같은 token + 다른 기존 share ID | owner account 없으면 401 | 기존 publish branch의 owner scope가 방어 |
| 같은 token + `/api/track` | 허용 | 같은 scope 공유 |
| 같은 token + 다른 tracking payload | allowlisted event이면 반복 insert 가능 | 일부 길이 제한과 event allowlist만 적용 |
| 같은 `feedback_response` 재전송 | 특정 client-controlled 필드가 같으면 dedupe될 수 있음 | select-then-insert이며 token consume이 아니고 동시 race 가능 |
| token 만료 후 | 401 | `exp` 검증 존재 |
| 동시에 2개 `/api/results` | 동일 instance IP limit 범위 내에서 모두 token 검증/DB insert 가능 | atomic consume/unique jti 없음 |
| 첫 요청 처리 중 재요청 | 별도 in-progress 상태 없이 처리 가능 | token 상태 table 없음 |
| 첫 요청 성공 후 재요청 | 다시 처리 가능 | completed 상태 없음 |
| 첫 요청 downstream 실패 후 재요청 | token이 만료되지 않았다면 다시 처리 가능 | 실패/lease/retry 정책 없음 |
| token revoke | 불가 | token별 server state 없음 |

`nonce`는 payload의 무작위 값일 뿐이다. DB table, unique constraint, atomic consume RPC, use counter, request fingerprint와 연결되지 않아 replay 방어 효과가 없다.

### SEC-01 idempotency와의 역할 구분

| 기능 | 현재 SEC-01 | SEC-05에서 필요한 기능 |
| --- | --- | --- |
| AI request 중복 방지 | endpoint + principal + idempotency key + request fingerprint | 그대로 유지 |
| anonymous DB write 권한 | 제공하지 않음 | 발급된 분석 run과 resource/operation을 결속 |
| token replay 방지 | 제공하지 않음 | jti hash의 atomic claim/complete/fail 및 사용 제한 |

세 역할을 하나로 합치면 AI retry key가 DB 권한 token처럼 장기간 사용되거나, tracking의 다회 event 요구가 single-use 분석 idempotency를 약화시킬 수 있다. SEC-01 table을 그대로 재목적화하지 말고 principal 해석/HMAC hash/atomic RPC 패턴만 재사용해야 한다.

## 8. DB/RLS/service-role 경계

- `/api/results`와 `/api/track`은 `createSupabaseAdminClient()`를 사용한다. service role은 RLS를 우회하므로 route 검증이 실질적인 anonymous write 권한 경계다.
- `/api/results`는 token signature만 확인한 뒤 새 row를 insert한다. token resource ownership을 확인할 별도 DB row가 없다.
- existing share publish는 `share_id`와 authenticated `user_id`를 동시에 필터하므로 anonymous token에 의해 우회되지 않는다.
- anonymous 신규 저장에서 `user_id`는 `null`, `share_id`는 서버 random, `is_public`은 `true`로 고정된다. client가 owner/public flag를 직접 지정하지는 못한다.
- `result_json`과 `survey_json`의 실제 내용은 client payload에서 구성된다. inline image와 일부 raw signal blob은 제거되지만 canonical AI response 여부는 검증하지 않는다.
- `/api/track`은 event allowlist와 길이 제한을 적용하고 `user_id`를 서버에서 정한다. 하지만 anonymous event가 특정 분석 run에서 발생했다는 ownership/resource 검증은 없다.
- repository migration에는 `recommendation_logs` 정의가 없으며, production의 실제 constraints/RLS/grants는 코드만으로 확인할 수 없다.
- analysis table의 repository schema migration은 table/index를 만들지만, 실제 production RLS/grant 상태는 이번 진단에서 조회하지 않았다. 별도 SEC-02 배포 검증 범위다.

## 9. Token 노출 가능 경로

| 경로 | 상태 | 근거 |
| --- | --- | --- |
| `NEXT_PUBLIC_` env | 확인되지 않음 | secret 이름은 server-only `WRITE_ACCESS_TOKEN_SECRET` |
| client import graph에 secret helper 포함 | 확인되지 않음 | `lib/write-access.js`는 `server-only`, API route만 import |
| response body | 없음 | response header로만 전달 |
| URL/query/browser history/referrer | 없음 | token을 URL에 붙이는 코드 미확인 |
| cookie | 없음 | write token은 cookie가 아니라 sessionStorage/header 사용 |
| localStorage | 없음 | `sessionStorage` 사용 |
| sessionStorage | confirmed | same-origin script/XSS가 raw token을 읽을 수 있음 |
| React hydration props | 확인되지 않음 | token은 client fetch response에서 직접 저장 |
| explicit application log | 확인되지 않음 | raw token을 console에 전달하는 코드 미확인 |
| API error response | 확인되지 않음 | token 원문을 body에 반영하지 않음 |
| platform header logging/APM | 설정 검증 필요 | Vercel/drain/APM의 request/response header redaction은 repository 밖 설정 |
| source map/debug endpoint | 설정 검증 필요 | server secret 자체는 source에 없으나 production source map/log 정책은 배포 설정 확인 필요 |

`sessionStorage`는 URL 노출을 줄이고 tab lifetime으로 범위를 제한하지만 bearer token 탈취 방어는 아니다. 현재 token은 principal binding이 없어 원문을 얻은 same-origin 악성 script가 다른 browser에서 재사용할 수 있다.

## 10. Findings

상태 집계: confirmed 5, likely 0, needs-deployment-verification 3. 최고 심각도는 High다.

### [SEC-05-01] 하나의 generic scope가 public result와 tracking write를 함께 허용한다

* 심각도: High
* 상태: confirmed
* 실제 파일: `lib/write-access.js`, `app/api/results/route.js`, `app/api/track/route.js`, `lib/analysis-results.js`
* 함수/코드 위치: `createWriteAccessToken`/`verifyWriteAccessToken` (`lib/write-access.js:31-91`), results token gate (`app/api/results/route.js:194-237`), track token gate (`app/api/track/route.js:95-107`)
* token 발급 경로: 성공한 `POST /api/analyze` 응답 header
* token 검증 경로: `POST /api/results`, `POST /api/track`의 동일 기본 `analysis-write` scope
* 허용되는 write: 새 `analysis_requests`, 새 public `analysis_results`, allowlisted `recommendation_logs`
* 공격 전제조건: 공격자가 자신에게 정상 발급된 token 또는 탈취한 유효 token 원문을 보유
* resource binding 상태: analysis request/result ID, output fingerprint, resource type 결속 없음
* replay 방어 상태: 없음
* 예상 영향: 임의 client payload를 AI 결과처럼 public 저장, public share/DB row 증가, recommendation analytics 오염
* 현재 방어: HMAC signature, expiration, scope, result shape check, event allowlist, server-set owner/public columns
* 방어의 한계: signature는 token 위조만 막고 token이 어느 결과와 operation을 허용하는지는 증명하지 못함
* 최소 보정 방향: server-generated analysis run grant에 token을 bind하고 `result:create`와 `track:create`를 명시적으로 구분; result payload fingerprint를 grant와 비교
* 검증 테스트 제안: 유효 token으로 다른 result body, 다른 operation, 다른 endpoint를 제출하고 모두 provider/DB write 전에 거부되는지 확인
* SEC-01 구조 재사용 가능 여부: principal hash와 stable HMAC fingerprint 패턴은 가능; idempotency table 직접 재사용은 부적절
* 추가 확인 필요: production에서 anonymous result/track row가 운영 의사결정에 사용되는 범위

### [SEC-05-02] nonce가 소비되지 않아 동일·동시 replay가 반복 write로 이어진다

* 심각도: Medium
* 상태: confirmed
* 실제 파일: `lib/write-access.js`, `app/api/results/route.js`, `app/api/track/route.js`
* 함수/코드 위치: nonce 생성 (`lib/write-access.js:37-46`), memory limiter (`109-131`), results inserts (`app/api/results/route.js:26-83`, `223-237`), track dedupe/insert (`app/api/track/route.js:172-208`)
* token 발급 경로: `/api/analyze`에서 매 성공 응답마다 random nonce 포함 token 발급
* token 검증 경로: signature/expiration/scope만 확인
* 허용되는 write: 동일 token으로 여러 result/request/log row 생성
* 공격 전제조건: 유효 token과 허용 payload 보유
* resource binding 상태: 없음
* replay 방어 상태: token consumption table, jti unique, in-progress/completed 상태, atomic RPC 없음
* 예상 영향: 중복 public result, 저장량 증가, tracking event 중복 및 동시 요청 race
* 현재 방어: process-memory IP limiter; `feedback_response`의 일부 select-before-insert dedupe
* 방어의 한계: serverless instance 간 공유되지 않으며, feedback dedupe는 token과 무관하고 unique/transaction 근거가 repository에 없음
* 최소 보정 방향: HMAC-hashed jti를 durable table에서 atomic claim/complete/fail하고 result create는 1회, track은 bounded multi-use + event fingerprint dedupe로 분리
* 검증 테스트 제안: 동일 token 순차 2회, 동시 2회, 처리 중/성공 후/실패 후 retry matrix
* SEC-01 구조 재사용 가능 여부: row lock, unique key, in-progress timeout, complete/fail, cleanup RPC 패턴 재사용 가능
* 추가 확인 필요: production platform-level distributed rate limit/WAF 존재 여부

### [SEC-05-03] token이 anonymous principal에 결속되지 않아 browser 간 이식 가능하다

* 심각도: Medium
* 상태: confirmed
* 실제 파일: `lib/write-access.js`, `lib/write-access-client.js`, `app/api/results/route.js`, `app/api/track/route.js`
* 함수/코드 위치: payload (`lib/write-access.js:37-46`), sessionStorage (`lib/write-access-client.js:1-25`), anonymous gates (`app/api/results/route.js:194-202`, `app/api/track/route.js:97-107`)
* token 발급 경로: `/api/analyze` response header
* token 검증 경로: account user가 없으면 generic token만 검증
* 허용되는 write: 다른 unauthenticated browser에서도 result/track write
* 공격 전제조건: token 원문이 browser extension, same-origin script, client device 공유 등으로 복사됨
* resource binding 상태: account, SEC-01 signed anonymous cookie, IP와 결속 없음
* replay 방어 상태: 없음
* 예상 영향: token 탈취 시 원래 browser와 무관하게 TTL 동안 anonymous write 권한 행사
* 현재 방어: sessionStorage는 tab-scoped이고 URL/referrer에 token을 넣지 않음
* 방어의 한계: bearer token 자체는 이식 가능하며 server가 현재 anonymous principal과 발급 principal을 비교하지 않음
* 최소 보정 방향: SEC-01 anonymous principal hash를 server-side grant row에 저장하고 모든 consume RPC에서 현재 principal hash와 비교
* 검증 테스트 제안: 같은 token을 다른 signed anonymous cookie principal에서 사용, 로그인 전후 사용, account 귀속 후 사용
* SEC-01 구조 재사용 가능 여부: signed cookie 검증과 subject hash 생성 경로 재사용 가능. quota consume은 호출하면 안 됨
* 추가 확인 필요: production CSP와 third-party script 목록

### [SEC-05-04] write token과 premium session이 service-role까지 포함한 secret fallback chain을 공유한다

* 심각도: Low
* 상태: confirmed
* 실제 파일: `lib/write-access.js`, `lib/premium-report-session.js`
* 함수/코드 위치: `getWriteAccessSecret` (`lib/write-access.js:19-25`), `getSecret` (`lib/premium-report-session.js:12-17`)
* token 발급 경로: write token과 premium cookie가 별도 payload/scope로 발급
* token 검증 경로: 각 helper가 scope를 별도로 확인
* 허용되는 write: 직접적인 cross-scope token 재사용은 확인되지 않음
* 공격 전제조건: 공유 signing secret 또는 fallback service-role key가 노출됨
* resource binding 상태: 해당 없음
* replay 방어 상태: write token에는 없음; premium session은 별도 stateful row 사용
* 예상 영향: 한 secret 노출의 blast radius 확대, service-role key가 signing key 역할까지 수행
* 현재 방어: server-only import, HMAC scope check, production에서 secret이 모두 없으면 fail-closed
* 방어의 한계: 목적별 key compartmentalization이 없고 explicit write secret 누락이 privileged DB key 사용으로 조용히 전환됨
* 최소 보정 방향: `WRITE_ACCESS_TOKEN_SECRET`을 production 필수로 만들고 service-role/dev literal fallback 제거; premium session은 별도 secret으로 분리 검토
* 검증 테스트 제안: 각 secret 누락/분리/rotation matrix와 cross-scope token 거부
* SEC-01 구조 재사용 가능 여부: SEC-01 secret과 공유하면 안 됨
* 추가 확인 필요: production에서 두 env 값이 실제로 분리되어 있는지

### [SEC-05-05] raw bearer token이 sessionStorage에 보관된다

* 심각도: Low
* 상태: confirmed
* 실제 파일: `lib/write-access-client.js`, `app/page.js`
* 함수/코드 위치: session key/read/write (`lib/write-access-client.js:1-25`), response header 수신 (`app/page.js:289-296`)
* token 발급 경로: `/api/analyze` response header
* token 검증 경로: client가 header로 재전송
* 허용되는 write: token 탈취 후 anonymous result/track write
* 공격 전제조건: same-origin script 실행, 악성 browser extension 또는 client device 접근
* resource binding 상태: principal binding이 없어 탈취 후 이식 가능
* replay 방어 상태: 없음
* 예상 영향: TTL 내 bearer 권한 탈취
* 현재 방어: sessionStorage는 URL/referrer와 다른 tab/재시작 노출을 줄임; 새 분석 시 삭제
* 방어의 한계: httpOnly가 아니며 JavaScript가 token 원문에 접근해야 하는 구조
* 최소 보정 방향: resource/principal binding과 짧은 TTL/consume을 우선 적용; 향후 BFF httpOnly cookie 전환은 UX/CSRF 설계와 함께 별도 평가
* 검증 테스트 제안: token이 URL/body/log에 나타나지 않는 정적 검사, XSS 위협 모델 하 principal-bound token의 이식 거부
* SEC-01 구조 재사용 가능 여부: signed httpOnly anonymous cookie principal을 보조 binding으로 사용할 수 있음
* 추가 확인 필요: production CSP, analytics/error recorder의 storage/header 수집 여부

### [SEC-05-06] production secret 분리·강도·rotation 상태는 코드만으로 확정할 수 없다

* 심각도: Info
* 상태: needs-deployment-verification
* 실제 파일: `lib/write-access.js`, `lib/premium-report-session.js`, local env key inventory
* 함수/코드 위치: 두 secret fallback helper
* token 발급 경로: server env에 의존
* token 검증 경로: 동일 env chain 사용
* 허용되는 write: secret 상태에 따라 모든 write token 검증에 영향
* 공격 전제조건: weak/shared/missing secret 또는 잘못된 rotation
* resource binding 상태: 코드상 미구현
* replay 방어 상태: 코드상 미구현
* 예상 영향: key compromise blast radius 또는 배포 장애
* 현재 방어: local env에는 key 이름이 존재하고 secret 값은 browser env가 아님
* 방어의 한계: 값의 강도, 동일값 여부, production 설정, rotation 절차는 repository로 확인 불가
* 최소 보정 방향: Vercel production/preview 환경에서 key 존재·분리 여부를 값 노출 없이 확인하고 rotation runbook 마련
* 검증 테스트 제안: secret을 출력하지 않는 boolean env preflight와 rotation 후 legacy token 거부
* SEC-01 구조 재사용 가능 여부: 별도 secret 유지 필요
* 추가 확인 필요: Vercel Project Settings > Environment Variables 및 접근 감사 로그

### [SEC-05-07] production RLS/grant와 recommendation_logs constraint는 배포 검증이 필요하다

* 심각도: Info
* 상태: needs-deployment-verification
* 실제 파일: `supabase/migrations/20260424_align_analysis_results_share_schema.sql`, `app/api/results/route.js`, `app/api/track/route.js`
* 함수/코드 위치: analysis schema (`5-155`), service-role writes (`app/api/results/route.js:26-83`, `app/api/track/route.js:130-208`)
* token 발급 경로: 영향 없음
* token 검증 경로: route-level gate
* 허용되는 write: service-role insert
* 공격 전제조건: DB grants/RLS가 repository 의도와 다르거나 direct client access가 열림
* resource binding 상태: route token에는 없음
* replay 방어 상태: repository에서 recommendation log unique/consume constraint를 확인할 수 없음
* 예상 영향: route 외 direct write/read 또는 중복 log 확대
* 현재 방어: server-only service-role helper, account tables에 대한 repository RLS migrations
* 방어의 한계: actual production policies/grants와 `recommendation_logs` schema는 이번 진단에서 조회하지 않음
* 최소 보정 방향: SEC-02 방식의 read-only catalog query로 table RLS, role grants, policies, indexes/constraints 확인
* 검증 테스트 제안: anon/authenticated direct access 거부와 service-role RPC-only consume 확인
* SEC-01 구조 재사용 가능 여부: service-role-only RPC privilege contract 참고 가능
* 추가 확인 필요: Supabase Dashboard > Database > Policies/Roles 및 read-only catalog 결과

### [SEC-05-08] platform header redaction과 distributed abuse control은 배포 설정 확인이 필요하다

* 심각도: Info
* 상태: needs-deployment-verification
* 실제 파일: `lib/write-access.js`, `/api/results`, `/api/track`, OWASP audit deployment checklist
* 함수/코드 위치: custom header (`lib/write-access.js:4`), process-memory limiter (`95-131`)
* token 발급 경로: response custom header
* token 검증 경로: request custom header
* 허용되는 write: results/track
* 공격 전제조건: platform/APM이 custom header를 수집하거나 WAF가 전혀 없음
* resource binding 상태: 없음
* replay 방어 상태: application-level durable consume 없음
* 예상 영향: operational log를 통한 token 노출 또는 분산 반복 요청 완화 부족
* 현재 방어: application code는 raw token을 명시적으로 log하지 않음
* 방어의 한계: Vercel logs/drains, reverse proxy, APM redaction과 WAF는 repository로 확인 불가
* 최소 보정 방향: header redaction 확인, endpoint별 WAF 보조 제한, alerting 추가. 이는 stateful consume을 대체하지 않음
* 검증 테스트 제안: synthetic non-secret header로 log capture 정책 확인, WAF threshold smoke test는 승인된 비운영 환경에서만 수행
* SEC-01 구조 재사용 가능 여부: SEC-01 durable quota는 AI endpoint 전용이며 results/track replay 방어를 대체하지 않음
* 추가 확인 필요: Vercel Firewall/Logs/Drains와 외부 observability 설정

## 11. 권장 최소 구현 설계

### 권장 결론

**stateful resource-bound grant + atomic operation consume**를 권장한다. Stateless signed token에 짧은 만료만 추가하는 방식은 동일/동시 replay와 다른 body 제출을 막지 못한다.

### Token claim 권장 계약

token에 필요한 최소 claim:

- `version`: 새 형식과 legacy 형식 구분
- `purpose`: 예: `anonymous-analysis-write`
- `resourceType`: `analysis-run`
- `resourceId`: `/api/analyze` 성공 시 생성한 server-side write grant ID
- `allowedOperations`: 최소 `result:create`, `track:create`의 explicit allowlist. 구현 가능하면 operation별 token으로 더 좁힌다.
- `issuedAt`
- `expiresAt`
- `jti`: cryptographically random identifier

token에 넣지 않을 값:

- raw user ID, raw anonymous cookie, raw IP
- result/submission/image/prompt/AI response
- stable anonymous principal hash. 이 값은 client-readable claim보다 server-side grant row에 저장하는 편이 낫다.

서명에는 전용 `WRITE_ACCESS_TOKEN_SECRET`만 사용한다. `SUPABASE_SERVICE_ROLE_KEY`, `ANALYSIS_REQUEST_GUARD_SECRET`, premium session secret fallback을 사용하지 않는다.

### Resource binding

현재는 token 발급 시 `analysis_result_id`가 없으므로 token을 존재하지 않는 result ID에 묶을 수 없다. 대신 `/api/analyze` 성공 시 server-generated `analysis-run` grant를 생성한다.

- grant는 SEC-01에서 검증한 현재 anonymous principal hash에 결속한다.
- 분석 input fingerprint와 별도로, 실제 반환할 public result 및 저장 가능한 submission의 stable HMAC fingerprint를 grant에 기록한다.
- `/api/results`는 현재 principal, grant, `result:create` operation, body fingerprint를 모두 확인한 뒤 한 번만 DB write한다.
- 성공 시 새 `analysis_results.id`/`share_id`를 canonical reference로 complete하여 동일 retry에는 provider/DB insert 없이 기존 safe reference를 반환한다.
- `/api/track`은 같은 analysis-run에만 event를 연결하고, operation별 최대 사용 수 및 event fingerprint 중복을 atomic하게 적용한다. 현재 client `session_id`는 authorization resource ID로 신뢰하지 않는다.
- `saved_reports`, premium session, full report, check-in은 기존 account/premium 경계를 유지하며 이 grant의 allowed operation에 넣지 않는다.

### Replay 방어 방식 비교

| 방식 | 장점 | 한계 | 판정 |
| --- | --- | --- | --- |
| Stateless signed token + 짧은 만료 | migration 없음 | 동일/동시 replay와 다른 body를 막지 못함 | 불충분 |
| Stateful one-time token | 단순하고 result create에 강함 | tracking의 정상 다회 event와 맞지 않음 | result operation에 적합 |
| jti consumption table | atomic consume, revoke/retention 가능 | migration/RPC 필요 | 기본 권장 |
| resource version/counter | bounded multi-use에 적합 | exact duplicate 식별은 별도 필요 | tracking 보조 |
| idempotency fingerprint 결합 | retry와 conflict를 구분 | authorization binding을 단독으로 대체하지 못함 | jti와 결합 권장 |

권장 DB 개념:

- `anonymous_write_grants`: grant ID, HMAC-hashed jti, SEC-01 anonymous subject hash, resource type/ID, expected payload fingerprint hash, allowed operation, expiry, bounded counters, timestamps
- `anonymous_write_consumptions`: grant, operation, request fingerprint hash, `in_progress/completed/failed`, canonical reference, lease/expiry
- result create에 `(grant_id, operation)` 단일 활성 row를 보장하는 unique constraint
- tracking에는 `(grant_id, operation, request_fingerprint_hash)` unique와 atomic bounded counter
- RLS enable, anon/authenticated direct 권한 revoke, service-role-only RPC, fixed `search_path`, raw token/jti/cookie/IP 미저장
- `expires_at` index와 service-role-only cleanup RPC. scheduler 연결은 배포 runbook에 명시

상태 전이:

1. token signature/claim과 현재 anonymous principal 확인
2. operation 및 body/event fingerprint 계산
3. RPC atomic claim
4. 신규 claim만 service-role downstream write
5. 성공 시 canonical reference로 complete
6. transient failure 시 failed/lease expiry 후 **같은 fingerprint만** retry 허용
7. 다른 fingerprint, 다른 principal, 다른 operation은 conflict/unauthorized로 거부
8. guard DB/RPC 실패는 write 전에 fail-closed

## 12. 예상 수정 파일

후속 구현의 최소 예상 범위다. 실제 구현 전 최신 worktree를 다시 확인해야 한다.

| 파일 | 예상 변경 |
| --- | --- |
| `lib/write-access.js` | versioned claim, 전용 secret 필수화, resource/operation 검증, raw identity 미저장 helper |
| `lib/security/analysis-request-guard.js` 또는 작은 공용 server helper | quota consume 없이 SEC-01 signed anonymous principal을 재확인할 수 있는 단일 경로 추출 |
| `app/api/analyze/route.js` | 성공 결과 fingerprint와 write grant 생성 후 bound token 발급 |
| `app/api/results/route.js` | service-role insert 전 atomic claim, fingerprint 비교, complete/fail/replay reference 반환 |
| `app/api/track/route.js` | operation-bound atomic consume, bounded count, event replay dedupe |
| `lib/write-access-client.js` | token version/expiry 오류 시 안전한 clear; 가능하면 기존 API 유지 |
| `components/result/ResultShareActions.jsx` | replayed canonical share response와 conflict 처리. token header 계약이 유지되면 최소 변경 |
| `app/result/page.js`, `app/result/full-report/page.js` | tracking event intent fingerprint/ID가 필요할 경우만 최소 변경 |
| 신규 Supabase migration 1개 | grant/consumption tables, atomic RPC, RLS/grants, cleanup |
| `scripts/verify-anonymous-write-token.mjs` | pure helper, migration contract, route ordering 정적 검증 |
| 후속 SEC-05 구현 문서 | claim, operation, retry, legacy, deployment contract 기록 |

`app/api/face-reading/route.js`는 현재 write token을 발급하거나 소비하지 않으므로 예상 수정 대상이 아니다. 분석-run resource를 두 AI 결과 모두에 결속해야 한다는 별도 제품 요구가 생길 때만 포함한다.

## 13. 구현 테스트 계약

| 번호 | 케이스 | 계층 | 기대 결과 |
| ---: | --- | --- | --- |
| 1 | 유효 token + 정확한 resource + 정확한 operation | pure + local DB integration | claim 후 1회 write, complete |
| 2 | 유효 token + 다른 resource ID | pure + DB integration | write 전 거부 |
| 3 | 유효 token + 다른 resource type | pure | 거부 |
| 4 | 유효 token + 다른 operation | pure + route static | 거부 |
| 5 | 동일 token 두 번째 result 사용 | local DB integration | 새 row 없이 canonical reference replay |
| 6 | 동일 token 동시 요청 | local DB concurrency | 하나만 claim, 나머지는 in-progress/replay |
| 7 | 만료 token | pure | 거부 |
| 8 | 서명 변조 token | pure | timing-safe 검증 실패 |
| 9 | purpose 변조 token | pure | 거부 |
| 10 | token 없는 anonymous 요청 | route | 401/안전 오류, write 없음 |
| 11 | 다른 anonymous principal | pure + route | 거부 |
| 12 | account 귀속 후 anonymous token 재사용 | route integration | account impersonation/귀속 불가, 정책대로 폐기 또는 거부 |
| 13 | legacy token | pure | 선택한 migration 정책에 따라 명시적 거부 또는 제한 호환 |
| 14 | DB consume 실패 | mocked route | fail-closed, service-role write 미호출 |
| 15 | downstream write 실패 후 retry | local DB integration | 같은 fingerprint만 lease/failed 정책에 따라 재시도 |
| 16 | protected column 변경 시도 | route + local DB | owner/public/user ID를 client가 변경하지 못함 |
| 17 | service-role route ownership check | local DB integration | resource/principal/operation 불일치 거부 |
| 18 | raw token DB/log 미저장 | static + local DB inspection | raw token/cookie/IP/body 없음, HMAC hash만 존재 |

Pure helper/static verifier만으로 1회용 동시성은 증명할 수 없다. 최소 한 번은 disposable local Supabase/Postgres에서 병렬 RPC integration test가 필요하다. production DB, 실제 사용자 data, OpenAI 호출은 테스트 대상이 아니다.

## 14. 기존 token 호환 고려

현재 token에는 `version`과 resource claim이 없어 안전한 server-side binding을 사후 복원할 수 없다.

- **즉시 거부:** 가장 안전하다. 기존 anonymous tab은 분석을 다시 실행해야 하지만 current production TTL이 24시간이고 account entitlement가 아니므로 우선 권장한다.
- **짧은 호환 기간:** v2 발급을 먼저 배포하고 최대 기존 production TTL만큼 기다린 뒤 v1 검증을 제거할 수 있다. 그 기간에는 SEC-05 위험이 그대로 남는다.
- **version별 검증:** v1을 장기 지원하면 resource binding을 제공할 수 없으므로 권장하지 않는다.
- **새 token 재발급:** v1 token만으로 canonical 분석 결과를 증명할 수 없어 자동 승격은 부적절하다. 사용자가 새 분석을 수행해 v2 grant를 받도록 해야 한다.

실제 활성 anonymous session 규모가 repository에서 확인되지 않으므로 최종 rollout 방식은 product 운영자가 선택해야 한다. 어떤 선택이든 `version`을 도입하고 v1 종료 시점을 명시한다.

## 15. 미확인 사항

- production Supabase의 `analysis_requests`, `analysis_results`, `recommendation_logs` 실제 RLS, grants, policies, constraints
- production `WRITE_ACCESS_TOKEN_SECRET`의 강도, service-role/premium secret과 실제 값 분리 여부, rotation 절차
- Vercel/프록시/APM이 custom request/response header를 저장하는지와 redaction 정책
- WAF/CDN distributed rate limit과 endpoint alerting 존재 여부
- 현재 production에 남아 있는 v1 token/tab 수와 anonymous result/track data의 운영 중요도
- `recommendation_logs`의 repository 밖 schema, retention, unique index, downstream 활용

확인 시 secret 값이나 production 사용자 row를 출력할 필요는 없다. Dashboard의 key 존재/분리 boolean, catalog metadata, policy 이름/role, redaction/WAF 설정 상태만 기록한다.

## 16. 결론

현재 write token은 HMAC-SHA-256 signature, 만료, exact scope, timing-safe comparison을 갖추고 있어 위조·변조·만료 token은 fail-closed한다. 그러나 token이 특정 analysis run/result, anonymous principal, operation, request fingerprint에 결속되지 않고 nonce도 소비되지 않는다.

따라서 유효 token 하나로 타인 소유 기존 result를 직접 수정하는 경로는 확인되지 않았지만, 임의 client payload의 새 public result를 반복 생성하고 같은 token을 tracking write에 교차 사용하며 동시 replay할 수 있다. 가장 큰 위험은 owner takeover가 아니라 public result/analytics 무결성, 저장량, bearer token 이식성이다.

최소 보정은 SEC-01 idempotency를 재목적화하는 것이 아니라, SEC-01의 principal/HMAC/atomic RPC 패턴을 활용한 별도 stateful write grant와 operation consume을 도입하는 것이다.

## 17. 다음 구현 작업 정의

다음 작업은 **SEC-05 resource-bound anonymous write grant 구현**으로 정의한다.

1. v2 claim과 전용 secret fail-closed 계약 확정
2. analysis-run grant 및 atomic consumption migration 작성
3. SEC-01 anonymous principal에 grant 결속
4. `/api/analyze`에서 expected result/submission fingerprint와 grant 생성
5. `/api/results`의 single-use create + canonical replay 구현
6. `/api/track`의 operation-bound bounded multi-use + exact event replay dedupe 구현
7. v1 token rollout 정책 결정
8. pure/static test와 disposable local Postgres concurrency test 수행

구현 완료 기준은 다른 resource/principal/operation/body가 DB write 전에 거부되고, 동일 result intent의 순차·동시 retry가 새 row를 만들지 않으며, consume 저장소 실패 시 service-role write가 실행되지 않는 것이다.
