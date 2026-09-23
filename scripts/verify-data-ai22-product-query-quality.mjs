#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_BETA_QUALITY_FAILURES,
  PRODUCT_QUERY_BETA_QUALITY_GATES,
  aggregateProductQueryQuality,
  evaluateParaphraseClusters,
  evaluateProductQueryQualityObservation
} from "../lib/product-query-beta-quality-evaluation-contract.mjs";
import {\n  PRODUCT_QUERY_INTENT_JSON_SCHEMA,\n  validateProductQueryIntent\n} from "../lib/product-query-intent-contract.mjs";
import { PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE } from "../lib/product-query-authenticated-beta-evidence-closure.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

const corpus = JSON.parse(
  readFileSync("fixtures/data-ai22/product-query-quality-cases.json", "utf8")
);
const cases = corpus.cases;

check(corpus.phase === "DATA-AI22", "corpus phase must be DATA-AI22");
check(
  corpus.provenance === "synthetic_fixed_fixtures" &&
    corpus.containsUserData === false &&
    corpus.containsAccountData === false,
  "corpus must contain synthetic fixtures only"
);
check(
  Array.isArray(cases) && cases.length === PRODUCT_QUERY_BETA_QUALITY_GATES.corpusCaseCount,
  "DATA-AI22 corpus must contain exactly 30 cases"
);
check(
  new Set(cases.map((testCase) => testCase.id)).size === cases.length,
  "case IDs must be unique"
);
check(
  new Set(cases.map((testCase) => testCase.query)).size === cases.length,
  "synthetic fixture queries must be unique"
);
check(
  cases.every(
    (testCase) =>
      typeof testCase.query === "string" &&
      testCase.query.trim().length > 0 &&
      testCase.query.length <= 500
  ),
  "all fixed fixture queries must be non-empty and within runtime limits"
);

const kindCounts = Object.fromEntries(
  ["paraphrase", "compound", "ambiguous", "conflict", "unsupported"].map(
    (kind) => [kind, cases.filter((testCase) => testCase.kind === kind).length]
  )
);
check(
  JSON.stringify(kindCounts) ===
    JSON.stringify({
      paraphrase: 15,
      compound: 8,
      ambiguous: 2,
      conflict: 2,
      unsupported: 3
    }),
  "corpus must preserve the planned coverage mix"
);

for (const testCase of cases) {
  check(
    validateProductQueryIntent(testCase.expectedIntent).ok,
    `${testCase.id} expected intent must satisfy the production intent schema`
  );
  check(
    Array.isArray(testCase.compareFields) &&
      Array.isArray(testCase.criticalIntentFields) &&
      testCase.criticalIntentFields.every((field) =>
        testCase.compareFields.includes(field)
      ),
    `${testCase.id} comparison fields must contain every critical intent field`
  );
  if (testCase.expectedBehavior === "conflict") {
    check(
      Array.isArray(testCase.conflictFields) &&
        testCase.conflictFields.length > 0 &&
        testCase.conflictFields.every(
          (field) =>
            testCase.compareFields.includes(field) &&
            testCase.expectedIntent[field] === null
        ),
      `${testCase.id} conflict fields must be explicit, compared, and neutralized`
    );
  }
}

const baseline = cases.map((testCase) =>
  evaluateProductQueryQualityObservation(testCase, {
    caseId: testCase.id,
    runtimeSucceeded: true,
    intent: testCase.expectedIntent
  })
);
check(
  baseline.every((evaluation) => evaluation.passed),
  "canonical expected intents must pass their own deterministic quality contract"
);

const aggregate = aggregateProductQueryQuality(cases, baseline);
check(aggregate.accepted === true, "canonical corpus baseline must satisfy DATA-AI22 gates");
check(
  aggregate.metrics.caseCount === 30 &&
    aggregate.metrics.intentAccuracy === 1 &&
    aggregate.metrics.runtimeSuccessRate === 1 &&
    aggregate.metrics.paraphraseStability === 1 &&
    aggregate.metrics.criticalIntentViolations === 0,
  "baseline aggregate metrics must be exact and lossless"
);

