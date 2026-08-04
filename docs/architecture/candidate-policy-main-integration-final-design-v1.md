# CandidatePolicy Main Integration Final Design v1

## 0. 문서 상태

```text
status: FINAL_DESIGN_COMPLETE
next_action: IMPLEMENT_IN_ONE_CURATED_PR
additional_design_stage_required: false
implementation_branch: codex/candidate-policy-main-integration
integration_base: main
integration_method: curated_tree_transplant
merge_method: squash
```

이 문서는 CandidatePolicy / CandidateExposurePolicy 장기 stacked branch를 현재 `main`에 통합하기 위한 최종 설계다.

이후에는 별도 설계 PR, 별도 cleanup 설계, 별도 dependency 설계를 만들지 않는다. 구현 중 발견되는 충돌·누락·검증 결함은 모두 하나의 통합 구현 PR 안에서 수정하고 재검증한다.

---

## 1. 문제 정의

CandidatePolicy 작업은 단일 feature branch가 아니라 다음과 같이 장기간 누적된 stacked chain이다.

```text
verifier baseline recovery
→ runtime safety hardening
→ current-product snapshot transport
→ canonical goal alignment
→ current-product findings integration
→ SEC-06 verifier recovery
→ actual catalog verification
→ sunscreen metadata remediation / rebaseline
→ SharedSkinDecisionContext v4
→ Integrated Evaluation Pack v2
→ Hosted Preview foundation / Stage 10
→ CandidateExposurePolicy responsibility review
→ default-off shadow runtime
→ canary eligibility and planning
→ validate-only isolated harness
→ approval-gated Hosted runner
→ read-only Hosted adapter
→ temporary synthetic diagnostic route
→ mandatory route cleanup
→ dependency security remediation
```

마지막 durable source head는 다음이다.

```text
branch: codex/dependency-security-triage
sha: ce882aa2057a06d39d86f99a09f4264725b4161b
PR: #147
```

그러나 이 branch의 Git ancestry를 그대로 `main`에 병합하면 다음 문제가 발생한다.

1. 중간 설계·검증·임시 route commit까지 main history에 들어간다.
2. 현재 main에서 별도로 발전한 Admin, 모바일, Face, Security 변경과 오래된 branch blob이 충돌한다.
3. `package.json`, `package-lock.json`, security verifier manifest, `/api/analyze` 같은 공유 파일을 과거 상태로 되돌릴 수 있다.
4. 임시 synthetic diagnostic route가 최종 tree에서는 삭제됐더라도 intermediate merge 순서 중 잠시 main에 존재할 수 있다.
5. PR을 순서대로 수십 번 merge하면 각 단계마다 재설계·재검증·cleanup이 반복된다.

따라서 **stacked PR 순차 병합은 금지**한다.

---

## 2. 최종 결정

### 2.1 단일 current-main curated integration

통합은 현재 `main` exact head에서 새 branch를 만들고, final source head의 durable 결과만 path 단위로 이식한다.

```text
current main exact tree
+ final source durable delta
+ dependency remediation
- temporary / superseded assets
= one curated integration PR
```

허용 방식:

- exact source blob copy
- 현재 main과 source의 의미 병합
- 현재 main 기준 lockfile 재생성
- 현재 main verifier manifest와 CandidatePolicy verifier의 union

금지 방식:

- stacked branch 전체 merge
- source branch cherry-pick 연쇄
- `git merge -s ours`로 ancestry만 편입
- shared file에 대한 무조건적 ours/theirs 선택
- temporary route를 main에 넣은 뒤 다시 삭제하는 순차 merge
- source `package-lock.json` wholesale copy

### 2.2 단일 구현 PR

```text
branch: codex/candidate-policy-main-integration
base: exact current main
PR base: main
PR count: exactly 1
merge: squash
```

구현 중 수정 commit 수는 제한하지 않지만 최종 PR은 하나만 유지한다. 최종 merge는 expected head SHA를 고정한 squash merge로 수행한다.

