# CandidateExposurePolicy Isolated Preview Canary Harness Design Review

## 1. Review scope

This review evaluates the Stage 11E design against the Stage 11D `plan_ready` contract. It does not approve or implement the Stage 11F harness.

Review dimensions:

- responsibility boundary;
- evidence trustworthiness;
- fail-closed behavior;
- privacy and operational safety;
- implementation feasibility.

## 2. Findings and remediation

### 2.1 Runtime SHA and harness SHA were initially conflated

Severity: Important

Initial design language described both Hosted execution and deterministic projection replay as using the same implementation SHA. That was not implementable: Stage 11F must add new harness and projection files, so its commit cannot equal the earlier Hosted product-runtime SHA.

Remediation:

- preserve `runtimeImplementationSha=1bc119347a2f8d3387a935163e24849ceebe349d` for the Hosted control and canary deployments;
- resolve `harnessImplementationSha` from the Stage 11F head at execution;
- require a path-diff and content-digest attestation for every runtime-sensitive product file;
- stop before execution if the Stage 11F head changes any runtime-sensitive file.

Result: resolved.

### 2.2 A product-route import would weaken isolation

Severity: Important

A direct import from `/api/analyze`, the decision engine, response builder, storage layer, or UI into the harness would make the observation path a product dependency and create a possible backflow path.

Remediation:

- use a runner-driven architecture;
- keep Hosted response invariance and deterministic projection replay as separate lanes;
- allow dependency flow only from the harness runner toward existing read-only modules;
- statically prohibit production modules from importing the design or future harness.

Result: resolved.

### 2.3 Provider nondeterminism could be mistaken for policy mutation

Severity: Important

Independent control and canary requests can produce different generated text. Requiring whole-body equality would create false failures, while excluding too many fields could hide actual structural mutation.

Remediation:

- measure response, snapshot, and candidate order inside the same canary request before and after shadow execution;
- use aggregate projection and fixture semantic fingerprints for scenario correlation;
- exclude only enumerated nondeterministic fields;
- permanently retain candidate sequence, count, exposure, lane, divergence, and structural keys in mutation-sensitive fingerprints;
- require normalization negative controls.

Result: resolved.

### 2.4 Candidate-level vectors could leak into evidence

Severity: Important

The isolated projection needs stable candidate references and an ordered exposure vector for deterministic comparison. Persisting those values would violate the aggregate-only contract.

Remediation:

- keep candidate references and ordered vectors in memory only;
- discard them after fingerprint calculation;
- prohibit candidate-level arrays and records in telemetry and evidence;
- store only aggregate counts and the projection fingerprint.

Result: resolved.

### 2.5 Stop-condition maps needed exact-key validation

Severity: Important

Checking only known `true` values would allow an unknown false key or a silently omitted stop condition.

Remediation:

- require the exact inherited Stage 11D key set;
- require every stop condition to define detection location, timing, immediate stop, no retry, cleanup, aggregate evidence, and final status;
- reject missing, disabled, and unknown conditions before execution.

Result: resolved.

### 2.6 Per-request telemetry and final evidence responsibilities were ambiguous

Severity: Minor

Project-environment and cleanup counts are final-run evidence, not per-request telemetry. Combining them into one schema would increase the chance of contradictory totals.

Remediation:

- keep per-request telemetry limited to scenario, locale, mode, policy aggregates, mutation booleans, and stop condition;
- keep cleanup, project mutation, Production change, deployment IDs, and SHA attestations in final aggregate evidence.

Result: resolved.

## 3. Responsibility-boundary review

The final design remains an observer:

- it cannot replace or filter recommendation candidates;
- it cannot reorder or mutate source candidates;
- it cannot add fields to responses or snapshots;
- it cannot enter storage or UI projection;
- it cannot consume public traffic;
- it cannot alter project-wide Preview or Production configuration.

The isolated projection exists only in the Stage 11F runner process and cannot be returned from a production module.

Assessment: PASS.

## 4. Evidence-trustworthiness review

The design distinguishes:

- exact Hosted runtime SHA;
- Stage 11F harness SHA;
- runtime module digest attestation;
- same-request mutation fingerprints;
- deterministic isolated projection fingerprint;
- fixture semantic fingerprint.

The design does not rely on independent provider response equality. Aggregate counts reconcile with candidate count, and normalization negative controls are required.

Cleanup failure, invalid evidence, candidate-level telemetry, or runtime-module mismatch cannot coexist with PASS.

Assessment: PASS.

## 5. Fail-closed review

The design fails closed for:

- stale Stage 11D evidence;
- changed runtime-sensitive modules;
- invalid deployment target or runtime SHA;
- request or duration budget drift;
- missing, false, or unknown stop-condition keys;
- default-off execution;
- unexpected or unclassified divergence;
- mutation fingerprint mismatch;
- exception, fallback, or invalid context;
- candidate-level telemetry;
- project or Production configuration change;
- cleanup residue or cleanup failure.

No automatic retry or continuation after a stop condition is allowed.

Assessment: PASS.

## 6. Privacy and operational-safety review

The design prohibits:

- real user images and product history;
- user, account, session, report, cookie, token, and email identifiers;
- candidate and product identifiers in telemetry or evidence;
- raw request and response bodies;
- provider prompts and output;
- deployment URLs and bypass secrets in persisted evidence.

Temporary bypass and runner files require `finally` cleanup, secret masking, and zero residue.

Assessment: PASS.

## 7. Implementation-feasibility review

The design is implementable without modifying product routes:

- control and evidence logic are pure modules;
- projection is a pure immutable transform;
- Hosted orchestration is confined to one runner script;
- runtime-sensitive module equality is independently attested;
- contract checks can be tested without Vercel or public traffic;
- actual Hosted execution remains a separately authorized operation.

Stage 11F must not alter any runtime-sensitive path. If such a change becomes necessary, Stage 11F must stop and return to Stage 11C exact-SHA evaluation.

Assessment: PASS.

## 8. Remaining uncertainty

Minor implementation details remain intentionally deferred:

- the exact Vercel API query used to correlate diagnostic IDs with aggregate runtime logs;
- the internal serialization format for memory-only ordered exposure vectors;
- the artifact retention period for aggregate evidence.

These do not change the design boundary. Stage 11F must resolve them within the existing aggregate-only, no-retry, zero-residue contract.

## 9. Final review decision

Critical unresolved findings: 0

Important unresolved findings: 0

Minor unresolved blockers: 0

Final status:

```text
design_ready_for_implementation_review
```

Authorization remains:

```text
harnessImplementationAuthorized=false
runtimeActivationAuthorized=false
publicTrafficAuthorized=false
productionActivationAuthorized=false
```
