# CandidateExposurePolicy Read-Only Hosted Adapter Design v1

## 1. Purpose

Stage 11H defines and independently reviews the concrete Hosted adapter boundary for the Stage 11G approval-gated runner core.

This stage is design-only. It does not implement the adapter, provision a Preview, call `/api/analyze`, query live Vercel resources, create or consume a GitHub Actions run, mutate project configuration, or touch Production.

Design base:

```text
branch: codex/candidate-exposure-policy-hosted-execution-runner
head: 7abe4a7ca986059def9de93f8ae68a0d7fb9bd25
Draft PR: #114
```

Product runtime authority remains:

```text
1bc119347a2f8d3387a935163e24849ceebe349d
```

## 2. Definition of read-only

`read-only Hosted adapter` means:

- Vercel control-plane access is limited to reading one explicitly named control deployment and one explicitly named canary deployment;
- the adapter cannot create, redeploy, promote, alias, cancel, or delete deployments;
- the adapter cannot read or write project or branch environment variables;
- the adapter cannot create, rotate, revoke, or persist a protection bypass;
- the adapter cannot query “latest” deployments or discover a deployment by timestamp;
- the adapter cannot query runtime logs by default;
- the adapter cannot target Production.

The approved diagnostic `POST /api/analyze` calls are bounded application-plane probes, not Vercel control-plane mutations. They remain prohibited until separate user approval authorizes the exact execution grant, deployment IDs, source SHA, and 16-request budget.

## 3. Source evidence used by this design

The design preserves the following repository-proven behavior:

1. Stage 10 recorded an exact immutable Preview whose Vercel `target` was `null`, state was READY, and source SHA matched.
2. Stage 11B and Stage 11C exact-SHA Hosted checks proved runtime commit headers, final diagnostic stage, default-off non-execution, shadow-on execution, mutation fingerprints, and aggregate divergence telemetry.
3. Stage 11F fixed four synthetic scenarios and the exact KO/EN control/canary 16-entry matrix.
4. Stage 11G separated `approvedSourceSha` from the product runtime authority and implemented adapter injection without a concrete network adapter.

The prior successful Hosted results do not authorize a new execution.

## 4. Architectural split

The concrete adapter is split into four narrow capabilities.

```text
Read-only deployment metadata capability
        ↓
Immutable application-host resolver
        ↓
Bounded diagnostic probe transport
        ↓
Local-only cleanup and aggregate normalization
```

The implementation must not receive a generic Vercel SDK client, generic REST client, shell command executor, or arbitrary URL fetcher.

## 5. Required Stage 11G core corrections before wiring

The current runner core must not be connected to a concrete adapter without the following contract corrections.

### 5.1 Split provisioning approval from execution authority

The current approval v1 exact operation set includes:

```text
manual_preview_provisioning
temporary_protection_bypass
```

Those operations exceed a read-only adapter's authority.

Stage 11I must introduce a derived, local-only execution grant:

```json
{
  "schemaVersion": "candidate-exposure-policy-hosted-execution-grant-v2",
  "approvalIdHash": "sha256",
  "provisioningReceiptDigest": "sha256",
  "issuedAt": "ISO-8601",
  "expiresAt": "ISO-8601",
  "approvedSourceSha": "40-character SHA",
  "productRuntimeAuthoritySha": "1bc119347a2f8d3387a935163e24849ceebe349d",
  "controlDeploymentId": "dpl_...",
  "canaryDeploymentId": "dpl_...",
  "allowedOperations": [
    "approved_deployment_metadata_read",
    "approved_preview_probe",
    "memory_only_access_material_use",
    "mandatory_local_cleanup"
  ],
  "maxDeploymentMetadataReads": 2,
  "maxAnalyzeRequests": 16,
  "runtimeLogReadsAllowed": false,
  "productionAllowed": false
}
```

Rules:

- the original user approval and provisioning receipt stay outside repository evidence;
- the execution grant contains no token, URL, cookie, user identifier, or raw approval text;
- exact deployment IDs are present before the grant is issued;
- no deployment or bypass mutation operation is included;
- expiry is at most 60 minutes after issuance;
- a new run requires a new execution grant.

