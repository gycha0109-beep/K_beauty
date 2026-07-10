import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "evaluator-boundary-pure-engine-target-replay.json");
const REQUIRED_SCENARIOS = [
  "target_active_acne_recent_instability",
  "target_redness_barrier_recent_instability",
  "target_pores_tone_active_recent_instability",
  "target_serum_tone_acne_recent_instability"
];
const FORBIDDEN_RUNTIME_FILES = [
  "app/api/analyze/route.js",
  "lib/skin-match-decision-engine.js",
  "lib/functional-ranking-contract.js",
  "lib/functional-candidate-policy.js",
  "app/page.js",
  "app/result/page.js",
  "app/result/full-report/page.js"
];
const FORBIDDEN_OUTPUT_PATTERNS = [
  /base64/i,
  /raw form/i,
  /"name"\s*:/i,
  /"brand"\s*:/i,
  /"buy_link"\s*:/i,
  /"image_url"\s*:/i,
  /purchase/i,
  /review text/i,
  /oliveyoung/i,
  /email/i,
  /cookie/i,
  /user-agent/i,
  /user agent/i,
  /Bearer\s+[A-Za-z0-9._-]+/i
];

function runReplay() {
  execFileSync(process.execPath, ["scripts/run-pure-engine-target-scenario-replay.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    env: process.env
  });
  assert(existsSync(OUTPUT_PATH), "pure engine replay output JSON should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(artifact) {
  return {
    ...artifact,
    generatedAt: "<stable>"
  };
}

function assertNoLeakage(artifact) {
  const serialized = JSON.stringify(artifact);

  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    assert(!pattern.test(serialized), `readonly replay output leaked forbidden pattern: ${pattern}`);
  }

  assert.equal(artifact.envValuesPrinted, false, "env values should not be printed");
  for (const envLoad of artifact.envFileLoads || []) {
    assert.equal(envLoad.valuesPrinted, false, `${envLoad.fileName} values should not be printed`);
  }
}

function assertReplayContract(artifact) {
  assert.equal(artifact.evidenceType, "pure_engine_replay");
  assert.equal(artifact.routeInvoked, false);
  assert.equal(artifact.apiAnalyzeInvoked, false);
  assert.equal(artifact.supabaseWriteExecuted, false);
  assert.equal(artifact.runtimeMutation, false);
  assert.equal(artifact.envValuesPrinted, false);
  assert.equal(artifact.productSource, "getRecommendationProducts_read_only");
  assert.equal(artifact.productSourceSummary?.source, "getRecommendationProducts_read_only");
  assert.equal(artifact.productSourceSummary?.serviceRoleRequired, false);
  assert.equal(artifact.productSourceSummary?.syntheticProductsUsed, false);
  assert.equal(artifact.productSourceSummary?.replayFallbackProductCount, 0);
  assert(Number.isInteger(artifact.productRowsLoaded), "productRowsLoaded should be recorded");
  assert(Number.isInteger(artifact.scorerCompatibleRows), "scorerCompatibleRows should be recorded");
  assert(artifact.productRowsLoaded >= artifact.scorerCompatibleRows);
  assert.equal(artifact.productRowsLoaded, artifact.productSourceSummary.productRowsLoaded);
  assert.equal(artifact.scorerCompatibleRows, artifact.productSourceSummary.scorerCompatibleRows);
  assert(!("completeProductRowFixturesUsed" in artifact), "actual capture fixture count should not be mixed into replay artifact");
}

function assertScenarioContract(artifact) {
  const scenarios = Array.isArray(artifact.scenarioResults) ? artifact.scenarioResults : [];
  const scenarioIds = new Set(scenarios.map((scenario) => scenario.scenarioId));

  for (const scenarioId of REQUIRED_SCENARIOS) {
    assert(scenarioIds.has(scenarioId), `missing target scenario result: ${scenarioId}`);
  }

  assert.equal(artifact.scenariosAttempted, REQUIRED_SCENARIOS.length);
  assert.equal(artifact.scenariosSucceeded + artifact.scenariosFailed, artifact.scenariosAttempted);

  for (const scenario of scenarios) {
    assert(["succeeded", "failed"].includes(scenario.status), `invalid status for ${scenario.scenarioId}`);
    assert(Number.isInteger(scenario.productRowsLoaded), `${scenario.scenarioId} missing productRowsLoaded`);
    assert(Number.isInteger(scenario.scorerCompatibleRows), `${scenario.scenarioId} missing scorerCompatibleRows`);
    assert(Number.isInteger(scenario.candidateRows), `${scenario.scenarioId} missing candidateRows`);
    assert(Number.isInteger(scenario.boundaryApplicableRows), `${scenario.scenarioId} missing boundaryApplicableRows`);
    assert(scenario.decisionSummary && typeof scenario.decisionSummary === "object");
    assert(scenario.gapCoverage && typeof scenario.gapCoverage === "object");
    assert(Number.isInteger(scenario.highRiskCollapsedCount));

    if (scenario.status === "failed") {
      assert(scenario.failureReason, `${scenario.scenarioId} failed without failureReason`);
    }
  }
}

function assertCoverageSafety(artifact) {
  assert.equal(artifact.highRiskCollapsedCount, 0, "high-risk candidates must not be downgraded to collapsed");

  for (const gap of ["activeLeaningOnly", "metadataIncomplete", "serumCategory", "strongCaution", "safeLowRiskHidden"]) {
    const bucket = artifact.gapCoverage?.[gap];
    assert(bucket, `${gap} bucket should exist`);
    assert(
      bucket.status === "observed_in_pure_engine_replay" ||
        bucket.status === "not_observed_in_pure_engine_replay",
      `${gap} should be observed or explicitly marked not observed`
    );
  }

  const metadata = artifact.gapCoverage.metadataIncomplete;
  if (metadata.observed) {
    const decisions = Object.keys(metadata.decisionDistribution || {});
    assert(
      decisions.every((decision) => decision === "requires_metadata_review" || decision === "not_applicable"),
      "metadata incomplete observations should not be treated as hard block or collapsed"
    );
  } else {
    assert(
      artifact.limitations.includes("metadataIncomplete:not_observed_in_pure_engine_replay"),
      "unobserved metadata incomplete gap should be recorded as a limitation"
    );
  }
}

function assertNoForbiddenFileChanges() {
  const phase39Guard = execFileSync(process.execPath, ["scripts/verify-shadow-dry-run-route-static-guard.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  assert(phase39Guard.includes("verify-shadow-dry-run-route-static-guard passed"));
  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const changedFiles = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  for (const file of FORBIDDEN_RUNTIME_FILES) {
    if (file === "app/api/analyze/route.js") {
      continue;
    }
    assert(!changedFiles.includes(file), `${file} should not be modified by readonly replay`);
  }

  assert(changedFiles.every((file) => !file.startsWith("data/")), "product data source files should not be modified");
  assert(changedFiles.every((file) => !file.startsWith("supabase/")), "Supabase files should not be modified");
}

function main() {
  const first = runReplay();
  assertReplayContract(first);
  assertScenarioContract(first);
  assertCoverageSafety(first);
  assertNoLeakage(first);
  assertNoForbiddenFileChanges();

  const second = runReplay();
  assert.deepEqual(
    stripVolatile(first),
    stripVolatile(second),
    "readonly pure engine replay output should be deterministic apart from generatedAt"
  );

  console.log("verify-pure-engine-replay-readonly-source passed");
}

main();
