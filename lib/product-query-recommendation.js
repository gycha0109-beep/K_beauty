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

const DEFAULT_RESULT_LIMIT = 5;
const MAX_RESULT_LIMIT = 10;

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_RESULT_LIMIT;
  return Math.min(parsed, MAX_RESULT_LIMIT);
}

function projectRankedResult(product) {
  return Object.freeze({
    id: product.id,
    brand: product.brand,
    name: product.name,
    category: product.category,
    score: product.score,
    whyPicked: Object.freeze([...(product.why_picked || [])]),
    matchedSignals: Object.freeze({ ...(product.matched_signals || {}) }),
    cautionNote: product.caution_note || null
  });
}

function rankSunscreenCandidates(plan, candidates) {
  const answers = plan.recommendationAnswers;
  const scoringCandidates = candidates.map((product) =>
    projectProductForQueryScoring(product, plan, { sunscreen: true })
  );
  const filtered = filterSunscreenCandidates(scoringCandidates, answers);
  const pool =
    filtered.strictCandidates.length > 0
      ? filtered.strictCandidates
      : filtered.penaltyOnlyCandidates;

  return pool
    .map((product) => scoreSunscreenProduct(product, answers))
    .sort(compareRankedProducts);
}

function rankGeneralCandidates(plan, candidates) {
  const answers = plan.recommendationAnswers;
  return candidates
    .map((product) => projectProductForQueryScoring(product, plan))
    .map((product) => scoreCanonicalProduct(product, answers))
    .sort(compareRankedProducts);
}

export function rankStructuredProductQueryFromProducts(intent, products, options = {}) {
  const plan = buildProductQueryExecutionPlan(intent);
  const candidates = filterProductQueryCandidates(products, plan);
  const limit = normalizeLimit(options.limit);

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

  if (!plan.rankingEligible) {
    return Object.freeze({
      contractVersion: plan.contractVersion,
      status: "insufficient_supported_intent",
      provenance: plan.provenance,
      effectiveCategory: plan.effectiveCategory,
      candidateCount: candidates.length,
      rankableSignals: plan.rankableSignals,
      constraintStatus: plan.constraintStatus,
      unresolvedTerms: plan.unresolvedTerms,
      results: Object.freeze([])
    });
  }

  const ranked =
    plan.effectiveCategory === "sunscreen"
      ? rankSunscreenCandidates(plan, candidates)
      : rankGeneralCandidates(plan, candidates);
  const results = ranked.slice(0, limit).map(projectRankedResult);

  return Object.freeze({
    contractVersion: plan.contractVersion,
    status: results.length > 0 ? "ranked" : "no_safe_candidates",
    provenance: plan.provenance,
    effectiveCategory: plan.effectiveCategory,
    candidateCount: candidates.length,
    rankableSignals: plan.rankableSignals,
    constraintStatus: plan.constraintStatus,
    unresolvedTerms: plan.unresolvedTerms,
    results: Object.freeze(results)
  });
}

export async function executeStructuredProductQuery(intent, options = {}) {
  const products = await getRecommendationProducts();
  return rankStructuredProductQueryFromProducts(intent, products, options);
}

export const PRODUCT_QUERY_RECOMMENDATION_RUNTIME = Object.freeze({
  corpusAuthority: "getRecommendationProducts",
  candidateAdmissionAuthority: "production-recommendation-candidate-admission-v1",
  scorerAuthority: "existing_recommendation_scoring",
  publicActivation: false,
  productionWrite: false
});
