import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

const [metadataPath, frontReceiptsPath, workRoot, outputPath] =
  process.argv.slice(2);

assert.ok(
  metadataPath && frontReceiptsPath && workRoot && outputPath,
  "Usage: node scripts/build-face-lab-london-set-v5-yaw-receipts.mjs <figshare-metadata.json> <front-receipts.json> <work-root> <output.json>"
);

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const frontReceipts = JSON.parse(readFileSync(frontReceiptsPath, "utf8"));

assert.equal(
  metadata.schemaVersion,
  "face-lab-london-set-v5-figshare-source-metadata-v0"
);
assert.equal(metadata.status, "metadata_only_exact_source_inventory");
assert.equal(metadata.source.articleId, 5047666);
assert.equal(metadata.source.version, 5);
assert.equal(
  metadata.source.doi,
  "10.6084/m9.figshare.5047666.v5"
);
assert.match(metadata.sourceMetadataDigest, /^sha256:[a-f0-9]{64}$/);

assert.equal(
  frontReceipts.schemaVersion,
  "face-lab-london-set-v5-front-source-receipts-v0"
);
assert.equal(frontReceipts.neutralFront.length, 102);

const expectedSubjects = frontReceipts.neutralFront
  .map((row) => row.subjectId)
  .sort();

const archiveSpecs = [
  {
    key: "neutralLeftThreeQuarter",
    side: "left",
    fileId: 8545675,
    fileName: "neutral_left_3quarter.zip"
  },
  {
    key: "neutralRightThreeQuarter",
    side: "right",
    fileId: 8545681,
    fileName: "neutral_right_3quarter.zip"
  }
];

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

function walkFiles(root) {
  const output = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...walkFiles(full));
    } else if (entry.isFile()) {
      output.push(full);
    }
  }
  return output;
}

