import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const [reviewPacketPath, contractPath] = process.argv.slice(2);
assert.ok(
  reviewPacketPath && contractPath,
  "Usage: node scripts/verify-face-lab-london-set-v5-combined-stability-evidence.mjs <review-packet.json> <contract.json>"
);

const rollRunPath =
  "evidence/facelab/photo-geometry/v0/manual-roll-stability-run-output.json";
const roll = JSON.parse(readFileSync(rollRunPath, "utf8"));
const reviewPacket = JSON.parse(
  readFileSync(reviewPacketPath, "utf8")
);
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

assert.equal(
  roll.schemaVersion,
  "face-lab-real-photo-stability-run-output-v0"
);
assert.equal(roll.ok, true);
assert.ok(roll.reports.length > 0);
assert.equal(roll.reports.length % 2, 0);
assert.deepEqual(
  roll.manifestSummary.coveredNuisanceClasses,
  ["head_roll"]
);
assert.equal(roll.productionAuthority, false);
assert.equal(roll.normalizationAuthority, false);
assert.equal(roll.thresholdAuthority, false);

const expectedReportCount = 486 + roll.reports.length;

assert.equal(
  reviewPacket.packetVersion,
  "real-photo-expression-yaw-pitch-roll-stability-review-v1"
);
assert.equal(reviewPacket.sourceReportCount, expectedReportCount);
assert.deepEqual(reviewPacket.sourceCoveredNuisanceClasses, [
  "expression",
  "head_pitch",
  "head_roll",
  "head_yaw"
]);
assert.equal(reviewPacket.reviewSemantics.descriptiveOnly, true);
assert.equal(reviewPacket.reviewSemantics.thresholdsApplied, false);
assert.equal(reviewPacket.reviewSemantics.automaticPassFail, false);
assert.equal(reviewPacket.reviewSemantics.automaticRanking, false);
assert.equal(reviewPacket.authority.productionAuthority, false);
assert.equal(reviewPacket.authority.normalizationAuthority, false);
assert.equal(reviewPacket.authority.thresholdAuthority, false);
assert.equal(reviewPacket.authority.adequacyDecisionAuthority, false);

assert.equal(
  contract.schemaVersion,
  "face-lab-real-photo-stability-adequacy-contract-v0"
);
assert.equal(
  contract.status,
  "expression_yaw_pitch_roll_review_packet_ready_adequacy_pending"
);
assert.equal(
  contract.currentEvidence.sourceReportCount,
  expectedReportCount
);
assert.deepEqual(
  contract.currentEvidence.coveredNuisanceClasses,
  ["expression", "head_pitch", "head_roll", "head_yaw"]
);
assert.deepEqual(
  contract.currentEvidence.missingNuisanceClasses,
  []
);
assert.equal(
  contract.currentEvidence.completeNuisanceCoverage,
  true
);
assert.equal(
  contract.currentEvidence.descriptiveReviewPacketPresent,
  true
);
assert.equal(
  contract.currentEvidence.reviewPacketRef,
  "evidence/facelab/photo-geometry/v0/real-photo-expression-yaw-pitch-roll-stability-review-packet.json"
);
assert.equal(
  contract.currentEvidence.componentEvidence.expression.reportCount,
  102
);
assert.equal(
  contract.currentEvidence.componentEvidence.headYaw.reportCount,
  204
);
assert.equal(
  contract.currentEvidence.componentEvidence.headPitch.reportCount,
  180
);
assert.equal(
  contract.currentEvidence.componentEvidence.headRoll.reportCount,
  roll.reports.length
);
assert.equal(
  contract.currentEvidence.adequacyDecisionPresent,
  false
);
assert.equal(
  contract.currentEvidence.status,
  "review_ready_adequacy_pending"
);
assert.equal(contract.productionAuthority, false);
assert.equal(contract.normalizationAuthority, false);
assert.equal(contract.thresholdAuthority, false);

assert.match(
  contract.currentEvidence.collectionFingerprint,
  /^sha256:[a-f0-9]{64}$/
);
assert.match(
  contract.currentEvidence.reviewPacketFingerprint,
  /^sha256:[a-f0-9]{64}$/
);

const serialized = JSON.stringify({
  roll,
  reviewPacket,
  contract
});
assert.equal(serialized.includes("/home/runner/"), false);
assert.equal(serialized.includes(".research/"), false);
assert.equal(
  serialized.includes("identityEmbeddingCreated\":true"),
  false
);

console.log(JSON.stringify({
  ok: true,
  reportCount: expectedReportCount,
  rollReportCount: roll.reports.length,
  completeNuisanceCoverage: true,
  adequacyDecisionPresent: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
}, null, 2));
