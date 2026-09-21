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
assert.equal(metadata.status, "metadata_only_exact_source_inventory");
assert.equal(metadata.archiveCount, 30);
assert.equal(metadata.archives.length, 30);
assert.equal(metadata.source.structure.subjectCount, 15);
assert.equal(metadata.source.structure.seriesPerSubject, 2);
assert.equal(metadata.source.structure.imagesPerSeries, 93);
assert.equal(metadata.source.structure.totalImages, 2790);
assert.deepEqual(metadata.source.structure.poseAxes, ["tilt", "pan"]);
assert.deepEqual(
  metadata.source.structure.tiltDegrees,
  [-90, -60, -30, -15, 0, 15, 30, 60, 90]
);
assert.deepEqual(
  metadata.source.structure.panDegrees,
  [-90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90]
);

assert.equal(
  metadata.source.usageTerms.standardizedLicenseIdentifier,
  null
);
assert.equal(
  metadata.source.usageTerms.explicitAnyPurposeUse,
  true
);
assert.equal(metadata.source.usageTerms.citationRequired, true);
assert.equal(
  metadata.source.usageTerms.redistributionAuthorityInferred,
  false
);
assert.equal(metadata.source.citation.required, true);

const keys = new Set();
for (const archive of metadata.archives) {
  assert.match(archive.subjectId, /^\d{2}$/);
  assert.ok(archive.series === 1 || archive.series === 2);
  assert.match(archive.label, /^Person\d{2}-[12]$/);
  assert.match(archive.fileName, /^Person\d{2}-[12]\.tar\.gz$/i);
  assert.match(archive.archiveUrl, /^https?:\/\//);
  const key = archive.subjectId + "-" + archive.series;
  assert.equal(keys.has(key), false);
  keys.add(key);
}
assert.equal(keys.size, 30);

const digestPayload = {
  source: metadata.source,
  archives: metadata.archives
};
assert.equal(
  metadata.sourceMetadataDigest,
  "sha256:" +
    createHash("sha256").update(stableJson(digestPayload)).digest("hex")
);

assert.equal(metadata.acquisition.metadataPagesFetched, true);
assert.equal(metadata.acquisition.archiveBytesDownloaded, false);
assert.equal(metadata.acquisition.rawImageBytesDownloaded, false);
assert.equal(metadata.acquisition.rawImageBytesPersisted, false);
assert.equal(metadata.privacy.rawImagesPersisted, false);
assert.equal(metadata.privacy.rawLandmarksPersisted, false);
assert.equal(metadata.privacy.identityEmbeddingCreated, false);
assert.equal(metadata.privacy.biometricIdentityMatchPerformed, false);
assert.equal(metadata.privacy.localImagePathsIncluded, false);
assert.equal(metadata.authority.productionAuthority, false);
assert.equal(metadata.authority.normalizationAuthority, false);
assert.equal(metadata.authority.thresholdAuthority, false);
assert.equal(metadata.authority.adequacyDecisionAuthority, false);
assert.equal(metadata.authority.redistributionAuthority, false);

console.log(
  JSON.stringify(
    {
      ok: true,
      archiveCount: metadata.archiveCount,
      sourceMetadataDigest: metadata.sourceMetadataDigest,
      explicitAnyPurposeUse: true,
      citationRequired: true,
      rawImageBytesDownloaded: false,
      productionAuthority: false
    },
    null,
    2
  )
);
