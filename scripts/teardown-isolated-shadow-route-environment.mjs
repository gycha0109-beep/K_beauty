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

function resolveWindowsSupabaseScript() {
  const located = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "(Get-Command supabase -ErrorAction Stop).Source"],
    { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: 30_000 }
  );
  const scriptPath = String(located.stdout || "").trim();
  return located.status === 0 && scriptPath.toLowerCase().endsWith(".ps1") ? scriptPath : null;
}

function stopLocalSupabase() {
  const options = { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: 180_000 };
  if (process.platform === "win32") {
    const scriptPath = resolveWindowsSupabaseScript();
    if (!scriptPath) {
      return { status: null, stdout: "", stderr: "", error: new Error("supabase_powershell_script_unavailable") };
    }
    return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", scriptPath, "--workdir", WORKDIR, "stop", "--no-backup", "--yes"], options);
  }
  return spawnSync("supabase", ["--workdir", WORKDIR, "stop", "--no-backup", "--yes"], options);
}

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
    const stopped = stopLocalSupabase();
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
