import assert from "node:assert/strict";

import {
  REVIEWED_HEADERS,
  REVIEWED_SCHEMA_VERSION,
  type ReviewExportSourceRecord,
} from "../lib/reviews/review-export-contract.js";
import { sha256Utf8 } from "../lib/reviews/review-batch-integrity.js";
import { parseStrictCsv, serializeCsv } from "../lib/reviews/review-csv.js";
import {
  ADMIN_REVIEW_CONTRACT_V2,
  CLEANSER_METADATA_SCHEMA_VERSION,
  CLEANSER_REVIEW_POLICY_VERSION,
  FIELD_EVIDENCE_SCHEMA_VERSION,
  V2_REVIEWED_HEADERS,
  buildCleanserMetadataV2ExportBatch,
  buildFieldEvidenceDigest,
  parseCleanserMetadataV2Package,
  validateCleanserMetadataV2Row,
  type FieldEvidenceRecord,
  type ReviewedCsvRowV2,
} from "../lib/reviews/review-cleanser-metadata-v2.js";

const candidateId = "61000000-0000-4000-8000-000000000001";
const batchId = "62000000-0000-4000-8000-000000000001";
const now = "2026-08-05T12:00:00.000Z";
const commonUrl = "https://example.com/evidence/common";
const profileUrl = "https://example.com/evidence/profile";
const commonFields = [
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

const source: ReviewExportSourceRecord = {
  candidate: {
    id: candidateId,
    source_name: "fixture",
    external_type: "product",
    external_id: "v2",
    source_url: "https://example.com/product/v2",
    category_path: "cleanser",
    product_name_raw: "Contract Cleanser",
    brand_name_raw: "Contract Brand",
    normalized_name: "contract cleanser",
    normalized_brand: "contract brand",
    service_category: "cleanser",
    product_form: null,
    canonical_name: "Contract Cleanser",
    canonical_brand: "Contract Brand",
    review_status: "needs_review",
    review_flags: [],
    match_method: null,
    match_confidence: null,
    matched_product_id: null,
    duplicate_of_product_id: null,
    promotion_payload: {
      product: {
        skin_types: ["oily"],
        concerns: ["pores"],
        texture: "gel",
        finish: "fresh",
        irritation_risk: "medium",
        sensitivity_safe: false,
      },
    },
    promotion_version: "fixture-v2",
    updated_at: now,
  },
  review: {
    candidate_id: candidateId,
    status: "queued",
    priority_score: 100,
    selection_reason: "fixture",
    evidence_snapshot: { fixture: true },
    rule_version: "ranking-review-v2",
    first_queued_at: now,
    last_queued_at: now,
    review_note: null,
    updated_at: now,
  },
  rankingEvidence: { candidate: { id: candidateId }, concerns: [], popularity: {} },
  existingProductMatch: null,
};

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function evidenceRecord(input: {
  id: string;
  candidate?: string;
  field?: string;
  value: "low_ph" | "balanced" | "deep_clean" | null;
  source?: string;
}): FieldEvidenceRecord {
  const base = {
    evidence_id: input.id,
    candidate_id: input.candidate ?? candidateId,
    field: input.field ?? "cleansing_profile",
    supported_value: input.value,
    evidence_type: "official_product_page",
    source_reference: input.source ?? profileUrl,
    schema_version: FIELD_EVIDENCE_SCHEMA_VERSION,
  } as Omit<FieldEvidenceRecord, "evidence_digest">;
  return { ...base, evidence_digest: buildFieldEvidenceDigest(base) };
}

function baseReviewedRow(template: string): ReviewedCsvRowV2 {
  const [row] = parseStrictCsv(template, V2_REVIEWED_HEADERS) as ReviewedCsvRowV2[];
  const fieldEvidence = Object.fromEntries(
    commonFields.map((field) => [field, { source_url: commonUrl }]),
  ) as Record<string, unknown>;
  const fieldConfidence = Object.fromEntries(
    commonFields.map((field) => [field, "high"]),
  ) as Record<string, string>;
  Object.assign(row, {
    review_decision: "approve",
    review_confidence: "high",
    reviewed_at: now,
    review_source_urls_json: JSON.stringify([commonUrl, profileUrl]),
    canonical_brand: "Contract Brand",
    canonical_name: "Contract Cleanser",
    canonical_category: "cleanser",
    product_form: "",
    skin_types_json: '["oily"]',
    concerns_json: '["pores"]',
    texture: "gel",
    finish: "fresh",
    irritation_risk: "medium",
    sensitivity_safe: "false",
    official_product_page_status: "verified",
    ingredient_list_status: "verified",
    duplicate_check_status: "checked_no_match",
    existing_product_match_id_reviewed: "",
    contradictions_json: "[]",
    review_contract_version: ADMIN_REVIEW_CONTRACT_V2,
    cleansing_profile_schema_version: CLEANSER_METADATA_SCHEMA_VERSION,
    cleansing_profile_review_policy_version: CLEANSER_REVIEW_POLICY_VERSION,
    cleansing_profile_evidence_schema_version: FIELD_EVIDENCE_SCHEMA_VERSION,
    field_evidence_json: JSON.stringify(fieldEvidence),
    field_confidence_json: JSON.stringify(fieldConfidence),
  });
  return row;
}

function setEvidence(
  row: ReviewedCsvRowV2,
  records: FieldEvidenceRecord[],
  confidence: "high" | "medium" | "low" | "unknown",
): void {
  const fieldEvidence = JSON.parse(row.field_evidence_json) as Record<string, unknown>;
  const fieldConfidence = JSON.parse(row.field_confidence_json) as Record<string, string>;
  fieldEvidence.cleansing_profile = records;
  fieldConfidence.cleansing_profile = confidence;
  row.field_evidence_json = JSON.stringify(fieldEvidence);
  row.field_confidence_json = JSON.stringify(fieldConfidence);
  row.cleansing_profile_evidence_refs_json = JSON.stringify(records.map((record) => record.evidence_id));
}

function validReviewedRow(template: string): ReviewedCsvRowV2 {
  const row = baseReviewedRow(template);
  const record = evidenceRecord({
    id: "63000000-0000-4000-8000-000000000001",
    value: "deep_clean",
  });
  setEvidence(row, [record], "high");
  Object.assign(row, {
    cleansing_profile: "deep_clean",
    cleansing_profile_review_state: "reviewed_valid",
    cleansing_profile_confidence: "high",
  });
  return row;
}

function clone(row: ReviewedCsvRowV2): ReviewedCsvRowV2 {
  return structuredClone(row);
}

function expectRowError(row: ReviewedCsvRowV2, code: string): void {
  const result = validateCleanserMetadataV2Row(row, 2);
  assert.equal(result.errors.some((error) => error.error_code === code), true, code);
}

function parsePackage(
  batchJson: string,
  manifestCsv: string,
  evidenceJsonl: string,
  reviewedCsv: string,
) {
  return parseCleanserMetadataV2Package({
    batch: bytes(batchJson),
    manifest: bytes(manifestCsv),
    evidence: bytes(evidenceJsonl),
    reviewed: bytes(reviewedCsv),
  });
}

function main(): void {
  assert.equal(REVIEWED_SCHEMA_VERSION, "product-review-reviewed-v1");
  assert.equal(REVIEWED_HEADERS.length, 32);
  assert.equal(
    sha256Utf8(REVIEWED_HEADERS.join("\n")),
    "5896aac98f47155bd00c143a252d1d4a1241d667dc5eedd28666e7ad819f2216",
    "v1 reviewed header contract changed",
  );

  const bundle = buildCleanserMetadataV2ExportBatch([source], {
    exportBatchId: batchId,
    exportedAt: now,
    sourceStatus: "queued",
  });
  const valid = validReviewedRow(bundle.reviewedTemplateCsv);
  const validCsv = serializeCsv(V2_REVIEWED_HEADERS, [valid]);
  const parsed = parsePackage(bundle.batchJson, bundle.manifestCsv, bundle.evidenceJsonl, validCsv);
  assert.equal(parsed.batch.review_contract_version, ADMIN_REVIEW_CONTRACT_V2);
  assert.equal(validateCleanserMetadataV2Row(parsed.reviewedRows[0], 2).metadata.complete, true);

  expectRowError({ ...clone(valid), cleansing_profile: "strong" }, "review_v2_cleansing_profile_invalid");
  expectRowError({ ...clone(valid), cleansing_profile_review_state: "reviewed_unknown" }, "review_v2_unknown_requires_null");
  expectRowError({ ...clone(valid), cleansing_profile_review_state: "reviewed_conflict" }, "review_v2_conflict_requires_null");
  expectRowError({ ...clone(valid), cleansing_profile_confidence: "unknown" }, "review_v2_valid_confidence_required");

  const missingEvidence = clone(valid);
  setEvidence(missingEvidence, [], "high");
  expectRowError(missingEvidence, "review_v2_valid_evidence_required");

  const mismatchedRefs = clone(valid);
  mismatchedRefs.cleansing_profile_evidence_refs_json = "[]";
  expectRowError(mismatchedRefs, "review_v2_evidence_reference_mismatch");

  const foreignEvidence = clone(valid);
  setEvidence(foreignEvidence, [evidenceRecord({
    id: "63000000-0000-4000-8000-000000000002",
    candidate: "61000000-0000-4000-8000-000000000099",
    value: "deep_clean",
  })], "high");
  expectRowError(foreignEvidence, "review_v2_foreign_evidence");

  const crossField = clone(valid);
  const crossFieldRaw = JSON.parse(crossField.field_evidence_json) as Record<string, unknown>;
  const crossFieldRecords = crossFieldRaw.cleansing_profile as Array<Record<string, unknown>>;
  crossFieldRecords[0].field = "texture";
  crossFieldRaw.cleansing_profile = crossFieldRecords;
  crossField.field_evidence_json = JSON.stringify(crossFieldRaw);
  expectRowError(crossField, "review_v2_field_evidence_invalid");

  const digestMismatch = clone(valid);
  const digestRaw = JSON.parse(digestMismatch.field_evidence_json) as Record<string, unknown>;
  const digestRecords = digestRaw.cleansing_profile as Array<Record<string, unknown>>;
  digestRecords[0].evidence_digest = "0".repeat(64);
  digestRaw.cleansing_profile = digestRecords;
  digestMismatch.field_evidence_json = JSON.stringify(digestRaw);
  expectRowError(digestMismatch, "review_v2_field_evidence_invalid");

  const duplicateEvidence = clone(valid);
  const duplicateRecord = evidenceRecord({
    id: "63000000-0000-4000-8000-000000000006",
    value: "deep_clean",
  });
  setEvidence(duplicateEvidence, [duplicateRecord, duplicateRecord], "high");
  expectRowError(duplicateEvidence, "review_v2_duplicate_evidence_id");

  const unknown = baseReviewedRow(bundle.reviewedTemplateCsv);
  const unknownRecord = evidenceRecord({
    id: "63000000-0000-4000-8000-000000000003",
    value: null,
  });
  setEvidence(unknown, [unknownRecord], "unknown");
  Object.assign(unknown, {
    cleansing_profile: "null",
    cleansing_profile_review_state: "reviewed_unknown",
    cleansing_profile_confidence: "unknown",
  });
  assert.equal(validateCleanserMetadataV2Row(unknown, 2).errors.length, 0);

  const conflict = baseReviewedRow(bundle.reviewedTemplateCsv);
  const conflictRecords = [
    evidenceRecord({
      id: "63000000-0000-4000-8000-000000000004",
      value: "balanced",
      source: "https://example.com/evidence/conflict-a",
    }),
    evidenceRecord({
      id: "63000000-0000-4000-8000-000000000005",
      value: "deep_clean",
      source: "https://example.com/evidence/conflict-b",
    }),
  ];
  conflict.review_source_urls_json = JSON.stringify([
    commonUrl,
    "https://example.com/evidence/conflict-a",
    "https://example.com/evidence/conflict-b",
  ]);
  setEvidence(conflict, conflictRecords, "unknown");
  Object.assign(conflict, {
    cleansing_profile: "null",
    cleansing_profile_review_state: "reviewed_conflict",
    cleansing_profile_confidence: "unknown",
  });
  assert.equal(validateCleanserMetadataV2Row(conflict, 2).errors.length, 0);

  const notApplicable = baseReviewedRow(bundle.reviewedTemplateCsv);
  Object.assign(notApplicable, {
    canonical_category: "moisturizer_cream",
    cleansing_profile: "null",
    cleansing_profile_review_state: "not_applicable",
    cleansing_profile_confidence: "unknown",
    cleansing_profile_evidence_refs_json: "[]",
  });
  const naEvidence = JSON.parse(notApplicable.field_evidence_json) as Record<string, unknown>;
  delete naEvidence.cleansing_profile;
  notApplicable.field_evidence_json = JSON.stringify(naEvidence);
  assert.equal(validateCleanserMetadataV2Row(notApplicable, 2).errors.length, 0);

  const deferred = baseReviewedRow(bundle.reviewedTemplateCsv);
  Object.assign(deferred, {
    review_decision: "defer",
    defer_reason: "needs_manual_research",
    cleansing_profile: "",
    cleansing_profile_review_state: "",
    cleansing_profile_confidence: "",
    cleansing_profile_evidence_refs_json: "[]",
  });
  const deferEvidence = JSON.parse(deferred.field_evidence_json) as Record<string, unknown>;
  delete deferEvidence.cleansing_profile;
  deferred.field_evidence_json = JSON.stringify(deferEvidence);
  assert.equal(validateCleanserMetadataV2Row(deferred, 2).errors.length, 0, "v1 defer semantics changed");

  const blocked = baseReviewedRow(bundle.reviewedTemplateCsv);
  Object.assign(blocked, {
    review_decision: "block",
    block_reason: "out_of_scope",
    cleansing_profile: "",
    cleansing_profile_review_state: "",
    cleansing_profile_confidence: "",
    cleansing_profile_evidence_refs_json: "[]",
  });
  const blockEvidence = JSON.parse(blocked.field_evidence_json) as Record<string, unknown>;
  delete blockEvidence.cleansing_profile;
  blocked.field_evidence_json = JSON.stringify(blockEvidence);
  assert.equal(validateCleanserMetadataV2Row(blocked, 2).errors.length, 0, "v1 block semantics changed");

  assert.throws(() => parsePackage(
    bundle.batchJson,
    bundle.manifestCsv,
    bundle.evidenceJsonl,
    validCsv.replace("review_contract_version", "unexpected_header"),
  ));
  assert.throws(() => parsePackage(
    bundle.batchJson,
    bundle.manifestCsv,
    bundle.evidenceJsonl,
    validCsv.replace("review_contract_version", "candidate_id"),
  ));
  assert.throws(() => parsePackage(
    bundle.batchJson,
    bundle.manifestCsv,
    bundle.evidenceJsonl,
    validCsv.replace("review_contract_version", "reviewer_id"),
  ));
  assert.throws(() => parseCleanserMetadataV2Package({
    batch: bytes(bundle.batchJson),
    manifest: bytes(bundle.manifestCsv),
    evidence: bytes(bundle.evidenceJsonl),
    reviewed: new Uint8Array([0xff, 0xfe, 0xfd]),
  }));
  assert.throws(() => parseCleanserMetadataV2Package({
    batch: bytes(bundle.batchJson),
    manifest: bytes(bundle.manifestCsv),
    evidence: bytes(bundle.evidenceJsonl),
    reviewed: new Uint8Array([...bytes(validCsv.slice(0, 100)), 0, ...bytes(validCsv.slice(100))]),
  }));
  assert.throws(() => parsePackage(
    bundle.batchJson.replace("product-review-export-v2", "product-review-export-v1"),
    bundle.manifestCsv,
    bundle.evidenceJsonl,
    validCsv,
  ));
  assert.throws(() => parsePackage(
    bundle.batchJson.replace(CLEANSER_REVIEW_POLICY_VERSION, "unknown-policy-v9"),
    bundle.manifestCsv,
    bundle.evidenceJsonl,
    validCsv,
  ));

  process.stdout.write(
    "verify:admin-product-review-cleanser-metadata-v2:contract PASS " +
    "(v1 exact contract, explicit v2, states, confidence, evidence binding, strict headers, UTF-8/NUL, no fallback)\n",
  );
}

main();
