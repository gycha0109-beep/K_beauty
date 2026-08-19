export const ROUTINE_POLICY_VERSION = "routine-policy-v1";

const ACTIVE_AXES = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const SENSITIVE_AXES = new Set(["barrier", "redness", "acne", "dehydration"]);

function text(value) {
  return String(value || "").normalize("NFKC").trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getScaleThreshold(scores = {}, concernScoreScale = "") {
  if (text(concernScoreScale).toLowerCase() === "skin_match_raw") {
    return { high: 18, elevated: 14 };
  }
  const maximum = Math.max(...Object.values(scores).map(number), 0);
  return maximum > 40 ? { high: 70, elevated: 55 } : { high: 18, elevated: 14 };
}

function getSkinState(context = {}) {
  const scores = context?.skinState?.concernScores || {};
  const thresholds = getScaleThreshold(scores, context?.metadata?.concernScoreScale);
  const priorityAxis = text(context?.skinState?.priorityAxis);
  const highAxes = Object.entries(scores)
    .filter(([, value]) => number(value) >= thresholds.high)
    .map(([axis]) => axis);
  const elevatedAxes = Object.entries(scores)
    .filter(([, value]) => number(value) >= thresholds.elevated)
    .map(([axis]) => axis);

  return { scores, thresholds, priorityAxis, highAxes, elevatedAxes };
}

function getAnswers(context = {}) {
  return context?.survey?.answers && typeof context.survey.answers === "object"
    ? context.survey.answers
    : {};
}

function getExposureRows(context = {}) {
  return Array.isArray(context?.productExposureState?.rows)
    ? context.productExposureState.rows
    : [];
}

function getRoutineSlots(row = {}) {
  if (Array.isArray(row.routineSlots)) {
    return row.routineSlots.map(text).filter(Boolean);
  }

  const category = text(row.category);
  const role = text(row.categoryRole);
  if (category === "cleanser") return ["am.cleanser", "pm.cleanser"];
  if (category === "sunscreen") return ["am.sunscreen"];
  if (["moisturizer", "moisturizer_lotion_emulsion", "moisturizer_gel", "moisturizer_cream", "moisturizer_balm"].includes(category)) {
    return ["am.moisturizer", "pm.moisturizer"];
  }
  if (["toner_essence", "toner_pad"].includes(category)) return ["am.hydration", "pm.treatment"];
  if (["treatment", "serum", "ampoule", "essence"].includes(category) || role === "functional_leave_on") {
    return ["pm.treatment"];
  }
  return [];
}

function buildBurdenState(context = {}) {
  const answers = getAnswers(context);
  const rows = getExposureRows(context);
  const selectedRows = rows.filter((row) => row?.sourceState === "selected");
  const duplicateAxes = Array.isArray(context?.productExposureState?.duplicateActiveAxes)
    ? context.productExposureState.duplicateActiveAxes
    : [];
  const unknownCount = number(context?.productExposureState?.unknownProductCount);
  const cleansingBurden = answers.cleansingFrequency === "3_plus" || answers.postWashFeeling === "tight"
    ? "elevated"
    : Object.keys(answers).length ? "normal" : "unknown";
  const makeupLayerBurden = answers.makeupUse === true
    ? "elevated"
    : Object.prototype.hasOwnProperty.call(answers, "makeupUse") ? "normal" : "unknown";
  const activeStackBurden = duplicateAxes.length
    ? "confirmed"
    : selectedRows.filter((row) => row?.activeExposure).length >= 2 ? "possible" : "none";

  return {
    cleansingBurden,
    layerBurden: selectedRows.length >= 5 || makeupLayerBurden === "elevated" ? "elevated" : selectedRows.length ? "normal" : "unknown",
    activeStackBurden,
    makeupLayerBurden,
    duplicateAxisBurden: duplicateAxes.length > 0,
    unknownProductBurden: unknownCount > 0,
    selectedSlotCount: selectedRows.length,
    completeness: context?.survey?.completeness === "available"
      ? unknownCount ? "partial" : "complete"
      : selectedRows.length ? "partial" : "minimal"
  };
}

function getModes(context, skin, burden) {
  const safetyLevel = text(context?.safetyState?.level);
  if (safetyLevel === "stabilize_first") {
    return { morning: "minimal", evening: "recovery" };
  }
  if (["barrier", "redness"].includes(skin.priorityAxis)) {
    return { morning: "minimal", evening: "recovery" };
  }
  if (["oiliness", "pores", "acne"].includes(skin.priorityAxis)) {
    return { morning: "fresh", evening: burden.activeStackBurden === "none" ? "controlled_active" : "balanced" };
  }
  if (skin.priorityAxis === "uv") {
    return { morning: "protective", evening: "balanced" };
  }
  return { morning: "balanced", evening: "balanced" };
}

function makeStep({ stepKey, order, role, requirement, action = "maintain", maximum = 7, reasonCodes = [], evidenceKeys = [], confidence = "medium" }) {
  return {
    stepKey,
    order,
    role,
    requirement,
    action,
    frequencyCap: { unit: "week", maximum },
    reasonCodes: unique(reasonCodes),
    evidenceKeys: unique(evidenceKeys),
    confidence
  };
}

function buildWindows(context, skin, burden, modes) {
  const safety = context?.safetyState || {};
  const stabilize = safety.level === "stabilize_first";
  const sensitive = Boolean(safety.sensitiveBurden || SENSITIVE_AXES.has(skin.priorityAxis));
  const treatmentMaximum = stabilize ? 0 : sensitive ? 1 : ["pores", "acne", "uneven_tone"].includes(skin.priorityAxis) ? 3 : 2;

  return {
    morning: {
      mode: modes.morning,
      steps: [
        makeStep({
          stepKey: "am.cleanse",
          order: 1,
          role: "cleanser",
          requirement: burden.cleansingBurden === "elevated" ? "optional" : "required",
          action: burden.cleansingBurden === "elevated" ? "reduce" : "maintain",
          reasonCodes: burden.cleansingBurden === "elevated" ? ["cleansing_burden_elevated"] : ["morning_reset"]
        }),
        makeStep({
          stepKey: "am.hydration",
          order: 2,
          role: "hydration_base",
          requirement: skin.priorityAxis === "oiliness" && !skin.elevatedAxes.includes("dehydration") ? "optional" : "required",
          action: burden.layerBurden === "elevated" ? "reduce" : "maintain",
          reasonCodes: burden.layerBurden === "elevated" ? ["layer_burden_elevated"] : ["hydration_support"]
        }),
        makeStep({
          stepKey: "am.sunscreen",
          order: 3,
          role: "sunscreen",
          requirement: "required",
          action: "maintain",
          reasonCodes: ["protection_must_maintain"],
          evidenceKeys: ["safety:protection_must_maintain"],
          confidence: "high"
        })
      ]
    },
    evening: {
      mode: modes.evening,
      steps: [
        makeStep({
          stepKey: "pm.cleanse",
          order: 1,
          role: "cleanser",
          requirement: "required",
          action: burden.cleansingBurden === "elevated" ? "reduce" : "maintain",
          reasonCodes: burden.cleansingBurden === "elevated" ? ["cleansing_burden_elevated"] : ["remove_daytime_residue"]
        }),
        makeStep({
          stepKey: "pm.treatment",
          order: 2,
          role: "functional_leave_on",
          requirement: treatmentMaximum === 0 ? "omit" : "optional",
          action: treatmentMaximum === 0 ? "hold" : burden.activeStackBurden !== "none" ? "reduce" : "maintain",
          maximum: treatmentMaximum,
          reasonCodes: [
            ...(stabilize ? ["stabilize_first"] : []),
            ...(burden.activeStackBurden !== "none" ? ["active_stack_burden"] : []),
            ...(!stabilize && burden.activeStackBurden === "none" ? ["controlled_active_window"] : [])
          ],
          confidence: context?.survey?.completeness === "available" ? "high" : "medium"
        }),
        makeStep({
          stepKey: "pm.moisturizer",
          order: 3,
          role: "hydration_base",
          requirement: "required",
          action: "maintain",
          reasonCodes: ["evening_recovery"]
        })
      ]
    }
  };
}

function actionForRow(row, context, burden) {
  const sourceState = text(row?.sourceState).toLowerCase() || "unanswered";
  if (["not_in_db", "unanswered"].includes(sourceState) || (sourceState === "selected" && !row?.evaluable)) {
    return "check_needed";
  }
  if (sourceState === "not_using") return "keep";

  const safety = context?.safetyState || {};
  const activeAxes = Array.isArray(row?.activeAxes) ? row.activeAxes : [];
  const active = activeAxes.some((axis) => ACTIVE_AXES.has(axis));
  if (safety.level === "stabilize_first" && active) return "hold";
  if (active && (burden.duplicateAxisBurden || burden.activeStackBurden === "possible")) return "reduce";
  return "keep";
}

function buildProductActions(context, burden) {
  return getExposureRows(context).flatMap((row) => {
    const slots = getRoutineSlots(row);
    const sourceState = text(row?.sourceState).toLowerCase() || "unanswered";
    const action = actionForRow(row, context, burden);
    const reasonCodes = [
      ...(action === "check_needed" ? ["product_evidence_incomplete"] : []),
      ...(action === "hold" ? ["stabilize_first_active_hold"] : []),
      ...(action === "reduce" ? ["duplicate_or_stack_burden"] : []),
      ...(action === "keep" ? ["no_clear_routine_conflict"] : [])
    ];

    return (slots.length ? slots : [null]).map((slotKey) => ({
      slotKey,
      productId: row?.productId || null,
      sourceState,
      action,
      reasonCodes,
      reevaluateWhen: action === "hold"
        ? ["skin_stable_for_several_days"]
        : action === "check_needed" ? ["product_information_available"] : []
    }));
  });
}

function buildProhibitedSameWindow(context, burden) {
  const items = [];
  if (burden.activeStackBurden !== "none") {
    items.push({
      axes: ["multiple_active_axes"],
      severity: context?.safetyState?.level === "stabilize_first" ? "blocked" : "warning",
      reasonCodes: ["active_stack_burden"]
    });
  }
  if (burden.cleansingBurden === "elevated") {
    items.push({
      axes: ["strong_cleansing", "exfoliation"],
      severity: "warning",
      reasonCodes: ["cleansing_burden_elevated"]
    });
  }
  return items;
}

export function buildRoutinePolicy(input = {}) {
  const context = input?.sharedContext || input?.context || input || {};
  const skin = getSkinState(context);
  const burden = buildBurdenState(context);
  const modes = getModes(context, skin, burden);
  const windows = buildWindows(context, skin, burden, modes);
  const treatmentCap = windows.evening.steps.find((step) => step.stepKey === "pm.treatment")?.frequencyCap?.maximum || 0;
  const unknown = Boolean(burden.unknownProductBurden);
  const confidence = context?.survey?.completeness === "available" && !unknown ? "high" : "medium";

  return {
    version: ROUTINE_POLICY_VERSION,
    status: context?.skinState?.priorityAxis ? unknown ? "partial" : "available" : "partial",
    modes,
    windows,
    weeklySchedule: {
      activeDaysMax: treatmentCap,
      restDaysMin: Math.max(0, 7 - treatmentCap),
      sameAxisSameDayAllowed: treatmentCap > 0 && !burden.duplicateAxisBurden
    },
    productActions: buildProductActions(context, burden),
    prohibitedSameWindow: buildProhibitedSameWindow(context, burden),
    introductionOrder: [
      { order: 1, role: "cleanser", gate: "stable_use" },
      { order: 2, role: "hydration_base", gate: "stable_use" },
      { order: 3, role: "sunscreen", gate: "daily_protection" },
      ...(treatmentCap > 0 ? [{ order: 4, role: "functional_leave_on", gate: "skin_stable_for_several_days" }] : [])
    ],
    routineBurdenState: burden,
    invariants: {
      protectionMustMaintain: true,
      sunscreenRequiredInMorning: true,
      unknownProductReplacementForbidden: true
    },
    reasonCodes: unique([
      ...(context?.safetyState?.reasonCodes || []),
      ...(burden.cleansingBurden === "elevated" ? ["cleansing_burden_elevated"] : []),
      ...(burden.activeStackBurden !== "none" ? ["active_stack_burden"] : []),
      ...(unknown ? ["product_evidence_incomplete"] : [])
    ]),
    evidenceKeys: unique((context?.evidenceLedger || []).map((item) => item?.key)),
    confidence
  };
}
