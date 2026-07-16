export const CROSS_DOMAIN_CONSISTENCY_VERSION = "cross-domain-consistency-v1";

const ACTIVE_DIRECTIONS = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const STOP_ACTIONS = new Set(["hold", "remove", "replace", "stop"]);
const REDUCED_PROTECTION_ACTIONS = new Set(["reduce", "hold", "remove", "omit"]);

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function step(policy, key) {
  const windows = policy?.windows || {};
  return [...(windows?.morning?.steps || []), ...(windows?.evening?.steps || [])]
    .find((item) => item?.stepKey === key) || null;
}

function activeRoutineAllowed(routinePolicy = {}) {
  const treatment = step(routinePolicy, "pm.treatment");
  return number(routinePolicy?.weeklySchedule?.activeDaysMax) > 0 ||
    number(treatment?.frequencyCap?.maximum) > 0 ||
    (treatment && treatment.requirement !== "omit" && ["maintain", "reduce"].includes(treatment.action)) ||
    (routinePolicy?.introductionOrder || []).some((item) => item?.role === "functional_leave_on");
}

function activeStackGuardPresent(routinePolicy = {}) {
  return (routinePolicy?.prohibitedSameWindow || []).some((item) =>
    (item?.reasonCodes || []).includes("active_stack_burden") ||
    (item?.axes || []).includes("multiple_active_axes")
  );
}

function reactionEvidence(sharedContext = {}) {
  return sharedContext?.conditionSignalState?.productReaction === "yes";
}

function productActionFor(policy = {}, row = {}) {
  const actions = policy?.productActions || [];
  return actions.filter((item) => {
    if (row?.productId && item?.productId) return String(item.productId) === String(row.productId);
    return !row?.productId && item?.slotKey && (row?.routineSlots || []).includes(item.slotKey);
  });
}

function violation(ruleId, severity, domains, paths, reasonCodes, evidenceKeys = [], unknownReasons = []) {
  return {
    ruleId,
    severity,
    domains,
    paths,
    reasonCodes: unique(reasonCodes),
    evidenceKeys: unique(evidenceKeys),
    unknownReasons: unique(unknownReasons),
    resolution: severity === "critical" ? "stabilization_fallback" : "confidence_cap"
  };
}

