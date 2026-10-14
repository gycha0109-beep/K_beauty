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
import { trackedChangesAtHead, unexpectedTrackedChanges } from "./sca-native-tracked-integrity.mjs";

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
const initialTrackedChanges = trackedChangesAtHead(root);
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
let apkEvidence = null;
const changesSeen = new Set();
const restoredSeen = new Set();
const restoreErrors = new Set();
// Explicitly restore package metadata before Gradle, since Expo prebuild
// is known to rewrite apps/mobile/package.json even with --no-install.
function restoreTrackedInputs() {
  let success = true;
  for (let index = 0; index < trackedPaths.length; index++) {
    const file = trackedPaths[index];
    if (before[index] === digest(file)) continue;
    changesSeen.add(tracked[index]);
    try {
      assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(),
        "changed tracked input is missing or non-regular");
      assert.ok(!fs.lstatSync(file).isSymbolicLink(),
        "refuse restore through symlink");
      fs.writeFileSync(file, beforeContents[index]);
      assert.equal(digest(file), before[index], "restore verification failed");
      restoredSeen.add(tracked[index]);
    } catch {
      restoreErrors.add(tracked[index]);
      success = false;
    }
  }
  return success;
}
try {
  assert.ok(fs.existsSync(path.join(mobile, "app.json")), "mobile config missing");
  if (initialTrackedChanges.length > 0) {
    stopReason = "PREEXISTING_TRACKED_WORKTREE_CHANGES_REFUSE_PREBUILD";
  } else if (androidExistedBefore) {
    stopReason = "ANDROID_DIRECTORY_ALREADY_EXISTS_REFUSE_OVERWRITE";
  } else {
    const prebuild = stage("androidPrebuild",
      "npm", ["run", "mobile:prebuild:android"], 360000);
    if (prebuild.status === "PASS") {
      generatedNativeShell = true;
      const shell = stage("nativeShellContract",
        "npm", ["run", "verify:mobile-native"], 60000);
      if (shell.status !== "PASS") {
        stopReason = "NATIVE_SHELL_CONTRACT_FAILED";
      } else if (!restoreTrackedInputs()) {
        stopReason = "TRACKED_INPUTS_NOT_RESTORED_BEFORE_GRADLE";
      } else if (process.env.SCA_ENABLE_GRADLE_DEBUG_OBSERVATION === "1") {
        // Long native assembly is opt-in only. The previous cold-build
        // diagnostic exhausted 7 minutes without producing an APK.
        const gradle = stage("androidGradleDebug",
          "npm", ["run", "mobile:build:android:debug"], 420000);
        if (gradle.status === "PASS") {
          const apk = path.join(android, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
          if (fs.existsSync(apk) && fs.statSync(apk).isFile() &&
              !fs.lstatSync(apk).isSymbolicLink() && fs.statSync(apk).size > 100000) {
            apkEvidence = {
              observed: "DEBUG_APK_FILE_GENERATED",
              bytes: fs.statSync(apk).size,
              sha256: digest(apk),
              caveat: "NO_DEVICE_SMOKE_OR_PATCHED_DEPENDENCY_ATTESTATION",
            };
          } else {
            stopReason = "GRADLE_PASS_BUT_APK_MISSING_OR_INVALID";
          }
        } else {
          stopReason = gradle.timedOut ?
            "GRADLE_DEBUG_BUILD_TIMED_OUT" : "GRADLE_DEBUG_BUILD_FAILED";
        }
      }
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
  // Final idempotent restoration also covers any later Gradle metadata edits.
  if (!androidExistedBefore) restoreTrackedInputs();
  const changedFiles = [...changesSeen];
  const restored = [...restoredSeen];
  const restorationErrors = [...restoreErrors];
  const trackedInputsRestored = trackedPaths.every((file, index) =>
    digest(file) === before[index]);
  // The five byte-exact snapshots are not the whole repo. Expo and Gradle
  // must not introduce changes to any *other* tracked file unnoticed.
  let changedTrackedRepositoryFiles = [];
  let gitTrackedCheckPassed = false;
  try {
    changedTrackedRepositoryFiles = trackedChangesAtHead(root);
    gitTrackedCheckPassed = unexpectedTrackedChanges(
      initialTrackedChanges, changedTrackedRepositoryFiles).length === 0 &&
      initialTrackedChanges.length === 0;
  } catch {
    stopReason ||= "WHOLE_REPOSITORY_TRACKED_INTEGRITY_CHECK_FAILED";
  }
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
    changedTrackedRepositoryFiles, // filenames only, never file content
    gitTrackedCheckPassed,
    restoredTrackedInputs: restored,
    restorationErrors,
    trackedInputsRestored,
    cleanup,
    nativeGradleBuild: checks.find((check) => check.label === "androidGradleDebug")?.status ||
      "NOT_RUN_OPT_IN_ONLY",
    apkArtifact: apkEvidence || "NOT_CREATED",
    candidatePatchedDependencyTested: false,
    extendedGradleOptIn: process.env.SCA_ENABLE_GRADLE_DEBUG_OBSERVATION === "1",
    canonicalAuditUnchanged: trackedInputsRestored && gitTrackedCheckPassed,
    conclusion: stopReason === null && trackedInputsRestored && gitTrackedCheckPassed &&
      cleanup === "REMOVED_GENERATED_NATIVE_DIRECTORY" &&
      checks.every((check) => check.status === "PASS") ?
      (apkEvidence ? "NATIVE_DEBUG_APK_BASELINE_PASS" :
        "NATIVE_PREBUILD_BASELINE_PASS_GRADLE_NOT_RUN") : "NATIVE_BUILD_BASELINE_INCOMPLETE",
  };
  console.log("SCA_NATIVE_PREBUILD_OBSERVATION=" + JSON.stringify(result));
  if (!trackedInputsRestored || !gitTrackedCheckPassed ||
      restorationErrors.length > 0 || cleanup !== "REMOVED_GENERATED_NATIVE_DIRECTORY") {
    process.exitCode = 1; // fail closed; never audit altered tracked inputs
  }
  // Do not prevent the separately-executed original npm audit from running.
  // This is an observation, not a policy waiver.
}
