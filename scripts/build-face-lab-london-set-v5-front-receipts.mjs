import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [sourceRoot, outputPath] = process.argv.slice(2);
if (!sourceRoot || !outputPath) {
  throw new Error(
    "Usage: node scripts/build-face-lab-london-set-v5-front-receipts.mjs <source-root> <output.json>"
  );
}

const inventory = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/london-set-v5-front-upstream-inventory.json",
    "utf8"
  )
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

function receipt(item) {
  const bytes = readFileSync(join(sourceRoot, item.path));
  const gitBlobSha1 = createHash("sha1")
    .update(Buffer.from("blob " + bytes.length + "\0"))
    .update(bytes)
    .digest("hex");
  if (gitBlobSha1 !== item.upstreamGitBlobSha1) {
    throw new Error(
      "london_set_v5_upstream_blob_mismatch:" + item.subjectId + ":" + item.path
    );
  }
  return {
    subjectId: item.subjectId,
    upstreamPath: item.path,
    upstreamGitBlobSha1: item.upstreamGitBlobSha1,
    sourceImageSha256: createHash("sha256").update(bytes).digest("hex")
  };
}

const neutralFront = inventory.inventory.neutralFront.map(receipt);
const smilingFront = inventory.inventory.smilingFront.map(receipt);

const receiptPayload = {
  source: {
    datasetDoi: inventory.source.datasetDoi,
    mirrorRepository: inventory.source.mirrorRepository,
    mirrorCommit: inventory.source.mirrorCommit,
    mirrorTree: inventory.source.mirrorTree
  },
  neutralFront,
  smilingFront
};

const output = {
  schemaVersion: "face-lab-london-set-v5-front-source-receipts-v0",
  status: "derived_source_receipts_only",
  receiptDigest:
    "sha256:" +
    createHash("sha256").update(stableJson(receiptPayload)).digest("hex"),
  ...receiptPayload,
  privacy: {
    rawImagesPersistedInReceipt: false,
    rawLandmarksPersisted: false,
    identityEmbeddingCreated: false,
    biometricIdentityMatchPerformed: false,
    localImagePathsIncluded: false
  },
  authority: {
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false,
    adequacyDecisionAuthority: false
  }
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  ok: true,
  outputPath,
  receiptDigest: output.receiptDigest,
  neutralFrontCount: neutralFront.length,
  smilingFrontCount: smilingFront.length,
  rawImagesPersistedInReceipt: false,
  productionAuthority: false
}, null, 2));