### 2.3 설계 종료 선언

이 문서가 승인되면 구현자는 추가 설계 산출물을 만들지 않는다.

다음은 새 설계 단계가 아니라 동일 구현 PR 내 작업이다.

- overlap 해결
- verifier false positive 수정
- lockfile 재생성
- Preview build 오류 수정
- integration manifest 갱신
- 결과 문서 갱신

---

## 3. 정확한 권위 모델

### 3.1 Current Main Authority

현재 `main`은 다음 영역의 최종 권위다.

- 현재 Admin 기능과 migration
- 현재 모바일 SurveyFlow / 카메라 / MediaPipe
- 현재 Auth, Security, RLS, Storage, Payment
- 현재 API route의 CandidatePolicy 외 동작
- 현재 package scripts와 workspace 목록
- 현재 CI workflow trigger, concurrency, permissions
- 현재 UI 및 locale behavior
- CandidatePolicy와 무관한 모든 파일

통합 branch 생성 시 `main` head SHA를 고정하고 manifest에 기록한다. 구현 도중 main이 이동하면 새 설계를 만들지 않고 같은 integration branch를 최신 main으로 재기반화한 후 전체 검증을 다시 실행한다.

### 3.2 Final Source Authority

다음 source가 CandidatePolicy durable 결과의 권위다.

```text
branch: codex/dependency-security-triage
sha: ce882aa2057a06d39d86f99a09f4264725b4161b
```

이 source는 다음을 포함한다.

- final CandidatePolicy runtime/safety/current-findings state
- SharedSkinDecisionContext v4 연계
- default-off CandidateExposurePolicy shadow runtime
- deterministic verification assets
- route cleanup 및 durable absence verifier
- dependency audit remediation

### 3.3 Cleanup Authority

임시 route 제거 상태의 권위는 다음이다.

```text
branch: codex/candidate-exposure-policy-synthetic-diagnostic-route-cleanup
sha: 87e3c6b8028b50b84a8bff7f2fc43087b2b78a20
PR: #143
```

### 3.4 Historical-only Authority

다음 source는 구현 결과를 복사하기 위한 권위가 아니라 과거 검증 근거다.

```text
Temporary route implementation: 51b186d21a0a6ece911fc2016985945c34ac7ee8
Temporary route cleanup design: 9b0ab2ac01d8df840f13fd89a0a1283182b97d3b
```

이 history는 final integration tree에 temporary route를 재도입할 권한을 주지 않는다.

---

## 4. 최종 통합 범위

### 4.1 포함: Production-adjacent durable contracts

다음 기능은 final source 의미를 보존한다.

1. CandidatePolicy verifier prerequisite materialization
2. immutable runtime safety context
3. sunscreen protection metadata fail-closed handling
4. stabilization active-axis block
5. current-product snapshot protection metadata transport
6. canonical effective goal authority
7. canonical current-product findings context
8. SharedSkinDecisionContext v4 compatibility
9. CandidateExposurePolicy exposure/lane contract
10. post-canonical default-off shadow runtime
11. aggregate-only observability
12. response/snapshot/candidate-order invariance
13. Production hard-disable and kill-switch boundaries

### 4.2 포함: Durable verification assets

- CandidatePolicy focused verifiers
- CandidateExposurePolicy shadow verifier
- actual-coverage and deterministic fixture materializers
- Integrated Evaluation Pack v2 compatibility checks
- security closeout manifest entries
- temporary diagnostic route absence verifier
- architecture guard compatibility
- dependency audit evidence document

### 4.3 포함: Dependency remediation

최소 승인 버전:

```text
next: 15.5.22
sharp: 0.35.3
postcss: 8.5.25
picomatch: 2.3.2 and 4.0.5
nanoid lock resolution: 3.3.17 or newer compatible fixed resolution
```

Next 내부 optional/transitive tree가 취약 버전으로 되돌아가지 않도록 다음 semantic override를 보존한다.

