# CandidateExposurePolicy Isolated Preview Canary Harness Design v1

## 1. Purpose and stage boundary

Stage 11E is a design-only and review-only stage. It converts the Stage 11D `plan_ready` result into a complete implementation contract for a future Stage 11F isolated Preview canary harness.

Stage 11E does not implement or execute the harness. It does not deploy a Preview, call `/api/analyze`, create a protection bypass, use a Vercel secret, change a project environment, or modify Production.

The design result can authorize only an implementation review. It cannot authorize runtime activation, recommendation filtering, response mutation, storage mutation, UI mutation, public traffic, or Production activation.

## 2. Source authority

Stage 11D plan branch:

```text
codex/candidate-exposure-policy-limited-preview-canary-plan
```

Stage 11D plan result:

```text
plan_ready
```

Hosted product-runtime implementation SHA retained from Stage 11C:

```text
1bc119347a2f8d3387a935163e24849ceebe349d
```

Stage 11F will necessarily have a different harness implementation commit because the runner and isolated projection files do not yet exist at the product-runtime SHA. The design therefore separates two authorities:

- `runtimeImplementationSha`: the exact SHA deployed for control and canary Hosted requests;
- `harnessImplementationSha`: the Stage 11F head resolved when the future harness runs.

The harness head is allowed to add only harness and verification files. Before execution it must prove that every runtime-sensitive product file has the same content as `runtimeImplementationSha` through both a path-diff check and a content-digest attestation.

If any runtime-sensitive file differs, the harness stops before deployment or analyze calls. A runtime change requires a new Stage 11C exact-SHA evaluation rather than silent reuse of the old evidence.

## 3. Architecture

The harness is runner-driven and has two isolated evidence lanes.

```text
Stage 11F runner
    |
    +-- Hosted invariance lane
    |       |
    |       +-- exact runtime SHA default-off Preview
    |       +-- exact runtime SHA deployment-scoped canary Preview
    |       +-- KO/EN × four scenarios × control/canary
    |       +-- response/snapshot/order mutation checks
    |       +-- existing aggregate shadow telemetry
    |
    +-- Deterministic projection replay lane
            |
            +-- Stage 11F harness head
            +-- runtime-sensitive module digest attestation against runtime SHA
            +-- synthetic canonical fixture state
            +-- CandidateExposurePolicy read-only execution
            +-- isolated candidate projection
            +-- aggregate counts and projection fingerprint only
```

The lanes are correlated only through a fixture semantic fingerprint containing the scenario and locale-independent fixture semantics. Hosted responses do not expose CandidateExposurePolicy decisions, and the projection replay does not use user images, accounts, sessions, reports, or provider output.

This split avoids importing canary code into the product route. The runner imports existing read-only policy modules; the recommendation runtime, response builder, storage layer, and UI never import the harness.

## 4. Control state machine

Allowed states:

```text
disabled
eligible
running
stopped
completed
invalid_configuration
```

Allowed transitions:

```text
disabled -> eligible
eligible -> running
running -> completed
running -> stopped
disabled -> invalid_configuration
eligible -> invalid_configuration
```

No transition leaves `stopped`, `completed`, or `invalid_configuration` within the same run.

### 4.1 `disabled`

Initial state. The harness has not established authority to execute.

### 4.2 `eligible`

Reached only when all of the following pass:

- Stage 11D evidence status is `plan_ready`;
- runtime implementation SHA matches the plan;
- both deployments are Preview deployments built from the same runtime SHA;
- the canary opt-in is deployment-scoped;
- Production and project-wide environment state are unchanged;
- the Stage 11F head is known;
- runtime-sensitive path diff and content digests match the runtime SHA;
- request and duration budgets are valid;
- exact stop-condition keys are present;
- fixture contracts and telemetry schemas validate.

### 4.3 `running`

The runner is executing the fixed 16-request matrix and deterministic projection replay. No dynamic request generation is permitted.

### 4.4 `stopped`

A stop condition occurred. No remaining analyze request or retry is executed. Cleanup still runs in `finally`.

### 4.5 `completed`

All 16 planned requests, projection replays, telemetry validations, mutation checks, evidence validation, and cleanup checks passed.

### 4.6 `invalid_configuration`

The configuration, evidence, SHA authority, fixture contract, telemetry schema, or stop-condition map was invalid before execution. No analyze request is sent.

## 5. Exact request matrix

The order is deterministic:

