import fs from "node:fs/promises";
import path from "node:path";

import {
  EVIDENCE_SCHEMA_VERSION,
  EXPORTED_BY_TOOL,
  EXPORT_BATCH_SCHEMA_VERSION,
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
  type BatchMetadata,
  type EvidenceRow,
  type ManifestRow,
  type ReviewedCsvRow,
} from "./review-export-contract.js";
import {
  assertJsonValueSafety,
  buildCandidateIdsHash,
  buildEvidenceIntegrityHash,
  buildRowIntegrityHash,
  canonicalJson,
  hashesEqual,
  isSha256,
  isUuid,
  sha256Utf8,
} from "./review-batch-integrity.js";
import {
  CsvContractError,
  parseManifestCsv,
  parseReviewedCsv,
} from "./review-csv.js";

export class IntakeFileError extends Error {
  readonly code: string;
  readonly field: string | null;

  constructor(code: string, message: string, field: string | null = null) {
    super(message);
    this.name = "IntakeFileError";
    this.code = code;
    this.field = field;
  }
}

export interface ParsedReviewedBatch {
  directory: string;
  batch: BatchMetadata;
  manifestRows: ManifestRow[];
  evidenceRows: EvidenceRow[];
  reviewedRows: ReviewedCsvRow[];
}

function parseJsonStrict(text: string, code: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new IntakeFileError(code, "JSON content is malformed.");
  }

  try {
    assertJsonValueSafety(value, { maxDepth: MAX_JSON_DEPTH });
  } catch {
    throw new IntakeFileError(code, "JSON content exceeds safety constraints.");
  }

  return value;
}

async function readUtf8File(filePath: string, maxBytes: number, code: string): Promise<string> {
  const stat = await fs.lstat(filePath).catch(() => null);

  if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
    throw new IntakeFileError(code, "Required batch file is missing or unsafe.");
  }

  if (stat.size > maxBytes) {
    throw new IntakeFileError(code, "Batch file exceeds the configured size limit.");
  }

  const bytes = await fs.readFile(filePath);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new IntakeFileError(code, "Batch file is not valid UTF-8.");
  }
}

function validateBatchMetadata(value: unknown): BatchMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntakeFileError("review_batch_invalid", "batch.json must contain an object.");
  }

  const batch = value as Record<string, unknown>;
  const expectedKeys = [
    "schema_version",
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
  const unknownKeys = Object.keys(batch).filter((key) => !expectedKeys.includes(key));
  const missingKeys = expectedKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(batch, key),
  );

  if (unknownKeys.length > 0 || missingKeys.length > 0) {
    throw new IntakeFileError(
      "review_batch_schema_invalid",
      "batch.json keys do not match the v1 contract.",
    );
  }

  if (
    batch.schema_version !== EXPORT_BATCH_SCHEMA_VERSION ||
    !isUuid(String(batch.export_batch_id ?? "")) ||
    !Number.isInteger(batch.candidate_count) ||
    Number(batch.candidate_count) < 1 ||
    Number(batch.candidate_count) > MAX_REVIEWED_ROWS ||
    batch.manifest_file !== "manifest.csv" ||
    batch.evidence_file !== "evidence.jsonl" ||
    batch.reviewed_template_file !== "reviewed-template.csv" ||
    batch.exported_by_tool !== EXPORTED_BY_TOOL ||
    !["queued", "reviewing", "deferred"].includes(String(batch.source_status ?? "")) ||
    !isSha256(String(batch.manifest_sha256 ?? "")) ||
    !isSha256(String(batch.evidence_sha256 ?? "")) ||
    !isSha256(String(batch.candidate_ids_sha256 ?? "")) ||
    !isSha256(String(batch.source_snapshot_version ?? ""))
  ) {
    throw new IntakeFileError(
      "review_batch_schema_invalid",
      "batch.json values do not match the v1 contract.",
    );
  }

  const exportedAt = new Date(String(batch.exported_at ?? ""));
  if (Number.isNaN(exportedAt.getTime()) || exportedAt.toISOString() !== batch.exported_at) {
    throw new IntakeFileError(
      "review_batch_schema_invalid",
      "batch.json exported_at must be a normalized UTC timestamp.",
    );
  }

  return batch as unknown as BatchMetadata;
}

