export const EFFECTIVE_POLICY_SET_VERSION = "effective-policy-set-v1";

const ACTIVE_DIRECTIONS = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function confidenceCap(value, maximum = "medium") {
  const rank = { low: 0, medium: 1, high: 2 };
  return (rank[value] ?? 0) > rank[maximum] ? maximum : value || "low";
}

function makeStep({ stepKey, order, role, requirement, action, maximum, reasonCodes = [], evidenceKeys = [], confidence = "medium" }) {
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

function fallbackFunctional(raw = {}) {
  const active = ACTIVE_DIRECTIONS.has(raw?.functionalDirection);
  const goals = (raw?.goals || []).map((goal) => {
    const goalActive = ["sebum_pore", "tone_spot", "texture_exfoliation"].includes(goal?.goalKey);
    if (!goalActive || goal?.status === "pause") return { ...goal };
    return { ...goal, status: "pause" };
  });
  return {
    ...clone(raw),
    status: active ? "pause" : "now",
    planMode: active ? "HOLD" : "START",
    allowedIntensity: active ? "hold" : raw?.functionalDirection === "sunscreen_protection" ? "maintain" : "support_only",
    recommendationSuppressed: true,
    suppressionReason: "cross_domain_blocked",
    targetCategories: [],
    goals,
    reasonCodes: unique([...(raw?.reasonCodes || []), "cross_domain_consistency_blocked", "stabilization_fallback_applied"]),
    safety: {
      ...(clone(raw?.safety) || {}),
      activeExpansionAllowed: false,
      exfoliationExpansionAllowed: false,
      protectionMustMaintain: true
    }
  };
}

function fallbackProductActions(sharedContext = {}) {
  return (sharedContext?.productExposureState?.rows || []).flatMap((row) => {
    const slots = Array.isArray(row?.routineSlots) && row.routineSlots.length ? row.routineSlots : [null];
    const unknown = ["not_in_db", "unanswered"].includes(row?.sourceState) || (row?.sourceState === "selected" && !row?.evaluable);
    const action = unknown ? "check_needed" : row?.sourceState === "not_using" ? "keep" : row?.activeExposure ? "hold" : "keep";
    return slots.map((slotKey) => ({
      slotKey,
      productId: row?.productId || null,
      sourceState: row?.sourceState || "unanswered",
      action,
      reasonCodes: action === "check_needed"
        ? ["product_evidence_incomplete"]
        : action === "hold" ? ["cross_domain_stabilization_hold"] : ["no_clear_routine_conflict"],
      reevaluateWhen: action === "hold"
        ? ["skin_stable_for_several_days"]
        : action === "check_needed" ? ["product_information_available"] : []
    }));
  });
}

function fallbackRoutine(raw = {}, sharedContext = {}) {
  const burden = sharedContext?.routineBurdenState || {};
  const cleanseAction = burden?.cleansingBurden === "elevated" ? "reduce" : "maintain";
  const hydrationAction = burden?.layerBurden === "elevated" ? "reduce" : "maintain";
  const unknown = Number(sharedContext?.productExposureState?.unknownProductCount || 0) > 0;
  return {
    ...clone(raw),
    status: sharedContext?.skinState?.priorityAxis ? unknown ? "partial" : "available" : "partial",
    modes: { morning: "minimal", evening: "recovery" },
    windows: {
      morning: {
        mode: "minimal",
        steps: [
          makeStep({ stepKey: "am.cleanse", order: 1, role: "cleanser", requirement: burden?.cleansingBurden === "elevated" ? "optional" : "required", action: cleanseAction, maximum: 7, reasonCodes: ["stabilization_fallback"] }),
          makeStep({ stepKey: "am.hydration", order: 2, role: "hydration_base", requirement: "required", action: hydrationAction, maximum: 7, reasonCodes: ["stabilization_fallback"] }),
          makeStep({ stepKey: "am.sunscreen", order: 3, role: "sunscreen", requirement: "required", action: "maintain", maximum: 7, reasonCodes: ["protection_must_maintain", "stabilization_fallback"], evidenceKeys: ["safety:protection_must_maintain"], confidence: "high" })
        ]
      },
      evening: {
        mode: "recovery",
        steps: [
          makeStep({ stepKey: "pm.cleanse", order: 1, role: "cleanser", requirement: "required", action: cleanseAction, maximum: 7, reasonCodes: ["stabilization_fallback"] }),
          makeStep({ stepKey: "pm.treatment", order: 2, role: "functional_leave_on", requirement: "omit", action: "hold", maximum: 0, reasonCodes: ["cross_domain_consistency_blocked", "stabilization_fallback_applied"] }),
          makeStep({ stepKey: "pm.moisturizer", order: 3, role: "hydration_base", requirement: "required", action: "maintain", maximum: 7, reasonCodes: ["evening_recovery", "stabilization_fallback"] })
        ]
      }
    },
    weeklySchedule: { activeDaysMax: 0, restDaysMin: 7, sameAxisSameDayAllowed: false },
    productActions: fallbackProductActions(sharedContext),
    prohibitedSameWindow: [{ axes: ["multiple_active_axes"], severity: "blocked", reasonCodes: ["active_stack_burden", "stabilization_fallback"] }],
    introductionOrder: [
      { order: 1, role: "cleanser", gate: "stable_use" },
      { order: 2, role: "hydration_base", gate: "stable_use" },
      { order: 3, role: "sunscreen", gate: "daily_protection" }
    ],
    routineBurdenState: clone(sharedContext?.routineBurdenState || raw?.routineBurdenState || {}),
    invariants: {
      protectionMustMaintain: true,
      sunscreenRequiredInMorning: true,
      unknownProductReplacementForbidden: true
    },
    reasonCodes: unique([...(raw?.reasonCodes || []), "cross_domain_consistency_blocked", "stabilization_fallback_applied"]),
    evidenceKeys: unique([...(raw?.evidenceKeys || []), "safety:protection_must_maintain"]),
    confidence: unknown || !sharedContext?.skinState?.priorityAxis ? "low" : "medium"
  };
}

function fallbackCondition(raw = {}) {
  return {
    ...clone(raw),
    responseMode: "stabilize",
    reasonCodes: unique([...(raw?.reasonCodes || []), "cross_domain_consistency_blocked", "stabilization_fallback_applied"]),
    confidence: confidenceCap(raw?.confidence, "medium")
  };
}

export function buildEffectivePolicySet({ sharedContext = {}, functionalPolicy = {}, routinePolicy = {}, conditionPolicy = {}, consistency = {} } = {}) {
  if (consistency?.effectivePolicySource !== "stabilization_fallback") {
    return {
      version: EFFECTIVE_POLICY_SET_VERSION,
      source: "raw",
      functionalPolicy: clone(functionalPolicy),
      routinePolicy: clone(routinePolicy),
      conditionPolicy: clone(conditionPolicy)
    };
  }

  return {
    version: EFFECTIVE_POLICY_SET_VERSION,
    source: "stabilization_fallback",
    functionalPolicy: fallbackFunctional(functionalPolicy),
    routinePolicy: fallbackRoutine(routinePolicy, sharedContext),
    conditionPolicy: fallbackCondition(conditionPolicy)
  };
}
