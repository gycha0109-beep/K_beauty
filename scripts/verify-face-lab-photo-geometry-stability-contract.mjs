import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildPhotoGeometryStabilityComparison,
  buildPhotoGeometryStabilityBatch,
  validatePhotoGeometryStabilityObservation,
  PHOTO_GEOMETRY_STABILITY_REAL_PAIR_REQUIRED
} from "../lib/face-lab-photo-geometry-stability.js";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const semanticContract = readJson(
  "evidence/facelab/structural-measurement/v0/semantic-contract.json"
);
const stabilityContract = readJson(
  "evidence/facelab/photo-geometry/v0/photo-geometry-stability.contract.json"
);

assert.equal(stabilityContract.productionAuthority, false);
assert.equal(stabilityContract.thresholdAuthority, false);
assert.deepEqual(
  [...PHOTO_GEOMETRY_STABILITY_REAL_PAIR_REQUIRED].sort(),
  [...stabilityContract.nuisanceClasses.realSameSubjectPairRequired].sort()
);

function measurement({
  sampleId,
  source = "mediapipe_face_geometry",
  sourceVersion = "google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809",
  adapterId = "mediapipe-face-geometry-metric-v0",
  delta = {},
  privacy = {
    sourceImagePersisted: false,
    identityEmbeddingCreated: false
  }
}) {
  const values = {
    lower_face_width_ratio: 0.76,
    chin_height_ratio: 0.53,
    eye_spacing_ratio: 0.22,
    eye_width_ratio: 0.186,
    eye_tilt: 0.11,
    nose_width_ratio: 0.27,
    ...delta
  };

  return {
    schemaVersion: "face-space-structural-measurement-v0",
    measurementVersion: "face-space-structural-measurement-v0",
    semanticsVersion: "face-space-structural-measurement-semantics-v0",
    sampleId,
    source,
    sourceVersion,
    adapterId,
    coordinateSpace: "pose_normalized_metric_3d",
    normalizationReference:
      "face_left_lateral_to_face_right_lateral_3d_distance",
    dimensions: Object.entries(values).map(([id, value]) => ({
      id,
      value,
      unit: id === "eye_tilt" ? "degree" : "ratio"
    })),
    privacy
  };
}

const baseline = measurement({ sampleId: "fixture_baseline" });
const repeat = measurement({ sampleId: "fixture_repeat" });
const resized = measurement({
  sampleId: "fixture_resize",
  delta: {
    lower_face_width_ratio: 0.7608,
    chin_height_ratio: 0.531,
    eye_spacing_ratio: 0.2205,
    eye_width_ratio: 0.1856,
    eye_tilt: 0.14,
    nose_width_ratio: 0.271
  }
});

const repeatReport = buildPhotoGeometryStabilityComparison(
  {
    pairGroupId: "pair_same_source_fixture",
    referenceMeasurement: baseline,
    candidateMeasurement: repeat,
    nuisance: { class: "repeated_run", runOrdinal: 2 },
    subjectLinkage: {
      method: "same_source_image_transform",
      status: "exact_same_source"
    }
  },
  semanticContract
);

assert.equal(repeatReport.comparisonKind, "same_provider");
assert.equal(repeatReport.interpretationStatus, "research_observation");
assert.equal(repeatReport.diagnostics.maxAbsoluteRatioDifference, 0);
assert.equal(repeatReport.diagnostics.maxAbsoluteDegreeDifference, 0);
assert.equal(
  repeatReport.dimensions.every(
    (item) => item.providerAnchorEquivalence === "not_applicable_same_provider"
  ),
  true
);
assert.deepEqual(
  validatePhotoGeometryStabilityObservation(repeatReport),
  { ok: true, errors: [] }
);

const batch = buildPhotoGeometryStabilityBatch(
  {
    pairGroupId: "pair_same_source_fixture",
    referenceMeasurement: baseline,
    variants: [
      {
        measurement: repeat,
        nuisance: { class: "repeated_run", runOrdinal: 2 }
      },
      {
        measurement: resized,
        nuisance: { class: "resolution", width: 768, height: 768 }
      }
    ],
    subjectLinkage: {
      method: "same_source_image_transform",
      status: "exact_same_source"
    }
  },
  semanticContract
);
assert.equal(batch.length, 2);
assert.ok(batch[1].diagnostics.maxAbsoluteRatioDifference > 0);
assert.ok(batch[1].diagnostics.maxAbsoluteDegreeDifference > 0);
assert.equal(batch[1].diagnostics.thresholdsApplied, false);

