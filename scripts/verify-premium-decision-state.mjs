import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPremiumConditionResponses } from "../lib/premium-condition-responses.js";
import {
  buildPremiumDecisionState,
  rebuildPremiumDecisionState
} from "../lib/premium-decision-state.js";
import { buildRotatedPremiumReportPayload } from "../lib/premium-report-reentry.js";

function baseReport(extra = {}) {
  return {
    freeResult: {
      priority: { axis: "barrier", score: 24 },
      scoring: {
        concernScores: {
          barrier: { total: 24 },
          redness: { total: 20 },
          pores: { total: 22 },
          dehydration: { total: 16 }
        }
      }
    },
    routineStructure: { type: "barrier_first" },
    conditionResponses: [
      {
        responseKey: "cleansing_load",
        status: "reduce",
        title: "기존 세안 판단",
        summary: "기존 설문 기반 판단",
        reasons: ["기존 설문 근거"],
        action: "기존 행동"
      }
    ],
    ...extra
  };
}

function functionalStatus(state, key) {
  return state.functionalDecisions.find((item) => item.goalKey === key)?.status || null;
}

function conditionStatus(state, key) {
  return state.conditionResponses.find((item) => item.responseKey === key)?.status || null;
}

const emptyState = buildPremiumDecisionState(
  baseReport({ currentProducts: null, currentProductVerdicts: [] }),
  { locale: "ko", source: "verify_empty" }
);
assert.equal(emptyState.decisionBundle.version, "premium-decision-bundle-v5");
assert.ok(emptyState.decisionBundle.rawPolicies.functional);
assert.ok(emptyState.decisionBundle.consistency);
assert.equal(emptyState.decisionBundle.effectivePolicySource, "raw");
assert.equal(emptyState.decisionBundle.contextRevision, 1);
assert.equal(emptyState.decisionBundle.context.productExposureState.activeExposurePresent, false);
assert.equal(emptyState.functionalPolicy.version, "functional-policy-v1");
assert.equal(emptyState.functionalPlan.policyVersion, "functional-policy-v1");
assert.equal(emptyState.routinePolicy.version, "routine-policy-v1");
assert.equal(emptyState.routinePlan.version, "premium-routine-projection-v1");
assert.equal(emptyState.routinePolicy.invariants.sunscreenRequiredInMorning, true);
assert.equal(emptyState.functionalRoutineAudit.status, "NO_ROUTINE_DATA");
assert.equal(functionalStatus(emptyState, "texture_exfoliation"), "later");
assert.equal(conditionStatus(emptyState, "active_load"), null);
assert.equal(
  emptyState.conditionResponses.find((item) => item.responseKey === "cleansing_load")?.title,
  "기존 세안 판단",
  "survey-dependent legacy output must remain when raw answers were not persisted"
);

const activeProduct = {
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
};

const activeReport = baseReport({
  freeResult: {
    ...baseReport().freeResult,
    priority: { axis: "pores", score: 25 },
    answers: { sensitivity: "high", recentSkinChange: "yes" }
  },
  currentProducts: {
    selections: [activeProduct],
    summary: { total: 1, selectedCount: 1 }
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
  ]
});
const activeState = buildPremiumDecisionState(activeReport, {
  locale: "ko",
  source: "verify_active"
});

assert.equal(activeState.decisionBundle.context.productExposureState.activeExposurePresent, true);
assert.deepEqual(activeState.decisionBundle.context.productExposureState.rows[0].activeAxes, ["exfoliation"]);
assert.equal(activeState.decisionBundle.context.safetyState.activeBurden, true);
assert.equal(activeState.functionalPolicy.planMode, "HOLD");
assert.equal(activeState.functionalPlan.planMode, "HOLD");
assert.equal(activeState.routinePolicy.weeklySchedule.activeDaysMax, 0);
assert.equal(activeState.routineProductActions[0].action, "hold");
assert.equal(activeState.functionalRoutineAudit.status, "OPTIMIZE");
assert.equal(functionalStatus(activeState, "texture_exfoliation"), "pause");
assert.equal(conditionStatus(activeState, "active_load"), "avoid_for_now");