1. KO / standard goal alignment / control
2. KO / standard goal alignment / canary
3. KO / stabilization active block / control
4. KO / stabilization active block / canary
5. KO / current-product semantics / control
6. KO / current-product semantics / canary
7. KO / metadata incomplete / control
8. KO / metadata incomplete / canary
9. EN / standard goal alignment / control
10. EN / standard goal alignment / canary
11. EN / stabilization active block / control
12. EN / stabilization active block / canary
13. EN / current-product semantics / control
14. EN / current-product semantics / canary
15. EN / metadata incomplete / control
16. EN / metadata incomplete / canary

Budget:

```text
2 locales × 4 scenarios × 2 modes = 16 analyze requests
```

Maximum duration is 60 minutes. Warm-up requests, quota probes, automatic retries, exploratory requests, and organic Preview traffic are prohibited.

After any stop condition, every later matrix entry has `executeAfterStop=false`.

## 6. Fixture contracts

### 6.1 Standard goal alignment

Purpose: exercise canonical goal alignment without stabilization, current-product, or metadata hardening dominating the result.

Required conditions:

- plan mode is not `HOLD`;
- recommendation suppression is false;
- functional direction is evaluable;
- current-product findings are valid and non-blocking.

Expected aggregate reason categories include `canonical_goal_match` and, where relevant, `protection_maintained`.

### 6.2 Stabilization active block

Purpose: exercise stabilization and active-expansion restrictions.

Required conditions:

- plan mode is `HOLD`, recommendation suppression is true, or equivalent stabilization fallback applies;
- active candidates exist;
- active expansion is prohibited;
- canonical context remains valid.

Expected aggregate reason categories include `stabilization_active_block` and `expansion_prohibited`.

### 6.3 Current-product semantics

Purpose: exercise same-product, duplicate-axis, replacement-intent, usage-unknown, and missing-step semantics.

Required conditions:

- current-product findings are structurally valid;
- only synthetic selected or not-using relations are present;
- metadata remains evaluable.

Expected aggregate reason categories include `already_using`, `duplicate_axis`, `replacement_intent_unknown`, and `missing_step`.

### 6.4 Metadata incomplete

Purpose: exercise insufficient-evidence hardening without corrupting canonical context.

Required conditions:

- canonical context is valid;
- synthetic candidate metadata is incomplete;
- protection requirements remain explicit where applicable.

Expected aggregate reason categories include `metadata_incomplete` and `protection_evidence_incomplete`.

### 6.5 Data restrictions

All fixtures are synthetic or explicitly authorized diagnostic fixtures. The following are prohibited:

- real user images;
- real user product history;
- account, email, session, report, cookie, or token data;
- saved report payloads;
- raw provider prompts or output;
- production catalog mutation.

KO and EN must retain identical structural semantics, candidate counts, aggregate policy outcomes, and stop-condition decisions. Provider-generated text and localized labels may differ and are excluded from cross-request equality requirements.

## 7. Isolated candidate projection

Proposed pure function:

```text
buildIsolatedCandidateProjection({ candidates, decisions })
```

Input:

- cloned immutable candidate descriptors;
- CandidateExposurePolicy decisions from the deterministic replay lane.

Output:

```text
{
  aggregate,
  fingerprint,
  orderedExposureVector
}
```

`orderedExposureVector` is memory-only. It is used to compute and verify deterministic ordering, then discarded. It is never logged or stored.

The projection contract requires:

- exact five exposure states;
- exact five-lane boolean eligibility vectors;
- source candidate order retained;
- duplicate candidate references rejected before projection;
- no mutation or reorder of the source candidates;
- no replacement, filtering, enrichment, or reorder of the recommendation candidate pool;
- candidate references retained only in memory;
- evidence limited to aggregate exposure counts, aggregate lane counts, candidate count, and projection fingerprint.

The projection object cannot be returned by a product module. Only the Stage 11F runner may consume it.

## 8. Fingerprint contract

The harness distinguishes eight fingerprint or attestation types:

- response pre/post fingerprint;
- snapshot pre/post fingerprint;
- candidate-order pre/post fingerprint;
- isolated projection fingerprint;
- runtime implementation SHA;
- harness implementation SHA;
- runtime module digest attestation;
- fixture semantic fingerprint.

Independent provider-backed control and canary response bodies are not required to have equal hashes. Policy mutation is measured inside the same canary request through pre/post response, snapshot, and candidate-order fingerprints.

Control/canary scenario comparison uses aggregate projection evidence and the shared fixture semantic fingerprint. It does not compare localized generated prose.

Excluded nondeterministic fields may include:

- `analysisRunId`;
- generation timestamps;
- provider-generated explanation text;
- diagnostic request IDs;
- request duration.

Mutation-sensitive fields may never be excluded:

- candidate sequence and count;
- response and snapshot structural keys;
- exposure counts;
- lane eligibility counts;
- divergence counts.

Negative controls must prove that normalization still detects changed candidate ordering, counts, exposure states, lane eligibility, and structural response fields.

## 9. Aggregate telemetry

The exact allowed fields are defined in the machine contract. They include only schema and plan versions, scenario, locale, mode, execution status, aggregate counts, mutation booleans, and stop condition.

Candidate, product, user, account, session, report, cookie, token, secret, raw request, raw response, provider prompt, and provider output fields are forbidden.

The validator rejects:

- unknown fields;
- missing required fields;
- negative or non-integer counts;
- exposure or divergence totals that do not reconcile with candidate count;
- lane counts above candidate count;
- contradictory status, error, exception, or fallback combinations;
- candidate-level arrays or records;
- raw request or response bodies.

Stop-condition evidence fields that describe cleanup or project state belong to the final aggregate evidence object, not per-request telemetry.

## 10. Stop conditions

The exact stop-condition key set is inherited from Stage 11D:

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

Missing, disabled, or unknown keys invalidate the configuration before execution.

Every stop condition defines:

- detection location;
- detection timing;
- immediate cessation of remaining requests;
- no automatic retry;
- mandatory cleanup;
- aggregate evidence fields;
- final evidence status.

Candidate-level telemetry detection produces `evidence_invalid`. Operational or policy contract failures produce `stopped_on_contract_violation`.

## 11. Cleanup contract

Cleanup always runs in `finally`, including configuration failure after temporary resources are created, request failure, telemetry failure, stop-condition failure, and evidence serialization failure.

Temporary resources include:

- automation bypass;
- runner-local fixture files;
- deployment locator;
- aggregate evidence working file;
- masked environment material.

Required postconditions:

```text
temporary bypass residue = 0
temporary file residue = 0
project environment mutation = 0
Production change = 0
```

Cleanup failure cannot coexist with PASS. The final status becomes `cleanup_failed` even when all request and policy checks passed.

## 12. Evidence schema

Required top-level fields:

- schema and plan versions;
- runtime implementation SHA;
- harness implementation SHA;
- runtime module digest attestation;
- opaque control and canary deployment IDs;
- start and completion timestamps;
- planned and completed request counts;
- HTTP 200 and runtime SHA match counts;
- default-off and canary execution counts;
- aggregate scenario results;
- aggregate divergence and mutation results;
- cleanup result;
- stop condition;
- final status;
- authorization object.

Allowed final statuses:

```text
completed_pass
stopped_on_contract_violation
blocked_before_execution
cleanup_failed
evidence_invalid
```

Deployment URLs, bypass secrets, candidate or product identifiers, user identifiers, and raw request or response data are never stored.

## 13. Stage 11F file responsibilities

Proposed files:

```text
lib/candidate-exposure-policy-isolated-canary-control.js
lib/candidate-exposure-policy-isolated-projection.js
lib/candidate-exposure-policy-isolated-canary-telemetry.js
lib/candidate-exposure-policy-isolated-canary-evidence.js
scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs
scripts/check-candidate-exposure-policy-isolated-canary-contract.mjs
```

Responsibilities remain separated:

- control: state machine, authority, budgets, runtime attestation, stop transitions;
- projection: immutable projection and memory-only vector;
- telemetry: exact aggregate schema validation;
- evidence: final aggregate schema and authorization invariants;
- runner: orchestration of both lanes and cleanup;
- checker: positive and negative contract controls.

Allowed dependency direction:

```text
harness runner -> existing canonical read-only modules
harness runner -> CandidateExposurePolicy
harness runner -> isolated projection
harness runner -> aggregate telemetry and evidence
```

Forbidden direction:

```text
recommendation runtime -> canary harness
response builder -> canary harness
storage layer -> canary harness
UI -> canary harness
production route -> canary design contract
```

## 14. Design result

The design validator can return only:

```text
design_ready_for_implementation_review
blocked_design_gap
blocked_boundary_violation
```

Every result keeps these authorizations false:

```text
harnessImplementationAuthorized=false
runtimeActivationAuthorized=false
publicTrafficAuthorized=false
productionActivationAuthorized=false
```

A ready design permits only Stage 11F implementation review. It does not permit implementation to begin automatically and does not authorize any product-runtime connection.
