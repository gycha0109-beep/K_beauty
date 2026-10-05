#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const canonicalPath = ".github/workflows/data-ai-product-query-static.yml";
const phasePaths = [
  ".github/workflows/data-ai3-product-query-shadow.yml",
  ".github/workflows/data-ai4-provider-shadow.yml",
  ".github/workflows/data-ai5-activation-readiness.yml",
  ".github/workflows/data-ai29c-protection-shadow.yml",
];

const canonical = fs.readFileSync(canonicalPath, "utf8");
const count = (text, needle) => text.split(needle).length - 1;

for (const script of [
  "scripts/verify-data-ai1-product-query-intent.mjs",
  "scripts/verify-data-ai2-product-query-execution.mjs",
  "scripts/verify-data-ai29a-product-query-quality.mjs",
  "scripts/verify-data-ai29b-product-query-ranking.mjs",
  "scripts/verify-data-ai29c-a-protection-authority.mjs",
  "scripts/verify-data-ai29c-a-protection-audit.mjs",
  "scripts/verify-data-ai29c-b-protection-shadow.mjs",
  "scripts/verify-data-ai29c-protection-expansion-wave-v1.mjs",
  "scripts/verify-data-ai29c-c5b-subject-presentation-correction.mjs",
  "scripts/verify-data-ai29c-c5c-catalog-only-water-enqueue.mjs",
  "scripts/verify-data-ai29c-c5d-catalog-official-source-projection.mjs",
  "scripts/verify-data-ai29c-c5e-post-expansion-protection-audit.mjs",
  "scripts/verify-data-ai29c-c6-discrimination-wave2.mjs",
  "scripts/verify-data-ai29c-c6f-prospective-axis-readiness.mjs",
  "scripts/verify-data-ai29c-c6g-prospective-protection-shadow.mjs",
  "scripts/verify-data-ai29c-d-r1-staged-activation-redesign.mjs",
  "scripts/verify-data-ai29c-d1-sunscreen-semantic-authority.mjs",
  "scripts/verify-data-ai29c-d1a-unresolved-fact-reresearch.mjs",
  "scripts/verify-data-ai29c-d1b-semantic-projection-policy.mjs",
  "scripts/verify-data-ai29c-d2-sunscreen-initial-admission.mjs",
  "scripts/verify-data-ai29c-d3-integrated-sunscreen-shadow.mjs",
  "scripts/verify-data-ai29c-d3r1-feature-gated-shadow.mjs",
  "scripts/verify-data-ai29c-d3r2-mixed-corpus-calibration.mjs",
  "scripts/verify-data-ai29c-d3r3-authority-complete-subset.mjs",
  "scripts/verify-data-ai29c-d4-spf-axis-review.mjs",
  "scripts/verify-data-ai29c-d4-uva-authority-recovery-review.mjs",
  "scripts/verify-data-ai29c-uva-r1-live-authority-recon.mjs",
  "scripts/verify-data-ai29c-uva-r2-exact-subject-research.mjs",
  "scripts/verify-data-ai29c-d4-water-axis-review.mjs",
  "scripts/verify-data-ai29c-water-a-intent-contract.mjs",
  "scripts/verify-data-ai29c-water-b-evidence-frontier.mjs",
  "scripts/verify-data-ai29c-water-b1-governed-label-mapping.mjs",
  "scripts/verify-data-ai29c-water-c-anessa-controlled-adoption.mjs",
  "scripts/verify-data-ai29c-water-c-r1-cardinality-guard.mjs",
  "scripts/verify-data-ai29c-water-c-r1-production-validation.mjs",
  "scripts/verify-data-ai29c-water-d1-day-dew-controlled-expansion.mjs",
  "scripts/verify-data-ai29c-water-d2a-frozen20-authority-recon.mjs",
  "scripts/verify-data-ai29c-water-d2a-r1-fully-source-recovery.mjs",
  "scripts/verify-data-ai29c-d5a-spf-runtime-gate.mjs",
  "scripts/verify-data-ai29c-d5b-spf-production-shadow.mjs",
  "scripts/verify-data-ai29c-d5c-bounded-internal-canary.mjs",
  "scripts/verify-data-ai29c-d5d-spf-production-activation.mjs",
  "scripts/verify-data-ai29c-d5d-r1-recovery.mjs",
  "scripts/verify-data-ai28e-bounded-incomplete-retry.mjs",
  "scripts/verify-data-ai3-product-query-shadow.mjs",
  "scripts/verify-data-ai4-provider-shadow.mjs",
  "scripts/verify-data-ai5-activation-readiness.mjs",
]) {
  const command =
    script === "scripts/verify-data-ai29c-d3-integrated-sunscreen-shadow.mjs" ||
    script === "scripts/verify-data-ai29c-d3r1-feature-gated-shadow.mjs" ||
    script === "scripts/verify-data-ai29c-d3r2-mixed-corpus-calibration.mjs" ||
    script === "scripts/verify-data-ai29c-d3r3-authority-complete-subset.mjs" ||
    script === "scripts/verify-data-ai29c-d4-spf-axis-review.mjs" ||
    script === "scripts/verify-data-ai29c-d4-uva-authority-recovery-review.mjs" ||
    script === "scripts/verify-data-ai29c-d4-water-axis-review.mjs" ||
    script === "scripts/verify-data-ai29c-d5a-spf-runtime-gate.mjs" ||
    script === "scripts/verify-data-ai29c-d5b-spf-production-shadow.mjs" ||
    script === "scripts/verify-data-ai29c-d5c-bounded-internal-canary.mjs" ||
    script === "scripts/verify-data-ai29c-d5d-spf-production-activation.mjs" ||
    script === "scripts/verify-data-ai29c-d5d-r1-recovery.mjs"
      ? `node --experimental-strip-types ${script}`
      : `node ${script}`;
  assert.equal(
    count(canonical, command),
    1,
    `${script}: canonical automatic execution must be exactly once`,
  );
}

