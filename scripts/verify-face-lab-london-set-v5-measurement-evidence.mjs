import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateFaceSpaceReferenceCorpus
} from "../lib/face-lab-face-space-reference-corpus.js";
import {
  summarizeRealPhotoStabilityCollection
} from "../lib/face-lab-real-photo-stability-evidence.js";
import {
  buildFaceLabNormalizationReviewPacketFromRunOutput
} from "../lib/face-lab-normalization-review-packet-run-output.js";

const reference = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-corpus-run-output.json",
    "utf8"
  )
);
const expression = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/london-set-v5-expression-stability-run-output.json",
    "utf8"
  )
);
const referenceReviewPacket = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-corpus-review-packet.json",
    "utf8"
  )
);
const expressionReviewPacket = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/london-set-v5-expression-stability-review-packet.json",
    "utf8"
  )
);
const referenceAdequacyContract = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/reference-corpus-adequacy.contract.json",
    "utf8"
  )
);
const stabilityAdequacyContract = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/real-photo-stability-adequacy.contract.json",
    "utf8"
  )
);

assert.equal(reference.ok, true);
assert.equal(
  reference.schemaVersion,
  "face-space-reference-corpus-measurement-run-output-v0"
);
assert.equal(reference.sourceSummary.recordCount, 102);
assert.deepEqual(reference.sourceSummary.splitCounts, {
  reference: 82,
  holdout: 20
});
assert.equal(
  reference.sourceSummary.sourceManifestDigest,
  "sha256:663954cd1670ff1e70ee372397b357e4b5ef0936cd21307ea217667c458d0cd9"
);
const referenceSummary = validateFaceSpaceReferenceCorpus(reference.corpus);
assert.equal(referenceSummary.recordCount, 102);
assert.equal(
  referenceSummary.referenceSplitFingerprint,
  "sha256:6f9a051dd204db73e35a2866aebdeb49f83a8e0ad557d97c3036427af5d44ccf"
);
assert.equal(reference.authority.productionAuthority, false);
assert.equal(reference.authority.normalizationAuthority, false);
assert.equal(reference.authority.thresholdAuthority, false);
assert.equal(reference.privacy.outputContainsLocalImagePaths, false);
assert.equal(reference.privacy.sourceImagePersisted, false);
assert.equal(reference.privacy.rawLandmarksPersisted, false);
assert.equal(reference.privacy.identityEmbeddingCreated, false);
assert.equal(reference.privacy.biometricIdentityMatchPerformed, false);
const rebuiltReferenceReviewPacket =
  buildFaceLabNormalizationReviewPacketFromRunOutput({
    kind: "reference-corpus",
    runOutput: reference,
    packetVersion: "london-set-v5-reference-corpus-review-v1"
  });
assert.deepEqual(referenceReviewPacket, rebuiltReferenceReviewPacket);
assert.equal(referenceReviewPacket.reviewSemantics.descriptiveOnly, true);
assert.equal(
  referenceReviewPacket.reviewSemantics.holdoutMeasurementValuesIncluded,
  false
);
assert.equal(
  referenceReviewPacket.authority.adequacyDecisionAuthority,
  false
);
assert.equal(
  referenceAdequacyContract.currentEvidence.realReferenceCorpusPresent,
  true
);
assert.equal(
  referenceAdequacyContract.currentEvidence.descriptiveReviewPacketPresent,
  true
);
assert.equal(
  referenceAdequacyContract.currentEvidence.reviewPacketFingerprint,
  referenceReviewPacket.reviewPacketFingerprint
);
assert.equal(
  referenceAdequacyContract.currentEvidence.adequacyDecisionPresent,
  false
);

assert.equal(expression.ok, true);
assert.equal(
  expression.schemaVersion,
  "face-lab-real-photo-stability-run-output-v0"
);
assert.equal(expression.manifestSummary.pairCount, 102);
assert.deepEqual(expression.manifestSummary.coveredNuisanceClasses, [
  "expression"
]);
assert.deepEqual(expression.manifestSummary.missingNuisanceClasses, [
  "head_pitch",
  "head_roll",
  "head_yaw"
]);
assert.equal(expression.manifestSummary.completeNuisanceCoverage, false);
const expressionSummary = summarizeRealPhotoStabilityCollection(
  expression.reports
);
assert.equal(
  expressionSummary.collectionFingerprint,
  "sha256:915f3c17833e7072e5e3cd75d48b30a9efc7b3ef28c163f433ab9f457573a77a"
);
assert.equal(expressionSummary.reportCount, 102);
assert.equal(
  expressionSummary.readinessContribution.realExpressionEvidenceKind,
  "real_photo_same_subject"
);
assert.equal(
  expressionSummary.readinessContribution.realPoseEvidenceKind,
  null
);
assert.equal(expression.productionAuthority, false);
assert.equal(expression.normalizationAuthority, false);
assert.equal(expression.thresholdAuthority, false);
assert.equal(expression.privacy.sourceImagePersisted, false);
assert.equal(expression.privacy.rawLandmarksPersisted, false);
assert.equal(expression.privacy.identityEmbeddingCreated, false);
assert.equal(expression.privacy.biometricIdentityMatchPerformed, false);
const rebuiltExpressionReviewPacket =
  buildFaceLabNormalizationReviewPacketFromRunOutput({
    kind: "real-photo-stability",
    runOutput: expression,
    packetVersion: "london-set-v5-expression-stability-review-v1"
  });
assert.deepEqual(expressionReviewPacket, rebuiltExpressionReviewPacket);
assert.deepEqual(
  expressionReviewPacket.sourceCoveredNuisanceClasses,
  ["expression"]
);
assert.equal(expressionReviewPacket.reviewSemantics.descriptiveOnly, true);
assert.equal(expressionReviewPacket.reviewSemantics.thresholdsApplied, false);
assert.equal(
  expressionReviewPacket.authority.adequacyDecisionAuthority,
  false
);
assert.equal(
  stabilityAdequacyContract.currentEvidence.realPhotoReportCollectionPresent,
  true
);
assert.deepEqual(
  stabilityAdequacyContract.currentEvidence.missingNuisanceClasses,
  ["head_pitch", "head_roll", "head_yaw"]
);
assert.equal(
  stabilityAdequacyContract.currentEvidence.completeNuisanceCoverage,
  false
);
assert.equal(
  stabilityAdequacyContract.currentEvidence.reviewPacketFingerprint,
  expressionReviewPacket.reviewPacketFingerprint
);
assert.equal(
  stabilityAdequacyContract.currentEvidence.adequacyDecisionPresent,
  false
);

const serialized = JSON.stringify({ reference, expression });
assert.equal(serialized.includes(".research/london-source"), false);
assert.equal(serialized.includes("identityEmbedding"), true);

console.log(JSON.stringify({
  ok: true,
  referenceCorpusRecords: 102,
  referenceSamples: 82,
  holdoutSamples: 20,
  expressionPairs: 102,
  realExpressionEvidenceKind: "real_photo_same_subject",
  realPoseEvidenceKind: null,
  missingNuisanceClasses: ["head_yaw", "head_pitch", "head_roll"],
  referenceReviewPacketFingerprint: referenceReviewPacket.reviewPacketFingerprint,
  expressionReviewPacketFingerprint: expressionReviewPacket.reviewPacketFingerprint,
  descriptiveReviewPacketsFrozen: true,
  adequacyDecisionPresent: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
}, null, 2));
