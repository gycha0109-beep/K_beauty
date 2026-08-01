import assert from "node:assert/strict";
import {
  CANDIDATE_EXPOSURES,
  CANDIDATE_EXPOSURE_LANES,
  CANDIDATE_EXPOSURE_POLICY_VERSION,
  buildCandidateLaneEligibility
} from "../lib/candidate-exposure-policy-contract.js";
import {
  CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES
} from "../lib/candidate-exposure-policy-observability.js";
import {
  ISOLATED_CANARY_STOP_CONDITIONS,
  canExecuteIsolatedCanaryEntry,
  createIsolatedCanaryControl,
  stopIsolatedCanaryRun,
  transitionIsolatedCanaryControl,
  validateIsolatedCanaryAuthority
} from "../lib/candidate-exposure-policy-isolated-canary-control.js";
import {
  buildIsolatedCandidateProjection,
  fingerprintIsolatedCandidateProjection
} from "../lib/candidate-exposure-policy-isolated-projection.js";
import {
  ISOLATED_CANARY_TELEMETRY_ALLOWED_FIELDS,
  buildIsolatedCanaryTelemetry,
  serializeIsolatedCanaryTelemetry,
  validateIsolatedCanaryTelemetry
} from "../lib/candidate-exposure-policy-isolated-canary-telemetry.js";
import {
  ISOLATED_CANARY_IMPLEMENTATION_AUTHORIZATION,
  createIsolatedCanaryImplementationEvidence,
  serializeIsolatedCanaryImplementationEvidence,
  validateIsolatedCanaryImplementationEvidence
} from "../lib/candidate-exposure-policy-isolated-canary-evidence.js";

let assertions = 0;
function equal(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}
function deepEqual(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}
function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}
function throws(fn, pattern, message) {
  assertions += 1;
  assert.throws(fn, pattern, message);
}

const stopConditions = Object.fromEntries(
  ISOLATED_CANARY_STOP_CONDITIONS.map((key) => [key, true])
);
const authorityInput = {
  designStatus: "design_ready_for_implementation_review",
  stage11eDesignBaseSha: "d82f097ac49bf3d2fbfe68b0ee57b1f07c55953a",
  expectedStage11eDesignBaseSha: "d82f097ac49bf3d2fbfe68b0ee57b1f07c55953a",
  runtimeImplementationSha: "1bc119347a2f8d3387a935163e24849ceebe349d",
  expectedRuntimeImplementationSha: "1bc119347a2f8d3387a935163e24849ceebe349d",
  runtimeAttestationMatch: true,
  implementationPathsAllowed: true,
  mode: "validate-only",
  maxAnalyzeRequests: 16,
  maxDurationMinutes: 60,
  stopConditions,
  networkAccessAllowed: false,
  hostedExecutionAllowed: false,
  productionAllowed: false
};

deepEqual(validateIsolatedCanaryAuthority(authorityInput), {
  valid: true,
  blockers: []
});

const authorityMutations = [
  ["design status", (value) => { value.designStatus = "blocked_design_gap"; }],
  ["design base", (value) => { value.stage11eDesignBaseSha = "different"; }],
  ["runtime SHA", (value) => { value.runtimeImplementationSha = "different"; }],
  ["runtime attestation", (value) => { value.runtimeAttestationMatch = false; }],
  ["implementation path", (value) => { value.implementationPathsAllowed = false; }],
  ["mode", (value) => { value.mode = "hosted"; }],
  ["request budget", (value) => { value.maxAnalyzeRequests = 17; }],
  ["duration", (value) => { value.maxDurationMinutes = 61; }],
  ["missing stop", (value) => { delete value.stopConditions.fallback; }],
  ["disabled stop", (value) => { value.stopConditions.invalidContext = false; }],
  ["unknown stop", (value) => { value.stopConditions.futureStop = true; }],
  ["network", (value) => { value.networkAccessAllowed = true; }],
  ["hosted", (value) => { value.hostedExecutionAllowed = true; }],
  ["Production", (value) => { value.productionAllowed = true; }]
];
for (const [name, mutate] of authorityMutations) {
  const value = structuredClone(authorityInput);
  mutate(value);
  const review = validateIsolatedCanaryAuthority(value);
  equal(review.valid, false, `${name} fails closed`);
  ok(review.blockers.length > 0, `${name} emits blocker`);
}

