import {
  PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
  validateProductQueryIntent
} from "./product-query-intent-contract.mjs";
import { buildProductQueryExecutionPlan } from "./product-query-execution-contract.mjs";

export const PRODUCT_QUERY_BETA_QUALITY_CONTRACT_VERSION =
  "product-query-beta-quality-evaluation-v1";

export const PRODUCT_QUERY_BETA_QUALITY_FAILURES = Object.freeze([
  "Q01_INTENT_SCHEMA_INVALID",
  "Q02_INTENT_MISPARSE",
  "Q03_CRITICAL_INTENT_DROPPED",
  "Q04_EXECUTION_PLAN_DRIFT",
  "Q05_PARAPHRASE_DRIFT",
  "Q06_UNSUPPORTED_FALSE_POSITIVE",
  "Q07_CONTRADICTION_IGNORED",
  "Q08_AMBIGUITY_OVERINFERRED",
  "Q09_RUNTIME_FAILURE",
  "Q10_AUTH_BOUNDARY_REGRESSION"
]);

export const PRODUCT_QUERY_BETA_QUALITY_GATES = Object.freeze({
  corpusCaseCount: 30,
  minimumIntentAccuracy: 0.95,
  minimumParaphraseStability: 0.9,
  minimumRuntimeSuccessRate: 0.95,
  maximumCriticalIntentViolations: 0,
  maximumSecurityBoundaryRegressions: 0,
  maximumPersistenceRegressions: 0
});

const INTENT_KEYS = Object.freeze([
  "category",
  "skin_type",
  "concerns",
  "sensitivity",
  "texture",
  "disliked_feel",
  "sunscreen_intent",
  "white_cast_hate",
  "tone_up_wanted",
  "eye_sensitive",
  "makeup_use",
  "outdoor_exposure",
  "unresolved_terms",
  "confidence"
]);

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizedIntentProjection(intent, fields) {
  return Object.fromEntries(fields.map((field) => [field, intent[field]]));
}

function unique(values) {
  return [...new Set(values)];
}

export function evaluateProductQueryQualityCase(testCase, actualIntent) {
  const failures = [];
  const validation = validateProductQueryIntent(actualIntent);

  if (!validation.ok) {
    return Object.freeze({
      caseId: testCase?.id || null,
      passed: false,
      intentMatched: false,
      criticalIntentViolationCount: 1,
      runtimeSucceeded: true,
      failures: Object.freeze(["Q01_INTENT_SCHEMA_INVALID"]),
      actualIntent: null,
      executionPlan: null
    });
  }

  const actual = validation.value;
  const expected = testCase.expectedIntent;
  const compareFields = Array.isArray(testCase.compareFields)
    ? testCase.compareFields
    : INTENT_KEYS;

  const mismatchedFields = compareFields.filter(
    (field) => !sameValue(actual[field], expected[field])
  );

  if (mismatchedFields.length > 0) failures.push("Q02_INTENT_MISPARSE");

  const criticalFields = Array.isArray(testCase.criticalIntentFields)
    ? testCase.criticalIntentFields
    : [];

  const criticalMismatchFields = criticalFields.filter(
    (field) => !sameValue(actual[field], expected[field])
  );

  if (criticalMismatchFields.length > 0) {
    failures.push("Q03_CRITICAL_INTENT_DROPPED");
  }

  const expectedBehavior = testCase.expectedBehavior || "supported";
  if (
    expectedBehavior === "unsupported" &&
    (actual.category !== null ||
      actual.sunscreen_intent === true ||
      actual.concerns.length > 0 ||
      actual.unresolved_terms.length === 0)
  ) {
    failures.push("Q06_UNSUPPORTED_FALSE_POSITIVE");
  }

  if (
    testCase.requiresUnresolvedTerms === true &&
    actual.unresolved_terms.length === 0
  ) {
    failures.push("Q02_INTENT_MISPARSE");
  }

  const conflictFields = Array.isArray(testCase.conflictFields)
    ? testCase.conflictFields
    : [];
  const conflictFieldLeaked = conflictFields.some(
    (field) => !sameValue(actual[field], expected[field])
  );

  if (
    expectedBehavior === "conflict" &&
    (actual.unresolved_terms.length === 0 ||
      actual.confidence !== "low" ||
      conflictFieldLeaked)
  ) {
    failures.push("Q07_CONTRADICTION_IGNORED");
  }

  if (
    expectedBehavior === "ambiguous" &&
    (actual.category !== null ||
      actual.skin_type !== null ||
      actual.concerns.length > 0 ||
      actual.sensitivity !== null ||
      actual.texture !== null ||
      actual.disliked_feel !== null ||
      actual.sunscreen_intent !== null ||
      actual.white_cast_hate !== null ||
      actual.tone_up_wanted !== null ||
      actual.eye_sensitive !== null ||
      actual.makeup_use !== null ||
      actual.outdoor_exposure !== null ||
      actual.unresolved_terms.length > 0)
  ) {
    failures.push("Q08_AMBIGUITY_OVERINFERRED");
  }

  let executionPlan = null;
  try {
    executionPlan = buildProductQueryExecutionPlan(actual);
    const expectedExecution = testCase.expectedExecution || {};
    const planChecks = [
      ["effectiveCategory", executionPlan.effectiveCategory],
      ["constraintStatus", executionPlan.constraintStatus],
      ["rankingEligible", executionPlan.rankingEligible],
      ["rankableSignals", executionPlan.rankableSignals]
    ];

    if (
      planChecks.some(([key, actualValue]) =>
        Object.hasOwn(expectedExecution, key) &&
        !sameValue(actualValue, expectedExecution[key])
      )
    ) {
      failures.push("Q04_EXECUTION_PLAN_DRIFT");
    }
  } catch {
    failures.push("Q04_EXECUTION_PLAN_DRIFT");
  }

  const semanticFailureCodes = new Set([
    "Q02_INTENT_MISPARSE",
    "Q03_CRITICAL_INTENT_DROPPED",
    "Q06_UNSUPPORTED_FALSE_POSITIVE",
    "Q07_CONTRADICTION_IGNORED",
    "Q08_AMBIGUITY_OVERINFERRED"
  ]);
  const intentMatched =
    mismatchedFields.length === 0 &&
    !failures.some((failure) => semanticFailureCodes.has(failure));

  return Object.freeze({
    caseId: testCase.id,
    passed: failures.length === 0,
    intentMatched,
    criticalIntentViolationCount: criticalMismatchFields.length,
    runtimeSucceeded: true,
    mismatchedFields: Object.freeze(mismatchedFields),
    criticalMismatchFields: Object.freeze(criticalMismatchFields),
    failures: Object.freeze(unique(failures)),
    actualIntent: actual,
    executionPlan
  });
}

