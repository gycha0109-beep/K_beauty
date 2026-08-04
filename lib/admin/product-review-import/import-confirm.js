import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadIntakeDatabaseSnapshot } from "../../../crawler/lib/reviews/review-export-query";
import { runReviewedIntakeDryRun } from "../../../crawler/lib/reviews/reviewed-intake-dry-run";
import {
  buildReviewImportConfirmPayload,
  confirmReviewedImportBatch,
  lookupReviewedImportConfirmation,
  ReviewImportConfirmError
} from "../../../crawler/lib/reviews/reviewed-intake-confirm";
import {
  mapProductReviewImportCode,
  ProductReviewImportError
} from "@/lib/admin/product-review-import/import-error-map";

export const PRODUCT_REVIEW_IMPORT_CONFIRMATION =
  "CONFIRM_PRODUCT_REVIEW_IMPORT";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

function requireAdminClient() {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new ProductReviewImportError("unexpected_error", 503);
  }
  return client;
}

function validateInput({ requestId, expectedReviewedFileSha256, expectedCanonicalPayloadSha256, confirmation }) {
  if (!UUID_PATTERN.test(String(requestId || ""))) {
    throw new ProductReviewImportError("invalid_reviewed_file", 400);
  }
  if (
    !SHA256_PATTERN.test(String(expectedReviewedFileSha256 || "")) ||
    !SHA256_PATTERN.test(String(expectedCanonicalPayloadSha256 || ""))
  ) {
    throw new ProductReviewImportError("payload_hash_mismatch", 409);
  }
  if (confirmation !== PRODUCT_REVIEW_IMPORT_CONFIRMATION) {
    throw new ProductReviewImportError("confirm_failed", 400);
  }
}

function projectConfirmed(result, status) {
  return {
    ok: true,
    status,
    requestId: result.request_id,
    exportBatchId: result.export_batch_id,
    summary: {
      total: result.total_rows,
      create: result.approve_create_new,
      merge: result.approve_merge_existing,
      defer: result.defer,
      block: result.block
    }
  };
}

async function lookupExact(client, actorUserId, requestId, preliminary) {
  return lookupReviewedImportConfirmation(client, {
    actorUserId,
    requestId,
    exportBatchId: preliminary.payload.export_batch_id,
    payloadHash: preliminary.payloadHash
  });
}

export async function executeProductReviewImportConfirm({
  parsed,
  actorUserId,
  requestId,
  expectedReviewedFileSha256,
  expectedCanonicalPayloadSha256,
  confirmation
}) {
  validateInput({
    requestId,
    expectedReviewedFileSha256,
    expectedCanonicalPayloadSha256,
    confirmation
  });

  if (
    parsed.reviewedFileSha256.toLowerCase() !==
    expectedReviewedFileSha256.toLowerCase()
  ) {
    throw new ProductReviewImportError("file_hash_mismatch", 409);
  }

  let preliminary;
  try {
    preliminary = buildReviewImportConfirmPayload(parsed);
  } catch (error) {
    throw new ProductReviewImportError(
      mapProductReviewImportCode(error?.code || error?.message, "invalid_reviewed_file"),
      400
    );
  }

  if (
    preliminary.payloadHash.toLowerCase() !==
    expectedCanonicalPayloadSha256.toLowerCase()
  ) {
    throw new ProductReviewImportError("payload_hash_mismatch", 409);
  }

  const client = requireAdminClient();

  try {
    const existing = await lookupExact(
      client,
      actorUserId,
      requestId,
      preliminary
    );
    if (existing) return projectConfirmed(existing, "already_confirmed");

    const dryRun = await runReviewedIntakeDryRun(parsed, (request) =>
      loadIntakeDatabaseSnapshot(client, request)
    );

    if (dryRun.summary.status !== "PASS" || dryRun.errors.length > 0) {
      const concurrentExisting = await lookupExact(
        client,
        actorUserId,
        requestId,
        preliminary
      );
      if (concurrentExisting) {
        return projectConfirmed(concurrentExisting, "already_confirmed");
      }
      throw new ProductReviewImportError("dry_run_failed", 409);
    }

    const authoritative = buildReviewImportConfirmPayload(parsed, dryRun);
    if (
      authoritative.payloadHash.toLowerCase() !==
      expectedCanonicalPayloadSha256.toLowerCase()
    ) {
      throw new ProductReviewImportError("payload_hash_mismatch", 409);
    }

    const result = await confirmReviewedImportBatch(client, {
      actorUserId,
      requestId,
      payload: authoritative.payload,
      payloadHash: authoritative.payloadHash
    });
    return projectConfirmed(result, "confirmed");
  } catch (error) {
    if (error instanceof ProductReviewImportError) throw error;
    if (error instanceof ReviewImportConfirmError) {
      const code = mapProductReviewImportCode(error.code, "confirm_failed");
      const status = [
        "request_conflict",
        "batch_already_confirmed",
        "stale_candidate",
        "stale_review",
        "stale_evidence",
        "identity_conflict"
      ].includes(code)
        ? 409
        : 400;
      throw new ProductReviewImportError(code, status);
    }
    throw new ProductReviewImportError("confirm_failed", 500);
  }
}
