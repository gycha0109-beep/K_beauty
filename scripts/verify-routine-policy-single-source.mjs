import assert from "node:assert/strict";
import { buildRoutinePolicy, ROUTINE_POLICY_VERSION } from "../lib/routine-policy.js";
import { buildPremiumRoutineProjection } from "../lib/premium-routine-projection.js";

function context(overrides = {}) {
  return {
    skinState: {
      priorityAxis: "pores",
      concernScores: {
        pores: 18,
        oiliness: 17,
        barrier: 8,
        redness: 7,
        dehydration: 10,
        acne: 11,
        uneven_tone: 8,
        uv: 10
      }
    },
    survey: {
      completeness: "available",
      answers: {
        cleansingFrequency: "2",
        postWashFeeling: "comfortable",
        makeupUse: true
      }
    },
    productExposureState: {
      rows: [],
      unknownProductCount: 0,
      duplicateActiveAxes: []
    },
    safetyState: {
      level: "stable",
      sensitiveBurden: false,
      reasonCodes: [],
      protectionMustMaintain: true
    },
    evidenceLedger: [{ key: "priority_axis" }],
    ...overrides
  };
}

const stable = buildRoutinePolicy({ sharedContext: context() });
assert.equal(stable.version, ROUTINE_POLICY_VERSION);
assert.equal(stable.windows.morning.steps.at(-1).stepKey, "am.sunscreen");
assert.equal(stable.windows.morning.steps.at(-1).requirement, "required");
assert.equal(stable.weeklySchedule.activeDaysMax, 3);
assert.equal(stable.confidence, "high");

const stabilize = buildRoutinePolicy({
  sharedContext: context({
    safetyState: {
      level: "stabilize_first",
      sensitiveBurden: true,
      reasonCodes: ["recent_skin_change"],
      protectionMustMaintain: true
    },
    productExposureState: {
      unknownProductCount: 0,
      duplicateActiveAxes: [],
      rows: [{
        sourceState: "selected",
        productId: "active-1",
        category: "serum",
        categoryRole: "functional_leave_on",
        evaluable: true,
        activeExposure: true,
        activeAxes: ["exfoliation"]
      }]
    }
  })
});
assert.equal(stabilize.weeklySchedule.activeDaysMax, 0);
assert.equal(stabilize.windows.evening.steps[1].action, "hold");
assert.equal(stabilize.productActions[0].action, "hold");
assert.equal(stabilize.invariants.sunscreenRequiredInMorning, true);

const unknown = buildRoutinePolicy({
  sharedContext: context({
    productExposureState: {
      unknownProductCount: 1,
      duplicateActiveAxes: [],
      rows: [{
        sourceState: "not_in_db",
        productId: null,
        category: "serum",
        evaluable: false,
        activeAxes: []
      }]
    }
  })
});
assert.equal(unknown.status, "partial");
assert.equal(unknown.productActions[0].action, "check_needed");
assert.equal(unknown.invariants.unknownProductReplacementForbidden, true);

const duplicate = buildRoutinePolicy({
  sharedContext: context({
    productExposureState: {
      unknownProductCount: 0,
      duplicateActiveAxes: ["exfoliation"],
      rows: [
        { sourceState: "selected", productId: "a", category: "serum", evaluable: true, activeExposure: true, activeAxes: ["exfoliation"] },
        { sourceState: "selected", productId: "b", category: "toner_pad", evaluable: true, activeExposure: true, activeAxes: ["exfoliation"] }
      ]
    }
  })
});
assert.equal(duplicate.weeklySchedule.sameAxisSameDayAllowed, false);
assert.ok(duplicate.productActions.every((item) => item.action === "reduce"));
assert.ok(duplicate.prohibitedSameWindow.length > 0);

const scale100 = buildRoutinePolicy({
  sharedContext: context({
    skinState: {
      priorityAxis: "barrier",
      concernScores: { barrier: 82, redness: 74, dehydration: 70, oiliness: 30 }
    },
    safetyState: {
      level: "caution",
      sensitiveBurden: true,
      reasonCodes: ["high_sensitive_axis"],
      protectionMustMaintain: true
    }
  })
});
assert.equal(scale100.weeklySchedule.activeDaysMax, 1);

const withoutFunctionalPolicy = buildRoutinePolicy({ sharedContext: context() });
const withUnrelatedFunctionalPolicy = buildRoutinePolicy({
  sharedContext: context(),
  functionalPolicy: { status: "hold", allowedIntensity: "none" }
});
assert.deepEqual(withoutFunctionalPolicy, withUnrelatedFunctionalPolicy);

const projection = buildPremiumRoutineProjection({
  report: {
    freeResult: {
      priority: { axis: "pores" },
      topPick: { id: "top", name: "Top", category: "toner_essence" }
    }
  },
  routinePolicy: stable,
  locale: "ko"
});
assert.equal(projection.routinePlan.version, "premium-routine-projection-v1");
assert.equal(projection.fullRoutine.morningSteps.length, 3);
assert.equal(projection.fullRoutine.nightSteps.length, 3);
assert.equal(projection.fullRoutine.morningSteps[2].title, "선케어");

console.log("verify-routine-policy-single-source: PASS");
