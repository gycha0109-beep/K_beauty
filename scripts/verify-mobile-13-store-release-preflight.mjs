import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const appJsonPath = join(mobileRoot, "app.json");
const packagePath = join(mobileRoot, "package.json");
const readinessPath = join(mobileRoot, "store-readiness.json");

const appJsonSource = readFileSync(appJsonPath, "utf8");
const appConfig = JSON.parse(appJsonSource);
const mobilePackage = JSON.parse(readFileSync(packagePath, "utf8"));
const readiness = JSON.parse(readFileSync(readinessPath, "utf8"));
const expo = appConfig.expo || {};
const requestedPlatform = process.argv.includes("--platform")
  ? process.argv[process.argv.indexOf("--platform") + 1]
  : "all";

assert.ok(["all", "android", "ios"].includes(requestedPlatform), `Unsupported platform: ${requestedPlatform}`);

function pluginConfig(name) {
  const entry = (expo.plugins || []).find((plugin) =>
    Array.isArray(plugin) ? plugin[0] === name : plugin === name
  );
  return Array.isArray(entry) ? entry[1] || {} : {};
}

function findFiles(root, basename, found = []) {
  if (!existsSync(root)) return found;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) findFiles(path, basename, found);
    else if (entry.name === basename) found.push(path);
  }
  return found;
}

assert.equal(readiness.schemaVersion, "mobile-store-readiness-v1");
assert.equal(readiness.slice, "MOBILE-13");
assert.equal(readiness.status, "preflight_only");

assert.equal(expo.name, "BEJEWELY");
assert.equal(expo.scheme, "bejewely");
assert.equal(expo.orientation, "portrait");
assert.equal(expo.version, readiness.releaseVersion.marketingVersion);
assert.equal(expo.ios?.bundleIdentifier, "com.bejewely.mobile");
assert.equal(expo.android?.package, "com.bejewely.mobile");
assert.equal(expo.ios?.buildNumber, readiness.releaseVersion.iosBuildNumber);
assert.equal(expo.android?.versionCode, readiness.releaseVersion.androidVersionCode);
assert.equal(expo.ios?.deploymentTarget, readiness.toolchainContract.iosDeploymentTarget);
assert.equal(readiness.toolchainContract.expoSdkMajor, 57);
assert.equal(readiness.toolchainContract.reactNativeMinor, "0.86");
assert.equal(readiness.toolchainContract.androidTargetSdk, 36);
assert.equal(readiness.toolchainContract.androidNativePageSizeKb, 16);
assert.equal(readiness.toolchainContract.iosSubmissionSdkMinimum, "26");
assert.equal(readiness.toolchainContract.bundletoolVersion, "1.18.3");
assert.equal(
  readiness.toolchainContract.bundletoolSha256,
  "a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29"
);

assert.match(mobilePackage.dependencies?.expo || "", /^~57\./, "MOBILE-13 expects Expo SDK 57");
assert.match(mobilePackage.dependencies?.["react-native"] || "", /^0\.86\./, "MOBILE-13 expects React Native 0.86");
assert.equal(
  mobilePackage.scripts?.["build:android:release"],
  "cd android && ./gradlew :app:bundleRelease --no-daemon",
  "MOBILE-13 must expose the release AAB build command"
);

const camera = pluginConfig("expo-camera");
assert.equal(
  camera.cameraPermission,
  "Allow BEJEWELY to use your camera for skin photo capture.",
  "Camera disclosure drifted"
);
assert.equal(camera.recordAudioAndroid, false, "Camera plugin must not request Android audio recording");
assert.equal(camera.microphonePermission, false, "Camera plugin must not inject an iOS microphone disclosure");
assert.equal(camera.barcodeScannerEnabled, false, "Barcode scanner remains outside BEJEWELY scope");

for (const token of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "POLAR_ACCESS_TOKEN",
  "STRIPE_SECRET_KEY",
  "GOOGLE_CLIENT_SECRET",
  "APPLE_PRIVATE_KEY"
]) {
  assert.ok(!appJsonSource.includes(token), `Forbidden server secret token leaked into app config: ${token}`);
}

const compliance = new Map(readiness.complianceInventory.map((item) => [item.id, item]));
for (const id of [
  "privacy_policy",
  "account_deletion_in_app",
  "google_external_account_deletion",
  "apple_privacy_manifest_required_reason_audit",
  "google_play_data_safety",
  "ai_skin_analysis_claim_review"
]) {
  assert.ok(compliance.has(id), `Missing compliance inventory item: ${id}`);
}
assert.equal(compliance.get("privacy_policy").status, "blocked");
assert.equal(compliance.get("account_deletion_in_app").status, "blocked");
assert.equal(compliance.get("google_external_account_deletion").status, "blocked");

