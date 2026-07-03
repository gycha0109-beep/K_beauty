import assert from "node:assert/strict";
import { resolveFunctionalGoalPolicy } from "../lib/functional-goal-policy.js";

function contract(primaryConcern, safety = {}) {
  return {
    goals: { primaryConcern },
    safety
  };
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

runCase("matching primaryConcern and priority has no tension", () => {
  const policy = resolveFunctionalGoalPolicy({
    surveyContract: contract("oiliness"),
    freeResultPriority: { axis: "oiliness" }
  });

  assert.equal(policy.hasTension, false);
  assert.equal(policy.tensionType, "none");
  assert.equal(policy.rankingGoal, "oiliness");
  assert.equal(policy.safetyGoal, "oiliness");
  assert.equal(policy.recommendationGuard, "normal");
});

runCase("pores primary and oiliness priority keeps ranking goal on pores", () => {
  const policy = resolveFunctionalGoalPolicy({
    surveyContract: contract("pores"),
    freeResultPriority: { axis: "oiliness" }
  });

  assert.equal(policy.hasTension, true);
  assert.equal(policy.tensionType, "requested_goal_vs_detected_priority");
  assert.equal(policy.rankingGoal, "pores");
  assert.equal(policy.safetyGoal, "oiliness");
});

runCase("acne primary and redness priority with high sensitivity stabilizes first", () => {
  const policy = resolveFunctionalGoalPolicy({
    surveyContract: contract("acne", {
      sensitivityRisk: "high",
      rednessRisk: "high"
    }),
    freeResultPriority: { axis: "redness" }
  });

  assert.equal(policy.hasTension, true);
  assert.equal(policy.tensionType, "requested_goal_vs_safety_priority");
  assert.equal(policy.rankingGoal, "acne");
  assert.equal(policy.safetyGoal, "redness");
  assert.equal(policy.recommendationGuard, "stabilize_first");
});

runCase("matching dehydration primary and priority has no tension", () => {
  const policy = resolveFunctionalGoalPolicy({
    surveyContract: contract("dehydration"),
    freeResultPriority: { axis: "dehydration" }
  });

  assert.equal(policy.hasTension, false);
  assert.equal(policy.rankingGoal, "dehydration");
  assert.equal(policy.safetyGoal, "dehydration");
});

runCase("missing priority keeps primaryConcern as ranking goal", () => {
  const policy = resolveFunctionalGoalPolicy({
    surveyContract: contract("uneven_tone"),
    freeResultPriority: null
  });

  assert.equal(policy.hasTension, false);
  assert.equal(policy.rankingGoal, "uneven_tone");
  assert.equal(policy.safetyGoal, "uneven_tone");
  assert.deepEqual(policy.warnings, ["priority_axis_missing"]);
});

runCase("missing primaryConcern falls back to priority for ranking goal with warning", () => {
  const policy = resolveFunctionalGoalPolicy({
    surveyContract: contract(null),
    freeResultPriority: { axis: "barrier" }
  });

  assert.equal(policy.hasTension, false);
  assert.equal(policy.rankingGoal, "barrier");
  assert.equal(policy.safetyGoal, "barrier");
  assert.deepEqual(policy.warnings, ["primaryConcern_missing_policy_fallback"]);
});
