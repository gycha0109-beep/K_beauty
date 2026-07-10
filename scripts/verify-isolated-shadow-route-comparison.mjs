import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const outputPath = path.join(ROOT, "tmp", "isolated-shadow-route-controlled-run.json");

const stdout = execFileSync(process.execPath, ["scripts/run-isolated-shadow-route-comparison.mjs"], {
  cwd: ROOT,
  encoding: "utf8",
  env: process.env
});
assert(stdout.includes("run-isolated-shadow-route-comparison summary"));
assert(existsSync(outputPath));

const output = JSON.parse(readFileSync(outputPath, "utf8"));
assert.equal(output.evidenceType, "isolated_shadow_route_controlled_run");
assert(["local_shadow_runtime_ready_for_controlled_route_run", "blocked_local_supabase_unavailable"].includes(output.finalStatus));
assert.equal(output.routeInvoked, false);
assert.equal(output.externalProductionProviderInvoked, false);
assert.equal(output.databaseCommandExecuted, false);
assert.equal(output.supabaseWriteExecuted, false);
assert.equal(output.providerStubbed, true);
if (output.finalStatus === "local_shadow_runtime_ready_for_controlled_route_run") {
  assert.equal(output.mutationObserverCoverage.status, "complete");
}
assert.equal(output.cleanupSucceeded, true);
assert.equal(output.runtimeConnected, false);
assert.equal(output.evaluatorConnected, false);
assert.equal(output.candidatePolicyConnected, false);

console.log("verify-isolated-shadow-route-comparison passed");
