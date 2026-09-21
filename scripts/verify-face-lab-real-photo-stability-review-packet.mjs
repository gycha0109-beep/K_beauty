import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildRealPhotoSameSubjectStabilityEvidence
} from "../lib/face-lab-real-photo-stability-evidence.js";
import {
  buildRealPhotoStabilityReviewPacket
} from "../lib/face-lab-real-photo-stability-review-packet.js";

const semanticContract = JSON.parse(
  readFileSync(
    "evidence/facelab/structural-measurement/v0/semantic-contract.json",
    "utf8"
  )
);

function measurement(sampleId, offset = 0) {
  const values = [
    ["lower_face_width_ratio", "ratio", 0.74 + offset],
    ["chin_height_ratio", "ratio", 0.45 + offset],
    ["eye_spacing_ratio", "ratio", 0.20 + offset],
    ["eye_width_ratio", "ratio", 0.17 + offset],
    ["eye_tilt", "degree", 0.2 + offset],
    ["nose_width_ratio", "ratio", 0.18 + offset]
  ];
  return {
    schemaVersion: "face-space-structural-measurement-v0",
    measurementVersion: "face-space-structural-measurement-v0",
    semanticsVersion: "face-space-structural-measurement-semantics-v0",
    sampleId,
    source: "mediapipe_face_geometry",
    sourceVersion:
      "google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809",
    adapterId: "mediapipe-face-geometry-metric-v0",
    coordinateSpace: "pose_normalized_metric_3d",
    normalizationReference:
      "face_left_lateral_to_face_right_lateral_3d_distance",
    dimensions: values.map(([id, unit, value]) => ({
      id,
      unit,
      value
    })),
    privacy: {
      sourceImagePersisted: false,
      identityEmbeddingCreated: false
    }
  };
}

function report(index, nuisanceClass, offset) {
  const digit = String(index + 1);
  return buildRealPhotoSameSubjectStabilityEvidence(
    {
      pairGroupId: "review_pair_" + index,
      referenceMeasurement: measurement("review_ref_" + index),
      candidateMeasurement: measurement(
        "review_candidate_" + index,
        offset
      ),
      nuisance: { class: nuisanceClass },
      subjectLinkage: {
        method: "dataset_same_subject_provenance",
        evidenceRef: "synthetic-review-provenance:" + index,
        biometricIdentityMatchPerformed: false
      },
      executionProvenance: {
        kind: "real_photo_pair_runner",
        runnerVersion:
          "face-lab-real-photo-stability-pair-runner-v0",
        runManifestDigest:
          "sha256:" + digit.repeat(64),
        sourceSetProvenanceRef:
          "synthetic-review-source-set",
        referenceImageSha256: digit.repeat(64),
        candidateImageSha256:
          String(index + 5).repeat(64)
      }
    },
    semanticContract
  );
}

const reports = [
  report(0, "head_yaw", 0.001),
  report(1, "head_pitch", 0.002),
  report(2, "head_roll", 0.003),
  report(3, "expression", 0.004)
];

const packet = buildRealPhotoStabilityReviewPacket({
  reports,
  packetVersion: "synthetic-review-packet-v0"
});

assert.equal(
  packet.schemaVersion,
  "face-lab-real-photo-stability-review-packet-v0"
);
assert.equal(packet.status, "manual_review_packet_ready");
assert.match(
  packet.sourceCollectionFingerprint,
  /^sha256:[a-f0-9]{64}$/
);
assert.match(
  packet.reviewPacketFingerprint,
  /^sha256:[a-f0-9]{64}$/
);
assert.equal(packet.observations.length, 4);
assert.equal(packet.authority.productionAuthority, false);
assert.equal(packet.authority.normalizationAuthority, false);
assert.equal(packet.authority.thresholdAuthority, false);
assert.equal(packet.authority.adequacyDecisionAuthority, false);
assert.equal(packet.reviewSemantics.descriptiveOnly, true);
assert.equal(packet.reviewSemantics.thresholdsApplied, false);
assert.equal(packet.reviewSemantics.automaticPassFail, false);
assert.equal(packet.reviewSemantics.automaticRanking, false);
assert.equal(packet.privacy.localImagePathsIncluded, false);
assert.equal(
  JSON.stringify(packet).includes("/local/"),
  false
);

const reordered = buildRealPhotoStabilityReviewPacket({
  reports: [...reports].reverse(),
  packetVersion: "synthetic-review-packet-v0"
});
assert.equal(
  reordered.reviewPacketFingerprint,
  packet.reviewPacketFingerprint
);

const changed = structuredClone(reports);
changed[0].comparison.dimensions[0].absoluteDifference += 0.001;
changed[0].comparison.diagnostics.maxAbsoluteRatioDifference += 0.001;
const changedPacket = buildRealPhotoStabilityReviewPacket({
  reports: changed,
  packetVersion: "synthetic-review-packet-v0"
});
assert.notEqual(
  changedPacket.reviewPacketFingerprint,
  packet.reviewPacketFingerprint
);

assert.equal("winner" in packet, false);
assert.equal("pass" in packet, false);
assert.equal("ranking" in packet, false);
assert.equal("adequacyDecision" in packet, false);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false,
  descriptiveOnly: true,
  thresholdsApplied: false,
  automaticPassFail: false,
  automaticRanking: false,
  exactCollectionFingerprintCarried: true,
  exactReviewPacketFingerprintCreated: true,
  reportOrderDoesNotChangePacketFingerprint: true,
  observedDriftChangeChangesPacketFingerprint: true,
  actualAdequacyDecisionPresent: false
}, null, 2));
