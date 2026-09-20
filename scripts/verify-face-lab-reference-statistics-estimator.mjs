import assert from "node:assert/strict";
import {
  estimateFaceSpaceReferenceStatistics
} from "../lib/face-lab-reference-statistics-research.js";
import {
  validateFaceSpaceReferenceStatisticsMethodDecision
} from "../lib/face-lab-face-space-normalization-research.js";

const dimensionIds = [
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
    dimensions: dimensionIds.map(([id, unit], index) => ({
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

const manifest = {
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
    record("ref_a", "subject_a", "reference", 0.00, "family_a"),
    record("ref_b", "subject_b", "reference", 0.02, "family_b"),
    record("ref_c", "subject_c", "reference", 0.04, "family_c"),
    record("holdout_d", "subject_d", "holdout", 10.0, "family_d")
  ]
};

const decision =
  validateFaceSpaceReferenceStatisticsMethodDecision({
    schemaVersion: "face-space-reference-statistics-method-decision-v0",
    status: "selected_for_research_candidate",
    decisionVersion: "synthetic-verifier-method-v0",
    scope: "same_provider",
    referenceCorpusSummarySchemaVersion:
      "face-space-reference-corpus-summary-v0",
    centerMethod: "mean",
    scaleMethod: "standard_deviation",
    percentileMethod: null,
    thresholdMethod: null,
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false
  });

const stats = estimateFaceSpaceReferenceStatistics({
  manifest,
  methodDecision: decision,
  version: "synthetic-verifier-statistics-v0"
});

assert.equal(stats.schemaVersion, "face-space-reference-statistics-v0");
assert.equal(stats.referenceSplitOnly, true);
assert.equal(stats.referenceSampleCount, 3);
assert.equal(stats.holdoutSampleCountExcluded, 1);
assert.equal(stats.methodDecisionVersion, decision.decisionVersion);
assert.equal(stats.authority.productionAuthority, false);
assert.equal(stats.authority.normalizationAuthority, false);
assert.equal(stats.authority.thresholdAuthority, false);
assert.equal(stats.dimensions.length, 6);

const lower = stats.dimensions.find(
  (dimension) => dimension.id === "lower_face_width_ratio"
);
assert.ok(Math.abs(lower.center - 0.22) < 1e-12);
assert.ok(lower.scale > 0);
assert.ok(lower.center < 1);

const changedHoldout = {
  ...manifest,
  records: manifest.records.map((item) =>
    item.split === "holdout"
      ? {
          ...item,
          measurement: measurement(item.sampleId, 1000)
        }
      : item
  )
};
const statsWithChangedHoldout = estimateFaceSpaceReferenceStatistics({
  manifest: changedHoldout,
  methodDecision: decision,
  version: "synthetic-verifier-statistics-holdout-change-v0"
});
assert.deepEqual(
  statsWithChangedHoldout.dimensions.map(({ id, unit, center, scale }) => ({
    id,
    unit,
    center,
    scale
  })),
  stats.dimensions.map(({ id, unit, center, scale }) => ({
    id,
    unit,
    center,
    scale
  }))
);

const degenerate = {
  ...manifest,
  records: manifest.records.map((item) =>
    item.split === "reference"
      ? {
          ...item,
          measurement: measurement(item.sampleId, 0)
        }
      : item
  )
};
assert.throws(
  () =>
    estimateFaceSpaceReferenceStatistics({
      manifest: degenerate,
      methodDecision: decision,
      version: "degenerate"
    }),
  /degenerate_scale/
);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  referenceSplitOnly: true,
  holdoutExcludedFromEstimation: true,
  syntheticVerifierOnly: true,
  actualReferenceStatisticsPersisted: false
}, null, 2));
