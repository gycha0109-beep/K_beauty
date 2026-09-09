import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedSourceSha1 = "708aeaf33190ec55694e2677da0e7c565f61adfe";
const expectedPatchedSha1 = "104a90a05f703288e5697c5548bb3af14ef951b1";
const retainedAnnotation = "SWIFT_RETURNS_RETAINED";
const replacements = [
  [
    "  SWIFT_RETURNS_RETAINED RuntimeScheduler(void *scheduler, ScheduleFn fn) noexcept",
    "  RuntimeScheduler(void *scheduler, ScheduleFn fn) noexcept",
  ],
  [
    "  SWIFT_RETURNS_RETAINED RuntimeScheduler() {}",
    "  RuntimeScheduler() {}",
  ],
];
const packageTargets = [
  {
    label: "root-peer",
    packageRoot: join(repoRoot, "node_modules", "expo-modules-jsi"),
    expectedVersion: "57.1.0",
  },
];

function sha1(value) {
  return createHash("sha1").update(value).digest("hex");
}

for (const { label, packageRoot, expectedVersion } of packageTargets) {
  const packageJsonPath = join(packageRoot, "package.json");
  const runtimeSchedulerPath = join(
    packageRoot,
    "apple",
    "Sources",
    "ExpoModulesJSI-Cxx",
    "include",
    "RuntimeScheduler.h"
  );

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  assert.equal(
    packageJson.version,
    expectedVersion,
    `MOBILE-12 compatibility shim target ${label} is bounded to expo-modules-jsi@${expectedVersion}; found ${packageJson.version}`
  );

  const source = readFileSync(runtimeSchedulerPath, "utf8");
  assert.equal(
    sha1(source),
    expectedSourceSha1,
    `expo-modules-jsi RuntimeScheduler.h source drifted for ${label}; refuse to patch unknown source`
  );

  const annotationCount = source.split(retainedAnnotation).length - 1;
  assert.equal(
    annotationCount,
    replacements.length,
    `Expected exactly ${replacements.length} ${retainedAnnotation} annotations for ${label}; found ${annotationCount}`
  );

  let patched = source;
  for (const [before, after] of replacements) {
    const occurrences = patched.split(before).length - 1;
    assert.equal(occurrences, 1, `Expected exactly one bounded RuntimeScheduler constructor match for ${label}: ${before}`);
    patched = patched.replace(before, after);
  }

  assert.ok(!patched.includes(retainedAnnotation), `${retainedAnnotation} remained after bounded compatibility patch for ${label}`);
  assert.equal(
    sha1(patched),
    expectedPatchedSha1,
    `Patched RuntimeScheduler.h hash did not match the exact bounded two-removal result for ${label}`
  );

  writeFileSync(runtimeSchedulerPath, patched, "utf8");

  console.log(`MOBILE_IOS_EXPO_MODULES_JSI_TARGET=${label}`);
  console.log(`MOBILE_IOS_EXPO_MODULES_JSI_VERSION=${expectedVersion}`);
  console.log(`MOBILE_IOS_EXPO_MODULES_JSI_SOURCE_SHA1=${expectedSourceSha1}`);
  console.log(`MOBILE_IOS_EXPO_MODULES_JSI_PATCHED_SHA1=${expectedPatchedSha1}`);
}

console.log("MOBILE_IOS_EXPO_MODULES_JSI_XCODE26_COMPAT=PASS");
