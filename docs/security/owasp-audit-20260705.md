# OWASP 보안 감사 보고서 - 2026-07-05

## 1. 감사 범위 및 제외 범위

- 작업 유형: 진단형
- 대상 저장소: `C:\Users\hun\Documents\K-beauty AI`
- 기준 시점 브랜치: `codex/survey-input-contract-refactor`
- 수행 방식: 코드 수정 없이 정적 코드 감사, 라우트/설정/의존성 인벤토리, read-only dependency audit, 문서/마이그레이션 대조
- 포함 범위: Next.js App Router, `app/api/**/route.js`, middleware, Supabase client/Auth/RLS 전제, 분석/공유/프리미엄/My/check-in 흐름, 이미지 업로드/AI 호출, 제품 링크, crawler/import 스크립트, 배포/보안 헤더/의존성/CI 설정
- 제외 범위: 운영 Supabase dashboard, 운영 데이터, Storage bucket 실설정, Vercel/WAF/도메인 설정, 외부 API 공격성 테스트, DB write, migration 실행, 결제 테스트, secret 값 확인
- secret/PII 처리: `.env.local`의 존재와 키 이름만 확인했고 값은 열람/기록하지 않았다. 실제 이미지, 사용자 개인정보, 분석 결과 원문은 보고서에 포함하지 않았다.

## 2. 기준 문서

- OWASP Top 10:2025: <https://owasp.org/Top10/2025/>
- OWASP ASVS 5.0: <https://owasp.org/www-project-application-security-verification-standard/>
- OWASP ASVS 5.0 Level 2 Controls: <https://cornucopia.owasp.org/taxonomy/asvs-5.0/level-2-controls>
- OWASP API Security Top 10:2023: <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- 프로젝트 지침: `AGENTS.md`, `.codex/AI_ROUTER.md`, `.codex/AI_CONTEXT.md`, `.codex/AI_REVIEW_CHECKLIST.md`

## 3. 저장소 현황

| 항목 | 확인 결과 |
| --- | --- |
| 현재 브랜치 | `codex/survey-input-contract-refactor` |
| 작업 시작 시 status | 기존 수정: `.codex/AI_WORK_LOG.md`, `app/result/full-report/page.js`, `app/result/page.js`, `components/result/free-v2/FreeResultV2DiagnosisStep.jsx`, `components/result/free-v2/FreeResultV2EvidenceStep.jsx` |
| Package manager | npm, 루트 `package-lock.json`, `crawler/package-lock.json` |
| Next.js | `next@15.5.14` |
| React | `react@19.2.4`, `react-dom@19.2.4` |
| Supabase | `@supabase/ssr@0.10.3`, `@supabase/supabase-js@2.106.0` |
| 주요 env 키 이름 | `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WRITE_ACCESS_TOKEN_SECRET` |
| CI workflow | `.github/workflows` 없음 |
| 배포 설정 | `vercel.json` 없음 |
| Next config | `next.config.js:1-7`에 `distDir`만 설정, 보안 헤더 없음 |
| Middleware | `middleware.js:1-11`에서 모든 비정적 경로를 Supabase session middleware로 위임 |

### 3.1 API route inventory

- `app/api/analyze/route.js`
- `app/api/auth/signout/route.js`
- `app/api/current-products/products/route.js`
- `app/api/face-reading/route.js`
- `app/api/full-report/route.js`
- `app/api/my/check-in/route.js`
- `app/api/my/dashboard/route.js`
- `app/api/my/save-report/route.js`
- `app/api/premium/access/route.js`
- `app/api/results/[shareId]/route.js`
- `app/api/results/route.js`
- `app/api/track/route.js`
- `app/auth/callback/route.js`

### 3.2 주요 page route inventory

- 공개/분석: `app/page.js`, `app/result/page.js`, `app/result/full-report/page.js`, `app/r/[shareId]/page.js`
- My: `app/my/page.js`, `app/my/check-in/page.js`
- 테스트/개발 확인: `app/test-result/page.js`, `app/test-full-report/page.js`
- locale wrapper: `app/[locale]/**`

### 3.3 주요 보안 관련 파일

- Supabase/Auth: `lib/supabase-admin.js`, `lib/supabase/server.js`, `lib/supabase/server-client.js`, `lib/supabase/browser-client.js`, `lib/supabase/middleware.js`
- 공유/저장: `lib/analysis-results.js`, `lib/analysis-result-access.js`, `app/api/results/**`, `app/r/[shareId]/page.js`
- 프리미엄: `lib/premium-access.js`, `lib/premium-report-session.js`, `app/api/full-report/route.js`, `app/api/premium/access/route.js`
- 업로드/AI: `lib/upload-validation.js`, `app/api/analyze/route.js`, `app/api/face-reading/route.js`, `lib/photo-evidence.js`
- My/check-in: `app/api/my/**`, `lib/my/**`
- crawler/import/export: `crawler/**`, `scripts/**`, `docs/pre-deploy-checklist.md`, `docs/ranking-pipeline.md`

## 4. 공격 표면 지도

