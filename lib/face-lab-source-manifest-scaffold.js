import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import {
  validateRealPhotoStabilityRunManifest
} from "./face-lab-real-photo-stability-run-manifest.js";
import {
  validateFaceSpaceReferenceCorpusSourceManifest
} from "./face-lab-reference-corpus-source-manifest.js";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function mediaTypeFromPath(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  throw new Error("face_lab_scaffold_media_type_unsupported:" + extension);
}

function imageReceipt(image) {
  if (!isObject(image) || !nonEmpty(image.sampleId) || !nonEmpty(image.path)) {
    throw new Error("face_lab_scaffold_image_invalid");
  }
  const bytes = readFileSync(image.path);
  return {
    sampleId: image.sampleId.trim(),
    path: image.path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    mediaType: mediaTypeFromPath(image.path),
    rawImagePersistenceAllowed: false
  };
}

export function scaffoldRealPhotoStabilityRunManifest(spec = {}) {
  if (
    !isObject(spec) ||
    spec.schemaVersion !==
      "face-lab-real-photo-stability-scaffold-spec-v0" ||
    !isObject(spec.sourceSet) ||
    !Array.isArray(spec.pairs)
  ) {
    throw new Error("real_photo_stability_scaffold_spec_invalid");
  }

  const manifest = {
    schemaVersion: "face-lab-real-photo-stability-run-manifest-v0",
    productionAuthority: false,
    normalizationAuthority: false,
    sourceSet: {
      kind: spec.sourceSet.kind,
      provenanceRef: spec.sourceSet.provenanceRef,
      archetypeSeeded: false,
      identityEmbeddingAllowed: false,
      biometricIdentityMatchingAllowed: false,
      rawImagePersistenceAllowed: false
    },
    pairs: spec.pairs.map((pair) => ({
      pairGroupId: pair.pairGroupId,
      nuisance: { class: pair.nuisanceClass },
      subjectLinkage: {
        method: pair.subjectLinkage?.method,
        evidenceRef: pair.subjectLinkage?.evidenceRef,
        biometricIdentityMatchPerformed: false
      },
      reference: imageReceipt(pair.reference),
      candidate: imageReceipt(pair.candidate)
    }))
  };

  const summary = validateRealPhotoStabilityRunManifest(manifest);
  return { manifest, summary };
}

export function scaffoldReferenceCorpusSourceManifest(spec = {}) {
  if (
    !isObject(spec) ||
    spec.schemaVersion !==
      "face-space-reference-corpus-source-scaffold-spec-v0" ||
    !isObject(spec.samplingFrame) ||
    !isObject(spec.subjectGrouping) ||
    !Array.isArray(spec.records)
  ) {
    throw new Error("reference_corpus_source_scaffold_spec_invalid");
  }

  const manifest = {
    schemaVersion: "face-space-reference-corpus-source-manifest-v0",
    productionAuthority: false,
    normalizationAuthority: false,
    samplingFrame: {
      kind: spec.samplingFrame.kind,
      provenanceRef: spec.samplingFrame.provenanceRef,
      archetypeSeeded: false,
      generalFaceIntent: true,
      identityEmbeddingAllowed: false,
      biometricIdentityMatchingAllowed: false,
      rawImagePersistenceAllowed: false
    },
    subjectGrouping: {
      method: spec.subjectGrouping.method,
      evidenceRef: spec.subjectGrouping.evidenceRef,
      biometricIdentityMatchPerformed: false
    },
    records: spec.records.map((record) => ({
      sampleId: record.sampleId,
      subjectGroupId: record.subjectGroupId,
      nearDuplicateFamilyId: record.nearDuplicateFamilyId || null,
      provenanceRef: record.provenanceRef,
      split: record.split,
      archetypeGroundTruth: null,
      identityEmbeddingCreated: false,
      biometricIdentityMatchPerformed: false,
      eligibilityQuality: {
        eligible: true,
        qualityStatus: record.qualityStatus
      },
      image: imageReceipt({
        sampleId: record.sampleId,
        path: record.path
      })
    }))
  };

  const summary = validateFaceSpaceReferenceCorpusSourceManifest(manifest);
  return { manifest, summary };
}
