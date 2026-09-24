import { createHash } from "node:crypto";
import {
  summarizeRealPhotoStabilityCollection
} from "./face-lab-real-photo-stability-evidence.js";

export const REAL_PHOTO_STABILITY_REVIEW_PACKET_SCHEMA_VERSION =
  "face-lab-real-photo-stability-review-packet-v0";

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return "[" + value.map((item) => stableJson(item)).join(",") + "]";
  }
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) + ":" + stableJson(value[key])
        )
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

export function buildRealPhotoStabilityReviewPacket({
  reports,
  packetVersion
} = {}) {
  if (!nonEmpty(packetVersion)) {
    throw new Error("real_photo_stability_review_packet_version_invalid");
  }

  const collection = summarizeRealPhotoStabilityCollection(reports);

  const observations = [...reports]
    .sort((a, b) => a.pairGroupId.localeCompare(b.pairGroupId))
    .map((report) => ({
      pairGroupId: report.pairGroupId,
      nuisanceClass: report.nuisance.class,
      subjectLinkage: {
        method: report.subjectLinkage.method,
        evidenceRef: report.subjectLinkage.evidenceRef
      },
      executionProvenance: {
        runnerVersion: report.executionProvenance.runnerVersion,
        runManifestDigest:
          report.executionProvenance.runManifestDigest,
        sourceSetProvenanceRef:
          report.executionProvenance.sourceSetProvenanceRef,
        referenceImageSha256:
          report.executionProvenance.referenceImageSha256,
        candidateImageSha256:
          report.executionProvenance.candidateImageSha256
      },
      diagnostics: {
        maxAbsoluteRatioDifference:
          report.comparison.diagnostics.maxAbsoluteRatioDifference,
        maxAbsoluteDegreeDifference:
          report.comparison.diagnostics.maxAbsoluteDegreeDifference,
        thresholdsApplied: false,
        calibrationStatus:
          report.comparison.diagnostics.calibrationStatus
      },
      dimensions: [...report.comparison.dimensions]
        .map((dimension) => ({
          id: dimension.id,
          unit: dimension.unit,
          reference: dimension.left,
          candidate: dimension.right,
          absoluteDifference: dimension.absoluteDifference,
          relativeDifference: dimension.relativeDifference
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    }));

  const fingerprintPayload = {
    schemaVersion: REAL_PHOTO_STABILITY_REVIEW_PACKET_SCHEMA_VERSION,
    packetVersion,
    sourceCollectionFingerprint: collection.collectionFingerprint,
    observations
  };
  const reviewPacketFingerprint =
    "sha256:" +
    createHash("sha256")
      .update(stableJson(fingerprintPayload))
      .digest("hex");

  return {
    schemaVersion: REAL_PHOTO_STABILITY_REVIEW_PACKET_SCHEMA_VERSION,
    packetVersion,
    status: "manual_review_packet_ready",
    sourceCollectionSchemaVersion: collection.schemaVersion,
    sourceCollectionFingerprint: collection.collectionFingerprint,
    sourceReportCount: collection.reportCount,
    sourceRunManifestDigests: collection.runManifestDigests,
    sourceCoveredNuisanceClasses:
      collection.coveredNuisanceClasses,
    reviewPacketFingerprint,
    observations,
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false,
      adequacyDecisionAuthority: false,
      rankingAuthority: false
    },
    reviewSemantics: {
      descriptiveOnly: true,
      thresholdsApplied: false,
      automaticPassFail: false,
      automaticRanking: false
    },
    privacy: {
      sourceImagePersisted: false,
      rawLandmarksPersisted: false,
      identityEmbeddingCreated: false,
      biometricIdentityMatchPerformed: false,
      localImagePathsIncluded: false
    }
  };
}
