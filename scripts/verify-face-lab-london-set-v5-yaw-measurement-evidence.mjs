import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  summarizeRealPhotoStabilityCollection
} from "../lib/face-lab-real-photo-stability-evidence.js";
import {
  buildFaceLabNormalizationReviewPacketFromRunOutput
} from "../lib/face-lab-normalization-review-packet-run-output.js";

const [runOutputPath, reviewPacketPath] = process.argv.slice(2);
assert.ok(
  runOutputPath && reviewPacketPath,
  "Usage: node scripts/verify-face-lab-london-set-v5-yaw-measurement-evidence.mjs <run-output.json> <review-packet.json>"
);

const runOutput = JSON.parse(readFileSync(runOutputPath, "utf8"));
const reviewPacket = JSON.parse(readFileSync(reviewPacketPath, "utf8"));

assert.equal(
  runOutput.schemaVersion,
  "face-lab-real-photo-stability-run-output-v0"
);
assert.equal(runOutput.ok, true);
assert.equal(runOutput.productionAuthority, false);
assert.equal(runOutput.normalizationAuthority, false);
assert.equal(runOutput.thresholdAuthority, false);

assert.equal(runOutput.manifestSummary.pairCount, 204);
assert.equal(runOutput.manifestSummary.opaqueSampleCount, 306);
assert.deepEqual(runOutput.manifestSummary.coveredNuisanceClasses, [
  "head_yaw"
]);
assert.deepEqual(runOutput.manifestSummary.missingNuisanceClasses, [
  "expression",
  "head_pitch",
  "head_roll"
]);
assert.equal(runOutput.manifestSummary.completeNuisanceCoverage, false);

assert.equal(runOutput.reports.length, 204);
const pairIds = new Set();
for (const report of runOutput.reports) {
  assert.equal(report.nuisance.class, "head_yaw");
  assert.match(
    report.pairGroupId,
    /^london_v5_yaw_(left|right)_\d{3}$/
  );
  assert.equal(pairIds.has(report.pairGroupId), false);
  pairIds.add(report.pairGroupId);
  assert.equal(
    report.subjectLinkage.method,
    "dataset_same_subject_provenance"
  );
  assert.match(
    report.subjectLinkage.evidenceRef,
    /^https:\/\/doi\.org\/10\.6084\/m9\.figshare\.5047666\.v5#subject-\d{3}$/
  );
  assert.equal(
    report.subjectLinkage.biometricIdentityMatchPerformed,
    false
  );
  assert.equal(report.authority.productionAuthority, false);
  assert.equal(report.authority.normalizationAuthority, false);
  assert.equal(report.authority.thresholdAuthority, false);
  assert.equal(report.privacy.sourceImagePersisted, false);
  assert.equal(report.privacy.rawLandmarksPersisted, false);
  assert.equal(report.privacy.identityEmbeddingCreated, false);
  assert.equal(report.privacy.biometricIdentityMatchPerformed, false);
}

const collection = summarizeRealPhotoStabilityCollection(runOutput.reports);
assert.equal(collection.reportCount, 204);
assert.equal(collection.opaquePairGroupCount, 204);
assert.deepEqual(collection.coveredNuisanceClasses, ["head_yaw"]);
assert.deepEqual(
  [...collection.missingNuisanceClasses].sort(),
  ["expression", "head_pitch", "head_roll"]
);
assert.equal(collection.realPhotoPoseAndExpressionCoverage, "incomplete");
assert.equal(
  collection.readinessContribution.realPoseEvidenceKind,
  null
);
assert.equal(
  collection.readinessContribution.realExpressionEvidenceKind,
  null
);
assert.equal(
  collection.collectionFingerprint,
  runOutput.collectionSummary.collectionFingerprint
);

const rebuiltReview =
  buildFaceLabNormalizationReviewPacketFromRunOutput({
    kind: "real-photo-stability",
    runOutput,
    packetVersion: "london-set-v5-yaw-stability-review-v1"
  });
assert.deepEqual(reviewPacket, rebuiltReview);
assert.equal(reviewPacket.sourceReportCount, 204);
assert.deepEqual(reviewPacket.sourceCoveredNuisanceClasses, ["head_yaw"]);
assert.equal(reviewPacket.reviewSemantics.descriptiveOnly, true);
assert.equal(reviewPacket.reviewSemantics.thresholdsApplied, false);
assert.equal(reviewPacket.reviewSemantics.automaticPassFail, false);
assert.equal(reviewPacket.reviewSemantics.automaticRanking, false);
assert.equal(reviewPacket.authority.productionAuthority, false);
assert.equal(reviewPacket.authority.normalizationAuthority, false);
assert.equal(reviewPacket.authority.thresholdAuthority, false);
assert.equal(reviewPacket.authority.adequacyDecisionAuthority, false);

assert.equal(runOutput.privacy.sourceImagePersisted, false);
assert.equal(runOutput.privacy.rawLandmarksPersisted, false);
assert.equal(runOutput.privacy.identityEmbeddingCreated, false);
assert.equal(runOutput.privacy.biometricIdentityMatchPerformed, false);
assert.equal(runOutput.privacy.outputContainsStructuralEvidenceOnly, true);

const serialized = JSON.stringify({ runOutput, reviewPacket });
assert.equal(serialized.includes(".research/"), false);
assert.equal(serialized.includes("/home/runner/"), false);
assert.equal(serialized.includes("identityEmbeddingCreated\":true"), false);

console.log(
  JSON.stringify(
    {
      ok: true,
      pairCount: 204,
      realYawEvidenceKind: "real_photo_same_subject",
      coveredNuisanceClasses: ["head_yaw"],
      missingNuisanceClasses: ["expression", "head_pitch", "head_roll"],
      collectionFingerprint: collection.collectionFingerprint,
      reviewPacketFingerprint: reviewPacket.reviewPacketFingerprint,
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false,
      adequacyDecisionAuthority: false
    },
    null,
    2
  )
);
