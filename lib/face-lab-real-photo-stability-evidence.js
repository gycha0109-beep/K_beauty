import {
  buildPhotoGeometryStabilityComparison,
  validatePhotoGeometryStabilityObservation
} from "./face-lab-photo-geometry-stability.js";

export const REAL_PHOTO_STABILITY_EVIDENCE_SCHEMA_VERSION =
  "face-lab-real-photo-same-subject-stability-evidence-v0";

export const REAL_PHOTO_STABILITY_COLLECTION_SCHEMA_VERSION =
  "face-lab-real-photo-same-subject-stability-collection-v0";

const REQUIRED_NUISANCE_CLASSES = Object.freeze([
  "head_yaw",
  "head_pitch",
  "head_roll",
  "expression"
]);

const ALLOWED_LINKAGE_METHODS = new Set([
  "dataset_same_subject_provenance",
  "manual_same_subject_pair"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildRealPhotoSameSubjectStabilityEvidence({
  pairGroupId,
  referenceMeasurement,
  candidateMeasurement,
  nuisance,
  subjectLinkage
} = {}, semanticContract) {
  if (!REQUIRED_NUISANCE_CLASSES.includes(nuisance?.class)) {
    throw new Error("real_photo_stability_nuisance_invalid");
  }
  if (!ALLOWED_LINKAGE_METHODS.has(subjectLinkage?.method)) {
    throw new Error("real_photo_stability_linkage_method_invalid");
  }
  if (!nonEmpty(subjectLinkage?.evidenceRef)) {
    throw new Error("real_photo_stability_linkage_evidence_ref_missing");
  }
  if (subjectLinkage?.biometricIdentityMatchPerformed !== false) {
    throw new Error("real_photo_stability_biometric_match_forbidden");
  }

  const comparison = buildPhotoGeometryStabilityComparison(
    {
      pairGroupId,
      referenceMeasurement,
      candidateMeasurement,
      nuisance,
      subjectLinkage: {
        method: subjectLinkage.method,
        status: "same_subject_asserted_by_non_biometric_provenance"
      }
    },
    semanticContract
  );

  if (comparison.comparisonKind !== "same_provider") {
    throw new Error("real_photo_stability_same_provider_required");
  }
  const validation = validatePhotoGeometryStabilityObservation(comparison);
  if (!validation.ok) {
    throw new Error(
      "real_photo_stability_comparison_invalid:" + validation.errors.join(",")
    );
  }

  return {
    schemaVersion: REAL_PHOTO_STABILITY_EVIDENCE_SCHEMA_VERSION,
    pairGroupId: comparison.pairGroupId,
    nuisance,
    subjectLinkage: {
      method: subjectLinkage.method,
      evidenceRef: subjectLinkage.evidenceRef.trim(),
      biometricIdentityMatchPerformed: false
    },
    comparison,
    authority: {
      productionAuthority: false,
      thresholdAuthority: false,
      normalizationAuthority: false,
      populationAuthority: false
    },
    privacy: {
      sourceImagePersisted: false,
      rawLandmarksPersisted: false,
      identityEmbeddingCreated: false,
      biometricIdentityMatchPerformed: false
    }
  };
}

export function summarizeRealPhotoStabilityCollection(reports = []) {
  if (!Array.isArray(reports)) {
    throw new Error("real_photo_stability_collection_invalid");
  }

  const covered = new Set();
  const pairGroups = new Set();
  for (const report of reports) {
    if (
      !isObject(report) ||
      report.schemaVersion !== REAL_PHOTO_STABILITY_EVIDENCE_SCHEMA_VERSION ||
      report.authority?.productionAuthority !== false ||
      report.authority?.thresholdAuthority !== false ||
      report.authority?.normalizationAuthority !== false ||
      report.privacy?.sourceImagePersisted !== false ||
      report.privacy?.rawLandmarksPersisted !== false ||
      report.privacy?.identityEmbeddingCreated !== false ||
      report.privacy?.biometricIdentityMatchPerformed !== false
    ) {
      throw new Error("real_photo_stability_report_invalid");
    }
    if (!REQUIRED_NUISANCE_CLASSES.includes(report.nuisance?.class)) {
      throw new Error("real_photo_stability_report_nuisance_invalid");
    }
    if (!ALLOWED_LINKAGE_METHODS.has(report.subjectLinkage?.method)) {
      throw new Error("real_photo_stability_report_linkage_invalid");
    }
    if (!nonEmpty(report.subjectLinkage?.evidenceRef)) {
      throw new Error("real_photo_stability_report_evidence_ref_missing");
    }
    covered.add(report.nuisance.class);
    pairGroups.add(report.pairGroupId);
  }

  const missing = REQUIRED_NUISANCE_CLASSES.filter(
    (nuisanceClass) => !covered.has(nuisanceClass)
  );

  return {
    schemaVersion: REAL_PHOTO_STABILITY_COLLECTION_SCHEMA_VERSION,
    reportCount: reports.length,
    opaquePairGroupCount: pairGroups.size,
    coveredNuisanceClasses: [...covered].sort(),
    missingNuisanceClasses: missing,
    realPhotoPoseAndExpressionCoverage:
      missing.length === 0 ? "covered_for_research" : "incomplete",
    readinessContribution: {
      realPoseEvidenceKind:
        missing.some((item) => item.startsWith("head_"))
          ? null
          : "real_photo_same_subject",
      realExpressionEvidenceKind:
        missing.includes("expression") ? null : "real_photo_same_subject"
    },
    authority: {
      productionAuthority: false,
      thresholdAuthority: false,
      normalizationAuthority: false,
      populationAuthority: false
    }
  };
}

export const REAL_PHOTO_STABILITY_REQUIRED_NUISANCE_CLASSES =
  REQUIRED_NUISANCE_CLASSES;
