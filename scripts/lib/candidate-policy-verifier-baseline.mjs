import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

export const CANDIDATE_POLICY_BASELINE_VERSION =
  "candidate-policy-verifier-baseline-v1";
export const CANDIDATE_POLICY_BASELINE_FIXED_TIME =
  "2026-07-28T00:00:00.000Z";

const CAPTURE_FILE_SET = [
  "baseline-complete-01.json",
  "baseline-complete-02.json",
  "baseline-final-only-01.json",
  "baseline-final-only-02.json",
  "candidate-exposure-audit.json",
  "candidate-exposure-audit.md",
  "replay-summary.json"
];

const INTEGRATION_FILE_SET = [
  "evaluator-boundary-actual-coverage.json",
  "evaluator-boundary-actual-coverage.md",
  "evaluator-boundary-integration-whatif.json",
  "evaluator-boundary-integration-whatif.md",
  "evaluator-boundary-pure-engine-target-replay.json",
  "evaluator-boundary-pure-engine-target-replay.md",
  "evaluator-boundary-readiness-review.json",
  "evaluator-boundary-readiness-review.md",
  "evaluator-boundary-target-capture-plan.json",
  "evaluator-boundary-target-capture-plan.md"
];

const HINT_RECEIVER_FILE_SET = [
  ...INTEGRATION_FILE_SET,
  "candidate-policy-hint-receiver-whatif.json",
  "candidate-policy-hint-receiver-whatif.md"
].sort();

const FORBIDDEN_FIELD_NAMES = new Set([
  "name",
  "brand",
  "buy_link",
  "image_url",
  "source_url",
  "email",
  "cookie",
  "token",
  "session"
]);

function sortedFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function syntheticProduct(index, overrides = {}) {
  return {
    id: `baseline-product-${String(index).padStart(2, "0")}`,
    category: "treatment",
    irritation_risk: "low",
    sensitivity_safe: true,
    ingredient_signals: {
      functional: [
        { label: "skin hydration", count: 6 },
        { label: "skin protection", count: 2 },
        { label: "whitening", count: 1 }
      ]
    },
    ...overrides
  };
}

function surveyContract() {
  return {
    skinState: {},
    goals: {},
    safety: {
      sensitivityRisk: "medium",
      rednessRisk: "high",
      drynessRisk: "low",
      recentSkinChange: "yes",
      recentlyChangedProduct: "yes"
    },
    behavior: {},
    preferences: {},
    sunscreen: {}
  };
}

function completeCapture(captureId, offset) {
  const products = Array.from({ length: 12 }, (_, index) => {
    if (index % 4 === 0) {
      return syntheticProduct(offset + index, {
        irritation_risk: "high",
        sensitivity_safe: false,
        ingredient_signals: {
          functional: [
            { label: "whitening", count: 5 },
            { label: "exfoliation", count: 2 }
          ]
        }
      });
    }
    if (index % 4 === 1) {
      return syntheticProduct(offset + index, {
        irritation_risk: null,
        sensitivity_safe: null
      });
    }
    return syntheticProduct(offset + index);
  });

  return {
    captureVersion: "v1",
    captureId,
    survey: surveyContract(),
    goalPolicy: {
      rankingGoal: "dehydration",
      safetyGoal: "redness",
      recommendationGuard: "stabilize_first",
      hasTension: true
    },
    candidateSource: {
      completeness: "complete",
      candidateIdentityMode: "product_row",
      sourceStage: "candidate_policy_verifier_baseline_fixture",
      sourceCount: products.length,
      products
    }
  };
}

function finalOnlyCapture(captureId) {
  return {
    captureVersion: "v1",
    captureId,
    survey: surveyContract(),
    goalPolicy: {},
    candidateSource: {
      completeness: "final_results_only",
      candidateIdentityMode: "final_result",
      sourceStage: "candidate_policy_verifier_baseline_fixture",
      sourceCount: 0,
      products: []
    }
  };
}

