import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "first-disabled-shadow-dry-run-plan.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "first-disabled-shadow-dry-run-plan.md");

const REQUIRED_KILL_CRITERIA = [
  "api_response_shape_diff",
  "top_pick_supporting_or_budget_diff",
  "db_write_count_gt_zero",
  "high_risk_collapsed_receiver_count_gt_zero",
  "metadata_incomplete_collapsed_receiver_count_gt_zero",
  "strong_caution_collapsed_receiver_count_gt_zero",
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
  const stdout = execFileSync(process.execPath, ["scripts/review-first-disabled-shadow-dry-run-plan.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  assert(stdout.includes("first-disabled-shadow-dry-run-plan summary"));
  assert(existsSync(OUTPUT_PATH), "first dry-run plan JSON should exist");
  assert(existsSync(MD_OUTPUT_PATH), "first dry-run plan markdown should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return {
    ...output,
    generatedAt: "<stable>"
  };
}

function assertPlan(output) {
  assert.equal(output.evidenceType, "first_disabled_shadow_dry_run_plan");
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.routeInvoked, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);
  assert(Array.isArray(output.preflightChecklist));
  assert(output.preflightChecklist.length >= 12);
  assert(Array.isArray(output.firstDryRunRunbook));
  assert(output.firstDryRunRunbook.length >= 10);
  assert(Array.isArray(output.snapshotRequirements));
  assert(output.snapshotRequirements.length >= 8);
  assert(Array.isArray(output.killCriteria));
  assert(output.killCriteria.length >= 10);
  assert(Array.isArray(output.rollbackPlan));
  assert(output.rollbackPlan.length >= 6);
  assert(Array.isArray(output.phase38AllowedScope));
  assert(Array.isArray(output.phase38ProhibitedScope));

  const killIds = output.killCriteria.map((entry) => entry.id);
  for (const id of REQUIRED_KILL_CRITERIA) {
    assert(killIds.includes(id), `missing kill criterion ${id}`);
  }

  const snapshotIds = output.snapshotRequirements.map((entry) => entry.id);
  for (const id of [
    "baselineResponseShapeSnapshot",
    "baselineRecommendationSnapshot",
    "shadowBoundaryHintSnapshot",
    "shadowReceiverSnapshot",
    "comparisonSnapshot",
    "dbWriteSummary",
    "forbiddenFieldScanSummary",
    "killConditionSummary"
  ]) {
    assert(snapshotIds.includes(id), `missing snapshot requirement ${id}`);
  }

  assert(output.phase38AllowedScope.includes("first_disabled_shadow_dry_run_implementation_patch_plan"));
  assert(output.phase38ProhibitedScope.includes("actual_route_change"));
  assert(output.phase38ProhibitedScope.includes("evaluator_runtime_connection"));
  assert(output.phase38ProhibitedScope.includes("candidate_policy_runtime_connection"));
  assert(output.phase38ProhibitedScope.includes("api_response_change"));
  assert(output.phase38ProhibitedScope.includes("recommendation_result_change"));
  assert(output.phase38ProhibitedScope.includes("db_or_supabase_change"));
}

function assertNoRuntimeConnections() {
  const route = readFileSync(path.join(ROOT, "app/api/analyze/route.js"), "utf8");
  const evaluator = readFileSync(path.join(ROOT, "lib/functional-ranking-contract.js"), "utf8");
  const candidatePolicy = readFileSync(path.join(ROOT, "lib/functional-candidate-policy.js"), "utf8");
  const joinedRuntime = [route, evaluator, candidatePolicy].join("\n");
  assert.equal(joinedRuntime.includes("review-first-disabled-shadow-dry-run-plan"), false);
  assert.equal(joinedRuntime.includes("first-disabled-shadow-dry-run-plan"), false);
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
    assert(!changedFiles.includes(file), `${file} should not be modified`);
  }
  assert(changedFiles.every((file) => !file.startsWith("data/")), "product data files should not be modified");
  assert(changedFiles.every((file) => !file.startsWith("supabase/")), "Supabase files should not be modified");
}

function assertNoLeakage() {
  const serialized = [readFileSync(OUTPUT_PATH, "utf8"), readFileSync(MD_OUTPUT_PATH, "utf8")].join("\n");
  for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
    assert(!pattern.test(serialized), `first dry-run plan output leaked forbidden value pattern: ${pattern}`);
  }
}

const first = runReviewScript();
assertPlan(first);
assertNoRuntimeConnections();
assertNoLeakage();

const second = runReviewScript();
assert.deepEqual(
  stripVolatile(first),
  stripVolatile(second),
  "first dry-run plan output should be deterministic apart from generatedAt"
);

console.log("verify-first-disabled-shadow-dry-run-plan passed");
