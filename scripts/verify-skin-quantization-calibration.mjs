import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SKIN_QUANTIZATION_APPROVAL_GATE,
  SKIN_QUANTIZATION_POLICIES,
  evaluateSkinQuantizationCalibration,
  quantizeVisibleLevel
} from "../lib/skin-quantization-calibration.js";

const fixtureDocument = JSON.parse(await readFile(
  new URL("./fixtures/skin-quantization-calibration-v1.json", import.meta.url),
  "utf8"
));
const evidence = JSON.parse(await readFile(
  new URL("../docs/verification/skin-quantization-calibration-v1-evidence.json", import.meta.url),
  "utf8"
));
const adapterSource = await readFile(
  new URL("../lib/recommendation-feature-adapters.js", import.meta.url),
  "utf8"
);
const engineSource = await readFile(
  new URL("../lib/skin-match-decision-engine.js", import.meta.url),
  "utf8"
);

assert.equal(fixtureDocument.schemaVersion, "skin-quantization-calibration-fixtures-v1");
assert.equal(fixtureDocument.declaredPurpose, "diagnostic_only_not_ground_truth");
assert.equal(Array.isArray(fixtureDocument.fixtures), true);
assert.equal(fixtureDocument.fixtures.length, 4);

assert.deepEqual(SKIN_QUANTIZATION_POLICIES.conservative_0123_v1.mapping, {
  none: 0,
  mild: 1,
  moderate: 2,
  high: 3
});
assert.deepEqual(SKIN_QUANTIZATION_POLICIES.linear_0135_v1.mapping, {
  none: 0,
  mild: 1,
  moderate: 3,
  high: 5
});
assert.deepEqual(SKIN_QUANTIZATION_POLICIES.capped_0124_v1.mapping, {
  none: 0,
  mild: 1,
  moderate: 2,
  high: 4
});
assert.equal(quantizeVisibleLevel("linear_0135_v1", "moderate"), 3);
assert.throws(() => quantizeVisibleLevel("missing", "mild"), /unknown_skin_quantization_policy/);
assert.throws(() => quantizeVisibleLevel("linear_0135_v1", "severe"), /invalid_visible_level/);

assert.equal(SKIN_QUANTIZATION_APPROVAL_GATE.minimumPositivePairs, 30);
assert.equal(SKIN_QUANTIZATION_APPROVAL_GATE.minimumPairsPerAxis, 3);
assert.deepEqual(SKIN_QUANTIZATION_APPROVAL_GATE.allowedReferenceTypes, [
  "consented_real_label",
  "declared_synthetic_ground_truth"
]);
assert.equal(SKIN_QUANTIZATION_APPROVAL_GATE.requireDownstreamEngineReplay, true);
assert.equal(SKIN_QUANTIZATION_APPROVAL_GATE.requireProductRegression, true);
assert.equal(SKIN_QUANTIZATION_APPROVAL_GATE.requireRoutineRegression, true);

const result = evaluateSkinQuantizationCalibration(fixtureDocument.fixtures);
assert.equal(result.schemaVersion, "skin-quantization-calibration-v1");
assert.equal(result.mode, "offline_shadow_governance");
assert.equal(result.productionAuthoritative, false);
assert.equal(result.activationAllowed, false);
assert.equal(result.outcome, "no_policy_approved");
assert.equal(result.approvedPolicy, null);
assert.equal(result.diagnosticBestPolicy, "linear_0135_v1");
assert.equal(result.policyResults.length, 3);

for (const policy of result.policyResults) {
  assert.equal(policy.positivePairCount, 7);
  assert.deepEqual(policy.referenceTypes, ["legacy_provider_output"]);
  assert.equal(policy.downstreamReplayComplete, false);
  assert.equal(policy.priorityComparableCount, 4);
  assert.equal(policy.priorityFlipCount, 1);
  assert.equal(policy.priorityFlipRate, 0.25);
  assert.equal(policy.gateResults.minimumPositivePairs, false);
  assert.equal(policy.gateResults.minimumPairsPerAxis, false);
  assert.equal(policy.gateResults.provenanceEligible, false);
  assert.equal(policy.gateResults.downstreamEngineReplay, false);
  assert.equal(policy.gateResults.productRegression, false);
  assert.equal(policy.gateResults.routineRegression, false);
  assert.equal(policy.gateResults.priorityFlipRate, false);
  assert.equal(policy.approved, false);
}

const linear = result.policyResults.find((policy) => policy.policyId === "linear_0135_v1");
const conservative = result.policyResults.find((policy) => policy.policyId === "conservative_0123_v1");
const capped = result.policyResults.find((policy) => policy.policyId === "capped_0124_v1");
assert.equal(Number(linear.meanAbsoluteError.toFixed(6)), Number((5 / 7).toFixed(6)));
assert.equal(Number(conservative.meanAbsoluteError.toFixed(6)), Number((6 / 7).toFixed(6)));
assert.equal(Number(capped.meanAbsoluteError.toFixed(6)), Number((6 / 7).toFixed(6)));
assert.equal(linear.exactMatchRate, 2 / 7);
assert.equal(conservative.exactMatchRate, 3 / 7);
assert.equal(capped.exactMatchRate, 3 / 7);

assert.equal(adapterSource.includes("skin-quantization-calibration"), false);
assert.equal(engineSource.includes("skin-quantization-calibration"), false);
assert.equal(engineSource.includes("applyPhotoWeights(scoreCard, photoAnalysis)"), true);
assert.equal(engineSource.includes("clamp(rawValue, 0, 5) * (axis === \"uv\" ? 3 : 4)"), true);

assert.equal(evidence.status, "no_policy_approved");
assert.equal(evidence.productionAuthoritative, false);
assert.equal(evidence.activationAllowed, false);
assert.equal(evidence.diagnosticBestPolicy, result.diagnosticBestPolicy);
assert.equal(evidence.fixtureSummary.positivePairs, 7);
assert.equal(evidence.regression.priorityComparableFixtures, 4);
assert.equal(evidence.regression.priorityFlipsPerPolicy, 1);
assert.equal(evidence.regression.productReplayComplete, false);
assert.equal(evidence.regression.routineReplayComplete, false);
assert.deepEqual(evidence.blockers, [
  "insufficient_positive_pair_count",
  "insufficient_per_axis_coverage",
  "reference_provenance_not_calibration_ground_truth",
  "downstream_engine_replay_missing",
  "product_regression_missing",
  "routine_regression_missing",
  "priority_flip_detected"
]);

console.log(JSON.stringify({
  ok: true,
  checks: 55,
  fixtures: fixtureDocument.fixtures.length,
  policies: result.policyResults.map((policy) => ({
    policyId: policy.policyId,
    positivePairCount: policy.positivePairCount,
    meanAbsoluteError: policy.meanAbsoluteError,
    exactMatchRate: policy.exactMatchRate,
    priorityFlipRate: policy.priorityFlipRate,
    approved: policy.approved
  })),
  diagnosticBestPolicy: result.diagnosticBestPolicy,
  approvedPolicy: result.approvedPolicy,
  outcome: result.outcome,
  productionAuthoritative: result.productionAuthoritative,
  activationAllowed: result.activationAllowed
}, null, 2));