function writeFixtureInputs(captureDir) {
  const captures = [
    completeCapture("baseline-complete-01", 0),
    completeCapture("baseline-complete-02", 20),
    finalOnlyCapture("baseline-final-only-01"),
    finalOnlyCapture("baseline-final-only-02")
  ];

  for (const capture of captures) {
    writeFileSync(
      path.join(captureDir, `${capture.captureId}.json`),
      `${JSON.stringify(capture, null, 2)}\n`,
      "utf8"
    );
  }

  writeFileSync(
    path.join(captureDir, "replay-summary.json"),
    `${JSON.stringify({
      replayVersion: "functional-shadow-replay-v1",
      results: captures.slice(0, 2).map((capture) => ({
        captureId: capture.captureId,
        comparison: {
          comparisonSummary: {
            comparisonConfidence: "high"
          }
        }
      }))
    }, null, 2)}\n`,
    "utf8"
  );
}

function runScript(root, script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.status !== 0 || result.signal || result.error) {
    const detail = [
      `producer_failed:${script}`,
      `status=${result.status}`,
      result.signal ? `signal=${result.signal}` : null,
      result.error ? `error=${result.error.message}` : null,
      (result.stderr || "").slice(-2_000)
    ].filter(Boolean).join("\n");
    throw new Error(detail);
  }
  return {
    script,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function assertNoForbiddenFields(value, location = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenFields(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert(
      !FORBIDDEN_FIELD_NAMES.has(key.toLowerCase()),
      `forbidden field ${key} at ${location}`
    );
    assertNoForbiddenFields(item, `${location}.${key}`);
  }
}

function assertExactKeys(value, expected, label) {
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expected].sort(),
    `${label} exact key set`
  );
}

export function validateCandidateExposureAudit(artifact) {
  assertExactKeys(artifact, [
    "auditVersion",
    "generatedAt",
    "evidenceType",
    "provenance",
    "aggregate",
    "fixtureAudits",
    "excludedFixtures"
  ], "candidate exposure audit");
  assert.equal(artifact.auditVersion, "functional-candidate-exposure-audit-v1");
  assert.equal(artifact.evidenceType, "deterministic_contract_fixture");
  assert.equal(
    artifact.provenance?.productionSourceModule,
    "lib/functional-candidate-exposure-audit.js"
  );
  assert.equal(artifact.aggregate.completeCaptureCount, 2);
  assert.equal(artifact.aggregate.excludedFixtureCount, 2);
  assert.equal(artifact.fixtureAudits.length, 2);
  assert(artifact.aggregate.totalEvaluatedProductRows > 0);
  assert.equal(
    artifact.aggregate.candidateReviewRowCount,
    artifact.aggregate.totalEvaluatedProductRows
  );
  assert.equal(
    artifact.aggregate.totalPrimaryCount +
      artifact.aggregate.totalContextualCount +
      artifact.aggregate.totalCollapsedCount +
      artifact.aggregate.totalHiddenCount +
      artifact.aggregate.totalInsufficientEvidenceCount,
    artifact.aggregate.totalEvaluatedProductRows
  );
  assert.deepEqual(artifact.aggregate.exposureStatusDistribution, {
    collapsed_candidate: 12,
    contextual_candidate: 6,
    hidden_candidate: 6
  });
  const fixtureRowTotal = artifact.fixtureAudits.reduce(
    (sum, fixture) => sum + fixture.candidateReviewRows.length,
    0
  );
  assert.equal(fixtureRowTotal, artifact.aggregate.totalEvaluatedProductRows);
  assert(
    artifact.fixtureAudits.every(
      (fixture) =>
        fixture.sourceStage === "candidate_policy_verifier_baseline_fixture" &&
        fixture.comparisonConfidence === "high"
    )
  );
  assertNoForbiddenFields(artifact);
  return artifact;
}

