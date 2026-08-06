export const EXPORT_BATCH_SCHEMA_VERSION = "product-review-export-v1";
export const MANIFEST_SCHEMA_VERSION = "product-review-manifest-v1";
export const EVIDENCE_SCHEMA_VERSION = "product-review-evidence-v1";
export const REVIEWED_SCHEMA_VERSION = "product-review-reviewed-v1";
export const IMPORT_CONFIRM_SCHEMA_VERSION = "product-review-import-confirm-v1";
export const EXPORTED_BY_TOOL = "bejewely-product-review-export/1";

export const EXPORT_STATUSES = ["queued", "reviewing", "deferred"] as const;
export const REVIEW_DECISIONS = ["approve", "defer", "block"] as const;

export const DEFAULT_EXPORT_LIMIT = 100;
export const MAX_EXPORT_LIMIT = 100;
export const MAX_REVIEWED_ROWS = 100;
export const MAX_REVIEWED_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_BATCH_FILE_BYTES = 64 * 1024;
export const MAX_MANIFEST_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_EVIDENCE_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_EVIDENCE_LINE_BYTES = 128 * 1024;
export const MAX_JSON_CELL_BYTES = 32 * 1024;
export const MAX_CSV_CELL_CHARACTERS = 64 * 1024;
export const MAX_JSON_DEPTH = 20;

export type ExportStatus = (typeof EXPORT_STATUSES)[number];
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const MANIFEST_HEADERS = [
  "schema_version",
  "export_batch_id",
  "candidate_id",
  "brand_name",
  "product_name",
  "normalized_brand",
  "normalized_name",
  "source_external_id",
  "source_product_url",
  "source_category_key",
  "source_product_form",
  "review_status",
  "priority_score",
  "review_queue_updated_at",
  "candidate_updated_at",
  "latest_concern_rank",
  "best_concern_rank",
  "concern_observed_dates",
  "distinct_concern_count",
  "latest_popularity_rank",
  "popularity_observed_dates",
  "existing_product_match_id",
  "existing_product_match_confidence",
  "existing_product_normalized_brand",
  "existing_product_normalized_name",
  "evidence_version",
  "evidence_jsonl_ref",
  "row_integrity_hash",
] as const;

export const REVIEWED_PROTECTED_HEADERS = [
  "schema_version",
  "export_batch_id",
  "candidate_id",
  "candidate_updated_at_expected",
  "review_queue_updated_at_expected",
  "evidence_version_expected",
  "row_integrity_hash",
  "evidence_jsonl_ref",
] as const;

export const REVIEWED_INPUT_HEADERS = [
  "review_decision",
  "review_confidence",
  "reviewed_at",
  "review_source_urls_json",
  "canonical_brand",
  "canonical_name",
  "canonical_category",
  "product_form",
  "skin_types_json",
  "concerns_json",
  "texture",
  "finish",
  "irritation_risk",
  "sensitivity_safe",
  "official_product_page_status",
  "ingredient_list_status",
  "duplicate_check_status",
  "existing_product_match_id_reviewed",
  "field_evidence_json",
  "field_confidence_json",
  "contradictions_json",
  "defer_reason",
  "block_reason",
  "review_note",
] as const;

export const REVIEWED_HEADERS = [
  ...REVIEWED_PROTECTED_HEADERS,
  ...REVIEWED_INPUT_HEADERS,
] as const;

export type ManifestHeader = (typeof MANIFEST_HEADERS)[number];
export type ReviewedHeader = (typeof REVIEWED_HEADERS)[number];
export type ManifestRow = Record<ManifestHeader, string>;
export type ReviewedCsvRow = Record<ReviewedHeader, string>;

export interface ExistingProductSnapshot {
  id: string;
  normalized_brand: string;
  normalized_name: string;
  brand: string | null;
  name: string | null;
  category: string | null;
  product_form: string | null;
}

export interface ReviewExportSourceRecord {
  candidate: {
    id: string;
    source_name: string;
    external_type: string | null;
    external_id: string | null;
    source_url: string | null;
    category_path: string | null;
    product_name_raw: string;
    brand_name_raw: string;
    normalized_name: string;
    normalized_brand: string;
    service_category: string | null;
    product_form: string | null;
    canonical_name: string | null;
    canonical_brand: string | null;
    review_status: string;
    review_flags: string[] | null;
    match_method: string | null;
    match_confidence: number | null;
    matched_product_id: string | null;
    duplicate_of_product_id: string | null;
    promotion_payload: unknown;
    promotion_version: string | null;
    updated_at: string;
  };
  review: {
    candidate_id: string;
    status: ExportStatus;
    priority_score: number;
    selection_reason: string;
    evidence_snapshot: unknown;
    rule_version: string;
    first_queued_at: string;
    last_queued_at: string;
    review_note: string | null;
    updated_at: string;
  };
  rankingEvidence: unknown;
  existingProductMatch: ExistingProductSnapshot | null;
}

export interface EvidenceRow {
  schema_version: typeof EVIDENCE_SCHEMA_VERSION;
  export_batch_id: string;
  candidate_id: string;
  evidence_version: string;
  candidate_snapshot: Record<string, unknown>;
  review_queue_snapshot: Record<string, unknown>;
  ranking_evidence: unknown;
  source_evidence: Record<string, unknown>;
  existing_product_match: ExistingProductSnapshot | null;
  proposed_promotion_payload: unknown;
  missing_fields: string[];
  approve_blockers: string[];
  evidence_integrity_hash: string;
}

