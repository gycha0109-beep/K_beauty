# Premium Hosted Preview Harness Hardening Design v1.1

## 1. 문서 상태

- 상태: 설계 확정 전 검토본
- 작업 유형: 검증 하네스 보안·신뢰성 보완 설계
- 기준 브랜치: `agent/premium-hosted-preview-verification`
- 기준 HEAD: `5dd2c469d223c878a2139d8276b2c4a04c2f6bf3`
- 기준 Draft PR: #38
- 구현: 미수행
- Hosted Preview 실제 실행: 미수행
- Production 실행·변경: 금지

이 문서는 단계 10 Hosted Preview 실행에서 확인된 `HARNESS_FAILURE`를 제거하기 위한 설계다. 검증기가 제품보다 약한 상태에서 PASS를 생성하지 못하도록 신뢰 경계, 자격증명 취급, 증거 수집, fixture 실행, locale 비교, schema 검증과 artifact 보안을 fail-closed로 재설계한다.

## 2. 목적

하네스가 다음 사실을 독립적으로 입증할 수 있어야 한다.

1. 인증자료를 전송할 대상이 PR #38의 정확한 Preview deployment다.
2. Account A/B는 서로 다른 영구 사용자이며 승인된 계정 역할과 일치한다.
3. UI에서 수행한 입력과 관찰한 API 응답·저장 snapshot이 동일한 실행에 속한다.
4. KO/EN 결과가 번역 문자열이 아니라 locale-neutral canonical 의미에서 동일하다.
5. fixture가 필수 증거, 허용 origin, 판정 규칙 또는 credential scope를 약화할 수 없다.
6. 실행 과정에서 Access Token, Cookie, 이메일, 원본 사진, 전체 Premium report가 artifact·로그·trace로 유출되지 않는다.
7. live schema, catalog와 session이 실행 도중 변경되거나 오염되면 PASS 대신 중단된다.
8. 필수 lane 하나라도 미실행·불확정·증거 부족이면 전체 gate가 PASS하지 않는다.

## 3. 변경 범위

### 3.1 변경 대상

- `scripts/premium-hosted-preview-core.mjs`
- `scripts/capture-premium-hosted-preview-google-login.mjs`
- `scripts/verify-premium-hosted-preview-preflight.mjs`
- `scripts/verify-premium-hosted-preview-ui-journey.mjs`
- `scripts/verify-premium-hosted-preview-db-evidence.mjs`
- `scripts/verify-premium-hosted-preview-gate.mjs`
- `scripts/verify-premium-hosted-preview-contract.mjs`
- `scripts/cleanup-premium-hosted-preview-run.mjs`
- 신규 read-only helper와 synthetic fixture verifier
- 검증 문서와 work log

### 3.2 변경 금지

- Premium engine와 CandidatePolicy
- API response contract 자체
- UI 마크업·`data-*` 속성 추가
- DB migration/schema/RLS
- Supabase Auth 정책·OAuth 설정
- Payment, Provider, Storage
- Vercel Production 설정
- Production 배포·실행

하네스가 필요한 증거를 현재 런타임에서 수집할 수 없으면 제품 코드를 임의 변경하지 않고 `HARNESS_FAILURE: canonical_projection_unavailable`로 중단한다.

## 4. 확인된 기존 결함

### Critical

1. Google 로그인 캡처가 실제 사용자 정체성·영구 사용자 여부를 입증하지 못한다.
2. 사용자 제공 host/SHA 값의 문자열 일치만으로 인증자료 전송 대상의 진위를 확정할 수 있다.
3. storage state가 일반 JSON으로 남아 토큰·보호 쿠키의 수명주기와 파일 권한이 통제되지 않는다.

### Important

1. UI journey가 실제 DOM에 없는 `data-*` 속성을 기대한다.
2. fixture가 `requiredEvidence`를 축소할 수 있다.
3. Preflight가 Account A/B 상이성, OAuth 왕복, Preview protection, runtime configuration, live schema를 충분히 확인하지 않는다.
4. KO/EN 비교가 canonical reason code를 비교하지 않는다.
5. 기존 저장 snapshot fingerprint는 locale을 포함하므로 KO/EN 의미 동일성 비교에 사용할 수 없다.
6. raw Premium response가 trace, HAR, console, 예외 또는 artifact로 유출될 수 있다.
7. fixture가 외부 origin 이동, 임의 파일 업로드 또는 파괴적 action을 수행할 수 있다.
8. scenario 간 Premium cookie, saved report, catalog와 browser context 오염 방지가 정의되지 않았다.

