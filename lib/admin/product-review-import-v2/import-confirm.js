import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadIntakeDatabaseSnapshot } from "../../../crawler/lib/reviews/review-export-query";
import {
  buildCleanserMetadataV2ConfirmPayload,
  runCleanserMetadataV2DryRun
} from "../../../crawler/lib/reviews/review-cleanser-metadata-v2";
import { loadMetadataSnapshot } from "@/lib/admin/product-review-import-v2/import-dry-run";
import { ProductReviewImportError } from "@/lib/admin/product-review-import/import-error-map";

export const PRODUCT_REVIEW_IMPORT_V2_CONFIRMATION = "CONFIRM_PRODUCT_REVIEW_IMPORT_V2";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

function requireClient() {
  const client = createSupabaseAdminClient();
  if (!client) throw new ProductReviewImportError("unexpected_error", 503);
  return client;
}

function validateInput(input) {
  if (!UUID_PATTERN.test(String(input.requestId || ""))) {
    throw new ProductReviewImportError("invalid_reviewed_file", 400);
  }
  if (!SHA256_PATTERN.test(String(input.expectedReviewedFileSha256 || "")) ||
      !SHA256_PATTERN.test(String(input.expectedCanonicalPayloadSha256 || ""))) {
    throw new ProductReviewImportError("payload_hash_mismatch", 409);
  }
  if (input.confirmation !== PRODUCT_REVIEW_IMPORT_V2_CONFIRMATION) {
    throw new ProductReviewImportError("confirm_failed", 400);
  }
}

function project(result, status) {
  return {
    ok: true,
    status,
    requestId: result.request_id,
    exportBatchId: result.export_batch_id,
    contractVersion: result.review_contract_version,
    summary: {
      total: result.total_rows,
      create: result.approve_create_new,
      merge: result.approve_merge_existing,
      defer: result.defer,
      block: result.block,
      metadataWrites: result.metadata_writes
    }
  };
}

async function lookup(client, actorUserId, requestId, exportBatchId, payloadHash) {
  const { data, error } = await client.rpc("admin_get_product_review_import_v2_confirmation", {
    p_actor_user_id: actorUserId,
    p_request_id: requestId,
    p_export_batch_id: exportBatchId,
    p_payload_hash: payloadHash
  });
  if (error) {
    const text = [error.message, error.details, error.hint, error.code].filter(Boolean).join(" ");
    if (text.includes("request_id_conflict")) throw new ProductReviewImportError("request_conflict", 409);
    throw new ProductReviewImportError("confirm_failed", 400);
  }
  return data || null;
}

export async function executeProductReviewImportV2Confirm(input) {
  validateInput(input);
  const expectedFile = input.expectedReviewedFileSha256.toLowerCase();
  const expectedPayload = input.expectedCanonicalPayloadSha256.toLowerCase();
  if (input.parsed.reviewedFileSha256.toLowerCase() !== expectedFile) {
    throw new ProductReviewImportError("file_hash_mismatch", 409);
  }

  const client = requireClient();
  const existing = await lookup(
    client,
    input.actorUserId,
    input.requestId,
    input.parsed.batch.export_batch_id,
    expectedPayload
  );
  if (existing) return project(existing, "already_confirmed");

  let dryRun;
  try {
    dryRun = await runCleanserMetadataV2DryRun(
      input.parsed,
      (request) => loadIntakeDatabaseSnapshot(client, request),
      (request) => loadMetadataSnapshot(client, request)
    );
  } catch {
    throw new ProductReviewImportError("dry_run_failed", 409);
  }
  if (dryRun.summary.status !== "PASS" || dryRun.errors.length > 0) {
    const concurrent = await lookup(
      client,
      input.actorUserId,
      input.requestId,
      input.parsed.batch.export_batch_id,
      expectedPayload
    );
    if (concurrent) return project(concurrent, "already_confirmed");
    throw new ProductReviewImportError("dry_run_failed", 409);
  }

  const authoritative = buildCleanserMetadataV2ConfirmPayload(input.parsed, dryRun);
  if (authoritative.payloadHash.toLowerCase() !== expectedPayload) {
    throw new ProductReviewImportError("payload_hash_mismatch", 409);
  }

  const { data, error } = await client.rpc("admin_confirm_product_review_import_v2_batch", {
    p_actor_user_id: input.actorUserId,
    p_request_id: input.requestId,
    p_payload: authoritative.payload,
    p_payload_hash: authoritative.payloadHash
  });
  if (error || !data) {
    const text = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(" ");
    const status = /conflict|stale|already/.test(text) ? 409 : 400;
    throw new ProductReviewImportError(status === 409 ? "request_conflict" : "confirm_failed", status);
  }
  return project(data, "confirmed");
}
