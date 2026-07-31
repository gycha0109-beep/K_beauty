# Bejewely Stage 10 Hosted Preview 사용자 흐름 통합 검증 결과

## 판정

`STAGE_10_HOSTED_PREVIEW_USER_FLOW_BLOCKED_EXTERNAL`

제품의 canonical 판단, 저장, 재열람, 회전, 소유권 및 cleanup 계약은 직접 검증에서 통과했다. 다만 immutable Preview에서 시작한 Google OAuth가 Production callback으로 돌아가는 외부 Auth redirect 불일치와, 후속 UI 재실행 시 `/api/analyze`가 HTTP 429 `analysis_rate_limited`를 반환한 상태 때문에 Stage 10 전체 PASS는 선언하지 않는다.

```text
CI_NOT_USED
GITHUB_ACTIONS_NOT_USED
PRODUCTION_NOT_CHANGED
CLEANUP_RESIDUE_ZERO_NOT_CONFIRMED
PR_REMAINS_DRAFT
```

이번 실행에서 생성한 `saved_reports` 4개는 모두 삭제됐고 duplicate source tuple은 0이다. 그러나 기존 영구 테스트 계정의 `auth.users`와 `profiles`는 생성·삭제 대상이 아니며, `premium_report_sessions` 전체 residue를 broad/service-role 접근 없이 직접 세지 못했다. 따라서 요구된 전체 `CLEANUP_RESIDUE_ZERO`는 확인되지 않은 것으로 기록한다.

## 실행 기준

- Validation commit: `d257074e102fbc25632ccb290b194efd26906db9`
- Branch: `codex/stage10-hosted-preview-user-flow`
- Draft PR: `#97`
- PR base: `codex/premium-hosted-preview-current-main-integration`
- Environment: `Preview`
- Vercel deployment: `dpl_3U6Pzp2jmeeSvZ46Y6CgkTZYfwG3`
- Immutable host: `k-beauty-8kryw6buk-johnny-self.vercel.app`
- Deployment state: `READY`
- GitHub deployment: `5684981746`
- Production promotion/alias/configuration change: 없음

GitHub PR head, GitHub deployment SHA, Vercel source SHA 및 로컬 validation commit이 모두 위 SHA와 일치했다. `/`, `/en`, `/my`, `/en/my`는 직접 HTTP 200을 반환했다.

## 로컬 검증

| 검증 | 결과 |
| --- | --- |
| `npm ci` | PASS |
| `npm run build` | PASS |
| `npm run architecture:guard` | PASS |
| `node scripts/verify-premium-route-storage-reentry.mjs` | PASS |
| `node scripts/verify-premium-report-reentry-contract.mjs` | PASS |
| `node scripts/verify-premium-integrated-evaluation.mjs` | PASS |
| `npm run verify:premium-hosted-preview-harness-hardening` | PASS |
| Premium decision state/current-product findings | PASS |
| Functional/routine/condition single-source verifiers | PASS |
| Cross-domain consistency verifier | PASS |
| Premium session payload boundary | PASS |
| SEC-11 sign-out boundary | PASS, 40/40 |
| `git diff --check` | PASS |

Integrated Evaluation Pack은 논리 fixture 16개, 실행 variant 17개, locale comparison 1개와 assertion 141개를 모두 통과했다. 기능성·루틴·컨디션 정책은 공통 canonical 상태를 사용하며, cross-domain negative fixture와 unknown/중복/장벽 우선/신규 활성 제한 계약이 통과했다.

첫 `npm ci`와 `npm run build` 호출은 실행 도구의 짧은 timeout으로 종료됐고, `npm ci` 재시도 중 Windows 파일 잠금 `EPERM`이 한 번 발생했다. 관련 프로세스 종료 후 동일 명령을 다시 실행해 정상 통과했다. 제품 코드 실패로 분류하지 않는다.

## 실제 Preview 브라우저·API 검증

성공 run: `premium-e2e-20260731013658-35182d8a`

- Browser/API steps: 29/29 PASS
- HTTP 계약 단계: 27
- 한국어 전체 여정: PASS
- 영어 전체 여정: PASS
- 익명 Premium 경계: HTTP 401
- 첫 저장: HTTP 200
- cookie 우선 인증: HTTP 200
- 동일 요청 retry: HTTP 200 / existing
- 저장 결과 재열람: HTTP 200, 재분석 없음
- finalized 의미 변경: HTTP 409
- principal conflict: HTTP 401
- cross-account saved report 접근: HTTP 401
- session rotation: HTTP 200
- 두 번째 독립 저장: HTTP 200
- source tuple duplicate: 0
- A/B 영구 Google 계정 분리: PASS

저장 fingerprint:

