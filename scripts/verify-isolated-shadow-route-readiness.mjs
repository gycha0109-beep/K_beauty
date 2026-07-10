import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { assertNonProductionSupabaseTarget } from "./assert-non-production-supabase-target.mjs";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "isolated-shadow-route-readiness.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "isolated-shadow-route-readiness.md");
const FIXTURE_DIR = path.join(ROOT, "test", "fixtures", "analyze");
const ALLOWED_STATUSES = new Set([
  "ready_for_phase43_isolated_route_run",
  "not_ready_missing_fixture",
  "not_ready_environment_unverified",
  "not_ready_mutation_delta_unmeasurable",
  "blocked_by_production_target",
  "fixture_contract_incomplete"
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

function runPreparation() {
  const stdout = execFileSync(process.execPath, ["scripts/prepare-isolated-shadow-route-readiness.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  assert(stdout.includes("prepare-isolated-shadow-route-readiness summary"));
  assert(existsSync(OUTPUT_PATH));
  assert(existsSync(MD_OUTPUT_PATH));
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return { ...output, generatedAt: "<stable>" };
}

function assertTargetSamples() {
  const unknown = assertNonProductionSupabaseTarget({ env: {} });
  assert.equal(unknown.safeToRunRoute, false);
  assert.equal(unknown.productionBlocked, true);

  const local = assertNonProductionSupabaseTarget({
    env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }
  });
  assert.equal(local.safeToRunRoute, true);
  assert.equal(local.productionBlocked, false);

  const hostedUnknown = assertNonProductionSupabaseTarget({
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://hosted.invalid" }
  });
  assert.equal(hostedUnknown.safeToRunRoute, false);
  assert.equal(hostedUnknown.productionBlocked, true);

  const hostedAllowlisted = assertNonProductionSupabaseTarget({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://hosted.invalid",
      SHADOW_ROUTE_NON_PRODUCTION_TARGET: "1",
      SHADOW_TEST_DB_DISPOSABLE: "1",
      SHADOW_TEST_ENVIRONMENT: "test"
    }
  });
  assert.equal(hostedAllowlisted.safeToRunRoute, true);
  assert.equal(hostedAllowlisted.productionBlocked, false);
}

function assertContract(output) {
  assert.equal(output.evidenceType, "isolated_shadow_route_readiness");
  assert(ALLOWED_STATUSES.has(output.status));
  assert.equal(output.status, "blocked_by_production_target");
  assert.equal(output.routeInvoked, false);
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);
  assert.equal(output.nonProductionTarget.checked, true);
  assert.equal(output.nonProductionTarget.safeToRunRoute, false);
  assert.equal(output.nonProductionTarget.productionBlocked, true);
  assert.equal(output.nonProductionTarget.secretsPrinted, false);

  assert.equal(output.fixtureReadiness.payloadExists, true);
  assert.equal(output.fixtureReadiness.payloadJsonParseable, true);
  assert.equal(output.fixtureReadiness.missingRequiredFields.length, 0);
  assert.equal(output.fixtureReadiness.payloadReferencesFixture, true);
  assert.equal(output.fixtureReadiness.imageExists, true);
  assert.equal(output.fixtureReadiness.imageSignatureValid, true);
  assert(output.fixtureReadiness.imageByteLength > 0);
  assert.equal(output.fixtureReadiness.readmeExists, true);
  assert.equal(output.fixtureReadiness.routeRequiredFieldContractPresent, true);
  assert.equal(output.fixtureReadiness.ready, true);

  assert.equal(output.runnerReadiness.tmpOutputDirWritable, true);
  assert.equal(output.runnerReadiness.runbookExists, true);
  assert.equal(output.runnerReadiness.actualRouteExecutionPrepared, false);
  assert.equal(output.mutationDeltaReadiness.status, "not_ready");
  assert.equal(output.mutationDeltaReadiness.shadowAddedMutationDeltaMustEqualZero, true);
  assert.equal(output.mutationDeltaReadiness.existingRouteWritesAllowed, true);
}

function assertNoRouteOrProtectedChanges() {
  for (const file of [
    "app/api/analyze/route.js",
    "lib/shadow-boundary-dry-run-artifact-writer.js",
    "lib/skin-match-decision-engine.js",
    "lib/functional-ranking-contract.js",
    "lib/functional-candidate-policy.js"
  ]) {
    const diff = execFileSync("git", ["diff", "--", file], { cwd: ROOT, encoding: "utf8" });
    assert.equal(diff, "", `${file} must remain unchanged in Phase 42`);
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
  const files = [
    OUTPUT_PATH,
    MD_OUTPUT_PATH,
    path.join(FIXTURE_DIR, "README.md"),
    path.join(ROOT, "docs", "runbooks", "isolated-shadow-route-runbook-20260710.md")
  ];
  const serialized = files.map((file) => readFileSync(file, "utf8")).join("\n");
  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    assert(!pattern.test(serialized), `readiness output leaked forbidden pattern: ${pattern}`);
  }
}

assertTargetSamples();
const first = runPreparation();
assertContract(first);
assertNoRouteOrProtectedChanges();
assertNoLeakage();
const second = runPreparation();
assert.deepEqual(stripVolatile(first), stripVolatile(second), "readiness artifact should be stable apart from generatedAt");

console.log("verify-isolated-shadow-route-readiness passed");
