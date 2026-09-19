#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertNotContains(path, forbidden) {
  const source = read(path);
  for (const needle of forbidden) {
    assert(
      !source.includes(needle),
      `${path} must not contain over-broad CI trigger: ${needle}`,
    );
  }
}

function assertContains(path, required) {
  const source = read(path);
  for (const needle of required) {
    assert(
      source.includes(needle),
      `${path} must retain CI trigger/authority: ${needle}`,
    );
  }
}

const rootPackageTriggers = [
  '- "package.json"',
  "- 'package.json'",
  '- "package-lock.json"',
  "- 'package-lock.json'",
];

for (const path of [
  ".github/workflows/admin-access-foundation.yml",
  ".github/workflows/admin-product-current-main-integration.yml",
  ".github/workflows/face-eval-cx1g-d2d-ui1-korean-review-ui-v1.yml",
  ".github/workflows/face-eval-cx1g-d2d-xp-hosted-intake-v1.yml",
  ".github/workflows/mobile-13-store-release-preflight.yml",
  ".github/workflows/mobile-15-distribution-authority.yml",
  ".github/workflows/mobile-20b-store-capture.yml",
]) {
  assertNotContains(path, rootPackageTriggers);
}

const nativeBroadTriggers = [
  '- "apps/mobile/app/**"',
  '- "apps/mobile/components/**"',
  '- "apps/mobile/features/**"',
  '- "apps/mobile/lib/**"',
  '- "apps/mobile/assets/**"',
  '- "packages/shared/**"',
  ...rootPackageTriggers,
];

for (const path of [
  ".github/workflows/mobile-native-shell.yml",
  ".github/workflows/mobile-ios-shell.yml",
]) {
  assertNotContains(path, nativeBroadTriggers);
  assertContains(path, [
    '- "apps/mobile/modules/**"',
    '- "apps/mobile/app.json"',
    '- "apps/mobile/package.json"',
    "workflow_dispatch:",
  ]);
}

const screenshots = read(".github/workflows/mobile-20d-app-store-screenshots.yml");
assert(!/\n\s*pull_request\s*:/.test(screenshots), "MOBILE-20D must not auto-run on pull requests");
assertContains(".github/workflows/mobile-20d-app-store-screenshots.yml", [
  "workflow_dispatch:",
  "branches: [main]",
  '- "apps/mobile/store-readiness.json"',
  '- "scripts/capture-mobile-20d-app-store-screenshots.sh"',
]);

console.log(JSON.stringify({
  status: "PASS",
  specialized_root_package_triggers: 0,
  native_shell_broad_ui_triggers: 0,
  mobile20d_pull_request_trigger: false,
}, null, 2));
