# CandidateExposurePolicy Hosted Execution Design v1

## 1. Purpose

Stage 11G defines the Hosted execution architecture for the Stage 11F isolated canary harness.

This stage is design-only. It does not implement or run Vercel deployment, redeployment, promotion, Preview probing, protection bypass, GitHub Actions Hosted execution, public traffic, or Production activation.

The design converts the Stage 11F machine result:

```text
implementation_ready_for_hosted_execution_review
```

into a manual-approval execution contract for a future implementation stage.

## 2. Authority baseline

Design base branch:

```text
codex/candidate-exposure-policy-isolated-preview-canary-harness
```

Design base HEAD:

```text
0060d80071b477308c3dd4a4d83f14b6453a2381
```

Validated Stage 11F harness implementation SHA:

```text
ebc16f9f166ccdefc86de777cf75836eca4af595
```

Product runtime authority SHA:

```text
1bc119347a2f8d3387a935163e24849ceebe349d
```

Stage 11F proves:

- exact 16-entry validate-only matrix;
- recursive runtime closure unchanged across 16 files;
- changed runtime files: 0;
- aggregate telemetry only;
- network operations: 0;
- Hosted operations: 0;
- Production changes: 0.

Stage 11G does not reinterpret these results as Hosted authorization.

## 3. Mandatory repository and deployment policy

The following policy is authoritative for Stage 11G and every future Hosted implementation stage.

1. Remote push is allowed.
2. Intermediate work states are not repeatedly pushed.
3. Local implementation, review, and verification finish before the final commit is pushed.
4. A push is never treated as a request or expectation for automatic Vercel Preview deployment.
5. Preview deployment requires explicit user approval and an explicitly named branch or exact SHA.
6. A branch target must be resolved to an immutable commit SHA before any deployment operation.
7. Production deployment is prohibited before merge to `main`.
8. Vercel deploy, redeploy, promote, or equivalent API operations are prohibited without explicit user approval.
9. GitHub Actions must not create a Preview merely because a branch or PR changed.
10. No design, implementation, or documentation marker can substitute for current user approval.

## 4. Non-goals

Stage 11G does not authorize:

- automatic Preview deployment after push;
- PR Preview deployment as an assumed platform behavior;
- Vercel project-wide or branch-wide environment mutation;
- Production deployment, aliasing, promotion, or domain change;
- CandidateExposurePolicy output entering recommendation assembly;
- response, snapshot, persistence, or UI mutation;
- organic or public Preview traffic;
- background monitoring or scheduled retries;
- warm-up, quota testing, exploratory calls, or automatic replay;
- storing deployment protection secrets or Vercel access tokens in repository evidence;
- executing the 16-request matrix in this stage.

## 5. Architectural decision

Hosted execution is split into four independent responsibilities.

```text
User approval
    ↓
Manual Preview provisioning
    ↓
Approved-deployment verification runner
    ↓
Aggregate evidence and mandatory cleanup
```

### 5.1 Approval authority

A human approval establishes exactly what may happen. It is not inferred from a PR, commit message, workflow marker, previous approval, or an existing Preview.

### 5.2 Manual Preview provisioning

Preview deployment creation is a separate operator action. The future verification runner does not create, redeploy, or promote deployments by default.

Provisioning produces two opaque deployment references:

- default-off control Preview;
- deployment-scoped shadow-on canary Preview.

Both deployments must resolve to the same approved product runtime SHA.

### 5.3 Approved-deployment verification runner

The future runner accepts already provisioned deployment references and performs only the approved exact matrix. It must reject any mode that attempts deployment creation or promotion.

### 5.4 Aggregate evidence and cleanup

The runner records aggregate evidence only and revokes any temporary protection material in a `finally` path. Cleanup failure cannot coexist with PASS.

## 6. Explicit approval contract

A future Hosted operation requires an ephemeral approval receipt created after the user's explicit approval.

Recommended local-only schema:

```json
{
  "schemaVersion": "candidate-exposure-policy-hosted-approval-v1",
  "approvalId": "opaque-random-id",
  "approvedAt": "ISO-8601 timestamp",
  "expiresAt": "ISO-8601 timestamp",
  "targetBranch": "explicit branch name",
  "targetSha": "40-character immutable SHA",
  "allowedOperations": [
    "manual_preview_provisioning",
    "approved_preview_probe",
    "temporary_protection_bypass",
    "mandatory_cleanup"
  ],
  "maxPreviewDeployments": 2,
  "maxAnalyzeRequests": 16,
  "productionAllowed": false
}
```

Rules:

- the receipt is local and untracked;
- the receipt contains no token, secret, deployment URL, user data, or raw conversation text;
- `targetSha` must be resolved and fixed before provisioning;
- approval expires after a short bounded window;
- the allowed operation set is exact;
- deployment promotion is never included;
- reuse across a different SHA is prohibited;
- reuse after expiry is prohibited;
- evidence may store only an approval-receipt SHA-256 digest and approval ID.

## 7. Deployment authority model

### 7.1 Target resolution

The operator may approve either:

- an exact SHA; or
- a branch plus its resolved exact SHA.

The immutable SHA is the execution authority. A moving branch name alone is insufficient.

Preflight must prove:

```text
approved target SHA
= control deployment runtime SHA
= canary deployment runtime SHA
= runner expected runtime SHA
```

Any mismatch blocks execution before the first analyze request.

### 7.2 Control Preview

The control Preview must satisfy:

- target is Preview, never Production;
- approved exact SHA;
- CandidateExposurePolicy shadow opt-in absent or disabled;
- no project or branch environment mutation;
- no Production alias or domain;
- no existing shadow execution in control logs.

### 7.3 Canary Preview

The canary Preview must satisfy:

- target is Preview, never Production;
- same approved exact SHA as control;
- opt-in exists only as deployment-scoped configuration;
- kill switch remains available;
- no project or branch environment mutation;
- no Production alias or domain;
- actor and deployment metadata identify the approved manual operation.

### 7.4 Provisioning separation

The verification runner accepts:

```text
controlDeploymentId
canaryDeploymentId
approvedTargetSha
approvalReceiptPath
```

It must not accept or expose:

```text
deploy
redeploy
promote
production
branch-wide environment write
project environment write
automatic deployment discovery by newest timestamp
```

The operator must pass exact deployment IDs. Selecting “latest deployment” is prohibited.

## 8. Execution modes

A future Stage 11H runner may expose only the following modes.

### 8.1 `plan-only`

Performs:

- approval receipt validation;
- exact SHA validation;
- request-matrix rendering;
- deployment-reference shape validation;
- stop-condition validation;
- evidence destination validation;
- zero network operations.

This is the default mode.

### 8.2 `execute-approved`

Permitted only after all approval and deployment preconditions pass.

Performs:

- read-only deployment metadata validation;
- temporary protection bypass only when required and explicitly approved;
- exact 16-request matrix;
- aggregate evidence collection;
- mandatory cleanup.

It does not create, redeploy, or promote a deployment.

Every other mode is rejected at argument parsing.

## 9. GitHub Actions policy and cost budget

GitHub Actions is not the default Hosted execution environment.

Preferred order:

1. local `plan-only` validation;
2. local implementation and contract verification;
3. one final commit push;
4. user approval;
5. manual Preview provisioning for the approved SHA;
6. local or explicitly approved one-time Hosted verification execution.

If GitHub Actions is later chosen, it must satisfy all of the following:

- `workflow_dispatch` only;
- no `push`, `pull_request`, `schedule`, `deployment`, or repository event trigger;
- explicit string inputs for approval ID, approved SHA, control deployment ID, and canary deployment ID;
- protected environment approval before the job starts;
- concurrency limited to one run per approval ID;
- `cancel-in-progress=false` once analyze requests begin;
- timeout at most 30 minutes;
- artifact retention one day;
- no automatic rerun;
- no deployment creation, redeployment, or promotion step;
- no Production environment;
- one authoritative run per approval.

Budget:

```text
Preview deployments: maximum 2
Analyze requests: exactly 16 maximum
Warm-up requests: 0
Quota probes: 0
Exploratory requests: 0
Automatic retries: 0
Scheduled checks: 0
Default GitHub Actions runs: 0
Authorized GitHub Actions runs: maximum 1
```

