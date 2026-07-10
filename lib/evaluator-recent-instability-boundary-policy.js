const BOUNDARY_DECISIONS = [
  "preserve_hard_block",
  "downgrade_to_collapsed_candidate",
  "requires_metadata_review",
  "not_applicable"
];

const FUTURE_INTEGRATION_HINTS = [
  "keep_evaluator_hard_block",
  "future_evaluator_pass_with_collapsed_hint",
  "needs_product_metadata_review",
  "no_evaluator_change"
];

const ACTIVE_AXES = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const STABILIZING_AXES = new Set(["hydration", "moisture_lock", "barrier_support", "soothing"]);
const STRONG_CAUTION_TAGS = new Set([
  "high_irritation_caution",
  "strong_active_caution",
  "retinoid_overlap_watch",
  "multiple_active_overlap_watch",
  "peeling_risk",
  "barrier_stress_watch",
  "sensitizing_active_watch"
]);

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeRisk(value) {
  const normalized = normalizeText(value);
  return ["low", "medium", "high"].includes(normalized) ? normalized : "unknown";
}

function normalizeBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function normalizeReasons(reasons = []) {
  return Array.from(new Set((Array.isArray(reasons) ? reasons : [])
    .map((reason) => normalizeText(reason))
    .filter(Boolean))).sort();
}