| 영역 | 진입점 | 신뢰 경계 | 사용자 식별 방식 | 주요 데이터 | 예상 위험 |
| -- | --- | ----- | --------- | ------ | ----- |
| 무료 분석 시작 -> 사진/설문 -> 분석 API -> 결과 저장 -> 결과 조회 | `app/page.js`, `/api/analyze`, `/api/results`, `/r/[shareId]`, `/api/results/[shareId]` | 브라우저 multipart/FormData -> 서버 AI/API -> Supabase service role -> 공개/비공개 조회 | 분석 시점은 익명 가능, 저장은 account user 또는 write token, 조회는 public flag 또는 owner cookie | 사진 data URL, 설문, 피부 상태, 추천 제품, `analysis_results.result_json` | AI 비용 남용, 저장 데이터 무결성, 공유 ID 추측, RLS 미설정 시 직접 DB 접근 |
| 무료 결과 -> premium CTA -> 접근 상태 확인 -> 현재 제품 입력 -> premium report 생성/저장/재조회 | `/api/premium/access`, `/api/full-report`, `lib/premium-access.js`, `lib/premium-report-session.js` | 클라이언트 CTA/currentProducts -> 서버 premium gate/session -> Supabase saved_reports | Supabase account user, premium session cookie, app_metadata entitlement | paid report, current product snapshot, face lab summary | release mode fail-open, session replay/만료, 저장된 premium report 재조회 정책 |
| My -> 체크인/다이어리/리포트 히스토리 | `/my`, `/my/check-in`, `/api/my/dashboard`, `/api/my/check-in`, `/api/my/save-report` | cookie session -> Supabase RLS -> user-scoped rows | Supabase cookie user, anonymous 제외 여부 | skin_profiles, saved_reports, daily_checkins, routine_logs, memo | client-supplied report JSON 저장, DB error detail 노출, RLS/dashboard 설정 의존 |
| private/public 공유 URL | `/r/[shareId]`, `/api/results/[shareId]`, `lib/analysis-result-access.js` | URL path parameter -> service role read -> owner/public policy helper | `is_public=true` 또는 owner cookie user | share id, result summary, recommended products, image_url, result_json-derived fields | 짧은 share id + read rate limit 부재, cache/header 미명시, RLS 미설정 시 DB 직접 우회 |
| 제품 추천 및 외부 구매 링크 | result pages, product source, crawler import | DB/imported product metadata -> React href/image rendering | 사용자 식별 없음 | buy_link, image_url, brand/name/category | link validation 불일치, unsafe URL, phishing/open redirect 유사 위험 |
| crawler/candidate/reviewed import/export | `crawler/**`, `scripts/**`, `data/**`, `docs/pre-deploy-checklist.md` | 로컬/운영자 파일 -> parser -> Supabase service role/RPC | 운영자 로컬 실행, service role | product_candidates, products, ranking snapshots, CSV/JSONL | CSV/formula injection, import 값 신뢰, service role 오남용, 운영 실수 |
| 관리자성 스크립트 및 내부 실행 경로 | `scripts/**`, npm scripts, crawler scripts | 로컬 파일시스템/process env -> Node scripts -> Supabase/OpenAI | 로컬 운영자 권한 | product/candidate/review data, snapshots | secret 환경 의존, write script 오실행, output 파일에 민감 데이터 잔류 |

## 5. OWASP Top 10:2025 순회 결과

| 분류 | 결과 | 관련 finding |
| --- | --- | --- |
| A01 Broken Access Control | 분석 결과 RLS 설정 공백은 배포 검증 필요. premium release default와 saved premium fabrication은 설계상 접근제어 위험. | SEC-02, SEC-04, SEC-06, SEC-09, SEC-11 |
| A02 Security Misconfiguration | 보안 헤더 미구성, 배포 설정/Storage/RLS/WAF는 코드만으로 확인 불가. | SEC-10, INFO-01 |
| A03 Software Supply Chain Failures | `npm audit --omit=dev` 기준 Next.js high, PostCSS moderate 취약점 확인. | SEC-03 |
| A04 Cryptographic Failures | write token이 HMAC 서명은 있으나 payload/resource binding 및 nonce 사용 추적이 없다. | SEC-05 |
| A05 Injection | eval/new Function은 확인되지 않음. URL validation 불일치와 CSV/import 계열은 보강 필요. | SEC-07, INFO-01 |
| A06 Insecure Design | public AI endpoint 비용 방어, premium fail-open, client-supplied report snapshot 저장 설계가 취약하다. | SEC-01, SEC-04, SEC-06 |
| A07 Authentication Failures | auth callback redirect는 same-origin/path 제한이 있다. signout GET은 logout CSRF 가능성이 있다. | SEC-11 |
| A08 Software or Data Integrity Failures | write token replay와 product link/import metadata 신뢰 경계가 약하다. | SEC-05, SEC-07 |
| A09 Security Logging & Alerting Failures | 일부 API가 DB/error message를 client 또는 log로 노출한다. rate-limit/abuse logging 일관성은 부족하다. | SEC-12, INFO-01 |
| A10 Mishandling of Exceptional Conditions | OpenAI 실패/timeout/resource exhaustion에 대한 서버측 quota/idempotency가 부족하다. | SEC-01, SEC-08, SEC-12 |

## 6. OWASP API Security Top 10:2023 순회 결과

| 분류 | 결과 | 관련 finding |
| --- | --- | --- |
| API1 BOLA / IDOR | `/r/[shareId]` helper는 owner/public gate가 있으나 DB RLS 배포 검증이 필요하다. My/dashboard는 user_id scope를 사용한다. | SEC-02, SEC-09 |
| API2 Broken Authentication | Supabase Auth 기반. anonymous 계정 제외는 My save에서 확인됨. signout GET은 낮은 영향의 CSRF logout. | SEC-11 |
| API3 Broken Object Property Level Authorization | `/api/my/save-report`가 client-supplied premium_report/report_type을 저장할 수 있다. | SEC-06 |
| API4 Unrestricted Resource Consumption | `/api/analyze`, `/api/face-reading`에 server-side quota/rate limit이 없다. upload 처리도 memory/base64 중심이다. | SEC-01, SEC-08 |
| API5 Broken Function Level Authorization | premium creation은 서버에서 확인하지만 release mode default가 fail-open이다. | SEC-04 |
| API6 Unrestricted Access to Sensitive Business Flows | write token으로 anonymous save/track 흐름이 재사용 가능하다. AI endpoint 반복 호출 가능. | SEC-01, SEC-05 |
| API7 SSRF | 사용자 URL을 서버가 fetch하는 명확한 경로는 확인되지 않았다. Next.js dependency advisory 및 deployment 확인 필요. | SEC-03, INFO-01 |
| API8 Security Misconfiguration | 보안 헤더, RLS/Storage/WAF/CORS 실제 설정 검증 필요. | SEC-10, INFO-01 |
| API9 Improper Inventory Management | API route inventory는 작성됨. 테스트 route와 운영 노출 여부는 배포 확인 필요. | INFO-01 |
| API10 Unsafe Consumption of APIs | OpenAI/model output과 imported product metadata를 신뢰하는 지점이 있다. | SEC-07, SEC-12 |

