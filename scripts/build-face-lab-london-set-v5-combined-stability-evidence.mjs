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
  pitchRunPath,
  contractInputPath,
  reviewPacketOutputPath,
  contractOutputPath
] = process.argv.slice(2);

assert.ok(
  expressionRunPath &&
    yawRunPath &&
    pitchRunPath &&
    contractInputPath &&
    reviewPacketOutputPath &&
    contractOutputPath,
  "Usage: node scripts/build-face-lab-london-set-v5-combined-stability-evidence.mjs <expression-run.json> <yaw-run.json> <pitch-run.json> <contract-input.json> <review-packet-output.json> <contract-output.json>"
);

const rollRunPath =
  "evidence/facelab/photo-geometry/v0/manual-roll-stability-run-output.json";
const supplementalRollRunPath =
  "evidence/facelab/photo-geometry/v0/supplemental-roll-stability-run-output.json";
const expression = JSON.parse(readFileSync(expressionRunPath, "utf8"));
const yaw = JSON.parse(readFileSync(yawRunPath, "utf8"));
const pitch = JSON.parse(readFileSync(pitchRunPath, "utf8"));
const roll = JSON.parse(readFileSync(rollRunPath, "utf8"));
const supplementalRoll = JSON.parse(readFileSync(supplementalRollRunPath, "utf8"));
const contract = JSON.parse(readFileSync(contractInputPath, "utf8"));

function validateRunOutput(
  runOutput,
  expectedClass,
  expectedCount = null
) {
  assert.equal(
    runOutput.schemaVersion,
    "face-lab-real-photo-stability-run-output-v0"
  );
  assert.equal(runOutput.ok, true);
  assert.equal(runOutput.productionAuthority, false);
  assert.equal(runOutput.normalizationAuthority, false);
  assert.equal(runOutput.thresholdAuthority, false);
  assert.ok(runOutput.reports.length > 0);
  if (expectedCount !== null) {
    assert.equal(runOutput.reports.length, expectedCount);
  }
  assert.equal(
    runOutput.manifestSummary.pairCount,
    runOutput.reports.length
  );
  assert.deepEqual(
    runOutput.manifestSummary.coveredNuisanceClasses,
    [expectedClass]
  );
  assert.equal(runOutput.privacy.sourceImagePersisted, false);
  assert.equal(runOutput.privacy.rawLandmarksPersisted, false);
  assert.equal(runOutput.privacy.identityEmbeddingCreated, false);
  assert.equal(
    runOutput.privacy.biometricIdentityMatchPerformed,
    false
  );

  for (const report of runOutput.reports) {
    assert.equal(report.nuisance.class, expectedClass);
    assert.equal(report.authority.productionAuthority, false);
    assert.equal(report.authority.normalizationAuthority, false);
    assert.equal(report.authority.thresholdAuthority, false);
    assert.equal(report.privacy.sourceImagePersisted, false);
    assert.equal(report.privacy.rawLandmarksPersisted, false);
    assert.equal(report.privacy.identityEmbeddingCreated, false);
    assert.equal(
      report.privacy.biometricIdentityMatchPerformed,
      false
    );
  }
}

validateRunOutput(expression, "expression", 102);
validateRunOutput(yaw, "head_yaw", 204);
validateRunOutput(pitch, "head_pitch", 180);
validateRunOutput(roll, "head_roll", 2);
validateRunOutput(supplementalRoll, "head_roll", 4);
const rollReports = [...roll.reports, ...supplementalRoll.reports];
const rollCollection = summarizeRealPhotoStabilityCollection(rollReports);
assert.equal(rollReports.length, 6);
assert.equal(new Set(rollReports.map((report) => report.subjectLinkage.evidenceRef)).size, 3);
assert.equal(rollCollection.collectionFingerprint, "sha256:872b8dcafa9d20ac93139e199e9b4e42a8c5120b0df835a2fe3b08cf71e73a54");

const reports = [
  ...expression.reports,
  ...yaw.reports,
  ...pitch.reports,
  ...rollReports
];
const expectedReportCount = 492;
assert.equal(reports.length, expectedReportCount);
assert.equal(
  new Set(reports.map((report) => report.pairGroupId)).size,
  expectedReportCount
);

