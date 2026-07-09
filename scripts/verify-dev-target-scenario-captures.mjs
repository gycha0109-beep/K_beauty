import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { runDevTargetScenarioCaptures } from "./run-dev-target-scenario-captures.mjs";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "evaluator-boundary-dev-target-captures.json");

const RAW_LEAKAGE_PATTERNS = [
  /base64/i,
  /filename/i,
  /purchase/i,
  /review text/i,
  /raw form/i,
  /email/i,
  /cookie/i,
  /user-agent/i,
  /user agent/i,
  /product name/i,
  /brand/i
];

function stripGeneratedAt(result) {
  return {
    ...result,
    generatedAt: "<stable>"
  };
}

function assertNoLeakage(result) {
  const serialized = JSON.stringify(result);
  for (const pattern of RAW_LEAKAGE_PATTERNS) {
    assert(!pattern.test(serialized), `dev target capture output leaked forbidden pattern: ${pattern}`);
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
      !source.includes("run-dev-target-scenario-captures") &&
        !source.includes("evaluator-boundary-dev-target-captures"),
      `${file} should not import or reference the dev target capture runner`
    );
  }
}

function assertExecutionContract(result) {
  assert.equal(result.runtimeMutation, false, "runner must declare no runtime mutation");
  assert.equal(result.syntheticFixturesUsed, false, "synthetic fixtures must not be counted as actual captures");
  assert(result.executionStatus && typeof result.executionStatus === "object", "executionStatus should be present");

  if (result.executionStatus.executed) {
    assert.equal(result.executionStatus.skipped, false, "executed run should not be skipped");
    assert.equal(result.captureFlagEnabled, true, "executed run should require an enabled capture flag");
    assert(Number.isInteger(result.newCompleteProductRowCaptures.length), "new capture count should be recorded");
  } else {
    assert.equal(result.executionStatus.skipped, true, "non-executed run should be marked skipped");
    assert(result.executionStatus.skipReason, "skipped run should include a skipReason");
  }

  assert(Array.isArray(result.scenarioResults), "scenarioResults should be an array");
  assert(result.scenarioResults.length >= 4, "four target scenarios should be represented");
  for (const scenario of result.scenarioResults) {
    assert(scenario.scenarioId, "scenario result should include scenarioId");
    assert(["not_attempted", "succeeded", "failed"].includes(scenario.status), `invalid scenario status: ${scenario.status}`);
  }
}

function assertCoverageSafety(result) {
  const highRisk = result.coverageAfterRun?.highRiskProtection;
  assert(highRisk, "coverageAfterRun.highRiskProtection should be present");
  assert.equal(highRisk.highRiskCollapsedCount, 0, "high-risk actual candidates should not be downgraded to collapsed");

  for (const gap of ["activeLeaningOnly", "metadataIncomplete", "serumCategory", "strongCaution"]) {
    const bucket = result.coverageAfterRun?.gapCoverage?.[gap];
    assert(bucket, `${gap} bucket should be present`);
    assert(
      bucket.status === "observed_in_current_actual_captures" ||
        bucket.status === "not_observed_in_current_actual_captures",
      `${gap} should be observed or explicitly marked not observed`
    );
  }
}

async function main() {
  execFileSync(process.execPath, ["scripts/run-dev-target-scenario-captures.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    env: process.env
  });

  assert(existsSync(OUTPUT_PATH), "dev target capture output JSON should exist");
  const output = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
  assertExecutionContract(output);
  assertCoverageSafety(output);
  assertNoLeakage(output);
  assertRuntimeIsolation();

  const fixedA = await runDevTargetScenarioCaptures({ generatedAt: "2026-07-03T00:00:00.000Z" });
  const fixedB = await runDevTargetScenarioCaptures({ generatedAt: "2026-07-03T00:00:00.000Z" });
  assert.deepEqual(stripGeneratedAt(fixedA), stripGeneratedAt(fixedB), "dev target capture result should be deterministic with a fixed timestamp");

  console.log("verify-dev-target-scenario-captures passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
