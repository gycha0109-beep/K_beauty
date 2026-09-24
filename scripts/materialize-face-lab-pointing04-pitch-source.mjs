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

const [metadataPath, receiptPath, outputRoot] = process.argv.slice(2);
assert.ok(
  metadataPath && receiptPath && outputRoot,
  "Usage: node scripts/materialize-face-lab-pointing04-pitch-source.mjs <metadata.json> <receipt.json> <output-root>"
);

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));

function md5(buffer) {
  return createHash("md5").update(buffer).digest("hex");
}
function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

assert.equal(metadata.sourceMetadataDigest, receipt.source.sourceMetadataDigest);
assert.equal(receipt.archives.length, 30);
assert.equal(receipt.selectedPitchAxisImages.length, 270);

const metadataById = new Map(metadata.files.map((file) => [file.id, file]));
const rowsByArchive = new Map();
for (const row of receipt.selectedPitchAxisImages) {
  const rows = rowsByArchive.get(row.upstreamArchiveFileId) || [];
  rows.push(row);
  rowsByArchive.set(row.upstreamArchiveFileId, rows);
}
assert.equal(rowsByArchive.size, 30);

mkdirSync(outputRoot, { recursive: true });

for (const archiveReceipt of receipt.archives) {
  const file = metadataById.get(archiveReceipt.fileId);
  assert.ok(file, "pointing04_metadata_file_missing:" + archiveReceipt.fileId);
  assert.equal(file.name, archiveReceipt.fileName);
  assert.equal(file.size, archiveReceipt.size);

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
    "pointing04_archive_download_failed:" + file.name + ":" + response.status
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.length, file.size);
  assert.equal(md5(buffer), archiveReceipt.md5);

  const archivePath = path.join(outputRoot, file.name);
  writeFileSync(archivePath, buffer);

  const rows = rowsByArchive.get(file.id);
  assert.equal(rows.length, 9);

  for (const row of rows) {
    const bytes = execFileSync(
      "tar",
      ["-xOzf", archivePath, row.upstreamMemberName],
      { encoding: null, maxBuffer: 8 * 1024 * 1024 }
    );
    assert.equal(
      sha256(bytes),
      row.sourceImageSha256,
      "pointing04_pitch_image_sha_mismatch:" +
        row.subjectId + ":" + row.series + ":" + row.pitchDegrees
    );
    assert.equal(bytes.length, row.byteSize);

    const dir = path.join(
      outputRoot,
      "subject-" + row.subjectId,
      "series-" + row.series
    );
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "pitch-" + row.pitchDegrees + ".jpg"),
      bytes
    );
  }

  rmSync(archivePath, { force: true });
}

console.log(JSON.stringify({
  ok: true,
  materializedImageCount: 270,
  archiveCount: 30,
  rawArchivePersistence: false,
  repositoryPersistence: false
}, null, 2));
