import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  REVIEWED_HEADERS,
  type ReviewedCsvRow,
} from "../lib/reviews/review-export-contract.js";
import { parseReviewedCsv, serializeCsv } from "../lib/reviews/review-csv.js";
import { resolveRepositoryPath } from "../lib/reviews/review-file-boundary.js";
import {
  FIXTURE_BLOCK_PRODUCT_ID,
  FIXTURE_CANDIDATE_IDS,
  FIXTURE_MERGE_PRODUCT_ID,
} from "./fixtures/product-review-export-intake.js";

const CRAWLER_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const REPOSITORY_ROOT = path.resolve(CRAWLER_ROOT, "..");

function evidence(sourceUrl: string, treatment: boolean) {
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
    ...(treatment ? ["product_form"] : []),
  ];
  return {
    fieldEvidence: Object.fromEntries(
      fields.map((field) => [field, { source_url: sourceUrl, note: "local fixture" }]),
    ),
    fieldConfidence: Object.fromEntries(fields.map((field) => [field, "high"])),
  };
}

async function main(): Promise<void> {
  const requestedDirectory = process.argv[2];
  if (!requestedDirectory) throw new Error("review_fixture_directory_required");

  const directory = await resolveRepositoryPath(REPOSITORY_ROOT, requestedDirectory, {
    mustExist: true,
  });
  const templatePath = path.join(directory, "reviewed-template.csv");
  const rows = parseReviewedCsv(await fs.readFile(templatePath, "utf8"), REVIEWED_HEADERS);
  const byId = new Map(rows.map((row) => [row.candidate_id, row]));
  const reviewedAt = new Date().toISOString();

  for (const candidateId of FIXTURE_CANDIDATE_IDS) {
    const row = byId.get(candidateId);
    if (!row) throw new Error("review_fixture_candidate_missing");
    row.review_confidence = "high";
    row.reviewed_at = reviewedAt;
    row.review_source_urls_json = JSON.stringify([
      `https://example.com/reviews/${candidateId}`,
    ]);
    row.contradictions_json = "[]";
  }

  const first = byId.get(FIXTURE_CANDIDATE_IDS[0]) as ReviewedCsvRow;
  const firstSource = `https://example.com/reviews/${first.candidate_id}`;
  const firstEvidence = evidence(firstSource, true);
  Object.assign(first, {
    review_decision: "approve",
    canonical_brand: "Formula Brand",
    canonical_name: "Formula Serum",
    canonical_category: "treatment",
    product_form: "serum",
    skin_types_json: '["oily","sensitive"]',
    concerns_json: '["barrier","dehydration"]',
    texture: "watery",
    finish: "fresh",
    irritation_risk: "low",
    sensitivity_safe: "true",
    official_product_page_status: "verified",
    ingredient_list_status: "verified",
    duplicate_check_status: "checked_no_match",
    field_evidence_json: JSON.stringify(firstEvidence.fieldEvidence),
    field_confidence_json: JSON.stringify(firstEvidence.fieldConfidence),
  });

  const second = byId.get(FIXTURE_CANDIDATE_IDS[1]) as ReviewedCsvRow;
  const secondSource = `https://example.com/reviews/${second.candidate_id}`;
  const secondEvidence = evidence(secondSource, false);
  Object.assign(second, {
    review_decision: "approve",
    canonical_brand: "Merge Brand",
    canonical_name: "Merge Cream",
    canonical_category: "moisturizer_cream",
    skin_types_json: '["dry","sensitive"]',
    concerns_json: '["barrier"]',
    texture: "cream",
    finish: "dewy",
    irritation_risk: "low",
    sensitivity_safe: "true",
    official_product_page_status: "verified",
    ingredient_list_status: "verified",
    duplicate_check_status: "checked_match",
    existing_product_match_id_reviewed: FIXTURE_MERGE_PRODUCT_ID,
    field_evidence_json: JSON.stringify(secondEvidence.fieldEvidence),
    field_confidence_json: JSON.stringify(secondEvidence.fieldConfidence),
  });

  Object.assign(byId.get(FIXTURE_CANDIDATE_IDS[2]) as ReviewedCsvRow, {
    review_decision: "defer",
    defer_reason: "missing_ingredient_evidence",
    sensitivity_safe: "unknown",
  });
  Object.assign(byId.get(FIXTURE_CANDIDATE_IDS[3]) as ReviewedCsvRow, {
    review_decision: "block",
    block_reason: "duplicate_product",
    existing_product_match_id_reviewed: FIXTURE_BLOCK_PRODUCT_ID,
  });
  Object.assign(byId.get(FIXTURE_CANDIDATE_IDS[4]) as ReviewedCsvRow, {
    review_decision: "defer",
    defer_reason: "identity_unresolved",
    sensitivity_safe: "null",
  });

  await fs.writeFile(
    path.join(directory, "reviewed.csv"),
    serializeCsv(REVIEWED_HEADERS, rows),
    "utf8",
  );
  process.stdout.write("reviewed_fixture_ready\n");
}

main().catch((error) => {
  const code =
    error instanceof Error && /^[a-z0-9_]+$/.test(error.message)
      ? error.message
      : "review_fixture_prepare_failed";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
