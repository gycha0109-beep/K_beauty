import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const contract = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/manual-roll-capture.contract.json",
    "utf8"
  )
);
const receipt = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/manual-roll-capture-receipt.json",
    "utf8"
  )
);
const runOutput = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/manual-roll-stability-run-output.json",
    "utf8"
  )
);
const reviewPacket = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/manual-roll-stability-review-packet.json",
    "utf8"
  )
);

assert.equal(contract.schemaVersion, "face-lab-manual-roll-capture-contract-v0");
assert.equal(contract.status, "capture_measured_additional_evidence_required");
assert.equal(contract.nuisanceClass, "head_roll");
assert.equal(
  contract.captureReceiptRef,
  "evidence/facelab/source-intake/v0/manual-roll-capture-receipt.json"
);
assert.deepEqual(contract.captureProtocol.requiredViews, [
  "neutral_front",
  "roll_left",
  "roll_right"
]);
assert.equal(contract.captureProtocol.sameSessionRequired, true);
assert.equal(contract.captureProtocol.syntheticRotationAllowed, false);
assert.equal(contract.captureProtocol.warpAugmentationAllowed, false);
assert.equal(contract.captureProtocol.mirroredImageSubstitutionAllowed, false);
assert.equal(contract.captureProtocol.rollAngleThresholdDegrees, null);
assert.equal(contract.captureProtocol.targetRollDegrees, null);
assert.equal(contract.captureProtocol.angleThresholdAuthority, false);

assert.equal(contract.consent.explicitConsentRequired, true);
assert.equal(contract.consent.consentEvidenceRefRequired, true);
assert.equal(contract.consent.usageScopeMustBeRecorded, true);
assert.equal(contract.consent.commercialResearchUseMustBeExplicitIfApplicable, true);
assert.equal(contract.consent.biometricIdentityMatchingAllowed, false);
assert.equal(contract.consent.identityEmbeddingAllowed, false);

assert.equal(contract.storage.rawImagesPersistedInRepository, false);
assert.equal(contract.storage.rawImagesPersistedInEvidencePackets, false);
assert.equal(contract.storage.rawLandmarksPersisted, false);
assert.equal(contract.storage.localImagePathsPersistedInEvidencePackets, false);
assert.equal(contract.storage.sourceImageSha256ReceiptsAllowed, true);
assert.equal(contract.storage.transientLocalPathsAllowedOnlyDuringMeasurement, true);

assert.equal(contract.readiness.captureDataPresent, true);
assert.equal(contract.readiness.rollEvidencePresent, true);
assert.equal(contract.readiness.descriptiveReviewPacketPresent, true);
assert.equal(contract.readiness.adequacyDecisionPresent, true);
assert.equal(
  contract.readiness.adequacyDecisionCode,
  "ADDITIONAL_EVIDENCE_REQUIRED"
);
assert.equal(contract.readiness.provisionalResearchGateGranted, false);
assert.equal(contract.readiness.additionalEvidenceRequired, true);
assert.equal(contract.readiness.currentSubjectCount, 1);
assert.equal(contract.readiness.currentObservationCount, 2);
assert.deepEqual(contract.expansionRequirement.reasonCodes, [
  "head_roll_subject_diversity_limited",
  "head_roll_distributional_evidence_limited"
]);
assert.equal(
  contract.expansionRequirement.additionalSubjectDiversityRequired,
  true
);
assert.equal(contract.expansionRequirement.exactMinimumSubjectCount, null);
assert.equal(
  contract.expansionRequirement.automaticAdequacyAtSubjectCount,
  false
);
assert.equal(
  contract.expansionRequirement.sameSessionCaptureUnitRetained,
  true
);
assert.equal(
  contract.expansionRequirement.numericRollThresholdIntroduced,
  false
);
assert.equal(
  contract.expansionRequirement.syntheticSubstitutionAllowed,
  false
);
assert.equal(
  contract.expansionRequirement.reReviewRequiredAfterExpansion,
  true
);
assert.equal(
  contract.measurementEvidenceRef,
  "evidence/facelab/photo-geometry/v0/manual-roll-stability-run-output.json"
);
assert.equal(
  contract.descriptiveReviewPacketRef,
  "evidence/facelab/photo-geometry/v0/manual-roll-stability-review-packet.json"
);

assert.equal(receipt.schemaVersion, "face-lab-manual-roll-capture-receipt-v0");
assert.equal(receipt.status, "capture_measured_review_packet_ready");
assert.equal(receipt.nuisanceClass, "head_roll");
assert.equal(receipt.commercialResearchUseAuthorized, true);
assert.equal(receipt.subjectCount, 1);
assert.equal(receipt.subjects.length, 1);
assert.equal(receipt.captureValidation.requiredViewsPresent, true);
assert.equal(receipt.captureValidation.sameSessionDeclared, true);
assert.equal(receipt.captureValidation.headRollViewsSelectedWithoutYawSubstitution, true);
assert.equal(receipt.captureValidation.numericRollThresholdApplied, false);
assert.equal(receipt.captureValidation.measurementExecuted, true);
assert.equal(
  receipt.captureValidation.measurementEvidenceRef,
  contract.measurementEvidenceRef
);
assert.equal(
  receipt.captureValidation.descriptiveReviewPacketRef,
  contract.descriptiveReviewPacketRef
);

