# CandidateExposurePolicy Isolated Preview Canary Harness Implementation Design v1

## 1. 문서 목적

이 문서는 Stage 11E에서 확정한 `CandidateExposurePolicy` 격리 Preview canary 계약을 실제 코드로 옮기기 위한 **Stage 11F 구현 설계서**다.

Stage 11E 문서는 정책·안전 경계의 권위 문서다. 이 문서는 그 경계를 다음 구현 항목으로 구체화한다.

- 파일별 책임과 공개 인터페이스
- 실행 상태 머신
- Stage 11E base, product runtime SHA, harness SHA의 권위 분리
- runtime import closure digest attestation
- 고정 fixture manifest
- deterministic isolated projection
- aggregate telemetry와 final evidence
- fail-closed stop condition
- cleanup 및 민감정보 경계
- 구현 순서와 검증 매트릭스

이 문서는 harness를 실행하거나 Production 활성화를 승인하지 않는다.

---

## 2. 단계 경계

### 2.1 Stage 11F에서 허용되는 작업

- harness 전용 pure module 구현
- validate-only runner 구현
- synthetic fixture manifest 구현
- aggregate telemetry/evidence validator 구현
- positive/negative contract verifier 구현
- static import-direction guard 구현
- runtime digest attestation 구현
- local validate-only 실행
- 기존 security verifier, architecture guard, Production build 실행
- Draft PR 유지

### 2.2 Stage 11F에서 금지되는 작업

- Hosted 실행 기능 구현
- Vercel Preview 생성 또는 재배포
- `/api/analyze` Hosted 호출
- protection bypass 생성
- Vercel token 또는 프로젝트 secret 사용
- Production alias, deployment, environment 변경
- 프로젝트 전역 environment 변경
- runtime filter 연결
- recommendation 후보 삭제·재정렬·교체
- API response 변경
- snapshot 변경
- storage write 또는 schema 변경
- UI 변경
- public Preview traffic
- PR Ready 전환
- merge

Stage 11F 완료는 **Hosted 실행 검토 자격**만 의미한다. Hosted 실행기는 별도 Stage 11G에서 설계·구현·승인한다.

---

## 3. 세 가지 권위

### 3.1 Stage 11E design base

Stage 11F 브랜치는 구현 시작 시점에 승인된 PR #102의 exact HEAD에서 생성한다.

```text
stage11eDesignBaseSha:
Stage 11F 브랜치 생성 시 고정한 PR #102 exact HEAD
```

Stage 11F가 추가할 수 있는 파일은 `stage11eDesignBaseSha..harnessImplementationSha` diff allowlist로 검증한다.

### 3.2 Hosted product runtime

```text
runtimeImplementationSha:
1bc119347a2f8d3387a935163e24849ceebe349d
```

이 SHA는 향후 control/canary Preview가 실행해야 할 product runtime 권위다.

### 3.3 Harness implementation

```text
harnessImplementationSha:
Stage 11F 구현 브랜치의 최종 검증 HEAD
```

### 3.4 권위 증명

Stage 11F는 다음을 각각 증명한다.

```text
A. stage11eDesignBaseSha 대비 harness-only 파일만 추가됐다.
B. harnessImplementationSha의 runtime import closure가
   runtimeImplementationSha와 byte-identical하다.
```

A는 구현 범위 증명이고 B는 product runtime 불변성 증명이다. 둘 중 하나라도 실패하면 `blocked_runtime_attestation`이다.

---

## 4. 전체 구조

```text
Stage 11F local validation
        |
        +-- Authority preflight
        |     +-- Stage 11E status 확인
        |     +-- design base SHA 확인
        |     +-- harness HEAD 확인
        |     +-- implementation diff allowlist
        |     +-- runtime import closure digest attestation
        |
        +-- Pure contract modules
        |     +-- control state machine
        |     +-- isolated projection
        |     +-- telemetry schema
        |     +-- final evidence schema
        |
        +-- Fixture manifest validation
        |     +-- exact four scenarios
        |     +-- exact KO/EN semantics
        |     +-- semantic fingerprint
        |
        +-- Validate-only runner
        |     +-- exact 16-entry plan
        |     +-- deterministic replay
        |     +-- simulated stop conditions
        |     +-- no network
        |
        +-- Contract verification
              +-- positive cases
              +-- negative controls
              +-- import-direction guard
              +-- evidence leak guard
```

