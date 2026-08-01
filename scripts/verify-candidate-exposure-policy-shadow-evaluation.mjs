import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  CANDIDATE_EXPOSURE_POLICY_SHADOW_ELIGIBILITY_STATUSES,
  reviewCandidateExposurePolicyShadowEligibility
} from "../lib/candidate-exposure-policy-shadow-eligibility.js";
import {
  classifyCandidateExposureDivergence,
  validateCandidateExposurePolicyShadowTelemetry
} from "../lib/candidate-exposure-policy-observability.js";
import { resolveCandidateExposurePolicyShadowControl } from "../lib/candidate-exposure-policy-shadow.js";

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

execFileSync(process.execPath, ["scripts/verify-candidate-exposure-policy-shadow-runtime.mjs"], {
  stdio: "inherit"
});

const controlCases = [
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1", VERCEL_ENV: "preview", NODE_ENV: "production" }, true, false],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1", VERCEL_ENV: "development" }, true, false],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1", NODE_ENV: "development" }, true, false],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1", NODE_ENV: "production" }, false, true],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1" }, false, false],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1", VERCEL_ENV: "unknown", NODE_ENV: "development" }, false, false],
  [{
    DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1",
    DISABLE_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1",
    VERCEL_ENV: "preview"
  }, false, false]
];
for (const [env, enabled, hardDisabled] of controlCases) {
  const control = resolveCandidateExposurePolicyShadowControl(env);
  equal(control.enabled, enabled, `control enabled ${JSON.stringify(env)}`);
  equal(control.productionHardDisabled, hardDisabled, `control hard-disable ${JSON.stringify(env)}`);
}

const validTelemetry = {
  schemaVersion: "candidate-exposure-policy-shadow-aggregate-v1",
  policyVersion: "candidate-exposure-policy-v1",
  contextVersion: "shared-skin-decision-context-v4",
  mode: "shadow_only",
  candidateCount: 2,
  exposureCounts: { hidden: 1, primary: 1 },
  laneEligibilityCounts: {
    topPick: 1,
    supporting: 1,
    budget: 1,
    routine: 1,
    treatment: 1
  },
  reasonCodeCounts: { canonical_goal_match: 1, irritation_risk: 1 },
  currentFindingsState: "valid_empty",
  divergenceCategoryCounts: { equivalent: 1, expected_exposure_state_expansion: 1 },
  invalidContextCount: 0,
  fallbackCount: 0,
  executionStatus: "executed",
  errorCategory: "none",
  responseFingerprintMatch: true,
  snapshotFingerprintMatch: true,
  candidateOrderMatch: true,
  shadowExceptionCount: 0
};

equal(validateCandidateExposurePolicyShadowTelemetry(validTelemetry).valid, true, "valid telemetry accepted");

const telemetryMutations = [
  ["unknown exposure key", (value) => { value.exposureCounts.unknown = 0; }],
  ["exposure total mismatch", (value) => { value.exposureCounts.primary = 0; }],
  ["missing lane", (value) => { delete value.laneEligibilityCounts.budget; }],
  ["lane exceeds candidates", (value) => { value.laneEligibilityCounts.topPick = 3; }],
  ["unknown reason", (value) => { value.reasonCodeCounts.raw_product_reason = 1; }],
  ["unknown divergence", (value) => { value.divergenceCategoryCounts.unclassified = 1; }],
  ["divergence total mismatch", (value) => { value.divergenceCategoryCounts.equivalent = 0; }],
  ["invalid findings state", (value) => { value.currentFindingsState = "unknown"; }],
  ["invalid mode", (value) => { value.mode = "runtime"; }],
  ["executed with fallback", (value) => { value.fallbackCount = 1; }],
  ["failure without error", (value) => { value.executionStatus = "execution_failed"; }],
  ["forbidden nested identifier", (value) => { value.reasonCodeCounts.productId = 1; }]
];
for (const [name, mutate] of telemetryMutations) {
  const value = structuredClone(validTelemetry);
  mutate(value);
  equal(validateCandidateExposurePolicyShadowTelemetry(value).valid, false, `${name} rejected`);
}

const divergenceFixtures = [
  [{ exposure: "primary", reasonCodes: ["canonical_goal_match"] }, "primary", "equivalent"],
  [{ exposure: "insufficient_evidence", reasonCodes: ["invalid_context"] }, "primary", "expected_invalid_context_hardening"],
  [{ exposure: "contextual", reasonCodes: ["invalid_context"] }, "primary", "unexpected_divergence"],
  [{ exposure: "hidden", reasonCodes: ["already_using"] }, "primary", "expected_current_product_semantics"],
  [{ exposure: "contextual", reasonCodes: ["already_using"] }, "primary", "unexpected_divergence"],
  [{ exposure: "hidden", reasonCodes: ["irritation_risk"] }, "primary", "expected_exposure_state_expansion"],
  [{ exposure: "contextual", reasonCodes: ["irritation_risk"] }, "primary", "unexpected_divergence"],
  [{ exposure: "primary", reasonCodes: ["canonical_goal_match"] }, "hidden", "expected_canonical_goal_alignment"],
  [{ exposure: "hidden", reasonCodes: ["canonical_goal_match"] }, "primary", "unexpected_divergence"],
  [{ exposure: "contextual", reasonCodes: [] }, "primary", "unexpected_divergence"]
];
for (const [decision, legacy, expected] of divergenceFixtures) {
  equal(classifyCandidateExposureDivergence(decision, legacy), expected, `${legacy} -> ${decision.exposure}`);
}