const consolidatedOnlyScripts = [
  "scripts/verify-data-ai29c-water-d1-r1-day-dew-required-facts.mjs",
  "scripts/verify-data-ai29c-uva-r3a-broad-spectrum-semantic-contract.mjs",
  "scripts/verify-data-ai29c-uva-r3b-registry-compatibility-audit.mjs",
  "scripts/verify-data-ai29c-uva-r3c-registry-coexistence-design.mjs",
  "scripts/verify-data-ai29c-uva-r3d-registry-coexistence-implementation.mjs",
  "scripts/verify-data-ai29c-uva-r3e-broad-spectrum-registry-publish-preflight.mjs",
  "scripts/verify-data-ai29c-uva-r3f-broad-spectrum-registry-controlled-publish.mjs",
  "scripts/verify-data-ai29c-uva-r3g-proposition-serializer-contract.mjs",
  "scripts/verify-data-ai29c-uva-r3h-day-dew-broad-spectrum-governed-pilot.mjs",
  "scripts/verify-data-ai29c-uva-r3i-skin1004-broad-spectrum-recovery.mjs",
  "scripts/verify-data-ai29c-uva-r3j-broad-spectrum-coverage-recon.mjs",
  "scripts/verify-data-ai29c-uva-r3k-broad-spectrum-phase-closeout.mjs",
  "scripts/verify-data-ai29c-uva-r4-blocked-subject-reassessment.mjs",
  "scripts/verify-data-ai29c-uva-r5-blocked-subject-closeout.mjs",
  "scripts/verify-data-ai29c-filter-r1-uv-filter-recovery.mjs",
  "scripts/verify-data-ai29c-filter-r2-roundlab-exact-kr-formulation-closeout.mjs",
  "scripts/verify-data-ai29c-protection-r1-gap-watch-closeout.mjs",
  "scripts/verify-v21-8f-r1-catalog-expansion-planning-refresh.mjs",
  "scripts/verify-v21-8g0-registry-pinned-reconciliation.mjs",
  "scripts/verify-v21-8g1-subject-identity.mjs",
  "scripts/verify-v21-8g2-0-registry-v1-research-contract.mjs",
  "scripts/verify-v21-8g2-a-required-fact-research.mjs",
  "scripts/verify-v21-8g2-b-required-fact-research.mjs",
  "scripts/verify-v21-8g2-c-required-fact-research.mjs",
  "scripts/verify-v21-8g2-wave1-research-closeout.mjs",
  "scripts/verify-v21-8g3-0-evidence-ingest-contract.mjs",
  "scripts/verify-v21-8g3-0-r1-gpt-worker-coexistence.mjs",
  "scripts/verify-v21-8g3-a-controlled-evidence-ingest.mjs",
  "scripts/verify-v21-8g3-b-review-preparation.mjs",
  "scripts/verify-v21-8g3-c-confirmation-preflight.mjs",
  "scripts/verify-v21-8h-final-product-fact-confirmation.mjs",
  "scripts/verify-v21-admission-g4-0-nonlegacy-frontier-design-v1.mjs",
  "scripts/verify-v21-admission-g4-b-fation-subject-registration-hold-v1.mjs",
  "scripts/verify-v21-admission-g4-b-r1-fation-formulation-authority-recovery-v1.mjs",
  "scripts/verify-v21-8h-r1-post-confirmation-pda-readiness.mjs",
  "scripts/verify-v21-8h-r2-barrier-support-non-numeric-shadow-feasibility.mjs",
  "scripts/product-evidence/verify-barrier-support-non-numeric-pda-contract-v1.mjs",
  "scripts/product-evidence/verify-barrier-support-non-numeric-pda-offline-shadow-v1.mjs",
  "scripts/product-evidence/verify-barrier-support-non-numeric-pda-shadow-adapter-contract-v1.mjs",
  "scripts/product-evidence/verify-barrier-support-non-numeric-pda-shadow-adapter-implementation-v1.mjs",
  "scripts/product-evidence/verify-barrier-support-shadow-consumption-evaluation-v1.mjs",
  "scripts/product-evidence/verify-barrier-support-coverage-recovery-prioritization-v1.mjs",
  "scripts/product-evidence/verify-barrier-support-p0-official-identity-authority-research-v1.mjs",
  "scripts/product-evidence/verify-barrier-support-p0-ready3-subject-identity-preflight-v1.mjs",
  "scripts/product-evidence/verify-barrier-support-ready3-legacy-subject-registration-path-v1.mjs",
  "scripts/product-evidence/verify-barrier-support-p0-ready3-controlled-subject-registration-closeout-v1.mjs",
  "scripts/product-evidence/verify-barrier-support-p0-ready3-official-evidence-research-v1.mjs",
];

