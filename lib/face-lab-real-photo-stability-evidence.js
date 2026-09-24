import { createHash } from "node:crypto";

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

function stableJson(value) {
  if (Array.isArray(value)) {
    return "[" + value.map((item) => stableJson(item)).join(",") + "]";
  }
  if (isObject(value)) {
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

function buildCollectionFingerprint(reports) {
  const payload = [...reports]
    .map((report) => ({
      schemaVersion: report.schemaVersion,
      pairGroupId: report.pairGroupId,
      nuisance: report.nuisance,
      subjectLinkage: report.subjectLinkage,
      executionProvenance: report.executionProvenance,
      comparison: report.comparison
    }))
    .sort((a, b) => a.pairGroupId.localeCompare(b.pairGroupId));

  return (
    "sha256:" +
    createHash("sha256").update(stableJson(payload)).digest("hex")
  );
}

export function buildRealPhotoSameSubjectStabilityEvidence({
  pairGroupId,
  referenceMeasurement,
  candidateMeasurement,
  nuisance,
  subjectLinkage,
  executionProvenance
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

  if (
    executionProvenance?.kind !== "real_photo_pair_runner" ||
    executionProvenance?.runnerVersion !==
      "face-lab-real-photo-stability-pair-runner-v0" ||
    !/^sha256:[a-f0-9]{64}$/.test(
      executionProvenance?.runManifestDigest || ""
    ) ||
    !nonEmpty(executionProvenance?.sourceSetProvenanceRef) ||
    !/^[a-f0-9]{64}$/.test(
      executionProvenance?.referenceImageSha256 || ""
    ) ||
    !/^[a-f0-9]{64}$/.test(
      executionProvenance?.candidateImageSha256 || ""
    )
  ) {
    throw new Error("real_photo_stability_execution_provenance_invalid");
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
    executionProvenance: {
      kind: "real_photo_pair_runner",
      runnerVersion: "face-lab-real-photo-stability-pair-runner-v0",
      runManifestDigest: executionProvenance.runManifestDigest,
      sourceSetProvenanceRef:
        executionProvenance.sourceSetProvenanceRef.trim(),
      referenceImageSha256: executionProvenance.referenceImageSha256,
      candidateImageSha256: executionProvenance.candidateImageSha256
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
  const runManifestDigests = new Set();
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
    if (
      report.comparison?.comparisonKind !== "same_provider" ||
      report.comparison?.pairGroupId !== report.pairGroupId ||
      report.comparison?.nuisance?.class !== report.nuisance.class ||
      report.comparison?.subjectLinkage?.method !==
        report.subjectLinkage?.method
    ) {
      throw new Error("real_photo_stability_report_comparison_mismatch");
    }
    const comparisonValidation =
      validatePhotoGeometryStabilityObservation(report.comparison);
    if (!comparisonValidation.ok) {
      throw new Error(
        "real_photo_stability_report_comparison_invalid:" +
          comparisonValidation.errors.join(",")
      );
    }
    if (!ALLOWED_LINKAGE_METHODS.has(report.subjectLinkage?.method)) {
      throw new Error("real_photo_stability_report_linkage_invalid");
    }
    if (!nonEmpty(report.subjectLinkage?.evidenceRef)) {
      throw new Error("real_photo_stability_report_evidence_ref_missing");
    }
    if (
      report.executionProvenance?.kind !== "real_photo_pair_runner" ||
      report.executionProvenance?.runnerVersion !==
        "face-lab-real-photo-stability-pair-runner-v0" ||
      !/^sha256:[a-f0-9]{64}$/.test(
        report.executionProvenance?.runManifestDigest || ""
      ) ||
      !nonEmpty(report.executionProvenance?.sourceSetProvenanceRef) ||
      !/^[a-f0-9]{64}$/.test(
        report.executionProvenance?.referenceImageSha256 || ""
      ) ||
      !/^[a-f0-9]{64}$/.test(
        report.executionProvenance?.candidateImageSha256 || ""
      )
    ) {
      throw new Error(
        "real_photo_stability_report_execution_provenance_invalid"
      );
    }
    covered.add(report.nuisance.class);
    pairGroups.add(report.pairGroupId);
    runManifestDigests.add(report.executionProvenance.runManifestDigest);
  }

  const missing = REQUIRED_NUISANCE_CLASSES.filter(
    (nuisanceClass) => !covered.has(nuisanceClass)
  );

  return {
    schemaVersion: REAL_PHOTO_STABILITY_COLLECTION_SCHEMA_VERSION,
    collectionFingerprint: buildCollectionFingerprint(reports),
    reportCount: reports.length,
    opaquePairGroupCount: pairGroups.size,
    runManifestDigestCount: runManifestDigests.size,
    runManifestDigests: [...runManifestDigests].sort(),
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