const clusters = evaluateParaphraseClusters(cases, baseline);
check(
  clusters.length === 5 &&
    clusters.every((cluster) => cluster.memberCount === 3 && cluster.stable),
  "five three-member paraphrase clusters must be stable at baseline"
);

const byId = new Map(cases.map((testCase) => [testCase.id, testCase]));

const creamCategoryOwnership = byId.get("DA22-COM-07");
check(
  creamCategoryOwnership.expectedIntent.texture === null &&
    !creamCategoryOwnership.criticalIntentFields.includes("texture") &&
    !creamCategoryOwnership.expectedExecution.rankableSignals.includes("texture"),
  "cream used only as the moisturizer category noun must not duplicate into texture"
);

const gelCategoryOwnership = byId.get("DA22-COM-04");
check(
  gelCategoryOwnership.expectedIntent.category === "moisturizer_gel" &&
    gelCategoryOwnership.expectedIntent.texture === null &&
    !gelCategoryOwnership.criticalIntentFields.includes("texture") &&
    !gelCategoryOwnership.expectedExecution.rankableSignals.includes("texture"),
  "gel used as the moisturizer product-family claim must belong to category only"
);

const plainSensitiveType = byId.get("DA22-SENS-02");
const degreeSensitiveSkin = byId.get("DA22-COM-07");
check(
  plainSensitiveType.expectedIntent.skin_type === "sensitive" &&
    plainSensitiveType.expectedIntent.sensitivity === null &&
    degreeSensitiveSkin.expectedIntent.skin_type === null &&
    degreeSensitiveSkin.expectedIntent.sensitivity === "high",
  "sensitive type/tendency and degree-bearing sensitivity must remain separate ownership cases"
);

const explicitUnsupported = byId.get("DA22-UNS-03");
const pureAmbiguity = byId.get("DA22-AMB-02");
check(
  explicitUnsupported.expectedIntent.unresolved_terms.length > 0 &&
    explicitUnsupported.expectedIntent.confidence === "low" &&
    pureAmbiguity.expectedIntent.unresolved_terms.length === 0 &&
    pureAmbiguity.expectedIntent.confidence === "low",
  "explicit unsupported concepts must remain distinct from pure ambiguity"
);

const toneUpConflict = byId.get("DA22-CON-01");
check(
  toneUpConflict.expectedIntent.tone_up_wanted === null &&
    toneUpConflict.expectedIntent.unresolved_terms.length > 0 &&
    toneUpConflict.expectedIntent.confidence === "low" &&
    toneUpConflict.conflictFields.includes("tone_up_wanted"),
  "same-dimension conflict must remain neutralized and unresolved"
);

const intentSchemaProperties = PRODUCT_QUERY_INTENT_JSON_SCHEMA.properties;
check(
  intentSchemaProperties.skin_type.description.includes("degree-bearing") &&
    intentSchemaProperties.sensitivity.description.includes("general skin reactivity") &&
    intentSchemaProperties.texture.description.includes("product-family noun") &&
    intentSchemaProperties.unresolved_terms.description.includes("Pure ambiguity"),
  "structured-output schema must carry the semantic ownership boundaries"
);

const droppedWhiteCast = evaluateProductQueryQualityObservation(
  byId.get("DA22-WC-01"),
  {
    runtimeSucceeded: true,
    intent: {
      ...byId.get("DA22-WC-01").expectedIntent,
      white_cast_hate: null
    }
  }
);
check(
  droppedWhiteCast.failures.includes("Q02_INTENT_MISPARSE") &&
    droppedWhiteCast.failures.includes("Q03_CRITICAL_INTENT_DROPPED"),
  "critical preference loss must be classified as misparse plus critical drop"
);