const completeEvidence = {
  implementation: {
    productionHardDisabled: true,
    selfHostedProductionHardDisabled: true,
    killSwitchPrecedence: true,
    malformedEnvironmentDisabled: true,
    telemetryContractStrict: true,
    divergenceClassifierStrict: true,
    runtimeFilterConnected: false,
    responseMutationConnected: false,
    storageMutationConnected: false,
    productionConfigurationChanged: false
  },
  local: {
    shadowVerifierPass: true,
    assertions: 193,
    currentProductFixtures: 12,
    safetyFixtures: 13,
    securityCloseoutPass: true,
    architectureGuardPass: true,
    productionBuildPass: true
  },
  catalog: {
    loadedRows: 164,
    scorerCompatibleRows: 164,
    scenarios: 4,
    candidateRows: 656,
    highRiskCollapsedCount: 0
  },
  hosted: {
    workflowPass: true,
    implementationSha: "current-exact-sha",
    currentImplementationSha: "current-exact-sha",
    analyzeCallCount: 4,
    http200Count: 4,
    runtimeCommitMatchCount: 4,
    premiumFinalStageCount: 4,
    defaultOffShadowExecutionCount: 0,
    responseFingerprintMatchCount: 2,
    snapshotFingerprintMatchCount: 2,
    candidateOrderMatchCount: 2,
    unexpectedDivergenceCount: 0,
    unclassifiedDivergenceCount: 0,
    shadowExceptionCount: 0,
    fallbackCount: 0,
    invalidContextCount: 0
  }
};

const eligible = reviewCandidateExposurePolicyShadowEligibility(completeEvidence);
equal(
  eligible.status,
  "eligible_for_limited_preview_canary_plan",
  "complete exact-SHA evidence is eligible only for a Preview canary plan"
);
equal(eligible.runtimeActivationAuthorized, false, "runtime activation remains unauthorized");
equal(eligible.productionActivationAuthorized, false, "Production activation remains unauthorized");
equal(eligible.recommendedNextStage, "stage_11d_limited_preview_canary_plan");

const staleHosted = structuredClone(completeEvidence);
staleHosted.hosted.currentImplementationSha = "new-implementation-sha";
const staleReview = reviewCandidateExposurePolicyShadowEligibility(staleHosted);
equal(staleReview.status, "blocked_pending_exact_sha_hosted_revalidation");
deepEqual(staleReview.blockers, ["hosted_exact_sha_revalidation_required"]);

const unsafeImplementation = structuredClone(completeEvidence);
unsafeImplementation.implementation.selfHostedProductionHardDisabled = false;
const unsafeReview = reviewCandidateExposurePolicyShadowEligibility(unsafeImplementation);
equal(unsafeReview.status, "blocked_remediation_required");
ok(unsafeReview.blockers.includes("self_hosted_production_hard_disable_unproven"));

const unexpectedHosted = structuredClone(completeEvidence);
unexpectedHosted.hosted.unexpectedDivergenceCount = 1;
const unexpectedReview = reviewCandidateExposurePolicyShadowEligibility(unexpectedHosted);
equal(unexpectedReview.status, "blocked_remediation_required");
ok(unexpectedReview.blockers.includes("hosted_unexpected_divergence_nonzero"));

deepEqual(CANDIDATE_EXPOSURE_POLICY_SHADOW_ELIGIBILITY_STATUSES, [
  "eligible_for_limited_preview_canary_plan",
  "blocked_pending_exact_sha_hosted_revalidation",
  "blocked_remediation_required"
]);

const resultDoc = readFileSync(
  "docs/verification/candidate-exposure-policy-shadow-runtime-result.md",
  "utf8"
);
ok(resultDoc.includes("CANDIDATE_EXPOSURE_POLICY_SHADOW_INTEGRATION_PASS"));
ok(resultDoc.includes("GitHub Actions run: `30709349633`, success"));
ok(resultDoc.includes("Unexpected divergence: 0"));
ok(resultDoc.includes("Shadow exception: 0"));

const routeSource = readFileSync("app/api/analyze/route.js", "utf8");
const engineSource = readFileSync("lib/skin-match-decision-engine.js", "utf8");
ok(!routeSource.includes("candidateExposurePolicyShadowResult"), "route does not consume shadow result");
ok(!engineSource.includes("candidate-exposure-policy"), "engine runtime filtering remains disconnected");

console.log(
  `verify-candidate-exposure-policy-shadow-evaluation: PASS (${assertions} assertions, ` +
  `${telemetryMutations.length} telemetry negative controls, ${divergenceFixtures.length} divergence fixtures)`
);
