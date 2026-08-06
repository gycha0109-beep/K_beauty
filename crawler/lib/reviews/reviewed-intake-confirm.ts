import type { SupabaseClient } from "@supabase/supabase-js";

import {
  IMPORT_CONFIRM_SCHEMA_VERSION,
  type IntakeDryRunResult,
  type ReviewImportConfirmPayload,
  type ReviewImportConfirmResult,
} from "./review-export-contract.js";
import { canonicalJson, sha256Utf8 } from "./review-batch-integrity.js";
import { validateReviewedRow } from "./reviewed-intake-contract.js";
import type { ParsedReviewedBatch } from "./reviewed-intake-parser.js";

export class ReviewImportConfirmError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "ReviewImportConfirmError";
    this.code = code;
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requiredString(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ReviewImportConfirmError(code);
  }
  return value;
}

function decisionReason(input: ReturnType<typeof validateReviewedRow>["input"]): string {
  if (input.decision === "defer") {
    return requiredString(input.deferReason, "review_import_defer_reason_required");
  }
  if (input.decision === "block") {
    return requiredString(input.blockReason, "review_import_block_reason_required");
  }
  return input.reviewNote ?? "Reviewed import approved";
}

export function buildReviewImportConfirmPayload(
  parsed: ParsedReviewedBatch,
  dryRun?: IntakeDryRunResult,
): { payload: ReviewImportConfirmPayload; payloadHash: string } {
  if (
    dryRun &&
    (dryRun.summary.status !== "PASS" || dryRun.errors.length > 0)
  ) {
    throw new ReviewImportConfirmError("review_import_confirm_requires_passing_dry_run");
  }

  const manifestById = new Map(
    parsed.manifestRows.map((row) => [row.candidate_id, row]),
  );
  const evidenceById = new Map(
    parsed.evidenceRows.map((row) => [row.candidate_id, row]),
  );

  const rows = parsed.reviewedRows.map((reviewed, index) => {
    const manifest = manifestById.get(reviewed.candidate_id);
    const evidence = evidenceById.get(reviewed.candidate_id);
    if (!manifest || !evidence) {
      throw new ReviewImportConfirmError("reviewed_candidate_set_mismatch");
    }

    const validation = validateReviewedRow(reviewed, manifest, evidence, index + 2);
    const decision = validation.input.decision;
    if (validation.errors.length > 0 || !decision) {
      throw new ReviewImportConfirmError("review_import_confirm_requires_passing_dry_run");
    }

    const candidate = evidence.candidate_snapshot;
    const review = evidence.review_queue_snapshot;
    const input = validation.input;

    return {
      row_number: index + 2,
      candidate_id: reviewed.candidate_id,
      decision,
      reason: decisionReason(input),
      review_confidence: requiredString(
        input.reviewConfidence,
        "review_import_confidence_required",
      ),
      reviewed_at: requiredString(input.reviewedAt, "review_import_reviewed_at_required"),
      review_source_urls: input.reviewSourceUrls ?? null,
      canonical_brand: input.canonicalBrand,
      canonical_name: input.canonicalName,
      normalized_brand: input.normalizedBrand,
      normalized_name: input.normalizedName,
      canonical_category: input.canonicalCategory,
      product_form: input.productForm,
      skin_types: input.skinTypes ?? null,
      concerns: input.concerns ?? null,
      texture: input.texture,
      finish: input.finish,
      irritation_risk: input.irritationRisk,
      sensitivity_safe: input.sensitivitySafe ?? null,
      official_product_page_status: input.officialProductPageStatus,
      ingredient_list_status: input.ingredientListStatus,
      duplicate_check_status: input.duplicateCheckStatus,
      existing_product_match_id: input.existingProductMatchIdReviewed,
      field_evidence: input.fieldEvidence ?? null,
      field_confidence: input.fieldConfidence ?? null,
      contradictions: input.contradictions ?? null,
      review_note: input.reviewNote,
      candidate_updated_at_expected: manifest.candidate_updated_at,
      review_queue_updated_at_expected: manifest.review_queue_updated_at,
      evidence_version_expected: manifest.evidence_version,
      row_integrity_hash: manifest.row_integrity_hash,
      evidence_integrity_hash: evidence.evidence_integrity_hash,
      expected_candidate: {
        source_name: requiredString(
          candidate.source_name,
          "review_import_candidate_snapshot_invalid",
        ),
        external_type: nullableString(candidate.external_type),
        external_id: nullableString(candidate.external_id),
        source_url: nullableString(candidate.source_url),
        category_path: nullableString(candidate.category_path),
        brand_name_raw: requiredString(
          candidate.brand_name_raw,
          "review_import_candidate_snapshot_invalid",
        ),
        product_name_raw: requiredString(
          candidate.product_name_raw,
          "review_import_candidate_snapshot_invalid",
        ),
        normalized_brand: requiredString(
          candidate.normalized_brand,
          "review_import_candidate_snapshot_invalid",
        ),
        normalized_name: requiredString(
          candidate.normalized_name,
          "review_import_candidate_snapshot_invalid",
        ),
        review_status: requiredString(
          candidate.review_status,
          "review_import_candidate_snapshot_invalid",
        ),
        review_flags: Array.isArray(candidate.review_flags)
          ? candidate.review_flags.map(String)
          : [],
        matched_product_id: nullableString(candidate.matched_product_id),
        duplicate_of_product_id: nullableString(candidate.duplicate_of_product_id),
        promotion_version: nullableString(candidate.promotion_version),
        promotion_payload_sha256: requiredString(
          candidate.promotion_payload_sha256,
          "review_import_candidate_snapshot_invalid",
        ),
      },
      expected_review: {
        status: requiredString(review.status, "review_import_review_snapshot_invalid"),
        rule_version: requiredString(
          review.rule_version,
          "review_import_review_snapshot_invalid",
        ),
      },
    };
  });

  const payload: ReviewImportConfirmPayload = {
    schema_version: IMPORT_CONFIRM_SCHEMA_VERSION,
    export_batch_id: parsed.batch.export_batch_id,
    source_snapshot_version: parsed.batch.source_snapshot_version,
    manifest_sha256: parsed.batch.manifest_sha256,
    evidence_sha256: parsed.batch.evidence_sha256,
    candidate_ids_sha256: parsed.batch.candidate_ids_sha256,
    reviewed_file_sha256: parsed.reviewedFileSha256,
    rows,
  };

  return {
    payload,
    payloadHash: sha256Utf8(canonicalJson(payload)),
  };
}

