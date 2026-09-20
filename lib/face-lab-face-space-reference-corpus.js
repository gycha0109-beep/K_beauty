export const FACE_SPACE_REFERENCE_CORPUS_SCHEMA_VERSION =
  "face-space-reference-corpus-v0";

export const FACE_SPACE_REFERENCE_CORPUS_SUMMARY_SCHEMA_VERSION =
  "face-space-reference-corpus-summary-v0";

const REQUIRED_DIMENSIONS = Object.freeze([
  "lower_face_width_ratio",
  "chin_height_ratio",
  "eye_spacing_ratio",
  "eye_width_ratio",
  "eye_tilt",
  "nose_width_ratio"
]);

const ALLOWED_SAMPLING_FRAME_KINDS = new Set([
  "consented_general_face_corpus",
  "licensed_general_face_corpus"
]);

const ALLOWED_SPLITS = new Set(["reference", "holdout"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateMeasurement(measurement, provider) {
  if (
    !isObject(measurement) ||
    measurement.schemaVersion !== "face-space-structural-measurement-v0" ||
    !Array.isArray(measurement.dimensions) ||
    measurement.privacy?.sourceImagePersisted !== false ||
    measurement.privacy?.identityEmbeddingCreated !== false
  ) {
    throw new Error("reference_corpus_measurement_invalid");
  }
  if (
    measurement.source !== provider.source ||
    measurement.sourceVersion !== provider.sourceVersion ||
    measurement.adapterId !== provider.adapterId
  ) {
    throw new Error("reference_corpus_provider_mismatch");
  }

  const byId = new Map();
  for (const dimension of measurement.dimensions) {
    if (
      !nonEmpty(dimension?.id) ||
      !nonEmpty(dimension?.unit) ||
      typeof dimension.value !== "number" ||
      !Number.isFinite(dimension.value)
    ) {
      throw new Error("reference_corpus_dimension_invalid");
    }
    if (byId.has(dimension.id)) {
      throw new Error("reference_corpus_dimension_duplicate:" + dimension.id);
    }
    byId.set(dimension.id, dimension);
  }
  for (const id of REQUIRED_DIMENSIONS) {
    if (!byId.has(id)) {
      throw new Error("reference_corpus_dimension_missing:" + id);
    }
  }
}

export function validateFaceSpaceReferenceCorpus(manifest = {}) {
  if (
    !isObject(manifest) ||
    manifest.schemaVersion !== FACE_SPACE_REFERENCE_CORPUS_SCHEMA_VERSION
  ) {
    throw new Error("reference_corpus_schema_invalid");
  }
  if (
    manifest.productionAuthority !== false ||
    manifest.normalizationAuthority !== false
  ) {
    throw new Error("reference_corpus_authority_invalid");
  }
  if (
    !isObject(manifest.samplingFrame) ||
    !ALLOWED_SAMPLING_FRAME_KINDS.has(manifest.samplingFrame.kind) ||
    !nonEmpty(manifest.samplingFrame.provenanceRef) ||
    manifest.samplingFrame.archetypeSeeded !== false ||
    manifest.samplingFrame.generalFaceIntent !== true
  ) {
    throw new Error("reference_corpus_sampling_frame_invalid");
  }
  if (
    !isObject(manifest.provider) ||
    !nonEmpty(manifest.provider.source) ||
    !nonEmpty(manifest.provider.sourceVersion) ||
    !nonEmpty(manifest.provider.adapterId)
  ) {
    throw new Error("reference_corpus_provider_invalid");
  }
  if (!Array.isArray(manifest.records) || manifest.records.length === 0) {
    throw new Error("reference_corpus_records_missing");
  }

  const sampleIds = new Set();
  const subjectSplit = new Map();
  const familySplit = new Map();
  const splitCounts = { reference: 0, holdout: 0 };

  for (const record of manifest.records) {
    if (
      !isObject(record) ||
      !nonEmpty(record.sampleId) ||
      !nonEmpty(record.subjectGroupId) ||
      !nonEmpty(record.provenanceRef) ||
      !ALLOWED_SPLITS.has(record.split)
    ) {
      throw new Error("reference_corpus_record_invalid");
    }
    if (sampleIds.has(record.sampleId)) {
      throw new Error("reference_corpus_sample_duplicate:" + record.sampleId);
    }
    sampleIds.add(record.sampleId);

    if (
      record.archetypeGroundTruth !== undefined &&
      record.archetypeGroundTruth !== null
    ) {
      throw new Error("reference_corpus_archetype_ground_truth_forbidden");
    }
    if (
      record.identityEmbeddingCreated !== false ||
      record.biometricIdentityMatchPerformed !== false ||
      record.rawImagePersistedInPacket !== false
    ) {
      throw new Error("reference_corpus_privacy_boundary_invalid");
    }
    if (
      !isObject(record.eligibilityQuality) ||
      record.eligibilityQuality.eligible !== true ||
      !nonEmpty(record.eligibilityQuality.qualityStatus)
    ) {
      throw new Error("reference_corpus_eligibility_quality_invalid");
    }

    const priorSubjectSplit = subjectSplit.get(record.subjectGroupId);
    if (priorSubjectSplit && priorSubjectSplit !== record.split) {
      throw new Error(
        "reference_corpus_subject_split_leakage:" + record.subjectGroupId
      );
    }
    subjectSplit.set(record.subjectGroupId, record.split);

    if (nonEmpty(record.nearDuplicateFamilyId)) {
      const priorFamilySplit = familySplit.get(record.nearDuplicateFamilyId);
      if (priorFamilySplit && priorFamilySplit !== record.split) {
        throw new Error(
          "reference_corpus_near_duplicate_split_leakage:" +
            record.nearDuplicateFamilyId
        );
      }
      familySplit.set(record.nearDuplicateFamilyId, record.split);
    }

    validateMeasurement(record.measurement, manifest.provider);
    splitCounts[record.split] += 1;
  }

  if (splitCounts.reference === 0 || splitCounts.holdout === 0) {
    throw new Error("reference_corpus_required_split_empty");
  }

  return {
    schemaVersion: FACE_SPACE_REFERENCE_CORPUS_SUMMARY_SCHEMA_VERSION,
    status: "structurally_valid_research_corpus",
    samplingFrameKind: manifest.samplingFrame.kind,
    recordCount: manifest.records.length,
    distinctSubjectGroupCount: subjectSplit.size,
    splitCounts,
    dimensionIds: [...REQUIRED_DIMENSIONS],
    evidenceState: {
      multiSubjectCoverage: subjectSplit.size > 1,
      generalFaceSamplingFrame: true,
      referenceDistributionReadyForMethodSelection: splitCounts.reference > 0,
      lockedHoldoutPresent: splitCounts.holdout > 0
    },
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      referenceStatisticsAuthority: false,
      thresholdAuthority: false,
      archetypeAuthority: false
    }
  };
}

export const FACE_SPACE_REFERENCE_CORPUS_REQUIRED_DIMENSIONS =
  REQUIRED_DIMENSIONS;
