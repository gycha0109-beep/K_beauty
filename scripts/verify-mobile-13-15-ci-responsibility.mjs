#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const m13 = read(".github/workflows/mobile-13-store-release-preflight.yml");
const m14 = read(".github/workflows/mobile-14-auth-app-links.yml");
const m15 = read(".github/workflows/mobile-15-distribution-authority.yml");
const matrix = JSON.parse(read("docs/ci/consolidation-audits/mobile-13-15-runtime-matrix.json"));
const phaseB = JSON.parse(read("docs/ci/consolidation-audits/phase-b-policy.json"));

const section = (source, start, end = null) => {
  const tail = source.split(start)[1] || "";
  return end ? (tail.split(end)[0] || "") : tail;
};

assert.match(m13, /^name: BEJEWELY Mobile 13 Store Release Preflight$/m);
assert.ok(m13.includes("  workflow_dispatch:"), "MOBILE-13 manual dispatch must remain");
assert.ok(!m13.includes("  pull_request:"), "MOBILE-13 must remain off routine PR execution");
assert.ok(!m13.includes("  push:"), "MOBILE-13 must remain off routine push execution");
for (const token of [
  "Build release AAB without production upload signing",
  "Verify Android 16 KB page-size bundle contract",
  "Upload Android release preflight artifact",
  "Build unsigned Release archive",
]) assert.ok(m13.includes(token), `MOBILE-13 unique release coverage missing: ${token}`);

assert.match(m14, /^name: BEJEWELY Mobile 14 Auth and App Links$/m);
for (const token of ["  pull_request:", "  push:", "  workflow_dispatch:"]) {
  assert.ok(m14.includes(token), `MOBILE-14 trigger missing: ${token.trim()}`);
}
for (const token of [
  "npm run prebuild:android --workspace @bejewely/mobile",
  "node scripts/verify-mobile-13-store-release-preflight.mjs --platform android",
  "node scripts/verify-mobile-14-auth-app-links.mjs --platform android",
  "npm run prebuild:ios --workspace @bejewely/mobile",
  "node scripts/verify-mobile-13-store-release-preflight.mjs --platform ios",
  "node scripts/verify-mobile-14-auth-app-links.mjs --platform ios",
]) assert.ok(m14.includes(token), `MOBILE-14 generated-native authority missing: ${token}`);

assert.match(m15, /^name: BEJEWELY Mobile 15 Distribution Authority$/m);
assert.ok(m15.includes("name: MOBILE-15 Source Contract"));
assert.ok(m15.includes("name: Android Signed Distribution AAB"));
assert.ok(m15.includes("name: iOS Signed Distribution IPA"));

const automatic = m15.split("  workflow_dispatch:")[0];
for (const retired of matrix.automaticTriggerRetirements["mobile-15-distribution-authority.yml"]) {
  assert.ok(!automatic.includes(`- "${retired}"`), `MOBILE-15 automatic trigger still owns retired prerequisite: ${retired}`);
}

const sourceContract = section(m15, "\n  source-contract:", "\n  android-signed-distribution:");
assert.ok(sourceContract.includes("npm run verify:mobile-foundation"));
assert.ok(sourceContract.includes("npm run mobile:typecheck"));
assert.ok(sourceContract.includes("npm run mobile:config"));
assert.ok(sourceContract.includes("node scripts/verify-mobile-15-distribution-authority.mjs"));
assert.ok(!sourceContract.includes("verify-mobile-13-store-release-preflight.mjs"), "MOBILE-15 routine source contract must not execute MOBILE-13");
assert.ok(!sourceContract.includes("verify-mobile-14-auth-app-links.mjs"), "MOBILE-15 routine source contract must not re-execute MOBILE-14");

const androidSigned = section(m15, "\n  android-signed-distribution:", "\n  ios-signed-distribution:");
for (const token of [
  "github.event_name == 'workflow_dispatch'",
  "node scripts/verify-mobile-13-store-release-preflight.mjs --platform android",
  "node scripts/verify-mobile-14-auth-app-links.mjs --platform android",
  "node scripts/verify-mobile-15-distribution-authority.mjs --platform android",
  "MOBILE_ANDROID_UPLOAD_KEYSTORE_BASE64",
  "Build signed release AAB",
  "Upload signed Android distribution artifact",
]) assert.ok(androidSigned.includes(token), `MOBILE-15 Android signing boundary missing: ${token}`);

const iosSigned = section(m15, "\n  ios-signed-distribution:");
for (const token of [
  "github.event_name == 'workflow_dispatch'",
  "node scripts/verify-mobile-13-store-release-preflight.mjs --platform ios",
  "node scripts/verify-mobile-14-auth-app-links.mjs --platform ios",
  "node scripts/verify-mobile-15-distribution-authority.mjs --platform ios",
  "MOBILE_IOS_DISTRIBUTION_CERT_P12_BASE64",
  "Build signed iOS distribution archive",
  "Export signed IPA",
  "Upload signed iOS distribution artifact",
  "Remove ephemeral Apple signing material",
]) assert.ok(iosSigned.includes(token), `MOBILE-15 iOS signing boundary missing: ${token}`);

const cluster = phaseB.clusters?.["mobile-release-13-15"];
assert.equal(cluster?.runtimeMatrix, "docs/ci/consolidation-audits/mobile-13-15-runtime-matrix.json");
assert.equal(cluster?.manualReleasePreflightOwner, "mobile-13-store-release-preflight.yml");
assert.equal(cluster?.nativeAuthLinkOwner, "mobile-14-auth-app-links.yml");
assert.equal(cluster?.distributionSigningOwner, "mobile-15-distribution-authority.yml");
for (const workflow of [
  "mobile-13-store-release-preflight.yml",
  "mobile-14-auth-app-links.yml",
  "mobile-15-distribution-authority.yml",
]) {
  assert.ok(
    !(phaseB.approvedRetiredWorkflows || []).includes(workflow),
    `Mobile 13-15 workflow must not be retired by another Phase B cluster: ${workflow}`,
  );
}
const expectedWorkflowCount =
  phaseB.baselineWorkflowCount +
  (phaseB.approvedAddedWorkflows || []).length -
  (phaseB.approvedRetiredWorkflows || []).length;

console.log(`MOBILE_13_15_CI_RESPONSIBILITY=PASS mobile13_manual=1 mobile14_native_owner=1 mobile15_source_duplicate_mobile14=0 mobile15_signed_platform_rechecks=2 signing_authority_preserved=1 workflow_inventory=${expectedWorkflowCount}`);
