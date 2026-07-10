import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "first-isolated-shadow-route-check.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "first-isolated-shadow-route-check.md");
const ALLOWED_STATUSES = new Set([
  "isolated_flag_on_route_run_pass",
  "isolated_route_run_not_executed_environment_unverified",
  "blocked_by_response_regression",
  "blocked_by_recommendation_regression",
  "blocked_by_shadow_db_mutation",
  "blocked_by_artifact_safety_violation"
]);
const FORBIDDEN_OUTPUT_PATTERNS = [
  /data:image\//i,
  /base64,[A-Za-z0-9+/=]{20,}/i,
  /"productName"\s*:\s*"[^"]+"/i,
  /"brand"\s*:\s*"[^"]+"/i,
  /"purchaseUrl"\s*:\s*"[^"]+"/i,
  /"reviewText"\s*:\s*"[^"]+"/i,
  /"rawForm"\s*:\s*\{/i,
  /"imageUrl"\s*:\s*"[^"]+"/i,
  /"pii"\s*:\s*"[^"]+"/i,
  /"fullApiResponseBody"\s*:\s*\{/i,
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /https?:\/\/[^\s")]+/i,
  /SUPABASE_[A-Z_]*=\S+/i,
  /NEXT_PUBLIC_SUPABASE_[A-Z_]*=\S+/i,
  /(?:secret|token|api[_-]?key)\s*[:=]\s*[A-Za-z0-9._-]{8,}/i
];

function runCheck() {
  const stdout = execFileSync(process.execPath, ["scripts/run-first-isolated-shadow-route-check.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  assert(stdout.includes("first-isolated-shadow-route-check summary"));
  assert(existsSync(OUTPUT_PATH));
  assert(existsSync(MD_OUTPUT_PATH));
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return { ...output, generatedAt: "<stable>" };
}

function assertContract(output) {
  assert.equal(output.evidenceType, "first_isolated_shadow_route_check");
  assert(ALLOWED_STATUSES.has(output.status));
  assert.equal(output.status, "isolated_route_run_not_executed_environment_unverified");
  assert.equal(output.routeInvoked, false);
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);
  assert.equal(output.skipReason, "isolated_route_run_not_executed_environment_unverified");
  assert.equal(output.environmentVerification.allRequiredConditionsVerified, false);
  assert.equal(output.environmentVerification.envValuesPrinted, false);
  assert.equal(output.environmentVerification.secretValuesPrinted, false);

  const gates = output.environmentVerification;
  assert(
    [
      gates.supabase.verifiedNonProduction,
      gates.disposableEnvironment.verified,
      gates.safeFixture.verified,
      gates.identicalInputReplay.verified,
      gates.mutationDeltaMeasurement.verified,
      gates.cleanupAndRollback.verified
    ].some((value) => value === false),
    "at least one execution gate must be unverified when route execution is skipped"
  );

  assert.equal(output.flagOffBaseline.attempted, false);
  assert.equal(output.flagOnDryRun.attempted, false);
  assert.equal(output.artifactVerification.attempted, false);
  assert.equal(output.comparison.responseShapeChanged, null);
  assert.equal(output.comparison.topPickChanged, null);
  assert.equal(output.shadowAddedDbMutationDelta, null);
  assert.equal(output.existingRouteMutationCount, null);
  assert.equal(output.environmentVerification.safeFixture.userImageUsed, false);
  assert(Object.values(output.safetyViolationCounts).every((value) => value === null));
  assert(Array.isArray(output.limitations) && output.limitations.length >= 4);
}

function assertNoProtectedRuntimeChanges() {
  for (const file of [
    "app/api/analyze/route.js",
    "lib/shadow-boundary-dry-run-helper.js",
    "lib/shadow-boundary-dry-run-artifact-writer.js",
    "lib/skin-match-decision-engine.js",
    "lib/functional-ranking-contract.js",
    "lib/functional-candidate-policy.js"
  ]) {
    const diff = execFileSync("git", ["diff", "--", file], { cwd: ROOT, encoding: "utf8" });
    assert.equal(diff, "", `${file} must remain unchanged in Phase 41`);
  }

  const changedFiles = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8"
  })
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  assert(changedFiles.every((file) => !file.startsWith("data/")));
  assert(changedFiles.every((file) => !file.startsWith("supabase/")));
}

function assertNoLeakage() {
  const serialized = [readFileSync(OUTPUT_PATH, "utf8"), readFileSync(MD_OUTPUT_PATH, "utf8")].join("\n");
  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    assert(!pattern.test(serialized), `isolated route check leaked forbidden pattern: ${pattern}`);
  }
}

const first = runCheck();
assertContract(first);
assertNoProtectedRuntimeChanges();
assertNoLeakage();

const second = runCheck();
assert.deepEqual(stripVolatile(first), stripVolatile(second), "route check output should be stable apart from generatedAt");

console.log("verify-first-isolated-shadow-route-check passed");
