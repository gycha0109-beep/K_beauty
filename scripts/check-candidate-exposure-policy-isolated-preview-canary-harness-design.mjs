import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import {
  CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_DESIGN_STATUSES,
  reviewCandidateExposurePolicyIsolatedCanaryHarnessDesign
} from "../lib/candidate-exposure-policy-isolated-preview-canary-harness-design.js";

const evidencePath = "docs/verification/candidate-exposure-policy-isolated-preview-canary-harness-design.json";
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));

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

function review(value) {
  return reviewCandidateExposurePolicyIsolatedCanaryHarnessDesign(value);
}

const ready = review(evidence);
deepEqual(ready, {
  version: "candidate-exposure-policy-isolated-preview-canary-harness-design-v1",
  status: "design_ready_for_implementation_review",
  blockers: [],
  harnessImplementationAuthorized: false,
  runtimeActivationAuthorized: false,
  publicTrafficAuthorized: false,
  productionActivationAuthorized: false,
  recommendedNextStage: "stage_11f_isolated_preview_canary_harness_implementation_review"
});

equal(evidence.design.requestMatrix.length, 16, "exact request matrix size");
equal(evidence.design.fixtures.length, 4, "four fixture contracts");
equal(evidence.design.maxDurationMinutes, 60, "duration ceiling");
equal(evidence.design.execution.automaticRetryAllowed, false, "retry disabled");
equal(evidence.design.execution.warmupRequestsAllowed, false, "warm-up disabled");
equal(evidence.design.execution.quotaProbeAllowed, false, "quota probe disabled");
equal(evidence.design.execution.exploratoryRequestsAllowed, false, "exploratory requests disabled");
equal(evidence.design.cleanup.cleanupFailureCanPass, false, "cleanup failure cannot pass");
equal(evidence.design.runtimeModuleAttestation.baselineRuntimeSha, evidence.stage11d.implementationSha, "runtime attestation baseline");
equal(evidence.design.harnessImplementationShaResolution, "stage11f_head_at_execution", "harness SHA is resolved later");

