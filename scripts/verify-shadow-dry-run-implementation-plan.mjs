import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "shadow-dry-run-implementation-plan.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "shadow-dry-run-implementation-plan.md");

const ALLOWED_PHASE_34_SCOPES = [
  "dry_run_snapshot_contract_helper_design",
  "future_flag_contract_documentation",
  "snapshot_schema_backed_no_response_no_recommendation_no_db_verifier_refinement",
  "route_insertion_point_static_guard_review"
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
  "env_value",
  "secret_value",
  "full_api_response_body"
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
  const stdout = execFileSync(process.execPath, ["scripts/review-shadow-dry-run-implementation-plan.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  assert(stdout.includes("shadow-dry-run-implementation-plan summary"));
  assert(existsSync(OUTPUT_PATH), "implementation plan JSON should exist");
  assert(existsSync(MD_OUTPUT_PATH), "implementation plan markdown should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return {
    ...output,
    generatedAt: "<stable>"
  };
}

function assertPlan(output) {
  assert.equal(output.evidenceType, "shadow_dry_run_implementation_plan");
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.routeInvoked, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);

  assert(output.featureFlagPlan, "featureFlagPlan should exist");
  assert.equal(output.featureFlagPlan.defaultState, "off");
  assert.equal(output.featureFlagPlan.flagValuePrinted, false);
  assert.equal(output.featureFlagPlan.apiResponseMutationAllowed, false);
  assert.equal(output.featureFlagPlan.recommendationMutationAllowed, false);
  assert.equal(output.featureFlagPlan.dbWriteAllowed, false);

  assert(Array.isArray(output.routeInsertionPointCandidates));
  assert(output.routeInsertionPointCandidates.length >= 3);
  assert(output.recommendedInsertionPoint?.id, "recommendedInsertionPoint should exist");
  assert(output.routeInsertionPointCandidates.some((candidate) => candidate.id === output.recommendedInsertionPoint.id));

  assert(output.snapshotContractPlan?.requiredSnapshots?.length >= 5);
  assert(output.snapshotContractPlan.requiredSnapshots.some((snapshot) => snapshot.id === "baselineResponseShapeSnapshot"));
  assert(output.snapshotContractPlan.requiredSnapshots.some((snapshot) => snapshot.id === "baselineRecommendationSnapshot"));
  assert(output.snapshotContractPlan.requiredSnapshots.some((snapshot) => snapshot.id === "comparisonSnapshot"));

  assert(output.artifactWritePlan, "artifactWritePlan should exist");
  assert.equal(output.artifactWritePlan.localTmpOnly, true);
  assert.equal(output.artifactWritePlan.dbPersistenceAllowed, false);

  assert(output.verifierChainPlan?.requiredVerifiers?.length >= 8);
  assert(output.verifierChainPlan.requiredVerifiers.includes("verify-shadow-no-response-change-skeleton"));
  assert(output.verifierChainPlan.requiredVerifiers.includes("verify-shadow-no-recommendation-change-skeleton"));
  assert(output.verifierChainPlan.requiredVerifiers.includes("verify-shadow-no-db-write-skeleton"));
  assert(output.verifierChainPlan.requiredVerifiers.includes("verify-shadow-runtime-dry-run-artifact-schema"));

  assert(output.killSwitchPlan?.killConditions?.length >= 4);
  assert(output.killSwitchPlan.killConditions.some((condition) => condition.id === "high_risk_violation_detected"));
  assert(output.killSwitchPlan.killConditions.some((condition) => condition.id === "response_shape_diff_detected"));
  assert(output.killSwitchPlan.killConditions.some((condition) => condition.id === "recommendation_result_diff_detected"));
  assert(output.killSwitchPlan.killConditions.some((condition) => condition.id === "db_write_detected"));

  for (const field of REQUIRED_FORBIDDEN_FIELDS) {
    assert(output.forbiddenFields.includes(field), `forbidden field missing: ${field}`);
  }

  assert.deepEqual([...output.phase34AllowedScope].sort(), [...ALLOWED_PHASE_34_SCOPES].sort());
  assert(output.phase34ProhibitedScope.includes("change_api_analyze_route"));
  assert(output.phase34ProhibitedScope.includes("connect_evaluator_runtime"));
  assert(output.phase34ProhibitedScope.includes("connect_candidate_policy_runtime"));
  assert(output.phase34ProhibitedScope.includes("change_api_response"));
  assert(output.phase34ProhibitedScope.includes("change_recommendation_results"));
  assert(output.phase34ProhibitedScope.includes("change_db_or_supabase"));
}

function assertNoRuntimeConnections() {
  const route = readFileSync(path.join(ROOT, "app/api/analyze/route.js"), "utf8");
  const evaluator = readFileSync(path.join(ROOT, "lib/functional-ranking-contract.js"), "utf8");
  const candidatePolicy = readFileSync(path.join(ROOT, "lib/functional-candidate-policy.js"), "utf8");
  const joinedRuntime = [route, evaluator, candidatePolicy].join("\n");
  assert.equal(joinedRuntime.includes("review-shadow-dry-run-implementation-plan"), false);
  assert.equal(joinedRuntime.includes("shadow-dry-run-implementation-plan"), false);
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
  assert(changedFiles.every((file) => !file.startsWith("data/")), "product data source files should not be modified");
  assert(changedFiles.every((file) => !file.startsWith("supabase/")), "Supabase files should not be modified");
}

function assertNoLeakage() {
  const serialized = [readFileSync(OUTPUT_PATH, "utf8"), readFileSync(MD_OUTPUT_PATH, "utf8")].join("\n");
  for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
    assert(!pattern.test(serialized), `implementation plan leaked forbidden value pattern: ${pattern}`);
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
  "implementation plan output should be deterministic apart from generatedAt"
);

console.log("verify-shadow-dry-run-implementation-plan passed");
