# Premium Hosted Preview Harness Hardening Design v2

## 1. 상태와 기준

- 상태: 구현 전 최종 설계
- 기준 저장소: `gycha0109-beep/K_beauty`
- 기준 Draft PR: #38
- 기준 브랜치: `agent/premium-hosted-preview-verification`
- 기준 HEAD: `5dd2c469d223c878a2139d8276b2c4a04c2f6bf3`
- 설계 브랜치: `agent/premium-hosted-preview-harness-hardening-design`
- 구현: 미수행
- Hosted Preview 실행: 미수행
- Production: 접근·실행·변경 금지

이 문서는 단계 10 실행에서 확인된 `HARNESS_FAILURE`를 제거하기 위한 최종 설계다. 검증기가 사용자 입력 URL, fixture, storage state 또는 API 전체 응답을 신뢰하여 거짓 PASS나 자격증명 유출을 만들지 못하도록 신뢰 사슬과 실행 경계를 다시 정의한다.

## 2. 목표

하네스는 다음을 독립적으로 증명해야 한다.

1. 자격증명을 전송하는 대상이 PR #38 exact HEAD의 Vercel Preview deployment다.
2. 해당 deployment는 READY이며 Production이 아니다.
3. Account A/B는 사전 승인된 서로 다른 Google 영구 사용자다.
4. 각 UI action, network response, saved row가 동일 lane·동일 request에 속한다.
5. KO/EN 결과는 locale-neutral canonical 의미에서 동일하다.
6. fixture가 필수 증거, origin, 판정 규칙, 파일 범위 또는 credential 범위를 완화할 수 없다.
7. scenario 간 cookie, session, catalog, saved row 오염이 없다.
8. raw token, cookie, 이메일, 원본 사진, 전체 Premium report가 artifact·trace·로그에 남지 않는다.
9. schema·deployment·catalog 상태를 입증 가능한 수준 이상으로 과장하지 않는다.
10. 필수 lane 하나라도 미실행·불확정·증거 누락이면 전체 gate는 PASS하지 않는다.

## 3. 비목표 및 변경 금지

이번 hardening은 검증 하네스만 변경한다.

변경 금지:

- Premium engine, CandidatePolicy, recommendation policy
- API response contract
- UI 마크업 또는 검증용 `data-*` 속성 추가
- DB schema, migration, RLS
- Supabase Auth/OAuth 설정
- Payment, Provider, Storage
- Vercel Production 설정
- Production deployment 또는 Production runtime 실행

현재 runtime에서 필수 canonical 값을 얻을 수 없으면 제품 코드를 고치지 않고 `CANONICAL_PROJECTION_UNAVAILABLE`로 종료한다.

## 4. 신뢰 모델

### 4.1 신뢰 출처

서로 독립된 출처를 교차 검증한다.

- GitHub PR API: repository, PR state, base, head, exact head SHA
- GitHub Deployment API: deployment ID, environment, deployment SHA
- 인증된 Vercel API/CLI: project ID, deployment ID, target, state, immutable deployment URL, aliases, source commit SHA
- 저장소 고정 contract:
  - 허용 Vercel project ID
  - Supabase project ref
  - fixture JSON schema
  - canonical projection path matrix
  - UI accessible-locator mapping
  - mandatory lane 목록
- Hosted run과 분리된 Account Enrollment Registry

### 4.2 신뢰하지 않는 값

다음은 단독 증거가 아니다.

- 사용자가 복사한 Preview URL
- 환경변수로 전달된 `EXPECTED_SHA`, `DEPLOYMENT_SHA`
- redirect 후 최종 URL
- fixture의 expected result 또는 required evidence
- storage state 원문
- API response 전체 객체
- UI 번역 문자열
- repository migration 파일 존재
- Vercel branch alias

## 5. 전체 실행 구조

하네스는 네 단계로 분리한다.

### Phase 0 — No-Credential Attestation

credential 파일을 열지 않고 PR·deployment·origin을 검증한다.

