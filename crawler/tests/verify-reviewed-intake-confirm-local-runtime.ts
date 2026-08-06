import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { canonicalJson, sha256Utf8 } from "../lib/reviews/review-batch-integrity.js";
import { createReviewConfirmClient } from "../lib/reviews/review-confirm-client.js";
import { resolveRepositoryPath } from "../lib/reviews/review-file-boundary.js";
import { loadIntakeDatabaseSnapshot } from "../lib/reviews/review-export-query.js";
import { createReviewReadOnlyClient } from "../lib/reviews/review-readonly-client.js";
import { runReviewedIntakeDryRun } from "../lib/reviews/reviewed-intake-dry-run.js";
import {
  buildReviewImportConfirmPayload,
  confirmReviewedImportBatch,
  lookupReviewedImportConfirmation,
  ReviewImportConfirmError,
} from "../lib/reviews/reviewed-intake-confirm.js";
import { loadParsedReviewedBatch } from "../lib/reviews/reviewed-intake-parser.js";

const CRAWLER_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const REPOSITORY_ROOT = path.resolve(CRAWLER_ROOT, "..");
let phase = "initialization";

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ReviewImportConfirmError) {
      if (error.code === code) return;
      throw new Error(`review_runtime_unexpected_code_${error.code}`);
    }
    throw new Error("review_runtime_unexpected_error_type");
  }
  throw new Error(`review_runtime_${code}_not_rejected`);
}

async function countRows(table: string): Promise<number> {
  const client = createReviewConfirmClient();
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error || count === null) throw new Error("review_runtime_count_failed");
  return count;
}

async function main(): Promise<void> {
  const [fileArgument, actorUserId, viewerUserId, requestId] =
    process.argv.slice(2);
  if (!fileArgument || !actorUserId || !viewerUserId || !requestId) {
    throw new Error("review_runtime_arguments_required");
  }

  dotenv.config({ path: path.join(CRAWLER_ROOT, ".env"), override: false });
  const reviewedFile = await resolveRepositoryPath(
    REPOSITORY_ROOT,
    fileArgument,
    { mustExist: true, expectFile: true },
  );
  const parsed = await loadParsedReviewedBatch(reviewedFile);
  const readClient = createReviewReadOnlyClient();
  const confirmClient = createReviewConfirmClient();

  const runDryRun = () =>
    runReviewedIntakeDryRun(parsed, (request) =>
      loadIntakeDatabaseSnapshot(readClient, request),
    );
  const initialDryRun = await runDryRun();
  assert.equal(initialDryRun.summary.status, "PASS");
  const confirmation = buildReviewImportConfirmPayload(parsed, initialDryRun);

  phase = "viewer_capability";
  await expectCode(
    confirmReviewedImportBatch(confirmClient, {
      actorUserId: viewerUserId,
      requestId: `${requestId}-viewer`,
      payload: confirmation.payload,
      payloadHash: confirmation.payloadHash,
    }),
    "review_import_capability_required",
  );

  const staleRow = confirmation.payload.rows[0];
  phase = "stale_setup";
  const staleTimestamp = new Date(
    new Date(staleRow.candidate_updated_at_expected).getTime() + 1_000,
  ).toISOString();
  const staleUpdate = await confirmClient
    .from("product_candidates")
    .update({ updated_at: staleTimestamp })
    .eq("id", staleRow.candidate_id);
  if (staleUpdate.error) throw new Error("review_runtime_stale_setup_failed");

  phase = "stale_rejection";
  await expectCode(
    confirmReviewedImportBatch(confirmClient, {
      actorUserId,
      requestId: `${requestId}-stale`,
      payload: confirmation.payload,
      payloadHash: confirmation.payloadHash,
    }),
    "review_import_stale_candidate",
  );

  phase = "stale_restore";
  const staleRestore = await confirmClient
    .from("product_candidates")
    .update({ updated_at: staleRow.candidate_updated_at_expected })
    .eq("id", staleRow.candidate_id);
  if (staleRestore.error) throw new Error("review_runtime_stale_restore_failed");
  assert.equal((await runDryRun()).summary.status, "PASS");

  phase = "confirm";
  const productsBefore = await countRows("products");
  const result = await confirmReviewedImportBatch(confirmClient, {
    actorUserId,
    requestId,
    payload: confirmation.payload,
    payloadHash: confirmation.payloadHash,
  });
  assert.equal(result.status, "confirmed");
  assert.equal(result.total_rows, 5);
  assert.equal(result.approve_create_new, 1);
  assert.equal(result.approve_merge_existing, 1);
  assert.equal(result.defer, 2);
  assert.equal(result.block, 1);

  phase = "idempotent_retry";
  const retry = await confirmReviewedImportBatch(confirmClient, {
    actorUserId,
    requestId,
    payload: confirmation.payload,
    payloadHash: confirmation.payloadHash,
  });
  assert.deepEqual(retry, result);
  assert.deepEqual(
    await lookupReviewedImportConfirmation(confirmClient, {
      actorUserId,
      requestId,
      exportBatchId: confirmation.payload.export_batch_id,
      payloadHash: confirmation.payloadHash,
    }),
    result,
  );

  phase = "request_conflict";
  const conflictingPayload = structuredClone(confirmation.payload);
  conflictingPayload.rows[0].review_note = "conflicting retry payload";
  await expectCode(
    confirmReviewedImportBatch(confirmClient, {
      actorUserId,
      requestId,
      payload: conflictingPayload,
      payloadHash: sha256Utf8(canonicalJson(conflictingPayload)),
    }),
    "review_import_request_id_conflict",
  );
  phase = "batch_conflict";
  await expectCode(
    confirmReviewedImportBatch(confirmClient, {
      actorUserId,
      requestId: `${requestId}-second`,
      payload: confirmation.payload,
      payloadHash: confirmation.payloadHash,
    }),
    "review_import_batch_already_confirmed",
  );

  phase = "final_state";
  assert.equal(await countRows("products"), productsBefore + 1);
  assert.equal(await countRows("admin_audit_logs"), 5);

  const { data: candidates, error: candidateError } = await confirmClient
    .from("product_candidates")
    .select("id, review_status, matched_product_id")
    .in("id", confirmation.payload.rows.map((row) => row.candidate_id));
  const { data: reviews, error: reviewError } = await confirmClient
    .from("candidate_promotion_reviews")
    .select("candidate_id, status, approved_product_id")
    .in("candidate_id", confirmation.payload.rows.map((row) => row.candidate_id));
  if (candidateError || reviewError) {
    throw new Error("review_runtime_state_read_failed");
  }

  assert.equal(
    candidates?.filter((row) => row.review_status === "promoted").length,
    2,
  );
  assert.equal(
    candidates?.filter((row) => row.review_status === "needs_review").length,
    2,
  );
  assert.equal(
    candidates?.filter((row) => row.review_status === "rejected").length,
    1,
  );
  assert.equal(reviews?.filter((row) => row.status === "approved").length, 2);
  assert.equal(reviews?.filter((row) => row.status === "deferred").length, 2);
  assert.equal(reviews?.filter((row) => row.status === "rejected").length, 1);

  process.stdout.write(
    "verify:product-review-intake-confirm:local-runtime PASS (capability, stale RPC, atomic batch, create, merge, defer, block, retry, conflicts, audit)\n",
  );
}

main().catch((error) => {
  process.stderr.write("verify:product-review-intake-confirm:local-runtime FAIL\n");
  if (error instanceof Error && /^[a-z0-9_]+$/.test(error.message)) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write(`review_runtime_${phase}_failed\n`);
  }
  process.exitCode = 1;
});
