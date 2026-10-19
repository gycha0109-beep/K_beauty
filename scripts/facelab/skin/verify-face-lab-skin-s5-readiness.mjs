import assert from "node:assert/strict";
import {
  evaluateSkinReadiness,
  SKIN_READINESS_VERSION,
  SKIN_PRODUCT_GATES,
  SKIN_RELEASE_GATES
} from "./skin-s5-readiness-gate.mjs";

const manifest = gateEvidence => ({ schemaVersion: SKIN_READINESS_VERSION, gateEvidence });
const blank = evaluateSkinReadiness(manifest({}));
assert.equal(blank.product.evidenceStatus, "HOLD");
assert.equal(blank.release.evidenceStatus, "HOLD");
assert.equal(blank.product.pending.length, 5);
assert.equal(blank.release.pending.length, 6);
assert.equal(blank.authority.releaseReadyAuthorized, false);
assert.equal(blank.authority.productReadyAuthorized, false);

const productEvidence = Object.fromEntries(Object.entries(SKIN_PRODUCT_GATES)
  .map(([key, family]) => [key, { status: "pass", family, reference: "approved_evidence_" + key }]));
const productOnly = evaluateSkinReadiness(manifest(productEvidence));
assert.equal(productOnly.product.evidenceStatus, "EXTERNAL_REVIEW_REQUIRED");
assert.equal(productOnly.release.evidenceStatus, "HOLD");
assert.equal(productOnly.authority.realEvidenceAuthenticityVerified, false);

const combined = { ...productEvidence, ...Object.fromEntries(Object.entries(SKIN_RELEASE_GATES)
  .map(([key, family]) => [key, { status: "pass", family, reference: "review_packet_" + key }])) };
const complete = evaluateSkinReadiness(manifest(combined));
assert.equal(complete.product.evidenceStatus, "EXTERNAL_REVIEW_REQUIRED");
assert.equal(complete.release.evidenceStatus, "EXTERNAL_REVIEW_REQUIRED");
assert.equal(complete.authority.productReadyAuthorized, false);
assert.equal(complete.authority.releaseReadyAuthorized, false);
assert.deepEqual(evaluateSkinReadiness(manifest(combined)), complete);

const securityBlocked = evaluateSkinReadiness(manifest({
  ...combined,
  sca_security: { status: "fail", family: "security" }
}));
assert.equal(securityBlocked.product.evidenceStatus, "EXTERNAL_REVIEW_REQUIRED");
assert.equal(securityBlocked.release.evidenceStatus, "BLOCKED");
assert.deepEqual(securityBlocked.release.failed, ["sca_security"]);

const sourceFail = evaluateSkinReadiness(manifest({
  ...combined,
  s1_independent_human_accuracy: { status: "fail", family: "human" }
}));
assert.equal(sourceFail.product.evidenceStatus, "BLOCKED");
assert.equal(sourceFail.release.evidenceStatus, "BLOCKED");

assert.throws(() => evaluateSkinReadiness(manifest({
  s1_independent_human_accuracy: { status: "pass", family: "synthetic", reference: "fixture_only" }
})), /evidence_family_mismatch/);
assert.throws(() => evaluateSkinReadiness(manifest({
  production_override: { status: "pass", family: "governance", reference: "fake" }
})), /unknown_gate/);
assert.throws(() => evaluateSkinReadiness(manifest({
  s0_current_code_audit: { status: "pass", family: "repository" }
})), /passing_gate_requires_opaque_reference/);
assert.throws(() => evaluateSkinReadiness(manifest({ sca_security: { status: "cleared", family: "security" } })), /invalid_gate_status/);
assert.throws(() => evaluateSkinReadiness({ ...manifest({}), secret: "forbidden" }), /readiness_manifest_invalid/);
console.log("verify-face-lab-skin-s5-readiness: PASS (fail-closed evidence only)");
