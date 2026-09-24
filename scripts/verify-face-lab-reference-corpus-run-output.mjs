import assert from "node:assert/strict";
import {
  buildFaceSpaceReferenceCorpusRunOutput
} from "../lib/face-lab-reference-corpus-run-output.js";

const dimensions = [
  ["lower_face_width_ratio", "ratio"],
  ["chin_height_ratio", "ratio"],
  ["eye_spacing_ratio", "ratio"],
  ["eye_width_ratio", "ratio"],
  ["eye_tilt", "degree"],
  ["nose_width_ratio", "ratio"]
];

const runtimeProvider = {
  source: "mediapipe_face_geometry",
  sourceVersion:
    "google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809",
  adapterId: "mediapipe-face-geometry-metric-v0"
};

function sourceRecord(sampleId, subjectGroupId, split, digit, familyId) {
  return {
    sampleId,
    subjectGroupId,
    nearDuplicateFamilyId: familyId,
    provenanceRef: "synthetic-verifier:" + sampleId,
    split,
    archetypeGroundTruth: null,
    identityEmbeddingCreated: false,
    biometricIdentityMatchPerformed: false,
    eligibilityQuality: {
      eligible: true,
      qualityStatus: "synthetic_verifier_only"
    },
    image: {
      path: "/local-only/" + sampleId + ".png",
      sha256: String(digit).repeat(64),
      mediaType: "image/png",
      rawImagePersistenceAllowed: false
    }
  };
}

const sourceManifest = {
  schemaVersion: "face-space-reference-corpus-source-manifest-v0",
  productionAuthority: false,
  normalizationAuthority: false,
  samplingFrame: {
    kind: "consented_general_face_corpus",
    provenanceRef: "synthetic-verifier-only",
    archetypeSeeded: false,
    generalFaceIntent: true,
    identityEmbeddingAllowed: false,
    biometricIdentityMatchingAllowed: false,
    rawImagePersistenceAllowed: false
  },
  subjectGrouping: {
    method: "dataset_subject_provenance",
    evidenceRef: "synthetic-subject-map",
    biometricIdentityMatchPerformed: false
  },
  records: [
    sourceRecord("ref_a", "subject_a", "reference", 1, "family_a"),
    sourceRecord("ref_b", "subject_b", "reference", 2, "family_b"),
    sourceRecord("ref_c", "subject_c", "reference", 3, "family_c"),
    sourceRecord("holdout_d", "subject_d", "holdout", 4, "family_d")
  ]
};

function measurement(sampleId, offset) {
  return {
    schemaVersion: "face-space-structural-measurement-v0",
    measurementVersion: "face-space-structural-measurement-v0",
    semanticsVersion: "face-space-structural-measurement-semantics-v0",
    sampleId,
    source: runtimeProvider.source,
    sourceVersion: runtimeProvider.sourceVersion,
    adapterId: runtimeProvider.adapterId,
    coordinateSpace: "pose_normalized_metric_3d",
    normalizationReference:
      "face_left_lateral_to_face_right_lateral_3d_distance",
    dimensions: dimensions.map(([id, unit], index) => ({
      id,
      unit,
      value: 0.2 + index * 0.1 + offset
    })),
    privacy: {
      sourceImagePersisted: false,
      identityEmbeddingCreated: false
    }
  };
}

const measurements = sourceManifest.records.map((record, index) => ({
  sampleId: record.sampleId,
  measurement: measurement(record.sampleId, index * 0.01)
}));

const output = buildFaceSpaceReferenceCorpusRunOutput({
  sourceManifest,
  measurements,
  runtimeProvider
});

assert.equal(
  output.schemaVersion,
  "face-space-reference-corpus-measurement-run-output-v0"
);
assert.equal(output.ok, true);
assert.equal(output.corpus.records.length, 4);
assert.equal(output.corpusSummary.splitCounts.reference, 3);
assert.equal(output.corpusSummary.splitCounts.holdout, 1);
assert.match(
  output.sourceSummary.sourceManifestDigest,
  /^sha256:[a-f0-9]{64}$/
);
assert.equal(
  output.corpus.sourceExecution.sourceManifestDigest,
  output.sourceSummary.sourceManifestDigest
);
assert.equal(
  output.corpusSummary.sourceExecution.sourceManifestDigest,
  output.sourceSummary.sourceManifestDigest
);
assert.match(
  output.corpusSummary.referenceSplitFingerprint,
  /^sha256:[a-f0-9]{64}$/
);
assert.equal(output.privacy.outputContainsLocalImagePaths, false);
assert.equal(
  JSON.stringify(output).includes("/local-only/"),
  false
);

for (let index = 0; index < output.corpus.records.length; index += 1) {
  const record = output.corpus.records[index];
  const sourceRecord = sourceManifest.records[index];
  assert.equal(record.rawImagePersistedInPacket, false);
  assert.equal(record.identityEmbeddingCreated, false);
  assert.equal(record.biometricIdentityMatchPerformed, false);
  assert.equal(
    record.sourceReceipt.sourceImageSha256,
    sourceRecord.image.sha256
  );
  assert.equal(
    record.sourceReceipt.sourceManifestDigest,
    output.sourceSummary.sourceManifestDigest
  );
  assert.equal("path" in record.sourceReceipt, false);
}

const badProviderMeasurements = structuredClone(measurements);
badProviderMeasurements[0].measurement.sourceVersion = "wrong";
assert.throws(
  () =>
    buildFaceSpaceReferenceCorpusRunOutput({
      sourceManifest,
      measurements: badProviderMeasurements,
      runtimeProvider
    }),
  /measurement_provenance_invalid/
);

const missingMeasurement = measurements.slice(0, -1);
assert.throws(
  () =>
    buildFaceSpaceReferenceCorpusRunOutput({
      sourceManifest,
      measurements: missingMeasurement,
      runtimeProvider
    }),
  /measurements_invalid/
);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  generatedCorpusValidated: true,
  exactSourceManifestDigestCarried: true,
  sourceImageSha256ReceiptsCarried: true,
  localImagePathsRemovedFromOutput: true,
  rawLandmarksExcludedFromOutput: true,
  syntheticMeasurementsOnly: true,
  actualReferenceCorpusGenerated: false
}, null, 2));
