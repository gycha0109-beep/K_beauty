#!/usr/bin/env node

import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { parseReviewExportArgs } from "./lib/reviews/review-cli-args.js";
import { writeReviewExportBatch } from "./lib/reviews/review-file-boundary.js";
import { loadReviewExportRecords } from "./lib/reviews/review-export-query.js";
import { buildReviewExportBatch } from "./lib/reviews/review-export-serializer.js";
import { createReviewReadOnlyClient } from "./lib/reviews/review-readonly-client.js";

const CRAWLER_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(CRAWLER_ROOT, "..");

async function main(): Promise<void> {
  const options = parseReviewExportArgs(process.argv.slice(2));
  dotenv.config({ path: path.join(CRAWLER_ROOT, ".env"), override: false });
  const client = createReviewReadOnlyClient();
  const records = await loadReviewExportRecords(client, {
    status: options.status,
    limit: options.limit,
    candidateId: options.candidateId,
  });

  if (records.length === 0) {
    throw new Error("review_export_no_candidates");
  }

  const batch = buildReviewExportBatch(records, {
    exportBatchId: crypto.randomUUID(),
    exportedAt: new Date().toISOString(),
    sourceStatus: options.status,
  });
  const outputPath = await writeReviewExportBatch(
    REPOSITORY_ROOT,
    options.outDir,
    batch,
    options.overwrite,
  );

  process.stdout.write(
    [
      `Export batch: ${batch.batch.export_batch_id}`,
      `Candidates: ${batch.batch.candidate_count}`,
      `Output: ${path.relative(REPOSITORY_ROOT, outputPath)}`,
      `Manifest SHA-256: ${batch.batch.manifest_sha256}`,
      `Evidence SHA-256: ${batch.batch.evidence_sha256}`,
      "Products writes: 0",
      "Database writes: 0",
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  const code =
    error instanceof Error && /^[a-z0-9_]+$/.test(error.message)
      ? error.message
      : "review_export_failed";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
