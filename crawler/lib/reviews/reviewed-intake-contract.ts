import { Buffer } from "node:buffer";

import {
  normalizeCanonicalBrandName,
  normalizeCanonicalProductName,
} from "../normalize.js";
import {
  MAX_JSON_CELL_BYTES,
  MAX_JSON_DEPTH,
  REVIEW_DECISIONS,
  type EvidenceRow,
  type IntakeRowError,
  type ManifestRow,
  type ReviewDecision,
  type ReviewedCsvRow,
} from "./review-export-contract.js";
import {
  assertJsonValueSafety,
  assertSafeSourceUrl,
  hashesEqual,
  isSha256,
  isUuid,
} from "./review-batch-integrity.js";

const REVIEW_CONFIDENCE = new Set(["low", "medium", "high"]);
const SERVICE_CATEGORIES = new Set([
  "cleanser",
  "toner_essence",
  "toner_pad",
  "treatment",
  "moisturizer",
  "moisturizer_lotion_emulsion",
  "moisturizer_gel",
  "moisturizer_cream",
  "moisturizer_balm",
  "sunscreen",
]);
const PRODUCT_FORMS = new Set([
  "serum",
  "ampoule",
  "essence",
  "booster",
  "peeling_solution",
]);
const SKIN_TYPES = new Set(["oily", "dry", "combination", "sensitive"]);
const CONCERNS = new Set([
  "oiliness",
  "dehydration",
  "acne",
  "uneven_tone",
  "pores",
  "redness",
  "barrier",
]);
const TEXTURES = new Set(["watery", "gel", "lotion", "cream"]);
const FINISHES = new Set(["fresh", "natural", "dewy", "soft_matte"]);
const IRRITATION_RISKS = new Set(["low", "medium", "high"]);
const OFFICIAL_PAGE_STATUSES = new Set([
  "verified",
  "missing",
  "unavailable",
  "conflict",
]);
const INGREDIENT_STATUSES = new Set([
  "verified",
  "missing",
  "unavailable",
  "conflict",
]);
const DUPLICATE_STATUSES = new Set([
  "checked_no_match",
  "checked_match",
  "unresolved",
]);
const DEFER_REASONS = new Set([
  "missing_official_source",
  "missing_ingredient_evidence",
  "identity_unresolved",
  "category_unresolved",
  "contradiction_unresolved",
  "needs_manual_research",
]);
const BLOCK_REASONS = new Set([
  "duplicate_product",
  "invalid_identity",
  "out_of_scope",
  "unsafe_source",
  "source_removed",
]);
const FIELD_CONFIDENCE_VALUES = new Set(["low", "medium", "high"]);
const REQUIRED_EVIDENCE_FIELDS = [
  "canonical_brand",
  "canonical_name",
  "canonical_category",
  "skin_types",
  "concerns",
  "texture",
  "finish",
  "irritation_risk",
  "sensitivity_safe",
];

type ServiceCategory =
  | "cleanser"
  | "toner_essence"
  | "toner_pad"
  | "treatment"
  | "moisturizer"
  | "moisturizer_lotion_emulsion"
  | "moisturizer_gel"
  | "moisturizer_cream"
  | "moisturizer_balm"
  | "sunscreen";
type ProductForm =
  | "serum"
  | "ampoule"
  | "essence"
  | "booster"
  | "peeling_solution";

function isCanonicalServiceCategory(value: string | null): value is ServiceCategory {
  return Boolean(value && SERVICE_CATEGORIES.has(value));
}

function isTreatmentProductForm(value: string | null): value is ProductForm {
  return Boolean(value && PRODUCT_FORMS.has(value));
}

export interface ParsedReviewedInput {
  decision: ReviewDecision | null;
  reviewConfidence: string | null;
  reviewedAt: string | null;
  reviewSourceUrls: string[] | null | undefined;
  canonicalBrand: string | null;
  canonicalName: string | null;
  normalizedBrand: string | null;
  normalizedName: string | null;
  canonicalCategory: ServiceCategory | null;
  productForm: ProductForm | null;
  skinTypes: string[] | null | undefined;
  concerns: string[] | null | undefined;
  texture: string | null;
  finish: string | null;
  irritationRisk: string | null;
  sensitivitySafe: boolean | null | undefined;
  officialProductPageStatus: string | null;
  ingredientListStatus: string | null;
  duplicateCheckStatus: string | null;
  existingProductMatchIdReviewed: string | null;
  fieldEvidence: Record<string, unknown> | null | undefined;
  fieldConfidence: Record<string, unknown> | null | undefined;
  contradictions: unknown[] | null | undefined;
  deferReason: string | null;
  blockReason: string | null;
  reviewNote: string | null;
}

