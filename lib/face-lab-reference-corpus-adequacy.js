export const FACE_SPACE_REFERENCE_CORPUS_ADEQUACY_SCHEMA_VERSION =
  "face-space-reference-corpus-adequacy-evidence-v0";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256Reference(value) {
  return (
    typeof value === "string" &&
    /^sha256:[a-f0-9]{64}$/.test(value)
  );
}

export function validateFaceSpaceReferenceCorpusAdequacyEvidence(
  evidence = {},
  referenceCorpusSummary,
  reviewPacket
) {
  if (
    !isObject(referenceCorpusSummary) ||
    referenceCorpusSummary.schemaVersion !==
      "face-space-reference-corpus-summary-v0" ||
    referenceCorpusSummary.status !== "structurally_valid_research_corpus" ||
    !sha256Reference(referenceCorpusSummary.referenceSplitFingerprint)
  ) {
    throw new Error("reference_corpus_adequacy_summary_invalid");
  }

  if (
    !isObject(reviewPacket) ||
    reviewPacket.schemaVersion !==
      "face-space-reference-corpus-review-packet-v0" ||
    reviewPacket.status !== "manual_review_packet_ready" ||
    !nonEmpty(reviewPacket.packetVersion) ||
    !sha256Reference(reviewPacket.reviewPacketFingerprint) ||
    reviewPacket.sourceReferenceCorpusSummarySchemaVersion !==
      referenceCorpusSummary.schemaVersion ||
    reviewPacket.sourceReferenceSplitFingerprint !==
      referenceCorpusSummary.referenceSplitFingerprint ||
    reviewPacket.sourceSamplingFrameProvenanceRef !==
      referenceCorpusSummary.samplingFrameProvenanceRef ||
    reviewPacket.sourceProvider?.source !==
      referenceCorpusSummary.provider?.source ||
    reviewPacket.sourceProvider?.sourceVersion !==
      referenceCorpusSummary.provider?.sourceVersion ||
    reviewPacket.sourceProvider?.adapterId !==
      referenceCorpusSummary.provider?.adapterId ||
    reviewPacket.authority?.productionAuthority !== false ||
    reviewPacket.authority?.normalizationAuthority !== false ||
    reviewPacket.authority?.referenceStatisticsAuthority !== false ||
    reviewPacket.authority?.methodSelectionAuthority !== false ||
    reviewPacket.authority?.adequacyDecisionAuthority !== false ||
    reviewPacket.reviewSemantics?.descriptiveOnly !== true ||
    reviewPacket.reviewSemantics?.centerScaleStatisticsIncluded !== false ||
    reviewPacket.reviewSemantics?.percentileStatisticsIncluded !== false ||
    reviewPacket.reviewSemantics?.holdoutMeasurementValuesIncluded !== false ||
    reviewPacket.reviewSemantics?.automaticPassFail !== false ||
    reviewPacket.reviewSemantics?.automaticRanking !== false ||
    reviewPacket.privacy?.sourceImagePersisted !== false ||
    reviewPacket.privacy?.rawLandmarksPersisted !== false ||
    reviewPacket.privacy?.identityEmbeddingCreated !== false ||
    reviewPacket.privacy?.biometricIdentityMatchPerformed !== false ||
    reviewPacket.privacy?.localImagePathsIncluded !== false
  ) {
    throw new Error("reference_corpus_adequacy_review_packet_invalid");
  }

  if (
    !isObject(evidence) ||
    evidence.schemaVersion !==
      FACE_SPACE_REFERENCE_CORPUS_ADEQUACY_SCHEMA_VERSION ||
    evidence.status !== "adequate_for_provisional_research" ||
    !nonEmpty(evidence.decisionVersion) ||
    !nonEmpty(evidence.evidenceRef) ||
    evidence.sourceReferenceCorpusSummarySchemaVersion !==
      referenceCorpusSummary.schemaVersion ||
    evidence.sourceReferenceSplitFingerprint !==
      referenceCorpusSummary.referenceSplitFingerprint ||
    evidence.sourceReviewPacketSchemaVersion !==
      reviewPacket.schemaVersion ||
    evidence.sourceReviewPacketVersion !==
      reviewPacket.packetVersion ||
    evidence.sourceReviewPacketFingerprint !==
      reviewPacket.reviewPacketFingerprint ||
    evidence.sourceSamplingFrameProvenanceRef !==
      referenceCorpusSummary.samplingFrameProvenanceRef ||
    evidence.sourceProvider?.source !==
      referenceCorpusSummary.provider?.source ||
    evidence.sourceProvider?.sourceVersion !==
      referenceCorpusSummary.provider?.sourceVersion ||
    evidence.sourceProvider?.adapterId !==
      referenceCorpusSummary.provider?.adapterId ||
    evidence.samplingFrameReviewed !== true ||
    evidence.splitIntegrityReviewed !== true ||
    evidence.measurementCoverageReviewed !== true ||
    evidence.holdoutIntegrityReviewed !== true ||
    !Array.isArray(evidence.coverageLimitations) ||
    evidence.coverageLimitations.length === 0 ||
    evidence.coverageLimitations.some((item) => !nonEmpty(item)) ||
    evidence.automaticAdequacyInferred !== false ||
    evidence.numericThresholdInvented !== false ||
    evidence.productionAuthority !== false ||
    evidence.normalizationAuthority !== false ||
    evidence.thresholdAuthority !== false
  ) {
    throw new Error("reference_corpus_adequacy_evidence_invalid");
  }

  return {
    schemaVersion: FACE_SPACE_REFERENCE_CORPUS_ADEQUACY_SCHEMA_VERSION,
    status: evidence.status,
    decisionVersion: evidence.decisionVersion,
    evidenceRef: evidence.evidenceRef,
    sourceReferenceCorpusSummarySchemaVersion:
      evidence.sourceReferenceCorpusSummarySchemaVersion,
    sourceReferenceSplitFingerprint:
      evidence.sourceReferenceSplitFingerprint,
    sourceReviewPacketSchemaVersion:
      evidence.sourceReviewPacketSchemaVersion,
    sourceReviewPacketVersion:
      evidence.sourceReviewPacketVersion,
    sourceReviewPacketFingerprint:
      evidence.sourceReviewPacketFingerprint,
    sourceSamplingFrameProvenanceRef:
      evidence.sourceSamplingFrameProvenanceRef,
    sourceProvider: {
      source: evidence.sourceProvider.source,
      sourceVersion: evidence.sourceProvider.sourceVersion,
      adapterId: evidence.sourceProvider.adapterId
    },
    coverageLimitations: [...evidence.coverageLimitations],
    review: {
      samplingFrameReviewed: true,
      splitIntegrityReviewed: true,
      measurementCoverageReviewed: true,
      holdoutIntegrityReviewed: true,
      automaticAdequacyInferred: false,
      numericThresholdInvented: false
    },
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false,
      provisionalResearchAdequacyOnly: true
    }
  };
}