function addReason(reasons, reason) {
  if (reason && !reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function getFunctionalAxes(productProfile = {}) {
  return Array.isArray(productProfile.functionalAxes)
    ? productProfile.functionalAxes.filter((axis) => axis && typeof axis === "object")
    : [];
}

function hasActiveAxis(productProfile = {}) {
  return getFunctionalAxes(productProfile).some((axis) => ACTIVE_AXES.has(normalizeText(axis.axis)));
}

function hasStabilizingAxis(productProfile = {}) {
  return getFunctionalAxes(productProfile).some((axis) => STABILIZING_AXES.has(normalizeText(axis.axis)));
}

function hasFunctionalAxes(productProfile = {}) {
  return getFunctionalAxes(productProfile).length > 0;
}

function getCautionTags(productProfile = {}) {
  return normalizeReasons(productProfile.cautionTags);
}

function hasStrongCautionSignal(productProfile = {}) {
  return getCautionTags(productProfile).some((tag) => STRONG_CAUTION_TAGS.has(tag));
}

function hasRecentInstability(surveySafety = {}, goalPolicy = {}) {
  return surveySafety.recentSkinChange === "yes" ||
    surveySafety.recentlyChangedProduct === "yes" ||
    surveySafety.recentInstability === true ||
    goalPolicy.recentInstability === true;
}

function hasHighSensitivity(surveySafety = {}, goalPolicy = {}) {
  return surveySafety.sensitivityRisk === "high" ||
    surveySafety.highSensitivity === true ||
    goalPolicy.highSensitivity === true;
}

function hasRecentInstabilityBlock(candidateEvaluation = {}) {
  const reasons = normalizeReasons(candidateEvaluation.hardFilterReasons);
  return candidateEvaluation.hardFilterStatus === "blocked" &&
    reasons.includes("recent_instability_active_limited");
}

function hasIndependentHardBlockReason(candidateEvaluation = {}) {
  const reasons = normalizeReasons(candidateEvaluation.hardFilterReasons);
  return reasons.some((reason) =>
    reason !== "recent_instability_active_limited" &&
    reason !== "candidate_evaluator_blocked" &&
    reason !== "evaluator_blocked"
  );
}

function buildPolicyContext({ candidateEvaluation, surveySafety, goalPolicy, product, productProfile }) {
  return {
    hardFilterStatus: candidateEvaluation?.hardFilterStatus || null,
    hardFilterReasons: normalizeReasons(candidateEvaluation?.hardFilterReasons),
    rankingGoal: goalPolicy?.rankingGoal || null,
    safetyGoal: goalPolicy?.safetyGoal || null,
    recommendationGuard: goalPolicy?.recommendationGuard || null,
    category: normalizeText(product?.category) || null,
    irritationRisk: normalizeRisk(product?.irritation_risk),
    sensitivitySafe: normalizeBoolean(product?.sensitivity_safe),
    recentInstability: hasRecentInstability(surveySafety, goalPolicy),
    highSensitivity: hasHighSensitivity(surveySafety, goalPolicy),
    profileEvaluable: productProfile?.evaluable === false ? false : true,
    activeAxisPresent: hasActiveAxis(productProfile),
    stabilizingAxisPresent: hasStabilizingAxis(productProfile),
    functionalAxesPresent: hasFunctionalAxes(productProfile),
    cautionTags: getCautionTags(productProfile),
    strongCautionSignal: hasStrongCautionSignal(productProfile)
  };
}

function makeResult({
  applies,
  boundaryDecision,
  confidence,
  reasons,
  policyContext,
  futureIntegrationHint
}) {
  if (!BOUNDARY_DECISIONS.includes(boundaryDecision)) {
    throw new Error(`Invalid evaluator boundary decision: ${boundaryDecision}`);
  }

  if (!FUTURE_INTEGRATION_HINTS.includes(futureIntegrationHint)) {
    throw new Error(`Invalid evaluator boundary integration hint: ${futureIntegrationHint}`);
  }

  return {
    applies,
    boundaryDecision,
    confidence,
    reasons: normalizeReasons(reasons),
    policyContext,
    futureIntegrationHint
  };
}

function metadataIncomplete(policyContext) {
  return policyContext.irritationRisk === "unknown" ||
    policyContext.sensitivitySafe == null ||
    policyContext.profileEvaluable === false ||
    !policyContext.functionalAxesPresent;
}

export function resolveEvaluatorRecentInstabilityBoundaryPolicy({
  candidateEvaluation = {},
  surveySafety = {},
  goalPolicy = {},
  product = {},
  productProfile = {}
} = {}) {
  const policyContext = buildPolicyContext({
    candidateEvaluation,
    surveySafety,
    goalPolicy,
    product,
    productProfile
  });
  const reasons = [];

  if (!hasRecentInstabilityBlock(candidateEvaluation)) {
    return makeResult({
      applies: false,
      boundaryDecision: "not_applicable",
      confidence: "high",
      reasons: ["not_recent_instability_active_limited_block"],
      policyContext,
      futureIntegrationHint: "no_evaluator_change"
    });
  }

  if (!policyContext.recentInstability || !policyContext.highSensitivity) {
    return makeResult({
      applies: false,
      boundaryDecision: "not_applicable",
      confidence: "medium",
      reasons: ["required_safety_context_absent"],
      policyContext,
      futureIntegrationHint: "no_evaluator_change"
    });
  }

  if (hasIndependentHardBlockReason(candidateEvaluation)) {
    return makeResult({
      applies: false,
      boundaryDecision: "not_applicable",
      confidence: "high",
      reasons: ["independent_hard_filter_reason_present"],
      policyContext,
      futureIntegrationHint: "no_evaluator_change"
    });
  }

  if (metadataIncomplete(policyContext)) {
    if (policyContext.irritationRisk === "unknown") addReason(reasons, "irritation_risk_missing");
    if (policyContext.sensitivitySafe == null) addReason(reasons, "sensitivity_safe_missing");
    if (policyContext.profileEvaluable === false) addReason(reasons, "profile_not_evaluable");
    if (!policyContext.functionalAxesPresent) addReason(reasons, "functional_axes_missing");

    return makeResult({
      applies: true,
      boundaryDecision: "requires_metadata_review",
      confidence: "low",
      reasons,
      policyContext,
      futureIntegrationHint: "needs_product_metadata_review"
    });
  }

  addReason(reasons, "recent_instability_active_limited_block");
  addReason(reasons, "recent_instability_context");
  addReason(reasons, "high_sensitivity_context");
  if (policyContext.activeAxisPresent) addReason(reasons, "active_functional_axis");
  if (policyContext.stabilizingAxisPresent) addReason(reasons, "stabilizing_functional_axis");
  if (policyContext.irritationRisk === "low") addReason(reasons, "low_irritation_risk");
  if (policyContext.irritationRisk === "medium") addReason(reasons, "medium_irritation_risk");
  if (policyContext.irritationRisk === "high") addReason(reasons, "high_irritation_risk");
  if (policyContext.sensitivitySafe === true) addReason(reasons, "sensitivity_safe_true");
  if (policyContext.sensitivitySafe === false) addReason(reasons, "sensitivity_safe_false");
  if (policyContext.strongCautionSignal) addReason(reasons, "strong_product_caution_signal");

  if (
    policyContext.irritationRisk === "high" ||
    policyContext.sensitivitySafe === false ||
    policyContext.strongCautionSignal
  ) {
    return makeResult({
      applies: true,
      boundaryDecision: "preserve_hard_block",
      confidence: "high",
      reasons,
      policyContext,
      futureIntegrationHint: "keep_evaluator_hard_block"
    });
  }

  if (
    ["low", "medium"].includes(policyContext.irritationRisk) &&
    policyContext.sensitivitySafe === true
  ) {
    return makeResult({
      applies: true,
      boundaryDecision: "downgrade_to_collapsed_candidate",
      confidence: policyContext.cautionTags.length ? "high" : "medium",
      reasons,
      policyContext,
      futureIntegrationHint: "future_evaluator_pass_with_collapsed_hint"
    });
  }

  return makeResult({
    applies: true,
    boundaryDecision: "requires_metadata_review",
    confidence: "low",
    reasons: [...reasons, "safety_metadata_ambiguous"],
    policyContext,
    futureIntegrationHint: "needs_product_metadata_review"
  });
}

export const EVALUATOR_RECENT_INSTABILITY_BOUNDARY_POLICY_VALUES = {
  boundaryDecisions: BOUNDARY_DECISIONS,
  futureIntegrationHints: FUTURE_INTEGRATION_HINTS,
  activeAxes: Array.from(ACTIVE_AXES),
  stabilizingAxes: Array.from(STABILIZING_AXES),
  strongCautionTags: Array.from(STRONG_CAUTION_TAGS)
};