export function validateIntegrationWhatIf(artifact) {
  assertExactKeys(artifact, [
    "generatedAt",
    "evidenceType",
    "contractVersion",
    "runtimeConnected",
    "routeInvoked",
    "supabaseWriteExecuted",
    "runtimeMutation",
    "evidenceSources",
    "integrationOptions",
    "recommendedIntegrationOption",
    "actualWhatIfSummary",
    "pureReplayWhatIfSummary",
    "safetyRegressionCheck",
    "lowRiskCollapsedHintConsistency",
    "gapStatus",
    "allowedNextStep",
    "prohibitedNextStep",
    "limitations"
  ], "integration what-if");
  assert.equal(artifact.evidenceType, "integration_whatif_shadow");
  assert.equal(
    artifact.contractVersion,
    "evaluator-boundary-collapsed-hint-contract-v1"
  );
  assert.equal(
    artifact.recommendedIntegrationOption,
    "option_b_evaluator_pass_with_collapsed_hint"
  );
  assert.equal(artifact.safetyRegressionCheck?.passed, true);
  assert.equal(artifact.lowRiskCollapsedHintConsistency?.passed, true);
  assert.equal(artifact.runtimeConnected, false);
  assert.equal(artifact.routeInvoked, false);
  assert.equal(artifact.supabaseWriteExecuted, false);
  assert.equal(artifact.runtimeMutation, false);
  assertNoForbiddenFields(artifact);
  return artifact;
}

export function validateHintReceiverWhatIf(artifact) {
  assertExactKeys(artifact, [
    "generatedAt",
    "evidenceType",
    "receiverContractVersion",
    "runtimeConnected",
    "routeInvoked",
    "supabaseWriteExecuted",
    "runtimeMutation",
    "evidenceSources",
    "actualReceiverSummary",
    "pureReplayReceiverSummary",
    "safetyRegressionCheck",
    "lowRiskCollapsedReceiverConsistency",
    "gapStatus",
    "allowedNextStep",
    "prohibitedNextStep",
    "limitations"
  ], "hint receiver what-if");
  assert.equal(artifact.evidenceType, "candidate_policy_hint_receiver_whatif");
  assert.equal(
    artifact.receiverContractVersion,
    "candidate-policy-hint-receiver-contract-v1"
  );
  assert.equal(artifact.safetyRegressionCheck?.passed, true);
  assert.equal(artifact.lowRiskCollapsedReceiverConsistency?.passed, true);
  assert.equal(artifact.runtimeConnected, false);
  assert.equal(artifact.routeInvoked, false);
  assert.equal(artifact.supabaseWriteExecuted, false);
  assert.equal(artifact.runtimeMutation, false);
  assertNoForbiddenFields(artifact);
  return artifact;
}

function stripVolatile(value) {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["generatedAt", "durationMs"].includes(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stripVolatile(item)])
  );
}

export function semanticHash(value) {
  return createHash("sha256")
    .update(JSON.stringify(stripVolatile(value)))
    .digest("hex");
}