### Phase 1 — Secure Credential Enrollment

사용자가 headed browser에서 Google login과 Preview protection 인증을 직접 완료한다. credential은 OS temp secure store에만 저장한다.

### Phase 2 — Credential-Bound Preflight

공식 Supabase SSR client로 실제 사용자를 확인하고 fixture·schema·catalog·canonical projection 가능성을 검증한다.

### Phase 3 — Runtime Lanes

모든 preflight가 통과한 후에만 UI, persistence, ownership, fault lane을 순차 실행한다.

Phase 0~2 중 실패하면 DB write를 수행하지 않는다.

## 6. Authoritative Deployment Attestation

### 6.1 PR 확인

GitHub에서 직접 다음을 조회한다.

- repository = `gycha0109-beep/K_beauty`
- PR #38 = Open, Draft, Unmerged
- base = `agent/premium-browser-journey-verification`
- head = `agent/premium-hosted-preview-verification`
- exact head SHA

### 6.2 Deployment 교차 검증

GitHub Deployment와 Vercel Deployment를 모두 조회한다.

필수 일치:

- GitHub deployment SHA = PR exact head SHA
- Vercel source commit SHA = PR exact head SHA
- GitHub environment = Preview
- Vercel target = preview
- Vercel state = READY
- Vercel project ID = 저장소 고정 project ID
- immutable deployment URL이 해당 deployment ID에 속함
- Production target·Production alias가 아님

사용자가 입력한 SHA나 URL은 조회 키 또는 기대값으로만 사용하고 증거로 채택하지 않는다.

### 6.3 Immutable URL만 사용

branch alias는 실행 도중 다른 deployment를 가리킬 수 있으므로 credential-bound request에 사용하지 않는다.

- Vercel이 반환한 immutable deployment URL을 canonical target으로 고정
- 모든 lane 시작 직전에 deployment ID, state, source SHA 재확인
- run 종료 시 한 번 더 재확인
- 중간에 deployment가 바뀌거나 READY가 아니면 `DEPLOYMENT_DRIFT_FAILURE`

### 6.4 Response binding

비인증 probe에서 다음을 기록한다.

- exact host
- redirect chain
- `x-vercel-id` 등 공개 Vercel response metadata
- deployment 조회 시각

response header는 보조 증거이며 Vercel API attestation을 대체하지 않는다.

## 7. Credential Release Gate

다음 모두가 통과하기 전에는 storage state, token, cookie, Preview bypass material을 읽지 않는다.

- PR exact-head 확인
- GitHub/Vercel deployment 교차 확인
- READY Preview 확인
- immutable URL 확인
- project ID 일치
- Production 아님
- 허용 origin 외 redirect 없음
- Preview protection 처리 방법 존재

실패 분류: `PREVIEW_ATTESTATION_FAILURE`.

## 8. Redirect 및 Credential Forwarding 정책

인증된 HTTP 요청은 자동 redirect를 따르지 않는다.

- redirect status를 수신하면 `Location`을 검사
- same exact origin의 승인된 path 이동만 수동 허용
- origin 변경 시 credential을 다시 보내지 않고 즉시 중단
- Google OAuth와 Vercel protection flow는 headed browser에서 사용자 직접 수행
- API verifier의 Authorization/Cookie는 외부 origin에 전달될 수 없음

이 규칙은 최초 probe뿐 아니라 모든 credential-bound request에 적용한다.

## 9. Secure Ephemeral Credential Store

### 9.1 위치

- 저장소·worktree 외부 OS temp root
- OneDrive, Dropbox, Google Drive 등 동기화 경로 금지
- run별 무작위 디렉터리

### 9.2 권한

- POSIX directory `0700`, file `0600`
- Windows 현재 사용자와 SYSTEM만 접근 가능한 ACL
- 권한 적용 검증 실패 시 credential 저장 금지

### 9.3 분리

