import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [receiptPath] = process.argv.slice(2);
assert.ok(
  receiptPath,
  "Usage: node scripts/verify-face-lab-london-set-v5-yaw-receipts.mjs <receipt.json>"
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
const front = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/london-set-v5-front-source-receipts.json",
    "utf8"
  )
);

assert.equal(
  receipt.schemaVersion,
  "face-lab-london-set-v5-yaw-source-receipts-v0"
);
assert.equal(receipt.status, "derived_yaw_source_receipts_only");
assert.equal(receipt.source.datasetDoi, "10.6084/m9.figshare.5047666.v5");
assert.equal(receipt.source.figshareArticleId, 5047666);
assert.equal(receipt.source.figshareVersion, 5);
assert.match(receipt.source.sourceMetadataDigest, /^sha256:[a-f0-9]{64}$/);

assert.deepEqual(
  receipt.archives.map(({ fileId, fileName }) => ({ fileId, fileName })),
  [
    { fileId: 8545675, fileName: "neutral_left_3quarter.zip" },
    { fileId: 8545681, fileName: "neutral_right_3quarter.zip" }
  ]
);

for (const archive of receipt.archives) {
  assert.ok(Number.isInteger(archive.size));
  assert.ok(archive.size > 0);
  assert.match(archive.md5, /^[a-f0-9]{32}$/);
}

assert.equal(receipt.neutralLeftThreeQuarter.length, 102);
assert.equal(receipt.neutralRightThreeQuarter.length, 102);

const expectedSubjects = front.neutralFront
  .map((row) => row.subjectId)
  .sort();
assert.deepEqual(
  receipt.neutralLeftThreeQuarter.map((row) => row.subjectId),
  expectedSubjects
);
assert.deepEqual(
  receipt.neutralRightThreeQuarter.map((row) => row.subjectId),
  expectedSubjects
);

const frontBySubject = new Map(
  front.neutralFront.map((row) => [
    row.subjectId,
    row.sourceImageSha256
  ])
);

for (const [label, rows, expectedFileId, expectedName] of [
  [
    "left",
    receipt.neutralLeftThreeQuarter,
    8545675,
    "neutral_left_3quarter.zip"
  ],
  [
    "right",
    receipt.neutralRightThreeQuarter,
    8545681,
    "neutral_right_3quarter.zip"
  ]
]) {
  assert.equal(new Set(rows.map((row) => row.subjectId)).size, 102);
  for (const row of rows) {
    assert.match(row.subjectId, /^\d{3}$/);
    assert.equal(row.upstreamArchiveFileId, expectedFileId);
    assert.equal(row.upstreamArchiveName, expectedName);
    assert.match(row.upstreamMemberName, /^\d{3}_\d{2}\.jpe?g$/i);
    assert.match(row.sourceImageSha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(row.byteSize));
    assert.ok(row.byteSize > 0);
    assert.notEqual(
      row.sourceImageSha256,
      frontBySubject.get(row.subjectId),
      "yaw_" + label + "_front_alias:" + row.subjectId
    );
    assert.equal("path" in row, false);
    assert.equal("localPath" in row, false);
  }
}

for (let index = 0; index < 102; index += 1) {
  assert.notEqual(
    receipt.neutralLeftThreeQuarter[index].sourceImageSha256,
    receipt.neutralRightThreeQuarter[index].sourceImageSha256
  );
}

const payload = {
  source: receipt.source,
  archives: receipt.archives,
  neutralLeftThreeQuarter: receipt.neutralLeftThreeQuarter,
  neutralRightThreeQuarter: receipt.neutralRightThreeQuarter
};
assert.equal(
  receipt.receiptDigest,
  "sha256:" +
    createHash("sha256").update(stableJson(payload)).digest("hex")
);

assert.equal(receipt.acquisition.rawArchivesDownloadedTransiently, true);
assert.equal(receipt.acquisition.rawImagesDownloadedTransiently, true);
assert.equal(receipt.acquisition.rawArchivesPersistedInRepository, false);
assert.equal(receipt.acquisition.rawImagesPersistedInReceipt, false);
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
      receiptDigest: receipt.receiptDigest,
      leftThreeQuarterCount: 102,
      rightThreeQuarterCount: 102,
      exactArchiveMd5ReceiptsPresent: true,
      exactImageSha256ReceiptsPresent: true,
      subjectSetMatchesFrontReceipts: true,
      rawImagesPersistedInReceipt: false,
      productionAuthority: false
    },
    null,
    2
  )
);
