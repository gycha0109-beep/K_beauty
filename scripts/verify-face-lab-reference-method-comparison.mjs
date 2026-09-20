import assert from "node:assert/strict";
import {
  buildFaceSpaceReferenceMethodComparison,
  FACE_SPACE_REFERENCE_METHOD_COMPARISON_METHODS
} from "../lib/face-lab-reference-method-comparison-research.js";

const dimensions = [
  ["lower_face_width_ratio", "ratio"],
  ["chin_height_ratio", "ratio"],
  ["eye_spacing_ratio", "ratio"],
  ["eye_width_ratio", "ratio"],
  ["eye_tilt", "degree"],
  ["nose_width_ratio", "ratio"]
];

function measurement(sampleId, offset) {
  return {
    schemaVersion: "face-space-structural-measurement-v0",
    sampleId,
    source: "mediapipe_face_landmarker_metric_geometry",
    sourceVersion: "0.10.35",
    adapterId: "mediapipe_metric_geometry_v0",
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

function record(sampleId, subjectGroupId, split, offset, familyId) {
  return {
    sampleId,
    subjectGroupId,
    nearDuplicateFamilyId: familyId,
    provenanceRef: "synthetic-verifier-only:" + sampleId,
    split,
    archetypeGroundTruth: null,
    identityEmbeddingCreated: false,
    biometricIdentityMatchPerformed: false,
    rawImagePersistedInPacket: false,
    eligibilityQuality: {
      eligible: true,
      qualityStatus: "synthetic_verifier_only"
    },
    measurement: measurement(sampleId, offset)
  };
}

function manifest(referenceOffsets = [0, 0.02, 0.05], holdoutOffset = 100) {
  return {
    schemaVersion: "face-space-reference-corpus-v0",
    productionAuthority: false,
    normalizationAuthority: false,
    samplingFrame: {
      kind: "consented_general_face_corpus",
      provenanceRef: "synthetic-verifier-only",
      archetypeSeeded: false,
      generalFaceIntent: true
    },
    provider: {
      source: "mediapipe_face_landmarker_metric_geometry",
      sourceVersion: "0.10.35",
      adapterId: "mediapipe_metric_geometry_v0"
    },
    records: [
      record("ref_a", "subject_a", "reference", referenceOffsets[0], "family_a"),
      record("ref_b", "subject_b", "reference", referenceOffsets[1], "family_b"),
      record("ref_c", "subject_c", "reference", referenceOffsets[2], "family_c"),
      record("holdout_d", "subject_d", "holdout", holdoutOffset, "family_d")
    ]
  };
}

const baseManifest = manifest();
const comparison = buildFaceSpaceReferenceMethodComparison({
  manifest: baseManifest,
  comparisonVersion: "synthetic-verifier-comparison-v0"
});

assert.equal(
  comparison.schemaVersion,
  "face-space-reference-method-comparison-v0"
);
assert.equal(comparison.status, "descriptive_comparison_only");
assert.equal(comparison.referenceSplitOnly, true);
assert.equal(comparison.referenceSampleCount, 3);
assert.equal(comparison.holdoutSampleCountExcluded, 1);
assert.equal(comparison.profiles.length, 4);
assert.match(comparison.sourceReferenceSplitFingerprint, /^sha256:[a-f0-9]{64}$/);
assert.match(comparison.packetFingerprint, /^sha256:[a-f0-9]{64}$/);
assert.equal(comparison.authority.productionAuthority, false);
assert.equal(comparison.authority.normalizationAuthority, false);
assert.equal(comparison.authority.methodSelectionAuthority, false);
assert.equal(comparison.authority.rankingAuthority, false);
assert.equal(comparison.authority.thresholdAuthority, false);
assert.equal("winner" in comparison, false);
assert.equal("selectedMethod" in comparison, false);
assert.equal("ranking" in comparison, false);
assert.deepEqual(
  comparison.profiles.map((profile) => [
    profile.centerMethod,
    profile.scaleMethod
  ]),
  FACE_SPACE_REFERENCE_METHOD_COMPARISON_METHODS
);

const changedHoldout = buildFaceSpaceReferenceMethodComparison({
  manifest: manifest([0, 0.02, 0.05], 10000),
  comparisonVersion: "synthetic-verifier-comparison-holdout-v0"
});
assert.deepEqual(changedHoldout.profiles, comparison.profiles);
assert.equal(
  changedHoldout.sourceReferenceSplitFingerprint,
  comparison.sourceReferenceSplitFingerprint
);

const changedReference = buildFaceSpaceReferenceMethodComparison({
  manifest: manifest([0, 0.1, 0.4], 100),
  comparisonVersion: "synthetic-verifier-comparison-reference-v0"
});
assert.notDeepEqual(changedReference.profiles, comparison.profiles);
assert.notEqual(
  changedReference.sourceReferenceSplitFingerprint,
  comparison.sourceReferenceSplitFingerprint
);

console.log(JSON.stringify({
  ok: true,
  status: comparison.status,
  productionAuthority: false,
  normalizationAuthority: false,
  methodSelectionAuthority: false,
  rankingAuthority: false,
  thresholdAuthority: false,
  referenceSplitOnly: true,
  holdoutExcludedFromComparison: true,
  comparisonDoesNotSelectWinner: true,
  actualCorpusComparisonPersisted: false
}, null, 2));
