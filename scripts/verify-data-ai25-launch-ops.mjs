#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    input: options.input,
    windowsHide: true
  });
}

function event(overrides = {}) {
  return {
    timestamp: "2026-10-01T00:00:01.000Z",
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
    deploymentSha: "abcdef0123456789abcdef0123456789abcdef01",
    ...overrides
  };
}

const root = mkdtempSync(join(tmpdir(), "bejewely-data-ai25-launch-ops-"));
const boundaryPath = join(root, "operational-baseline-start.json");
const launchArgs = [
  "scripts/freeze-data-ai25-operational-baseline-start.mjs",
  "--launched-at",
  "2026-10-01T00:00:00.000Z",
  "--deployment-id",
  "dpl_TestLaunchBoundary123",
  "--deployment-sha",
  "abcdef0123456789abcdef0123456789abcdef01",
  "--output",
  boundaryPath
];

const missingConfirmation = runNode(launchArgs);
check(
  missingConfirmation.status !== 0,
  "launch boundary must fail closed without explicit real-launch confirmation"
);

const frozen = runNode([
  ...launchArgs,
  "--confirm",
  "I_CONFIRM_REAL_SERVICE_LAUNCH"
]);
check(frozen.status === 0, "valid launch boundary freeze must succeed");

const boundary = JSON.parse(readFileSync(boundaryPath, "utf8"));
check(
  boundary.boundaryVersion === "data-ai25-operational-baseline-start-v1" &&
    boundary.phase === "DATA-AI25" &&
    boundary.state === "operational_baseline_started" &&
    boundary.operationalBaselineStartAt === "2026-10-01T00:00:00.000Z" &&
    boundary.preBaselineQaExcluded === true &&
    boundary.syntheticTrafficMaySatisfyBaseline === false &&
    boundary.cohortExpansionAuthorized === false &&
    boundary.publicCutoverAuthorized === false,
  "frozen launch boundary must preserve the post-launch authority contract"
);

const repeated = runNode([
  ...launchArgs,
  "--confirm",
  "I_CONFIRM_REAL_SERVICE_LAUNCH"
]);
check(
  repeated.status === 0,
  "repeating the exact same launch boundary must be idempotent"
);

const changedBoundary = runNode([
  "scripts/freeze-data-ai25-operational-baseline-start.mjs",
  "--launched-at",
  "2026-10-01T00:00:02.000Z",
  "--deployment-id",
  "dpl_TestLaunchBoundary123",
  "--deployment-sha",
  "abcdef0123456789abcdef0123456789abcdef01",
  "--output",
  boundaryPath,
  "--confirm",
  "I_CONFIRM_REAL_SERVICE_LAUNCH"
]);
check(
  changedBoundary.status !== 0,
  "a frozen operational baseline must reject later cutoff mutation"
);

const productionEvents = [
  event({ timestamp: "2026-09-30T23:59:59.000Z" }),
  ...Array.from({ length: 30 }, (_, index) =>
    event({
      timestamp: new Date(
        Date.parse("2026-10-01T00:00:01.000Z") + index * 1000
      ).toISOString()
    })
  )
];

const evaluationArgs = [
  "scripts/run-data-ai25-post-launch-evaluation.mjs",
  "--boundary",
  boundaryPath,
  "--source",
  "production-vercel-runtime",
  "--security-regression-count",
  "0",
  "--persistence-leakage-count",
  "0"
];

const missingProductionConfirmation = runNode(evaluationArgs, {
  input: JSON.stringify(productionEvents)
});
check(
  missingProductionConfirmation.status !== 0,
  "post-launch readiness must fail closed without explicit Production observation confirmation"
);

const evaluated = runNode(
  [
    ...evaluationArgs,
    "--confirm",
    "I_CONFIRM_REAL_PRODUCTION_OBSERVATIONS"
  ],
  { input: JSON.stringify(productionEvents) }
);
check(
  evaluated.status === 0,
  `post-launch readiness command must succeed: ${evaluated.stderr}`
);

const evidence = JSON.parse(evaluated.stdout);
check(
  evidence.phase === "DATA-AI25" &&
    evidence.source === "production-vercel-runtime" &&
    evidence.launchBoundary.operationalBaselineStartAt ===
      "2026-10-01T00:00:00.000Z" &&
    evidence.baseline.preBaselineObservationCount === 1 &&
    evidence.baseline.validRuntimeObservationCount === 30 &&
    evidence.readiness.state === "ready_for_manual_expansion_review",
  "post-launch command must exclude pre-launch traffic and evaluate 30 valid observations"
);
check(
  evidence.readiness.cohortExpansionAuthorized === false &&
    evidence.readiness.environmentMutationAuthorized === false &&
    evidence.readiness.publicCutoverAuthorized === false &&
    evidence.authority.syntheticTrafficAccepted === false &&
    evidence.authority.rawRuntimeLogsPersisted === false,
  "ready state must remain review-only with no rollout mutation authority"
);

const maliciousSecret = "SHOULD_NOT_LEAK_RAW_QUERY_SECRET";
const adversarialEvents = [
  ...productionEvents.slice(1),
  {
    ...event({ timestamp: "2026-10-01T00:10:00.000Z" }),
    rawQuery: maliciousSecret
  }
];
const adversarial = runNode(
  [
    ...evaluationArgs,
    "--confirm",
    "I_CONFIRM_REAL_PRODUCTION_OBSERVATIONS"
  ],
  { input: JSON.stringify(adversarialEvents) }
);
check(adversarial.status === 0, "privacy-adversarial observation must be safely scored");
const adversarialEvidence = JSON.parse(adversarial.stdout);
check(
  adversarialEvidence.baseline.telemetryContractViolationCount === 1 &&
    adversarialEvidence.readiness.state === "hold",
  "unexpected telemetry fields must force HOLD after minimum evidence is met"
);
check(
  !adversarial.stdout.includes(maliciousSecret),
  "sanitized DATA-AI25 evidence must not copy rejected raw query material"
);

console.log(
  `DATA-AI25 launch operations verifier: PASS (${assertions} assertions)`
);
