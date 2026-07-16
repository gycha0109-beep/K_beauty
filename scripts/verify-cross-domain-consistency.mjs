import assert from "node:assert/strict";
import { buildCrossDomainConsistency } from "../lib/cross-domain-consistency.js";
import { buildEffectivePolicySet } from "../lib/effective-policy-set.js";
import { buildPremiumDecisionState } from "../lib/premium-decision-state.js";
import { buildPremiumFunctionalProjection } from "../lib/premium-functional-projection.js";
import { buildPremiumRoutineProjection } from "../lib/premium-routine-projection.js";
import { buildPremiumConditionProjection } from "../lib/premium-condition-projection.js";

function baseContext(overrides = {}) {
  return {
    skinState: { priorityAxis: "pores", concernScores: { pores: 20 } },
    survey: { completeness: "available", answers: {} },
    safetyState: { level: "stable", protectionMustMaintain: true },
    productExposureState: { rows: [], unknownProductCount: 0, duplicateActiveAxes: [] },
    routineBurdenState: { activeStackBurden: "none", cleansingBurden: "normal", layerBurden: "normal" },
    conditionSignalState: { productReaction: "no", completeness: "complete" },
    ...overrides
  };
}

function baseFunctional(overrides = {}) {
  return {
    version: "functional-policy-v1",
    functionalDirection: "exfoliation",
    primaryGoal: "pores_texture",
    secondaryGoal: null,
    status: "now",
    planMode: "START",
    allowedIntensity: "low_to_moderate",
    recommendationSuppressed: false,
    suppressionReason: null,
    targetCategories: ["treatment"],
    reasonCodes: [],
    safety: { protectionMustMaintain: true },
    goals: [],
    ...overrides
  };
}

function baseRoutine(overrides = {}) {
  const value = {
    version: "routine-policy-v1",
    windows: {
      morning: { mode: "balanced", steps: [
        { stepKey: "am.cleanse", role: "cleanser", requirement: "required", action: "maintain", frequencyCap: { unit: "week", maximum: 7 } },
        { stepKey: "am.hydration", role: "hydration_base", requirement: "required", action: "maintain", frequencyCap: { unit: "week", maximum: 7 } },
        { stepKey: "am.sunscreen", role: "sunscreen", requirement: "required", action: "maintain", frequencyCap: { unit: "week", maximum: 7 } }
      ] },
      evening: { mode: "controlled_active", steps: [
        { stepKey: "pm.cleanse", role: "cleanser", requirement: "required", action: "maintain", frequencyCap: { unit: "week", maximum: 7 } },
        { stepKey: "pm.treatment", role: "functional_leave_on", requirement: "optional", action: "maintain", frequencyCap: { unit: "week", maximum: 3 } },
        { stepKey: "pm.moisturizer", role: "hydration_base", requirement: "required", action: "maintain", frequencyCap: { unit: "week", maximum: 7 } }
      ] }
    },
    weeklySchedule: { activeDaysMax: 3, restDaysMin: 4, sameAxisSameDayAllowed: false },
    productActions: [],
    prohibitedSameWindow: [],
    introductionOrder: [{ order: 4, role: "functional_leave_on", gate: "skin_stable_for_several_days" }],
    invariants: { protectionMustMaintain: true, sunscreenRequiredInMorning: true, unknownProductReplacementForbidden: true },
    confidence: "high",
    reasonCodes: [],
    evidenceKeys: []
  };
  return { ...value, ...overrides };
}

function baseCondition(overrides = {}) {
  return {
    version: "condition-policy-v1",
    responseMode: "steady",
    scenarios: [],
    invariants: { protectionMustMaintain: true, unknownProductStopForbidden: true },
    confidence: "high",
    reasonCodes: [],
    ...overrides
  };
}

const normalInput = {
  sharedContext: baseContext(),
  functionalPolicy: baseFunctional(),
  routinePolicy: baseRoutine(),
  conditionPolicy: baseCondition()
};
assert.equal(buildCrossDomainConsistency(normalInput).verdict, "consistent");
assert.deepEqual(buildCrossDomainConsistency(normalInput), buildCrossDomainConsistency(normalInput));

const blockedInput = {
  ...normalInput,
  sharedContext: baseContext({ safetyState: { level: "stabilize_first", protectionMustMaintain: true } })
};
const blocked = buildCrossDomainConsistency(blockedInput);
assert.equal(blocked.verdict, "blocked");
assert.equal(blocked.effectivePolicySource, "stabilization_fallback");
assert.ok(blocked.violations.some((item) => item.ruleId === "CONSISTENCY_SAFETY_ACTIVE_EXPANSION"));

const effective = buildEffectivePolicySet({ ...blockedInput, consistency: blocked });
assert.equal(effective.source, "stabilization_fallback");
assert.equal(effective.functionalPolicy.planMode, "HOLD");
assert.equal(effective.functionalPolicy.allowedIntensity, "hold");
assert.equal(effective.routinePolicy.weeklySchedule.activeDaysMax, 0);
assert.equal(effective.routinePolicy.windows.evening.steps.find((item) => item.stepKey === "pm.treatment").requirement, "omit");
assert.equal(effective.routinePolicy.windows.morning.steps.find((item) => item.stepKey === "am.sunscreen").frequencyCap.maximum, 7);

const missingProtection = buildCrossDomainConsistency({
  ...normalInput,
  routinePolicy: baseRoutine({ windows: { ...baseRoutine().windows, morning: { mode: "balanced", steps: [] } } })
});
assert.ok(missingProtection.violations.some((item) => item.ruleId === "CONSISTENCY_PROTECTION_MISSING"));