const ambiguityOverinfer = evaluateProductQueryQualityObservation(
  byId.get("DA22-AMB-01"),
  {
    runtimeSucceeded: true,
    intent: {
      ...byId.get("DA22-AMB-01").expectedIntent,
      skin_type: "oily"
    }
  }
);
check(
  ambiguityOverinfer.failures.includes("Q08_AMBIGUITY_OVERINFERRED"),
  "ambiguous query over-inference must be detected"
);

const unsupportedMissingSignal = evaluateProductQueryQualityObservation(
  byId.get("DA22-UNS-01"),
  {
    runtimeSucceeded: true,
    intent: {
      ...byId.get("DA22-UNS-01").expectedIntent,
      unresolved_terms: []
    }
  }
);
check(
  unsupportedMissingSignal.intentMatched === false &&
    unsupportedMissingSignal.failures.includes("Q06_UNSUPPORTED_FALSE_POSITIVE"),
  "unsupported query with no unresolved signal must reduce intent accuracy"
);

const unsupportedFalsePositive = evaluateProductQueryQualityObservation(
  byId.get("DA22-UNS-03"),
  {
    runtimeSucceeded: true,
    intent: {
      ...byId.get("DA22-UNS-03").expectedIntent,
      category: "sunscreen",
      sunscreen_intent: true
    }
  }
);
check(
  unsupportedFalsePositive.failures.includes("Q06_UNSUPPORTED_FALSE_POSITIVE"),
  "out-of-domain query mapped into skincare must be detected"
);

const conflictIgnored = evaluateProductQueryQualityObservation(
  byId.get("DA22-CON-01"),
  {
    runtimeSucceeded: true,
    intent: {
      ...byId.get("DA22-CON-01").expectedIntent,
      unresolved_terms: [],
      confidence: "high",
      tone_up_wanted: false
    }
  }
);
check(
  conflictIgnored.failures.includes("Q07_CONTRADICTION_IGNORED"),
  "contradiction suppression must be detected"
);

const conflictFieldLeak = evaluateProductQueryQualityObservation(
  byId.get("DA22-CON-01"),
  {
    runtimeSucceeded: true,
    intent: {
      ...byId.get("DA22-CON-01").expectedIntent,
      tone_up_wanted: false
    }
  }
);
check(
  conflictFieldLeak.failures.includes("Q07_CONTRADICTION_IGNORED"),
  "conflicted structured field must remain neutral even when unresolved evidence is preserved"
);

const ambiguityUnresolvedLeak = evaluateProductQueryQualityObservation(
  byId.get("DA22-AMB-02"),
  {
    runtimeSucceeded: true,
    intent: {
      ...byId.get("DA22-AMB-02").expectedIntent,
      unresolved_terms: ["generic personalized recommendation"]
    }
  }
);
check(
  ambiguityUnresolvedLeak.failures.includes("Q08_AMBIGUITY_OVERINFERRED"),
  "pure ambiguity must not be converted into an unresolved concept"
);

const runtimeFailure = evaluateProductQueryQualityObservation(
  byId.get("DA22-WC-01"),
  { runtimeSucceeded: false }
);
check(
  runtimeFailure.runtimeSucceeded === false &&
    runtimeFailure.failures.includes("Q09_RUNTIME_FAILURE"),
  "provider/runtime failure must have a stable failure class"
);

const invalidSchema = evaluateProductQueryQualityObservation(
  byId.get("DA22-WC-01"),
  {
    runtimeSucceeded: true,
    intent: {
      ...byId.get("DA22-WC-01").expectedIntent,
      product_ids: ["forbidden"]
    }
  }
);
check(
  invalidSchema.failures.includes("Q01_INTENT_SCHEMA_INVALID"),
  "provider output that exceeds the schema must fail closed"
);

const driftCase = {
  ...byId.get("DA22-WC-01"),
  expectedExecution: {
    ...byId.get("DA22-WC-01").expectedExecution,
    rankableSignals: ["eye_sensitive"]
  }
};
const executionDrift = evaluateProductQueryQualityObservation(driftCase, {
  runtimeSucceeded: true,
  intent: driftCase.expectedIntent
});
check(
  executionDrift.failures.includes("Q04_EXECUTION_PLAN_DRIFT"),
  "downstream execution drift must be detected independently of intent equality"
);