```json
{
  "next": {
    "postcss": "8.5.25",
    "sharp": "0.35.3"
  }
}
```

단, current main이 더 높은 비취약 호환 버전을 이미 사용한다면 downgrade하지 않는다.

### 4.4 포함: Final integration evidence

구현 PR은 다음 permanent 파일을 추가한다.

```text
docs/architecture/candidate-policy-main-integration-manifest-v1.json
scripts/verify-candidate-policy-main-integration.mjs
docs/verification/candidate-policy-main-integration-result.md
```

현재 design manifest는 구현 시 exact path/blob manifest로 갱신한다.

---

## 5. 명시적 제외 범위

### 5.1 Temporary route surface — 반드시 없음

다음 파일은 final integration tree에 존재하면 즉시 FAIL이다.

```text
app/api/internal/candidate-exposure-policy-diagnostic/route.js
lib/candidate-exposure-policy-hosted-diagnostic-auth.js
lib/candidate-exposure-policy-hosted-diagnostic-contract.js
lib/candidate-exposure-policy-hosted-diagnostic-execution.js
scripts/check-candidate-exposure-policy-hosted-diagnostic-route.mjs
```

다음 route string도 production/runtime code에서 금지한다.

```text
/api/internal/candidate-exposure-policy-diagnostic
```

과거 문서에서의 역사적 언급만 허용한다.

### 5.2 Temporary validation assets

다음은 통합 대상이 아니다.

- one-shot GitHub Actions workflow
- validation-trigger branch file
- temporary `postbuild` hook
- `tmp/**` evidence
- `_local_data/**`
- local Auth/session/cookie evidence
- Vercel bypass material
- access token, secret, deployment mutation capability
- generated Preview-only probe route
- validation branch ancestry

### 5.3 Runtime activation

다음은 이번 통합에서 금지한다.

- CandidateExposurePolicy runtime filtering 연결
- recommendation 후보 제거/재정렬
- public Preview traffic
- percentage rollout
- Production canary
- Production environment mutation
- Vercel promote/alias mutation
- Hosted diagnostic execution
- Provider 호출

### 5.4 Data / schema

- migration 추가 또는 변경
- Production catalog write
- Supabase hosted write
- backfill
- RLS 변경
- Storage policy 변경
- Auth/OAuth 설정 변경

과거 #85에서 실행된 sunscreen metadata remediation은 현재 데이터 상태의 historical prerequisite다. 이번 integration은 그 SQL을 재실행하지 않는다.

---

## 6. Path disposition model

모든 cumulative source path는 구현 시 아래 세 가지 중 정확히 하나로 분류한다.

```text
include_exact
merge_semantic
exclude
```

분류되지 않은 path가 하나라도 있으면 integration verifier가 실패한다.

### 6.1 include_exact

조건:

- CandidatePolicy 전용 신규 파일
- current main에 동일 path가 없음
- temporary/superseded가 아님
- final source blob이 durable 최종 상태임

처리:

- final source exact blob을 복사
- blob SHA를 manifest에 기록
- integration head의 blob SHA가 source와 같은지 검증

예상 prefix:

```text
lib/candidate-policy-*
lib/candidate-exposure-policy-*
scripts/verify-candidate-*
docs/architecture/candidate-*
docs/reviews/candidate-*
docs/verification/candidate-*
```

prefix만으로 자동 승인하지 않는다. exact path manifest를 생성하고 검토한다.

### 6.2 merge_semantic

공유 파일은 현재 main을 기준으로 필요한 CandidatePolicy delta만 적용한다.

