import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

const [metadataPath, contractPath, workRoot, outputPath] =
  process.argv.slice(2);

assert.ok(
  metadataPath && contractPath && workRoot && outputPath,
  "Usage: node scripts/build-face-lab-pointing04-pitch-receipts.mjs <metadata.json> <contract.json> <work-root> <output.json>"
);

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

assert.equal(
  metadata.schemaVersion,
  "face-lab-pointing04-source-metadata-v0"
);
assert.equal(
  metadata.status,
  "figshare_metadata_only_exact_source_inventory"
);
assert.equal(
  contract.schemaVersion,
  "face-lab-pointing04-source-contract-v0"
);
assert.equal(
  metadata.sourceMetadataDigest,
  contract.source.sourceMetadataDigest,
  "pointing04_source_metadata_digest_mismatch"
);
assert.equal(metadata.source.articleId, contract.source.figshareArticleId);
assert.equal(metadata.source.version, contract.source.figshareVersion);
assert.equal(metadata.source.doi, contract.source.doi);
assert.equal(metadata.fileCount, contract.source.fileCount);
assert.equal(metadata.totalFileBytes, contract.source.totalFileBytes);
assert.equal(
  metadata.source.usageSemantics.figshareLicenseIsCcBy,
  true
);

const PITCHES = [-90, -60, -30, -15, 0, 15, 30, 60, 90];
const PANS = [-90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90];

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

