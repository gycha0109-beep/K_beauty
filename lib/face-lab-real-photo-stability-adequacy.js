export const REAL_PHOTO_STABILITY_ADEQUACY_SCHEMA_VERSION =
  "face-lab-real-photo-stability-adequacy-evidence-v0";

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

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return (
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  );
}

export function validateRealPhotoStabilityAdequacyEvidence(
  evidence = {},
  collectionSummary
) {
  if (
    !isObject(collectionSummary) ||
    collectionSummary.schemaVersion !==
      "face-lab-real-photo-same-subject-stability-collection-v0" ||
    !sha256Reference(collectionSummary.collectionFingerprint) ||
    collectionSummary.authority?.productionAuthority !== false ||
    collectionSummary.authority?.normalizationAuthority !== false
  ) {
    throw new Error("real_photo_stability_adequacy_collection_invalid");
  }

  if (
    !isObject(evidence) ||
    evidence.schemaVersion !==
      REAL_PHOTO_STABILITY_ADEQUACY_SCHEMA_VERSION ||
    evidence.status !== "adequate_for_provisional_research" ||
    !nonEmpty(evidence.decisionVersion) ||
    !nonEmpty(evidence.evidenceRef) ||
    evidence.sourceCollectionSchemaVersion !==
      collectionSummary.schemaVersion ||
    evidence.sourceCollectionFingerprint !==
      collectionSummary.collectionFingerprint ||
    evidence.sourceReportCount !== collectionSummary.reportCount ||
    !sameStringSet(
      evidence.sourceRunManifestDigests,
      collectionSummary.runManifestDigests
    ) ||
    !sameStringSet(
      evidence.sourceCoveredNuisanceClasses,
      collectionSummary.coveredNuisanceClasses
    ) ||
    collectionSummary.realPhotoPoseAndExpressionCoverage !==
      "covered_for_research" ||
    evidence.nuisanceCoverageReviewed !== true ||
    evidence.subjectLinkageProvenanceReviewed !== true ||
    evidence.measurementDriftReviewed !== true ||
    evidence.sourceCaptureLimitationsReviewed !== true ||
    !Array.isArray(evidence.coverageLimitations) ||
    evidence.coverageLimitations.length === 0 ||
    evidence.coverageLimitations.some((item) => !nonEmpty(item)) ||
    evidence.automaticAdequacyInferred !== false ||
    evidence.numericThresholdInvented !== false ||
    evidence.productionAuthority !== false ||
    evidence.normalizationAuthority !== false ||
    evidence.thresholdAuthority !== false
  ) {
    throw new Error("real_photo_stability_adequacy_evidence_invalid");
  }

  return {
    schemaVersion: REAL_PHOTO_STABILITY_ADEQUACY_SCHEMA_VERSION,
    status: evidence.status,
    decisionVersion: evidence.decisionVersion,
    evidenceRef: evidence.evidenceRef,
    sourceCollectionSchemaVersion:
      evidence.sourceCollectionSchemaVersion,
    sourceCollectionFingerprint:
      evidence.sourceCollectionFingerprint,
    sourceReportCount: evidence.sourceReportCount,
    sourceRunManifestDigests: [
      ...new Set(evidence.sourceRunManifestDigests)
    ].sort(),
    sourceCoveredNuisanceClasses: [
      ...new Set(evidence.sourceCoveredNuisanceClasses)
    ].sort(),
    coverageLimitations: [...evidence.coverageLimitations],
    review: {
      nuisanceCoverageReviewed: true,
      subjectLinkageProvenanceReviewed: true,
      measurementDriftReviewed: true,
      sourceCaptureLimitationsReviewed: true,
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