Stage 11F에는 Vercel, HTTP, deployment, bypass adapter가 존재하지 않는다.

---

## 5. Stage 11F 파일 계획

```text
lib/candidate-exposure-policy-isolated-canary-control.js
lib/candidate-exposure-policy-isolated-projection.js
lib/candidate-exposure-policy-isolated-canary-telemetry.js
lib/candidate-exposure-policy-isolated-canary-evidence.js
scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs
scripts/check-candidate-exposure-policy-isolated-canary-contract.mjs
scripts/check-candidate-exposure-policy-isolated-canary-import-boundary.mjs
fixtures/candidate-exposure-policy-isolated-canary/manifest.v1.json
fixtures/candidate-exposure-policy-isolated-canary/README.md
docs/reviews/candidate-exposure-policy-isolated-canary-implementation-review.md
docs/verification/candidate-exposure-policy-isolated-canary-implementation-result.md
```

Stage 11F는 다음을 수정하지 않는다.

```text
package.json
package-lock.json
app/**
components/**
middleware.*
next.config.*
supabase/**
기존 lib runtime 파일
```

실행은 package script 추가 없이 직접 수행한다.

```bash
node scripts/check-candidate-exposure-policy-isolated-canary-contract.mjs
node scripts/check-candidate-exposure-policy-isolated-canary-import-boundary.mjs
node scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs --mode validate-only
```

---

## 6. 현재 runtime exact contract

Stage 11F는 새 이름을 만들지 않고 현재 runtime contract를 그대로 import한다.

### 6.1 Exposure

```text
primary
contextual
collapsed
hidden
insufficient_evidence
```

### 6.2 Lane eligibility

```text
topPick
supporting
budget
routine
treatment
```

### 6.3 Decision shape

```js
{
  policyVersion: string,
  candidateRef: string,
  exposure:
    | "primary"
    | "contextual"
    | "collapsed"
    | "hidden"
    | "insufficient_evidence",
  reasonCodes: string[],
  currentProductRelation: string,
  evidenceState: string,
  laneEligibility: {
    topPick: boolean,
    supporting: boolean,
    budget: boolean,
    routine: boolean,
    treatment: boolean
  },
  provenance: object
}
```

Harness는 exposure, lane, reason code 목록을 복제 정의하지 않는다. 다음 export가 권위다.

```text
CANDIDATE_EXPOSURES
CANDIDATE_EXPOSURE_LANES
CANDIDATE_EXPOSURE_REASON_CODES
validateCandidateExposureDecision
```

---

## 7. Control module

파일:

```text
lib/candidate-exposure-policy-isolated-canary-control.js
```

책임:

- run state machine
- authority preflight 결과 해석
- request/time budget 검증
- exact stop-condition key 검증
- terminal state 보호
- matrix entry 실행 가능 여부 판정
- stop 이후 실행 차단

비책임:

- Git 명령
- filesystem digest 계산
- HTTP/Vercel 호출
- telemetry serialization
- evidence write

공개 인터페이스:

```js
export const ISOLATED_CANARY_CONTROL_STATES
export const ISOLATED_CANARY_STOP_CONDITIONS

export function createIsolatedCanaryControl(input)
export function validateIsolatedCanaryAuthority(input)
export function transitionIsolatedCanaryControl(control, event)
export function canExecuteIsolatedCanaryEntry(control, entry)
export function stopIsolatedCanaryRun(control, stopCondition)
```

상태:

```text
disabled
eligible
running
stopped
completed
invalid_configuration
```

전이:

```text
disabled -> eligible
disabled -> invalid_configuration
eligible -> running
eligible -> invalid_configuration
running -> completed
running -> stopped
```

`stopped`, `completed`, `invalid_configuration`은 terminal이다.

