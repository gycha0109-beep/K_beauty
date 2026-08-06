import {
  EVIDENCE_SCHEMA_VERSION,
  EXPORTED_BY_TOOL,
  EXPORT_BATCH_SCHEMA_VERSION,
  MANIFEST_HEADERS,
  MANIFEST_SCHEMA_VERSION,
  MAX_EVIDENCE_FILE_BYTES,
  MAX_EVIDENCE_LINE_BYTES,
  MAX_MANIFEST_FILE_BYTES,
  MAX_REVIEWED_FILE_BYTES,
  REVIEWED_HEADERS,
  REVIEWED_SCHEMA_VERSION,
  type BatchMetadata,
  type EvidenceRow,
  type ExportBatchFiles,
  type ExportStatus,
  type ManifestRow,
  type ReviewExportSourceRecord,
  type ReviewedCsvRow,
} from "./review-export-contract.js";
import {
  assertSafeSourceUrl,
  buildCandidateIdsHash,
  buildEvidenceIntegrityHash,
  buildEvidenceVersion,
  buildRowIntegrityHash,
  canonicalJson,
  normalizeUtcTimestamp,
  sanitizeCsvFormula,
  sha256Utf8,
} from "./review-batch-integrity.js";
import { serializeCsv } from "./review-csv.js";