## 5. 신뢰 모델

### 5.1 신뢰 가능한 입력

다음은 각각 독립 출처로 조회되고 상호 일치할 때만 신뢰한다.

- GitHub PR metadata의 repository, base, head branch, exact head SHA
- GitHub Deployment metadata의 environment, deployment ID, deployment SHA
- 인증된 Vercel API/CLI의 project ID, deployment ID, state, target, URL, source commit SHA
- 저장소에 고정된 Supabase project ref와 허용 Vercel project ID
- 구현 전에 별도 승인된 Account A/B user hash registry
- 저장소에 고정된 canonical projection contract와 fixture JSON schema

### 5.2 신뢰하지 않는 입력

- 환경변수에 사용자가 직접 입력한 `DEPLOYMENT_SHA`
- 사용자가 복사한 Preview URL
- redirect 응답의 최종 URL만으로 추정한 deployment
- fixture의 PASS 기대값·필수 증거 목록
- storage state 원문
- API response 전체 객체
- UI 번역 문자열
- repository migration 파일의 존재만으로 추정한 live migration 상태

## 6. Credential Release Gate

인증자료를 읽거나 네트워크에 전송하기 전에 다음 순서의 read-only gate를 통과해야 한다.

### 6.1 PR identity

- repository가 `gycha0109-beep/K_beauty`
- PR #38이 Open, Draft, Unmerged
- base가 `agent/premium-browser-journey-verification`
- head가 `agent/premium-hosted-preview-verification`
- exact head SHA를 GitHub에서 직접 조회

### 6.2 Deployment attestation

GitHub Deployment와 Vercel Deployment를 독립 조회해 다음을 교차 검증한다.

- GitHub deployment SHA = PR exact head SHA
- Vercel source commit SHA = PR exact head SHA
- GitHub environment = Preview
- Vercel target = preview
- Vercel state = READY
- Vercel project ID = 승인된 project ID
- deployment ID와 URL이 동일 deployment를 가리킴
- Production alias 또는 Production target이 아님
- host가 해당 deployment의 Vercel alias 목록에 포함됨

환경변수로 전달된 SHA는 비교 편의를 위한 기대값일 뿐 증거로 인정하지 않는다.

### 6.3 Network boundary

credential을 로드하기 전에 비인증 요청으로 다음을 확인한다.

- HTTPS
- redirect chain의 모든 origin 기록
- 허용 origin 외 이동 없음
- Vercel Protection redirect 여부 식별
- 보호 우회가 필요한 경우 승인된 Preview bypass 방식만 허용
- bypass secret 값은 메모리에서만 사용하고 artifact에 기록하지 않음

### 6.4 Release decision

다음 중 하나라도 충족하지 못하면 storage state, Access Token, Cookie를 읽지 않는다.

- deployment identity 불일치
- Vercel state가 READY가 아님
- Production 가능성 존재
- project ID 불일치
- 예상하지 않은 redirect origin
- Preview protection 처리 수단 부재

실패 분류: `PREVIEW_ATTESTATION_FAILURE`.

## 7. Ephemeral Credential Storage

### 7.1 저장 위치

- 저장소 외부 OS temp root에 run별 디렉터리 생성
- Git worktree, OneDrive, Dropbox, Google Drive 등 동기화 경로 금지
- run directory 이름에는 사용자 ID, 이메일, token 또는 URL query를 포함하지 않음

### 7.2 권한

- POSIX: directory `0700`, credential file `0600`
- Windows: 현재 사용자와 SYSTEM만 접근 가능한 ACL
- 권한 적용 실패 시 credential 저장 금지

### 7.3 파일 분리

- `credentials/`: storage state, bypass material, token cache
- `artifacts/`: allowlist DTO만 저장
- 두 디렉터리 간 파일 복사 금지
- artifact scanner가 credential directory를 읽거나 업로드하지 않음

### 7.4 수명주기