### 5.2 Normalize Preview classification

The current runner requires:

```text
target === "preview"
```

That is incompatible with retained repository evidence where a valid immutable Preview had `target=null`.

The adapter must normalize environment class using all available facts:

```text
deployment ID exact match
AND project identity exact match
AND team identity exact match when applicable
AND state READY
AND target is null or preview
AND target is not production
AND no Production alias is attached
AND immutable deployment host is present
AND exact source SHA is proven
```

A null target alone is not sufficient.

### 5.3 Remove metadata-level shadow opt-in authority

The current runner expects deployment metadata to expose:

```text
shadowOptIn=false | true
```

Generic deployment metadata is not a reliable authority for deployment-scoped runtime behavior.

The corrected responsibility is:

- metadata proves deployment identity, source, READY state, project ownership, immutable host, and Production disconnection;
- the control probe proves shadow execution is absent;
- the canary probe proves shadow execution is present;
- runtime telemetry proves the actual policy mode and mutation invariants.

### 5.4 Replace adapter v1 with an exact read-only capability contract

Proposed contract:

```js
{
  contract: {
    schemaVersion: "candidate-exposure-policy-read-only-hosted-adapter-v2",
    deploymentMutationAllowed: false,
    environmentReadAllowed: false,
    environmentMutationAllowed: false,
    runtimeLogReadAllowed: false,
    bypassMutationAllowed: false,
    productionAllowed: false,
    automaticRetryAllowed: false,
    maxDeploymentMetadataReads: 2,
    maxAnalyzeRequests: 16,
    perRequestTimeoutMs: 90000,
    maxResponseBytes: 2097152
  },
  getDeploymentMetadata(deploymentId),
  probeAnalyze(entry),
  cleanup(context)
}
```

Exact contract keys are required. Unknown keys fail closed.

## 6. Deployment metadata capability

### 6.1 Allowed operation

The implementation may perform only an exact deployment-by-ID read equivalent to:

```text
GET deployment metadata for controlDeploymentId
GET deployment metadata for canaryDeploymentId
```

Total metadata reads: exactly two maximum.

### 6.2 Forbidden operation

The implementation must not:

- list deployments;
- select a newest deployment;
- resolve by branch alone;
- fetch project environment values;
- fetch branch environment values;
- create, redeploy, promote, cancel, delete, or alias a deployment;
- inspect Production deployment state beyond rejecting an exact deployment that is Production-linked;
- query logs during the normal pass path.

### 6.3 Minimal injected capability

A generic Vercel client is prohibited.

The adapter implementation receives only:

```js
{
  getDeploymentById: async (deploymentId) => rawMetadata
}
```

The injected object must expose no other methods.

Static verification must reject source containing write-capable Vercel calls, CLI subprocess execution, generic `vercel api`, or generic SDK instances.

### 6.4 Source SHA normalization

The raw provider response may expose source SHA in more than one location.

The normalizer must:

1. inspect only an exact allowlist of known source-SHA fields;
2. accept one unique 40-character lowercase SHA;
3. fail if no SHA is present;
4. fail if multiple populated fields disagree;
5. compare the normalized SHA to `approvedSourceSha`;
6. retain only the boolean match and SHA in memory;
7. omit raw metadata from evidence.

### 6.5 Immutable host normalization

The host must be derived from deployment metadata, never supplied independently by the caller.

Required host properties:

- HTTPS only;
- hostname only, no username or password;
- default port only;
- no query or fragment;
- Vercel immutable deployment hostname;
- exact metadata-derived value;
- not equal to a Production/custom alias;
- not redirected before the diagnostic route responds.

The full host is memory-only and forbidden in repository evidence.

### 6.6 Normalized metadata output

```js
{
  schemaVersion: "candidate-exposure-policy-read-only-deployment-metadata-v1",
  deploymentId,
  environmentClass: "preview",
  approvedSourceShaMatch: true,
  ready: true,
  projectIdentityMatch: true,
  teamIdentityMatch: true,
  immutableHostPresent: true,
  productionTarget: false,
  productionAliasPresent: false,
  sourceMetadataConflict: false
}
```

