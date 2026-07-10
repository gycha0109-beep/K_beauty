import assert from "node:assert/strict";
import { buildFunctionalPlanDecision } from "../lib/functional-plan-decision.js";

function withScores(concernScores, extra = {}) {
  return {
    scoring: {
      concernScores: Object.fromEntries(
        Object.entries(concernScores).map(([axis, total]) => [axis, { total }])
      )
    },
    ...extra
  };
}

function assertDecision(name, freeResult, expected) {
  const decision = buildFunctionalPlanDecision({ freeResult });

  Object.entries(expected).forEach(([key, value]) => {
    assert.equal(decision[key], value, `${name}: expected ${key} to be ${value}`);
  });

  assert.ok(Array.isArray(decision.targetCategories), `${name}: targetCategories is array`);
  assert.ok(Array.isArray(decision.avoidWith), `${name}: avoidWith is array`);
  assert.ok(decision.routineGuide && typeof decision.routineGuide === "object", `${name}: routineGuide exists`);
  assert.equal(typeof decision.reason, "string", `${name}: reason is string`);

  return decision;
}

assertDecision(
  "pores concern",
  withScores({ pores: 24, oiliness: 12 }, { priority: { axis: "pores" } }),
  {
    primaryGoal: "pores_texture",
    functionalDirection: "exfoliation",
    recommendationSuppressed: false
  }
);

assertDecision(
  "acne oiliness concern",
  withScores({ acne: 22, oiliness: 20 }, { priority: { axis: "acne" } }),
  {
    primaryGoal: "oil_acne",
    functionalDirection: "acne_care",
    recommendationSuppressed: false
  }
);

assertDecision(
  "redness barrier concern",
  withScores({ redness: 21, barrier: 19 }, { priority: { axis: "redness" } }),
  {
    primaryGoal: "barrier_redness",
    functionalDirection: "soothing"
  }
);

assertDecision(
  "dehydration concern",
  withScores({ dehydration: 26 }, { priority: { axis: "dehydration" } }),
  {
    primaryGoal: "dehydration",
    functionalDirection: "hydration",
    recommendationSuppressed: false
  }
);

assertDecision(
  "uneven tone concern",
  withScores({ uneven_tone: 23 }, { priority: { axis: "uneven_tone" } }),
  {
    primaryGoal: "uneven_tone",
    functionalDirection: "tone_care",
    recommendationSuppressed: false
  }
);

assertDecision(
  "high sensitivity and redness",
  withScores(
    { pores: 25, redness: 20, barrier: 12 },
    { priority: { axis: "pores" }, form: { sensitivity: "high" } }
  ),
  {
    primaryGoal: "pores_texture",
    functionalDirection: "exfoliation",
    recommendationSuppressed: true,
    suppressionReason: "sensitivity_barrier"
  }
);

assertDecision(
  "signal fallback",
  {},
  {
    primaryGoal: "dehydration",
    secondaryGoal: null,
    functionalDirection: "hydration",
    recommendationSuppressed: false,
    suppressionReason: null
  }
);

console.log("verify-functional-plan-decision: ok");
