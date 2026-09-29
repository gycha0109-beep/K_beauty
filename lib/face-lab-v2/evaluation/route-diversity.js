import { createHash } from "node:crypto";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import { buildFaceLabV2TargetSweepCohort } from "./target-responsiveness.js";
import { FACE_LAB_V2_EVALUATION_CONTRACT_VERSION } from "./contracts.js";

export const FACE_LAB_V2_ROUTE_DIVERSITY_AUDIT_VERSION =
  "face-lab-v2-route-diversity-audit-v1";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function fingerprint(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex")
    .slice(0, 16);
}

function increment(counter, key) {
  counter[key] = (counter[key] || 0) + 1;
}

function actionIdentity(action) {
  return [action?.domain, action?.parameter, action?.direction].join(":");
}

function actionSemantic(action) {
  return [actionIdentity(action), action?.strength || ""].join(":");
}

function signature(actions, mapper) {
  return (Array.isArray(actions) ? actions : [])
    .map(mapper)
    .sort()
    .join("|");
}

function routeActionIdentitySignature(route) {
  return signature(route?.actions, actionIdentity);
}

function routeActionSemanticSignature(route) {
  return signature(route?.actions, actionSemantic);
}

function routeDomainSignature(route) {
  return [...new Set((route?.actions || []).map((item) => item.domain))]
    .sort()
    .join("|");
}

function routeProfileSignature(route) {
  return [
    route?.changeMagnitude || "",
    route?.dailyEffort || "",
    route?.maintenance || "",
    route?.costBand || "",
    route?.reversibility || ""
  ].join("|");
}

function dominantDomain(route) {
  const counts = {};
  for (const action of route?.actions || []) increment(counts, action.domain || "unknown");
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] || null;
}

function jaccard(leftActions, rightActions) {
  const left = new Set((leftActions || []).map(actionIdentity));
  const right = new Set((rightActions || []).map(actionIdentity));
  const union = new Set([...left, ...right]);
  if (!union.size) return 1;
  let intersection = 0;
  for (const key of left) if (right.has(key)) intersection += 1;
  return Number((intersection / union.size).toFixed(4));
}

function addFailure(failures, payload) {
  const failure = { severity: "hard", ...payload };
  failures.push({ ...failure, fingerprint: fingerprint(failure) });
}

function pairwise(routes) {
  const pairs = [];
  for (let leftIndex = 0; leftIndex < routes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < routes.length; rightIndex += 1) {
      const left = routes[leftIndex];
      const right = routes[rightIndex];
      const leftIdentity = routeActionIdentitySignature(left);
      const rightIdentity = routeActionIdentitySignature(right);
      const leftSemantic = routeActionSemanticSignature(left);
      const rightSemantic = routeActionSemanticSignature(right);
      const actionIdentitySame = leftIdentity === rightIdentity;
      const actionSemanticSame = leftSemantic === rightSemantic;
      const strengthOnlyDifference = actionIdentitySame && !actionSemanticSame;
      const overlap = jaccard(left.actions, right.actions);
      const leftDominant = dominantDomain(left);
      const rightDominant = dominantDomain(right);
      const dominantDomainDifferent = leftDominant !== rightDominant;
      const cosmeticDuplicate = actionSemanticSame;
      const meaningfulDistinct = !cosmeticDuplicate;
      const strongChoiceDistinct =
        meaningfulDistinct &&
        (dominantDomainDifferent || overlap <= 0.5);

      pairs.push({
        leftRouteId: left.routeId,
        rightRouteId: right.routeId,
        leftStrategy: left.strategy,
        rightStrategy: right.strategy,
        leftDominantDomain: leftDominant,
        rightDominantDomain: rightDominant,
        dominantDomainDifferent,
        actionIdentitySame,
        actionSemanticSame,
        strengthOnlyDifference,
        cosmeticDuplicate,
        meaningfulDistinct,
        strongChoiceDistinct,
        actionIdentityJaccard: overlap,
        leftActionCount: left.actions?.length || 0,
        rightActionCount: right.actions?.length || 0,
        leftDomainSignature: routeDomainSignature(left),
        rightDomainSignature: routeDomainSignature(right),
        leftProfileSignature: routeProfileSignature(left),
        rightProfileSignature: routeProfileSignature(right)
      });
    }
  }
  return pairs;
}

function maxConcentration(counter, denominator) {
  if (!denominator) return 0;
  return Number((Math.max(0, ...Object.values(counter)) / denominator).toFixed(4));
}