No URL, project ID, team ID, branch name, token, environment key, or raw metadata is serialized.

## 7. Diagnostic probe transport

### 7.1 Request authority

The probe transport accepts only a matrix entry generated by the Stage 11G runner.

It must reject caller-supplied arbitrary:

- URL;
- path;
- method;
- headers;
- body;
- locale;
- scenario;
- deployment ID;
- retry count.

### 7.2 Request construction

The transport constructs exactly:

```text
POST https://<metadata-derived-immutable-host>/api/analyze
```

The body is built only from the approved Stage 11F synthetic fixture and the matrix locale.

Requirements:

- exactly one request per matrix entry;
- sequential execution;
- no warm-up request;
- no HEAD request;
- no quota probe;
- no automatic retry;
- redirect mode is manual;
- every 3xx response fails closed;
- per-request timeout is 90 seconds;
- response body cap is 2 MiB;
- content type must be the expected JSON type;
- no cookie jar;
- no `Cookie` header;
- any `Set-Cookie` header is counted and discarded, never replayed;
- no browser session or persistent HTTP agent state shared with user traffic.

### 7.3 Protection access material

The adapter does not create or revoke protection bypass material.

Optional approved access material is supplied through a memory-only provider:

```js
getAccessMaterial({ deploymentId, approvalIdHash })
```

The provider returns either:

```js
{ mode: "none" }
```

or an opaque header map constrained by an exact allowlist established during implementation review.

Rules:

- values are never logged, serialized, hashed into evidence, or written to disk;
- material is scoped to the two exact deployment IDs;
- material expires no later than the execution grant;
- the adapter cannot refresh it;
- an authentication failure stops the run without requesting new material;
- cleanup releases in-memory references only;
- bypass created/revoked evidence counts remain zero for this adapter.

### 7.4 Probe response authority

The adapter extracts only the approved diagnostic envelope needed by Stage 11G:

```text
HTTP status
exact source-SHA match
final diagnostic stage reached
shadow execution boolean
aggregate CandidateExposurePolicy telemetry
response fingerprint match
snapshot fingerprint match
candidate-order match
unexpected divergence count
unclassified divergence count
shadow exception count
fallback count
invalid context count
candidate-level telemetry incident boolean
Production/project configuration change boolean
```

It must not retain or expose:

- full response body;
- generated explanation text;
- candidate references;
- product data;
- raw Provider output;
- cookies;
- session identifiers;
- report identifiers;
- request headers;
- deployment hostname.

If the diagnostic envelope is absent, ambiguous, malformed, duplicated, or conflicts with the matrix entry, the result is `evidenceSerializationFailure`.

### 7.5 Control and canary proof

Control entry:

```text
shadowExecution=false
projectionFingerprintPresent=false
```

Canary entry:

```text
shadowExecution=true
responseFingerprintMatch=true
snapshotFingerprintMatch=true
candidateOrderMatch=true
projectionFingerprintPresent=true
```

The control/canary distinction is proven per request, not inferred from Vercel metadata.

## 8. Runtime logs

Runtime log access is excluded from the normal adapter.

Reasons:

- logs may contain unrelated concurrent traffic;
- deployment logs are not required when the response diagnostic envelope is complete;
- log streaming increases runtime, privacy, and Actions cost;
- log data may include unapproved fields.

A later failure-diagnostics stage may design a separate aggregate-only log adapter, but it requires new user approval and cannot run automatically after a failed probe.

## 9. Cleanup contract

The read-only adapter creates no Vercel resource.

Cleanup is local only:

- abort pending request controllers;
- release access-material references;
- zero mutable in-memory header buffers when possible;
- remove adapter-created temporary files, if any;
- close local response streams;
- prove cookie jar count zero;
- prove deployment mutation count zero;
- prove environment read and mutation counts zero;
- prove runtime log read count zero;
- prove Production operation count zero.

