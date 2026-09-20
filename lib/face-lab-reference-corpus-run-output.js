import {
  validateFaceSpaceReferenceCorpusSourceManifest
} from "./face-lab-reference-corpus-source-manifest.js";
import {
  validateFaceSpaceReferenceCorpus
} from "./face-lab-face-space-reference-corpus.js";

export const FACE_SPACE_REFERENCE_CORPUS_RUN_OUTPUT_SCHEMA_VERSION =
  "face-space-reference-corpus-measurement-run-output-v0";

const RUNNER_VERSION =
  "face-space-reference-corpus-measurement-runner-v0";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildFaceSpaceReferenceCorpusRunOutput({
  sourceManifest,
  measurements,
  runtimeProvider,
  runnerVersion = RUNNER_VERSION
} = {}) {
  const sourceSummary =
    validateFaceSpaceReferenceCorpusSourceManifest(sourceManifest);

  if (
    runnerVersion !== RUNNER_VERSION ||
    !isObject(runtimeProvider) ||
    !nonEmpty(runtimeProvider.source) ||
    !nonEmpty(runtimeProvider.sourceVersion) ||
    !nonEmpty(runtimeProvider.adapterId)
  ) {
    throw new Error("reference_corpus_run_output_runtime_invalid");
  }

  if (
    !Array.isArray(measurements) ||
    measurements.length !== sourceManifest.records.length
  ) {
    throw new Error("reference_corpus_run_output_measurements_invalid");
  }

  const measurementBySampleId = new Map();
  for (const item of measurements) {
    if (
      !isObject(item) ||
      !nonEmpty(item.sampleId) ||
      !isObject(item.measurement) ||
      measurementBySampleId.has(item.sampleId)
    ) {
      throw new Error(
        "reference_corpus_run_output_measurement_entry_invalid"
      );
    }
    if (
      item.measurement.sampleId !== item.sampleId ||
      item.measurement.source !== runtimeProvider.source ||
      item.measurement.sourceVersion !== runtimeProvider.sourceVersion ||
      item.measurement.adapterId !== runtimeProvider.adapterId ||
      item.measurement.privacy?.sourceImagePersisted !== false ||
      item.measurement.privacy?.identityEmbeddingCreated !== false
    ) {
      throw new Error(
        "reference_corpus_run_output_measurement_provenance_invalid:" +
          item.sampleId
      );
    }
    measurementBySampleId.set(item.sampleId, item.measurement);
  }

  const records = sourceManifest.records.map((sourceRecord) => {
    const measurement = measurementBySampleId.get(sourceRecord.sampleId);
    if (!measurement) {
      throw new Error(
        "reference_corpus_run_output_measurement_missing:" +
          sourceRecord.sampleId
      );
    }

    return {
      sampleId: sourceRecord.sampleId,
      subjectGroupId: sourceRecord.subjectGroupId,
      nearDuplicateFamilyId:
        sourceRecord.nearDuplicateFamilyId || null,
      provenanceRef: sourceRecord.provenanceRef,
      split: sourceRecord.split,
      archetypeGroundTruth: null,
      identityEmbeddingCreated: false,
      biometricIdentityMatchPerformed: false,
      rawImagePersistedInPacket: false,
      eligibilityQuality: {
        eligible: true,
        qualityStatus: sourceRecord.eligibilityQuality.qualityStatus
      },
      sourceReceipt: {
        runnerVersion,
        sourceManifestDigest: sourceSummary.sourceManifestDigest,
        sourceImageSha256: sourceRecord.image.sha256
      },
      measurement
    };
  });

  const corpus = {
    schemaVersion: "face-space-reference-corpus-v0",
    productionAuthority: false,
    normalizationAuthority: false,
    samplingFrame: {
      kind: sourceManifest.samplingFrame.kind,
      provenanceRef: sourceManifest.samplingFrame.provenanceRef,
      archetypeSeeded: false,
      generalFaceIntent: true
    },
    provider: {
      source: runtimeProvider.source,
      sourceVersion: runtimeProvider.sourceVersion,
      adapterId: runtimeProvider.adapterId
    },
    sourceExecution: {
      runnerVersion,
      sourceManifestDigest: sourceSummary.sourceManifestDigest,
      rawImagePersisted: false,
      rawLandmarksPersisted: false,
      identityEmbeddingCreated: false,
      biometricIdentityMatchPerformed: false
    },
    records
  };

  const corpusSummary = validateFaceSpaceReferenceCorpus(corpus);

  return {
    schemaVersion: FACE_SPACE_REFERENCE_CORPUS_RUN_OUTPUT_SCHEMA_VERSION,
    ok: true,
    runnerVersion,
    sourceSummary,
    corpus,
    corpusSummary,
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false
    },
    privacy: {
      outputContainsLocalImagePaths: false,
      sourceImagePersisted: false,
      rawLandmarksPersisted: false,
      identityEmbeddingCreated: false,
      biometricIdentityMatchPerformed: false
    }
  };
}

export const FACE_SPACE_REFERENCE_CORPUS_RUNNER_VERSION = RUNNER_VERSION;
