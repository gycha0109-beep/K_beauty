import {
  buildRealPhotoStabilityReviewPacket
} from "./face-lab-real-photo-stability-review-packet.js";
import {
  buildFaceSpaceReferenceCorpusReviewPacket
} from "./face-lab-reference-corpus-review-packet.js";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function commonAuthorityInvalid(authority) {
  return (
    !isObject(authority) ||
    authority.productionAuthority !== false ||
    authority.normalizationAuthority !== false ||
    authority.thresholdAuthority !== false
  );
}

export function buildFaceLabNormalizationReviewPacketFromRunOutput({
  kind,
  runOutput,
  packetVersion
} = {}) {
  if (!isObject(runOutput)) {
    throw new Error("face_lab_review_run_output_invalid");
  }

  if (kind === "real-photo-stability") {
    if (
      runOutput.schemaVersion !==
        "face-lab-real-photo-stability-run-output-v0" ||
      runOutput.ok !== true ||
      runOutput.productionAuthority !== false ||
      runOutput.normalizationAuthority !== false ||
      runOutput.thresholdAuthority !== false ||
      !Array.isArray(runOutput.reports) ||
      runOutput.privacy?.sourceImagePersisted !== false ||
      runOutput.privacy?.rawLandmarksPersisted !== false ||
      runOutput.privacy?.identityEmbeddingCreated !== false ||
      runOutput.privacy?.biometricIdentityMatchPerformed !== false ||
      runOutput.privacy?.outputContainsStructuralEvidenceOnly !== true
    ) {
      throw new Error("face_lab_review_real_photo_run_output_invalid");
    }
    return buildRealPhotoStabilityReviewPacket({
      reports: runOutput.reports,
      packetVersion
    });
  }

  if (kind === "reference-corpus") {
    if (
      runOutput.schemaVersion !==
        "face-space-reference-corpus-measurement-run-output-v0" ||
      runOutput.ok !== true ||
      commonAuthorityInvalid(runOutput.authority) ||
      !isObject(runOutput.corpus) ||
      runOutput.privacy?.outputContainsLocalImagePaths !== false ||
      runOutput.privacy?.sourceImagePersisted !== false ||
      runOutput.privacy?.rawLandmarksPersisted !== false ||
      runOutput.privacy?.identityEmbeddingCreated !== false ||
      runOutput.privacy?.biometricIdentityMatchPerformed !== false
    ) {
      throw new Error("face_lab_review_reference_run_output_invalid");
    }
    return buildFaceSpaceReferenceCorpusReviewPacket({
      manifest: runOutput.corpus,
      packetVersion
    });
  }

  throw new Error("face_lab_review_run_output_kind_invalid");
}
