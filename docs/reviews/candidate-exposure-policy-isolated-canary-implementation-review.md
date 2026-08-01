# CandidateExposurePolicy Isolated Canary Implementation Review

## 1. Review scope

Stage 11F implements the previously approved isolated Preview canary harness as a local `validate-only` system.

The implementation includes:

- pure control state machine;
- immutable isolated candidate projection;
- aggregate-only telemetry;
- implementation-readiness evidence;
- four deterministic synthetic fixtures;
- exact 16-entry KO/EN control/canary matrix;
- recursive runtime import-closure attestation;
- implementation path allowlist;
- contract and import-boundary verifiers.

The implementation does not include:

- Vercel deployment or API access;
- `/api/analyze` HTTP calls;
- protection bypass or secret access;
- Hosted execution mode;
- runtime candidate filtering;
- recommendation, response, snapshot, persistence, or UI mutation;
- public Preview traffic;
- project environment or Production changes.

## 2. Independent design review resolutions

Two ambiguities were resolved before implementation:

1. `reasonCodeCounts` remains available only in the in-memory projection and deterministic fingerprint input. It is rejected from serialized telemetry and implementation-readiness evidence.
2. Stage 11F emits a separate implementation-readiness evidence schema. Future deployment IDs, HTTP results, Hosted cleanup, and Hosted PASS evidence remain Stage 11G responsibilities.

The Stage 11E machine telemetry allowlist remains authoritative.

## 3. Architecture review

### 3.1 Control

The control module implements the exact states:

```text
disabled
eligible
running
stopped
completed
invalid_configuration
```

Execution is authorized only when all of the following are true:

- Stage 11E design status is ready;
- exact design-base SHA matches;
- exact runtime SHA matches;
- recursive runtime attestation passes;
- implementation path scope passes;
- mode is exactly `validate-only`;
- request budget is exactly 16;
- duration ceiling is at most 60 minutes;
- stop-condition map has the exact key set and all values are true;
- network, Hosted, and Production permissions are false.

Terminal states cannot resume or increment request counts.

### 3.2 Projection

The projection accepts only reduced descriptors:

```js
{
  candidateRef: string,
  sourceIndex: number
}
```

It rejects duplicate references, non-contiguous indices, count mismatch, order mismatch, and invalid CandidateExposurePolicy decisions. It reuses the production policy contract rather than duplicating exposure, lane, or reason vocabularies.

Candidate references and ordered vectors remain under `memoryOnly`. Telemetry and readiness evidence do not accept them.

### 3.3 Telemetry

The telemetry schema uses the exact Stage 11E aggregate allowlist. It rejects:

- unknown or missing fields;
- invalid exposure, lane, or divergence key sets;
- negative counts and total mismatches;
- contradictory execution states;
- candidate, product, user, session, report, token, secret, raw request/response, provider, ordered-vector, and reason-count fields.

Control entries explicitly report `validate_only_control_disabled`. Canary entries explicitly report `validate_only_simulation`; they are not represented as Hosted observations.

### 3.4 Readiness evidence

The readiness evidence proves only implementation properties:

- runtime closure attestation;
- implementation scope;
- exact matrix;
- valid aggregate telemetry;
- zero divergence, exception, fallback, invalid context, or mutation mismatch;
- zero network, Hosted, Production, and temporary-resource residue;
- all activation authorizations remain false.

It rejects Hosted-only fields such as deployment IDs, HTTP counts, deployment URLs, and bypass secrets.

## 4. Fixture review

The manifest contains exactly four synthetic scenarios:

- `standard_goal_alignment`;
- `stabilization_active_block`;
- `current_product_semantics`;
- `metadata_incomplete`.

Each scenario has a deterministic canonical state, two synthetic candidates, expected policy reasons, and no real user data. The runner replays each scenario in KO and EN using control and canary entries for an exact total of 16.

The fixture semantic fingerprint excludes locale text generation because Stage 11F performs no provider call. KO and EN therefore share the same structural fixture semantics while retaining distinct matrix locale entries.

## 5. Runtime attestation review

The runner recursively follows relative local imports from the contracted runtime roots and compares current file bytes against runtime SHA:

```text
1bc119347a2f8d3387a935163e24849ceebe349d
```

The implementation path check independently compares Stage 11F HEAD against design base:

```text
d82f097ac49bf3d2fbfe68b0ee57b1f07c55953a
```

These checks answer different questions:

- implementation scope: only approved Stage 11F files changed;
- runtime integrity: product runtime import closure remains byte-identical.

## 6. Findings and corrections

### Important 1 — baseline newline loss

Initial attestation reused a trimmed Git command helper for `git show`. A final newline in a runtime file could therefore create a false byte mismatch.

Correction:

- general Git metadata output remains trimmed;
- baseline file content uses an untrimmed path;
- current and baseline UTF-8 bytes are compared without normalization.

### Important 2 — static guard self-match

The initial import-boundary verifier applied forbidden literal checks to its own source. The verifier necessarily contains strings such as `workflow_dispatch` and Vercel-related forbidden patterns as test definitions, which could cause a false positive.

Correction:

- forbidden operational-pattern scans apply only to implementation modules and the runner;
- verifier source is excluded from literal self-scanning;
- product import scans and changed-path allowlists still cover all relevant files.

### Important 3 — implementation and Hosted evidence conflation

The design contained future Hosted evidence fields that Stage 11F cannot truthfully populate.

Correction:

- Stage 11F uses `candidate-exposure-policy-isolated-canary-implementation-readiness-v1`;
- deployment, HTTP, bypass, and Hosted cleanup fields are forbidden;
- ready status is `implementation_ready_for_hosted_execution_review` rather than a Hosted PASS.

### Important 4 — serialized reason-count expansion

The implementation design proposed reason counts in telemetry although the approved Stage 11E machine allowlist did not.

Correction:

- reason counts remain in memory for deterministic local checks and projection fingerprints;
- serialized telemetry explicitly rejects `reasonCodeCounts`.

### Minor 1 — evidence privacy vocabulary

The readiness evidence forbidden-key vocabulary originally covered `brandId` but not the plain `brand` key.

Correction:

- both normalized forms are forbidden.

### Minor 2 — invalid finalization shape

The first finalizer draft added `validationErrors` to an invalid evidence object, producing a shape outside the exact schema.

Correction:

- invalid finalization changes only the existing `status` field to `evidence_invalid`;
- detailed validation errors remain return-time diagnostics and are never serialized as evidence.

## 7. Static boundary review

The import-boundary verifier confirms:

- no `app/**`, `components/**`, selected production `lib/**`, package, lockfile, or Supabase path changes;
- no product module imports a Stage 11F harness module;
- implementation modules contain no `fetch`, external URL, Vercel token, bypass, deployment, `/api/analyze`, workflow-dispatch, or Production-deploy operation;
- only the attestation runner uses `node:child_process`;
- runner mode is `validate-only` and exposes no hosted or deploy option.

## 8. Pre-verification review result

```text
Critical unresolved: 0
Important unresolved: 0
Blocking Minor unresolved: 0
```

The implementation is ready for one final authoritative validation run. This review does not claim that run has passed yet.

## 9. Authorization boundary

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

## 10. Pre-verification markers

```text
STAGE_11F_IMPLEMENTATION_REVIEW_COMPLETE
FINAL_VALIDATION_PENDING
HOSTED_EXECUTION_NOT_IMPLEMENTED
RUNTIME_FILTER_NOT_CONNECTED
PRODUCTION_NOT_CHANGED
PR_REMAINS_DRAFT
```
