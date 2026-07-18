# Premium Hosted Preview Harness Hardening Design v1

## 1. 목적

단계 10 Hosted Preview 실행에서 확인된 HARNESS_FAILURE를 제거한다.

이 설계의 목표는 검증기를 실제 배포 환경에서 신뢰할 수 있는 fail-closed 검증 도구로 만드는 것이다. 제품 런타임, DB 스키마, RLS, Auth 정책, Payment, Provider, Production 설정은 변경하지 않는다.

기준 브랜치:

- `agent/premium-hosted-preview-verification`
- 기준 HEAD: `5dd2c469d223c878a2139d8276b2c4a04c2f6bf3`
- Draft PR: #38

## 2. 확인된 결함

### Critical

1. 로그인 캡처가 실제 사용자 정체성과 영구 사용자 여부를 증명하지 못한다.

### Important

1. UI journey가 실제 UI에 없는 `data-*` 속성을 읽는다.
2. fixture가 `requiredEvidence`를 축소해도 검증이 통과할 수 있다.
3. Preflight가 OAuth, 계정 차이, Preview 환경, live schema를 충분히 검증하지 않는다.
4. KO/EN 비교가 canonical reason code를 비교하지 않는다.

## 3. 설계 원칙

- 모든 필수 증거는 검증기 코드가 고정한다.
- fixture는 입력과 selector만 제공하며 필수 증거 집합을 변경하지 못한다.
- 로그인 증거는 Supabase Auth의 실제 사용자 응답과 연결한다.
- UI 검증은 DOM 텍스트만 신뢰하지 않고 네트워크 응답·저장 snapshot과 교차 검증한다.
- 민감정보는 메모리에서만 사용하고 artifact에는 해시·공개 메타데이터만 기록한다.
- 필수 증거가 하나라도 없으면 해당 lane과 전체 gate가 실패한다.
- 검증기 결함과 제품 결함을 다른 failure category로 분리한다.

## 4. 변경 범위

### 변경 대상

- `scripts/capture-premium-hosted-preview-google-login.mjs`
- `scripts/verify-premium-hosted-preview-preflight.mjs`
- `scripts/verify-premium-hosted-preview-ui-journey.mjs`
- `scripts/premium-hosted-preview-core.mjs`
- `scripts/verify-premium-hosted-preview-contract.mjs`
- 필요 시 신규 read-only helper
- 검증 문서와 work log

### 변경 금지

- Premium engine
- API response contract 자체
- DB migration/schema/RLS
- Auth 정책
- 실제 UI 마크업 추가 또는 변경
- Vercel/Production 설정
- 결제·Provider·Storage

## 5. 인증 증거 설계

### 5.1 로그인 캡처 흐름

1. headed Chromium에서 사용자가 직접 Google OAuth를 완료한다.
2. Preview origin 복귀를 확인한다.
3. browser storage state를 저장한다.
4. storage state의 Supabase access token을 메모리에서만 추출한다.
5. `${SUPABASE_URL}/auth/v1/user`를 호출한다.
6. 다음을 검증한다.
   - 응답 성공
   - `id` 존재
   - `is_anonymous === false`
   - provider가 anonymous가 아님
   - 기대 사용자 해시와 일치
7. login evidence에는 다음만 기록한다.
   - account key
   - user ID SHA-256
   - permanent user boolean
   - provider category
   - target host
   - deployment SHA
   - final path
   - createdAt
   - storage-state SHA-256

토큰·쿠키·이메일·provider metadata 원문은 기록하지 않는다.

### 5.2 Account A/B 상이성

Preflight가 두 login evidence의 사용자 해시가 다름을 강제한다.

### 5.3 증거 결속

login evidence는 다음이 모두 현재 실행과 일치해야 한다.

- target host
- deployment SHA
- storage-state hash
- expected user hash
- 생성 시각 허용 범위

하나라도 불일치하면 재로그인이 필요하다.

## 6. UI canonical evidence 설계

### 6.1 금지 방식

- 존재하지 않는 `data-*` 속성 가정
- 번역 문자열만 비교
- fixture가 필수 필드를 제거
- 기대값을 실제 결과에 맞춰 동적 생성

### 6.2 증거 소스

각 UI lane은 세 계층을 교차 검증한다.

1. **브라우저 동작 증거**
   - 실제 입력 action 완료
   - 결과 화면 도달
   - 오류·fallback UI 존재 여부

2. **네트워크 canonical 증거**
   - `/api/analyze`
   - `/api/full-report`
   - `/api/full-report/session`
   의 공개 응답에서 canonical metadata를 수집한다.

3. **저장 snapshot 증거**
   - saved report fingerprint
   - report/snapshot/bundle version
   - 저장 locale
   - top pick ID
   - canonical reason codes

UI lane PASS는 세 계층이 서로 일치할 때만 가능하다.

### 6.3 필수 canonical projection

검증기 코드가 다음 필드를 고정한다.

- functional policy status
- functional reason codes
- routine policy status
- routine reason codes
- condition policy status
- condition reason codes
- cross-domain consistency verdict
- consistency reason codes
- confidence band 또는 confidence ceiling
- fallback/uncertainty 상태
- top pick product ID
- snapshot fingerprint
- report locale

API가 공개 응답에서 해당 필드를 제공하지 않는 경우, 저장 snapshot의 공개-safe 파생값을 사용한다. 어느 쪽에서도 확인할 수 없으면 `HARNESS_FAILURE: canonical_projection_unavailable`로 중단한다.

### 6.4 UI와 canonical 연결

UI 텍스트는 locale별 label 존재만 확인한다. 의미 판정은 네트워크/저장 snapshot의 canonical 값으로 한다.

