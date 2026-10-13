#!/usr/bin/env node
/**
 * SCA-3 observational Android native prebuild baseline.
 *
 * Runs only on an ephemeral CI checkout and never modifies npm lockfiles,
 * npm audit policy, installed library sources or deployed applications.
 * This does NOT build an APK or attest a patched dependency candidate.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mobile = path.join(root, "apps", "mobile");
const android = path.join(mobile, "android");
const tracked = [
  "package.json",
  "package-lock.json",
  "apps/mobile/package.json",
  "apps/mobile/app.json",
  "apps/mobile/.gitignore",
];
const trackedPaths = tracked.map((p) => path.join(root, p));
const digest = (p) => fs.existsSync(p) ?
  createHash("sha256").update(fs.readFileSync(p)).digest("hex") : "MISSING";
const before = trackedPaths.map(digest);
const beforeContents = trackedPaths.map((p) => fs.readFileSync(p));
const androidExistedBefore = fs.existsSync(android);
const checks = [];
const childEnv = {
  ...process.env,
  CI: "1",
  EXPO_NO_DOTENV: "1",
  EXPO_TELEMETRY_DISABLED: "1",
};
function stage(label, cmd, args, timeoutMs) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    env: childEnv,
    maxBuffer: 16 * 1024 * 1024,
    timeout: timeoutMs,
  });
  const out = {
    label,
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    spawnError: result.error?.code || null,
    timedOut: result.error?.code === "ETIMEDOUT",
  };
  checks.push(out);
  // Never echo subprocess output: it can include local configuration,
  // signing-related data, device paths and other environment details.
  return out;
}
let stopReason = null;
let generatedNativeShell = false;
try {
  assert.ok(fs.existsSync(path.join(mobile, "app.json")), "mobile config missing");
  if (androidExistedBefore) {
    stopReason = "ANDROID_DIRECTORY_ALREADY_EXISTS_REFUSE_OVERWRITE";
  } else {
    const prebuild = stage("androidPrebuild",
      "npm", ["run", "mobile:prebuild:android"], 360000);
    if (prebuild.status === "PASS") {
      generatedNativeShell = true;
      stage("nativeShellContract",
        "npm", ["run", "verify:mobile-native"], 60000);
    } else {
      stopReason = "ANDROID_PREBUILD_FAILED";
    }
  }
} catch (e) {
  stopReason = "PREBUILD_OBSERVER_INTERNAL_ERROR";
  checks.push({
    label: "observer",
    status: "FAIL",
    errorType: e?.name || "Error",
  });
} finally {
  const after = trackedPaths.map(digest);
  const changedFiles = tracked.filter((_, index) => before[index] !== after[index]);
  // Expo prebuild may normalize workspace package.json even with --no-install.
  // Restore exact original bytes on the disposable CI checkout before npm audit.
  const restored = [];
  const restorationErrors = [];
  if (!androidExistedBefore) {
    for (let index = 0; index < trackedPaths.length; index++) {
      if (before[index] === after[index]) continue;
      const file = trackedPaths[index];
      try {
        assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(),
          "changed tracked input is missing or non-regular");
        assert.ok(!fs.lstatSync(file).isSymbolicLink(),
          "refuse restore through symlink");
        fs.writeFileSync(file, beforeContents[index]);
        if (digest(file) !== before[index]) {
          throw new Error("tracked input content not recovered");
        }
        restored.push(tracked[index]);
      } catch {
        restorationErrors.push(tracked[index]);
      }
    }
  }
  const trackedInputsRestored = trackedPaths.every((file, index) =>
    digest(file) === before[index]);
  const nativeWasCreated = !fs.existsSync(android) ? false :
    !fs.lstatSync(android).isSymbolicLink() && fs.lstatSync(android).isDirectory();
  const safeToClean = !androidExistedBefore && nativeWasCreated &&
    path.dirname(android) === mobile && !fs.existsSync(path.join(android, ".git"));
  let cleanup = "NOT_NEEDED";
  if (safeToClean) {
    try {
      fs.rmSync(android, { recursive: true, force: true });
      cleanup = "REMOVED_GENERATED_NATIVE_DIRECTORY";
    } catch {
      cleanup = "CLEANUP_FAILED";
    }
  } else if (fs.existsSync(android)) {
    cleanup = "REFUSED_UNSAFE_NATIVE_DIRECTORY_CLEANUP";
  }
  const result = {
    mode: "UNMODIFIED_LOCK_NATIVE_PREBUILD_BASELINE_ONLY",
    sdk: "EXPO_57_ANDROID_PREBUILD",
    checks,
    generatedNativeShell,
    stopReason,
    changedTrackedInputs: changedFiles, // names only; never print file contents
    restoredTrackedInputs: restored,
    restorationErrors,
    trackedInputsRestored,
    cleanup,
    nativeGradleBuild: "NOT_RUN",
    apkArtifact: "NOT_CREATED",
    candidatePatchedDependencyTested: false,
    canonicalAuditUnchanged: trackedInputsRestored,
    conclusion: stopReason === null && trackedInputsRestored &&
      cleanup === "REMOVED_GENERATED_NATIVE_DIRECTORY" &&
      checks.every((check) => check.status === "PASS") ?
      (changedFiles.length ? "NATIVE_PREBUILD_PASS_WITH_RESTORED_INPUT_MUTATION" :
        "NATIVE_PREBUILD_BASELINE_PASS") : "NATIVE_PREBUILD_BASELINE_INCOMPLETE",
  };
  console.log("SCA_NATIVE_PREBUILD_OBSERVATION=" + JSON.stringify(result));
  if (!trackedInputsRestored || restorationErrors.length > 0 ||
      cleanup === "CLEANUP_FAILED") {
    process.exitCode = 1; // fail closed; never audit altered tracked inputs
  }
  // Do not prevent the separately-executed original npm audit from running.
  // This is an observation, not a policy waiver.
}
