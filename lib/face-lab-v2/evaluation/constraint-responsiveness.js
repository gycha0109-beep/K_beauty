import { createHash } from "node:crypto";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";

export const FACE_LAB_V2_CONSTRAINT_RESPONSIVENESS_VERSION =
  "face-lab-v2-constraint-responsiveness-evaluator-v1";

const DAILY_EFFORT_RANK = Object.freeze({
  low: 1,
  medium: 2,
  high: 3
});

const COST_RANK = Object.freeze({
  low: 1,
  standard: 2,
  higher: 3
});

const MAINTENANCE_RANK = Object.freeze({
  low: 1,
  medium: 2,
  high: 3
});

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function fingerprint(value) {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")
    .slice(0, 16);
}

function clone(value) {
  return structuredClone(value);
}

function selectedRoute(canonical) {
  return (canonical?.routes?.routes || []).find(
    (route) => route.routeId === canonical?.routes?.selectedRouteId
  ) || null;
}

function addFailure(failures, {
  caseId,
  evaluatorId,
  expected,
  observed,
  dimension
}) {
  const payload = {
    caseId,
    evaluatorId,
    severity: "hard",
    dimension,
    expected,
    observed
  };

  failures.push({
    ...payload,
    fingerprint: fingerprint(payload)
  });
}

function build(caseDef, surveyAnswers, suffix) {
  return buildFaceLabV2Canonical({
    analysis: caseDef.analysis,
    surveyAnswers,
    resultId: `${caseDef.caseId}-${suffix}`
  });
}

function compareRank({
  caseId,
  dimension,
  baselineRoute,
  constrainedRoute,
  field,
  rank,
  failures
}) {
  if (!baselineRoute || !constrainedRoute) {
    addFailure(failures, {
      caseId,
      evaluatorId: "E6-constraint-route-loss",
      dimension,
      expected: "both baseline and constrained variants retain an actionable selected route",
      observed: {
        baselineRouteId: baselineRoute?.routeId || null,
        constrainedRouteId: constrainedRoute?.routeId || null
      }
    });
    return;
  }

  const baselineValue = baselineRoute[field];
  const constrainedValue = constrainedRoute[field];
  const baselineRank = rank[baselineValue];
  const constrainedRank = rank[constrainedValue];

  if (!baselineRank || !constrainedRank) {
    addFailure(failures, {
      caseId,
      evaluatorId: "E6-constraint-rank-unknown",
      dimension,
      expected: `known ${field} rank`,
      observed: {
        baselineValue,
        constrainedValue
      }
    });
    return;
  }

  if (constrainedRank > baselineRank) {
    addFailure(failures, {
      caseId,
      evaluatorId: "E6-constraint-regression",
      dimension,
      expected: `${field} must stay equal or become lighter under tighter constraint`,
      observed: {
        baseline: {
          routeId: baselineRoute.routeId,
          value: baselineValue
        },
        constrained: {
          routeId: constrainedRoute.routeId,
          value: constrainedValue
        }
      }
    });
  }
}

function makeupActions(canonical) {
  return (canonical?.routes?.routes || []).flatMap((route) =>
    (route.actions || [])
      .filter((action) => action.domain === "makeup")
      .map((action) => ({
        routeId: route.routeId,
        parameter: action.parameter,
        strength: action.strength
      }))
  );
}