Normalized cleanup result:

```js
{
  temporaryBypassCreatedCount: 0,
  temporaryBypassRevokedCount: 0,
  temporaryFileResidue: 0,
  cookieJarEntryCount: 0,
  deploymentMetadataReadCount: 2,
  environmentReadCount: 0,
  projectEnvironmentMutationCount: 0,
  branchEnvironmentMutationCount: 0,
  runtimeLogReadCount: 0,
  deploymentMutationCount: 0,
  productionChangeCount: 0
}
```

Cleanup failure cannot coexist with PASS.

## 10. Cost and execution budget

```text
GitHub Actions default runs: 0
GitHub Actions authorized runs: maximum 1
Vercel deployment operations inside adapter: 0
Deployment metadata reads: maximum 2
Analyze requests: maximum 16
Warm-up requests: 0
Quota probes: 0
Automatic retries: 0
Runtime-log reads: 0
Environment reads: 0
Maximum execution time: 30 minutes
Artifact retention, if Actions is approved: 1 day
```

The preferred execution environment remains local. GitHub Actions requires separate approval and `workflow_dispatch` only.

## 11. Implementation file boundary

Expected Stage 11I files:

```text
lib/candidate-exposure-policy-read-only-hosted-adapter-contract.js
lib/candidate-exposure-policy-read-only-hosted-adapter.js
scripts/check-candidate-exposure-policy-read-only-hosted-adapter.mjs
scripts/candidate-exposure-policy-hosted-execution.mjs
lib/candidate-exposure-policy-hosted-execution-contract.js
lib/candidate-exposure-policy-hosted-execution.js
```

Allowed changes to existing Stage 11G files are limited to:

- execution grant v2 validation;
- adapter v2 exact contract;
- Preview metadata normalization;
- removal of metadata-level `shadowOptIn` authority;
- expanded local cleanup counters;
- explicit adapter injection into the still-disabled CLI path.

Forbidden changes:

```text
app/**
components/**
Supabase schema or migrations
package or lockfile unless independently approved
CandidateExposurePolicy runtime behavior
recommendation assembly
response schema
storage schema
UI
Vercel workflow
Production configuration
```

## 12. Static and contract verification requirements

Stage 11I must provide local tests for:

1. `target=null` valid Preview with all other proofs present;
2. `target=production` rejection;
3. Production alias rejection;
4. conflicting source SHA fields rejection;
5. missing source SHA rejection;
6. wrong project or team identity rejection;
7. latest-deployment discovery prohibition;
8. generic Vercel SDK injection rejection;
9. write-capable method rejection, including hidden nested capability objects;
10. arbitrary URL rejection;
11. non-HTTPS host rejection;
12. custom/Production alias rejection;
13. redirect rejection;
14. timeout and body-size cap;
15. no-retry proof;
16. no-cookie-jar proof;
17. `Set-Cookie` discard proof;
18. missing diagnostic envelope rejection;
19. control shadow execution rejection;
20. canary non-execution rejection;
21. fixture fingerprint mismatch rejection;
22. aggregate telemetry exact schema;
23. access material non-serialization;
24. local cleanup residue zero;
25. exact 2 metadata reads and 16 probe calls;
26. environment/log/deployment/Production operation counts zero.

No Hosted request is required to validate the adapter implementation stage.

## 13. Independent design review

### Critical 1 — Preview target representation

Finding:

- the Stage 11G metadata contract required `target="preview"`;
- retained exact Preview evidence recorded `target=null`.

Resolution:

- environment classification now uses READY, exact project/team identity, exact source SHA, non-Production target, immutable host, and no Production alias;
- null target is permitted only when every other Preview proof passes.

Status: resolved.

### Critical 2 — shadow mode inferred from control-plane metadata

Finding:

- generic deployment metadata cannot reliably prove deployment-scoped shadow execution.

Resolution:

- metadata proves identity and safety only;
- each control/canary probe proves actual execution mode;
- mutation and projection fingerprints remain runtime evidence.

Status: resolved.

### Critical 3 — read-only adapter inherited mutation authority

