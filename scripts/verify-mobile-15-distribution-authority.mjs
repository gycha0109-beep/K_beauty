import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MOBILE15_ANDROID_SIGNING_MARKER,
  patchAndroidReleaseSigning
} from "./configure-mobile-15-android-release-signing.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const workflowPath = join(repoRoot, ".github", "workflows", "mobile-15-distribution-authority.yml");
const appConfig = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8"));
const storeReadiness = JSON.parse(readFileSync(join(mobileRoot, "store-readiness.json"), "utf8"));
const distribution = JSON.parse(readFileSync(join(mobileRoot, "distribution-readiness.json"), "utf8"));
const workflowSource = readFileSync(workflowPath, "utf8");
const gitignoreSource = readFileSync(join(repoRoot, ".gitignore"), "utf8");
const expo = appConfig.expo || {};

const mode = process.argv.includes("--platform")
  ? process.argv[process.argv.indexOf("--platform") + 1]
  : "source";
assert.ok(["source", "android", "ios"].includes(mode), `Unsupported MOBILE-15 platform: ${mode}`);

assert.equal(distribution.schemaVersion, "mobile-distribution-readiness-v1");
assert.equal(distribution.slice, "MOBILE-15");
assert.equal(distribution.status, "repository_signing_path_ready_external_authority_pending");
assert.equal(storeReadiness.slice, "MOBILE-15");
assert.equal(storeReadiness.status, "repository_ready_external_pending");
assert.equal(storeReadiness.mobile15Contract?.distributionReadinessPath, "apps/mobile/distribution-readiness.json");
assert.equal(storeReadiness.mobile15Contract?.signedArtifactWorkflow, ".github/workflows/mobile-15-distribution-authority.yml");

assert.equal(distribution.identity.iosBundleIdentifier, "com.bejewely.mobile");
assert.equal(distribution.identity.androidApplicationId, "com.bejewely.mobile");
assert.equal(distribution.identity.iosBundleIdentifier, expo.ios?.bundleIdentifier);
assert.equal(distribution.identity.androidApplicationId, expo.android?.package);
assert.equal(distribution.releaseVersion.marketingVersion, expo.version);
assert.equal(distribution.releaseVersion.iosBuildNumber, expo.ios?.buildNumber);
assert.equal(distribution.releaseVersion.androidVersionCode, expo.android?.versionCode);
assert.equal(distribution.releaseVersion.monotonicBuildIdentifiersRequired, true);

assert.equal(distribution.credentialBoundary.repositoryStoresPrivateSigningMaterial, false);
assert.equal(distribution.credentialBoundary.workflowSecretsOnly, true);
assert.equal(
  distribution.credentialBoundary.android.uploadCertificateIsNotDeliveredAppSigningCertificate,
  true,
  "Play upload certificate and delivered Play App Signing certificate must remain distinct authorities"
);
assert.equal(
  distribution.credentialBoundary.android.playDeliveredAppSigningCertificateSource,
  "google_play_console_after_play_app_signing_enrollment"
);
assert.equal(
  distribution.credentialBoundary.android.playDeliveredAppSigningCertificateEnvironmentKey,
  "MOBILE_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS"
);
assert.equal(distribution.credentialBoundary.ios.appleTeamIdEnvironmentKey, "MOBILE_IOS_APPLE_TEAM_ID");
assert.equal(distribution.credentialBoundary.ios.requiredBundleIdentifier, "com.bejewely.mobile");