let control = createIsolatedCanaryControl(authorityInput);
equal(control.state, "disabled");
control = transitionIsolatedCanaryControl(control, { type: "authorize" });
equal(control.state, "eligible");
control = transitionIsolatedCanaryControl(control, { type: "start" });
equal(control.state, "running");
equal(canExecuteIsolatedCanaryEntry(control, { sequence: 1, executeAfterStop: false }), true);
equal(canExecuteIsolatedCanaryEntry(control, { sequence: 2, executeAfterStop: false }), false);
for (let sequence = 1; sequence <= 16; sequence += 1) {
  equal(canExecuteIsolatedCanaryEntry(control, { sequence, executeAfterStop: false }), true);
  control = transitionIsolatedCanaryControl(control, { type: "record_entry" });
}
equal(control.completedEntries, 16);
control = transitionIsolatedCanaryControl(control, { type: "complete" });
equal(control.state, "completed");
equal(transitionIsolatedCanaryControl(control, { type: "record_entry" }), control);

let stoppedControl = createIsolatedCanaryControl(authorityInput);
stoppedControl = transitionIsolatedCanaryControl(stoppedControl, { type: "authorize" });
stoppedControl = transitionIsolatedCanaryControl(stoppedControl, { type: "start" });
stoppedControl = stopIsolatedCanaryRun(stoppedControl, "fallback");
equal(stoppedControl.state, "stopped");
equal(stoppedControl.stopCondition, "fallback");
equal(canExecuteIsolatedCanaryEntry(stoppedControl, { sequence: 1, executeAfterStop: false }), false);

let unknownStopControl = createIsolatedCanaryControl(authorityInput);
unknownStopControl = transitionIsolatedCanaryControl(unknownStopControl, { type: "authorize" });
unknownStopControl = transitionIsolatedCanaryControl(unknownStopControl, { type: "start" });
unknownStopControl = stopIsolatedCanaryRun(unknownStopControl, "futureStop");
equal(unknownStopControl.state, "invalid_configuration");
ok(unknownStopControl.authority.blockers.includes("unknown_stop_condition"));

const decisions = [
  {
    policyVersion: CANDIDATE_EXPOSURE_POLICY_VERSION,
    candidateRef: "synthetic-a",
    exposure: "primary",
    reasonCodes: ["canonical_goal_match"],
    currentProductRelation: "none",
    evidenceState: "complete",
    laneEligibility: buildCandidateLaneEligibility("primary", { treatmentEligible: true }),
    provenance: {
      policy: CANDIDATE_EXPOSURE_POLICY_VERSION,
      adapterExposure: "primary",
      contextVersion: "context-v1",
      functionalPolicyVersion: "functional-v1",
      consistencyVersion: "consistency-v1"
    }
  },
  {
    policyVersion: CANDIDATE_EXPOSURE_POLICY_VERSION,
    candidateRef: "synthetic-b",
    exposure: "contextual",
    reasonCodes: ["duplicate_axis", "replacement_intent_unknown", "canonical_goal_match"],
    currentProductRelation: "same_axis",
    evidenceState: "complete",
    laneEligibility: buildCandidateLaneEligibility("contextual"),
    provenance: {
      policy: CANDIDATE_EXPOSURE_POLICY_VERSION,
      adapterExposure: "primary",
      contextVersion: "context-v1",
      functionalPolicyVersion: "functional-v1",
      consistencyVersion: "consistency-v1"
    }
  }
];
const candidates = [
  { candidateRef: "synthetic-a", sourceIndex: 0 },
  { candidateRef: "synthetic-b", sourceIndex: 1 }
];
const candidatesBefore = JSON.stringify(candidates);
const decisionsBefore = JSON.stringify(decisions);
const projection = buildIsolatedCandidateProjection({ candidates, decisions });
equal(projection.aggregate.candidateCount, 2);
equal(projection.aggregate.exposureCounts.primary, 1);
equal(projection.aggregate.exposureCounts.contextual, 1);
equal(projection.aggregate.laneEligibilityCounts.topPick, 1);
equal(projection.aggregate.laneEligibilityCounts.supporting, 2);
equal(projection.aggregate.reasonCodeCounts.canonical_goal_match, 2);
equal(projection.memoryOnly.orderedCandidateRefs[0], "synthetic-a");
equal(projection.fingerprint.length, 64);
equal(fingerprintIsolatedCandidateProjection(projection), projection.fingerprint);
equal(JSON.stringify(candidates), candidatesBefore);
equal(JSON.stringify(decisions), decisionsBefore);
equal(Object.isFrozen(projection), true);
equal(Object.isFrozen(projection.memoryOnly.orderedCandidateRefs), true);

