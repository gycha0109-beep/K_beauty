import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildRealPhotoSameSubjectStabilityEvidence
} from "../lib/face-lab-real-photo-stability-evidence.js";
import {
  buildFaceLabNormalizationReviewPacketFromRunOutput
} from "../lib/face-lab-normalization-review-packet-run-output.js";

const semanticContract = JSON.parse(
  readFileSync(
    "evidence/facelab/structural-measurement/v0/semantic-contract.json",
    "utf8"
  )
);

const provider = {
  source: "mediapipe_face_geometry",
  sourceVersion:
    "google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809",
  adapterId: "mediapipe-face-geometry-metric-v0"
};

const dimensionSpecs = [
  ["lower_face_width_ratio", "ratio", 0.74],
  ["chin_height_ratio", "ratio", 0.45],
  ["eye_spacing_ratio", "ratio", 0.20],
  ["eye_width_ratio", "ratio", 0.17],
  ["eye_tilt", "degree", 0.2],
  ["nose_width_ratio", "ratio", 0.18]
];

function measurement(sampleId, offset = 0) {
  return {
    schemaVersion: "face-space-structural-measurement-v0",
    measurementVersion: "face-space-structural-measurement-v0",
    semanticsVersion: "face-space-structural-measurement-semantics-v0",
    sampleId,
    source: provider.source,
    sourceVersion: provider.sourceVersion,
    adapterId: provider.adapterId,
    coordinateSpace: "pose_normalized_metric_3d",
    normalizationReference:
      "face_left_lateral_to_face_right_lateral_3d_distance",
    dimensions: dimensionSpecs.map(([id, unit, value]) => ({
      id,
      unit,
      value: value + offset
    })),
    privacy: {
      sourceImagePersisted: false,
      identityEmbeddingCreated: false
    }
  };
}

function report(index, nuisanceClass) {
  const digit = String(index + 1);
  return buildRealPhotoSameSubjectStabilityEvidence(
    {
      pairGroupId: "run_output_pair_" + index,
      referenceMeasurement: measurement("ref_" + index),
      candidateMeasurement: measurement(
        "candidate_" + index,
        (index + 1) * 0.001
      ),
      nuisance: { class: nuisanceClass },
      subjectLinkage: {
        method: "dataset_same_subject_provenance",
        evidenceRef: "synthetic-run-output:" + index,
        biometricIdentityMatchPerformed: false
      },
      executionProvenance: {
        kind: "real_photo_pair_runner",
        runnerVersion:
          "face-lab-real-photo-stability-pair-runner-v0",
        runManifestDigest: "sha256:" + digit.repeat(64),
        sourceSetProvenanceRef: "synthetic-run-output",
        referenceImageSha256: digit.repeat(64),
        candidateImageSha256: String(index + 5).repeat(64)
      }
    },
    semanticContract
  );
}

const reports = [
  report(0, "head_yaw"),
  report(1, "head_pitch"),
  report(2, "head_roll"),
  report(3, "expression")
];

const realRunOutput = {
  schemaVersion: "face-lab-real-photo-stability-run-output-v0",
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false,
  reports,
  privacy: {
    sourceImagePersisted: false,
    rawLandmarksPersisted: false,
    identityEmbeddingCreated: false,
    biometricIdentityMatchPerformed: false,
    outputContainsStructuralEvidenceOnly: true
  }
};

const realPacket =
  buildFaceLabNormalizationReviewPacketFromRunOutput({
    kind: "real-photo-stability",
    runOutput: realRunOutput,
    packetVersion: "synthetic-run-output-review-v0"
  });
assert.equal(
  realPacket.schemaVersion,
  "face-lab-real-photo-stability-review-packet-v0"
);
assert.equal(realPacket.privacy.localImagePathsIncluded, false);
assert.equal(realPacket.authority.adequacyDecisionAuthority, false);

function corpusRecord(sampleId, subjectGroupId, split, offset) {
  return {
    sampleId,
    subjectGroupId,
    nearDuplicateFamilyId: "family_" + sampleId,
    provenanceRef: "synthetic-run-output:" + sampleId,
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

const corpus = {
  schemaVersion: "face-space-reference-corpus-v0",
  productionAuthority: false,
  normalizationAuthority: false,
  samplingFrame: {
    kind: "consented_general_face_corpus",
    provenanceRef: "synthetic-run-output:reference",
    archetypeSeeded: false,
    generalFaceIntent: true
  },
  provider,
  sourceExecution: {
    runnerVersion: "face-space-reference-corpus-measurement-runner-v0",
    sourceManifestDigest: "sha256:" + "f".repeat(64),
    rawImagePersisted: false,
    rawLandmarksPersisted: false,
    identityEmbeddingCreated: false,
    biometricIdentityMatchPerformed: false
  },
  records: [
    corpusRecord("a", "subject_a", "reference", 0),
    corpusRecord("b", "subject_b", "reference", 0.01),
    corpusRecord("c", "subject_c", "reference", 0.02),
    corpusRecord("d", "subject_d", "holdout", 0.03)
  ]
};

const referenceRunOutput = {
  schemaVersion: "face-space-reference-corpus-measurement-run-output-v0",
  ok: true,
  corpus,
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

const referencePacket =
  buildFaceLabNormalizationReviewPacketFromRunOutput({
    kind: "reference-corpus",
    runOutput: referenceRunOutput,
    packetVersion: "synthetic-run-output-review-v0"
  });
assert.equal(
  referencePacket.schemaVersion,
  "face-space-reference-corpus-review-packet-v0"
);
assert.equal(referencePacket.privacy.localImagePathsIncluded, false);
assert.equal(referencePacket.authority.adequacyDecisionAuthority, false);

assert.throws(
  () =>
    buildFaceLabNormalizationReviewPacketFromRunOutput({
      kind: "reference-corpus",
      runOutput: {
        ...referenceRunOutput,
        privacy: {
          ...referenceRunOutput.privacy,
          outputContainsLocalImagePaths: true
        }
      },
      packetVersion: "synthetic-run-output-review-v0"
    }),
  /reference_run_output_invalid/
);

assert.throws(
  () =>
    buildFaceLabNormalizationReviewPacketFromRunOutput({
      kind: "real-photo-stability",
      runOutput: {
        ...realRunOutput,
        normalizationAuthority: true
      },
      packetVersion: "synthetic-run-output-review-v0"
    }),
  /real_photo_run_output_invalid/
);

console.log(JSON.stringify({
  ok: true,
  realPhotoRunOutputToReviewPacket: true,
  referenceCorpusRunOutputToReviewPacket: true,
  privacyLeakageRejected: true,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false,
  adequacyDecisionAuthority: false
}, null, 2));