- `credentials/`: storage state, Preview protection material, refresh 결과
- `artifacts/`: allowlist evidence DTO
- artifact packaging은 `credentials/`를 입력으로 받지 않음

### 9.4 TTL과 cleanup

- 기본 TTL 30분
- 정상 종료, 실패, SIGINT, SIGTERM, uncaught exception에 cleanup handler
- TTL 초과 storage state 재사용 금지
- run 종료 후 credential 기본 삭제
- cleanup 실패 시 경로만 보고하고 내용은 출력하지 않음

### 9.5 Lock

동일 `(repository, deploymentId, accountHash)` 조합은 한 번에 한 run만 허용한다.

## 10. Account Enrollment Registry

Hosted 실행과 분리된 enrollment 단계에서 Account A/B를 승인한다.

필드:

- registry version
- account key A/B
- user ID SHA-256
- expected provider = google
- expected access role
  - A: `premium_allowed`
  - B: `premium_denied`
- operator attestation: 검증 전용 계정 여부
- approvedAt

Hosted verifier는 registry를 read-only로 사용한다. login 결과를 보고 registry hash를 자동 생성·수정하지 않는다.

`검증 전용 계정 여부`는 자동 입증이 불가능하므로 operator attestation으로 명시한다.

## 11. 공식 Supabase SSR Session Resolution

storage state cookie를 직접 문자열 파싱하지 않는다.

- 현재 lockfile의 `@supabase/ssr` `createServerClient` 사용
- Playwright storage state cookies를 `getAll/setAll` adapter로 제공
- `auth.getUser()`로 서버 검증된 사용자 조회
- cookie chunking, encoding, ordering은 공식 library에 위임
- library version contract test 추가

`getUser()` 과정에서 cookie refresh가 발생하면:

1. 갱신 cookie는 secure credential store에만 반영
2. storage-state hash 재계산
3. login evidence를 새 hash로 원자적 갱신
4. artifact에는 refresh 여부 boolean만 기록

## 12. 로그인 증거

필수 검증:

- user ID 존재
- `is_anonymous !== true`
- Google provider 확인
- user ID hash = registry hash
- Account A/B hash 상이
- storage-state hash 일치
- deployment ID, immutable host, deployment SHA 결속
- evidence TTL 유효

기록 허용:

- account key
- user ID hash
- permanent boolean
- provider category
- deployment ID/host/SHA
- storage-state hash
- final path
- createdAt/expiresAt
- evidence version

금지:

- email
- raw user ID
- token/cookie
- OAuth code
- identities 원문
- provider identity ID

## 13. Access Role Proof

registry의 access role은 기대값일 뿐 PASS 증거가 아니다.

실제 runtime에서 확인한다.

- Account A: Premium entry와 full-report 생성 성공
- Account B: release-mode 계약에 따른 402 또는 403
- B의 stale Premium cookie 우회 실패
- A cookie + B bearer principal conflict 401
- B가 A savedReportId 접근 실패

기대 role과 runtime 결과가 다르면 `ACCOUNT_ACCESS_MISMATCH`.

## 14. Fixture Sandbox

### 14.1 fixture가 제공 가능한 값

- scenario ID
- same-origin 상대 start path
- 제한된 action sequence
- 입력 값
- fixture root 내부 상대 파일 경로
- versioned accessible locator key

### 14.2 제공 불가 값

- required evidence
- PASS/FAIL 규칙
- canonical field 목록
- allowed origin
- credential 경로
- arbitrary URL
- arbitrary selector
- JavaScript/evaluate
- shell command
- network interception rule

### 14.3 허용 action DSL

- `gotoRelative`
- `clickByRoleKey`
- `fillByLabelKey`
- `selectByLabelKey`
- `checkByLabelKey`
- `setFixtureFile`
- `waitForHeadingKey`
- `expectVisibleCopyKey`

locator key는 저장소 고정 mapping으로만 해석한다. fixture가 role/name 문자열을 직접 주입하지 못하게 한다.

### 14.4 Path/File 정책

