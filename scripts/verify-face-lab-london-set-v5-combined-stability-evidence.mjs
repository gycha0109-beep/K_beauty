import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  summarizeRealPhotoStabilityCollection
} from "../lib/face-lab-real-photo-stability-evidence.js";
import {
  buildRealPhotoStabilityReviewPacket
} from "../lib/face-lab-real-photo-stability-review-packet.js";

const [reviewPacketPath, contractPath] = process.argv.slice(2);
assert.ok(
  reviewPacketPath && contractPath,
  "Usage: node scripts/verify-face-lab-london-set-v5-combined-stability-evidence.mjs <review-packet.json> <contract.json>"
);

const expression = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/london-set-v5-expression-stability-run-output.json",
    "utf8"
  )
);
const yaw = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/london-set-v5-yaw-stability-run-output.json",
    "utf8"
  )
);
const pitch = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/pointing04-pitch-stability-run-output.json",
    "utf8"
  )
);
const reviewPacket = JSON.parse(readFileSync(reviewPacketPath, "utf8"));
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

const reports = [
  ...expression.reports,
  ...yaw.reports,
  ...pitch.reports
];
assert.equal(reports.length, 486);
assert.equal(new Set(reports.map((report) => report.pairGroupId)).size, 486);

const collection = summarizeRealPhotoStabilityCollection(reports);
assert.equal(collection.reportCount, 486);
assert.deepEqual(collection.coveredNuisanceClasses, [
  "expression",
  "head_pitch",
  "head_yaw"
]);
assert.deepEqual(collection.missingNuisanceClasses, ["head_roll"]);
assert.equal(collection.realPhotoPoseAndExpressionCoverage, "incomplete");
assert.equal(
  collection.readinessContribution.realExpressionEvidenceKind,
  "real_photo_same_subject"
);
assert.equal(collection.readinessContribution.realPoseEvidenceKind, null);

const rebuiltPacket = buildRealPhotoStabilityReviewPacket({
  reports,
  packetVersion:
    "real-photo-expression-yaw-pitch-stability-review-v1"
});
assert.deepEqual(reviewPacket, rebuiltPacket);
assert.equal(reviewPacket.sourceReportCount, 486);
assert.deepEqual(reviewPacket.sourceCoveredNuisanceClasses, [
  "expression",
  "head_pitch",
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
  contract.status,
  "expression_yaw_pitch_review_packet_ready_roll_incomplete"
);
assert.equal(contract.productionAuthority, false);
assert.equal(contract.normalizationAuthority, false);
assert.equal(contract.thresholdAuthority, false);
assert.equal(contract.currentEvidence.realPhotoReportCollectionPresent, true);
assert.equal(contract.currentEvidence.sourceReportCount, 486);
assert.equal(
  contract.currentEvidence.collectionFingerprint,
  collection.collectionFingerprint
);
assert.deepEqual(
  contract.currentEvidence.sourceRunManifestDigests,
  collection.runManifestDigests
);
assert.deepEqual(contract.currentEvidence.coveredNuisanceClasses, [
  "expression",
  "head_pitch",
  "head_yaw"
]);
assert.deepEqual(contract.currentEvidence.missingNuisanceClasses, [
  "head_roll"
]);
assert.equal(contract.currentEvidence.completeNuisanceCoverage, false);
assert.equal(contract.currentEvidence.descriptiveReviewPacketPresent, true);
assert.equal(
  contract.currentEvidence.reviewPacketRef,
  "evidence/facelab/photo-geometry/v0/real-photo-expression-yaw-pitch-stability-review-packet.json"
);
assert.equal(
  contract.currentEvidence.reviewPacketVersion,
  "real-photo-expression-yaw-pitch-stability-review-v1"
);
assert.equal(
  contract.currentEvidence.reviewPacketFingerprint,
  reviewPacket.reviewPacketFingerprint
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
assert.equal(contract.currentEvidence.adequacyDecisionPresent, false);
assert.equal(
  contract.currentEvidence.status,
  "review_ready_roll_incomplete"
);

const serialized = JSON.stringify({ reviewPacket, contract });
assert.equal(serialized.includes("adequate_for_provisional_research"), false);
assert.equal(serialized.includes("/home/runner/"), false);
assert.equal(serialized.includes(".research/"), false);

console.log(JSON.stringify({
  ok: true,
  reportCount: 486,
  coveredNuisanceClasses: ["expression", "head_pitch", "head_yaw"],
  missingNuisanceClasses: ["head_roll"],
  collectionFingerprint: collection.collectionFingerprint,
  reviewPacketFingerprint: reviewPacket.reviewPacketFingerprint,
  adequacyDecisionPresent: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
}, null, 2));
