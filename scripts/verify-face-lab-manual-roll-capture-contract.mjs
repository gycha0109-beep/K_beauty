import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const contract = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/manual-roll-capture.contract.json",
    "utf8"
  )
);

assert.equal(
  contract.schemaVersion,
  "face-lab-manual-roll-capture-contract-v0"
);
assert.equal(contract.status, "capture_protocol_ready_evidence_absent");
assert.equal(contract.nuisanceClass, "head_roll");
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
assert.equal(
  contract.consent.commercialResearchUseMustBeExplicitIfApplicable,
  true
);
assert.equal(contract.consent.biometricIdentityMatchingAllowed, false);
assert.equal(contract.consent.identityEmbeddingAllowed, false);

assert.equal(contract.storage.rawImagesPersistedInRepository, false);
assert.equal(contract.storage.rawImagesPersistedInEvidencePackets, false);
assert.equal(contract.storage.rawLandmarksPersisted, false);
assert.equal(
  contract.storage.localImagePathsPersistedInEvidencePackets,
  false
);
assert.equal(contract.storage.sourceImageSha256ReceiptsAllowed, true);
assert.equal(
  contract.storage.transientLocalPathsAllowedOnlyDuringMeasurement,
  true
);

assert.equal(contract.readiness.captureDataPresent, false);
assert.equal(contract.readiness.rollEvidencePresent, false);
assert.equal(contract.readiness.descriptiveReviewPacketPresent, false);
assert.equal(contract.readiness.adequacyDecisionPresent, false);
assert.equal(contract.authority.productionAuthority, false);
assert.equal(contract.authority.normalizationAuthority, false);
assert.equal(contract.authority.thresholdAuthority, false);
assert.equal(contract.authority.adequacyDecisionAuthority, false);
assert.equal(contract.authority.populationAuthority, false);

console.log(JSON.stringify({
  ok: true,
  nuisanceClass: "head_roll",
  captureDataPresent: false,
  rollEvidencePresent: false,
  angleThresholdAuthority: false,
  productionAuthority: false
}, null, 2));