- run lock 획득 후 생성
- 기본 TTL 30분
- 정상 종료, 실패, SIGINT, SIGTERM, uncaught exception에서 cleanup
- cleanup 실패 시 파일 경로만 보고하고 내용은 출력하지 않음
- 최종 gate 후 storage state와 token cache는 기본 삭제
- 재사용이 필요한 login evidence는 token 없이 hash와 공개 metadata만 별도 저장

### 7.5 병렬 실행 방지

동일 `(repository, deploymentId, accountHash)` 조합에 전역 lock을 둔다. lock이 존재하면 새 실행은 중단한다.

실패 분류: `CREDENTIAL_STORAGE_FAILURE` 또는 `CONCURRENT_RUN_FAILURE`.

## 8. Account Enrollment 및 로그인 증거

### 8.1 승인 registry

Account A/B의 user ID SHA-256은 Hosted 실행과 분리된 enrollment 단계에서 생성한다.

registry 항목:

- account key: `A` 또는 `B`
- user ID SHA-256
- expected access role: `premium_allowed` 또는 `premium_denied`
- operator attestation: 검증 전용 계정 여부
- approvedAt
- registry version

Hosted 실행은 registry를 읽기만 하며 수정할 수 없다. 로그인 결과를 보고 예상 hash를 동적으로 갱신하는 기능을 두지 않는다.

`검증 전용 계정` 여부는 기술적으로 독립 증명할 수 없으므로 operator attestation으로 명확히 분류한다.

### 8.2 공식 Supabase SSR session 해석

storage state cookie를 수동 문자열 파싱하지 않는다.

- 현재 저장소가 사용하는 `@supabase/ssr`의 `createServerClient`를 사용
- Playwright storage state의 cookie adapter를 공식 client에 제공
- `auth.getUser()`로 서버 검증된 실제 사용자 조회
- cookie chunk, ordering, encoding은 라이브러리에 위임
- library version은 lockfile과 contract test로 고정

### 8.3 영구 사용자·provider 검증

다음을 강제한다.

- `user.id` 존재
- `user.is_anonymous !== true`
- anonymous provider 아님
- user ID hash가 승인 registry와 일치
- Account A/B hash가 서로 다름
- login evidence의 storage-state hash가 현재 파일과 일치

Google provider 여부는 `app_metadata.provider`와 `identities[].provider`의 safe projection으로 확인하되 provider metadata 원문은 저장하지 않는다.

### 8.4 login evidence

기록 허용:

- account key
- user ID SHA-256
- permanent user boolean
- provider category
- deployment ID
- target host
- deployment SHA
- final path
- storage-state SHA-256
- createdAt, expiresAt
- evidence schema version

기록 금지:

- email
- user metadata 원문
- token
- cookie
- OAuth code
- provider identity ID

## 9. Fixture Sandbox

### 9.1 fixture 권한

fixture는 다음만 제공한다.

- scenario ID
- same-origin 상대 start path
- 제한된 action sequence
- 입력 값
- fixture root 내부 파일의 상대 경로
- 실제 DOM 조사로 확정된 accessible role/name locator

fixture는 다음을 제공하거나 변경할 수 없다.

- required evidence 목록
- PASS/FAIL 규칙
- canonical projection field 목록
- expected deployment/host/SHA
- allowed origin
- credential 경로
- artifact 경로
- network interception policy
- arbitrary JavaScript

### 9.2 허용 action DSL

허용:

- `gotoRelative`
- `clickByRole`
- `fillByLabel`
- `selectOptionByLabel`
- `checkByLabel`
- `setInputFiles`
- `waitForHeading`
- `expectVisibleTextKey`

금지:

- `evaluate`
- arbitrary CSS/XPath
- 외부 URL
- shell command
- localStorage/sessionStorage 임의 쓰기
- cookie 임의 쓰기
- logout/delete/payment/admin action

### 9.3 경로·파일 제한

- start path는 `/`로 시작하고 `//` 금지
- 매 navigation 후 origin 재확인
- 업로드 파일은 전용 fixture root 하위만 허용
- realpath가 fixture root를 벗어나면 실패
- 허용 확장자, MIME, 최대 크기 고정
- symlink 금지
- 개인 실사용 사진 금지
- fixture SHA-256을 manifest에 기록

