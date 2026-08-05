import { Buffer } from "node:buffer";

import {
  EVIDENCE_SCHEMA_VERSION,
  EXPORT_BATCH_SCHEMA_VERSION,
  EXPORTED_BY_TOOL,
  MANIFEST_HEADERS,
  MANIFEST_SCHEMA_VERSION,
  MAX_BATCH_FILE_BYTES,
  MAX_EVIDENCE_FILE_BYTES,
  MAX_EVIDENCE_LINE_BYTES,
  MAX_JSON_DEPTH,
  MAX_MANIFEST_FILE_BYTES,
  MAX_REVIEWED_FILE_BYTES,
  MAX_REVIEWED_ROWS,
  REVIEWED_HEADERS,
  REVIEWED_SCHEMA_VERSION,
  type EvidenceRow,
  type IntakeDatabaseSnapshot,
  type IntakeDryRunResult,
  type IntakeRowError,
  type ManifestRow,
  type ReviewExportSourceRecord,
  type ReviewImportConfirmPayload,
  type ReviewedCsvRow,
} from "./review-export-contract.js";
import {
  assertJsonValueSafety,
  assertSafeSourceUrl,
  buildCandidateIdsHash,
  buildEvidenceIntegrityHash,
  buildRowIntegrityHash,
  canonicalJson,
  hashesEqual,
  isSha256,
  isUuid,
  sha256Utf8,
} from "./review-batch-integrity.js";
import { parseStrictCsv, serializeCsv } from "./review-csv.js";
import { buildReviewExportBatch } from "./review-export-serializer.js";
import { runReviewedIntakeDryRun, type IntakeSnapshotLoader } from "./reviewed-intake-dry-run.js";
import { buildReviewImportConfirmPayload } from "./reviewed-intake-confirm.js";

export const ADMIN_REVIEW_CONTRACT_V2 = "admin-product-review-v2";
export const EXPORT_BATCH_SCHEMA_VERSION_V2 = "product-review-export-v2";
export const MANIFEST_SCHEMA_VERSION_V2 = "product-review-manifest-v2";
export const EVIDENCE_SCHEMA_VERSION_V2 = "product-review-evidence-v2";
export const REVIEWED_SCHEMA_VERSION_V2 = "product-review-reviewed-v2";
export const IMPORT_CONFIRM_SCHEMA_VERSION_V2 = "product-review-import-confirm-v2";
export const CLEANSER_METADATA_SCHEMA_VERSION = "cleanser-metadata-v1";
export const CLEANSER_REVIEW_POLICY_VERSION = "cleanser-metadata-review-policy-v1";
export const FIELD_EVIDENCE_SCHEMA_VERSION = "product-review-field-evidence-v1";
export const EXPORTED_BY_TOOL_V2 = "bejewely-product-review-export/2";

export const CLEANSING_PROFILES = ["low_ph", "balanced", "deep_clean"] as const;
export const CLEANSING_REVIEW_STATES = [
  "reviewed_valid",
  "reviewed_unknown",
  "reviewed_conflict",
  "not_applicable",
] as const;
export const CLEANSING_REVIEW_CONFIDENCE = ["high", "medium", "low", "unknown"] as const;
export const FIELD_EVIDENCE_TYPES = [
  "official_product_page",
  "manufacturer_documentation",
  "ingredient_list",
  "review_corpus",
  "manual_conflict_record",
] as const;

export const V2_REVIEWED_EXTRA_HEADERS = [
  "review_contract_version",
  "cleansing_profile",
  "cleansing_profile_review_state",
  "cleansing_profile_confidence",
  "cleansing_profile_evidence_refs_json",
  "cleansing_profile_schema_version",
  "cleansing_profile_review_policy_version",
  "cleansing_profile_evidence_schema_version",
] as const;

export const V2_REVIEWED_HEADERS = [
  ...REVIEWED_HEADERS,
  ...V2_REVIEWED_EXTRA_HEADERS,
] as const;

type V2ExtraHeader = (typeof V2_REVIEWED_EXTRA_HEADERS)[number];
export type ReviewedCsvRowV2 = ReviewedCsvRow & Record<V2ExtraHeader, string>;
export type CleansingProfile = (typeof CLEANSING_PROFILES)[number];
export type CleansingReviewState = (typeof CLEANSING_REVIEW_STATES)[number];
export type CleansingReviewConfidence = (typeof CLEANSING_REVIEW_CONFIDENCE)[number];

