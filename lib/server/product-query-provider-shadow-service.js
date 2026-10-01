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
    query: "건성이고 피부 민감도가 높은 편이야. 장벽이 신경 쓰여서 크림 보습제 찾아줘.",
    expectedCategory: "moisturizer_cream",
    expectedStatus: "ranked",
    requiredIntent: Object.freeze({
      category: "moisturizer_cream",
      skin_type: "dry",
      sensitivity: "high"
    }),
    requiredConcern: "barrier",
    requireNullIntentFields: Object.freeze(["texture"])
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
  }),
  Object.freeze({
    id: "ko_oily_fresh_afterfeel_cleanser",
    query: "지성피부인데 말끔한 세안감으로 세수하고 싶은데 폼클렌징 추천해줘라",
    expectedCategory: "cleanser",
    expectedStatus: "ranked",
    requiredIntent: Object.freeze({
      category: "cleanser",
      skin_type: "oily",
      preferred_finish: "fresh"
    }),
    requireNullIntentFields: Object.freeze(["post_wash_feeling"])
  }),
  Object.freeze({
    id: "ko_oily_temporary_sensitive_light_cream",
    query: "평소 피부 타입은 지성이야. 요즘은 일시적으로 피부 민감도가 높아졌어. 크림 추천해줘",
    expectedCategory: "moisturizer_cream",
    expectedStatus: "ranked",
    requiredIntent: Object.freeze({
      category: "moisturizer_cream",
      skin_type: "oily",
      sensitivity: "high",
      very_sensitive_period: true
    }),
    requireNullIntentFields: Object.freeze(["texture"])
  }),
  Object.freeze({
    id: "ko_tight_afterwash_oily_afternoon_cream",
    query: "세안 후엔 당기는데 오후엔 기름져. 자극 적고 가벼운 크림 찾아줘",
    expectedCategory: "moisturizer_cream",
    expectedStatus: "ranked",
    requiredIntent: Object.freeze({
      category: "moisturizer_cream",
      post_wash_feeling: "tight",
      afternoon_skin_change: "more_oily"
    }),
    requireNullIntentFields: Object.freeze(["texture"])
  }),
  Object.freeze({
    id: "ko_no_cast_bright_toneup_sunscreen",
    query: "백탁은 싫은데 얼굴은 밝아 보였으면 좋겠어. 선크림 추천해줘",
    expectedCategory: "sunscreen",
    expectedStatus: "ranked",
    requiredIntent: Object.freeze({
      category: "sunscreen",
      sunscreen_intent: true,
      white_cast_hate: true,
      tone_up_wanted: true
    }),
    requireNoToneUpConflictUnresolved: true
  }),
  Object.freeze({
    id: "ko_toneup_same_axis_conflict_sunscreen",
    query: "톤업은 싫은데 확실하게 톤업되는 선크림 찾아줘",
    expectedCategory: "sunscreen",
    expectedStatus: "insufficient_supported_intent",
    requiredIntent: Object.freeze({
      category: "sunscreen",
      sunscreen_intent: true,
      tone_up_wanted: null
    }),
    requireToneUpConflictUnresolved: true
  }),
  Object.freeze({
    id: "ko_eye_sensitive_no_cast_sunscreen",
    query: "눈이 엄청 예민한데 백탁 없는 선크림 추천해줘",
    expectedCategory: "sunscreen",
    expectedStatus: "ranked",
    requiredIntent: Object.freeze({
      category: "sunscreen",
      sunscreen_intent: true,
      white_cast_hate: true,
      eye_sensitive: true
    }),
    requireNullIntentFields: Object.freeze(["sensitivity"])
  }),
  Object.freeze({
    id: "ko_makeup_no_pilling_eye_sunscreen",
    query: "화장 전에 써도 밀리지 않고 눈도 안 시린 선크림 추천해줘",
    expectedCategory: "sunscreen",
    expectedStatus: "ranked",
    requiredIntent: Object.freeze({
      category: "sunscreen",
      sunscreen_intent: true,
      makeup_use: true,
      eye_sensitive: true
    })
  }),
  ...[400, 600, 800].map((outputBudget) =>
    Object.freeze({
      id: `ko_oily_temporary_sensitive_light_cream_budget_${outputBudget}`,
      query: "평소 피부 타입은 지성이야. 요즘은 일시적으로 피부 민감도가 높아졌어. 크림 추천해줘",
      outputBudget,
      expectedCategory: "moisturizer_cream",
      expectedStatus: "ranked",
      requiredIntent: Object.freeze({
        category: "moisturizer_cream",
        skin_type: "oily",
        sensitivity: "high",
        very_sensitive_period: true
      }),
      requireNullIntentFields: Object.freeze(["texture"])
    })
  )
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

