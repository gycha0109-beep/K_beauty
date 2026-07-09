import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "runtime-integration-acceptance-criteria.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "runtime-integration-acceptance-criteria.md");
const ARCHITECTURE_DOC_PATH = path.join(ROOT, "docs", "architecture", "runtime-integration-acceptance-criteria.md");
const REVIEW_DOC_PATH = path.join(ROOT, "docs", "reviews", "runtime-integration-acceptance-review-20260709.md");
const ALLOWED_STATUSES = [
  "ready_for_runtime_integration_plan",
  "ready_for_shadow_runtime_dry_run_only",
  "needs_more_contract_tests",
  "needs_more_evidence",
  "blocked_by_safety_regression",
  "blocked_by_runtime_mutation"
];
const READY_STATUSES = new Set([
  "ready_for_runtime_integration_plan",
  "ready_for_shadow_runtime_dry_run_only"
]);
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
  /purchase\s*url/i,
  /review\s*text/i,
  /oliveyoung/i,
  /email/i,
  /cookie/i,
  /user-agent/i,
  /user agent/i,
  /Bearer\s+[A-Za-z0-9._-]+/i
];

function runReview() {
  const stdout = execFileSync(process.execPath, ["scripts/review-runtime-integration-acceptance-criteria.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });

  assert(stdout.includes("runtime-integration-acceptance-criteria summary"));
  assert(existsSync(OUTPUT_PATH), "acceptance JSON should exist");
  assert(existsSync(MD_OUTPUT_PATH), "acceptance markdown should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return {
    ...output,
    generatedAt: "<stable>"
  };
}

function assertAcceptanceContract(output) {
  assert.equal(output.evidenceType, "runtime_integration_acceptance_review");
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.routeInvoked, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);
  assert(ALLOWED_STATUSES.includes(output.acceptanceStatus), "acceptanceStatus must be an allowed value");

  const highRiskCounts = [
    output.safetyRegressionGate?.details?.actualHighRiskCollapsedHints,
    output.safetyRegressionGate?.details?.pureHighRiskCollapsedHints,
    output.safetyRegressionGate?.details?.actualHighRiskCollapsedReceivers,
    output.safetyRegressionGate?.details?.pureHighRiskCollapsedReceivers
  ].map((value) => Number(value || 0));
  if (highRiskCounts.some((value) => value > 0)) {
    assert(!READY_STATUSES.has(output.acceptanceStatus), "ready status is invalid with high-risk collapsed counts");
  }

  assert.equal(output.gateResults.gateA_safetyRegression.status, "pass");
  assert.equal(output.gateResults.gateB_lowRiskConsistency.status, "pass");
  assert.equal(output.gateResults.gateC_evidenceSeparation.status, "pass");
  assert.equal(output.gateResults.gateD_serumCategory.status, "pass");
  assert.equal(output.gateResults.gateE_metadataIncomplete.status, "conditional");
  assert.equal(output.gateResults.gateF_strongCaution.status, "conditional");
  assert.equal(output.gateResults.gateG_activeOnly.status, "conditional");
  assert.equal(output.gateResults.gateH_runtimeIsolation.status, "pass");

  assert.equal(output.evidenceSeparationGate.details.syntheticCoverageRecordedAsActual, false);
  assert.equal(output.gateResults.gateE_metadataIncomplete.details.requiredContractTest, "metadata_incomplete_routes_to_insufficient_evidence");
  assert.equal(output.gateResults.gateF_strongCaution.details.requiredContractTest, "strong_caution_preserves_hidden_or_hard_block");
  assert.equal(output.gateResults.gateG_activeOnly.details.requiredContractTest, "active_only_safe_collapses_unsafe_preserves_hidden");
  assert(output.requiredContractTestsBeforeRuntime.includes("metadata_incomplete_routes_to_insufficient_evidence"));
  assert(output.requiredContractTestsBeforeRuntime.includes("strong_caution_preserves_hidden_or_hard_block"));
  assert(output.requiredContractTestsBeforeRuntime.includes("active_only_safe_collapses_unsafe_preserves_hidden"));
  assert(output.requiredShadowDryRunBeforeRuntime.some((item) => item.includes("shadow_runtime_dry_run")));
  assert(output.prohibitedNextStep.includes("connect_evaluator_runtime"));
  assert(output.prohibitedNextStep.includes("connect_candidate_policy_runtime"));
}

function assertDocs() {
  assert(existsSync(ARCHITECTURE_DOC_PATH), "runtime acceptance architecture doc should exist");
  assert(existsSync(REVIEW_DOC_PATH), "runtime acceptance review doc should exist");

  const architecture = readFileSync(ARCHITECTURE_DOC_PATH, "utf8");
  const review = readFileSync(REVIEW_DOC_PATH, "utf8");

  assert(architecture.includes("runtime integration acceptance criteria"));
  assert(architecture.includes("runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다"));
  assert(architecture.includes("Gate A"));
  assert(architecture.includes("Phase 30"));
  assert(review.includes("acceptanceStatus"));
  assert(review.includes("ready for a runtime integration plan"));
  assert(review.includes("Required contract tests"));
  assert(review.includes("Still prohibited"));
}

function assertNoLeakage() {
  const serialized = [
    readFileSync(OUTPUT_PATH, "utf8"),
    readFileSync(MD_OUTPUT_PATH, "utf8"),
    existsSync(ARCHITECTURE_DOC_PATH) ? readFileSync(ARCHITECTURE_DOC_PATH, "utf8") : "",
    existsSync(REVIEW_DOC_PATH) ? readFileSync(REVIEW_DOC_PATH, "utf8") : ""
  ].join("\n");

  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    assert(!pattern.test(serialized), `acceptance output leaked forbidden pattern: ${pattern}`);
  }
}

function assertNoRuntimeConnections() {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");
  const page = readFileSync("app/page.js", "utf8");
  const joinedRuntime = [route, evaluator, candidatePolicy, page].join("\n");

  assert.equal(joinedRuntime.includes("runtime-integration-acceptance-criteria"), false);
  assert.equal(joinedRuntime.includes("review-runtime-integration-acceptance-criteria"), false);

  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const changedFiles = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  for (const file of FORBIDDEN_RUNTIME_FILES) {
    assert(!changedFiles.includes(file), `${file} should not be modified by acceptance criteria review`);
  }

  assert(changedFiles.every((file) => !file.startsWith("data/")), "product data source files should not be modified");
  assert(changedFiles.every((file) => !file.startsWith("supabase/")), "Supabase files should not be modified");
}

const first = runReview();
assertAcceptanceContract(first);
assertNoRuntimeConnections();

const second = runReview();
assert.deepEqual(
  stripVolatile(first),
  stripVolatile(second),
  "acceptance review output should be deterministic apart from generatedAt"
);

if (existsSync(ARCHITECTURE_DOC_PATH) && existsSync(REVIEW_DOC_PATH)) {
  assertDocs();
}
assertNoLeakage();

console.log("verify-runtime-integration-acceptance-criteria passed");