## 10. Request matrix

The exact matrix remains:

```text
2 locales × 4 scenarios × 2 modes = 16 requests
```

Locales:

- `ko`;
- `en`.

Scenarios:

- `standard_goal_alignment`;
- `stabilization_active_block`;
- `current_product_semantics`;
- `metadata_incomplete`.

Modes:

- control default-off;
- canary deployment-scoped shadow-on.

Execution order is deterministic:

1. KO standard control;
2. KO standard canary;
3. KO stabilization control;
4. KO stabilization canary;
5. KO current-product control;
6. KO current-product canary;
7. KO metadata-incomplete control;
8. KO metadata-incomplete canary;
9. EN standard control;
10. EN standard canary;
11. EN stabilization control;
12. EN stabilization canary;
13. EN current-product control;
14. EN current-product canary;
15. EN metadata-incomplete control;
16. EN metadata-incomplete canary.

A stop condition prevents every remaining request. No retry is performed in the same approval window.

## 11. Hosted preflight state machine

States:

```text
awaiting_approval
approval_invalid
approval_ready
deployments_unverified
preflight_ready
running
stopped
cleanup_pending
completed_pass
cleanup_failed
evidence_invalid
```

Transitions:

```text
awaiting_approval
  → approval_invalid
  → approval_ready

approval_ready
  → deployments_unverified
  → preflight_ready

preflight_ready
  → running

running
  → stopped
  → cleanup_pending

stopped
  → cleanup_pending

cleanup_pending
  → completed_pass
  → cleanup_failed
  → evidence_invalid
```

Terminal states cannot resume. A new attempt requires a new approval ID and a new execution evidence record.

## 12. Stop conditions

The exact Stage 11E stop-condition set remains authoritative:

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

Stage 11G adds execution-authority stop conditions:

```text
approvalMissing
approvalExpired
approvalTargetMismatch
unapprovedOperation
controlDeploymentMismatch
canaryDeploymentMismatch
requestBudgetExceeded
timeBudgetExceeded
protectionCleanupFailure
evidenceSerializationFailure
```

All keys are exact and mandatory. Unknown, missing, duplicated, or disabled conditions are contract violations.

## 13. Fingerprint and comparison contract

Hosted execution distinguishes three comparisons.

### 13.1 Same-request mutation invariance

Inside each canary request:

- response pre/post fingerprint must match;
- snapshot pre/post fingerprint must match;
- candidate order pre/post fingerprint must match.

This is the authoritative mutation check.

### 13.2 Control/canary structural comparison

Independent provider-backed responses are not required to have equal full response hashes.

Control/canary comparison uses only:

- runtime SHA;
- final diagnostic stage;
- candidate-reference count;
- aggregate exposure counts;
- aggregate lane counts;
- aggregate divergence categories;
- isolated projection fingerprint after removal of prohibited identifiers and nondeterministic text.

### 13.3 Fixture semantic authority

Each request records a fixture semantic fingerprint derived from the approved synthetic fixture structure. Locale text, generated timestamps, run IDs, and provider output are excluded.

## 14. Protection bypass contract

Deployment protection bypass is optional and permitted only when:

- the approval receipt explicitly allows it;
- both exact deployment IDs are already known;
- direct approved access is unavailable;
- the bypass is scoped to automation access only;
- its secret is masked immediately;
- it is held in memory only;
- it is revoked in `finally`;
- revocation is verified through a read-back check.

Forbidden:

- storing the secret in repository files, artifacts, logs, PR text, or evidence;
- reusing an existing unknown bypass;
- creating multiple bypass values for one approval;
- regenerating a bypass after probe failure;
- treating cleanup failure as PASS.

## 15. Aggregate telemetry contract

Permitted per-entry telemetry fields:

```text
schemaVersion
planVersion
approvalIdHash
runtimeImplementationShaMatch
fixtureScenario
fixtureSemanticFingerprint
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

Forbidden fields include:

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
approval receipt content
deployment URL
rawRequest
rawResponse
providerPrompt
providerOutput
ordered exposure vector
reasonCodeCounts
```