export function runFaceLabV2RouteDiversityAudit() {
  const cohort = buildFaceLabV2TargetSweepCohort();
  const failures = [];
  const cases = [];
  const routeCountDistribution = {};
  const selectedStrategyCounts = {};
  const emittedStrategyCounts = {};
  const collapseClassificationCounts = {};
  let emittedRouteCount = 0;
  let totalPairCount = 0;
  let cosmeticDuplicatePairCount = 0;
  let meaningfulDistinctPairCount = 0;
  let strongChoiceDistinctPairCount = 0;
  let strengthOnlyDifferencePairCount = 0;
  let jaccardTotal = 0;

  for (const caseDef of cohort.cases) {
    const canonical = buildFaceLabV2Canonical({
      analysis: caseDef.analysis,
      surveyAnswers: caseDef.surveyAnswers,
      resultId: caseDef.caseId
    });
    const routes = canonical?.routes?.routes || [];
    const selectedRouteId = canonical?.routes?.selectedRouteId || null;
    const selected = routes.find((route) => route.routeId === selectedRouteId) || null;
    const pairs = pairwise(routes);
    const uniqueSemanticSignatureCount = new Set(
      routes.map(routeActionSemanticSignature)
    ).size;

    if (routes.length > 3) {
      addFailure(failures, {
        caseId: caseDef.caseId,
        evaluatorId: "RD1-route-bound",
        expected: "at most 3 emitted routes",
        observed: routes.length
      });
    }
    if (selectedRouteId && !selected) {
      addFailure(failures, {
        caseId: caseDef.caseId,
        evaluatorId: "RD1-selected-route-membership",
        expected: "selectedRouteId references emitted route",
        observed: selectedRouteId
      });
    }
    if (new Set(routes.map((route) => route.routeId)).size !== routes.length) {
      addFailure(failures, {
        caseId: caseDef.caseId,
        evaluatorId: "RD1-route-id-uniqueness",
        expected: "unique route IDs",
        observed: routes.map((route) => route.routeId)
      });
    }

    const collapseClassification = routes.length === 0
      ? "NO_ROUTE"
      : routes.length === 1
        ? "SINGLE_ROUTE"
        : uniqueSemanticSignatureCount <= 1
          ? "MULTI_ROUTE_COSMETIC_ONLY"
          : "MULTI_ROUTE_MEANINGFUL";

    increment(routeCountDistribution, String(routes.length));
    increment(collapseClassificationCounts, collapseClassification);
    if (selected) increment(selectedStrategyCounts, selected.strategy || selected.routeId);
    for (const route of routes) {
      emittedRouteCount += 1;
      increment(emittedStrategyCounts, route.strategy || route.routeId);
    }

    for (const pair of pairs) {
      totalPairCount += 1;
      jaccardTotal += pair.actionIdentityJaccard;
      if (pair.cosmeticDuplicate) cosmeticDuplicatePairCount += 1;
      if (pair.meaningfulDistinct) meaningfulDistinctPairCount += 1;
      if (pair.strongChoiceDistinct) strongChoiceDistinctPairCount += 1;
      if (pair.strengthOnlyDifference) strengthOnlyDifferencePairCount += 1;
    }

    cases.push({
      caseId: caseDef.caseId,
      faceGroupId: caseDef.faceGroupId,
      targetKey: caseDef.targetKey,
      routeCount: routes.length,
      selectedRouteId,
      selectedStrategy: selected?.strategy || null,
      routeStrategies: routes.map((route) => route.strategy || route.routeId),
      uniqueSemanticSignatureCount,
      collapseClassification,
      routes: routes.map((route) => ({
        routeId: route.routeId,
        strategy: route.strategy,
        dominantDomain: dominantDomain(route),
        actionCount: route.actions?.length || 0,
        actionIdentitySignature: routeActionIdentitySignature(route),
        actionSemanticSignature: routeActionSemanticSignature(route),
        domainSignature: routeDomainSignature(route),
        profileSignature: routeProfileSignature(route)
      })),
      pairs
    });
  }

  const casesWithAtLeastTwoRoutes = cases.filter((item) => item.routeCount >= 2).length;
  const casesWithAtLeastTwoMeaningfulRoutes = cases.filter(
    (item) => item.uniqueSemanticSignatureCount >= 2
  ).length;
  const casesWithStrongChoiceDiversity = cases.filter(
    (item) => item.pairs.some((pair) => pair.strongChoiceDistinct)
  ).length;

  return {
    reportVersion: "face-lab-v2-route-diversity-audit-report-v1",
    evaluatorVersion: FACE_LAB_V2_ROUTE_DIVERSITY_AUDIT_VERSION,
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
      caseCount: cases.length,
      emittedRouteCount,
      routeCountDistribution,
      selectedStrategyCounts,
      emittedStrategyCounts,
      selectedStrategyConcentration: maxConcentration(
        selectedStrategyCounts,
        cases.filter((item) => item.selectedStrategy).length
      ),
      collapseClassificationCounts,
      casesWithAtLeastTwoRoutes,
      casesWithAtLeastTwoMeaningfulRoutes,
      casesWithStrongChoiceDiversity,
      totalPairCount,
      cosmeticDuplicatePairCount,
      meaningfulDistinctPairCount,
      strongChoiceDistinctPairCount,
      strengthOnlyDifferencePairCount,
      averageActionIdentityJaccard: totalPairCount
        ? Number((jaccardTotal / totalPairCount).toFixed(4))
        : 0,
      hardFailureCount: failures.length
    },
    cases,
    failures
  };
}
