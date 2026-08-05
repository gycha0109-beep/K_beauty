import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadIntakeDatabaseSnapshot } from "../../../crawler/lib/reviews/review-export-query";
import {
  buildCleanserMetadataV2ConfirmPayload,
  runCleanserMetadataV2DryRun
} from "../../../crawler/lib/reviews/review-cleanser-metadata-v2";
import {
  getProductReviewImportMessage,
  ProductReviewImportError
} from "@/lib/admin/product-review-import/import-error-map";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireClient() {
  const client = createSupabaseAdminClient();
  if (!client) throw new ProductReviewImportError("unexpected_error", 503);
  return client;
}

async function loadMetadataSnapshot(client, { productIds }) {
  const unique = [...new Set(productIds.filter(Boolean))];
  const products = new Map();
  const reviews = new Map();
  if (unique.length === 0) return { products, reviews };

  const productQuery = await client
    .from("products")
    .select("id,category,cleansing_profile,updated_at")
    .in("id", unique);
  if (productQuery.error) throw new Error("review_v2_target_snapshot_failed");
  for (const row of productQuery.data || []) products.set(row.id, row);

  const reviewQuery = await client
    .from("product_metadata_field_reviews")
    .select("product_id,candidate_id,canonical_payload_digest,updated_at")
    .eq("field_name", "cleansing_profile")
    .in("product_id", unique);
  if (reviewQuery.error) throw new Error("review_v2_metadata_snapshot_failed");
  for (const row of reviewQuery.data || []) reviews.set(row.product_id, row);
  return { products, reviews };
}

function projectError(error) {
  return {
    code: String(error.error_code || "invalid_reviewed_file").slice(0, 100),
    field: typeof error.field === "string" ? error.field.slice(0, 100) : null,
    message: getProductReviewImportMessage("invalid_reviewed_file")
  };
}

export function projectProductReviewV2DryRun(parsed, dryRun, requestId) {
  const ready = dryRun.summary.status === "PASS" && dryRun.errors.length === 0;
  const confirmation = ready ? buildCleanserMetadataV2ConfirmPayload(parsed, dryRun) : null;
  return {
    ok: ready,
    status: ready ? "ready" : "invalid",
    requestId,
    retryable: false,
    contractVersion: parsed.batch.review_contract_version,
    exportBatchId: parsed.batch.export_batch_id,
    reviewedFileSha256: parsed.reviewedFileSha256,
    canonicalPayloadSha256: confirmation?.payloadHash || null,
    summary: {
      total: dryRun.summary.total_rows,
      valid: dryRun.summary.valid_rows,
      create: dryRun.summary.approve_create_new,
      merge: dryRun.summary.approve_merge_existing,
      defer: dryRun.summary.defer,
      block: dryRun.summary.block,
      metadataReviewComplete: dryRun.summary.metadata_review_complete,
      reviewedUnknown: dryRun.summary.reviewed_unknown,
      reviewedConflict: dryRun.summary.reviewed_conflict,
      notApplicable: dryRun.summary.not_applicable,
      metadataErrors: dryRun.summary.metadata_errors,
      databaseWrites: 0
    },
    rows: dryRun.rows.map((row) => ({
      candidateId: row.candidate_id,
      state: row.metadata.state,
      cleansingProfile: row.metadata.profile,
      confidence: row.metadata.confidence,
      reviewComplete: row.metadata.complete,
      evidenceDigest: row.metadata.evidenceDigest,
      errors: row.errors.map(projectError)
    }))
  };
}

export async function executeProductReviewImportV2DryRun(parsed, operationRequestId = randomUUID()) {
  const requestId = UUID_PATTERN.test(String(operationRequestId || ""))
    ? String(operationRequestId)
    : randomUUID();
  const client = requireClient();
  try {
    const dryRun = await runCleanserMetadataV2DryRun(
      parsed,
      (request) => loadIntakeDatabaseSnapshot(client, request),
      (request) => loadMetadataSnapshot(client, request)
    );
    return projectProductReviewV2DryRun(parsed, dryRun, requestId);
  } catch {
    throw new ProductReviewImportError("dry_run_failed", 400);
  }
}

export { loadMetadataSnapshot };