## 7. ASVS 관련 핵심 통제 점검표

| 영역 | 확인 결과 | 상태 |
| --- | --- | --- |
| 인증 | Supabase SSR cookie/Bearer client 사용. My save는 non-anonymous account user 확인. Middleware 보호 경로는 `/my`, `/my/check-in` 중심. | 부분 충족 |
| 세션 관리 | premium report cookie는 httpOnly/sameSite/secure prod 설정과 DB-backed session 확인. signout GET 존재. | 부분 충족 |
| 접근 통제 | owner/public helper가 `/r/[shareId]`와 API 공유 조회에 사용된다. DB RLS는 analysis tables에서 코드상 확인 필요. | 부분 충족/검증 필요 |
| 입력 검증 | 설문 필수값과 일부 enum/length는 검증됨. 이미지 magic bytes/dimensions, JSON body 총량, premium saved payload schema는 부족. | 부분 충족 |
| 출력 인코딩/XSS | React 기본 escaping 사용. `dangerouslySetInnerHTML`은 `app/layout.js`의 정적 theme script로 확인되어 직접 취약점은 아님. URL href sanitizer는 불일치. | 부분 충족 |
| 파일 처리 | MIME/size 검증은 있으나 signature/dimension 검증 없음. 원본 이미지는 Supabase Storage 저장 경로가 확인되지 않음. | 부분 충족 |
| API/웹서비스 | state-changing routes는 대부분 POST. `/api/auth/signout`은 GET도 허용. AI endpoint quota가 없음. | 부분 충족 |
| 데이터 보호 | My tables RLS 정책은 migration에 있음. analysis tables와 storage/dashboard 설정은 확인 필요. | 검증 필요 |
| 로깅/오류 처리 | 일부 generic response 있음. 일부 DB/error message client 반환과 AI/provider preview logging 위험 있음. | 부분 충족 |
| 구성 | 보안 헤더, Vercel/WAF/rate limit, source map, Storage policy는 코드만으로 확인 불가. | 검증 필요 |
| 의존성/공급망 | lockfile audit 결과 prod high 1, moderate 1. GitHub Actions는 없음. | 미충족 |
| 비즈니스 로직 | premium gate는 서버에 있으나 fail-open default와 saved report fabrication 가능성이 있다. | 부분 충족 |

## 8. Finding 요약

| 심각도 | 개수 | ID |
| --- | ---: | --- |
| Critical | 0 | - |
| High | 3 | SEC-01, SEC-02, SEC-03 |
| Medium | 6 | SEC-04, SEC-05, SEC-06, SEC-07, SEC-08, SEC-09 |
| Low | 3 | SEC-10, SEC-11, SEC-12 |
| Info | 1 | INFO-01 |

## 9. Finding 상세

### [SEC-01] 공개 AI 분석 endpoint에 서버측 quota/rate limit이 없다

* 심각도: High
* OWASP 매핑: OWASP Top 10:2025 A06, A10; API Security 2023 API4, API6; ASVS API/resource consumption
* 영향 영역: `/api/analyze`, `/api/face-reading`, OpenAI 비용, 서버 CPU/memory
* 상태: confirmed
* 근거 파일: `app/api/analyze/route.js`, `app/api/face-reading/route.js`, `lib/upload-validation.js`
* 코드 위치: `app/api/analyze/route.js:1165-1402`, `app/api/face-reading/route.js:687-839`, `lib/upload-validation.js:1-49`
* 취약 조건: 인증 없이 multipart 요청을 보낼 수 있고, 파일 MIME/size 검증 후 OpenAI 호출로 진행된다. `/api/results`와 `/api/track`에는 in-memory limiter가 있으나 AI 호출 route에는 같은 방어가 확인되지 않는다.
* 공격 시나리오: 외부 사용자가 작은 허용 이미지 파일을 반복 제출하면 서버가 매번 이미지 base64 변환과 AI API 호출을 수행한다.
* 예상 영향: OpenAI 비용 급증, 서버 리소스 고갈, 정상 사용자의 분석 실패, provider rate limit 소진
* 현재 방어: 8MB upload limit, MIME allowlist, 필수 form field 확인, OpenAI 오류 fallback
* 왜 현재 방어가 충분하지 않은지: size/type 검증은 비용 호출 횟수를 제한하지 않는다. 서버리스 환경에서는 edge/platform 레벨 rate limit이 없다면 단일 프로세스 memory limiter도 적용되지 않는다.
* 최소 수정 권장안: 인증/익명 세션/IP/device fingerprint 조합의 durable rate limit, 일일 quota, AI 호출 idempotency key, provider timeout과 retry 제한을 추가한다. 기존 API response field는 유지한다.
* 회귀 테스트 권장안: 동일 IP/익명 세션에서 quota 초과 시 AI provider 호출 전 429가 반환되는지, 정상 첫 요청과 로그인 사용자 예외 정책이 유지되는지 테스트한다.
* 배포 환경 확인 항목: Vercel/WAF/rate limit, OpenAI spend cap/project quota, provider timeout, error alerting
* 우선순위: P0
* 수정 난이도: Medium

### [SEC-02] 민감한 analysis tables의 RLS/grant 상태가 코드 기준으로 확인되지 않는다