function md5(buffer) {
  return createHash("md5").update(buffer).digest("hex");
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function angleForms(value) {
  if (value < 0) return [String(value)];
  if (value === 0) return ["+0", "0"];
  return ["+" + value, String(value)];
}

function validPosePairs() {
  const pairs = [];
  for (const pitch of PITCHES) {
    if (Math.abs(pitch) === 90) {
      pairs.push({ pitch, pan: 0 });
      continue;
    }
    for (const pan of PANS) {
      pairs.push({ pitch, pan });
    }
  }
  return pairs;
}

const VALID_POSES = validPosePairs();
assert.equal(VALID_POSES.length, 93);

function parsePoseMember(memberName, subjectId, series) {
  const base = path.posix.basename(memberName).toLowerCase();
  if (!/\.jpe?g$/i.test(base)) return null;

  const fixedPrefix = ("personne" + subjectId + series).toLowerCase();
  if (!base.startsWith(fixedPrefix)) return null;

  const matches = [];
  for (const pose of VALID_POSES) {
    for (const pitchToken of angleForms(pose.pitch)) {
      for (const panToken of angleForms(pose.pan)) {
        const suffix =
          pitchToken.toLowerCase() +
          panToken.toLowerCase() +
          ".jpg";
        if (!base.endsWith(suffix)) continue;
        const middle = base.slice(
          fixedPrefix.length,
          base.length - suffix.length
        );
        if (/^\d{2}$/.test(middle)) {
          matches.push({
            pitchDegrees: pose.pitch,
            panDegrees: pose.pan,
            sequenceNumber: Number(middle)
          });
        }
      }
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      "pointing04_pose_member_parse_ambiguous:" +
        subjectId +
        ":" +
        series +
        ":" +
        memberName +
        ":" +
        matches.length
    );
  }
  return matches[0];
}

async function download(file) {
  const response = await fetch(file.downloadUrl, {
    headers: {
      accept: "application/gzip,application/octet-stream",
      "user-agent": "BEJEWELY-FaceLab-Research-Pitch/1.0"
    },
    signal: AbortSignal.timeout(120_000)
  });
  assert.equal(
    response.ok,
    true,
    "pointing04_archive_download_failed:" +
      file.name +
      ":" +
      response.status
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(
    buffer.length,
    file.size,
    "pointing04_archive_size_mismatch:" + file.name
  );

  const expectedMd5 = file.computedMd5 || file.suppliedMd5;
  assert.match(
    expectedMd5 || "",
    /^[a-f0-9]{32}$/i,
    "pointing04_archive_md5_missing:" + file.name
  );
  const actualMd5 = md5(buffer);
  if (file.computedMd5) {
    assert.equal(
      actualMd5,
      file.computedMd5.toLowerCase(),
      "pointing04_archive_computed_md5_mismatch:" + file.name
    );
  }
  if (file.suppliedMd5) {
    assert.equal(
      actualMd5,
      file.suppliedMd5.toLowerCase(),
      "pointing04_archive_supplied_md5_mismatch:" + file.name
    );
  }

  return { buffer, actualMd5 };
}

mkdirSync(workRoot, { recursive: true });

const personFiles = metadata.files
  .map((file) => {
    const match = /^Person(\d{2})-([12])\.tar\.gz$/i.exec(file.name);
    if (!match) return null;
    return {
      ...file,
      subjectId: match[1],
      series: Number(match[2])
    };
  })
  .filter(Boolean)
  .sort(
    (a, b) =>
      a.subjectId.localeCompare(b.subjectId) ||
      a.series - b.series
  );

assert.equal(
  personFiles.length,
  contract.source.personArchiveCount,
  "pointing04_person_archive_count_mismatch"
);

const expectedKeys = [];
for (let subject = 1; subject <= 15; subject += 1) {
  const subjectId = String(subject).padStart(2, "0");
  for (const series of [1, 2]) {
    expectedKeys.push(subjectId + "-" + series);
  }
}
assert.deepEqual(
  personFiles.map((file) => file.subjectId + "-" + file.series),
  expectedKeys
);

const archives = [];
const selectedPitchAxisImages = [];

for (const file of personFiles) {
  const { buffer, actualMd5 } = await download(file);
  const archivePath = path.join(workRoot, file.name);
  writeFileSync(archivePath, buffer);

  const members = execFileSync(
    "tar",
    ["-tzf", archivePath],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
  )
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const imageMembers = members.filter((item) => /\.jpe?g$/i.test(item));
  assert.equal(
    imageMembers.length,
    93,
    "pointing04_archive_image_count_invalid:" +
      file.name +
      ":" +
      imageMembers.length
  );

  const parsed = imageMembers.map((memberName) => ({
    memberName,
    ...parsePoseMember(memberName, file.subjectId, file.series)
  }));

  const poseKeys = new Set(
    parsed.map((row) => row.pitchDegrees + ":" + row.panDegrees)
  );
  assert.equal(
    poseKeys.size,
    93,
    "pointing04_pose_grid_not_unique:" + file.name
  );

  const pitchAxis = parsed
    .filter((row) => row.panDegrees === 0)
    .sort((a, b) => a.pitchDegrees - b.pitchDegrees);

  assert.equal(
    pitchAxis.length,
    9,
    "pointing04_pitch_axis_count_invalid:" + file.name
  );
  assert.deepEqual(
    pitchAxis.map((row) => row.pitchDegrees),
    PITCHES
  );

  archives.push({
    subjectId: file.subjectId,
    series: file.series,
    fileId: file.id,
    fileName: file.name,
    size: file.size,
    md5: actualMd5
  });

  for (const row of pitchAxis) {
    const bytes = execFileSync(
      "tar",
      ["-xOzf", archivePath, row.memberName],
      { encoding: null, maxBuffer: 8 * 1024 * 1024 }
    );
    selectedPitchAxisImages.push({
      subjectId: file.subjectId,
      series: file.series,
      pitchDegrees: row.pitchDegrees,
      panDegrees: 0,
      sequenceNumber: row.sequenceNumber,
      upstreamArchiveFileId: file.id,
      upstreamArchiveName: file.name,
      upstreamMemberName: row.memberName,
      sourceImageSha256: sha256(bytes),
      byteSize: bytes.length
    });
  }

  rmSync(archivePath, { force: true });
}

assert.equal(archives.length, 30);
assert.equal(selectedPitchAxisImages.length, 270);

const source = {
  datasetDoi: contract.source.doi,
  figshareArticleId: contract.source.figshareArticleId,
  figshareVersion: contract.source.figshareVersion,
  sourceMetadataDigest: contract.source.sourceMetadataDigest,
  sourceContractRef:
    "evidence/facelab/source-intake/v0/pointing04-source.contract.json"
};

const payload = {
  source,
  archives,
  selectedPitchAxisImages
};

const output = {
  schemaVersion: "face-lab-pointing04-pitch-source-receipts-v0",
  status: "derived_pitch_axis_source_receipts_only",
  receiptDigest:
    "sha256:" +
    createHash("sha256").update(stableJson(payload)).digest("hex"),
  ...payload,
  acquisition: {
    rawArchivesDownloadedTransiently: true,
    rawImagesReadTransiently: true,
    rawArchivesPersistedInRepository: false,
    rawImagesPersistedInReceipt: false,
    fullArchiveExtractionPerformed: false
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
rmSync(workRoot, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      ok: true,
      receiptDigest: output.receiptDigest,
      archiveCount: archives.length,
      selectedPitchAxisImageCount:
        selectedPitchAxisImages.length,
      rawImagesPersistedInReceipt: false,
      productionAuthority: false
    },
    null,
    2
  )
);
