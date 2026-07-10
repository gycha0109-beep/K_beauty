import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "isolated-shadow-route-controlled-run.json");
const MD_PATH = path.join(ROOT, "tmp", "isolated-shadow-route-controlled-run.md");
const ALLOWED_STATUSES = new Set([
  "isolated_shadow_route_run_pass",
  "blocked_local_supabase_unavailable",
  "blocked_local_schema_not_reproducible",
  "blocked_external_provider_not_isolated",
  "blocked_needs_test_seam_approval",
  "blocked_fixture_contract",
  "blocked_mutation_observer_incomplete",
  "blocked_cleanup_contract",
  "blocked_response_regression",
  "blocked_recommendation_regression",
  "blocked_shadow_db_mutation",
  "blocked_shadow_storage_mutation",
  "blocked_artifact_safety_violation"
]);
const FORBIDDEN_PATTERNS = [
  /data:image\//i,
  /base64,[A-Za-z0-9+/=]{20,}/i,
  /"(?:productName|brand|purchaseUrl|reviewText|rawForm|imageUrl|pii|fullApiResponseBody)"\s*:/i,
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /https?:\/\/[^\s")]+/i,
  /(?:SUPABASE|OPENAI)_[A-Z_]*=\S+/i
];

const stdout = execFileSync(process.execPath, ["scripts/run-isolated-shadow-route-comparison.mjs"], {
  cwd: ROOT,
  encoding: "utf8",
  env: process.env
});
assert(stdout.includes("run-isolated-shadow-route-comparison summary"));
assert(existsSync(OUTPUT_PATH));
assert(existsSync(MD_PATH));

const output = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
assert.equal(output.evidenceType, "isolated_shadow_route_controlled_run");
assert(ALLOWED_STATUSES.has(output.finalStatus));
assert.equal(output.finalStatus, "blocked_local_schema_not_reproducible");
assert.equal(output.productionBlocked, true);
assert.equal(output.hostedUnknownTargetUsed, false);
assert.equal(output.routeInvoked, false);
assert.equal(output.externalProductionProviderInvoked, false);
assert.equal(output.supabaseWriteExecuted, false);
assert.equal(output.databaseCommandExecuted, false);
assert.equal(output.runtimeConnected, false);
assert.equal(output.evaluatorConnected, false);
assert.equal(output.candidatePolicyConnected, false);
assert.equal(output.baselineExecution.attempted, false);
assert.equal(output.flagOnExecution.attempted, false);
assert.equal(output.responseShapeChanged, null);
assert.equal(output.recommendationChanged, null);
assert.equal(output.shadowAddedDbMutationDelta, null);
assert.equal(output.shadowAddedStorageMutationDelta, null);
assert.equal(output.artifactSchemaValid, null);
assert.equal(output.forbiddenFieldDetected, null);
assert.equal(output.environmentAssessment.migrationReproducibility.createsProducts, false);
assert.equal(output.environmentAssessment.migrationReproducibility.altersProducts, true);
assert.equal(output.environmentAssessment.migrationReproducibility.schemaReproducible, false);
assert.equal(output.environmentAssessment.providerIsolation.externalProductionProviderInvoked, false);
assert.equal(output.mutationObserverCoverage.measured, false);
assert(Array.isArray(output.unobservedMutationSurface) && output.unobservedMutationSurface.length >= 1);
assert(Object.values(output.safetyViolationCounts).every((value) => value === null));
assert.equal(output.cleanupExecuted, true);
assert.equal(output.cleanupSucceeded, true);

const serialized = `${readFileSync(OUTPUT_PATH, "utf8")}\n${readFileSync(MD_PATH, "utf8")}`;
for (const pattern of FORBIDDEN_PATTERNS) {
  assert(!pattern.test(serialized), `controlled-run artifact leaked forbidden content: ${pattern}`);
}

for (const file of [
  "app/api/analyze/route.js",
  "lib/skin-match-decision-engine.js",
  "lib/functional-ranking-contract.js",
  "lib/functional-candidate-policy.js",
  "lib/shadow-boundary-dry-run-helper.js",
  "lib/shadow-boundary-dry-run-artifact-writer.js"
]) {
  const diff = execFileSync("git", ["diff", "--", file], { cwd: ROOT, encoding: "utf8" });
  assert.equal(diff, "", `${file} must not change in Phase 43`);
}

console.log("verify-isolated-shadow-route-comparison passed");
