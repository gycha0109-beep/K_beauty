# Premium Hosted Preview Harness Hardening Work Log

## 기준

- 저장소: `gycha0109-beep/K_beauty`
- 선행 런타임 하네스: Draft PR #38
- 선행 HEAD: `5dd2c469d223c878a2139d8276b2c4a04c2f6bf3`
- 최종 설계: Draft PR #44
- 설계 문서: `docs/verification/premium-hosted-preview-harness-hardening-design-v2.1.md`
- 설계 HEAD: `1f483c19e235c54106d1d7604855e59a4ef96598`
- 구현 브랜치: `agent/premium-hosted-preview-harness-hardening`
- 구현 Draft PR: #51

## 기존 HARNESS_FAILURE

- 실제 UI에 없는 `data-*` 속성에 canonical 판정을 의존했다.
- fixture가 `requiredEvidence`를 축소할 수 있었다.
- Google 로그인 증거가 실제 Supabase 사용자, 영구 사용자 여부와 Account A/B 상이성을 입증하지 못했다.
- Preview·배포 SHA·환경·schema 검증이 자기진술 값에 의존했다.
- KO/EN 비교에서 reason code와 locale-neutral 의미 비교가 부족했다.

## 설계 보정

v2 설계를 실제 Decision Bundle v5와 `/api/full-report` 계약에 대조한 결과, 존재하지 않는 `uncertaintyState`와 Top Pick 부재 전용 reason을 직접 필드로 요구하는 결함을 발견했다.

v2.1에서 다음으로 보정했다.

- `uncertaintyState` 제거
- exact direct source로 계산하는 `evidenceStateV1` 도입
- Top Pick을 nullable presence/ID로 표현하고 가상의 null reason 생성 금지
- 여러 Top Pick ID 키는 값이 모두 같을 때만 허용
- 저장 불변성 fingerprint와 KO/EN semantic fingerprint 분리
- canonical exact path inventory를 실제 소스와 일치시킴
- UI는 accessible marker만 확인하고 의미는 correlated `/api/full-report`와 snapshot에서 추출

## 구현 파일

- `scripts/premium-hosted-preview-contract-core.mjs`
- `scripts/premium-hosted-preview-core-v2.mjs`
- `scripts/premium-hosted-preview-security.mjs`
- `scripts/generate-premium-hosted-preview-attestation.mjs`
- `scripts/capture-premium-hosted-preview-google-login.mjs`
- `scripts/verify-premium-hosted-preview-preflight.mjs`
- `scripts/verify-premium-hosted-preview-ui-journey.mjs`
- `scripts/verify-premium-hosted-preview-error-boundaries.mjs`
- `scripts/verify-premium-hosted-preview-db-evidence.mjs`
- `scripts/verify-premium-hosted-preview-gate.mjs`
- `scripts/cleanup-premium-hosted-preview-run.mjs`
- `scripts/verify-premium-hosted-preview-contract.mjs`
- `package.json`

## 구현 내용

- GitHub PR/Deployment와 Vercel Deployment API를 교차하는 authoritative attestation 생성기
- immutable Preview URL, READY/Preview target, project ID, exact SHA 검증
- attestation 통과 전 credential release 차단
- Supabase URL을 승인된 project ref에 결속
- OS temp 외 credential 저장 금지, POSIX mode/Windows ACL, TTL, run lock, cleanup
- `@supabase/ssr`의 `createServerClient()`와 `auth.getUser()`를 이용한 실제 사용자 증거
- fixture-owned selector/required evidence/PASS 규칙 제거
- accessible locator DSL과 업로드 realpath·확장자·크기 sandbox
- Decision Bundle exact-path canonical projection
- nullable Top Pick, reason code 중복/타입 검증
- locale-neutral semantic fingerprint와 `evidenceStateV1`
- full-report response 상관관계 확인 및 raw body artifact 차단
- auth/protection cookie만 복원하는 fresh browser context
- attested DB evidence, ownership, source-session 독립성, version 분리, duplicate tuple 검증
- 별도 authoritative Fault Preview 요구
- principal-conflict 포함 fail-closed lane gate
- 현재 run의 attested 개별 report ID에 한정한 cleanup

## 자체 리뷰 및 보완

최초 구현 후 전체 변경을 보안·false-pass·격리·개인정보 관점에서 재검토했다.

발견:

- Critical 3
  - attestation 파일의 provenance·freshness가 강제되지 않음
  - 일부 credential 사용 경로가 Preview/Supabase identity에 재결속되지 않음
  - browser context가 전체 storage state를 복원해 lane 오염 가능
- Important 8
  - Windows file ACL과 directory ACL 구분 부족
  - Top Pick 복수 ID 키 처리 모호성
  - current-product lane 중복/누락 가능
  - gate의 duplicate lane·principal-conflict 누락
  - DB source/version/source-session 검증 부족
  - Fault Preview 독립 attestation 부족
  - cleanup evidence의 deployment·owner binding 부족
  - artifact 문자열 값의 email/bearer/data URL 검출 부족
- Medium 2
  - accessible role allowlist 부족
  - login evidence schema와 최대 TTL 미강제

보완 후:

- Critical 0
- Important 0
- Medium 0

필수 evidence나 assertion을 optional로 변경하지 않았다.

## 검증

독립 임시 validation PR #52가 exact implementation code HEAD `cafd11ea8e6e0c0977ce79675c21a40452bd4275`를 checkout하여 실행했다.

- Workflow run: `29655702138`
- Job: `88109532732`
- 결과: PASS

통과 항목:

- `npm ci`
- 변경 `.mjs` 전체 `node --check`
- `npm run verify:premium-hosted-preview-harness-hardening`
- `npm run verify:premium-hosted-preview-contract`
- `npm run verify:premium-browser-journey-contract`
- `node scripts/verify-premium-route-storage-reentry.mjs`
- `node scripts/verify-premium-report-reentry-contract.mjs`
- `node scripts/verify-premium-integrated-evaluation.mjs`
- `node scripts/verify-premium-decision-state.mjs`
- `npm run architecture:guard`
- `npm run build`
- `git diff --check`

## 실행 경계

- 실제 Hosted Preview 전체 여정 미실행
- 실제 Google OAuth 미실행
- 실제 Account A/B 미사용
- 실제 Supabase DB write/delete 미수행
- Vercel/Supabase 설정 미변경
- DB schema/migration/RLS/Auth 정책 미변경
- Premium runtime/API/UI/CandidatePolicy 미변경
- Production 미접촉
- 사용자 기존 로컬 작업 트리 및 `codex/survey-input-contract-refactor` 미접촉

실제 catalog hash 생성과 live schema Level B/C/D, Account A/B, 별도 Fault Preview는 단계 10 실행 시 확인할 외부 gate다.
