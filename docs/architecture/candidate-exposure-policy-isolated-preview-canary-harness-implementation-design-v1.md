# CandidateExposurePolicy Isolated Preview Canary Harness Implementation Design v1

## 1. 문서 목적

이 문서는 Stage 11E에서 확정한 `CandidateExposurePolicy` 격리 Preview canary 계약을 실제 코드로 옮기기 위한 **Stage 11F 구현 설계서**다.

이 단계의 목적은 Hosted canary를 실행하는 것이 아니라, 다음을 구현 가능한 수준으로 고정하는 것이다.

- 파일별 책임과 공개 인터페이스
- 실행 상태 머신
- runtime SHA와 harness SHA의 권위 분리
- runtime tree attestation
- 고정 fixture 패키지
- Hosted invariance lane
- deterministic projection replay lane
- aggregate telemetry와 evidence
- fail-closed stop condition
- cleanup 및 비밀정보 처리
- 구현 순서와 검증 매트릭스

이 문서는 기존 Stage 11E 설계 계약을 대체하지 않는다. Stage 11E 문서는 정책·안전 경계의 권위 문서이고, 이 문서는 그 경계를 코드 구조와 실행 절차로 구체화하는 하위 구현 문서다.

---

## 2. 단계 경계

### 2.1 Stage 11F에서 허용되는 작업

- harness 전용 pure module 구현
- harness runner 구현
- synthetic fixture manifest 구현
- aggregate telemetry/evidence validator 구현
- local validate-only 실행
- positive/negative contract verifier 구현
- static import-direction guard 구현
- 기존 security verifier, architecture guard, Production build 실행
- Draft PR 유지

### 2.2 Stage 11F에서 금지되는 작업

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

Stage 11F 구현 완료는 **Hosted 실행 승인**이 아니다. Hosted 실행은 별도 Stage 11G 승인과 명시적 실행 창을 요구한다.

---

## 3. 권위 기준

### 3.1 Stage 11E 설계 권위

```text
branch: codex/candidate-exposure-policy-isolated-preview-canary-harness-design
status: design_ready_for_implementation_review
```

### 3.2 Hosted product-runtime 권위

```text
runtimeImplementationSha:
1bc119347a2f8d3387a935163e24849ceebe349d
```

### 3.3 Stage 11F harness 권위

```text
harnessImplementationSha:
Stage 11F 구현 브랜치의 최종 검증 HEAD
```

두 SHA는 동일할 수 없다. Stage 11F에는 harness 파일이 새로 추가되기 때문이다.

따라서 실행 권위는 다음 두 증명으로 구성한다.

```text
1. Hosted deployment가 runtimeImplementationSha를 실행한다.
2. harnessImplementationSha가 runtimeImplementationSha 대비
   허용된 harness-only 파일 외에는 어떤 변경도 포함하지 않는다.
```

두 번째 증명은 path allowlist와 content digest attestation을 모두 통과해야 한다.

---

## 4. 전체 구현 구조

```text
Stage 11F local validation
        |
        +-- Authority preflight
        |     +-- Stage 11E contract 확인
        |     +-- runtime SHA 확인
        |     +-- harness HEAD 확인
        |     +-- changed-path allowlist 확인
        |     +-- runtime tree digest attestation
        |
        +-- Pure contract modules
        |     +-- control state machine
        |     +-- isolated projection
        |     +-- telemetry schema
        |     +-- final evidence schema
        |
        +-- Fixture package validation
        |     +-- manifest schema
        |     +-- asset hash
        |     +-- semantic fingerprint
        |     +-- KO/EN 구조 동등성
        |
        +-- Validate-only runner
        |     +-- exact 16-entry plan 생성
        |     +-- no network
        |     +-- no Vercel
        |     +-- no analyze call
        |     +-- simulated stop conditions
        |
        +-- Contract verifier
              +-- positive cases
              +-- negative controls
              +-- import-direction guard
              +-- evidence leak guard
```

