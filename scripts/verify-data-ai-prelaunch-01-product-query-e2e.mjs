#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE,
  PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE_CONTRACT_VERSION
} from "../lib/product-query-prelaunch-acceptance-contract.mjs";
import {
  PRODUCT_QUERY_BETA_OPERATIONAL_READINESS
} from "../lib/product-query-beta-operational-readiness-contract.mjs";
import {
  aggregateProductQueryOperationalBaseline
} from "../lib/product-query-beta-operational-baseline.mjs";
import {
  evaluateProductQueryOperationalReadiness
} from "../lib/product-query-beta-operational-readiness-evaluator.mjs";
import {
  PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE
} from "../lib/product-query-beta-quality-acceptance-evidence.mjs";
import {
  PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY
} from "../lib/product-query-operational-observability.mjs";
import {
  DATA_AI20_MAX_APPROVED_ACCOUNTS
} from "../lib/product-query-authenticated-beta-controlled-activation.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE_CONTRACT_VERSION ===
    "product-query-prelaunch-acceptance-v1" &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.phase === "DATA-AI-PRELAUNCH-01" &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.targetState === "prelaunch_accepted",
  "prelaunch acceptance contract must be frozen"
);

check(
  PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.executionBoundary
      .exactProductionDeploymentRequired === true &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.executionBoundary
      .dedicatedQaAccountsRequired === true &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.executionBoundary
      .approvedAccountRequired === true &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.executionBoundary
      .authenticatedNonCohortAccountRequired === true &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.executionBoundary
      .automaticProductionExecution === false &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.executionBoundary
      .manualHostedAcceptanceRequired === true,
  "hosted Production acceptance must remain explicit and manual"
);

check(
  PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.authorityBoundary
      .providerRole === "intent_parsing_only" &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.authorityBoundary
      .providerProductSelection === false &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.authorityBoundary
      .providerRankingAuthority === false &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.authorityBoundary
      .deterministicRankingAuthority === "existing_recommendation_engine" &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.authorityBoundary
      .automaticCohortExpansion === false &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.authorityBoundary
      .publicCutover === false &&
    DATA_AI20_MAX_APPROVED_ACCOUNTS === 3,
  "prelaunch acceptance must not widen recommendation or rollout authority"
);

check(
  PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.persistenceBoundary.persistence ===
      "none" &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.persistenceBoundary
      .compareAfterDashboardLoad === true &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.privacyBoundary
      .rawQueryInPermanentEvidence === false &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.privacyBoundary
      .artifactSecretScanRequired === true,
  "prelaunch persistence/privacy boundary must remain closed"
);

check(
  PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE.phase === "DATA-AI22" &&
    PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE.accepted === true &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.phase === "DATA-AI24" &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.persistence === "none",
  "DATA-AI22 and DATA-AI24 must remain the semantic and observability authorities"
);

check(
  PRODUCT_QUERY_BETA_OPERATIONAL_READINESS.observabilityAuthority
      .postLaunchOnly === true &&
    PRODUCT_QUERY_BETA_OPERATIONAL_READINESS.observabilityAuthority
      .operationalBaselineStartAtRequired === true &&
    PRODUCT_QUERY_BETA_OPERATIONAL_READINESS.observabilityAuthority
      .prelaunchQaExcluded === true &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.operationalEvidenceBoundary
      .prelaunchQaMaySatisfyDataAi25 === false,
  "DATA-AI25 must be post-launch only"
);

function observation(timestamp) {
  return {
    timestamp,
    event: "provider_runtime",
    category: "runtime_state",
    operation: "product_query_beta",
    dependency: "application",
    environment: "production",
    provider: "openai",
    model: "gpt-5.6-luna",
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
    deploymentSha: "abcdef0123456789abcdef0123456789abcdef01"
  };
}

const noLaunchBoundary = aggregateProductQueryOperationalBaseline([
  observation("2026-09-25T00:00:00.000Z")
]);
const noLaunchReadiness = evaluateProductQueryOperationalReadiness(
  noLaunchBoundary,
  {
    securityRegressionCount: 0,
    persistenceLeakageCount: 0,
    semanticQualityAccepted: true,
    observabilityPrivacyAccepted: true,
    currentMaxApprovedAccounts: 3
  }
);
check(
  noLaunchBoundary.validRuntimeObservationCount === 0 &&
    noLaunchBoundary.unscopedObservationCount === 1 &&
    noLaunchReadiness.state === "insufficient_evidence" &&
    noLaunchReadiness.reasons.includes("operational_baseline_not_started"),
  "pre-launch observations must not become DATA-AI25 evidence before launch"
);

