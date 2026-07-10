import { existsSync, readFileSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const RUNS_ROOT = path.resolve(ROOT, "tmp", "isolated-shadow-route-runs");
const OUTPUT_PATH = path.join(ROOT, "tmp", "isolated-shadow-route-environment-teardown.json");

function isSafeRunDirectory(candidate) {
  if (!candidate) return false;
  const resolved = path.resolve(candidate);
  return resolved.startsWith(`${RUNS_ROOT}${path.sep}`) && path.basename(resolved).startsWith("phase43-");
}

export async function teardownIsolatedShadowRouteEnvironment({ runDirectory = null } = {}) {
  const cleanup = {
    attempted: true,
    localDatabaseResetAttempted: false,
    localStorageCleanupAttempted: false,
    testServerStopAttempted: false,
    localArtifactCleanupAttempted: false,
    noResourcesCreated: !runDirectory,
    succeeded: false,
    reasonCode: null
  };

  if (!runDirectory) {
    cleanup.succeeded = true;
    cleanup.reasonCode = "no_isolated_resources_created";
  } else if (!isSafeRunDirectory(runDirectory)) {
    cleanup.reasonCode = "unsafe_cleanup_path_rejected";
  } else if (!existsSync(path.join(runDirectory, ".phase43-isolated-run"))) {
    cleanup.reasonCode = "cleanup_marker_missing";
  } else {
    cleanup.localArtifactCleanupAttempted = true;
    await rm(runDirectory, { recursive: true, force: false });
    cleanup.succeeded = true;
    cleanup.reasonCode = "isolated_run_directory_removed";
  }

  const output = {
    generatedAt: new Date().toISOString(),
    evidenceType: "isolated_shadow_route_environment_teardown",
    routeInvoked: false,
    databaseCommandExecuted: false,
    supabaseWriteExecuted: false,
    cleanup
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const setupPath = path.join(ROOT, "tmp", "isolated-shadow-route-environment-setup.json");
  const setup = existsSync(setupPath) ? JSON.parse(readFileSync(setupPath, "utf8")) : null;
  const output = await teardownIsolatedShadowRouteEnvironment({
    runDirectory: setup?.runDirectory || null
  });
  console.log("teardown-isolated-shadow-route-environment summary");
  console.log(JSON.stringify(output.cleanup, null, 2));
}
