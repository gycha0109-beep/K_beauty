import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildCandidateIdsHash,
  hashesEqual,
  isSha256,
  sha256Utf8,
} from "./lib/reviews/review-batch-integrity.js";
import { ReviewPathError, writeReviewExportBatch } from "./lib/reviews/review-file-boundary.js";
import { buildReviewExportBatch } from "./lib/reviews/review-export-serializer.js";
import {
  FIXTURE_BATCH_ID,
  FIXTURE_CANDIDATE_IDS,
  FIXTURE_EXPORTED_AT,
  createExportFixtureRecords,
} from "./tests/fixtures/product-review-export-intake.js";

async function main(): Promise<void> {
  const records = createExportFixtureRecords().reverse();
  const first = buildReviewExportBatch(records, {
    exportBatchId: FIXTURE_BATCH_ID,
    exportedAt: FIXTURE_EXPORTED_AT,
    sourceStatus: "queued",
  });
  const second = buildReviewExportBatch(records, {
    exportBatchId: FIXTURE_BATCH_ID,
    exportedAt: FIXTURE_EXPORTED_AT,
    sourceStatus: "queued",
  });

  assert.equal(first.manifestCsv, second.manifestCsv);
  assert.equal(first.evidenceJsonl, second.evidenceJsonl);
  assert.equal(first.reviewedTemplateCsv, second.reviewedTemplateCsv);
  assert.equal(first.batchJson, second.batchJson);
  assert.deepEqual(
    first.manifestRows.map((row) => row.candidate_id),
    [...FIXTURE_CANDIDATE_IDS],
  );
  assert.equal(first.manifestRows[0].brand_name, "'=FormulaBrand");
  assert.equal(first.manifestRows[0].product_name, "'+Formula Serum");
  assert.equal(
    first.evidenceRows[0].candidate_snapshot.brand_name_raw,
    "=FormulaBrand",
  );
  assert.equal(first.manifestCsv.includes("\r"), false);
  assert.equal(first.evidenceJsonl.includes("\r"), false);
  assert.ok(isSha256(first.batch.manifest_sha256));
  assert.ok(isSha256(first.batch.evidence_sha256));
  assert.ok(hashesEqual(first.batch.manifest_sha256, sha256Utf8(first.manifestCsv)));
  assert.ok(hashesEqual(first.batch.evidence_sha256, sha256Utf8(first.evidenceJsonl)));
  assert.ok(
    hashesEqual(
      first.batch.candidate_ids_sha256,
      buildCandidateIdsHash([...FIXTURE_CANDIDATE_IDS]),
    ),
  );
  assert.equal(first.batch.candidate_count, 5);

  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "bejewely-review-export-"),
  );
  try {
    const written = await writeReviewExportBatch(
      temporaryRoot,
      "data/review-batches/fixture",
      first,
      false,
    );
    const names = (await fs.readdir(written)).sort();
    assert.deepEqual(names, [
      "batch.json",
      "evidence.jsonl",
      "manifest.csv",
      "reviewed-template.csv",
    ]);
    await assert.rejects(
      () =>
        writeReviewExportBatch(
          temporaryRoot,
          "data/review-batches/fixture",
          first,
          false,
        ),
      (error: unknown) =>
        error instanceof ReviewPathError && error.code === "review_export_output_exists",
    );
    await writeReviewExportBatch(
      temporaryRoot,
      "data/review-batches/fixture",
      first,
      true,
    );
    await assert.rejects(
      () =>
        writeReviewExportBatch(
          temporaryRoot,
          "../outside",
          first,
          false,
        ),
      (error: unknown) =>
        error instanceof ReviewPathError &&
        error.code === "review_path_outside_repository",
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }

  process.stdout.write(
    "verify:product-review-export PASS (deterministic batch, hashes, formula safety, four-file output, overwrite/path boundary)\n",
  );
}

main().catch((error) => {
  process.stderr.write("verify:product-review-export FAIL\n");
  if (error instanceof Error) process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