- start path `/` 시작, `//` 금지
- navigation마다 origin 확인
- file realpath가 fixture root 내부인지 확인
- symlink 금지
- MIME, 확장자, 최대 크기 allowlist
- 실사용 개인 사진 금지
- fixture hash 기록

## 15. Canonical Projection Path Matrix

canonical 값을 임의 추정하지 않는다. 저장소 고정 `CanonicalProjectionContractV1`이 response schema version별 exact source path와 타입을 정의한다.

예시 구조:

```text
field: functional.status
sources:
  network: decisionBundle.functionalPolicy.status
  saved: premium_report.decisionBundle.functionalPolicy.status
type: enum
required: true
```

필수 field:

- functional status
- functional reason-code set
- routine status
- routine reason-code set
- condition status
- condition reason-code set
- consistency verdict
- consistency reason-code set
- confidence band 또는 ceiling
- fallback state
- uncertainty state
- top pick product ID 또는 explicit null reason
- current-product canonical action/status
- locale
- immutable snapshot fingerprint
- report/snapshot/bundle version

규칙:

- path가 존재하지 않으면 다른 유사 필드로 자동 fallback 금지
- 타입 불일치 실패
- unknown extra field는 무시하되 필수 field 누락은 실패
- raw body는 메모리에서 projection 직후 폐기
- fixture가 path matrix를 수정할 수 없음

## 16. UI Accessible Projection Contract

UI는 canonical authority가 아니다. UI 검증은 canonical state가 사용자에게 숨겨지지 않는지 확인한다.

저장소 고정 mapping:

- canonical state/reason group
- locale별 copy key
- accessible role
- accessible name/heading key
- 필수 가시성 여부

금지:

- 실제 DOM에 없는 `data-*` 가정
- arbitrary CSS/XPath
- 전체 번역 문자열 동등 비교
- UI 텍스트를 canonical evidence로 승격

UI mapping이 실제 DOM과 맞지 않으면 제품 실패가 아니라 `UI_PROJECTION_CONTRACT_FAILURE`.

## 17. Network Request Correlation

전역 response listener로 결과를 선택하지 않는다.

각 action 직전에 `waitForResponse`를 설치하고 다음을 모두 일치시킨다.

- exact origin
- pathname
- HTTP method
- request body safe-projection hash
- lane ID
- request sequence
- 예상 status class

일치 응답 0개 또는 2개 이상이면 실패한다.

request body에 사진/data URL이 포함돼도 원문을 기록하지 않고 hash만 계산한다.

## 18. Raw Response Handling

`/api/full-report`는 전체 Premium report를 반환하므로 다음을 강제한다.

- response body는 메모리에서만 파싱
- 즉시 allowlist canonical DTO 생성
- raw object를 logger, assertion message, artifact writer에 전달 금지
- 실패 시에도 body dump 금지
- exception에는 endpoint, status, public code, projection failure path만 포함

Playwright:

- HAR off
- trace off
- video off
- screenshot off가 기본
- 승인된 screenshot은 개인정보·사진 영역 마스킹 후 결과 영역만 허용

## 19. Locale-neutral Semantic Fingerprint

기존 immutable snapshot fingerprint는 locale을 포함하므로 KO/EN 동일성 비교에 사용하지 않는다.

`semanticFingerprintV1` 입력:

- functional/routine/condition status
- 정렬·중복 제거된 reason-code sets
- consistency verdict/reasons
- confidence band/ceiling
- fallback/uncertainty flags
- top pick product ID 또는 null reason
- current-product canonical status/action
- report/snapshot/bundle version
- catalog safe-projection hash

제외:

- locale
- 번역 문자열
- title/description/label
- generatedAt
- savedReportId/session ID
- image URL/alt
- UI ordering

KO/EN 비교 전제:

- semantic input hash 동일
- fixture hash의 locale 외 부분 동일
- catalog hash 동일
- semantic fingerprint 동일
- reason code 중복 0

## 20. Scenario Isolation

각 lane:

1. fresh browser context
2. 승인된 auth cookies와 Preview protection cookie만 복원
3. Premium report cookie 제거
4. localStorage/sessionStorage/IndexedDB 초기화
5. 새 analyze로 새 Premium session 생성
6. lane별 request sequence 생성
7. 실행 후 context 폐기

추가 규칙:

- A/B context 공유 금지
- lane 순차 실행
- 각 savedReportId를 run/lane에 결속
- 다음 lane 시작 전 이전 report 불변성 read-only 확인
- session rotation lane 외 session 재사용 금지

## 21. Catalog Snapshot Binding

KO/EN pair 및 current-product lane에 사용되는 제품의 safe projection hash를 실행 전후 확인한다.

safe projection은 공개·비민감 field만 포함한다.

- product ID
- category
- canonical functional axes
- recommendation eligibility 관련 상태
- current-product evaluability 관련 상태

실행 중 hash 변경 시 `CATALOG_DRIFT_FAILURE`.

동적 ranking 때문에 Top Pick ID를 고정할 수 없는 scenario는 구현 전에 contract에서 invariant 기반 lane으로 명시한다. 실행 도중 임의 완화는 금지한다.

## 22. Live Schema Evidence Levels

### Level A — Repository/deployment

migration 파일과 deployment SHA만 확인. live 적용 증거 아님.

### Level B — RLS read contract

Account A로 필수 column select 가능 여부 확인.

- id
- user_id
- report_type
- report_version
- source_type
- source_session_id
- premium_report
- created_at
- updated_at

column 존재/read 가능만 입증한다.

### Level C — Runtime behavior

실제 저장·retry·409·rotation으로 입증한다.

- required shape 저장
- duplicate source tuple 방지
- finalized immutability
- owner isolation
- runtime value shape

### Level D — Authoritative migration history

Supabase CLI linked project 또는 승인된 management API read-only 조회가 있을 때만 migration 적용을 확정한다.

Level D가 없으면 exact migration state는 `UNCONFIRMED`로 보고한다.

## 23. DB Evidence Privacy

DB row에서 raw `user_id`와 `source_session_id`를 artifact에 기록하지 않는다.

- user ID: registry-compatible SHA-256
- source session ID: run-local SHA-256
- savedReportId는 cleanup 식별을 위해 허용
- artifact secret scan은 메모리에 보유한 실제 raw user/session/token 값을 exact-match로 검사

모든 UUID를 일반적으로 금지하지 않는다. savedReportId와 raw user ID를 구분한다.

## 24. Photo Fallback Determinism

PASS 가능한 fallback:

- contract에 정의된 `insufficient_photo_evidence`
- explicit no-face/low-evidence 상태
- 설문 기반 canonical 판단 유지

PASS로 인정하지 않음:

- 429
- provider 5xx
- timeout
- upload 실패
- image format 오류
- auth 오류

fixture는 합성·비식별이며 expected fallback reason code를 저장소 contract에 고정한다.

provider 호출:

- 최대 호출 수
- 최대 전체 시간
- bounded retry
- `Retry-After` 준수

동일 fixture가 안정적으로 fallback을 만들지 못하면 lane은 `PHOTO_FALLBACK_NONDETERMINISTIC`.

## 25. Fault Preview / safe-5xx

정상 Preview에 장애를 주입하지 않는다.

Fault Preview 필수 attestation:

- 별도 deployment ID와 immutable URL
- 동일 exact application SHA 또는 명시적 fault-only commit
- target = preview
- Production 아님
- 정상 Preview와 별도 environment scope
- fault toggle 하나만 활성화
- 정상 Supabase production project를 파괴적으로 변경하지 않음

허용 fault:

- read-only dependency failure
- save path의 isolated test-only failure
- timeout simulator

금지:

- 공유 Preview env 변경
- Production env 변경
- schema/RLS 변경
- 여러 fault 동시 활성화

검증:

- 5xx가 성공으로 위장되지 않음
- stack/secret/DB 상세 미노출
- partial/duplicate save 0
- retry 가능한 public error

Fault Preview가 없으면 safe-5xx는 `NOT_EXECUTED`이며 전체 단계 10 PASS 금지.

## 26. Scoped Cleanup

cleanup 대상은 현재 run evidence에 기록된 savedReportId만 허용한다.

삭제 전:

- run ID
- lane ID
- savedReportId
- owner hash
- creation evidence
- 대상 deployment/Supabase ref
을 다시 확인한다.

규칙:

- wildcard/query-range deletion 금지
- 기존 데이터 삭제 금지
- 각 ID 개별 삭제
- 사용자 명시 승인 전 DB 삭제 금지
- 삭제 후 개별 재조회
- cleanup 자체도 owner RLS 범위 사용
- credential cleanup은 사용자 승인 없이 즉시 수행

## 27. Artifact Allowlist 및 Secret Scan

artifact writer는 arbitrary object를 받지 않고 schema별 DTO만 받는다.

허용:

- hash
- public reason code
- status/version
- product ID
- savedReportId
- fingerprint
- HTTP status/public error code
- duration
- deployment ID/host/SHA
- fixture hash

금지:

- token/cookie/Authorization
- email/OAuth code
- raw user ID
- raw source session ID
- raw photo/data URL
- full request/response body
- whole Premium report

secret scan:

- 현재 run에서 실제 사용한 token/cookie/raw user ID/raw source session ID exact-match
- JWT pattern
- email
- Authorization header
- data URL
- known Supabase/Vercel secret values

검출 시 artifact 디렉터리 폐기 후 `ARTIFACT_SECURITY_FAILURE`.

## 28. Preflight 순서

순서를 바꿀 수 없다.

1. PR exact-head 조회
2. GitHub/Vercel deployment attestation
3. 비인증 redirect/protection probe
4. secure temp, ACL, lock
5. fixture schema/path/hash
6. Account Registry load
7. storage-state ACL/hash/TTL
8. official SSR `getUser()` A/B
9. provider/permanent/hash/상이성
10. login evidence deployment binding
11. access role non-write probe 가능한 범위 확인
12. live schema Level B
13. catalog baseline
14. canonical path capability
15. UI locator capability
16. runtime lane 허용

1~15 실패 시 write lane 금지.

## 29. 필수 Lanes

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

각 lane은 다음을 따로 기록한다.

- executed
- evidenceComplete
- verdict
- failureCategory

fixture 존재만으로 executed가 될 수 없다.

## 30. Failure Taxonomy

- `PREVIEW_ATTESTATION_FAILURE`
- `DEPLOYMENT_DRIFT_FAILURE`
- `PREVIEW_ACCESS_FAILURE`
- `CREDENTIAL_STORAGE_FAILURE`
- `CONCURRENT_RUN_FAILURE`
- `AUTH_EVIDENCE_FAILURE`
- `ACCOUNT_REGISTRY_FAILURE`
- `ACCOUNT_ACCESS_MISMATCH`
- `FIXTURE_CONTRACT_FAILURE`
- `UI_PROJECTION_CONTRACT_FAILURE`
- `NETWORK_CORRELATION_FAILURE`
- `CANONICAL_PROJECTION_UNAVAILABLE`
- `LOCALE_SEMANTIC_MISMATCH`
- `LIVE_SCHEMA_FAILURE`
- `CATALOG_DRIFT_FAILURE`
- `SCENARIO_ISOLATION_FAILURE`
- `PHOTO_FALLBACK_NONDETERMINISTIC`
- `FAULT_PREVIEW_FAILURE`
- `ARTIFACT_SECURITY_FAILURE`
- `PRODUCT_RUNTIME_FAILURE`

하네스 결함과 제품 결함은 동일 코드로 합치지 않는다.

## 31. Contract Test Matrix

### Deployment/Credential

