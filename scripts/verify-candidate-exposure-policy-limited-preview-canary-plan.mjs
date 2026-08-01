import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CANDIDATE_EXPOSURE_POLICY_LIMITED_PREVIEW_CANARY_PLAN_STATUSES,
  reviewCandidateExposurePolicyLimitedPreviewCanaryPlan
} from "../lib/candidate-exposure-policy-limited-preview-canary-plan.js";

const evidence = JSON.parse(readFileSync(
  "docs/verification/candidate-exposure-policy-limited-preview-canary-plan.json",
  "utf8"
));

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

const ready = reviewCandidateExposurePolicyLimitedPreviewCanaryPlan({
  eligibility: evidence.eligibility,
  plan: evidence.plan
});

deepEqual(ready, {
  version: "candidate-exposure-policy-limited-preview-canary-plan-v1",
  status: "plan_ready",
  blockers: [],
  runtimeActivationAuthorized: false,
  productionActivationAuthorized: false,
  publicTrafficAuthorized: false,
  recommendedNextStage: "stage_11e_isolated_preview_canary_harness"
});

equal(evidence.authorization.planDesign, true, "plan design is authorized");
equal(evidence.authorization.isolatedHarnessImplementation, false, "harness implementation is not authorized by Stage 11D");
equal(evidence.authorization.runtimeFilterConnection, false, "runtime filter connection is not authorized");
equal(evidence.authorization.publicTraffic, false, "public traffic is not authorized");
equal(evidence.authorization.production, false, "Production is not authorized");

const staleEligibility = structuredClone(evidence);
staleEligibility.eligibility.status = "blocked_pending_exact_sha_hosted_revalidation";
const staleEligibilityReview = reviewCandidateExposurePolicyLimitedPreviewCanaryPlan(staleEligibility);
equal(staleEligibilityReview.status, "blocked_evidence_stale");
ok(staleEligibilityReview.blockers.includes("eligibility_status_not_ready"));

const staleSha = structuredClone(evidence);
staleSha.plan.implementationSha = "different-runtime-sha";
const staleShaReview = reviewCandidateExposurePolicyLimitedPreviewCanaryPlan(staleSha);
equal(staleShaReview.status, "blocked_evidence_stale");
ok(staleShaReview.blockers.includes("plan_implementation_sha_stale"));

const contractMutations = [
  ["version", (value) => { value.plan.version = "future-version"; }],
  ["environment", (value) => { value.plan.environment = "production"; }],
  ["deployment scope", (value) => { value.plan.deploymentScope = "project_wide"; }],
  ["traffic source", (value) => { value.plan.trafficSource = "public_preview_traffic"; }],
  ["runtime connection", (value) => { value.plan.runtimeConnectionMode = "recommendation_runtime"; }],
  ["request budget low", (value) => { value.plan.maxAnalyzeRequests = 15; }],
  ["request budget high", (value) => { value.plan.maxAnalyzeRequests = 20; }],
  ["duration", (value) => { value.plan.maxDurationMinutes = 61; }],
  ["locale missing", (value) => { value.plan.locales = ["ko"]; }],
  ["locale extra", (value) => { value.plan.locales = ["ko", "en", "ja"]; }],
  ["scenario missing", (value) => { value.plan.scenarios.pop(); }],
  ["scenario extra", (value) => { value.plan.scenarios.push("public_traffic"); }],
  ["pairing", (value) => { value.plan.pairedRequestsPerScenario = 1; }],
  ["stop condition missing", (value) => { delete value.plan.stopConditions.shadowException; }],
  ["stop condition disabled", (value) => { value.plan.stopConditions.unexpectedDivergence = false; }],
  ["default-off control", (value) => { value.plan.defaultOffControlRequired = false; }],
  ["deployment opt-in", (value) => { value.plan.deploymentScopedOptInRequired = false; }],
  ["kill switch", (value) => { value.plan.killSwitchRequired = false; }],
  ["fixture source", (value) => { value.plan.syntheticOrAuthorizedFixtureOnly = false; }],
  ["aggregate telemetry", (value) => { value.plan.aggregateTelemetryOnly = false; }],
  ["isolated projection", (value) => { value.plan.isolatedCandidateProjectionOnly = false; }],
  ["public traffic", (value) => { value.plan.publicTrafficAllowed = true; }],
  ["candidate telemetry", (value) => { value.plan.candidateLevelTelemetryAllowed = true; }],
  ["runtime filtering", (value) => { value.plan.runtimeFilterConnectionAllowed = true; }],
  ["recommendation mutation", (value) => { value.plan.recommendationMutationAllowed = true; }],
  ["response mutation", (value) => { value.plan.responseMutationAllowed = true; }],
  ["storage mutation", (value) => { value.plan.storageMutationAllowed = true; }],
  ["UI mutation", (value) => { value.plan.uiMutationAllowed = true; }],
  ["project env mutation", (value) => { value.plan.projectEnvironmentMutationAllowed = true; }],
  ["Production", (value) => { value.plan.productionAllowed = true; }]
];

for (const [name, mutate] of contractMutations) {
  const value = structuredClone(evidence);
  mutate(value);
  const review = reviewCandidateExposurePolicyLimitedPreviewCanaryPlan(value);
  equal(review.status, "blocked_contract_violation", `${name} fails closed`);
  ok(review.blockers.length > 0, `${name} emits a blocker`);
  equal(review.runtimeActivationAuthorized, false, `${name} cannot authorize runtime activation`);
  equal(review.productionActivationAuthorized, false, `${name} cannot authorize Production`);
  equal(review.publicTrafficAuthorized, false, `${name} cannot authorize public traffic`);
}

deepEqual(CANDIDATE_EXPOSURE_POLICY_LIMITED_PREVIEW_CANARY_PLAN_STATUSES, [
  "plan_ready",
  "blocked_evidence_stale",
  "blocked_contract_violation"
]);

const routeSource = readFileSync("app/api/analyze/route.js", "utf8");
const engineSource = readFileSync("lib/skin-match-decision-engine.js", "utf8");
const fullReportSource = readFileSync("app/api/full-report/route.js", "utf8");
for (const [name, source] of [
  ["analyze route", routeSource],
  ["decision engine", engineSource],
  ["full-report route", fullReportSource]
]) {
  equal(source.includes("candidate-exposure-policy-limited-preview-canary-plan"), false, `${name} does not import canary plan`);
  equal(source.includes("reviewCandidateExposurePolicyLimitedPreviewCanaryPlan"), false, `${name} does not consume canary plan`);
}

const serialized = JSON.stringify(evidence);
for (const forbidden of ["VERCEL_TOKEN", "_vercel_share", "x-vercel-protection-bypass", "customerId", "candidateId", "productId"]) {
  equal(serialized.includes(forbidden), false, `${forbidden} is absent from plan evidence`);
}

console.log(
  `verify-candidate-exposure-policy-limited-preview-canary-plan: PASS (` +
  `${assertions} assertions, ${contractMutations.length} contract negative controls)`
);
