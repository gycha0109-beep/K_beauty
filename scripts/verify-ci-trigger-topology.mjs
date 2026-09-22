#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

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

const retiredTrustDataGovernanceWorkflows = new Set([
  "trust-phase5-admin-queue.yml",
  "trust-phase5c-fation-formulation-conflict.yml",
  "trust-phase8a-revalidation-contract.yml",
]);

const presentRetiredTrustDataGovernanceWorkflows = readdirSync(".github/workflows")
  .filter((name) => retiredTrustDataGovernanceWorkflows.has(name))
  .sort();
assert.deepEqual(
  presentRetiredTrustDataGovernanceWorkflows,
  [],
  `retired TRUST Data Governance workflows must stay retired: ${presentRetiredTrustDataGovernanceWorkflows.join(", ")}`,
);

const dataOfferWorkflows = readdirSync(".github/workflows")
  .filter((name) => /^data-offer\d/i.test(name) && /\.ya?ml$/i.test(name))
  .sort();
assert.deepEqual(
  dataOfferWorkflows,
  [
    "data-offer17-controlled-offer-rpc-diagnostic.yml",
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

const retiredProductEvidenceWorkflows = new Set([
  "free-result-v2-product-evidence-ui.yml",
  "product-evidence-presentation-contract.yml",
  "product-evidence-presentation-provider.yml",
  "product-evidence-review-observation-readiness.yml",
]);

const retiredFaceLabNeutralStageStaticWorkflows = new Set([
  "face-lab-neutral-face-count-shared-stage-v1.yml",
]);
const presentRetiredFaceLabNeutralStageStaticWorkflows = readdirSync(".github/workflows")
  .filter((name) => retiredFaceLabNeutralStageStaticWorkflows.has(name))
  .sort();
assert.deepEqual(
  presentRetiredFaceLabNeutralStageStaticWorkflows,
  [],
  `retired Face Lab neutral-stage static workflows must stay retired: ${presentRetiredFaceLabNeutralStageStaticWorkflows.join(", ")}`,
);
assertContains("scripts/verify-current-main-health.mjs", [
  'run("Face Lab hosted set authority"',
  'run("Face Lab hosted response contract"',
  'run("Face Lab hosted UI security boundary"',
  'run("Face Lab neutral face-count shared stage"',
  'run("Face Lab neutral face-count contract syntax"',
  'run("Face Lab neutral face-count intake syntax"',
  'run("Face Lab neutral face-count review HTML syntax"',
  'run("Face Lab neutral review submit route syntax"',
  'run("Face Lab review submit route syntax"',
  'run("Face Lab review route syntax"',
  'run("Face Lab target-axis contract"',
  'run("Face Lab independent Human cue protocol"',
  'run("Face Lab archetype scoring contract"',
  'run("Face Lab Human evaluation contract"',
  'run("Face Lab synthetic evaluation workspace"',
  'run("Architecture guard"',
]);

const retiredProductOfferObservabilityStaticWorkflows = new Set([
  "data-offer17-offer-runtime-observability.yml",
]);
const presentRetiredProductOfferObservabilityStaticWorkflows = readdirSync(".github/workflows")
  .filter((name) => retiredProductOfferObservabilityStaticWorkflows.has(name))
  .sort();
assert.deepEqual(
  presentRetiredProductOfferObservabilityStaticWorkflows,
  [],
  `retired Product Offer observability static workflows must stay retired: ${presentRetiredProductOfferObservabilityStaticWorkflows.join(", ")}`,
);
assertContains("scripts/verify-current-main-health.mjs", [
  'run("DATA-OFFER17 Offer runtime observability"',
  'run("DATA-OFFER17 observability verifier syntax"',
  'run("DATA-OFFER17 observability module syntax"',
  'run("DATA-OFFER17 offer read service syntax"',
]);

const retiredFaceLabOperatorStaticWorkflows = new Set([
  "face-lab-neutral-review-operator-v1.yml",
  "face-lab-neutral-review-operator-vercel-cli-compat-v1.yml",
]);
const presentRetiredFaceLabOperatorStaticWorkflows = readdirSync(".github/workflows")
  .filter((name) => retiredFaceLabOperatorStaticWorkflows.has(name))
  .sort();
assert.deepEqual(
  presentRetiredFaceLabOperatorStaticWorkflows,
  [],
  `retired Face Lab operator static workflows must stay retired: ${presentRetiredFaceLabOperatorStaticWorkflows.join(", ")}`,
);
assertContains("scripts/verify-current-main-health.mjs", [
  'run("Face Lab neutral review operator safety"',
  'run("Face Lab neutral review operator syntax"',
  'run("Face Lab neutral review operator Vercel compatibility launcher syntax"',
  'run("Face Lab neutral review operator Vercel compatibility verifier syntax"',
  'run("Face Lab neutral review operator Vercel CLI compatibility"',
]);

const retiredCatalogTaxonomyStaticWorkflows = new Set([
  "data-taxonomy-ci.yml",
]);
const presentRetiredCatalogTaxonomyStaticWorkflows = readdirSync(".github/workflows")
  .filter((name) => retiredCatalogTaxonomyStaticWorkflows.has(name))
  .sort();
assert.deepEqual(
  presentRetiredCatalogTaxonomyStaticWorkflows,
  [],
  `retired Catalog Taxonomy static workflows must stay retired: ${presentRetiredCatalogTaxonomyStaticWorkflows.join(", ")}`,
);
assertContains("scripts/verify-current-main-health.mjs", [
  'run("DATA-TAXONOMY1 shadow catalog taxonomy foundation"',
  'run("DATA-TAXONOMY2 candidate manual classification"',
  'run("DATA-TAXONOMY4 recommendation shadow parity"',
  'run("DATA-TAXONOMY5 production recommendation parity foundation"',
  'run("DATA-TAXONOMY5 production recommendation parity runtime"',
  'run("DATA-TAXONOMY15 recommendation parity catalog-only v2"',
  'run("DATA-TAXONOMY6 product identity decoupling preflight"',
  'run("DATA-TAXONOMY7 legacy projection compatibility"',
  'run("DATA-TAXONOMY8 nullable legacy category projection"',
  'run("DATA-TAXONOMY10 catalog-only product promotion eligibility"',
  'run("DATA-TAXONOMY11 catalog-only transactional adoption"',
  'run("Catalog taxonomy shadow reader syntax"',
  'run("Catalog taxonomy shadow replay syntax"',
  'run("Catalog taxonomy shadow cardinality syntax"',
  'run("Catalog taxonomy replay route syntax"',
]);

const retiredProductDataPipelineStaticWorkflows = new Set([
  "hwahae-review-capture-provenance.yml",
  "legacy-offer-classifier.yml",
  "product-identity-resolution.yml",
]);
const presentRetiredProductDataPipelineStaticWorkflows = readdirSync(".github/workflows")
  .filter((name) => retiredProductDataPipelineStaticWorkflows.has(name))
  .sort();
assert.deepEqual(
  presentRetiredProductDataPipelineStaticWorkflows,
  [],
  `retired Product Data Pipeline static workflows must stay retired: ${presentRetiredProductDataPipelineStaticWorkflows.join(", ")}`,
);
assertContains("scripts/verify-current-main-health.mjs", [
  'run("Legacy offer classifier"',
  'run("Legacy offer migration manifest and dry-run"',
  'run("Product identity resolver"',
  'run("Product identity adoption plan"',
  'run("Product identity key repair plan"',
  'run("Hwahae review capture provenance"',
]);
const presentRetiredProductEvidenceWorkflows = readdirSync(".github/workflows")
  .filter((name) => retiredProductEvidenceWorkflows.has(name))
  .sort();
assert.deepEqual(
  presentRetiredProductEvidenceWorkflows,
  [],
  `retired Product Evidence workflows must stay retired: ${presentRetiredProductEvidenceWorkflows.join(", ")}`,
);

const retiredProductQueryAIWorkflows = new Set([
  "data-ai9-hosted-preview-acceptance.yml",
  "data-ai14-production-canary.yml",
  "data-ai17-authenticated-limited-beta-design.yml",
  "data-ai19-authenticated-beta-activation-preflight.yml",
  "data-ai22-product-query-quality-evaluation.yml",
]);

const presentRetiredProductQueryAIWorkflows = readdirSync(".github/workflows")
  .filter((name) => retiredProductQueryAIWorkflows.has(name))
  .sort();

assert.deepEqual(
  presentRetiredProductQueryAIWorkflows,
  [],
  `retired Product Query AI workflows must stay retired: ${presentRetiredProductQueryAIWorkflows.join(", ")}`,
);

assertContains("scripts/verify-current-main-health.mjs", [
  'run("DATA-AI22 product-query quality evaluation"',
  'run("DATA-AI22 product-query quality canonical baseline"',
  '"scripts/run-data-ai22-product-query-quality-evaluation.mjs", "--expected-baseline"',
]);

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
  "scripts/verify-mobile-initial-entry-routing.mjs",
  "npm run verify:mobile-entry-routing",
]);
assertNotContains(".github/workflows/mobile-ci.yml", [
  ...rootPackageTriggers,
  "npm run mobile:prebuild:android",
  "npm run verify:mobile-native",
]);
assertContains(".github/workflows/mobile-ci.yml", [
  "node scripts/verify-mobile-camera-foundation.mjs",
  "node scripts/verify-mobile-face-guidance.mjs",
]);
assertContains(".github/workflows/mobile-native-shell.yml", [
  "npm run mobile:prebuild:android",
  "npm run verify:mobile-native",
]);