const scopedBaseline = aggregateProductQueryOperationalBaseline(
  [
    observation("2026-09-25T09:59:59.000Z"),
    observation("2026-09-25T10:00:00.000Z")
  ],
  { operationalBaselineStartAt: "2026-09-25T10:00:00.000Z" }
);
check(
  scopedBaseline.preBaselineObservationCount === 1 &&
    scopedBaseline.validRuntimeObservationCount === 1,
  "only observations at or after the real launch boundary may enter DATA-AI25"
);

const prelaunchMalformedBaseline = aggregateProductQueryOperationalBaseline(
  [
    {
      ...observation("2026-09-25T09:59:59.000Z"),
      rawQuery: "prelaunch QA must never contaminate readiness"
    },
    observation("2026-09-25T10:00:00.000Z")
  ],
  { operationalBaselineStartAt: "2026-09-25T10:00:00.000Z" }
);
check(
  prelaunchMalformedBaseline.preBaselineObservationCount === 1 &&
    prelaunchMalformedBaseline.telemetryContractViolationCount === 0 &&
    prelaunchMalformedBaseline.validRuntimeObservationCount === 1,
  "pre-launch QA must be excluded before DATA-AI25 contract scoring"
);

const cardSource = readFileSync(
  "components/my/ProductQueryBetaCard.jsx",
  "utf8"
);
const dashboardSource = readFileSync("components/my/MyDashboard.jsx", "utf8");
const routeSource = readFileSync(
  "app/api/my/product-query-beta/route.js",
  "utf8"
);
const runnerSource = readFileSync(
  "scripts/run-product-query-prelaunch-e2e.mjs",
  "utf8"
);

for (const selector of [
  'data-testid="product-query-beta-card"',
  'data-testid="product-query-beta-input"',
  'data-testid="product-query-beta-submit"',
  'data-testid="product-query-beta-result"'
]) {
  check(cardSource.includes(selector), `missing stable E2E selector: ${selector}`);
}

check(
  dashboardSource.includes("productQueryBetaAvailable ?") &&
    dashboardSource.includes("<ProductQueryBetaCard"),
  "My dashboard must keep server-computed beta visibility"
);

check(
  routeSource.includes("export async function POST(request)") &&
    !routeSource.includes("export async function GET(") &&
    routeSource.includes('error: "unauthorized"') &&
    routeSource.includes("if (!runtimePolicy.allowed) return notFound();"),
  "Product Query route must remain authenticated, cohort-gated and POST-only"
);

check(
  routeSource.includes('status: 503, error: "product_query_temporarily_unavailable"') &&
    routeSource.includes('status: 502, error: "product_query_provider_protocol_error"'),
  "provider failure mapping must remain controlled without Production sabotage"
);

for (const requiredRunnerToken of [
  "PQ_PRELAUNCH_ALLOW_PRODUCTION",
  "PQ_PRELAUNCH_EXPECTED_SHA",
  "PQ_PRELAUNCH_DEPLOYMENT_SHA",
  "PQ_PRELAUNCH_ELIGIBLE_STORAGE_STATE",
  "PQ_PRELAUNCH_INELIGIBLE_STORAGE_STATE",
  "ineligibleCardHidden",
  "ineligibleDirectPostBlocked",
  "snapshotPersistence",
  "persistenceAfter",
  "persistenceBefore",
  "artifactSecretLeakage"
]) {
  check(
    runnerSource.includes(requiredRunnerToken),
    `manual hosted runner missing boundary: ${requiredRunnerToken}`
  );
}

check(
  runnerSource.includes('viewport: { width: 1440, height: 1080 }') &&
    runnerSource.includes('viewport: { width: 390, height: 844 }') &&
    runnerSource.includes('new URL("/en/my", baseUrl)') &&
    runnerSource.includes('caseId: "PRE-CONFLICT"') &&
    runnerSource.includes('caseId: "PRE-UNSUPPORTED"'),
  "manual hosted runner must cover desktop/mobile, ko/en and fail-closed cases"
);

for (const forbiddenMutation of [
  "BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES =",
  "DATA_AI20_MAX_APPROVED_ACCOUNTS = 4",
  "automaticCohortExpansion: true",
  "publicCutover: true",
  "cohortExpansionAuthorized: true",
  "publicCutoverAuthorized: true"
]) {
  check(
    !runnerSource.includes(forbiddenMutation),
    `prelaunch runner must not contain rollout mutation authority: ${forbiddenMutation}`
  );
}

check(
  PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.completionBoundary.freezeAfterAcceptance ===
      true &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.completionBoundary
      .acceptedStateLabel === "PRE-LAUNCH READY" &&
    PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE.completionBoundary
      .nextAction === "real_service_launch",
  "accepted Product Query must freeze until real service launch"
);

console.log(
  `DATA-AI-PRELAUNCH-01 verifier: PASS (${assertions} assertions)`
);
