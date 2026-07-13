import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertLocalShadowTestWorkdir, LOCAL_SHADOW_TEST_WORKDIR } from "./assert-non-production-supabase-target.mjs";

const ROOT = process.cwd();
const RUNS_ROOT = path.resolve(ROOT, "tmp", "isolated-shadow-route-runs");
const WORKDIR = path.join(ROOT, LOCAL_SHADOW_TEST_WORKDIR);
const OUTPUT_PATH = path.join(ROOT, "tmp", "isolated-shadow-route-environment-teardown.json");
const SETUP_OUTPUT_PATH = path.join(ROOT, "tmp", "isolated-shadow-route-environment-setup.json");

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

function readSetupRunDirectory() {
  if (!existsSync(SETUP_OUTPUT_PATH)) {
    return null;
  }

  try {
    const setupEvidence = JSON.parse(readFileSync(SETUP_OUTPUT_PATH, "utf8"));
    return typeof setupEvidence?.runDirectory === "string" && setupEvidence.runDirectory.trim()
      ? setupEvidence.runDirectory
      : null;
  } catch {
    return null;
  }
}

export async function teardownIsolatedShadowRouteEnvironment({ runDirectory = null } = {}) {
  const safety = assertLocalShadowTestWorkdir({ root: ROOT });
  const evidenceRunDirectory = runDirectory ? null : readSetupRunDirectory();
  const resolvedRunDirectory = runDirectory || evidenceRunDirectory;
  const runDirectorySource = runDirectory ? "explicit_argument" : evidenceRunDirectory ? "setup_evidence" : "none";
  const safeCandidate = resolvedRunDirectory ? safeRunDirectory(resolvedRunDirectory) : false;
  const marker = safeCandidate && existsSync(path.join(resolvedRunDirectory, ".phase43-isolated-run"));
  const cleanup = {
    attempted: true,
    runDirectorySource,
    localDatabaseResetAttempted: false,
    localStorageCleanupAttempted: false,
    testServerStopAttempted: false,
    localArtifactCleanupAttempted: false,
    succeeded: false,
    reasonCode: null
  };

  if (!resolvedRunDirectory) {
    cleanup.succeeded = true;
    cleanup.reasonCode = "no_isolated_resources_created";
  } else if (!safeCandidate) {
    cleanup.reasonCode = "unsafe_run_directory_evidence";
  } else if (!marker) {
    cleanup.succeeded = true;
    cleanup.reasonCode = "isolated_resources_already_removed";
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
      await rm(resolvedRunDirectory, { recursive: true, force: true });
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