const expectedSecretNames = new Set([
  "MOBILE_ANDROID_UPLOAD_KEYSTORE_BASE64",
  "MOBILE_ANDROID_UPLOAD_KEYSTORE_PASSWORD",
  "MOBILE_ANDROID_UPLOAD_KEY_ALIAS",
  "MOBILE_ANDROID_UPLOAD_KEY_PASSWORD",
  "MOBILE_ANDROID_UPLOAD_CERT_SHA256",
  "MOBILE_IOS_DISTRIBUTION_CERT_P12_BASE64",
  "MOBILE_IOS_DISTRIBUTION_CERT_PASSWORD",
  "MOBILE_IOS_APP_STORE_PROFILE_BASE64",
  "MOBILE_IOS_EXPORT_OPTIONS_PLIST_BASE64"
]);
const configuredSecretNames = new Set([
  distribution.credentialBoundary.android.uploadKeystoreBase64Secret,
  distribution.credentialBoundary.android.uploadKeystorePasswordSecret,
  distribution.credentialBoundary.android.uploadKeyAliasSecret,
  distribution.credentialBoundary.android.uploadKeyPasswordSecret,
  distribution.credentialBoundary.android.expectedUploadCertificateSha256Secret,
  distribution.credentialBoundary.ios.distributionCertificateP12Base64Secret,
  distribution.credentialBoundary.ios.distributionCertificatePasswordSecret,
  distribution.credentialBoundary.ios.appStoreProvisioningProfileBase64Secret,
  distribution.credentialBoundary.ios.exportOptionsPlistBase64Secret
]);
assert.deepEqual([...configuredSecretNames].sort(), [...expectedSecretNames].sort());

const authorityById = new Map(distribution.externalAuthority.map((entry) => [entry.id, entry]));
for (const id of [
  "ios_bundle_id_registration",
  "app_store_connect_app_record",
  "ios_distribution_certificate_and_profile",
  "android_package_registration",
  "play_app_signing_enrollment",
  "android_upload_key",
  "testflight_internal_distribution",
  "play_internal_testing",
  "physical_device_qa"
]) {
  assert.equal(authorityById.get(id)?.status, "pending", `External authority must remain pending until verified: ${id}`);
}
assert.equal(distribution.closeoutRule.signedArtifactBuildAloneDoesNotCloseSlice, true);

// Source-control and workflow secret-safety boundary.
for (const ignoredPattern of ["*.jks", "*.keystore", "*.p12", "*.p8", "*.mobileprovision"]) {
  assert.ok(gitignoreSource.split(/\r?\n/).includes(ignoredPattern), `Signing material must be gitignored: ${ignoredPattern}`);
}
assert.match(workflowSource, /workflow_dispatch:/);
assert.match(workflowSource, /name:\s+MOBILE-15 Source Contract/);
assert.equal(
  [...workflowSource.matchAll(/github\.event_name == 'workflow_dispatch'/g)].length,
  2,
  "Signed Android/iOS jobs must be gated exclusively behind manual workflow_dispatch"
);
for (const secretName of [...expectedSecretNames, "MOBILE_IOS_APPLE_TEAM_ID"]) {
  assert.ok(workflowSource.includes(`secrets.${secretName}`), `Workflow must source signing authority from GitHub secrets: ${secretName}`);
}
assert.match(workflowSource, /Missing required MOBILE-15 Android signing authority/);
assert.match(workflowSource, /Missing required MOBILE-15 iOS signing authority/);
assert.match(workflowSource, /test "\$\(git rev-parse HEAD\)" = "\$\{\{ github\.sha \}\}"/);
assert.match(workflowSource, /if:\s+always\(\)/);

