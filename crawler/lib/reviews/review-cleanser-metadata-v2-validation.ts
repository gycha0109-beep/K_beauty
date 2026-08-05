import { Buffer } from "node:buffer";

import type { IntakeRowError } from "./review-export-contract.js";
import {
  assertJsonValueSafety,
  assertSafeSourceUrl,
  canonicalJson,
  hashesEqual,
  isSha256,
  isUuid,
  sha256Utf8,
} from "./review-batch-integrity.js";
import {
  CLEANSING_PROFILES,
  CLEANSING_REVIEW_CONFIDENCE,
  CLEANSING_REVIEW_STATES,
  FIELD_EVIDENCE_SCHEMA_VERSION,
  FIELD_EVIDENCE_TYPES,
  buildFieldEvidenceDigest,
  type CleansingProfile,
  type CleansingReviewConfidence,
  type CleansingReviewState,
  type FieldEvidenceRecord,
  type ParsedMetadataReview,
  type ReviewedCsvRowV2,
} from "./review-cleanser-metadata-v2-contract.js";

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function evidenceWithoutDigest(record: FieldEvidenceRecord): Omit<FieldEvidenceRecord, "evidence_digest"> {
  const { evidence_digest: _digest, ...rest } = record;
  return rest;
}

function addError(
  errors: IntakeRowError[],
  rowNumber: number,
  candidateId: string | null,
  code: string,
  field: string,
  message: string,
): void {
  errors.push({ row_number: rowNumber, candidate_id: candidateId, error_code: code, field, message });
}

function parseJsonCell(raw: string): unknown {
  if (Buffer.byteLength(raw, "utf8") > 32 * 1024) throw new Error("too_large");
  const parsed = JSON.parse(raw);
  assertJsonValueSafety(parsed, { maxDepth: 12 });
  return parsed;
}

function parseProfile(raw: string): CleansingProfile | null | undefined {
  const value = raw.trim();
  if (value === "" || value === "null") return null;
  return (CLEANSING_PROFILES as readonly string[]).includes(value)
    ? (value as CleansingProfile)
    : undefined;
}

function parseState(raw: string): CleansingReviewState | null {
  return (CLEANSING_REVIEW_STATES as readonly string[]).includes(raw)
    ? (raw as CleansingReviewState)
    : null;
}

function parseConfidence(raw: string): CleansingReviewConfidence | null {
  return (CLEANSING_REVIEW_CONFIDENCE as readonly string[]).includes(raw)
    ? (raw as CleansingReviewConfidence)
    : null;
}

function parseEvidenceRecord(value: unknown): FieldEvidenceRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = [
    "evidence_id",
    "candidate_id",
    "field",
    "supported_value",
    "evidence_type",
    "source_reference",
    "schema_version",
    "evidence_digest",
  ];
  if (!exactKeys(record, keys)) return null;
  const supported = record.supported_value;
  if (
    !isUuid(String(record.evidence_id ?? "")) ||
    !isUuid(String(record.candidate_id ?? "")) ||
    record.field !== "cleansing_profile" ||
    !(supported === null || (CLEANSING_PROFILES as readonly unknown[]).includes(supported)) ||
    !(FIELD_EVIDENCE_TYPES as readonly unknown[]).includes(record.evidence_type) ||
    typeof record.source_reference !== "string" ||
    record.schema_version !== FIELD_EVIDENCE_SCHEMA_VERSION ||
    !isSha256(String(record.evidence_digest ?? ""))
  ) {
    return null;
  }
  const parsed = record as unknown as FieldEvidenceRecord;
  try {
    assertSafeSourceUrl(parsed.source_reference);
  } catch {
    return null;
  }
  return hashesEqual(parsed.evidence_digest, buildFieldEvidenceDigest(evidenceWithoutDigest(parsed)))
    ? parsed
    : null;
}

function parseEvidenceRefs(
  raw: string,
  rowNumber: number,
  candidateId: string | null,
  errors: IntakeRowError[],
): string[] {
  try {
    const parsed = parseJsonCell(raw || "[]");
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => typeof item !== "string" || !isUuid(item)) ||
      new Set(parsed).size !== parsed.length
    ) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    addError(
      errors,
      rowNumber,
      candidateId,
      "review_v2_evidence_refs_invalid",
      "cleansing_profile_evidence_refs_json",
      "Evidence refs must be a unique JSON UUID array.",
    );
    return [];
  }
}