* 심각도: High
* OWASP 매핑: A01 Broken Access Control, A02 Security Misconfiguration; API1 BOLA/IDOR
* 영향 영역: `analysis_requests`, `analysis_results`, 무료 결과, private/public share
* 상태: needs-deployment-verification
* 근거 파일: `supabase/migrations/20260424_align_analysis_results_share_schema.sql`, `supabase/migrations/20260520170737_add_revisit_core_tables.sql`, `lib/analysis-result-access.js`, `lib/supabase-admin.js`
* 코드 위치: `supabase/migrations/20260424_align_analysis_results_share_schema.sql:5-67`, `supabase/migrations/20260424_align_analysis_results_share_schema.sql:130-152`, `supabase/migrations/20260520170737_add_revisit_core_tables.sql:150-154`, `supabase/migrations/20260520170737_add_revisit_core_tables.sql:299-309`, `lib/analysis-result-access.js:34-64`, `lib/supabase-admin.js:20-32`
* 취약 조건: `analysis_requests`와 `analysis_results` 생성 migration에서 RLS enable/revoke/grant가 확인되지 않는다. 반면 My 관련 5개 테이블은 별도 migration에서 RLS와 anon revoke가 명시되어 있다.
* 공격 시나리오: 배포 DB에서 analysis tables에 anon/authenticated select grant가 열려 있고 RLS가 꺼져 있으면, 공개 anon key를 가진 클라이언트가 앱의 owner/public helper를 우회해 직접 REST 조회를 시도할 수 있다.
* 예상 영향: private 분석 결과, 설문 JSON, 피부 상태/추천 결과가 사용자 경계를 넘어 노출될 수 있다.
* 현재 방어: 앱 레벨에서는 `getAnalysisResultForShare`가 `is_public` 또는 owner user check를 수행한다. server route는 service role로 읽는다.
* 왜 현재 방어가 충분하지 않은지: Supabase anon key는 브라우저 공개 전제다. DB RLS/grant가 열려 있으면 앱 route의 접근제어를 거치지 않는 직접 Supabase REST 접근이 가능해진다.
* 최소 수정 권장안: 배포 DB에서 `analysis_requests`, `analysis_results`의 RLS enable, anon revoke, authenticated 최소 정책을 확인한 뒤 누락 시 별도 migration으로 보강한다. 공개 공유 조회는 service-role server API만 사용하도록 유지한다.
* 회귀 테스트 권장안: anon/authenticated Supabase client로 private row select가 거부되고, server `/r/[shareId]` owner/public 정책은 유지되는지 확인한다.
* 배포 환경 확인 항목: `pg_class.relrowsecurity`, `information_schema.role_table_grants`, Supabase REST 권한, 기존 remote-only policy 유무
* 우선순위: P0
* 수정 난이도: Medium

### [SEC-03] 운영 의존성 audit에서 Next.js high 취약점이 확인된다

* 심각도: High
* OWASP 매핑: A03 Software Supply Chain Failures, A02 Security Misconfiguration; API7 SSRF
* 영향 영역: Next.js App Router, middleware route protection, cache, image/server components
* 상태: confirmed
* 근거 파일: `package.json`, `package-lock.json`, `middleware.js`, `lib/supabase/middleware.js`
* 코드 위치: `package.json`, `package-lock.json`, `middleware.js:1-11`, `lib/supabase/middleware.js:20-92`
* 취약 조건: `npm audit --omit=dev --json` 기준 prod vulnerabilities는 high 1, moderate 1이다. `next@15.5.14`가 여러 Next.js advisory 범위에 포함된다.
* 공격 시나리오: advisory 성격에 따라 middleware/proxy bypass, cache poisoning, DoS, SSRF, XSS 계열 위험이 앱 route protection과 cache 동작에 영향을 줄 수 있다.
* 예상 영향: `/my` 보호, redirect/cache, server component 응답, availability에 영향을 줄 수 있다.
* 현재 방어: 앱 레벨 middleware와 Supabase route/client checks가 존재한다.
* 왜 현재 방어가 충분하지 않은지: framework-level 취약점은 애플리케이션 코드의 접근제어를 우회하거나 캐시 계층에 영향을 줄 수 있다.
* 최소 수정 권장안: 별도 변경 작업에서 Next.js/PostCSS를 audit-fixed 버전으로 올리고 lockfile만 갱신한다. 변경 전후 `/my`, `/r/[shareId]`, `/api/full-report`, `/api/analyze` smoke test를 수행한다.
* 회귀 테스트 권장안: `npm audit --omit=dev`, `npm run build`, protected route redirect, share private/public access, premium report session 재조회 테스트
* 배포 환경 확인 항목: Vercel runtime Next.js override 여부, production source maps/cache 설정, middleware prefetch behavior
* 우선순위: P0
* 수정 난이도: Medium

### [SEC-04] premium release mode가 환경변수 누락 시 fail-open 된다

* 심각도: Medium
* OWASP 매핑: A01 Broken Access Control, A06 Insecure Design; API5 Broken Function Level Authorization
* 영향 영역: premium report 생성 권한, 향후 결제 연결
* 상태: confirmed
* 근거 파일: `lib/premium-access.js`, `app/api/full-report/route.js`
* 코드 위치: `lib/premium-access.js:6-12`, `lib/premium-access.js:57-105`, `app/api/full-report/route.js:282-294`
* 취약 조건: `PREMIUM_RELEASE_MODE`가 비어 있거나 허용값이 아니면 `beta_open`으로 처리되고, account user는 `canCreatePremium=true`가 된다.
* 공격 시나리오: production 배포에서 env 누락 또는 오타가 발생하면 paid_only 의도와 달리 로그인 사용자 전체가 premium report 생성을 시도할 수 있다.
* 예상 영향: 향후 결제 연결 후 premium entitlement 우회, 비용/상품 정책 혼선
* 현재 방어: anonymous user는 거부된다. `paid_only` 설정 시 app_metadata entitlement를 확인한다. premium session cookie도 필요하다.
* 왜 현재 방어가 충분하지 않은지: 결제/권한 기능에서 설정 누락은 보수적으로 닫혀야 한다. fail-open default는 운영 실수를 권한 확대로 바꾼다.
* 최소 수정 권장안: production에서 env 누락/invalid는 `paid_only` 또는 explicit misconfiguration error로 닫는다. beta_open은 명시 설정일 때만 허용한다.
* 회귀 테스트 권장안: env unset/invalid/`beta_open`/`paid_only` 케이스별 access response와 `/api/full-report` 생성 거부/허용 테스트
* 배포 환경 확인 항목: Vercel production `PREMIUM_RELEASE_MODE`, entitlement app_metadata 운영 절차
* 우선순위: P1
* 수정 난이도: Low