향후 Stage 11G에서만 다음 Hosted 경로를 사용한다.

```text
Explicit Stage 11G authorization
        |
        +-- exact runtime SHA control Preview
        +-- exact runtime SHA canary Preview
        +-- fixed 16-request matrix
        +-- same-request invariance
        +-- deterministic projection replay
        +-- aggregate evidence
        +-- mandatory cleanup
```

---

## 5. 파일 계획

Stage 11F는 아래 파일만 추가한다. 기존 product runtime 파일은 수정하지 않는다.

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
docs/verification/candidate-exposure-policy-isolated-canary-implementation-result.md
```

Stage 11F 구현을 위해 `package.json`, `package-lock.json`, application route, recommendation runtime, response builder, storage, UI 파일을 수정하지 않는다.

Node script는 다음처럼 직접 실행한다.

```bash
node scripts/check-candidate-exposure-policy-isolated-canary-contract.mjs
node scripts/check-candidate-exposure-policy-isolated-canary-import-boundary.mjs
node scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs --mode validate-only
```

---

## 6. 모듈별 책임과 인터페이스

## 6.1 Control module

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
- 요청 실행 가능 여부 판정
- stop 이후 실행 차단

비책임:

- Git 명령 실행
- Vercel API 호출
- HTTP 요청
- telemetry serialization
- evidence 파일 write

공개 인터페이스:

```js
export const ISOLATED_CANARY_CONTROL_STATES
export const ISOLATED_CANARY_STOP_CONDITIONS

export function createIsolatedCanaryControl(input)
export function validateIsolatedCanaryAuthority(input)
export function transitionIsolatedCanaryControl(control, event)
export function canExecuteIsolatedCanaryRequest(control, entry)
export function stopIsolatedCanaryRun(control, stopCondition)
```

권장 event:

```text
authority_validated
configuration_invalid
run_started
request_completed
contract_violation
run_completed
cleanup_failed
```

불변식:

- 초기 상태는 `disabled`
- authority 통과 없이 `running` 불가
- `stopped`, `completed`, `invalid_configuration`은 terminal
- stop 이후 completed request count 증가 금지
- request budget은 항상 16 이하
- duration budget은 60분 이하
- unknown stop-condition key 존재 시 `invalid_configuration`
- stop-condition key 누락 또는 disabled 시 `invalid_configuration`

---

## 6.2 Isolated projection module

파일:

```text
lib/candidate-exposure-policy-isolated-projection.js
```

책임:

- candidate와 policy decision의 immutable projection
- exact exposure-state 검증
- exact lane-eligibility 검증
- candidate order 보존
- candidate reference 중복 탐지
- aggregate exposure count 계산
- aggregate lane count 계산
- projection fingerprint 계산용 canonical value 생성

공개 인터페이스:

```js
export const ISOLATED_CANARY_EXPOSURE_STATES
export const ISOLATED_CANARY_LANES

export function buildIsolatedCandidateProjection({
  candidates,
  decisions
})

