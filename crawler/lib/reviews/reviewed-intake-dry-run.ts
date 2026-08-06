import {
  type EvidenceRow,
  type IntakeDatabaseSnapshot,
  type IntakeDryRunResult,
  type IntakeRowError,
  type IntakeRowResult,
  type IntakeSummary,
  type ManifestRow,
} from "./review-export-contract.js";
import {
  buildEvidenceVersion,
  canonicalJson,
  normalizeUtcTimestamp,
  sha256Utf8,
} from "./review-batch-integrity.js";
import {
  type IntakeSnapshotLoadRequest,
} from "./review-export-query.js";
import {
  validateReviewedRow,
  type ParsedReviewedInput,
} from "./reviewed-intake-contract.js";
import type { ParsedReviewedBatch } from "./reviewed-intake-parser.js";

export type IntakeSnapshotLoader = (
  request: IntakeSnapshotLoadRequest,
) => Promise<IntakeDatabaseSnapshot>;

interface WorkingRow {
  result: IntakeRowResult;
  input: ParsedReviewedInput;
  manifest: ManifestRow;
  evidence: EvidenceRow;
}

function addError(
  row: WorkingRow,
  code: string,
  field: string | null,
  message: string,
): void {
  row.result.errors.push({
    row_number: row.result.row_number,
    candidate_id: row.result.candidate_id,
    error_code: code,
    field,
    message,
  });
}

function tryNormalizedTimestamp(value: string): string | null {
  try {
    return normalizeUtcTimestamp(value);
  } catch {
    return null;
  }
}

function getEvidenceCandidateSnapshot(evidence: EvidenceRow): Record<string, unknown> {
  return evidence.candidate_snapshot;
}

function findProductByIdentity(
  snapshot: IntakeDatabaseSnapshot,
  normalizedBrand: string,
  normalizedName: string,
) {
  return [...snapshot.products.values()].find(
    (product) =>
      product.normalized_brand === normalizedBrand &&
      product.normalized_name === normalizedName,
  );
}