assertContains(".github/workflows/mobile-ios-shell.yml", [
  '- "apps/mobile/app/_layout.tsx"',
  '- "apps/mobile/app/index.tsx"',
  '- "apps/mobile/features/camera/NativeFaceCamera.tsx"',
  '- "apps/mobile/lib/auth.ts"',
  '- "apps/mobile/lib/env.ts"',
  '- "apps/mobile/lib/my.ts"',
  '- "apps/mobile/lib/supabase.ts"',
  '- "scripts/verify-mobile-initial-entry-routing.mjs"',
  "npm run verify:mobile-entry-routing",
]);
for (const path of [
  "scripts/verify-mobile-camera-foundation.mjs",
  "scripts/verify-mobile-face-guidance.mjs",
  "scripts/verify-mobile-initial-entry-routing.mjs",
]) {
  assertNotContains(path, [
    "mobile-camera.yml",
    "mobile-face-guidance.yml",
    "mobile-foundation.yml",
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
  ".github/workflows/trust-phase5b-subject-registration.yml",
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
  ".github/workflows/product-identity-key-repair-confirm.yml",
  ".github/workflows/product-offers.yml",
  ".github/workflows/product-source-bindings.yml",
];
for (const path of modernizedNodeWorkflows) {
  assertContains(path, ["actions/checkout@v7", "actions/setup-node@v7", "node-version: 22"]);
  assertNotContains(path, ["actions/checkout@v4", "actions/setup-node@v4", "node-version: 20"]);
}
for (const path of trustPhaseWorkflows) {
  assertNotContains(path, ["npm run architecture:guard", "npm run build"]);
}
assertContains("scripts/verify-current-main-health.mjs", [
  'run("Product Evidence presentation contract"',
  'run("Product Evidence presentation provider"',
  'run("Product Evidence Free Result V2 UI"',
  'run("Product Evidence review observation readiness"',
]);

assertContains("scripts/verify-current-main-health.mjs", [
  'run("TRUST Phase 1 intake contract"',
  'run("TRUST Phase 2 subject resolution contract"',
  'run("TRUST Phase 3 research worker contract"',
  'run("TRUST Phase 4 controlled evidence adoption"',
  'run("TRUST Phase 5 admin queue contract"',
  'run("TRUST Phase 5B subject registration contract"',
  'run("TRUST Phase 5C formulation conflict HOLD"',
  'run("TRUST Phase 6A reentry contract"',
  'run("TRUST Phase 8A revalidation contract"',
]);
assertContains(".github/workflows/current-main-health.yml", [
  "Check exact-head diff hygiene",
  'git diff --check "${BASE_SHA}...${HEAD_SHA}"',
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

const dataAi4Workflow = read(".github/workflows/data-ai4-provider-shadow.yml");
const dataAi4PushSection = dataAi4Workflow.split("  pull_request:")[0];
assert(
  dataAi4PushSection.includes("    paths:"),
  "DATA-AI4 provider-backed shadow probe must not run on every main push",
);
assertContains(".github/workflows/data-ai4-provider-shadow.yml", [
  "cancel-in-progress: true",
  "actions/checkout@v7",
  "actions/setup-node@v7",
  "node-version: 22",
]);

const dataAi5Workflow = read(".github/workflows/data-ai5-activation-readiness.yml");
const dataAi5PushSection = dataAi5Workflow.split("  pull_request:")[0];
assert(
  dataAi5PushSection.includes("    paths:"),
  "DATA-AI5 activation-readiness probe must not run on every main push",
);
assertContains(".github/workflows/data-ai5-activation-readiness.yml", [
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

const retiredExpiredFaceLabSmokePaths = [
  ".github/workflows/facelab-neutral-stage-a-production-browser-smoke.yml",
  "app/api/internal/facelab-review-self-smoke/route.js",
  "scripts/run-face-lab-neutral-production-browser-smoke.mjs",
];
for (const path of retiredExpiredFaceLabSmokePaths) {
  assert(
    !existsSync(path),
    `expired FaceLab production smoke path must stay retired: ${path}`,
  );
}

const heavyRuntimeConcurrencyWorkflows = [
  ".github/workflows/trust-phase7a-backfill.yml",
  ".github/workflows/data-taxonomy13-catalog-only-candidate-approval.yml",
  ".github/workflows/data-taxonomy15-catalog-only-trust-intake.yml",
  ".github/workflows/product-identity-key-repair-confirm.yml",
  ".github/workflows/product-offers.yml",
  ".github/workflows/product-source-bindings.yml",
];
for (const path of heavyRuntimeConcurrencyWorkflows) {
  assertContains(path, [
    "concurrency:",
    "cancel-in-progress: true",
  ]);
}

assertContains("scripts/verify-current-main-health.mjs", [
  'run("Mobile initial-entry routing static contract"',
  'run("TRUST Phase 7A legacy backfill preflight"',
]);

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
  retired_trust_data_governance_workflows: 0,
  historical_data_offer_workflows: 0,
  operational_data_offer_workflows: 2,
  data_taxonomy_workflows: 3,
  face_eval_workflows: 2,
  retired_product_query_ai_workflows: 0,
  retired_mobile_store_stage_workflows: 0,
  retired_mobile_app_stage_workflows: 0,
  heavy_mobile_root_package_triggers: 0,
  g3a_unbounded_main_push: false,
  data_ai3_unbounded_main_push: false,
  data_ai4_unbounded_main_push: false,
  data_ai5_unbounded_main_push: false,
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
  retired_expired_facelab_smoke_paths: 0,
  heavy_runtime_concurrency_guarded: true,
  ci_architecture_guard_diff_aware: true,
}, null, 2));


/* CI_RESPONSIBILITY_TRIGGER_GUARD */
const responsibilityScopedWorkflowPaths = [
  ".github/workflows/data-ai21-limited-beta-evidence-closure.yml",
  ".github/workflows/data-ai22-live-provider-acceptance.yml",
  ".github/workflows/trust-phase6b-reentry.yml",
  ".github/workflows/trust-phase7a-backfill.yml",
  ".github/workflows/trust-phase7b-backfill.yml",
  ".github/workflows/trust-phase7c-phase4-compat.yml",
  ".github/workflows/trust-phase7c-readiness.yml",
  ".github/workflows/trust-phase7d-relational-adoption.yml",
  ".github/workflows/trust-phase8g-source-verification.yml",
];

for (const relativePath of responsibilityScopedWorkflowPaths) {
  const source = read(relativePath);
  assert.ok(
    !source.includes('      - "scripts/verify-current-main-health.mjs"'),
    `${relativePath}: phase/runtime workflow must not trigger on canonical orchestrator changes`
  );
  assert.ok(
    source.includes("watchtower_track:"),
    `${relativePath}: workflow_dispatch must expose optional watchtower_track`
  );
}


/* TRUST_RESPONSIBILITY_NAMING_GUARD */
const trustResponsibilityWorkflows = readdirSync(".github/workflows")
  .filter((name) => /^trust-phase/i.test(name) && /\.ya?ml$/i.test(name))
  .sort();

for (const name of trustResponsibilityWorkflows) {
  const relativePath = `.github/workflows/${name}`;
  const source = read(relativePath);
  assert.ok(
    source.startsWith("name: TRUST Data Governance - "),
    `${relativePath}: TRUST workflow display name must expose TRUST Data Governance responsibility`
  );
  if (source.includes("  workflow_dispatch:")) {
    assert.ok(
      source.includes("watchtower_track:"),
      `${relativePath}: workflow_dispatch must expose optional watchtower_track`
    );
  }
}


/* PRODUCT_QUERY_AI_RESPONSIBILITY_NAMING_GUARD */
const productQueryAIWorkflows = readdirSync(".github/workflows")
  .filter((name) => /^data-ai\d/i.test(name) && /\.ya?ml$/i.test(name))
  .sort();

for (const name of productQueryAIWorkflows) {
  const relativePath = `.github/workflows/${name}`;
  const source = read(relativePath);
  assert.ok(
    source.startsWith("name: Product Query AI - "),
    `${relativePath}: DATA-AI workflow display name must expose Product Query AI responsibility`
  );
  if (source.includes("  workflow_dispatch:")) {
    assert.ok(
      source.includes("watchtower_track:"),
      `${relativePath}: workflow_dispatch must expose optional watchtower_track`
    );
  }
}

assert.ok(
  read(".github/workflows/v21-admission-g3a-pf-authority-read.yml")
    .startsWith("name: Recommendation Admission - "),
  "v21-admission-g3a-pf-authority-read.yml must expose Recommendation Admission responsibility"
);


/* DATA_RESPONSIBILITY_NAMING_GUARD */
const responsibilityNameGroups = [
  {
    names: [
      "data-offer17-controlled-offer-rpc-diagnostic.yml",
    ],
    prefix: "name: Product Offer Runtime - ",
  },
  {
    names: [
      "data-taxonomy13-catalog-only-candidate-approval.yml",
      "data-taxonomy15-catalog-only-trust-intake.yml",
    ],
    prefix: "name: Catalog Taxonomy - ",
  },
  {
    names: [
      "product-identity-key-repair-confirm.yml",
      "product-offers.yml",
      "product-source-bindings.yml",
    ],
    prefix: "name: Product Data Pipeline - ",
  },
];

for (const group of responsibilityNameGroups) {
  for (const name of group.names) {
    const relativePath = `.github/workflows/${name}`;
    const source = read(relativePath);
    assert.ok(
      source.startsWith(group.prefix),
      `${relativePath}: workflow display name must expose its technical responsibility`
    );
    if (source.includes("  workflow_dispatch:")) {
      assert.ok(
        source.includes("watchtower_track:"),
        `${relativePath}: workflow_dispatch must expose optional watchtower_track`
      );
    }
  }
}


/* FACE_LAB_RESPONSIBILITY_NAMING_GUARD */
const faceLabResponsibilityWorkflows = [
  "face-eval-cx1g-d2d-ui1-korean-review-ui-v1.yml",
  "face-eval-cx1g-d2d-xp-hosted-intake-v1.yml",
];

for (const name of faceLabResponsibilityWorkflows) {
  const relativePath = `.github/workflows/${name}`;
  const source = read(relativePath);
  assert.ok(
    source.startsWith("name: Face Lab - "),
    `${relativePath}: workflow display name must expose Face Lab responsibility`,
  );
  assert.ok(
    source.includes("  workflow_dispatch:") && source.includes("watchtower_track:"),
    `${relativePath}: workflow_dispatch must expose optional watchtower_track`,
  );
}


/* ADMIN_RESPONSIBILITY_NAMING_GUARD */
const adminResponsibilityWorkflows = [
  "admin-access-foundation.yml",
  "admin-product-current-main-integration.yml",
];

for (const name of adminResponsibilityWorkflows) {
  const relativePath = `.github/workflows/${name}`;
  const source = read(relativePath);
  assert.ok(
    source.startsWith("name: Admin - "),
    `${relativePath}: workflow display name must expose Admin responsibility`,
  );
  assert.ok(
    source.includes("  workflow_dispatch:") && source.includes("watchtower_track:"),
    `${relativePath}: workflow_dispatch must expose optional watchtower_track`,
  );
}
