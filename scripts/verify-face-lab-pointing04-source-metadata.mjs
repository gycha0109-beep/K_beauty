import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [metadataPath] = process.argv.slice(2);
assert.ok(
  metadataPath,
  "Usage: node scripts/verify-face-lab-pointing04-source-metadata.mjs <metadata.json>"
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

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));

assert.equal(
  metadata.schemaVersion,
  "face-lab-pointing04-source-metadata-v0"
);
assert.equal(
  metadata.status,
  "figshare_metadata_only_exact_source_inventory"
);
assert.equal(metadata.source.articleId, 5142466);
assert.equal(metadata.source.version, 2);
assert.equal(
  metadata.source.doi,
  "10.6084/m9.figshare.5142466.v2"
);
assert.equal(metadata.source.title, "Pointing04 DB");
assert.equal(metadata.source.citation.required, true);
assert.equal(
  metadata.source.citation.article,
  "Estimating Face Orientation from Robust Detection of Salient Facial Features"
);
assert.equal(
  metadata.source.usageSemantics.figshareLicenseIsCcBy,
  true
);
assert.equal(
  metadata.source.usageSemantics.standardizedLicensePresent,
  true
);
assert.ok(metadata.source.license);
assert.ok(
  /CC BY/i.test(String(metadata.source.license.name || "")) ||
    /creativecommons\.org\/licenses\/by\/4\.0/i.test(
      String(metadata.source.license.url || "")
    )
);

assert.ok(Number.isInteger(metadata.fileCount));
assert.ok(metadata.fileCount > 0);
assert.equal(metadata.files.length, metadata.fileCount);
assert.ok(Number.isInteger(metadata.totalFileBytes));
assert.ok(metadata.totalFileBytes > 0);

const ids = new Set();
for (const file of metadata.files) {
  assert.ok(Number.isInteger(file.id));
  assert.ok(file.id > 0);
  assert.equal(ids.has(file.id), false);
  ids.add(file.id);
  assert.equal(typeof file.name, "string");
  assert.ok(file.name.length > 0);
  assert.ok(Number.isInteger(file.size));
  assert.ok(file.size >= 0);
  assert.equal(typeof file.downloadUrl, "string");
  assert.ok(file.downloadUrl.startsWith("https://"));
  if (file.suppliedMd5 !== null) {
    assert.match(file.suppliedMd5, /^[a-f0-9]{32}$/i);
  }
  if (file.computedMd5 !== null) {
    assert.match(file.computedMd5, /^[a-f0-9]{32}$/i);
  }
}

const payload = {
  source: metadata.source,
  files: metadata.files
};
assert.equal(
  metadata.sourceMetadataDigest,
  "sha256:" +
    createHash("sha256").update(stableJson(payload)).digest("hex")
);

assert.equal(metadata.acquisition.metadataEndpointOnly, true);
assert.equal(metadata.acquisition.archiveBytesDownloaded, false);
assert.equal(metadata.acquisition.rawImageBytesDownloaded, false);
assert.equal(metadata.acquisition.rawImageBytesPersisted, false);
assert.equal(metadata.acquisition.fileContentInspected, false);
assert.equal(metadata.privacy.rawImagesPersisted, false);
assert.equal(metadata.privacy.rawLandmarksPersisted, false);
assert.equal(metadata.privacy.identityEmbeddingCreated, false);
assert.equal(metadata.privacy.biometricIdentityMatchPerformed, false);
assert.equal(metadata.privacy.localImagePathsIncluded, false);
assert.equal(metadata.authority.productionAuthority, false);
assert.equal(metadata.authority.normalizationAuthority, false);
assert.equal(metadata.authority.thresholdAuthority, false);
assert.equal(metadata.authority.adequacyDecisionAuthority, false);

console.log(
  JSON.stringify(
    {
      ok: true,
      articleId: metadata.source.articleId,
      version: metadata.source.version,
      fileCount: metadata.fileCount,
      totalFileBytes: metadata.totalFileBytes,
      sourceMetadataDigest: metadata.sourceMetadataDigest,
      licenseName: metadata.source.license.name,
      rawImageBytesDownloaded: false,
      productionAuthority: false
    },
    null,
    2
  )
);