function validateDatabaseSnapshot(
  row: WorkingRow,
  snapshot: IntakeDatabaseSnapshot,
): void {
  const candidateId = row.result.candidate_id;
  if (!candidateId) return;

  const candidate = snapshot.candidates.get(candidateId);
  const review = snapshot.reviews.get(candidateId);
  const evidenceCandidate = getEvidenceCandidateSnapshot(row.evidence);

  if (!candidate) {
    addError(
      row,
      "reviewed_row_candidate_not_found",
      "candidate_id",
      "Candidate no longer exists.",
    );
  } else {
    if (
      tryNormalizedTimestamp(candidate.updated_at) !==
      row.manifest.candidate_updated_at
    ) {
      addError(
        row,
        "reviewed_row_stale_candidate",
        "candidate_updated_at_expected",
        "Candidate changed after export.",
      );
    }

    if (
      candidate.normalized_brand !== String(evidenceCandidate.normalized_brand ?? "") ||
      candidate.normalized_name !== String(evidenceCandidate.normalized_name ?? "") ||
      candidate.source_name !== String(evidenceCandidate.source_name ?? "") ||
      candidate.external_type !==
        (typeof evidenceCandidate.external_type === "string"
          ? evidenceCandidate.external_type
          : null) ||
      candidate.external_id !==
        (typeof evidenceCandidate.external_id === "string"
          ? evidenceCandidate.external_id
          : null) ||
      candidate.source_url !==
        (typeof evidenceCandidate.source_url === "string"
          ? evidenceCandidate.source_url
          : null) ||
      candidate.category_path !==
        (typeof evidenceCandidate.category_path === "string"
          ? evidenceCandidate.category_path
          : null) ||
      candidate.product_name_raw !== String(evidenceCandidate.product_name_raw ?? "") ||
      candidate.brand_name_raw !== String(evidenceCandidate.brand_name_raw ?? "")
      ||
      candidate.canonical_name !==
        (typeof evidenceCandidate.canonical_name === "string"
          ? evidenceCandidate.canonical_name
          : null) ||
      candidate.canonical_brand !==
        (typeof evidenceCandidate.canonical_brand === "string"
          ? evidenceCandidate.canonical_brand
          : null) ||
      candidate.service_category !==
        (typeof evidenceCandidate.service_category === "string"
          ? evidenceCandidate.service_category
          : null) ||
      candidate.product_form !==
        (typeof evidenceCandidate.product_form === "string"
          ? evidenceCandidate.product_form
          : null) ||
      canonicalJson(candidate.review_flags) !==
        canonicalJson(evidenceCandidate.review_flags ?? []) ||
      candidate.matched_product_id !==
        (typeof evidenceCandidate.matched_product_id === "string"
          ? evidenceCandidate.matched_product_id
          : null) ||
      candidate.duplicate_of_product_id !==
        (typeof evidenceCandidate.duplicate_of_product_id === "string"
          ? evidenceCandidate.duplicate_of_product_id
          : null) ||
      candidate.promotion_version !==
        (typeof evidenceCandidate.promotion_version === "string"
          ? evidenceCandidate.promotion_version
          : null) ||
      sha256Utf8(canonicalJson(candidate.promotion_payload ?? null)) !==
        String(evidenceCandidate.promotion_payload_sha256 ?? "")
    ) {
      addError(
        row,
        "reviewed_row_stale_candidate",
        "candidate_id",
        "Candidate identity changed after export.",
      );
    }

    if (["approved", "promoted", "rejected"].includes(candidate.review_status)) {
      addError(
        row,
        "reviewed_row_already_processed",
        "candidate_id",
        "Candidate is already approved, promoted, or rejected.",
      );
    }
  }

  if (!review) {
    addError(
      row,
      "reviewed_row_review_queue_not_found",
      "candidate_id",
      "Review queue row no longer exists.",
    );
  } else {
    if (
      tryNormalizedTimestamp(review.updated_at) !==
        row.manifest.review_queue_updated_at ||
      review.status !== row.manifest.review_status
    ) {
      addError(
        row,
        "reviewed_row_stale_review_queue",
        "review_queue_updated_at_expected",
        "Review queue changed after export.",
      );
    }

    const currentEvidenceVersion = buildEvidenceVersion(
      review.rule_version,
      review.evidence_snapshot,
    );
    if (currentEvidenceVersion !== row.manifest.evidence_version) {
      addError(
        row,
        "reviewed_row_stale_evidence",
        "evidence_version_expected",
        "Ranking evidence changed after export.",
      );
    }

    if (["approved", "rejected"].includes(review.status)) {
      addError(
        row,
        "reviewed_row_already_processed",
        "candidate_id",
        "Review queue row is already final.",
      );
    }
  }
}

function validateIdentity(
  row: WorkingRow,
  snapshot: IntakeDatabaseSnapshot,
): void {
  const exportedMatchId = row.manifest.existing_product_match_id || null;
  const reviewedMatchId = row.input.existingProductMatchIdReviewed;

  if (exportedMatchId !== reviewedMatchId) {
    addError(
      row,
      "reviewed_existing_product_match_conflict",
      "existing_product_match_id_reviewed",
      "Reviewed product match differs from the exported match.",
    );
  }

  if (!reviewedMatchId) {
    if (
      row.input.decision === "approve" &&
      row.input.normalizedBrand &&
      row.input.normalizedName
    ) {
      const implicitMatch = findProductByIdentity(
        snapshot,
        row.input.normalizedBrand,
        row.input.normalizedName,
      );
      if (implicitMatch) {
        addError(
          row,
          "reviewed_existing_product_match_required",
          "existing_product_match_id_reviewed",
          "Canonical identity already matches an existing product.",
        );
      }
    }
    return;
  }

  const product = snapshot.products.get(reviewedMatchId);
  if (!product) {
    addError(
      row,
      "reviewed_existing_product_not_found",
      "existing_product_match_id_reviewed",
      "Referenced existing product does not exist.",
    );
    return;
  }

  if (
    row.input.decision === "approve" &&
    (product.normalized_brand !== row.input.normalizedBrand ||
      product.normalized_name !== row.input.normalizedName)
  ) {
    addError(
      row,
      "reviewed_existing_product_identity_conflict",
      "existing_product_match_id_reviewed",
      "Existing product identity does not match reviewed canonical identity.",
    );
  }
}