불변식:

- authority 통과 없이 `running` 불가
- request budget 정확히 16
- duration ceiling 60분
- stop 이후 completed count 증가 금지
- unknown/missing/disabled stop condition은 실행 전 invalid

---

## 8. Isolated projection module

파일:

```text
lib/candidate-exposure-policy-isolated-projection.js
```

책임:

- candidate와 policy decision의 immutable join
- 현재 contract validator 재사용
- candidate order 보존
- duplicate candidateRef 탐지
- aggregate exposure count 계산
- aggregate lane count 계산
- aggregate reason-code count 계산
- deterministic projection fingerprint 생성

공개 인터페이스:

```js
export function buildIsolatedCandidateProjection({
  candidates,
  decisions
})

export function fingerprintIsolatedCandidateProjection(projection)
```

입력 candidate는 원본 product 객체를 직접 노출하지 않고 runner가 다음 descriptor로 축소한다.

```js
{
  candidateRef: string,
  sourceIndex: number
}
```

출력:

```js
{
  aggregate: {
    candidateCount: number,
    exposureCounts: Record<string, number>,
    laneEligibilityCounts: Record<string, number>,
    reasonCodeCounts: Record<string, number>
  },
  fingerprintInput: {
    candidateCount: number,
    orderedExposures: string[],
    orderedLaneEligibilityBits: string[],
    exposureCounts: Record<string, number>,
    laneEligibilityCounts: Record<string, number>,
    reasonCodeCounts: Record<string, number>
  },
  memoryOnly: {
    orderedCandidateRefs: string[]
  }
}
```

`memoryOnly`는 order/fingerprint 검증 후 폐기한다. telemetry와 evidence builder는 `memoryOnly`를 입력으로 받지 않는다.

Fail-closed:

- duplicate candidateRef
- candidate/decision 수 불일치
- sourceIndex 중복·비연속
- candidateRef 순서 불일치
- `validateCandidateExposureDecision()` 실패
- aggregate total 불일치
- source candidate mutation

---

## 9. Aggregate telemetry module

파일:

```text
lib/candidate-exposure-policy-isolated-canary-telemetry.js
```

책임:

- per-entry aggregate schema
- unknown field 거부
- required field 누락 거부
- count reconciliation
- contradictory execution state 거부
- candidate/product/user/secret/raw payload 탐지

공개 인터페이스:

```js
export const ISOLATED_CANARY_TELEMETRY_SCHEMA_VERSION
export const ISOLATED_CANARY_TELEMETRY_ALLOWED_FIELDS
export const ISOLATED_CANARY_TELEMETRY_FORBIDDEN_FIELDS

export function buildIsolatedCanaryTelemetry(input)
export function validateIsolatedCanaryTelemetry(record)
export function serializeIsolatedCanaryTelemetry(record)
```

허용 필드:

```text
schemaVersion
planVersion
runtimeAttestationMatch
fixtureScenario
locale
mode
executionStatus
candidateCount
exposureCounts
laneEligibilityCounts
reasonCodeCounts
divergenceCategoryCounts
responseFingerprintMatch
snapshotFingerprintMatch
candidateOrderMatch
projectionFingerprintPresent
unexpectedDivergenceCount
unclassifiedDivergenceCount
shadowExceptionCount
fallbackCount
invalidContextCount
stopCondition
```

Stage 11F validate-only에서 response/snapshot/order 값은 Hosted 관측 결과가 아니라 **simulation contract result**임을 `executionStatus=validate_only_simulation`으로 명확히 구분한다.

금지 데이터:

```text
candidateRef
candidateId
productId
productName
brand
productUrl
userId
accountId
email
sessionId
reportId
cookie
token
secret
rawRequest
rawResponse
providerPrompt
providerOutput
```

object tree 전체 key를 재귀 검사하고 camelCase, snake_case, 대소문자 변형을 정규화해 탐지한다.

---

## 10. Final evidence module

파일:

```text
lib/candidate-exposure-policy-isolated-canary-evidence.js
```

책임:

