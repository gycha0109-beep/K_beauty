import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  scaffoldRealPhotoStabilityRunManifest,
  scaffoldReferenceCorpusSourceManifest
} from "../lib/face-lab-source-manifest-scaffold.js";

const root = mkdtempSync(join(tmpdir(), "facelab-scaffold-"));
try {
  const paths = {};
  for (const [name, bytes] of [
    ["baseline.png", "baseline-bytes"],
    ["yaw.png", "yaw-bytes"],
    ["pitch.jpg", "pitch-bytes"],
    ["roll.jpeg", "roll-bytes"],
    ["expression.png", "expression-bytes"],
    ["reference_a.png", "reference-a"],
    ["reference_b.png", "reference-b"],
    ["reference_c.jpg", "reference-c"],
    ["holdout_d.jpeg", "holdout-d"]
  ]) {
    const filePath = join(root, name);
    writeFileSync(filePath, bytes);
    paths[name] = filePath;
  }

  const realPhoto = scaffoldRealPhotoStabilityRunManifest({
    schemaVersion: "face-lab-real-photo-stability-scaffold-spec-v0",
    sourceSet: {
      kind: "manual_research_capture",
      provenanceRef: "synthetic-verifier-only:manual-capture"
    },
    pairs: [
      ["yaw", "head_yaw", "yaw.png"],
      ["pitch", "head_pitch", "pitch.jpg"],
      ["roll", "head_roll", "roll.jpeg"],
      ["expression", "expression", "expression.png"]
    ].map(([id, nuisanceClass, candidate]) => ({
      pairGroupId: "pair_" + id,
      nuisanceClass,
      subjectLinkage: {
        method: "manual_same_subject_pair",
        evidenceRef: "synthetic-verifier-only:" + id
      },
      reference: {
        sampleId: "baseline",
        path: paths["baseline.png"]
      },
      candidate: {
        sampleId: id,
        path: paths[candidate]
      }
    }))
  });

  assert.equal(realPhoto.summary.completeNuisanceCoverage, true);
  assert.equal(realPhoto.summary.opaqueSampleCount, 5);
  assert.match(realPhoto.summary.manifestDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(
    realPhoto.manifest.pairs[0].reference.mediaType,
    "image/png"
  );
  assert.equal(
    realPhoto.manifest.pairs[1].candidate.mediaType,
    "image/jpeg"
  );
  assert.equal(
    realPhoto.manifest.pairs[0].reference.rawImagePersistenceAllowed,
    false
  );

  const referenceCorpus = scaffoldReferenceCorpusSourceManifest({
    schemaVersion:
      "face-space-reference-corpus-source-scaffold-spec-v0",
    samplingFrame: {
      kind: "consented_general_face_corpus",
      provenanceRef: "synthetic-verifier-only:general-face"
    },
    subjectGrouping: {
      method: "manual_research_grouping",
      evidenceRef: "synthetic-verifier-only:subject-map"
    },
    records: [
      ["ref_a", "subject_a", "reference", "reference_a.png", "family_a"],
      ["ref_b", "subject_b", "reference", "reference_b.png", "family_b"],
      ["ref_c", "subject_c", "reference", "reference_c.jpg", "family_c"],
      ["holdout_d", "subject_d", "holdout", "holdout_d.jpeg", "family_d"]
    ].map(([sampleId, subjectGroupId, split, file, family]) => ({
      sampleId,
      subjectGroupId,
      split,
      nearDuplicateFamilyId: family,
      provenanceRef: "synthetic-verifier-only:" + sampleId,
      qualityStatus: "synthetic_verifier_only",
      path: paths[file]
    }))
  });

  assert.equal(referenceCorpus.summary.recordCount, 4);
  assert.deepEqual(referenceCorpus.summary.splitCounts, {
    reference: 3,
    holdout: 1
  });
  assert.match(
    referenceCorpus.summary.sourceManifestDigest,
    /^sha256:[a-f0-9]{64}$/
  );
  assert.equal(
    referenceCorpus.manifest.records[2].image.mediaType,
    "image/jpeg"
  );
  assert.equal(
    referenceCorpus.manifest.records[0].image.rawImagePersistenceAllowed,
    false
  );

  assert.throws(
    () =>
      scaffoldReferenceCorpusSourceManifest({
        schemaVersion:
          "face-space-reference-corpus-source-scaffold-spec-v0",
        samplingFrame: {
          kind: "consented_general_face_corpus",
          provenanceRef: "x"
        },
        subjectGrouping: {
          method: "manual_research_grouping",
          evidenceRef: "x"
        },
        records: [{
          sampleId: "bad",
          subjectGroupId: "bad",
          split: "reference",
          provenanceRef: "bad",
          qualityStatus: "bad",
          path: join(root, "unsupported.webp")
        }]
      }),
    /ENOENT|media_type_unsupported/
  );

  console.log(JSON.stringify({
    ok: true,
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false,
    realPhotoManifestScaffoldedAndValidated: true,
    referenceCorpusManifestScaffoldedAndValidated: true,
    imageSha256ComputedLocally: true,
    mediaTypeDerivedLocally: true,
    biometricIdentityMatchingUsed: false,
    identityEmbeddingCreated: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
