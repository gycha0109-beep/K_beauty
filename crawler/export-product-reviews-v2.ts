#!/usr/bin/env node

import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { parseReviewExportArgs } from "./lib/reviews/review-cli-args.js";
import { writeReviewExportBatch } from "./lib/reviews/review-file-boundary.js";
import { loadReviewExportRecords } from "./lib/reviews/review-export-query.js";
import { createReviewReadOnlyClient } from "./lib/reviews/review-readonly-client.js";
import { buildCleanserMetadataV2ExportBatch } from "./lib/reviews/review-cleanser-metadata-v2.js";
import type { ExportBatchFiles } from "./lib/reviews/review-export-contract.js";

const CRAWLER_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(CRAWLER_ROOT, "..");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveExportBatchId(): string {
  const configured = process.env.REVIEW_V2_EXPORT_BATCH_ID?.trim();
  if (!configured) return crypto.randomUUID();
  if (!UUID_PATTERN.test(configured)) throw new Error("review_export_v2_batch_id_invalid");
  return configured;
}

function resolveExportedAt(): string {
  const configured = process.env.REVIEW_V2_EXPORTED_AT?.trim();
  if (!configured) return new Date().toISOString();
  const parsed = new Date(configured);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== configured) {
    throw new Error("review_export_v2_exported_at_invalid");
  }
  return configured;
}

async function main(): Promise<void> {
  const options = parseReviewExportArgs(process.argv.slice(2));
  dotenv.config({ path: path.join(CRAWLER_ROOT, ".env"), override: false });
  const client = createReviewReadOnlyClient();
  const records = await loadReviewExportRecords(client, {
    status: options.status,
    limit: options.limit,
    candidateId: options.candidateId,
  });
  if (records.length === 0) throw new Error("review_export_no_candidates");

  const batch = buildCleanserMetadataV2ExportBatch(records, {
    exportBatchId: resolveExportBatchId(),
    exportedAt: resolveExportedAt(),
    sourceStatus: options.status,
  });
  const outputPath = await writeReviewExportBatch(
    REPOSITORY_ROOT,
    options.outDir,
    batch as unknown as ExportBatchFiles,
    options.overwrite,
  );
  process.stdout.write([
    `Export batch: ${batch.batch.export_batch_id}`,
    `Contract: ${batch.batch.review_contract_version}`,
    `Candidates: ${batch.batch.candidate_count}`,
    `Output: ${path.relative(REPOSITORY_ROOT, outputPath)}`,
    `Manifest SHA-256: ${batch.batch.manifest_sha256}`,
    `Evidence SHA-256: ${batch.batch.evidence_sha256}`,
    "Products writes: 0",
    "Database writes: 0",
    "",
  ].join("\n"));
}

main().catch((error) => {
  const code = error instanceof Error && /^[a-z0-9_]+$/.test(error.message)
    ? error.message
    : "review_export_v2_failed";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
