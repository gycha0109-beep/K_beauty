const VALID_GOAL_AXES = new Set([
  "barrier",
  "dehydration",
  "oiliness",
  "redness",
  "acne",
  "pores",
  "uneven_tone",
  "uv"
]);

const SAFETY_LEAD_AXES = new Set(["barrier", "redness", "dehydration"]);

function normalizeAxis(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return VALID_GOAL_AXES.has(normalized) ? normalized : null;
}

function normalizePriorityAxis(priority) {
  if (typeof priority === "string") {
    return normalizeAxis(priority);
  }

  return normalizeAxis(priority?.axis || priority?.concern || priority?.primaryAxis);
}

function normalizeSafety(safety = {}) {
  return {
    sensitivityRisk: safety?.sensitivityRisk || "unknown",
    drynessRisk: safety?.drynessRisk || "unknown",
    rednessRisk: safety?.rednessRisk || "unknown",
    recentSkinChange: safety?.recentSkinChange || "unknown",
    recentlyChangedProduct: safety?.recentlyChangedProduct || "unknown"
  };
}

function hasHighSafetyRisk(safety, detectedPriority) {
  return (
    safety.sensitivityRisk === "high" ||
    safety.drynessRisk === "high" ||
    safety.rednessRisk === "high" ||
    safety.recentSkinChange === "yes" ||
    safety.recentlyChangedProduct === "yes" ||
    SAFETY_LEAD_AXES.has(detectedPriority)
  );
}

export function resolveFunctionalGoalPolicy({
  surveyContract = {},
  freeResultPriority = {},
  safety: safetyInput
} = {}) {
  const requestedConcern = normalizeAxis(surveyContract?.goals?.primaryConcern);
  const detectedPriority = normalizePriorityAxis(freeResultPriority);
  const safety = normalizeSafety(safetyInput || surveyContract?.safety || {});
  const hasTension = Boolean(
    requestedConcern && detectedPriority && requestedConcern !== detectedPriority
  );
  const highSafetyRisk = hasHighSafetyRisk(safety, detectedPriority);
  const rankingGoal = requestedConcern || detectedPriority || null;
  const safetyGoal = detectedPriority || requestedConcern || null;
  const recommendationGuard = highSafetyRisk ? "stabilize_first" : "normal";
  const tensionType = hasTension
    ? recommendationGuard === "stabilize_first"
      ? "requested_goal_vs_safety_priority"
      : "requested_goal_vs_detected_priority"
    : "none";
  const warnings = [];

  if (!requestedConcern) {
    warnings.push("primaryConcern_missing_policy_fallback");
  }

  if (!detectedPriority) {
    warnings.push("priority_axis_missing");
  }

  return {
    requestedConcern,
    detectedPriority,
    hasTension,
    tensionType,
    rankingGoal,
    safetyGoal,
    copyStrategy: {
      leadWith: requestedConcern ? "requestedConcern" : detectedPriority ? "detectedPriority" : "unknown",
      cautionWith: safetyGoal ? "safetyGoal" : "unknown",
      explainAs: hasTension ? "tension" : "aligned"
    },
    recommendationGuard,
    warnings
  };
}