export function fingerprintIsolatedCandidateProjection(projection)
```

입력 후보 최소 shape:

```js
{
  candidateRef: string,
  sourceIndex: number
}
```

입력 decision 최소 shape:

```js
{
  candidateRef: string,
  exposureState:
    | "primary"
    | "contextual"
    | "collapsed"
    | "hidden"
    | "insufficient_evidence",
  laneEligibility: {
    top_pick: boolean,
    supporting: boolean,
    budget: boolean,
    routine: boolean,
    alternative: boolean
  },
  reasonCategories: string[]
}
```

출력:

```js
{
  aggregate: {
    candidateCount: number,
    exposureCounts: Record<string, number>,
    laneEligibilityCounts: Record<string, number>,
    reasonCategoryCounts: Record<string, number>
  },
  fingerprintInput: {
    candidateCount: number,
    orderedExposureStates: string[],
    orderedLaneEligibilityBits: string[],
    exposureCounts: Record<string, number>,
    laneEligibilityCounts: Record<string, number>,
    reasonCategoryCounts: Record<string, number>
  },
  memoryOnly: {
    orderedCandidateRefs: string[]
  }
}
```

`memoryOnly`는 runner 내부에서 fingerprint와 order 검증 후 즉시 폐기한다. telemetry와 evidence builder는 `memoryOnly` 속성을 입력으로 받지 않는다.

Fail-closed 조건:

- duplicate candidateRef
- candidate/decision 수 불일치
- unknown exposure state
- lane key 누락 또는 unknown lane key
- boolean이 아닌 lane 값
- sourceIndex 중복 또는 비연속
- decision의 candidateRef가 후보와 불일치
- aggregate total 불일치

---

## 6.3 Aggregate telemetry module

파일:

```text
lib/candidate-exposure-policy-isolated-canary-telemetry.js
```

책임:

- per-request aggregate telemetry exact schema
- unknown field 거부
- required field 누락 거부
- count reconciliation
- contradictory execution state 거부
- candidate-level data 탐지
- raw request/response, identifier, secret 탐지

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
runtimeImplementationShaMatch
fixtureScenario
locale
mode
executionStatus
candidateCount
exposureCounts
laneEligibilityCounts
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

직렬화 전 object tree 전체 key를 재귀 검사한다. 금지 key의 대소문자·snake_case·camelCase 변형도 탐지한다.

---

## 6.4 Final evidence module

파일:

```text
lib/candidate-exposure-policy-isolated-canary-evidence.js
```

책임:

- run-level evidence 생성
- planned/completed count 검증
- request telemetry aggregate
- stop-condition result
- cleanup result
- authorization invariant
- final status 계산
- PASS와 cleanup failure의 양립 차단

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

최종 status:

```text
completed_pass
stopped_on_contract_violation
blocked_before_execution
cleanup_failed
evidence_invalid
```

authorization object는 항상 다음을 포함한다.

```js
{
  harnessImplemented: true,
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

Stage 11F local validation evidence에서는 `hostedExecutionAuthorized`가 반드시 `false`다.

---

## 6.5 Runner

파일:

```text
scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs
```

지원 mode:

```text
validate-only
hosted-execution
```

Stage 11F에서는 `validate-only`만 허용한다.

`hosted-execution` mode는 코드에 존재할 수 있으나 다음 세 조건을 모두 요구하며, Stage 11F에서는 만족시킬 수 없다.

```text
1. --authorization-file <path>
2. authorization.stage === "11G"
3. authorization.hostedExecutionAuthorized === true
```

추가로 다음이 필요하다.

```text
ALLOW_CANDIDATE_EXPOSURE_POLICY_HOSTED_CANARY=1
```

Stage 11F verifier는 해당 environment가 없을 때 hosted mode가 네트워크 접근 전에 fail-closed하는지 확인한다.

Runner 공개 동작:

```text
parse config
→ validate Stage 11E design evidence
→ resolve harness HEAD
→ validate changed-path allowlist
→ build runtime tree attestation
→ validate fixture package
→ build exact 16-entry matrix
→ create control state
→ validate-only simulation
→ build aggregate evidence
→ cleanup in finally
→ write one sanitized evidence JSON
```

Runner는 product route에 import되지 않는다.

---

## 7. Runtime tree attestation

## 7.1 Changed-path allowlist

Stage 11F HEAD와 `runtimeImplementationSha`의 변경 파일은 다음 prefix/path만 허용한다.

```text
lib/candidate-exposure-policy-isolated-canary-*.js
scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs
scripts/check-candidate-exposure-policy-isolated-canary-*.mjs
fixtures/candidate-exposure-policy-isolated-canary/**
docs/architecture/candidate-exposure-policy-isolated-preview-canary-harness-implementation-design-v1.md
docs/reviews/candidate-exposure-policy-isolated-canary-implementation-review.md
docs/verification/candidate-exposure-policy-isolated-canary-implementation-result.md
```

다음 파일이 변경되면 즉시 차단한다.

```text
app/**
components/**
middleware.*
next.config.*
package.json
package-lock.json
lib/candidate-exposure-policy.js
lib/candidate-exposure-policy-shadow.js
lib/candidate-exposure-policy-observability.js
lib/candidate-exposure-policy-divergence-diagnostics.js
lib/skin-match-decision-engine.js
lib/shared-skin-decision-context*.js
lib/*functional*.js
lib/*current-product*.js
supabase/**
```

allowlist 밖의 변경은 파일 내용과 관계없이 `runtimeShaMismatch`로 처리한다.

## 7.2 Content digest attestation

allowlist 검증 후 다음 runtime-sensitive 파일의 SHA-256 digest를 두 ref에서 계산한다.

```text
runtimeImplementationSha
harnessImplementationSha
```

필수 digest 대상:

```text
app/api/analyze/route.js
lib/candidate-exposure-policy.js
lib/candidate-exposure-policy-shadow.js
lib/candidate-exposure-policy-observability.js
lib/candidate-exposure-policy-divergence-diagnostics.js
lib/skin-match-decision-engine.js
```

추가 대상은 manifest에서 확장 가능하지만 삭제할 수 없다.

attestation 출력:

```js
{
  runtimeImplementationSha: string,
  harnessImplementationSha: string,
  algorithm: "sha256",
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

final evidence에는 전체 파일 digest map을 저장하지 않는다. 다음만 저장한다.

```text
algorithm
fileCount
matchedFileCount
allMatch
attestationFingerprint
```

---

## 8. Fixture package

## 8.1 저장 구조

```text
fixtures/candidate-exposure-policy-isolated-canary/
├─ manifest.v1.json
└─ README.md
```

이미지 binary는 Git에 저장하지 않는다.

manifest는 승인된 synthetic fixture artifact를 참조한다.

```js
{
  schemaVersion: "candidate-exposure-policy-isolated-canary-fixtures-v1",
  artifact: {
    source: "github_actions_artifact",
    artifactName: string,
    assetBundleSha256: string
  },
  scenarios: []
}
```

Stage 11F validate-only에서는 fixture binary를 다운로드하지 않는다. manifest와 semantic contract만 검증한다.

Stage 11G 실행 시에만 artifact를 다운로드하고 다음을 검증한다.

- artifact name exact match
- bundle SHA-256
- 각 asset SHA-256
- MIME 및 image decode
- synthetic provenance
- 실제 사용자 데이터 없음
- asset count exact match

## 8.2 Scenario manifest

각 scenario는 locale-independent semantic input과 KO/EN presentation input을 분리한다.

```js
{
  scenario: "standard_goal_alignment",
  semanticInput: {
    survey: {},
    currentProducts: {},
    candidateMetadataOverrides: {}
  },
  localeInputs: {
    ko: {},
    en: {}
  },
  assetRef: string,
  assetSha256: string,
  expected: {
    controlExecution: "disabled",
    canaryExecution: "executed",
    allowedReasonCategories: [],
    forbiddenErrorCategories: [],
    structuralInvariantKeys: []
  }
}
```

fixture semantic fingerprint는 다음만 포함한다.

- scenario key
- locale-independent survey semantics
- current-product semantic state
- candidate metadata override state
- expected canonical conditions

localized string과 provider-generated text는 포함하지 않는다.

---

## 9. Exact request matrix builder

Runner는 manifest 순서를 신뢰하지 않고 고정 상수에서 matrix를 생성한다.

```text
locale order: ko, en
scenario order:
  1. standard_goal_alignment
  2. stabilization_active_block
  3. current_product_semantics
  4. metadata_incomplete
mode order: control, canary
```

생성 결과:

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

manifest가 matrix 항목을 추가·삭제·재정렬할 수 없다.

---

## 10. Hosted invariance lane 설계

Stage 11F에서는 실행하지 않지만, 구현 인터페이스는 다음을 따른다.

입력:

```js
{
  deploymentRole: "default_off" | "deployment_scoped_opt_in",
  deploymentId: string,
  expectedRuntimeSha: string,
  fixture: object,
  locale: "ko" | "en"
}
```

요청 전 확인:

- deployment target은 Preview
- deployment runtime SHA exact match
- control은 shadow opt-in 없음
- canary는 deployment-scoped opt-in만 존재
- project-wide env mutation 없음
- Production alias와 environment unchanged
- request budget remaining
- control state `running`

요청 후 확인:

- HTTP 200
- runtime commit header exact match
- control에서 shadow execution 0
- canary에서 shadow execution 1
- response pre/post match
- snapshot pre/post match
- candidate-order pre/post match
- unexpected divergence 0
- unclassified divergence 0
- shadow exception 0
- fallback 0
- invalid context 0

Independent control/canary full response hash equality는 요구하지 않는다.

---

## 11. Deterministic projection replay lane 설계

입력:

```text
synthetic fixture semantic state
+ exact candidate descriptors
+ canonical decision state
```

실행:

```text
build canonical fixture state
→ deep-freeze input
→ evaluateCandidateExposurePolicy()
→ buildIsolatedCandidateProjection()
→ verify original candidates unchanged
→ verify original candidate order unchanged
→ compute aggregate fingerprint
→ discard memory-only candidate refs
```

Hosted lane과 projection lane의 상관은 다음 두 값만 사용한다.

```text
fixtureSemanticFingerprint
aggregate policy category/count contract
```

Hosted response에서 policy decision 배열을 추출하거나 노출하지 않는다.

---

## 12. Stop-condition 처리

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

처리 순서:

```text
detect
→ atomically set firstStopCondition
→ transition running -> stopped
→ prevent all remaining requests
→ prevent retry
→ preserve completed aggregate only
→ enter finally cleanup
→ finalize evidence
```

첫 stop condition만 권위 있는 `stopCondition`으로 저장한다. 이후 cleanup 중 발견된 오류는 별도 `cleanup.errors`에 기록하고 최종 status를 `cleanup_failed`로 승격할 수 있다.

---

## 13. Cleanup 설계

Runner의 main body는 반드시 `try/finally` 구조를 사용한다.

```js
let cleanupContext = createCleanupContext();
try {
  // preflight and optional execution
} finally {
  cleanupResult = await cleanupIsolatedCanaryResources(cleanupContext);
}
```

cleanup 대상:

- automation/protection bypass
- downloaded fixture artifact
- extracted fixture directory
- deployment locator temp file
- aggregate working file
- masked environment material
- authorization working copy

cleanup 후 검증:

```text
bypass residue = 0
fixture temp file residue = 0
authorization copy residue = 0
project environment mutation = 0
Production change = 0
```

cleanup 실패 시 request 결과와 관계없이 PASS 금지.

---

## 14. Secret 및 민감정보 처리

Stage 11F validate-only는 secret을 읽지 않는다.

Stage 11G Hosted 실행 시에도 다음 원칙을 적용한다.

- token은 process environment에서만 읽음
- CLI argument로 token 전달 금지
- token·bypass 값을 object serialization 대상에 포함 금지
- stdout/stderr 로그 금지
- artifact 저장 금지
- temp file에 평문 저장 금지
- child process environment는 exact allowlist로 전달
- request header dump 금지
- error object의 request config 직렬화 금지

로그와 evidence에는 opaque deployment ID만 허용하며 URL은 저장하지 않는다.

---

## 15. Validate-only mode

Stage 11F의 권위 검증 mode다.

수행:

- design evidence load
- runtime/harness SHA 형식 검증
- changed-path allowlist 검증
- content digest attestation
- fixture manifest schema 검증
- exact matrix 생성 검증
- control state positive transition
- 모든 stop condition simulation
- projection deterministic replay
- telemetry positive/negative validation
- evidence positive/negative validation
- cleanup simulation
- network adapter가 호출되지 않았는지 assertion

금지:

- DNS
- HTTP
- Vercel
- Supabase
- Provider
- deployment lookup
- fixture binary download

validate-only output:

```text
implementation_ready_for_hosted_execution_review
blocked_implementation_contract
blocked_runtime_attestation
blocked_boundary_violation
```

`implementation_ready_for_hosted_execution_review`는 Stage 11G 검토 자격일 뿐 실행 승인이 아니다.

---

## 16. Contract verifier 설계

파일:

```text
scripts/check-candidate-exposure-policy-isolated-canary-contract.mjs
```

필수 positive 검증:

- exact state set
- valid transition set
- exact stop-condition set
- exact 16-entry matrix
- four fixture scenarios
- KO/EN semantic parity
- exact exposure-state set
- exact lane set
- deterministic projection fingerprint
- aggregate telemetry round-trip
- final evidence round-trip
- cleanup success PASS
- hosted authorization false

필수 negative controls:

### Control

- authority 없는 run 시작
- terminal state 재전환
- 17번째 request
- 60분 초과
- stop 이후 request
- unknown stop-condition key
- stop-condition key 누락
- disabled stop-condition

### Projection

- duplicate candidateRef
- candidate/decision 수 불일치
- order change
- unknown exposure state
- lane key 누락
- unknown lane
- non-boolean lane
- source candidate mutation
- decision candidate mismatch

### Telemetry

- candidate ID 삽입
- product name 삽입
- raw response 삽입
- unknown top-level field
- nested forbidden field
- negative count
- non-integer count
- candidate count reconciliation 실패
- contradictory execution/error state

### Evidence

- cleanup failure + completed_pass
- Hosted authorization true in Stage 11F
- Production authorization true
- deployment URL 저장
- bypass secret 저장
- candidate-level array 저장
- request count mismatch
- stop condition과 status 불일치

### Runner

- hosted mode without authorization file
- wrong stage authorization
- environment gate 없음
- runtime attestation mismatch
- forbidden changed path
- fixture hash mismatch
- simulated stop 후 후속 matrix entry 실행

---

## 17. Import-direction guard

파일:

```text
scripts/check-candidate-exposure-policy-isolated-canary-import-boundary.mjs
```

검사 대상:

```text
app/**
components/**
lib/skin-match-decision-engine.js
lib/candidate-exposure-policy.js
lib/candidate-exposure-policy-shadow.js
lib/candidate-exposure-policy-observability.js
```

다음 문자열/import를 금지한다.

```text
candidate-exposure-policy-isolated-canary-control
candidate-exposure-policy-isolated-projection
candidate-exposure-policy-isolated-canary-telemetry
candidate-exposure-policy-isolated-canary-evidence
run-candidate-exposure-policy-isolated-preview-canary
```

허용 dependency direction:

```text
runner/checker -> isolated harness modules
runner -> existing read-only canonical/policy modules
```

금지 dependency direction:

```text
product runtime -> isolated harness modules
route -> isolated harness modules
response/storage/UI -> isolated harness modules
```

---

## 18. 구현 순서

### Phase 1 — Pure control and schema

1. control state constants
2. authority validator
3. transition reducer
4. stop-condition exact-key validator
5. telemetry exact schema
6. evidence exact schema

검증:

- pure positive tests
- malformed configuration negative controls

### Phase 2 — Isolated projection

1. candidate/decision join
2. duplicate detection
3. exact exposure/lane validation
4. aggregate counts
5. canonical fingerprint input
6. memory-only candidate refs

검증:

- deterministic replay
- mutation/order negative controls

### Phase 3 — Fixture manifest and attestation

1. manifest schema
2. exact scenario set
3. KO/EN semantic parity
4. changed-path allowlist
5. runtime digest attestation

검증:

- stale runtime SHA
- forbidden product change
- fixture hash mismatch

### Phase 4 — Validate-only runner

1. CLI parse
2. preflight
3. exact matrix build
4. simulated execution
5. stop simulation
6. evidence finalization
7. cleanup simulation

검증:

- network adapter invocation count = 0
- Hosted authorization false

### Phase 5 — Static boundary and repository regression

1. import-direction guard
2. Stage 11F contract verifier
3. existing security closeout suite
4. architecture guard
5. Production build
6. diff hygiene

### Phase 6 — Implementation review

1. file responsibility review
2. no product runtime diff 확인
3. no candidate-level evidence 확인
4. no secret handling path 확인
5. all negative controls 확인
6. Draft PR 유지

---

## 19. 검증 매트릭스

| 검증 계층 | 필수 결과 |
|---|---|
| Control unit | 모든 상태·전이·budget·stop invariant PASS |
| Projection unit | exposure/lane/order/immutability PASS |
| Telemetry unit | exact allowlist와 leak detection PASS |
| Evidence unit | status/count/cleanup/authorization PASS |
| Attestation | forbidden changed path 0, runtime digest mismatch 0 |
| Fixture contract | 4 scenarios, KO/EN semantic parity PASS |
| Runner validate-only | network/Vercel/analyze 호출 0 |
| Import boundary | product runtime import 0 |
| Security closeout | 기존 전체 suite PASS |
| Architecture guard | PASS |
| Production build | PASS |
| Diff hygiene | PASS |

---

## 20. 구현 완료 조건

Stage 11F는 다음을 모두 충족해야 완료다.

```text
1. 계획된 harness 파일만 추가됨
2. product runtime 파일 변경 0
3. runtime attestation allMatch=true
4. exact 16-entry matrix 생성
5. four-scenario fixture contract 통과
6. control state machine positive/negative 검증 통과
7. isolated projection deterministic 검증 통과
8. candidate-level telemetry/evidence 0
9. validate-only network call 0
10. Hosted execution authorization=false
11. Production authorization=false
12. 기존 security verifier 전체 PASS
13. architecture guard PASS
14. Production build PASS
15. Draft PR 유지
```

완료 status:

```text
implementation_ready_for_hosted_execution_review
```

이 상태는 다음을 의미하지 않는다.

```text
Hosted execution approved
runtime activation approved
recommendation mutation approved
Production approved
```

---

## 21. Stage 11F 결과 문서 형식

파일:

```text
docs/verification/candidate-exposure-policy-isolated-canary-implementation-result.md
```

필수 항목:

- branch
- base
- harness implementation SHA
- runtime implementation SHA
- changed file list
- runtime attestation summary
- fixture contract summary
- verifier assertion count
- negative-control count
- security closeout result
- architecture guard result
- Production build result
- diff hygiene result
- network/Vercel/analyze call count
- authorization object
- unresolved findings
- final status

최종 marker:

```text
CANDIDATE_EXPOSURE_POLICY_ISOLATED_PREVIEW_CANARY_HARNESS_IMPLEMENTATION_PASS
IMPLEMENTATION_READY_FOR_HOSTED_EXECUTION_REVIEW
RUNTIME_TREE_ATTESTATION_PASS
EXACT_16_REQUEST_PLAN_PRESERVED
ISOLATED_PROJECTION_IMPLEMENTED
AGGREGATE_TELEMETRY_ONLY
CANDIDATE_LEVEL_EVIDENCE_ZERO
VALIDATE_ONLY_NETWORK_CALL_ZERO
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

## 22. 후속 단계

Stage 11F가 통과하면 다음 단계는 별도 승인된 Stage 11G다.

```text
Stage 11G — Bounded Hosted Isolated Preview Canary Execution
```

Stage 11G는 다음을 새로 확인해야 한다.

- exact Preview deployment IDs
- exact runtime SHA
- deployment-scoped canary opt-in
- Stage 11G authorization manifest
- 실행 시간 창
- 16-request quota
- synthetic fixture artifact
- protection bypass 생성·삭제 권한
- cleanup 책임자
- stop-condition monitoring

Stage 11F PASS만으로 Stage 11G를 자동 실행하지 않는다.
