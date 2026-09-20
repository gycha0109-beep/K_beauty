export const REAL_PHOTO_STABILITY_RUN_MANIFEST_SCHEMA_VERSION =
  "face-lab-real-photo-stability-run-manifest-v0";

const REQUIRED_NUISANCE_CLASSES = new Set([
  "head_yaw",
  "head_pitch",
  "head_roll",
  "expression"
]);

const ALLOWED_LINKAGE_METHODS = new Set([
  "dataset_same_subject_provenance",
  "manual_same_subject_pair"
]);

const ALLOWED_SOURCE_SET_KINDS = new Set([
  "consented_same_subject_photo_set",
  "licensed_same_subject_photo_set",
  "manual_research_capture"
]);

const ALLOWED_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validateImageRef(image, label) {
  if (
    !isObject(image) ||
    !nonEmpty(image.sampleId) ||
    !nonEmpty(image.path) ||
    !sha256(image.sha256) ||
    !ALLOWED_MEDIA_TYPES.has(image.mediaType) ||
    image.rawImagePersistenceAllowed !== false
  ) {
    throw new Error(
      "real_photo_stability_run_image_invalid:" + label
    );
  }
}

export function validateRealPhotoStabilityRunManifest(manifest = {}) {
  if (
    !isObject(manifest) ||
    manifest.schemaVersion !==
      REAL_PHOTO_STABILITY_RUN_MANIFEST_SCHEMA_VERSION ||
    manifest.productionAuthority !== false ||
    manifest.normalizationAuthority !== false
  ) {
    throw new Error("real_photo_stability_run_manifest_invalid");
  }

  if (
    !isObject(manifest.sourceSet) ||
    !ALLOWED_SOURCE_SET_KINDS.has(manifest.sourceSet.kind) ||
    !nonEmpty(manifest.sourceSet.provenanceRef) ||
    manifest.sourceSet.archetypeSeeded !== false ||
    manifest.sourceSet.identityEmbeddingAllowed !== false ||
    manifest.sourceSet.biometricIdentityMatchingAllowed !== false ||
    manifest.sourceSet.rawImagePersistenceAllowed !== false
  ) {
    throw new Error("real_photo_stability_run_source_set_invalid");
  }

  if (!Array.isArray(manifest.pairs) || manifest.pairs.length === 0) {
    throw new Error("real_photo_stability_run_pairs_missing");
  }

  const pairIds = new Set();
  const sampleIds = new Set();
  const covered = new Set();

  for (const pair of manifest.pairs) {
    if (
      !isObject(pair) ||
      !nonEmpty(pair.pairGroupId) ||
      !REQUIRED_NUISANCE_CLASSES.has(pair.nuisance?.class) ||
      !ALLOWED_LINKAGE_METHODS.has(pair.subjectLinkage?.method) ||
      !nonEmpty(pair.subjectLinkage?.evidenceRef) ||
      pair.subjectLinkage?.biometricIdentityMatchPerformed !== false
    ) {
      throw new Error("real_photo_stability_run_pair_invalid");
    }

    if (pairIds.has(pair.pairGroupId)) {
      throw new Error(
        "real_photo_stability_run_pair_duplicate:" + pair.pairGroupId
      );
    }
    pairIds.add(pair.pairGroupId);

    validateImageRef(pair.reference, "reference");
    validateImageRef(pair.candidate, "candidate");

    if (
      pair.reference.sampleId === pair.candidate.sampleId ||
      pair.reference.path === pair.candidate.path
    ) {
      throw new Error("real_photo_stability_run_pair_same_asset");
    }

    for (const image of [pair.reference, pair.candidate]) {
      if (sampleIds.has(image.sampleId)) {
        throw new Error(
          "real_photo_stability_run_sample_duplicate:" + image.sampleId
        );
      }
      sampleIds.add(image.sampleId);
    }
    covered.add(pair.nuisance.class);
  }

  const missingNuisanceClasses = [...REQUIRED_NUISANCE_CLASSES]
    .filter((item) => !covered.has(item))
    .sort();

  return {
    schemaVersion: "face-lab-real-photo-stability-run-manifest-summary-v0",
    pairCount: manifest.pairs.length,
    opaqueSampleCount: sampleIds.size,
    coveredNuisanceClasses: [...covered].sort(),
    missingNuisanceClasses,
    completeNuisanceCoverage: missingNuisanceClasses.length === 0,
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false
    },
    privacy: {
      rawImagePersistenceAllowed: false,
      identityEmbeddingAllowed: false,
      biometricIdentityMatchingAllowed: false,
      rawLandmarkPersistenceAllowed: false
    }
  };
}
