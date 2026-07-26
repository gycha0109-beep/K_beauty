# Unified Vision Post-Replay Revalidation — 2026-07-19

## 1. 범위

- Repository: `gycha0109-beep/K_beauty`
- PR: `#50`
- Branch: `design/unified-vision-observation-pipeline`
- Base: `codex/survey-input-contract-refactor`
- Production 배포: 미실행
- hosted Supabase 접근·변경: 없음
- 이번 재정렬 중 image-bearing Provider call: 0

이번 작업은 PR #66 Local Supabase Replay Baseline 병합 이후 PR #50을 최신 base에 정렬하고, 정적 회귀와 격리 DB Gate를 다시 검증한 기록이다.

## 2. PR #66 병합

- PR #66 final head: `68d554e64149cbfbc835e216285a08f14a06ba42`
- Merge commit: `c6939321f1bf921e7f6a2dad1acb02536e57d1b9`
- 결과: merged

PR #66은 historical-authoritative DDL 복구가 아니라 local replay-equivalent contract다. 정확한 pre-20260410 historical DDL provenance는 미확정 상태를 유지한다.

## 3. PR #50 base 정렬

PR #50의 기존 head를 최신 base에 실제 merge commit으로 정렬했다.

보완 내용:

1. Unified Vision script와 DB replay script가 `package.json`에 함께 유지되도록 충돌을 병합했다.
2. PR 전체 diff에 남아 있던 Markdown trailing whitespace를 제거했다.
3. `unified-vision-provider-smoke-final-20260719.md`의 추가 EOF blank line을 제거했다.
4. path-scoped `Unified Vision Static Guard`를 추가했다.
5. 임시 sync·diagnostic·whitespace workflow와 diagnostic file은 최종 branch에서 모두 제거했다.

Production migration, Vision runtime contract, image attempt budget, automatic retry 정책은 변경하지 않았다.

## 4. Unified Vision Static Gate

검증 항목:

```text
npm ci
npm run verify:unified-vision-pipeline
npm run face-lab:eval:verify
node scripts/verify-analysis-request-guard.mjs
node scripts/verify-provider-runtime-log-sanitization.mjs
node scripts/verify-anonymous-write-grant-v2.mjs
node scripts/verify-analysis-rls-contract.mjs
npm run architecture:guard
npm run build
git diff --check
```

결과:

```text
PASS
```

검증된 경계:

- onboarding `/api/analyze` 단일 요청
- image-bearing Provider request site 단일화
- 자동 image retry 없음
- Face Lab partial evidence fail-closed
- anonymous persistence fingerprint 밖에 Face Lab envelope 유지
- Provider credential·payload 로그 차단
- analysis guard, anonymous grant, RLS 계약 유지
- production build 및 diff integrity

## 5. Local Supabase DB Gate

검증 항목:

```text
replay verifier
isolated workspace preparation
Local Supabase start
clean migration reset 1
clean migration reset 2
DB lint
anonymous synthetic product exact read = 5
anonymous INSERT denied
anonymous UPDATE denied
anonymous DELETE denied
mandatory successful-path cleanup
```

결과:

```text
PASS
```

기존 `BLOCKED_BY_SCHEMA_UNCERTAINTY`의 실행 차단은 replay-equivalent local contract를 통해 해소됐다. 이는 exact historical schema 복구를 의미하지 않는다.

## 6. 안전 경계

```text
Production migration 변경: 0
hosted Supabase 접근·mutation: 0
remote schema 변경: 0
hosted 제품·사용자 row 복사: 0
Production 배포: 0
이번 재검증 Provider image call: 0
누적 image-bearing Provider attempts: 1
누적 automatic retries: 0
```

## 7. Runtime Provider Smoke

Post-replay Lane B와 Lane A는 아직 실행하지 않았다.

확인된 로컬 실행 자산:

```text
Repository: D:\Ji_hwan\K_Beauti AI
Manifest: manifest.local.json
Lane A fixture: private/face-lab-fixtures/subject-a/frontal-clear.png
Lane B fixture: private/face-lab-fixtures/subject-a/lower-face-occluded.png
```

이 자산과 검증된 non-production `.env.local` credential은 사용자 로컬 PC 경계에 있으며 GitHub connector 실행 환경에는 노출되지 않는다. 따라서 임의의 대체 이미지, hosted DB, Production endpoint 또는 secret 복사를 사용하지 않았다.

현재 판정:

```text
Static Gate: PASS
DB Gate: PASS
Lane B: NOT RUN
Lane A: NOT RUN
Final runtime verdict: PENDING_LOCAL_PROVIDER_SMOKE
```

## 8. 다음 실행 순서

```text
사용자 로컬 PC의 최신 PR #50 worktree 확인
→ Lane B canonical Vision Provider smoke 1회
→ 성공 시 Lane A /api/analyze E2E smoke 1회
→ image attempt·retry·token·latency·KO/EN projection·cross-contamination 기록
→ PR #50 최종 독립 리뷰
```

Lane B 또는 Lane A 실패 시 자동 재시도하지 않는다. 새로운 image-bearing attempt는 별도 기록과 명시적 실행으로만 추가한다.

## 9. PR 상태

- Open
- Draft
- 미병합
- Ready 전환 금지
- Lane B와 Lane A 및 최종 리뷰 전 merge 금지
