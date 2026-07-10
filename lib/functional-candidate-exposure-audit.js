import { buildCurrentProductFindings } from "./current-product-findings.js";
import { buildFunctionalCandidateAudit } from "./functional-candidate-audit.js";
import { resolveFunctionalGuardExposurePolicy } from "./functional-guard-exposure-policy.js";
import { evaluateFunctionalRankingCandidate } from "./functional-ranking-contract.js";
import { resolveProductFunctionalProfile } from "./product-functional-profile.js";
import { resolveRecentInstabilityGuardPolicy } from "./recent-instability-guard-policy.js";

const GROUP_KEYS = {
  primary_candidate: "primaryCandidates",
  contextual_candidate: "contextualCandidates",
  collapsed_candidate: "collapsedCandidates",
  hidden_candidate: "hiddenCandidates",
  insufficient_evidence_candidate: "insufficientEvidenceCandidates"
};
const EXPOSURE_STATUS_ORDER = Object.keys(GROUP_KEYS);

const ACTIVE_AXES = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const STABILIZING_AXES = new Set(["hydration", "moisture_lock", "barrier_support", "soothing"]);

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getProductId(product) {
  return String(product?.id || product?.productId || product?.product_id || "").trim() || null;
}

function normalizeCategory(category) {
  const value = normalizeText(category);

  if (!value) return "unknown";
  if (value === "serum" || value === "ampoule") return "serum";
  if (value === "essence" || value === "toner_essence") return "essence";
  if (value === "moisturizer" || value.startsWith("moisturizer_")) return "moisturizer";
  if (["treatment", "toner_pad", "sunscreen", "cleanser"].includes(value)) return value;
  return value;
}

function increment(map, key) {
  const normalized = key || "unknown";
  map[normalized] = (map[normalized] || 0) + 1;
}

function sortObject(input = {}) {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

function createGroupDistribution() {
  return {
    primaryCandidates: {},
    contextualCandidates: {},
    collapsedCandidates: {},
    hiddenCandidates: {},
    insufficientEvidenceCandidates: {}
  };
}

function incrementGrouped(distribution, groupKey, key) {
  if (!distribution[groupKey]) {
    distribution[groupKey] = {};
  }

  increment(distribution[groupKey], key);
}

function sortGrouped(distribution) {
  return Object.fromEntries(
    Object.entries(distribution).map(([groupKey, values]) => [groupKey, sortObject(values)])
  );
}

function reasonToKey(reason) {
  const normalized = normalizeText(reason);

  if (normalized.includes("high sensitivity") && normalized.includes("irritation")) {
    return "sensitivity_high_irritation_conflict";
  }

  if (normalized.includes("stabilize-first")) {
    return "stabilize_first_active_limited";
  }

  if (normalized.includes("recent instability")) {
    return "recent_instability_active_limited";
  }

  if (normalized.includes("eye sensitivity")) {
    return "sunscreen_eye_sting_conflict";
  }

  if (normalized.includes("white-cast")) {
    return "sunscreen_white_cast_conflict";
  }

  if (normalized.includes("makeup use")) {
    return "sunscreen_pilling_conflict";
  }

  if (normalized.includes("missing")) {
    return "product_required_field_missing";
  }

  if (normalized.includes("too sparse") || normalized.includes("not sufficient")) {
    return "structured_data_insufficient";
  }

  return normalized
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "unknown_reason";
}

function stableReasons(reasons = [], mapper = (reason) => reason) {
  return Array.from(new Set((Array.isArray(reasons) ? reasons : []).map(mapper).filter(Boolean))).sort();
}

function stableStringArray(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeText(value))
    .filter(Boolean))).sort();
}

function safetyMetadataProfile(product, productProfile) {
  const irritationRisk = normalizeText(product?.irritation_risk);
  const sensitivitySafe = typeof product?.sensitivity_safe === "boolean" ? product.sensitivity_safe : null;
  const profileComplete = productProfile?.evaluable !== false &&
    Array.isArray(productProfile?.functionalAxes) &&
    productProfile.functionalAxes.length > 0 &&
    Array.isArray(productProfile?.cautionTags);

  if (!irritationRisk || sensitivitySafe == null || !profileComplete) {
    return "metadata_incomplete";
  }

  if (sensitivitySafe === true && irritationRisk === "low") return "safe_low_risk";
  if (sensitivitySafe === true && irritationRisk === "medium") return "safe_medium_risk";
  if (sensitivitySafe === false && irritationRisk === "high") return "unsafe_high_risk";
  return "mixed_or_uncertain";
}

