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

## 최초 설계 보정

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
- `scripts/premium-hosted-preview-core.mjs`
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
- `docs/verification/premium-hosted-preview-live-runbook.md`
- `docs/verification/examples/premium-hosted-preview/manifest.example.json`
- `docs/verification/examples/premium-hosted-preview/ui-case.example.json`
- `docs/verification/examples/premium-hosted-preview/browser-conflict-body.example.json`

## 구현 내용

- GitHub PR/Deployment와 Vercel Deployment API를 교차하는 authoritative attestation 생성기
- immutable Preview URL, READY/Preview target, project ID, explicit PR number, exact SHA 검증
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

## 구현 자체 리뷰 및 1차 보완

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

1차 보완 후 Critical 0 / Important 0 / Medium 0으로 정리했다.

## Live 실행 준비 재검토 및 2차 보완

실제 Hosted Preview를 실행할 수 있는 수준인지 source와 Vercel 상태를 다시 대조했다. 이 과정에서 계약 검증만으로 드러나지 않았던 실행·복구·정리 결함을 추가 발견했다.

발견:

- Critical 5
  - attestation 생성기와 검증기가 PR #38을 기본값으로 사용하여 PR #51 exact-head를 검증할 수 없음
  - final gate 입력 JSON이 동일 run/PR/deployment에서 생성되었는지 강제하지 않음
  - UI가 생성한 7개 saved report가 cleanup scope에서 누락됨
  - raw saved report UUID가 배포 가능한 artifact에 남을 수 있음
  - cleanup 입력이 변경 가능한 raw evidence 파일에 의존하여 TOCTOU 및 범위 변조 가능
- Important 10
  - signed-in/Premium entry marker가 optional이라 인증·접근 false-pass 가능
  - browser journey의 일부 정규식 매칭만으로 persistence/rotation lane을 통과시킬 수 있음
  - browser step 중복과 exact expected-step set 검증 부족
  - manifest·attestation·result·storage-state 경로가 secure root 밖을 참조할 수 있음
  - UI case JSON과 browser conflict fixture의 realpath/symlink 검증 누락
  - Vercel 보호 Preview에서 bypass token을 안전하게 same-origin bootstrap하는 절차 부재
  - UI/DB/error 결과에 runId·PR·deployment·immutable host 결속 부족
  - DB evidence가 환경변수 raw ID 목록을 신뢰함
  - Fault Preview bypass/redirect 경계가 main Preview와 충분히 분리되지 않음
  - 사용 중인 확장 failure category 일부가 정의되지 않아 오류 분류가 소실됨
- Medium 3
  - current-product/UI case 개수와 lane 집합 검증이 분산됨
  - browser intermediate artifact와 distributable artifact 경계 문서 부족
  - 실패 중간 실행에서 생성된 row를 회수하기 위한 secure evidence 설명 부족

보완:

- `PREMIUM_HOSTED_PR_NUMBER`를 필수화하고 모든 attestation/login/preflight/gate에 동일 PR을 결속
- main/Fault Preview 모두 authenticated GitHub/Vercel metadata와 exact SHA를 요구
- manifest와 attestation을 secure run root/credentials directory 내부로 제한
- Account A/B storage state, result JSON, browser evidence, cleanup manifest 경로를 secure directory에 제한
- signed-in 및 Premium entry accessible marker를 필수화하고 role/kind allowlist 검증
- 모든 image/UI/conflict fixture를 realpath·확장자·크기·symlink 관점에서 검증
- Vercel bypass token을 exact Preview origin에만 보내고 redirect를 수동 차단
- UI 7개 lane마다 raw saved report ID를 secure per-lane evidence에만 기록
- browser journey 4개 row와 UI 7개 row를 합친 정확히 11개 current-run row를 DB에서 검증
- distributable artifact에서는 알려진 식별자 키를 SHA-256으로 치환하고 그 외 raw UUID를 거부
- final gate가 모든 result를 동일 run/PR/deployment/host에 결속하고 exact browser step set을 검사
- cleanup manifest를 SHA-256으로 고정하고 run/PR/deployment/owner/browser/UI evidence hash/TTL/정확히 11개 ID를 검증
- 각 row를 정상 RLS와 Account A로 재확인한 뒤 개별 삭제하고 삭제 관측 후 credential directory 제거
- 확장 failure category를 명시적으로 정의
- 전체 실행 순서, secure workspace, 11-row cleanup 경계, 수동 OAuth 지점을 live runbook에 기록

2차 보완 후 자체 리뷰 결과:

- Critical 0
- Important 0
- Medium 0

필수 evidence나 assertion을 optional로 변경하지 않았다.

## 이전 독립 검증

이전 구현 HEAD `82ff42e179253e4acbf8b3c908324df65d7f0df1`은 임시 Draft PR #53에서 검증되어 PASS했으나, 이후 live 실행 준비 보완으로 구현 HEAD가 변경되었으므로 해당 결과를 최종 exact-head 근거로 사용하지 않는다.

## 최종 검증 계획

현재 최종 구현 HEAD를 고정한 뒤 별도 임시 validation branch/PR에서 다음을 실행한다.

- `npm ci`
- 변경 `.mjs` 전체 `node --check`
- `npm run verify:premium-hosted-preview-harness-hardening`
- `npm run verify:premium-hosted-preview-contract`
- `npm run verify:premium-browser-journey-contract`
- `node scripts/verify-premium-route-storage-reentry.mjs`
- `node scripts/verify-premium-report-reentry-contract.mjs`
- `node scripts/verify-premium-integrated-evaluation.mjs`
- `node scripts/verify-premium-decision-state.mjs`
- example JSON parse
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

실제 live gate에는 exact-head READY Preview, Account A/B interactive OAuth, public Supabase config, catalog hash, synthetic photos, exact UI fixtures, 별도 Fault Preview가 필요하다. 현재 저장소와 하네스 측에서 준비 가능한 범위는 구현 및 문서화했다.
