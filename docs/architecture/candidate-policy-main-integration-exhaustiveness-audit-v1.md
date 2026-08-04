# CandidatePolicy Main Integration Exhaustiveness Audit v1

## 0. 최종 판정

```text
audit_status: DESIGN_CORRECTED_TO_EXHAUSTIVE_408_PATH_AUTHORITY
silent_path_omission_possible_under_current_contract: false
actual_merge_completeness_proven: pending implementation
next_action: IMPLEMENT_SINGLE_CURATED_INTEGRATION_PR
additional_design_stage_required: false
```

이 감사는 설계 문구가 아니라 exact Git history와 tree diff를 기준으로 수행했다.

초기 최종 설계의 `current-main curated integration` 방향은 타당했지만, 실제 diff 전체를 열거하지 않아 “빠짐없이”를 증명하지 못했다. 첫 보완에서 GitHub compare 응답에 노출된 127개만 ledger로 만들었으나, fail-closed 원격 검증에서 실제 `git diff --name-only`가 408개임이 확인됐다.

따라서 127-path ledger는 폐기하고 exact Git CLI 결과 408개를 전부 분류한 ledger로 교체했다.

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
```

권위 있는 tree 비교:

```text
git diff --name-status --no-renames <main> <source>

A — source only: 100
D — main only: 278
M — both trees contain different blobs: 30
total: 408
```

두 branch는 fast-forward 또는 단순 stacked merge 관계가 아니다. source를 wholesale merge하면 현재 main의 Admin, 모바일, Face, Synthetic Toolkit T1–T11, Auth, Security, migration, E2E 및 CI 자산을 대량으로 제거하거나 과거 blob으로 되돌릴 수 있다.

---

## 2. 검증 과정에서 발견한 두 결함

### 2.1 기존 설계의 경로 누락 위험

기존 설계는 모든 path를 다음 중 하나로 분류한다고 선언했다.

```text
include_exact
merge_semantic
exclude
```

그러나 actual path ledger가 없어서 prefix 밖 경로, main-only 경로, shared file 누락을 자동 차단하지 못했다.

### 2.2 첫 원격 실행의 거짓 성공

첫 임시 workflow는 다음 형태였다.

```bash
node verifier.mjs | tee result.txt
```

`pipefail`이 없어 Node가 AssertionError로 실패해도 `tee`의 종료 코드가 0이 되어 GitHub 화면은 success로 표시됐다. raw job log 검토에서 이를 발견했다.

수정:

```bash
set -euo pipefail
node verifier.mjs 2>&1 | tee result.txt
```

이후 실행은 실제 408-path mismatch를 정상적으로 failure 처리했다. 첫 success run은 검증 근거로 사용하지 않는다.

---

## 3. 최종 408-path disposition

```text
include_exact: 62
merge_semantic: 6
exclude_source_only: 38
exclude_main_present: 302
exclude total: 340
total: 408
unknown: 0
duplicate: 0
```

### 3.1 `include_exact` — 62

CandidatePolicy / CandidateExposurePolicy 전용 durable runtime, contract, fixture, verifier 및 증거다.

```text
final_blob(path) == source_blob(ce882aa..., path)
```

권위 파일:

```text
docs/architecture/candidate-policy-main-integration-ledger/include-exact.txt
```

### 3.2 `merge_semantic` — 6

정확히 다음 여섯 경로다.

```text
app/api/analyze/route.js
lib/evaluator-boundary-policy-shadow.js
package.json
package-lock.json
scripts/run-security-closeout-verifier-suite.mjs
scripts/verify-evaluator-boundary-readiness-review.mjs
```

권위 파일:

```text
docs/architecture/candidate-policy-main-integration-ledger/merge-semantic.txt
```

각 path는 current main 권위와 source delta를 별도로 보존하며 wholesale ours/theirs 선택을 금지한다.

### 3.3 `exclude_source_only` — 38

source에만 존재하지만 CandidatePolicy durable integration에는 필요하지 않은 과거 Premium Hosted, Auth helper, Stage 11C/11D workflow 및 evidence다.

```text
final path absent
```

권위 파일:

```text
docs/architecture/candidate-policy-main-integration-ledger/exclude-source-only.txt
```

### 3.4 `exclude_main_present` — 302

현재 main에 존재하며 source가 없거나 다른 과거 blob을 가진 경로다. 여기에는 Admin, SurveyFlow, Synthetic Toolkit T1–T11 package/runtime/docs/tests, migration 및 E2E가 포함된다.

```text
final_blob(path) == main_blob(647051..., path)
```

권위 파일:

```text
docs/architecture/candidate-policy-main-integration-ledger/exclude-main-platform.txt
docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-root-packages.txt
docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-docs.txt
docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-src.txt
docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-tests.txt
```

이 302개를 분류하지 않으면 source 통합 과정에서 현재 main 기능이 삭제될 수 있다. 이번 보완의 핵심은 이 current-main 보존 집합을 exact path로 고정한 것이다.

---

## 4. Path ledger verifier 계약

```text
scripts/verify-candidate-policy-main-integration-path-ledger.mjs
```

full-history checkout에서 다음을 직접 계산한다.

1. exact merge base
2. ahead counts `521 / 263`
3. actual name-status counts `A100 / D278 / M30`
4. actual tree diff 408개
5. ledger union과 actual diff의 exact equality
6. duplicate 및 unknown path zero
7. include-exact 62개가 모두 source-only이고 source object가 존재함
8. semantic 6개가 모두 양쪽 modified path임
9. source-only exclusion 38개가 모두 source-only임
10. main-present exclusion 302개가 모두 main object를 가짐
11. temporary diagnostic route가 durable 분류에 포함되지 않음

한 경로라도 다르면 구현 또는 merge를 중단한다.

---

## 5. Transitive closure

path가 존재하는 것만으로는 충분하지 않다. include 또는 semantic path가 exclude-source-only 파일을 import하거나 실행하면 기능이 불완전해진다.

최종 구현 verifier는 다음을 추가로 증명해야 한다.

```text
literal static imports resolve
literal dynamic imports resolve
package script targets resolve
spawned local script targets resolve
security manifest entries resolve
included/semantic → excluded-source-only dependency edges = 0
production build module closure = PASS
```

---

## 6. Dependency 재검토

현재 main은 이미 다음을 보유한다.

```text
npm workspaces
Synthetic Toolkit T1–T11 scripts
next 15.5.22
sharp 0.35.3
safe override strategy
```

따라서 source package files를 wholesale 복사하지 않는다.

구현은 CandidatePolicy scripts만 union하고 current-main package graph에서 lockfile을 재생성한다. 최종 `npm audit = 0`과 resolved dependency tree를 확인한다.

---

## 7. “빠짐없이 통합” 완료 조건

실제 구현 완료를 주장하려면 다음이 모두 통과해야 한다.

```text
actual Git diff = ledger: 408/408
include-exact source blob parity: 62/62
semantic contracts: 6/6
source-only exclusions absent: 38/38
main-present exact blob parity: 302/302
unknown path: 0
duplicate path: 0
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