function functionalProfile(productProfile) {
  const axes = Array.isArray(productProfile?.functionalAxes) ? productProfile.functionalAxes : [];
  const hasActive = axes.some((axis) => ACTIVE_AXES.has(axis?.axis));
  const hasStabilizing = axes.some((axis) => STABILIZING_AXES.has(axis?.axis));

  if (hasActive && hasStabilizing) return "mixed";
  if (hasActive) return "active_leaning";
  if (hasStabilizing) return "stabilizing_leaning";
  return "unknown";
}

function evaluationStatus(evaluation) {
  if (evaluation?.hardFilterStatus === "blocked") return "blocked";
  if (evaluation?.hardFilterStatus === "insufficient_data") return "insufficient_data";
  if (evaluation?.eligible === true) return "eligible";
  return "not_eligible";
}

function normalizeFindings(input, goalPolicy) {
  if (Array.isArray(input)) {
    return input;
  }

  if (Array.isArray(input?.findings)) {
    return input.findings;
  }

  if (input && typeof input === "object" && Array.isArray(input.selections)) {
    return buildCurrentProductFindings({
      currentProducts: input,
      primaryGoal: goalPolicy?.rankingGoal || "",
      functionalDirection: goalPolicy?.rankingGoal || ""
    }).findings;
  }

  return [];
}

function selectCurrentProductFinding(product, findings) {
  const id = getProductId(product);

  if (id) {
    const direct = findings.find((finding) => finding?.productId === id);
    if (direct) return direct;
  }

  return findings.find((finding) => finding?.relationToPlan === "duplicate_axis") ||
    findings.find((finding) => finding?.relationToPlan === "supports_goal") ||
    findings.find((finding) => finding?.sourceState === "not_in_db") ||
    findings.find((finding) => finding?.sourceState === "unanswered") ||
    findings.find((finding) => finding?.sourceState === "not_using") ||
    null;
}

function makeRankMap(candidateAudit) {
  const map = new Map();

  for (const item of candidateAudit.rankedCandidates || []) {
    if (item?.evaluation?.productId) {
      map.set(item.evaluation.productId, item.rank);
    }
  }

  return map;
}

function makeExposureItem({ product, rank, evaluation, recentInstabilityGuardPolicy, exposurePolicy }) {
  return {
    productId: evaluation.productId || getProductId(product),
    category: normalizeCategory(product?.category || evaluation.rankingContext?.productCategory),
    rank,
    evaluation,
    recentInstabilityGuardPolicy,
    exposurePolicy
  };
}

function makeCandidateReviewRow({
  product,
  productProfile,
  evaluation,
  recentInstabilityGuardPolicy,
  exposurePolicy,
  goalPolicy,
  currentProductFinding
}) {
  const category = normalizeCategory(product?.category || evaluation?.rankingContext?.productCategory);
  const hardFilterStatus = evaluation?.hardFilterStatus || null;
  const guardDecision = recentInstabilityGuardPolicy?.decision || null;
  const guardPolicyContext = recentInstabilityGuardPolicy?.policyContext || {};
  const currentProductRelation =
    currentProductFinding?.relationToPlan ||
    currentProductFinding?.sourceState ||
    exposurePolicy?.policyContext?.currentProductRelation ||
    exposurePolicy?.policyContext?.currentProductSourceState ||
    "none";

  return {
    productId: evaluation?.productId || getProductId(product),
    category,
    exposureStatus: exposurePolicy?.exposureStatus || "unknown",
    visibilityPriority: exposurePolicy?.visibilityPriority || "normal",
    userMessageType: exposurePolicy?.userMessageType || "none",
    evaluationStatus: evaluationStatus(evaluation),
    hardFilterStatus,
    hardFilterReasons: stableReasons(evaluation?.hardFilterReasons, reasonToKey),
    guardDecision,
    guardLevel: recentInstabilityGuardPolicy?.guardLevel || "none",
    guardReasons: stableReasons(recentInstabilityGuardPolicy?.reasons),
    implementationHint: recentInstabilityGuardPolicy?.implementationHint || null,
    exposureReasons: stableReasons(exposurePolicy?.reasons),
    blockedBy: {
      evaluator: hardFilterStatus === "blocked",
      guardHardBlock: guardDecision === "hard_block_candidate"
    },
    confidence: evaluation?.confidence || "unknown",
    safetyMetadataProfile: safetyMetadataProfile(product, productProfile),
    functionalProfile: functionalProfile(productProfile),
    irritationRisk: guardPolicyContext.irritationRisk || normalizeText(product?.irritation_risk) || "unknown",
    sensitivitySafe: typeof guardPolicyContext.sensitivitySafe === "boolean"
      ? guardPolicyContext.sensitivitySafe
      : (typeof product?.sensitivity_safe === "boolean" ? product.sensitivity_safe : null),
    profileEvaluable: productProfile?.evaluable === false ? false : true,
    activeAxisPresent: guardPolicyContext.activeAxisPresent === true,
    stabilizingAxisPresent: guardPolicyContext.stabilizingAxisPresent === true,
    cautionTags: stableStringArray(productProfile?.cautionTags),
    rankingGoal:
      goalPolicy?.rankingGoal ||
      evaluation?.rankingContext?.rankingGoal ||
      recentInstabilityGuardPolicy?.policyContext?.rankingGoal ||
      null,
    safetyGoal:
      goalPolicy?.safetyGoal ||
      evaluation?.rankingContext?.safetyGoal ||
      recentInstabilityGuardPolicy?.policyContext?.safetyGoal ||
      null,
    recommendationGuard:
      goalPolicy?.recommendationGuard ||
      evaluation?.rankingContext?.recommendationGuard ||
      recentInstabilityGuardPolicy?.policyContext?.recommendationGuard ||
      null,
    currentProductRelation,
    safetyContext: {
      highSensitivity: recentInstabilityGuardPolicy?.policyContext?.highSensitivity === true,
      recentInstability: recentInstabilityGuardPolicy?.policyContext?.recentInstability === true
    }
  };
}