| Path / 영역 | 권위와 처리 |
|---|---|
| `app/api/analyze/route.js` | current main이 전체 route 권위. final source의 post-canonical shadow insertion과 aggregate observability만 의미 병합. request parsing, Provider, persistence, response, security contract는 main 유지. |
| Premium decision orchestrator / shared context caller | current main 기능 보존 + v4 context 및 CandidatePolicy context projection만 병합. |
| product snapshot mapper | current main identity/category/snapshot behavior 보존 + protection metadata projection만 병합. |
| `package.json` | current main scripts/workspaces/dependencies 보존 + CandidatePolicy scripts + 승인 dependency versions/overrides union. |
| `package-lock.json` | 복사 금지. merged `package.json`에서 deterministic 재생성. |
| `scripts/run-security-closeout-verifier-suite.mjs` | main verifier 목록과 CandidatePolicy durable verifier의 de-duplicated union. 현재 main count를 낮추지 않음. |
| architecture docs index | current main index 보존 + final integration entry 추가. |
| `.gitignore` | current main 규칙 보존 + 필요한 local evidence exclusion만 union. |
| CI workflows | current main이 권위. temporary workflow 복사 금지. 필요한 기존 workflow가 새 verifier를 자동 발견하도록 최소 변경만 허용. |

### 6.3 exclude

- Section 5의 모든 경로
- intermediate implementation-only route modules
- duplicate/superseded review documents 중 final source가 명시적으로 supersede한 파일
- branch-specific validation runner
- temporary deployment metadata
- current main에서 삭제된 오래된 파일을 source ancestry만을 이유로 복원하는 경우

---

## 7. Overlap fail-closed 규칙

구현자는 common merge base를 기준으로 다음 집합을 계산한다.

```text
MAIN_CHANGED = merge-base..current-main
SOURCE_CHANGED = merge-base..final-source
OVERLAP = MAIN_CHANGED ∩ SOURCE_CHANGED
```

각 `OVERLAP` path는 Section 6.2 table 또는 manifest의 explicit semantic merge entry에 있어야 한다.

금지:

- unknown overlap 자동 해결
- 전체 directory ours/theirs
- current main 파일을 source로 wholesale 교체
- source file을 current main로 wholesale 버리고 기능 누락을 허용

각 overlap entry는 manifest에 기록한다.

```json
{
  "path": "...",
  "mainBlob": "...",
  "sourceBlob": "...",
  "resultBlob": "...",
  "resolution": "semantic_merge",
  "preservedMainContracts": [],
  "importedSourceContracts": []
}
```

---

## 8. 구현 순서 — 추가 설계 없이 한 번에 수행

### Commit 1 — Freeze and manifest

1. exact current main SHA 고정
2. exact final source SHA 고정
3. merge base 계산
4. cumulative changed-path inventory 생성
5. 모든 path를 `include_exact / merge_semantic / exclude`로 분류
6. unknown path 0 확인
7. explicit temporary-route absence precheck

### Commit 2 — Durable runtime and contract transplant

1. CandidatePolicy 전용 exact blobs 반입
2. shared runtime paths semantic merge
3. `/api/analyze` main behavior 보존
4. runtime/shadow context parity 보존
5. default-off / Production hard-disable 보존
6. UI, persistence, response schema 변경 0 확인

### Commit 3 — Verification and evidence transplant

1. deterministic materializers 반입
2. focused verifier 반입
3. security-closeout manifest union
4. route-absence verifier 반입
5. final integration verifier 구현
6. final architecture/review/evidence docs 정리

### Commit 4 — Dependency remediation

1. merged package.json에 승인 버전 적용
2. current main workspace/scripts 보존
3. Node 20.20.x / npm 10.8.2 기준 lockfile 재생성
4. `npm audit fix --package-lock-only`는 package major 변경 없이만 허용
5. resolved tree 확인
6. audit 0 확인

### Commit 5 — Final result only

1. exact integration head 검증
2. result document에 run/deployment/artifact 기록
3. temporary validation workflow 제거
4. final diff 재검증
5. PR 본문 final status 갱신

Commit 수는 구현 과정에서 달라질 수 있으나 PR은 하나만 존재하며, 최종 squash merge로 main에 하나의 revertable commit을 남긴다.