const duplicate = buildCrossDomainConsistency({
  ...normalInput,
  sharedContext: baseContext({
    productExposureState: { rows: [], unknownProductCount: 0, duplicateActiveAxes: ["exfoliation"] },
    routineBurdenState: { activeStackBurden: "confirmed" }
  }),
  routinePolicy: baseRoutine({ weeklySchedule: { activeDaysMax: 3, restDaysMin: 4, sameAxisSameDayAllowed: true } })
});
assert.ok(duplicate.violations.some((item) => item.ruleId === "CONSISTENCY_DUPLICATE_AXIS_SAME_DAY"));
assert.ok(duplicate.violations.some((item) => item.ruleId === "CONSISTENCY_DUPLICATE_AXIS_EXPANSION"));

const unknownContext = baseContext({
  productExposureState: {
    rows: [{ sourceState: "not_in_db", productId: "unknown", routineSlots: ["pm.treatment"], evaluable: false }],
    unknownProductCount: 1,
    duplicateActiveAxes: []
  }
});
const unknown = buildCrossDomainConsistency({
  ...normalInput,
  sharedContext: unknownContext,
  routinePolicy: baseRoutine({
    productActions: [{ slotKey: "pm.treatment", productId: "unknown", action: "hold" }],
    confidence: "high"
  })
});
assert.ok(unknown.violations.some((item) => item.ruleId === "CONSISTENCY_UNKNOWN_PRODUCT_STOP"));
assert.ok(unknown.violations.some((item) => item.ruleId === "CONSISTENCY_UNKNOWN_PRODUCT_CONFIDENCE"));

const genericStabilizationHold = buildCrossDomainConsistency({
  ...normalInput,
  routinePolicy: baseRoutine({
    productActions: [{
      slotKey: "pm.treatment",
      productId: "known",
      action: "hold",
      reasonCodes: ["stabilize_first_active_hold"]
    }]
  })
});
assert.ok(
  !genericStabilizationHold.violations.some((item) => item.ruleId === "CONSISTENCY_PRODUCT_BLAME_WITHOUT_REACTION_EVIDENCE"),
  "a generic stabilization hold must not be misclassified as product causation"
);

const noReaction = buildCrossDomainConsistency({
  ...normalInput,
  routinePolicy: baseRoutine({
    productActions: [{
      slotKey: "pm.treatment",
      productId: "known",
      action: "hold",
      reasonCodes: ["suspected_product_reaction"]
    }]
  })
});
assert.ok(noReaction.violations.some((item) => item.ruleId === "CONSISTENCY_PRODUCT_BLAME_WITHOUT_REACTION_EVIDENCE"));

const unknownWithoutId = buildCrossDomainConsistency({
  ...normalInput,
  sharedContext: baseContext({
    productExposureState: {
      rows: [{ sourceState: "not_in_db", productId: null, routineSlots: ["pm.treatment"], evaluable: false }],
      unknownProductCount: 1,
      duplicateActiveAxes: []
    }
  }),
  routinePolicy: baseRoutine({
    productActions: [{ slotKey: "pm.treatment", productId: "known", action: "hold" }],
    confidence: "medium"
  }),
  conditionPolicy: baseCondition({ confidence: "medium" })
});
assert.ok(
  !unknownWithoutId.violations.some((item) => item.ruleId === "CONSISTENCY_UNKNOWN_PRODUCT_STOP"),
  "a slot-shared known product action must not be assigned to an unidentified unknown product"
);

const functionalProjection = buildPremiumFunctionalProjection({
  report: { topPick: { id: "p1", name: "Candidate" }, budgetAlternatives: [{ id: "p2", name: "Budget" }] },
  functionalPolicy: effective.functionalPolicy,
  locale: "ko"
});
assert.deepEqual(functionalProjection.functionalPlan.productCandidates, []);
assert.deepEqual(functionalProjection.functionalPlan.budgetAlternatives, []);

const routineProjection = buildPremiumRoutineProjection({
  report: { topPick: { id: "p1", name: "Treatment", category: "treatment" } },
  routinePolicy: effective.routinePolicy,
  locale: "ko"
});
assert.equal(routineProjection.routinePlan.nightSteps.find((item) => item.productRole === "functional_leave_on").product, null);

const legacyReport = { conditionResponses: [{ responseKey: "active_load", status: "avoid_for_now" }] };
const minimalCondition = baseCondition({ conditionSignalState: { completeness: "minimal" }, scenarios: [] });
assert.equal(buildPremiumConditionProjection({ report: legacyReport, conditionPolicy: minimalCondition, allowLegacyFallback: true }).conditionPlan.responses[0].responseKey, "active_load");
assert.ok(!buildPremiumConditionProjection({ report: legacyReport, conditionPolicy: minimalCondition, allowLegacyFallback: false }).conditionPlan.responses.some((item) => item.legacyCarryover));

const report = {
  freeResult: {
    priority: { axis: "pores", score: 20 },
    scoring: { concernScores: { pores: 20 } },
    answers: { recentSkinChange: "yes" }
  },
  currentProducts: { selections: [] }
};
const decisionState = buildPremiumDecisionState(report, { locale: "ko", source: "consistency_verifier" });
assert.equal(decisionState.decisionBundle.version, "premium-decision-bundle-v5");
assert.ok(decisionState.rawPolicies.functional);
assert.ok(decisionState.consistency);
assert.equal(decisionState.effectivePolicySource, "raw");
assert.equal(decisionState.consistency.verdict, "consistent");
assert.equal(decisionState.functionalPolicy, decisionState.decisionBundle.functionalPolicy);
assert.equal(decisionState.decisionBundle.effectivePolicies, undefined);

console.log("cross-domain consistency verifier passed");
