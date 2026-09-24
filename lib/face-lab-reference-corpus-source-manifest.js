import { createHash } from "node:crypto";

export const FACE_SPACE_REFERENCE_CORPUS_SOURCE_MANIFEST_SCHEMA_VERSION =
  "face-space-reference-corpus-source-manifest-v0";

const ALLOWED_SAMPLING_FRAME_KINDS = new Set([
  "consented_general_face_corpus",
  "licensed_general_face_corpus"
]);

const ALLOWED_SUBJECT_GROUPING_METHODS = new Set([
  "dataset_subject_provenance",
  "manual_research_grouping"
]);

const ALLOWED_SPLITS = new Set(["reference", "holdout"]);
const ALLOWED_MEDIA_TYPES = new Set(["image/png", "image/jpeg"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function buildSourceManifestDigest(manifest) {
  const payload = {
    schemaVersion: manifest.schemaVersion,
    samplingFrame: {
      kind: manifest.samplingFrame.kind,
      provenanceRef: manifest.samplingFrame.provenanceRef
    },
    subjectGrouping: {
      method: manifest.subjectGrouping.method,
      evidenceRef: manifest.subjectGrouping.evidenceRef
    },
    records: manifest.records
      .map((record) => ({
        sampleId: record.sampleId,
        subjectGroupId: record.subjectGroupId,
        nearDuplicateFamilyId: record.nearDuplicateFamilyId || null,
        provenanceRef: record.provenanceRef,
        split: record.split,
        eligibilityQuality: {
          eligible: record.eligibilityQuality.eligible,
          qualityStatus: record.eligibilityQuality.qualityStatus
        },
        image: {
          sha256: record.image.sha256,
          mediaType: record.image.mediaType
        }
      }))
      .sort((a, b) => a.sampleId.localeCompare(b.sampleId))
  };

  return (
    "sha256:" +
    createHash("sha256").update(JSON.stringify(payload)).digest("hex")
  );
}

export function validateFaceSpaceReferenceCorpusSourceManifest(manifest = {}) {
  if (
    !isObject(manifest) ||
    manifest.schemaVersion !==
      FACE_SPACE_REFERENCE_CORPUS_SOURCE_MANIFEST_SCHEMA_VERSION ||
    manifest.productionAuthority !== false ||
    manifest.normalizationAuthority !== false
  ) {
    throw new Error("reference_corpus_source_manifest_invalid");
  }

  if (
    !isObject(manifest.samplingFrame) ||
    !ALLOWED_SAMPLING_FRAME_KINDS.has(manifest.samplingFrame.kind) ||
    !nonEmpty(manifest.samplingFrame.provenanceRef) ||
    manifest.samplingFrame.archetypeSeeded !== false ||
    manifest.samplingFrame.generalFaceIntent !== true ||
    manifest.samplingFrame.identityEmbeddingAllowed !== false ||
    manifest.samplingFrame.biometricIdentityMatchingAllowed !== false ||
    manifest.samplingFrame.rawImagePersistenceAllowed !== false
  ) {
    throw new Error("reference_corpus_source_sampling_frame_invalid");
  }

  if (
    !isObject(manifest.subjectGrouping) ||
    !ALLOWED_SUBJECT_GROUPING_METHODS.has(
      manifest.subjectGrouping.method
    ) ||
    !nonEmpty(manifest.subjectGrouping.evidenceRef) ||
    manifest.subjectGrouping.biometricIdentityMatchPerformed !== false
  ) {
    throw new Error("reference_corpus_source_subject_grouping_invalid");
  }

  if (!Array.isArray(manifest.records) || manifest.records.length === 0) {
    throw new Error("reference_corpus_source_records_missing");
  }

  const sampleIds = new Set();
  const sampleIdByImageSha = new Map();
  const subjectSplit = new Map();
  const familySplit = new Map();
  const splitCounts = { reference: 0, holdout: 0 };

  for (const record of manifest.records) {
    if (
      !isObject(record) ||
      !nonEmpty(record.sampleId) ||
      !nonEmpty(record.subjectGroupId) ||
      !nonEmpty(record.provenanceRef) ||
      !ALLOWED_SPLITS.has(record.split) ||
      (record.archetypeGroundTruth !== undefined &&
        record.archetypeGroundTruth !== null) ||
      record.identityEmbeddingCreated !== false ||
      record.biometricIdentityMatchPerformed !== false ||
      !isObject(record.eligibilityQuality) ||
      record.eligibilityQuality.eligible !== true ||
      !nonEmpty(record.eligibilityQuality.qualityStatus) ||
      !isObject(record.image) ||
      !nonEmpty(record.image.path) ||
      !sha256(record.image.sha256) ||
      !ALLOWED_MEDIA_TYPES.has(record.image.mediaType) ||
      record.image.rawImagePersistenceAllowed !== false
    ) {
      throw new Error("reference_corpus_source_record_invalid");
    }

    if (sampleIds.has(record.sampleId)) {
      throw new Error(
        "reference_corpus_source_sample_duplicate:" + record.sampleId
      );
    }
    sampleIds.add(record.sampleId);

    const priorSampleForSha = sampleIdByImageSha.get(record.image.sha256);
    if (priorSampleForSha && priorSampleForSha !== record.sampleId) {
      throw new Error(
        "reference_corpus_source_image_duplicate:" + record.sampleId
      );
    }
    sampleIdByImageSha.set(record.image.sha256, record.sampleId);

    const priorSubjectSplit = subjectSplit.get(record.subjectGroupId);
    if (priorSubjectSplit && priorSubjectSplit !== record.split) {
      throw new Error(
        "reference_corpus_source_subject_split_leakage:" +
          record.subjectGroupId
      );
    }
    subjectSplit.set(record.subjectGroupId, record.split);

    if (nonEmpty(record.nearDuplicateFamilyId)) {
      const priorFamilySplit = familySplit.get(record.nearDuplicateFamilyId);
      if (priorFamilySplit && priorFamilySplit !== record.split) {
        throw new Error(
          "reference_corpus_source_near_duplicate_split_leakage:" +
            record.nearDuplicateFamilyId
        );
      }
      familySplit.set(record.nearDuplicateFamilyId, record.split);
    }

    splitCounts[record.split] += 1;
  }

  if (splitCounts.reference === 0 || splitCounts.holdout === 0) {
    throw new Error("reference_corpus_source_required_split_empty");
  }

  return {
    schemaVersion: "face-space-reference-corpus-source-manifest-summary-v0",
    sourceManifestDigest: buildSourceManifestDigest(manifest),
    samplingFrameKind: manifest.samplingFrame.kind,
    samplingFrameProvenanceRef: manifest.samplingFrame.provenanceRef,
    subjectGroupingMethod: manifest.subjectGrouping.method,
    recordCount: manifest.records.length,
    distinctSubjectGroupCount: subjectSplit.size,
    splitCounts,
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false
    },
    privacy: {
      rawImagePersistenceAllowed: false,
      identityEmbeddingAllowed: false,
      biometricIdentityMatchingAllowed: false
    }
  };
}