Telemetry validators must enforce:

- exact field allowlist;
- exact nested count vocabularies;
- nonnegative integers;
- aggregate totals;
- status and error consistency;
- no identifier-bearing nested key;
- no unknown enum value.

## 16. Final Hosted evidence schema

Recommended aggregate evidence:

```json
{
  "schemaVersion": "candidate-exposure-policy-hosted-execution-evidence-v1",
  "planVersion": "candidate-exposure-policy-limited-preview-canary-plan-v1",
  "approvalIdHash": "sha256",
  "approvedTargetSha": "40-character SHA",
  "harnessImplementationSha": "40-character SHA",
  "controlDeploymentId": "opaque deployment ID",
  "canaryDeploymentId": "opaque deployment ID",
  "startedAt": "ISO-8601",
  "completedAt": "ISO-8601",
  "plannedRequestCount": 16,
  "completedRequestCount": 16,
  "http200Count": 16,
  "runtimeShaMatchCount": 16,
  "finalDiagnosticStageCount": 16,
  "defaultOffExecutionCount": 0,
  "canaryExecutionCount": 8,
  "validTelemetryCount": 16,
  "mutationFingerprintMatchCount": 8,
  "unexpectedDivergenceCount": 0,
  "unclassifiedDivergenceCount": 0,
  "shadowExceptionCount": 0,
  "fallbackCount": 0,
  "invalidContextCount": 0,
  "candidateLevelTelemetryIncidentCount": 0,
  "networkRequestCount": 16,
  "temporaryBypassCreatedCount": 0,
  "temporaryBypassRevokedCount": 0,
  "projectEnvironmentMutationCount": 0,
  "productionChangeCount": 0,
  "stopCondition": "none",
  "cleanupStatus": "completed",
  "status": "completed_pass",
  "authorization": {
    "runtimeActivationAuthorized": false,
    "publicTrafficAuthorized": false,
    "productionActivationAuthorized": false
  }
}
```

When protection bypass is required, created and revoked counts must both equal one. The bypass value is never stored.

Allowed final statuses:

```text
blocked_before_execution
stopped_on_contract_violation
cleanup_failed
evidence_invalid
completed_pass
```

## 17. Cleanup contract

Cleanup always runs after preflight has created temporary material, regardless of request success.

Cleanup includes:

- revoke temporary protection bypass when created;
- verify bypass absence;
- delete local temporary approval-derived material;
- delete temporary multipart files and response buffers;
- delete local deployment locator cache;
- preserve only validated aggregate evidence;
- verify project environment mutation count remains zero;
- verify Production change count remains zero.

Success requires:

```text
temporary bypass residue = 0
temporary file residue = 0
project environment mutation = 0
Production change = 0
```

## 18. Failure and retry policy

No automatic retry is permitted.

Failure classes:

### 18.1 Preflight failure

No analyze request is sent. A corrected attempt requires a new approval or a still-valid approval that explicitly covers the corrected deployment pair.

### 18.2 Request failure

Stop immediately, run cleanup, finalize aggregate partial evidence, and do not execute remaining requests.

### 18.3 Telemetry or serialization failure

Stop immediately. Raw request or response material is not retained as a fallback.

### 18.4 Cleanup failure

Final status is `cleanup_failed`. PASS is prohibited even when all 16 requests succeeded.

### 18.5 Infrastructure failure

Do not rerun automatically. Review the exact failure, confirm that cleanup completed, obtain renewed user approval when necessary, then start a new execution record.

## 19. Future implementation structure

Stage 11H may propose the following files after a separate implementation approval:

```text
lib/candidate-exposure-policy-hosted-approval.js
lib/candidate-exposure-policy-hosted-preflight.js
lib/candidate-exposure-policy-hosted-telemetry.js
lib/candidate-exposure-policy-hosted-evidence.js
scripts/run-candidate-exposure-policy-hosted-execution.mjs
scripts/check-candidate-exposure-policy-hosted-execution-contract.mjs
scripts/check-candidate-exposure-policy-hosted-execution-boundary.mjs
```

Responsibilities:

- approval: parse and validate the ephemeral approval receipt;
- preflight: validate immutable SHA and exact deployment pair;
- telemetry: validate aggregate per-entry records;
- evidence: validate final execution and cleanup evidence;
- runner: support only `plan-only` and `execute-approved`;
- contract checker: positive and negative controls;
- boundary checker: prove no deployment, promotion, runtime-filter, response, storage, UI, project-environment, or Production path exists.

No product route imports these modules.

## 20. Required negative controls

A future implementation verifier must reject at least:

- approval missing;
- approval expired;
- branch without resolved SHA;
- target SHA changed after approval;
- control and canary SHA mismatch;
- non-Preview deployment;
- Production target or alias;
- deployment ID discovered by “latest” lookup;
- deployment creation inside the runner;
- redeploy or promote operation;
- project or branch environment mutation;
- request budget 15 or 17;
- warm-up or quota probe;
- automatic retry;
- missing or unknown stop condition;
- public traffic;
- candidate-level telemetry;
- raw response artifact;
- protection bypass not revoked;
- cleanup failure marked PASS;
- GitHub push or pull-request trigger;
- more than one authorized Actions run;
- recommendation, response, persistence, UI, or runtime-filter connection.

## 21. Design review checklist

The next review must answer:

1. Is manual user approval cryptographically and operationally bound to one immutable SHA?
2. Can a push or PR event create a deployment or Hosted run?
3. Can the runner create, redeploy, or promote a deployment?
4. Can “latest deployment” selection introduce a moving target?
5. Are control and canary guaranteed to use the same runtime SHA?
6. Can temporary bypass material survive any failure path?
7. Can candidate or product identifiers enter telemetry or artifacts?
8. Can provider nondeterminism be confused with policy mutation?
9. Can cleanup failure coexist with PASS?
10. Can any product runtime module import the Hosted harness?
11. Is GitHub Actions consumption zero by default and one run maximum after approval?
12. Are all Production operations structurally absent before `main` merge and separate approval?

## 22. Stage result and authorization boundary

Stage 11G design status:

```text
design_ready_for_review
```

This status means the design is ready for independent review only.

It does not authorize:

```text
Hosted runner implementation
Preview deployment
Vercel deploy
Vercel redeploy
Vercel promote
protection bypass creation
/api/analyze Hosted calls
GitHub Actions Hosted execution
runtime filtering
recommendation mutation
response mutation
storage mutation
UI mutation
public Preview traffic
Production deployment
```

Every Stage 11G result retains:

```text
hostedImplementationAuthorized=false
previewDeploymentAuthorized=false
hostedExecutionAuthorized=false
runtimeActivationAuthorized=false
publicTrafficAuthorized=false
productionActivationAuthorized=false
```

## 23. Design markers

```text
CANDIDATE_EXPOSURE_POLICY_HOSTED_EXECUTION_DESIGN_COMPLETE
DESIGN_READY_FOR_REVIEW
MANUAL_USER_APPROVAL_REQUIRED
IMMUTABLE_SHA_REQUIRED
AUTOMATIC_PREVIEW_DEPLOYMENT_NOT_ASSUMED
PUSH_TRIGGERED_DEPLOYMENT_PROHIBITED
RUNNER_DEPLOYMENT_CREATION_PROHIBITED
EXACT_TWO_PREVIEW_DEPLOYMENTS_MAX
EXACT_16_REQUEST_BUDGET
GITHUB_ACTIONS_ZERO_BY_DEFAULT
AUTHORIZED_ACTIONS_RUN_MAX_ONE
AUTOMATIC_RETRY_PROHIBITED
AGGREGATE_TELEMETRY_ONLY
MANDATORY_FINALLY_CLEANUP
HOSTED_IMPLEMENTATION_NOT_AUTHORIZED
PREVIEW_DEPLOYMENT_NOT_AUTHORIZED
HOSTED_EXECUTION_NOT_AUTHORIZED
RUNTIME_FILTER_NOT_CONNECTED
PUBLIC_TRAFFIC_NOT_AUTHORIZED
PRODUCTION_NOT_AUTHORIZED
```
