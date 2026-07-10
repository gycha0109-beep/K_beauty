import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "shadow-route-insertion-static-guard.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "shadow-route-insertion-static-guard.md");

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
  const stdout = execFileSync(process.execPath, ["scripts/review-shadow-route-insertion-static-guard.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  assert(stdout.includes("shadow-route-insertion-static-guard summary"));
  assert(existsSync(OUTPUT_PATH), "static guard JSON should exist");
  assert(existsSync(MD_OUTPUT_PATH), "static guard markdown should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return {
    ...output,
    generatedAt: "<stable>"
  };
}

function assertOutput(output) {
  assert.equal(output.evidenceType, "shadow_route_insertion_static_guard_review");
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.routeInvoked, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);
  assert(Array.isArray(output.filesInspected));
  assert(output.filesInspected.includes("app/api/analyze/route.js"));
  assert(Array.isArray(output.insertionPointReviews));
  assert(output.insertionPointReviews.length >= 5);
  assert.equal(output.recommendedInsertionPoint, "route_outside_helper_dev_only_artifact_writer");
  assert(output.requiredGuardrails.length >= 5);
  assert(output.prohibitedImplementationPatterns.length >= 5);
  assert(output.requiredGuardrails.includes("helper_result_not_merged_into_public_response"));
  assert(output.requiredGuardrails.includes("helper_result_not_written_to_db_or_store_payload"));
  assert(output.prohibitedImplementationPatterns.includes("append_shadow_artifact_to_api_response"));
  assert(output.prohibitedImplementationPatterns.includes("write_shadow_artifact_to_db_or_supabase"));
}

function assertNoRuntimeConnections() {
  const route = readFileSync(path.join(ROOT, "app/api/analyze/route.js"), "utf8");
  const evaluator = readFileSync(path.join(ROOT, "lib/functional-ranking-contract.js"), "utf8");
  const candidatePolicy = readFileSync(path.join(ROOT, "lib/functional-candidate-policy.js"), "utf8");
  const joinedRuntime = [route, evaluator, candidatePolicy].join("\n");
  assert.equal(joinedRuntime.includes("shadow-dry-run-snapshot-contract"), false);
  assert.equal(joinedRuntime.includes("review-shadow-route-insertion-static-guard"), false);

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
    assert(!pattern.test(serialized), `static guard output leaked forbidden value pattern: ${pattern}`);
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
  "static guard output should be deterministic apart from generatedAt"
);

console.log("verify-shadow-route-insertion-static-guard passed");
