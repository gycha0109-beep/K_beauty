# CandidateExposurePolicy Isolated Preview Canary Harness Design Result

## Final status

- Branch: `codex/candidate-exposure-policy-isolated-preview-canary-harness-design`
- Draft PR: #102
- Base: `codex/candidate-exposure-policy-limited-preview-canary-plan`
- Stage 11D base head: `1627fd9a038e36ac61a2c8df0b8ff2313652b04e`
- Hosted product-runtime SHA: `1bc119347a2f8d3387a935163e24849ceebe349d`
- Design status: `design_ready_for_implementation_review`
- Harness implementation authorized: no
- Runtime activation authorized: no
- Public traffic authorized: no
- Production activation authorized: no

## Design result

Stage 11E defines a runner-driven, two-lane harness design:

1. an exact product-runtime SHA Hosted lane for response, snapshot, candidate-order, and aggregate shadow invariance;
2. a future Stage 11F harness-head deterministic projection replay lane.

The two commits are intentionally distinct. The future harness must attest that every runtime-sensitive product file at the Stage 11F head is unchanged from the Hosted runtime SHA through both path-diff and content-digest checks. A mismatch stops the run before deployment or analyze calls and requires a new Stage 11C exact-SHA evaluation.

The product route, recommendation runtime, response builder, persistence, and UI do not import or consume the design. The isolated projection remains runner-only and returns only memory-local vectors plus aggregate counts and a fingerprint.

## Fixed contract

- control states: six-state finite state machine;
- request matrix: exact KO/EN × four scenarios × control/canary = 16;
- duration ceiling: 60 minutes;
- retries, warm-up, quota probes, exploratory requests, and public traffic: prohibited;
- fixture sources: synthetic or explicitly authorized diagnostic fixtures only;
- candidate references and ordered exposure vectors: memory-only;
- telemetry: aggregate-only exact allowlist;
- stop conditions: exact inherited key set with no missing, disabled, or unknown keys;
- cleanup: mandatory `finally`, zero bypass and temporary-file residue;
- cleanup failure: cannot coexist with PASS;
- final evidence: no deployment URL, bypass secret, candidate, product, user, request, or response payload.

## Self-review findings

Resolved Important findings:

1. Hosted runtime SHA and future harness implementation SHA were initially conflated.
2. A product-route import direction could weaken isolation.
3. Provider nondeterminism could be mistaken for policy mutation.
4. Candidate-level ordered vectors could leak into evidence.
5. Stop-condition maps required exact-key validation.

Resolved Minor finding:

- per-request telemetry and final cleanup/project evidence responsibilities were separated.

Unresolved Critical findings: 0

Unresolved Important findings: 0

Unresolved blocking Minor findings: 0

## Verification

Initial run `30718753857` stopped at the design verifier because its filename regex incorrectly classified the temporary design-validation workflow as a Hosted harness workflow. No product or design contract failure occurred. The verifier was corrected to inspect workflow contents for deployment, analyze, Vercel secret, bypass, and harness-runner patterns.

Authoritative verification run: `30718814713`

- Stage 11E design contract: PASS
- assertions: 452
- design-gap negative controls: 50
- boundary-violation negative controls: 15
- security closeout verifier suite: 60/60 PASS
- architecture guard: PASS
- Production build: PASS
- diff hygiene: PASS

No Vercel deployment was created. No `/api/analyze` Hosted request was sent. No protection bypass was generated. No GitHub secret was read by the verification job. No project or Production configuration changed.

## Machine result

The machine-readable design is stored at:

`docs/verification/candidate-exposure-policy-isolated-preview-canary-harness-design.json`

The pure validator returns:

```text
design_ready_for_implementation_review
```

Every result retains:

```text
harnessImplementationAuthorized=false
runtimeActivationAuthorized=false
publicTrafficAuthorized=false
productionActivationAuthorized=false
```

## Final markers

```text
CANDIDATE_EXPOSURE_POLICY_ISOLATED_PREVIEW_CANARY_HARNESS_DESIGN_PASS
DESIGN_READY_FOR_IMPLEMENTATION_REVIEW
EXACT_16_REQUEST_MATRIX
FOUR_SCENARIO_FIXTURE_CONTRACT_COMPLETE
ISOLATED_PROJECTION_BOUNDARY_DEFINED
RUNTIME_AND_HARNESS_SHA_AUTHORITY_SEPARATED
RUNTIME_MODULE_DIGEST_ATTESTATION_REQUIRED
AGGREGATE_TELEMETRY_SCHEMA_DEFINED
FINGERPRINT_CONTRACT_DEFINED
FAIL_CLOSED_STOP_CONDITIONS_DEFINED
CLEANUP_CONTRACT_DEFINED
EVIDENCE_SCHEMA_DEFINED
HARNESS_NOT_IMPLEMENTED
HOSTED_ANALYZE_NOT_RUN
RUNTIME_FILTER_NOT_CONNECTED
RECOMMENDATION_MUTATION_NOT_CONNECTED
RESPONSE_MUTATION_NOT_CONNECTED
STORAGE_MUTATION_NOT_CONNECTED
UI_MUTATION_NOT_CONNECTED
PUBLIC_TRAFFIC_NOT_AUTHORIZED
PRODUCTION_NOT_CHANGED
PR_REMAINS_DRAFT
```

## Next-stage boundary

The next possible stage is Stage 11F implementation review. Stage 11E does not automatically authorize implementation.

Before Stage 11F begins, its scope must explicitly preserve:

- runner-only dependency direction;
- no runtime-sensitive product-file changes;
- no product route import;
- no recommendation, response, storage, or UI connection;
- no public traffic or Production;
- exact 16-request budget and all fail-closed stop conditions.
