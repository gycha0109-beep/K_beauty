import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [receiptPath] = process.argv.slice(2);
assert.ok(
  receiptPath,
  "Usage: node scripts/verify-face-lab-pointing04-pitch-receipts.mjs <receipt.json>"
);

function stableJson(value) {
  if (Array.isArray(value)) {
    return "[" + value.map((item) => stableJson(item)).join(",") + "]";
  }
  if (value !== null && typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stableJson(value[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
const contract = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/pointing04-source.contract.json",
    "utf8"
  )
);

assert.equal(
  receipt.schemaVersion,
  "face-lab-pointing04-pitch-source-receipts-v0"
);
assert.equal(
  receipt.status,
  "derived_pitch_axis_source_receipts_only"
);
assert.equal(
  receipt.source.sourceMetadataDigest,
  contract.source.sourceMetadataDigest
);
assert.equal(receipt.source.datasetDoi, contract.source.doi);
assert.equal(receipt.archives.length, 30);
assert.equal(receipt.selectedPitchAxisImages.length, 270);

const archiveKeys = new Set();
for (const archive of receipt.archives) {
  assert.match(archive.subjectId, /^\d{2}$/);
  assert.ok(archive.series === 1 || archive.series === 2);
  assert.match(archive.fileName, /^Person\d{2}-[12]\.tar\.gz$/i);
  assert.ok(Number.isInteger(archive.fileId) && archive.fileId > 0);
  assert.ok(Number.isInteger(archive.size) && archive.size > 0);
  assert.match(archive.md5, /^[a-f0-9]{32}$/);
  const key = archive.subjectId + "-" + archive.series;
  assert.equal(archiveKeys.has(key), false);
  archiveKeys.add(key);
}
assert.equal(archiveKeys.size, 30);

const perSeries = new Map();
const imageShaSet = new Set();
for (const row of receipt.selectedPitchAxisImages) {
  assert.match(row.subjectId, /^\d{2}$/);
  assert.ok(row.series === 1 || row.series === 2);
  assert.ok(
    [-90, -60, -30, -15, 0, 15, 30, 60, 90].includes(
      row.pitchDegrees
    )
  );
  assert.equal(row.panDegrees, 0);
  assert.ok(Number.isInteger(row.sequenceNumber));
  assert.ok(row.sequenceNumber >= 0 && row.sequenceNumber <= 92);
  assert.match(row.sourceImageSha256, /^[a-f0-9]{64}$/);
  assert.equal(imageShaSet.has(row.sourceImageSha256), false);
  imageShaSet.add(row.sourceImageSha256);
  assert.ok(Number.isInteger(row.byteSize) && row.byteSize > 0);
  assert.equal("path" in row, false);
  assert.equal("localPath" in row, false);

  const key = row.subjectId + "-" + row.series;
  const pitches = perSeries.get(key) || [];
  pitches.push(row.pitchDegrees);
  perSeries.set(key, pitches);
}

assert.equal(perSeries.size, 30);
for (const pitches of perSeries.values()) {
  assert.deepEqual(
    [...pitches].sort((a, b) => a - b),
    [-90, -60, -30, -15, 0, 15, 30, 60, 90]
  );
}

const payload = {
  source: receipt.source,
  archives: receipt.archives,
  selectedPitchAxisImages: receipt.selectedPitchAxisImages
};
assert.equal(
  receipt.receiptDigest,
  "sha256:" +
    createHash("sha256").update(stableJson(payload)).digest("hex")
);

assert.equal(receipt.acquisition.rawArchivesDownloadedTransiently, true);
assert.equal(receipt.acquisition.rawImagesReadTransiently, true);
assert.equal(receipt.acquisition.rawArchivesPersistedInRepository, false);
assert.equal(receipt.acquisition.rawImagesPersistedInReceipt, false);
assert.equal(receipt.acquisition.fullArchiveExtractionPerformed, false);
assert.equal(receipt.privacy.rawImagesPersistedInReceipt, false);
assert.equal(receipt.privacy.rawLandmarksPersisted, false);
assert.equal(receipt.privacy.identityEmbeddingCreated, false);
assert.equal(receipt.privacy.biometricIdentityMatchPerformed, false);
assert.equal(receipt.privacy.localImagePathsIncluded, false);
assert.equal(receipt.authority.productionAuthority, false);
assert.equal(receipt.authority.normalizationAuthority, false);
assert.equal(receipt.authority.thresholdAuthority, false);
assert.equal(receipt.authority.adequacyDecisionAuthority, false);

console.log(
  JSON.stringify(
    {
      ok: true,
      archiveCount: receipt.archives.length,
      selectedPitchAxisImageCount:
        receipt.selectedPitchAxisImages.length,
      expectedPitchPairCount: 240,
      receiptDigest: receipt.receiptDigest,
      rawImagesPersistedInReceipt: false,
      productionAuthority: false
    },
    null,
    2
  )
);
