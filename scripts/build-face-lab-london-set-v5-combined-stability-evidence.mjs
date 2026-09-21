import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import {
  summarizeRealPhotoStabilityCollection
} from "../lib/face-lab-real-photo-stability-evidence.js";
import {
  buildRealPhotoStabilityReviewPacket
} from "../lib/face-lab-real-photo-stability-review-packet.js";

const [
  expressionRunPath,
  yawRunPath,
  contractInputPath,
  reviewPacketOutputPath,
  contractOutputPath
] = process.argv.slice(2);

assert.ok(
  expressionRunPath &&
    yawRunPath &&
    contractInputPath &&
    reviewPacketOutputPath &&
    contractOutputPath,
  "Usage: node scripts/build-face-lab-london-set-v5-combined-stability-evidence.mjs <expression-run.json> <yaw-run.json> <contract-input.json> <review-packet-output.json> <contract-output.json>"
);

const expression = JSON.parse(readFileSync(expressionRunPath, "utf8"));
const yaw = JSON.parse(readFileSync(yawRunPath, "utf8"));
const contract = JSON.parse(readFileSync(contractInputPath, "utf8"));

function validateRunOutput(runOutput, expectedClass, expectedCount) {
  assert.equal(
    runOutput.schemaVersion,
    "face-lab-real-photo-stability-run-output-v0"
  );
  assert.equal(runOutput.ok, true);
  assert.equal(runOutput.productionAuthority, false);
  assert.equal(runOutput.normalizationAuthority, false);
  assert.equal(runOutput.thresholdAuthority, false);
  assert.equal(runOutput.reports.length, expectedCount);
  assert.equal(runOutput.manifestSummary.pairCount, expectedCount);
  assert.deepEqual(runOutput.manifestSummary.coveredNuisanceClasses, [
    expectedClass
  ]);
  assert.equal(runOutput.privacy.sourceImagePersisted, false);
  assert.equal(runOutput.privacy.rawLandmarksPersisted, false);
  assert.equal(runOutput.privacy.identityEmbeddingCreated, false);
  assert.equal(runOutput.privacy.biometricIdentityMatchPerformed, false);
  assert.equal(runOutput.privacy.outputContainsStructuralEvidenceOnly, true);
  for (const report of runOutput.reports) {
    assert.equal(report.nuisance.class, expectedClass);
    assert.equal(report.authority.productionAuthority, false);
    assert.equal(report.authority.normalizationAuthority, false);
    assert.equal(report.authority.thresholdAuthority, false);
    assert.equal(report.privacy.sourceImagePersisted, false);
    assert.equal(report.privacy.rawLandmarksPersisted, false);
    assert.equal(report.privacy.identityEmbeddingCreated, false);
    assert.equal(report.privacy.biometricIdentityMatchPerformed, false);
  }
}

validateRunOutput(expression, "expression", 102);
validateRunOutput(yaw, "head_yaw", 204);

const reports = [...expression.reports, ...yaw.reports];
assert.equal(reports.length, 306);
assert.equal(new Set(reports.map((report) => report.pairGroupId)).size, 306);

const collection = summarizeRealPhotoStabilityCollection(reports);
assert.equal(collection.reportCount, 306);
assert.equal(collection.opaquePairGroupCount, 306);
assert.deepEqual(collection.coveredNuisanceClasses, [
  "expression",
  "head_yaw"
]);
assert.deepEqual(collection.missingNuisanceClasses, [
  "head_pitch",
  "head_roll"
]);
assert.equal(collection.realPhotoPoseAndExpressionCoverage, "incomplete");
assert.equal(
  collection.readinessContribution.realExpressionEvidenceKind,
  "real_photo_same_subject"
);
assert.equal(collection.readinessContribution.realPoseEvidenceKind, null);

const packetVersion =
  "london-set-v5-expression-yaw-stability-review-v1";
const reviewPacket = buildRealPhotoStabilityReviewPacket({
  reports,
  packetVersion
});

assert.equal(reviewPacket.sourceReportCount, 306);
assert.deepEqual(reviewPacket.sourceCoveredNuisanceClasses, [
  "expression",
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
assert.equal(contract.productionAuthority, false);
assert.equal(contract.normalizationAuthority, false);
assert.equal(contract.thresholdAuthority, false);

const nextContract = structuredClone(contract);
nextContract.status =
  "expression_yaw_review_packet_ready_pitch_roll_incomplete";
nextContract.currentEvidence = {
  realPhotoReportCollectionPresent: true,
  sourceReportCount: 306,
  collectionFingerprint: collection.collectionFingerprint,
  sourceRunManifestDigests: collection.runManifestDigests,
  coveredNuisanceClasses: collection.coveredNuisanceClasses,
  missingNuisanceClasses: collection.missingNuisanceClasses,
  completeNuisanceCoverage: false,
  descriptiveReviewPacketPresent: true,
  reviewPacketRef:
    "evidence/facelab/photo-geometry/v0/london-set-v5-expression-yaw-stability-review-packet.json",
  reviewPacketVersion: packetVersion,
  reviewPacketFingerprint: reviewPacket.reviewPacketFingerprint,
  componentEvidence: {
    expression: {
      runOutputRef:
        "evidence/facelab/photo-geometry/v0/london-set-v5-expression-stability-run-output.json",
      reviewPacketRef:
        "evidence/facelab/photo-geometry/v0/london-set-v5-expression-stability-review-packet.json",
      reportCount: 102,
      collectionFingerprint:
        expression.collectionSummary.collectionFingerprint
    },
    headYaw: {
      runOutputRef:
        "evidence/facelab/photo-geometry/v0/london-set-v5-yaw-stability-run-output.json",
      reviewPacketRef:
        "evidence/facelab/photo-geometry/v0/london-set-v5-yaw-stability-review-packet.json",
      reportCount: 204,
      collectionFingerprint:
        yaw.collectionSummary.collectionFingerprint
    }
  },
  adequacyDecisionPresent: false,
  status: "review_ready_pitch_roll_incomplete"
};

assert.equal(nextContract.currentEvidence.adequacyDecisionPresent, false);
assert.equal(nextContract.productionAuthority, false);
assert.equal(nextContract.normalizationAuthority, false);
assert.equal(nextContract.thresholdAuthority, false);

writeFileSync(
  reviewPacketOutputPath,
  JSON.stringify(reviewPacket, null, 2) + "\n",
  "utf8"
);
writeFileSync(
  contractOutputPath,
  JSON.stringify(nextContract, null, 2) + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      reportCount: 306,
      coveredNuisanceClasses: collection.coveredNuisanceClasses,
      missingNuisanceClasses: collection.missingNuisanceClasses,
      collectionFingerprint: collection.collectionFingerprint,
      reviewPacketFingerprint: reviewPacket.reviewPacketFingerprint,
      adequacyDecisionPresent: false,
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false
    },
    null,
    2
  )
);