export function evaluateProductQueryQualityObservation(testCase, observation) {
  if (!observation || observation.runtimeSucceeded !== true) {
    return Object.freeze({
      caseId: testCase?.id || null,
      passed: false,
      intentMatched: false,
      criticalIntentViolationCount: 0,
      runtimeSucceeded: false,
      mismatchedFields: Object.freeze([]),
      criticalMismatchFields: Object.freeze([]),
      failures: Object.freeze(["Q09_RUNTIME_FAILURE"]),
      actualIntent: null,
      executionPlan: null
    });
  }

  return evaluateProductQueryQualityCase(testCase, observation.intent);
}

export function evaluateParaphraseClusters(testCases, evaluations) {
  const byId = new Map(evaluations.map((evaluation) => [evaluation.caseId, evaluation]));
  const clusters = new Map();

  for (const testCase of testCases) {
    if (!testCase.paraphraseCluster) continue;
    const bucket = clusters.get(testCase.paraphraseCluster) || [];
    bucket.push(testCase);
    clusters.set(testCase.paraphraseCluster, bucket);
  }

  return Object.freeze(
    [...clusters.entries()].map(([clusterId, members]) => {
      const fields = unique(
        members.flatMap((member) =>
          Array.isArray(member.clusterFields) ? member.clusterFields : []
        )
      );
      const projections = members
        .map((member) => byId.get(member.id)?.actualIntent)
        .filter(Boolean)
        .map((intent) => normalizedIntentProjection(intent, fields));
      const stable =
        projections.length === members.length &&
        projections.every((projection) => sameValue(projection, projections[0]));

      return Object.freeze({
        clusterId,
        memberCount: members.length,
        fields: Object.freeze(fields),
        stable
      });
    })
  );
}

export function aggregateProductQueryQuality(testCases, evaluations) {
  const clusters = evaluateParaphraseClusters(testCases, evaluations);
  const total = testCases.length;
  const intentMatches = evaluations.filter((item) => item.intentMatched).length;
  const runtimeSuccesses = evaluations.filter((item) => item.runtimeSucceeded).length;
  const criticalIntentViolations = evaluations.reduce(
    (sum, item) => sum + item.criticalIntentViolationCount,
    0
  );
  const stableClusters = clusters.filter((cluster) => cluster.stable).length;

  const metrics = Object.freeze({
    caseCount: total,
    intentAccuracy: total === 0 ? 0 : intentMatches / total,
    runtimeSuccessRate: total === 0 ? 0 : runtimeSuccesses / total,
    paraphraseClusterCount: clusters.length,
    paraphraseStability:
      clusters.length === 0 ? 1 : stableClusters / clusters.length,
    criticalIntentViolations,
    securityBoundaryRegressions: 0,
    persistenceRegressions: 0
  });

  const gates = PRODUCT_QUERY_BETA_QUALITY_GATES;
  const accepted =
    metrics.caseCount === gates.corpusCaseCount &&
    metrics.intentAccuracy >= gates.minimumIntentAccuracy &&
    metrics.runtimeSuccessRate >= gates.minimumRuntimeSuccessRate &&
    metrics.paraphraseStability >= gates.minimumParaphraseStability &&
    metrics.criticalIntentViolations <= gates.maximumCriticalIntentViolations &&
    metrics.securityBoundaryRegressions <= gates.maximumSecurityBoundaryRegressions &&
    metrics.persistenceRegressions <= gates.maximumPersistenceRegressions;

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_BETA_QUALITY_CONTRACT_VERSION,
    intentContractVersion: PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
    accepted,
    metrics,
    clusters
  });
}
