import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFunctionalPlanDecision } from "../lib/functional-plan-decision.js";
import { buildFunctionalPolicy, FUNCTIONAL_POLICY_VERSION } from "../lib/functional-policy.js";
import { buildPremiumDecisionState } from "../lib/premium-decision-state.js";
import { buildPremiumFunctionalDecisions } from "../lib/premium-functional-decisions.js";
import { resolvePremiumFunctionalDisplayModel } from "../lib/premium-functional-display-model.js";

function freeResult(axis, scores, extra = {}) {
  return {
    priority: { axis, score: scores[axis] || 0 },
    scoring: {
      concernScores: Object.fromEntries(
        Object.entries(scores).map(([key, total]) => [key, { total }])
      )
    },
    ...extra
  };
}

const pores24 = freeResult("pores", { pores: 24, redness: 8, barrier: 6 });
const legacyPores = buildFunctionalPlanDecision({ freeResult: pores24 });
const policyPores = buildFunctionalPolicy({ freeResult: pores24, locale: "ko" });
const premiumPores = buildPremiumFunctionalDecisions({ freeResult: pores24, locale: "ko" });

assert.equal(policyPores.version, FUNCTIONAL_POLICY_VERSION);
assert.equal(policyPores.primaryGoal, "pores_texture");
assert.equal(policyPores.functionalDirection, "exfoliation");
assert.equal(policyPores.planMode, "START");
assert.equal(legacyPores.primaryGoal, policyPores.primaryGoal);
assert.equal(legacyPores.functionalDirection, policyPores.functionalDirection);
assert.equal(premiumPores[0].policyVersion, FUNCTIONAL_POLICY_VERSION);
assert.ok(premiumPores.some((item) => item.goalKey === "texture_exfoliation" && item.status === "now"));

const poresPercent = buildFunctionalPolicy({
  freeResult: freeResult("pores", { pores: 86, redness: 20, barrier: 18 }),
  locale: "ko"
});
assert.equal(poresPercent.planMode, "START", "percent-scale stable pores should not be held");

const sensitiveActiveReport = {
  freeResult: freeResult(
    "pores",
    { pores: 86, redness: 78, barrier: 74, dehydration: 72 },
    { answers: { sensitivity: "high", recentSkinChange: "yes" } }
  ),
  currentProducts: {
    selections: [
      {
        status: "selected",
        category: "serum",
        productId: "active-serum",
        productSnapshot: {
          id: "active-serum",
          brand: "Example",
          name: "Active Serum",
          category: "serum",
          ingredient_signals: {
            functional: [{ label: "Exfoliation", count: 4 }]
          }
        }
      }
    ]
  },
  currentProductVerdicts: [
    {
      slotKey: "pm.functional.serum",
      status: "hold",
      title: "hold",
      summary: "hold",
      reasons: [],
      adjustment: null
    }
  ],
  supportingProducts: [],
  budgetAlternatives: []
};
const sensitiveState = buildPremiumDecisionState(sensitiveActiveReport, {
  locale: "ko",
  source: "verify_functional_policy_single_source"
});
assert.equal(sensitiveState.decisionBundle.version, "premium-decision-bundle-v5");
assert.equal(sensitiveState.functionalPolicy.planMode, "HOLD");
assert.equal(sensitiveState.functionalPolicy.allowedIntensity, "hold");
assert.equal(sensitiveState.functionalPlan.planMode, "HOLD");
assert.equal(sensitiveState.functionalRoutineAudit.status, "OPTIMIZE");
assert.equal(
  sensitiveState.functionalDecisions.find((item) => item.goalKey === "texture_exfoliation")?.status,
  "pause"
);
assert.equal(
  sensitiveState.decisionBundle.functionalPolicy.primaryGoal,
  sensitiveState.functionalPolicy.primaryGoal
);
assert.deepEqual(
  sensitiveState.decisionBundle.currentProductFindings,
  sensitiveState.currentProductFindings
);
assert.equal(sensitiveState.decisionBundle.routinePolicy.version, "routine-policy-v1");

const unknownState = buildPremiumDecisionState({
  freeResult: freeResult("pores", { pores: 24, redness: 8, barrier: 6 }),
  currentProducts: {
    selections: [{ status: "not_in_db", category: "serum", productId: null }]
  },
  currentProductVerdicts: []
}, { locale: "ko", source: "verify_unknown" });
assert.equal(unknownState.functionalPolicy.planMode, "START");
assert.equal(unknownState.functionalRoutineAudit.status, "UNKNOWN");
assert.equal(unknownState.currentProductFindings.findings[0].sourceState, "not_in_db");
assert.equal(unknownState.routinePolicy.productActions[0].action, "check_needed");

const canonicalDisplay = resolvePremiumFunctionalDisplayModel({
  report: sensitiveState,
  decisions: sensitiveState.functionalDecisions,
  locale: "ko"
});
assert.equal(canonicalDisplay.source, "canonical");
assert.strictEqual(canonicalDisplay.functionalPlan, sensitiveState.functionalPlan);
assert.strictEqual(canonicalDisplay.routineAudit, sensitiveState.functionalRoutineAudit);

const legacyDisplay = resolvePremiumFunctionalDisplayModel({
  report: {},
  decisions: [{
    goalKey: "hydration",
    status: "now",
    title: "보습·수분 유지",
    summary: "기존 저장 판단",
    reasons: ["기존 근거"],
    nextAction: "기존 행동"
  }],
  locale: "ko"
});
assert.equal(legacyDisplay.source, "legacy_adapter");
assert.equal(legacyDisplay.functionalPlan.primaryGoal, "dehydration");
assert.equal(legacyDisplay.functionalPlan.planSummary, "기존 저장 판단");

const componentSource = readFileSync(
  new URL("../components/full-report/PremiumFunctionalDecisionSection.jsx", import.meta.url),
  "utf8"
);
for (const forbidden of [
  "PRIORITY_AXIS_TO_PLAN",
  "inferPlanMode",
  "buildActualFunctionalPlan",
  "buildCurrentProductFindings",
  "sensitivityScore",
  "concernScores"
]) {
  assert.ok(!componentSource.includes(forbidden), `UI must not contain policy logic: ${forbidden}`);
}
assert.match(componentSource, /resolvePremiumFunctionalDisplayModel/);

const legacyAdapterSource = readFileSync(
  new URL("../lib/functional-plan-decision.js", import.meta.url),
  "utf8"
);
const premiumAdapterSource = readFileSync(
  new URL("../lib/premium-functional-decisions.js", import.meta.url),
  "utf8"
);
assert.match(legacyAdapterSource, /buildFunctionalPolicy/);
assert.match(premiumAdapterSource, /buildFunctionalPolicy/);

console.log("verify-functional-policy-single-source: ok");