Finding:

- approval v1 included manual provisioning and temporary bypass mutation;
- passing it directly to the adapter would over-authorize the adapter.

Resolution:

- introduce execution grant v2 with metadata read, probe, memory-only access use, and local cleanup only;
- provisioning and bypass mutation remain separate operator responsibilities.

Status: resolved.

### Important 1 — top-level method blacklist is insufficient

Finding:

- a generic SDK or closure could retain write-capable operations without exposing a forbidden top-level adapter method.

Resolution:

- inject a minimal `getDeploymentById` capability rather than a generic client;
- static verification rejects generic SDK construction and command execution;
- adapter contract keys are exact.

Status: resolved.

### Important 2 — arbitrary URL and redirect escape

Finding:

- accepting a URL independently from deployment metadata could redirect probes to Production or an unrelated host.

Resolution:

- host derives only from exact deployment metadata;
- redirect mode is manual and every redirect is rejected;
- custom and Production aliases are prohibited.

Status: resolved.

### Important 3 — protection cleanup conflicts with read-only control plane

Finding:

- creating and revoking bypass material would make the adapter mutating.

Resolution:

- the adapter consumes optional pre-authorized access material in memory only;
- it cannot create, refresh, or revoke it;
- bypass created and revoked counts are both zero.

Status: resolved.

### Important 4 — log access may leak unrelated traffic

Finding:

- deployment logs can include unrelated concurrent invocations and are not necessary for the normal pass path.

Resolution:

- log reads are zero and forbidden by adapter contract;
- any future log diagnostics require a separate stage and approval.

Status: resolved.

### Important 5 — cookies could accidentally create cross-request state

Finding:

- the analyzed route may emit `Set-Cookie` at its final stage;
- replaying cookies would make the matrix stateful.

Resolution:

- no cookie jar and no outgoing Cookie header;
- Set-Cookie values are discarded;
- only an aggregate count may remain in local diagnostics, not final evidence.

Status: resolved.

### Minor 1 — response-size and timeout bounds were unspecified

Resolution:

- 90-second per-request timeout;
- 2 MiB response cap;
- 30-minute total execution cap.

Status: resolved.

## 14. Review verdict

```text
Critical unresolved: 0
Important unresolved: 0
Blocking Minor unresolved: 0
```

Machine design status:

```text
design_ready_for_read_only_hosted_adapter_implementation_review
```

This status authorizes only a local implementation and implementation review of the adapter boundary.

It does not authorize:

- Preview provisioning;
- bypass creation or revocation;
- `/api/analyze` execution;
- Vercel deployment operations;
- runtime log access;
- GitHub Actions execution;
- runtime activation;
- public traffic;
- Production activation.

## 15. Final markers

```text
CANDIDATE_EXPOSURE_POLICY_READ_ONLY_HOSTED_ADAPTER_DESIGN_PASS
READ_ONLY_CONTROL_PLANE_BOUNDARY_DEFINED
EXECUTION_GRANT_V2_REQUIRED
TARGET_NULL_PREVIEW_COMPATIBILITY_DEFINED
SHADOW_MODE_PROVEN_BY_RUNTIME_PROBE
GENERIC_VERCEL_CLIENT_PROHIBITED
DEPLOYMENT_MUTATION_NOT_AUTHORIZED
BYPASS_MUTATION_NOT_AUTHORIZED
RUNTIME_LOG_READ_NOT_AUTHORIZED
EXACT_TWO_METADATA_READ_BUDGET
EXACT_SIXTEEN_PROBE_BUDGET
AUTOMATIC_RETRY_PROHIBITED
COOKIE_JAR_PROHIBITED
ADAPTER_IMPLEMENTATION_NOT_STARTED
HOSTED_REQUEST_NOT_RUN
GITHUB_ACTIONS_NOT_USED
RUNTIME_FILTER_NOT_CONNECTED
PUBLIC_TRAFFIC_NOT_AUTHORIZED
PRODUCTION_NOT_CHANGED
PR_REMAINS_DRAFT
```