실패 분류: `FIXTURE_CONTRACT_FAILURE`.

## 10. Scenario Isolation

각 lane은 다음 격리를 가진다.

1. fresh Playwright browser context
2. 승인된 Account auth cookie와 Preview protection cookie만 복원
3. Premium report cookie, localStorage, sessionStorage, IndexedDB 제거
4. 새 analyze 요청으로 새 Premium session 생성
5. lane별 request sequence와 run ID 생성
6. lane 종료 후 browser context 폐기
7. 실행은 순차 처리

Account A/B context와 storage state는 절대 공유하지 않는다.

각 lane의 저장 ID는 run manifest에 연결하고, 다음 lane 시작 전에 이전 lane report 불변성을 read-only 확인한다.

## 11. Network Request Correlation

단순 전역 response listener를 사용하지 않는다.

각 action 직전에 endpoint별 `waitForResponse`를 설치하고 다음 조건을 모두 사용한다.

- exact origin
- pathname
- HTTP method
- request body safe-projection hash
- lane ID
- request sequence
- expected status class

일치 응답이 0개 또는 2개 이상이면 실패한다. retry가 발생하면 retry reason과 sequence를 별도로 기록한다.

raw request/response body는 artifact에 저장하지 않는다.

실패 분류: `NETWORK_CORRELATION_FAILURE`.

## 12. Canonical Evidence Projection

### 12.1 증거 계층

각 UI lane은 세 계층을 교차 검증한다.

1. 브라우저 동작
   - 실제 입력 완료
   - 예상 결과 화면 도달
   - 필수 warning/fallback/error UI 가시성

2. 네트워크 canonical evidence
   - `/api/analyze`
   - `/api/full-report`
   - `/api/full-report/session`
   의 raw body를 메모리에서 즉시 allowlist projection

3. 저장 evidence
   - RLS 범위의 saved report safe projection
   - immutable snapshot fingerprint
   - locale-neutral semantic fingerprint
   - version과 Top Pick ID

### 12.2 고정 필수 필드

필수 필드는 검증기 코드 상수로 고정한다.

- functional status
- functional reason-code set
- routine status
- routine reason-code set
- condition status
- condition reason-code set
- cross-domain consistency verdict
- consistency reason-code set
- confidence band 또는 confidence ceiling
- fallback state
- uncertainty state
- top pick product ID 또는 명시적 null reason
- report locale
- immutable snapshot fingerprint
- locale-neutral semantic fingerprint
- report version
- snapshot version
- decision bundle version

fixture는 이 목록을 축소할 수 없다.

### 12.3 canonical projection 불가 처리

현재 공개 API response 또는 RLS-readable saved snapshot에서 필수 값을 얻지 못하면 UI 텍스트를 대신 canonical evidence로 승격하지 않는다.

결과: `HARNESS_FAILURE: canonical_projection_unavailable`.

## 13. Locale-neutral Semantic Fingerprint

기존 저장 snapshot fingerprint는 locale과 번역 결과를 포함하므로 보고서 불변성 검증에만 사용한다.

KO/EN 의미 동일성에는 별도 `semanticFingerprintV1`을 사용한다.

### 13.1 포함

- 정책 status
- 정렬·중복 제거된 reason code set
- consistency verdict와 reason code set
- confidence band/ceiling
- fallback/uncertainty flags
- top pick product ID
- current product canonical action/status
- report/snapshot/bundle version
- catalog safe-projection hash

### 13.2 제외

- locale
- 번역 문자열
- title, label, 설명문
- generatedAt
- savedReportId
- session ID
- image URL/alt
- UI ordering
- locale별 가격·표시 형식

### 13.3 비교

- KO/EN 입력의 semantic input hash가 동일해야 함
- catalog hash가 동일해야 함
- semantic fingerprint가 동일해야 함
- reason code 배열에 중복이 있으면 contract failure

## 14. UI Projection Verification

UI 의미 판정을 raw 텍스트 전체 비교로 수행하지 않는다.

검증 대상:

- 결과 page heading과 주요 section 도달
- canonical status에 대응하는 locale별 공개 label key의 가시성
- warning, fallback, uncertainty가 숨겨지지 않음
- 저장 완료·재열람·충돌 UI 상태
- 인증·권한 오류 화면