function sortCandidateReviewRows(rows) {
  return rows.sort((left, right) => {
    const leftStatus = EXPOSURE_STATUS_ORDER.indexOf(left.exposureStatus);
    const rightStatus = EXPOSURE_STATUS_ORDER.indexOf(right.exposureStatus);
    const statusDelta = (leftStatus === -1 ? Number.MAX_SAFE_INTEGER : leftStatus) -
      (rightStatus === -1 ? Number.MAX_SAFE_INTEGER : rightStatus);
    if (statusDelta) return statusDelta;

    const categoryDelta = String(left.category || "").localeCompare(String(right.category || ""));
    if (categoryDelta) return categoryDelta;

    return String(left.productId || "").localeCompare(String(right.productId || ""));
  });
}

function sortExposureItems(items) {
  return items.sort((left, right) => {
    const leftRank = Number.isFinite(Number(left.rank)) ? Number(left.rank) : Number.POSITIVE_INFINITY;
    const rightRank = Number.isFinite(Number(right.rank)) ? Number(right.rank) : Number.POSITIVE_INFINITY;

    if (leftRank !== rightRank) return leftRank - rightRank;

    const scoreDelta = (right.evaluation?.totalScore ?? -1) - (left.evaluation?.totalScore ?? -1);
    if (scoreDelta !== 0) return scoreDelta;

    return String(left.productId || "").localeCompare(String(right.productId || ""));
  });
}

function rankingContext(goalPolicy = {}) {
  return {
    rankingGoal: goalPolicy?.rankingGoal || null,
    safetyGoal: goalPolicy?.safetyGoal || null,
    recommendationGuard: goalPolicy?.recommendationGuard || "normal",
    hasTension: Boolean(goalPolicy?.hasTension)
  };
}

