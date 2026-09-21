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

assert.equal(contract.schemaVersion, "face-lab-manual-roll-capture-contract-v0");
assert.equal(contract.status, "capture_received_measurement_pending");
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
assert.equal(contract.readiness.rollEvidencePresent, false);
assert.equal(contract.readiness.descriptiveReviewPacketPresent, false);
assert.equal(contract.readiness.adequacyDecisionPresent, false);

assert.equal(receipt.schemaVersion, "face-lab-manual-roll-capture-receipt-v0");
assert.equal(receipt.status, "capture_received_measurement_pending");
assert.equal(receipt.nuisanceClass, "head_roll");
assert.equal(receipt.commercialResearchUseAuthorized, true);
assert.equal(receipt.subjectCount, 1);
assert.equal(receipt.subjects.length, 1);
assert.equal(receipt.captureValidation.requiredViewsPresent, true);
assert.equal(receipt.captureValidation.sameSessionDeclared, true);
assert.equal(receipt.captureValidation.headRollViewsSelectedWithoutYawSubstitution, true);
assert.equal(receipt.captureValidation.numericRollThresholdApplied, false);
assert.equal(receipt.captureValidation.measurementExecuted, false);

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

for (const authority of [contract.authority, receipt.authority]) {
  assert.equal(authority.productionAuthority, false);
  assert.equal(authority.normalizationAuthority, false);
  assert.equal(authority.thresholdAuthority, false);
  assert.equal(authority.adequacyDecisionAuthority, false);
  assert.equal(authority.populationAuthority, false);
}

const serialized = JSON.stringify({ contract, receipt });
assert.equal(serialized.includes("/mnt/data/"), false);
assert.equal(serialized.includes("\\mnt\\data\\"), false);
assert.equal(serialized.includes('"path"'), false);

console.log(JSON.stringify({
  ok: true,
  nuisanceClass: "head_roll",
  captureDataPresent: true,
  rollEvidencePresent: false,
  measurementExecuted: false,
  angleThresholdAuthority: false,
  rawImagesPersistedInRepository: false,
  localImagePathsPersisted: false,
  productionAuthority: false
}, null, 2));
