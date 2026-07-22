import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildConditionPolicy, CONDITION_POLICY_VERSION } from "../lib/condition-policy.js";
import { buildPremiumConditionProjection } from "../lib/premium-condition-projection.js";
import { buildPremiumDecisionState } from "../lib/premium-decision-state.js";

function context(overrides = {}) {
  return {
    skinState: {
      priorityAxis: "barrier",
      concernScores: { barrier: 24, redness: 20, dehydration: 18, acne: 8, oiliness: 7 }
    },
    survey: {
      completeness: "available",
      answers: {
        postWashFeeling: "comfortable",
        afternoonSkinChange: "mostly_same",
        recentSkinChange: "no",
        recentlyChangedProduct: "no",
        cleansingFrequency: "twice",
        environmentExposure: []
      }
    },
    safetyState: {
      level: "caution",
      sensitiveBurden: true,
      activeBurden: false,
      recentSkinChange: "no",
      recentlyChangedProduct: "no",
      reasonCodes: ["sensitive_priority"]
    },
    productExposureState: {
      rows: [],
      activeExposurePresent: false,
      duplicateActiveAxes: [],
      unknownProductCount: 0
    },
    routineBurdenState: {
      cleansingBurden: "normal",
      layerBurden: "normal",
      activeStackBurden: "none"
    },
    environmentState: {
      completeness: "available",
      outdoorExposure: false,
      heatExposure: false,
      humidityExposure: false,
      airconExposure: false,
      maskExposure: false
    },
    ...overrides
  };
}

const stable = buildConditionPolicy({ sharedContext: context() });
assert.equal(stable.version, CONDITION_POLICY_VERSION);
assert.equal(stable.responseMode, "adjust");
assert.equal(stable.invariants.protectionMustMaintain, true);
assert.equal(stable.invariants.specificProductBlameRequiresReactionEvidence, true);

const irritated = buildConditionPolicy({
  sharedContext: context({
    survey: {
      completeness: "available",
      answers: {
        postWashFeeling: "tight",
        afternoonSkinChange: "red_or_irritated",
        recentSkinChange: "yes",
        recentlyChangedProduct: "yes",
        cleansingFrequency: "3_plus",
        environmentExposure: ["heat", "mask"]
      }
    },
    safetyState: {
      level: "stabilize_first",
      sensitiveBurden: true,
      activeBurden: true,
      recentSkinChange: "yes",
      recentlyChangedProduct: "yes",
      reasonCodes: ["recent_skin_change", "recent_product_change"]
    },
    productExposureState: {
      rows: [{ sourceState: "selected", activeExposure: true }],
      activeExposurePresent: true,
      duplicateActiveAxes: [],
      unknownProductCount: 0
    },
    routineBurdenState: {
      cleansingBurden: "elevated",
      layerBurden: "normal",
      activeStackBurden: "possible"
    },
    environmentState: {
      completeness: "available",
      outdoorExposure: false,
      heatExposure: true,
      humidityExposure: false,
      airconExposure: false,
      maskExposure: true
    }
  })
});
assert.equal(irritated.responseMode, "stabilize");
assert.equal(irritated.scenarios.find((item) => item.conditionKey === "redness_irritation")?.triggerState, "active");
assert.equal(irritated.scenarios.find((item) => item.conditionKey === "active_exposure_burden")?.responseLevel, "pause_optional");
assert.equal(irritated.scenarios.find((item) => item.conditionKey === "environment_recovery")?.triggerState, "active");

const unknownProduct = buildConditionPolicy({
  sharedContext: context({
    productExposureState: {
      rows: [{ sourceState: "not_in_db", activeExposure: false }],
      activeExposurePresent: false,
      duplicateActiveAxes: [],
      unknownProductCount: 1
    }
  })
});
const unknownActive = unknownProduct.scenarios.find((item) => item.conditionKey === "active_exposure_burden");
assert.equal(unknownActive.triggerState, "unknown");
assert.notEqual(unknownActive.responseLevel, "pause_optional");
assert.ok(unknownActive.unknownReasons.includes("unknown_product_prevents_specific_stop_decision"));

