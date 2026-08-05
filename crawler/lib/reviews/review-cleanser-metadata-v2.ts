import {
  MANIFEST_HEADERS,
  type ManifestRow,
  type ReviewExportSourceRecord,
  type ReviewImportConfirmPayload,
} from "./review-export-contract.js";
import {
  buildEvidenceIntegrityHash,
  buildRowIntegrityHash,
  canonicalJson,
  sha256Utf8,
} from "./review-batch-integrity.js";
import { serializeCsv } from "./review-csv.js";
import { buildReviewExportBatch } from "./review-export-serializer.js";
import { runReviewedIntakeDryRun, type IntakeSnapshotLoader } from "./reviewed-intake-dry-run.js";
import { buildReviewImportConfirmPayload } from "./reviewed-intake-confirm.js";
import {
  ADMIN_REVIEW_CONTRACT_V2,
  CLEANSER_METADATA_SCHEMA_VERSION,
  CLEANSER_REVIEW_POLICY_VERSION,
  CleanserMetadataV2Error,
  EVIDENCE_SCHEMA_VERSION_V2,
  EXPORTED_BY_TOOL_V2,
  EXPORT_BATCH_SCHEMA_VERSION_V2,
  FIELD_EVIDENCE_SCHEMA_VERSION,
  IMPORT_CONFIRM_SCHEMA_VERSION_V2,
  MANIFEST_SCHEMA_VERSION_V2,
  REVIEWED_SCHEMA_VERSION_V2,
  V2_REVIEWED_HEADERS,
  type CleanserMetadataV2DryRunResult,
  type MetadataTargetSnapshotLoader,
  type ParsedCleanserMetadataV2,
  type ReviewedCsvRowV2,
  type V2BatchMetadata,
} from "./review-cleanser-metadata-v2-contract.js";
import { validateCleanserMetadataV2Row } from "./review-cleanser-metadata-v2-validation.js";

export * from "./review-cleanser-metadata-v2-contract.js";
export * from "./review-cleanser-metadata-v2-validation.js";

export async function runCleanserMetadataV2DryRun(
  parsed: ParsedCleanserMetadataV2,
  snapshotLoader: IntakeSnapshotLoader,
  metadataLoader: MetadataTargetSnapshotLoader,
): Promise<CleanserMetadataV2DryRunResult> {
  const v1 = await runReviewedIntakeDryRun(parsed.v1Parsed, snapshotLoader);
  const productIds = parsed.manifestRows.map((row) => row.existing_product_match_id).filter(Boolean);
  const metadataSnapshot = await metadataLoader({ productIds });
  const rows = parsed.reviewedRows.map((row, index) => {
    const validation = validateCleanserMetadataV2Row(row, index + 2);
    const productId = parsed.manifestRows[index].existing_product_match_id || null;
    return {
      row_number: index + 2,
      candidate_id: row.candidate_id || null,
      metadata: validation.metadata,
      errors: validation.errors,
      targetProduct: productId ? metadataSnapshot.products.get(productId) ?? null : null,
      existingReview: productId ? metadataSnapshot.reviews.get(productId) ?? null : null,
    };
  });
  const errors = [...v1.errors, ...rows.flatMap((row) => row.errors)];
  const invalidRows = new Set(errors.map((error) => error.row_number));
  return {
    v1,
    summary: {
      ...v1.summary,
      status: errors.length === 0 ? "PASS" : "FAIL",
      valid_rows: parsed.reviewedRows.length - invalidRows.size,
      metadata_review_complete: rows.filter((row) => row.metadata.complete).length,
      reviewed_unknown: rows.filter((row) => row.metadata.state === "reviewed_unknown" && row.errors.length === 0).length,
      reviewed_conflict: rows.filter((row) => row.metadata.state === "reviewed_conflict" && row.errors.length === 0).length,
      not_applicable: rows.filter((row) => row.metadata.state === "not_applicable" && row.errors.length === 0).length,
      metadata_errors: new Set(rows.filter((row) => row.errors.length > 0).map((row) => row.row_number)).size,
    },
    rows,
    errors,
  };
}

