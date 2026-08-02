# CandidateExposurePolicy Temporary Synthetic Diagnostic Route Design v1

## 1. Purpose

Stage 11J defines and independently reviews a temporary Hosted diagnostic route that can execute the Stage 11F synthetic CandidateExposurePolicy fixtures inside an exact-SHA Vercel Preview.

This stage is design-only.

It does not:

- implement a route;
- modify `/api/analyze`;
- create or inspect a Vercel deployment;
- call a Hosted endpoint;
- create or consume a GitHub Actions run;
- change project or branch environment configuration;
- use public traffic;
- touch Production;
- authorize CandidateExposurePolicy runtime filtering.

Design base:

```text
branch: codex/candidate-exposure-policy-read-only-hosted-adapter
head: 1a459e2e92ffafa9f2f5c81179d84f7875fc3e15
Draft PR: #117
```

Product runtime authority remains:

```text
1bc119347a2f8d3387a935163e24849ceebe349d
```

Stage 11I status at this base:

```text
read_only_hosted_adapter_implemented_execution_blocked_route_contract
```

## 2. Current blocker

The current product endpoint:

```text
POST /api/analyze
```

accepts multipart survey and image input. It also owns request guarding, image validation, optional Provider work, product-source access, Premium session preparation, cookie emission, and the normal user response.

The Stage 11F synthetic fixture contract instead provides:

```text
scenario
canonicalState
candidates
expectedReasonCodes
fixture semantic fingerprint
```

The current product route does not accept this synthetic contract and does not emit the aggregate diagnostic envelope required by the Stage 11I adapter.

Injecting synthetic fixtures into `/api/analyze` would mix a bounded policy diagnostic with the user-facing analysis contract and its unrelated side effects.

This design rejects that approach.

## 3. Plan-version correction

Stage 11D v1 described sixteen Hosted `/api/analyze` requests.

A separate diagnostic route cannot honestly satisfy that request-target claim.

Stage 11J therefore introduces a new transport plan:

```text
candidate-exposure-policy-hosted-diagnostic-plan-v2
```

The v2 plan preserves:

- locales: `ko`, `en`;
- scenarios: four exact Stage 11F synthetic fixtures;
- modes: `control`, `canary`;
- exact matrix size: 16;
- exact source-SHA deployment identity;
- two Preview deployments;
- aggregate-only evidence;
- fail-closed stop conditions;
- zero retry, warm-up, quota probe, organic traffic, and Production action.

It changes only the Hosted application-plane target:

```text
Stage 11D v1: /api/analyze
Stage 11J v2: temporary synthetic diagnostic route
```

A future PASS may be described only as:

```text
Hosted CandidateExposurePolicy diagnostic execution PASS
```

It must not be described as:

```text
/api/analyze integration PASS
end-to-end user analysis PASS
runtime activation PASS
Production readiness PASS
```

Stage 11D v1 remains historical and unexecuted rather than being silently reinterpreted.

## 4. Core architecture

The diagnostic boundary is isolated from the product route.

```text
approved read-only Hosted adapter
        ↓
HMAC-authenticated temporary diagnostic route
        ↓
internal Stage 11F fixture lookup
        ↓
deployment environment mode resolution
        ↓
control: no evaluator execution
canary: pure CandidateExposurePolicy evaluation
        ↓
aggregate-only diagnostic envelope
```

Proposed route:

```text
POST /api/internal/candidate-exposure-policy-diagnostic
```

The word `internal` is descriptive only. It is not treated as an access-control mechanism.

Security comes from:

- Preview hard-disable rules;
- exact source-SHA verification;
- an exact signed request contract;
- existing Vercel deployment protection material;
- internal fixture selection;
- no persistence or mutation;
- mandatory temporary-route removal.

## 5. Temporary lifecycle

The route is a temporary verification asset and is not intended for `main` or Production.

Required lifecycle:

```text
Stage 11J design
→ Stage 11K local implementation and review
→ user-approved exact-SHA manual Preview provisioning
→ user-approved bounded Hosted diagnostic execution
→ evidence review
→ separate cleanup branch removes route and route-only modules
→ cleanup verification proves route absence
```

The route implementation branch must remain Draft.

Before any CandidatePolicy stack is integrated toward `main`, the following must be absent:

```text
app/api/internal/candidate-exposure-policy-diagnostic/**
route-only diagnostic authentication code
route-only execution code
route-only fixture transport code
```

Design and evidence documents may remain.

The read-only adapter may remain only if it is still disconnected and contains no automatic deployment or Hosted execution trigger.

## 6. Production hard-disable

The route wrapper must reject before reading or parsing the request body unless all environment preconditions pass.

Required environment state:

```text
VERCEL_ENV === "preview"
NODE_ENV === "production"
VERCEL_GIT_COMMIT_SHA is a lowercase 40-character SHA
VERCEL_AUTOMATION_BYPASS_SECRET is present
```

The route must return an indistinguishable 404 response when:

- `VERCEL_ENV` is missing;
- `VERCEL_ENV` is `production`;
- `VERCEL_ENV` is `development`;
- the runtime is self-hosted;
- `VERCEL_GIT_COMMIT_SHA` is missing or malformed;
- the route authentication key is unavailable;
- authentication fails.

The route must never fall back to local development enablement.

No request flag, header, query parameter, branch name, or execution grant can override the environment hard-disable.

## 7. Route runtime configuration

The future route must declare:

```js
export const runtime = "nodejs";
export const maxDuration = 10;
```

Rationale:

- Node.js runtime is required for HMAC and timing-safe comparison;
- policy evaluation is deterministic and should complete far below ten seconds;
- a short function ceiling bounds cost and abuse;
- the route performs no Provider, database, storage, or browser operation.

The route must not configure an Edge runtime.

The route must not add `vercel.json`, middleware, rewrites, redirects, or custom project configuration.

Official Vercel documentation reviewed for this design confirms that Next.js route handlers can declare a function duration and that Protection Bypass for Automation uses an HTTP header with a project-managed secret that may also be exposed as `VERCEL_AUTOMATION_BYPASS_SECRET` in deployments.

Trusted Sources/OIDC is not adopted in v1 because no approved local-runner issuer and claim contract exists. It may be designed separately later.

## 8. Transport and application authentication

### 8.1 Two separate layers

Vercel Deployment Protection access and application route authorization are separate.

Transport layer:

```text
x-vercel-protection-bypass
```

Application layer:

```text
x-bejewely-diagnostic-timestamp
x-bejewely-diagnostic-nonce
x-bejewely-diagnostic-signature
```

Possession of a valid Vercel bypass value alone is not treated as sufficient route authorization.

### 8.2 Signing key

The application signature uses HMAC-SHA-256 keyed by the same approved automation bypass secret available to:

- the external memory-only access-material provider; and
- the Preview route through `VERCEL_AUTOMATION_BYPASS_SECRET`.

The route implementation must not create, rotate, revoke, persist, print, or return that secret.

No additional repository or Vercel environment secret is introduced by this design.

### 8.3 Access-material capability correction

The Stage 11I access-material boundary must be amended from a plain header-map concept to a narrow signing capability.

Proposed capability:

```js
{
  mode: "automation_bypass_hmac_v1",
  getProtectionHeaders(),
  signDiagnosticRequest(canonicalBytes),
  expiresAt
}
```

Rules:

- no enumerable raw secret field;
- no serialization;
- no logging;
- no persistence;
- no refresh;
- no create or revoke method;
- exact deployment and approval scope;
- expiry no later than the execution grant;
- references released during local cleanup.

### 8.4 Canonical signature input

The exact canonical string is:

```text
POST
/api/internal/candidate-exposure-policy-diagnostic
<lowercase request host>
<content-type>
<timestamp>
<nonce>
<sha256 of exact request body bytes>
```

