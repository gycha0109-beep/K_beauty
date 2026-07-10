import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "read-only-scorer-compatible-product-source.json");
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
  /brand name/i,
  /purchase/i,
  /review text/i,
  /email/i,
  /cookie/i,
  /user-agent/i,
  /user agent/i
];

function runInspection() {
  execFileSync(process.execPath, ["scripts/inspect-read-only-scorer-compatible-product-source.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    env: process.env
  });
  assert(existsSync(OUTPUT_PATH), "read-only scorer source output JSON should exist");
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
    assert(!pattern.test(serialized), `read-only scorer source output leaked forbidden pattern: ${pattern}`);
  }
}

function assertRuntimeIsolation() {
  const guardedFiles = [
    "app/api/analyze/route.js",
    "lib/skin-match-decision-engine.js",
    "lib/functional-ranking-contract.js",
    "lib/functional-candidate-policy.js"
  ];

  for (const file of guardedFiles) {
    const source = readFileSync(path.join(ROOT, file), "utf8");
    assert(
      !source.includes("inspect-read-only-scorer-compatible-product-source") &&
        !source.includes("read-only-scorer-compatible-product-source"),
      `${file} should not import or reference Phase 23 inspection`
    );
  }
}

function assertArtifactContract(artifact) {
  assert.equal(
    artifact.extractionVersion,
    "read-only-scorer-compatible-product-source-v1",
    "unexpected extraction version"
  );
  assert.equal(artifact.evidenceType, "read_only_scorer_compatible_product_source");
  assert.equal(artifact.routeInvoked, false);
  assert.equal(artifact.apiAnalyzeInvoked, false);
  assert.equal(artifact.supabaseWriteExecuted, false);
  assert.equal(artifact.runtimeMutation, false);
  assert.equal(artifact.syntheticProductsUsed, false);

  assert(["available", "unavailable"].includes(artifact.productSourceSummary?.status));
  assert.equal(artifact.productSourceSummary?.sourceMode, "getRecommendationProducts_read_only");
  assert(Array.isArray(artifact.scorerProductContract?.requiredForScorerCompatibility));
  assert(
    artifact.scorerProductContract.requiredForScorerCompatibility.length >= 4,
    "scorer product contract should document required fields"
  );
}

function assertScenarioContract(artifact) {
  if (artifact.productSourceSummary.status === "available") {
    const scenarioIds = new Set((artifact.scenarioResults || []).map((scenario) => scenario.scenarioId));

    for (const scenarioId of REQUIRED_SCENARIOS) {
      assert(scenarioIds.has(scenarioId), `missing target scenario result: ${scenarioId}`);
    }

    assert.equal(artifact.scenarioSummary.scenariosAttempted, REQUIRED_SCENARIOS.length);
    assert.equal(
      artifact.scenarioSummary.scenariosSucceeded + artifact.scenarioSummary.scenariosFailed,
      artifact.scenarioSummary.scenariosAttempted
    );
    assert(
      artifact.productSourceSummary.totalRows >= artifact.productSourceSummary.scorerCompatibleCount,
      "compatible count should not exceed total rows"
    );
    return;
  }

  assert.equal(artifact.productSourceSummary.totalRows, 0);
  assert.equal(artifact.scenarioSummary.scenariosAttempted, 0);
  assert(
    artifact.limitations.some((item) => item.startsWith("product_source_unavailable:")),
    "unavailable source should be recorded as a limitation"
  );
}

function main() {
  const first = runInspection();
  assertArtifactContract(first);
  assertScenarioContract(first);
  assertNoLeakage(first);
  assertRuntimeIsolation();

  const second = runInspection();
  assert.deepEqual(
    stripGeneratedAt(first),
    stripGeneratedAt(second),
    "read-only scorer source inspection should be deterministic apart from generatedAt"
  );

  console.log("verify-read-only-scorer-compatible-product-source passed");
}

main();
