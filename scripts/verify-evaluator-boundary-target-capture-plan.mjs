import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildEvaluatorBoundaryTargetCapturePlan } from "./plan-evaluator-boundary-target-captures.mjs";

const ROOT = process.cwd();
const JSON_OUTPUT = path.join(ROOT, "tmp", "evaluator-boundary-target-capture-plan.json");

const ALLOWED_FORM_FIELDS = new Set([
  "skinType",
  "sensitivity",
  "primaryConcern",
  "mainConcerns",
  "recentSkinChange",
  "recentlyChangedProduct",
  "sunscreenPreferenceState",
  "postWashFeeling",
  "afternoonSkinChange",
  "cleansingFrequency",
  "environmentExposure",
  "preferredTexture",
  "mostDislikedFeel",
  "whiteCastHate",
  "toneUpWanted",
  "makeupUse",
  "eyeSensitive"
]);

const RAW_LEAKAGE_PATTERNS = [
  /base64/i,
  /filename/i,
  /purchase/i,
  /review text/i,
  /raw form/i,
  /email/i,
  /cookie/i,
  /session/i,
  /user-agent/i,
  /user agent/i,
  /product name/i,
  /brand/i
];

function stripGeneratedAt(plan) {
  return {
    ...plan,
    generatedAt: "<stable>"
  };
}

function assertScenarioContract(plan) {
  assert(Array.isArray(plan.proposedScenarios), "proposedScenarios should be an array");
  assert(plan.proposedScenarios.length >= 4, "at least four target scenarios should be proposed");

  for (const scenario of plan.proposedScenarios) {
    assert(scenario.scenarioId, "scenarioId should be present");
    assert(scenario.form && typeof scenario.form === "object", "scenario form should be present");

    for (const key of Object.keys(scenario.form)) {
      assert(ALLOWED_FORM_FIELDS.has(key), `unsupported SurveyInputContract scenario field: ${key}`);
    }

    assert(Array.isArray(scenario.expectedGapTargets), "expectedGapTargets should be an array");
    assert.equal(scenario.captureMode, "dev_only_actual_api_capture", "scenario should target actual dev-only API capture");
  }
}

function assertGapContract(plan) {
  const requiredGaps = ["activeLeaningOnly", "metadataIncomplete", "serumCategory", "strongCaution"];
  const validStatuses = new Set([
    "available_in_current_complete_candidate_rows",
    "not_available_in_current_product_distribution"
  ]);

  for (const gap of requiredGaps) {
    const value = plan.gapTargetAvailability?.[gap];
    assert(value, `missing gap target availability for ${gap}`);
    assert(validStatuses.has(value.status), `invalid status for ${gap}: ${value.status}`);
    assert(Number.isInteger(value.candidateRowCount), `${gap} candidateRowCount should be numeric`);
    assert(Number.isInteger(value.boundaryApplicableRows), `${gap} boundaryApplicableRows should be numeric`);
  }
}

function assertNoRawLeakage(plan) {
  const serialized = JSON.stringify(plan);
  for (const pattern of RAW_LEAKAGE_PATTERNS) {
    assert(!pattern.test(serialized), `target capture plan leaked forbidden pattern: ${pattern}`);
  }
}

function assertRuntimeIsolation() {
  const guardedFiles = [
    "app/api/analyze/route.js",
    "lib/functional-ranking-contract.js",
    "lib/functional-candidate-policy.js"
  ];

  for (const file of guardedFiles) {
    const source = readFileSync(path.join(ROOT, file), "utf8");
    assert(
      !source.includes("plan-evaluator-boundary-target-captures") &&
        !source.includes("evaluator-boundary-target-capture-plan"),
      `${file} should not import or reference target capture planning`
    );
  }
}

async function main() {
  execFileSync(process.execPath, ["scripts/plan-evaluator-boundary-target-captures.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    env: process.env
  });

  assert(existsSync(JSON_OUTPUT), "target capture plan JSON should exist");
  const outputPlan = JSON.parse(readFileSync(JSON_OUTPUT, "utf8"));
  assert.equal(outputPlan.runtimeMutation, false, "plan must declare no runtime mutation");
  assert.equal(outputPlan.sourceSummary.syntheticFixturesUsed, false, "synthetic fixtures must not be counted as actual evidence");
  assert.equal(outputPlan.devCaptureExecution.status, "capture_run_not_executed", "planner should not fake a dev capture run");

  assertScenarioContract(outputPlan);
  assertGapContract(outputPlan);
  assertNoRawLeakage(outputPlan);
  assertRuntimeIsolation();

  const fixedA = await buildEvaluatorBoundaryTargetCapturePlan({ generatedAt: "2026-07-03T00:00:00.000Z" });
  const fixedB = await buildEvaluatorBoundaryTargetCapturePlan({ generatedAt: "2026-07-03T00:00:00.000Z" });
  assert.deepEqual(stripGeneratedAt(fixedA), stripGeneratedAt(fixedB), "target capture plan should be deterministic with a fixed timestamp");

  console.log("verify-evaluator-boundary-target-capture-plan passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