- run-level evidence
- planned/completed count
- scenario aggregate
- runtime attestation summary
- stop-condition result
- cleanup result
- authorization invariant
- final status 계산

공개 인터페이스:

```js
export const ISOLATED_CANARY_EVIDENCE_SCHEMA_VERSION
export const ISOLATED_CANARY_EVIDENCE_STATUSES

export function createIsolatedCanaryEvidence(input)
export function appendIsolatedCanaryScenarioResult(evidence, scenario)
export function finalizeIsolatedCanaryEvidence(evidence, cleanup)
export function validateIsolatedCanaryEvidence(evidence)
export function serializeIsolatedCanaryEvidence(evidence)
```

status:

```text
implementation_ready_for_hosted_execution_review
blocked_implementation_contract
blocked_runtime_attestation
blocked_boundary_violation
cleanup_failed
evidence_invalid
```

authorization:

```js
{
  harnessImplemented: true,
  hostedExecutionImplemented: false,
  hostedExecutionAuthorized: false,
  runtimeActivationAuthorized: false,
  runtimeFilterConnectionAuthorized: false,
  recommendationMutationAuthorized: false,
  responseMutationAuthorized: false,
  storageMutationAuthorized: false,
  uiMutationAuthorized: false,
  publicTrafficAuthorized: false,
  projectEnvironmentMutationAuthorized: false,
  productionActivationAuthorized: false
}
```

cleanup failure와 ready status는 양립할 수 없다.

---

## 11. Runtime attestation

## 11.1 Implementation diff allowlist

비교 범위:

```text
stage11eDesignBaseSha..harnessImplementationSha
```

허용 경로:

```text
lib/candidate-exposure-policy-isolated-canary-*.js
scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs
scripts/check-candidate-exposure-policy-isolated-canary-*.mjs
fixtures/candidate-exposure-policy-isolated-canary/**
docs/reviews/candidate-exposure-policy-isolated-canary-implementation-review.md
docs/verification/candidate-exposure-policy-isolated-canary-implementation-result.md
```

allowlist 밖의 변경은 `blocked_boundary_violation`이다.

## 11.2 Runtime import closure digest

다음 root에서 시작해 상대 경로 local import를 재귀 탐색한다.

```text
app/api/analyze/route.js
lib/candidate-exposure-policy.js
lib/candidate-exposure-policy-shadow.js
lib/candidate-exposure-policy-observability.js
lib/candidate-exposure-policy-divergence-diagnostics.js
lib/skin-match-decision-engine.js
```

필수 포함 파일:

```text
lib/candidate-exposure-policy-contract.js
lib/candidate-exposure-policy-evaluator-adapter.js
lib/evaluator-boundary-policy-shadow.js
lib/product-functional-profile.js
```

규칙:

- unresolved local import가 있으면 실패
- dynamic local import가 있으면 명시적 manifest 없이는 실패
- import closure의 각 파일을 두 ref에서 SHA-256 계산
- `runtimeImplementationSha`와 `harnessImplementationSha`의 모든 digest가 일치해야 함
- harness-only 파일은 runtime closure에 포함되면 안 됨

attestation 내부 결과:

```js
{
  runtimeImplementationSha: string,
  harnessImplementationSha: string,
  algorithm: "sha256",
  rootFiles: string[],
  files: {
    [path]: {
      runtimeDigest: string,
      harnessDigest: string,
      match: boolean
    }
  },
  allMatch: boolean
}
```

final evidence에는 개별 digest를 저장하지 않고 다음만 저장한다.

```text
algorithm
rootFileCount
closureFileCount
matchedFileCount
allMatch
attestationFingerprint
```

---

## 12. Fixture manifest

저장:

```text
fixtures/candidate-exposure-policy-isolated-canary/
├─ manifest.v1.json
└─ README.md
```

Stage 11F는 이미지 binary를 저장하거나 다운로드하지 않는다.

manifest는 네 scenario의 **semantic fixture**만 포함한다.

```text
standard_goal_alignment
stabilization_active_block
current_product_semantics
metadata_incomplete
```

구조:

```js
{
  schemaVersion: "candidate-exposure-policy-isolated-canary-fixtures-v1",
  scenarios: [
    {
      scenario: string,
      semanticInput: {
        canonicalState: object,
        candidates: object[]
      },
      localePresentation: {
        ko: object,
        en: object
      },
      expected: {
        allowedReasonCodes: string[],
        forbiddenReasonCodes: string[],
        forbiddenErrorCategories: string[]
      }
    }
  ]
}
```

실제 `/api/analyze`용 synthetic image asset 계약은 Stage 11G에서 별도 작성한다.

fixture semantic fingerprint 포함:

- scenario
- locale-independent canonical state
- candidate semantic metadata
- expected canonical conditions

제외:

- localized string
- provider-generated text
- request ID
- timestamp

---

## 13. Exact 16-entry plan

Runner는 manifest 순서를 신뢰하지 않고 상수에서 matrix를 생성한다.

```text
locale order: ko, en
scenario order:
  standard_goal_alignment
  stabilization_active_block
  current_product_semantics
  metadata_incomplete
mode order: control, canary
```

```text
1  ko standard_goal_alignment control
2  ko standard_goal_alignment canary
3  ko stabilization_active_block control
4  ko stabilization_active_block canary
5  ko current_product_semantics control
6  ko current_product_semantics canary
7  ko metadata_incomplete control
8  ko metadata_incomplete canary
9  en standard_goal_alignment control
10 en standard_goal_alignment canary
11 en stabilization_active_block control
12 en stabilization_active_block canary
13 en current_product_semantics control
14 en current_product_semantics canary
15 en metadata_incomplete control
16 en metadata_incomplete canary
```

Stage 11F에서는 이 matrix를 생성·검증·simulation할 뿐 HTTP 요청을 보내지 않는다.

---

## 14. Validate-only runner

파일:

```text
scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs
```

지원 mode:

```text
validate-only
```

다른 mode나 unknown flag는 config parse 단계에서 실패한다.

실행 순서:

```text
parse validate-only config
→ load Stage 11E machine contract
→ resolve design base and harness HEAD
→ validate implementation diff allowlist
→ build runtime import closure attestation
→ validate fixture manifest
→ build exact 16-entry plan
→ create control state
→ deterministic projection replay
→ simulate control/canary aggregate records
→ simulate every stop condition
→ build final evidence
→ cleanup in finally
→ write sanitized evidence JSON
```

금지 adapter:

```text
HTTP
DNS
Vercel
Supabase
Provider
fixture download
child process with network command
```

verifier는 주입된 adapter invocation count가 0인지 확인한다.

---

## 15. Projection replay

각 scenario에 대해:

```text
load semantic fixture
→ deep-clone and deep-freeze source
→ evaluateCandidateExposurePolicy()
→ validate every decision with current contract
→ buildIsolatedCandidateProjection()
→ verify source unchanged
→ verify candidate order unchanged
→ compute projection fingerprint
→ discard memoryOnly refs
→ build aggregate-only telemetry
```

KO/EN은 같은 semantic fixture를 공유하며 locale presentation만 다르다.

필수 parity:

- candidate count
- exposure counts
- lane eligibility counts
- reason code counts
- projection fingerprint
- stop decision

---

## 16. Stop conditions

정확한 key set:

```text
runtimeShaMismatch
defaultOffShadowExecution
unexpectedDivergence
unclassifiedDivergence
shadowException
fallback
invalidContext
responseFingerprintMismatch
snapshotFingerprintMismatch
candidateOrderMismatch
candidateLevelTelemetryDetected
productionOrProjectConfigurationChange
```

Stage 11F simulation은 각 condition을 한 번씩 강제하고 다음을 검증한다.

```text
first condition recorded
running -> stopped
remaining entries blocked
retry blocked
cleanup executed
ready status impossible
```

첫 stop condition만 권위 있는 `stopCondition`으로 저장한다. cleanup 오류는 별도 `cleanup.errors`에 기록하고 최종 status를 `cleanup_failed`로 만든다.

---

## 17. Cleanup