```text
KO first/second canonical fingerprint:
fe8d3fa4f4e47d21882b59e851aa412e68e2c698710fe2bdd51937a5f90afd91

EN first/second canonical fingerprint:
e56d4fcda490e7b10a07c52c4842309f54f91a3ea729cb73df0d34fc8400b1c8
```

각 locale에서 rotation 전후 독립 session/report가 생성됐고, 동일 입력 fingerprint는 유지됐다. 저장 재열람은 저장 snapshot을 사용했으며 finalized snapshot 변경 요청은 차단됐다.

## 인증 및 sign-out

- 비로그인 Premium 저장 접근: PASS, 401
- cookie와 bearer가 같은 principal: PASS
- cookie/bearer principal conflict: PASS, 401
- cross-account read: PASS, 401
- sign-out 요청 정책과 Premium cookie expiry 계약: PASS, 40/40
- 실제 Preview 헤더: 로그인 상태에서 `로그아웃` 및 `My`, sign-out 후 `Google로 로그인`

운영자 스크린샷의 로그인 CTA는 단순 UI 문제가 아니었다. 해당 시각의 안전하게 축약한 브라우저 기록에서 immutable Preview OAuth가 Production callback으로 돌아갔다. 현재 Production SHA는 cookie 기반 UI와 localStorage 기반 익명 클라이언트가 분리돼 익명 signup을 먼저 만들지만, #96/#97 Preview는 cookie 기반 클라이언트로 통합돼 같은 영구 세션에서 익명 signup 없이 `/auth/v1/user` 200과 로그인 헤더를 표시했다.

## DB 및 cleanup

- 이번 run에서 생성된 `saved_reports`: 4
- 삭제된 `saved_reports`: 4
- duplicate `(owner, report_type, source_type, source_session_id)`: 0
- saved report residue: 0
- cleanup 완료: PASS
- Premium session residue: BLOCKED_EXTERNAL_CONFIGURATION, 안전한 owner-scoped count 경로 없음
- 기존 영구 테스트 `auth.users`/`profiles`: NOT_APPLICABLE, 생성 또는 삭제하지 않음
- broad owner/date/service-role cleanup: 수행하지 않음

원시 UUID, 이메일, cookie, JWT, token, anon/service-role key, 사진 및 report payload는 이 문서에 기록하지 않았다.

## 단계별 결과

| 단계 | 결과 | 근거 |
| --- | --- | --- |
| Canonical current-product/functional/routine/condition | PASS | 16 logical fixtures, 141/141 assertions |
| Cross-domain consistency | PASS | 실행 verifier 및 negative fixtures |
| Route/storage/reentry | PASS | focused verifier 및 exact Preview run |
| KO/EN 저장·재열람·회전 | PASS | 29/29 browser/API steps |
| Cross-account/principal conflict | PASS | 401 |
| Finalized snapshot conflict | PASS | 409 |
| Saved-row cleanup | PASS | 4 created / 4 deleted / residue 0 |
| Sign-out UI/route contract | PASS | actual header transition + SEC-11 40/40 |
| Immutable Preview OAuth callback | BLOCKED_EXTERNAL_CONFIGURATION | Supabase callback이 Production host로 fallback |
| 후속 전체 UI 재실행 | BLOCKED_EXTERNAL_CONFIGURATION | analyze HTTP 429 rate limit |
| Fault Preview lane | NOT_APPLICABLE | 별도 안전한 non-Production fault deployment가 제공되지 않음 |

## 남은 blocker

1. Supabase Auth redirect allowlist가 immutable Preview callback을 수용하지 않는다. Production OAuth 설정은 이번 작업에서 변경하지 않았다. 로컬 검증은 저장소 밖의 임시 storage-state bridge로만 수행했다.
2. 성공 run 이후 추가 브라우저 탐색이 analyze quota를 소비해 후속 authoritative rerun이 `ko:analyze` HTTP 429에서 중단됐다. 이 실패 run은 report를 생성하지 않아 cleanup 대상이 없었다.
3. 위 두 blocker가 해소된 뒤 동일 exact-SHA 계열에서 전체 UI fixture를 다시 실행해야 Stage 10 PASS로 승격할 수 있다.

CandidatePolicy runtime은 활성화하지 않았고, Production 배포·promote·alias·환경변수·OAuth 설정·DB schema/RLS를 변경하지 않았다. PR #97은 Draft이며 merge하지 않았다.

---

## Stage 10B blocker closure (2026-07-31)

### Final verdict

`STAGE_10_HOSTED_PREVIEW_USER_FLOW_PASS`

```text
CI_NOT_USED
GITHUB_ACTIONS_NOT_USED
PRODUCTION_NOT_PROMOTED
RUN_SCOPED_CLEANUP_RESIDUE_ZERO
PR_REMAINS_DRAFT
```

