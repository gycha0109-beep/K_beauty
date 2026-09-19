#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertNotContains(path, needles) {
  const source = read(path);
  for (const needle of needles) {
    assert(!source.includes(needle), `${path} contains over-broad trigger: ${needle}`);
  }
}

function assertContains(path, needles) {
  const source = read(path);
  for (const needle of needles) {
    assert(source.includes(needle), `${path} missing required trigger boundary: ${needle}`);
  }
}

const historicalTrustWorkflows = readdirSync(".github/workflows")
  .filter((name) => /^trust-p\d/i.test(name) && /\.ya?ml$/i.test(name));
assert.deepEqual(
  historicalTrustWorkflows,
  [],
  `historical TRUST-P workflows must stay retired: ${historicalTrustWorkflows.join(", ")}`,
);

const historicalDataOfferWorkflows = readdirSync(".github/workflows")
  .filter((name) => /^data-offer\d/i.test(name) && /\.ya?ml$/i.test(name));
assert.deepEqual(
  historicalDataOfferWorkflows,
  [],
  `historical DATA-OFFER workflows must stay retired: ${historicalDataOfferWorkflows.join(", ")}`,
);

const taxonomyWorkflows = readdirSync(".github/workflows")
  .filter((name) => /^data-taxonomy/i.test(name) && /\.ya?ml$/i.test(name))
  .sort();
assert.deepEqual(
  taxonomyWorkflows,
  [
    "data-taxonomy-ci.yml",
    "data-taxonomy13-catalog-only-candidate-approval.yml",
    "data-taxonomy15-catalog-only-trust-intake.yml",
  ],
  `DATA-TAXONOMY workflow topology drift: ${taxonomyWorkflows.join(", ")}`,
);

const faceEvalWorkflows = readdirSync(".github/workflows")
  .filter((name) => /^face-eval/i.test(name) && /\.ya?ml$/i.test(name))
  .sort();
assert.deepEqual(
  faceEvalWorkflows,
  [
    "face-eval-cx1g-d2d-ui1-korean-review-ui-v1.yml",
    "face-eval-cx1g-d2d-xp-hosted-intake-v1.yml",
  ],
  `FACE-EVAL workflow topology drift: ${faceEvalWorkflows.join(", ")}`,
);

const retiredMobileStoreStages = new Set([
  "mobile-16a-privacy-account-deletion.yml",
  "mobile-16c-google-data-safety.yml",
  "mobile-16d-google-play-health-declaration.yml",
  "mobile-16e-content-rating-readiness.yml",
  "mobile-16f-store-listing-claims.yml",
  "mobile-16g-production-icon-audit.yml",
  "mobile-16h-production-icons.yml",
  "mobile-17-production-surface.yml",
  "mobile-18-store-listing.yml",
  "mobile-19a-public-support.yml",
]);
const presentRetiredMobileStoreStages = readdirSync(".github/workflows")
  .filter((name) => retiredMobileStoreStages.has(name))
  .sort();
assert.deepEqual(
  presentRetiredMobileStoreStages,
  [],
  `retired mobile store stage workflows must stay retired: ${presentRetiredMobileStoreStages.join(", ")}`,
);
assertContains(".github/workflows/mobile-store-readiness.yml", [
  "concurrency:",
  "cancel-in-progress:",
]);
assertNotContains(".github/workflows/mobile-store-readiness.yml", rootPackageTriggers);

const retiredMobileAppStages = new Set([
  "mobile-foundation.yml",
  "mobile-camera.yml",
  "mobile-analyze.yml",
  "mobile-saved-report.yml",
  "mobile-public-share.yml",
  "mobile-public-result-deep-link.yml",
  "mobile-premium-entry.yml",
  "mobile-my-skin-diary.yml",
  "mobile-auth.yml",
  "mobile-face-guidance.yml",
]);
const presentRetiredMobileAppStages = readdirSync(".github/workflows")
  .filter((name) => retiredMobileAppStages.has(name))
  .sort();
assert.deepEqual(
  presentRetiredMobileAppStages,
  [],
  `retired mobile app stage workflows must stay retired: ${presentRetiredMobileAppStages.join(", ")}`,
);
assertContains(".github/workflows/mobile-ci.yml", [
  "concurrency:",
  "cancel-in-progress:",
  "npm run mobile:export:android",
]);
assertNotContains(".github/workflows/mobile-ci.yml", [
  ...rootPackageTriggers,
  "npm run mobile:prebuild:android",
  "npm run verify:mobile-native",
]);

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
]) {
  assertNotContains(path, rootPackageTriggers);
}

for (const path of [
  ".github/workflows/data-taxonomy-ci.yml",
  ".github/workflows/face-eval-cx1g-d2d-ui1-korean-review-ui-v1.yml",
  ".github/workflows/face-eval-cx1g-d2d-xp-hosted-intake-v1.yml",
]) {
  assertContains(path, [
    "concurrency:",
    "cancel-in-progress:",
  ]);
}

for (const path of [
  ".github/workflows/mobile-13-store-release-preflight.yml",
  ".github/workflows/mobile-20d-app-store-screenshots.yml",
]) {
  const source = read(path);
  assert(!/\n\s*pull_request\s*:/.test(source), `${path} must not auto-run on pull requests`);
  assertContains(path, ["workflow_dispatch:"]);
}

const nativeBroadTriggers = [
  '- "apps/mobile/app/**"',
  '- "apps/mobile/components/**"',
  '- "apps/mobile/features/**"',
  '- "apps/mobile/lib/**"',
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
  ]);
}

const architectureGuard = read("scripts/architecture-guard.mjs");
assert(
  architectureGuard.includes("ARCHITECTURE_GUARD_BASE_SHA"),
  "architecture guard must consume an explicit CI base SHA",
);
assert(
  architectureGuard.includes("${ciBase}...HEAD"),
  "architecture guard must compare the CI base against HEAD",
);

const currentHealthWorkflow = read(".github/workflows/current-main-health.yml");
assert(
  currentHealthWorkflow.includes("ARCHITECTURE_GUARD_BASE_SHA:"),
  "current-main health must provide the PR/push base SHA to architecture guard",
);

console.log(JSON.stringify({
  status: "PASS",
  historical_trust_p_workflows: 0,
  historical_data_offer_workflows: 0,
  data_taxonomy_workflows: 3,
  face_eval_workflows: 2,
  retired_mobile_store_stage_workflows: 0,
  retired_mobile_app_stage_workflows: 0,
  cross_domain_root_package_triggers: 0,
  reverse_canonical_health_triggers: 0,
  superseded_pr_run_cancellation: true,
  routine_pr_heavy_release_gates: 0,
  native_shell_ui_surface_triggers: 0,
  ci_architecture_guard_diff_aware: true,
}, null, 2));