function md5(buffer) {
  return createHash("md5").update(buffer).digest("hex");
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function downloadArchive(spec) {
  const file = metadata.files.find(
    (item) => item.id === spec.fileId && item.name === spec.fileName
  );
  assert.ok(file, "london_yaw_archive_metadata_missing:" + spec.fileName);
  assert.equal(file.isLinkOnly, false);
  assert.ok(Number.isInteger(file.size) && file.size > 0);
  assert.equal(typeof file.downloadUrl, "string");
  assert.ok(file.downloadUrl.startsWith("https://"));

  const expectedMd5 = file.computedMd5 || file.suppliedMd5;
  assert.match(
    expectedMd5 || "",
    /^[a-f0-9]{32}$/i,
    "london_yaw_archive_md5_missing:" + spec.fileName
  );

  const response = await fetch(file.downloadUrl, {
    headers: {
      accept: "application/octet-stream",
      "user-agent": "BEJEWELY-FaceLab-Research-Yaw/1.0"
    },
    signal: AbortSignal.timeout(120_000)
  });
  assert.equal(
    response.ok,
    true,
    "london_yaw_archive_download_failed:" +
      spec.fileName +
      ":" +
      response.status
  );

  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(
    buffer.length,
    file.size,
    "london_yaw_archive_size_mismatch:" + spec.fileName
  );
  const actualMd5 = md5(buffer);
  if (file.computedMd5) {
    assert.equal(
      actualMd5,
      file.computedMd5.toLowerCase(),
      "london_yaw_archive_computed_md5_mismatch:" + spec.fileName
    );
  }
  if (file.suppliedMd5) {
    assert.equal(
      actualMd5,
      file.suppliedMd5.toLowerCase(),
      "london_yaw_archive_supplied_md5_mismatch:" + spec.fileName
    );
  }

  const archiveDir = path.join(workRoot, spec.key);
  mkdirSync(archiveDir, { recursive: true });
  const zipPath = path.join(workRoot, spec.fileName);
  writeFileSync(zipPath, buffer);

  execFileSync("unzip", ["-qq", "-o", zipPath, "-d", archiveDir], {
    stdio: "inherit"
  });
  rmSync(zipPath, { force: true });

  const imageFiles = walkFiles(archiveDir)
    .filter((filePath) => /\.jpe?g$/i.test(filePath))
    .map((filePath) => {
      const baseName = path.basename(filePath);
      const match = /^(\d{3})_(\d{2})\.jpe?g$/i.exec(baseName);
      if (!match) return null;
      const bytes = readFileSync(filePath);
      return {
        subjectId: match[1],
        upstreamMemberName: path
          .relative(archiveDir, filePath)
          .split(path.sep)
          .join("/"),
        sourceImageSha256: sha256(bytes),
        byteSize: statSync(filePath).size
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.subjectId.localeCompare(b.subjectId) ||
        a.upstreamMemberName.localeCompare(b.upstreamMemberName)
    );

  assert.equal(
    imageFiles.length,
    102,
    "london_yaw_archive_image_count_invalid:" +
      spec.fileName +
      ":" +
      imageFiles.length
  );

  const subjectIds = imageFiles.map((row) => row.subjectId);
  assert.deepEqual(
    subjectIds,
    expectedSubjects,
    "london_yaw_archive_subject_set_mismatch:" + spec.fileName
  );
  assert.equal(new Set(subjectIds).size, 102);

  return {
    archive: {
      key: spec.key,
      side: spec.side,
      fileId: file.id,
      fileName: file.name,
      size: file.size,
      md5: actualMd5
    },
    images: imageFiles.map((row) => ({
      ...row,
      upstreamArchiveFileId: file.id,
      upstreamArchiveName: file.name
    }))
  };
}

mkdirSync(workRoot, { recursive: true });

const left = await downloadArchive(archiveSpecs[0]);
const right = await downloadArchive(archiveSpecs[1]);

for (let index = 0; index < expectedSubjects.length; index += 1) {
  assert.equal(left.images[index].subjectId, expectedSubjects[index]);
  assert.equal(right.images[index].subjectId, expectedSubjects[index]);
  assert.notEqual(
    left.images[index].sourceImageSha256,
    right.images[index].sourceImageSha256,
    "london_yaw_left_right_asset_alias:" + expectedSubjects[index]
  );
}

const frontBySubject = new Map(
  frontReceipts.neutralFront.map((row) => [
    row.subjectId,
    row.sourceImageSha256
  ])
);
for (const row of [...left.images, ...right.images]) {
  assert.notEqual(
    row.sourceImageSha256,
    frontBySubject.get(row.subjectId),
    "london_yaw_front_asset_alias:" + row.subjectId
  );
}

const source = {
  datasetDoi: metadata.source.doi,
  figshareArticleId: metadata.source.articleId,
  figshareVersion: metadata.source.version,
  sourceMetadataDigest: metadata.sourceMetadataDigest
};

const receiptPayload = {
  source,
  archives: [left.archive, right.archive],
  neutralLeftThreeQuarter: left.images,
  neutralRightThreeQuarter: right.images
};

const output = {
  schemaVersion: "face-lab-london-set-v5-yaw-source-receipts-v0",
  status: "derived_yaw_source_receipts_only",
  receiptDigest:
    "sha256:" +
    createHash("sha256")
      .update(stableJson(receiptPayload))
      .digest("hex"),
  ...receiptPayload,
  acquisition: {
    rawArchivesDownloadedTransiently: true,
    rawImagesDownloadedTransiently: true,
    rawArchivesPersistedInRepository: false,
    rawImagesPersistedInReceipt: false
  },
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

console.log(
  JSON.stringify(
    {
      ok: true,
      receiptDigest: output.receiptDigest,
      leftThreeQuarterCount: left.images.length,
      rightThreeQuarterCount: right.images.length,
      archiveIds: output.archives.map((archive) => archive.fileId),
      rawImagesPersistedInReceipt: false,
      productionAuthority: false
    },
    null,
    2
  )
);
