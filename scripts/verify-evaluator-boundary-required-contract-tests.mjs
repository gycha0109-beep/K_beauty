import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "evaluator-boundary-required-contract-tests.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "evaluator-boundary-required-contract-tests.md");
const REVIEW_DOC_PATH = path.join(ROOT, "docs", "reviews", "evaluator-boundary-required-contract-tests-20260709.md");

const REQUIRED_TESTS = [
  "metadata_incomplete_routes_to_insufficient_evidence",
  "strong_caution_preserves_hidden_or_hard_block",
  "active_only_safe_collapses_unsafe_preserves_hidden",
  "high_risk_or_sensitivity_unsafe_never_collapses",
  "serum_category_does_not_drive_exposure_by_itself",
  "actual_and_pure_replay_evidence_remain_separate",
  "no_api_response_shape_change",
  "no_recommendation_result_change_when_shadow_enabled",
  "no_db_write_from_shadow_dry_run",
  "no_forbidden_artifact_fields"
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
  /data:image\//i,
  /base64,[A-Za-z0-9+/=]{20,}/i,
  /"name"\s*:\s*"[^"]+"/i,
  /"brand"\s*:\s*"[^"]+"/i,
  /"buy_link"\s*:\s*"[^"]+"/i,
  /"image_url"\s*:\s*"[^"]+"/i,
  /https?:\/\/[^\s")]+/i,
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /SUPABASE_[A-Z_]*=\S+/i,
  /NEXT_PUBLIC_SUPABASE_[A-Z_]*=\S+/i,
  /"email"\s*:\s*"[^"]+"/i,
  /"cookie"\s*:\s*"[^"]+"/i,
  /"user-agent"\s*:\s*"[^"]+"/i
];

function runContractTests() {
  const stdout = execFileSync(process.execPath, ["scripts/run-evaluator-boundary-required-contract-tests.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });

  assert(stdout.includes("evaluator-boundary-required-contract-tests summary"));
  assert(existsSync(OUTPUT_PATH), "contract test JSON should exist");
  assert(existsSync(MD_OUTPUT_PATH), "contract test markdown should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return {
    ...output,
    generatedAt: "<stable>"
  };
}

function getResult(output, id) {
  return output.testResults.find((result) => result.id === id);
}

function assertContractOutput(output) {
  assert.equal(output.evidenceType, "required_contract_test_skeleton");
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.routeInvoked, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);
  assert.equal(output.syntheticContractCasesUsed, true);
  assert.equal(output.syntheticTreatedAsActualEvidence, false);
  assert.equal(output.failedCount, 0);
  assert.equal(output.passedCount, REQUIRED_TESTS.length);

  const ids = output.testResults.map((result) => result.id).sort();
  assert.deepEqual(ids, [...REQUIRED_TESTS].sort());

  for (const id of REQUIRED_TESTS) {
    assert.equal(getResult(output, id)?.passed, true, `${id} should pass`);
  }

  const metadata = getResult(output, "metadata_incomplete_routes_to_insufficient_evidence");
  assert.equal(metadata.details.futureExposureGroup, "insufficient_evidence_candidate");
  assert.notEqual(metadata.details.futureExposureGroup, "collapsed_candidate");

  const strongCaution = getResult(output, "strong_caution_preserves_hidden_or_hard_block");
  assert.notEqual(strongCaution.details.futureExposureGroup, "collapsed_candidate");

  const highRisk = getResult(output, "high_risk_or_sensitivity_unsafe_never_collapses");
  assert.notEqual(highRisk.details.highRisk.futureExposureGroup, "collapsed_candidate");
  assert.notEqual(highRisk.details.sensitivityUnsafe.futureExposureGroup, "collapsed_candidate");
  assert.notEqual(highRisk.details.highRisk.candidatePolicyHint, "collapsed_candidate_hint");
  assert.notEqual(highRisk.details.sensitivityUnsafe.candidatePolicyHint, "collapsed_candidate_hint");

  const serum = getResult(output, "serum_category_does_not_drive_exposure_by_itself");
  assert.equal(serum.details.categoryOnly.boundaryDecision, "not_applicable");
  assert.equal(serum.details.categoryOnly.futureExposureGroup, "unchanged");

  const evidence = getResult(output, "actual_and_pure_replay_evidence_remain_separate");
  assert.equal(evidence.details.syntheticTreatedAsActualEvidence, false);
  assert.notEqual(evidence.details.actualEvidenceBucket, evidence.details.pureReplayEvidenceBucket);

  assert(getResult(output, "no_api_response_shape_change"));
  assert(getResult(output, "no_recommendation_result_change_when_shadow_enabled"));
  assert(getResult(output, "no_db_write_from_shadow_dry_run"));
  assert(getResult(output, "no_forbidden_artifact_fields"));
}

function assertNoRuntimeConnections() {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");
  const page = readFileSync("app/page.js", "utf8");
  const joinedRuntime = [route, evaluator, candidatePolicy, page].join("\n");

  assert.equal(joinedRuntime.includes("shadow-runtime-dry-run-artifact-schema"), false);
  assert.equal(joinedRuntime.includes("run-evaluator-boundary-required-contract-tests"), false);
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
    assert(!changedFiles.includes(file), `${file} should not be modified by contract test skeleton`);
  }

  assert(changedFiles.every((file) => !file.startsWith("data/")), "product data source files should not be modified");
  assert(changedFiles.every((file) => !file.startsWith("supabase/")), "Supabase files should not be modified");
}

function assertNoLeakage() {
  const serialized = [
    readFileSync(OUTPUT_PATH, "utf8"),
    readFileSync(MD_OUTPUT_PATH, "utf8"),
    existsSync(REVIEW_DOC_PATH) ? readFileSync(REVIEW_DOC_PATH, "utf8") : ""
  ].join("\n");

  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    assert(!pattern.test(serialized), `contract test output leaked forbidden pattern: ${pattern}`);
  }
}

const first = runContractTests();
assertContractOutput(first);
assertNoRuntimeConnections();

const second = runContractTests();
assert.deepEqual(
  stripVolatile(first),
  stripVolatile(second),
  "contract test output should be deterministic apart from generatedAt"
);

assertNoLeakage();

console.log("verify-evaluator-boundary-required-contract-tests passed");
