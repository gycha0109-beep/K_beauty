import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const appConfig = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8"));
const mobilePackage = JSON.parse(readFileSync(join(mobileRoot, "package.json"), "utf8"));
const readiness = JSON.parse(readFileSync(join(mobileRoot, "store-readiness.json"), "utf8"));
const authSource = readFileSync(join(mobileRoot, "lib", "auth.ts"), "utf8");
const mySource = readFileSync(join(mobileRoot, "app", "my.tsx"), "utf8");
const appleButtonSource = readFileSync(join(mobileRoot, "components", "NativeAppleSignInButton.tsx"), "utf8");
const aasaPath = join(repoRoot, "app", ".well-known", "apple-app-site-association", "route.js");
const assetlinksPath = join(repoRoot, "app", ".well-known", "assetlinks.json", "route.js");
const aasaSource = readFileSync(aasaPath, "utf8");
const assetlinksSource = readFileSync(assetlinksPath, "utf8");
const expo = appConfig.expo || {};
const platform = process.argv.includes("--platform") ? process.argv[process.argv.indexOf("--platform") + 1] : "source";

assert.ok(["source", "android", "ios"].includes(platform), `Unsupported platform: ${platform}`);
assert.equal(readiness.slice, "MOBILE-14");
assert.equal(readiness.status, "repository_ready_external_pending");
assert.equal(readiness.mobile14Contract.canonicalWebOrigin, "https://k-beauty-two.vercel.app");
assert.equal(readiness.mobile14Contract.googleOAuthRedirect, "bejewely://auth/callback");
assert.equal(readiness.mobile14Contract.verifiedLinkPathPrefix, "/r/");
assert.equal(readiness.mobile14Contract.associationMissingAuthorityBehavior, "http_503_fail_closed");
assert.equal(mobilePackage.dependencies?.["expo-apple-authentication"], "~57.0.1");

const plugins = new Set((expo.plugins || []).map((entry) => Array.isArray(entry) ? entry[0] : entry));
assert.ok(plugins.has("expo-apple-authentication"), "Expo Apple Authentication plugin must be frozen");
assert.equal(expo.ios?.usesAppleSignIn, true);
assert.deepEqual(expo.ios?.associatedDomains, ["applinks:k-beauty-two.vercel.app"]);

const appLinkFilter = (expo.android?.intentFilters || []).find((entry) =>
  entry.action === "VIEW" && entry.autoVerify === true && (entry.category || []).includes("BROWSABLE") && (entry.category || []).includes("DEFAULT")
);
assert.ok(appLinkFilter, "Android verified VIEW intent filter is required");
assert.ok((appLinkFilter.data || []).some((entry) =>
  entry.scheme === "https" && entry.host === "k-beauty-two.vercel.app" && entry.pathPrefix === "/r/"
), "Android App Link must be restricted to the canonical /r/ report prefix");