function addBatchIdentityConflicts(rows: WorkingRow[]): void {
  const externalIdentityGroups = new Map<string, WorkingRow[]>();
  const createIdentityGroups = new Map<string, WorkingRow[]>();

  for (const row of rows) {
    const evidenceCandidate = getEvidenceCandidateSnapshot(row.evidence);
    const externalKey = [
      evidenceCandidate.source_name,
      evidenceCandidate.external_type,
      evidenceCandidate.external_id,
    ].join("::");
    const externalGroup = externalIdentityGroups.get(externalKey) ?? [];
    externalGroup.push(row);
    externalIdentityGroups.set(externalKey, externalGroup);

    if (
      row.input.decision === "approve" &&
      !row.input.existingProductMatchIdReviewed &&
      row.input.normalizedBrand &&
      row.input.normalizedName
    ) {
      const identityKey = `${row.input.normalizedBrand}::${row.input.normalizedName}`;
      const identityGroup = createIdentityGroups.get(identityKey) ?? [];
      identityGroup.push(row);
      createIdentityGroups.set(identityKey, identityGroup);
    }
  }

  for (const group of externalIdentityGroups.values()) {
    if (group.length <= 1) continue;
    for (const row of group) {
      addError(
        row,
        "reviewed_batch_external_identity_conflict",
        "candidate_id",
        "Batch contains duplicate source external identity.",
      );
    }
  }

  for (const group of createIdentityGroups.values()) {
    if (group.length <= 1) continue;
    for (const row of group) {
      addError(
        row,
        "reviewed_batch_duplicate_product_create",
        "canonical_name",
        "Multiple rows would create the same normalized product identity.",
      );
    }
  }
}

function finalizeRow(row: WorkingRow): void {
  row.result.valid = row.result.errors.length === 0;

  if (!row.result.valid) {
    row.result.planned_action = "invalid";
  } else if (row.input.decision === "approve") {
    row.result.planned_action = row.input.existingProductMatchIdReviewed
      ? "merge_existing"
      : "create_new";
  } else if (row.input.decision === "defer") {
    row.result.planned_action = "deferred";
  } else if (row.input.decision === "block") {
    row.result.planned_action = "blocked";
  }
}

function uniqueRowCount(errors: IntakeRowError[], predicate: (code: string) => boolean): number {
  return new Set(
    errors
      .filter((error) => predicate(error.error_code))
      .map((error) => error.row_number),
  ).size;
}

function buildSummary(batchId: string, rows: WorkingRow[]): IntakeSummary {
  const errors = rows.flatMap((row) => row.result.errors);
  const validRows = rows.filter((row) => row.result.valid);
  const staleRows = uniqueRowCount(errors, (code) => code.startsWith("reviewed_row_stale_"));
  const identityConflicts = uniqueRowCount(
    errors,
    (code) =>
      code.includes("identity_conflict") ||
      code.includes("product_match_conflict") ||
      code === "reviewed_existing_product_match_required",
  );
  const duplicateRows = uniqueRowCount(
    errors,
    (code) => code.includes("duplicate_product_create") || code.includes("duplicate_candidate"),
  );
  const schemaErrors = new Set(
    errors
      .filter(
        (error) =>
          !error.error_code.startsWith("reviewed_row_stale_") &&
          !error.error_code.includes("identity_conflict") &&
          !error.error_code.includes("product_match_conflict") &&
          error.error_code !== "reviewed_existing_product_match_required" &&
          !error.error_code.includes("duplicate_product_create"),
      )
      .map((error) => error.row_number),
  ).size;

  return {
    export_batch: batchId,
    total_rows: rows.length,
    valid_rows: validRows.length,
    approve_create_new: validRows.filter(
      (row) => row.result.planned_action === "create_new",
    ).length,
    approve_merge_existing: validRows.filter(
      (row) => row.result.planned_action === "merge_existing",
    ).length,
    defer: validRows.filter((row) => row.result.planned_action === "deferred").length,
    block: validRows.filter((row) => row.result.planned_action === "blocked").length,
    schema_errors: schemaErrors,
    stale_rows: staleRows,
    identity_conflicts: identityConflicts,
    duplicate_rows: duplicateRows,
    products_writes: 0,
    database_writes: 0,
    status: errors.length === 0 ? "PASS" : "FAIL",
  };
}

