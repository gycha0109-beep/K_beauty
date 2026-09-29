import assert from "node:assert/strict";
import {
  FACE_LAB_V2_ROUTE_DIVERSITY_AUDIT_VERSION,
  runFaceLabV2RouteDiversityAudit
} from "../lib/face-lab-v2/evaluation/route-diversity.js";

const report = runFaceLabV2RouteDiversityAudit();

assert.equal(
  report.evaluatorVersion,
  "face-lab-v2-route-diversity-audit-v1"
);
assert.equal(report.cohort.faceCount, 8);
assert.equal(report.cohort.targetCount, 12);
assert.equal(report.cohort.caseCount, 96);
assert.equal(report.summary.caseCount, 96);
assert.equal(
  report.summary.hardFailureCount,
  0,
  JSON.stringify(report.failures, null, 2)
);

const classifiedCases = Object.values(
  report.summary.collapseClassificationCounts
).reduce((sum, count) => sum + count, 0);
assert.equal(
  classifiedCases,
  report.summary.caseCount,
  "every target-sweep case must receive one route-diversity classification"
);

const routeCountCases = Object.values(
  report.summary.routeCountDistribution
).reduce((sum, count) => sum + count, 0);
assert.equal(
  routeCountCases,
  report.summary.caseCount,
  "route-count distribution must account for every target-sweep case"
);

assert.ok(
  report.summary.emittedRouteCount >= report.summary.casesWithAtLeastTwoRoutes,
  "emitted-route accounting must remain internally consistent"
);
assert.ok(
  report.summary.meaningfulDistinctPairCount <= report.summary.totalPairCount
);
assert.ok(
  report.summary.strongChoiceDistinctPairCount <= report.summary.meaningfulDistinctPairCount
);
assert.ok(
  report.summary.cosmeticDuplicatePairCount <= report.summary.totalPairCount
);

for (const item of report.cases) {
  assert.ok(item.routeCount >= 0 && item.routeCount <= 3);
  assert.equal(item.routes.length, item.routeCount);
  assert.ok(
    ["NO_ROUTE", "SINGLE_ROUTE", "MULTI_ROUTE_COSMETIC_ONLY", "MULTI_ROUTE_MEANINGFUL"].includes(
      item.collapseClassification
    )
  );
  if (item.routeCount >= 2) {
    assert.equal(
      item.pairs.length,
      (item.routeCount * (item.routeCount - 1)) / 2,
      "every emitted route pair must be audited"
    );
  }
}

console.log(JSON.stringify({
  ok: true,
  version: FACE_LAB_V2_ROUTE_DIVERSITY_AUDIT_VERSION,
  cohort: report.cohort,
  summary: report.summary,
  collapsedCases: report.cases
    .filter((item) => item.collapseClassification !== "MULTI_ROUTE_MEANINGFUL")
    .map((item) => ({
      caseId: item.caseId,
      targetKey: item.targetKey,
      routeCount: item.routeCount,
      classification: item.collapseClassification,
      routeStrategies: item.routeStrategies
    }))
}, null, 2));
