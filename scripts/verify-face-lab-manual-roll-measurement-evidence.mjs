import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  summarizeRealPhotoStabilityCollection
} from "../lib/face-lab-real-photo-stability-evidence.js";
import {
  buildFaceLabNormalizationReviewPacketFromRunOutput
} from "../lib/face-lab-normalization-review-packet-run-output.js";

const [captureSpecPath, runOutputPath, reviewPacketPath] =
  process.argv.slice(2);
assert.ok(
  captureSpecPath && runOutputPath && reviewPacketPath,
  "Usage: node scripts/verify-face-lab-manual-roll-measurement-evidence.mjs <capture-spec.json> <run-output.json> <review-packet.json>"
);

const spec = JSON.parse(readFileSync(captureSpecPath, "utf8"));
const runOutput = JSON.parse(readFileSync(runOutputPath, "utf8"));
const reviewPacket = JSON.parse(readFileSync(reviewPacketPath, "utf8"));

assert.equal(spec.schemaVersion, "face-lab-manual-roll-capture-spec-v0");
assert.equal(spec.nuisanceClass, "head_roll");
assert.equal(spec.commercialResearchUseAuthorized, true);
assert.ok(Array.isArray(spec.subjects) && spec.subjects.length > 0);

const expectedPairCount = spec.subjects.length * 2;
const expectedSampleCount = spec.subjects.length * 3;

assert.equal(
  runOutput.schemaVersion,
  "face-lab-real-photo-stability-run-output-v0"
);
assert.equal(runOutput.ok, true);
assert.equal(runOutput.manifestSummary.pairCount, expectedPairCount);
assert.equal(
  runOutput.manifestSummary.opaqueSampleCount,
  expectedSampleCount
);
assert.deepEqual(
  runOutput.manifestSummary.coveredNuisanceClasses,
  ["head_roll"]
);
assert.deepEqual(
  runOutput.manifestSummary.missingNuisanceClasses,
  ["expression", "head_pitch", "head_yaw"]
);
assert.equal(runOutput.manifestSummary.completeNuisanceCoverage, false);
assert.equal(runOutput.reports.length, expectedPairCount);

const expectedSubjectIds = new Set(
  spec.subjects.map((subject) => subject.subjectId)
);
const observedSubjectIds = new Set();
const pairIds = new Set();

for (const report of runOutput.reports) {
  assert.equal(report.nuisance.class, "head_roll");
  assert.match(
    report.pairGroupId,
    /^manual_roll_[a-zA-Z0-9_-]+_(left|right)$/
  );
  assert.equal(pairIds.has(report.pairGroupId), false);
  pairIds.add(report.pairGroupId);

  const match =
    /^manual_roll_(.+)_(left|right)$/.exec(report.pairGroupId);
  assert.ok(match);
  assert.equal(expectedSubjectIds.has(match[1]), true);
  observedSubjectIds.add(match[1]);

  assert.equal(
    report.subjectLinkage.method,
    "manual_same_subject_pair"
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
  assert.equal(
    report.privacy.biometricIdentityMatchPerformed,
    false
  );
}

assert.deepEqual(
  [...observedSubjectIds].sort(),
  [...expectedSubjectIds].sort()
);

const collection =
  summarizeRealPhotoStabilityCollection(runOutput.reports);
assert.equal(collection.reportCount, expectedPairCount);
assert.equal(collection.opaquePairGroupCount, expectedPairCount);
assert.deepEqual(collection.coveredNuisanceClasses, ["head_roll"]);
assert.deepEqual(
  [...collection.missingNuisanceClasses].sort(),
  ["expression", "head_pitch", "head_yaw"]
);
assert.equal(
  collection.realPhotoPoseAndExpressionCoverage,
  "incomplete"
);
assert.equal(
  collection.collectionFingerprint,
  runOutput.collectionSummary.collectionFingerprint
);

const rebuiltReview =
  buildFaceLabNormalizationReviewPacketFromRunOutput({
    kind: "real-photo-stability",
    runOutput,
    packetVersion: "manual-roll-stability-review-v1"
  });
assert.deepEqual(reviewPacket, rebuiltReview);
assert.equal(reviewPacket.sourceReportCount, expectedPairCount);
assert.deepEqual(
  reviewPacket.sourceCoveredNuisanceClasses,
  ["head_roll"]
);
assert.equal(reviewPacket.reviewSemantics.descriptiveOnly, true);
assert.equal(reviewPacket.reviewSemantics.thresholdsApplied, false);
assert.equal(reviewPacket.reviewSemantics.automaticPassFail, false);
assert.equal(reviewPacket.reviewSemantics.automaticRanking, false);
assert.equal(reviewPacket.authority.productionAuthority, false);
assert.equal(reviewPacket.authority.normalizationAuthority, false);
assert.equal(reviewPacket.authority.thresholdAuthority, false);
assert.equal(
  reviewPacket.authority.adequacyDecisionAuthority,
  false
);

assert.equal(runOutput.privacy.sourceImagePersisted, false);
assert.equal(runOutput.privacy.rawLandmarksPersisted, false);
assert.equal(runOutput.privacy.identityEmbeddingCreated, false);
assert.equal(
  runOutput.privacy.biometricIdentityMatchPerformed,
  false
);
assert.equal(
  runOutput.privacy.outputContainsStructuralEvidenceOnly,
  true
);

const serialized = JSON.stringify({ runOutput, reviewPacket });
for (const subject of spec.subjects) {
  for (const view of ["neutralFront", "rollLeft", "rollRight"]) {
    assert.equal(
      serialized.includes(pathToken(subject[view].path)),
      false,
      "manual_roll_local_path_leaked"
    );
  }
}
assert.equal(serialized.includes("identityEmbeddingCreated\":true"), false);

function pathToken(value) {
  return String(value).replaceAll("\\\\", "/");
}

console.log(JSON.stringify({
  ok: true,
  subjectCount: spec.subjects.length,
  pairCount: expectedPairCount,
  realRollEvidenceKind: "real_photo_same_subject",
  coveredNuisanceClasses: ["head_roll"],
  missingNuisanceClasses: ["expression", "head_pitch", "head_yaw"],
  collectionFingerprint: collection.collectionFingerprint,
  reviewPacketFingerprint: reviewPacket.reviewPacketFingerprint,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false,
  adequacyDecisionAuthority: false
}, null, 2));