function hasToneUpConflictMeaning(terms) {
  return terms.some((term) => {
    const normalized = normalizeTerm(term);
    const toneUp =
      normalized.includes("tone up") ||
      normalized.includes("toneup") ||
      normalized.includes("톤업") ||
      normalized.includes("톤 업");
    const conflict =
      normalized.includes("conflict") ||
      normalized.includes("contradict") ||
      normalized.includes("충돌") ||
      normalized.includes("상충") ||
      normalized.includes("모순");
    return toneUp && conflict;
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
    intent?.preferred_finish === null &&
    intent?.post_wash_feeling === null &&
    intent?.afternoon_skin_change === null &&
    intent?.very_sensitive_period === null &&
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

  for (const field of scenario.requireNullIntentFields || []) {
    if (intent[field] !== null) failures.push(`intent_${field}_must_be_null`);
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

  if (
    scenario.requireToneUpConflictUnresolved &&
    (!Array.isArray(intent.unresolved_terms) ||
      !hasToneUpConflictMeaning(intent.unresolved_terms))
  ) {
    failures.push("tone_up_conflict_not_unresolved");
  }

  if (
    scenario.requireNoToneUpConflictUnresolved &&
    Array.isArray(intent.unresolved_terms) &&
    hasToneUpConflictMeaning(intent.unresolved_terms)
  ) {
    failures.push("false_tone_up_conflict_preserved");
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

  if (scenario.requireToneUpConflictUnresolved && execution.constraintStatus !== "partial") {
    failures.push("tone_up_conflict_not_partial");
  }

  if (scenario.requireNoToneUpConflictUnresolved && execution.constraintStatus !== "resolved") {
    failures.push("independent_axes_not_resolved");
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
    preferred_finish: intent?.preferred_finish ?? null,
    post_wash_feeling: intent?.post_wash_feeling ?? null,
    afternoon_skin_change: intent?.afternoon_skin_change ?? null,
    very_sensitive_period: intent?.very_sensitive_period ?? null,
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

export function getProductQueryProviderShadowScenarioMetadata(scenarioId) {
  const scenario = PRODUCT_QUERY_PROVIDER_SHADOW_SCENARIOS.find(
    (candidate) => candidate.id === scenarioId
  );
  if (!scenario) return null;
  return Object.freeze({
    scenarioId: scenario.id,
    outputBudget: Number.isInteger(scenario.outputBudget)
      ? scenario.outputBudget
      : null
  });
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
    {
      model: options.model,
      limit: 5,
      maxOutputTokens:
        Number.isInteger(scenario.outputBudget)
          ? scenario.outputBudget
          : options.maxOutputTokens,
      incompleteRetry:
        Number.isInteger(scenario.outputBudget)
          ? false
          : options.incompleteRetry
    }
  );
  const failures = evaluateScenario(scenario, shadow);
  const execution = shadow.execution;
  const intent = safeIntentProjection(shadow.intent);

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_PROVIDER_SHADOW_CONTRACT_VERSION,
    scenarioId: scenario.id,
    outputBudget: Number.isInteger(scenario.outputBudget)
      ? scenario.outputBudget
      : null,
    querySha256: createHash("sha256").update(scenario.query).digest("hex"),
    provider: shadow.provider,
    model: shadow.model,
    providerAttempts: Number(shadow.providerAttempts || 1),
    providerRetryUsed: shadow.providerRetryUsed === true,
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
