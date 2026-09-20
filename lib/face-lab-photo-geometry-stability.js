import {
  compareStructuralMeasurements,
  STRUCTURAL_MEASUREMENT_SCHEMA_VERSION,
  STRUCTURAL_MEASUREMENT_SEMANTICS_VERSION
} from "./face-lab-photo-geometry-research.js";

export const PHOTO_GEOMETRY_STABILITY_REPORT_SCHEMA_VERSION =
  "face-lab-photo-geometry-stability-report-v0";

export const PHOTO_GEOMETRY_STABILITY_NUISANCE_CLASSES = Object.freeze([
  "repeated_run",
  "resolution",
  "compression",
  "crop_translation",
  "lighting_exposure",
  "lighting_contrast",
  "white_balance",
  "image_rotation",
  "head_yaw",
  "head_pitch",
  "head_roll",
  "expression",
  "occlusion",
  "provider_comparison"
]);

const REAL_PAIR_REQUIRED = new Set([
  "head_yaw",
  "head_pitch",
  "head_roll",
  "expression"
]);

const SUBJECT_LINKAGE_METHODS = new Set([
  "same_source_image_transform",
  "manual_same_subject_pair",
  "dataset_same_subject_provenance",
  "controlled_3d_same_identity",
  "canonical_diagnostic"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateMeasurement(measurement, label) {
  if (!isObject(measurement)) {
    throw new Error("photo_geometry_stability_measurement_missing:" + label);
  }
  if (measurement.schemaVersion !== STRUCTURAL_MEASUREMENT_SCHEMA_VERSION) {
    throw new Error("photo_geometry_stability_measurement_schema_invalid:" + label);
  }
  if (
    measurement.semanticsVersion !==
    STRUCTURAL_MEASUREMENT_SEMANTICS_VERSION
  ) {
    throw new Error(
      "photo_geometry_stability_measurement_semantics_invalid:" + label
    );
  }
  if (measurement.privacy?.sourceImagePersisted !== false) {
    throw new Error(
      "photo_geometry_stability_source_image_persistence_forbidden:" + label
    );
  }
  if (measurement.privacy?.identityEmbeddingCreated !== false) {
    throw new Error(
      "photo_geometry_stability_identity_embedding_forbidden:" + label
    );
  }
}

function semanticDimensionMap(semanticContract) {
  if (
    !isObject(semanticContract) ||
    semanticContract.schemaVersion !==
      STRUCTURAL_MEASUREMENT_SEMANTICS_VERSION ||
    semanticContract.productionAuthority !== false ||
    !Array.isArray(semanticContract.dimensions)
  ) {
    throw new Error("photo_geometry_stability_semantic_contract_invalid");
  }

  const dimensions = new Map();
  for (const dimension of semanticContract.dimensions) {
    if (
      !nonEmpty(dimension?.id) ||
      !["ratio", "degree"].includes(dimension?.unit) ||
      !["unvalidated", "hold", "validated"].includes(
        dimension?.providerAnchorEquivalence
      )
    ) {
      throw new Error(
        "photo_geometry_stability_semantic_dimension_invalid:" +
          String(dimension?.id || "unknown")
      );
    }
    dimensions.set(dimension.id, dimension);
  }
  return dimensions;
}

function validateNuisance(nuisance, subjectLinkage) {
  if (
    !isObject(nuisance) ||
    !PHOTO_GEOMETRY_STABILITY_NUISANCE_CLASSES.includes(nuisance.class)
  ) {
    throw new Error("photo_geometry_stability_nuisance_invalid");
  }
  if (
    !isObject(subjectLinkage) ||
    !SUBJECT_LINKAGE_METHODS.has(subjectLinkage.method) ||
    !nonEmpty(subjectLinkage.status)
  ) {
    throw new Error("photo_geometry_stability_subject_linkage_invalid");
  }

  if (
    REAL_PAIR_REQUIRED.has(nuisance.class) &&
    subjectLinkage.method === "same_source_image_transform"
  ) {
    throw new Error(
      "photo_geometry_stability_real_pair_required:" + nuisance.class
    );
  }

  if (
    nuisance.class !== "provider_comparison" &&
    subjectLinkage.method === "canonical_diagnostic"
  ) {
    throw new Error(
      "photo_geometry_stability_canonical_diagnostic_scope_invalid"
    );
  }
}

function relativeDifference(unit, reference, absoluteDifference) {
  if (unit !== "ratio" || Math.abs(reference) <= 1e-12) return null;
  return absoluteDifference / Math.abs(reference);
}

export function buildPhotoGeometryStabilityComparison({
  pairGroupId,
  referenceMeasurement,
  candidateMeasurement,
  nuisance,
  subjectLinkage
} = {}, semanticContract) {
  if (!nonEmpty(pairGroupId)) {
    throw new Error("photo_geometry_stability_pair_group_id_missing");
  }

  validateMeasurement(referenceMeasurement, "reference");
  validateMeasurement(candidateMeasurement, "candidate");
  validateNuisance(nuisance, subjectLinkage);

  const semantics = semanticDimensionMap(semanticContract);
  const comparison = compareStructuralMeasurements(
    referenceMeasurement,
    candidateMeasurement
  );
  const crossProvider =
    referenceMeasurement.source !== candidateMeasurement.source ||
    referenceMeasurement.adapterId !== candidateMeasurement.adapterId;

  if (nuisance.class === "provider_comparison" && !crossProvider) {
    throw new Error(
      "photo_geometry_stability_provider_comparison_requires_distinct_provider"
    );
  }

  const dimensions = comparison.dimensions.map((dimension) => {
    const semantic = semantics.get(dimension.id);
    if (!semantic || semantic.unit !== dimension.unit) {
      throw new Error(
        "photo_geometry_stability_semantic_dimension_missing:" + dimension.id
      );
    }

    const providerAnchorEquivalence = crossProvider
      ? semantic.providerAnchorEquivalence
      : "not_applicable_same_provider";

    return {
      ...dimension,
      relativeDifference: relativeDifference(
        dimension.unit,
        dimension.left,
        dimension.absoluteDifference
      ),
      providerAnchorEquivalence,
      crossProviderInterpretation: crossProvider
        ? semantic.providerAnchorEquivalence === "hold"
          ? "hold"
          : semantic.providerAnchorEquivalence === "validated"
            ? "validated_by_semantic_contract"
            : "unvalidated"
        : "not_applicable"
    };
  });

  const ratioDifferences = dimensions
    .filter((item) => item.unit === "ratio")
    .map((item) => item.absoluteDifference);
  const degreeDifferences = dimensions
    .filter((item) => item.unit === "degree")
    .map((item) => item.absoluteDifference);

  const hasCrossProviderHold = dimensions.some(
    (item) => item.crossProviderInterpretation === "hold"
  );
  const hasCrossProviderUnvalidated = dimensions.some(
    (item) => item.crossProviderInterpretation === "unvalidated"
  );

  return {
    schemaVersion: PHOTO_GEOMETRY_STABILITY_REPORT_SCHEMA_VERSION,
    pairGroupId: pairGroupId.trim(),
    nuisance,
    subjectLinkage,
    comparisonKind: crossProvider ? "cross_provider" : "same_provider",
    reference: {
      sampleId: referenceMeasurement.sampleId,
      source: referenceMeasurement.source,
      sourceVersion: referenceMeasurement.sourceVersion,
      adapterId: referenceMeasurement.adapterId,
      measurementDigest: referenceMeasurement.measurementDigest || null
    },
    candidate: {
      sampleId: candidateMeasurement.sampleId,
      source: candidateMeasurement.source,
      sourceVersion: candidateMeasurement.sourceVersion,
      adapterId: candidateMeasurement.adapterId,
      measurementDigest: candidateMeasurement.measurementDigest || null
    },
    dimensions,
    diagnostics: {
      maxAbsoluteRatioDifference:
        ratioDifferences.length > 0 ? Math.max(...ratioDifferences) : null,
      maxAbsoluteDegreeDifference:
        degreeDifferences.length > 0 ? Math.max(...degreeDifferences) : null,
      thresholdsApplied: false,
      calibrationStatus: "not_calibrated"
    },
    interpretationStatus: crossProvider
      ? hasCrossProviderHold
        ? "semantic_hold"
        : hasCrossProviderUnvalidated
          ? "semantic_unvalidated"
          : "semantic_contract_validated_only"
      : "research_observation",
    authority: {
      productionAuthority: false,
      thresholdAuthority: false,
      faceSpaceCalibrationAuthority: false,
      archetypeAuthority: false,
      styleRecommendationAuthority: false
    },
    privacy: {
      sourceImagePersisted: false,
      identityEmbeddingCreated: false,
      biometricIdentityMatchPerformed: false
    }
  };
}

export function buildPhotoGeometryStabilityBatch({
  pairGroupId,
  referenceMeasurement,
  variants,
  subjectLinkage
} = {}, semanticContract) {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error("photo_geometry_stability_variants_missing");
  }

  return variants.map((variant) =>
    buildPhotoGeometryStabilityComparison(
      {
        pairGroupId,
        referenceMeasurement,
        candidateMeasurement: variant.measurement,
        nuisance: variant.nuisance,
        subjectLinkage: variant.subjectLinkage || subjectLinkage
      },
      semanticContract
    )
  );
}

export function validatePhotoGeometryStabilityObservation(report) {
  const errors = [];

  if (
    !isObject(report) ||
    report.schemaVersion !== PHOTO_GEOMETRY_STABILITY_REPORT_SCHEMA_VERSION
  ) {
    errors.push("schema_version_invalid");
  }
  if (report?.authority?.productionAuthority !== false) {
    errors.push("production_authority_forbidden");
  }
  if (report?.authority?.thresholdAuthority !== false) {
    errors.push("threshold_authority_forbidden");
  }
  if (report?.diagnostics?.thresholdsApplied !== false) {
    errors.push("threshold_application_forbidden");
  }
  if (report?.privacy?.sourceImagePersisted !== false) {
    errors.push("source_image_persistence_forbidden");
  }
  if (report?.privacy?.identityEmbeddingCreated !== false) {
    errors.push("identity_embedding_forbidden");
  }
  if (report?.privacy?.biometricIdentityMatchPerformed !== false) {
    errors.push("biometric_identity_match_forbidden");
  }
  if (!Array.isArray(report?.dimensions) || report.dimensions.length === 0) {
    errors.push("dimensions_missing");
  } else {
    for (const dimension of report.dimensions) {
      if (!finite(dimension.absoluteDifference)) {
        errors.push("dimension_difference_invalid:" + String(dimension.id));
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export const PHOTO_GEOMETRY_STABILITY_REAL_PAIR_REQUIRED =
  Object.freeze([...REAL_PAIR_REQUIRED]);
