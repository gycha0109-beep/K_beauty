import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  scaffoldRealPhotoStabilityRunManifest
} from "../lib/face-lab-source-manifest-scaffold.js";

const [frontSourceRoot, yawSourceRoot, outputPath] = process.argv.slice(2);
assert.ok(
  frontSourceRoot && yawSourceRoot && outputPath,
  "Usage: node scripts/build-face-lab-london-set-v5-yaw-measurement-manifest.mjs <front-source-root> <yaw-source-root> <output.json>"
);

const frontReceipts = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/london-set-v5-front-source-receipts.json",
    "utf8"
  )
);
const yawReceipts = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/london-set-v5-yaw-source-receipts.json",
    "utf8"
  )
);

assert.equal(
  yawReceipts.schemaVersion,
  "face-lab-london-set-v5-yaw-source-receipts-v0"
);
assert.equal(yawReceipts.status, "derived_yaw_source_receipts_only");
assert.equal(yawReceipts.neutralLeftThreeQuarter.length, 102);
assert.equal(yawReceipts.neutralRightThreeQuarter.length, 102);

const leftBySubject = new Map(
  yawReceipts.neutralLeftThreeQuarter.map((row) => [row.subjectId, row])
);
const rightBySubject = new Map(
  yawReceipts.neutralRightThreeQuarter.map((row) => [row.subjectId, row])
);
assert.equal(leftBySubject.size, 102);
assert.equal(rightBySubject.size, 102);

const provenanceRef = "https://doi.org/10.6084/m9.figshare.5047666.v5";
const pairs = [];

for (const neutral of frontReceipts.neutralFront) {
  const left = leftBySubject.get(neutral.subjectId);
  const right = rightBySubject.get(neutral.subjectId);
  assert.ok(left, "london_yaw_left_receipt_missing:" + neutral.subjectId);
  assert.ok(right, "london_yaw_right_receipt_missing:" + neutral.subjectId);

  const reference = {
    sampleId: "london_v5_" + neutral.subjectId + "_neutral_front",
    path: path.resolve(frontSourceRoot, neutral.upstreamPath)
  };

  pairs.push({
    pairGroupId: "london_v5_yaw_left_" + neutral.subjectId,
    nuisanceClass: "head_yaw",
    subjectLinkage: {
      method: "dataset_same_subject_provenance",
      evidenceRef: provenanceRef + "#subject-" + neutral.subjectId
    },
    reference,
    candidate: {
      sampleId:
        "london_v5_" + neutral.subjectId + "_neutral_left_3quarter",
      path: path.resolve(
        yawSourceRoot,
        "neutralLeftThreeQuarter",
        left.upstreamMemberName
      )
    }
  });

  pairs.push({
    pairGroupId: "london_v5_yaw_right_" + neutral.subjectId,
    nuisanceClass: "head_yaw",
    subjectLinkage: {
      method: "dataset_same_subject_provenance",
      evidenceRef: provenanceRef + "#subject-" + neutral.subjectId
    },
    reference,
    candidate: {
      sampleId:
        "london_v5_" + neutral.subjectId + "_neutral_right_3quarter",
      path: path.resolve(
        yawSourceRoot,
        "neutralRightThreeQuarter",
        right.upstreamMemberName
      )
    }
  });
}

const scaffold = scaffoldRealPhotoStabilityRunManifest({
  schemaVersion: "face-lab-real-photo-stability-scaffold-spec-v0",
  sourceSet: {
    kind: "licensed_same_subject_photo_set",
    provenanceRef
  },
  pairs
});

assert.equal(scaffold.summary.pairCount, 204);
assert.equal(scaffold.summary.opaqueSampleCount, 306);
assert.deepEqual(scaffold.summary.coveredNuisanceClasses, ["head_yaw"]);
assert.deepEqual(scaffold.summary.missingNuisanceClasses, [
  "expression",
  "head_pitch",
  "head_roll"
]);
assert.equal(scaffold.summary.completeNuisanceCoverage, false);

const frontBySubject = new Map(
  frontReceipts.neutralFront.map((row) => [
    row.subjectId,
    row.sourceImageSha256
  ])
);

for (const pair of scaffold.manifest.pairs) {
  const subjectId = pair.pairGroupId.slice(-3);
  assert.equal(pair.reference.sha256, frontBySubject.get(subjectId));
  if (pair.pairGroupId.includes("_left_")) {
    assert.equal(
      pair.candidate.sha256,
      leftBySubject.get(subjectId).sourceImageSha256
    );
  } else if (pair.pairGroupId.includes("_right_")) {
    assert.equal(
      pair.candidate.sha256,
      rightBySubject.get(subjectId).sourceImageSha256
    );
  } else {
    throw new Error("london_yaw_pair_side_invalid:" + pair.pairGroupId);
  }
}

writeFileSync(
  outputPath,
  JSON.stringify(scaffold.manifest, null, 2) + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      manifestDigest: scaffold.summary.manifestDigest,
      pairCount: scaffold.summary.pairCount,
      opaqueSampleCount: scaffold.summary.opaqueSampleCount,
      coveredNuisanceClasses: scaffold.summary.coveredNuisanceClasses,
      missingNuisanceClasses: scaffold.summary.missingNuisanceClasses,
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false
    },
    null,
    2
  )
);