assert.match(authSource, /MOBILE_AUTH_REDIRECT_URL\s*=\s*["']bejewely:\/\/auth\/callback["']/);
assert.match(authSource, /signInWithOAuth\(\{\s*provider:\s*["']google["']/s);
assert.match(authSource, /signInNativeWithApple/);
assert.match(authSource, /AppleAuthentication\.signInAsync/);
assert.match(authSource, /signInWithIdToken\(\{\s*provider:\s*["']apple["']/s);
assert.match(mySource, /NativeAppleSignInButton/);
assert.match(mySource, /signInNativeWithApple/);
assert.match(appleButtonSource, /AppleAuthenticationButtonType\.SIGN_IN/);
assert.match(appleButtonSource, /accessibilityLabel=["']mobile-apple-sign-in["']/);

for (const [source, envKey] of [
  [aasaSource, "MOBILE_IOS_APPLE_TEAM_ID"],
  [assetlinksSource, "MOBILE_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS"]
]) {
  assert.ok(source.includes(envKey), `Association endpoint must use ${envKey}`);
  assert.match(source, /503/, "Missing external authority must fail closed with HTTP 503");
}
assert.match(aasaSource, /com\.bejewely\.mobile/);
assert.match(aasaSource, /\/r\/\*/);
assert.match(assetlinksSource, /com\.bejewely\.mobile/);
assert.match(assetlinksSource, /delegate_permission\/common\.handle_all_urls/);

async function verifyAssociationRuntime() {
  const oldTeamId = process.env.MOBILE_IOS_APPLE_TEAM_ID;
  const oldFingerprints = process.env.MOBILE_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS;
  try {
    delete process.env.MOBILE_IOS_APPLE_TEAM_ID;
    delete process.env.MOBILE_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS;
    const aasaModule = await import(`${pathToFileURL(aasaPath).href}?mobile14=${Date.now()}`);
    const assetlinksModule = await import(`${pathToFileURL(assetlinksPath).href}?mobile14=${Date.now()}`);
    assert.equal((await aasaModule.GET()).status, 503);
    assert.equal((await assetlinksModule.GET()).status, 503);

    process.env.MOBILE_IOS_APPLE_TEAM_ID = "ABCDE12345";
    process.env.MOBILE_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS = Array(32).fill("AA").join(":");
    const aasaOk = await aasaModule.GET();
    const assetlinksOk = await assetlinksModule.GET();
    assert.equal(aasaOk.status, 200);
    assert.equal(assetlinksOk.status, 200);
    const aasa = await aasaOk.json();
    const assetlinks = await assetlinksOk.json();
    assert.equal(aasa.applinks.details[0].appID, "ABCDE12345.com.bejewely.mobile");
    assert.equal(aasa.applinks.details[0].components[0]["/"], "/r/*");
    assert.equal(assetlinks[0].target.package_name, "com.bejewely.mobile");
    assert.equal(assetlinks[0].target.sha256_cert_fingerprints.length, 1);
  } finally {
    if (oldTeamId === undefined) delete process.env.MOBILE_IOS_APPLE_TEAM_ID;
    else process.env.MOBILE_IOS_APPLE_TEAM_ID = oldTeamId;
    if (oldFingerprints === undefined) delete process.env.MOBILE_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS;
    else process.env.MOBILE_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS = oldFingerprints;
  }
}

await verifyAssociationRuntime();
console.log("MOBILE_14_SOURCE_AUTH_AND_ASSOCIATION=PASS");

if (platform === "android") {
  const manifestPath = join(mobileRoot, "android", "app", "src", "main", "AndroidManifest.xml");
  assert.ok(existsSync(manifestPath), "Run Android prebuild before MOBILE-14 Android verification");
  const manifest = readFileSync(manifestPath, "utf8");
  assert.match(manifest, /android:autoVerify=["']true["']/);
  assert.match(manifest, /android:scheme=["']https["']/);
  assert.match(manifest, /android:host=["']k-beauty-two\.vercel\.app["']/);
  assert.match(manifest, /android:pathPrefix=["']\/r\/["']/);
  console.log("MOBILE_14_ANDROID_APP_LINK=PASS");
}

if (platform === "ios") {
  const entitlementsPath = join(mobileRoot, "ios", "BEJEWELY", "BEJEWELY.entitlements");
  assert.ok(existsSync(entitlementsPath), "Run iOS prebuild before MOBILE-14 iOS verification");
  const entitlements = readFileSync(entitlementsPath, "utf8");
  assert.match(entitlements, /com\.apple\.developer\.associated-domains/);
  assert.match(entitlements, /applinks:k-beauty-two\.vercel\.app/);
  assert.match(entitlements, /com\.apple\.developer\.applesignin/);
  console.log("MOBILE_14_IOS_ASSOCIATED_DOMAIN_AND_APPLE_SIGN_IN=PASS");
}

console.log("MOBILE_14_AUTH_APP_LINKS=PASS");
