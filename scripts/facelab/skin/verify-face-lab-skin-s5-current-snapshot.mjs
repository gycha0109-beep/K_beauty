import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateSkinReadiness, SKIN_PRODUCT_GATES, SKIN_RELEASE_GATES,
  SKIN_READINESS_VERSION
} from "./skin-s5-readiness-gate.mjs";

// Public metadata-only research snapshot; deliberately no Human/photo/Provider data.
const source = "docs/domain/facelab/skin-s5-readiness-snapshot-20261017.json";
const manifest = JSON.parse(readFileSync(source, "utf8"));
assert.equal(manifest.schemaVersion, SKIN_READINESS_VERSION);
assert.deepEqual(Object.keys(manifest).sort(), ["gateEvidence", "schemaVersion"]);
const expectedGates = {...SKIN_PRODUCT_GATES, ...SKIN_RELEASE_GATES};
assert.deepEqual(Object.keys(manifest.gateEvidence).sort(), Object.keys(expectedGates).sort());
for (const [gate, family] of Object.entries(expectedGates)) {
  assert.deepEqual(Object.keys(manifest.gateEvidence[gate]).sort(), ["family", "status"]);
  assert.equal(manifest.gateEvidence[gate].family, family);
  assert.equal(manifest.gateEvidence[gate].status, gate === "sca_security" ? "fail" : "hold");
}
const result = evaluateSkinReadiness(manifest);
assert.equal(result.product.evidenceStatus, "HOLD");
assert.equal(result.product.pending.length, 5);
assert.equal(result.release.evidenceStatus, "BLOCKED");
assert.deepEqual(result.release.failed, ["sca_security"]);
assert.equal(result.release.pending.length, 6);
assert.equal(result.authority.productReadyAuthorized, false);
assert.equal(result.authority.releaseReadyAuthorized, false);
assert.equal(result.authority.realEvidenceAuthenticityVerified, false);
assert.equal(result.authority.noProductionWrites, true);

// Explicitly refuse to promote structural or synthetic-only S1/S2/S3/S4 records
// to the distinct product-level Human/real-capture/device acceptance gate.
for(const item of ["s1_independent_human_accuracy","s2_human_decision_safety",
  "s3_real_capture_repeatability","s4_mobile_web_uat"]){
  assert.equal(manifest.gateEvidence[item].status,"hold");
}
console.log("verify-face-lab-skin-s5-current-snapshot: PASS (PRODUCT HOLD / RELEASE BLOCKED; research evidence only)");
