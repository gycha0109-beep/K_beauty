import { createHash } from "node:crypto";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import {
  buildFaceLabV2TargetSweepCohort
} from "./target-responsiveness.js";
import {
  FACE_LAB_V2_EVALUATION_CONTRACT_VERSION
} from "./contracts.js";

export const FACE_LAB_V2_SPECIFICITY_DISTRIBUTION_VERSION =
  "face-lab-v2-specificity-distribution-evaluator-v1";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
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

function increment(counter, key) {
  if (!key) return;
  counter[key] = (counter[key] || 0) + 1;
}

function selectedRoute(canonical) {
  return (canonical?.routes?.routes || []).find(
    (route) => route.routeId === canonical?.routes?.selectedRouteId
  ) || null;
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
    .map((item) => item.domain + ":" + item.parameter)
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

function maxConcentration(counter, denominator) {
  if (!denominator) return 0;
  const max = Math.max(0, ...Object.values(counter));
  return Number((max / denominator).toFixed(4));
}

function topEntries(counter, limit = 10) {
  return Object.entries(counter)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function addFailure(failures, {
  evaluatorId,
  expected,
  observed
}) {
  const payload = {
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

function summarizeGroup(rows) {
  const routeCounts = {};
  const actionSignatureCounts = {};
  const parameterSignatureCounts = {};
  const wordingSignatureCounts = {};

  for (const row of rows) {
    increment(routeCounts, row.routeStrategy);
    increment(actionSignatureCounts, row.actionSignature);
    increment(parameterSignatureCounts, row.parameterSignature);
    increment(wordingSignatureCounts, row.wordingSignature);
  }

  return {
    caseCount: rows.length,
    actionableCaseCount: rows.filter((row) => row.routeStrategy !== "NO_ROUTE").length,
    uniqueRouteStrategyCount: Object.keys(routeCounts).length,
    uniqueActionSignatureCount: Object.keys(actionSignatureCounts).length,
    uniqueParameterSignatureCount: Object.keys(parameterSignatureCounts).length,
    uniqueWordingSignatureCount: Object.keys(wordingSignatureCounts).length,
    routeConcentration: maxConcentration(routeCounts, rows.length),
    actionSignatureConcentration: maxConcentration(actionSignatureCounts, rows.length),
    parameterSignatureConcentration: maxConcentration(parameterSignatureCounts, rows.length),
    wordingSignatureConcentration: maxConcentration(wordingSignatureCounts, rows.length),
    topActionSignatures: topEntries(actionSignatureCounts, 5),
    topParameterSignatures: topEntries(parameterSignatureCounts, 5)
  };
}

export function runFaceLabV2SpecificityDistributionEvaluation() {
  const cohort = buildFaceLabV2TargetSweepCohort();
  const failures = [];
  const rows = [];

  const routeStrategyCounts = {};
  const domainCounts = {};
  const parameterCounts = {};
  const actionSignatureCounts = {};
  const parameterSignatureCounts = {};
  const wordingSignatureCounts = {};
  const actionCopyCounts = {};
  const signatureTargets = new Map();
  const signatureFaces = new Map();

  for (const caseDef of cohort.cases) {
    const canonical = buildFaceLabV2Canonical({
      analysis: caseDef.analysis,
      surveyAnswers: caseDef.surveyAnswers,
      resultId: caseDef.caseId
    });
    const route = selectedRoute(canonical);
    const actions = route?.actions || [];
    const row = {
      caseId: caseDef.caseId,
      faceGroupId: caseDef.faceGroupId,
      targetKey: caseDef.targetKey,
      routeStrategy: route?.strategy || "NO_ROUTE",
      actionSignature: actionSignature(route),
      parameterSignature: parameterSignature(route),
      wordingSignature: wordingSignature(route),
      actionCount: actions.length
    };
    rows.push(row);

    increment(routeStrategyCounts, row.routeStrategy);
    increment(actionSignatureCounts, row.actionSignature);
    increment(parameterSignatureCounts, row.parameterSignature);
    increment(wordingSignatureCounts, row.wordingSignature);

    if (!signatureTargets.has(row.actionSignature)) {
      signatureTargets.set(row.actionSignature, new Set());
      signatureFaces.set(row.actionSignature, new Set());
    }
    signatureTargets.get(row.actionSignature).add(caseDef.targetKey);
    signatureFaces.get(row.actionSignature).add(caseDef.faceGroupId);

    for (const action of actions) {
      increment(domainCounts, action.domain);
      increment(parameterCounts, action.domain + ":" + action.parameter);
      increment(actionCopyCounts, action.explanation || "");
    }
  }

  const byTarget = new Map();
  const byFace = new Map();

  for (const row of rows) {
    if (!byTarget.has(row.targetKey)) byTarget.set(row.targetKey, []);
    if (!byFace.has(row.faceGroupId)) byFace.set(row.faceGroupId, []);
    byTarget.get(row.targetKey).push(row);
    byFace.get(row.faceGroupId).push(row);
  }

  const targetDiagnostics = [...byTarget.entries()]
    .map(([targetKey, groupRows]) => ({
      targetKey,
      ...summarizeGroup(groupRows)
    }))
    .sort((left, right) => left.targetKey.localeCompare(right.targetKey));

  const faceDiagnostics = [...byFace.entries()]
    .map(([faceGroupId, groupRows]) => ({
      faceGroupId,
      ...summarizeGroup(groupRows)
    }))
    .sort((left, right) => left.faceGroupId.localeCompare(right.faceGroupId));

  const signatureReach = [...signatureTargets.entries()]
    .map(([signature, targets]) => ({
      signature,
      count: actionSignatureCounts[signature] || 0,
      distinctTargetCount: targets.size,
      distinctFaceCount: signatureFaces.get(signature)?.size || 0
    }))
    .sort((left, right) =>
      right.count - left.count ||
      right.distinctTargetCount - left.distinctTargetCount ||
      left.signature.localeCompare(right.signature)
    );

  if (rows.length !== cohort.caseCount) {
    addFailure(failures, {
      evaluatorId: "E8-case-accounting",
      expected: cohort.caseCount,
      observed: rows.length
    });
  }

  const targetCaseTotal = targetDiagnostics.reduce(
    (sum, item) => sum + item.caseCount,
    0
  );
  if (targetCaseTotal !== cohort.caseCount) {
    addFailure(failures, {
      evaluatorId: "E8-target-accounting",
      expected: cohort.caseCount,
      observed: targetCaseTotal
    });
  }

  const faceCaseTotal = faceDiagnostics.reduce(
    (sum, item) => sum + item.caseCount,
    0
  );
  if (faceCaseTotal !== cohort.caseCount) {
    addFailure(failures, {
      evaluatorId: "E8-face-accounting",
      expected: cohort.caseCount,
      observed: faceCaseTotal
    });
  }

  const totalActionCount = Object.values(domainCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    reportVersion: "face-lab-v2-specificity-distribution-report-v1",
    evaluatorVersion: FACE_LAB_V2_SPECIFICITY_DISTRIBUTION_VERSION,
    contractVersion: FACE_LAB_V2_EVALUATION_CONTRACT_VERSION,
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
      actionableCaseCount: rows.filter((row) => row.routeStrategy !== "NO_ROUTE").length,
      noRouteCaseCount: rows.filter((row) => row.routeStrategy === "NO_ROUTE").length,
      totalActionCount,
      uniqueRouteStrategyCount: Object.keys(routeStrategyCounts).length,
      uniqueActionSignatureCount: Object.keys(actionSignatureCounts).length,
      uniqueParameterSignatureCount: Object.keys(parameterSignatureCounts).length,
      uniqueWordingSignatureCount: Object.keys(wordingSignatureCounts).length,
      routeConcentration: maxConcentration(routeStrategyCounts, rows.length),
      actionSignatureConcentration: maxConcentration(actionSignatureCounts, rows.length),
      parameterSignatureConcentration: maxConcentration(parameterSignatureCounts, rows.length),
      wordingSignatureConcentration: maxConcentration(wordingSignatureCounts, rows.length),
      domainConcentration: maxConcentration(domainCounts, totalActionCount),
      parameterConcentration: maxConcentration(parameterCounts, totalActionCount),
      targetFullyCollapsedCount: targetDiagnostics.filter(
        (item) => item.uniqueActionSignatureCount <= 1
      ).length,
      faceFullyCollapsedCount: faceDiagnostics.filter(
        (item) => item.uniqueActionSignatureCount <= 1
      ).length,
      maxTargetActionSignatureConcentration: Math.max(
        0,
        ...targetDiagnostics.map((item) => item.actionSignatureConcentration)
      ),
      averageTargetUniqueActionSignatureCount: Number(
        (
          targetDiagnostics.reduce(
            (sum, item) => sum + item.uniqueActionSignatureCount,
            0
          ) / Math.max(1, targetDiagnostics.length)
        ).toFixed(3)
      ),
      averageFaceUniqueActionSignatureCount: Number(
        (
          faceDiagnostics.reduce(
            (sum, item) => sum + item.uniqueActionSignatureCount,
            0
          ) / Math.max(1, faceDiagnostics.length)
        ).toFixed(3)
      ),
      maxDistinctTargetReachPerActionSignature: Math.max(
        0,
        ...signatureReach.map((item) => item.distinctTargetCount)
      ),
      maxDistinctFaceReachPerActionSignature: Math.max(
        0,
        ...signatureReach.map((item) => item.distinctFaceCount)
      ),
      hardFailureCount: failures.length
    },
    distributions: {
      routeStrategyCounts,
      domainCounts,
      parameterCounts,
      actionSignatureCounts,
      parameterSignatureCounts,
      wordingSignatureCounts,
      topActionCopies: topEntries(actionCopyCounts, 20),
      topActionSignatures: topEntries(actionSignatureCounts, 20),
      topParameterSignatures: topEntries(parameterSignatureCounts, 20)
    },
    targetDiagnostics,
    faceDiagnostics,
    signatureReach: signatureReach.slice(0, 30),
    rows,
    failures
  };
}
