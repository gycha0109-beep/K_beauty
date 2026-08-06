import {
  REVIEWED_HEADERS,
  type ExistingProductSnapshot,
  type IntakeDatabaseSnapshot,
  type ReviewExportSourceRecord,
  type ReviewedCsvRow,
} from "../../lib/reviews/review-export-contract.js";
import { buildReviewExportBatch } from "../../lib/reviews/review-export-serializer.js";

export const FIXTURE_BATCH_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const FIXTURE_EXPORTED_AT = "2026-07-31T01:00:00.000Z";
export const FIXTURE_REVIEWED_AT = "2026-07-31T02:00:00.000Z";
export const FIXTURE_CANDIDATE_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
] as const;
export const FIXTURE_MERGE_PRODUCT_ID = "66666666-6666-4666-8666-666666666666";
export const FIXTURE_BLOCK_PRODUCT_ID = "77777777-7777-4777-8777-777777777777";

function rankingEvidence(index: number) {
  return {
    candidate: {
      id: FIXTURE_CANDIDATE_IDS[index],
      source_name: "hwahae",
      external_type: "product",
      external_id: `external-${index + 1}`,
    },
    concerns: [
      {
        concern: "barrier",
        observation_count: 2,
        best_rank: index + 1,
        latest_rank: index + 2,
        latest_collected_at: `2026-07-${20 + index}T00:00:00.000Z`,
        observations: [
          {
            rank: index + 1,
            collected_at: `2026-07-${20 + index}T00:00:00.000Z`,
            service_category: index === 0 ? "treatment" : "moisturizer_cream",
            source_category_key: index === 0 ? "essence_ampoule_serum" : "cream",
            source_product_form: index === 0 ? "serum" : null,
          },
        ],
      },
    ],
    popularity: {
      observation_count: 1,
      best_rank: index + 5,
      latest_rank: index + 5,
      latest_collected_at: `2026-07-${20 + index}T00:00:00.000Z`,
      observations: [
        {
          rank: index + 5,
          collected_at: `2026-07-${20 + index}T00:00:00.000Z`,
          service_category: index === 0 ? "treatment" : "moisturizer_cream",
          source_category_key: index === 0 ? "essence_ampoule_serum" : "cream",
          source_product_form: index === 0 ? "serum" : null,
        },
      ],
    },
  };
}

function product(
  id: string,
  normalizedBrand: string,
  normalizedName: string,
): ExistingProductSnapshot {
  return {
    id,
    normalized_brand: normalizedBrand,
    normalized_name: normalizedName,
    brand: normalizedBrand,
    name: normalizedName,
    category: "moisturizer_cream",
    product_form: null,
  };
}

export const FIXTURE_PRODUCTS = [
  product(FIXTURE_MERGE_PRODUCT_ID, "merge brand", "merge cream"),
  product(FIXTURE_BLOCK_PRODUCT_ID, "blocked brand", "duplicate cream"),
];

export function createExportFixtureRecords(): ReviewExportSourceRecord[] {
  const definitions = [
    {
      rawBrand: "=FormulaBrand",
      rawName: "+Formula Serum",
      normalizedBrand: "formula brand",
      normalizedName: "formula serum",
      existing: null,
    },
    {
      rawBrand: "Merge Brand",
      rawName: "Merge Cream",
      normalizedBrand: "merge brand",
      normalizedName: "merge cream",
      existing: FIXTURE_PRODUCTS[0],
    },
    {
      rawBrand: "Deferred Brand",
      rawName: "Evidence Pending Cream",
      normalizedBrand: "deferred brand",
      normalizedName: "evidence pending cream",
      existing: null,
    },
    {
      rawBrand: "Blocked Brand",
      rawName: "Duplicate Cream",
      normalizedBrand: "blocked brand",
      normalizedName: "duplicate cream",
      existing: FIXTURE_PRODUCTS[1],
    },
    {
      rawBrand: "Stale Brand",
      rawName: "Stale Cream",
      normalizedBrand: "stale brand",
      normalizedName: "stale cream",
      existing: null,
    },
  ];

  return definitions.map((definition, index) => {
    const timestamp = `2026-07-${20 + index}T01:00:00.000Z`;
    const evidence = rankingEvidence(index);
    return {
      candidate: {
        id: FIXTURE_CANDIDATE_IDS[index],
        source_name: "hwahae",
        external_type: "product",
        external_id: `external-${index + 1}`,
        source_url: `https://example.com/products/${index + 1}`,
        category_path: index === 0 ? "treatment" : "moisturizer_cream",
        product_name_raw: definition.rawName,
        brand_name_raw: definition.rawBrand,
        normalized_name: definition.normalizedName,
        normalized_brand: definition.normalizedBrand,
        service_category: null,
        product_form: null,
        canonical_name: null,
        canonical_brand: null,
        review_status: "new",
        review_flags: ["missing_canonical_name", "missing_canonical_brand"],
        match_method: definition.existing ? "exact_normalized" : null,
        match_confidence: definition.existing ? 1 : null,
        matched_product_id: definition.existing?.id ?? null,
        duplicate_of_product_id: null,
        promotion_payload: null,
        promotion_version: "v1",
        updated_at: timestamp,
      },
      review: {
        candidate_id: FIXTURE_CANDIDATE_IDS[index],
        status: "queued",
        priority_score: 100 - index,
        selection_reason: "fixture ranking evidence",
        evidence_snapshot: evidence,
        rule_version: "fixture-v1",
        first_queued_at: timestamp,
        last_queued_at: timestamp,
        review_note: null,
        updated_at: timestamp,
      },
      rankingEvidence: evidence,
      existingProductMatch: definition.existing,
    };
  });
}

