#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { parseReviewedImportArgs } from "./lib/reviews/review-cli-args.js";
import { resolveRepositoryPath } from "./lib/reviews/review-file-boundary.js";
import { loadIntakeDatabaseSnapshot } from "./lib/reviews/review-export-query.js";
import { createReviewReadOnlyClient } from "./lib/reviews/review-readonly-client.js";
import {
  formatDryRunResult,
  runReviewedIntakeDryRun,
} from "./lib/reviews/reviewed-intake-dry-run.js";
import {
  IntakeFileError,
  loadParsedReviewedBatch,
} from "./lib/reviews/reviewed-intake-parser.js";

const CRAWLER_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(CRAWLER_ROOT, "..");

async function main(): Promise<void> {
  const options = parseReviewedImportArgs(process.argv.slice(2));
  const reviewedFile = await resolveRepositoryPath(REPOSITORY_ROOT, options.file, {
    mustExist: true,
    expectFile: true,
  });
  const parsed = await loadParsedReviewedBatch(reviewedFile);
  dotenv.config({ path: path.join(CRAWLER_ROOT, ".env"), override: false });
  const client = createReviewReadOnlyClient();
  const result = await runReviewedIntakeDryRun(parsed, (request) =>
    loadIntakeDatabaseSnapshot(client, request),
  );

  process.stdout.write(formatDryRunResult(result));
  if (result.summary.status !== "PASS") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const code =
    error instanceof IntakeFileError
      ? error.code
      : error instanceof Error && /^[a-z0-9_]+$/.test(error.message)
        ? error.message
        : "review_import_dry_run_failed";
  process.stderr.write(`${code}\nProducts writes: 0\nDatabase writes: 0\n`);
  process.exitCode = 1;
});
