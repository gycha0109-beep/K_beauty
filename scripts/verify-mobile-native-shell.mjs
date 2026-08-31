import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const appConfig = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8"));
const mobilePackage = JSON.parse(readFileSync(join(mobileRoot, "package.json"), "utf8"));
const mobileIgnore = readFileSync(join(mobileRoot, ".gitignore"), "utf8");
const expo = appConfig.expo || {};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertPermissionNotRequested(manifest, permission, message) {
  const escapedPermission = escapeRegExp(permission);
  const tags = manifest.match(
    new RegExp(`<uses-permission(?:-sdk-23)?\\b[^>]*android:name=["']${escapedPermission}["'][^>]*\\/?>`, "g")
  ) || [];
  for (const tag of tags) {
    assert.match(tag, /tools:node=["']remove["']/, message);
  }
}

assert.equal(expo.orientation, "portrait", "MOBILE-1 must keep the native shell portrait-locked");
assert.equal(expo.userInterfaceStyle, "automatic", "MOBILE-1 must follow the system light/dark preference");
assert.ok(expo.plugins?.includes("expo-system-ui"), "expo-system-ui plugin is required for Android automatic UI style");
assert.equal(expo.android?.package, "com.bejewely.mobile", "Unexpected Android application id");
assert.equal(expo.android?.softwareKeyboardLayoutMode, "resize", "Android keyboard layout mode must remain explicit");
assert.equal(expo.androidStatusBar?.translucent, false, "Status bar must not overlay the app shell");
assert.match(mobileIgnore, /^android\/$/m, "Generated Android project must stay untracked");
assert.match(mobileIgnore, /^ios\/$/m, "Generated iOS project must stay untracked");
assert.equal(typeof mobilePackage.scripts?.["prebuild:android"], "string");
assert.equal(typeof mobilePackage.scripts?.["build:android:debug"], "string");
assert.equal(typeof mobilePackage.scripts?.["verify:native"], "string");
assert.equal(mobilePackage.dependencies?.["expo-system-ui"], "~57.0.2");
assert.equal(mobilePackage.dependencies?.["expo-localization"], "~57.0.1");
assert.equal(
  mobilePackage.dependencies?.["react-native-reanimated"],
  "4.5.1",
  "Expo SDK 57 native shell requires the validated Reanimated 4.5.1 runtime pair"
);
assert.equal(
  mobilePackage.dependencies?.["react-native-worklets"],
  "0.10.1",
  "Expo SDK 57 native shell requires the validated Worklets 0.10.1 runtime pair"
);

const androidRoot = join(mobileRoot, "android");
assert.ok(existsSync(androidRoot), "Run Expo Android prebuild before the MOBILE-1 native verifier");

const buildGradle = readFileSync(join(androidRoot, "app", "build.gradle"), "utf8");
const manifest = readFileSync(join(androidRoot, "app", "src", "main", "AndroidManifest.xml"), "utf8");
const mainActivity = join(androidRoot, "app", "src", "main", "java", "com", "bejewely", "mobile", "MainActivity.kt");

assert.match(buildGradle, /applicationId\s+["']com\.bejewely\.mobile["']/, "Generated applicationId drifted from app config");
assert.match(manifest, /android:screenOrientation=["']portrait["']/, "Generated Android manifest lost portrait orientation");
assert.match(manifest, /android:windowSoftInputMode=["'][^"']*adjustResize[^"']*["']/, "Generated Android manifest lost keyboard resize behavior");
assert.ok(existsSync(mainActivity), "Generated MainActivity package path is missing");

if (mobilePackage.dependencies?.["expo-camera"]) {
  const cameraPlugin = expo.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-camera");
  assert.ok(cameraPlugin, "expo-camera dependency requires the Expo config plugin");
  assert.equal(cameraPlugin[1]?.recordAudioAndroid, false, "Photo-only camera must keep Android audio recording disabled");
  assert.equal(cameraPlugin[1]?.barcodeScannerEnabled, false, "Camera foundation must keep barcode support disabled");
  assert.match(manifest, /android\.permission\.CAMERA/, "Generated Android manifest lost CAMERA permission");
  assert.ok(
    expo.android?.blockedPermissions?.includes("android.permission.RECORD_AUDIO"),
    "Photo-only MOBILE-5 must explicitly block RECORD_AUDIO"
  );
  assertPermissionNotRequested(
    manifest,
    "android.permission.RECORD_AUDIO",
    "Photo-only MOBILE-5 must not request RECORD_AUDIO unless the manifest entry is an explicit removal marker"
  );
}

console.log("MOBILE_NATIVE_SHELL=PASS");