This section supersedes the earlier blocked verdict while retaining the original
blocked evidence above.

### Blocker resolution

- Previous blocked validation commit: `d257074e102fbc25632ccb290b194efd26906db9`
- Final validation commit: `67521b3def0ce617dd5cde4d806eac9f328b40d8`
- Supabase Auth Site URL remained `https://k-beauty-two.vercel.app`.
- The Auth redirect allowlist contained three existing entries and did not contain
  a K Beauty Preview redirect. The single project-scoped pattern
  `https://k-beauty-*-johnny-self.vercel.app/**` was appended; existing entries
  were not removed or replaced.
- The Google provider callback configuration was not changed.
- The OAuth caller now resolves Production, project-scoped Vercel Preview, and
  localhost return origins explicitly. Untrusted hosts fall back to the canonical
  Production origin, and unsafe callback paths are rejected.
- Account A and Account B both completed a new Google OAuth round trip directly on
  the exact Preview host. Both captured sessions were permanent Google sessions
  whose safe source classification was `target_host`; the canonical-cookie bridge
  was not used.
- The previous HTTP 429 was an hourly limiter result after repeated verification.
  The authoritative KO/EN rerun issued exactly two analyze requests and received no
  unexpected 429. No limiter threshold, reset state, or bypass was changed.

### Exact Preview

- Vercel deployment ID: `dpl_HfxF3QksAn67iScd5598RtcVE3b1`
- Immutable host: `k-beauty-dnvdj1fe3-johnny-self.vercel.app`
- State: `READY`
- Target: Preview (`null`), not Production
- Source SHA: `67521b3def0ce617dd5cde4d806eac9f328b40d8`
- Branch alias: `k-beauty-git-codex-stage10-hosted-preview-user-flow-johnny-self.vercel.app`
- Branch alias and immutable deployment resolved to the same deployment.
- Basic Preview HTTP check: 200.

Production remained deployment `dpl_14cM1sGrm15CmgW6GQYq8swFx7oZ` at SHA
`a30970b78ff2fb3f5784d947b746223a66954e44`; no promotion or Production alias
change was performed.

### Authoritative KO/EN rerun

- Run: `premium-e2e-20260731030813-27924c25`
- Verdict: `HOSTED_PREVIEW_PASS`
- Browser/API steps: 29/29 PASS
- Analyze request count: 2 (one KO and one EN)
- Anonymous Premium boundary: 401
- First save: 200
- Identical retry: 200 / existing
- Saved report reopen without reanalysis: 200
- Finalized snapshot change: 409
- Principal conflict: 401
- Cross-account read: 401
- Session rotation: 200
- Second independent save: 200
- Duplicate source tuple count: 0
- KO first/second fingerprint:
  `fe8d3fa4f4e47d21882b59e851aa412e68e2c698710fe2bdd51937a5f90afd91`
- EN first/second fingerprint:
  `c93cf40338b1237089cf00eafaf72df46886d256fe288332f8f6ce7011cb3095`
- Actual Preview sign-out POST returned 303 and the header transitioned to the
  signed-out state. The route-level SEC-11 contract continues to verify Supabase
  logout plus path-scoped Premium cookie expiry.

### Run-scoped cleanup

- Known Premium session IDs created: 4
- Known Premium session IDs deleted by exact ID: 4
- Known Premium session exact-ID residue: 0
- Saved reports created: 4
- Saved reports deleted by exact ID: 4
- Saved report exact-ID residue: 0
- Auth users/profile cleanup: `NOT_APPLICABLE` because the two permanent test
  accounts were reused.
- The raw run-scoped cleanup file was kept only in the ignored runtime directory
  and removed after successful cleanup. No raw session ID, token, cookie, email, or
  secret is recorded in this document.

### Direct local verification

All checks were executed locally; GitHub Actions was not used.

- `npm ci`: PASS
- `npm run build`: PASS
- `npm run architecture:guard`: PASS
- `node scripts/verify-premium-route-storage-reentry.mjs`: PASS
- `node scripts/verify-premium-report-reentry-contract.mjs`: PASS
- `node scripts/verify-premium-integrated-evaluation.mjs`: PASS
- `npm run verify:premium-hosted-preview-harness-hardening`: PASS
- `npm run verify:preview-oauth-origin`: PASS, 13 assertions
- `npm run verify:premium-run-scoped-cleanup`: PASS, 15 assertions
- `node scripts/verify-premium-browser-journey-contract.mjs`: PASS
- `node scripts/check-premium-browser-journey-local.mjs`: PASS
- `node scripts/run-security-closeout-verifier-suite.mjs`: PASS, 57/57
- `git diff --check`: PASS

The dependency installation continued to report four existing high-severity audit
findings. No dependency or package policy was changed in this bounded blocker
closure.