export interface BatchMetadata {
  schema_version: typeof EXPORT_BATCH_SCHEMA_VERSION;
  export_batch_id: string;
  exported_at: string;
  exported_by_tool: typeof EXPORTED_BY_TOOL;
  source_status: ExportStatus;
  candidate_count: number;
  manifest_file: "manifest.csv";
  evidence_file: "evidence.jsonl";
  reviewed_template_file: "reviewed-template.csv";
  manifest_sha256: string;
  evidence_sha256: string;
  candidate_ids_sha256: string;
  source_snapshot_version: string;
}

export interface ExportBatchFiles {
  batch: BatchMetadata;
  batchJson: string;
  manifestCsv: string;
  evidenceJsonl: string;
  reviewedTemplateCsv: string;
  manifestRows: ManifestRow[];
  evidenceRows: EvidenceRow[];
}

export interface IntakeCandidateSnapshot {
  id: string;
  source_name: string;
  external_type: string | null;
  external_id: string | null;
  source_url: string | null;
  category_path: string | null;
  product_name_raw: string;
  brand_name_raw: string;
  canonical_name: string | null;
  canonical_brand: string | null;
  service_category: string | null;
  product_form: string | null;
  review_flags: string[];
  promotion_payload: unknown;
  promotion_version: string | null;
  updated_at: string;
  review_status: string;
  normalized_brand: string;
  normalized_name: string;
  matched_product_id: string | null;
  duplicate_of_product_id: string | null;
}

export interface IntakeReviewSnapshot {
  candidate_id: string;
  status: string;
  rule_version: string;
  evidence_snapshot: unknown;
  updated_at: string;
}

export interface IntakeDatabaseSnapshot {
  candidates: Map<string, IntakeCandidateSnapshot>;
  reviews: Map<string, IntakeReviewSnapshot>;
  products: Map<string, ExistingProductSnapshot>;
}

export interface IntakeRowError {
  row_number: number;
  candidate_id: string | null;
  error_code: string;
  field: string | null;
  message: string;
}

export type IntakePlannedAction =
  | "create_new"
  | "merge_existing"
  | "deferred"
  | "blocked"
  | "invalid";

export interface IntakeRowResult {
  row_number: number;
  candidate_id: string | null;
  decision: ReviewDecision | null;
  planned_action: IntakePlannedAction;
  valid: boolean;
  errors: IntakeRowError[];
}

export interface IntakeSummary {
  export_batch: string;
  total_rows: number;
  valid_rows: number;
  approve_create_new: number;
  approve_merge_existing: number;
  defer: number;
  block: number;
  schema_errors: number;
  stale_rows: number;
  identity_conflicts: number;
  duplicate_rows: number;
  products_writes: 0;
  database_writes: 0;
  status: "PASS" | "FAIL";
}

export interface IntakeDryRunResult {
  summary: IntakeSummary;
  rows: IntakeRowResult[];
  errors: IntakeRowError[];
}

export interface ReviewImportConfirmRow {
  row_number: number;
  candidate_id: string;
  decision: ReviewDecision;
  reason: string;
  review_confidence: string;
  reviewed_at: string;
  review_source_urls: string[] | null;
  canonical_brand: string | null;
  canonical_name: string | null;
  normalized_brand: string | null;
  normalized_name: string | null;
  canonical_category: string | null;
  product_form: string | null;
  skin_types: string[] | null;
  concerns: string[] | null;
  texture: string | null;
  finish: string | null;
  irritation_risk: string | null;
  sensitivity_safe: boolean | null;
  official_product_page_status: string | null;
  ingredient_list_status: string | null;
  duplicate_check_status: string | null;
  existing_product_match_id: string | null;
  field_evidence: Record<string, unknown> | null;
  field_confidence: Record<string, unknown> | null;
  contradictions: unknown[] | null;
  review_note: string | null;
  candidate_updated_at_expected: string;
  review_queue_updated_at_expected: string;
  evidence_version_expected: string;
  row_integrity_hash: string;
  evidence_integrity_hash: string;
  expected_candidate: {
    source_name: string;
    external_type: string | null;
    external_id: string | null;
    source_url: string | null;
    category_path: string | null;
    brand_name_raw: string;
    product_name_raw: string;
    normalized_brand: string;
    normalized_name: string;
    review_status: string;
    review_flags: string[];
    matched_product_id: string | null;
    duplicate_of_product_id: string | null;
    promotion_version: string | null;
    promotion_payload_sha256: string;
  };
  expected_review: {
    status: string;
    rule_version: string;
  };
}

export interface ReviewImportConfirmPayload {
  schema_version: typeof IMPORT_CONFIRM_SCHEMA_VERSION;
  export_batch_id: string;
  source_snapshot_version: string;
  manifest_sha256: string;
  evidence_sha256: string;
  candidate_ids_sha256: string;
  reviewed_file_sha256: string;
  rows: ReviewImportConfirmRow[];
}

export interface ReviewImportConfirmResult {
  status: "confirmed";
  request_id: string;
  export_batch_id: string;
  actor_role: string;
  total_rows: number;
  approve_create_new: number;
  approve_merge_existing: number;
  defer: number;
  block: number;
  rows: Array<{
    candidate_id: string;
    decision: ReviewDecision;
    candidate_review_status: string;
    queue_status: string;
    promotion_action: "inserted" | "merged" | "none";
    product_id: string | null;
    audit_id: string;
  }>;
}