Rules:

- newline separator is exactly `\n`;
- no trailing newline;
- method and path are constants;
- host is the immutable metadata-derived deployment host;
- content type is exactly `application/json`;
- timestamp is an integer Unix epoch in milliseconds;
- nonce is base64url without padding and decodes to 32 bytes;
- body digest is lowercase hexadecimal SHA-256;
- signature is lowercase hexadecimal HMAC-SHA-256;
- route verification uses constant-time byte comparison.

### 8.5 Time and replay boundary

The route accepts timestamps within:

```text
-60 seconds to +15 seconds from server time
```

The local runner must generate a unique nonce for every matrix entry.

No nonce ledger is persisted because this route is pure and creates no state. The residual possibility of a signed request being replayed inside the narrow time window is accepted only because:

- the request requires possession of approved protection material;
- the route is Preview-only;
- the route is pure and read-only;
- each invocation has a ten-second ceiling;
- no user data, Provider, database, session, or storage operation exists.

This is not authorization for an endpoint with side effects.

## 9. Request contract

Request content type:

```text
application/json
```

Maximum request body:

```text
8 KiB
```

Exact request body:

```json
{
  "schemaVersion": "candidate-exposure-policy-hosted-diagnostic-request-v1",
  "executionGrantDigest": "64-character SHA-256",
  "approvalIdHash": "64-character SHA-256",
  "approvedSourceSha": "40-character SHA",
  "deploymentId": "dpl_...",
  "sequence": 1,
  "locale": "ko",
  "scenario": "standard_goal_alignment",
  "expectedMode": "control",
  "fixtureSemanticFingerprint": "64-character SHA-256"
}
```

Exact allowed values:

```text
locale: ko | en
scenario:
  standard_goal_alignment
  stabilization_active_block
  current_product_semantics
  metadata_incomplete
expectedMode: control | canary
sequence: 1..16
```

The route rejects:

- unknown fields;
- duplicate JSON keys;
- arrays or nested objects not present in the contract;
- request-provided `canonicalState`;
- request-provided candidates;
- request-provided reason codes;
- request-provided telemetry;
- arbitrary URL, method, path, headers, retry count, or timeout;
- malformed deployment ID or hashes;
- source SHA unequal to `VERCEL_GIT_COMMIT_SHA`;
- expired or malformed authentication headers;
- matrix sequence inconsistent with locale, scenario, and mode.

The deployment ID is signed correlation data. The route does not claim it can independently query or self-attest its Vercel deployment ID. The read-only adapter's exact metadata-to-host binding remains the deployment identity authority.

## 10. Browser and state rejection

The route is not a browser endpoint.

It must reject requests containing:

```text
Cookie
Authorization
Origin
Sec-Fetch-Site
Sec-Fetch-Mode
Sec-Fetch-Dest
```

The route must not:

- enable CORS;
- export `OPTIONS`;
- create a cookie;
- read an application session;
- use a user account;
- use a browser state file;
- follow a redirect;
- share an HTTP cookie jar.

The Vercel protection header is handled as external transport material and is not echoed in application output.

## 11. Fixture authority

The route loads fixtures from the repository-owned Stage 11F manifest.

The caller selects only a scenario key.

Before execution, the route must prove:

```text
manifest schema is exact
actualUserData === false
runtimeImplementationSha === product runtime authority
scenario order is exact
selected scenario exists exactly once
computed semantic fingerprint matches the signed request
expected reason-code list exists
candidate list is non-empty
```

The fixture is cloned before evaluation.

No raw fixture, candidate descriptor, candidate ID, reason-code map, or canonical state is returned.

No external file path, uploaded file, URL, database row, request image, or user survey is accepted.

## 12. Deployment mode authority

The request's `expectedMode` is an assertion, not authority.

The route resolves the actual mode using the existing deployment environment contract:

```text
DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW
DISABLE_CANDIDATE_EXPOSURE_POLICY_SHADOW
VERCEL_ENV
NODE_ENV
```

### Control deployment

Required resolved state:

```text
enabled = false
optInRequested = false
killSwitchRequested = false
productionHardDisabled = false
mode = disabled
```

The control route must not call `evaluateCandidateExposurePolicy`.

It returns an aggregate zero-execution result.

### Canary deployment

Required resolved state:

```text
enabled = true
optInRequested = true
killSwitchRequested = false
productionHardDisabled = false
mode = shadow_only
```

The canary route executes exactly one pure CandidateExposurePolicy evaluation for the selected fixture.

### Mismatch handling

The route rejects when:

- expected control reaches a shadow-enabled deployment;
- expected canary reaches a disabled deployment;
- kill switch is active;
- environment classification is unrecognized;
- Production hard-disable is active.

The request cannot select or override deployment mode.

## 13. Control execution contract

Control mode proves default-off behavior.

Required behavior:

```text
CandidateExposurePolicy evaluator call count = 0
candidateCount = 0
all exposure counts = 0
all lane counts = 0
all divergence counts = 0
projection fingerprint present = false
shadow execution = false
exception/fallback/invalid-context counts = 0
mutation checks = true
```

Control mode must not calculate hidden policy decisions and then discard them.

No candidate data may enter CandidateExposurePolicy in the control path.

## 14. Canary execution contract

Canary mode performs one deterministic evaluation using the internal fixture.

Required sequence:

```text
clone canonicalState and candidates
→ fingerprint both inputs and candidate order
→ evaluateCandidateExposurePolicy exactly once
→ require status evaluated
→ require every fixture expected reason to be observed
→ build isolated candidate projection
→ compare decisions with evaluatorExecution
→ verify canonicalState unchanged
→ verify candidate input unchanged
→ verify candidate order unchanged
→ build aggregate route telemetry
→ recursively validate forbidden fields
→ serialize exact response envelope
```

The route must not use the default console telemetry sink.

The route must not call `runCandidateExposurePolicyShadow` if doing so would require a second policy evaluation or incomplete legacy evidence. The route may reuse the existing pure evaluator, projection, divergence comparison, and telemetry contracts directly.

This diagnostic proves the same CandidateExposurePolicy implementation executes in the Preview runtime under the deployment opt-in boundary. It does not prove the `/api/analyze` wrapper integration.

## 15. Runtime authority separation

The route does not self-attest product runtime bytes.

Authority remains split:

```text
local preflight:
  recursive runtime closure byte attestation against
  1bc119347a2f8d3387a935163e24849ceebe349d

Hosted route:
  VERCEL_GIT_COMMIT_SHA equals approvedSourceSha
  exact imported policy behavior executes
```

The route must not return a hardcoded `runtimeImplementationShaMatch=true` and present that as byte attestation.

The Stage 11I adapter combines:

- validated local runtime attestation;
- exact deployment metadata;
- exact Hosted source SHA;
- route diagnostic aggregate.

Only the combined runner may produce the final normalized Hosted telemetry field:

```text
runtimeImplementationShaMatch
```

## 16. Diagnostic aggregate

Route-owned aggregate schema:

```text
candidate-exposure-policy-hosted-diagnostic-aggregate-v1
```

Exact fields:

```text
schemaVersion
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
```

Execution statuses:

```text
hosted_control_disabled
hosted_canary_executed
```

The aggregate excludes:

```text
approvalIdHash
runtimeImplementationShaMatch
stopCondition
candidateRef
candidateId
productId
product name
brand
URL
reasonCodeCounts
ordered exposure vector
ordered candidate references
raw request
raw response
Provider content
cookie
session/report/account identifiers
secret or token
```

The adapter adds approval and runtime-attestation context after validating the route envelope.

## 17. Success response envelope

Maximum serialized response:

```text
64 KiB
```

Exact success shape:

```json
{
  "schemaVersion": "candidate-exposure-policy-hosted-diagnostic-envelope-v1",
  "status": "completed",
  "sourceSha": "40-character SHA",
  "environmentClass": "preview",
  "deploymentIdHash": "64-character SHA-256",
  "executionGrantDigest": "64-character SHA-256",
  "sequence": 1,
  "finalDiagnosticStage": "candidate_policy_diagnostic_complete",
  "shadowExecution": false,
  "aggregate": {}
}
```

The raw deployment ID is not returned. A SHA-256 correlation hash is sufficient.

Success headers:

```text
Content-Type: application/json
Cache-Control: no-store, private, max-age=0
Pragma: no-cache
X-Content-Type-Options: nosniff
```

The response must not contain `Set-Cookie`.

## 18. Error responses

Unauthenticated, wrong-environment, missing-key, and invalid-signature failures return only:

```json
{
  "error": "not_found"
}
```

with HTTP 404.

Authenticated contract failures use exact allowlisted machine codes and no details, stack, input echo, or field values.

Examples:

```text
request_contract_invalid
source_sha_mismatch
fixture_contract_invalid
fixture_fingerprint_mismatch
deployment_mode_mismatch
kill_switch_active
policy_evaluation_failed
aggregate_validation_failed
response_serialization_failed
```

Authenticated failures are non-200 and stop the Stage 11I runner.

No automatic retry is permitted.

## 19. Adapter corrections required by Stage 11K

The current Stage 11I adapter still uses analyze-oriented naming from the earlier assumption.

Stage 11K must correct:

```text
postAnalyzeDiagnostic
→ postCandidatePolicyDiagnostic

probeAnalyze
→ probeCandidatePolicyDiagnostic

analyzeRequestCount
→ diagnosticRequestCount
```

The adapter must call only:

```text
/api/internal/candidate-exposure-policy-diagnostic
```

It must never call `/api/analyze` in the Stage 11J v2 plan.

Adapter mapping responsibilities:

```text
HTTP status and body-size verification
route envelope exact validation
source SHA verification
request/deployment correlation hash verification
execution grant digest verification
matrix entry verification
route aggregate validation
local runtime attestation injection
approvalIdHash injection
normalized Hosted telemetry creation
forbidden-key recursive scan
raw body disposal
```

The final evidence must identify the plan as:

```text
candidate-exposure-policy-hosted-diagnostic-plan-v2
```

## 20. Forbidden dependencies and operations

The route and route-owned modules must not import or call:

```text
/api/analyze implementation
OpenAI or another Provider
photo evidence
product source
Supabase client
Auth
Premium access
Premium report session
anonymous write grants
analysis request guard
cookies
saved reports
storage
payment
admin APIs
Vercel SDK or REST API
child_process
filesystem writes
runtime logs
external fetch
```

Allowed product imports are limited to the exact pure CandidateExposurePolicy and Stage 11F fixture/projection/telemetry dependencies frozen during implementation review.

A static import-boundary verifier must enforce the allowlist recursively.

## 21. Logging, persistence, and privacy

The route emits no application log on the success path.

It must not pass aggregate output to `console.info`, `console.log`, `console.warn`, or `console.error`.

It performs:

```text
database writes: 0
storage writes: 0
file writes: 0
cookies: 0
sessions: 0
Provider calls: 0
external network calls: 0
runtime log reads: 0
Vercel control-plane calls: 0
```

Only synthetic fixtures are used.

The response undergoes a recursive forbidden-key scan before serialization.

## 22. Budget

```text
Preview deployments: maximum 2, provisioned outside route and adapter
Deployment metadata reads: maximum 2
Diagnostic POST requests: maximum 16
Evaluator calls:
  control: 0 per request
  canary: 1 per request
Total evaluator calls: exactly 8 on full PASS
Automatic retries: 0
Warm-up requests: 0
HEAD requests: 0
Quota probes: 0
Runtime-log reads: 0
Environment reads through Vercel API: 0
Deployment mutations inside adapter: 0
Route max duration: 10 seconds
Request body cap: 8 KiB
Response body cap: 64 KiB
Overall runner ceiling: 30 minutes
GitHub Actions default: 0
```