function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function hasControlCharacters(value: string): boolean {
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}

function addError(
  errors: IntakeRowError[],
  rowNumber: number,
  candidateId: string | null,
  errorCode: string,
  field: string | null,
  message: string,
): void {
  errors.push({
    row_number: rowNumber,
    candidate_id: candidateId,
    error_code: errorCode,
    field,
    message,
  });
}

function parseJsonCell(
  raw: string,
  options: {
    rowNumber: number;
    candidateId: string | null;
    field: string;
    errors: IntakeRowError[];
  },
): unknown | undefined {
  if (raw === "") return undefined;

  if (Buffer.byteLength(raw, "utf8") > MAX_JSON_CELL_BYTES) {
    addError(
      options.errors,
      options.rowNumber,
      options.candidateId,
      "reviewed_json_cell_too_large",
      options.field,
      "JSON cell exceeds the configured size limit.",
    );
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
    assertJsonValueSafety(parsed, { maxDepth: MAX_JSON_DEPTH });
  } catch {
    addError(
      options.errors,
      options.rowNumber,
      options.candidateId,
      "reviewed_json_cell_invalid",
      options.field,
      "JSON cell is malformed or exceeds safety constraints.",
    );
    return undefined;
  }

  return parsed;
}

function parseStringArray(
  value: unknown,
  allowed: Set<string>,
  options: {
    rowNumber: number;
    candidateId: string | null;
    field: string;
    errors: IntakeRowError[];
  },
): string[] | null | undefined {
  if (value === undefined || value === null) return value;
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || !allowed.has(item)) ||
    new Set(value).size !== value.length
  ) {
    addError(
      options.errors,
      options.rowNumber,
      options.candidateId,
      "reviewed_enum_array_invalid",
      options.field,
      "Field must be a unique array of allowed string values.",
    );
    return undefined;
  }
  return value;
}

function parseSensitivitySafe(
  raw: string,
  rowNumber: number,
  candidateId: string | null,
  errors: IntakeRowError[],
): boolean | null | undefined {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (normalized === "null" || normalized === "unknown") return null;

  addError(
    errors,
    rowNumber,
    candidateId,
    "reviewed_sensitivity_safe_invalid",
    "sensitivity_safe",
    "sensitivity_safe must be true, false, null, or unknown.",
  );
  return undefined;
}

function validateFieldEvidence(
  input: ParsedReviewedInput,
  rowNumber: number,
  candidateId: string | null,
  errors: IntakeRowError[],
): void {
  if (!input.fieldEvidence || typeof input.fieldEvidence !== "object") {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_field_evidence_required",
      "field_evidence_json",
      "Approve requires field-level evidence.",
    );
    return;
  }

  const required = [...REQUIRED_EVIDENCE_FIELDS];
  if (input.canonicalCategory === "treatment") required.push("product_form");

  for (const field of required) {
    const evidence = input.fieldEvidence[field];
    if (
      !evidence ||
      typeof evidence !== "object" ||
      Array.isArray(evidence) ||
      typeof (evidence as Record<string, unknown>).source_url !== "string"
    ) {
      addError(
        errors,
        rowNumber,
        candidateId,
        "reviewed_field_evidence_missing",
        `field_evidence_json.${field}`,
        `Approve requires a source_url for ${field}.`,
      );
      continue;
    }

    try {
      const safeUrl = assertSafeSourceUrl(
        String((evidence as Record<string, unknown>).source_url),
      );
      if (!input.reviewSourceUrls?.includes(safeUrl)) {
        addError(
          errors,
          rowNumber,
          candidateId,
          "reviewed_field_evidence_source_mismatch",
          `field_evidence_json.${field}`,
          "Field evidence source must appear in review_source_urls_json.",
        );
      }
    } catch {
      addError(
        errors,
        rowNumber,
        candidateId,
        "reviewed_source_url_unsafe",
        `field_evidence_json.${field}`,
        "Field evidence contains an unsafe source URL.",
      );
    }
  }

  if (!input.fieldConfidence || typeof input.fieldConfidence !== "object") {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_field_confidence_required",
      "field_confidence_json",
      "Approve requires field-level confidence.",
    );
    return;
  }

  for (const field of required) {
    if (!FIELD_CONFIDENCE_VALUES.has(String(input.fieldConfidence[field] ?? ""))) {
      addError(
        errors,
        rowNumber,
        candidateId,
        "reviewed_field_confidence_invalid",
        `field_confidence_json.${field}`,
        `Approve requires low, medium, or high confidence for ${field}.`,
      );
    }
  }
}