function blankReviewedRow(): ReviewedCsvRow {
  const row = Object.create(null) as ReviewedCsvRow;
  for (const header of REVIEWED_HEADERS) row[header] = "";
  return row;
}

function approveEvidence(sourceUrl: string, treatment: boolean) {
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
    evidence: Object.fromEntries(
      fields.map((field) => [field, { source_url: sourceUrl, note: "fixture" }]),
    ),
    confidence: Object.fromEntries(fields.map((field) => [field, "high"])),
  };
}

export function createIntakeFixture() {
  const records = createExportFixtureRecords();
  const batch = buildReviewExportBatch(records, {
    exportBatchId: FIXTURE_BATCH_ID,
    exportedAt: FIXTURE_EXPORTED_AT,
    sourceStatus: "queued",
  });
  const reviewedRows = batch.manifestRows.map((manifest) => {
    const row = blankReviewedRow();
    row.schema_version = "product-review-reviewed-v1";
    row.export_batch_id = manifest.export_batch_id;
    row.candidate_id = manifest.candidate_id;
    row.candidate_updated_at_expected = manifest.candidate_updated_at;
    row.review_queue_updated_at_expected = manifest.review_queue_updated_at;
    row.evidence_version_expected = manifest.evidence_version;
    row.row_integrity_hash = manifest.row_integrity_hash;
    row.evidence_jsonl_ref = manifest.evidence_jsonl_ref;
    row.review_confidence = "high";
    row.reviewed_at = FIXTURE_REVIEWED_AT;
    row.review_source_urls_json = JSON.stringify([
      `https://example.com/reviews/${manifest.candidate_id}`,
    ]);
    row.contradictions_json = "[]";
    return row;
  });

  const firstSource = `https://example.com/reviews/${FIXTURE_CANDIDATE_IDS[0]}`;
  const firstEvidence = approveEvidence(firstSource, true);
  Object.assign(reviewedRows[0], {
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
    field_evidence_json: JSON.stringify(firstEvidence.evidence),
    field_confidence_json: JSON.stringify(firstEvidence.confidence),
  });

  const secondSource = `https://example.com/reviews/${FIXTURE_CANDIDATE_IDS[1]}`;
  const secondEvidence = approveEvidence(secondSource, false);
  Object.assign(reviewedRows[1], {
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
    field_evidence_json: JSON.stringify(secondEvidence.evidence),
    field_confidence_json: JSON.stringify(secondEvidence.confidence),
  });

  Object.assign(reviewedRows[2], {
    review_decision: "defer",
    defer_reason: "missing_ingredient_evidence",
    sensitivity_safe: "unknown",
    review_note: "Ingredient evidence is not yet authoritative.",
  });
  Object.assign(reviewedRows[3], {
    review_decision: "block",
    block_reason: "duplicate_product",
    existing_product_match_id_reviewed: FIXTURE_BLOCK_PRODUCT_ID,
    review_note: "Confirmed duplicate.",
  });
  Object.assign(reviewedRows[4], {
    review_decision: "defer",
    defer_reason: "identity_unresolved",
    sensitivity_safe: "null",
    review_note: "Candidate will be stale in the negative fixture.",
  });

  const snapshot: IntakeDatabaseSnapshot = {
    candidates: new Map(
      records.map((record) => [
        record.candidate.id,
        {
          id: record.candidate.id,
          source_name: record.candidate.source_name,
          external_type: record.candidate.external_type,
          external_id: record.candidate.external_id,
          source_url: record.candidate.source_url,
          category_path: record.candidate.category_path,
          product_name_raw: record.candidate.product_name_raw,
          brand_name_raw: record.candidate.brand_name_raw,
          canonical_name: record.candidate.canonical_name,
          canonical_brand: record.candidate.canonical_brand,
          service_category: record.candidate.service_category,
          product_form: record.candidate.product_form,
          review_flags: record.candidate.review_flags ?? [],
          promotion_payload: record.candidate.promotion_payload,
          promotion_version: record.candidate.promotion_version,
          updated_at: record.candidate.updated_at,
          review_status: record.candidate.review_status,
          normalized_brand: record.candidate.normalized_brand,
          normalized_name: record.candidate.normalized_name,
          matched_product_id: record.candidate.matched_product_id,
          duplicate_of_product_id: record.candidate.duplicate_of_product_id,
        },
      ]),
    ),
    reviews: new Map(
      records.map((record) => [
        record.review.candidate_id,
        {
          candidate_id: record.review.candidate_id,
          status: record.review.status,
          rule_version: record.review.rule_version,
          evidence_snapshot: record.review.evidence_snapshot,
          updated_at: record.review.updated_at,
        },
      ]),
    ),
    products: new Map(FIXTURE_PRODUCTS.map((entry) => [entry.id, entry])),
  };

  return { records, batch, reviewedRows, snapshot };
}
