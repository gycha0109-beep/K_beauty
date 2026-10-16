import assert from "node:assert/strict";
import { summarizeSkinVisionOperationalPairs as summarize, SKIN_VISION_OPERATIONAL_METRICS_VERSION } from "./skin-vision-v2-operational-metrics.mjs";
const record = (caseId, variant, elapsedMs, cost, result = "STRUCTURALLY_VALID") => ({
  caseId, variant, structuralResult: result, elapsedMs,
  estimatedCostMicroUsd: cost, costSource: cost === null ? "unavailable" : "operator_estimate"
});
const rows = [
  record("SYN01", "v1", 1000, 100), record("SYN01", "v2", 1400, 175),
  record("SYN02", "v1", 900, 110), record("SYN02", "v2", 1100, 120)
];
const done = summarize(rows);
assert.equal(done.version, SKIN_VISION_OPERATIONAL_METRICS_VERSION);
assert.equal(done.matchedPairs, 2);
assert.equal(done.unmatchedCases, 0);
assert.equal(done.pairedTimings, 2);
assert.equal(done.pairedCosts, 2);
assert.equal(done.v2Slower, 2);
assert.equal(done.v2MoreExpensive, 2);
assert.deepEqual(done.latencyMs.v2, { count: 2, mean: 1250, median: 1250, p95: 1400, max: 1400 });
assert.deepEqual(done.latencyMs.delta, { count: 2, mean: 300, median: 300, p95: 400, max: 400 });
assert.equal(done.estimatedCostMicroUsd.delta.mean, 43);
assert.equal(done.verdict, "MEASUREMENT_CAPTURE_COMPLETE_REVIEW_REQUIRED");
assert.equal(done.providerTestingApproved, false);
assert.equal(done.actualProviderCompatibilityVerified, false);
assert.equal(done.productReady, false);
assert.equal(done.releaseReady, false);
assert.equal(done.liveProviderCallsByEvaluator, 0);
assert.equal(done.personalDataPersistedByEvaluator, false);
assert.deepEqual(summarize([...rows].reverse()), done);
const partial = summarize([rows[0], rows[1], record("SYN02", "v1", null, null), record("SYN02", "v2", 1200, null)]);
assert.equal(partial.pairedTimings, 1);
assert.equal(partial.pairedCosts, 1);
assert.equal(partial.measurementCoverageComplete, false);
assert.equal(partial.verdict, "MEASUREMENT_EVIDENCE_INCOMPLETE");
assert.equal(summarize(rows.slice(0, 3)).unmatchedCases, 1);
assert.equal(summarize([record("SYN01", "v1", 100, 1), record("SYN01", "v2", 90, 0, "INVALID_OR_INCOMPLETE")]).bothStructurallyValid, 0);
assert.equal(summarize(rows, { evidenceOrigin: "operator_unverified" }).actualProviderCompatibilityVerified, false);
assert.throws(() => summarize([rows[0], rows[0]]), /duplicate_variant_for_case/);
assert.throws(() => summarize([]), /invalid_operational_rows/);
assert.throws(() => summarize(rows, { evidenceOrigin: "provider_verified" }), /invalid_evidence_origin/);
assert.throws(() => summarize([record("face@example.com", "v1", 1, 1)]), /invalid_operational_trial_identity/);
assert.throws(() => summarize([record("SYN", "v1", -1, 1)]), /invalid_operational_measurement/);
assert.throws(() => summarize([record("SYN", "v1", 1.1, 1)]), /invalid_operational_measurement/);
assert.throws(() => summarize([record("SYN", "v1", 1, -1)]), /invalid_operational_measurement/);
assert.throws(() => summarize([{ ...record("SYN", "v1", 1, 1), imageUrl: "https://example.com/face.jpg" }]), /invalid_operational_row_shape/);
assert.throws(() => summarize([{ ...record("SYN", "v1", 1, 1), rawProviderResponse: "SECRET" }]), /invalid_operational_row_shape/);
assert.throws(() => summarize([{ ...record("SYN", "v1", 1, 1), costSource: "invoice_verified" }]), /invalid_operational_measurement/);
assert.throws(() => summarize([{ ...record("SYN", "v1", 1, 1), costSource: "unavailable" }]), /invalid_operational_measurement/);
assert.throws(() => summarize([{ ...record("SYN", "v1", 1, 1), elapsedMs: 600001 }]), /invalid_operational_measurement/);
assert(!JSON.stringify(done).includes("SYN01"));
console.log("verify-face-lab-s1b-operational-metrics: PASS (synthetic metadata only; no Provider test or release authorization)");