export interface V2BatchMetadata {
  schema_version: typeof EXPORT_BATCH_SCHEMA_VERSION_V2;
  review_contract_version: typeof ADMIN_REVIEW_CONTRACT_V2;
  cleanser_metadata_schema_version: typeof CLEANSER_METADATA_SCHEMA_VERSION;
  cleanser_metadata_review_policy_version: typeof CLEANSER_REVIEW_POLICY_VERSION;
  field_evidence_schema_version: typeof FIELD_EVIDENCE_SCHEMA_VERSION;
  export_batch_id: string;
  exported_at: string;
  exported_by_tool: typeof EXPORTED_BY_TOOL_V2;
  source_status: "queued" | "reviewing" | "deferred";
  candidate_count: number;
  manifest_file: "manifest.csv";
  evidence_file: "evidence.jsonl";
  reviewed_template_file: "reviewed-template.csv";
  manifest_sha256: string;
  evidence_sha256: string;
  candidate_ids_sha256: string;
  source_snapshot_version: string;
}

export interface FieldEvidenceRecord {
  evidence_id: string;
  candidate_id: string;
  field: "cleansing_profile";
  supported_value: CleansingProfile | null;
  evidence_type: (typeof FIELD_EVIDENCE_TYPES)[number];
  source_reference: string;
  schema_version: typeof FIELD_EVIDENCE_SCHEMA_VERSION;
  evidence_digest: string;
}

export interface ParsedCleanserMetadataV2 {
  directory: string;
  reviewedFileSha256: string;
  batch: V2BatchMetadata;
  manifestRows: ManifestRow[];
  evidenceRows: EvidenceRow[];
  reviewedRows: ReviewedCsvRowV2[];
  v1Parsed: {
    directory: string;
    reviewedFileSha256: string;
    batch: {
      schema_version: typeof EXPORT_BATCH_SCHEMA_VERSION;
      export_batch_id: string;
      exported_at: string;
      exported_by_tool: typeof EXPORTED_BY_TOOL;
      source_status: "queued" | "reviewing" | "deferred";
      candidate_count: number;
      manifest_file: "manifest.csv";
      evidence_file: "evidence.jsonl";
      reviewed_template_file: "reviewed-template.csv";
      manifest_sha256: string;
      evidence_sha256: string;
      candidate_ids_sha256: string;
      source_snapshot_version: string;
    };
    manifestRows: ManifestRow[];
    evidenceRows: EvidenceRow[];
    reviewedRows: ReviewedCsvRow[];
  };
}

export interface MetadataTargetSnapshot {
  products: Map<string, {
    id: string;
    category: string;
    cleansing_profile: string | null;
    updated_at: string;
  }>;
  reviews: Map<string, {
    product_id: string;
    candidate_id: string | null;
    canonical_payload_digest: string;
    updated_at: string;
  }>;
}

export type MetadataTargetSnapshotLoader = (request: {
  productIds: string[];
}) => Promise<MetadataTargetSnapshot>;

export interface ParsedMetadataReview {
  profile: CleansingProfile | null;
  state: CleansingReviewState | null;
  confidence: CleansingReviewConfidence | null;
  refs: string[];
  evidence: FieldEvidenceRecord[];
  evidenceDigest: string | null;
  complete: boolean;
}

export interface CleanserMetadataV2DryRunResult {
  v1: IntakeDryRunResult;
  summary: IntakeDryRunResult["summary"] & {
    metadata_review_complete: number;
    reviewed_unknown: number;
    reviewed_conflict: number;
    not_applicable: number;
    metadata_errors: number;
  };
  rows: Array<{
    row_number: number;
    candidate_id: string | null;
    metadata: ParsedMetadataReview;
    errors: IntakeRowError[];
    targetProduct: MetadataTargetSnapshot["products"] extends Map<string, infer T> ? T | null : never;
    existingReview: MetadataTargetSnapshot["reviews"] extends Map<string, infer T> ? T | null : never;
  }>;
  errors: IntakeRowError[];
}

export class CleanserMetadataV2Error extends Error {
  readonly code: string;
  readonly field: string | null;

  constructor(code: string, message = code, field: string | null = null) {
    super(message);
    this.name = "CleanserMetadataV2Error";
    this.code = code;
    this.field = field;
  }
}