const breakoutUnknown = stable.scenarios.find((item) => item.conditionKey === "breakout_shift");
const flakingUnknown = stable.scenarios.find((item) => item.conditionKey === "flaking_shift");
assert.equal(breakoutUnknown.triggerState, "unknown");
assert.equal(flakingUnknown.triggerState, "unknown");

const withoutSiblings = buildConditionPolicy({ sharedContext: context() });
const withSiblings = buildConditionPolicy({
  sharedContext: context(),
  functionalPolicy: { planMode: "HOLD" },
  routinePolicy: { weeklySchedule: { activeDaysMax: 0 } },
  currentProductVerdicts: [{ status: "hold" }],
  routineStructure: { type: "recovery" }
});
assert.deepEqual(withSiblings, withoutSiblings);
assert.deepEqual(buildConditionPolicy({ sharedContext: context() }), buildConditionPolicy({ sharedContext: context() }));

const projection = buildPremiumConditionProjection({
  report: {},
  conditionPolicy: irritated,
  locale: "ko"
});
assert.equal(projection.conditionPlan.version, "premium-condition-projection-v1");
assert.ok(projection.conditionResponses.some((item) => item.status === "avoid_for_now"));
assert.ok(projection.conditionPlan.globalNotice);

const decisionState = buildPremiumDecisionState({
  freeResult: {
    priority: { axis: "barrier", score: 24 },
    scoring: { concernScores: { barrier: { total: 24 }, redness: { total: 20 } } },
    answers: {
      postWashFeeling: "tight",
      afternoonSkinChange: "red_or_irritated",
      recentSkinChange: "yes",
      recentlyChangedProduct: "no",
      cleansingFrequency: "3_plus",
      environmentExposure: ["heat"]
    }
  }
}, { locale: "ko", source: "verify_condition_policy" });
assert.equal(decisionState.decisionBundle.version, "premium-decision-bundle-v4");
assert.equal(decisionState.conditionPolicy.version, "condition-policy-v1");
assert.equal(decisionState.conditionPlan.version, "premium-condition-projection-v1");
assert.deepEqual(decisionState.decisionBundle.conditionResponses, decisionState.conditionResponses);
assert.equal(decisionState.decisionBundle.dependencies.functionalPolicyResult, false);
assert.equal(decisionState.decisionBundle.dependencies.routinePolicyResult, false);
assert.equal(decisionState.decisionBundle.context.version, "shared-skin-decision-context-v3");
assert.equal(decisionState.decisionBundle.context.conditionSignalState.rednessOrIrritation, "yes");
assert.equal(decisionState.conditionPlan.source, "canonical");

const analyzeSource = readFileSync(new URL("../app/api/analyze/route.js", import.meta.url), "utf8");
assert.match(analyzeSource, /rebuildPremiumDecisionState\(premiumDecisionSource/);
assert.match(analyzeSource, /source: "api_analyze_initial_session"/);
for (const artifact of ["conditionPolicy", "conditionPlan", "decisionBundle"]) {
  assert.match(analyzeSource, new RegExp(`${artifact}: sanitizeCanonicalDecisionArtifact`));
}

const conditionComponentSource = readFileSync(
  new URL("../components/full-report/PremiumConditionResponseSection.jsx", import.meta.url),
  "utf8"
);
assert.match(conditionComponentSource, /Array\.isArray\(conditionPlan\?\.responses\)/);
assert.match(conditionComponentSource, /data-condition-source=\{source\}/);
assert.match(conditionComponentSource, /canonicalResponses \|\|/);

const fullReportPageSource = readFileSync(new URL("../app/result/full-report/page.js", import.meta.url), "utf8");
assert.match(fullReportPageSource, /conditionPlan=\{report\?\.conditionPlan \|\| report\?\.decisionBundle\?\.conditionPlan\}/);

const decisionSource = readFileSync(new URL("../lib/premium-decision-state.js", import.meta.url), "utf8");
assert.ok(!decisionSource.includes("buildPremiumConditionResponses"));
assert.match(decisionSource, /buildConditionPolicy\(\{ sharedContext: context \}\)/);

console.log("verify-condition-policy-single-source: PASS");
