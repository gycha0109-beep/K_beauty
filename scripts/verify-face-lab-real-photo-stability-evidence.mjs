import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildRealPhotoSameSubjectStabilityEvidence,
  summarizeRealPhotoStabilityCollection,
  REAL_PHOTO_STABILITY_REQUIRED_NUISANCE_CLASSES
} from "../lib/face-lab-real-photo-stability-evidence.js";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

const semanticContract = readJson(
  "evidence/facelab/structural-measurement/v0/semantic-contract.json"
);
const intakeContract = readJson(
  "evidence/facelab/photo-geometry/v0/real-photo-same-subject-stability.contract.json"
);

assert.equal(intakeContract.productionAuthority, false);
assert.equal(intakeContract.normalizationAuthority, false);
assert.equal(intakeContract.currentEvidence.realPhotoPairCount, 0);
assert.deepEqual(
  [...REAL_PHOTO_STABILITY_REQUIRED_NUISANCE_CLASSES].sort(),
  [...intakeContract.requiredNuisanceClasses].sort()
);
assert.equal(
  intakeContract.evidencePromotion.controlled3dCanSatisfyRealPhotoGate,
  false
);

function measurement(sampleId, delta = {}, source = "mediapipe_face_geometry") {
  const values = {
    lower_face_width_ratio: 0.74,
    chin_height_ratio: 0.45,
    eye_spacing_ratio: 0.20,
    eye_width_ratio: 0.17,
    eye_tilt: 0.2,
    nose_width_ratio: 0.18,
    ...delta
  };
  return {
    schemaVersion: "face-space-structural-measurement-v0",
    measurementVersion: "face-space-structural-measurement-v0",
    semanticsVersion: "face-space-structural-measurement-semantics-v0",
    sampleId,
    source,
    sourceVersion:
      source === "mediapipe_face_geometry"
        ? "google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809"
        : "other-provider",
    adapterId:
      source === "mediapipe_face_geometry"
        ? "mediapipe-face-geometry-metric-v0"
        : "other-adapter",
    coordinateSpace: "pose_normalized_metric_3d",
    normalizationReference:
      "face_left_lateral_to_face_right_lateral_3d_distance",
    dimensions: Object.entries(values).map(([id, value]) => ({
      id,
      value,
      unit: id === "eye_tilt" ? "degree" : "ratio"
    })),
    privacy: {
      sourceImagePersisted: false,
      identityEmbeddingCreated: false
    }
  };
}

const baseline = measurement("opaque_reference");
const nuisanceFixtures = [
  ["head_yaw", { lower_face_width_ratio: 0.741, eye_tilt: 0.24 }],
  ["head_pitch", { chin_height_ratio: 0.451, eye_tilt: 0.19 }],
  ["head_roll", { eye_width_ratio: 0.1705, eye_tilt: 0.22 }],
  ["expression", { chin_height_ratio: 0.456, nose_width_ratio: 0.181 }]
];

const reports = nuisanceFixtures.map(([nuisanceClass, delta], index) =>
  buildRealPhotoSameSubjectStabilityEvidence(
    {
      pairGroupId: "opaque_pair_" + index,
      referenceMeasurement: baseline,
      candidateMeasurement: measurement("opaque_candidate_" + index, delta),
      nuisance: { class: nuisanceClass },
      subjectLinkage: {
        method:
          index % 2 === 0
            ? "dataset_same_subject_provenance"
            : "manual_same_subject_pair",
        evidenceRef: "opaque-provenance-ref-" + index,
        biometricIdentityMatchPerformed: false
      }
    },
    semanticContract
  )
);

for (const report of reports) {
  assert.equal(report.comparison.comparisonKind, "same_provider");
  assert.equal(report.authority.productionAuthority, false);
  assert.equal(report.authority.thresholdAuthority, false);
  assert.equal(report.authority.normalizationAuthority, false);
  assert.equal(report.privacy.sourceImagePersisted, false);
  assert.equal(report.privacy.rawLandmarksPersisted, false);
  assert.equal(report.privacy.identityEmbeddingCreated, false);
  assert.equal(report.privacy.biometricIdentityMatchPerformed, false);
}

const complete = summarizeRealPhotoStabilityCollection(reports);
assert.equal(complete.realPhotoPoseAndExpressionCoverage, "covered_for_research");
assert.deepEqual(complete.missingNuisanceClasses, []);
assert.equal(
  complete.readinessContribution.realPoseEvidenceKind,
  "real_photo_same_subject"
);
assert.equal(
  complete.readinessContribution.realExpressionEvidenceKind,
  "real_photo_same_subject"
);
assert.equal(complete.authority.normalizationAuthority, false);

const incomplete = summarizeRealPhotoStabilityCollection(
  reports.filter((report) => report.nuisance.class !== "expression")
);
assert.equal(incomplete.realPhotoPoseAndExpressionCoverage, "incomplete");
assert.equal(incomplete.readinessContribution.realExpressionEvidenceKind, null);
assert.deepEqual(incomplete.missingNuisanceClasses, ["expression"]);

assert.throws(
  () =>
    buildRealPhotoSameSubjectStabilityEvidence(
      {
        pairGroupId: "controlled_3d_not_real_photo",
        referenceMeasurement: baseline,
        candidateMeasurement: measurement("controlled_candidate"),
        nuisance: { class: "head_yaw" },
        subjectLinkage: {
          method: "controlled_3d_same_identity",
          evidenceRef: "synthetic-only",
          biometricIdentityMatchPerformed: false
        }
      },
      semanticContract
    ),
  /linkage_method_invalid/
);

assert.throws(
  () =>
    buildRealPhotoSameSubjectStabilityEvidence(
      {
        pairGroupId: "biometric_forbidden",
        referenceMeasurement: baseline,
        candidateMeasurement: measurement("bad_candidate"),
        nuisance: { class: "head_pitch" },
        subjectLinkage: {
          method: "manual_same_subject_pair",
          evidenceRef: "manual-note",
          biometricIdentityMatchPerformed: true
        }
      },
      semanticContract
    ),
  /biometric_match_forbidden/
);

assert.throws(
  () =>
    buildRealPhotoSameSubjectStabilityEvidence(
      {
        pairGroupId: "cross_provider_forbidden",
        referenceMeasurement: baseline,
        candidateMeasurement: measurement(
          "other_provider_candidate",
          {},
          "other_provider"
        ),
        nuisance: { class: "expression" },
        subjectLinkage: {
          method: "dataset_same_subject_provenance",
          evidenceRef: "dataset-row-id",
          biometricIdentityMatchPerformed: false
        }
      },
      semanticContract
    ),
  /same_provider_required/
);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  currentRealPhotoPairCount: intakeContract.currentEvidence.realPhotoPairCount,
  requiredNuisanceClasses: REAL_PHOTO_STABILITY_REQUIRED_NUISANCE_CLASSES,
  simulatedCompleteCollection: {
    reportCount: complete.reportCount,
    opaquePairGroupCount: complete.opaquePairGroupCount,
    coverage: complete.realPhotoPoseAndExpressionCoverage
  },
  invariants: {
    controlled3dCannotSatisfyRealPhotoGate: true,
    biometricIdentityMatchingForbidden: true,
    crossProviderPairRejected: true,
    rawLandmarkPersistenceForbidden: true,
    technicalCoverageDoesNotCreateNormalizationAuthority: true
  }
}, null, 2));