### [SEC-05] anonymous write token이 resource-bound가 아니며 replay 방어가 없다

* 심각도: Medium
* OWASP 매핑: A04 Cryptographic Failures, A08 Software or Data Integrity Failures; API6
* 영향 영역: `/api/results`, `/api/track`, public share 생성, recommendation logs
* 상태: confirmed
* 근거 파일: `lib/write-access.js`, `app/api/analyze/route.js`, `app/api/results/route.js`, `app/api/track/route.js`
* 코드 위치: `lib/write-access.js:19-47`, `lib/write-access.js:49-93`, `lib/write-access.js:109-131`, `app/api/results/route.js:194-237`, `app/api/track/route.js:95-140`
* 취약 조건: token payload는 `scope`, `exp`, random nonce만 포함한다. 특정 분석 payload, request id, share id, user/session에 바인딩되지 않고 nonce 사용 여부도 서버에 저장하지 않는다.
* 공격 시나리오: 유효한 분석 응답에서 받은 write token을 TTL 내 재사용해 임의 JSON 형태의 public result 저장 또는 tracking write를 반복할 수 있다.
* 예상 영향: public result 데이터 무결성 저하, DB/log 저장량 증가, analytics 오염, 운영자가 신뢰하는 추천 로그 품질 저하
* 현재 방어: HMAC signature, expiration, scope check, `/api/results` 10/10분 in-memory rate limit, `/api/track` 50/10분 in-memory rate limit
* 왜 현재 방어가 충분하지 않은지: in-memory limiter는 서버리스/멀티 인스턴스에서 우회 가능하고, token이 분석 결과와 연결되지 않아 재사용 자체를 구분하지 못한다.
* 최소 수정 권장안: token을 analysis session id/hash와 bind하고, nonce 또는 session id를 durable store에서 single-use/limited-use로 관리한다. `/api/results`는 분석 직후 서버가 생성한 canonical result만 저장하도록 좁힌다.
* 회귀 테스트 권장안: token 재사용, 다른 result body 제출, expired token, 정상 분석 직후 저장을 각각 확인한다.
* 배포 환경 확인 항목: `WRITE_ACCESS_TOKEN_SECRET`이 service role과 분리되어 있는지, serverless shared limiter 유무
* 우선순위: P1
* 수정 난이도: Medium

### [SEC-06] My save-report가 client-supplied premium report snapshot을 저장할 수 있다

* 심각도: Medium
* OWASP 매핑: A06 Insecure Design; API3 Broken Object Property Level Authorization, API4
* 영향 영역: `/api/my/save-report`, `saved_reports`, My report history
* 상태: confirmed
* 근거 파일: `app/api/my/save-report/route.js`, `supabase/migrations/20260520170737_add_revisit_core_tables.sql`
* 코드 위치: `app/api/my/save-report/route.js:163-180`, `app/api/my/save-report/route.js:304-423`, `supabase/migrations/20260520170737_add_revisit_core_tables.sql:214-237`
* 취약 조건: account user라면 request body의 `reportType`이 `premium`일 때 `body.premiumReport` 또는 `freeResult.premiumReport`가 `saved_reports.premium_report`에 저장된다. `/api/full-report`의 premium session/entitlement 검증과 같은 출처 검증은 이 save endpoint에 없다.
* 공격 시나리오: 로그인 사용자가 임의 payload를 premium saved report처럼 저장해 자신의 My history를 오염시키고, future paid feature가 `saved_reports.report_type='premium'`을 신뢰하면 권한 혼선이 생긴다.
* 예상 영향: own-account data integrity 저하, premium access 정책 혼동, 큰 JSON 저장을 통한 storage abuse
* 현재 방어: account user만 허용, Supabase RLS owner policy, 저장 row는 본인 user_id로 제한
* 왜 현재 방어가 충분하지 않은지: owner 제한은 cross-user 접근은 막지만, premium report의 source-of-truth를 client body로 열어 둔다.
* 최소 수정 권장안: `premium` 저장은 `premium_report_session` 또는 server-generated saved premium report path에서만 허용하고, free save endpoint는 `reportType='free'`만 받도록 제한한다. JSON body size/schema cap을 둔다.
* 회귀 테스트 권장안: free save 정상, premium body 직접 제출 거부, `/api/full-report`가 생성한 premium saved report 재조회 정상
* 배포 환경 확인 항목: 기존 saved_reports 중 client-origin premium row 존재 여부, 향후 결제 entitlement와 saved report 정책
* 우선순위: P1
* 수정 난이도: Medium

### [SEC-07] full-report 구매 링크 검증이 free-result보다 약하다

* 심각도: Medium
* OWASP 매핑: A05 Injection, A08 Software/Data Integrity; API8, API10
* 영향 영역: premium full report 제품 링크, imported product metadata
* 상태: likely
* 근거 파일: `app/result/full-report/page.js`, `app/result/page.js`, `crawler/lib/supabase.ts`
* 코드 위치: `app/result/full-report/page.js:598-615`, `app/result/full-report/page.js:2754-2775`, `app/result/page.js:2497-2525`, `crawler/lib/supabase.ts:1389-1411`
* 취약 조건: full-report의 `isExactOliveYoungProductLink`는 문자열에 `oliveyoung.co.kr` 포함 여부만 본다. free-result 쪽은 `http` 시작, example 제외, `oliveyoung.co.kr/...getGoodsDetail` 패턴으로 더 좁게 검사한다.
* 공격 시나리오: crawler/import/DB 오염으로 `oliveyoung.co.kr` 문자열을 포함한 비정상 scheme 또는 redirect성 URL이 product `buy_link`에 들어가면 full-report에서 그대로 `href`로 렌더링될 수 있다.
* 예상 영향: 사용자가 premium report에서 unsafe/phishing 링크로 이동할 수 있다. 직접 사용자 입력 경로가 아니라 운영/import 신뢰 경계가 전제조건이다.
* 현재 방어: React attribute escaping, fallback Naver search, free-result에는 더 엄격한 검사
* 왜 현재 방어가 충분하지 않은지: 같은 제품 링크를 두 화면에서 다르게 검증해 full-report가 더 넓은 입력을 허용한다.
* 최소 수정 권장안: URL sanitizer를 공용 helper로 통합하고 `https://` scheme, allowlisted host, path/query 형태를 검증한다. ingestion 단계에서도 같은 allowlist를 적용한다.
* 회귀 테스트 권장안: 정상 OliveYoung link 허용, non-http/다른 host/문자열 포함형 link fallback, full/free 결과 일관성 확인
* 배포 환경 확인 항목: products/product_candidates의 기존 `buy_link` 품질, crawler import 검증 단계
* 우선순위: P2
* 수정 난이도: Low