function decodeUtf8(bytes: Uint8Array, maxBytes: number, code: string): string {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > maxBytes) {
    throw new CleanserMetadataV2Error(code, "Batch file exceeds the configured size limit.");
  }
  if (bytes.includes(0)) {
    throw new CleanserMetadataV2Error(code, "Batch file contains a NUL byte.");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CleanserMetadataV2Error(code, "Batch file is not valid UTF-8.");
  }
}

function parseJsonStrict(text: string, code: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
    assertJsonValueSafety(parsed, { maxDepth: MAX_JSON_DEPTH });
  } catch {
    throw new CleanserMetadataV2Error(code, "JSON content is malformed or unsafe.");
  }
  return parsed;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validateBatch(value: unknown): V2BatchMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CleanserMetadataV2Error("review_v2_batch_invalid");
  }
  const row = value as Record<string, unknown>;
  const keys = [
    "schema_version",
    "review_contract_version",
    "cleanser_metadata_schema_version",
    "cleanser_metadata_review_policy_version",
    "field_evidence_schema_version",
    "export_batch_id",
    "exported_at",
    "exported_by_tool",
    "source_status",
    "candidate_count",
    "manifest_file",
    "evidence_file",
    "reviewed_template_file",
    "manifest_sha256",
    "evidence_sha256",
    "candidate_ids_sha256",
    "source_snapshot_version",
  ];
  if (!exactKeys(row, keys)) throw new CleanserMetadataV2Error("review_v2_batch_schema_invalid");
  const timestamp = new Date(String(row.exported_at ?? ""));
  if (
    row.schema_version !== EXPORT_BATCH_SCHEMA_VERSION_V2 ||
    row.review_contract_version !== ADMIN_REVIEW_CONTRACT_V2 ||
    row.cleanser_metadata_schema_version !== CLEANSER_METADATA_SCHEMA_VERSION ||
    row.cleanser_metadata_review_policy_version !== CLEANSER_REVIEW_POLICY_VERSION ||
    row.field_evidence_schema_version !== FIELD_EVIDENCE_SCHEMA_VERSION ||
    row.exported_by_tool !== EXPORTED_BY_TOOL_V2 ||
    !isUuid(String(row.export_batch_id ?? "")) ||
    !Number.isInteger(row.candidate_count) ||
    Number(row.candidate_count) < 1 ||
    Number(row.candidate_count) > MAX_REVIEWED_ROWS ||
    !["queued", "reviewing", "deferred"].includes(String(row.source_status ?? "")) ||
    row.manifest_file !== "manifest.csv" ||
    row.evidence_file !== "evidence.jsonl" ||
    row.reviewed_template_file !== "reviewed-template.csv" ||
    !isSha256(String(row.manifest_sha256 ?? "")) ||
    !isSha256(String(row.evidence_sha256 ?? "")) ||
    !isSha256(String(row.candidate_ids_sha256 ?? "")) ||
    !isSha256(String(row.source_snapshot_version ?? "")) ||
    Number.isNaN(timestamp.getTime()) ||
    timestamp.toISOString() !== row.exported_at
  ) {
    throw new CleanserMetadataV2Error("review_v2_batch_schema_invalid");
  }
  return row as unknown as V2BatchMetadata;
}

function evidenceWithoutDigest(record: FieldEvidenceRecord): Omit<FieldEvidenceRecord, "evidence_digest"> {
  const { evidence_digest: _digest, ...rest } = record;
  return rest;
}

export function buildFieldEvidenceDigest(record: Omit<FieldEvidenceRecord, "evidence_digest">): string {
  return sha256Utf8(canonicalJson(record));
}