function parseEvidenceJsonl(text: string): EvidenceRow[] {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length === 0) {
    throw new IntakeFileError("review_evidence_empty", "evidence.jsonl is empty.");
  }

  return lines.map((line, index) => {
    if (!line || Buffer.byteLength(line, "utf8") > MAX_EVIDENCE_LINE_BYTES) {
      throw new IntakeFileError(
        "review_evidence_line_invalid",
        `evidence.jsonl line ${index + 1} is blank or oversized.`,
      );
    }

    const parsed = parseJsonStrict(line, "review_evidence_json_invalid");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new IntakeFileError(
        "review_evidence_row_invalid",
        `evidence.jsonl line ${index + 1} must be an object.`,
      );
    }

    const row = parsed as Record<string, unknown>;
    const expectedKeys = [
      "schema_version",
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
      Object.keys(row).some((key) => !expectedKeys.includes(key)) ||
      expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(row, key)) ||
      row.schema_version !== EVIDENCE_SCHEMA_VERSION ||
      !isUuid(String(row.export_batch_id ?? "")) ||
      !isUuid(String(row.candidate_id ?? "")) ||
      !isSha256(String(row.evidence_version ?? "")) ||
      !isSha256(String(row.evidence_integrity_hash ?? ""))
    ) {
      throw new IntakeFileError(
        "review_evidence_row_invalid",
        `evidence.jsonl line ${index + 1} does not match the v1 contract.`,
      );
    }

    if (
      !row.candidate_snapshot ||
      typeof row.candidate_snapshot !== "object" ||
      Array.isArray(row.candidate_snapshot) ||
      !row.review_queue_snapshot ||
      typeof row.review_queue_snapshot !== "object" ||
      Array.isArray(row.review_queue_snapshot) ||
      !row.source_evidence ||
      typeof row.source_evidence !== "object" ||
      Array.isArray(row.source_evidence) ||
      !Array.isArray(row.missing_fields) ||
      !Array.isArray(row.approve_blockers) ||
      (row.existing_product_match !== null &&
        (typeof row.existing_product_match !== "object" ||
          Array.isArray(row.existing_product_match)))
    ) {
      throw new IntakeFileError(
        "review_evidence_row_invalid",
        `evidence.jsonl line ${index + 1} contains invalid nested shapes.`,
      );
    }

    const { evidence_integrity_hash: existingHash, ...withoutHash } = row;
    const calculatedHash = buildEvidenceIntegrityHash(withoutHash);
    if (!hashesEqual(String(existingHash), calculatedHash)) {
      throw new IntakeFileError(
        "review_evidence_integrity_mismatch",
        `evidence.jsonl line ${index + 1} failed its integrity check.`,
      );
    }

    return row as unknown as EvidenceRow;
  });
}