The preferred implementation and contract verification environment remains local.

Any Hosted execution requires a separate current user approval.

## 23. Implementation boundary

Expected Stage 11K files:

```text
app/api/internal/candidate-exposure-policy-diagnostic/route.js
lib/candidate-exposure-policy-hosted-diagnostic-auth.js
lib/candidate-exposure-policy-hosted-diagnostic-contract.js
lib/candidate-exposure-policy-hosted-diagnostic-execution.js
lib/candidate-exposure-policy-read-only-hosted-adapter.js
lib/candidate-exposure-policy-hosted-execution-v2.js
scripts/check-candidate-exposure-policy-hosted-diagnostic-route.mjs
scripts/check-candidate-exposure-policy-hosted-execution.mjs
docs/reviews/candidate-exposure-policy-hosted-diagnostic-route-implementation-review.md
docs/verification/candidate-exposure-policy-hosted-diagnostic-route-implementation-result.md
```

The exact implementation allowlist must be frozen before coding.

Forbidden changes:

```text
app/api/analyze/route.js
components/**
middleware
next.config.*
vercel.json
package.json
package-lock.json
Supabase schema or migrations
CandidateExposurePolicy decision behavior
recommendation assembly
normal response schema
storage schema
UI
Production configuration
GitHub workflow
```

No dependency may be added.

## 24. Local verification requirements

Stage 11K must include at least the following negative and positive controls.

1. Production environment returns 404 before body read.
2. Self-hosted and development environments return 404.
3. missing system source SHA returns 404.
4. missing route signing key returns 404.
5. invalid signature returns 404.
6. signature comparison is timing-safe.
7. stale timestamp is rejected.
8. excessive future timestamp is rejected.
9. malformed or reused test nonce is rejected by the local runner contract.
10. exact request field set is enforced.
11. duplicate JSON keys are rejected before ordinary parsing acceptance.
12. body larger than 8 KiB is rejected.
13. non-JSON content type is rejected.
14. Cookie, Authorization, Origin, and browser fetch headers are rejected.
15. request-provided fixture objects are rejected.
16. exact matrix sequence mapping is enforced.
17. source SHA must equal `VERCEL_GIT_COMMIT_SHA`.
18. deployment ID is valid signed correlation data.
19. fixture manifest `actualUserData=false` is enforced.
20. manifest runtime authority is enforced.
21. fixture fingerprint mismatch is rejected.
22. unknown scenario is rejected.
23. control disabled environment passes.
24. control evaluator call count is exactly zero.
25. control projection is absent.
26. control zero-count aggregate is valid.
27. canary enabled environment passes.
28. canary evaluator call count is exactly one.
29. canary expected reasons are observed.
30. canary input canonical state remains unchanged.
31. canary candidate input remains unchanged.
32. canary candidate order remains unchanged.
33. canary projection fingerprint is present but not serialized.
34. unexpected divergence stops.
35. unclassified divergence stops.
36. exception, fallback, or invalid context stops.
37. kill switch stops both expected modes.
38. expected mode mismatch stops.
39. aggregate exact field set is enforced.
40. candidate-level and reason-code count fields are rejected.
41. route response exact field set is enforced.
42. serialized response remains below 64 KiB.
43. response is no-store and emits no Set-Cookie.
44. success path emits no console log.
45. route import graph contains no Provider, DB, storage, Auth, session, or external network dependency.
46. `/api/analyze` imports no diagnostic module.
47. diagnostic modules are imported only by the temporary route, checker, and adapter boundary.
48. adapter transport path is the temporary diagnostic path only.
49. `/api/analyze` is never called by the v2 runner.
50. adapter discards raw route body after normalization.
51. adapter adds runtime-attestation status rather than trusting a route boolean.
52. exact two metadata reads and sixteen diagnostic calls are simulated locally.
53. control/canary count is 8/8.
54. automatic retry count remains zero.
55. environment/log/deployment/Production operation counts remain zero.
56. cleanup design includes mandatory route removal verification.
57. Product build and security suite are deferred until a separately approved final validation point.