---

## 9. 최종 runtime invariants

### 9.1 CandidateExposurePolicy state

```text
contract_present: true
shadow_runtime_present: true
default_enabled: false
production_hard_disabled: true
runtime_filter_connected: false
recommendation_output_changed: false
candidate_order_changed: false
response_schema_changed: false
storage_schema_changed: false
```

### 9.2 Safety authority

우선순위:

```text
canonical safety context
> stabilization protection
> canonical effective goal
> current-product relation
> exposure lane derivation
```

Current-product findings는 safety 또는 canonical goal을 override하지 않는다.

### 9.3 Fail-closed cases

- missing/invalid context
- wrong context version
- invalid provenance
- duplicate candidate identity
- inconsistent aggregate
- missing sunscreen protection component
- malformed environment classification
- Production shadow activation attempt

### 9.4 Observability privacy

허용:

- aggregate counts
- bounded reason vocabulary
- execution state
- divergence counts
- fingerprint equality boolean

금지:

- product ID
- product name/brand
- URL
- raw survey text
- raw user input
- candidate reference
- cookie/session/token
- Provider response

---

## 10. Dependency merge contract

### 10.1 package.json

Current main의 다음 항목을 삭제하면 실패한다.

- 기존 scripts
- workspaces
- Admin / Face / mobile / security verifier scripts
- current dependencies not owned by CandidatePolicy

CandidatePolicy source에서 다음만 union한다.

- durable verifier scripts
- required package metadata
- fixed dependency versions and overrides

### 10.2 package-lock.json

최종 lockfile은 current main + merged package.json의 결과다.

검증:

```text
npm ci: PASS
npm audit --json total: 0
npm ls next: one compatible 15.5.22+ resolution
npm ls sharp: no vulnerable 0.34.x resolution
npm ls postcss: no vulnerable resolution
npm ls picomatch: only fixed 2.3.2 / 4.0.5 or newer compatible resolution
```

`npm audit fix --force`는 금지한다.

---

## 11. Integration verifier contract

`scripts/verify-candidate-policy-main-integration.mjs`는 최소 다음을 검증한다.

### 11.1 Identity

- manifest version exact
- current-main base SHA exact
- final source SHA exact
- implementation head exact
- no uncommitted tracked mutation

### 11.2 Path completeness

- source cumulative paths exact set
- every path disposition exactly one
- include/merge/exclude duplicate 0
- unknown path 0
- result changed path가 final allowlist 밖이면 FAIL

### 11.3 Blob parity

- `include_exact` result blob == source blob
- `main_preserved` result blob == main blob
- semantic merge blob은 expected digest와 일치
- excluded path absent

### 11.4 Temporary surface absence

- five temporary files absent
- route string non-doc occurrence 0
- diagnostic HMAC header names non-doc occurrence 0
- deleted diagnostic symbol/import occurrence 0
- build app-path manifest에 deleted route 0

### 11.5 Runtime boundaries

- default flag false
- Production hard disable true
- runtime filter consumer 0
- recommendation output mutator 0
- DB writer 0
- public route 0
- current `/api/analyze` request/response contract unchanged except approved internal shadow hook

### 11.6 Dependency boundaries

- required fixed versions
- nested override resolved
- audit total 0
- lockfile/package sync

### 11.7 Historical evidence

- final cleanup result retained
- dependency remediation result retained
- temporary route result is historical-only and explicitly superseded
- final integration result is authoritative current-state document

---

## 12. 필수 검증 매트릭스

### 12.1 Install / dependency

```text
npm ci
npm audit --json
npm ls next sharp postcss picomatch --all
```

PASS 조건:

- install success
- vulnerability total 0
- invalid/extraneous dependency 0

### 12.2 CandidatePolicy focused

최종 repository에 존재하는 모든 CandidatePolicy focused verifier를 실행한다.

필수 의미:

- baseline materialization standalone
- runtime safety
- snapshot transport
- goal alignment
- current findings
- actual-coverage fixture
- CandidateExposurePolicy shadow
- temporary route absence
- integration verifier

### 12.3 Security closeout

```text
preparation: all PASS
verifier manifest: expected == executed == passed
failed: 0
```

기존 61이라는 숫자를 무조건 고정하지 않는다. 현재 main이 verifier를 추가했다면 그 수를 보존하고 CandidatePolicy verifier를 union한다. 최종 expected count는 manifest에 기록한다.

### 12.4 Architecture / syntax

```text
changed JS/MJS syntax: PASS
architecture guard: PASS
ghost-code audit: PASS
git diff --check: PASS
```

### 12.5 Production build

```text
npm run build: PASS
static generation: all PASS
deleted diagnostic route absent: PASS
```

### 12.6 Determinism / invariance

- runtime and shadow same context
- repeated fixture semantic hash same
- default-off shadow execution 0
- shadow-on isolated verifier response fingerprint unchanged
- snapshot fingerprint unchanged
- candidate order fingerprint unchanged
- unexpected divergence 0
- unclassified divergence 0
- exception/fallback 0

### 12.7 Vercel Preview

Exact integration head의 normal branch Preview만 사용한다.

PASS:

```text
state: READY
target: null
source SHA: exact integration head
branch alias only: true
Production alias: absent
```

금지:

- promote
- Production alias
- project-wide env mutation
- temporary diagnostic route request
- Provider-backed `/api/analyze` request

Preview는 build/route surface만 증명한다.

### 12.8 Current main regression

현재 main이 보유한 관련 workflow/verifier를 모두 실행한다.

최소:

- Admin static/runtime verifier where available
- Security suite
- mobile/MediaPipe static tests where current main CI requires them
- Synthetic Toolkit tests if current main already contains the toolkit
- production build

CandidatePolicy 통합을 이유로 main verifier를 삭제·skip·allow-failure 처리하지 않는다.

---

## 13. CI 실행 설계

### 13.1 Final-head workflow

통합 PR 최종 head를 exact SHA로 checkout한다.

- `fetch-depth: 0`
- verifier가 요구하는 canonical local refs를 명시적으로 복원
- source branch를 실행 대상으로 checkout하지 않음
- synthetic merge SHA가 아니라 PR branch exact SHA 사용

### 13.2 Temporary workflow lifecycle

검증용 one-shot workflow가 필요한 경우:

1. integration branch에 temporary workflow를 추가하지 않는다.
2. same-repository validation branch/workflow가 exact integration head를 checkout한다.
3. 결과 artifact를 업로드한다.
4. temporary PR은 미병합 종료한다.
5. final integration tree에는 workflow가 남지 않는다.

### 13.3 Evidence artifact

최소 포함:

```text
integration-manifest.json
changed-paths.txt
blob-parity.json
npm-audit.json
npm-ls.txt
security-closeout-verifier-suite.json
build-route-manifest.txt
preview-metadata.json
```

artifact digest를 result document와 PR 본문에 기록한다.

---

## 14. PR 및 merge 운영

### 14.1 Integration PR

```text
title: feat(candidate-policy): integrate final default-off policy stack
head: codex/candidate-policy-main-integration
base: main
draft: true until exact-head validation completes
```

### 14.2 Ready 조건

- exact current main base가 변하지 않았거나 latest main 재기반화 완료
- unresolved overlap 0
- unknown path 0
- temporary route surface 0
- audit 0
- focused verifiers all PASS
- security closeout all PASS
- build PASS
- exact Preview READY
- Production change 0

### 14.3 Merge

- expected head SHA 고정
- squash merge
- commit title에 CandidatePolicy final integration 명시
- merge 직전 main head 재확인
- main이 이동했으면 merge하지 않고 같은 PR을 update 후 전부 재실행

---

## 15. 기존 stacked PR 처리

기존 PR은 통합 전에 merge하지 않는다.