export function buildFunctionalCandidateExposureAudit({
  products,
  surveyContract = {},
  goalPolicy = {},
  currentProductFindings = null,
  options = {}
} = {}) {
  const candidateAudit = buildFunctionalCandidateAudit({
    products,
    surveyContract,
    goalPolicy,
    currentProductFindings,
    options: {
      includeBlocked: true,
      includeInsufficientData: true,
      maxRankedCandidates: Array.isArray(products) ? products.length : 0,
      ...(options.candidateAuditOptions || {})
    }
  });
  const rankMap = makeRankMap(candidateAudit);
  const findings = normalizeFindings(currentProductFindings, goalPolicy);
  const groups = {
    primaryCandidates: [],
    contextualCandidates: [],
    collapsedCandidates: [],
    hiddenCandidates: [],
    insufficientEvidenceCandidates: []
  };
  const exposureStatusDistribution = {};
  const userMessageTypeDistribution = {};
  const guardLevelDistribution = {};
  const implementationHintDistribution = {};
  const categoryDistribution = createGroupDistribution();
  const functionalProfileDistribution = createGroupDistribution();
  const safetyMetadataProfileDistribution = createGroupDistribution();
  const currentProductRelationDistribution = createGroupDistribution();
  const candidateReviewRows = [];
  let evaluatedCount = 0;
  let skippedCount = 0;

  for (const product of Array.isArray(products) ? products : []) {
    if (!product || typeof product !== "object") {
      skippedCount += 1;
      continue;
    }

    const productProfile = resolveProductFunctionalProfile(product);
    const evaluation = evaluateFunctionalRankingCandidate({
      product,
      surveyContract,
      goalPolicy,
      productProfile,
      currentProductFindings
    });
    const recentInstabilityGuardPolicy = resolveRecentInstabilityGuardPolicy({
      surveySafety: surveyContract?.safety || {},
      goalPolicy,
      product,
      productProfile
    });
    const currentProductFinding = selectCurrentProductFinding(product, findings);
    const exposurePolicy = resolveFunctionalGuardExposurePolicy({
      candidateEvaluation: evaluation,
      recentInstabilityGuardPolicy,
      goalPolicy,
      currentProductFinding
    });
    const groupKey = GROUP_KEYS[exposurePolicy.exposureStatus];

    if (!groupKey) {
      skippedCount += 1;
      continue;
    }

    evaluatedCount += 1;
    const item = makeExposureItem({
      product,
      rank: rankMap.get(evaluation.productId) || null,
      evaluation,
      recentInstabilityGuardPolicy,
      exposurePolicy
    });

    groups[groupKey].push(item);
    candidateReviewRows.push(makeCandidateReviewRow({
      product,
      productProfile,
      evaluation,
      recentInstabilityGuardPolicy,
      exposurePolicy,
      goalPolicy,
      currentProductFinding
    }));
    increment(exposureStatusDistribution, exposurePolicy.exposureStatus);
    increment(userMessageTypeDistribution, exposurePolicy.userMessageType);
    increment(guardLevelDistribution, recentInstabilityGuardPolicy.guardLevel);
    increment(implementationHintDistribution, recentInstabilityGuardPolicy.implementationHint);
    incrementGrouped(categoryDistribution, groupKey, item.category);
    incrementGrouped(functionalProfileDistribution, groupKey, functionalProfile(productProfile));
    incrementGrouped(safetyMetadataProfileDistribution, groupKey, safetyMetadataProfile(product, productProfile));
    incrementGrouped(
      currentProductRelationDistribution,
      groupKey,
      currentProductFinding?.relationToPlan || currentProductFinding?.sourceState || "none"
    );
  }

  Object.values(groups).forEach(sortExposureItems);
  sortCandidateReviewRows(candidateReviewRows);

  return {
    ...groups,
    candidateReviewRows,
    summary: {
      totalInputCount: Array.isArray(products) ? products.length : 0,
      evaluatedCount,
      candidateReviewRowCount: candidateReviewRows.length,
      primaryCount: groups.primaryCandidates.length,
      contextualCount: groups.contextualCandidates.length,
      collapsedCount: groups.collapsedCandidates.length,
      hiddenCount: groups.hiddenCandidates.length,
      insufficientEvidenceCount: groups.insufficientEvidenceCandidates.length,
      skippedCount,
      exposureStatusDistribution: sortObject(exposureStatusDistribution),
      userMessageTypeDistribution: sortObject(userMessageTypeDistribution),
      guardLevelDistribution: sortObject(guardLevelDistribution),
      implementationHintDistribution: sortObject(implementationHintDistribution),
      categoryDistribution: sortGrouped(categoryDistribution),
      functionalProfileDistribution: sortGrouped(functionalProfileDistribution),
      safetyMetadataProfileDistribution: sortGrouped(safetyMetadataProfileDistribution),
      currentProductRelationDistribution: sortGrouped(currentProductRelationDistribution),
      rankingContext: rankingContext(goalPolicy),
      candidateAuditSummary: candidateAudit.summary,
      policyNotes: [
        "This result is a shadow-only audit.",
        "This result does not replace existing recommendation results.",
        "Collapsed candidate is not a product-unsuitable judgment.",
        "Insufficient evidence is not lower product quality.",
        "Hidden candidate may reflect current-condition and safety-guard exposure exclusion."
      ]
    }
  };
}