const androidJobSource = workflowSource.split("\n  android-signed-distribution:")[1]?.split("\n  ios-signed-distribution:")[0] || "";
const iosJobSource = workflowSource.split("\n  ios-signed-distribution:")[1] || "";
assert.ok(androidJobSource, "Android signed distribution job is missing");
assert.ok(iosJobSource, "iOS signed distribution job is missing");
assert.match(androidJobSource, /apps\/mobile\/android\/app\/build\/outputs\/bundle\/release\/app-release\.aab/);
assert.match(androidJobSource, /apps\/mobile\/mobile15-android-signing-evidence\.txt/);
assert.ok(!/upload-artifact[\s\S]*?\.keystore/.test(androidJobSource), "Android upload artifact boundary must not include keystore material");
assert.match(iosJobSource, /apps\/mobile\/\.mobile-store-preflight\/export\/\*\.ipa/);
assert.match(iosJobSource, /apps\/mobile\/mobile15-ios-signing-evidence\.txt/);
const iosUploadBlock = iosJobSource.split("- name: Upload signed iOS distribution artifact")[1]?.split("- name: Remove ephemeral Apple signing material")[0] || "";
assert.ok(iosUploadBlock, "iOS signed artifact upload block is missing");
for (const forbiddenArtifact of [".p12", ".p8", ".mobileprovision", "keychain-db", "export-options.plist"]) {
  assert.ok(!iosUploadBlock.includes(forbiddenArtifact), `iOS upload artifact boundary must exclude signing material: ${forbiddenArtifact}`);
}
assert.match(iosJobSource, /security delete-keychain/);
assert.match(iosJobSource, /rm -f[\s\S]*mobile15-distribution\.p12/);
console.log("MOBILE_15_SECRET_SAFE_WORKFLOW_BOUNDARY=PASS");

const fixture = `android {\n    signingConfigs {\n        debug {\n            storeFile file('debug.keystore')\n        }\n    }\n    buildTypes {\n        debug {\n            signingConfig signingConfigs.debug\n        }\n        release {\n            signingConfig signingConfigs.debug\n            minifyEnabled false\n        }\n    }\n}\n`;
const patchedFixture = patchAndroidReleaseSigning(fixture);
assert.ok(patchedFixture.includes(MOBILE15_ANDROID_SIGNING_MARKER));
assert.match(patchedFixture, /MOBILE_ANDROID_UPLOAD_KEYSTORE_PATH/);
assert.match(patchedFixture, /release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/);
assert.equal(patchAndroidReleaseSigning(patchedFixture), patchedFixture, "Android signing patch must be idempotent");
console.log("MOBILE_15_SOURCE_DISTRIBUTION_AUTHORITY=PASS");

if (mode === "android") {
  const gradlePath = join(mobileRoot, "android", "app", "build.gradle");
  assert.ok(existsSync(gradlePath), "Run Expo Android prebuild and MOBILE-15 signing configurator first");
  const gradle = readFileSync(gradlePath, "utf8");
  assert.ok(gradle.includes(MOBILE15_ANDROID_SIGNING_MARKER));
  assert.match(gradle, /release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/);
  assert.match(gradle, /MOBILE_ANDROID_UPLOAD_KEYSTORE_PATH/);
  assert.match(gradle, /MOBILE_ANDROID_UPLOAD_KEYSTORE_PASSWORD/);
  assert.match(gradle, /MOBILE_ANDROID_UPLOAD_KEY_ALIAS/);
  assert.match(gradle, /MOBILE_ANDROID_UPLOAD_KEY_PASSWORD/);
  console.log("MOBILE_15_ANDROID_UPLOAD_SIGNING_CONFIG=PASS");
}

if (mode === "ios") {
  const projectPath = join(mobileRoot, "ios", "BEJEWELY.xcodeproj", "project.pbxproj");
  const entitlementsPath = join(mobileRoot, "ios", "BEJEWELY", "BEJEWELY.entitlements");
  assert.ok(existsSync(projectPath), "Run Expo iOS prebuild first");
  assert.ok(existsSync(entitlementsPath), "Generated iOS entitlements are required for distribution signing");
  const project = readFileSync(projectPath, "utf8");
  const entitlements = readFileSync(entitlementsPath, "utf8");
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*["']?com\.bejewely\.mobile["']?;/);
  assert.match(entitlements, /com\.apple\.developer\.associated-domains/);
  assert.match(entitlements, /applinks:k-beauty-two\.vercel\.app/);
  assert.match(entitlements, /com\.apple\.developer\.applesignin/);
  console.log("MOBILE_15_IOS_DISTRIBUTION_ENTITLEMENTS=PASS");
}

console.log("MOBILE_15_DISTRIBUTION_AUTHORITY=PASS");
