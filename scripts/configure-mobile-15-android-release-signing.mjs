import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultGradlePath = join(repoRoot, "apps", "mobile", "android", "app", "build.gradle");

export const MOBILE15_ANDROID_SIGNING_MARKER = "MOBILE-15 upload signing authority";

const releaseSigningBlock = `
        // ${MOBILE15_ANDROID_SIGNING_MARKER}
        release {
            def uploadKeystorePath = System.getenv("MOBILE_ANDROID_UPLOAD_KEYSTORE_PATH")
            def uploadKeystorePassword = System.getenv("MOBILE_ANDROID_UPLOAD_KEYSTORE_PASSWORD")
            def uploadKeyAlias = System.getenv("MOBILE_ANDROID_UPLOAD_KEY_ALIAS")
            def uploadKeyPassword = System.getenv("MOBILE_ANDROID_UPLOAD_KEY_PASSWORD")
            if (!uploadKeystorePath || !uploadKeystorePassword || !uploadKeyAlias || !uploadKeyPassword) {
                throw new GradleException("MOBILE-15 Android upload signing credentials are incomplete")
            }
            storeFile file(uploadKeystorePath)
            storePassword uploadKeystorePassword
            keyAlias uploadKeyAlias
            keyPassword uploadKeyPassword
        }
`;

export function patchAndroidReleaseSigning(source) {
  assert.equal(typeof source, "string");
  assert.ok(source.includes("signingConfigs {"), "Generated Android build.gradle has no signingConfigs block");
  assert.ok(source.includes("buildTypes {"), "Generated Android build.gradle has no buildTypes block");

  let next = source;
  if (!next.includes(MOBILE15_ANDROID_SIGNING_MARKER)) {
    next = next.replace("    signingConfigs {", `    signingConfigs {${releaseSigningBlock}`);
  }

  const releaseUsesUploadSigning = /release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/.test(next);
  if (!releaseUsesUploadSigning) {
    const releaseDebugPattern = /(release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
    assert.match(
      next,
      releaseDebugPattern,
      "Generated Android release build no longer exposes the expected Expo signing placeholder"
    );
    next = next.replace(releaseDebugPattern, "$1signingConfig signingConfigs.release");
  }

  assert.ok(next.includes(MOBILE15_ANDROID_SIGNING_MARKER));
  assert.match(next, /release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/);
  return next;
}

function main() {
  const requestedPath = process.argv[2] ? resolve(process.argv[2]) : defaultGradlePath;
  const source = readFileSync(requestedPath, "utf8");
  const next = patchAndroidReleaseSigning(source);
  writeFileSync(requestedPath, next);
  console.log(`MOBILE_15_ANDROID_RELEASE_SIGNING_CONFIGURED=${requestedPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