function parseEvidenceRows(text: string, batch: V2BatchMetadata): EvidenceRow[] {
  const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
  if (lines.length !== batch.candidate_count || lines.some((line) => !line)) {
    throw new CleanserMetadataV2Error("review_v2_evidence_count_mismatch");
  }
  return lines.map((line, index) => {
    if (Buffer.byteLength(line, "utf8") > MAX_EVIDENCE_LINE_BYTES) {
      throw new CleanserMetadataV2Error("review_v2_evidence_line_invalid");
    }
    const value = parseJsonStrict(line, "review_v2_evidence_json_invalid");
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new CleanserMetadataV2Error("review_v2_evidence_row_invalid");
    }
    const row = value as Record<string, unknown>;
    const expectedKeys = [
      "schema_version",
      "review_contract_version",
      "cleanser_metadata_schema_version",
      "cleanser_metadata_review_policy_version",
      "field_evidence_schema_version",
      "export_batch_id",
      "candidate_id",
      "evidence_version",
      "candidate_snapshot",
      "review_queue_snapshot",
      "ranking_evidence",
      "source_evidence",
      "existing_product_match",
      "proposed_promotion_payload",
      "missing_fields",
      "approve_blockers",
      "evidence_integrity_hash",
    ];
    if (
      !exactKeys(row, expectedKeys) ||
      row.schema_version !== EVIDENCE_SCHEMA_VERSION_V2 ||
      row.review_contract_version !== ADMIN_REVIEW_CONTRACT_V2 ||
      row.cleanser_metadata_schema_version !== CLEANSER_METADATA_SCHEMA_VERSION ||
      row.cleanser_metadata_review_policy_version !== CLEANSER_REVIEW_POLICY_VERSION ||
      row.field_evidence_schema_version !== FIELD_EVIDENCE_SCHEMA_VERSION ||
      row.export_batch_id !== batch.export_batch_id ||
      !isUuid(String(row.candidate_id ?? "")) ||
      !isSha256(String(row.evidence_version ?? "")) ||
      !isSha256(String(row.evidence_integrity_hash ?? ""))
    ) {
      throw new CleanserMetadataV2Error("review_v2_evidence_row_invalid", `Invalid evidence row ${index + 1}.`);
    }
    const { evidence_integrity_hash: digest, ...withoutDigest } = row;
    if (!hashesEqual(String(digest), buildEvidenceIntegrityHash(withoutDigest))) {
      throw new CleanserMetadataV2Error("review_v2_evidence_integrity_mismatch");
    }
    const v1Row: EvidenceRow = {
      ...(row as unknown as EvidenceRow),
      schema_version: EVIDENCE_SCHEMA_VERSION,
    };
    return v1Row;
  });
}

function stripV2Row(row: ReviewedCsvRowV2): ReviewedCsvRow {
  const result = Object.create(null) as ReviewedCsvRow;
  for (const header of REVIEWED_HEADERS) result[header] = row[header];
  result.schema_version = REVIEWED_SCHEMA_VERSION;
  return result;
}

