import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { inspectAnalyzeNoWriteBoundary } from "./inspect-analyze-no-write-boundary.mjs";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "analyze-no-write-boundary.json");

const REQUIRED_FILES = [
  "app/api/analyze/route.js",
  "lib/functional-shadow-capture.js",
  "lib/skin-match-decision-engine.js",
  "lib/product-source.js",
  "lib/security/analysis-request-guard.js",
  "lib/premium-report-session.js"
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

function stripGeneratedAt(artifact) {
  return {
    ...artifact,
    generatedAt: "<stable>"
  };
}

function assertNoForbiddenOutput(artifact) {
  const serialized = JSON.stringify(artifact);
  for (const pattern of FORBIDDEN_PATTERNS) {
    assert(!pattern.test(serialized), `boundary artifact leaked forbidden pattern: ${pattern}`);
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
      !source.includes("inspect-analyze-no-write-boundary") &&
        !source.includes("analyze-no-write-boundary"),
      `${file} should not import or reference no-write boundary inspector`
    );
  }
}

function assertArtifactContract(artifact) {
  assert.equal(artifact.runtimeMutation, false, "runtimeMutation should be false");

  for (const file of REQUIRED_FILES) {
    assert(artifact.filesInspected.includes(file), `filesInspected should include ${file}`);
  }

  assert(Array.isArray(artifact.pureAnalysisBoundary), "pureAnalysisBoundary should be an array");
  assert(artifact.pureAnalysisBoundary.length >= 4, "pureAnalysisBoundary should identify route stages");
  assert(artifact.mutationBoundary, "mutationBoundary should be present");
  assert(Array.isArray(artifact.mutationCalls), "mutationCalls should be an array");
  assert(artifact.mutationCalls.length > 0, "mutationCalls should not be empty");
  assert(
    artifact.mutationCalls.some((item) => item.label === "analysis_guard_entered_before_recommendation_generation"),
    "analysis guard boundary should be identified"
  );
  assert(
    artifact.mutationCalls.some((item) => item.label === "premium_report_store_insert"),
    "premium report store insert should be identified"
  );

  assert(Array.isArray(artifact.captureInsertionCandidates), "captureInsertionCandidates should be an array");
  assert(artifact.captureInsertionCandidates.length >= 2, "at least two capture insertion candidates should exist");

  const optionIds = new Set((artifact.optionsComparison || []).map((item) => item.optionId));
  assert(optionIds.has("option_1_dev_only_no_write_analyze_capture_mode"), "option 1 should be present");
  assert(optionIds.has("option_2_pure_engine_replay_runner"), "option 2 should be present");
  assert(optionIds.has("option_3_isolated_dev_db_write_allowed_capture"), "option 3 should be present");
  assert(artifact.recommendedNextStep?.optionId, "recommendedNextStep should be present");
}

async function main() {
  execFileSync(process.execPath, ["scripts/inspect-analyze-no-write-boundary.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    env: process.env
  });

  assert(existsSync(OUTPUT_PATH), "analyze no-write boundary JSON should exist");
  const output = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
  assertArtifactContract(output);
  assertNoForbiddenOutput(output);
  assertRuntimeIsolation();

  const fixedA = await inspectAnalyzeNoWriteBoundary({ generatedAt: "2026-07-03T00:00:00.000Z" });
  const fixedB = await inspectAnalyzeNoWriteBoundary({ generatedAt: "2026-07-03T00:00:00.000Z" });
  assert.deepEqual(stripGeneratedAt(fixedA), stripGeneratedAt(fixedB), "boundary inspection should be deterministic with fixed timestamp");

  console.log("verify-analyze-no-write-boundary passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
