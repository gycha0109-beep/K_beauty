import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FACE_SPACE_REFERENCE_CORPUS_REQUIRED_DIMENSIONS,
  validateFaceSpaceReferenceCorpus
} from "../lib/face-lab-face-space-reference-corpus.js";

const contract = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/reference-corpus.contract.json",
    "utf8"
  )
);

assert.equal(contract.productionAuthority, false);
assert.equal(contract.normalizationAuthority, false);
assert.equal(contract.currentEvidence.corpusManifestPresent, false);
assert.equal(contract.statisticsPolicy.statisticsGenerationAuthorizedNow, false);
assert.equal(contract.statisticsPolicy.centerMethod, null);
assert.equal(contract.statisticsPolicy.scaleMethod, null);
assert.equal(
  contract.sourceSeparation.reverseArchetypeSeedCorpusMayServeAsReferenceCorpus,
  false
);

const provider = {
  source: "mediapipe_face_geometry",
  sourceVersion:
    "google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809",
  adapterId: "mediapipe-face-geometry-metric-v0"
};

function measurement(sampleId, offset = 0) {
  const base = {
    lower_face_width_ratio: 0.74 + offset,
    chin_height_ratio: 0.45 + offset,
    eye_spacing_ratio: 0.20 + offset,
    eye_width_ratio: 0.17 + offset,
    eye_tilt: 0.2 + offset,
    nose_width_ratio: 0.18 + offset
  };
  return {
    schemaVersion: "face-space-structural-measurement-v0",
    sampleId,
    source: provider.source,
    sourceVersion: provider.sourceVersion,
    adapterId: provider.adapterId,
    dimensions: Object.entries(base).map(([id, value]) => ({
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

function record({
  sampleId,
  subjectGroupId,
  split,
  nearDuplicateFamilyId = null,
  offset = 0
}) {
  return {
    sampleId,
    subjectGroupId,
    split,
    nearDuplicateFamilyId,
    provenanceRef: "synthetic-verifier-provenance:" + sampleId,
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
    kind: "licensed_general_face_corpus",
    provenanceRef: "synthetic-verifier-only",
    archetypeSeeded: false,
    generalFaceIntent: true
  },
  provider,
  records: [
    record({
      sampleId: "ref_a_1",
      subjectGroupId: "subject_a",
      split: "reference",
      nearDuplicateFamilyId: "family_a",
      offset: 0
    }),
    record({
      sampleId: "ref_a_2",
      subjectGroupId: "subject_a",
      split: "reference",
      nearDuplicateFamilyId: "family_a",
      offset: 0.001
    }),
    record({
      sampleId: "ref_b_1",
      subjectGroupId: "subject_b",
      split: "reference",
      offset: -0.001
    }),
    record({
      sampleId: "holdout_c_1",
      subjectGroupId: "subject_c",
      split: "holdout",
      nearDuplicateFamilyId: "family_c",
      offset: 0.002
    })
  ]
};

const summary = validateFaceSpaceReferenceCorpus(manifest);
assert.equal(summary.status, "structurally_valid_research_corpus");
assert.equal(summary.recordCount, 4);
assert.equal(summary.distinctSubjectGroupCount, 3);
assert.deepEqual(summary.splitCounts, { reference: 3, holdout: 1 });
assert.equal(summary.evidenceState.multiSubjectCoverage, true);
assert.equal(summary.evidenceState.generalFaceSamplingFrame, true);
assert.equal(summary.evidenceState.lockedHoldoutPresent, true);
assert.equal(summary.authority.productionAuthority, false);
assert.equal(summary.authority.normalizationAuthority, false);
assert.equal(summary.authority.referenceStatisticsAuthority, false);
assert.deepEqual(
  [...summary.dimensionIds].sort(),
  [...FACE_SPACE_REFERENCE_CORPUS_REQUIRED_DIMENSIONS].sort()
);

const archetypeLeak = structuredClone(manifest);
archetypeLeak.records[0].archetypeGroundTruth = "cat";
assert.throws(
  () => validateFaceSpaceReferenceCorpus(archetypeLeak),
  /archetype_ground_truth_forbidden/
);

const subjectLeak = structuredClone(manifest);
subjectLeak.records[3].subjectGroupId = "subject_a";
assert.throws(
  () => validateFaceSpaceReferenceCorpus(subjectLeak),
  /subject_split_leakage/
);

const familyLeak = structuredClone(manifest);
subjectLeak.records[3].subjectGroupId = "subject_c";
familyLeak.records[3].nearDuplicateFamilyId = "family_a";
assert.throws(
  () => validateFaceSpaceReferenceCorpus(familyLeak),
  /near_duplicate_split_leakage/
);

const privacyLeak = structuredClone(manifest);
privacyLeak.records[0].identityEmbeddingCreated = true;
assert.throws(
  () => validateFaceSpaceReferenceCorpus(privacyLeak),
  /privacy_boundary_invalid/
);

const archetypeSeeded = structuredClone(manifest);
archetypeSeeded.samplingFrame.archetypeSeeded = true;
assert.throws(
  () => validateFaceSpaceReferenceCorpus(archetypeSeeded),
  /sampling_frame_invalid/
);

const noHoldout = structuredClone(manifest);
noHoldout.records = noHoldout.records.filter(
  (item) => item.split === "reference"
);
assert.throws(
  () => validateFaceSpaceReferenceCorpus(noHoldout),
  /required_split_empty/
);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  currentRealCorpusPresent: contract.currentEvidence.corpusManifestPresent,
  syntheticVerifierSummary: summary,
  invariants: {
    archetypeSeedCorpusRejectedAsAuthority: true,
    subjectLevelSplitEnforced: true,
    nearDuplicateSplitEnforced: true,
    identityEmbeddingForbidden: true,
    biometricIdentityMatchingForbidden: true,
    rawImagePacketPersistenceForbidden: true,
    referenceStatisticsMethodStillUnselected: true
  }
}, null, 2));
