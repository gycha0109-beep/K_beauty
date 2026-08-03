#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import {
  parseReviewedImportArgs,
  ReviewCliArgumentError,
} from "./lib/reviews/review-cli-args.js";
import { createReviewConfirmClient } from "./lib/reviews/review-confirm-client.js";
import { resolveRepositoryPath } from "./lib/reviews/review-file-boundary.js";
import { loadIntakeDatabaseSnapshot } from "./lib/reviews/review-export-query.js";
import { createReviewReadOnlyClient } from "./lib/reviews/review-readonly-client.js";
import {
  formatDryRunResult,
  runReviewedIntakeDryRun,
} from "./lib/reviews/reviewed-intake-dry-run.js";
import {
  buildReviewImportConfirmPayload,
  confirmReviewedImportBatch,
  formatConfirmResult,
  lookupReviewedImportConfirmation,
  ReviewImportConfirmError,
} from "./lib/reviews/reviewed-intake-confirm.js";
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
  const preliminaryConfirmation =
    options.mode === "confirm"
      ? buildReviewImportConfirmPayload(parsed)
      : null;
  const confirmClient =
    options.mode === "confirm" ? createReviewConfirmClient() : null;

  if (options.mode === "confirm" && preliminaryConfirmation && confirmClient) {
    const existing = await lookupReviewedImportConfirmation(confirmClient, {
      actorUserId: options.actorUserId,
      requestId: options.requestId,
      exportBatchId: preliminaryConfirmation.payload.export_batch_id,
      payloadHash: preliminaryConfirmation.payloadHash,
    });
    if (existing) {
      process.stdout.write("Idempotent retry: true\n");
      process.stdout.write(formatConfirmResult(existing));
      return;
    }
  }

  const client = createReviewReadOnlyClient();
  const result = await runReviewedIntakeDryRun(parsed, (request) =>
    loadIntakeDatabaseSnapshot(client, request),
  );

  process.stdout.write(formatDryRunResult(result));
  if (result.summary.status !== "PASS") {
    if (options.mode === "confirm" && preliminaryConfirmation && confirmClient) {
      const existing = await lookupReviewedImportConfirmation(confirmClient, {
        actorUserId: options.actorUserId,
        requestId: options.requestId,
        exportBatchId: preliminaryConfirmation.payload.export_batch_id,
        payloadHash: preliminaryConfirmation.payloadHash,
      });
      if (existing) {
        process.stdout.write("Idempotent retry: true\n");
        process.stdout.write(formatConfirmResult(existing));
        return;
      }
    }
    process.exitCode = 1;
    return;
  }

  if (
    options.mode === "confirm" &&
    preliminaryConfirmation &&
    confirmClient
  ) {
    const confirmation = buildReviewImportConfirmPayload(parsed, result);
    const confirmResult = await confirmReviewedImportBatch(
      confirmClient,
      {
        actorUserId: options.actorUserId,
        requestId: options.requestId,
        payload: confirmation.payload,
        payloadHash: confirmation.payloadHash,
      },
    );
    process.stdout.write(formatConfirmResult(confirmResult));
  }
}

main().catch((error) => {
  const code =
    error instanceof IntakeFileError ||
    error instanceof ReviewCliArgumentError ||
    error instanceof ReviewImportConfirmError
      ? error.code
      : error instanceof Error && /^[a-z0-9_]+$/.test(error.message)
        ? error.message
        : "review_import_failed";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