function inspect({ sharedContext = {}, functionalPolicy = {}, routinePolicy = {}, conditionPolicy = {} }) {
  const violations = [];
  const safety = sharedContext?.safetyState || {};
  const exposure = sharedContext?.productExposureState || {};
  const burden = sharedContext?.routineBurdenState || {};
  const activeDirection = ACTIVE_DIRECTIONS.has(functionalPolicy?.functionalDirection);
  const treatment = step(routinePolicy, "pm.treatment");
  const sunscreen = step(routinePolicy, "am.sunscreen");
  const protectionRequired = Boolean(
    safety?.protectionMustMaintain ||
    functionalPolicy?.safety?.protectionMustMaintain ||
    routinePolicy?.invariants?.protectionMustMaintain ||
    conditionPolicy?.invariants?.protectionMustMaintain
  );
  const contextAvailable = Boolean(
    sharedContext?.skinState?.priorityAxis ||
    sharedContext?.survey?.completeness === "available" ||
    Object.keys(sharedContext?.skinState?.concernScores || {}).length
  );

  if (!contextAvailable) {
    violations.push(violation(
      "CONSISTENCY_CONTEXT_INSUFFICIENT", "critical",
      ["context"], ["sharedContext.skinState", "sharedContext.survey"],
      ["canonical_context_insufficient"], [], ["priority_and_concern_context_missing"]
    ));
  }

  if (safety?.level === "stabilize_first" && activeDirection && (
    functionalPolicy?.status === "now" ||
    functionalPolicy?.planMode === "START" ||
    functionalPolicy?.allowedIntensity !== "hold" ||
    functionalPolicy?.recommendationSuppressed !== true
  )) {
    violations.push(violation(
      "CONSISTENCY_SAFETY_ACTIVE_EXPANSION", "critical",
      ["context", "functional"], ["sharedContext.safetyState.level", "functionalPolicy"],
      ["stabilize_first_active_expansion"]
    ));
  }

  if (activeDirection && ["pause", "HOLD", "hold"].includes(
    functionalPolicy?.status === "pause" ? "pause" : functionalPolicy?.planMode === "HOLD" ? "HOLD" : functionalPolicy?.allowedIntensity
  ) && activeRoutineAllowed(routinePolicy)) {
    violations.push(violation(
      "CONSISTENCY_FUNCTIONAL_HOLD_ROUTINE_ACTIVE", "critical",
      ["functional", "routine"], ["functionalPolicy.planMode", "routinePolicy.weeklySchedule.activeDaysMax", "routinePolicy.windows.evening.steps"],
      ["functional_hold_routine_active"]
    ));
  }

  if (functionalPolicy?.recommendationSuppressed === true && activeRoutineAllowed(routinePolicy)) {
    violations.push(violation(
      "CONSISTENCY_FUNCTIONAL_SUPPRESSED_ROUTINE_ACTIVE", "critical",
      ["functional", "routine"], ["functionalPolicy.recommendationSuppressed", "routinePolicy"],
      ["suppressed_functional_routine_active"]
    ));
  }

  if (conditionPolicy?.responseMode === "stabilize" && activeRoutineAllowed(routinePolicy)) {
    violations.push(violation(
      "CONSISTENCY_CONDITION_STABILIZE_ROUTINE_ACTIVE", "critical",
      ["condition", "routine"], ["conditionPolicy.responseMode", "routinePolicy.weeklySchedule.activeDaysMax"],
      ["condition_stabilize_routine_active"]
    ));
  }

  const activeScenarios = (conditionPolicy?.scenarios || []).filter((item) => ["active", "watch"].includes(item?.triggerState));
  const pauseRoles = new Set(activeScenarios.flatMap((item) => item?.pauseRoles || []));
  if (["optional_actives", "optional_exfoliation", "suspected_optional_product"].some((role) => pauseRoles.has(role)) && activeRoutineAllowed(routinePolicy)) {
    violations.push(violation(
      "CONSISTENCY_CONDITION_PAUSE_ROLE_MAINTAINED", "critical",
      ["condition", "routine"], ["conditionPolicy.scenarios.pauseRoles", "routinePolicy"],
      ["condition_pause_role_still_active"]
    ));
  }

  const reduceStack = activeScenarios.some((item) => (item?.reduceActions || []).some((action) =>
    ["same_day_active_stacking", "active_frequency", "optional_exfoliation"].includes(action)
  ));
  if (reduceStack && (routinePolicy?.weeklySchedule?.sameAxisSameDayAllowed === true || !activeStackGuardPresent(routinePolicy))) {
    const confirmed = burden?.activeStackBurden === "confirmed" || (exposure?.duplicateActiveAxes || []).length > 0;
    violations.push(violation(
      "CONSISTENCY_CONDITION_REDUCE_STACK_UNGUARDED", confirmed ? "critical" : "warning",
      ["condition", "routine"], ["conditionPolicy.scenarios.reduceActions", "routinePolicy.weeklySchedule", "routinePolicy.prohibitedSameWindow"],
      ["condition_stack_reduction_unguarded"]
    ));
  }

  if (protectionRequired && !sunscreen) {
    violations.push(violation(
      "CONSISTENCY_PROTECTION_MISSING", "critical",
      ["context", "routine"], ["routinePolicy.windows.morning.steps"], ["protection_step_missing"]
    ));
  } else if (protectionRequired && sunscreen?.requirement !== "required") {
    violations.push(violation(
      "CONSISTENCY_PROTECTION_NOT_REQUIRED", "critical",
      ["context", "routine"], ["routinePolicy.windows.morning.steps.am.sunscreen.requirement"], ["protection_not_required"]
    ));
  }
  if (protectionRequired && sunscreen && (
    REDUCED_PROTECTION_ACTIONS.has(sunscreen?.action) || number(sunscreen?.frequencyCap?.maximum) < 7
  )) {
    violations.push(violation(
      "CONSISTENCY_PROTECTION_REDUCED", "critical",
      ["context", "routine"], ["routinePolicy.windows.morning.steps.am.sunscreen"], ["protection_reduced"]
    ));
  }

  const unknownRows = (exposure?.rows || []).filter((row) =>
    ["not_in_db", "unanswered"].includes(row?.sourceState) || (row?.sourceState === "selected" && !row?.evaluable)
  );
  if (unknownRows.some((row) => productActionFor(routinePolicy, row).some((item) => STOP_ACTIONS.has(item?.action)))) {
    violations.push(violation(
      "CONSISTENCY_UNKNOWN_PRODUCT_STOP", "critical",
      ["context", "routine"], ["sharedContext.productExposureState.rows", "routinePolicy.productActions"],
      ["unknown_product_stop_forbidden"], [], ["product_evidence_incomplete"]
    ));
  }
  if (unknownRows.length && [routinePolicy?.confidence, conditionPolicy?.confidence].includes("high")) {
    violations.push(violation(
      "CONSISTENCY_UNKNOWN_PRODUCT_CONFIDENCE", "warning",
      ["context", "routine", "condition"], ["sharedContext.productExposureState.unknownProductCount", "routinePolicy.confidence", "conditionPolicy.confidence"],
      ["unknown_product_confidence_cap"], [], ["product_evidence_incomplete"]
    ));
  }

  const productSpecificStops = (routinePolicy?.productActions || []).filter((item) => item?.productId && STOP_ACTIONS.has(item?.action));
  if (productSpecificStops.length && !reactionEvidence(sharedContext)) {
    violations.push(violation(
      "CONSISTENCY_PRODUCT_BLAME_WITHOUT_REACTION_EVIDENCE", "critical",
      ["context", "condition", "routine"], ["sharedContext.conditionSignalState.productReaction", "routinePolicy.productActions"],
      ["product_blame_without_reaction_evidence"]
    ));
  }

  const duplicateAxes = exposure?.duplicateActiveAxes || [];
  if (duplicateAxes.length && routinePolicy?.weeklySchedule?.sameAxisSameDayAllowed === true) {
    violations.push(violation(
      "CONSISTENCY_DUPLICATE_AXIS_SAME_DAY", "critical",
      ["context", "routine"], ["sharedContext.productExposureState.duplicateActiveAxes", "routinePolicy.weeklySchedule.sameAxisSameDayAllowed"],
      ["duplicate_axis_same_day_allowed"]
    ));
  }
  if (duplicateAxes.includes(functionalPolicy?.functionalDirection) && functionalPolicy?.planMode === "START" && functionalPolicy?.recommendationSuppressed !== true) {
    violations.push(violation(
      "CONSISTENCY_DUPLICATE_AXIS_EXPANSION", "critical",
      ["context", "functional"], ["sharedContext.productExposureState.duplicateActiveAxes", "functionalPolicy.functionalDirection"],
      ["duplicate_axis_expansion"]
    ));
  }

  if (["confirmed", "possible"].includes(burden?.activeStackBurden) && !activeStackGuardPresent(routinePolicy)) {
    const critical = burden.activeStackBurden === "confirmed" || safety?.level === "stabilize_first";
    violations.push(violation(
      "CONSISTENCY_ACTIVE_STACK_UNGUARDED", critical ? "critical" : "warning",
      ["context", "routine"], ["sharedContext.routineBurdenState.activeStackBurden", "routinePolicy.prohibitedSameWindow"],
      ["active_stack_unguarded"]
    ));
  }

  if (activeDirection) {
    const activeDays = number(routinePolicy?.weeklySchedule?.activeDaysMax);
    const treatmentMax = number(treatment?.frequencyCap?.maximum);
    const sameDay = routinePolicy?.weeklySchedule?.sameAxisSameDayAllowed;
    const intensity = functionalPolicy?.allowedIntensity;
    const invalid = intensity === "hold"
      ? activeDays !== 0 || treatmentMax !== 0 || treatment?.requirement !== "omit"
      : intensity === "low"
        ? activeDays > 1 || treatmentMax > 1 || sameDay !== false
        : intensity === "low_to_moderate"
          ? activeDays > 3 || treatmentMax > 3
          : false;
    if (invalid) {
      violations.push(violation(
        "CONSISTENCY_INTENSITY_FREQUENCY_CAP", "critical",
        ["functional", "routine"], ["functionalPolicy.allowedIntensity", "routinePolicy.weeklySchedule", "routinePolicy.windows.evening.steps.pm.treatment"],
        ["functional_intensity_frequency_conflict"]
      ));
    }
  }

  return violations;
}