No real Hosted request is required for Stage 11K implementation review.

## 25. Cleanup verification requirements

The later cleanup stage must prove:

```text
temporary route path absent
route-only authentication module absent
route-only execution module absent
no import reference remains
/api/analyze unchanged from approved runtime authority
CandidateExposurePolicy runtime closure unchanged
Preview deployment operation not promoted
Production alias unchanged
```

A prior Hosted PASS becomes invalid for activation purposes if the cleanup cannot prove route removal.

The diagnostic evidence may remain historical but cannot authorize a route that no longer exists or a different SHA.

## 26. Independent design review

### Critical 1 — silently replacing `/api/analyze`

Finding:

- Stage 11D v1 named `/api/analyze` as the request target;
- a new endpoint would not satisfy that claim.

Resolution:

- introduce Hosted diagnostic plan v2;
- preserve the matrix and budget while changing the target explicitly;
- prohibit claims of `/api/analyze` integration or end-to-end user-flow PASS.

Status: resolved.

### Critical 2 — synthetic injection into the user route

Finding:

- `/api/analyze` owns real image/survey validation, Provider, product-source, session, cookie, and normal response behavior;
- a hidden synthetic branch would enlarge the user route's attack and regression surface.

Resolution:

- use a dedicated temporary route;
- forbid any `/api/analyze` modification or diagnostic import;
- remove the temporary route after evidence collection.

Status: resolved.

### Critical 3 — bypass secret treated as complete authorization

Finding:

- Vercel automation bypass is project-scoped transport access;
- it does not by itself bind a request to the approved execution grant, SHA, deployment, matrix entry, or expiry.

Resolution:

- require a second HMAC-authenticated application envelope;
- bind method, path, host, body, timestamp, and nonce;
- keep the secret memory-only and route-side through the existing Vercel system environment.

Status: resolved.

### Critical 4 — route residue in Production

Finding:

- a hard-disabled route could still be bundled if merged to `main`;
- configuration or future refactoring could accidentally weaken the guard.

Resolution:

- define the route as a temporary stacked-branch asset;
- require a separate cleanup branch and route-absence proof before integration toward `main`.

Status: resolved.

### Critical 5 — request-owned fixture payload

Finding:

- accepting `canonicalState` or candidates from the caller would create an arbitrary policy execution service and could leak candidate-level data.

Resolution:

- accept only an exact scenario key and expected semantic fingerprint;
- load the immutable synthetic fixture internally;
- return aggregates only.

Status: resolved.

### Important 1 — route self-attestation

Finding:

- a route cannot prove its imported runtime files are byte-identical merely by returning a constant boolean.

Resolution:

- retain local recursive runtime closure attestation as the byte authority;
- route proves only exact Hosted source SHA and behavior;
- adapter combines both proofs.

Status: resolved.

### Important 2 — control path accidentally evaluates policy

Finding:

- evaluating then discarding decisions would make default-off control evidence false.

Resolution:

- control evaluator call count is exactly zero;
- candidate count and every aggregate count are zero;
- projection is absent.

Status: resolved.

### Important 3 — request mode becomes authority

Finding:

- a body field selecting canary mode would bypass the deployment-scoped opt-in design.

Resolution:

- resolve actual mode only from existing environment control;
- treat request mode only as an assertion;
- reject every mismatch.

Status: resolved.

### Important 4 — analyze-oriented adapter naming

Finding:

- `postAnalyzeDiagnostic`, `probeAnalyze`, and `analyzeRequestCount` would falsely imply the product route is tested.