throws(
  () => buildIsolatedCandidateProjection({
    candidates: [candidates[0], { candidateRef: "synthetic-a", sourceIndex: 1 }],
    decisions
  }),
  /duplicate_candidate_ref/
);
throws(
  () => buildIsolatedCandidateProjection({ candidates, decisions: decisions.slice(0, 1) }),
  /decision_count_mismatch/
);
throws(
  () => buildIsolatedCandidateProjection({
    candidates: [{ candidateRef: "synthetic-a", sourceIndex: 1 }],
    decisions: [decisions[0]]
  }),
  /source_index_invalid/
);
throws(
  () => buildIsolatedCandidateProjection({
    candidates,
    decisions: [decisions[1], decisions[0]]
  }),
  /candidate_order_mismatch/
);
throws(
  () => buildIsolatedCandidateProjection({
    candidates,
    decisions: [{ ...decisions[0], exposure: "future" }, decisions[1]]
  }),
  /decision_invalid/
);

const zeroExposure = Object.fromEntries(CANDIDATE_EXPOSURES.map((key) => [key, 0]));
const zeroLanes = Object.fromEntries(CANDIDATE_EXPOSURE_LANES.map((key) => [key, 0]));
const zeroDivergence = Object.fromEntries(
  CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES.map((key) => [key, 0])
);
const controlTelemetry = buildIsolatedCanaryTelemetry({
  runtimeImplementationShaMatch: true,
  fixtureScenario: "standard_goal_alignment",
  locale: "ko",
  mode: "control",
  executionStatus: "validate_only_control_disabled",
  candidateCount: 0,
  exposureCounts: zeroExposure,
  laneEligibilityCounts: zeroLanes,
  divergenceCategoryCounts: zeroDivergence,
  responseFingerprintMatch: true,
  snapshotFingerprintMatch: true,
  candidateOrderMatch: true,
  projectionFingerprintPresent: false,
  unexpectedDivergenceCount: 0,
  unclassifiedDivergenceCount: 0,
  shadowExceptionCount: 0,
  fallbackCount: 0,
  invalidContextCount: 0,
  stopCondition: null
});
equal(validateIsolatedCanaryTelemetry(controlTelemetry).valid, true);
ok(serializeIsolatedCanaryTelemetry(controlTelemetry).includes("validate_only_control_disabled"));

const canaryDivergence = { ...zeroDivergence, equivalent: 2 };
const canaryTelemetry = buildIsolatedCanaryTelemetry({
  runtimeImplementationShaMatch: true,
  fixtureScenario: "current_product_semantics",
  locale: "en",
  mode: "canary",
  executionStatus: "validate_only_simulation",
  candidateCount: 2,
  exposureCounts: projection.aggregate.exposureCounts,
  laneEligibilityCounts: projection.aggregate.laneEligibilityCounts,
  divergenceCategoryCounts: canaryDivergence,
  responseFingerprintMatch: true,
  snapshotFingerprintMatch: true,
  candidateOrderMatch: true,
  projectionFingerprintPresent: true,
  unexpectedDivergenceCount: 0,
  unclassifiedDivergenceCount: 0,
  shadowExceptionCount: 0,
  fallbackCount: 0,
  invalidContextCount: 0,
  stopCondition: null
});
equal(validateIsolatedCanaryTelemetry(canaryTelemetry).valid, true);
equal(Object.keys(canaryTelemetry).length, ISOLATED_CANARY_TELEMETRY_ALLOWED_FIELDS.length);

