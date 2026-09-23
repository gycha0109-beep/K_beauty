import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  estimateFaceSpaceReferenceStatistics
} from "../lib/face-lab-reference-statistics-research.js";
import {
  buildFaceSpaceReferenceMethodComparison
} from "../lib/face-lab-reference-method-comparison-research.js";
import {
  buildFaceSpaceReferenceMethodSelectionDecision
} from "../lib/face-lab-reference-method-selection-research.js";

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

const comparison = buildFaceSpaceReferenceMethodComparison({
  manifest,
  comparisonVersion: "synthetic-verifier-method-comparison-v0"
});
const selection = buildFaceSpaceReferenceMethodSelectionDecision({
  comparison,
  selectedMethodId: "mean__standard_deviation",
  decisionVersion: "synthetic-verifier-method-v0",
  evidenceRef: "synthetic-verifier-only:method-selection",
  selectionRationale:
    "Synthetic verifier chooses one supported method only to exercise lineage gates."
});
const decision = selection.decision;

const stats = estimateFaceSpaceReferenceStatistics({
  manifest,
  methodDecision: decision,
  methodComparison: comparison,
  version: "synthetic-verifier-statistics-v0"
});

assert.equal(stats.schemaVersion, "face-space-reference-statistics-v0");
assert.equal(stats.referenceSplitOnly, true);
assert.equal(stats.referenceSampleCount, 3);
assert.equal(stats.holdoutSampleCountExcluded, 1);
assert.equal(stats.methodDecisionVersion, decision.decisionVersion);
assert.match(stats.sourceReferenceSplitFingerprint, /^sha256:[a-f0-9]{64}$/);
assert.equal(
  stats.sourceSamplingFrameProvenanceRef,
  manifest.samplingFrame.provenanceRef
);
assert.deepEqual(stats.sourceProvider, manifest.provider);
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
  methodComparison: comparison,
  version: "synthetic-verifier-statistics-holdout-change-v0"
});
assert.equal(
  statsWithChangedHoldout.sourceReferenceSplitFingerprint,
  stats.sourceReferenceSplitFingerprint
);
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
    buildFaceSpaceReferenceMethodComparison({
      manifest: degenerate,
      comparisonVersion: "synthetic-degenerate-comparison"
    }),
  /degenerate_scale/
);

const actualRunOutput = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-corpus-run-output.json",
    "utf8"
  )
);
const actualComparison = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-method-comparison.json",
    "utf8"
  )
);
const actualSelection = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-method-selection.json",
    "utf8"
  )
);
const actualStatistics = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-statistics.json",
    "utf8"
  )
);
const rebuiltActualStatistics = estimateFaceSpaceReferenceStatistics({
  manifest: actualRunOutput.corpus,
  methodDecision: actualSelection.decision,
  methodComparison: actualComparison,
  version: "london-set-v5-reference-statistics-v1"
});
assert.deepEqual(actualStatistics, rebuiltActualStatistics);
assert.equal(actualStatistics.referenceSplitOnly, true);
assert.equal(actualStatistics.referenceSampleCount, 82);
assert.equal(actualStatistics.holdoutSampleCountExcluded, 20);
assert.equal(actualStatistics.centerMethod, "median");
assert.equal(
  actualStatistics.scaleMethod,
  "mad_scaled_consistent"
);
assert.equal(actualStatistics.authority.productionAuthority, false);
assert.equal(actualStatistics.authority.normalizationAuthority, false);
assert.equal(actualStatistics.authority.thresholdAuthority, false);
assert.equal("percentiles" in actualStatistics, false);
assert.equal("thresholds" in actualStatistics, false);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  referenceSplitOnly: true,
  holdoutExcludedFromEstimation: true,
  syntheticVerifierOnly: true,
  actualReferenceStatisticsPersisted: true,
  actualReferenceStatisticsVersion: actualStatistics.version,
  actualReferenceSampleCount: actualStatistics.referenceSampleCount,
  actualHoldoutSampleCountExcluded:
    actualStatistics.holdoutSampleCountExcluded,
  exactReferenceSplitFingerprintCarried: true,
  holdoutDoesNotChangeReferenceFingerprint: true,
  statisticsRequireMatchingMethodComparison: true,
  methodDecisionBuiltFromComparisonEvidence: true
}, null, 2));
