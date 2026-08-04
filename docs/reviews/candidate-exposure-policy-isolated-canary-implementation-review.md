# CandidateExposurePolicy Isolated Canary Implementation Review

## 1. Scope

Stage 11F implements the approved isolated canary design as a local `validate-only` harness.

Included:

- pure control state machine;
- immutable isolated candidate projection;
- aggregate-only telemetry;
- implementation-readiness evidence;
- four deterministic synthetic fixtures;
- exact 16-entry KO/EN control/canary matrix;
- recursive runtime import-closure attestation;
- implementation path allowlist;
- contract and import-boundary verifiers.

Not included:

- Vercel deployment or API access;
- `/api/analyze` HTTP calls;
- protection bypass or secret access;
- Hosted execution mode;
- runtime candidate filtering;
- recommendation, response, persistence, or UI mutation;
- public Preview traffic;
- project environment or Production changes.

## 2. Independent design review resolutions

Two ambiguities were resolved before implementation:

1. `reasonCodeCounts` remains available only in the in-memory projection and deterministic fingerprint input. It is rejected from serialized telemetry and readiness evidence.
2. Stage 11F emits a separate implementation-readiness evidence schema. Deployment IDs, HTTP results, Hosted cleanup, and Hosted PASS evidence remain future-stage responsibilities.

The Stage 11E machine telemetry allowlist remains authoritative.

## 3. Architecture review

### Control

The exact states are:

```text
disabled
eligible
running
stopped
completed
invalid_configuration
```

Execution is eligible only when design status and SHA, runtime SHA and byte attestation, implementation path scope, exact request budget, duration ceiling, exact stop-condition map, `validate-only` mode, and all non-activation permissions are valid.

Terminal states cannot resume or increment the matrix count.

### Projection

Projection input is reduced to:

```js
{
  candidateRef: string,
  sourceIndex: number
}
```

Duplicate references, non-contiguous indices, count mismatch, order mismatch, and invalid CandidateExposurePolicy decisions are rejected. Exposure, lane, and reason vocabularies come from the existing production policy contract.

Candidate references and ordered vectors remain under `memoryOnly` and never enter serialized telemetry or readiness evidence.

### Telemetry

The telemetry schema uses the exact Stage 11E aggregate allowlist. It rejects unknown or missing fields, invalid count-map keys, negative or inconsistent totals, contradictory execution states, candidate/product/user/session/report identifiers, tokens and secrets, raw payloads, provider content, ordered vectors, and `reasonCodeCounts`.

Control entries use `validate_only_control_disabled`. Canary entries use `validate_only_simulation`; they are not represented as Hosted observations.

### Readiness evidence

The readiness evidence proves implementation properties only:

- runtime closure attestation;
- implementation scope;
- exact matrix construction;
- valid aggregate telemetry;
- zero divergence, exception, fallback, invalid context, and mutation mismatch;
- zero network, Hosted, Production, and temporary-resource residue;
- all activation authorizations remain false.

Hosted-only fields such as deployment IDs, HTTP counts, URLs, and bypass secrets are forbidden.

## 4. Fixture review

The manifest contains exactly four synthetic scenarios:

- `standard_goal_alignment`;
- `stabilization_active_block`;
- `current_product_semantics`;
- `metadata_incomplete`.

Each scenario contains a deterministic canonical state, two synthetic candidates, expected policy reasons, and no real user data. The runner replays every scenario in KO and EN with control and canary entries, producing exactly 16 entries.

## 5. Runtime authority review

Product runtime authority:

```text
1bc119347a2f8d3387a935163e24849ceebe349d
```

Stage 11E design base:

```text
d82f097ac49bf3d2fbfe68b0ee57b1f07c55953a
```

The checks remain separate:

- implementation scope compares Stage 11F changes with the design base;
- runtime integrity recursively compares the product runtime import closure byte-for-byte with the runtime authority SHA.

## 6. Findings and corrections

### Important — baseline newline loss

The first attestation implementation trimmed `git show` output and could falsely report a final-newline difference. Baseline file content now uses an untrimmed Git path and compares UTF-8 bytes without normalization.

### Important — static guard self-match

The first import-boundary verifier scanned its own forbidden-pattern definitions. Operational-pattern scans now apply only to implementation modules and the runner; verifier source is excluded from literal self-scanning.

### Important — route path versus network call

The first final run treated the runtime attestation path `app/api/analyze/route.js` as an HTTP call because it rejected the generic `/api/analyze` substring.

The corrected guard permits repository route paths while directly rejecting network-capable constructs: `fetch`, Axios, Node HTTP requests, XHR, WebSocket, Undici, external URLs, Vercel deployment, tokens, and bypass material.

### Important — exact branch HEAD authority

