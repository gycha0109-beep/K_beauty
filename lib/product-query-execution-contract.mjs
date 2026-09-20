import {
  PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
  buildRecommendationAnswersFromProductQueryIntent,
  validateProductQueryIntent
} from "./product-query-intent-contract.mjs";

export const PRODUCT_QUERY_EXECUTION_CONTRACT_VERSION = "product-query-execution-v1";

const QUERY_ONLY_FINISH_SENTINEL = "__query_unstated__";

function executionError(code, details = []) {
  const error = new Error(code);
  error.code = code;
  error.details = Object.freeze([...details]);
  return error;
}

function hasExplicitValue(intent, key) {
  if (key === "concerns") return Array.isArray(intent.concerns) && intent.concerns.length > 0;
  return intent[key] !== null;
}

function collectExplicitFields(intent) {
  const fields = [];
  for (const key of [
    "skin_type",
    "concerns",
    "sensitivity",
    "texture",
    "disliked_feel",
    "sunscreen_intent",
    "white_cast_hate",
    "tone_up_wanted",
    "eye_sensitive",
    "makeup_use",
    "outdoor_exposure"
  ]) {
    if (hasExplicitValue(intent, key)) fields.push(key);
  }
  return fields;
}

function collectRankableSignals(intent, effectiveCategory) {
  const signals = [];

  if (intent.skin_type !== null && intent.skin_type !== "not_sure") signals.push("skin_type");
  if (intent.concerns.length > 0) signals.push("concerns");
  if (intent.texture !== null) signals.push("texture");
  if (intent.disliked_feel !== null) signals.push("disliked_feel");

  if (effectiveCategory === "sunscreen") {
    if (intent.sensitivity === "high") signals.push("sensitivity");
    if (intent.white_cast_hate === true) signals.push("white_cast_hate");
    if (intent.tone_up_wanted !== null) signals.push("tone_up_wanted");
    if (intent.eye_sensitive === true) signals.push("eye_sensitive");
    if (intent.makeup_use === true) signals.push("makeup_use");
  } else if (intent.sensitivity !== null) {
    signals.push("sensitivity");
  }

  return Array.from(new Set(signals));
}

export function buildProductQueryExecutionPlan(intent) {
  const validation = validateProductQueryIntent(intent);
  if (!validation.ok) {
    throw executionError("PRODUCT_QUERY_EXECUTION_INTENT_INVALID", validation.errors);
  }

  const value = validation.value;
  if (
    value.sunscreen_intent === true &&
    value.category !== null &&
    value.category !== "sunscreen"
  ) {
    throw executionError("PRODUCT_QUERY_EXECUTION_CATEGORY_CONFLICT", [
      "sunscreen_intent_conflicts_with_category"
    ]);
  }

  const adapter = buildRecommendationAnswersFromProductQueryIntent(value);
  const effectiveCategory =
    value.category || (value.sunscreen_intent === true ? "sunscreen" : null);
  const explicitFields = collectExplicitFields(value);
  const rankableSignals = collectRankableSignals(value, effectiveCategory);
  const unresolvedTerms = [...value.unresolved_terms];

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_EXECUTION_CONTRACT_VERSION,
    intentContractVersion: PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
    provenance: "query_only",
    intent: value,
    effectiveCategory,
    recommendationAnswers: adapter.recommendationAnswers,
    scoringContext: Object.freeze({
      provenance: "query_only",
      explicitFields: Object.freeze(explicitFields)
    }),
    rankableSignals: Object.freeze(rankableSignals),
    rankingEligible: rankableSignals.length > 0,
    unresolvedTerms: Object.freeze(unresolvedTerms),
    constraintStatus: unresolvedTerms.length > 0 ? "partial" : "resolved"
  });
}

export function filterProductQueryCandidates(products, plan) {
  if (!Array.isArray(products)) {
    throw executionError("PRODUCT_QUERY_EXECUTION_CORPUS_INVALID");
  }
  if (!plan || plan.contractVersion !== PRODUCT_QUERY_EXECUTION_CONTRACT_VERSION) {
    throw executionError("PRODUCT_QUERY_EXECUTION_PLAN_INVALID");
  }

  const category = plan.effectiveCategory;
  return products.filter((product) => {
    if (!product?.id || !product?.name || !product?.brand || !product?.category) return false;
    return category ? product.category === category : true;
  });
}

export function projectProductForQueryScoring(product, plan, options = {}) {
  if (!product || typeof product !== "object") {
    throw executionError("PRODUCT_QUERY_EXECUTION_PRODUCT_INVALID");
  }
  if (!plan || plan.contractVersion !== PRODUCT_QUERY_EXECUTION_CONTRACT_VERSION) {
    throw executionError("PRODUCT_QUERY_EXECUTION_PLAN_INVALID");
  }

  const explicit = new Set(plan.scoringContext.explicitFields);
  const sunscreenMode = options.sunscreen === true;
  const concerns = plan.intent.concerns || [];
  const safetyRelevant =
    explicit.has("sensitivity") ||
    plan.intent.skin_type === "sensitive" ||
    (sunscreenMode && (concerns.includes("redness") || concerns.includes("barrier")));
  const finishRelevant =
    explicit.has("texture") ||
    explicit.has("disliked_feel") ||
    (sunscreenMode && explicit.has("skin_type"));
  const toneUpRelevant = explicit.has("tone_up_wanted");

  return {
    ...product,
    ...(safetyRelevant
      ? {}
      : {
          irritation_risk: "medium",
          sensitivity_safe: false
        }),
    ...(finishRelevant ? {} : { finish: QUERY_ONLY_FINISH_SENTINEL }),
    ...(sunscreenMode && !toneUpRelevant ? { tone_up: false } : {})
  };
}

export const PRODUCT_QUERY_EXECUTION_LIMITS = Object.freeze({
  publicActivation: false,
  profileMerge: false,
  historyRead: false,
  productionWrite: false,
  productFactDirectRead: false,
  taxonomyRuntimeAuthority: false,
  rankingAuthority: "existing_recommendation_engine"
});
