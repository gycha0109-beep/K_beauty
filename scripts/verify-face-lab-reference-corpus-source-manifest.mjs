import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateFaceSpaceReferenceCorpusSourceManifest
} from "../lib/face-lab-reference-corpus-source-manifest.js";

const contract = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/reference-corpus-source-runner.contract.json",
    "utf8"
  )
);

assert.equal(contract.productionAuthority, false);
assert.equal(contract.normalizationAuthority, false);
assert.equal(contract.currentEvidence.realSourceManifestPresent, false);
assert.equal(contract.currentEvidence.actualRunnerExecuted, false);

function image(sampleId, digit) {
  return {
    path: "/replace/" + sampleId + ".png",
    sha256: String(digit).repeat(64),
    mediaType: "image/png",
    rawImagePersistenceAllowed: false
  };
}

function record(sampleId, subjectGroupId, split, digit, familyId = null) {
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
    image: image(sampleId, digit)
  };
}

const manifest = {
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
    evidenceRef: "synthetic-dataset-subject-map",
    biometricIdentityMatchPerformed: false
  },
  records: [
    record("ref_a", "subject_a", "reference", 1, "family_a"),
    record("ref_b", "subject_b", "reference", 2, "family_b"),
    record("ref_c", "subject_c", "reference", 3, "family_c"),
    record("holdout_d", "subject_d", "holdout", 4, "family_d")
  ]
};

const summary = validateFaceSpaceReferenceCorpusSourceManifest(manifest);
assert.match(summary.sourceManifestDigest, /^sha256:[a-f0-9]{64}$/);
assert.equal(summary.recordCount, 4);
assert.equal(summary.distinctSubjectGroupCount, 4);
assert.deepEqual(summary.splitCounts, { reference: 3, holdout: 1 });
assert.equal(summary.authority.productionAuthority, false);
assert.equal(summary.authority.normalizationAuthority, false);
assert.equal(summary.privacy.rawImagePersistenceAllowed, false);
assert.equal(summary.privacy.identityEmbeddingAllowed, false);
assert.equal(summary.privacy.biometricIdentityMatchingAllowed, false);

const pathChanged = structuredClone(manifest);
pathChanged.records[0].image.path = "/other/local/path/ref_a.png";
const pathChangedSummary =
  validateFaceSpaceReferenceCorpusSourceManifest(pathChanged);
assert.equal(
  pathChangedSummary.sourceManifestDigest,
  summary.sourceManifestDigest
);

const shaChanged = structuredClone(manifest);
shaChanged.records[0].image.sha256 = "5".repeat(64);
const shaChangedSummary =
  validateFaceSpaceReferenceCorpusSourceManifest(shaChanged);
assert.notEqual(
  shaChangedSummary.sourceManifestDigest,
  summary.sourceManifestDigest
);

const subjectLeak = structuredClone(manifest);
subjectLeak.records[3].subjectGroupId = "subject_a";
assert.throws(
  () => validateFaceSpaceReferenceCorpusSourceManifest(subjectLeak),
  /subject_split_leakage/
);

const familyLeak = structuredClone(manifest);
familyLeak.records[3].nearDuplicateFamilyId = "family_a";
assert.throws(
  () => validateFaceSpaceReferenceCorpusSourceManifest(familyLeak),
  /near_duplicate_split_leakage/
);

const duplicateImage = structuredClone(manifest);
duplicateImage.records[1].image.sha256 =
  duplicateImage.records[0].image.sha256;
assert.throws(
  () => validateFaceSpaceReferenceCorpusSourceManifest(duplicateImage),
  /image_duplicate/
);

const biometric = structuredClone(manifest);
biometric.subjectGrouping.biometricIdentityMatchPerformed = true;
assert.throws(
  () => validateFaceSpaceReferenceCorpusSourceManifest(biometric),
  /subject_grouping_invalid/
);

const archetypeSeeded = structuredClone(manifest);
archetypeSeeded.samplingFrame.archetypeSeeded = true;
assert.throws(
  () => validateFaceSpaceReferenceCorpusSourceManifest(archetypeSeeded),
  /sampling_frame_invalid/
);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  currentRealSourceManifestPresent:
    contract.currentEvidence.realSourceManifestPresent,
  actualRunnerExecuted: false,
  invariants: {
    sourceManifestDigestBindsImageSha256: true,
    localPathExcludedFromDigest: true,
    subjectSplitLeakageForbidden: true,
    nearDuplicateSplitLeakageForbidden: true,
    duplicateImageBytesForbidden: true,
    identityEmbeddingForbidden: true,
    biometricIdentityMatchingForbidden: true,
    archetypeSeededSourceForbidden: true
  }
}, null, 2));