interface RankingSummary {
  latestConcernRank: number | null;
  bestConcernRank: number | null;
  concernObservedDates: string[];
  distinctConcernCount: number;
  latestPopularityRank: number | null;
  popularityObservedDates: string[];
  sourceCategoryKey: string | null;
  sourceProductForm: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function toFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeObservedDate(value: unknown): string | null {
  const text = toNullableString(value);

  if (!text) {
    return null;
  }

  try {
    return normalizeUtcTimestamp(text);
  } catch {
    return null;
  }
}

function uniqueSorted(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function summarizeRankingEvidence(value: unknown): RankingSummary {
  const evidence = isRecord(value) ? value : {};
  const concerns = toRecordArray(evidence.concerns);
  const concernObservations = concerns.flatMap((concern) =>
    toRecordArray(concern.observations),
  );
  const popularity = isRecord(evidence.popularity) ? evidence.popularity : {};
  const popularityObservations = toRecordArray(popularity.observations);
  const latestConcernRanks = concerns
    .map((concern) => toFiniteNumber(concern.latest_rank))
    .filter((rank): rank is number => rank !== null);
  const bestConcernRanks = concerns
    .map((concern) => toFiniteNumber(concern.best_rank))
    .filter((rank): rank is number => rank !== null);
  const latestObservation =
    [...concernObservations, ...popularityObservations]
      .sort((left, right) =>
        String(right.collected_at ?? "").localeCompare(String(left.collected_at ?? "")),
      )[0] ?? null;

  return {
    latestConcernRank:
      latestConcernRanks.length > 0 ? Math.min(...latestConcernRanks) : null,
    bestConcernRank: bestConcernRanks.length > 0 ? Math.min(...bestConcernRanks) : null,
    concernObservedDates: uniqueSorted(
      concernObservations.map((observation) =>
        normalizeObservedDate(observation.collected_at),
      ),
    ),
    distinctConcernCount: concerns.length,
    latestPopularityRank: toFiniteNumber(popularity.latest_rank),
    popularityObservedDates: uniqueSorted(
      popularityObservations.map((observation) =>
        normalizeObservedDate(observation.collected_at),
      ),
    ),
    sourceCategoryKey: toNullableString(latestObservation?.source_category_key),
    sourceProductForm: toNullableString(latestObservation?.source_product_form),
  };
}

function sanitizeObservation(value: Record<string, unknown>): Record<string, unknown> {
  return {
    rank: toFiniteNumber(value.rank),
    collected_at: normalizeObservedDate(value.collected_at),
    job_id: toNullableString(value.job_id),
    service_category: toNullableString(value.service_category),
    source_category_key: toNullableString(value.source_category_key),
    source_product_form: toNullableString(value.source_product_form),
    requested_limit: toFiniteNumber(value.requested_limit),
  };
}

function sanitizeRankingEvidence(value: unknown): Record<string, unknown> {
  const evidence = isRecord(value) ? value : {};
  const candidate = isRecord(evidence.candidate) ? evidence.candidate : {};
  const concerns = toRecordArray(evidence.concerns)
    .slice(0, 20)
    .map((concern) => ({
      concern: toNullableString(concern.concern),
      observation_count: toFiniteNumber(concern.observation_count),
      best_rank: toFiniteNumber(concern.best_rank),
      latest_rank: toFiniteNumber(concern.latest_rank),
      latest_collected_at: normalizeObservedDate(concern.latest_collected_at),
      observations: toRecordArray(concern.observations)
        .slice(0, 50)
        .map(sanitizeObservation),
    }));
  const popularity = isRecord(evidence.popularity) ? evidence.popularity : {};

  return {
    candidate: {
      id: toNullableString(candidate.id),
      source_name: toNullableString(candidate.source_name),
      external_type: toNullableString(candidate.external_type),
      external_id: toNullableString(candidate.external_id),
    },
    concerns,
    popularity: {
      observation_count: toFiniteNumber(popularity.observation_count),
      best_rank: toFiniteNumber(popularity.best_rank),
      latest_rank: toFiniteNumber(popularity.latest_rank),
      latest_collected_at: normalizeObservedDate(popularity.latest_collected_at),
      observations: toRecordArray(popularity.observations)
        .slice(0, 100)
        .map(sanitizeObservation),
    },
  };
}

function safeOptionalUrl(value: unknown): string | null {
  const url = toNullableString(value);
  if (!url) return null;

  try {
    return assertSafeSourceUrl(url);
  } catch {
    return null;
  }
}

function sanitizePromotionPayload(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const product = isRecord(value.product) ? value.product : {};
  const evidence = isRecord(value.evidence) ? value.evidence : {};
  return {
    metadata: {
      version: toNullableString(metadata.version),
      service_category: toNullableString(metadata.service_category),
      product_form: toNullableString(metadata.product_form),
      source_service_category: toNullableString(metadata.source_service_category),
      source_category_key: toNullableString(metadata.source_category_key),
      source_product_form: toNullableString(metadata.source_product_form),
      source_context_status: toNullableString(metadata.source_context_status),
      source_context_conflict:
        typeof metadata.source_context_conflict === "boolean"
          ? metadata.source_context_conflict
          : null,
      match_method: toNullableString(metadata.match_method),
      match_confidence: toFiniteNumber(metadata.match_confidence),
      review_flags: Array.isArray(metadata.review_flags)
        ? metadata.review_flags.filter((item): item is string => typeof item === "string").slice(0, 30)
        : [],
    },
    product: {
      skin_types: Array.isArray(product.skin_types)
        ? product.skin_types.filter((item): item is string => typeof item === "string").slice(0, 10)
        : [],
      concerns: Array.isArray(product.concerns)
        ? product.concerns.filter((item): item is string => typeof item === "string").slice(0, 20)
        : [],
      texture: toNullableString(product.texture),
      finish: toNullableString(product.finish),
      irritation_risk: toNullableString(product.irritation_risk),
      sensitivity_safe:
        typeof product.sensitivity_safe === "boolean" ? product.sensitivity_safe : null,
      price_min: toFiniteNumber(product.price_min),
      price_max: toFiniteNumber(product.price_max),
      buy_link: safeOptionalUrl(product.buy_link),
      image_url: safeOptionalUrl(product.image_url),
    },
    evidence: {
      source_name: toNullableString(evidence.source_name),
      category_path: toNullableString(evidence.category_path),
      raw_product_name: toNullableString(evidence.raw_product_name)?.slice(0, 500) ?? null,
      raw_brand_name: toNullableString(evidence.raw_brand_name)?.slice(0, 300) ?? null,
    },
  };
}

function collectMissingFields(record: ReviewExportSourceRecord): string[] {
  const candidate = record.candidate;
  const payload = isRecord(candidate.promotion_payload)
    ? candidate.promotion_payload
    : {};
  const product = isRecord(payload.product) ? payload.product : {};
  const missing: string[] = [];

  if (!candidate.canonical_brand?.trim()) missing.push("canonical_brand");
  if (!candidate.canonical_name?.trim()) missing.push("canonical_name");
  if (!candidate.service_category) missing.push("service_category");
  if (candidate.service_category === "treatment" && !candidate.product_form) {
    missing.push("product_form");
  }
  if (!Array.isArray(product.skin_types) || product.skin_types.length === 0) {
    missing.push("skin_types");
  }
  if (!Array.isArray(product.concerns) || product.concerns.length === 0) {
    missing.push("concerns");
  }
  if (!toNullableString(product.texture)) missing.push("texture");
  if (!toNullableString(product.finish)) missing.push("finish");
  if (!toNullableString(product.irritation_risk)) missing.push("irritation_risk");
  if (typeof product.sensitivity_safe !== "boolean") missing.push("sensitivity_safe");

  return missing.sort();
}

function display(value: string | null | undefined): string {
  return sanitizeCsvFormula(
    (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " "),
  );
}

function scalar(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function createReviewedTemplateRow(manifest: ManifestRow): ReviewedCsvRow {
  const row = Object.create(null) as ReviewedCsvRow;

  for (const header of REVIEWED_HEADERS) {
    row[header] = "";
  }

  row.schema_version = REVIEWED_SCHEMA_VERSION;
  row.export_batch_id = manifest.export_batch_id;
  row.candidate_id = manifest.candidate_id;
  row.candidate_updated_at_expected = manifest.candidate_updated_at;
  row.review_queue_updated_at_expected = manifest.review_queue_updated_at;
  row.evidence_version_expected = manifest.evidence_version;
  row.row_integrity_hash = manifest.row_integrity_hash;
  row.evidence_jsonl_ref = manifest.evidence_jsonl_ref;
  return row;
}

function createBatchJson(batch: BatchMetadata): string {
  return `${JSON.stringify(batch, null, 2)}\n`;
}

export function buildReviewExportBatch(
  records: ReviewExportSourceRecord[],
  options: {
    exportBatchId: string;
    exportedAt: string;
    sourceStatus: ExportStatus;
  },
): ExportBatchFiles {
  const exportedAt = normalizeUtcTimestamp(options.exportedAt);
  const sortedRecords = [...records].sort((left, right) =>
    left.candidate.id.localeCompare(right.candidate.id),
  );
  const manifestRows: ManifestRow[] = [];
  const evidenceRows: EvidenceRow[] = [];

  for (const record of sortedRecords) {
    if (record.review.candidate_id !== record.candidate.id) {
      throw new Error("review_export_candidate_reference_mismatch");
    }

    if (record.review.status !== options.sourceStatus) {
      throw new Error("review_export_status_mismatch");
    }

    const rankingEvidence = sanitizeRankingEvidence(
      record.rankingEvidence ?? record.review.evidence_snapshot,
    );
    const summary = summarizeRankingEvidence(rankingEvidence);
    const evidenceVersion = buildEvidenceVersion(
      record.review.rule_version,
      record.review.evidence_snapshot,
    );
    const sourceUrl = record.candidate.source_url
      ? assertSafeSourceUrl(record.candidate.source_url)
      : null;
    const missingFields = collectMissingFields(record);
    const evidenceWithoutHash: Omit<EvidenceRow, "evidence_integrity_hash"> = {
      schema_version: EVIDENCE_SCHEMA_VERSION,
      export_batch_id: options.exportBatchId,
      candidate_id: record.candidate.id,
      evidence_version: evidenceVersion,
      candidate_snapshot: {
        id: record.candidate.id,
        source_name: record.candidate.source_name,
        external_type: record.candidate.external_type,
        external_id: record.candidate.external_id,
        source_url: sourceUrl,
        category_path: record.candidate.category_path,
        brand_name_raw: record.candidate.brand_name_raw,
        product_name_raw: record.candidate.product_name_raw,
        normalized_brand: record.candidate.normalized_brand,
        normalized_name: record.candidate.normalized_name,
        canonical_brand: record.candidate.canonical_brand,
        canonical_name: record.candidate.canonical_name,
        service_category: record.candidate.service_category,
        product_form: record.candidate.product_form,
        review_status: record.candidate.review_status,
        review_flags: record.candidate.review_flags ?? [],
        matched_product_id: record.candidate.matched_product_id,
        duplicate_of_product_id: record.candidate.duplicate_of_product_id,
        promotion_version: record.candidate.promotion_version,
        promotion_payload_sha256: sha256Utf8(
          canonicalJson(record.candidate.promotion_payload ?? null),
        ),
        candidate_updated_at: normalizeUtcTimestamp(record.candidate.updated_at),
      },
      review_queue_snapshot: {
        candidate_id: record.review.candidate_id,
        status: record.review.status,
        priority_score: record.review.priority_score,
        selection_reason: record.review.selection_reason.slice(0, 2000),
        rule_version: record.review.rule_version,
        first_queued_at: normalizeUtcTimestamp(record.review.first_queued_at),
        last_queued_at: normalizeUtcTimestamp(record.review.last_queued_at),
        review_queue_updated_at: normalizeUtcTimestamp(record.review.updated_at),
      },
      ranking_evidence: rankingEvidence,
      source_evidence: {
        source_name: record.candidate.source_name,
        external_type: record.candidate.external_type,
        external_id: record.candidate.external_id,
        source_url: sourceUrl,
        source_category_key: summary.sourceCategoryKey,
        source_product_form: summary.sourceProductForm,
      },
      existing_product_match: record.existingProductMatch,
      proposed_promotion_payload: sanitizePromotionPayload(
        record.candidate.promotion_payload,
      ),
      missing_fields: missingFields,
      approve_blockers: missingFields.map((field) => `missing_${field}`),
    };
    const evidenceIntegrityHash = buildEvidenceIntegrityHash(
      evidenceWithoutHash as unknown as Record<string, unknown>,
    );
    const evidenceRow: EvidenceRow = {
      ...evidenceWithoutHash,
      evidence_integrity_hash: evidenceIntegrityHash,
    };
    const evidenceRef = `evidence.jsonl#${record.candidate.id}`;
    const candidateUpdatedAt = normalizeUtcTimestamp(record.candidate.updated_at);
    const reviewUpdatedAt = normalizeUtcTimestamp(record.review.updated_at);
    const rowIntegrityHash = buildRowIntegrityHash({
      schema_version: MANIFEST_SCHEMA_VERSION,
      export_batch_id: options.exportBatchId,
      candidate_id: record.candidate.id,
      candidate_updated_at: candidateUpdatedAt,
      review_queue_updated_at: reviewUpdatedAt,
      evidence_version: evidenceVersion,
      source_external_id: record.candidate.external_id,
      source_product_url: sourceUrl,
      normalized_brand: record.candidate.normalized_brand,
      normalized_name: record.candidate.normalized_name,
      existing_product_match_id: record.existingProductMatch?.id ?? null,
      evidence_integrity_hash: evidenceIntegrityHash,
    });

    manifestRows.push({
      schema_version: MANIFEST_SCHEMA_VERSION,
      export_batch_id: options.exportBatchId,
      candidate_id: record.candidate.id,
      brand_name: display(record.candidate.brand_name_raw),
      product_name: display(record.candidate.product_name_raw),
      normalized_brand: display(record.candidate.normalized_brand),
      normalized_name: display(record.candidate.normalized_name),
      source_external_id: display(record.candidate.external_id),
      source_product_url: display(sourceUrl),
      source_category_key: display(summary.sourceCategoryKey),
      source_product_form: display(summary.sourceProductForm),
      review_status: record.review.status,
      priority_score: scalar(record.review.priority_score),
      review_queue_updated_at: reviewUpdatedAt,
      candidate_updated_at: candidateUpdatedAt,
      latest_concern_rank: scalar(summary.latestConcernRank),
      best_concern_rank: scalar(summary.bestConcernRank),
      concern_observed_dates: summary.concernObservedDates.join(";"),
      distinct_concern_count: scalar(summary.distinctConcernCount),
      latest_popularity_rank: scalar(summary.latestPopularityRank),
      popularity_observed_dates: summary.popularityObservedDates.join(";"),
      existing_product_match_id: record.existingProductMatch?.id ?? "",
      existing_product_match_confidence: scalar(
        record.existingProductMatch
          ? (record.candidate.match_confidence ?? 1)
          : null,
      ),
      existing_product_normalized_brand:
        record.existingProductMatch?.normalized_brand ?? "",
      existing_product_normalized_name:
        record.existingProductMatch?.normalized_name ?? "",
      evidence_version: evidenceVersion,
      evidence_jsonl_ref: evidenceRef,
      row_integrity_hash: rowIntegrityHash,
    });
    evidenceRows.push(evidenceRow);
  }

  const manifestCsv = serializeCsv(MANIFEST_HEADERS, manifestRows);
  const evidenceLines = evidenceRows.map((row) => canonicalJson(row));
  if (
    evidenceLines.some((line) => Buffer.byteLength(line, "utf8") > MAX_EVIDENCE_LINE_BYTES)
  ) {
    throw new Error("review_export_evidence_row_too_large");
  }
  const evidenceJsonl = `${evidenceLines.join("\n")}\n`;
  const reviewedTemplateRows = manifestRows.map(createReviewedTemplateRow);
  const reviewedTemplateCsv = serializeCsv(REVIEWED_HEADERS, reviewedTemplateRows);
  if (Buffer.byteLength(manifestCsv, "utf8") > MAX_MANIFEST_FILE_BYTES) {
    throw new Error("review_export_manifest_too_large");
  }
  if (Buffer.byteLength(evidenceJsonl, "utf8") > MAX_EVIDENCE_FILE_BYTES) {
    throw new Error("review_export_evidence_too_large");
  }
  if (Buffer.byteLength(reviewedTemplateCsv, "utf8") > MAX_REVIEWED_FILE_BYTES) {
    throw new Error("review_export_reviewed_template_too_large");
  }
  const candidateIds = sortedRecords.map((record) => record.candidate.id);
  const sourceSnapshotVersion = sha256Utf8(
    canonicalJson(
      sortedRecords.map((record, index) => ({
        candidate_id: record.candidate.id,
        candidate_updated_at: normalizeUtcTimestamp(record.candidate.updated_at),
        review_queue_updated_at: normalizeUtcTimestamp(record.review.updated_at),
        evidence_version: evidenceRows[index].evidence_version,
      })),
    ),
  );
  const batch: BatchMetadata = {
    schema_version: EXPORT_BATCH_SCHEMA_VERSION,
    export_batch_id: options.exportBatchId,
    exported_at: exportedAt,
    exported_by_tool: EXPORTED_BY_TOOL,
    source_status: options.sourceStatus,
    candidate_count: sortedRecords.length,
    manifest_file: "manifest.csv",
    evidence_file: "evidence.jsonl",
    reviewed_template_file: "reviewed-template.csv",
    manifest_sha256: sha256Utf8(manifestCsv),
    evidence_sha256: sha256Utf8(evidenceJsonl),
    candidate_ids_sha256: buildCandidateIdsHash(candidateIds),
    source_snapshot_version: sourceSnapshotVersion,
  };

  return {
    batch,
    batchJson: createBatchJson(batch),
    manifestCsv,
    evidenceJsonl,
    reviewedTemplateCsv,
    manifestRows,
    evidenceRows,
  };
}
