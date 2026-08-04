# CandidatePolicy Main Integration Exhaustiveness Audit v1

## 0. 판정

```text
audit_status: DESIGN_CORRECTED_AND_EXHAUSTIVE
silent_path_omission_possible_under_current_contract: false
actual_merge_completeness_proven: pending implementation
next_action: IMPLEMENT_SINGLE_CURATED_INTEGRATION_PR
additional_design_stage_required: false
```

이 감사는 기존 최종 설계의 방향만 확인한 것이 아니라, exact current `main`과 exact durable source의 실제 Git tree를 비교해 누락 가능성을 다시 검증한 결과다.

기존 설계의 핵심 방향인 `current-main curated integration`은 유지한다. 다만 기존 문서가 prefix와 path class 중심이어서 “실제 diff의 모든 경로가 분류되었다”는 점을 기계적으로 증명하지 못하는 결함이 있었다. 이 감사에서 해당 결함을 수정했다.

---

## 1. Exact Git authority

```text
current main:
647051f7feff8e23dc7b563cb7b58ffcba7e6eaf

durable final source:
ce882aa2057a06d39d86f99a09f4264725b4161b

merge base:
a30970b78ff2fb3f5784d947b746223a66954e44

relation:
main ahead 521
source ahead 263
status diverged
tree-diff paths 127
```

두 branch는 단순한 stacked fast-forward 관계가 아니다. source tree를 wholesale copy하거나 source ancestry를 순차 merge하면 현재 main의 521개 후속 commit에서 발전한 Admin, 모바일, Face, Toolkit, Auth, Security 및 CI 상태를 되돌릴 수 있다.

---

## 2. 발견된 기존 설계 결함

기존 설계는 다음 원칙을 선언했다.

```text
모든 cumulative source path
→ include_exact / merge_semantic / exclude
→ exactly once
```

그러나 실제 127개 diff path를 전부 열거한 authority ledger가 없었다.

따라서 다음 위험을 문서만으로 차단하지 못했다.

1. prefix 밖의 CandidatePolicy 의존 파일 누락
2. source에 포함된 오래된 Premium/Auth delta의 실수 반입
3. 공유 파일이 semantic merge 목록에서 빠지는 문제
4. source-only verifier를 추가하면서 그 실행 대상 파일을 누락하는 문제
5. exclude한 source-only 파일을 include 파일이 import하는 숨은 dependency
6. current main에 존재하는 exclude 파일을 source blob으로 덮어쓰는 회귀

이 상태에서는 “방향은 안전하다”고 말할 수는 있어도 “빠짐없이 통합된다”고 증명할 수는 없었다.

---

## 3. 수정된 exhaustive path contract

다음 ledger를 추가했다.

```text
docs/architecture/candidate-policy-main-integration-path-ledger-v1.json
```

ledger는 exact tree diff 127개를 모두 한 번씩 분류한다.

```text
include_exact: 62
merge_semantic: 6
exclude: 59
total: 127
unknown: 0
duplicate: 0
```

authoritative verifier:

```text
scripts/verify-candidate-policy-main-integration-path-ledger.mjs
```

이 verifier는 full Git history에서 다음을 직접 재계산한다.

- exact merge base
- main/source ahead counts
- `git diff --name-only <main> <source>`
- actual diff path count 127
- ledger path set과 actual Git path set의 byte-exact equality
- disposition count `62 / 6 / 59`
- duplicate path zero
- include-exact source object existence
- CandidateExposurePolicy runtime path가 exclude로 분류되지 않았는지

ledger와 실제 Git diff가 한 경로라도 다르면 구현을 시작할 수 없다.

---

## 4. Disposition 의미

### 4.1 `include_exact` — 62 paths

CandidatePolicy / CandidateExposurePolicy 전용 durable runtime, contract, fixture, verifier, architecture/review/verification evidence다.

최종 integration tree의 각 blob은 exact source SHA의 해당 blob과 같아야 한다.

```text
final_blob(path) == source_blob(ce882aa..., path)
```

파일명 prefix는 설명용일 뿐 authority가 아니다. 실제 authority는 62개 exact path ledger다.

### 4.2 `merge_semantic` — 6 paths

정확히 다음 여섯 경로만 semantic merge 대상이다.

```text
app/api/analyze/route.js
lib/evaluator-boundary-policy-shadow.js
package.json
package-lock.json
scripts/run-security-closeout-verifier-suite.mjs
scripts/verify-evaluator-boundary-readiness-review.mjs
```

그 외 path를 semantic merge로 임의 승격할 수 없다.

#### `/api/analyze`

current main이 request parsing, Vision/Provider, security, Premium session, persistence, Face Lab 및 response contract를 소유한다.

source에서는 다음만 반입한다.

- CandidateExposurePolicy shadow import
- post-canonical default-off invocation
- aggregate-only observability

response mutation, candidate filtering, order change, diagnostic fixture injection은 금지한다.

#### evaluator boundary shadow

current main 동작을 유지하고 source의 `baselineExposureGroup` observability만 반입한다.