function parseFieldEvidence(
  raw: string,
  rowNumber: number,
  candidateId: string | null,
  errors: IntakeRowError[],
): FieldEvidenceRecord[] {
  try {
    const parsed = raw ? parseJsonCell(raw) : {};
    const list = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).cleansing_profile
      : undefined;
    if (list === undefined) return [];
    if (!Array.isArray(list)) throw new Error("invalid");
    const records = list.map(parseEvidenceRecord);
    if (records.some((item) => item === null)) throw new Error("invalid");
    return records as FieldEvidenceRecord[];
  } catch {
    addError(
      errors,
      rowNumber,
      candidateId,
      "review_v2_field_evidence_invalid",
      "field_evidence_json.cleansing_profile",
      "Field evidence records are invalid.",
    );
    return [];
  }
}

function parseReviewSourceUrls(
  raw: string,
  rowNumber: number,
  candidateId: string | null,
  errors: IntakeRowError[],
): string[] {
  try {
    const parsed = parseJsonCell(raw || "[]");
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => typeof item !== "string") ||
      new Set(parsed).size !== parsed.length
    ) {
      throw new Error("invalid");
    }
    return parsed.map((item) => assertSafeSourceUrl(item));
  } catch {
    addError(
      errors,
      rowNumber,
      candidateId,
      "review_v2_review_source_urls_invalid",
      "review_source_urls_json",
      "Review source URLs are invalid.",
    );
    return [];
  }
}