const designGapMutations = [
  ["Stage 11D status", (value) => { value.stage11d.status = "blocked_contract_violation"; }],
  ["Stage 11D blocker", (value) => { value.stage11d.blockers = ["blocked"]; }],
  ["stale runtime SHA", (value) => { value.design.runtimeImplementationSha = "stale"; }],
  ["missing harness SHA resolution", (value) => { value.design.harnessImplementationShaResolution = "same_as_runtime"; }],
  ["design status", (value) => { value.design.status = "completed_pass"; }],
  ["control state missing", (value) => { value.design.controlStates.pop(); }],
  ["control transition missing", (value) => { value.design.controlTransitions.pop(); }],
  ["request budget", (value) => { value.design.maxAnalyzeRequests = 17; }],
  ["duration budget", (value) => { value.design.maxDurationMinutes = 61; }],
  ["locale set", (value) => { value.design.locales.push("ja"); }],
  ["scenario set", (value) => { value.design.scenarios.pop(); }],
  ["mode set", (value) => { value.design.modes = ["control"]; }],
  ["matrix sequence", (value) => { value.design.requestMatrix[0].sequence = 2; }],
  ["matrix deployment role", (value) => { value.design.requestMatrix[0].deploymentRole = "deployment_scoped_opt_in"; }],
  ["matrix execute after stop", (value) => { value.design.requestMatrix[0].executeAfterStop = true; }],
  ["fixture missing", (value) => { value.design.fixtures.pop(); }],
  ["fixture user data", (value) => { value.design.fixtures[0].actualUserDataAllowed = true; }],
  ["fixture contract empty", (value) => { value.design.fixtures[0].canonicalConditions = []; }],
  ["stop condition missing", (value) => { delete value.design.stopConditions.shadowException; }],
  ["stop condition unknown", (value) => { value.design.stopConditions.ignoreFailure = structuredClone(value.design.stopConditions.fallback); }],
  ["stop condition retry", (value) => { value.design.stopConditions.fallback.automaticRetryAllowed = true; }],
  ["stop condition cleanup", (value) => { value.design.stopConditions.fallback.cleanupRequired = false; }],
  ["telemetry candidate records", (value) => { value.design.telemetry.candidateLevelRecordsAllowed = true; }],
  ["telemetry missing-field acceptance", (value) => { value.design.telemetry.missingRequiredFieldsRejected = false; }],
  ["fingerprint provider equality", (value) => { value.design.fingerprints.independentProviderResponseEqualityRequired = true; }],
  ["fingerprint type missing", (value) => { value.design.fingerprints.types.pop(); }],
  ["fingerprint controls missing", (value) => { value.design.fingerprints.normalizationNegativeControlsRequired = false; }],
  ["projection mutation", (value) => { value.design.projection.sourceCandidateMutationAllowed = true; }],
  ["projection response use", (value) => { value.design.projection.responseConsumptionAllowed = true; }],
  ["projection vector evidence", (value) => { value.design.projection.orderedExposureVectorEvidenceAllowed = true; }],
  ["runtime attestation baseline", (value) => { value.design.runtimeModuleAttestation.baselineRuntimeSha = "different"; }],
  ["runtime path attestation", (value) => { value.design.runtimeModuleAttestation.runtimeSensitivePaths.pop(); }],
  ["runtime digest attestation", (value) => { value.design.runtimeModuleAttestation.contentDigestAttestationRequired = false; }],
  ["cleanup finally", (value) => { value.design.cleanup.finallyRequired = false; }],
  ["cleanup residue", (value) => { value.design.cleanup.bypassResidueRequired = 1; }],
  ["cleanup pass", (value) => { value.design.cleanup.cleanupFailureCanPass = true; }],
  ["evidence field missing", (value) => { value.design.evidence.requiredFields.pop(); }],
  ["evidence status missing", (value) => { value.design.evidence.statuses.pop(); }],
  ["evidence raw response", (value) => { value.design.evidence.rawResponseStored = true; }],
  ["Stage 11F file missing", (value) => { value.design.stage11fFilePlan.pop(); }],
  ["dependency direction", (value) => { value.design.dependencyDirection.forbidden.pop(); }],
  ["hosted lane", (value) => { value.design.execution.hostedLane = "harness_head_runtime"; }],
  ["projection lane", (value) => { value.design.execution.projectionLane = "same_commit"; }],
  ["fixture lane correlation", (value) => { value.design.execution.lanesShareFixtureSemanticFingerprint = false; }],
  ["hosted policy decisions", (value) => { value.design.execution.hostedLaneExposesPolicyDecisions = true; }],
  ["projection real data", (value) => { value.design.execution.projectionLaneUsesActualUserData = true; }],
  ["automatic retry", (value) => { value.design.execution.automaticRetryAllowed = true; }],
  ["warm-up", (value) => { value.design.execution.warmupRequestsAllowed = true; }],
  ["quota probe", (value) => { value.design.execution.quotaProbeAllowed = true; }],
  ["exploratory request", (value) => { value.design.execution.exploratoryRequestsAllowed = true; }]
];

for (const [name, mutate] of designGapMutations) {
  const value = structuredClone(evidence);
  mutate(value);
  const result = review(value);
  equal(result.status, "blocked_design_gap", `${name} fails as a design gap`);
  ok(result.blockers.length > 0, `${name} emits blockers`);
  equal(result.harnessImplementationAuthorized, false, `${name} does not authorize implementation`);
  equal(result.runtimeActivationAuthorized, false, `${name} does not authorize runtime`);
  equal(result.publicTrafficAuthorized, false, `${name} does not authorize public traffic`);
  equal(result.productionActivationAuthorized, false, `${name} does not authorize Production`);
}