Runner main은 `try/finally`를 강제한다.

Stage 11F cleanup 대상:

- temporary evidence working file
- temporary digest manifest
- temporary fixture normalization file
- authorization simulation file

Stage 11F postcondition:

```text
temporary file residue = 0
network resource count = 0
project environment mutation = 0
Production change = 0
```

Stage 11G의 bypass/deployment cleanup은 Stage 11F 범위가 아니다.

---

## 18. 민감정보 경계

Stage 11F는 secret을 읽지 않는다.

금지:

- environment secret enumeration
- token/bypass parsing
- deployment URL 저장
- raw request/response
- product/candidate identifier evidence
- user/account/session/report 정보

허용 evidence는 aggregate count, boolean invariant, SHA summary, status뿐이다.

---

## 19. Contract verifier

파일:

```text
scripts/check-candidate-exposure-policy-isolated-canary-contract.mjs
```

Positive:

- exact state set와 transition
- exact stop-condition set
- exact 16-entry plan
- exact four scenarios
- KO/EN semantic parity
- current exposure/lane/reason contract import
- deterministic projection
- aggregate telemetry round-trip
- final evidence round-trip
- cleanup success
- network invocation 0
- Hosted authorization false

Negative controls:

### Control

- authority 없는 run
- terminal state 재전환
- 17번째 entry
- 60분 초과
- stop 이후 entry
- unknown/missing/disabled stop key

### Projection

- duplicate candidateRef
- candidate/decision count mismatch
- candidate order change
- invalid current decision contract
- source mutation
- aggregate reconciliation mismatch

### Telemetry

- candidateRef 삽입
- productName 삽입
- rawResponse 삽입
- nested forbidden field
- unknown field
- negative/non-integer count
- contradictory status

### Evidence

- cleanup failure + ready status
- hostedExecutionImplemented=true
- hostedExecutionAuthorized=true
- Production authorization=true
- deployment URL 저장
- candidate-level array 저장
- planned/completed mismatch

### Attestation

- design base mismatch
- forbidden implementation path
- unresolved local import
- dynamic import without manifest
- runtime file digest mismatch
- harness module imported by runtime closure

---

## 20. Import-direction guard

파일:

```text
scripts/check-candidate-exposure-policy-isolated-canary-import-boundary.mjs
```

검사 대상:

```text
app/**
components/**
기존 lib/**
```

기존 파일에서 다음 harness import를 금지한다.

```text
candidate-exposure-policy-isolated-canary-control
candidate-exposure-policy-isolated-projection
candidate-exposure-policy-isolated-canary-telemetry
candidate-exposure-policy-isolated-canary-evidence
run-candidate-exposure-policy-isolated-preview-canary
```

허용:

```text
runner/checker -> harness modules
runner -> existing read-only runtime modules
```

금지:

```text
product runtime -> harness modules
route/response/storage/UI -> harness modules
```

---

## 21. 구현 순서

### Phase 1 — Pure control and schema

1. control state constants
2. authority validator
3. transition reducer
4. stop-condition validator
5. telemetry schema
6. evidence schema

### Phase 2 — Projection

1. current runtime contract import
2. immutable descriptor join
3. duplicate/order validation
4. aggregate counts
5. deterministic fingerprint
6. memory-only ref disposal

### Phase 3 — Authority attestation

1. design base resolver
2. implementation diff allowlist
3. recursive local import graph
4. runtime digest comparison
5. attestation summary

### Phase 4 — Fixture and runner

1. four-scenario manifest
2. KO/EN parity
3. exact matrix builder
4. validate-only orchestration
5. stop simulation
6. cleanup

### Phase 5 — Verification

1. contract verifier
2. import-direction guard
3. existing security closeout suite
4. architecture guard
5. Production build
6. diff hygiene

### Phase 6 — Independent implementation review

1. no product runtime diff
2. no network capability
3. no candidate-level evidence
4. no secret path
5. negative controls complete
6. Draft PR 유지

---

## 22. 검증 매트릭스