- fake env SHA 차단
- wrong Vercel project 차단
- branch alias drift 차단
- Production target 차단
- READY 아닌 deployment 차단
- authenticated redirect origin 변경 시 credential 미전송
- ACL/TTL 실패 차단
- concurrent run 차단

### Auth

- anonymous user 차단
- non-Google provider 차단
- same A/B 차단
- registry mismatch 차단
- storage hash mismatch 차단
- chunked cookie 처리
- refresh 후 evidence hash 갱신

### Fixture

- requiredEvidence 주입 차단
- arbitrary locator 차단
- external URL 차단
- path traversal/symlink 차단
- arbitrary local file 차단
- evaluate/shell/logout/delete action 차단

### Canonical/Locale

- exact source path 누락 차단
- type mismatch 차단
- reason mismatch 탐지
- duplicate reason 탐지
- locale-only 차이 semantic hash 동일
- policy 차이 semantic hash 불일치
- immutable fingerprint와 semantic fingerprint 분리

### Network/Artifact

- 0개/복수 response correlation 차단
- raw response logging 차단
- HAR/trace/video off 확인
- known token/cookie/user/session exact leak 탐지
- savedReportId 허용과 user UUID 금지 구분

### Isolation/Schema/Catalog/Fault

- lane cookie 오염 탐지
- saved report 재사용 탐지
- catalog drift 탐지
- schema level 과장 방지
- provider 429 fallback 오판 방지
- 정상 Preview fault injection 차단
- fault toggle 복수 활성화 차단
- cleanup wildcard 차단

## 32. 구현 순서

### Phase I — Pure security core

- deployment attestation
- credential release gate
- redirect no-forward policy
- secure store/ACL/TTL/lock
- registry/official SSR user resolver
- fixture sandbox
- canonical path contract
- semantic fingerprint
- artifact DTO/secret scan

### Phase II — Runtime harness integration

- login capture 교체
- preflight 순서 적용
- UI accessible contract
- network correlation
- scenario isolation
- DB evidence levels/privacy
- catalog binding
- photo fallback
- fault preview
- scoped cleanup

### Phase III — Recursive self-review

Critical/Important가 0이 될 때까지 설계 계약과 구현을 재검토한다. fixture나 verifier를 약화해 테스트를 통과시키지 않는다.

### Phase IV — Independent exact-head verification

별도 임시 검증 브랜치/PR에서 exact implementation HEAD를 검증한다. 임시 PR은 병합하지 않고 닫는다.

Hosted Preview 실제 실행은 구현 검증 이후 별도 단계다.

## 33. 완료 조건

- Critical 0
- Important 0
- deployment attestation 전 credential read 0회
- authenticated cross-origin redirect credential forwarding 0회
- branch alias 사용 0회
- storage state ACL/TTL/cleanup/lock 검증
- A/B 실제 user hash, Google provider, 영구 사용자, 상이성 검증
- fixture가 evidence/origin/locator/판정 규칙을 바꿀 수 없음
- exact canonical path matrix와 type 검증
- KO/EN semantic fingerprint 비교
- UI/network/DB 상호 결속
- response correlation 모호성 0
- scenario 오염 0
- catalog drift 감지
- schema evidence level 과장 0
- raw report/token/cookie/email/photo artifact 0건
- fault Preview 정상 Preview와 완전 분리
- cleanup 대상 run-scoped ID로 제한
- 기존 verifier, architecture guard, build, git diff check 회귀 없음
- Draft 유지
- Production, DB schema, RLS, Auth 정책 변경 없음

## 34. 외부 실행 전제

구현과 독립 검증이 PASS된 후에만 필요하다.

1. exact HEAD READY Preview
2. Vercel API/CLI read access
3. Preview protection 사용자 인증 또는 승인된 bypass
4. Account A/B enrollment
5. headed Google login 두 번
6. 합성 정상/fallback 사진
7. 별도 Fault Preview
8. cleanup 승인

CandidatePolicy runtime 재평가는 단계 10 전체 PASS 후에만 가능하다.
