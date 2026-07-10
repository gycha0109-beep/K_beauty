import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "final-pre-runtime-integration-checklist.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "final-pre-runtime-integration-checklist.md");

const ALLOWED_STATUSES = new Set([
  "ready_for_first_disabled_shadow_dry_run_plan",
  "needs_more_preflight_tests",
  "needs_more_route_static_review",
  "blocked_by_safety_regression",
  "blocked_by_runtime_mutation",
  "blocked_by_missing_contract"
]);

const REQUIRED_BLOCK_CONDITIONS = [
  "high_risk_collapsed_receiver_count_gt_zero",
  "metadata_incomplete_collapsed_receiver_count_gt_zero",
  "strong_caution_collapsed_receiver_count_gt_zero",
  "api_response_shape_diff",
  "top_pick_supporting_or_budget_diff",
  "db_write_count_gt_zero"
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

const FORBIDDEN_VALUE_PATTERNS = [
  /data:image\//i,
  /base64,[A-Za-z0-9+/=]{20,}/i,
  /"product_name"\s*:\s*"[^"]+"/i,
  /"productName"\s*:\s*"[^"]+"/i,
  /"name"\s*:\s*"[^"]+"/i,
  /"brand"\s*:\s*"[^"]+"/i,
  /"purchase_url"\s*:\s*"[^"]+"/i,
  /"purchaseUrl"\s*:\s*"[^"]+"/i,
  /"review_text"\s*:\s*"[^"]+"/i,
  /"reviewText"\s*:\s*"[^"]+"/i,
  /"raw_form"\s*:\s*\{/i,
  /"rawForm"\s*:\s*\{/i,
  /"image"\s*:\s*"[^"]+"/i,
  /"pii"\s*:\s*"[^"]+"/i,
  /"full_api_response_body"\s*:\s*\{/i,
  /"fullApiResponseBody"\s*:\s*\{/i,
  /"apiResponseBody"\s*:\s*\{/i,
  /"responseBody"\s*:\s*\{/i,
  /https?:\/\/[^\s")]+/i,
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /SUPABASE_[A-Z_]*=\S+/i,
  /NEXT_PUBLIC_SUPABASE_[A-Z_]*=\S+/i,
  /(?:secret|token|api[_-]?key)\s*[:=]\s*[A-Za-z0-9._-]{8,}/i
];

function runReviewScript() {
  const stdout = execFileSync(process.execPath, ["scripts/review-final-pre-runtime-integration-checklist.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  assert(stdout.includes("final-pre-runtime-integration-checklist summary"));
  assert(existsSync(OUTPUT_PATH), "final checklist JSON should exist");
  assert(existsSync(MD_OUTPUT_PATH), "final checklist markdown should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return {
    ...output,
    generatedAt: "<stable>"
  };
}

function assertOutput(output) {
  assert.equal(output.evidenceType, "final_pre_runtime_integration_checklist");
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.routeInvoked, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);
  assert(ALLOWED_STATUSES.has(output.checklistStatus), `invalid status ${output.checklistStatus}`);

  for (const section of [
    "policyReadiness",
    "contractReadiness",
    "safetyVerifierReadiness",
    "routeIsolationReadiness",
    "artifactSafetyReadiness"
  ]) {
    assert(output[section], `${section} should exist`);
    assert(Array.isArray(output[section].items), `${section}.items should exist`);
  }

  assert(Array.isArray(output.firstRuntimeDryRunAllowConditions));
  assert(output.firstRuntimeDryRunAllowConditions.length >= 10);
  assert(Array.isArray(output.blockConditions));
  assert(output.blockConditions.length >= 10);
  const blockIds = output.blockConditions.map((condition) => condition.id);
  for (const id of REQUIRED_BLOCK_CONDITIONS) {
    assert(blockIds.includes(id), `missing block condition ${id}`);
  }

  assert(Array.isArray(output.phase37AllowedScope));
  assert(Array.isArray(output.phase37ProhibitedScope));
  assert(output.phase37AllowedScope.includes("first_disabled_shadow_dry_run_plan"));
  assert(output.phase37ProhibitedScope.includes("api_analyze_route_change"));
  assert(output.phase37ProhibitedScope.includes("evaluator_runtime_connection"));
  assert(output.phase37ProhibitedScope.includes("candidate_policy_runtime_connection"));
  assert(output.phase37ProhibitedScope.includes("db_or_supabase_write"));
}

function assertNoRuntimeConnections() {
  const route = readFileSync(path.join(ROOT, "app/api/analyze/route.js"), "utf8");
  const evaluator = readFileSync(path.join(ROOT, "lib/functional-ranking-contract.js"), "utf8");
  const candidatePolicy = readFileSync(path.join(ROOT, "lib/functional-candidate-policy.js"), "utf8");
  const joinedRuntime = [route, evaluator, candidatePolicy].join("\n");
  assert.equal(joinedRuntime.includes("review-final-pre-runtime-integration-checklist"), false);
  assert.equal(joinedRuntime.includes("final-pre-runtime-integration-checklist"), false);

  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const changedFiles = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  for (const file of FORBIDDEN_RUNTIME_FILES) {
    assert(!changedFiles.includes(file), `${file} should not be modified`);
  }
  assert(changedFiles.every((file) => !file.startsWith("data/")), "product data files should not be modified");
  assert(changedFiles.every((file) => !file.startsWith("supabase/")), "Supabase files should not be modified");
}

function assertNoLeakage() {
  const serialized = [readFileSync(OUTPUT_PATH, "utf8"), readFileSync(MD_OUTPUT_PATH, "utf8")].join("\n");
  for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
    assert(!pattern.test(serialized), `final checklist output leaked forbidden value pattern: ${pattern}`);
  }
}

const first = runReviewScript();
assertOutput(first);
assertNoRuntimeConnections();
assertNoLeakage();

const second = runReviewScript();
assert.deepEqual(
  stripVolatile(first),
  stripVolatile(second),
  "final checklist output should be deterministic apart from generatedAt"
);

console.log("verify-final-pre-runtime-integration-checklist passed");