export function parseCleanserMetadataV2Package(files: {
  batch: Uint8Array;
  manifest: Uint8Array;
  evidence: Uint8Array;
  reviewed: Uint8Array;
}): ParsedCleanserMetadataV2 {
  const batchText = decodeUtf8(files.batch, MAX_BATCH_FILE_BYTES, "review_v2_batch_unreadable");
  const manifestText = decodeUtf8(files.manifest, MAX_MANIFEST_FILE_BYTES, "review_v2_manifest_unreadable");
  const evidenceText = decodeUtf8(files.evidence, MAX_EVIDENCE_FILE_BYTES, "review_v2_evidence_unreadable");
  const reviewedText = decodeUtf8(files.reviewed, MAX_REVIEWED_FILE_BYTES, "review_v2_reviewed_unreadable");
  const batch = validateBatch(parseJsonStrict(batchText, "review_v2_batch_invalid"));

  if (!hashesEqual(batch.manifest_sha256, sha256Utf8(manifestText))) {
    throw new CleanserMetadataV2Error("review_v2_manifest_hash_mismatch");
  }
  if (!hashesEqual(batch.evidence_sha256, sha256Utf8(evidenceText))) {
    throw new CleanserMetadataV2Error("review_v2_evidence_hash_mismatch");
  }

  const manifestRows = parseStrictCsv(manifestText, MANIFEST_HEADERS) as ManifestRow[];
  const reviewedRows = parseStrictCsv(reviewedText, V2_REVIEWED_HEADERS) as ReviewedCsvRowV2[];
  const evidenceRows = parseEvidenceRows(evidenceText, batch);
  if (
    manifestRows.length !== batch.candidate_count ||
    reviewedRows.length !== batch.candidate_count ||
    evidenceRows.length !== batch.candidate_count
  ) {
    throw new CleanserMetadataV2Error("review_v2_batch_row_count_mismatch");
  }

  const evidenceById = new Map(evidenceRows.map((row) => [row.candidate_id, row]));
  const ids = manifestRows.map((row) => row.candidate_id);
  if (new Set(ids).size !== ids.length || !hashesEqual(batch.candidate_ids_sha256, buildCandidateIdsHash(ids))) {
    throw new CleanserMetadataV2Error("review_v2_candidate_ids_mismatch");
  }

  const reviewedById = new Map<string, ReviewedCsvRowV2>();
  for (const reviewed of reviewedRows) {
    if (reviewedById.has(reviewed.candidate_id)) {
      throw new CleanserMetadataV2Error("review_v2_duplicate_candidate_id");
    }
    reviewedById.set(reviewed.candidate_id, reviewed);
  }

  for (const [index, manifest] of manifestRows.entries()) {
    const evidence = evidenceById.get(manifest.candidate_id);
    const reviewed = reviewedById.get(manifest.candidate_id);
    if (
      manifest.schema_version !== MANIFEST_SCHEMA_VERSION_V2 ||
      manifest.export_batch_id !== batch.export_batch_id ||
      !reviewed ||
      reviewed.schema_version !== REVIEWED_SCHEMA_VERSION_V2 ||
      reviewed.export_batch_id !== batch.export_batch_id ||
      reviewed.candidate_id !== manifest.candidate_id ||
      reviewed.review_contract_version !== ADMIN_REVIEW_CONTRACT_V2 ||
      reviewed.cleansing_profile_schema_version !== CLEANSER_METADATA_SCHEMA_VERSION ||
      reviewed.cleansing_profile_review_policy_version !== CLEANSER_REVIEW_POLICY_VERSION ||
      reviewed.cleansing_profile_evidence_schema_version !== FIELD_EVIDENCE_SCHEMA_VERSION ||
      !evidence ||
      evidence.evidence_version !== manifest.evidence_version ||
      manifest.evidence_jsonl_ref !== `evidence.jsonl#${manifest.candidate_id}`
    ) {
      throw new CleanserMetadataV2Error("review_v2_row_contract_invalid", `Invalid row ${index + 2}.`);
    }
    const snapshot = evidence.candidate_snapshot as Record<string, unknown>;
    const existing = evidence.existing_product_match;
    const calculated = buildRowIntegrityHash({
      schema_version: MANIFEST_SCHEMA_VERSION_V2,
      export_batch_id: manifest.export_batch_id,
      candidate_id: manifest.candidate_id,
      candidate_updated_at: manifest.candidate_updated_at,
      review_queue_updated_at: manifest.review_queue_updated_at,
      evidence_version: manifest.evidence_version,
      source_external_id: typeof snapshot.external_id === "string" ? snapshot.external_id : null,
      source_product_url: typeof snapshot.source_url === "string" ? snapshot.source_url : null,
      normalized_brand: String(snapshot.normalized_brand ?? ""),
      normalized_name: String(snapshot.normalized_name ?? ""),
      existing_product_match_id: existing?.id ?? null,
      evidence_integrity_hash: evidence.evidence_integrity_hash,
    });
    if (!hashesEqual(manifest.row_integrity_hash, calculated) || reviewed.row_integrity_hash !== manifest.row_integrity_hash) {
      throw new CleanserMetadataV2Error("review_v2_row_integrity_mismatch");
    }
  }

  return {
    directory: "<memory>",
    reviewedFileSha256: sha256Utf8(reviewedText),
    batch,
    manifestRows,
    evidenceRows,
    reviewedRows,
    v1Parsed: {
      directory: "<memory>",
      reviewedFileSha256: sha256Utf8(reviewedText),
      batch: {
        schema_version: EXPORT_BATCH_SCHEMA_VERSION,
        export_batch_id: batch.export_batch_id,
        exported_at: batch.exported_at,
        exported_by_tool: EXPORTED_BY_TOOL,
        source_status: batch.source_status,
        candidate_count: batch.candidate_count,
        manifest_file: "manifest.csv",
        evidence_file: "evidence.jsonl",
        reviewed_template_file: "reviewed-template.csv",
        manifest_sha256: batch.manifest_sha256,
        evidence_sha256: batch.evidence_sha256,
        candidate_ids_sha256: batch.candidate_ids_sha256,
        source_snapshot_version: batch.source_snapshot_version,
      },
      manifestRows: manifestRows.map((row) => ({ ...row, schema_version: MANIFEST_SCHEMA_VERSION })),
      evidenceRows,
      reviewedRows: reviewedRows.map(stripV2Row),
    },
  };
}

