# CandidateExposurePolicy Isolated Canary Implementation Design — Independent Review

## Review target

- Stage 11E approved design contract
- Stage 11F implementation design v1
- product runtime authority: `1bc119347a2f8d3387a935163e24849ceebe349d`
- reviewed design head before this document: `d71ce5b353fa214d35aaaebf14f45618dbd35fc0`

## Result

```text
design_ready_for_stage11f_implementation
```

The design is implementable without changing product runtime files, but two specification ambiguities must be resolved before code is written.

## Resolved Important findings

### 1. Projection reason counts versus serialized telemetry

The implementation design includes `reasonCodeCounts` in the in-memory projection aggregate and also lists it in the proposed telemetry shape. The Stage 11E machine contract does not include `reasonCodeCounts` in the serialized telemetry allowlist.

Resolution:

- `reasonCodeCounts` may exist in the pure projection result and deterministic fingerprint input;
- it may be used by local contract assertions;
- it must not be serialized into Stage 11F aggregate telemetry or implementation-readiness evidence;
- the Stage 11E machine allowlist is authoritative for serialized telemetry;
- an unknown `reasonCodeCounts` telemetry field must fail validation.

This keeps reason-level candidate behavior available for deterministic local validation without expanding the previously reviewed aggregate telemetry surface.

### 2. Validate-only evidence versus future Hosted evidence

The Stage 11E design contains a future Hosted evidence contract with deployment IDs, HTTP counts, runtime response headers, and cleanup of temporary Hosted resources. Stage 11F explicitly prohibits deployment and HTTP execution, so it cannot truthfully populate those fields.

Resolution:

- Stage 11F implements a separate `implementation-readiness` evidence schema;
- Stage 11F evidence proves pure-module contracts, fixture replay, exact matrix construction, runtime digest attestation, import boundaries, no-network execution, and non-authorization invariants;
- Stage 11F does not emit placeholder deployment IDs, HTTP counts, or Hosted PASS markers;
- the future Hosted evidence contract remains unchanged and is deferred to Stage 11G;
- Stage 11F ready status is `implementation_ready_for_hosted_execution_review`, not `completed_pass`.

## Additional review conclusions

### Responsibility boundary

- The harness remains a runner-owned consumer of existing read-only policy modules.
- No production route, recommendation builder, persistence layer, or UI may import the harness.
- The validate-only runner must reject every mode except `validate-only` before any work starts.

### Runtime attestation

- Implementation scope is compared against the exact Stage 11E design base SHA.
- Product runtime integrity is checked independently against runtime SHA `1bc119347a2f8d3387a935163e24849ceebe349d`.
- The attestation must recursively follow relative local imports from the contracted runtime roots.
- Missing baseline objects, unresolved local imports, changed bytes, or out-of-allowlist implementation paths fail closed.

### Projection and privacy

- Candidate references and ordered vectors are memory-only.
- Telemetry and evidence builders must reject them recursively, including case and separator variants.
- Original candidate descriptors and decisions must remain deeply unchanged after projection.

### Verification strategy

- No intermediate GitHub Actions runs.
- All code, review fixes, and result documentation are completed first.
- One final Actions run may execute contract verifier, import-boundary verifier, validate-only runner, security closeout, architecture guard, Production build, and diff hygiene.
- No Vercel token, deployment, HTTP request, bypass, or Production operation is permitted.

## Authorization

```text
stage11fImplementationAuthorized=true
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

## Review markers

```text
STAGE_11F_IMPLEMENTATION_DESIGN_INDEPENDENT_REVIEW_PASS
MACHINE_TELEMETRY_ALLOWLIST_AUTHORITATIVE
IMPLEMENTATION_AND_HOSTED_EVIDENCE_SEPARATED
PRODUCT_RUNTIME_MUTATION_NOT_AUTHORIZED
HOSTED_EXECUTION_NOT_AUTHORIZED
```
