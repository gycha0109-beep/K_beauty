function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function buildPremiumSessionReportSource({ premiumReport, decision, freeResult }) {
  if (isRecord(premiumReport)) {
    return {
      ...premiumReport,
      freeResult
    };
  }

  if (!isRecord(decision)) {
    return null;
  }

  return {
    topPickDetailedReason: String(decision.topPick?.reason || ""),
    supportingConcerns: Array.isArray(decision.supportingConcerns)
      ? decision.supportingConcerns
      : [],
    supportingProducts: Array.isArray(decision.explanationProducts)
      ? decision.explanationProducts
      : Array.isArray(decision.products)
        ? decision.products
        : [],
    routineStructure: decision.routineStructure || null,
    photoObservations: decision.photoObservations || null,
    fullRoutine: {
      morning: Array.isArray(decision.morning) ? decision.morning : [],
      night: Array.isArray(decision.night) ? decision.night : []
    },
    avoidCombinations: Array.isArray(decision.avoid) ? decision.avoid : [],
    budgetAlternatives: Array.isArray(decision.altPicks) ? decision.altPicks : [],
    freeResult
  };
}
