import { createHash } from "node:crypto";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import { buildCandidateStyleDelta } from "../candidate-style-delta.js";
import { buildStyleRoutes } from "../route-generator.js";
import {
  buildFaceLabV2TargetSweepCohort
} from "./target-responsiveness.js";

export const FACE_LAB_V2_CANDIDATE_PERSONALIZATION_EVALUATOR_VERSION =
  "face-lab-v2-candidate-personalization-evaluator-v1";

export const FACE_LAB_V2_CANDIDATE_EVALUATION_CONTRACT_VERSION =
  "face-lab-v2-candidate-evaluation-contract-v1";

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

function selectedRouteFromCanonical(canonical) {
  return (canonical?.routes?.routes || []).find(
    (route) =>
      route.routeId === canonical?.routes?.selectedRouteId
  ) || null;
}

function selectCandidateRoute(routes) {
  const list = Array.isArray(routes?.routes)
    ? routes.routes
    : [];
  if (!list.length) return null;

  if (routes.defaultRouteId) {
    const preferred = list.find(
      (route) => route.routeId === routes.defaultRouteId
    );
    if (preferred) return preferred;
  }

  return list[0];
}

function activePriorities(styleDelta) {
  return Array.isArray(styleDelta?.priorities)
    ? styleDelta.priorities.filter(
        (item) => item?.constraintState !== "blocked"
      )
    : [];
}

function styleDeltaSignature(styleDelta) {
  return activePriorities(styleDelta)
    .map((item) =>
      [
        item.domain,
        item.parameter,
        item.direction,
        item.strength,
        item.reason || ""
      ].join(":")
    )
    .sort()
    .join("|");
}

function actionSignature(route) {
  if (!route) return "NO_ROUTE";
  return (route.actions || [])
    .map((item) =>
      [
        item.domain,
        item.parameter,
        item.direction,
        item.strength,
        item.reason || ""
      ].join(":")
    )
    .sort()
    .join("|");
}

function parameterSignature(route) {
  if (!route) return "NO_ROUTE";
  return (route.actions || [])
    .map(
      (item) => item.domain + ":" + item.parameter
    )
    .sort()
    .join("|");
}

function wordingSignature(route) {
  if (!route) return "NO_ROUTE";
  return (route.actions || [])
    .map((item) => item.explanation || "")
    .filter(Boolean)
    .sort()
    .join("||");
}

function routeSignature(route) {
  if (!route) return "NO_ROUTE";
  return (
    (route.strategy || route.routeId || "UNKNOWN") +
    "::" +
    actionSignature(route)
  );
}

function actionIdentity(item) {
  return {
    rank: item?.rank ?? null,
    domain: item?.domain ?? null,
    parameter: item?.parameter ?? null,
    direction: item?.direction ?? null,
    constraintState: item?.constraintState ?? null,
    blockedBy: item?.blockedBy ?? null
  };
}

function increment(counter, key) {
  if (!key) return;
  counter[key] = (counter[key] || 0) + 1;
}

function maxConcentration(counter, denominator) {
  if (!denominator) return 0;
  const max = Math.max(
    0,
    ...Object.values(counter)
  );
  return Number((max / denominator).toFixed(4));
}

function summarizeRows(rows, prefix) {
  const routeCounts = {};
  const actionSignatureCounts = {};
  const parameterSignatureCounts = {};
  const wordingSignatureCounts = {};

  for (const row of rows) {
    increment(routeCounts, row[prefix + "RouteStrategy"]);
    increment(
      actionSignatureCounts,
      row[prefix + "ActionSignature"]
    );
    increment(
      parameterSignatureCounts,
      row[prefix + "ParameterSignature"]
    );
    increment(
      wordingSignatureCounts,
      row[prefix + "WordingSignature"]
    );
  }

  return {
    caseCount: rows.length,
    actionableCaseCount: rows.filter(
      (row) =>
        row[prefix + "RouteStrategy"] !== "NO_ROUTE"
    ).length,
    uniqueRouteStrategyCount:
      Object.keys(routeCounts).length,
    uniqueActionSignatureCount:
      Object.keys(actionSignatureCounts).length,
    uniqueParameterSignatureCount:
      Object.keys(parameterSignatureCounts).length,
    uniqueWordingSignatureCount:
      Object.keys(wordingSignatureCounts).length,
    routeConcentration:
      maxConcentration(routeCounts, rows.length),
    actionSignatureConcentration:
      maxConcentration(
        actionSignatureCounts,
        rows.length
      ),
    parameterSignatureConcentration:
      maxConcentration(
        parameterSignatureCounts,
        rows.length
      ),
    wordingSignatureConcentration:
      maxConcentration(
        wordingSignatureCounts,
        rows.length
      )
  };
}