for (const subject of receipt.subjects) {
  assert.match(subject.subjectId, /^[a-zA-Z0-9_-]+$/);
  assert.equal(subject.sameSession, true);
  assert.equal(subject.explicitConsent, true);
  assert.equal(subject.biometricIdentityMatchPerformed, false);
  assert.equal(subject.syntheticRotationApplied, false);
  assert.equal(subject.warpAugmentationApplied, false);
  assert.deepEqual(
    Object.keys(subject.views).sort(),
    ["neutralFront", "rollLeft", "rollRight"].sort()
  );
  for (const view of Object.values(subject.views)) {
    assert.match(view.sampleId, /^[a-zA-Z0-9_-]+$/);
    assert.match(view.sha256, /^[a-f0-9]{64}$/);
    assert.equal(view.mediaType, "image/jpeg");
    assert.ok(Number.isInteger(view.width) && view.width > 0);
    assert.ok(Number.isInteger(view.height) && view.height > 0);
  }
}

assert.equal(receipt.privacy.rawImagesPersistedInRepository, false);
assert.equal(receipt.privacy.rawImagesPersistedInEvidencePackets, false);
assert.equal(receipt.privacy.rawLandmarksPersisted, false);
assert.equal(receipt.privacy.localImagePathsPersisted, false);
assert.equal(receipt.privacy.identityEmbeddingCreated, false);
assert.equal(receipt.privacy.biometricIdentityMatchPerformed, false);
assert.equal(receipt.privacy.sourceImageSha256ReceiptsOnly, true);

assert.equal(runOutput.schemaVersion, "face-lab-real-photo-stability-run-output-v0");
assert.equal(runOutput.ok, true);
assert.equal(runOutput.reports.length, 2);
assert.deepEqual(runOutput.manifestSummary.coveredNuisanceClasses, ["head_roll"]);
assert.equal(
  reviewPacket.sourceCollectionFingerprint,
  runOutput.collectionSummary.collectionFingerprint
);
assert.equal(reviewPacket.sourceReportCount, runOutput.reports.length);
assert.deepEqual(reviewPacket.sourceCoveredNuisanceClasses, ["head_roll"]);
assert.equal(reviewPacket.reviewSemantics.descriptiveOnly, true);
assert.equal(reviewPacket.reviewSemantics.thresholdsApplied, false);
assert.equal(reviewPacket.reviewSemantics.automaticPassFail, false);
assert.equal(reviewPacket.reviewSemantics.automaticRanking, false);

const subject = receipt.subjects[0];
const leftReport = runOutput.reports.find((report) =>
  report.pairGroupId.endsWith("_left")
);
const rightReport = runOutput.reports.find((report) =>
  report.pairGroupId.endsWith("_right")
);
assert.ok(leftReport && rightReport);
assert.equal(
  subject.views.neutralFront.sha256,
  leftReport.executionProvenance.referenceImageSha256
);
assert.equal(
  subject.views.neutralFront.sha256,
  rightReport.executionProvenance.referenceImageSha256
);
assert.equal(
  subject.views.rollLeft.sha256,
  leftReport.executionProvenance.candidateImageSha256
);
assert.equal(
  subject.views.rollRight.sha256,
  rightReport.executionProvenance.candidateImageSha256
);

for (const authority of [contract.authority, receipt.authority]) {
  assert.equal(authority.productionAuthority, false);
  assert.equal(authority.normalizationAuthority, false);
  assert.equal(authority.thresholdAuthority, false);
  assert.equal(authority.adequacyDecisionAuthority, false);
  assert.equal(authority.populationAuthority, false);
}

const serialized = JSON.stringify({ contract, receipt, runOutput, reviewPacket });
assert.equal(serialized.includes("/mnt/data/"), false);
assert.equal(serialized.includes("\\mnt\\data\\"), false);
assert.equal(serialized.includes('"path"'), false);

console.log(JSON.stringify({
  ok: true,
  nuisanceClass: "head_roll",
  captureDataPresent: true,
  rollEvidencePresent: true,
  descriptiveReviewPacketPresent: true,
  adequacyDecisionCode: "ADDITIONAL_EVIDENCE_REQUIRED",
  additionalEvidenceRequired: true,
  measurementExecuted: true,
  angleThresholdAuthority: false,
  rawImagesPersistedInRepository: false,
  localImagePathsPersisted: false,
  productionAuthority: false
}, null, 2));