### [SEC-08] 이미지 업로드 검증이 MIME/size 중심이고 실제 파일 signature/dimension을 확인하지 않는다

* 심각도: Medium
* OWASP 매핑: A10 Mishandling of Exceptional Conditions; API4; ASVS File Handling
* 영향 영역: `/api/analyze`, `/api/face-reading`, memory/base64 처리, AI image input
* 상태: confirmed
* 근거 파일: `lib/upload-validation.js`, `app/api/analyze/route.js`, `app/api/face-reading/route.js`
* 코드 위치: `lib/upload-validation.js:1-49`, `app/api/analyze/route.js:1221-1230`, `app/api/analyze/route.js:1271-1273`, `app/api/face-reading/route.js:696-707`, `app/api/face-reading/route.js:725-726`
* 취약 조건: `file.type`과 `file.size`만 확인하고 파일 magic bytes, decoding 가능 여부, 이미지 dimension/pixel count를 확인하지 않는다. 이후 전체 파일을 arrayBuffer/base64로 메모리에 올린다.
* 공격 시나리오: 허용 MIME으로 선언된 비이미지 또는 압축/해상도 특이 파일을 반복 제출해 decode/AI provider 처리 실패와 서버 메모리 부담을 유발할 수 있다.
* 예상 영향: 분석 실패율 증가, resource exhaustion, provider 오류 증가
* 현재 방어: 8MB limit, MIME allowlist, provider error fallback
* 왜 현재 방어가 충분하지 않은지: MIME은 클라이언트 제공 값이고, byte size만으로 pixel/dimension 부담을 제어하지 못한다.
* 최소 수정 권장안: 업로드 초반 magic bytes 확인, 이미지 decoder로 dimension/pixel count 제한, base64 변환 전 rejection, body/request size limit 문서화
* 회귀 테스트 권장안: 정상 jpg/png/webp 허용, MIME spoof file 거부, 초과 dimension 거부, 8MB 초과 거부
* 배포 환경 확인 항목: Vercel body size limit, upstream proxy upload limit
* 우선순위: P2
* 수정 난이도: Medium

### [SEC-09] 공개 share id entropy와 read-rate/cache 정책이 민감 데이터 특성 대비 약하다

* 심각도: Medium
* OWASP 매핑: A01 Broken Access Control, A02 Security Misconfiguration; API1, API4
* 영향 영역: `/r/[shareId]`, `/api/results/[shareId]`, public/private result lookup
* 상태: likely
* 근거 파일: `lib/analysis-results.js`, `app/api/results/[shareId]/route.js`, `app/r/[shareId]/page.js`
* 코드 위치: `lib/analysis-results.js:93-102`, `app/api/results/[shareId]/route.js:4-24`, `app/api/results/[shareId]/route.js:25-35`, `app/r/[shareId]/page.js:121-127`
* 취약 조건: share id는 `randomBytes(6)` 기반 48-bit entropy다. read route에 explicit rate limit이나 `Cache-Control: no-store/private`가 확인되지 않는다.
* 공격 시나리오: 대량 online guessing이나 로그/브라우저 cache/CDN cache misconfiguration이 결합되면 public share 결과의 노출 가능성이 커진다. private row는 helper가 owner/public을 검사하므로 단순 URL만으로는 확인되지 않았다.
* 예상 영향: 공개로 전환된 피부 분석 결과의 비의도적 조회, private/public 정책 혼선 시 피해 확대
* 현재 방어: share id는 random, DB unique, `getAnalysisResultForShare`는 private owner check와 public flag를 확인한다. page metadata는 `robots: noindex,nofollow`를 설정한다.
* 왜 현재 방어가 충분하지 않은지: 얼굴/피부 분석 정보는 민감도가 높아 public URL entropy와 read abuse 방어를 더 보수적으로 잡는 편이 안전하다.
* 최소 수정 권장안: share id를 128-bit 이상으로 늘리고, share read route에 durable low-cost rate limit과 explicit `Cache-Control: no-store` 또는 private/public에 맞는 cache policy를 추가한다.
* 회귀 테스트 권장안: 기존 share id backward compatibility, 신규 id 길이, private owner 200/anonymous 404, public anonymous 200, response header 확인
* 배포 환경 확인 항목: CDN caching, access logs retention, link revoke/expiration 정책
* 우선순위: P2
* 수정 난이도: Medium

### [SEC-10] 보안 헤더가 애플리케이션/배포 설정에 명시되어 있지 않다