locator는 실제 accessible role, label, heading, button name을 사용한다. 실제 DOM에 존재하지 않는 `data-*` 속성을 가정하지 않는다.

locale별 copy는 별도 mapping contract에 두며, canonical 판정은 network/DB projection이 담당한다.

## 15. Artifact 및 로그 보안

### 15.1 allowlist writer

artifact writer는 arbitrary object를 받지 않는다. schema별 DTO builder만 허용한다.

허용:

- hash
- public reason code
- status
- version
- product ID
- fingerprint
- HTTP status
- public error code
- duration
- deployment ID, host, SHA
- fixture hash

금지:

- access/refresh token
- cookie value
- Authorization header
- email
- OAuth code
- raw user metadata
- raw photo 또는 data URL
- 전체 Premium report body
- raw source session ID
- full request body

### 15.2 Playwright 기록

- HAR 기본 비활성화
- trace 기본 비활성화
- video 비활성화
- screenshot 기본 비활성화
- 실패 screenshot이 필요한 경우 사전 승인된 결과 영역만 캡처하고 개인정보·사진 영역 마스킹
- console listener는 redaction 후 공개 error code만 기록
- exception stack은 로컬 stderr에 제한하고 artifact에는 분류 코드와 파일/line만 기록

### 15.3 secret scan

artifact 디렉터리 전체를 재귀 검사한다.

- JWT 형태
- Supabase auth cookie key/value
- Authorization header
- 이메일
- OAuth code/query
- service-role/anon key 패턴
- data URL
- raw UUID user ID
- source session ID

검출 시 artifact를 폐기하고 `HARNESS_FAILURE: artifact_secret_detected`.

## 16. Live Schema Evidence Levels

schema 검증 수준을 과장하지 않는다.

### Level A: deployment metadata

- 저장소 migration hash
- GitHub/Vercel deployment SHA
- migration 적용 주장 아님

### Level B: public/RLS read contract

Account A로 다음 컬럼 select 가능 여부 확인:

- `id`
- `user_id`
- `report_type`
- `report_version`
- `source_type`
- `source_session_id`
- `premium_report`
- `created_at`
- `updated_at`

컬럼 존재와 read contract만 입증한다. DB native type과 migration 적용 이력은 확정하지 않는다.

### Level C: runtime behavior

실제 저장·재시도·충돌·rotation으로 다음을 입증한다.

- required 값 저장
- unique tuple 동작
- finalized immutability
- RLS owner isolation
- runtime value type/shape

### Level D: authoritative migration evidence

Supabase CLI linked project 또는 승인된 관리 API에서 migration version을 read-only 조회한 경우에만 exact migration applied를 확정한다.

Level D가 없으면 `migration exact state: UNCONFIRMED`로 보고하되, Level B/C가 단계 10 gate 요구를 충족하는지는 별도 계약으로 판정한다.

## 17. Catalog Snapshot Binding

제품 DB 변화로 KO/EN oracle이 흔들리지 않도록 필수 product row의 safe projection hash를 사용한다.

safe projection 예:

- product ID
- category
- canonical functional axes
- recommendation eligibility 관련 공개 상태
- current-product evaluability 관련 공개 상태

규칙:

- KO 실행 직전 catalog hash 기록
- EN 실행 직전 동일 hash 강제
- 각 pair 종료 후 재확인
- 실행 도중 hash 변경 시 `CATALOG_DRIFT_FAILURE`
- live rank 변동으로 Top Pick 고정이 불가능한 경우 deterministic fixture가 지정한 invariant만 검증하고, Top Pick ID 필수 여부는 contract에서 명시적으로 분리

## 18. Photo Fallback 결정성

Photo Fallback은 provider 오류와 구분한다.

PASS 가능한 fallback:

- 앱 계약에 정의된 `insufficient_photo_evidence`
- 명시적 no-face/low-evidence 상태
- 설문 기반 canonical 판단 유지

PASS 불가:

- HTTP 429
- provider 5xx
- timeout
- 이미지 형식 오류
- 업로드 실패
- 인증 오류

