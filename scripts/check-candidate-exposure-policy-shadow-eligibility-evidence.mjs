import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewCandidateExposurePolicyShadowEligibility } from "../lib/candidate-exposure-policy-shadow-eligibility.js";

const evidence = JSON.parse(readFileSync(
  "docs/verification/candidate-exposure-policy-shadow-eligibility-evidence.json",
  "utf8"
));

assert.equal(
  evidence.schemaVersion,
  "candidate-exposure-policy-shadow-eligibility-evidence-v1"
);
assert.equal(evidence.draftPullRequest, 100);
assert.equal(evidence.hosted.githubActionsRunId, undefined);
assert.equal(evidence.hosted.expectedCanonicalEvaluatorRebuildCount, 20);
assert.equal(evidence.hosted.temporaryAutomationBypassCreated, true);
assert.equal(evidence.hosted.temporaryAutomationBypassRevoked, true);
assert.equal(evidence.authorization.runtimeActivation, false);
assert.equal(evidence.authorization.productionActivation, false);

const review = reviewCandidateExposurePolicyShadowEligibility({
  implementation: evidence.implementation,
  local: evidence.local,
  catalog: evidence.catalog,
  hosted: evidence.hosted
});

assert.deepEqual(review, {
  version: "candidate-exposure-policy-shadow-eligibility-v1",
  status: "eligible_for_limited_preview_canary_plan",
  blockers: [],
  runtimeActivationAuthorized: false,
  productionActivationAuthorized: false,
  recommendedNextStage: "stage_11d_limited_preview_canary_plan"
});

console.log(
  "check-candidate-exposure-policy-shadow-eligibility-evidence: PASS " +
  `(run ${evidence.githubActionsRunId}, implementation ${evidence.hosted.implementationSha})`
);
