# CandidateExposurePolicy Isolated Canary Implementation Result

## Final status

- Stage: 11F
- Branch: `codex/candidate-exposure-policy-isolated-preview-canary-harness`
- Draft PR: #107
- Base: `codex/candidate-exposure-policy-isolated-preview-canary-harness-design`
- Validated implementation SHA: `ebc16f9f166ccdefc86de777cf75836eca4af595`
- Product runtime authority SHA: `1bc119347a2f8d3387a935163e24849ceebe349d`
- Stage 11E design base SHA: `d82f097ac49bf3d2fbfe68b0ee57b1f07c55953a`
- Machine status: `implementation_ready_for_hosted_execution_review`
- Hosted execution authorized: no
- Runtime activation authorized: no
- Production activation authorized: no

## Implemented boundary

Stage 11F implements a local validate-only harness consisting of:

- fail-closed control state machine;
- immutable isolated candidate projection;
- exact aggregate telemetry schema;
- implementation-readiness evidence schema;
- four deterministic synthetic fixture scenarios;
- exact KO/EN × four scenarios × control/canary matrix;
- recursive runtime import-closure byte attestation;
- implementation path allowlist;
- contract and import-boundary verifiers.

The harness supports only:

```text
--mode validate-only
```

It does not implement deployment, HTTP, Vercel, bypass, Hosted, public-traffic, project-environment, or Production operations.

## Authoritative validation

GitHub Actions run:

```text
30722550071
```

Validated branch HEAD:

```text
ebc16f9f166ccdefc86de777cf75836eca4af595
```

Results:

- Stage 11F contract verifier: 129 assertions PASS;
- authority negative controls: 14;
- telemetry negative controls: 12;
- readiness-evidence negative controls: 11;
- import-boundary verifier: 597 assertions PASS;
- changed paths checked: 11;
- product files scanned: 102;
- security closeout verifier suite: 60/60 PASS;
- architecture guard: PASS;
- Production build: PASS;
- validate-only runner: PASS;
- diff hygiene: PASS;
- readiness artifact digest: `sha256:d40d76b0b9912e48aa4b89e5570e90849f94085e64bfcdf8d1ba165046e21174`.

## Readiness evidence

The artifact reports:

```text
schemaVersion=candidate-exposure-policy-isolated-canary-implementation-readiness-v1
status=implementation_ready_for_hosted_execution_review
mode=validate-only
runtimeClosureFileCount=16
changedRuntimeFileCount=0
implementationChangedFileCount=11
plannedEntryCount=16
completedEntryCount=16
controlEntryCount=8
canaryEntryCount=8
fixtureScenarioCount=4
localeCount=2
telemetryRecordCount=16
validTelemetryRecordCount=16
unexpectedDivergenceCount=0
unclassifiedDivergenceCount=0
shadowExceptionCount=0
fallbackCount=0
invalidContextCount=0
mutationMismatchCount=0
networkOperationCount=0
hostedOperationCount=0
productionChangeCount=0
```

All implementation-scope paths were allowed. No candidate, product, user, session, report, token, secret, raw request/response, provider payload, deployment ID, URL, or bypass value is present in the evidence.

## Validation history

Two bounded failures occurred before the authoritative run:

1. Run `30722395069` stopped after the import-boundary verifier treated the local runtime path `app/api/analyze/route.js` as an HTTP call. The guard was corrected to detect network-capable constructs rather than a generic route substring.
2. Run `30722443126` passed all Stage 11F checks but the existing security suite returned 59/60 because the workflow omitted the Stage 10 local verifier ref. It also exposed that the default checkout identified GitHub's PR merge commit rather than the branch HEAD. The final workflow explicitly fetched the baseline and checked out the exact PR head SHA.

Both failed runs stopped before any Hosted or Production action. No such action existed in the workflow or implementation.

## Cleanup

The one-time final-validation workflow was deleted after the successful run.

The deletion produced no additional Actions run. The final branch retains no Stage 11F workflow, secret reference, deployment instruction, or Hosted trigger.

## Authorization

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

## Final markers

```text
CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_IMPLEMENTATION_PASS
STAGE_11F_VALIDATE_ONLY_HARNESS_IMPLEMENTATION_PASS
IMPLEMENTATION_READY_FOR_HOSTED_EXECUTION_REVIEW
EXACT_16_ENTRY_MATRIX_PASS
RUNTIME_CLOSURE_UNCHANGED
CANDIDATE_ORDER_UNCHANGED
AGGREGATE_TELEMETRY_ONLY
NETWORK_OPERATION_ZERO
HOSTED_OPERATION_ZERO
PRODUCTION_CHANGE_ZERO
HOSTED_EXECUTION_NOT_IMPLEMENTED
RUNTIME_FILTER_NOT_CONNECTED
RECOMMENDATION_MUTATION_NOT_CONNECTED
RESPONSE_MUTATION_NOT_CONNECTED
STORAGE_MUTATION_NOT_CONNECTED
UI_MUTATION_NOT_CONNECTED
PUBLIC_TRAFFIC_NOT_AUTHORIZED
PRODUCTION_NOT_AUTHORIZED
PR_REMAINS_DRAFT
```

## Next eligible work

The next work is a separate Stage 11G Hosted execution design and authorization review.

Stage 11F does not authorize implementing or running that Hosted path. Any Stage 11G work must separately define exact-SHA deployments, request authority, protection cleanup, evidence schema, stop conditions, and Actions budget before execution.