export async function loadParsedReviewedBatch(
  reviewedFilePath: string,
): Promise<ParsedReviewedBatch> {
  const reviewedAbsolute = path.resolve(reviewedFilePath);
  const directory = path.dirname(reviewedAbsolute);
  const directoryStat = await fs.lstat(directory).catch(() => null);

  if (!directoryStat?.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new IntakeFileError("review_batch_directory_unsafe", "Batch directory is unsafe.");
  }

  const batchText = await readUtf8File(
    path.join(directory, "batch.json"),
    MAX_BATCH_FILE_BYTES,
    "review_batch_unreadable",
  );
  const batch = validateBatchMetadata(parseJsonStrict(batchText, "review_batch_invalid"));
  const [manifestText, evidenceText, reviewedText] = await Promise.all([
    readUtf8File(
      path.join(directory, batch.manifest_file),
      MAX_MANIFEST_FILE_BYTES,
      "review_manifest_unreadable",
    ),
    readUtf8File(
      path.join(directory, batch.evidence_file),
      MAX_EVIDENCE_FILE_BYTES,
      "review_evidence_unreadable",
    ),
    readUtf8File(
      reviewedAbsolute,
      MAX_REVIEWED_FILE_BYTES,
      "reviewed_csv_unreadable",
    ),
  ]);

  if (!hashesEqual(batch.manifest_sha256, sha256Utf8(manifestText))) {
    throw new IntakeFileError(
      "review_manifest_hash_mismatch",
      "manifest.csv does not match batch.json.",
    );
  }
  if (!hashesEqual(batch.evidence_sha256, sha256Utf8(evidenceText))) {
    throw new IntakeFileError(
      "review_evidence_hash_mismatch",
      "evidence.jsonl does not match batch.json.",
    );
  }

  let manifestRows: ManifestRow[];
  let reviewedRows: ReviewedCsvRow[];
  try {
    manifestRows = parseManifestCsv(manifestText);
    reviewedRows = parseReviewedCsv(reviewedText, REVIEWED_HEADERS);
  } catch (error) {
    if (error instanceof CsvContractError) {
      throw new IntakeFileError(error.code, error.message, error.field);
    }
    throw error;
  }

  const evidenceRows = parseEvidenceJsonl(evidenceText);
  if (
    manifestRows.length !== batch.candidate_count ||
    evidenceRows.length !== batch.candidate_count ||
    reviewedRows.length !== batch.candidate_count
  ) {
    throw new IntakeFileError(
      "review_batch_row_count_mismatch",
      "Batch file row counts do not match batch.json.",
    );
  }

  const manifestIds = manifestRows.map((row) => row.candidate_id);
  if (
    new Set(manifestIds).size !== manifestIds.length ||
    !hashesEqual(batch.candidate_ids_sha256, buildCandidateIdsHash(manifestIds))
  ) {
    throw new IntakeFileError(
      "review_batch_candidate_ids_mismatch",
      "Manifest candidate IDs do not match batch.json.",
    );
  }

  const evidenceById = new Map<string, EvidenceRow>();
  for (const evidence of evidenceRows) {
    if (evidenceById.has(evidence.candidate_id)) {
      throw new IntakeFileError(
        "review_evidence_duplicate_candidate",
        "evidence.jsonl contains duplicate candidate IDs.",
      );
    }
    evidenceById.set(evidence.candidate_id, evidence);
  }

  const reviewedIds = new Set<string>();
  for (const [index, manifest] of manifestRows.entries()) {
    if (
      manifest.schema_version !== MANIFEST_SCHEMA_VERSION ||
      manifest.export_batch_id !== batch.export_batch_id ||
      !isUuid(manifest.candidate_id) ||
      manifest.review_status !== batch.source_status ||
      !isSha256(manifest.evidence_version) ||
      !isSha256(manifest.row_integrity_hash)
    ) {
      throw new IntakeFileError(
        "review_manifest_row_invalid",
        `manifest.csv row ${index + 2} does not match the batch contract.`,
      );
    }

    const evidence = evidenceById.get(manifest.candidate_id);
    if (
      !evidence ||
      evidence.export_batch_id !== batch.export_batch_id ||
      evidence.evidence_version !== manifest.evidence_version ||
      manifest.evidence_jsonl_ref !== `evidence.jsonl#${manifest.candidate_id}`
    ) {
      throw new IntakeFileError(
        "review_evidence_reference_mismatch",
        `manifest.csv row ${index + 2} references inconsistent evidence.`,
      );
    }

    const candidateSnapshot = evidence.candidate_snapshot;
    const reviewQueueSnapshot = evidence.review_queue_snapshot;
    const existingMatch = evidence.existing_product_match;
    if (
      candidateSnapshot.id !== manifest.candidate_id ||
      reviewQueueSnapshot.candidate_id !== manifest.candidate_id
    ) {
      throw new IntakeFileError(
        "review_evidence_reference_mismatch",
        `evidence.jsonl candidate snapshot does not match manifest row ${index + 2}.`,
      );
    }
    const calculatedRowHash = buildRowIntegrityHash({
      schema_version: manifest.schema_version,
      export_batch_id: manifest.export_batch_id,
      candidate_id: manifest.candidate_id,
      candidate_updated_at: manifest.candidate_updated_at,
      review_queue_updated_at: manifest.review_queue_updated_at,
      evidence_version: manifest.evidence_version,
      source_external_id:
        typeof candidateSnapshot.external_id === "string"
          ? candidateSnapshot.external_id
          : null,
      source_product_url:
        typeof candidateSnapshot.source_url === "string" ? candidateSnapshot.source_url : null,
      normalized_brand: String(candidateSnapshot.normalized_brand ?? ""),
      normalized_name: String(candidateSnapshot.normalized_name ?? ""),
      existing_product_match_id: existingMatch?.id ?? null,
      evidence_integrity_hash: evidence.evidence_integrity_hash,
    });

    if (!hashesEqual(manifest.row_integrity_hash, calculatedRowHash)) {
      throw new IntakeFileError(
        "review_manifest_row_integrity_mismatch",
        `manifest.csv row ${index + 2} failed its row integrity check.`,
      );
    }
  }

  const calculatedSourceSnapshotVersion = sha256Utf8(
    canonicalJson(
      [...manifestRows]
        .sort((left, right) => left.candidate_id.localeCompare(right.candidate_id))
        .map((manifest) => ({
          candidate_id: manifest.candidate_id,
          candidate_updated_at: manifest.candidate_updated_at,
          review_queue_updated_at: manifest.review_queue_updated_at,
          evidence_version: manifest.evidence_version,
        })),
    ),
  );
  if (!hashesEqual(batch.source_snapshot_version, calculatedSourceSnapshotVersion)) {
    throw new IntakeFileError(
      "review_batch_source_snapshot_mismatch",
      "Batch source snapshot does not match the manifest.",
    );
  }

  for (const [index, reviewed] of reviewedRows.entries()) {
    if (
      reviewed.schema_version !== REVIEWED_SCHEMA_VERSION ||
      reviewed.export_batch_id !== batch.export_batch_id ||
      !isUuid(reviewed.candidate_id)
    ) {
      throw new IntakeFileError(
        "reviewed_row_contract_invalid",
        `Reviewed CSV row ${index + 2} has invalid protected identifiers.`,
      );
    }

    if (reviewedIds.has(reviewed.candidate_id)) {
      throw new IntakeFileError(
        "reviewed_duplicate_candidate_id",
        `Reviewed CSV row ${index + 2} repeats a candidate ID.`,
      );
    }
    reviewedIds.add(reviewed.candidate_id);
  }

  if (
    reviewedIds.size !== manifestIds.length ||
    manifestIds.some((candidateId) => !reviewedIds.has(candidateId))
  ) {
    throw new IntakeFileError(
      "reviewed_candidate_set_mismatch",
      "Reviewed CSV candidate IDs do not match the exported manifest.",
    );
  }

  return {
    directory,
    batch,
    manifestRows,
    evidenceRows,
    reviewedRows,
  };
}