export async function lookupReviewedImportConfirmation(
  client: SupabaseClient,
  options: {
    actorUserId: string;
    requestId: string;
    exportBatchId: string;
    payloadHash: string;
  },
): Promise<ReviewImportConfirmResult | null> {
  const { data, error } = await client.rpc(
    "admin_get_product_review_import_confirmation",
    {
      p_actor_user_id: options.actorUserId,
      p_request_id: options.requestId,
      p_export_batch_id: options.exportBatchId,
      p_payload_hash: options.payloadHash,
    },
  );

  if (error) {
    throw mapConfirmError(databaseErrorText(error));
  }
  if (data === null) {
    return null;
  }
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new ReviewImportConfirmError("review_import_confirmation_lookup_failed");
  }
  return data as unknown as ReviewImportConfirmResult;
}

function mapConfirmError(message: string): ReviewImportConfirmError {
  const actorCode = message.includes("admin_product_review_access_required")
    ? "review_import_access_required"
    : message.includes("admin_product_review_capability_required")
      ? "review_import_capability_required"
      : null;
  const knownCode = actorCode ?? [
    "review_import_request_id_invalid",
    "review_import_payload_invalid",
    "review_import_payload_too_large",
    "review_import_sensitive_payload_rejected",
    "review_import_payload_schema_invalid",
    "review_import_batch_id_invalid",
    "review_import_hash_invalid",
    "review_import_payload_hash_mismatch",
    "review_import_rows_invalid",
    "review_import_row_count_invalid",
    "review_import_row_schema_invalid",
    "review_import_duplicate_candidate_id",
    "review_import_candidate_ids_hash_mismatch",
    "review_import_source_snapshot_hash_mismatch",
    "review_import_access_required",
    "review_import_capability_required",
    "review_import_request_id_conflict",
    "review_import_batch_already_confirmed",
    "review_import_candidate_not_found",
    "review_import_review_queue_not_found",
    "review_import_candidate_id_invalid",
    "review_import_decision_invalid",
    "review_import_stale_candidate",
    "review_import_stale_review_queue",
    "review_import_row_already_processed",
    "review_import_existing_product_not_found",
    "review_import_existing_product_identity_conflict",
    "review_import_existing_product_match_required",
    "review_import_duplicate_product_create",
    "review_import_approve_payload_invalid",
    "review_import_normalization_contract_mismatch",
    "review_import_product_form_invalid",
    "review_import_defer_reason_invalid",
    "review_import_block_reason_invalid",
    "review_import_duplicate_evidence_required",
    "review_import_promotion_failed",
  ].find((code) => message.includes(code));
  return new ReviewImportConfirmError(knownCode ?? "review_import_confirm_failed");
}

function databaseErrorText(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const value = error as Record<string, unknown>;
  return ["message", "details", "hint", "code"]
    .map((key) => (typeof value[key] === "string" ? value[key] : ""))
    .join(" ");
}

export async function confirmReviewedImportBatch(
  client: SupabaseClient,
  options: {
    actorUserId: string;
    requestId: string;
    payload: ReviewImportConfirmPayload;
    payloadHash: string;
  },
): Promise<ReviewImportConfirmResult> {
  const { data, error } = await client.rpc(
    "admin_confirm_product_review_import_batch",
    {
      p_actor_user_id: options.actorUserId,
      p_request_id: options.requestId,
      p_payload: options.payload,
      p_payload_hash: options.payloadHash,
    },
  );

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw mapConfirmError(databaseErrorText(error));
  }

  return data as unknown as ReviewImportConfirmResult;
}

export function formatConfirmResult(result: ReviewImportConfirmResult): string {
  return [
    `Confirm status: ${result.status}`,
    `Request ID: ${result.request_id}`,
    `Export batch: ${result.export_batch_id}`,
    `Total rows: ${result.total_rows}`,
    `Approve create new: ${result.approve_create_new}`,
    `Approve merge existing: ${result.approve_merge_existing}`,
    `Defer: ${result.defer}`,
    `Block: ${result.block}`,
    `Products writes: ${result.approve_create_new + result.approve_merge_existing}`,
    `Database writes: confirmed`,
    "Status: PASS",
    "",
  ].join("\n");
}
