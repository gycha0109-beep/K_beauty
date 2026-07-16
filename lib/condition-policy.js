export const CONDITION_POLICY_VERSION = "condition-policy-v1";

const RESPONSE_LEVELS = new Set(["maintain", "reduce", "pause_optional"]);

function text(value) {
  return String(value || "").normalize("NFKC").trim();
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function yesNoUnknown(value) {
  if (value === true || ["yes", "true", "1"].includes(text(value).toLowerCase())) return "yes";
  if (value === false || ["no", "false", "0"].includes(text(value).toLowerCase())) return "no";
  return "unknown";
}

function getAnswers(context = {}) {
  return context?.survey?.answers && typeof context.survey.answers === "object"
    ? context.survey.answers
    : {};
}

function buildConditionSignals(context = {}) {
  if (context?.conditionSignalState && typeof context.conditionSignalState === "object") {
    return context.conditionSignalState;
  }

  const answers = getAnswers(context);
  const afternoon = text(answers.afternoonSkinChange).toLowerCase();
  const postWash = text(answers.postWashFeeling).toLowerCase();
  const explicitReaction = yesNoUnknown(answers.productReaction || answers.recentProductReaction);
  const explicitBreakout = yesNoUnknown(answers.breakoutIncrease || answers.recentBreakoutIncrease);
  const explicitFlaking = yesNoUnknown(answers.flakingIncrease || answers.recentFlakingIncrease);
  const knownCount = [afternoon, postWash, explicitReaction, explicitBreakout, explicitFlaking]
    .filter((value) => value && value !== "unknown").length;

  return {
    rednessOrIrritation: afternoon === "red_or_irritated" ? "yes" : afternoon ? "no" : "unknown",
    drynessOrTightness: postWash === "tight" || afternoon === "more_dry"
      ? "yes"
      : postWash || afternoon ? "no" : "unknown",
    oilinessIncrease: afternoon === "more_oily" ? "yes" : afternoon ? "no" : "unknown",
    breakoutIncrease: explicitBreakout,
    flakingIncrease: explicitFlaking,
    productReaction: explicitReaction,
    recentSkinChange: yesNoUnknown(answers.recentSkinChange || context?.safetyState?.recentSkinChange),
    recentProductChange: yesNoUnknown(answers.recentlyChangedProduct || context?.safetyState?.recentlyChangedProduct),
    completeness: knownCount >= 4 ? "complete" : knownCount ? "partial" : "minimal"
  };
}

function environmentActive(environment = {}) {
  return Boolean(
    environment.outdoorExposure ||
    environment.heatExposure ||
    environment.humidityExposure ||
    environment.airconExposure ||
    environment.maskExposure
  );
}

function scenario({
  conditionKey,
  triggerState,
  responseLevel,
  maintainRoles = [],
  reduceActions = [],
  pauseRoles = [],
  returnCriteria = [],
  escalationCriteria = [],
  reasonCodes = [],
  evidenceKeys = [],
  unknownReasons = [],
  confidence = "medium"
}) {
  return {
    conditionKey,
    triggerState,
    responseLevel: RESPONSE_LEVELS.has(responseLevel) ? responseLevel : "maintain",
    maintainRoles: unique(maintainRoles),
    reduceActions: unique(reduceActions),
    pauseRoles: unique(pauseRoles),
    returnCriteria: unique(returnCriteria),
    escalationCriteria: unique(escalationCriteria),
    reasonCodes: unique(reasonCodes),
    evidenceKeys: unique(evidenceKeys),
    unknownReasons: unique(unknownReasons),
    confidence
  };
}

function buildScenarios(context, signals) {
  const safety = context?.safetyState || {};
  const exposure = context?.productExposureState || {};
  const burden = context?.routineBurdenState || {};
  const environment = context?.environmentState || {};
  const stabilize = safety.level === "stabilize_first" || signals.productReaction === "yes";
  const sensitiveWatch = Boolean(safety.sensitiveBurden);
  const unknownProducts = Number(exposure.unknownProductCount || 0) > 0;
  const activeExposure = Boolean(exposure.activeExposurePresent);
  const activeStack = burden.activeStackBurden && burden.activeStackBurden !== "none";

  const rednessActive = signals.rednessOrIrritation === "yes";
  const rednessWatch = !rednessActive && sensitiveWatch;
  const drynessActive = signals.drynessOrTightness === "yes";
  const oilActive = signals.oilinessIncrease === "yes";
  const environmentBurden = environmentActive(environment);
  const reactionWatch = signals.productReaction === "yes" ||
    (signals.recentProductChange === "yes" && rednessActive);

  return [
    scenario({
      conditionKey: "redness_irritation",
      triggerState: rednessActive ? "active" : rednessWatch ? "watch" : signals.rednessOrIrritation === "unknown" ? "unknown" : "inactive",
      responseLevel: rednessActive && stabilize ? "pause_optional" : rednessActive || rednessWatch ? "reduce" : "maintain",
      maintainRoles: ["gentle_cleansing", "hydration", "barrier_support", "sun_protection"],
      reduceActions: rednessActive || rednessWatch ? ["friction", "heat_exposure", "layer_count"] : [],
      pauseRoles: rednessActive && stabilize ? ["optional_actives", "optional_exfoliation"] : [],
      returnCriteria: rednessActive ? ["redness_signal_resolved", "comfortable_for_several_days"] : [],
      escalationCriteria: rednessActive ? ["persistent_discomfort", "daily_life_interference", "worsening_reaction"] : [],
      reasonCodes: [
        ...(rednessActive ? ["explicit_redness_or_irritation"] : []),
        ...(rednessWatch ? ["sensitive_burden_watch"] : [])
      ],
      evidenceKeys: rednessActive ? ["survey:afternoon_skin_change"] : ["safety:sensitive_burden"],
      unknownReasons: signals.rednessOrIrritation === "unknown" ? ["acute_redness_signal_missing"] : [],
      confidence: rednessActive ? "high" : rednessWatch ? "medium" : "low"
    }),
    scenario({
      conditionKey: "dryness_tightness",
      triggerState: drynessActive ? "active" : signals.drynessOrTightness === "unknown" ? "unknown" : "inactive",
      responseLevel: drynessActive ? "reduce" : "maintain",
      maintainRoles: ["hydration", "barrier_support"],
      reduceActions: drynessActive ? ["cleansing_frequency", "cleansing_friction", "drying_finish"] : [],
      pauseRoles: drynessActive && stabilize ? ["optional_actives"] : [],
      returnCriteria: drynessActive ? ["tightness_signal_resolved", "comfortable_for_several_days"] : [],
      escalationCriteria: drynessActive ? ["persistent_discomfort", "worsening_reaction"] : [],
      reasonCodes: drynessActive ? ["explicit_dryness_or_tightness"] : [],
      evidenceKeys: drynessActive ? ["survey:post_wash_or_afternoon_change"] : [],
      unknownReasons: signals.drynessOrTightness === "unknown" ? ["acute_dryness_signal_missing"] : [],
      confidence: drynessActive ? "high" : "low"
    }),
    scenario({
      conditionKey: "oiliness_shift",
      triggerState: oilActive ? "active" : signals.oilinessIncrease === "unknown" ? "unknown" : "inactive",
      responseLevel: oilActive ? "reduce" : "maintain",
      maintainRoles: ["hydration", "sun_protection"],
      reduceActions: oilActive ? ["heavy_layer_count", "makeup_prep_layers"] : [],
      reasonCodes: oilActive ? ["explicit_oiliness_increase"] : [],
      evidenceKeys: oilActive ? ["survey:afternoon_skin_change"] : [],
      unknownReasons: signals.oilinessIncrease === "unknown" ? ["acute_oiliness_signal_missing"] : [],
      confidence: oilActive ? "high" : "low"
    }),
    scenario({
      conditionKey: "breakout_shift",
      triggerState: signals.breakoutIncrease === "yes" ? "active" : signals.breakoutIncrease === "unknown" ? "unknown" : "inactive",
      responseLevel: signals.breakoutIncrease === "yes" ? "reduce" : "maintain",
      maintainRoles: ["gentle_cleansing", "hydration", "sun_protection"],
      reduceActions: signals.breakoutIncrease === "yes" ? ["same_day_active_stacking", "friction"] : [],
      pauseRoles: signals.breakoutIncrease === "yes" && stabilize ? ["optional_actives"] : [],
      returnCriteria: signals.breakoutIncrease === "yes" ? ["breakout_signal_stable"] : [],
      escalationCriteria: signals.breakoutIncrease === "yes" ? ["rapid_worsening", "persistent_discomfort"] : [],
      reasonCodes: signals.breakoutIncrease === "yes" ? ["explicit_breakout_increase"] : [],
      evidenceKeys: signals.breakoutIncrease === "yes" ? ["survey:breakout_increase"] : [],
      unknownReasons: signals.breakoutIncrease === "unknown" ? ["breakout_change_not_observed"] : [],
      confidence: signals.breakoutIncrease === "yes" ? "high" : "low"
    }),
    scenario({
      conditionKey: "flaking_shift",
      triggerState: signals.flakingIncrease === "yes" ? "active" : signals.flakingIncrease === "unknown" ? "unknown" : "inactive",
      responseLevel: signals.flakingIncrease === "yes" ? "reduce" : "maintain",
      maintainRoles: ["hydration", "barrier_support"],
      reduceActions: signals.flakingIncrease === "yes" ? ["cleansing_friction", "optional_exfoliation"] : [],
      pauseRoles: signals.flakingIncrease === "yes" ? ["optional_exfoliation"] : [],
      returnCriteria: signals.flakingIncrease === "yes" ? ["flaking_signal_resolved"] : [],
      escalationCriteria: signals.flakingIncrease === "yes" ? ["worsening_reaction"] : [],
      reasonCodes: signals.flakingIncrease === "yes" ? ["explicit_flaking_increase"] : [],
      evidenceKeys: signals.flakingIncrease === "yes" ? ["survey:flaking_increase"] : [],
      unknownReasons: signals.flakingIncrease === "unknown" ? ["flaking_change_not_observed"] : [],
      confidence: signals.flakingIncrease === "yes" ? "high" : "low"
    }),
    scenario({
      conditionKey: "cleansing_burden",
      triggerState: burden.cleansingBurden === "elevated" ? "active" : burden.cleansingBurden === "unknown" ? "unknown" : "inactive",
      responseLevel: burden.cleansingBurden === "elevated" ? "reduce" : "maintain",
      maintainRoles: ["necessary_evening_cleansing"],
      reduceActions: burden.cleansingBurden === "elevated" ? ["cleansing_frequency", "cleansing_duration", "cleansing_friction"] : [],
      reasonCodes: burden.cleansingBurden === "elevated" ? ["cleansing_burden_elevated"] : [],
      evidenceKeys: burden.cleansingBurden === "elevated" ? ["routine_burden:cleansing"] : [],
      unknownReasons: burden.cleansingBurden === "unknown" ? ["cleansing_context_missing"] : [],
      confidence: burden.cleansingBurden === "unknown" ? "low" : "high"
    }),
    scenario({
      conditionKey: "active_exposure_burden",
      triggerState: activeExposure || activeStack ? "active" : unknownProducts ? "unknown" : "inactive",
      responseLevel: stabilize && activeExposure ? "pause_optional" : activeStack ? "reduce" : "maintain",
      maintainRoles: ["gentle_cleansing", "hydration", "barrier_support", "sun_protection"],
      reduceActions: activeStack ? ["same_day_active_stacking", "active_frequency"] : [],
      pauseRoles: stabilize && activeExposure ? ["optional_actives", "optional_exfoliation"] : [],
      returnCriteria: stabilize && activeExposure ? ["comfortable_for_several_days", "reaction_signal_resolved"] : [],
      escalationCriteria: reactionWatch ? ["worsening_reaction", "persistent_discomfort"] : [],
      reasonCodes: [
        ...(activeExposure ? ["active_exposure_present"] : []),
        ...(activeStack ? ["active_stack_burden"] : []),
        ...(unknownProducts ? ["product_evidence_incomplete"] : [])
      ],
      evidenceKeys: ["product_exposure:active", "routine_burden:active_stack"],
      unknownReasons: unknownProducts ? ["unknown_product_prevents_specific_stop_decision"] : [],
      confidence: unknownProducts ? "low" : activeExposure || activeStack ? "high" : "medium"
    }),
    scenario({
      conditionKey: "environment_recovery",
      triggerState: environmentBurden ? "active" : environment.completeness === "unknown" ? "unknown" : "inactive",
      responseLevel: environmentBurden ? "reduce" : "maintain",
      maintainRoles: ["gentle_cleansing", "hydration", "sun_protection"],
      reduceActions: environmentBurden ? ["heavy_layer_count", "friction", "heat_exposure"] : [],
      reasonCodes: environmentBurden ? ["environment_exposure_present"] : [],
      evidenceKeys: environmentBurden ? ["environment:exposure"] : [],
      unknownReasons: environment.completeness === "unknown" ? ["environment_context_missing"] : [],
      confidence: environmentBurden ? "high" : "low"
    }),
    scenario({
      conditionKey: "product_reaction_watch",
      triggerState: signals.productReaction === "yes" ? "active" : signals.recentProductChange === "yes" ? "watch" : signals.productReaction === "unknown" ? "unknown" : "inactive",
      responseLevel: signals.productReaction === "yes" ? "pause_optional" : reactionWatch ? "reduce" : "maintain",
      maintainRoles: ["gentle_cleansing", "hydration", "barrier_support", "sun_protection"],
      reduceActions: reactionWatch ? ["new_product_trials", "layer_count"] : [],
      pauseRoles: signals.productReaction === "yes" ? ["suspected_optional_product", "optional_actives"] : [],
      returnCriteria: signals.productReaction === "yes" ? ["reaction_signal_resolved", "comfortable_for_several_days"] : [],
      escalationCriteria: signals.productReaction === "yes" ? ["worsening_reaction", "persistent_discomfort", "daily_life_interference"] : [],
      reasonCodes: [
        ...(signals.productReaction === "yes" ? ["explicit_product_reaction"] : []),
        ...(signals.recentProductChange === "yes" ? ["recent_product_change_watch"] : [])
      ],
      evidenceKeys: signals.productReaction === "yes" ? ["survey:product_reaction"] : ["safety:recent_product_change"],
      unknownReasons: signals.productReaction === "unknown" ? ["reaction_link_not_confirmed"] : [],
      confidence: signals.productReaction === "yes" ? "high" : signals.recentProductChange === "yes" ? "medium" : "low"
    })
  ];
}

export function buildConditionPolicy(input = {}) {
  const context = input?.sharedContext || input?.context || input || {};
  const signals = buildConditionSignals(context);
  const scenarios = buildScenarios(context, signals);
  const safety = context?.safetyState || {};
  const hasPause = scenarios.some((item) => item.responseLevel === "pause_optional" && item.triggerState === "active");
  const hasAdjustment = scenarios.some((item) => item.responseLevel === "reduce" && ["active", "watch"].includes(item.triggerState));
  const unknownProducts = Number(context?.productExposureState?.unknownProductCount || 0) > 0;
  const responseMode = hasPause || safety.level === "stabilize_first"
    ? "stabilize"
    : hasAdjustment || safety.level === "caution" ? "adjust" : "steady";
  const available = context?.skinState?.priorityAxis || context?.survey?.completeness === "available";
  const confidence = !available || signals.completeness === "minimal"
    ? "low"
    : unknownProducts || signals.completeness === "partial" ? "medium" : "high";

  return {
    version: CONDITION_POLICY_VERSION,
    status: !available ? "insufficient_context" : confidence === "high" ? "available" : "partial",
    responseMode,
    conditionSignalState: signals,
    scenarios,
    invariants: {
      protectionMustMaintain: true,
      unknownProductStopForbidden: true,
      noNewActiveDuringStabilization: true,
      specificProductBlameRequiresReactionEvidence: true
    },
    reasonCodes: unique([
      ...(safety.reasonCodes || []),
      ...scenarios.flatMap((item) => item.reasonCodes)
    ]),
    evidenceKeys: unique(scenarios.flatMap((item) => item.evidenceKeys)),
    confidence
  };
}
