import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "shadow-flag-invariance-preflight.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "shadow-flag-invariance-preflight.md");
const ROUTE_PATH = path.join(ROOT, "app", "api", "analyze", "route.js");
const WRITER_PATH = path.join(ROOT, "lib", "shadow-boundary-dry-run-artifact-writer.js");
const ALLOWED_STATUSES = new Set([
  "ready_for_isolated_local_flag_on_run",
  "flag_on_run_verified_in_isolated_environment",
  "needs_verifier_hardening",
  "blocked_by_invariance_regression",
  "blocked_by_unsafe_execution_environment"
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
  /SUPABASE_[A-Z_]*=\S+/i,
  /NEXT_PUBLIC_SUPABASE_[A-Z_]*=\S+/i,
  /(?:secret|token|api[_-]?key)\s*[:=]\s*[A-Za-z0-9._-]{8,}/i
];

function runReview() {
  const routeBefore = readFileSync(ROUTE_PATH, "utf8");
  const writerBefore = readFileSync(WRITER_PATH, "utf8");
  const stdout = execFileSync(process.execPath, ["scripts/review-shadow-flag-invariance-preflight.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  assert(stdout.includes("shadow-flag-invariance-preflight summary"));
  assert.equal(readFileSync(ROUTE_PATH, "utf8"), routeBefore, "preflight must not modify the route");
  assert.equal(readFileSync(WRITER_PATH, "utf8"), writerBefore, "preflight must not modify the writer");
  assert(existsSync(OUTPUT_PATH));
  assert(existsSync(MD_OUTPUT_PATH));
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return { ...output, generatedAt: "<stable>" };
}

function assertContract(output) {
  assert.equal(output.evidenceType, "shadow_flag_invariance_preflight");
  assert.equal(output.routePatched, true);
  assert.equal(output.routeInvoked, false);
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);
  assert(ALLOWED_STATUSES.has(output.preflightStatus));
  assert.equal(output.preflightStatus, "ready_for_isolated_local_flag_on_run");

  assert.equal(output.flagOffInvariance.allDisabledCasesPassed, true);
  assert.equal(output.flagOffInvariance.guardReturnsBeforeDynamicImport, true);
  assert.equal(output.flagOffInvariance.helperOrWriterAttemptedCount, 0);
  assert.equal(output.flagOffInvariance.artifactFileCountDelta, 0);
  assert.equal(output.flagOffInvariance.responseOrStoreMutationPathDetected, false);
  const disabledIds = new Set(output.flagOffInvariance.cases.map((item) => item.id));
  for (const id of [
    "env_missing",
    "flag_zero",
    "flag_false",
    "flag_empty",
    "production_flag_one",
    "development_flag_true_not_exact"
  ]) {
    assert(disabledIds.has(id), `missing flag-off case: ${id}`);
  }
  assert(output.flagOffInvariance.cases.every((item) => item.disabled === true));

  assert.equal(output.flagOnHelperInvariance.developmentExplicitFlagEnabled, true);
  assert.equal(output.flagOnHelperInvariance.sanitizedArtifactWritten, true);
  assert.equal(output.flagOnHelperInvariance.artifactWriterLocalOnly, true);
  assert.equal(output.flagOnHelperInvariance.outputBoundaryEscapeBlocked, true);
  assert.equal(output.flagOnHelperInvariance.schemaValidationPassed, true);
  assert.equal(output.flagOnHelperInvariance.snapshotValidationPassed, true);
  assert.equal(output.flagOnHelperInvariance.forbiddenFieldWriteBlocked, true);
  assert.equal(output.flagOnHelperInvariance.writerFailureNonBlocking, true);
  assert.equal(output.flagOnHelperInvariance.responseSnapshotInputMutated, false);
  assert.equal(output.flagOnHelperInvariance.recommendationSnapshotInputMutated, false);
  assert.equal(output.flagOnHelperInvariance.supabaseClientOrMutationCallDetected, false);

  assert.equal(output.shadowAddedDbMutationCount, 0);
  assert.equal(output.responseMutationDetected, false);
  assert.equal(output.recommendationMutationDetected, false);
  assert.equal(output.artifactWriterLocalOnly, true);
  assert.equal(output.verifierIntegrity.passed, true);
  assert.equal(output.verifierIntegrity.detectedCount, 10);
  assert.equal(output.verifierIntegrity.totalCount, 10);
  assert.equal(output.verifierIntegrity.sourceFilesMutated, false);
  assert.equal(output.negativeControlResults.length, 10);
  assert(output.negativeControlResults.every((item) => item.detected && item.verifierRejected));

  assert.equal(output.actualRouteExecution.executed, false);
  assert.equal(
    output.actualRouteExecution.skipReason,
    "actual_route_execution_not_run_unsafe_or_unverified_environment"
  );
  assert.equal(output.actualRouteExecution.envValuesInspectedOrPrinted, false);
}

function assertProtectedFilesUnchanged() {
  for (const file of [
    "lib/skin-match-decision-engine.js",
    "lib/functional-ranking-contract.js",
    "lib/functional-candidate-policy.js"
  ]) {
    const diff = execFileSync("git", ["diff", "--", file], { cwd: ROOT, encoding: "utf8" });
    assert.equal(diff, "", `${file} must remain unchanged`);
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
    assert(!pattern.test(serialized), `preflight artifact leaked forbidden pattern: ${pattern}`);
  }
}

const integrityOutput = execFileSync(process.execPath, ["scripts/verify-shadow-verifier-integrity.mjs"], {
  cwd: ROOT,
  encoding: "utf8",
  env: process.env
});
assert(integrityOutput.includes("verify-shadow-verifier-integrity passed"));

const staticGuardOutput = execFileSync(process.execPath, ["scripts/verify-shadow-dry-run-route-static-guard.mjs"], {
  cwd: ROOT,
  encoding: "utf8",
  env: process.env
});
assert(staticGuardOutput.includes("verify-shadow-dry-run-route-static-guard passed"));

const first = runReview();
assertContract(first);
assertProtectedFilesUnchanged();
assertNoLeakage();

const second = runReview();
assert.deepEqual(stripVolatile(first), stripVolatile(second), "preflight output should be stable apart from generatedAt");

console.log("verify-shadow-flag-invariance-preflight passed");