export function buildCleanserMetadataV2ConfirmPayload(
  parsed: ParsedCleanserMetadataV2,
  dryRun: CleanserMetadataV2DryRunResult,
): { payload: Record<string, unknown>; payloadHash: string } {
  if (dryRun.summary.status !== "PASS" || dryRun.errors.length > 0) {
    throw new CleanserMetadataV2Error("review_v2_confirm_requires_passing_dry_run");
  }
  const v1 = buildReviewImportConfirmPayload(parsed.v1Parsed, dryRun.v1);
  const metadataByCandidate = new Map(dryRun.rows.map((row) => [row.candidate_id, row]));
  const rows = (v1.payload as ReviewImportConfirmPayload).rows.map((row) => {
    const metadataRow = metadataByCandidate.get(row.candidate_id);
    if (!metadataRow) throw new CleanserMetadataV2Error("review_v2_candidate_set_mismatch");
    return {
      ...row,
      review_contract_version: ADMIN_REVIEW_CONTRACT_V2,
      cleansing_profile: metadataRow.metadata.profile,
      cleansing_profile_review_state: metadataRow.metadata.state,
      cleansing_profile_confidence: metadataRow.metadata.confidence,
      cleansing_profile_evidence_refs: metadataRow.metadata.refs,
      cleansing_profile_evidence_records: metadataRow.metadata.evidence,
      cleansing_profile_evidence_digest: metadataRow.metadata.evidenceDigest,
      cleansing_profile_schema_version: CLEANSER_METADATA_SCHEMA_VERSION,
      cleansing_profile_review_policy_version: CLEANSER_REVIEW_POLICY_VERSION,
      cleansing_profile_evidence_schema_version: FIELD_EVIDENCE_SCHEMA_VERSION,
      structured_metadata_review_complete: metadataRow.metadata.complete,
      expected_target_product: metadataRow.targetProduct,
      expected_existing_metadata_review: metadataRow.existingReview,
    };
  });
  const payload = {
    schema_version: IMPORT_CONFIRM_SCHEMA_VERSION_V2,
    review_contract_version: ADMIN_REVIEW_CONTRACT_V2,
    cleanser_metadata_schema_version: CLEANSER_METADATA_SCHEMA_VERSION,
    cleanser_metadata_review_policy_version: CLEANSER_REVIEW_POLICY_VERSION,
    field_evidence_schema_version: FIELD_EVIDENCE_SCHEMA_VERSION,
    export_batch_id: parsed.batch.export_batch_id,
    source_snapshot_version: parsed.batch.source_snapshot_version,
    manifest_sha256: parsed.batch.manifest_sha256,
    evidence_sha256: parsed.batch.evidence_sha256,
    candidate_ids_sha256: parsed.batch.candidate_ids_sha256,
    reviewed_file_sha256: parsed.reviewedFileSha256,
    v1_payload: v1.payload,
    v1_payload_hash: v1.payloadHash,
    rows,
  };
  return { payload, payloadHash: sha256Utf8(canonicalJson(payload)) };
}

