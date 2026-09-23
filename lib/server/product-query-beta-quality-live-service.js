import "server-only";

import corpus from "@/fixtures/data-ai22/product-query-quality-cases.json";
import {
  evaluateProductQueryQualityObservation
} from "@/lib/product-query-beta-quality-evaluation-contract.mjs";
import {
  runNaturalLanguageProductQueryShadow
} from "@/lib/server/product-query-shadow-service";

export const DATA_AI22_LIVE_ACCEPTANCE_CONTRACT_VERSION =
  "data-ai22-live-provider-acceptance-v1";

export const DATA_AI22_LIVE_BATCH_SIZE = 5;
export const DATA_AI22_LIVE_BATCH_COUNT = 6;

function getBatchCases(batch) {
  if (!Number.isInteger(batch) || batch < 1 || batch > DATA_AI22_LIVE_BATCH_COUNT) {
    const error = new Error("DATA_AI22_LIVE_BATCH_INVALID");
    error.code = "DATA_AI22_LIVE_BATCH_INVALID";
    throw error;
  }

  const start = (batch - 1) * DATA_AI22_LIVE_BATCH_SIZE;
  const cases = corpus.cases.slice(start, start + DATA_AI22_LIVE_BATCH_SIZE);

  if (cases.length !== DATA_AI22_LIVE_BATCH_SIZE) {
    const error = new Error("DATA_AI22_LIVE_CORPUS_INCOMPLETE");
    error.code = "DATA_AI22_LIVE_CORPUS_INCOMPLETE";
    throw error;
  }

  return cases;
}

function projectExecution(execution) {
  return Object.freeze({
    status: execution?.status || "unknown",
    effectiveCategory: execution?.effectiveCategory || null,
    constraintStatus: execution?.constraintStatus || null,
    resultCount: Array.isArray(execution?.results) ? execution.results.length : 0,
    persisted: false
  });
}

async function runLiveCase(testCase) {
  try {
    const shadow = await runNaturalLanguageProductQueryShadow(testCase.query, {
      limit: 5
    });

    const evaluation = evaluateProductQueryQualityObservation(testCase, {
      caseId: testCase.id,
      runtimeSucceeded: true,
      intent: shadow.intent
    });

    return Object.freeze({
      caseId: testCase.id,
      passed: evaluation.passed,
      intentMatched: evaluation.intentMatched,
      criticalIntentViolationCount: evaluation.criticalIntentViolationCount,
      runtimeSucceeded: true,
      failures: Object.freeze([...evaluation.failures]),
      mismatchedFields: Object.freeze([...(evaluation.mismatchedFields || [])]),
      criticalMismatchFields: Object.freeze([
        ...(evaluation.criticalMismatchFields || [])
      ]),
      actualIntent: evaluation.actualIntent,
      execution: projectExecution(shadow.execution),
      provider: shadow.provider || null,
      model: shadow.model || null
    });
  } catch (error) {
    return Object.freeze({
      caseId: testCase.id,
      passed: false,
      intentMatched: false,
      criticalIntentViolationCount: 0,
      runtimeSucceeded: false,
      failures: Object.freeze(["Q09_RUNTIME_FAILURE"]),
      mismatchedFields: Object.freeze([]),
      criticalMismatchFields: Object.freeze([]),
      actualIntent: null,
      execution: null,
      provider: null,
      model: null,
      runtimeErrorClass:
        typeof error?.code === "string" ? error.code : "UNKNOWN"
    });
  }
}

export async function runDataAi22LiveAcceptanceBatch(batch) {
  const cases = getBatchCases(batch);
  const results = await Promise.all(cases.map((testCase) => runLiveCase(testCase)));

  return Object.freeze({
    contractVersion: DATA_AI22_LIVE_ACCEPTANCE_CONTRACT_VERSION,
    phase: "DATA-AI22",
    batch,
    batchCount: DATA_AI22_LIVE_BATCH_COUNT,
    batchSize: DATA_AI22_LIVE_BATCH_SIZE,
    caseCount: results.length,
    caseIds: Object.freeze(results.map((result) => result.caseId)),
    allRuntimeSucceeded: results.every((result) => result.runtimeSucceeded),
    allCasesPassed: results.every((result) => result.passed),
    criticalIntentViolationCount: results.reduce(
      (sum, result) => sum + result.criticalIntentViolationCount,
      0
    ),
    results: Object.freeze(results)
  });
}

export const DATA_AI22_LIVE_ACCEPTANCE_LIMITS = Object.freeze({
  fixedSyntheticCorpusOnly: true,
  batches: DATA_AI22_LIVE_BATCH_COUNT,
  casesPerBatch: DATA_AI22_LIVE_BATCH_SIZE,
  totalCases: DATA_AI22_LIVE_BATCH_COUNT * DATA_AI22_LIVE_BATCH_SIZE,
  authenticatedOnly: true,
  cookieTransportOnly: true,
  approvedCohortOnly: true,
  userQueryInput: false,
  profileRead: false,
  historyRead: false,
  persistence: "none",
  recommendationLogWrite: false,
  productionWrite: false,
  productResultsReturned: false,
  rawAccountIdReturned: false,
  accountHashReturned: false,
  accessTokenReturned: false
});