const collection = summarizeRealPhotoStabilityCollection(reports);
assert.equal(collection.reportCount, expectedReportCount);
assert.equal(collection.opaquePairGroupCount, expectedReportCount);
assert.deepEqual(collection.coveredNuisanceClasses, [
  "expression",
  "head_pitch",
  "head_roll",
  "head_yaw"
]);
assert.deepEqual(collection.missingNuisanceClasses, []);
assert.equal(
  collection.realPhotoPoseAndExpressionCoverage,
  "covered_for_research"
);
assert.equal(
  collection.readinessContribution.realExpressionEvidenceKind,
  "real_photo_same_subject"
);
assert.equal(
  collection.readinessContribution.realPoseEvidenceKind,
  "real_photo_same_subject"
);

const packetVersion =
  "real-photo-expression-yaw-pitch-roll-stability-review-v2";
const reviewPacket = buildRealPhotoStabilityReviewPacket({
  reports,
  packetVersion
});

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
assert.equal(contract.productionAuthority, false);
assert.equal(contract.normalizationAuthority, false);
assert.equal(contract.thresholdAuthority, false);

const nextContract = structuredClone(contract);
nextContract.status =
  "expression_yaw_pitch_roll_review_packet_ready_adequacy_pending";
nextContract.currentEvidence = {
  realPhotoReportCollectionPresent: true,
  sourceReportCount: expectedReportCount,
  collectionFingerprint: collection.collectionFingerprint,
  sourceRunManifestDigests: collection.runManifestDigests,
  coveredNuisanceClasses: collection.coveredNuisanceClasses,
  missingNuisanceClasses: collection.missingNuisanceClasses,
  completeNuisanceCoverage: true,
  descriptiveReviewPacketPresent: true,
  reviewPacketRef:
    "generated://face-lab/real-photo-expression-yaw-pitch-roll-stability-review-v2",
  reviewPacketVersion: packetVersion,
  reviewPacketFingerprint: reviewPacket.reviewPacketFingerprint,
  componentEvidence: {
    expression: {
      runOutputRef:
        "evidence/facelab/photo-geometry/v0/london-set-v5-expression-stability-run-output.json",
      reportCount: 102,
      collectionFingerprint:
        expression.collectionSummary.collectionFingerprint
    },
    headYaw: {
      runOutputRef:
        "evidence/facelab/photo-geometry/v0/london-set-v5-yaw-stability-run-output.json",
      reportCount: 204,
      collectionFingerprint:
        yaw.collectionSummary.collectionFingerprint
    },
    headPitch: {
      runOutputRef:
        "evidence/facelab/photo-geometry/v0/pointing04-pitch-stability-run-output.json",
      reportCount: 180,
      collectionFingerprint:
        pitch.collectionSummary.collectionFingerprint
    },
    headRoll: {
      runOutputRefs: [
        "evidence/facelab/photo-geometry/v0/manual-roll-stability-run-output.json",
        "evidence/facelab/photo-geometry/v0/supplemental-roll-stability-run-output.json"
      ],
      historicalReviewPacketRef:
        "evidence/facelab/photo-geometry/v0/manual-roll-stability-review-packet.json",
      reportCount: 6,
      governedCaptureReportCount: 2,
      supplementalReportCount: 4,
      subjectLinkageEvidenceRefCount: 3,
      collectionFingerprint: rollCollection.collectionFingerprint
    }
  },
  adequacyDecisionPresent: false,
  status: "review_ready_adequacy_pending"
};

assert.equal(nextContract.currentEvidence.completeNuisanceCoverage, true);
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

console.log(JSON.stringify({
  ok: true,
  reportCount: expectedReportCount,
  rollReportCount: rollReports.length,
  rollSubjectLinkageEvidenceRefCount: 3,
  coveredNuisanceClasses: collection.coveredNuisanceClasses,
  missingNuisanceClasses: collection.missingNuisanceClasses,
  completeNuisanceCoverage: true,
  collectionFingerprint: collection.collectionFingerprint,
  reviewPacketFingerprint: reviewPacket.reviewPacketFingerprint,
  adequacyDecisionPresent: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
}, null, 2));