function hasUnresolvedContradiction(contradictions: unknown[] | null | undefined): boolean {
  if (!contradictions) return false;

  return contradictions.some((item) => {
    if (typeof item === "string") return item.trim().length > 0;
    if (!item || typeof item !== "object" || Array.isArray(item)) return true;
    const status = String((item as Record<string, unknown>).status ?? "unresolved");
    return !["resolved", "dismissed"].includes(status);
  });
}

export function validateReviewedRow(
  reviewed: ReviewedCsvRow,
  manifest: ManifestRow,
  evidence: EvidenceRow,
  rowNumber: number,
): { input: ParsedReviewedInput; errors: IntakeRowError[] } {
  const candidateId = isUuid(reviewed.candidate_id) ? reviewed.candidate_id : null;
  const errors: IntakeRowError[] = [];

  const protectedPairs: Array<[string, string, string]> = [
    ["candidate_id", reviewed.candidate_id, manifest.candidate_id],
    ["export_batch_id", reviewed.export_batch_id, manifest.export_batch_id],
    [
      "candidate_updated_at_expected",
      reviewed.candidate_updated_at_expected,
      manifest.candidate_updated_at,
    ],
    [
      "review_queue_updated_at_expected",
      reviewed.review_queue_updated_at_expected,
      manifest.review_queue_updated_at,
    ],
    [
      "evidence_version_expected",
      reviewed.evidence_version_expected,
      manifest.evidence_version,
    ],
    ["evidence_jsonl_ref", reviewed.evidence_jsonl_ref, manifest.evidence_jsonl_ref],
  ];

  for (const [field, actual, expected] of protectedPairs) {
    if (actual !== expected) {
      addError(
        errors,
        rowNumber,
        candidateId,
        "reviewed_protected_field_mismatch",
        field,
        "Export-protected field was modified.",
      );
    }
  }

  if (
    !isSha256(reviewed.row_integrity_hash) ||
    !hashesEqual(reviewed.row_integrity_hash, manifest.row_integrity_hash)
  ) {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_row_integrity_mismatch",
      "row_integrity_hash",
      "Export row integrity hash does not match.",
    );
  }

  if (
    evidence.candidate_id !== manifest.candidate_id ||
    evidence.evidence_version !== manifest.evidence_version
  ) {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_evidence_reference_mismatch",
      "evidence_jsonl_ref",
      "Evidence sidecar does not match the reviewed row.",
    );
  }

  const decisionText = text(reviewed.review_decision)?.toLowerCase() ?? null;
  const decision = REVIEW_DECISIONS.includes(decisionText as ReviewDecision)
    ? (decisionText as ReviewDecision)
    : null;
  if (!decision) {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_decision_invalid",
      "review_decision",
      "review_decision must be approve, defer, or block.",
    );
  }

  const reviewConfidence = text(reviewed.review_confidence)?.toLowerCase() ?? null;
  if (!reviewConfidence || !REVIEW_CONFIDENCE.has(reviewConfidence)) {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_confidence_invalid",
      "review_confidence",
      "review_confidence must be low, medium, or high.",
    );
  }

  const reviewedAtRaw = text(reviewed.reviewed_at);
  let reviewedAt: string | null = null;
  if (reviewedAtRaw) {
    const parsed = new Date(reviewedAtRaw);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString() === reviewedAtRaw) {
      reviewedAt = reviewedAtRaw;
    }
  }
  if (!reviewedAt) {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_at_invalid",
      "reviewed_at",
      "reviewed_at must be a normalized UTC ISO 8601 timestamp.",
    );
  }

  const reviewSourceUrlsRaw = parseJsonCell(reviewed.review_source_urls_json, {
    rowNumber,
    candidateId,
    field: "review_source_urls_json",
    errors,
  });
  let reviewSourceUrls: string[] | null | undefined;
  if (reviewSourceUrlsRaw === undefined || reviewSourceUrlsRaw === null) {
    reviewSourceUrls = reviewSourceUrlsRaw;
  } else if (
    !Array.isArray(reviewSourceUrlsRaw) ||
    reviewSourceUrlsRaw.length > 10 ||
    reviewSourceUrlsRaw.some((url) => typeof url !== "string")
  ) {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_source_urls_invalid",
      "review_source_urls_json",
      "Review source URLs must be an array of at most 10 strings.",
    );
  } else {
    const safeUrls: string[] = [];
    for (const url of reviewSourceUrlsRaw) {
      try {
        safeUrls.push(assertSafeSourceUrl(url));
      } catch {
        addError(
          errors,
          rowNumber,
          candidateId,
          "reviewed_source_url_unsafe",
          "review_source_urls_json",
          "Review source URL must use a safe HTTPS origin.",
        );
      }
    }
    reviewSourceUrls = [...new Set(safeUrls)];
  }

  const canonicalBrand = text(reviewed.canonical_brand);
  const canonicalName = text(reviewed.canonical_name);
  const categoryText = text(reviewed.canonical_category)?.toLowerCase() ?? null;
  const canonicalCategory = isCanonicalServiceCategory(categoryText)
    ? categoryText
    : null;
  const productFormText = text(reviewed.product_form)?.toLowerCase() ?? null;
  const productForm = isTreatmentProductForm(productFormText) ? productFormText : null;
  const skinTypesRaw = parseJsonCell(reviewed.skin_types_json, {
    rowNumber,
    candidateId,
    field: "skin_types_json",
    errors,
  });
  const concernsRaw = parseJsonCell(reviewed.concerns_json, {
    rowNumber,
    candidateId,
    field: "concerns_json",
    errors,
  });
  const fieldEvidenceRaw = parseJsonCell(reviewed.field_evidence_json, {
    rowNumber,
    candidateId,
    field: "field_evidence_json",
    errors,
  });
  const fieldConfidenceRaw = parseJsonCell(reviewed.field_confidence_json, {
    rowNumber,
    candidateId,
    field: "field_confidence_json",
    errors,
  });
  const contradictionsRaw = parseJsonCell(reviewed.contradictions_json, {
    rowNumber,
    candidateId,
    field: "contradictions_json",
    errors,
  });
  const skinTypes = parseStringArray(skinTypesRaw, SKIN_TYPES, {
    rowNumber,
    candidateId,
    field: "skin_types_json",
    errors,
  });
  const concerns = parseStringArray(concernsRaw, CONCERNS, {
    rowNumber,
    candidateId,
    field: "concerns_json",
    errors,
  });
  const fieldEvidence =
    fieldEvidenceRaw === undefined ||
    fieldEvidenceRaw === null ||
    (typeof fieldEvidenceRaw === "object" && !Array.isArray(fieldEvidenceRaw))
      ? (fieldEvidenceRaw as Record<string, unknown> | null | undefined)
      : undefined;
  const fieldConfidence =
    fieldConfidenceRaw === undefined ||
    fieldConfidenceRaw === null ||
    (typeof fieldConfidenceRaw === "object" && !Array.isArray(fieldConfidenceRaw))
      ? (fieldConfidenceRaw as Record<string, unknown> | null | undefined)
      : undefined;
  const contradictions =
    contradictionsRaw === undefined ||
    contradictionsRaw === null ||
    Array.isArray(contradictionsRaw)
      ? (contradictionsRaw as unknown[] | null | undefined)
      : undefined;

  if (
    fieldEvidenceRaw !== undefined &&
    fieldEvidenceRaw !== null &&
    fieldEvidence === undefined
  ) {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_field_evidence_invalid",
      "field_evidence_json",
      "field_evidence_json must contain an object.",
    );
  }
  if (
    fieldConfidenceRaw !== undefined &&
    fieldConfidenceRaw !== null &&
    fieldConfidence === undefined
  ) {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_field_confidence_invalid",
      "field_confidence_json",
      "field_confidence_json must contain an object.",
    );
  }
  if (
    contradictionsRaw !== undefined &&
    contradictionsRaw !== null &&
    contradictions === undefined
  ) {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_contradictions_invalid",
      "contradictions_json",
      "contradictions_json must contain an array.",
    );
  }

  const existingProductMatchIdReviewed = text(
    reviewed.existing_product_match_id_reviewed,
  );
  if (existingProductMatchIdReviewed && !isUuid(existingProductMatchIdReviewed)) {
    addError(
      errors,
      rowNumber,
      candidateId,
      "reviewed_existing_product_id_invalid",
      "existing_product_match_id_reviewed",
      "Existing product match must be a UUID.",
    );
  }

  const reviewNote = text(reviewed.review_note);
  for (const [field, value, maxLength] of [
    ["canonical_brand", canonicalBrand, 200],
    ["canonical_name", canonicalName, 300],
    ["review_note", reviewNote, 2000],
  ] as const) {
    if (value && (value.length > maxLength || hasControlCharacters(value))) {
      addError(
        errors,
        rowNumber,
        candidateId,
        "reviewed_text_invalid",
        field,
        `${field} exceeds text safety limits.`,
      );
    }
  }
  for (const [field, value] of [
    ["canonical_brand", canonicalBrand],
    ["canonical_name", canonicalName],
    ["review_note", reviewNote],
  ] as const) {
    if (value && /^[=+\-@]/.test(value)) {
      addError(
        errors,
        rowNumber,
        candidateId,
        "reviewed_formula_injection",
        field,
        `${field} cannot begin with a spreadsheet formula prefix.`,
      );
    }
  }

  const input: ParsedReviewedInput = {
    decision,
    reviewConfidence,
    reviewedAt,
    reviewSourceUrls,
    canonicalBrand,
    canonicalName,
    normalizedBrand: canonicalBrand
      ? normalizeCanonicalBrandName(canonicalBrand)
      : null,
    normalizedName: canonicalName
      ? normalizeCanonicalProductName(canonicalName)
      : null,
    canonicalCategory,
    productForm,
    skinTypes,
    concerns,
    texture: text(reviewed.texture)?.toLowerCase() ?? null,
    finish: text(reviewed.finish)?.toLowerCase() ?? null,
    irritationRisk: text(reviewed.irritation_risk)?.toLowerCase() ?? null,
    sensitivitySafe: parseSensitivitySafe(
      reviewed.sensitivity_safe,
      rowNumber,
      candidateId,
      errors,
    ),
    officialProductPageStatus:
      text(reviewed.official_product_page_status)?.toLowerCase() ?? null,
    ingredientListStatus:
      text(reviewed.ingredient_list_status)?.toLowerCase() ?? null,
    duplicateCheckStatus:
      text(reviewed.duplicate_check_status)?.toLowerCase() ?? null,
    existingProductMatchIdReviewed:
      existingProductMatchIdReviewed && isUuid(existingProductMatchIdReviewed)
        ? existingProductMatchIdReviewed
        : null,
    fieldEvidence,
    fieldConfidence,
    contradictions,
    deferReason: text(reviewed.defer_reason)?.toLowerCase() ?? null,
    blockReason: text(reviewed.block_reason)?.toLowerCase() ?? null,
    reviewNote,
  };

  if (
    input.officialProductPageStatus &&
    !OFFICIAL_PAGE_STATUSES.has(input.officialProductPageStatus)
  ) {
    addError(errors, rowNumber, candidateId, "reviewed_official_status_invalid", "official_product_page_status", "Official product page status is not allowed.");
  }
  if (
    input.ingredientListStatus &&
    !INGREDIENT_STATUSES.has(input.ingredientListStatus)
  ) {
    addError(errors, rowNumber, candidateId, "reviewed_ingredient_status_invalid", "ingredient_list_status", "Ingredient list status is not allowed.");
  }
  if (
    input.duplicateCheckStatus &&
    !DUPLICATE_STATUSES.has(input.duplicateCheckStatus)
  ) {
    addError(errors, rowNumber, candidateId, "reviewed_duplicate_status_invalid", "duplicate_check_status", "Duplicate check status is not allowed.");
  }

  if (decision === "approve") {
    if (!canonicalBrand || !input.normalizedBrand) {
      addError(errors, rowNumber, candidateId, "reviewed_canonical_brand_required", "canonical_brand", "Approve requires canonical_brand.");
    }
    if (!canonicalName || !input.normalizedName) {
      addError(errors, rowNumber, candidateId, "reviewed_canonical_name_required", "canonical_name", "Approve requires canonical_name.");
    }
    if (!canonicalCategory) {
      addError(errors, rowNumber, candidateId, "reviewed_category_invalid", "canonical_category", "Approve requires an allowed service category.");
    }
    if (canonicalCategory === "treatment" && !productForm) {
      addError(errors, rowNumber, candidateId, "reviewed_product_form_required", "product_form", "Treatment approval requires product_form.");
    }
    if (canonicalCategory && canonicalCategory !== "treatment" && productFormText) {
      addError(errors, rowNumber, candidateId, "reviewed_product_form_unexpected", "product_form", "product_form is only allowed for treatment.");
    }
    if (!skinTypes || skinTypes.length === 0) {
      addError(errors, rowNumber, candidateId, "reviewed_skin_types_required", "skin_types_json", "Approve requires at least one skin type.");
    }
    if (!concerns || concerns.length === 0) {
      addError(errors, rowNumber, candidateId, "reviewed_concerns_required", "concerns_json", "Approve requires at least one concern.");
    }
    if (!input.texture || !TEXTURES.has(input.texture)) {
      addError(errors, rowNumber, candidateId, "reviewed_texture_invalid", "texture", "Approve requires an allowed texture.");
    }
    if (!input.finish || !FINISHES.has(input.finish)) {
      addError(errors, rowNumber, candidateId, "reviewed_finish_invalid", "finish", "Approve requires an allowed finish.");
    }
    if (!input.irritationRisk || !IRRITATION_RISKS.has(input.irritationRisk)) {
      addError(errors, rowNumber, candidateId, "reviewed_irritation_risk_invalid", "irritation_risk", "Approve requires an allowed irritation risk.");
    }
    if (typeof input.sensitivitySafe !== "boolean") {
      addError(errors, rowNumber, candidateId, "reviewed_sensitivity_safe_required", "sensitivity_safe", "Approve requires true or false; unknown must be deferred.");
    }
    if (
      !input.officialProductPageStatus ||
      !OFFICIAL_PAGE_STATUSES.has(input.officialProductPageStatus) ||
      input.officialProductPageStatus !== "verified"
    ) {
      addError(errors, rowNumber, candidateId, "reviewed_official_source_required", "official_product_page_status", "Approve requires a verified official product page.");
    }
    if (
      !input.ingredientListStatus ||
      !INGREDIENT_STATUSES.has(input.ingredientListStatus) ||
      input.ingredientListStatus !== "verified"
    ) {
      addError(errors, rowNumber, candidateId, "reviewed_ingredient_evidence_required", "ingredient_list_status", "Approve requires verified ingredient evidence.");
    }
    if (
      !input.duplicateCheckStatus ||
      !DUPLICATE_STATUSES.has(input.duplicateCheckStatus) ||
      input.duplicateCheckStatus === "unresolved"
    ) {
      addError(errors, rowNumber, candidateId, "reviewed_duplicate_check_required", "duplicate_check_status", "Approve requires a resolved duplicate check.");
    }
    if (input.duplicateCheckStatus === "checked_match" && !input.existingProductMatchIdReviewed) {
      addError(errors, rowNumber, candidateId, "reviewed_existing_product_required", "existing_product_match_id_reviewed", "A matched duplicate check requires an existing product ID.");
    }
    if (input.duplicateCheckStatus === "checked_no_match" && input.existingProductMatchIdReviewed) {
      addError(errors, rowNumber, candidateId, "reviewed_duplicate_check_conflict", "duplicate_check_status", "No-match duplicate status conflicts with an existing product ID.");
    }
    if (!input.reviewSourceUrls || input.reviewSourceUrls.length === 0) {
      addError(errors, rowNumber, candidateId, "reviewed_source_urls_required", "review_source_urls_json", "Approve requires at least one safe review source URL.");
    }
    if (hasUnresolvedContradiction(contradictions)) {
      addError(errors, rowNumber, candidateId, "reviewed_contradiction_unresolved", "contradictions_json", "Approve is blocked by unresolved contradictions.");
    }
    validateFieldEvidence(input, rowNumber, candidateId, errors);
  } else if (decision === "defer") {
    if (!input.deferReason || !DEFER_REASONS.has(input.deferReason)) {
      addError(errors, rowNumber, candidateId, "reviewed_defer_reason_required", "defer_reason", "Defer requires an allowed reason code.");
    }
  } else if (decision === "block") {
    if (!input.blockReason || !BLOCK_REASONS.has(input.blockReason)) {
      addError(errors, rowNumber, candidateId, "reviewed_block_reason_required", "block_reason", "Block requires an allowed reason code.");
    }
    if (
      input.blockReason === "duplicate_product" &&
      !input.existingProductMatchIdReviewed
    ) {
      addError(errors, rowNumber, candidateId, "reviewed_duplicate_evidence_required", "existing_product_match_id_reviewed", "Duplicate block requires an existing product ID.");
    }
  }

  return { input, errors };
}
