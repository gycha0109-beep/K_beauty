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

const rootPackageTriggers = [
  '- "package.json"',
  "- 'package.json'",
  '- "package-lock.json"',
  "- 'package-lock.json'",
];

const historicalTrustWorkflows = readdirSync(".github/workflows")
  .filter((name) => /^trust-p\d/i.test(name) && /\.ya?ml$/i.test(name));
assert.deepEqual(
  historicalTrustWorkflows,
  [],
  `historical TRUST-P workflows must stay retired: ${historicalTrustWorkflows.join(", ")}`,
);

const dataOfferWorkflows = readdirSync(".github/workflows")
  .filter((name) => /^data-offer\d/i.test(name) && /\.ya?ml$/i.test(name))
  .sort();
assert.deepEqual(
  dataOfferWorkflows,
  [
    "data-offer17-controlled-offer-rpc-diagnostic.yml",
    "data-offer17-offer-runtime-observability.yml",
  ],
  `DATA-OFFER workflow topology drift: ${dataOfferWorkflows.join(", ")}`,
);

const controlledOfferWorkflow = read(
  ".github/workflows/data-offer17-controlled-offer-rpc-diagnostic.yml",
);
const controlledOfferPushSection = controlledOfferWorkflow.split("  pull_request:")[0];
assert(
  controlledOfferPushSection.includes("    paths:"),
  "DATA-OFFER17 deployed production diagnostic must not run on every main push",
);
assertContains(".github/workflows/data-offer17-controlled-offer-rpc-diagnostic.yml", [
  "cancel-in-progress: true",
]);

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
assertContains(".github/workflows/mobile-ci.yml", [
  "node scripts/verify-mobile-initial-entry-routing.mjs",
  "node scripts/verify-mobile-camera-foundation.mjs",
  "node scripts/verify-mobile-face-guidance.mjs",
]);
assertContains(".github/workflows/mobile-native-shell.yml", [
  "npm run mobile:prebuild:android",
  "npm run verify:mobile-native",
]);
for (const path of [
  "scripts/verify-mobile-camera-foundation.mjs",
  "scripts/verify-mobile-face-guidance.mjs",
]) {
  assertNotContains(path, [
    "mobile-camera.yml",
    "mobile-face-guidance.yml",
  ]);
}

for (const path of [
  ".github/workflows/mobile-20a-store-capture.yml",
  ".github/workflows/mobile-20b-store-capture.yml",
]) {
  assertContains(path, [
    "android-actions/setup-android@v4",
    "packages: ''",
  ]);
}

assertContains(".github/workflows/admin-product-current-main-integration.yml", [
  "node-version: 22",
]);

const trustPhaseWorkflows = [
  ".github/workflows/trust-phase1-intake-foundation.yml",
  ".github/workflows/trust-phase2-subject-resolution.yml",
  ".github/workflows/trust-phase3-research-worker.yml",
  ".github/workflows/trust-phase4-controlled-evidence-adoption.yml",
  ".github/workflows/trust-phase5-admin-queue.yml",
  ".github/workflows/trust-phase5b-subject-registration.yml",
  ".github/workflows/trust-phase5c-fation-formulation-conflict.yml",
  ".github/workflows/trust-phase6a-reentry.yml",
];
for (const path of trustPhaseWorkflows) {
  assertContains(path, ["actions/checkout@v7", "actions/setup-node@v7", "node-version: 22"]);
  assertNotContains(path, ["node-version: 20"]);
}

