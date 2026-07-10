import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "shadow-runtime-dry-run-plan.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "shadow-runtime-dry-run-plan.md");
const DRY_RUN_DOC_PATH = path.join(ROOT, "docs", "architecture", "shadow-runtime-dry-run-design.md");
const CONTRACT_TEST_DOC_PATH = path.join(ROOT, "docs", "architecture", "evaluator-boundary-required-contract-tests.md");
const REVIEW_DOC_PATH = path.join(ROOT, "docs", "reviews", "shadow-runtime-dry-run-plan-20260709.md");

const REQUIRED_CONTRACT_TESTS = [
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

const REQUIRED_FORBIDDEN_FIELDS = [
  "product_name",
  "brand",
  "purchase_url",
  "review_text",
  "raw_form",
  "image",
  "base64",
  "pii",
  "env_secret_values",
  "full_api_response_body"
];

const REQUIRED_KILL_CONDITIONS = [
  "high_risk_collapsed_receiver_count_gt_zero",
  "sensitivity_safe_false_collapsed_receiver_count_gt_zero",
  "strong_caution_collapsed_receiver_count_gt_zero",
  "metadata_incomplete_collapsed_receiver_count_gt_zero",
  "api_response_shape_change_detected",
  "top_pick_supporting_or_budget_result_change_detected",
  "db_write_detected",
  "production_flag_missing_or_misconfigured",
  "forbidden_artifact_field_detected"
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
  /base64,[A-Za-z0-9+/=]{20,}/i,
  /data:image\//i,
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

function runReview() {
  const stdout = execFileSync(process.execPath, ["scripts/review-shadow-runtime-dry-run-plan.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });

  assert(stdout.includes("shadow-runtime-dry-run-plan summary"));
  assert(existsSync(OUTPUT_PATH), "shadow dry-run plan JSON should exist");
  assert(existsSync(MD_OUTPUT_PATH), "shadow dry-run plan markdown should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return {
    ...output,
    generatedAt: "<stable>"
  };
}

function assertPlanContract(output) {
  assert.equal(output.evidenceType, "shadow_runtime_dry_run_plan");
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.routeInvoked, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);

  assert.equal(output.disabledByDefaultGate.defaultState, "off");
  assert.equal(output.disabledByDefaultGate.explicitFlagRequired, true);
  assert.equal(output.disabledByDefaultGate.productionDefault, "disabled");
  assert.equal(output.disabledByDefaultGate.apiResponseExposure, "none");
  assert.equal(output.disabledByDefaultGate.recommendationMutation, "none");
  assert.equal(output.disabledByDefaultGate.dbPersistence, "none");
  assert.equal(output.disabledByDefaultGate.envValuesPrinted, false);

  const contractTestIds = output.requiredContractTests.map((test) => test.id);
  for (const testId of REQUIRED_CONTRACT_TESTS) {
    assert(contractTestIds.includes(testId), `missing required contract test: ${testId}`);
  }

  for (const field of REQUIRED_FORBIDDEN_FIELDS) {
    assert(output.forbiddenObservationFields.includes(field), `missing forbidden observation field: ${field}`);
  }

  const killIds = output.killConditions.map((condition) => condition.id);
  for (const condition of REQUIRED_KILL_CONDITIONS) {
    assert(killIds.includes(condition), `missing kill condition: ${condition}`);
  }

  assert(output.requiredDryRunVerifiers.includes("verify_no_api_response_shape_change"));
  assert(output.requiredDryRunVerifiers.includes("verify_no_recommendation_result_change"));
  assert(output.requiredDryRunVerifiers.includes("verify_no_db_write_from_shadow_dry_run"));
  assert(output.requiredDryRunVerifiers.includes("verify_no_forbidden_artifact_fields"));
  assert(output.requiredDryRunVerifiers.includes("verify_high_risk_collapsed_receiver_count_zero"));
  assert(output.requiredDryRunVerifiers.includes("verify_metadata_incomplete_not_collapsed"));
  assert(output.requiredDryRunVerifiers.includes("verify_strong_caution_not_collapsed"));

  assert(output.baselineVsShadowComparison.requiredComparisons.includes("api_response_shape_diff"));
  assert(output.baselineVsShadowComparison.requiredComparisons.includes("recommendation_result_diff"));
  assert(output.baselineVsShadowComparison.requiredComparisons.includes("db_write_attempt_count"));
  assert.equal(output.readinessFromPhase29.acceptanceStatus, "ready_for_runtime_integration_plan");
  assert.equal(output.runtimeFileCheck.passed, true);
}

function assertNoRuntimeConnections() {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");
  const page = readFileSync("app/page.js", "utf8");
  const joinedRuntime = [route, evaluator, candidatePolicy, page].join("\n");

  assert.equal(joinedRuntime.includes("shadow-runtime-dry-run-plan"), false);
  assert.equal(joinedRuntime.includes("review-shadow-runtime-dry-run-plan"), false);

  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const changedFiles = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  for (const file of FORBIDDEN_RUNTIME_FILES) {
    assert(!changedFiles.includes(file), `${file} should not be modified by shadow dry-run plan`);
  }

  assert(changedFiles.every((file) => !file.startsWith("data/")), "product data source files should not be modified");
  assert(changedFiles.every((file) => !file.startsWith("supabase/")), "Supabase files should not be modified");
}

function assertDocs() {
  assert(existsSync(DRY_RUN_DOC_PATH), "shadow runtime dry-run architecture doc should exist");
  assert(existsSync(CONTRACT_TEST_DOC_PATH), "required contract tests doc should exist");
  assert(existsSync(REVIEW_DOC_PATH), "shadow runtime dry-run review doc should exist");

  const dryRunDoc = readFileSync(DRY_RUN_DOC_PATH, "utf8");
  const contractDoc = readFileSync(CONTRACT_TEST_DOC_PATH, "utf8");
  const reviewDoc = readFileSync(REVIEW_DOC_PATH, "utf8");

  assert(dryRunDoc.includes("shadow runtime dry-run 설계 문서"));
  assert(dryRunDoc.includes("runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다"));
  assert(dryRunDoc.includes("disabled-by-default"));
  assert(dryRunDoc.includes("kill conditions"));
  assert(contractDoc.includes("runtime 연결 전 필수 contract test 계획"));
  assert(contractDoc.includes("runtime 정책 변경 또는 테스트 구현 완료 선언이 아니다"));
  assert(contractDoc.includes("metadata_incomplete_routes_to_insufficient_evidence"));
  assert(contractDoc.includes("no_db_write_from_shadow_dry_run"));
  assert(reviewDoc.includes("Phase 29"));
  assert(reviewDoc.includes("Phase 31"));
  assert(reviewDoc.includes("runtime 미적용"));
}

function assertNoLeakage() {
  const serialized = [
    readFileSync(OUTPUT_PATH, "utf8"),
    readFileSync(MD_OUTPUT_PATH, "utf8"),
    existsSync(DRY_RUN_DOC_PATH) ? readFileSync(DRY_RUN_DOC_PATH, "utf8") : "",
    existsSync(CONTRACT_TEST_DOC_PATH) ? readFileSync(CONTRACT_TEST_DOC_PATH, "utf8") : "",
    existsSync(REVIEW_DOC_PATH) ? readFileSync(REVIEW_DOC_PATH, "utf8") : ""
  ].join("\n");

  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    assert(!pattern.test(serialized), `shadow dry-run plan leaked forbidden pattern: ${pattern}`);
  }
}

const first = runReview();
assertPlanContract(first);
assertNoRuntimeConnections();

const second = runReview();
assert.deepEqual(
  stripVolatile(first),
  stripVolatile(second),
  "shadow runtime dry-run plan output should be deterministic apart from generatedAt"
);

if (existsSync(DRY_RUN_DOC_PATH) && existsSync(CONTRACT_TEST_DOC_PATH) && existsSync(REVIEW_DOC_PATH)) {
  assertDocs();
}
assertNoLeakage();

console.log("verify-shadow-runtime-dry-run-plan passed");