function groupedDiagnostics(rows, key, prefix) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }

  return [...groups.entries()]
    .map(([value, groupRows]) => ({
      [key]: value,
      ...summarizeRows(groupRows, prefix),
      changedCaseCount: groupRows.filter(
        (row) => row.selectedRouteChanged
      ).length,
      activatedCaseCount: groupRows.filter(
        (row) => row.candidateRelationIds.length > 0
      ).length
    }))
    .sort((left, right) =>
      String(left[key]).localeCompare(
        String(right[key])
      )
    );
}

function addFailure(
  failures,
  {
    caseId,
    evaluatorId,
    expected,
    observed
  }
) {
  const payload = {
    caseId,
    evaluatorId,
    severity: "hard",
    expected,
    observed
  };
  failures.push({
    ...payload,
    fingerprint: fingerprint(payload)
  });
}

function relationEvidence(action) {
  return (action?.evidence || []).filter(
    (value) =>
      typeof value === "string" &&
      value.startsWith("candidate_relation:")
  );
}

function faceEvidence(action) {
  return (action?.evidence || []).filter(
    (value) =>
      typeof value === "string" &&
      value.startsWith("face_feature:")
  );
}

export function runFaceLabV2CandidatePersonalizationEvaluation() {
  const cohort = buildFaceLabV2TargetSweepCohort();
  const failures = [];
  const rows = [];
  const relationActivationCounts = {};
  const targetActivationCounts = {};
  const faceActivationCounts = {};

  let candidateRelationActionCount = 0;
  let candidateRelationActionWithFaceEvidenceCount = 0;
  let rationaleMutationActionCount = 0;

  for (const caseDef of cohort.cases) {
    const currentCanonical =
      buildFaceLabV2Canonical({
        analysis: caseDef.analysis,
        surveyAnswers: caseDef.surveyAnswers,
        resultId: caseDef.caseId
      });

    const currentStyleDelta =
      currentCanonical.styleDelta;
    const currentRoute =
      selectedRouteFromCanonical(currentCanonical);

    const candidateStyleDelta =
      buildCandidateStyleDelta({
        currentFaceProfile:
          currentCanonical.currentFaceProfile,
        targetStyle:
          currentCanonical.targetStyle
      });

    const candidateRoutes = buildStyleRoutes(
      candidateStyleDelta,
      {
        locale: "ko",
        targetStyle:
          currentCanonical.targetStyle
      }
    );
    const candidateRoute =
      selectCandidateRoute(candidateRoutes);

    const candidateRelationIds = [
      ...new Set(
        (
          candidateStyleDelta
            .personalizationLedger || []
        ).map((entry) => entry.relationId)
      )
    ];

    for (const relationId of candidateRelationIds) {
      increment(
        relationActivationCounts,
        relationId
      );
    }
    if (candidateRelationIds.length) {
      increment(
        targetActivationCounts,
        caseDef.targetKey
      );
      increment(
        faceActivationCounts,
        caseDef.faceGroupId
      );
    }

    const currentPriorities =
      currentStyleDelta?.priorities || [];
    const candidatePriorities =
      candidateStyleDelta?.priorities || [];

    if (
      currentPriorities.length !==
      candidatePriorities.length
    ) {
      addFailure(failures, {
        caseId: caseDef.caseId,
        evaluatorId:
          "C1-action-count-authority",
        expected: currentPriorities.length,
        observed: candidatePriorities.length
      });
    }

    const boundedLength = Math.min(
      currentPriorities.length,
      candidatePriorities.length
    );
    for (
      let index = 0;
      index < boundedLength;
      index += 1
    ) {
      const currentAction =
        currentPriorities[index];
      const candidateAction =
        candidatePriorities[index];

      const currentIdentity =
        actionIdentity(currentAction);
      const candidateIdentity =
        actionIdentity(candidateAction);

      if (
        stableStringify(currentIdentity) !==
        stableStringify(candidateIdentity)
      ) {
        addFailure(failures, {
          caseId: caseDef.caseId,
          evaluatorId:
            "C2-action-identity-authority",
          expected: currentIdentity,
          observed: candidateIdentity
        });
      }

      if (
        currentAction?.constraintState ===
          "blocked" &&
        stableStringify(currentAction) !==
          stableStringify(candidateAction)
      ) {
        addFailure(failures, {
          caseId: caseDef.caseId,
          evaluatorId:
            "C3-blocked-action-authority",
          expected: currentAction,
          observed: candidateAction
        });
      }
    }

    const currentStyleSignature =
      styleDeltaSignature(currentStyleDelta);
    const candidateStyleSignature =
      styleDeltaSignature(candidateStyleDelta);

    if (
      !candidateRelationIds.length &&
      currentStyleSignature !==
        candidateStyleSignature
    ) {
      addFailure(failures, {
        caseId: caseDef.caseId,
        evaluatorId:
          "C4-change-without-candidate-relation",
        expected: currentStyleSignature,
        observed: candidateStyleSignature
      });
    }

    for (
      const ledgerEntry of
        candidateStyleDelta
          .personalizationLedger || []
    ) {
      const related = candidatePriorities.find(
        (item) =>
          item.domain === ledgerEntry.domain &&
          item.parameter ===
            ledgerEntry.parameter &&
          relationEvidence(item).includes(
            "candidate_relation:" +
              ledgerEntry.relationId
          )
      );

      if (!related) {
        addFailure(failures, {
          caseId: caseDef.caseId,
          evaluatorId:
            "C5-candidate-relation-lineage",
          expected:
            ledgerEntry.relationId +
            " traceable to a candidate action",
          observed: null
        });
        continue;
      }

      if (!faceEvidence(related).length) {
        addFailure(failures, {
          caseId: caseDef.caseId,
          evaluatorId:
            "C6-face-evidence-lineage",
          expected:
            "candidate relation action retains face_feature evidence",
          observed: related.evidence
        });
      }

      if (
        !related.evidence?.some(
          (value) =>
            value === "target_axis:softSharp"
        )
      ) {
        addFailure(failures, {
          caseId: caseDef.caseId,
          evaluatorId:
            "C7-target-evidence-lineage",
          expected:
            "target_axis:softSharp preserved",
          observed: related.evidence
        });
      }
    }

    const candidateRouteActions =
      candidateRoute?.actions || [];
    const currentRouteActions =
      currentRoute?.actions || [];

    for (const action of candidateRouteActions) {
      const relations = relationEvidence(action);
      if (!relations.length) continue;

      candidateRelationActionCount += 1;
      if (faceEvidence(action).length) {
        candidateRelationActionWithFaceEvidenceCount += 1;
      }

      const currentMatch =
        currentRouteActions.find(
          (currentAction) =>
            currentAction.domain === action.domain &&
            currentAction.parameter ===
              action.parameter &&
            currentAction.direction ===
              action.direction
        );

      if (
        currentMatch &&
        currentMatch.explanation !==
          action.explanation
      ) {
        rationaleMutationActionCount += 1;
      }
    }

    rows.push({
      caseId: caseDef.caseId,
      faceGroupId: caseDef.faceGroupId,
      targetKey: caseDef.targetKey,
      candidateRelationIds,
      currentStyleDeltaSignature:
        currentStyleSignature,
      candidateStyleDeltaSignature:
        candidateStyleSignature,
      styleDeltaChanged:
        currentStyleSignature !==
        candidateStyleSignature,
      currentRouteStrategy:
        currentRoute?.strategy || "NO_ROUTE",
      candidateRouteStrategy:
        candidateRoute?.strategy || "NO_ROUTE",
      currentActionSignature:
        actionSignature(currentRoute),
      candidateActionSignature:
        actionSignature(candidateRoute),
      currentParameterSignature:
        parameterSignature(currentRoute),
      candidateParameterSignature:
        parameterSignature(candidateRoute),
      currentWordingSignature:
        wordingSignature(currentRoute),
      candidateWordingSignature:
        wordingSignature(candidateRoute),
      currentRouteSignature:
        routeSignature(currentRoute),
      candidateRouteSignature:
        routeSignature(candidateRoute),
      selectedRouteChanged:
        routeSignature(currentRoute) !==
        routeSignature(candidateRoute)
    });
  }

  if (rows.length !== cohort.caseCount) {
    addFailure(failures, {
      caseId: "cohort",
      evaluatorId: "C8-case-accounting",
      expected: cohort.caseCount,
      observed: rows.length
    });
  }

  const targetCurrentDiagnostics =
    groupedDiagnostics(
      rows,
      "targetKey",
      "current"
    );
  const targetCandidateDiagnostics =
    groupedDiagnostics(
      rows,
      "targetKey",
      "candidate"
    );
  const faceCurrentDiagnostics =
    groupedDiagnostics(
      rows,
      "faceGroupId",
      "current"
    );
  const faceCandidateDiagnostics =
    groupedDiagnostics(
      rows,
      "faceGroupId",
      "candidate"
    );

  const currentDistribution =
    summarizeRows(rows, "current");
  const candidateDistribution =
    summarizeRows(rows, "candidate");

  const candidateActivatedCaseCount =
    rows.filter(
      (row) =>
        row.candidateRelationIds.length > 0
    ).length;
  const styleDeltaChangedCaseCount =
    rows.filter(
      (row) => row.styleDeltaChanged
    ).length;
  const selectedRouteChangedCaseCount =
    rows.filter(
      (row) => row.selectedRouteChanged
    ).length;

  const currentTargetFullyCollapsedCount =
    targetCurrentDiagnostics.filter(
      (item) =>
        item.uniqueActionSignatureCount <= 1
    ).length;
  const candidateTargetFullyCollapsedCount =
    targetCandidateDiagnostics.filter(
      (item) =>
        item.uniqueActionSignatureCount <= 1
    ).length;

  const average = (values) =>
    Number(
      (
        values.reduce(
          (sum, value) => sum + value,
          0
        ) /
        Math.max(1, values.length)
      ).toFixed(3)
    );

  const hardFailures = failures.filter(
    (item) => item.severity === "hard"
  );

  return {
    reportVersion:
      "face-lab-v2-candidate-personalization-report-v1",
    evaluatorVersion:
      FACE_LAB_V2_CANDIDATE_PERSONALIZATION_EVALUATOR_VERSION,
    contractVersion:
      FACE_LAB_V2_CANDIDATE_EVALUATION_CONTRACT_VERSION,
    cohort: {
      version: cohort.cohortVersion,
      seed: cohort.seed,
      faceCount: cohort.faceCount,
      targetCount: cohort.targetCount,
      caseCount: cohort.caseCount,
      hash: cohort.cohortHash
    },
    summary: {
      caseCount: rows.length,
      candidateActivatedCaseCount,
      styleDeltaChangedCaseCount,
      selectedRouteChangedCaseCount,
      candidateRelationActionCount,
      candidateRelationActionWithFaceEvidenceCount,
      faceEvidenceUtilizationRate:
        candidateRelationActionCount
          ? Number(
              (
                candidateRelationActionWithFaceEvidenceCount /
                candidateRelationActionCount
              ).toFixed(4)
            )
          : 0,
      humanVisibleRationaleMutationRate:
        candidateRelationActionCount
          ? Number(
              (
                rationaleMutationActionCount /
                candidateRelationActionCount
              ).toFixed(4)
            )
          : 0,
      routeMutationRate: Number(
        (
          selectedRouteChangedCaseCount /
          Math.max(1, rows.length)
        ).toFixed(4)
      ),
      currentTargetFullyCollapsedCount,
      candidateTargetFullyCollapsedCount,
      currentAverageTargetUniqueActionSignatureCount:
        average(
          targetCurrentDiagnostics.map(
            (item) =>
              item.uniqueActionSignatureCount
          )
        ),
      candidateAverageTargetUniqueActionSignatureCount:
        average(
          targetCandidateDiagnostics.map(
            (item) =>
              item.uniqueActionSignatureCount
          )
        ),
      currentAverageFaceUniqueActionSignatureCount:
        average(
          faceCurrentDiagnostics.map(
            (item) =>
              item.uniqueActionSignatureCount
          )
        ),
      candidateAverageFaceUniqueActionSignatureCount:
        average(
          faceCandidateDiagnostics.map(
            (item) =>
              item.uniqueActionSignatureCount
          )
        ),
      hardFailureCount: hardFailures.length
    },
    distributions: {
      relationActivationCounts,
      targetActivationCounts,
      faceActivationCounts,
      current: currentDistribution,
      candidate: candidateDistribution
    },
    targetDiagnostics: {
      current: targetCurrentDiagnostics,
      candidate: targetCandidateDiagnostics
    },
    faceDiagnostics: {
      current: faceCurrentDiagnostics,
      candidate: faceCandidateDiagnostics
    },
    rows,
    failures
  };
}
