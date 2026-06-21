import assert from "node:assert/strict";

import {
  prepareCandidateReview,
  type CandidateForReview,
  type MatchableProductRecord,
} from "./lib/review.js";
import { extractCandidateSourceContext } from "./lib/supabase.js";

function makeCandidate(overrides: Partial<CandidateForReview> = {}): CandidateForReview {
  return {
    id: "candidate-1",
    source_name: "hwahae",
    category_path: "essence",
    product_name_raw: "Fresh Calming Essence",
    brand_name_raw: "Brand",
    normalized_name: "fresh calming essence",
    normalized_brand: "brand",
    source_context_status: "missing",
    source_context_conflict: false,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<MatchableProductRecord> = {}): MatchableProductRecord {
  return {
    id: "product-1",
    name: "Fresh Calming Essence",
    brand: "Brand",
    normalized_name: "fresh calming essence",
    normalized_brand: "brand",
    category: "toner_essence",
    product_form: null,
    ...overrides,
  };
}

function hydrateFromEvidence(
  evidenceSnapshot: unknown,
  overrides: Partial<CandidateForReview> = {},
): CandidateForReview {
  return makeCandidate({
    ...extractCandidateSourceContext(evidenceSnapshot),
    ...overrides,
  });
}

function popularityEvidence(observations: Record<string, unknown>[]): Record<string, unknown> {
  return {
    concerns: [],
    popularity: {
      observations,
    },
  };
}

function concernEvidence(observations: Record<string, unknown>[]): Record<string, unknown> {
  return {
    concerns: [
      {
        concern_key: "barrier",
        observations,
      },
    ],
    popularity: {
      observations: [],
    },
  };
}

function assertUnresolved(prepared: ReturnType<typeof prepareCandidateReview>): void {
  assert.equal(prepared.serviceCategory, null);
  assert.equal(prepared.productForm, null);
  assert.equal(prepared.reviewFlags.includes("ambiguous_category"), true);
}

{
  const prepared = prepareCandidateReview(
    hydrateFromEvidence(
      popularityEvidence([
        {
          service_category: "treatment",
          source_product_form: "essence",
          source_category_key: "treatment/essence",
          collected_at: "2026-06-22T00:00:00.000Z",
        },
      ]),
    ),
    [],
  );

  assert.equal(prepared.serviceCategory, "treatment");
  assert.equal(prepared.productForm, "essence");
  assert.equal(prepared.reviewFlags.includes("ambiguous_category"), false);
  assert.equal(prepared.reviewFlags.includes("missing_product_form"), false);
}

{
  const prepared = prepareCandidateReview(
    hydrateFromEvidence(
      concernEvidence([
        {
          service_category: "toner_essence",
          source_product_form: null,
          source_category_key: "toner/prep",
          collected_at: "2026-06-22T00:00:00.000Z",
        },
      ]),
    ),
    [],
  );

  assert.equal(prepared.serviceCategory, "toner_essence");
  assert.equal(prepared.productForm, null);
  assert.equal(prepared.reviewFlags.includes("ambiguous_category"), false);
}

{
  const candidate = hydrateFromEvidence(popularityEvidence([]));
  const prepared = prepareCandidateReview(candidate, []);

  assert.equal(candidate.source_context_status, "missing");
  assertUnresolved(prepared);
}

{
  const candidate = hydrateFromEvidence("not-an-object");
  const prepared = prepareCandidateReview(candidate, []);

  assert.equal(candidate.source_context_status, "malformed");
  assertUnresolved(prepared);
}

{
  const candidate = hydrateFromEvidence(
    popularityEvidence([
      {
        rank: 1,
        collected_at: "2026-06-22T00:00:00.000Z",
      },
    ]),
  );
  const prepared = prepareCandidateReview(candidate, []);

  assert.equal(candidate.source_context_status, "incomplete");
  assertUnresolved(prepared);
}

for (const sourceProductForm of [null, undefined, "unknown"]) {
  const candidate = hydrateFromEvidence(
    popularityEvidence([
      {
        service_category: "treatment",
        source_product_form: sourceProductForm,
        source_category_key: "treatment/unknown",
        collected_at: "2026-06-22T00:00:00.000Z",
      },
    ]),
  );
  const prepared = prepareCandidateReview(candidate, []);

  assert.equal(candidate.source_context_status, "invalid_combination");
  assertUnresolved(prepared);
}

{
  const candidate = hydrateFromEvidence(
    concernEvidence([
      {
        service_category: "toner_essence",
        source_product_form: "essence",
        source_category_key: "toner/prep",
        collected_at: "2026-06-22T00:00:00.000Z",
      },
    ]),
  );
  const prepared = prepareCandidateReview(candidate, []);

  assert.equal(candidate.source_context_status, "invalid_combination");
  assertUnresolved(prepared);
}

{
  const candidate = hydrateFromEvidence({
    concerns: [
      {
        concern_key: "barrier",
        observations: [
          {
            service_category: "toner_essence",
            source_product_form: null,
            source_category_key: "toner/prep",
            collected_at: "2026-06-22T00:00:00.000Z",
          },
        ],
      },
    ],
    popularity: {
      observations: [
        {
          service_category: "treatment",
          source_product_form: "essence",
          source_category_key: "treatment/essence",
          collected_at: "2026-06-22T01:00:00.000Z",
        },
      ],
    },
  });
  const prepared = prepareCandidateReview(candidate, []);

  assert.equal(candidate.source_context_status, "conflict");
  assert.equal(candidate.source_context_conflict, true);
  assertUnresolved(prepared);
}

{
  const prepared = prepareCandidateReview(
    makeCandidate({
      source_context_status: "missing",
      source_service_category: null,
      source_product_form: null,
    }),
    [
      makeProduct({
        category: "essence",
        product_form: null,
      }),
    ],
  );

  assertUnresolved(prepared);
  assert.notEqual(prepared.serviceCategory, "treatment");
  assert.equal(prepared.matchedProductId, "product-1");
}

for (const productName of [
  "Bright Repair Serum",
  "Repair Ampoule",
  "Fresh Calming Essence",
]) {
  const prepared = prepareCandidateReview(
    makeCandidate({
      product_name_raw: productName,
      normalized_name: productName.toLowerCase(),
      source_context_status: "missing",
      source_service_category: null,
      source_product_form: null,
    }),
    [],
  );

  assertUnresolved(prepared);
  assert.notEqual(prepared.serviceCategory, "treatment");
}

{
  const prepared = prepareCandidateReview(
    hydrateFromEvidence(
      popularityEvidence([
        {
          service_category: "toner_essence",
          source_product_form: null,
          source_category_key: "toner/prep",
          collected_at: "2026-06-22T00:00:00.000Z",
        },
      ]),
    ),
    [
      makeProduct({
        category: "treatment",
        product_form: "essence",
      }),
    ],
  );

  assert.equal(prepared.serviceCategory, "toner_essence");
  assert.equal(prepared.productForm, null);
  assert.equal(prepared.matchedProductId, "product-1");
  assert.equal(prepared.reviewFlags.includes("ambiguous_category"), true);
}

{
  const prepared = prepareCandidateReview(
    makeCandidate({
      category_path: "sunscreen",
      product_name_raw: "Daily UV Sun Cream",
      normalized_name: "daily uv sun cream",
      source_context_status: "missing",
      source_service_category: null,
      source_product_form: null,
    }),
    [],
  );

  assertUnresolved(prepared);
}

console.log("review-prep source-context fail-closed checks passed");