const unknownState = buildPremiumDecisionState(
  baseReport({
    currentProducts: {
      selections: [{ status: "not_in_db", category: "serum", productId: null }],
      summary: { total: 1, notInDbCount: 1 }
    },
    currentProductVerdicts: []
  }),
  { locale: "ko", source: "verify_unknown" }
);

assert.equal(unknownState.decisionBundle.context.productExposureState.unknownProductCount, 1);
assert.equal(unknownState.decisionBundle.context.productExposureState.activeExposurePresent, false);
assert.equal(unknownState.routinePolicy.status, "partial");
assert.equal(unknownState.routineProductActions[0].action, "check_needed");
assert.equal(unknownState.functionalRoutineAudit.status, "UNKNOWN");
assert.notEqual(conditionStatus(unknownState, "active_load"), "avoid_for_now");

const rebuiltOnce = rebuildPremiumDecisionState(activeReport, {
  locale: "ko",
  source: "verify_revision"
});
const rebuiltAgain = rebuildPremiumDecisionState(rebuiltOnce, {
  locale: "ko",
  source: "verify_revision"
});

assert.equal(rebuiltAgain.decisionBundle.contextHash, rebuiltOnce.decisionBundle.contextHash);
assert.equal(rebuiltAgain.decisionBundle.contextRevision, rebuiltOnce.decisionBundle.contextRevision);

const changed = rebuildPremiumDecisionState(
  { ...rebuiltAgain, currentProducts: null, currentProductVerdicts: [] },
  { locale: "ko", source: "verify_revision_change" }
);
assert.notEqual(changed.decisionBundle.contextHash, rebuiltAgain.decisionBundle.contextHash);
assert.equal(changed.decisionBundle.contextRevision, rebuiltAgain.decisionBundle.contextRevision + 1);

const previousSurvey = rebuildPremiumDecisionState(
  baseReport({
    freeResult: {
      ...baseReport().freeResult,
      answers: { recentSkinChange: "no" }
    }
  }),
  { locale: "ko", source: "verify_survey_revision" }
);
const changedSurvey = rebuildPremiumDecisionState(
  {
    ...previousSurvey,
    freeResult: {
      ...previousSurvey.freeResult,
      answers: { recentSkinChange: "yes" }
    }
  },
  { locale: "ko", source: "verify_survey_revision_change" }
);
assert.equal(changedSurvey.decisionBundle.context.survey.answers.recentSkinChange, "yes");
assert.equal(changedSurvey.decisionBundle.context.safetyState.recentSkinChange, "yes");
assert.notEqual(changedSurvey.decisionBundle.contextHash, previousSurvey.decisionBundle.contextHash);
assert.equal(changedSurvey.decisionBundle.contextRevision, previousSurvey.decisionBundle.contextRevision + 1);

const rotated = buildRotatedPremiumReportPayload(rebuiltOnce);
assert.ok(rotated);
assert.equal(rotated.currentProducts, null);
assert.deepEqual(rotated.currentProductVerdicts, []);
assert.equal(rotated.decisionBundle.context.productExposureState.activeExposurePresent, false);
assert.equal(rotated.functionalRoutineAudit.status, "NO_ROUTINE_DATA");
assert.notEqual(conditionStatus(rotated, "active_load"), "avoid_for_now");

const conditionBase = {
  locale: "ko",
  priorityAxis: "barrier",
  scoreCard: { barrier: { total: 24 } },
  safetyState: { sensitiveBurden: true, activeBurden: false, level: "caution" },
  productExposureState: {
    activeExposurePresent: false,
    duplicateActiveAxes: [],
    highCautionExposureCount: 0
  }
};
const withoutSibling = buildPremiumConditionResponses(conditionBase);
const withSibling = buildPremiumConditionResponses({
  ...conditionBase,
  functionalDecisions: [{ goalKey: "texture_exfoliation", status: "pause" }]
});
assert.deepEqual(withSibling, withoutSibling, "condition policy must ignore functional final output");

const fullReportRoute = readFileSync(
  new URL("../app/api/full-report/route.js", import.meta.url),
  "utf8"
);
assert.match(
  fullReportRoute,
  /const currentProductVerdicts = buildPremiumCurrentProductVerdicts\(currentProducts, report, locale\);/,
  "empty current-product submissions must still rebuild the premium decision state"
);

console.log("verify-premium-decision-state: ok");