const modernizedNodeWorkflows = [
  ".github/workflows/admin-access-foundation.yml",
  ".github/workflows/face-eval-cx1g-d2d-ui1-korean-review-ui-v1.yml",
  ".github/workflows/face-eval-cx1g-d2d-xp-hosted-intake-v1.yml",
  ".github/workflows/face-lab-neutral-review-operator-v1.yml",
  ".github/workflows/legacy-offer-classifier.yml",
  ".github/workflows/product-identity-key-repair-confirm.yml",
  ".github/workflows/product-identity-resolution.yml",
  ".github/workflows/product-offers.yml",
  ".github/workflows/product-source-bindings.yml",
];
for (const path of modernizedNodeWorkflows) {
  assertContains(path, ["actions/checkout@v7", "actions/setup-node@v7", "node-version: 22"]);
  assertNotContains(path, ["actions/checkout@v4", "actions/setup-node@v4", "node-version: 20"]);
}
for (const path of trustPhaseWorkflows.filter((path) => !path.includes("phase5c-"))) {
  assertNotContains(path, ["npm run architecture:guard", "npm run build"]);
}
assertContains("scripts/verify-current-main-health.mjs", [
  'run("Mobile initial-entry routing contract"',
  'run("TRUST Phase 1 intake contract"',
  'run("TRUST Phase 2 subject resolution contract"',
  'run("TRUST Phase 3 research worker contract"',
  'run("TRUST Phase 4 controlled evidence adoption"',
  'run("TRUST Phase 5 admin queue contract"',
  'run("TRUST Phase 5B subject registration contract"',
  'run("TRUST Phase 5C formulation conflict HOLD"',
  'run("TRUST Phase 6A reentry contract"',
]);
assertContains(".github/workflows/trust-phase5c-fation-formulation-conflict.yml", [
  "concurrency:",
  "cancel-in-progress: true",
]);
assertNotContains(".github/workflows/admin-product-current-main-integration.yml", [
  "node-version: 20",
]);

for (const path of [
  ".github/workflows/mobile-14-auth-app-links.yml",
  ".github/workflows/mobile-15-distribution-authority.yml",
  ".github/workflows/mobile-20b-store-capture.yml",
]) {
  assertNotContains(path, rootPackageTriggers);
}

const g3aWorkflow = read(".github/workflows/v21-admission-g3a-pf-authority-read.yml");
const g3aPushSection = g3aWorkflow.split("  pull_request:")[0];
assert(
  g3aPushSection.includes("    paths:"),
  "G3A deployed runtime probe must not run on every main push",
);
assertContains(".github/workflows/v21-admission-g3a-pf-authority-read.yml", [
  "cancel-in-progress: true",
]);

const dataAi3Workflow = read(".github/workflows/data-ai3-product-query-shadow.yml");
const dataAi3PushSection = dataAi3Workflow.split("  pull_request:")[0];
assert(
  dataAi3PushSection.includes("    paths:"),
  "DATA-AI3 deployed shadow probe must not run on every main push",
);
assertContains(".github/workflows/data-ai3-product-query-shadow.yml", [
  "cancel-in-progress: true",
  "actions/checkout@v7",
  "actions/setup-node@v7",
  "node-version: 22",
]);
assertNotContains(".github/workflows/mobile-14-auth-app-links.yml", [
  '- "apps/mobile/**"',
  "source-and-web:",
]);
assertContains(".github/workflows/mobile-store-readiness.yml", [
  '- "app/.well-known/**"',
]);

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

const workflowFiles = readdirSync(".github/workflows")
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();
const retiredFirstPartyActionMajors = [
  "actions/checkout@v4",
  "actions/setup-node@v4",
  "actions/upload-artifact@v4",
];
for (const name of workflowFiles) {
  const source = read(`.github/workflows/${name}`);
  for (const action of retiredFirstPartyActionMajors) {
    assert(
      !source.includes(action),
      `.github/workflows/${name} must not use retired first-party action runtime: ${action}`,
    );
  }
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
  operational_data_offer_workflows: 2,
  data_taxonomy_workflows: 3,
  face_eval_workflows: 2,
  retired_mobile_store_stage_workflows: 0,
  retired_mobile_app_stage_workflows: 0,
  heavy_mobile_root_package_triggers: 0,
  g3a_unbounded_main_push: false,
  data_ai3_unbounded_main_push: false,
  cross_domain_root_package_triggers: 0,
  reverse_canonical_health_triggers: 0,
  superseded_pr_run_cancellation: true,
  routine_pr_heavy_release_gates: 0,
  native_shell_ui_surface_triggers: 0,
  mobile_verifiers_follow_consolidated_topology: true,
  android_store_capture_sdk_setup_current: true,
  admin_integration_node22: true,
  trust_static_baseline_canonicalized: true,
  legacy_node20_workflows: 0,
  retired_first_party_action_runtimes: 0,
  ci_architecture_guard_diff_aware: true,
}, null, 2));
