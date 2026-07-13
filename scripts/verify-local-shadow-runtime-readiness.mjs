import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolveLocalShadowProviderStub } from "../lib/local-shadow-provider-stub.js";
import { assertLocalShadowTestWorkdir } from "./assert-non-production-supabase-target.mjs";
import { inspectShadowRouteProviderIsolation } from "./lib/shadow-route-provider-isolation.mjs";
import { prepareIsolatedShadowRouteEnvironment } from "./setup-isolated-shadow-route-environment.mjs";
import { teardownIsolatedShadowRouteEnvironment } from "./teardown-isolated-shadow-route-environment.mjs";

const ROOT = process.cwd();
const enabledEnv = {
  NODE_ENV: "development",
  LOCAL_SHADOW_PROVIDER_STUB: "1",
  SHADOW_ROUTE_NON_PRODUCTION_TARGET: "1",
  SHADOW_TEST_DB_DISPOSABLE: "1",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321"
};

assert.equal(resolveLocalShadowProviderStub({ env: {} }).enabled, false);
assert.equal(resolveLocalShadowProviderStub({ env: { ...enabledEnv, NODE_ENV: "production" } }).enabled, false);
assert.equal(resolveLocalShadowProviderStub({ env: { ...enabledEnv, NEXT_PUBLIC_SUPABASE_URL: "https://remote.invalid" } }).enabled, false);
assert.equal(resolveLocalShadowProviderStub({ env: enabledEnv }).enabled, true);
assert.equal(assertLocalShadowTestWorkdir({ root: ROOT }).safeToRunLocalDatabaseCommands, true);

assert.equal(inspectShadowRouteProviderIsolation(ROOT).existingTestAdapterPresent, true);

const setupOne = await prepareIsolatedShadowRouteEnvironment();
assert.equal(setupOne.routeInvoked, false);
assert.equal(setupOne.externalProductionProviderInvoked, false);
assert.equal(typeof setupOne.reasonCode, "string");
assert.equal(typeof setupOne.predicates, "object");
assert(["local_shadow_runtime_ready_for_controlled_route_run", "blocked_local_supabase_unavailable"].includes(setupOne.setupStatus));

if (setupOne.setupStatus === "local_shadow_runtime_ready_for_controlled_route_run") {
  assert.equal(setupOne.mutationObserver.mutationObserverCoverage, "complete");
  assert.equal(setupOne.seed.productCountVerified, true);
  assert.equal(setupOne.seed.deterministic, true);
  assert.equal(setupOne.commands.start.exitCode, 0);
  assert.equal(setupOne.commands.firstReset.exitCode, 0);
  assert.equal(setupOne.commands.firstSeedQuery.exitCode, 0);
  assert.equal(setupOne.commands.secondReset.exitCode, 0);
  assert.equal(setupOne.commands.secondSeedQuery.exitCode, 0);
  assert(existsSync(setupOne.runDirectory));
  const firstTeardown = await teardownIsolatedShadowRouteEnvironment({ runDirectory: setupOne.runDirectory });
  assert.equal(firstTeardown.cleanup.succeeded, true);
  const secondTeardown = await teardownIsolatedShadowRouteEnvironment({ runDirectory: setupOne.runDirectory });
  assert.equal(secondTeardown.cleanup.succeeded, true);
} else {
  assert.equal(setupOne.tools.dockerDaemonAvailable, false);
  assert.equal(setupOne.databaseCommandExecuted, false);
}

console.log("verify-local-shadow-runtime-readiness passed");