export function materializeCandidatePolicyVerifierBaseline({
  root,
  workspace,
  includeHintReceiver = false,
  legacyRepositoryLayout = false
}) {
  const captureDir = path.join(
    workspace,
    legacyRepositoryLayout ? "functional-shadow-captures" : "captures"
  );
  const outputDir = legacyRepositoryLayout
    ? workspace
    : path.join(workspace, "artifacts");

  if (legacyRepositoryLayout) {
    rmSync(workspace, { recursive: true, force: true });
  } else {
    rmSync(captureDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
  mkdirSync(captureDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
  writeFixtureInputs(captureDir);

  const common = ["--generated-at", CANDIDATE_POLICY_BASELINE_FIXED_TIME];
  const runs = [];
  runs.push(runScript(root, "scripts/run-functional-candidate-exposure-audit.mjs", [
    "--capture-dir",
    captureDir,
    ...common
  ]));
  const candidateAudit = validateCandidateExposureAudit(
    readJson(path.join(captureDir, "candidate-exposure-audit.json"))
  );

  runs.push(runScript(root, "scripts/collect-evaluator-boundary-actual-coverage.mjs", [
    "--capture-dir",
    captureDir,
    "--output-dir",
    outputDir,
    ...common
  ]));
  const actualCoverage = readJson(
    path.join(outputDir, "evaluator-boundary-actual-coverage.json")
  );
  assert.equal(actualCoverage.evidenceType, "deterministic_contract_fixture");
  assert.equal(actualCoverage.actualEvidenceAvailable, false);
  assert.equal(actualCoverage.fixtureEvidenceAvailable, true);
  assert(actualCoverage.candidateSummary.totalCandidateRows > 0);
  assert.equal(actualCoverage.highRiskProtection.passed, true);
  assertNoForbiddenFields(actualCoverage);

  runs.push(runScript(root, "scripts/plan-evaluator-boundary-target-captures.mjs", [
    "--capture-dir",
    captureDir,
    "--output-dir",
    outputDir,
    ...common
  ]));
  const targetPlan = readJson(
    path.join(outputDir, "evaluator-boundary-target-capture-plan.json")
  );
  assert.equal(
    targetPlan.planVersion,
    "evaluator-boundary-target-capture-plan-v1"
  );
  assert.equal(targetPlan.proposedScenarios.length, 4);
  assert.equal(targetPlan.runtimeMutation, false);

  runs.push(runScript(root, "scripts/run-pure-engine-target-scenario-replay.mjs", [
    "--output-dir",
    outputDir,
    ...common
  ]));
  const pureReplay = readJson(
    path.join(outputDir, "evaluator-boundary-pure-engine-target-replay.json")
  );
  assert.equal(
    pureReplay.replayVersion,
    "evaluator-boundary-pure-engine-target-replay-v1"
  );
  assert.equal(pureReplay.productSourceSummary.status, "unavailable");
  assert.equal(
    pureReplay.productSourceSummary.failureReason,
    "read_only_product_source_missing_config"
  );
  assert.equal(pureReplay.productRowsLoaded, 0);
  assert.equal(pureReplay.routeInvoked, false);
  assert.equal(pureReplay.supabaseWriteExecuted, false);
  assert.equal(pureReplay.runtimeMutation, false);

  runs.push(runScript(root, "scripts/review-evaluator-boundary-readiness.mjs", [
    "--output-dir",
    outputDir,
    ...common
  ]));
  const readiness = readJson(
    path.join(outputDir, "evaluator-boundary-readiness-review.json")
  );
  assert.equal(readiness.routeInvoked, false);
  assert.equal(readiness.supabaseWriteExecuted, false);
  assert.equal(readiness.runtimeMutation, false);
  runs.push(runScript(root, "scripts/run-evaluator-boundary-integration-whatif.mjs", [
    "--capture-dir",
    captureDir,
    "--output-dir",
    outputDir,
    ...common
  ]));
  const integration = validateIntegrationWhatIf(
    readJson(path.join(outputDir, "evaluator-boundary-integration-whatif.json"))
  );

  let hintReceiver = null;
  if (includeHintReceiver) {
    runs.push(runScript(root, "scripts/run-candidate-policy-hint-receiver-whatif.mjs", [
      "--output-dir",
      outputDir,
      ...common
    ]));
    hintReceiver = validateHintReceiverWhatIf(
      readJson(path.join(outputDir, "candidate-policy-hint-receiver-whatif.json"))
    );
  }

  assert.deepEqual(sortedFiles(captureDir), CAPTURE_FILE_SET);
  assert.deepEqual(
    sortedFiles(outputDir),
    includeHintReceiver ? HINT_RECEIVER_FILE_SET : INTEGRATION_FILE_SET
  );

  return {
    version: CANDIDATE_POLICY_BASELINE_VERSION,
    captureDir,
    outputDir,
    captureFiles: sortedFiles(captureDir),
    outputFiles: sortedFiles(outputDir),
    candidateAudit,
    integration,
    hintReceiver,
    semanticHashes: {
      candidateAudit: semanticHash(candidateAudit),
      actualCoverage: semanticHash(actualCoverage),
      targetPlan: semanticHash(targetPlan),
      pureReplay: semanticHash(pureReplay),
      readiness: semanticHash(readiness),
      integration: semanticHash(integration),
      ...(hintReceiver ? { hintReceiver: semanticHash(hintReceiver) } : {})
    },
    runs
  };
}

export function cleanupCandidatePolicyVerifierWorkspace(workspace) {
  rmSync(workspace, { recursive: true, force: true });
  assert.equal(
    readdirSync(path.dirname(workspace), { withFileTypes: true })
      .some((entry) => entry.name === path.basename(workspace)),
    false,
    "candidate policy verifier workspace should be removed"
  );
}