const paraphraseDriftEvaluations = baseline.map((evaluation) => {
  if (evaluation.caseId !== "DA22-OILY-03") return evaluation;
  return evaluateProductQueryQualityObservation(byId.get("DA22-OILY-03"), {
    runtimeSucceeded: true,
    intent: {
      ...byId.get("DA22-OILY-03").expectedIntent,
      skin_type: "combination"
    }
  });
});
const driftClusters = evaluateParaphraseClusters(cases, paraphraseDriftEvaluations);
check(
  driftClusters.find((cluster) => cluster.clusterId === "OILY01")?.stable === false,
  "semantic drift inside a paraphrase cluster must be detected"
);

check(
  PRODUCT_QUERY_BETA_QUALITY_FAILURES.length === 10 &&
    PRODUCT_QUERY_BETA_QUALITY_FAILURES[0] === "Q01_INTENT_SCHEMA_INVALID" &&
    PRODUCT_QUERY_BETA_QUALITY_FAILURES.at(-1) === "Q10_AUTH_BOUNDARY_REGRESSION",
  "failure taxonomy must remain fixed and reviewable"
);

check(
  PRODUCT_QUERY_BETA_QUALITY_GATES.minimumIntentAccuracy === 0.95 &&
    PRODUCT_QUERY_BETA_QUALITY_GATES.minimumParaphraseStability === 0.9 &&
    PRODUCT_QUERY_BETA_QUALITY_GATES.minimumRuntimeSuccessRate === 0.95 &&
    PRODUCT_QUERY_BETA_QUALITY_GATES.maximumCriticalIntentViolations === 0,
  "quality gates must match DATA-AI22 acceptance policy"
);

check(
  PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE.runtimeBoundary
    ?.authenticatedOnly === true &&
    PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE.runtimeBoundary
      ?.maxApprovedAccounts === 3 &&
    PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE.runtimeBoundary
      ?.automaticTrafficSampling === false &&
    PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE.runtimeBoundary
      ?.publicSearchCutover === false &&
    PRODUCT_QUERY_AUTHENTICATED_BETA_EVIDENCE_CLOSURE.runtimeBoundary
      ?.persistence === "none",
  "DATA-AI22 must inherit the closed DATA-AI21 three-account runtime boundary"
);

const runner = readFileSync(
  "scripts/run-data-ai22-product-query-quality-evaluation.mjs",
  "utf8"
);
check(
  runner.includes("rawQueryRecorded: false") &&
    runner.includes("accountIdentifierRecorded: false") &&
    runner.includes("tokenRecorded: false") &&
    !runner.includes("testCase.query,"),
  "evaluation report must not persist raw fixture query or identity/token material"
);

const provider = readFileSync("lib/server/product-query-intent-service.js", "utf8");
check(
  provider.includes("store: false") &&
    provider.includes('provenance: "query_only"') &&
    !provider.includes("@/lib/product-source") &&
    !provider.includes("@/lib/recommendation-scoring"),
  "provider must remain intent-only and non-persistent"
);
check(
  provider.includes("Semantic ownership:") &&
    provider.includes("Do NOT duplicate one phrase into multiple fields") &&
    provider.includes('do NOT infer sensitivity="high" merely from skin_type=sensitive') &&
    provider.includes("MUST NOT also populate texture") &&
    provider.includes("Desired product properties are not user conditions") &&
    provider.includes("Sensitivity ownership precedence:") &&
    provider.includes('"피부가 민감한 편" maps to skin_type=sensitive') &&
    provider.includes('"많이 민감한 피부"') &&
    provider.includes('"젤 타입 보습제"') &&
    provider.includes("Explicit unsupported concepts are not ambiguity") &&
    provider.includes("do not choose a side"),
  "provider instructions must preserve semantic ownership and fail-closed conflict handling"
);

console.log(
  `DATA-AI22 product-query quality corpus verifier: PASS (${assertions} assertions)`
);
