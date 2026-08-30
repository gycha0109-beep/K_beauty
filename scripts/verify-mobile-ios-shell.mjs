import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const iosRoot = join(mobileRoot, "ios");

const appConfig = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8"));
const mobilePackage = JSON.parse(readFileSync(join(mobileRoot, "package.json"), "utf8"));
const mobileIgnore = readFileSync(join(mobileRoot, ".gitignore"), "utf8");
const iosWorkflow = readFileSync(join(repoRoot, ".github", "workflows", "mobile-ios-shell.yml"), "utf8");
const faceGuideConfig = JSON.parse(
  readFileSync(join(mobileRoot, "modules", "bejewely-face-guide", "expo-module.config.json"), "utf8")
);
const expo = appConfig.expo || {};

assert.equal(expo.scheme, "bejewely", "MOBILE-12 must preserve the existing custom scheme");
assert.equal(expo.orientation, "portrait", "MOBILE-12 must preserve portrait orientation");
assert.equal(expo.userInterfaceStyle, "automatic", "MOBILE-12 must preserve automatic system appearance");
assert.equal(expo.ios?.bundleIdentifier, "com.bejewely.mobile", "Unexpected pre-store iOS bundle identifier");
assert.equal(expo.ios?.supportsTablet, false, "MOBILE-12 simulator scope is phone-first");
assert.ok(!Object.hasOwn(expo.ios || {}, "associatedDomains"), "Universal Links remain out of MOBILE-12 scope");
assert.match(mobileIgnore, /^ios\/$/m, "Generated iOS project must stay untracked");
assert.equal(
  mobilePackage.scripts?.["prebuild:ios"],
  "expo prebuild --platform ios --clean --no-install",
  "MOBILE-12 must expose the clean iOS CNG command"
);
assert.deepEqual(
  faceGuideConfig.platforms,
  ["android"],
  "The Android ML Kit face-guide module must not be linked into the iOS shell"
);
assert.match(
  iosWorkflow,
  /DEVELOPER_DIR:\s*\/Applications\/Xcode_26\.2\.app\/Contents\/Developer/,
  "MOBILE-12 CI must pin an Xcode toolchain with Swift tools 6.2 support"
);
assert.match(
  iosWorkflow,
  /test \"\$\(xcodebuild -version \| sed -n '1p'\)\" = \"Xcode 26\.2\"/,
  "MOBILE-12 CI must attest the pinned Xcode version before native generation/build"
);

const forbiddenBundleTokens = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "POLAR_ACCESS_TOKEN",
  "STRIPE_SECRET_KEY",
];
const appJsonSource = readFileSync(join(mobileRoot, "app.json"), "utf8");
for (const token of forbiddenBundleTokens) {
  assert.ok(!appJsonSource.includes(token), `Forbidden server secret token leaked into iOS app config: ${token}`);
}

console.log("MOBILE_IOS_SOURCE_CONFIG=PASS");
console.log("MOBILE_IOS_PLATFORM_BOUNDARY=PASS");
console.log("MOBILE_IOS_XCODE_TOOLCHAIN_PIN=PASS");

assert.ok(existsSync(iosRoot), "Run Expo iOS prebuild before the MOBILE-12 generated-native verifier");

const projectFile = join(iosRoot, "BEJEWELY.xcodeproj", "project.pbxproj");
const infoPlistFile = join(iosRoot, "BEJEWELY", "Info.plist");
const podfile = join(iosRoot, "Podfile");

assert.ok(existsSync(projectFile), "Generated BEJEWELY Xcode project is missing");
assert.ok(existsSync(infoPlistFile), "Generated BEJEWELY Info.plist is missing");
assert.ok(existsSync(podfile), "Generated iOS Podfile is missing");

const project = readFileSync(projectFile, "utf8");
const infoPlist = readFileSync(infoPlistFile, "utf8");

assert.match(
  project,
  /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*["']?com\.bejewely\.mobile["']?;/,
  "Generated iOS bundle identifier drifted from app config"
);
assert.match(infoPlist, /<string>bejewely<\/string>/, "Generated Info.plist lost the bejewely URL scheme");
assert.match(infoPlist, /<key>NSCameraUsageDescription<\/key>/, "Generated Info.plist lost camera usage disclosure");
assert.doesNotMatch(project, /com\.apple\.developer\.associated-domains/, "Universal Links entitlement is outside MOBILE-12");
assert.doesNotMatch(infoPlist, /applinks:/, "Universal Links are outside MOBILE-12");

console.log("MOBILE_IOS_GENERATED_CONTRACT=PASS");
console.log("MOBILE_IOS_HOSTED_LINKS_EXCLUDED=PASS");
console.log("MOBILE_IOS_STORE_SIGNING_EXCLUDED=PASS");
console.log("MOBILE_12_IOS_NATIVE_SHELL=PASS");
