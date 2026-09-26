#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const canonicalPath = ".github/workflows/data-ai-product-query-static.yml";
const phasePaths = [
  ".github/workflows/data-ai3-product-query-shadow.yml",
  ".github/workflows/data-ai4-provider-shadow.yml",
  ".github/workflows/data-ai5-activation-readiness.yml",
];

const canonical = fs.readFileSync(canonicalPath, "utf8");
const count = (text, needle) => text.split(needle).length - 1;

for (const script of [
  "scripts/verify-data-ai1-product-query-intent.mjs",
  "scripts/verify-data-ai2-product-query-execution.mjs",
  "scripts/verify-data-ai3-product-query-shadow.mjs",
  "scripts/verify-data-ai4-provider-shadow.mjs",
  "scripts/verify-data-ai5-activation-readiness.mjs",
]) {
  assert.equal(count(canonical, `node ${script}`), 1, `${script}: canonical automatic execution must be exactly once`);
}

assert.equal(count(canonical, "npm ci --no-audit --no-fund"), 1, "canonical npm ci must execute exactly once");
assert.equal(count(canonical, "npm run architecture:guard"), 1, "canonical architecture guard must execute exactly once");
assert.equal(count(canonical, "npm run build"), 1, "canonical production build must execute exactly once");
assert.ok(canonical.includes("node --check scripts/validate-data-ai4-provider-shadow-runtime-response.mjs"));
assert.ok(canonical.includes("node --check scripts/validate-data-ai5-activation-readiness-runtime-response.mjs"));

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

console.log("DATA_AI3_5_CI_CONSOLIDATION=PASS canonical_static=1 compatibility_runtime_owners=3");