fallback fixture는 합성·비식별이어야 하며 예상 fallback reason code를 contract에 고정한다. 동일 fixture를 사전 synthetic/local contract에서 반복해 안정성을 확인한다. 실제 provider 결과가 비결정적이면 lane을 PASS시키지 않고 `PHOTO_FALLBACK_NONDETERMINISTIC`으로 중단한다.

provider 호출에는 최대 호출 수, 전체 시간, bounded retry와 `Retry-After` 준수를 적용한다.

## 19. Preview Protection

- 302를 Preview 접근 성공으로 간주하지 않는다.
- 보호 페이지 login은 앱 Google OAuth와 분리된 credential boundary로 취급한다.
- Vercel bypass cookie 또는 사용자 직접 보호 인증 후 생성된 cookie는 credential directory에만 저장한다.
- bypass material은 target deployment ID와 host에 결속한다.
- 다른 Preview에 재사용하지 않는다.
- 정상 Preview와 Fault Preview credential을 분리한다.

## 20. Failure Taxonomy

- `PREVIEW_ATTESTATION_FAILURE`
- `PREVIEW_ACCESS_FAILURE`
- `CREDENTIAL_STORAGE_FAILURE`
- `AUTH_EVIDENCE_FAILURE`
- `ACCOUNT_REGISTRY_FAILURE`
- `FIXTURE_CONTRACT_FAILURE`
- `NETWORK_CORRELATION_FAILURE`
- `CANONICAL_PROJECTION_FAILURE`
- `LOCALE_SEMANTIC_MISMATCH`
- `LIVE_SCHEMA_FAILURE`
- `CATALOG_DRIFT_FAILURE`
- `SCENARIO_ISOLATION_FAILURE`
- `PHOTO_FALLBACK_NONDETERMINISTIC`
- `ARTIFACT_SECURITY_FAILURE`
- `PRODUCT_RUNTIME_FAILURE`

다음은 하네스 실패다.

- 존재하지 않는 selector
- fixture가 필수 검증을 우회
- deployment attestation 전 credential 로드
- login evidence와 storage-state hash 불일치
- canonical 필드 수집 불가
- raw response/artifact secret 검출
- request correlation 모호성
- scenario session 오염

제품 결함과 하네스 결함을 같은 결과 코드로 합치지 않는다.

## 21. Preflight 순서

Preflight는 다음 순서를 바꿀 수 없다.

1. GitHub PR exact-head 조회
2. GitHub/Vercel deployment attestation
3. 비인증 origin/redirect/protection 확인
4. run lock과 secure temp 생성
5. fixture schema·path·hash 검증
6. account registry 읽기
7. storage-state 권한·hash·TTL 검증
8. 공식 Supabase SSR client로 Account A/B `getUser()`
9. Account A/B 상이성·영구 사용자·provider 확인
10. OAuth login evidence와 deployment 결속 확인
11. live schema Level B 확인
12. catalog baseline hash 확인
13. canonical projection capability 확인
14. write-capable lane 허용

1~13 중 하나라도 실패하면 DB write와 Premium 저장 lane을 시작하지 않는다.

## 22. 필수 Lane

- preflight
- google-login-a
- google-login-b
- premium-entry
- ko-normal
- en-normal
- selected-product
- not-in-db
- selected-plus-not-in-db
- duplicate-axis
- photo-fallback
- persistence
- finalized-conflict
- session-rotation
- unauthenticated
- forbidden
- ownership
- principal-conflict
- safe-5xx

각 lane은 `executed`, `evidenceComplete`, `verdict`를 별도 기록한다. fixture 존재만으로 `executed=true`가 될 수 없다.

## 23. Contract Test Matrix

### Deployment/Credential

- 사용자 제공 SHA가 실제 Vercel SHA와 다르면 credential 미로드
- 잘못된 Vercel project ID 차단
- Production target 차단
- READY 아닌 deployment 차단
- 외부 redirect origin 차단
- storage state ACL 실패 차단
- TTL 초과 state 차단
- 동시 run lock 차단

### Authentication

- anonymous user 차단
- 동일 Account A/B 차단
- registry hash mismatch 차단
- storage-state hash mismatch 차단
- cookie chunk·순서 변경 처리
- Google provider 부재 차단

### Fixture

