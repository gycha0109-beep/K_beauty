const ACTIVE_FUNCTIONAL_AXES = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const STABILIZING_FUNCTIONAL_AXES = new Set(["hydration", "moisture_lock", "barrier_support", "soothing"]);
const VALID_DECISIONS = new Set([
  "no_guard",
  "allow_with_context",
  "soft_penalty_candidate",
  "collapsed_exposure_candidate",
  "hard_block_candidate",
  "insufficient_data"
]);

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeRisk(value) {
  const normalized = normalizeText(value);
  return ["low", "medium", "high"].includes(normalized) ? normalized : "unknown";
}

function addReason(reasons, reason) {
  if (reason && !reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function getFunctionalAxes(productProfile) {
  return Array.isArray(productProfile?.functionalAxes)
    ? productProfile.functionalAxes.filter((axis) => axis && typeof axis === "object")
    : [];
}

function hasActiveFunctionalAxis(productProfile) {
  return getFunctionalAxes(productProfile).some((axis) => ACTIVE_FUNCTIONAL_AXES.has(axis.axis));
}

function hasStabilizingFunctionalAxis(productProfile) {
  return getFunctionalAxes(productProfile).some((axis) => STABILIZING_FUNCTIONAL_AXES.has(axis.axis));
}

function hasFunctionalAxes(productProfile) {
  return getFunctionalAxes(productProfile).length > 0;
}

function hasCautionTagsField(productProfile) {
  return Array.isArray(productProfile?.cautionTags);
}

function hasProductSafetyMetadata(product) {
  return product && typeof product === "object" &&
    Object.prototype.hasOwnProperty.call(product, "irritation_risk") &&
    Object.prototype.hasOwnProperty.call(product, "sensitivity_safe");
}

function productSafetyMetadataComplete({ product, productProfile }) {
  return Boolean(
    product &&
    typeof product === "object" &&
    hasProductSafetyMetadata(product) &&
    hasFunctionalAxes(productProfile) &&
    hasCautionTagsField(productProfile) &&
    productProfile?.evaluable !== false
  );
}

function buildPolicyContext({ surveySafety, goalPolicy, product, productProfile }) {
  const activeAxisPresent = hasActiveFunctionalAxis(productProfile);

  return {
    rankingGoal: goalPolicy?.rankingGoal || null,
    safetyGoal: goalPolicy?.safetyGoal || null,
    recommendationGuard: goalPolicy?.recommendationGuard || null,
    category: normalizeText(product?.category) || null,
    categoryRole: productProfile?.categoryRole || null,
    activeAxisPresent,
    stabilizingAxisPresent: hasStabilizingFunctionalAxis(productProfile),
    productSafetyMetadataComplete: productSafetyMetadataComplete({ product, productProfile }),
    recentInstability:
      surveySafety?.recentSkinChange === "yes" ||
      surveySafety?.recentlyChangedProduct === "yes",
    highSensitivity: surveySafety?.sensitivityRisk === "high",
    irritationRisk: normalizeRisk(product?.irritation_risk),
    sensitivitySafe: typeof product?.sensitivity_safe === "boolean"
      ? product.sensitivity_safe
      : null
  };
}

function finish(output) {
  if (!VALID_DECISIONS.has(output.decision)) {
    throw new Error(`Invalid recent instability guard decision: ${output.decision}`);
  }

  output.reasons = [...output.reasons].sort();
  return output;
}

function result({ applies, guardLevel, decision, reasons, policyContext, implementationHint }) {
  return finish({
    applies,
    guardLevel,
    decision,
    reasons,
    policyContext,
    implementationHint
  });
}

export function resolveRecentInstabilityGuardPolicy({
  surveySafety = {},
  goalPolicy = {},
  product = {},
  productProfile = {}
} = {}) {
  const policyContext = buildPolicyContext({ surveySafety, goalPolicy, product, productProfile });
  const reasons = [];
  const irritationRisk = policyContext.irritationRisk;
  const sensitivitySafe = policyContext.sensitivitySafe;
  const recentInstability = policyContext.recentInstability;
  const highSensitivity = policyContext.highSensitivity;
  const stabilizeFirst = goalPolicy?.recommendationGuard === "stabilize_first";

  if (recentInstability) addReason(reasons, "recent_instability_detected");
  if (highSensitivity) addReason(reasons, "high_sensitivity_detected");
  if (stabilizeFirst) addReason(reasons, "stabilize_first_guard");
  if (goalPolicy?.safetyGoal === "redness") addReason(reasons, "redness_safety_goal");
  if (policyContext.activeAxisPresent) addReason(reasons, "active_functional_axis");
  if (policyContext.stabilizingAxisPresent) addReason(reasons, "stabilizing_functional_axis");
  if (irritationRisk === "high") addReason(reasons, "high_irritation_risk");
  if (irritationRisk === "medium") addReason(reasons, "medium_irritation_risk");
  if (irritationRisk === "low") addReason(reasons, "low_irritation_risk");
  if (sensitivitySafe === false) addReason(reasons, "sensitivity_safe_false");
  if (sensitivitySafe === true) addReason(reasons, "sensitivity_safe_true");

  const applies = Boolean(recentInstability || highSensitivity || stabilizeFirst);

  if (!applies) {
    return result({
      applies: false,
      guardLevel: "none",
      decision: "no_guard",
      reasons: ["safety_context_not_triggered"],
      policyContext,
      implementationHint: "collect_more_evidence"
    });
  }

  const metadataComplete = policyContext.productSafetyMetadataComplete;
  if (!metadataComplete) {
    addReason(reasons, "safety_metadata_incomplete");
    return result({
      applies: true,
      guardLevel: highSensitivity || recentInstability ? "medium" : "low",
      decision: "insufficient_data",
      reasons,
      policyContext,
      implementationHint: "needs_metadata_review"
    });
  }

  if (highSensitivity && irritationRisk === "high") {
    return result({
      applies: true,
      guardLevel: "high",
      decision: "hard_block_candidate",
      reasons,
      policyContext,
      implementationHint: "keep_hard_block"
    });
  }

  if (highSensitivity && sensitivitySafe === false) {
    return result({
      applies: true,
      guardLevel: "high",
      decision: "hard_block_candidate",
      reasons,
      policyContext,
      implementationHint: "keep_hard_block"
    });
  }

  if (recentInstability && irritationRisk === "high") {
    return result({
      applies: true,
      guardLevel: "high",
      decision: "hard_block_candidate",
      reasons,
      policyContext,
      implementationHint: "keep_hard_block"
    });
  }

  if (
    recentInstability &&
    highSensitivity &&
    policyContext.activeAxisPresent &&
    (irritationRisk === "high" || sensitivitySafe === false)
  ) {
    return result({
      applies: true,
      guardLevel: "high",
      decision: "hard_block_candidate",
      reasons,
      policyContext,
      implementationHint: "keep_hard_block"
    });
  }

  if (
    recentInstability &&
    sensitivitySafe === true &&
    ["low", "medium"].includes(irritationRisk)
  ) {
    return result({
      applies: true,
      guardLevel: irritationRisk === "low" ? "low" : "medium",
      decision: "collapsed_exposure_candidate",
      reasons,
      policyContext,
      implementationHint: "future_collapsed_exposure"
    });
  }

  if (highSensitivity && irritationRisk === "low" && sensitivitySafe === true) {
    return result({
      applies: true,
      guardLevel: "low",
      decision: "allow_with_context",
      reasons,
      policyContext,
      implementationHint: "collect_more_evidence"
    });
  }

  return result({
    applies: true,
    guardLevel: "low",
    decision: "allow_with_context",
    reasons,
    policyContext,
    implementationHint: "collect_more_evidence"
  });
}

export const RECENT_INSTABILITY_GUARD_POLICY_VALUES = {
  guardLevel: ["none", "low", "medium", "high"],
  decision: Array.from(VALID_DECISIONS),
  implementationHint: [
    "keep_hard_block",
    "future_soft_penalty",
    "future_collapsed_exposure",
    "collect_more_evidence",
    "needs_metadata_review"
  ],
  activeFunctionalAxes: Array.from(ACTIVE_FUNCTIONAL_AXES),
  stabilizingFunctionalAxes: Array.from(STABILIZING_FUNCTIONAL_AXES)
};
