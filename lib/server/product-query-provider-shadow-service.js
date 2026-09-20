import "server-only";

import { createHash } from "crypto";
import {
  runNaturalLanguageProductQueryShadow
} from "@/lib/server/product-query-shadow-service";

export const PRODUCT_QUERY_PROVIDER_SHADOW_CONTRACT_VERSION =
  "product-query-provider-shadow-v1";

export const PRODUCT_QUERY_PROVIDER_SHADOW_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "ko_oily_no_cast_nonsticky_sunscreen",
    query: "지성인데 백탁 없고 끈적이지 않는 선크림 찾아줘.",
    expectedCategory: "sunscreen",
    expectedStatus: "ranked",
    requiredIntent: Object.freeze({
      category: "sunscreen",
      skin_type: "oily",
      disliked_feel: "sticky",
      sunscreen_intent: true,
      white_cast_hate: true
    })
  }),
  Object.freeze({
    id: "ko_dry_high_sensitivity_barrier_cream",
    query: "건성이고 피부 민감도가 높은 편이야. 장벽이 신경 쓰여서 크림 타입 보습제 찾아줘.",
    expectedCategory: "moisturizer_cream",
    expectedStatus: "ranked",
    requiredIntent: Object.freeze({
      category: "moisturizer_cream",
      skin_type: "dry",
      sensitivity: "high",
      texture: "cream"
    }),
    requiredConcern: "barrier"
  }),
  Object.freeze({
    id: "ko_category_only_cleanser",
    query: "클렌저 찾아줘.",
    expectedCategory: "cleanser",
    expectedStatus: "insufficient_supported_intent",
    requiredIntent: Object.freeze({
      category: "cleanser"
    }),
    requireSparseIntent: true
  }),
  Object.freeze({
    id: "ko_acne_treatment_pregnancy_unresolved",
    query: "여드름 때문에 쓸 트리트먼트 중에서 임산부도 안전한 제품 찾아줘.",
    expectedCategory: "treatment",
    expectedStatus: "ranked",
    requiredIntent: Object.freeze({
      category: "treatment"
    }),
    requiredConcern: "acne",
    requirePregnancyUnresolved: true
  })
]);