for (const script of consolidatedOnlyScripts) {
  assert.ok(fs.existsSync(script), `${script}: consolidated verifier must exist`);
  assert.equal(
    count(canonical, `node ${script}`),
    0,
    `${script}: consolidated-only verifier must not be duplicated in canonical workflow`,
  );
  const result = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: process.env,
  });
  assert.equal(
    result.status,
    0,
    `${script}: consolidated verifier must pass`,
  );
}

assert.equal(count(canonical, "npm ci --no-audit --no-fund"), 1, "canonical npm ci must execute exactly once");
assert.equal(count(canonical, "npm run architecture:guard"), 1, "canonical architecture guard must execute exactly once");
assert.equal(count(canonical, "npm run build"), 1, "canonical production build must execute exactly once");
assert.ok(canonical.includes("node --check scripts/validate-data-ai4-provider-shadow-runtime-response.mjs"));
assert.ok(canonical.includes("node --check scripts/validate-data-ai5-activation-readiness-runtime-response.mjs"));
assert.ok(canonical.includes("node --check scripts/validate-data-ai29c-d5d-spf-production-activation-response.mjs"));

for (const path of phasePaths) {
  const yaml = fs.readFileSync(path, "utf8");
  assert.ok(yaml.includes("actions: read"), `${path}: Actions read permission required for canonical gate`);
  assert.ok(yaml.includes("run: node scripts/await-ci-workflow.mjs"), `${path}: same-head canonical gate required`);
  assert.ok(yaml.includes("CANONICAL_WORKFLOW_PATH: .github/workflows/data-ai-product-query-static.yml"));
  assert.ok(yaml.includes("EXPECTED_EVENT: ${{ github.event_name }}"));
  assert.ok(yaml.includes("if: github.event_name != 'workflow_dispatch'"));
  assert.ok(yaml.includes("if: github.event_name == 'workflow_dispatch'"));
  assert.ok(yaml.includes("if: github.event_name == 'push'"), `${path}: push-only deployed runtime probe must remain`);
  assert.ok(yaml.includes("needs: verify"), `${path}: runtime probe must remain gated by compatibility verify job`);
}

const waiter = fs.readFileSync("scripts/await-ci-workflow.mjs", "utf8");
assert.ok(waiter.includes('url.searchParams.set("head_sha", expectedSha)'));
assert.ok(waiter.includes("run.head_sha === expectedSha"));
assert.ok(waiter.includes("run.event === expectedEvent"));
assert.ok(waiter.includes('run.conclusion === "success"'));
assert.ok(waiter.includes("throw new Error"), "canonical gate must fail closed");

console.log("DATA_AI3_5_CI_CONSOLIDATION=PASS canonical_static=1 compatibility_runtime_owners=4");