| 계층 | 필수 결과 |
|---|---|
| Control | 상태·전이·budget·stop invariant PASS |
| Projection | contract/order/immutability/fingerprint PASS |
| Telemetry | exact allowlist와 leak detection PASS |
| Evidence | status/count/cleanup/authorization PASS |
| Implementation diff | allowlist 밖 변경 0 |
| Runtime closure | unresolved import 0, digest mismatch 0 |
| Fixture | 4 scenarios, KO/EN parity PASS |
| Runner | network/Vercel/analyze 호출 0 |
| Import boundary | 기존 runtime의 harness import 0 |
| Security closeout | 기존 전체 suite PASS |
| Architecture guard | PASS |
| Production build | PASS |
| Diff hygiene | PASS |

---

## 23. 완료 조건

```text
1. 계획된 harness 파일만 추가
2. 기존 product runtime 파일 변경 0
3. stage11e design base exact match
4. runtime import closure allMatch=true
5. exact 16-entry plan 보존
6. four-scenario fixture contract 통과
7. current exposure/lane/reason contract 재사용
8. projection deterministic
9. candidate-level telemetry/evidence 0
10. validate-only network call 0
11. hostedExecutionImplemented=false
12. hostedExecutionAuthorized=false
13. Production authorization=false
14. security verifier 전체 PASS
15. architecture guard PASS
16. Production build PASS
17. Draft PR 유지
```

완료 status:

```text
implementation_ready_for_hosted_execution_review
```

이 상태는 Hosted 실행 또는 runtime 활성화 승인이 아니다.

---

## 24. Stage 11F 결과 문서

```text
docs/verification/candidate-exposure-policy-isolated-canary-implementation-result.md
```

필수 내용:

- branch/base/head
- stage11eDesignBaseSha
- runtimeImplementationSha
- harnessImplementationSha
- changed file list
- implementation diff allowlist result
- runtime closure attestation summary
- fixture result
- assertion/negative-control count
- network invocation count
- security closeout
- architecture guard
- Production build
- diff hygiene
- authorization object
- unresolved findings
- final status

최종 marker:

```text
CANDIDATE_EXPOSURE_POLICY_ISOLATED_PREVIEW_CANARY_HARNESS_IMPLEMENTATION_PASS
IMPLEMENTATION_READY_FOR_HOSTED_EXECUTION_REVIEW
DESIGN_BASE_EXACT
RUNTIME_IMPORT_CLOSURE_ATTESTATION_PASS
EXACT_16_REQUEST_PLAN_PRESERVED
ISOLATED_PROJECTION_IMPLEMENTED
CURRENT_EXPOSURE_CONTRACT_REUSED
AGGREGATE_TELEMETRY_ONLY
CANDIDATE_LEVEL_EVIDENCE_ZERO
VALIDATE_ONLY_NETWORK_CALL_ZERO
HOSTED_EXECUTION_NOT_IMPLEMENTED
HOSTED_EXECUTION_NOT_AUTHORIZED
RUNTIME_FILTER_NOT_CONNECTED
RECOMMENDATION_MUTATION_NOT_CONNECTED
RESPONSE_MUTATION_NOT_CONNECTED
STORAGE_MUTATION_NOT_CONNECTED
UI_MUTATION_NOT_CONNECTED
PUBLIC_TRAFFIC_NOT_AUTHORIZED
PRODUCTION_NOT_CHANGED
PR_REMAINS_DRAFT
```

---

## 25. 후속 단계

Stage 11F가 통과한 뒤에만 별도 Stage 11G 설계를 시작한다.

```text
Stage 11G — Bounded Hosted Isolated Preview Canary Execution
```

Stage 11G는 다음을 별도로 설계·승인해야 한다.

- exact Preview deployment IDs
- exact runtime SHA
- deployment-scoped canary opt-in
- synthetic image fixture artifact
- request construction
- protection bypass 생성·삭제
- Vercel secret 사용 경계
- 16-request 실행 창
- Hosted telemetry 수집
- cleanup 책임
- stop-condition monitoring

Stage 11F PASS만으로 Stage 11G를 자동 시작하지 않는다.