export function validateCleanserMetadataV2Row(
  row: ReviewedCsvRowV2,
  rowNumber: number,
): { metadata: ParsedMetadataReview; errors: IntakeRowError[] } {
  const candidateId = isUuid(row.candidate_id) ? row.candidate_id : null;
  const errors: IntakeRowError[] = [];
  const decision = row.review_decision.trim().toLowerCase();
  const category = row.canonical_category.trim();
  const refs = parseEvidenceRefs(row.cleansing_profile_evidence_refs_json, rowNumber, candidateId, errors);
  const evidence = parseFieldEvidence(row.field_evidence_json, rowNumber, candidateId, errors);
  const reviewSourceUrls = parseReviewSourceUrls(row.review_source_urls_json, rowNumber, candidateId, errors);

  const ids = evidence.map((item) => item.evidence_id);
  if (new Set(ids).size !== ids.length) {
    addError(errors, rowNumber, candidateId, "review_v2_duplicate_evidence_id", "field_evidence_json.cleansing_profile", "Duplicate evidence ID.");
  }
  if (evidence.some((item) => item.candidate_id !== row.candidate_id)) {
    addError(errors, rowNumber, candidateId, "review_v2_foreign_evidence", "field_evidence_json.cleansing_profile", "Evidence belongs to another candidate.");
  }
  if (refs.some((ref) => !ids.includes(ref)) || ids.some((id) => !refs.includes(id))) {
    addError(errors, rowNumber, candidateId, "review_v2_evidence_reference_mismatch", "cleansing_profile_evidence_refs_json", "Evidence refs do not match field evidence records.");
  }
  if (evidence.some((item) => !reviewSourceUrls.includes(item.source_reference))) {
    addError(errors, rowNumber, candidateId, "review_v2_evidence_source_mismatch", "field_evidence_json.cleansing_profile", "Evidence source must appear in review_source_urls_json.");
  }

  if (decision !== "approve") {
    const hasMetadata =
      row.cleansing_profile.trim() !== "" ||
      row.cleansing_profile_review_state.trim() !== "" ||
      row.cleansing_profile_confidence.trim() !== "" ||
      refs.length > 0 ||
      evidence.length > 0;
    if (hasMetadata) {
      addError(errors, rowNumber, candidateId, "review_v2_metadata_not_allowed_for_non_approve", "cleansing_profile_review_state", "Deferred or blocked rows cannot persist metadata review state.");
    }
    return {
      metadata: {
        profile: null,
        state: null,
        confidence: null,
        refs,
        evidence,
        evidenceDigest: null,
        complete: false,
      },
      errors,
    };
  }

  const profile = parseProfile(row.cleansing_profile);
  const state = parseState(row.cleansing_profile_review_state);
  const confidence = parseConfidence(row.cleansing_profile_confidence);
  if (profile === undefined) {
    addError(errors, rowNumber, candidateId, "review_v2_cleansing_profile_invalid", "cleansing_profile", "Invalid cleansing_profile.");
  }
  if (!state) {
    addError(errors, rowNumber, candidateId, "review_v2_review_state_invalid", "cleansing_profile_review_state", "Invalid review state.");
  }
  if (!confidence) {
    addError(errors, rowNumber, candidateId, "review_v2_confidence_invalid", "cleansing_profile_confidence", "Invalid confidence.");
  }

  if (category === "cleanser") {
    if (state === "not_applicable") {
      addError(errors, rowNumber, candidateId, "review_v2_cleanser_not_applicable", "cleansing_profile_review_state", "Cleanser cannot be not_applicable.");
    }
    if (state === "reviewed_valid") {
      if (!profile) {
        addError(errors, rowNumber, candidateId, "review_v2_valid_profile_required", "cleansing_profile", "reviewed_valid requires a non-null profile.");
      }
      if (confidence === "unknown") {
        addError(errors, rowNumber, candidateId, "review_v2_valid_confidence_required", "cleansing_profile_confidence", "reviewed_valid requires bounded confidence.");
      }
      if (evidence.length === 0) {
        addError(errors, rowNumber, candidateId, "review_v2_valid_evidence_required", "cleansing_profile_evidence_refs_json", "reviewed_valid requires evidence.");
      }
      if (profile && evidence.some((item) => item.supported_value !== profile)) {
        addError(errors, rowNumber, candidateId, "review_v2_evidence_value_mismatch", "field_evidence_json.cleansing_profile", "Evidence does not support the reviewed value.");
      }
    } else if (state === "reviewed_unknown") {
      if (profile !== null) {
        addError(errors, rowNumber, candidateId, "review_v2_unknown_requires_null", "cleansing_profile", "reviewed_unknown requires null.");
      }
      if (confidence !== "unknown") {
        addError(errors, rowNumber, candidateId, "review_v2_unknown_confidence_invalid", "cleansing_profile_confidence", "reviewed_unknown requires unknown confidence.");
      }
      if (evidence.length === 0 || evidence.some((item) => item.supported_value !== null)) {
        addError(errors, rowNumber, candidateId, "review_v2_unknown_evidence_invalid", "field_evidence_json.cleansing_profile", "reviewed_unknown requires null-support evidence.");
      }
    } else if (state === "reviewed_conflict") {
      if (profile !== null) {
        addError(errors, rowNumber, candidateId, "review_v2_conflict_requires_null", "cleansing_profile", "reviewed_conflict requires null.");
      }
      if (confidence !== "unknown") {
        addError(errors, rowNumber, candidateId, "review_v2_conflict_confidence_invalid", "cleansing_profile_confidence", "reviewed_conflict requires unknown confidence.");
      }
      const values = new Set(evidence.map((item) => item.supported_value).filter((item) => item !== null));
      if (evidence.length < 2 || values.size < 2) {
        addError(errors, rowNumber, candidateId, "review_v2_conflict_evidence_invalid", "field_evidence_json.cleansing_profile", "reviewed_conflict requires conflicting evidence.");
      }
    }
  } else if (
    state !== "not_applicable" ||
    profile !== null ||
    confidence !== "unknown" ||
    refs.length > 0 ||
    evidence.length > 0
  ) {
    addError(errors, rowNumber, candidateId, "review_v2_non_cleanser_metadata_invalid", "cleansing_profile_review_state", "Non-cleanser must be not_applicable with null profile, unknown confidence, and no evidence.");
  }

  const evidenceDigest = evidence.length > 0
    ? sha256Utf8(canonicalJson([...evidence].sort((a, b) => a.evidence_id.localeCompare(b.evidence_id))))
    : null;
  const complete =
    category === "cleanser" &&
    state === "reviewed_valid" &&
    Boolean(profile) &&
    confidence !== "unknown" &&
    errors.length === 0;

  return {
    metadata: {
      profile: profile ?? null,
      state,
      confidence,
      refs,
      evidence,
      evidenceDigest,
      complete,
    },
    errors,
  };
}
