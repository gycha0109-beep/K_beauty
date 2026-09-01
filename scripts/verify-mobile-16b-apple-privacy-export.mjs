import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const appConfig = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8"));
const readiness = JSON.parse(readFileSync(join(mobileRoot, "store-readiness.json"), "utf8"));
const mobilePackage = JSON.parse(readFileSync(join(mobileRoot, "package.json"), "utf8"));
const sharedPackage = JSON.parse(readFileSync(join(repoRoot, "packages", "shared", "package.json"), "utf8"));
const expo = appConfig.expo || {};
const ios = expo.ios || {};
const mode = process.argv.includes("--platform")
  ? process.argv[process.argv.indexOf("--platform") + 1]
  : "source";

assert.ok(["source", "ios"].includes(mode), `Unsupported MOBILE-16B platform: ${mode}`);

const expectedRequiredReasons = new Map([
  ["NSPrivacyAccessedAPICategoryUserDefaults", ["CA92.1"]],
  ["NSPrivacyAccessedAPICategoryFileTimestamp", ["C617.1"]],
  ["NSPrivacyAccessedAPICategorySystemBootTime", ["35F9.1"]]
]);

function normalizeReasonEntries(entries) {
  return new Map(
    (entries || []).map((entry) => [
      entry.NSPrivacyAccessedAPIType,
      [...(entry.NSPrivacyAccessedAPITypeReasons || [])].sort()
    ])
  );
}

function assertRequiredReasons(entries, label) {
  const actual = normalizeReasonEntries(entries);
  assert.deepEqual(
    [...actual.keys()].sort(),
    [...expectedRequiredReasons.keys()].sort(),
    `${label} required-reason API categories drifted`
  );
  for (const [category, reasons] of expectedRequiredReasons) {
    assert.deepEqual(actual.get(category), [...reasons].sort(), `${label} reasons drifted for ${category}`);
  }
}

const privacy = ios.privacyManifests || {};
assert.equal(privacy.NSPrivacyTracking, false, "MOBILE-16B forbids app-owned tracking");
assert.deepEqual(privacy.NSPrivacyTrackingDomains || [], [], "Tracking domains must remain empty");
assertRequiredReasons(privacy.NSPrivacyAccessedAPITypes, "Expo source privacy manifest");
assert.equal(
  ios.infoPlist?.ITSAppUsesNonExemptEncryption,
  false,
  "Export-compliance source must declare exempt-only/no non-exempt encryption"
);

const contract = readiness.mobile16BContract;
assert.ok(contract, "Missing MOBILE-16B readiness contract");
assert.equal(contract.applePrivacyManifest.source, "expo.ios.privacyManifests");
assert.equal(contract.applePrivacyManifest.tracking, false);
assert.equal(contract.applePrivacyManifest.appStoreUploadValidationStatus, "external_pending");
assert.equal(contract.exportCompliance.infoPlistKey, "ITSAppUsesNonExemptEncryption");
assert.equal(contract.exportCompliance.value, false);
assert.equal(contract.exportCompliance.classification, "exempt_only");
assert.equal(contract.exportCompliance.appStoreConnectConfirmationStatus, "external_pending");
assertRequiredReasons(contract.applePrivacyManifest.requiredReasonApis, "MOBILE-16B readiness contract");

const compliance = new Map(readiness.complianceInventory.map((item) => [item.id, item]));
assert.equal(
  compliance.get("apple_privacy_manifest_required_reason_audit")?.status,
  "repository_implemented_app_store_upload_validation_pending"
);
assert.equal(
  compliance.get("apple_export_compliance")?.status,
  "repository_implemented_app_store_connect_confirmation_pending"
);

const externalBlockers = new Map(readiness.externalBlockers.map((item) => [item.id, item]));
assert.equal(externalBlockers.get("apple_privacy_manifest_app_store_validation")?.status, "external_pending");
assert.equal(externalBlockers.get("apple_export_compliance_confirmation")?.status, "external_pending");

const dependencyNames = new Set([
  ...Object.keys(mobilePackage.dependencies || {}),
  ...Object.keys(mobilePackage.devDependencies || {}),
  ...Object.keys(sharedPackage.dependencies || {}),
  ...Object.keys(sharedPackage.devDependencies || {})
]);
for (const dependency of dependencyNames) {
  assert.ok(
    !/(?:^|[-_/])(crypto-js|tweetnacl|libsodium|sodium|quick-crypto)(?:$|[-_/])/i.test(dependency),
    `Potential app-owned cryptography dependency requires export-compliance reassessment: ${dependency}`
  );
}

console.log("MOBILE_16B_APPLE_PRIVACY_SOURCE=PASS");
console.log("MOBILE_16B_EXPORT_COMPLIANCE_SOURCE=PASS");

if (mode === "ios") {
  const iosRoot = join(mobileRoot, "ios");
  const infoPlistPath = join(iosRoot, "BEJEWELY", "Info.plist");
  const privacyManifestPath = join(iosRoot, "BEJEWELY", "PrivacyInfo.xcprivacy");
  assert.ok(existsSync(infoPlistPath), "Run Expo iOS prebuild before MOBILE-16B iOS verification");
  assert.ok(existsSync(privacyManifestPath), "Generated app PrivacyInfo.xcprivacy is required");

  const infoPlist = readFileSync(infoPlistPath, "utf8");
  const privacyManifest = readFileSync(privacyManifestPath, "utf8");
  assert.match(
    infoPlist,
    /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\s*\/>/,
    "Generated Info.plist must carry ITSAppUsesNonExemptEncryption=false"
  );
  assert.match(privacyManifest, /<key>NSPrivacyTracking<\/key>\s*<false\s*\/>/);
  for (const [category, reasons] of expectedRequiredReasons) {
    assert.ok(privacyManifest.includes(category), `Generated privacy manifest missing ${category}`);
    for (const reason of reasons) {
      assert.ok(privacyManifest.includes(reason), `Generated privacy manifest missing reason ${reason}`);
    }
  }

  function findPrivacyManifests(root, found = []) {
    if (!existsSync(root)) return found;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) findPrivacyManifests(path, found);
      else if (entry.name === "PrivacyInfo.xcprivacy") found.push(path);
    }
    return found;
  }

  const manifests = findPrivacyManifests(iosRoot);
  assert.ok(manifests.length > 0, "Generated iOS project must contain privacy manifests");
  for (const manifestPath of manifests) {
    const source = readFileSync(manifestPath, "utf8");
    assert.ok(
      !/<key>NSPrivacyTracking<\/key>\s*<true\s*\/>/.test(source),
      `Tracking-enabled privacy manifest requires explicit review: ${manifestPath}`
    );
  }
  console.log(`MOBILE_16B_IOS_PRIVACY_MANIFEST_FILES=${manifests.length}`);
  console.log("MOBILE_16B_GENERATED_PRIVACY_EXPORT=PASS");
}

console.log("MOBILE_16B_APPLE_PRIVACY_EXPORT=PASS");