* 심각도: Low
* OWASP 매핑: A02 Security Misconfiguration; ASVS Configuration
* 영향 영역: 전체 웹 앱
* 상태: confirmed
* 근거 파일: `next.config.js`, `middleware.js`, `vercel.json`
* 코드 위치: `next.config.js:1-7`, `middleware.js:1-11`, `vercel.json` 없음
* 취약 조건: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors/X-Frame-Options가 코드 설정에서 확인되지 않는다.
* 공격 시나리오: 다른 취약점이 생겼을 때 XSS, clickjacking, referrer leakage, browser feature abuse의 피해를 줄이는 방어층이 없다.
* 예상 영향: defense-in-depth 부족, 외부 링크/AI 출력/XSS 계열 위험 증폭
* 현재 방어: React 기본 escaping, 일부 link `rel="noreferrer"`, robots noindex
* 왜 현재 방어가 충분하지 않은지: browser security headers는 앱 전역 보안 기준이며 UI escaping과 별개다.
* 최소 수정 권장안: Next `headers()` 또는 Vercel 설정으로 CSP report-only부터 적용하고, frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy를 명시한다.
* 회귀 테스트 권장안: 주요 페이지/API header snapshot, CSP report-only violation 모니터링, auth callback/inline theme script 영향 확인
* 배포 환경 확인 항목: Vercel project-level headers, CDN override
* 우선순위: P3
* 수정 난이도: Low

### [SEC-11] signout route가 GET을 허용해 logout CSRF가 가능하다

* 심각도: Low
* OWASP 매핑: A01 Broken Access Control, A07 Authentication Failures; ASVS Session Management
* 영향 영역: `/api/auth/signout`
* 상태: confirmed
* 근거 파일: `app/api/auth/signout/route.js`
* 코드 위치: `app/api/auth/signout/route.js:4-17`
* 취약 조건: GET과 POST가 모두 `signOut`을 호출한다.
* 공격 시나리오: 외부 사이트가 사용자의 브라우저를 signout URL로 이동시키면 사용자가 의도치 않게 로그아웃될 수 있다.
* 예상 영향: 계정 탈취나 데이터 노출은 아니지만 세션 가용성 저하와 사용자 혼란
* 현재 방어: Supabase signOut 자체는 서버 세션 종료, redirect는 same-origin root
* 왜 현재 방어가 충분하지 않은지: state-changing action은 GET으로 실행되지 않는 것이 안전하다.
* 최소 수정 권장안: GET signout을 제거하거나 confirmation page만 반환하고, POST에는 same-site form/action 또는 CSRF token을 적용한다.
* 회귀 테스트 권장안: POST logout 정상, GET은 405 또는 safe page, 기존 UI logout button 동작 확인
* 배포 환경 확인 항목: SameSite cookie behavior, logout UI가 POST를 사용하는지
* 우선순위: P3
* 수정 난이도: Low

### [SEC-12] 일부 API error response와 logs가 내부 오류 세부정보를 노출한다

* 심각도: Low
* OWASP 매핑: A09 Security Logging & Alerting Failures, A10 Mishandling of Exceptional Conditions
* 영향 영역: `/api/track`, `/api/results/[shareId]`, `/api/my/save-report`, AI/OpenAI diagnostics
* 상태: confirmed
* 근거 파일: `app/api/track/route.js`, `app/api/results/[shareId]/route.js`, `app/api/my/save-report/route.js`, `app/api/face-reading/route.js`, `lib/openai-env-diagnostics.js`
* 코드 위치: `app/api/track/route.js:218-223`, `app/api/track/route.js:237-241`, `app/api/results/[shareId]/route.js:25-35`, `app/api/my/save-report/route.js:252-265`, `app/api/my/save-report/route.js:333-339`, `app/api/face-reading/route.js:769-783`, `app/api/face-reading/route.js:825-829`
* 취약 조건: DB error message 또는 caught error message가 일부 client response에 포함된다. server logs에는 payload 또는 model output preview가 일부 남을 수 있다. `openai-env-diagnostics`는 production에서 early return하지만 non-prod에서는 key prefix를 출력한다.
* 공격 시나리오: 공격자가 malformed payload를 반복 제출해 DB schema/cache/error text를 수집하거나, 운영 log에 민감한 분석 파생 텍스트가 남을 수 있다.
* 예상 영향: 내부 schema/운영 정보 노출, privacy/log retention 위험
* 현재 방어: 많은 route는 generic error를 반환하고, production OpenAI env diagnostics는 비활성화된다.
* 왜 현재 방어가 충분하지 않은지: error policy가 route별로 다르고, 민감한 얼굴/피부 분석 특성상 model output preview도 개인정보성 파생 데이터일 수 있다.
* 최소 수정 권장안: client response는 stable error code로 통일하고, server log는 redaction/length cap/category만 남긴다. provider raw body/model output preview는 production에서 금지한다.
* 회귀 테스트 권장안: DB insert failure/mock error 시 client가 generic code만 받는지, logs에 payload/raw model text가 없는지 확인
* 배포 환경 확인 항목: Vercel log retention/access policy, error tracking redaction, production `NODE_ENV`
* 우선순위: P3
* 수정 난이도: Low

### [INFO-01] 배포 환경과 Supabase dashboard 설정은 코드만으로 확정할 수 없다

* 심각도: Info
* OWASP 매핑: A02 Security Misconfiguration, A09 Logging & Alerting; API8, API9
* 영향 영역: Supabase RLS/Storage/Auth, Vercel/WAF/CORS/security headers, source maps, logs, domain redirects
* 상태: needs-deployment-verification
* 근거 파일: `next.config.js`, `lib/supabase-admin.js`, `lib/supabase/browser-client.js`, `supabase/migrations/**`, `.env.local`
* 코드 위치: `next.config.js:1-7`, `lib/supabase-admin.js:4-17`, `lib/supabase/browser-client.js:50-61`, `supabase/migrations/20260424_align_analysis_results_share_schema.sql:5-152`
* 취약 조건: 운영 dashboard 설정, Storage bucket policy, WAF/rate limit, production source maps, allowed redirect URL/CORS, logs redaction은 저장소 코드만으로 확인되지 않는다.
* 공격 시나리오: 운영 설정이 코드 전제와 다르면 앱의 owner/public/premium 방어와 다르게 데이터가 노출되거나 abuse 방어가 누락될 수 있다.
* 예상 영향: 설정 누락에 따라 private report/image 노출, auth redirect 오용, excessive logging, rate-limit 부재
* 현재 방어: 앱 코드에는 일부 owner/public/premium checks와 My RLS migration이 있다.
* 왜 현재 방어가 충분하지 않은지: Supabase/Vercel 보안은 dashboard-level 설정도 최종 소스다.
* 최소 수정 권장안: 아래 배포 환경 체크리스트를 운영자 read-only로 확인하고 결과를 별도 runbook에 기록한다.
* 회귀 테스트 권장안: dashboard 설정 snapshot, SQL read-only checks, staging에서 private/public share matrix
* 배포 환경 확인 항목: 아래 13장 전체
* 우선순위: P2
* 수정 난이도: Low