The second run checked out GitHub's synthetic PR merge commit, so the readiness artifact identified the merge SHA rather than the Stage 11F branch SHA.

The final workflow explicitly checked out `${{ github.event.pull_request.head.sha }}`. The authoritative artifact therefore records:

```text
ebc16f9f166ccdefc86de777cf75836eca4af595
```

### Important — Stage 10 verifier baseline

The second run omitted the local Stage 10 ref required by the existing Stage 11A verifier. The final workflow explicitly fetched `codex/stage10-hosted-preview-user-flow` before the security suite. No verifier contract was weakened.

### Important — implementation and Hosted evidence separation

Stage 11F uses `candidate-exposure-policy-isolated-canary-implementation-readiness-v1`. Deployment, HTTP, bypass, and Hosted cleanup fields are forbidden. The ready status is `implementation_ready_for_hosted_execution_review`, not a Hosted PASS.

### Important — serialized reason-count expansion

Reason counts remain in memory for deterministic projection checks and fingerprints. Serialized telemetry rejects `reasonCodeCounts`.

### Minor — evidence privacy vocabulary

Both `brand` and `brandId` normalized keys are forbidden.

### Minor — invalid finalization shape

Invalid finalization changes only the existing status to `evidence_invalid`; it does not append non-schema validation fields.

## 7. Final static boundary

The final verifier confirms:

- no `app/**`, `components/**`, selected production `lib/**`, package, lockfile, or Supabase path changes;
- no product module imports a Stage 11F harness module;
- implementation modules contain no network-capable client, external URL, Vercel token, bypass, deployment, workflow-dispatch, or Production-deploy operation;
- the runner may reference `app/api/analyze/route.js` only as a local runtime-attestation root;
- only the attestation runner uses `node:child_process`;
- runner mode is exactly `validate-only`, with no hosted or deploy option.

## 8. Validation history

### Run `30722395069`

- contract verifier: PASS;
- import boundary: failed on an over-broad `/api/analyze` substring rule;
- later stages skipped;
- no Hosted or Production operation occurred.

### Run `30722443126`

- Stage 11F contract: PASS;
- import boundary: PASS;
- validate-only runner: PASS;
- security closeout: 59/60 because the workflow did not fetch the existing Stage 10 local verifier ref;
- architecture and build skipped;
- runner evidence identified the PR merge SHA, exposing the checkout-authority issue;
- no Hosted or Production operation occurred.

### Authoritative run `30722550071`

Exact Stage 11F branch HEAD:

```text
ebc16f9f166ccdefc86de777cf75836eca4af595
```

Results:

- contract verifier: 129 assertions PASS;
- import boundary: 597 assertions PASS;
- changed Stage 11F paths: 11, all allowed;
- product files scanned: 102;
- security closeout: 60/60 PASS;
- architecture guard: PASS;
- Production build: PASS;
- validate-only runner: PASS;
- diff hygiene: PASS;
- readiness artifact uploaded and retained for one day.

Readiness evidence:

- runtime closure files: 16;
- changed runtime files: 0;
- completed entries: 16/16;
- control entries: 8;
- canary entries: 8;
- telemetry records valid: 16/16;
- unexpected divergence: 0;
- unclassified divergence: 0;
- shadow exception: 0;
- fallback: 0;
- invalid context: 0;
- mutation mismatch: 0;
- network operations: 0;
- Hosted operations: 0;
- Production changes: 0.

## 9. Final review result

```text
Critical unresolved: 0
Important unresolved: 0
Blocking Minor unresolved: 0
```

Final machine status:

```text
implementation_ready_for_hosted_execution_review
```

This status does not authorize Hosted execution or runtime activation.

## 10. Authorization boundary

```text
harnessImplemented=true
hostedExecutionImplemented=false
hostedExecutionAuthorized=false
runtimeActivationAuthorized=false
runtimeFilterConnectionAuthorized=false
recommendationMutationAuthorized=false
responseMutationAuthorized=false
storageMutationAuthorized=false
uiMutationAuthorized=false
publicTrafficAuthorized=false
projectEnvironmentMutationAuthorized=false
productionActivationAuthorized=false
```

## 11. Final markers

```text
STAGE_11F_VALIDATE_ONLY_HARNESS_IMPLEMENTATION_PASS
IMPLEMENTATION_READY_FOR_HOSTED_EXECUTION_REVIEW
EXACT_16_ENTRY_MATRIX_PASS
RUNTIME_CLOSURE_UNCHANGED
AGGREGATE_TELEMETRY_ONLY
NETWORK_OPERATION_ZERO
HOSTED_OPERATION_ZERO
RUNTIME_FILTER_NOT_CONNECTED
PRODUCTION_NOT_CHANGED
PR_REMAINS_DRAFT
```