export async function runReviewedIntakeDryRun(
  parsed: ParsedReviewedBatch,
  snapshotLoader: IntakeSnapshotLoader,
): Promise<IntakeDryRunResult> {
  const manifestById = new Map(
    parsed.manifestRows.map((row) => [row.candidate_id, row]),
  );
  const evidenceById = new Map(
    parsed.evidenceRows.map((row) => [row.candidate_id, row]),
  );
  const workingRows: WorkingRow[] = parsed.reviewedRows.map((reviewed, index) => {
    const manifest = manifestById.get(reviewed.candidate_id);
    const evidence = evidenceById.get(reviewed.candidate_id);

    if (!manifest || !evidence) {
      throw new Error("reviewed_candidate_set_mismatch");
    }

    const rowNumber = index + 2;
    const validation = validateReviewedRow(reviewed, manifest, evidence, rowNumber);
    return {
      input: validation.input,
      manifest,
      evidence,
      result: {
        row_number: rowNumber,
        candidate_id: reviewed.candidate_id,
        decision: validation.input.decision,
        planned_action: "invalid",
        valid: false,
        errors: validation.errors,
      },
    };
  });

  for (const row of workingRows) {
    if (
      row.input.reviewedAt &&
      new Date(row.input.reviewedAt).getTime() <
        new Date(parsed.batch.exported_at).getTime()
    ) {
      addError(
        row,
        "reviewed_at_before_export",
        "reviewed_at",
        "reviewed_at cannot precede the export timestamp.",
      );
    }
  }

  const request: IntakeSnapshotLoadRequest = {
    candidateIds: workingRows
      .map((row) => row.result.candidate_id)
      .filter((value): value is string => Boolean(value)),
    productIds: workingRows.flatMap((row) => {
      const exportedId = row.manifest.existing_product_match_id;
      const reviewedId = row.input.existingProductMatchIdReviewed;
      return [exportedId, reviewedId].filter((value): value is string => Boolean(value));
    }),
    normalizedIdentities: workingRows
      .filter(
        (row) =>
          row.input.decision === "approve" &&
          row.input.normalizedBrand &&
          row.input.normalizedName,
      )
      .map((row) => ({
        normalizedBrand: row.input.normalizedBrand as string,
        normalizedName: row.input.normalizedName as string,
      })),
  };
  const snapshot = await snapshotLoader(request);

  for (const row of workingRows) {
    validateDatabaseSnapshot(row, snapshot);
    validateIdentity(row, snapshot);
  }

  addBatchIdentityConflicts(workingRows);
  workingRows.forEach(finalizeRow);
  const summary = buildSummary(parsed.batch.export_batch_id, workingRows);
  const rowResults = workingRows.map((row) => row.result);

  return {
    summary,
    rows: rowResults,
    errors: rowResults.flatMap((row) => row.errors),
  };
}

export function formatDryRunResult(result: IntakeDryRunResult): string {
  const lines = [
    `Export batch: ${result.summary.export_batch}`,
    `Total rows: ${result.summary.total_rows}`,
    `Valid rows: ${result.summary.valid_rows}`,
    "Approve:",
    `  Create new: ${result.summary.approve_create_new}`,
    `  Merge existing: ${result.summary.approve_merge_existing}`,
    `Defer: ${result.summary.defer}`,
    `Block: ${result.summary.block}`,
    `Schema errors: ${result.summary.schema_errors}`,
    `Stale rows: ${result.summary.stale_rows}`,
    `Identity conflicts: ${result.summary.identity_conflicts}`,
    `Duplicate rows: ${result.summary.duplicate_rows}`,
    "Products writes: 0",
    "Database writes: 0",
    `Status: ${result.summary.status}`,
  ];

  if (result.errors.length > 0) {
    lines.push("", "Row errors:");
    for (const error of result.errors) {
      lines.push(
        [
          `row_number=${error.row_number}`,
          `candidate_id=${error.candidate_id ?? ""}`,
          `error_code=${error.error_code}`,
          `field=${error.field ?? ""}`,
          `message=${error.message}`,
        ].join(" "),
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