최종 integration이 main에 squash merge된 후 다음 순서로 처리한다.

1. 각 PR에 final integration PR/merge SHA를 참조하는 superseded comment 추가
2. open stacked PR을 미병합 close
3. historical verification PR은 보존
4. branch 삭제는 최소 30일 retention 또는 별도 repository 정책에 따라 수행

주요 supersede 대상:

```text
#78, #79, #80, #81, #82, #83, #84, #85, #88
#91, #92, #93, #96, #97, #98, #99, #100, #101, #102
#107, #112, #114, #115, #117, #119, #122, #141, #143, #147
```

PR마다 이미 main에 별도 반영된 내용이 있으면 close comment에 그 사실을 명시한다. PR을 닫는 행위가 데이터 rollback이나 deployment rollback을 의미하지 않는다.

---

## 16. Rollback

### 16.1 Code rollback

squash merge commit 하나를 revert한다.

```text
revert integration squash commit
→ full security/build validation
→ Preview READY
→ merge rollback PR
```

### 16.2 Runtime safety

CandidateExposurePolicy는 default-off이고 Production hard-disabled이므로 통합 직후 runtime output 변화가 없어야 한다.

의도치 않은 변화가 감지되면:

1. Production activation 없음 확인
2. integration commit revert
3. dependency 문제와 CandidatePolicy 문제를 분리 진단

### 16.3 Data rollback

이번 통합은 DB/schema/data write가 0이므로 데이터 rollback은 없다.

과거 sunscreen remediation은 별도 historical operation이며 이번 integration rollback 대상이 아니다.

---

## 17. Stop conditions

다음 중 하나라도 발생하면 merge를 중지한다. 새 설계 PR은 만들지 않고 같은 integration PR에서 수정한다.

- final source SHA 불일치
- current main base drift 미해결
- unknown overlap
- temporary route/symbol residue
- runtime enable/default change
- Production hard-disable 약화
- response/storage/candidate-order mutation
- npm audit finding > 0
- security verifier fail 또는 skip
- current main regression
- build failure
- Preview source SHA mismatch
- Preview Production target/alias
- secrets or raw evidence in repository

---

## 18. 구현 완료 보고 형식

최종 보고는 다음만 사용한다.

```text
완료
- final main base SHA
- final integration head SHA
- integration PR
- exact changed file count
- audit result
- verifier result
- build result
- Preview result

문제
- unresolved blocker only

다음 작업
- Ready/merge 또는 merge 후 stacked PR close
```

중간 단계명을 새 Stage로 추가하지 않는다.

---

## 19. Final acceptance contract

```text
ONE_CURATED_MAIN_INTEGRATION_PR
NO_STACKED_SEQUENTIAL_MERGES
NO_ADDITIONAL_DESIGN_STAGE
TEMPORARY_DIAGNOSTIC_ROUTE_ABSENT
CURRENT_MAIN_CONTRACTS_PRESERVED
CANDIDATE_POLICY_DURABLE_STATE_INCLUDED
DEPENDENCY_AUDIT_ZERO
RUNTIME_DEFAULT_OFF
PRODUCTION_HARD_DISABLED
RECOMMENDATION_OUTPUT_UNCHANGED
DATABASE_UNCHANGED
PRODUCTION_UNCHANGED
FULL_EXACT_HEAD_VALIDATION_REQUIRED
SQUASH_REVERT_BOUNDARY
```

최종 상태:

```text
READY_FOR_SINGLE_PR_IMPLEMENTATION
```
---

## Implementation disposition amendment

`scripts/verify-candidate-exposure-policy-diagnostic-route-absence.mjs` moved from exact-source to semantic integration because its source version hard-coded the pre-integration `app/api/analyze/route.js` blob. The final verifier retains every temporary-path and forbidden-token check and adds explicit checks for the approved current-main semantic route contract.

`61 exact + 7 semantic + 38 source-only absent + 302 main-preserved = 408`.
