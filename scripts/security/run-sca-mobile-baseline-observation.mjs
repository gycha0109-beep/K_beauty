#!/usr/bin/env node
/**
 * SCA-3 diagnostic of the UNMODIFIED, npm-ci-installed Expo Android JS baseline.
 *
 * This is NOT a dependency remediation or security gate. Individual subprocess
 * failures are recorded as failures, never presented as successful checks.
 * The canonical production/full npm audit runs separately and must still FAIL
 * if the original vulnerable dependency remains.
 *
 * Prebuild/native/Gradle is expressly outside this baseline observation.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const exportDir = path.join(root, "apps", "mobile", ".expo-ci-dist");
const childEnv = {
  ...process.env,
  CI: "1",
  EXPO_NO_DOTENV: "1",
  EXPO_TELEMETRY_DISABLED: "1",
};
function observe(label, command, args, timeoutMs) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: childEnv,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    label,
    result: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    timedOut: result.error?.code === "ETIMEDOUT",
    spawnError: result.error?.code || null,
    // Deliberately do not log process stdout/stderr, code or inlined env values.
    output: result.status === 0 ? result.stdout : null,
  };
}
function publicResult(observation) {
  const { output: omitted, ...record } = observation;
  return record;
}
const checks = [];
let bundleMap = "NOT_RUN";
try {
  for (const [label, script, limit] of [
    ["foundation", "verify:mobile-foundation", 60000],
    ["typecheck", "mobile:typecheck", 180000],
  ]) {
    checks.push(observe(label, "npm", ["run", script], limit));
  }
  // Do not risk deleting a symlink/unknown folder outside the disposable CI checkout.
  if (fs.existsSync(exportDir)) {
    if (fs.lstatSync(exportDir).isSymbolicLink()) {
      throw new Error("refuse generated export symlink");
    }
    fs.rmSync(exportDir, { recursive: true, force: true });
  }
  const exported = observe("androidJsExport", "npm",
    ["run", "mobile:export:android", "--", "--source-maps"], 360000);
  checks.push(exported);
  if (exported.result === "PASS") {
    const inventory = observe("bundleSourceMapInventory", process.execPath, [
      path.join(root, "scripts", "security", "report-sca-android-bundle-boundary.mjs"),
    ], 60000);
    checks.push(inventory);
    if (inventory.result === "PASS") {
      const record = inventory.output?.split("\n")
        .find((s) => s.startsWith("SCA_ANDROID_BUNDLE_BOUNDARY="));
      if (!record) {
        checks[checks.length - 1].result = "FAIL";
        bundleMap = "MISSING_DIAGNOSTIC_MARKER";
      } else {
        // Inventory output contains only counts and package inclusion codes.
        console.log(record);
        bundleMap = "OBSERVED";
      }
    } else {
      bundleMap = "INVENTORY_FAILED";
    }
  } else {
    bundleMap = "ANDROID_EXPORT_FAILED";
  }
} finally {
  if (fs.existsSync(exportDir) && !fs.lstatSync(exportDir).isSymbolicLink()) {
    fs.rmSync(exportDir, { recursive: true, force: true });
  }
}
console.log("SCA_MOBILE_BASELINE_OBSERVATION=" + JSON.stringify({
  scope: "UNMODIFIED_NPM_LOCK_ANDROID_JAVASCRIPT_ONLY",
  checks: checks.map(publicResult),
  bundleMap,
  nativeGradle: "NOT_RUN_REQUIRES_SEPARATE_PREBUILD_ISOLATION",
  overall: checks.every((c) => c.result === "PASS") ? "OBSERVATIONS_SUCCEEDED" :
    "OBSERVATIONS_HAVE_FAILURES",
  canonicalAudit: "UNCHANGED_RUNS_SEPARATELY_WITH_REAL_FAILURES",
}));