export function buildCleanserMetadataV2ExportBatch(
  records: ReviewExportSourceRecord[],
  options: { exportBatchId: string; exportedAt: string; sourceStatus: "queued" | "reviewing" | "deferred" },
): {
  batch: V2BatchMetadata;
  batchJson: string;
  manifestCsv: string;
  evidenceJsonl: string;
  reviewedTemplateCsv: string;
} {
  const base = buildReviewExportBatch(records, options);
  const evidenceRows = base.evidenceRows.map((source) => {
    const withoutDigest = {
      ...source,
      schema_version: EVIDENCE_SCHEMA_VERSION_V2,
      review_contract_version: ADMIN_REVIEW_CONTRACT_V2,
      cleanser_metadata_schema_version: CLEANSER_METADATA_SCHEMA_VERSION,
      cleanser_metadata_review_policy_version: CLEANSER_REVIEW_POLICY_VERSION,
      field_evidence_schema_version: FIELD_EVIDENCE_SCHEMA_VERSION,
    } as Record<string, unknown>;
    delete withoutDigest.evidence_integrity_hash;
    return { ...withoutDigest, evidence_integrity_hash: buildEvidenceIntegrityHash(withoutDigest) };
  });
  const manifestRows = base.manifestRows.map((source, index) => {
    const evidence = evidenceRows[index];
    const snapshot = evidence.candidate_snapshot as Record<string, unknown>;
    const existing = evidence.existing_product_match as { id?: string } | null;
    return {
      ...source,
      schema_version: MANIFEST_SCHEMA_VERSION_V2,
      row_integrity_hash: buildRowIntegrityHash({
        schema_version: MANIFEST_SCHEMA_VERSION_V2,
        export_batch_id: source.export_batch_id,
        candidate_id: source.candidate_id,
        candidate_updated_at: source.candidate_updated_at,
        review_queue_updated_at: source.review_queue_updated_at,
        evidence_version: source.evidence_version,
        source_external_id: typeof snapshot.external_id === "string" ? snapshot.external_id : null,
        source_product_url: typeof snapshot.source_url === "string" ? snapshot.source_url : null,
        normalized_brand: String(snapshot.normalized_brand ?? ""),
        normalized_name: String(snapshot.normalized_name ?? ""),
        existing_product_match_id: existing?.id ?? null,
        evidence_integrity_hash: String(evidence.evidence_integrity_hash),
      }),
    } as ManifestRow;
  });
  const reviewedRows = manifestRows.map((manifest) => {
    const row = Object.create(null) as ReviewedCsvRowV2;
    for (const header of V2_REVIEWED_HEADERS) row[header] = "";
    row.schema_version = REVIEWED_SCHEMA_VERSION_V2;
    row.export_batch_id = manifest.export_batch_id;
    row.candidate_id = manifest.candidate_id;
    row.candidate_updated_at_expected = manifest.candidate_updated_at;
    row.review_queue_updated_at_expected = manifest.review_queue_updated_at;
    row.evidence_version_expected = manifest.evidence_version;
    row.row_integrity_hash = manifest.row_integrity_hash;
    row.evidence_jsonl_ref = manifest.evidence_jsonl_ref;
    row.review_contract_version = ADMIN_REVIEW_CONTRACT_V2;
    row.cleansing_profile_schema_version = CLEANSER_METADATA_SCHEMA_VERSION;
    row.cleansing_profile_review_policy_version = CLEANSER_REVIEW_POLICY_VERSION;
    row.cleansing_profile_evidence_schema_version = FIELD_EVIDENCE_SCHEMA_VERSION;
    return row;
  });
  const manifestCsv = serializeCsv(MANIFEST_HEADERS, manifestRows);
  const evidenceJsonl = `${evidenceRows.map((row) => canonicalJson(row)).join("\n")}\n`;
  const reviewedTemplateCsv = serializeCsv(V2_REVIEWED_HEADERS, reviewedRows);
  const batch: V2BatchMetadata = {
    schema_version: EXPORT_BATCH_SCHEMA_VERSION_V2,
    review_contract_version: ADMIN_REVIEW_CONTRACT_V2,
    cleanser_metadata_schema_version: CLEANSER_METADATA_SCHEMA_VERSION,
    cleanser_metadata_review_policy_version: CLEANSER_REVIEW_POLICY_VERSION,
    field_evidence_schema_version: FIELD_EVIDENCE_SCHEMA_VERSION,
    export_batch_id: base.batch.export_batch_id,
    exported_at: base.batch.exported_at,
    exported_by_tool: EXPORTED_BY_TOOL_V2,
    source_status: base.batch.source_status,
    candidate_count: base.batch.candidate_count,
    manifest_file: "manifest.csv",
    evidence_file: "evidence.jsonl",
    reviewed_template_file: "reviewed-template.csv",
    manifest_sha256: sha256Utf8(manifestCsv),
    evidence_sha256: sha256Utf8(evidenceJsonl),
    candidate_ids_sha256: base.batch.candidate_ids_sha256,
    source_snapshot_version: base.batch.source_snapshot_version,
  };
  return {
    batch,
    batchJson: `${JSON.stringify(batch, null, 2)}\n`,
    manifestCsv,
    evidenceJsonl,
    reviewedTemplateCsv,
  };
}
