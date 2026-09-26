#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ai25Workflow = readFileSync(".github/workflows/data-ai25-operational-readiness.yml", "utf8");
const prelaunchWorkflow = readFileSync(".github/workflows/data-ai-prelaunch-01-product-query-e2e.yml", "utf8");
const prelaunchVerifier = readFileSync("scripts/verify-data-ai-prelaunch-01-product-query-e2e.mjs", "utf8");
const policy = JSON.parse(readFileSync("docs/ci/consolidation-audits/phase-b-policy.json", "utf8"));

function count(source, token) {
  return source.split(token).length - 1;
}

assert.match(ai25Workflow, /^name: Product Query AI - Operational Readiness$/m);
assert.match(ai25Workflow, /^    name: DATA-AI25 operational baseline and readiness contract$/m);
assert.equal(
  count(ai25Workflow, "node scripts/verify-data-ai25-product-query-operational-readiness.mjs"),
  1,
  "DATA-AI25 workflow must execute its operational-readiness verifier exactly once"
);

assert.match(prelaunchWorkflow, /^name: Product Query AI - Pre-launch Acceptance$/m);
assert.match(prelaunchWorkflow, /^    name: Product Query pre-launch acceptance contract$/m);
assert.equal(
  count(prelaunchWorkflow, "node scripts/verify-data-ai-prelaunch-01-product-query-e2e.mjs"),
  1,
  "PRELAUNCH workflow must execute its acceptance verifier exactly once"
);
assert.equal(
  count(prelaunchWorkflow, "verify-data-ai25-product-query-operational-readiness.mjs"),
  0,
  "PRELAUNCH workflow must not execute or path-trigger on the DATA-AI25 verifier"
);
assert.match(prelaunchWorkflow, /node --check scripts\/bootstrap-product-query-prelaunch-auth\.mjs/);
assert.match(prelaunchWorkflow, /node --check scripts\/run-product-query-prelaunch-e2e\.mjs/);

for (const boundary of [
  "postLaunchOnly",
  "operationalBaselineStartAtRequired",
  "prelaunchQaExcluded",
  "prelaunchQaMaySatisfyDataAi25",
  "operational_baseline_not_started"
]) {
  assert.ok(
    prelaunchVerifier.includes(boundary),
    `PRELAUNCH verifier must preserve DATA-AI25 evidence boundary: ${boundary}`
  );
}

const cluster = policy.clusters?.["taxonomy-ai-prelaunch"];
assert.equal(cluster?.operationalReadinessOwner, "data-ai25-operational-readiness.yml");
assert.equal(cluster?.prelaunchAcceptanceOwner, "data-ai-prelaunch-01-product-query-e2e.yml");
assert.deepEqual(policy.approvedAddedWorkflows, ["data-ai-product-query-static.yml"]);
assert.deepEqual(policy.approvedRetiredWorkflows, []);

console.log("DATA_AI25_PRELAUNCH_CI_RESPONSIBILITY=PASS ai25_owner=1 prelaunch_owner=1 duplicate_ai25_execution=0");
