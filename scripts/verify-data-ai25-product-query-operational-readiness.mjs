#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DATA_AI25_EXPECTED_MODEL,
  DATA_AI25_EXPECTED_PROVIDER,
  DATA_AI25_MAX_FALLBACK_RATE,
  DATA_AI25_MIN_RUNTIME_SUCCESS_RATE,
  DATA_AI25_MIN_VALID_RUNTIME_OBSERVATIONS,
  PRODUCT_QUERY_BETA_OPERATIONAL_READINESS,
  PRODUCT_QUERY_BETA_OPERATIONAL_READINESS_CONTRACT_VERSION
} from "../lib/product-query-beta-operational-readiness-contract.mjs";
import {
  aggregateProductQueryOperationalBaseline
} from "../lib/product-query-beta-operational-baseline.mjs";
import {
  evaluateProductQueryOperationalReadiness
} from "../lib/product-query-beta-operational-readiness-evaluator.mjs";
import {
  DATA_AI20_MAX_APPROVED_ACCOUNTS
} from "../lib/product-query-authenticated-beta-controlled-activation.mjs";
import {
  PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE
} from "../lib/product-query-beta-quality-acceptance-evidence.mjs";
import {
  PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY
} from "../lib/product-query-operational-observability.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

const fixture = JSON.parse(
  readFileSync(
    "fixtures/data-ai25/product-query-operational-readiness-cases.json",
    "utf8"
  )
);

check(
  PRODUCT_QUERY_BETA_OPERATIONAL_READINESS_CONTRACT_VERSION ===
    "product-query-beta-operational-readiness-v1" &&
    PRODUCT_QUERY_BETA_OPERATIONAL_READINESS.phase === "DATA-AI25",
  "DATA-AI25 readiness contract must be frozen"
);

check(
  DATA_AI25_MIN_VALID_RUNTIME_OBSERVATIONS === 30 &&
    DATA_AI25_MIN_RUNTIME_SUCCESS_RATE === 0.95 &&
    DATA_AI25_MAX_FALLBACK_RATE === 0.05 &&
    DATA_AI25_EXPECTED_PROVIDER === "openai" &&
    DATA_AI25_EXPECTED_MODEL === "gpt-5.6-luna",
  "DATA-AI25 hard gates must match the approved operating boundary"
);

check(
  PRODUCT_QUERY_BETA_OPERATIONAL_READINESS.observabilityAuthority
      .syntheticFixturesMaySatisfyProductionEvidence === false &&
    PRODUCT_QUERY_BETA_OPERATIONAL_READINESS.observabilityAuthority
      .productionEvidenceRequiresRealObservations === true &&
    PRODUCT_QUERY_BETA_OPERATIONAL_READINESS.semanticAuthority
      .inferSemanticAccuracyFromProductionTraffic === false,
  "synthetic and operational evidence authorities must remain separated"
);

check(
  DATA_AI20_MAX_APPROVED_ACCOUNTS === 3 &&
    PRODUCT_QUERY_BETA_OPERATIONAL_READINESS.authorityBoundary
      .currentMaxApprovedAccountsMustRemain === 3 &&
    PRODUCT_QUERY_BETA_OPERATIONAL_READINESS.authorityBoundary
      .automaticCohortExpansion === false &&
    PRODUCT_QUERY_BETA_OPERATIONAL_READINESS.authorityBoundary
      .environmentMutation === false &&
    PRODUCT_QUERY_BETA_OPERATIONAL_READINESS.authorityBoundary
      .publicCutover === false,
  "DATA-AI25 must not expand the current three-account beta"
);

check(
  PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE.accepted === true &&
    PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE.phase === "DATA-AI22",
  "DATA-AI22 must remain semantic-quality authority"
);

check(
  PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.phase === "DATA-AI24" &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.persistence === "none" &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.rawQuery === false &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.userIdentity === false &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.recommendationResultIdentity === false,
  "DATA-AI24 must remain privacy-safe observability authority"
);

function event(overrides = {}) {
  return {
    timestamp: "2026-09-25T00:00:00.000Z",
    event: "provider_runtime",
    category: "runtime_state",
    operation: "product_query_beta",
    dependency: "application",
    environment: "production",
    provider: DATA_AI25_EXPECTED_PROVIDER,
    model: DATA_AI25_EXPECTED_MODEL,
    diagnosticVersion: "product-query-beta-observability-v1",
    outcome: "success",
    confidence: "high",
    constraintStatus: "resolved",
    latencyBucket: "1_3s",
    providerLatencyBucket: "1_3s",
    recommendationLatencyBucket: "lt_1s",
    resultCountBucket: "3_5",
    unresolvedCountBucket: "0",
    providerSucceeded: true,
    fallbackUsed: false,
    deploymentSha: "abcdef0123456789abcdef0123456789abcdef01",
    ...overrides
  };
}

function eventsForCase(testCase) {
  const events = [];
  for (const [outcome, count] of Object.entries(testCase.counts)) {
    for (let index = 0; index < count; index += 1) {
      events.push(
        event({
          outcome,
          providerSucceeded:
            outcome !== "provider_error" && outcome !== "runtime_error",
          confidence: outcome === "provider_error" ? "unknown" : "high",
          constraintStatus:
            outcome === "provider_error" || outcome === "runtime_error"
              ? "unknown"
              : "resolved"
        })
      );
    }
  }

  for (
    let index = 0;
    index < Math.min(testCase.fallbackCount || 0, events.length);
    index += 1
  ) {
    events[index] = { ...events[index], fallbackUsed: true };
  }

  return events;
}