UI가 특정 상태를 숨기는지 확인할 때는 실제 화면 텍스트 또는 안정적인 role/heading/button locator를 사용한다. selector는 실제 DOM 조사로만 확정한다.

## 7. Fixture 계약

fixture가 제공할 수 있는 항목:

- start path
- action sequence
- input values
- file path
- stable role/text locator
- expected scenario ID

fixture가 제공할 수 없는 항목:

- required evidence 목록
- 허용되는 필수 필드 누락
- PASS/FAIL 판정 규칙
- expected canonical output 전체

시나리오별 기대값은 저장소의 deterministic policy fixture 또는 별도 고정 contract 파일에서 가져온다.

필수 시나리오:

- ko-normal
- en-normal
- selected-product
- not-in-db
- selected-plus-not-in-db
- duplicate-axis
- photo-fallback

## 8. KO/EN 의미 동일성

비교 대상:

- functional status
- functional reason-code set
- routine status
- routine reason-code set
- condition status
- condition reason-code set
- consistency verdict
- consistency reason-code set
- confidence band
- fallback/uncertainty state
- top pick ID
- snapshot semantic fingerprint

비교 제외:

- 번역 문구
- 문장 순서
- locale-specific copy

reason code set은 정렬 후 비교한다. 중복 reason code는 contract 위반으로 본다.

## 9. Preflight 강화

Preflight는 write 이전에 다음을 검증한다.

### Deployment

- HTTPS
- exact host
- exact deployment SHA
- Production 아님
- Preview Protection 처리 가능
- unexpected origin redirect 없음

### Account

- Account A/B login evidence 존재
- storage-state hash 일치
- 실제 사용자 해시 일치
- 영구 사용자
- 두 계정 상이

### OAuth

- callback path 계약
- 현재 Preview origin으로 왕복한 login evidence
- stale login evidence 차단

### Runtime configuration

- 필수 public runtime env의 존재 여부를 비밀값 출력 없이 확인
- Supabase auth endpoint 접근
- 필요한 REST table/column read contract 확인
- migration/version marker 확인

### Fixture

- 정상/fallback 사진 존재
- 모든 UI case 존재
- 필수 lane 정확히 한 번씩 존재
- selector/action schema 유효
- canonical projection source 존재

## 10. Live schema 확인

Service Role 없이 Account A의 RLS 범위에서 다음 read contract를 검사한다.

- `saved_reports` 필수 컬럼
- `report_type`
- `report_version`
- `source_type`
- `source_session_id`
- `premium_report`
- `created_at`
- `updated_at`

컬럼 부재·타입 불일치는 `PRECONDITION_FAILURE: live_schema_mismatch`로 중단한다.

migration table을 읽을 권한이 없으면 저장소 migration hash와 live column contract를 조합해 검증하며, migration 적용 여부를 독립 확정할 수 없다고 명시한다.

## 11. Failure taxonomy 보완

추가 또는 세분화:

- `AUTH_EVIDENCE_FAILURE`
- `CANONICAL_PROJECTION_FAILURE`
- `FIXTURE_CONTRACT_FAILURE`
- `LIVE_SCHEMA_FAILURE`
- `PREVIEW_ACCESS_FAILURE`

다음은 HARNESS_FAILURE로 분류한다.

- 존재하지 않는 selector
- 필수 canonical 값 수집 불가
- fixture가 필수 검증을 우회
- login evidence와 storage state 불일치
- artifact 민감정보 검출

## 12. Artifact 계약

허용:

- 해시
- 공개 reason code
- status
- version
- product ID
- fingerprint
- HTTP status
- 공개 error code
- duration
- host/SHA

금지:

- access/refresh token
- cookie value
- Authorization header
- email
- OAuth code
- raw photo
- full Premium report body
- raw source session ID

artifact writer는 allowlist 방식으로 변경한다. 임의 객체 전체 직렬화를 금지한다.

## 13. 검증 전략

### Pure contract tests

- 영구 사용자/익명 사용자 증거 판정
- Account A/B 동일 사용자 차단
- stale login evidence 차단
- storage-state hash mismatch 차단
- fixture requiredEvidence 주입 차단
- 필수 canonical field 누락 차단
- KO/EN reason-code mismatch 탐지
- duplicate reason code 탐지
- live schema mismatch 탐지
- artifact allowlist 검증

### Repository regression

- 기존 Premium verifier 전부
- architecture guard
- build
- git diff check

### Independent exact-head verification

구현 브랜치와 별도 임시 검증 브랜치/PR에서 exact HEAD를 검증한다. 검증 PR은 병합하지 않고 종료한다.

Hosted Preview 실제 실행은 구현 검증과 별도다.

## 14. 완료 조건

- Critical 0
- Important 0
- fixture가 필수 증거를 축소할 수 없음
- 실제 사용자 해시·영구 사용자·계정 상이성 검증
- canonical reason code 포함 KO/EN 비교
- UI/network/DB 교차 증거
- Preview/계정/schema preflight fail-closed
- artifact allowlist 및 secret scan
- 기존 verifier와 build 회귀 없음
- PR Draft 유지
- Production·DB schema·Auth 정책 미변경

## 15. 이후 단계

이 hardening 구현과 독립 검증이 PASS된 후에만 다음을 진행한다.

1. exact HEAD READY Preview 확보
2. Preview Protection 접근 준비
3. 전용 Google 계정 A/B 로그인
4. 합성 정상/fallback 사진 준비
5. 별도 Fault Preview 준비
6. 단계 10 Hosted Preview 전체 재실행

CandidatePolicy runtime 재평가는 단계 10 전체 PASS 후에만 가능하다.