설계는 이제 silent omission을 허용하지 않는다. 실제 merge completeness는 구현 PR final head가 위 조건을 통과한 뒤에만 주장한다.

---

## 8. 다음 작업

추가 설계가 아니라 다음 단일 구현 작업으로 진행한다.

```text
CANDIDATE-POLICY-MAIN-INTEGRATION
branch: codex/candidate-policy-main-integration
base: exact current main
PR: exactly one
```

순서:

1. implementation branch를 exact main에서 생성
2. 408-path ledger verifier를 첫 gate로 실행
3. 62 exact source blobs 반입
4. 6 semantic paths 구현
5. 38 source-only exclusions 부재 검증
6. 302 main-present blobs 보존 검증
7. transitive closure 검증
8. focused/security/regression/build/audit 검증
9. exact-head Preview 검증
10. final result manifest 작성

```text
TREE_DIFF_408_OF_408_CLASSIFIED
SOURCE_ONLY_100
MAIN_ONLY_278
MODIFIED_30
INCLUDE_EXACT_62
MERGE_SEMANTIC_6
EXCLUDE_SOURCE_ONLY_38
EXCLUDE_MAIN_PRESENT_302
UNKNOWN_PATH_ZERO
DUPLICATE_PATH_ZERO
TRANSITIVE_CLOSURE_REQUIRED
READY_FOR_SINGLE_PR_IMPLEMENTATION
NO_ADDITIONAL_DESIGN_STAGE
```