## 10. 비주얼리 특화 위험 요약

- 얼굴 사진과 피부 상태는 일반 제품 추천보다 민감도가 높으므로, public share와 logs/cache 정책은 보수적으로 설계해야 한다.
- 현재 원본 이미지를 Supabase Storage에 저장하는 명확한 경로는 확인되지 않았지만, OpenAI data URL 전송과 server logs/error handling은 privacy 관점에서 계속 관리해야 한다.
- premium report는 향후 결제 연결 가능성이 있으므로 fail-open 설정과 client-supplied premium snapshot 저장을 먼저 닫아야 한다.
- Supabase service role은 server-only 파일에서 생성되지만, service role route가 DB RLS를 우회하므로 app-level owner/public policy와 DB-level RLS가 함께 맞아야 한다.
- 제품 링크/후보 import는 직접 사용자 입력이 아니더라도 운영자/crawler 신뢰 경계이므로 URL sanitizer와 CSV/import hardening이 필요하다.

## 11. 수정 우선순위 로드맵

| 순서 | 목표 | 관련 finding | 최소 변경 방향 |
| ---: | --- | --- | --- |
| 1 | 외부 노출 비용/DoS 차단 | SEC-01, SEC-08 | AI endpoint durable rate limit, quota, upload signature/dimension validation |
| 2 | private report/result DB 접근 보증 | SEC-02, SEC-09 | analysis tables RLS/grants 검증 및 보강, share id/header/rate limit 개선 |
| 3 | 공급망 위험 제거 | SEC-03 | Next/PostCSS audit-fixed upgrade와 route regression |
| 4 | premium 접근 설계 닫기 | SEC-04, SEC-06 | fail-closed release mode, premium save source 검증 |
| 5 | 저장/로그 무결성 | SEC-05, SEC-12 | write token binding, stable error/log redaction |
| 6 | 링크/헤더 hardening | SEC-07, SEC-10, SEC-11 | 공용 URL sanitizer, security headers, POST-only logout |
| 7 | 운영 검증 | INFO-01 | Supabase/Vercel dashboard checklist 수행 |

## 12. 감사 한계와 미확인 영역

- 실제 Supabase dashboard RLS, grants, Storage bucket public/private, Auth redirect URL allowlist는 확인하지 않았다.
- 실제 production URL, WAF/rate limit, Vercel headers/source map/log retention은 확인하지 않았다.
- 외부 API나 운영 서비스에 대해 공격성 테스트를 수행하지 않았다.
- 실제 사용자 데이터, 이미지 원본, 분석 결과 원문, secret 값은 확인하지 않았다.
- `npm run lint`는 Next ESLint 초기 설정 프롬프트에서 멈춰 완료하지 않았다.
- build는 외부 side effect 가능성을 배제하기 어려운 보안 감사 범위에서 실행하지 않았다.

## 13. 배포 전 반드시 확인할 설정 체크리스트

| 항목 | 확인 방법 |
| --- | --- |
| analysis table RLS | Supabase SQL Editor read-only: `select relname, relrowsecurity from pg_class where oid in ('public.analysis_requests'::regclass, 'public.analysis_results'::regclass);` |
| analysis table grants | `information_schema.role_table_grants`에서 anon/authenticated 권한 확인 |
| Storage buckets | Supabase Storage dashboard에서 public/private, signed URL, bucket policy 확인 |
| Auth anonymous 설정 | Supabase Auth dashboard에서 anonymous provider, email/OAuth provider, session lifetime 확인 |
| Redirect URL allowlist | Supabase Auth URL Configuration에서 production/staging URL만 허용되는지 확인 |
| Vercel/WAF/rate limit | project/domain-level firewall, bot/rate rules, function timeout 확인 |
| Security headers | production response에서 CSP/HSTS/X-Content-Type-Options/Referrer-Policy/Permissions-Policy/frame-ancestors 확인 |
| Source maps/debug | production source map 공개 여부, test route 접근 여부, debug logging env 확인 |
| Env separation | `WRITE_ACCESS_TOKEN_SECRET`이 `SUPABASE_SERVICE_ROLE_KEY`와 분리되어 있는지 확인 |
| Premium mode | production `PREMIUM_RELEASE_MODE`가 의도값이고 invalid/unset 알림이 있는지 확인 |
| Log redaction | Vercel/error tracking logs에서 request body, model output, secret prefix, user memo가 남지 않는지 확인 |
| OpenAI budget | project-level spend cap, per-key quota, alerting, timeout 확인 |
| Product data quality | `buy_link`, `image_url`, CSV/JSONL import 값에 formula/unsafe URL이 없는지 sampling 확인 |

## 14. 최종 결론

현재 저장소 코드 기준으로 즉시 단일 요청만으로 타인 private report를 읽는 confirmed 취약점은 확인되지 않았다. 그러나 public AI endpoint resource control, analysis tables RLS/grant 배포 검증, Next.js 공급망 취약점은 우선 대응이 필요하다. 또한 premium 접근 제어는 향후 결제 연결 전에 fail-closed로 바꾸고, client-supplied premium snapshot 저장 경로를 좁혀야 한다. 배포 환경 설정과 Supabase dashboard 상태는 코드만으로 단정할 수 없으므로, 이 보고서의 체크리스트를 별도 read-only 운영 검증으로 완료해야 한다.
