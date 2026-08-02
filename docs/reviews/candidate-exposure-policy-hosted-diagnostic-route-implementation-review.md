# CandidateExposurePolicy Hosted Diagnostic Route Implementation Review

## Scope

Stage 11K implements and reviews the temporary Preview-only synthetic diagnostic route designed in Stage 11J.

Design base:

```text
branch: codex/candidate-exposure-policy-synthetic-diagnostic-route-design
head: 1aa3617a641a1650df2901346ccabcee32c95414
Draft PR: #119
```

Implementation allowlist:

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

No product route, UI, dependency, Vercel configuration, workflow, database, or Production file is in scope.

## Implemented boundary

The implementation adds:

- `POST /api/internal/candidate-exposure-policy-diagnostic`;
- Preview-only and Node production-runtime hard-disable checks;
- exact Hosted source SHA, system deployment ID, and execution-grant digest binding;
- HMAC-SHA-256 request authentication with timing-safe comparison;
- 8 KiB streaming request cap and 64 KiB response cap;
- strict flat JSON parsing with duplicate-key rejection;
- internal Stage 11F fixture lookup by scenario only;
- control evaluator call count zero;
- canary evaluator call count one;
- aggregate-only response validation;
- no cookies, logs, database, storage, Provider, external network, or user data;
- adapter and runner renaming from analyze terminology to CandidatePolicy diagnostic terminology;
- Hosted diagnostic plan v2 evidence mapping.

## Independent implementation review

### Critical 1 — project bypass secret did not independently prove the approved execution grant

Finding:

- the Stage 11J design used the project-wide Vercel automation bypass secret as both transport access and HMAC key;
- signing a caller-provided grant digest with the same project-scoped secret did not make that digest an independently trusted route authority.

Resolution:

- require the Vercel system `VERCEL_DEPLOYMENT_ID` and exact request deployment ID to match;
- require a non-secret, deployment-scoped `CANDIDATE_EXPOSURE_POLICY_DIAGNOSTIC_GRANT_DIGEST` and exact request grant digest to match;
- retain HMAC for request integrity and possession proof;
- retain the runner's execution-grant validation as the approval authority;
- do not create or change either Preview deployment or environment configuration in Stage 11K.

Status: resolved in code. Future manual Preview provisioning must supply the exact approved grant digest to both exact-SHA deployments.

### Important 1 — request deployment ID was only echoed

Finding:

- hashing a signed request deployment ID proves correlation but not the runtime deployment identity by itself.

Resolution:

- bind the request deployment ID to Vercel's runtime `VERCEL_DEPLOYMENT_ID` before policy execution;
- retain the adapter's read-only deployment metadata-to-host verification as the external identity proof.

Status: resolved.

### Important 2 — raw diagnostic bytes remained live after transport

Finding:

- the adapter retained request and canonical-signature buffers until function return.

Resolution:

- zero both buffers in a `finally` block after the transport capability returns or fails;
- raw response bodies are normalized immediately and never enter final telemetry or evidence.

Status: resolved.

### Important 3 — route-provided runtime match could become false authority

Finding:

- a route boolean cannot attest recursive runtime bytes.

Resolution:

- the route aggregate contains no runtime implementation match field;
- the v2 runner validates the local runtime closure attestation first;
- only then does it inject `runtimeImplementationShaMatch=true` into normalized Hosted telemetry.

Status: resolved.

### Important 4 — default-off evidence count was under-specified

Finding:

- the prior evidence builder counted only a default-off violation rather than successful control entries.

Resolution:

- `defaultOffExecutionCount` now counts the eight completed control records;
- completed PASS requires exactly eight control and eight canary records.

Status: resolved.

### Important 5 — analyze-oriented transport naming was misleading

Resolution:

```text
postAnalyzeDiagnostic → postCandidatePolicyDiagnostic
probeAnalyze → probeCandidatePolicyDiagnostic
analyzeRequestCount → diagnosticRequestCount
```

The adapter's active route contract points only to the temporary CandidatePolicy diagnostic path.

Status: resolved.

## Local verification

```text
JavaScript syntax checks: PASS
Hosted diagnostic route checker: PASS, 63 assertions
Hosted diagnostic execution checker: PASS, 107 assertions
Total Stage 11K assertions: 170
```

Verified properties include:

- environment rejection before body read;
- missing source SHA, deployment ID, grant digest, or signing key rejection;
- stale/future timestamp and invalid signature rejection;
- timing-safe signature comparison;
- duplicate JSON key, nested fixture, unknown field, matrix mismatch, source mismatch, deployment mismatch, and grant mismatch rejection;
- control evaluator call count zero;
- canary evaluator call count one;
- aggregate and response exact schemas;
- no Store/Set-Cookie/logging/browser state;
- target `null` and `preview` compatibility;
- Production target, alias, source conflict, project mismatch, and custom host rejection;
- exact two metadata reads and sixteen diagnostic POST simulations;
- control/canary 8/8;
- retry, environment read, runtime-log read, deployment mutation, bypass mutation, and Production change counts zero;
- final evidence uses `candidate-exposure-policy-hosted-diagnostic-plan-v2`.

The previously retained Stage 11F authoritative readiness evidence already records the unchanged product runtime closure and real policy fixture replay as:

```text
runtime closure files: 16
changed runtime files: 0
completed entries: 16/16
valid telemetry: 16/16
unexpected divergence: 0
unclassified divergence: 0
exception/fallback/invalid context/mutation mismatch: 0
```

Stage 11K does not modify that policy runtime closure.

## Verification limitation

The local Stage 11K workspace used interface-compatible mirrors for unchanged repository dependencies because the full repository could not be cloned into the execution container.

Therefore the following remain pending until a separately approved final validation point on the exact repository HEAD:

```text
full-repository Stage 11K checker execution
Next.js production build
existing security-closeout suite
architecture guard
exact import-closure verifier against the complete checkout
```

This is a verification limitation, not authorization to run GitHub Actions or Vercel. No Hosted claim is made.

## Review verdict

```text
Critical code findings unresolved: 0
Important code findings unresolved: 0
Blocking Minor code findings unresolved: 0
Full repository validation pending: true
```

Machine status:

```text
temporary_synthetic_diagnostic_route_implemented_local_contract_pass_repository_validation_pending
```

## Authorization

```text
route implementation complete: true
Preview provisioning authorized: false
Hosted metadata read authorized: false
Hosted diagnostic execution authorized: false
Vercel deploy/redeploy/promote authorized: false
GitHub Actions authorized: false
/api/analyze modification authorized: false
runtime activation authorized: false
public traffic authorized: false
Production activation authorized: false
```

The temporary route and route-only modules must be removed and their absence verified before integration toward `main`.
