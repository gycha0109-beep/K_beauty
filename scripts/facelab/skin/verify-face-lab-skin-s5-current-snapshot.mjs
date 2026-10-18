import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateSkinReadiness, SKIN_PRODUCT_GATES, SKIN_RELEASE_GATES,
  SKIN_READINESS_VERSION
} from "./skin-s5-readiness-gate.mjs";

const historical = JSON.parse(readFileSync("docs/domain/facelab/skin-s5-readiness-snapshot-20261017.json", "utf8"));
const historicalResult = evaluateSkinReadiness(historical);
assert.equal(historicalResult.product.evidenceStatus, "HOLD");
assert.equal(historicalResult.release.evidenceStatus, "BLOCKED");
assert.deepEqual(historicalResult.release.failed, ["sca_security"]);

const source = "docs/domain/facelab/skin-s5-readiness-snapshot-20261018.json";
const manifest = JSON.parse(readFileSync(source, "utf8"));
assert.equal(manifest.schemaVersion, SKIN_READINESS_VERSION);
assert.deepEqual(Object.keys(manifest).sort(), ["gateEvidence", "schemaVersion"]);
const expectedGates = { ...SKIN_PRODUCT_GATES, ...SKIN_RELEASE_GATES };
assert.deepEqual(Object.keys(manifest.gateEvidence).sort(), Object.keys(expectedGates).sort());
for (const [gate, family] of Object.entries(expectedGates)) {
  const record = manifest.gateEvidence[gate];
  assert.equal(record.family, family);
  if (gate === "sca_security") {
    assert.deepEqual(Object.keys(record).sort(), ["family", "reference", "status"]);
    assert.equal(record.status, "pass");
    assert.equal(record.reference, "PR1343_fc61d592_SCA_39112482805");
  } else {
    assert.deepEqual(Object.keys(record).sort(), ["family", "status"]);
    assert.equal(record.status, "hold", "other independent gates must not auto-pass with security");
  }
}
const result = evaluateSkinReadiness(manifest);
assert.equal(result.product.evidenceStatus, "HOLD");
assert.equal(result.product.pending.length, 5);
assert.equal(result.release.evidenceStatus, "HOLD");
assert.deepEqual(result.release.failed, []);
assert.equal(result.release.pending.length, 5);
assert.equal(result.release.statuses.find(x => x.gate === "sca_security").reference, "PR1343_fc61d592_SCA_39112482805");
assert.equal(result.authority.productReadyAuthorized, false);
assert.equal(result.authority.releaseReadyAuthorized, false);
assert.equal(result.authority.realEvidenceAuthenticityVerified, false);
assert.equal(result.authority.noProductionWrites, true);

// A verified dependency rollout does not certify Human accuracy, actual
// same-person repeat photos, app UAT, data privacy or Skin release approval.
for (const gate of ["s1_independent_human_accuracy", "s2_human_decision_safety",
  "s3_real_capture_repeatability", "s4_mobile_web_uat", "privacy_consent_retention",
  "auth_rls_storage_review", "production_ci_regression", "rollback_and_monitoring",
  "responsible_owner_approval"]) {
  assert.equal(manifest.gateEvidence[gate].status, "hold");
}
console.log("verify-face-lab-skin-s5-current-snapshot: PASS (20261017 BLOCKED historical / 20261018 SCA PASS; PRODUCT HOLD / RELEASE HOLD)");