const controls = Object.freeze({
  securityRegressionCount: 0,
  persistenceLeakageCount: 0,
  semanticQualityAccepted: true,
  observabilityPrivacyAccepted: true,
  currentMaxApprovedAccounts: DATA_AI20_MAX_APPROVED_ACCOUNTS
});

for (const testCase of fixture.cases) {
  const baseline = aggregateProductQueryOperationalBaseline(
    eventsForCase(testCase)
  );
  const readiness = evaluateProductQueryOperationalReadiness(
    baseline,
    controls
  );

  check(
    readiness.state === testCase.expectedState,
    `${testCase.id} expected ${testCase.expectedState}, got ${readiness.state}`
  );
  check(
    readiness.cohortExpansionAuthorized === false &&
      readiness.environmentMutationAuthorized === false &&
      readiness.publicCutoverAuthorized === false,
    `${testCase.id} must never authorize rollout mutation`
  );

  if (testCase.expectedReason) {
    check(
      readiness.reasons.includes(testCase.expectedReason),
      `${testCase.id} must preserve expected HOLD reason`
    );
  }
}

const readyCase = fixture.cases.find(
  (testCase) => testCase.id === "DA25-READY-01"
);
const readyBaseline = aggregateProductQueryOperationalBaseline(
  eventsForCase(readyCase)
);
check(
  readyBaseline.validRuntimeObservationCount === 50 &&
    readyBaseline.runtimeSuccessRate === 0.98 &&
    readyBaseline.fallbackRate === 0.02,
  "ready fixture must exercise the exact 98% runtime / 2% fallback boundary"
);

const invalidRequestBaseline = aggregateProductQueryOperationalBaseline([
  event({
    outcome: "invalid_request",
    provider: "provider",
    model: undefined,
    providerSucceeded: false,
    confidence: "unknown",
    constraintStatus: "unknown",
    resultCountBucket: "unknown",
    unresolvedCountBucket: "unknown"
  }),
  event()
]);
check(
  invalidRequestBaseline.validObservationCount === 2 &&
    invalidRequestBaseline.validRuntimeObservationCount === 1 &&
    invalidRequestBaseline.runtimeSuccessRate === 1,
  "invalid requests must not inflate or depress the runtime-attempt denominator"
);

const driftEvents = Array.from({ length: 30 }, () => event());
driftEvents[0] = event({ model: "unexpected-model" });
const driftBaseline = aggregateProductQueryOperationalBaseline(driftEvents);
const driftReadiness = evaluateProductQueryOperationalReadiness(
  driftBaseline,
  controls
);
check(
  driftBaseline.providerModelDriftCount === 1 &&
    driftReadiness.state === "hold" &&
    driftReadiness.reasons.includes("provider_model_contract_drift"),
  "successful provider/model drift must force HOLD"
);

const maliciousEvent = {
  ...event(),
  ...fixture.privacyAdversarialFields
};
const maliciousBaseline = aggregateProductQueryOperationalBaseline([
  maliciousEvent
]);
const maliciousSerialized = JSON.stringify(maliciousBaseline);

check(
  maliciousBaseline.candidateObservationCount === 1 &&
    maliciousBaseline.validObservationCount === 0 &&
    maliciousBaseline.telemetryContractViolationCount === 1,
  "privacy-adversarial Product Query observations must be rejected"
);

for (const forbidden of [
  "test@example.com",
  "Bearer",
  "sk-secret",
  "user-123",
  "deadbeef",
  "127.0.0.1",
  "secret-agent",
  "product-1",
  "secret-product",
  "secret-response",
  "oily sensitive sunscreen"
]) {
  check(
    !maliciousSerialized.includes(forbidden),
    `sanitized baseline leaked forbidden material: ${forbidden}`
  );
}

const unrelatedBaseline = aggregateProductQueryOperationalBaseline([
  { operation: "face_lab", rawQuery: "must be ignored" },
  event()
]);
check(
  unrelatedBaseline.candidateObservationCount === 1 &&
    unrelatedBaseline.validObservationCount === 1,
  "unrelated runtime logs must be ignored rather than imported into baseline evidence"
);

const sourceFiles = [
  "lib/product-query-beta-operational-readiness-contract.mjs",
  "lib/product-query-beta-operational-baseline.mjs",
  "lib/product-query-beta-operational-readiness-evaluator.mjs",
  "scripts/aggregate-data-ai25-product-query-baseline.mjs",
  "scripts/evaluate-data-ai25-product-query-readiness.mjs"
].map((path) => readFileSync(path, "utf8")).join("\n");

for (const forbiddenAuthority of [
  "BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES =",
  "DATA_AI20_MAX_APPROVED_ACCOUNTS = 4",
  "DATA_AI20_MAX_APPROVED_ACCOUNTS = 5",
  "automaticCohortExpansion: true",
  "environmentMutation: true",
  "publicCutover: true",
  "cohortExpansionAuthorized: true"
]) {
  check(
    !sourceFiles.includes(forbiddenAuthority),
    `DATA-AI25 must not contain rollout mutation authority: ${forbiddenAuthority}`
  );
}

console.log(
  `DATA-AI25 operational readiness verifier: PASS (${assertions} assertions)`
);
