import "server-only";

import { createHash } from "crypto";
import "@/lib/server/recommendation-candidate-admission-runtime";
import { extractProductQueryIntent } from "@/lib/server/product-query-intent-service";
import { getRecommendationProducts } from "@/lib/product-source";
import {
  executeStructuredProductQuery,
  rankStructuredProductQueryFromProducts
} from "@/lib/product-query-recommendation";
import { PRODUCT_QUERY_INTENT_SCHEMA_VERSION } from "@/lib/product-query-intent-contract.mjs";

export const PRODUCT_QUERY_SHADOW_CONTRACT_VERSION = "product-query-shadow-v1";

function intent(overrides = {}) {
  return {
    schema_version: PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
    category: null,
    skin_type: null,
    concerns: [],
    sensitivity: null,
    texture: null,
    disliked_feel: null,
    sunscreen_intent: null,
    white_cast_hate: null,
    tone_up_wanted: null,
    eye_sensitive: null,
    makeup_use: null,
    outdoor_exposure: null,
    unresolved_terms: [],
    confidence: "high",
    ...overrides
  };
}

export const PRODUCT_QUERY_SHADOW_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "sunscreen_sparse_preferences",
    intent: Object.freeze(intent({
      category: "sunscreen",
      skin_type: "oily",
      concerns: ["oiliness"],
      texture: "watery",
      disliked_feel: "greasy",
      sunscreen_intent: true,
      white_cast_hate: true,
      tone_up_wanted: false
    })),
    expectedStatus: "ranked",
    expectedCategory: "sunscreen",
    expectedConstraintStatus: "resolved"
  }),
  Object.freeze({
    id: "moisturizer_explicit_context",
    intent: Object.freeze(intent({
      category: "moisturizer_cream",
      skin_type: "dry",
      concerns: ["dehydration", "barrier"],
      sensitivity: "high",
      texture: "cream"
    })),
    expectedStatus: "ranked",
    expectedCategory: "moisturizer_cream",
    expectedConstraintStatus: "resolved"
  }),
  Object.freeze({
    id: "category_only_fail_closed",
    intent: Object.freeze(intent({
      category: "cleanser",
      confidence: "medium"
    })),
    expectedStatus: "insufficient_supported_intent",
    expectedCategory: "cleanser",
    expectedConstraintStatus: "resolved"
  }),
  Object.freeze({
    id: "unresolved_constraint_preserved",
    intent: Object.freeze(intent({
      category: "treatment",
      concerns: ["acne"],
      unresolved_terms: ["pregnancy-safe"],
      confidence: "medium"
    })),
    expectedStatus: "ranked",
    expectedCategory: "treatment",
    expectedConstraintStatus: "partial",
    expectedUnresolvedTerm: "pregnancy-safe"
  })
]);

function stableExecutionProjection(result) {
  return {
    contractVersion: result?.contractVersion || null,
    status: result?.status || null,
    provenance: result?.provenance || null,
    effectiveCategory: result?.effectiveCategory || null,
    candidateCount: Number(result?.candidateCount || 0),
    rankableSignals: Array.isArray(result?.rankableSignals) ? [...result.rankableSignals] : [],
    constraintStatus: result?.constraintStatus || null,
    unresolvedTerms: Array.isArray(result?.unresolvedTerms) ? [...result.unresolvedTerms] : [],
    results: Array.isArray(result?.results)
      ? result.results.map((product) => ({
          id: product?.id || null,
          brand: product?.brand || null,
          name: product?.name || null,
          category: product?.category || null,
          score: Number(product?.score || 0),
          whyPicked: Array.isArray(product?.whyPicked) ? [...product.whyPicked] : [],
          cautionNote: product?.cautionNote || null
        }))
      : []
  };
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function checkScenario(scenario, result) {
  const failures = [];
  if (result.status !== scenario.expectedStatus) failures.push("status_mismatch");
  if (result.effectiveCategory !== scenario.expectedCategory) failures.push("category_mismatch");
  if (result.constraintStatus !== scenario.expectedConstraintStatus) {
    failures.push("constraint_status_mismatch");
  }
  if (result.candidateCount < 1) failures.push("empty_real_corpus_slice");
  if (scenario.expectedStatus === "ranked" && result.results.length < 1) {
    failures.push("ranked_result_missing");
  }
  if (scenario.expectedStatus === "insufficient_supported_intent" && result.results.length !== 0) {
    failures.push("insufficient_intent_ranked_anyway");
  }
  if (
    scenario.expectedUnresolvedTerm &&
    !result.unresolvedTerms.includes(scenario.expectedUnresolvedTerm)
  ) {
    failures.push("unresolved_term_lost");
  }
  if (
    result.results.some((product) =>
      scenario.expectedCategory && product.category !== scenario.expectedCategory
    )
  ) {
    failures.push("cross_category_result");
  }
  return failures;
}

export async function runStructuredProductQueryShadowEvaluation() {
  const products = await getRecommendationProducts();
  const scenarios = [];

  for (const scenario of PRODUCT_QUERY_SHADOW_SCENARIOS) {
    const pureResult = rankStructuredProductQueryFromProducts(
      scenario.intent,
      products,
      { limit: 5 }
    );
    const runtimeResult = await executeStructuredProductQuery(
      scenario.intent,
      { limit: 5 }
    );
    const pureProjection = stableExecutionProjection(pureResult);
    const runtimeProjection = stableExecutionProjection(runtimeResult);
    const pureFingerprint = fingerprint(pureProjection);
    const runtimeFingerprint = fingerprint(runtimeProjection);
    const failures = checkScenario(scenario, pureProjection);
    if (pureFingerprint !== runtimeFingerprint) failures.push("runtime_parity_mismatch");

    scenarios.push(Object.freeze({
      id: scenario.id,
      status: pureProjection.status,
      effectiveCategory: pureProjection.effectiveCategory,
      candidateCount: pureProjection.candidateCount,
      resultCount: pureProjection.results.length,
      constraintStatus: pureProjection.constraintStatus,
      unresolvedTerms: Object.freeze([...pureProjection.unresolvedTerms]),
      pureFingerprint,
      runtimeFingerprint,
      parity: pureFingerprint === runtimeFingerprint,
      pass: failures.length === 0,
      failures: Object.freeze(failures)
    }));
  }

  const allParity = scenarios.every((scenario) => scenario.parity);
  const allScenarioChecksPass = scenarios.every((scenario) => scenario.pass);

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_SHADOW_CONTRACT_VERSION,
    candidateCorpusCount: products.length,
    scenarioCount: scenarios.length,
    allParity,
    allScenarioChecksPass,
    scenarios: Object.freeze(scenarios)
  });
}

export async function runNaturalLanguageProductQueryShadow(query, options = {}) {
  const extracted = await extractProductQueryIntent(query, options);
  const execution = await executeStructuredProductQuery(extracted.intent, {
    limit: options.limit
  });

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_SHADOW_CONTRACT_VERSION,
    provenance: "query_only_shadow",
    provider: extracted.provider,
    model: extracted.model,
    intent: extracted.intent,
    execution,
    persisted: false
  });
}

export const PRODUCT_QUERY_SHADOW_LIMITS = Object.freeze({
  publicActivation: false,
  publicRoute: false,
  persistence: "none",
  profileRead: false,
  historyRead: false,
  productionWrite: false,
  recommendationLogWrite: false,
  directProductFactRead: false,
  taxonomyRuntimeAuthority: false,
  providerBackedAutomaticCiGate: false
});
