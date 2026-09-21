import assert from "node:assert/strict";
import {
  buildFaceSpaceReferenceCorpusReviewPacket
} from "../lib/face-lab-reference-corpus-review-packet.js";

const provider = {
  source: "mediapipe_face_geometry",
  sourceVersion:
    "google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809",
  adapterId: "mediapipe-face-geometry-metric-v0"
};

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
    source: provider.source,
    sourceVersion: provider.sourceVersion,
    adapterId: provider.adapterId,
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
    provenanceRef: "synthetic-review:" + sampleId,
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
    provenanceRef: "synthetic-review-only",
    archetypeSeeded: false,
    generalFaceIntent: true
  },
  provider,
  records: [
    record("ref_a", "subject_a", "reference", 0.00, "family_a"),
    record("ref_b", "subject_b", "reference", 0.02, "family_b"),
    record("ref_c", "subject_c", "reference", 0.05, "family_c"),
    record("holdout_d", "subject_d", "holdout", 100, "family_d")
  ]
};

const packet = buildFaceSpaceReferenceCorpusReviewPacket({
  manifest,
  packetVersion: "synthetic-reference-review-packet-v0"
});

assert.equal(
  packet.schemaVersion,
  "face-space-reference-corpus-review-packet-v0"
);
assert.equal(packet.status, "manual_review_packet_ready");
assert.match(
  packet.sourceReferenceSplitFingerprint,
  /^sha256:[a-f0-9]{64}$/
);
assert.match(
  packet.reviewPacketFingerprint,
  /^sha256:[a-f0-9]{64}$/
);
assert.equal(packet.authority.productionAuthority, false);
assert.equal(packet.authority.normalizationAuthority, false);
assert.equal(packet.authority.referenceStatisticsAuthority, false);
assert.equal(packet.authority.methodSelectionAuthority, false);
assert.equal(packet.authority.adequacyDecisionAuthority, false);
assert.equal(packet.reviewSemantics.descriptiveOnly, true);
assert.equal(
  packet.reviewSemantics.centerScaleStatisticsIncluded,
  false
);
assert.equal(
  packet.reviewSemantics.percentileStatisticsIncluded,
  false
);
assert.equal(
  packet.reviewSemantics.holdoutMeasurementValuesIncluded,
  false
);
assert.deepEqual(packet.reviewSnapshot.splitCounts, {
  reference: 3,
  holdout: 1
});
assert.equal(
  packet.reviewSnapshot.splitDistinctSubjectGroupCounts.reference,
  3
);
assert.equal(
  packet.reviewSnapshot.splitDistinctSubjectGroupCounts.holdout,
  1
);

const changedHoldoutValue = structuredClone(manifest);
changedHoldoutValue.records[3].measurement =
  measurement("holdout_d", 999);
const changedHoldoutPacket =
  buildFaceSpaceReferenceCorpusReviewPacket({
    manifest: changedHoldoutValue,
    packetVersion: "synthetic-reference-review-packet-v0"
  });
assert.equal(
  changedHoldoutPacket.reviewPacketFingerprint,
  packet.reviewPacketFingerprint
);
assert.equal(
  changedHoldoutPacket.sourceReferenceSplitFingerprint,
  packet.sourceReferenceSplitFingerprint
);

const changedReference = structuredClone(manifest);
changedReference.records[0].subjectGroupId = "subject_a_changed";
const changedReferencePacket =
  buildFaceSpaceReferenceCorpusReviewPacket({
    manifest: changedReference,
    packetVersion: "synthetic-reference-review-packet-v0"
  });
assert.notEqual(
  changedReferencePacket.reviewPacketFingerprint,
  packet.reviewPacketFingerprint
);

assert.equal("center" in packet.reviewSnapshot, false);
assert.equal("scale" in packet.reviewSnapshot, false);
assert.equal("percentile" in packet.reviewSnapshot, false);
assert.equal("ranking" in packet, false);
assert.equal("winner" in packet, false);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  referenceStatisticsAuthority: false,
  methodSelectionAuthority: false,
  descriptiveOnly: true,
  holdoutMeasurementValuesExcluded: true,
  centerScaleStatisticsExcluded: true,
  percentileStatisticsExcluded: true,
  exactReferenceSplitFingerprintCarried: true,
  exactReviewPacketFingerprintCreated: true,
  actualAdequacyDecisionPresent: false
}, null, 2));
