import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [receiptPath] = process.argv.slice(2);
if (!receiptPath) {
  throw new Error(
    "Usage: node scripts/verify-face-lab-london-set-v5-front-receipts.mjs <receipt.json>"
  );
}

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
assert.equal(
  receipt.schemaVersion,
  "face-lab-london-set-v5-front-source-receipts-v0"
);
assert.equal(receipt.status, "derived_source_receipts_only");
assert.equal(
  receipt.source.mirrorCommit,
  "fa8b78fda2d659bb74ce62fcd99c4407551d2a77"
);
assert.equal(receipt.neutralFront.length, 102);
assert.equal(receipt.smilingFront.length, 102);
assert.deepEqual(
  receipt.neutralFront.map((item) => item.subjectId),
  receipt.smilingFront.map((item) => item.subjectId)
);

for (const [kind, rows] of [
  ["neutral", receipt.neutralFront],
  ["smiling", receipt.smilingFront]
]) {
  for (const item of rows) {
    assert.match(item.subjectId, /^[0-9]{3}$/);
    assert.match(item.upstreamGitBlobSha1, /^[a-f0-9]{40}$/);
    assert.match(item.sourceImageSha256, /^[a-f0-9]{64}$/);
    assert.equal(
      item.upstreamPath,
      kind === "neutral"
        ? "inst/neutral_front/" + item.subjectId + "_03.jpg"
        : "inst/smiling_front/" + item.subjectId + "_08.jpg"
    );
  }
}

const payload = {
  source: receipt.source,
  neutralFront: receipt.neutralFront,
  smilingFront: receipt.smilingFront
};
assert.equal(
  receipt.receiptDigest,
  "sha256:" +
    createHash("sha256").update(stableJson(payload)).digest("hex")
);

assert.equal(receipt.privacy.rawImagesPersistedInReceipt, false);
assert.equal(receipt.privacy.rawLandmarksPersisted, false);
assert.equal(receipt.privacy.identityEmbeddingCreated, false);
assert.equal(receipt.privacy.biometricIdentityMatchPerformed, false);
assert.equal(receipt.privacy.localImagePathsIncluded, false);
assert.equal(receipt.authority.productionAuthority, false);
assert.equal(receipt.authority.normalizationAuthority, false);
assert.equal(receipt.authority.thresholdAuthority, false);
assert.equal(receipt.authority.adequacyDecisionAuthority, false);

console.log(JSON.stringify({
  ok: true,
  receiptDigest: receipt.receiptDigest,
  neutralFrontCount: 102,
  smilingFrontCount: 102,
  exactImageSha256ReceiptsPresent: true,
  rawImagesPersistedInReceipt: false,
  productionAuthority: false,
  normalizationAuthority: false
}, null, 2));