- `requiredEvidence` 주입 차단
- 외부 URL 차단
- path traversal·symlink 차단
- 임의 local file 업로드 차단
- evaluate/script action 차단
- logout/delete locator 차단

### Canonical/Locale

- 필수 canonical field 누락 차단
- KO/EN reason-code mismatch 탐지
- duplicate reason code 탐지
- locale만 다른 보고서의 semantic fingerprint 동일
- 정책 의미가 다른 보고서의 semantic fingerprint 불일치
- immutable snapshot fingerprint와 semantic fingerprint 역할 분리

### Artifact

- raw Premium response 저장 차단
- JWT/cookie/email/data URL 검출
- trace/HAR 비활성 확인
- arbitrary object writer 거부

### Isolation/Schema/Catalog

- lane 간 Premium cookie 잔존 탐지
- 동일 saved report 재사용 탐지
- request response 중복 correlation 차단
- live column 누락 탐지
- migration 상태 과장 금지
- catalog drift 탐지
- provider 429를 photo fallback으로 오판하지 않음

## 24. 구현 순서

### Phase 1 — Pure security core

- deployment attestation model
- credential release gate
- secure temp/ACL/TTL/lock
- account registry와 official SSR user resolution
- fixture schema/sandbox
- artifact allowlist writer와 secret scanner
- locale-neutral semantic fingerprint

### Phase 2 — Harness integration

- login capture 교체
- preflight 순서 적용
- request correlation
- canonical projection
- UI locator contract
- scenario isolation
- DB evidence level 분리
- catalog binding
- photo fallback 분류

### Phase 3 — Synthetic review

- 모든 악성·누락 fixture contract test
- token·cookie leakage test
- wrong-deployment credential exfiltration regression
- KO/EN semantic fingerprint test
- concurrency·cleanup test
- 기존 Premium verifier 회귀

### Phase 4 — Independent exact-head verification

구현 브랜치와 별도 임시 검증 브랜치/PR에서 exact HEAD를 검증한다. 임시 PR은 병합하지 않고 종료한다.

Hosted Preview 실제 실행은 구현 검증과 별도다.

## 25. 완료 조건

- Critical 0
- Important 0
- fixture가 필수 evidence·origin·판정 규칙을 변경할 수 없음
- deployment attestation 전 credential 접근 0회
- 실제 사용자 hash, 영구 사용자, provider, Account A/B 상이성 검증
- storage state ACL·TTL·cleanup·lock 검증
- KO/EN canonical reason code와 locale-neutral semantic fingerprint 비교
- UI/network/DB evidence 교차 확인
- request correlation 모호성 0
- scenario 간 session 오염 0
- catalog drift 감지
- schema evidence level을 과장하지 않음
- artifact allowlist와 secret scan 통과
- raw report, token, cookie, 이메일, 사진 artifact 0건
- 기존 verifier, architecture guard, build, git diff check 회귀 없음
- PR Draft 유지
- Production, DB schema, RLS, Auth 정책 미변경

## 26. 구현 후 외부 Gate

하네스 hardening과 exact-head 독립 검증이 PASS된 뒤에만 다음을 진행한다.

1. exact HEAD의 READY Preview 확보
2. Preview Protection 접근 준비
3. Account A/B enrollment 승인
4. 사용자가 headed browser에서 Google 로그인
5. 합성 정상·fallback fixture 준비
6. 정상 Preview 전체 실행
7. 독립 Fault Preview safe-5xx 실행
8. scoped cleanup 승인

CandidatePolicy runtime 재평가는 단계 10 전체 PASS 후에만 가능하다.

## 27. 설계 판정

이 v1.1 설계는 기존 v1에서 누락된 다음 항목을 필수 계약으로 승격한다.

- Trust Root & Credential Release Gate
- Authoritative Deployment Attestation
- Ephemeral Credential Storage
- Account Enrollment Registry
- Official Supabase SSR Session Resolution
- Locale-neutral Semantic Fingerprint
- Fixture Sandbox
- Scenario Isolation & Global Lock
- Network Response Correlation
- Schema Evidence Levels
- Catalog Snapshot Binding
- Photo Fallback Determinism
- Artifact/Trace/Screenshot Redaction

본 문서는 구현 승인 전 최종 독립 리뷰 대상이다.
