import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseStrictCsv, serializeCsv } from "../lib/reviews/review-csv.js";
import { resolveRepositoryPath } from "../lib/reviews/review-file-boundary.js";
import {
  ADMIN_REVIEW_CONTRACT_V2,
  CLEANSER_METADATA_SCHEMA_VERSION,
  CLEANSER_REVIEW_POLICY_VERSION,
  FIELD_EVIDENCE_SCHEMA_VERSION,
  V2_REVIEWED_HEADERS,
  buildFieldEvidenceDigest,
  type FieldEvidenceRecord,
  type ReviewedCsvRowV2,
} from "../lib/reviews/review-cleanser-metadata-v2.js";

const CRAWLER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = path.resolve(CRAWLER_ROOT, "..");
const REVIEWED_AT = process.env.REVIEW_V2_REVIEWED_AT || "2026-08-05T12:05:00.000Z";
const IDS = {
  validCreate: "51000000-0000-4000-8000-000000000001",
  validMerge: "51000000-0000-4000-8000-000000000002",
  unknown: "51000000-0000-4000-8000-000000000003",
  conflict: "51000000-0000-4000-8000-000000000004",
  notApplicable: "51000000-0000-4000-8000-000000000005",
};

function commonEvidence(sourceUrl: string): {
  fieldEvidence: Record<string, unknown>;
  fieldConfidence: Record<string, string>;
} {
  const fields = [
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
  return {
    fieldEvidence: Object.fromEntries(fields.map((field) => [field, {
      source_url: sourceUrl,
      note: "local v2 fixture",
    }])),
    fieldConfidence: Object.fromEntries(fields.map((field) => [field, "high"])),
  };
}

function fieldEvidence(input: Omit<FieldEvidenceRecord, "evidence_digest">): FieldEvidenceRecord {
  return { ...input, evidence_digest: buildFieldEvidenceDigest(input) };
}

function fillCommon(
  row: ReviewedCsvRowV2,
  input: {
    brand: string;
    name: string;
    category: string;
    skinTypes: string[];
    concerns: string[];
    texture: string;
    finish: string;
    risk: string;
    sensitivitySafe: boolean;
    existingProductId?: string;
    extraSources?: string[];
  },
): { evidence: Record<string, unknown>; confidence: Record<string, string> } {
  const source = `https://example.com/reviews/${row.candidate_id}`;
  const common = commonEvidence(source);
  Object.assign(row, {
    review_decision: "approve",
    review_confidence: "high",
    reviewed_at: REVIEWED_AT,
    review_source_urls_json: JSON.stringify([source, ...(input.extraSources ?? [])]),
    canonical_brand: input.brand,
    canonical_name: input.name,
    canonical_category: input.category,
    product_form: "",
    skin_types_json: JSON.stringify(input.skinTypes),
    concerns_json: JSON.stringify(input.concerns),
    texture: input.texture,
    finish: input.finish,
    irritation_risk: input.risk,
    sensitivity_safe: String(input.sensitivitySafe),
    official_product_page_status: "verified",
    ingredient_list_status: "verified",
    duplicate_check_status: input.existingProductId ? "checked_match" : "checked_no_match",
    existing_product_match_id_reviewed: input.existingProductId ?? "",
    contradictions_json: "[]",
    review_contract_version: ADMIN_REVIEW_CONTRACT_V2,
    cleansing_profile_schema_version: CLEANSER_METADATA_SCHEMA_VERSION,
    cleansing_profile_review_policy_version: CLEANSER_REVIEW_POLICY_VERSION,
    cleansing_profile_evidence_schema_version: FIELD_EVIDENCE_SCHEMA_VERSION,
  });
  return { evidence: common.fieldEvidence, confidence: common.fieldConfidence };
}

function applyReviewedValid(
  row: ReviewedCsvRowV2,
  common: { evidence: Record<string, unknown>; confidence: Record<string, string> },
  input: {
    evidenceId: string;
    source: string;
    value: "low_ph" | "balanced" | "deep_clean";
    confidence: "high" | "medium" | "low";
  },
): void {
  const record = fieldEvidence({
    evidence_id: input.evidenceId,
    candidate_id: row.candidate_id,
    field: "cleansing_profile",
    supported_value: input.value,
    evidence_type: "official_product_page",
    source_reference: input.source,
    schema_version: FIELD_EVIDENCE_SCHEMA_VERSION,
  });
  common.evidence.cleansing_profile = [record];
  common.confidence.cleansing_profile = input.confidence;
  Object.assign(row, {
    cleansing_profile: input.value,
    cleansing_profile_review_state: "reviewed_valid",
    cleansing_profile_confidence: input.confidence,
    cleansing_profile_evidence_refs_json: JSON.stringify([record.evidence_id]),
    field_evidence_json: JSON.stringify(common.evidence),
    field_confidence_json: JSON.stringify(common.confidence),
  });
}

async function main(): Promise<void> {
  const requestedDirectory = process.argv[2];
  if (!requestedDirectory) throw new Error("review_v2_fixture_directory_required");
  const directory = await resolveRepositoryPath(REPOSITORY_ROOT, requestedDirectory, { mustExist: true });
  const rows = parseStrictCsv(
    await fs.readFile(path.join(directory, "reviewed-template.csv"), "utf8"),
    V2_REVIEWED_HEADERS,
  ) as ReviewedCsvRowV2[];
  const byId = new Map(rows.map((row) => [row.candidate_id, row]));
  const validCreate = byId.get(IDS.validCreate);
  const validMerge = byId.get(IDS.validMerge);
  const unknown = byId.get(IDS.unknown);
  const conflict = byId.get(IDS.conflict);
  const notApplicable = byId.get(IDS.notApplicable);
  if (!validCreate || !validMerge || !unknown || !conflict || !notApplicable) {
    throw new Error("review_v2_fixture_candidate_missing");
  }

  const createSource = "https://example.com/evidence/deep-clean";
  const createCommon = fillCommon(validCreate, {
    brand: "Valid Brand",
    name: "Deep Clean Fixture",
    category: "cleanser",
    skinTypes: ["oily"],
    concerns: ["pores"],
    texture: "gel",
    finish: "fresh",
    risk: "medium",
    sensitivitySafe: false,
    extraSources: [createSource],
  });
  applyReviewedValid(validCreate, createCommon, {
    evidenceId: "53000000-0000-4000-8000-000000000001",
    source: createSource,
    value: "deep_clean",
    confidence: "high",
  });

  const mergeSource = "https://example.com/evidence/low-ph";
  const mergeCommon = fillCommon(validMerge, {
    brand: "Merge Brand",
    name: "Existing Cleanser",
    category: "cleanser",
    skinTypes: ["sensitive"],
    concerns: ["barrier"],
    texture: "gel",
    finish: "fresh",
    risk: "low",
    sensitivitySafe: true,
    existingProductId: "52000000-0000-4000-8000-000000000001",
    extraSources: [mergeSource],
  });
  applyReviewedValid(validMerge, mergeCommon, {
    evidenceId: "53000000-0000-4000-8000-000000000002",
    source: mergeSource,
    value: "low_ph",
    confidence: "medium",
  });

  const unknownSource = "https://example.com/evidence/unknown";
  const unknownCommon = fillCommon(unknown, {
    brand: "Unknown Brand",
    name: "Unknown Cleanser",
    category: "cleanser",
    skinTypes: ["sensitive"],
    concerns: ["barrier"],
    texture: "gel",
    finish: "natural",
    risk: "low",
    sensitivitySafe: true,
    extraSources: [unknownSource],
  });
  const unknownRecord = fieldEvidence({
    evidence_id: "53000000-0000-4000-8000-000000000003",
    candidate_id: IDS.unknown,
    field: "cleansing_profile",
    supported_value: null,
    evidence_type: "manufacturer_documentation",
    source_reference: unknownSource,
    schema_version: FIELD_EVIDENCE_SCHEMA_VERSION,
  });
  unknownCommon.evidence.cleansing_profile = [unknownRecord];
  unknownCommon.confidence.cleansing_profile = "unknown";
  Object.assign(unknown, {
    cleansing_profile: "null",
    cleansing_profile_review_state: "reviewed_unknown",
    cleansing_profile_confidence: "unknown",
    cleansing_profile_evidence_refs_json: JSON.stringify([unknownRecord.evidence_id]),
    field_evidence_json: JSON.stringify(unknownCommon.evidence),
    field_confidence_json: JSON.stringify(unknownCommon.confidence),
  });

  const conflictA = "https://example.com/evidence/conflict-a";
  const conflictB = "https://example.com/evidence/conflict-b";
  const conflictCommon = fillCommon(conflict, {
    brand: "Conflict Brand",
    name: "Conflict Cleanser",
    category: "cleanser",
    skinTypes: ["combination"],
    concerns: ["oiliness"],
    texture: "cream",
    finish: "natural",
    risk: "medium",
    sensitivitySafe: false,
    extraSources: [conflictA, conflictB],
  });
  const conflictRecords = [
    fieldEvidence({
      evidence_id: "53000000-0000-4000-8000-000000000004",
      candidate_id: IDS.conflict,
      field: "cleansing_profile",
      supported_value: "balanced",
      evidence_type: "official_product_page",
      source_reference: conflictA,
      schema_version: FIELD_EVIDENCE_SCHEMA_VERSION,
    }),
    fieldEvidence({
      evidence_id: "53000000-0000-4000-8000-000000000005",
      candidate_id: IDS.conflict,
      field: "cleansing_profile",
      supported_value: "deep_clean",
      evidence_type: "review_corpus",
      source_reference: conflictB,
      schema_version: FIELD_EVIDENCE_SCHEMA_VERSION,
    }),
  ];
  conflictCommon.evidence.cleansing_profile = conflictRecords;
  conflictCommon.confidence.cleansing_profile = "unknown";
  Object.assign(conflict, {
    cleansing_profile: "null",
    cleansing_profile_review_state: "reviewed_conflict",
    cleansing_profile_confidence: "unknown",
    cleansing_profile_evidence_refs_json: JSON.stringify(conflictRecords.map((item) => item.evidence_id)),
    field_evidence_json: JSON.stringify(conflictCommon.evidence),
    field_confidence_json: JSON.stringify(conflictCommon.confidence),
  });

  const notApplicableCommon = fillCommon(notApplicable, {
    brand: "Neutral Brand",
    name: "Not Applicable Cream",
    category: "moisturizer_cream",
    skinTypes: ["dry"],
    concerns: ["dehydration"],
    texture: "cream",
    finish: "dewy",
    risk: "low",
    sensitivitySafe: true,
  });
  Object.assign(notApplicable, {
    cleansing_profile: "null",
    cleansing_profile_review_state: "not_applicable",
    cleansing_profile_confidence: "unknown",
    cleansing_profile_evidence_refs_json: "[]",
    field_evidence_json: JSON.stringify(notApplicableCommon.evidence),
    field_confidence_json: JSON.stringify(notApplicableCommon.confidence),
  });

  await fs.writeFile(
    path.join(directory, "reviewed.csv"),
    serializeCsv(V2_REVIEWED_HEADERS, rows),
    "utf8",
  );
  process.stdout.write("reviewed_v2_fixture_ready\n");
}

main().catch((error) => {
  const code = error instanceof Error && /^[a-z0-9_]+$/.test(error.message)
    ? error.message
    : "review_v2_fixture_prepare_failed";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