export function runFaceLabV2ConstraintResponsivenessEvaluation(cases = []) {
  const failures = [];
  const diagnostics = [];
  let pairedComparisonCount = 0;
  let dailyRouteChangedCount = 0;
  let budgetRouteChangedCount = 0;
  let maintenanceRouteChangedCount = 0;
  let makeupActionCount = 0;

  for (const caseDef of cases) {
    const baseSurvey = clone(caseDef.surveyAnswers);
    baseSurvey.constraints.lifestyle.dailyMinutes = 30;
    baseSurvey.constraints.lifestyle.budgetBand = "standard";
    baseSurvey.constraints.lifestyle.maintenanceTolerance = "medium";

    const baseline = build(caseDef, baseSurvey, "constraint-baseline");
    const baselineRoute = selectedRoute(baseline);

    const fiveMinuteSurvey = clone(baseSurvey);
    fiveMinuteSurvey.constraints.lifestyle.dailyMinutes = 5;
    const fiveMinute = build(caseDef, fiveMinuteSurvey, "constraint-5m");
    const fiveMinuteRoute = selectedRoute(fiveMinute);
    pairedComparisonCount += 1;

    compareRank({
      caseId: caseDef.caseId,
      dimension: "dailyMinutes:30→5",
      baselineRoute,
      constrainedRoute: fiveMinuteRoute,
      field: "dailyEffort",
      rank: DAILY_EFFORT_RANK,
      failures
    });

    if (baselineRoute?.routeId !== fiveMinuteRoute?.routeId) {
      dailyRouteChangedCount += 1;
    }

    const lowBudgetSurvey = clone(baseSurvey);
    lowBudgetSurvey.constraints.lifestyle.budgetBand = "low";
    const lowBudget = build(caseDef, lowBudgetSurvey, "constraint-low-budget");
    const lowBudgetRoute = selectedRoute(lowBudget);
    pairedComparisonCount += 1;

    compareRank({
      caseId: caseDef.caseId,
      dimension: "budgetBand:standard→low",
      baselineRoute,
      constrainedRoute: lowBudgetRoute,
      field: "costBand",
      rank: COST_RANK,
      failures
    });

    if (baselineRoute?.routeId !== lowBudgetRoute?.routeId) {
      budgetRouteChangedCount += 1;
    }

    const lowMaintenanceSurvey = clone(baseSurvey);
    lowMaintenanceSurvey.constraints.lifestyle.maintenanceTolerance = "low";
    const lowMaintenance = build(
      caseDef,
      lowMaintenanceSurvey,
      "constraint-low-maintenance"
    );
    const lowMaintenanceRoute = selectedRoute(lowMaintenance);
    pairedComparisonCount += 1;

    compareRank({
      caseId: caseDef.caseId,
      dimension: "maintenanceTolerance:medium→low",
      baselineRoute,
      constrainedRoute: lowMaintenanceRoute,
      field: "maintenance",
      rank: MAINTENANCE_RANK,
      failures
    });

    if (baselineRoute?.routeId !== lowMaintenanceRoute?.routeId) {
      maintenanceRouteChangedCount += 1;
    }

    const lightMakeupSurvey = clone(baseSurvey);
    lightMakeupSurvey.constraints.makeup.intensity = "light";
    const lightMakeup = build(
      caseDef,
      lightMakeupSurvey,
      "constraint-light-makeup"
    );

    const lightActions = makeupActions(lightMakeup);
    makeupActionCount += lightActions.length;
    pairedComparisonCount += 1;

    for (const action of lightActions) {
      if (action.strength !== "light") {
        addFailure(failures, {
          caseId: caseDef.caseId,
          evaluatorId: "E6-makeup-intensity-cap",
          dimension: "makeupIntensity:light",
          expected: "all emitted makeup route actions use light strength",
          observed: action
        });
      }
    }

    diagnostics.push({
      caseId: caseDef.caseId,
      baselineRouteId: baselineRoute?.routeId || null,
      fiveMinuteRouteId: fiveMinuteRoute?.routeId || null,
      lowBudgetRouteId: lowBudgetRoute?.routeId || null,
      lowMaintenanceRouteId: lowMaintenanceRoute?.routeId || null,
      lightMakeupActionCount: lightActions.length
    });
  }

  return {
    reportVersion: "face-lab-v2-constraint-responsiveness-report-v1",
    evaluatorVersion: FACE_LAB_V2_CONSTRAINT_RESPONSIVENESS_VERSION,
    summary: {
      inputCaseCount: cases.length,
      pairedComparisonCount,
      hardFailureCount: failures.length,
      dailyRouteChangedCount,
      budgetRouteChangedCount,
      maintenanceRouteChangedCount,
      makeupActionCount
    },
    diagnostics,
    failures
  };
}