const externalBlockers = new Set(readiness.externalBlockers.map((item) => item.id));
for (const id of [
  "apple_developer_and_app_store_connect",
  "google_play_console",
  "ios_distribution_signing_and_provisioning",
  "android_upload_signing_key",
  "hosted_oauth_redirect_allow_list",
  "universal_links_and_android_app_links",
  "domain_association_files",
  "testflight_and_play_internal_testing"
]) {
  assert.ok(externalBlockers.has(id), `Missing external blocker: ${id}`);
}

console.log("MOBILE_13_SOURCE_IDENTITY=PASS");
console.log("MOBILE_13_VERSION_POLICY=PASS");
console.log("MOBILE_13_PERMISSION_SOURCE_BOUNDARY=PASS");
console.log("MOBILE_13_SECRET_BOUNDARY=PASS");
console.log("MOBILE_13_COMPLIANCE_INVENTORY=PASS");

if (requestedPlatform === "all" || requestedPlatform === "android") {
  const androidRoot = join(mobileRoot, "android");
  assert.ok(existsSync(androidRoot), "Run Expo Android prebuild before MOBILE-13 Android verification");

  const manifestPath = join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
  const appGradlePath = join(androidRoot, "app", "build.gradle");
  const manifest = readFileSync(manifestPath, "utf8");
  const appGradle = readFileSync(appGradlePath, "utf8");

  assert.match(appGradle, /applicationId\s+["']com\.bejewely\.mobile["']/);
  assert.match(appGradle, /versionCode\s+1\b/);
  assert.match(appGradle, /versionName\s+["']0\.1\.0["']/);
  assert.match(
    appGradle,
    /targetSdkVersion\s+rootProject\.ext\.targetSdkVersion/,
    "Generated Android app must resolve targetSdk through the Expo root-project contract"
  );
  assert.match(manifest, /android\.permission\.CAMERA/);
  for (const permission of [
    "android.permission.RECORD_AUDIO",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.READ_CONTACTS",
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE"
  ]) {
    assert.ok(!manifest.includes(permission), `Unexpected Android permission: ${permission}`);
  }

  console.log("MOBILE_13_ANDROID_TARGET_API_DELEGATION=PASS");
  console.log("MOBILE_13_ANDROID_GENERATED_PERMISSIONS=PASS");
  console.log("MOBILE_13_ANDROID_RELEASE_CONTRACT=PASS");
}

if (requestedPlatform === "all" || requestedPlatform === "ios") {
  const iosRoot = join(mobileRoot, "ios");
  assert.ok(existsSync(iosRoot), "Run Expo iOS prebuild before MOBILE-13 iOS verification");

  const projectPath = join(iosRoot, "BEJEWELY.xcodeproj", "project.pbxproj");
  const infoPlistPath = join(iosRoot, "BEJEWELY", "Info.plist");
  const project = readFileSync(projectPath, "utf8");
  const infoPlist = readFileSync(infoPlistPath, "utf8");
  const iosContract = `${project}\n${infoPlist}`;

  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*["']?com\.bejewely\.mobile["']?;/);
  assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET\s*=\s*16\.4;/);
  assert.match(
    iosContract,
    /MARKETING_VERSION\s*=\s*0\.1\.0;|<key>CFBundleShortVersionString<\/key>\s*<string>0\.1\.0<\/string>/,
    "Generated iOS marketing version drifted"
  );
  assert.match(
    iosContract,
    /CURRENT_PROJECT_VERSION\s*=\s*1;|<key>CFBundleVersion<\/key>\s*<string>1<\/string>/,
    "Generated iOS build number drifted"
  );
  assert.match(infoPlist, /<key>NSCameraUsageDescription<\/key>/);
  assert.match(infoPlist, /Allow BEJEWELY to use your camera for skin photo capture\./);
  assert.match(infoPlist, /<string>bejewely<\/string>/);

  for (const privacyKey of [
    "NSMicrophoneUsageDescription",
    "NSLocationWhenInUseUsageDescription",
    "NSLocationAlwaysAndWhenInUseUsageDescription",
    "NSPhotoLibraryUsageDescription",
    "NSContactsUsageDescription"
  ]) {
    assert.ok(!infoPlist.includes(privacyKey), `Unexpected iOS privacy permission: ${privacyKey}`);
  }

  const privacyManifests = findFiles(iosRoot, "PrivacyInfo.xcprivacy");
  console.log(`MOBILE_13_IOS_PRIVACY_MANIFEST_FILES=${privacyManifests.length}`);
  console.log("MOBILE_13_IOS_DEPLOYMENT_TARGET=PASS");
  console.log("MOBILE_13_IOS_GENERATED_PERMISSIONS=PASS");
  console.log("MOBILE_13_IOS_RELEASE_CONTRACT=PASS");
}

console.log("MOBILE_13_STORE_RELEASE_PREFLIGHT=PASS");
