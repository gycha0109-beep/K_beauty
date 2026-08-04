import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { REVIEWED_HEADERS, MAX_EVIDENCE_FILE_BYTES } from "./lib/reviews/review-export-contract.js";
import { serializeCsv } from "./lib/reviews/review-csv.js";
import { writeReviewExportBatch } from "./lib/reviews/review-file-boundary.js";
import {
  IntakeFileError,
  parseReviewedBatchFiles
} from "./lib/reviews/reviewed-intake-parser.js";
import { createIntakeFixture } from "./tests/fixtures/product-review-export-intake.js";

async function expectCode(run: () => unknown, code: string): Promise<void> {
  assert.throws(
    run,
    (error: unknown) => error instanceof IntakeFileError && error.code === code
  );
}

async function main(): Promise<void> {
  const fixture = createIntakeFixture();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bejewely-review-intake-bytes-"));

  try {
    const directory = await writeReviewExportBatch(temporaryRoot, "batch", fixture.batch, false);
    const reviewed = Buffer.from(serializeCsv(REVIEWED_HEADERS, fixture.reviewedRows), "utf8");
    const files = {
      batch: await fs.readFile(path.join(directory, "batch.json")),
      manifest: await fs.readFile(path.join(directory, "manifest.csv")),
      evidence: await fs.readFile(path.join(directory, "evidence.jsonl")),
      reviewed
    };

    const parsed = parseReviewedBatchFiles(files);
    assert.equal(parsed.directory, null);
    assert.equal(parsed.reviewedRows.length, fixture.reviewedRows.length);
    assert.equal(parsed.batch.export_batch_id, fixture.batch.batch.export_batch_id);

    await expectCode(
      () => parseReviewedBatchFiles({ ...files, reviewed: Uint8Array.from([0xff]) }),
      "reviewed_csv_unreadable"
    );
    await expectCode(
      () => parseReviewedBatchFiles({ ...files, batch: Buffer.from([0x7b, 0x00, 0x7d]) }),
      "review_batch_unreadable"
    );
    await expectCode(
      () => parseReviewedBatchFiles({ ...files, evidence: Buffer.alloc(0) }),
      "review_evidence_unreadable"
    );
    await expectCode(
      () => parseReviewedBatchFiles({ ...files, evidence: Buffer.alloc(MAX_EVIDENCE_FILE_BYTES + 1) }),
      "review_evidence_unreadable"
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }

  process.stdout.write("verify:product-review-intake-bytes PASS\n");
}

main().catch((error) => {
  process.stderr.write("verify:product-review-intake-bytes FAIL\n");
  if (error instanceof Error) process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