const boundaryMutations = [
  ["harness implementation", (value) => { value.design.authorization.harnessImplementationAuthorized = true; }],
  ["runtime activation", (value) => { value.design.authorization.runtimeActivationAuthorized = true; }],
  ["runtime filtering", (value) => { value.design.authorization.runtimeFilterConnectionAuthorized = true; }],
  ["recommendation mutation", (value) => { value.design.authorization.recommendationMutationAuthorized = true; }],
  ["response mutation", (value) => { value.design.authorization.responseMutationAuthorized = true; }],
  ["storage mutation", (value) => { value.design.authorization.storageMutationAuthorized = true; }],
  ["UI mutation", (value) => { value.design.authorization.uiMutationAuthorized = true; }],
  ["public traffic", (value) => { value.design.authorization.publicTrafficAuthorized = true; }],
  ["project environment", (value) => { value.design.authorization.projectEnvironmentMutationAuthorized = true; }],
  ["Production", (value) => { value.design.authorization.productionActivationAuthorized = true; }],
  ["runtime import", (value) => { value.design.runtimeImportsAllowed = true; }],
  ["Hosted deployment", (value) => { value.design.hostedDeploymentExecutionAllowed = true; }],
  ["Hosted analyze", (value) => { value.design.hostedAnalyzeExecutionAllowed = true; }],
  ["Vercel mutation", (value) => { value.design.vercelMutationAllowed = true; }],
  ["Production mutation", (value) => { value.design.productionMutationAllowed = true; }]
];

for (const [name, mutate] of boundaryMutations) {
  const value = structuredClone(evidence);
  mutate(value);
  const result = review(value);
  equal(result.status, "blocked_boundary_violation", `${name} is a boundary violation`);
  ok(result.blockers.length > 0, `${name} emits blockers`);
  equal(result.harnessImplementationAuthorized, false, `${name} does not authorize implementation`);
  equal(result.runtimeActivationAuthorized, false, `${name} does not authorize runtime`);
  equal(result.publicTrafficAuthorized, false, `${name} does not authorize public traffic`);
  equal(result.productionActivationAuthorized, false, `${name} does not authorize Production`);
}

deepEqual(CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_DESIGN_STATUSES, [
  "design_ready_for_implementation_review",
  "blocked_design_gap",
  "blocked_boundary_violation"
]);

const staticSources = [
  ["analyze route", "app/api/analyze/route.js"],
  ["full-report route", "app/api/full-report/route.js"],
  ["decision engine", "lib/skin-match-decision-engine.js"],
  ["policy runtime", "lib/candidate-exposure-policy.js"],
  ["shadow runtime", "lib/candidate-exposure-policy-shadow.js"]
];
for (const [name, path] of staticSources) {
  const source = readFileSync(path, "utf8");
  equal(source.includes("candidate-exposure-policy-isolated-preview-canary-harness-design"), false, `${name} does not import design contract`);
  equal(source.includes("reviewCandidateExposurePolicyIsolatedCanaryHarnessDesign"), false, `${name} does not consume design contract`);
}

const forbiddenImplementationFiles = evidence.design.stage11fFilePlan.map((entry) => entry.path);
for (const path of forbiddenImplementationFiles) {
  equal(existsSync(path), false, `${path} is not implemented in Stage 11E`);
}

const hostedWorkflowPatterns = [
  "vercel deploy",
  "/api/analyze",
  "VERCEL_TOKEN",
  "protection-bypass",
  "x-vercel-protection-bypass",
  "run-candidate-exposure-policy-isolated-preview-canary"
];
for (const name of readdirSync(".github/workflows")) {
  const source = readFileSync(`.github/workflows/${name}`, "utf8");
  for (const pattern of hostedWorkflowPatterns) {
    equal(source.includes(pattern), false, `${name} does not contain Hosted harness pattern ${pattern}`);
  }
}

const serialized = readFileSync(evidencePath, "utf8");
for (const forbiddenSecretPattern of [
  "VERCEL_TOKEN",
  "_vercel_share",
  "x-vercel-protection-bypass",
  "Bearer vcp_"
]) {
  equal(serialized.includes(forbiddenSecretPattern), false, `${forbiddenSecretPattern} is absent`);
}

console.log(
  "check-candidate-exposure-policy-isolated-preview-canary-harness-design: PASS " +
  `(${assertions} assertions, ${designGapMutations.length} design-gap controls, ` +
  `${boundaryMutations.length} boundary controls)`
);
