import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const contract = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/london-set-v5.contract.json",
    "utf8"
  )
);

assert.equal(
  contract.schemaVersion,
  "face-lab-london-set-v5-source-intake-contract-v0"
);
assert.equal(contract.status, "source_candidate_selected_not_acquired");
assert.equal(contract.productionAuthority, false);
assert.equal(contract.normalizationAuthority, false);
assert.equal(contract.thresholdAuthority, false);
assert.equal(contract.adequacyDecisionAuthority, false);

assert.equal(contract.source.version, "v5");
assert.equal(contract.source.doi, "10.6084/m9.figshare.5047666.v5");
assert.equal(contract.source.rawDatasetAcquired, false);
assert.equal(contract.source.exactFileInventoryFrozen, false);
assert.equal(contract.source.exactFileSha256ReceiptsFrozen, false);

assert.equal(
  contract.frontImageMirror.repository,
  "debruine/webmorphR.stim"
);
assert.equal(
  contract.frontImageMirror.pinnedCommit,
  "fa8b78fda2d659bb74ce62fcd99c4407551d2a77"
);
assert.equal(contract.frontImageMirror.neutralFrontJpegCountObserved, 102);
assert.equal(contract.frontImageMirror.smilingFrontJpegCountObserved, 102);
assert.equal(contract.frontImageMirror.neutralFrontFilenamePattern, "<subject>_03.jpg");
assert.equal(contract.frontImageMirror.smilingFrontFilenamePattern, "<subject>_08.jpg");
assert.equal(contract.frontImageMirror.yawSourceProvided, false);
assert.equal(contract.frontImageMirror.pitchSourceProvided, false);
assert.equal(contract.frontImageMirror.rollSourceProvided, false);
assert.equal(contract.frontImageMirror.exactFrontImageSha256ReceiptsFrozen, true);
assert.equal(
  contract.frontImageMirror.receiptEvidenceRef,
  "evidence/facelab/source-intake/v0/london-set-v5-front-source-receipts.json"
);
assert.equal(
  contract.frontImageMirror.receiptDigest,
  "sha256:b51a121c5639da4d090f0e43b4287d5cd5c306ba036efca3030516cf72a2025a"
);
assert.equal(contract.frontImageMirror.receiptWorkflowRunId, 35608210749);
assert.equal(
  contract.frontImageMirror.receiptWorkflowHead,
  "24e14d984f52e920993b20756834e56c6e3bb656"
);
assert.equal(
  contract.frontImageMirror.transientRawSourceRemovedBeforeArtifactUpload,
  true
);
assert.equal(
  contract.frontImageMirror.imageSha256ReceiptsStillRequiredBeforeExecution,
  false
);

assert.equal(
  contract.allowedResearchRoles.generalFaceReferenceCorpusCandidate,
  true
);
assert.equal(
  contract.allowedResearchRoles.sameSubjectHeadYawCandidate,
  true
);
assert.equal(
  contract.allowedResearchRoles.sameSubjectExpressionCandidate,
  true
);
assert.equal(
  contract.allowedResearchRoles.sameSubjectHeadPitchCandidate,
  false
);
assert.equal(
  contract.allowedResearchRoles.sameSubjectHeadRollCandidate,
  false
);

assert.equal(
  contract.plannedSourceMapping.referenceHoldoutSplit,
  "subject_level_only"
);
assert.equal(
  contract.hardBoundaries.fake2DRotationAsHeadRollForbidden,
  true
);
assert.equal(
  contract.hardBoundaries.inferredPitchFrom2DTransformForbidden,
  true
);
assert.equal(
  contract.hardBoundaries.biometricIdentityMatchingForbidden,
  true
);
assert.equal(contract.hardBoundaries.identityEmbeddingForbidden, true);
assert.equal(
  contract.hardBoundaries.rawImageRepositoryCommitForbidden,
  true
);
assert.equal(
  contract.hardBoundaries.rawImageEvidencePacketPersistenceForbidden,
  true
);
assert.equal(contract.hardBoundaries.rawLandmarkPersistenceForbidden, true);
assert.equal(contract.hardBoundaries.archetypeGroundTruthForbidden, true);
assert.equal(
  contract.hardBoundaries.populationRepresentativenessAssumed,
  false
);
assert.equal(
  contract.hardBoundaries.sensitiveAttributeUserInferenceForbidden,
  true
);
assert.equal(contract.hardBoundaries.productionActivationForbidden, true);

for (const [key, value] of Object.entries(contract.gatesBeforeExecution)) {
  assert.equal(value, true, "execution gate must remain required: " + key);
}
assert.equal(contract.unresolved.headPitchRealPhotoSourceRequired, true);
assert.equal(contract.unresolved.headRollRealPhotoSourceRequired, true);
assert.equal(
  contract.unresolved.referenceCorpusAdequacyDecisionPresent,
  false
);
assert.equal(
  contract.unresolved.realPhotoStabilityAdequacyDecisionPresent,
  false
);

console.log(JSON.stringify({
  ok: true,
  sourceCandidateSelected: true,
  rawDatasetAcquired: false,
  permittedEvidenceClasses: ["head_yaw", "expression", "reference_corpus"],
  blockedEvidenceClasses: ["head_pitch", "head_roll"],
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false,
  adequacyDecisionAuthority: false
}, null, 2));
