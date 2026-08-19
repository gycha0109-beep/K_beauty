#!/usr/bin/env node
import assert from "node:assert/strict";
import { buildSharedSkinDecisionContext } from "../../lib/shared-skin-decision-context-v4.js";
import { buildRoutinePolicy } from "../../lib/routine-policy.js";
import { buildExfoliationNormativePolicySkinMatchContext } from "../../lib/exfoliation-normative-policy-skin-match-context.js";

function report() {
  return {
    freeResult: {
      answers: {
        skinType: "oily",
        sensitivity: "low",
        mainConcern: "oiliness",
        mainConcerns: ["oiliness"],
        recentSkinChange: "no",
        recentlyChangedProduct: "no"
      },
      priority: { axis: "oiliness" },
      scoring: {
        concernScores: {
          barrier: 2,
          redness: 2,
          acne: 3,
          dehydration: 14,
          oiliness: 22,
          pores: 80,
          uneven_tone: 3,
          uv: 4
        }
      }
    },
    currentProducts: null
  };
}

const rawContext = buildExfoliationNormativePolicySkinMatchContext(report());
const genericContext = buildSharedSkinDecisionContext(report()).context;
const directRawContext = buildSharedSkinDecisionContext(report(), {
  source: "v21_9i_routine_source_scale_contract",
  concernScoreScale: "skin_match_raw"
}).context;

assert.deepEqual(rawContext.safetyState, directRawContext.safetyState);
assert.equal(rawContext.metadata.concernScoreScale, "skin_match_raw");

const rawRoutine = buildRoutinePolicy({ context: rawContext });
const directRawRoutine = buildRoutinePolicy({ context: directRawContext });
const genericRoutine = buildRoutinePolicy({ context: genericContext });

assert.deepEqual(rawRoutine, directRawRoutine);

const rawHydration = rawRoutine.windows.morning.steps.find((step) => step.stepKey === "am.hydration");
const genericHydration = genericRoutine.windows.morning.steps.find((step) => step.stepKey === "am.hydration");

assert.equal(rawHydration?.requirement, "required");
assert.equal(genericHydration?.requirement, "optional");

const scale100Routine = buildRoutinePolicy({
  sharedContext: {
    skinState: {
      priorityAxis: "barrier",
      concernScores: { barrier: 82, redness: 74, dehydration: 70, oiliness: 30 }
    },
    survey: { completeness: "available", answers: {} },
    productExposureState: { rows: [], unknownProductCount: 0, duplicateActiveAxes: [] },
    safetyState: {
      level: "caution",
      sensitiveBurden: true,
      reasonCodes: ["high_sensitive_axis"],
      protectionMustMaintain: true
    },
    evidenceLedger: []
  }
});
assert.equal(scale100Routine.weeklySchedule.activeDaysMax, 1);

console.log(JSON.stringify({
  verifier: "verify-v21-9i-routine-source-scale-contract-v1",
  raw_source_hydration_requirement: rawHydration?.requirement,
  generic_dynamic_hydration_requirement: genericHydration?.requirement,
  source_scale_no_semantic_fork: true,
  generic_scale100_regression: true,
  status: "PASS"
}, null, 2));