assert.throws(
  () =>
    buildPhotoGeometryStabilityComparison(
      {
        pairGroupId: "fake_pose_pair",
        referenceMeasurement: baseline,
        candidateMeasurement: resized,
        nuisance: { class: "head_yaw", degrees: 10 },
        subjectLinkage: {
          method: "same_source_image_transform",
          status: "synthetic_2d_warp"
        }
      },
      semanticContract
    ),
  /real_pair_required:head_yaw/
);

const realPoseReport = buildPhotoGeometryStabilityComparison(
  {
    pairGroupId: "manual_same_subject_pose_pair",
    referenceMeasurement: baseline,
    candidateMeasurement: resized,
    nuisance: { class: "head_yaw", bin: "small" },
    subjectLinkage: {
      method: "manual_same_subject_pair",
      status: "research_pair_asserted_without_biometric_matching"
    }
  },
  semanticContract
);
assert.equal(realPoseReport.interpretationStatus, "research_observation");
assert.equal(realPoseReport.privacy.biometricIdentityMatchPerformed, false);

const gnmCandidate = measurement({
  sampleId: "gnm_canonical_diagnostic",
  source: "gnm_v3",
  sourceVersion: "google/GNM@a424b5153eec9154f3dfa5ee7f214e5817918d54",
  adapterId: "google-gnm-v3-research-adapter-v0",
  delta: {
    lower_face_width_ratio: 0.745,
    chin_height_ratio: 0.492,
    eye_spacing_ratio: 0.224,
    eye_width_ratio: 0.184,
    eye_tilt: 0.078,
    nose_width_ratio: 0.228
  }
});

const crossProvider = buildPhotoGeometryStabilityComparison(
  {
    pairGroupId: "canonical_provider_diagnostic",
    referenceMeasurement: baseline,
    candidateMeasurement: gnmCandidate,
    nuisance: { class: "provider_comparison" },
    subjectLinkage: {
      method: "canonical_diagnostic",
      status: "not_same_subject_evidence"
    }
  },
  semanticContract
);

assert.equal(crossProvider.comparisonKind, "cross_provider");
assert.equal(crossProvider.interpretationStatus, "semantic_hold");
assert.deepEqual(
  crossProvider.dimensions
    .filter((item) => item.crossProviderInterpretation === "hold")
    .map((item) => item.id)
    .sort(),
  ["chin_height_ratio", "nose_width_ratio"]
);
assert.deepEqual(
  crossProvider.dimensions
    .filter((item) => item.crossProviderInterpretation === "unvalidated")
    .map((item) => item.id)
    .sort(),
  [
    "eye_spacing_ratio",
    "eye_tilt",
    "eye_width_ratio",
    "lower_face_width_ratio"
  ]
);

assert.throws(
  () =>
    buildPhotoGeometryStabilityComparison(
      {
        pairGroupId: "privacy_violation",
        referenceMeasurement: baseline,
        candidateMeasurement: measurement({
          sampleId: "bad_candidate",
          privacy: {
            sourceImagePersisted: false,
            identityEmbeddingCreated: true
          }
        }),
        nuisance: { class: "repeated_run" },
        subjectLinkage: {
          method: "same_source_image_transform",
          status: "exact_same_source"
        }
      },
      semanticContract
    ),
  /identity_embedding_forbidden/
);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  thresholdAuthority: false,
  repeatDeterminismContract: "PASS",
  sameProviderNuisanceObservation: "PASS",
  fakePoseWarpRejected: true,
  realPosePairContractAccepted: true,
  crossProviderStatus: crossProvider.interpretationStatus,
  crossProviderHoldDimensions: crossProvider.dimensions
    .filter((item) => item.crossProviderInterpretation === "hold")
    .map((item) => item.id),
  crossProviderUnvalidatedDimensions: crossProvider.dimensions
    .filter((item) => item.crossProviderInterpretation === "unvalidated")
    .map((item) => item.id)
}, null, 2));
