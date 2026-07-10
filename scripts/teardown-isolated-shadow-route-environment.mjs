import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertLocalShadowTestWorkdir, LOCAL_SHADOW_TEST_WORKDIR } from "./assert-non-production-supabase-target.mjs";

const ROOT = process.cwd();
const RUNS_ROOT = path.resolve(ROOT, "tmp", "isolated-shadow-route-runs");
const WORKDIR = path.join(ROOT, LOCAL_SHADOW_TEST_WORKDIR);
const OUTPUT_PATH = path.join(ROOT, "tmp", "isolated-shadow-route-environment-teardown.json");

function safeRunDirectory(candidate) {
  const resolved = path.resolve(candidate || "");
  return resolved.startsWith(`${RUNS_ROOT}${path.sep}`) && path.basename(resolved).startsWith("phase44-");
}

export async function teardownIsolatedShadowRouteEnvironment({ runDirectory = null } = {}) {
  const safety = assertLocalShadowTestWorkdir({ root: ROOT });
  const cleanup = { attempted: true, localDatabaseResetAttempted: false, localStorageCleanupAttempted: false, testServerStopAttempted: false, localArtifactCleanupAttempted: false, succeeded: false, reasonCode: null };
  const marker = runDirectory && safeRunDirectory(runDirectory) && existsSync(path.join(runDirectory, ".phase43-isolated-run"));

  if (!runDirectory || !marker) {
    cleanup.succeeded = true;
    cleanup.reasonCode = "no_isolated_resources_created";
  } else if (!safety.safeToRunLocalDatabaseCommands) {
    cleanup.reasonCode = "unsafe_local_shadow_workdir";
  } else {
    cleanup.testServerStopAttempted = true;
    const stopped = spawnSync("supabase", ["stop", "--workdir", WORKDIR, "--no-backup", "--yes"], { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: 180_000 });
    if (stopped.status !== 0) {
      cleanup.reasonCode = "local_supabase_stop_failed";
    } else {
      cleanup.localDatabaseResetAttempted = true;
      cleanup.localStorageCleanupAttempted = true;
      cleanup.localArtifactCleanupAttempted = true;
      await rm(runDirectory, { recursive: true, force: true });
      cleanup.succeeded = true;
      cleanup.reasonCode = "local_shadow_resources_removed";
    }
  }

  const output = { evidenceType: "isolated_shadow_route_environment_teardown", routeInvoked: false, databaseCommandExecuted: cleanup.localDatabaseResetAttempted, supabaseWriteExecuted: false, cleanup };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const output = await teardownIsolatedShadowRouteEnvironment({ runDirectory: process.argv[2] || null });
  console.log(JSON.stringify(output.cleanup, null, 2));
}