const telemetryMutations = [
  ["unknown field", (value) => { value.futureField = 1; }],
  ["reason counts", (value) => { value.reasonCodeCounts = {}; }],
  ["candidate ref", (value) => { value.nested = { candidate_ref: "synthetic-a" }; }],
  ["candidate count", (value) => { value.candidateCount = 3; }],
  ["negative count", (value) => { value.exposureCounts.primary = -1; }],
  ["lane overflow", (value) => { value.laneEligibilityCounts.topPick = 3; }],
  ["divergence total", (value) => { value.divergenceCategoryCounts.equivalent = 1; }],
  ["mutation mismatch", (value) => { value.responseFingerprintMatch = false; }],
  ["runtime mismatch", (value) => { value.runtimeImplementationShaMatch = false; }],
  ["projection missing", (value) => { value.projectionFingerprintPresent = false; }],
  ["fallback", (value) => { value.fallbackCount = 1; }],
  ["invalid stop", (value) => { value.stopCondition = "future"; }]
];
for (const [name, mutate] of telemetryMutations) {
  const value = structuredClone(canaryTelemetry);
  mutate(value);
  equal(validateIsolatedCanaryTelemetry(value).valid, false, `${name} telemetry rejected`);
  throws(() => serializeIsolatedCanaryTelemetry(value), /telemetry_invalid/);
}

const validEvidence = createIsolatedCanaryImplementationEvidence({
  designVersion: "candidate-exposure-policy-isolated-preview-canary-harness-design-v1",
  planVersion: "candidate-exposure-policy-limited-preview-canary-plan-v1",
  stage11eDesignBaseSha: "d82f097ac49bf3d2fbfe68b0ee57b1f07c55953a",
  runtimeImplementationSha: "1bc119347a2f8d3387a935163e24849ceebe349d",
  harnessImplementationSha: "harness-head-sha",
  mode: "validate-only",
  plannedEntryCount: 16,
  completedEntryCount: 16,
  controlEntryCount: 8,
  canaryEntryCount: 8,
  fixtureScenarioCount: 4,
  localeCount: 2,
  runtimeAttestation: {
    match: true,
    closureFileCount: 20,
    changedRuntimeFileCount: 0
  },
  implementationScope: {
    allowed: true,
    changedFileCount: 9,
    disallowedPaths: []
  },
  matrix: {
    exact: true,
    sequenceCount: 16,
    scenarioCount: 4,
    localeCount: 2,
    modeCount: 2
  },
  telemetrySummary: {
    recordCount: 16,
    validRecordCount: 16,
    unexpectedDivergenceCount: 0,
    unclassifiedDivergenceCount: 0,
    shadowExceptionCount: 0,
    fallbackCount: 0,
    invalidContextCount: 0,
    mutationMismatchCount: 0
  },
  cleanup: {
    temporaryFileResidue: 0,
    networkOperationCount: 0,
    hostedOperationCount: 0,
    productionChangeCount: 0
  },
  status: "implementation_ready_for_hosted_execution_review"
});
equal(validateIsolatedCanaryImplementationEvidence(validEvidence).valid, true);
deepEqual(validEvidence.authorization, ISOLATED_CANARY_IMPLEMENTATION_AUTHORIZATION);
ok(serializeIsolatedCanaryImplementationEvidence(validEvidence).includes("implementation_ready_for_hosted_execution_review"));

const evidenceMutations = [
  ["incomplete", (value) => { value.completedEntryCount = 15; }],
  ["runtime", (value) => { value.runtimeAttestation.match = false; }],
  ["runtime changed", (value) => { value.runtimeAttestation.changedRuntimeFileCount = 1; }],
  ["scope", (value) => { value.implementationScope.allowed = false; }],
  ["matrix", (value) => { value.matrix.sequenceCount = 15; }],
  ["telemetry", (value) => { value.telemetrySummary.recordCount = 15; }],
  ["divergence", (value) => { value.telemetrySummary.unexpectedDivergenceCount = 1; }],
  ["cleanup", (value) => { value.cleanup.networkOperationCount = 1; }],
  ["authorization", (value) => { value.authorization.hostedExecutionAuthorized = true; }],
  ["hosted field", (value) => { value.controlDeploymentId = "deployment"; }],
  ["candidate field", (value) => { value.matrix.candidateId = "synthetic-a"; }]
];
for (const [name, mutate] of evidenceMutations) {
  const value = structuredClone(validEvidence);
  mutate(value);
  equal(validateIsolatedCanaryImplementationEvidence(value).valid, false, `${name} evidence rejected`);
  throws(() => serializeIsolatedCanaryImplementationEvidence(value), /evidence_invalid/);
}

console.log(
  `check-candidate-exposure-policy-isolated-canary-contract: PASS ` +
  `(${assertions} assertions, ${authorityMutations.length} authority negatives, ` +
  `${telemetryMutations.length} telemetry negatives, ${evidenceMutations.length} evidence negatives)`
);