export function buildCrossDomainConsistency(input = {}) {
  const violations = inspect(input);
  const critical = violations.some((item) => item.severity === "critical");
  const warning = violations.some((item) => item.severity === "warning");
  const insufficient = violations.some((item) => item.ruleId === "CONSISTENCY_CONTEXT_INSUFFICIENT");
  const unknownProducts = number(input?.sharedContext?.productExposureState?.unknownProductCount) > 0;
  const verdict = insufficient ? "insufficient_context" : critical ? "blocked" : warning ? "warning" : "consistent";
  const severity = critical ? "critical" : warning ? "warning" : "none";
  const fallback = critical ? {
    key: "stabilization_routine",
    reasonCodes: unique(violations.filter((item) => item.severity === "critical").flatMap((item) => item.reasonCodes)),
    maintainRoles: ["gentle_cleansing", "hydration", "barrier_support", "sun_protection"],
    omitRoles: ["optional_actives", "optional_exfoliation"],
    protectionMustMaintain: true,
    productSpecificStopForbidden: true
  } : null;

  return {
    version: CROSS_DOMAIN_CONSISTENCY_VERSION,
    verdict,
    severity,
    violations,
    fallback,
    effectivePolicySource: critical ? "stabilization_fallback" : "raw",
    confidence: insufficient ? "low" : unknownProducts || warning ? "medium" : "high",
    reasonCodes: unique(violations.flatMap((item) => item.reasonCodes)),
    evidenceKeys: unique(violations.flatMap((item) => item.evidenceKeys))
  };
}
