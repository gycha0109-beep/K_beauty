import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  scaffoldRealPhotoStabilityRunManifest
} from "../lib/face-lab-source-manifest-scaffold.js";

const [sourceRoot, outputPath] = process.argv.slice(2);
assert.ok(
  sourceRoot && outputPath,
  "Usage: node scripts/build-face-lab-pointing04-pitch-measurement-manifest.mjs <source-root> <output.json>"
);

const receipts = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/pointing04-pitch-source-receipts.json",
    "utf8"
  )
);

assert.equal(
  receipts.schemaVersion,
  "face-lab-pointing04-pitch-source-receipts-v0"
);
assert.equal(receipts.archives.length, 30);
assert.equal(receipts.selectedPitchAxisImages.length, 270);

const bySeries = new Map();
for (const row of receipts.selectedPitchAxisImages) {
  const key = row.subjectId + "-" + row.series;
  const rows = bySeries.get(key) || [];
  rows.push(row);
  bySeries.set(key, rows);
}
assert.equal(bySeries.size, 30);

const provenanceRef = "https://doi.org/10.6084/m9.figshare.5142466.v2";
const pairs = [];

for (const [key, rows] of [...bySeries.entries()].sort()) {
  const [subjectId, seriesText] = key.split("-");
  const series = Number(seriesText);
  const referenceReceipt = rows.find((row) => row.pitchDegrees === 0);
  assert.ok(referenceReceipt, "pointing04_pitch_reference_missing:" + key);

  const referencePath = path.resolve(
    sourceRoot,
    "subject-" + subjectId,
    "series-" + series,
    "pitch-0.jpg"
  );

  for (const candidateReceipt of rows
    .filter((row) =>
      [-60, -30, -15, 15, 30, 60].includes(row.pitchDegrees)
    )
    .sort((a, b) => a.pitchDegrees - b.pitchDegrees)) {
    const pitchToken =
      candidateReceipt.pitchDegrees < 0
        ? "m" + Math.abs(candidateReceipt.pitchDegrees)
        : "p" + candidateReceipt.pitchDegrees;

    pairs.push({
      pairGroupId:
        "pointing04_pitch_" +
        subjectId +
        "_s" +
        series +
        "_" +
        pitchToken,
      nuisanceClass: "head_pitch",
      subjectLinkage: {
        method: "dataset_same_subject_provenance",
        evidenceRef:
          provenanceRef +
          "#subject-" +
          subjectId +
          "-series-" +
          series
      },
      reference: {
        sampleId:
          "pointing04_" + subjectId + "_s" + series + "_pitch_0",
        path: referencePath
      },
      candidate: {
        sampleId:
          "pointing04_" +
          subjectId +
          "_s" +
          series +
          "_pitch_" +
          candidateReceipt.pitchDegrees,
        path: path.resolve(
          sourceRoot,
          "subject-" + subjectId,
          "series-" + series,
          "pitch-" + candidateReceipt.pitchDegrees + ".jpg"
        )
      }
    });
  }
}

assert.equal(pairs.length, 180);

const scaffold = scaffoldRealPhotoStabilityRunManifest({
  schemaVersion: "face-lab-real-photo-stability-scaffold-spec-v0",
  sourceSet: {
    kind: "licensed_same_subject_photo_set",
    provenanceRef
  },
  pairs
});

assert.equal(scaffold.summary.pairCount, 180);
assert.equal(scaffold.summary.opaqueSampleCount, 210);
assert.deepEqual(scaffold.summary.coveredNuisanceClasses, ["head_pitch"]);
assert.deepEqual(scaffold.summary.missingNuisanceClasses, [
  "expression",
  "head_roll",
  "head_yaw"
]);
assert.equal(scaffold.summary.completeNuisanceCoverage, false);

const receiptByKey = new Map(
  receipts.selectedPitchAxisImages.map((row) => [
    row.subjectId + "-" + row.series + "-" + row.pitchDegrees,
    row
  ])
);

for (const pair of scaffold.manifest.pairs) {
  const match =
    /^pointing04_pitch_(\d{2})_s([12])_(m|p)(\d+)$/.exec(
      pair.pairGroupId
    );
  assert.ok(match, "pointing04_pitch_pair_id_invalid:" + pair.pairGroupId);
  const subjectId = match[1];
  const series = Number(match[2]);
  const candidatePitch =
    (match[3] === "m" ? -1 : 1) * Number(match[4]);

  assert.equal(
    pair.reference.sha256,
    receiptByKey.get(subjectId + "-" + series + "-0").sourceImageSha256
  );
  assert.equal(
    pair.candidate.sha256,
    receiptByKey.get(
      subjectId + "-" + series + "-" + candidatePitch
    ).sourceImageSha256
  );
}

writeFileSync(
  outputPath,
  JSON.stringify(scaffold.manifest, null, 2) + "\n",
  "utf8"
);

console.log(JSON.stringify({
  ok: true,
  manifestDigest: scaffold.summary.manifestDigest,
  pairCount: scaffold.summary.pairCount,
  opaqueSampleCount: scaffold.summary.opaqueSampleCount,
  coveredNuisanceClasses: scaffold.summary.coveredNuisanceClasses,
  missingNuisanceClasses: scaffold.summary.missingNuisanceClasses,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
}, null, 2));
