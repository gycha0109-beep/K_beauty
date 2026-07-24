# Premium Hosted E2E Local Runner

## 목적

Google OAuth가 필요한 Premium Hosted E2E를 Codex나 GitHub Actions에 맡기지 않고 로컬에서 반복 실행한다.

- 최초 1회만 A/B 전용 Google 테스트 계정으로 직접 로그인한다.
- 이후에는 저장된 Chromium 프로필을 재사용한다.
- Google 이메일과 비밀번호를 코드, YAML, 환경 변수에 저장하지 않는다.
- 기존 `run-premium-browser-journey.mjs`와 강제 cleanup 계약은 그대로 사용한다.
- Preview 환경에서만 동작하며 `main`/`master`에서 bootstrap을 거부한다.
- 추적·비추적 변경이 남은 Git working tree에서는 실행을 거부한다.

## 로컬 저장 위치

다음 경로는 Git에서 제외된다.

```text
.codex/runtime/premium-e2e/
├─ profile-a/
├─ profile-b/
├─ account-a-storage-state.json
├─ account-b-storage-state.json
├─ account-metadata.json
├─ config.json
├─ conflict-body.json
├─ synthetic-face-fixture.png
└─ artifacts/
```

이 디렉터리에는 로그인 세션이 포함될 수 있다. 커밋하거나 다른 사람에게 전달하지 않는다.

## 최초 준비

대상 Preview 브랜치를 checkout하고 의존성을 준비한다.

```bash
npm ci
npx playwright install chromium
npm run check:premium-browser-journey-local
```

A/B 로그인을 등록한다.

```bash
npm run e2e:premium:login -- --url=https://YOUR-PREVIEW-URL
```

실행 순서:

1. A 프로필 Chromium이 열린다.
2. A 전용 Google 테스트 계정으로 로그인한다.
3. 로그인 완료를 감지하면 A 창이 닫힌다.
4. B 프로필 Chromium이 열린다.
5. B 전용 Google 테스트 계정으로 로그인한다.
6. 두 계정이 서로 다른 영구 Google 계정인지 검증한다.

스크립트는 로그인 후 대상 Preview 홈을 다시 열어 브라우저의 Supabase `/auth/v1/user` 요청에서 현재 세션을 확인한다. 비밀번호와 이메일은 읽거나 기록하지 않는다.

Vercel Deployment Protection을 사용하는 경우:

```bash
npm run e2e:premium:login -- \
  --url=https://YOUR-PREVIEW-URL \
  --preview-bypass-token=YOUR_LOCAL_BYPASS_TOKEN
```

bypass token은 셸 기록에 남길 수 있으므로 환경 변수 사용이 더 적합하다.

```bash
PREMIUM_E2E_PREVIEW_BYPASS_TOKEN=... npm run e2e:premium:login -- --url=https://YOUR-PREVIEW-URL
```

## 반복 실행

bootstrap 이후에는 다음 한 줄로 KO/EN Hosted E2E와 cleanup을 실행한다.

```bash
npm run e2e:premium:hosted
```

동작 범위:

- Preview 연결 확인
- 로컬 wrapper 계약 및 기존 Premium journey 계약 검증
- A/B Chromium 프로필에서 최신 Supabase 세션 확인
- A storage state 갱신
- KO/EN 전체 Premium journey 실행
- cookie-only saved-report 재진입
- mixed-principal 및 B 계정 직접 접근 차단 검증
- finalized snapshot conflict 및 DB 불변성 검증
- session rotation과 두 번째 독립 저장 검증
- artifact secret scan
- 생성 report가 있으면 성공/실패와 무관하게 별도 cleanup 실행
- `local-run-summary.json` 기록

브라우저를 보면서 디버깅하려면:

```bash
npm run e2e:premium:hosted -- --headed
```

별도 비개인 테스트 이미지를 사용하려면:

```bash
npm run e2e:premium:hosted -- --image=/absolute/path/to/test.png
```

기본값은 로컬에서 생성되는 합성 PNG fixture다.

## SHA 계약

wrapper는 다음을 강제한다.

- Git working tree가 clean일 것
- 현재 checkout 브랜치가 bootstrap 당시 브랜치와 동일할 것
- `expected SHA`가 현재 로컬 `HEAD`와 동일할 것
- `deployment SHA`가 `expected SHA`와 동일할 것

명시적으로 전달할 수 있다.

```bash
npm run e2e:premium:hosted -- --deployment-sha=<40-character-git-sha>
```

Vercel Preview 응답 자체가 Git SHA를 공개하지 않는 경우, 이 값은 기존 harness와 동일하게 운영자가 선택한 배포 SHA assertion이다. 실행 전에 해당 Preview가 현재 로컬 HEAD의 배포인지 Vercel/GitHub 화면에서 확인해야 한다.

## 세션 만료

다음 오류가 나오면 A/B 프로필 중 하나의 Supabase 세션이 갱신되지 않은 상태다.

```text
AUTH_EXPIRED
```

다시 로그인한 뒤 재실행한다.

```bash
npm run e2e:premium:login
npm run e2e:premium:hosted
```

저장된 `config.json`을 사용하므로 Preview URL을 다시 입력할 필요는 없다.

## 결과 판정

- `HOSTED_PREVIEW_PASS`: Hosted journey와 필요한 cleanup이 모두 성공
- `HOSTED_PREVIEW_FAILURE`: journey 실패, 생성 데이터 cleanup은 성공했거나 불필요
- `CLEANUP_FAILURE`: 생성된 테스트 report cleanup 실패

결과 artifact는 다음 경로에 생성된다.

```text
.codex/runtime/premium-e2e/artifacts/<run-id>/
```

`HOSTED_PREVIEW_PASS`는 실제 실행 뒤에만 성립한다. repository contract 통과만으로 Hosted PASS를 선언하지 않는다.