Resolution:

- rename the capability and counters to CandidatePolicy diagnostic terminology;
- prohibit `/api/analyze` calls in the v2 runner.

Status: resolved.

### Important 5 — logging and cookie contamination

Finding:

- the current shadow helper defaults to console telemetry;
- normal analyze flow may emit cookies.

Resolution:

- the diagnostic route uses pure evaluation with no console sink;
- route response emits no cookie and rejects incoming browser state.

Status: resolved.

### Important 6 — replay protection without storage

Finding:

- a serverless route cannot provide durable nonce uniqueness without adding storage.

Resolution:

- use a narrow timestamp window and unique runner nonce;
- retain zero persistence and zero side effects;
- document the bounded residual replay risk rather than claiming durable one-time enforcement.

Status: resolved.

### Important 7 — route cost bounds

Finding:

- the Stage 11I transport cap of 90 seconds is excessive for pure policy evaluation.

Resolution:

- route maximum duration is ten seconds;
- request and response caps are 8 KiB and 64 KiB;
- adapter's broader outer timeout remains a transport ceiling, not expected route duration.

Status: resolved.

### Minor 1 — future OIDC support

Finding:

- Vercel now supports Trusted Sources/OIDC, but the current local runner has no approved issuer or claim mapping.

Resolution:

- exclude OIDC from v1;
- allow a future separately reviewed authentication profile.

Status: resolved.

## 27. Review verdict

```text
Critical unresolved: 0
Important unresolved: 0
Blocking Minor unresolved: 0
```

Machine design status:

```text
design_ready_for_temporary_synthetic_diagnostic_route_implementation_review
```

This status authorizes only local implementation and implementation review of the temporary route contract.

It does not authorize:

- Preview provisioning;
- Vercel deploy, redeploy, or promote;
- bypass creation or revocation;
- Hosted metadata reads;
- Hosted diagnostic requests;
- GitHub Actions execution;
- `/api/analyze` modification;
- runtime filtering;
- public traffic;
- Production activation.

## 28. Final markers

```text
CANDIDATE_EXPOSURE_POLICY_SYNTHETIC_DIAGNOSTIC_ROUTE_DESIGN_PASS
HOSTED_DIAGNOSTIC_PLAN_V2_DEFINED
STAGE_11D_ANALYZE_TARGET_NOT_SILENTLY_REINTERPRETED
PRODUCT_ANALYZE_ROUTE_UNCHANGED
TEMPORARY_ROUTE_LIFECYCLE_REQUIRED
PREVIEW_HARD_DISABLED_OUTSIDE_EXACT_ENVIRONMENT
HMAC_APPLICATION_AUTH_REQUIRED
VERCEL_BYPASS_NOT_SUFFICIENT_AUTHORITY
INTERNAL_FIXTURE_SELECTION_ONLY
CONTROL_EVALUATOR_CALL_COUNT_ZERO
CANARY_EVALUATOR_CALL_COUNT_ONE
RUNTIME_ATTESTATION_REMAINS_EXTERNAL_AUTHORITY
AGGREGATE_ONLY_RESPONSE
PROVIDER_OPERATION_ZERO
DATABASE_OPERATION_ZERO
COOKIE_OPERATION_ZERO
AUTOMATIC_RETRY_PROHIBITED
EXACT_SIXTEEN_DIAGNOSTIC_REQUEST_BUDGET
ROUTE_REMOVAL_REQUIRED_BEFORE_MAIN
IMPLEMENTATION_NOT_STARTED
HOSTED_REQUEST_NOT_RUN
VERCEL_OPERATION_NOT_RUN
GITHUB_ACTIONS_NOT_USED
RUNTIME_FILTER_NOT_CONNECTED
PUBLIC_TRAFFIC_NOT_AUTHORIZED
PRODUCTION_NOT_CHANGED
PR_REMAINS_DRAFT
```