#### package files

current main은 이미 다음을 보유한다.

- npm workspaces
- Synthetic Toolkit T1–T11 scripts
- Next `15.5.22`
- Sharp `0.35.3`
- safe override strategy

따라서 source `package.json` 또는 lockfile wholesale copy는 금지한다. CandidatePolicy verifier scripts만 union하고 lockfile은 merged package state에서 재생성한다.

#### security closeout

current main manifest를 기준으로 다음 네 CandidatePolicy verifier만 추가한다.

```text
verify-candidate-exposure-policy-diagnostic-route-absence.mjs
verify-candidate-exposure-policy-shadow-evaluation.mjs
verify-candidate-exposure-policy-shadow-runtime.mjs
verify-candidate-policy-runtime-reevaluation.mjs
```

source에 존재하는 별도 Premium Hosted verifier 묶음을 CandidatePolicy 통합이라는 이유로 자동 반입하지 않는다.

### 4.3 `exclude` — 59 paths

두 종류로 나뉜다.

1. source-only path: final tree에도 없어야 함
2. current main에도 존재하는 path: exact current-main blob을 유지해야 함

```text
source-only excluded:
final path absent

main-existing excluded:
final_blob(path) == main_blob(647051..., path)
```

주요 제외:

- source branch 전용 Stage 11C/11D workflow
- 과거 Premium Hosted work log, runbook, fixture 및 runner
- source의 과거 Auth/full-report/session/Supabase delta
- current main이 이미 별도로 발전시킨 UI와 security verifier
- CandidatePolicy integration과 무관한 historical tooling

exclude는 “검토하지 않음”이 아니라 exact base parity로 보호되는 명시적 결정이다.

---

## 5. Transitive dependency closure

127-path ledger만으로도 파일 누락은 막지만, include 파일이 exclude source-only 파일을 import하면 runtime closure가 깨질 수 있다.

따라서 구현 verifier는 다음 closure를 추가로 증명해야 한다.

```text
literal static imports resolve
literal dynamic imports resolve
package script targets resolve
spawned local script targets resolve
security manifest entries resolve
included/semantic path → excluded source-only path edges = 0
production build module closure = PASS
```

이 중 하나라도 실패하면 path 분류가 잘못된 것이므로 같은 integration PR에서 disposition을 수정하고 전체 검증을 다시 실행한다. 새 설계 단계는 만들지 않는다.

---

## 6. Dependency 재검토

current main `package.json`은 이미 다음 상태다.

```text
workspaces: packages/*, tools/*
Synthetic Toolkit T1–T11 scripts: present
next: 15.5.22
sharp: 0.35.3
```

source dependency remediation을 wholesale 이식할 이유가 없다.

통합 구현의 dependency 작업은 다음 순서다.

1. CandidatePolicy scripts만 package.json에 union
2. current main dependency versions와 override 유지
3. lockfile deterministic regeneration
4. `npm ci`
5. `npm audit --json`
6. `npm ls --all`

최종 audit가 0이고 required resolved versions가 안전하면 추가 package version 변경은 하지 않는다.

---

## 7. 구현 완료 판정

다음 조건이 모두 통과해야만 “빠짐없이 통합 완료”라고 말할 수 있다.

```text
Git diff ledger: 127/127 exact match
include_exact: 62/62 source blob parity
merge_semantic: 6/6 path-specific contract PASS
exclude: 59/59 main parity or source-only absence
unresolved import/script/verifier dependency: 0
temporary diagnostic route residue: 0
CandidatePolicy focused verifiers: PASS
security closeout expected = executed = passed
current-main regression: PASS
npm audit: 0
production build: PASS
default-off response/snapshot/order invariance: PASS
exact-head Preview: READY
Production target/alias: absent
```

설계는 이제 silent omission을 허용하지 않는다. 다만 실제 merge completeness는 구현 branch의 최종 tree가 위 게이트를 통과하기 전에는 주장하지 않는다.

---

## 8. 다음 작업

다음 작업은 추가 설계가 아니다.

```text
CANDIDATE-POLICY-MAIN-INTEGRATION
```

단일 구현 PR에서 다음을 연속 수행한다.

1. exact main에서 implementation branch 생성
2. 127-path ledger verifier를 첫 gate로 실행
3. 62 exact blobs 반입
4. 6 semantic paths 구현
5. 59 excluded paths의 main parity/absence 검증
6. import/script/security closure 검증
7. focused + security + regression + build + audit 실행
8. exact-head Preview 검증
9. 결과 문서와 final machine manifest 작성

```text
EXHAUSTIVE_PATH_LEDGER_DEFINED
TREE_DIFF_127_OF_127_CLASSIFIED
INCLUDE_EXACT_62
MERGE_SEMANTIC_6
EXCLUDE_59
UNKNOWN_PATH_ZERO
DUPLICATE_PATH_ZERO
TRANSITIVE_CLOSURE_REQUIRED
READY_FOR_SINGLE_PR_IMPLEMENTATION
NO_ADDITIONAL_DESIGN_STAGE
```
