import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadIntakeDatabaseSnapshot } from "../../../crawler/lib/reviews/review-export-query";
import { runReviewedIntakeDryRun } from "../../../crawler/lib/reviews/reviewed-intake-dry-run";
import { buildReviewImportConfirmPayload } from "../../../crawler/lib/reviews/reviewed-intake-confirm";
import {
  getProductReviewImportMessage,
  mapProductReviewImportCode,
  ProductReviewImportError
} from "@/lib/admin/product-review-import/import-error-map";

function requireAdminClient() {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new ProductReviewImportError("unexpected_error", 503);
  }
  return client;
}

function projectRowError(error) {
  const code = mapProductReviewImportCode(error.error_code, "invalid_reviewed_file");
  return {
    code,
    field: typeof error.field === "string" && error.field.length <= 100 ? error.field : null,
    message: getProductReviewImportMessage(code)
  };
}

export function projectProductReviewDryRun(parsed, dryRun, requestId) {
  const ready = dryRun.summary.status === "PASS" && dryRun.errors.length === 0;
  const confirmation = ready
    ? buildReviewImportConfirmPayload(parsed, dryRun)
    : null;

  return {
    ok: ready,
    status: ready ? "ready" : "invalid",
    requestId,
    exportBatchId: parsed.batch.export_batch_id || null,
    reviewedFileSha256: parsed.reviewedFileSha256 || null,
    canonicalPayloadSha256: confirmation?.payloadHash || null,
    summary: {
      total: dryRun.summary.total_rows,
      valid: dryRun.summary.valid_rows,
      approve:
        dryRun.summary.approve_create_new +
        dryRun.summary.approve_merge_existing,
      create: dryRun.summary.approve_create_new,
      merge: dryRun.summary.approve_merge_existing,
      defer: dryRun.summary.defer,
      block: dryRun.summary.block,
      stale: dryRun.summary.stale_rows,
      identityConflicts: dryRun.summary.identity_conflicts,
      schemaErrors: dryRun.summary.schema_errors,
      databaseWrites: 0
    },
    rows: dryRun.rows.map((row) => ({
      candidateId: row.candidate_id,
      decision: row.decision,
      plan: row.planned_action,
      errors: row.errors.map(projectRowError)
    }))
  };
}

export async function executeProductReviewImportDryRun(parsed) {
  const requestId = randomUUID();
  const client = requireAdminClient();
  let dryRun;

  try {
    dryRun = await runReviewedIntakeDryRun(parsed, (request) =>
      loadIntakeDatabaseSnapshot(client, request)
    );
  } catch (error) {
    throw new ProductReviewImportError(
      mapProductReviewImportCode(error?.message, "dry_run_failed"),
      400
    );
  }

  return projectProductReviewDryRun(parsed, dryRun, requestId);
}
