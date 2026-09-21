import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  scaffoldRealPhotoStabilityRunManifest,
  scaffoldReferenceCorpusSourceManifest
} from "../lib/face-lab-source-manifest-scaffold.js";

const [sourceRoot, outputDir] = process.argv.slice(2);
assert.ok(
  sourceRoot && outputDir,
  "Usage: node scripts/build-face-lab-london-set-v5-measurement-manifests.mjs <source-root> <output-dir>"
);

const receipts = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/london-set-v5-front-source-receipts.json",
    "utf8"
  )
);
const splitPlan = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/london-set-v5-reference-holdout-split-plan.json",
    "utf8"
  )
);

assert.equal(
  splitPlan.schemaVersion,
  "face-lab-london-set-v5-reference-holdout-split-plan-v0"
);
assert.equal(splitPlan.status, "frozen_pre_measurement");
assert.equal(splitPlan.sourceReceiptDigest, receipts.receiptDigest);
assert.equal(splitPlan.method.measurementValuesUsed, false);
assert.equal(splitPlan.method.sensitiveAttributesUsed, false);
assert.equal(splitPlan.method.archetypeLabelsUsed, false);

const splitBySubject = new Map(
  splitPlan.records.map((record) => [record.subjectId, record.split])
);
assert.equal(splitBySubject.size, 102);

const smilingBySubject = new Map(
  receipts.smilingFront.map((record) => [record.subjectId, record])
);
assert.equal(smilingBySubject.size, 102);

const provenanceRef =
  "https://doi.org/10.6084/m9.figshare.5047666.v5";

const referenceSpec = {
  schemaVersion: "face-space-reference-corpus-source-scaffold-spec-v0",
  samplingFrame: {
    kind: "licensed_general_face_corpus",
    provenanceRef
  },
  subjectGrouping: {
    method: "dataset_subject_provenance",
    evidenceRef: provenanceRef
  },
  records: receipts.neutralFront.map((record) => {
    const split = splitBySubject.get(record.subjectId);
    assert.ok(split === "reference" || split === "holdout");
    return {
      sampleId: "london_v5_" + record.subjectId + "_neutral_front",
      subjectGroupId: "london_v5_subject_" + record.subjectId,
      nearDuplicateFamilyId: "london_v5_subject_" + record.subjectId,
      provenanceRef:
        provenanceRef + "#subject-" + record.subjectId + "-neutral-front",
      split,
      qualityStatus: "source_receipt_verified_pending_measurement_review",
      path: path.resolve(sourceRoot, record.upstreamPath)
    };
  })
};

const expressionSpec = {
  schemaVersion: "face-lab-real-photo-stability-scaffold-spec-v0",
  sourceSet: {
    kind: "licensed_same_subject_photo_set",
    provenanceRef
  },
  pairs: receipts.neutralFront.map((neutral) => {
    const smiling = smilingBySubject.get(neutral.subjectId);
    assert.ok(smiling, "smiling receipt missing:" + neutral.subjectId);
    return {
      pairGroupId: "london_v5_expression_" + neutral.subjectId,
      nuisanceClass: "expression",
      subjectLinkage: {
        method: "dataset_same_subject_provenance",
        evidenceRef:
          provenanceRef + "#subject-" + neutral.subjectId
      },
      reference: {
        sampleId: "london_v5_" + neutral.subjectId + "_neutral_front",
        path: path.resolve(sourceRoot, neutral.upstreamPath)
      },
      candidate: {
        sampleId: "london_v5_" + smiling.subjectId + "_smiling_front",
        path: path.resolve(sourceRoot, smiling.upstreamPath)
      }
    };
  })
};

const reference = scaffoldReferenceCorpusSourceManifest(referenceSpec);
const expression = scaffoldRealPhotoStabilityRunManifest(expressionSpec);

assert.equal(reference.summary.recordCount, 102);
assert.deepEqual(reference.summary.splitCounts, {
  reference: 82,
  holdout: 20
});
assert.equal(expression.summary.pairCount, 102);
assert.deepEqual(expression.summary.coveredNuisanceClasses, ["expression"]);
assert.deepEqual(
  expression.summary.missingNuisanceClasses,
  ["head_pitch", "head_roll", "head_yaw"]
);
assert.equal(expression.summary.completeNuisanceCoverage, false);

mkdirSync(outputDir, { recursive: true });
const referencePath = path.join(
  outputDir,
  "london-set-v5-reference-corpus-source-manifest.json"
);
const expressionPath = path.join(
  outputDir,
  "london-set-v5-expression-stability-run-manifest.json"
);
writeFileSync(referencePath, JSON.stringify(reference.manifest, null, 2) + "\n");
writeFileSync(expressionPath, JSON.stringify(expression.manifest, null, 2) + "\n");

console.log(JSON.stringify({
  ok: true,
  sourceReceiptDigest: receipts.receiptDigest,
  referenceSourceManifestDigest: reference.summary.sourceManifestDigest,
  expressionRunManifestDigest: expression.summary.manifestDigest,
  referenceSampleCount: reference.summary.splitCounts.reference,
  holdoutSampleCount: reference.summary.splitCounts.holdout,
  expressionPairCount: expression.summary.pairCount,
  missingExpressionCollectionNuisanceClasses:
    expression.summary.missingNuisanceClasses,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
}, null, 2));
