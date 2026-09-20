import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateRealPhotoStabilityRunManifest
} from "../lib/face-lab-real-photo-stability-run-manifest.js";

const contract = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/real-photo-stability-runner.contract.json",
    "utf8"
  )
);

assert.equal(contract.productionAuthority, false);
assert.equal(contract.normalizationAuthority, false);
assert.equal(contract.currentEvidence.realPairManifestPresent, false);
assert.equal(contract.currentEvidence.actualRunnerExecuted, false);

function image(sampleId, path, char, mediaType = "image/png") {
  return {
    sampleId,
    path,
    sha256: char.repeat(64),
    mediaType,
    rawImagePersistenceAllowed: false
  };
}

function pair(index, nuisanceClass) {
  return {
    pairGroupId: "opaque_pair_" + index,
    nuisance: { class: nuisanceClass },
    subjectLinkage: {
      method:
        index % 2 === 0
          ? "dataset_same_subject_provenance"
          : "manual_same_subject_pair",
      evidenceRef: "opaque-provenance:" + index,
      biometricIdentityMatchPerformed: false
    },
    reference: image(
      "reference_" + index,
      "/not-present/reference_" + index + ".png",
      String((index % 9) + 1)
    ),
    candidate: image(
      "candidate_" + index,
      "/not-present/candidate_" + index + ".png",
      String(((index + 4) % 9) + 1)
    )
  };
}

const manifest = {
  schemaVersion: "face-lab-real-photo-stability-run-manifest-v0",
  productionAuthority: false,
  normalizationAuthority: false,
  sourceSet: {
    kind: "consented_same_subject_photo_set",
    provenanceRef: "synthetic-verifier-only",
    archetypeSeeded: false,
    identityEmbeddingAllowed: false,
    biometricIdentityMatchingAllowed: false,
    rawImagePersistenceAllowed: false
  },
  pairs: [
    pair(0, "head_yaw"),
    pair(1, "head_pitch"),
    pair(2, "head_roll"),
    pair(3, "expression")
  ]
};

const summary = validateRealPhotoStabilityRunManifest(manifest);
assert.match(summary.manifestDigest, /^sha256:[a-f0-9]{64}$/);
assert.equal(summary.pairCount, 4);
assert.equal(summary.opaqueSampleCount, 8);
assert.equal(summary.completeNuisanceCoverage, true);
assert.deepEqual(summary.missingNuisanceClasses, []);
assert.equal(summary.authority.productionAuthority, false);
assert.equal(summary.authority.normalizationAuthority, false);
assert.equal(summary.privacy.rawImagePersistenceAllowed, false);
assert.equal(summary.privacy.identityEmbeddingAllowed, false);
assert.equal(summary.privacy.biometricIdentityMatchingAllowed, false);
assert.equal(summary.privacy.rawLandmarkPersistenceAllowed, false);

const biometric = structuredClone(manifest);
biometric.pairs[0].subjectLinkage.biometricIdentityMatchPerformed = true;
assert.throws(
  () => validateRealPhotoStabilityRunManifest(biometric),
  /pair_invalid/
);

const sameAsset = structuredClone(manifest);
sameAsset.pairs[0].candidate.path = sameAsset.pairs[0].reference.path;
assert.throws(
  () => validateRealPhotoStabilityRunManifest(sameAsset),
  /pair_same_asset/
);

const archetypeSeeded = structuredClone(manifest);
archetypeSeeded.sourceSet.archetypeSeeded = true;
assert.throws(
  () => validateRealPhotoStabilityRunManifest(archetypeSeeded),
  /source_set_invalid/
);

const duplicatePair = structuredClone(manifest);
duplicatePair.pairs[1].pairGroupId = duplicatePair.pairs[0].pairGroupId;
assert.throws(
  () => validateRealPhotoStabilityRunManifest(duplicatePair),
  /pair_duplicate/
);

const pathOnlyChanged = structuredClone(manifest);
pathOnlyChanged.pairs[0].reference.path =
  "/different/local/path/reference_0.png";
const pathOnlyChangedSummary =
  validateRealPhotoStabilityRunManifest(pathOnlyChanged);
assert.equal(
  pathOnlyChangedSummary.manifestDigest,
  summary.manifestDigest
);

const shaChanged = structuredClone(manifest);
shaChanged.pairs[0].reference.sha256 = "f".repeat(64);
const shaChangedSummary = validateRealPhotoStabilityRunManifest(shaChanged);
assert.notEqual(
  shaChangedSummary.manifestDigest,
  summary.manifestDigest
);

const reusedBaseline = structuredClone(manifest);
reusedBaseline.pairs[1].reference = structuredClone(
  reusedBaseline.pairs[0].reference
);
const reusedBaselineSummary =
  validateRealPhotoStabilityRunManifest(reusedBaseline);
assert.equal(reusedBaselineSummary.pairCount, 4);
assert.equal(reusedBaselineSummary.opaqueSampleCount, 7);

const conflictingReuse = structuredClone(reusedBaseline);
conflictingReuse.pairs[1].reference.sha256 = "e".repeat(64);
assert.throws(
  () => validateRealPhotoStabilityRunManifest(conflictingReuse),
  /sample_conflict/
);

const assetAlias = structuredClone(manifest);
assetAlias.pairs[1].reference.sha256 =
  assetAlias.pairs[0].reference.sha256;
assert.throws(
  () => validateRealPhotoStabilityRunManifest(assetAlias),
  /asset_alias/
);

const incomplete = structuredClone(manifest);
incomplete.pairs = incomplete.pairs.filter(
  (item) => item.nuisance.class !== "expression"
);
const incompleteSummary = validateRealPhotoStabilityRunManifest(incomplete);
assert.equal(incompleteSummary.completeNuisanceCoverage, false);
assert.deepEqual(incompleteSummary.missingNuisanceClasses, ["expression"]);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  actualRunnerExecuted: false,
  currentRealPairManifestPresent:
    contract.currentEvidence.realPairManifestPresent,
  syntheticManifestCoverageComplete: summary.completeNuisanceCoverage,
  invariants: {
    rawImagePersistenceForbidden: true,
    rawLandmarkPersistenceForbidden: true,
    identityEmbeddingForbidden: true,
    biometricIdentityMatchingForbidden: true,
    archetypeSeededSourceRejected: true,
    actualRealPhotoEvidenceStillAbsent: true,
    manifestDigestIgnoresLocalPaths: true,
    manifestDigestBindsImageSha256: true,
    exactBaselineSampleReuseAllowed: true,
    conflictingSampleReuseRejected: true,
    duplicateAssetAliasRejected: true
  }
}, null, 2));
