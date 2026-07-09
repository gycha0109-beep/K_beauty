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

const FORBIDDEN_PATTERNS = [
  /base64/i,
  /raw form/i,
  /product name/i,
  /brand/i,
  /purchase/i,
  /review text/i,
  /email/i,
  /cookie/i,
  /user-agent/i,
  /user agent/i
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

function stripGeneratedAt(artifact) {
  return {
    ...artifact,
    generatedAt: "<stable>"
  };
}

function assertNoLeakage(artifact) {
  const serialized = JSON.stringify(artifact);
  for (const pattern of FORBIDDEN_PATTERNS) {
    assert(!pattern.test(serialized), `pure engine replay output leaked forbidden pattern: ${pattern}`);
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
      !source.includes("run-pure-engine-target-scenario-replay") &&
        !source.includes("evaluator-boundary-pure-engine-target-replay"),
      `${file} should not import or reference pure engine replay`
    );
  }
}

function assertReplayContract(artifact) {
  assert.equal(artifact.evidenceType, "pure_engine_replay", "evidenceType should be pure_engine_replay");
  assert.equal(artifact.routeInvoked, false, "routeInvoked should be false");
  assert.equal(artifact.supabaseWriteExecuted, false, "supabaseWriteExecuted should be false");
  assert.equal(artifact.runtimeMutation, false, "runtimeMutation should be false");
  assert.equal(artifact.envValuesPrinted, false, "env values should not be printed");
  assert.equal(artifact.productSource, "getRecommendationProducts_read_only", "read-only product source should be used");
  assert(Number.isInteger(artifact.productRowsLoaded), "productRowsLoaded should be recorded");
  assert(Number.isInteger(artifact.scorerCompatibleRows), "scorerCompatibleRows should be recorded");
  assert.equal(artifact.productSourceSummary?.syntheticProductsUsed, false, "synthetic products should not be used");
  assert.equal(artifact.productSourceSummary?.routeInvoked, false, "product source summary should not claim route invocation");
  assert.equal(artifact.productSourceSummary?.replayFallbackProductCount, 0, "sanitized capture fallback rows should not be mixed into Phase 25 replay");
  assert.equal(artifact.productSourceSummary?.source, "getRecommendationProducts_read_only", "product source summary should identify read-only source");

  const scenarioIds = new Set((artifact.scenarioResults || []).map((scenario) => scenario.scenarioId));
  for (const scenarioId of REQUIRED_SCENARIOS) {
    assert(scenarioIds.has(scenarioId), `missing target scenario result: ${scenarioId}`);
  }

  assert.equal(artifact.scenariosAttempted, REQUIRED_SCENARIOS.length, "all target scenarios should be attempted");
  assert.equal(
    artifact.scenariosSucceeded + artifact.scenariosFailed,
    artifact.scenariosAttempted,
    "scenario success/failure counts should add up"
  );

  for (const scenario of artifact.scenarioResults) {
    assert(["succeeded", "failed"].includes(scenario.status), `invalid scenario status: ${scenario.status}`);
    assert(Number.isInteger(scenario.productRowsLoaded), "scenario should record productRowsLoaded");
    assert(Number.isInteger(scenario.scorerCompatibleRows), "scenario should record scorerCompatibleRows");
    assert(Number.isInteger(scenario.candidateRows), "scenario should record candidateRows");
    assert(Number.isInteger(scenario.boundaryApplicableRows), "scenario should record boundaryApplicableRows");
    if (scenario.status === "failed") {
      assert(scenario.failureReason, "failed scenario should have a failureReason");
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
  }
}

function main() {
  const first = runReplay();
  assertReplayContract(first);
  assertCoverageSafety(first);
  assertNoLeakage(first);
  assertRuntimeIsolation();

  const second = runReplay();
  assert.deepEqual(stripGeneratedAt(first), stripGeneratedAt(second), "pure engine replay output should be deterministic apart from generatedAt");

  console.log("verify-pure-engine-target-scenario-replay passed");
}

main();