function normalizeTerm(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function hasPregnancyMeaning(terms) {
  return terms.some((term) => {
    const normalized = normalizeTerm(term);
    return (
      normalized.includes("pregnan") ||
      normalized.includes("임산") ||
      normalized.includes("임신")
    );
  });
}

function isSparseCategoryOnlyIntent(intent) {
  return (
    intent?.skin_type === null &&
    Array.isArray(intent?.concerns) &&
    intent.concerns.length === 0 &&
    intent?.sensitivity === null &&
    intent?.texture === null &&
    intent?.disliked_feel === null &&
    intent?.sunscreen_intent === null &&
    intent?.white_cast_hate === null &&
    intent?.tone_up_wanted === null &&
    intent?.eye_sensitive === null &&
    intent?.makeup_use === null &&
    intent?.outdoor_exposure === null &&
    Array.isArray(intent?.unresolved_terms) &&
    intent.unresolved_terms.length === 0
  );
}

function evaluateScenario(scenario, shadow) {
  const failures = [];
  const intent = shadow?.intent || {};
  const execution = shadow?.execution || {};

  for (const [key, expected] of Object.entries(scenario.requiredIntent || {})) {
    if (intent[key] !== expected) failures.push(`intent_${key}_mismatch`);
  }

  if (
    scenario.requiredConcern &&
    (!Array.isArray(intent.concerns) || !intent.concerns.includes(scenario.requiredConcern))
  ) {
    failures.push("required_concern_missing");
  }

  if (scenario.requireSparseIntent && !isSparseCategoryOnlyIntent(intent)) {
    failures.push("category_only_intent_hallucinated");
  }

  if (
    scenario.requirePregnancyUnresolved &&
    (!Array.isArray(intent.unresolved_terms) ||
      !hasPregnancyMeaning(intent.unresolved_terms))
  ) {
    failures.push("pregnancy_constraint_not_unresolved");
  }

  if (execution.effectiveCategory !== scenario.expectedCategory) {
    failures.push("execution_category_mismatch");
  }
  if (execution.status !== scenario.expectedStatus) {
    failures.push("execution_status_mismatch");
  }
  if (!Number.isInteger(execution.candidateCount) || execution.candidateCount < 1) {
    failures.push("real_corpus_slice_empty");
  }

  const results = Array.isArray(execution.results) ? execution.results : [];
  if (scenario.expectedStatus === "ranked" && results.length < 1) {
    failures.push("ranked_results_missing");
  }
  if (
    scenario.expectedStatus === "insufficient_supported_intent" &&
    results.length !== 0
  ) {
    failures.push("insufficient_intent_ranked_anyway");
  }
  if (
    results.some((product) => product?.category !== scenario.expectedCategory)
  ) {
    failures.push("cross_category_result");
  }

  if (scenario.requirePregnancyUnresolved && execution.constraintStatus !== "partial") {
    failures.push("unresolved_constraint_not_partial");
  }

  return failures;
}

function safeIntentProjection(intent) {
  return Object.freeze({
    category: intent?.category ?? null,
    skin_type: intent?.skin_type ?? null,
    concerns: Object.freeze(Array.isArray(intent?.concerns) ? [...intent.concerns] : []),
    sensitivity: intent?.sensitivity ?? null,
    texture: intent?.texture ?? null,
    disliked_feel: intent?.disliked_feel ?? null,
    sunscreen_intent: intent?.sunscreen_intent ?? null,
    white_cast_hate: intent?.white_cast_hate ?? null,
    tone_up_wanted: intent?.tone_up_wanted ?? null,
    eye_sensitive: intent?.eye_sensitive ?? null,
    makeup_use: intent?.makeup_use ?? null,
    outdoor_exposure: intent?.outdoor_exposure ?? null,
    unresolved_terms: Object.freeze(
      Array.isArray(intent?.unresolved_terms) ? [...intent.unresolved_terms] : []
    ),
    confidence: intent?.confidence ?? null
  });
}

export function getProductQueryProviderShadowScenarioIds() {
  return PRODUCT_QUERY_PROVIDER_SHADOW_SCENARIOS.map((scenario) => scenario.id);
}

export async function runProductQueryProviderShadowScenario(
  scenarioId,
  options = {}
) {
  const scenario = PRODUCT_QUERY_PROVIDER_SHADOW_SCENARIOS.find(
    (candidate) => candidate.id === scenarioId
  );
  if (!scenario) {
    const error = new Error("PRODUCT_QUERY_PROVIDER_SHADOW_SCENARIO_INVALID");
    error.code = "PRODUCT_QUERY_PROVIDER_SHADOW_SCENARIO_INVALID";
    throw error;
  }

  const shadow = await runNaturalLanguageProductQueryShadow(
    scenario.query,
    { model: options.model, limit: 5 }
  );
  const failures = evaluateScenario(scenario, shadow);
  const execution = shadow.execution;
  const intent = safeIntentProjection(shadow.intent);

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_PROVIDER_SHADOW_CONTRACT_VERSION,
    scenarioId: scenario.id,
    querySha256: createHash("sha256").update(scenario.query).digest("hex"),
    provider: shadow.provider,
    model: shadow.model,
    intent,
    execution: Object.freeze({
      status: execution.status,
      effectiveCategory: execution.effectiveCategory,
      candidateCount: execution.candidateCount,
      resultCount: Array.isArray(execution.results) ? execution.results.length : 0,
      rankableSignals: Object.freeze(
        Array.isArray(execution.rankableSignals) ? [...execution.rankableSignals] : []
      ),
      constraintStatus: execution.constraintStatus,
      unresolvedTerms: Object.freeze(
        Array.isArray(execution.unresolvedTerms) ? [...execution.unresolvedTerms] : []
      )
    }),
    persisted: false,
    pass: failures.length === 0,
    failures: Object.freeze(failures)
  });
}

export const PRODUCT_QUERY_PROVIDER_SHADOW_LIMITS = Object.freeze({
  arbitraryQueryInput: false,
  publicActivation: false,
  publicRoute: false,
  persistence: "none",
  profileRead: false,
  historyRead: false,
  productionWrite: false,
  recommendationLogWrite: false,
  directProductFactRead: false,
  taxonomyRuntimeAuthority: false,
  providerProductSelection: false,
  providerRankingAuthority: false
});
