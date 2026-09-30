import { getRecommendationProducts } from "@/lib/product-source";
import {
  compareRankedProducts,
  filterSunscreenCandidates,
  scoreCanonicalProduct,
  scoreSunscreenProduct
} from "@/lib/recommendation-scoring";
import {
  buildProductQueryExecutionPlan,
  filterProductQueryCandidates,
  projectProductForQueryScoring
} from "@/lib/product-query-execution-contract.mjs";
import {
  selectProductQueryExplanationRefsForRankedProducts
} from "@/lib/product-query-explanation-contract.mjs";
import {
  applySunscreenSpfRuntimeGate
} from "@/lib/sunscreen-spf-runtime-gate.mjs";

const DEFAULT_RESULT_LIMIT = 5;
const MAX_RESULT_LIMIT = 10;

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_RESULT_LIMIT;
  return Math.min(parsed, MAX_RESULT_LIMIT);
}

function projectRankedResult(product, explanationRefs) {
  return Object.freeze({
    id: product.id,
    brand: product.brand,
    name: product.name,
    category: product.category,
    score: product.score,
    whyPicked: Object.freeze([...(product.why_picked || [])]),
    explanationRefs: Object.freeze([...(explanationRefs || [])]),
    matchedSignals: Object.freeze({ ...(product.matched_signals || {}) }),
    cautionNote: product.caution_note || null
  });
}

function isSpfRuntimeRequestEligible(plan, options) {
  return Boolean(
    plan?.effectiveCategory === "sunscreen" &&
    plan?.intent?.sunscreen_intent === true &&
    plan?.intent?.outdoor_exposure === true &&
    options?.spfRuntimeGate?.enabled === true
  );
}

function rankSunscreenCandidates(plan, candidates, options = {}) {
  const answers = plan.recommendationAnswers;
  const scoringCandidates = candidates.map((product) =>
    projectProductForQueryScoring(product, plan, { sunscreen: true })
  );
  const filtered = filterSunscreenCandidates(scoringCandidates, answers);
  const pool =
    filtered.strictCandidates.length > 0
      ? filtered.strictCandidates
      : filtered.penaltyOnlyCandidates;

  const baselineRanked = pool
    .map((product) => scoreSunscreenProduct(product, answers))
    .sort(compareRankedProducts);

  const gate = applySunscreenSpfRuntimeGate({
    rankedProducts: baselineRanked,
    enabled: options?.spfRuntimeGate?.enabled === true,
    sunscreenIntent: plan.intent.sunscreen_intent === true,
    outdoorExposure: plan.intent.outdoor_exposure === true,
    protectionByProductId:
      options?.spfRuntimeGate?.protectionByProductId || null
  });

  return Object.freeze({
    ranked: Object.freeze(
      [...gate.products].sort(compareRankedProducts)
    ),
    gate,
    rejectedIds: Object.freeze(
      (filtered.rejected || [])
        .map((product) => product?.id)
        .filter(Boolean)
        .sort()
    )
  });
}

function rankGeneralCandidates(plan, candidates) {
  const answers = plan.recommendationAnswers;
  return candidates
    .map((product) => projectProductForQueryScoring(product, plan))
    .map((product) => scoreCanonicalProduct(product, answers))
    .sort(compareRankedProducts);
}

function maybeAttachSpfGateEvidence(result, gate, options) {
  if (options?.includeRuntimeGateEvidence !== true || !gate) {
    return result;
  }

  return Object.freeze({
    ...result,
    runtimeGateEvidence: Object.freeze({
      spf: Object.freeze({
        version: gate.version,
        flagEnabled: gate.flagEnabled,
        requestEligible: gate.requestEligible,
        authorityComplete: gate.authorityComplete,
        axisApplied: gate.axisApplied,
        reason: gate.reason,
        missingProductIds: gate.missingProductIds,
        adjustments: gate.adjustments,
        limits: gate.limits
      })
    })
  });
}

export function rankStructuredProductQueryFromProducts(intent, products, options = {}) {
  const plan = buildProductQueryExecutionPlan(intent);
  const candidates = filterProductQueryCandidates(products, plan);
  const limit = normalizeLimit(options.limit);
  const spfRuntimeRequestEligible = isSpfRuntimeRequestEligible(
    plan,
    options
  );

  if (candidates.length === 0) {
    return Object.freeze({
      contractVersion: plan.contractVersion,
      status: "no_candidates",
      provenance: plan.provenance,
      effectiveCategory: plan.effectiveCategory,
      candidateCount: 0,
      rankableSignals: plan.rankableSignals,
      constraintStatus: plan.constraintStatus,
      unresolvedTerms: plan.unresolvedTerms,
      results: Object.freeze([])
    });
  }

  let sunscreenRanking = null;
  if (
    plan.effectiveCategory === "sunscreen" &&
    (plan.rankingEligible || spfRuntimeRequestEligible)
  ) {
    sunscreenRanking = rankSunscreenCandidates(
      plan,
      candidates,
      options
    );
  }

  const spfAxisApplied =
    sunscreenRanking?.gate?.axisApplied === true;

  if (!plan.rankingEligible && !spfAxisApplied) {
    return maybeAttachSpfGateEvidence(
      Object.freeze({
        contractVersion: plan.contractVersion,
        status: "insufficient_supported_intent",
        provenance: plan.provenance,
        effectiveCategory: plan.effectiveCategory,
        candidateCount: candidates.length,
        rankableSignals: plan.rankableSignals,
        constraintStatus: plan.constraintStatus,
        unresolvedTerms: plan.unresolvedTerms,
        results: Object.freeze([])
      }),
      sunscreenRanking?.gate || null,
      options
    );
  }

  const ranked =
    plan.effectiveCategory === "sunscreen"
      ? sunscreenRanking?.ranked || []
      : rankGeneralCandidates(plan, candidates);

  const rankableSignals = spfAxisApplied
    ? Object.freeze([
        ...new Set([...plan.rankableSignals, "outdoor_exposure"])
      ])
    : plan.rankableSignals;

  const topRanked = ranked.slice(0, limit);
  const explanationRefs =
    selectProductQueryExplanationRefsForRankedProducts(topRanked, plan, {
      maxReasons: 3
    });
  const results = topRanked.map((product, index) =>
    projectRankedResult(product, explanationRefs[index])
  );

  return maybeAttachSpfGateEvidence(
    Object.freeze({
      contractVersion: plan.contractVersion,
      status: results.length > 0 ? "ranked" : "no_safe_candidates",
      provenance: plan.provenance,
      effectiveCategory: plan.effectiveCategory,
      candidateCount: candidates.length,
      rankableSignals,
      constraintStatus: plan.constraintStatus,
      unresolvedTerms: plan.unresolvedTerms,
      results: Object.freeze(results)
    }),
    sunscreenRanking?.gate || null,
    options
  );
}

export async function executeStructuredProductQuery(intent, options = {}) {
  const products = await getRecommendationProducts();
  return rankStructuredProductQueryFromProducts(intent, products, options);
}

export const PRODUCT_QUERY_RECOMMENDATION_RUNTIME = Object.freeze({
  corpusAuthority: "getRecommendationProducts",
  candidateAdmissionAuthority: "production-recommendation-candidate-admission-v1",
  scorerAuthority: "existing_recommendation_scoring",
  spfRuntimeGateDefault: false,
  publicActivation: false,
  productionWrite: false
});
