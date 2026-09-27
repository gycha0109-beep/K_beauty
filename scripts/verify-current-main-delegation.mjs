#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/current-main-health.yml", "utf8");
const current = fs.readFileSync("scripts/verify-current-main-health.mjs", "utf8");
const resolver = fs.readFileSync("scripts/resolve-current-main-delegations.mjs", "utf8");
const audit = fs.readFileSync("scripts/audit-ci-workflow-overlap.mjs", "utf8");
const policy = JSON.parse(fs.readFileSync("docs/ci/consolidation-audits/current-main-delegation-policy.json", "utf8"));
const phaseB = JSON.parse(fs.readFileSync("docs/ci/consolidation-audits/phase-b-policy.json", "utf8"));

assert.match(workflow, /^name: BEJEWELY Current Main Health$/m);
assert.match(workflow, /^    name: BEJEWELY Current Main Health$/m);
assert.ok(workflow.includes("actions: read"), "Current Main needs Actions read permission");
assert.ok(workflow.includes("run: node scripts/resolve-current-main-delegations.mjs"));
assert.ok(workflow.includes("CURRENT_MAIN_DELEGATION_RESULT_PATH: ${{ runner.temp }}/current-main-delegation.json"));
assert.ok(workflow.includes("GITHUB_TOKEN: ${{ github.token }}"));
assert.ok(workflow.includes("EXPECTED_SHA: ${{ github.event.pull_request.head.sha || github.sha }}"));
assert.ok(workflow.includes("EXPECTED_EVENT: ${{ github.event_name }}"));

const expected = [
  ["data-ai1", "scripts/verify-data-ai1-product-query-intent.mjs"],
  ["data-ai2", "scripts/verify-data-ai2-product-query-execution.mjs"],
  ["data-ai3", "scripts/verify-data-ai3-product-query-shadow.mjs"],
  ["data-ai4", "scripts/verify-data-ai4-provider-shadow.mjs"],
  ["data-ai5", "scripts/verify-data-ai5-activation-readiness.mjs"],
  ["data-ai25", "scripts/verify-data-ai25-product-query-operational-readiness.mjs"],
  ["data-ai-prelaunch-01", "scripts/verify-data-ai-prelaunch-01-product-query-e2e.mjs"],
  ["trust-phase2-subject-resolution", "scripts/verify-trust-subject-resolution.mjs"],
  ["trust-phase2-presentation-hardening", "scripts/verify-trust-subject-resolution-presentation-hardening.mjs"],
  ["trust-phase3-research-worker", "scripts/verify-trust-research-worker.mjs"],
  ["trust-phase4-controlled-adoption", "scripts/verify-trust-phase4-controlled-evidence-adoption.mjs"],
  ["product-fact-controlled-write", "scripts/verify-product-fact-controlled-write-v1.mjs"],
  ["product-fact-subject-registration", "scripts/verify-product-fact-subject-registration-v1.mjs"],
  ["trust-phase5-admin-queue", "scripts/verify-trust-phase5-admin-queue.mjs"],
  ["trust-phase5b-subject-registration", "scripts/verify-trust-phase5b-subject-registration.mjs"],
  ["trust-phase6a-reentry", "scripts/verify-trust-phase6a-reentry.mjs"],
  ["trust-phase7a-backfill-preflight", "scripts/verify-trust-phase7a-legacy-backfill-preflight.mjs"],
  ["trust-phase7b-backfill-materialization", "scripts/verify-trust-phase7b-legacy-backfill-materialization.mjs"],
  ["trust-phase7c-research-readiness", "scripts/verify-trust-phase7c-legacy-research-readiness.mjs"],
  ["trust-phase7c-phase4-compat", "scripts/verify-trust-phase7c-phase4-legacy-compat.mjs"],
  ["trust-phase7d-relational-adoption", "scripts/verify-trust-phase7d-relational-adoption.mjs"],
  ["data-ai16", "scripts/verify-data-ai16-production-canary-closure.mjs"],
  ["data-ai18", "scripts/verify-data-ai18-authenticated-beta-runtime.mjs"],
  ["data-ai20", "scripts/verify-data-ai20-authenticated-beta-controlled-activation.mjs"],
  ["data-ai21", "scripts/verify-data-ai21-limited-beta-evidence-closure.mjs"],
  ["data-ai22-live-provider-acceptance", "scripts/verify-data-ai22-live-provider-acceptance.mjs"],
  ["data-ai23", "scripts/verify-data-ai23-authenticated-beta-ux.mjs"],
  ["data-ai24", "scripts/verify-data-ai24-operational-observability.mjs"],
];

const contracts = policy.owners.flatMap((owner) => owner.contracts);
assert.equal(policy.owners.length, 11);
assert.equal(contracts.length, expected.length);
for (const [id, script] of expected) {
  const contract = contracts.find((item) => item.id === id);
  assert.equal(contract?.script, script, `${id}: delegation policy drift`);
  assert.ok(current.includes(`runDelegated("${id}"`), `${id}: Current Main must use delegated-or-local execution`);
}
{
  const owner = policy.owners.find((candidate) => candidate.id === "taxonomy-ai-data-ai16");
  assert.equal(owner?.workflowPath, ".github/workflows/data-ai16-production-canary-closure.yml", "taxonomy-ai-data-ai16: owner workflow drift");
  assert.equal(owner?.contracts?.[0]?.id, "data-ai16", "taxonomy-ai-data-ai16: owner contract drift");
}
{
  const owner = policy.owners.find((candidate) => candidate.id === "taxonomy-ai-data-ai18");
  assert.equal(owner?.workflowPath, ".github/workflows/data-ai18-authenticated-beta-runtime.yml", "taxonomy-ai-data-ai18: owner workflow drift");
  assert.equal(owner?.contracts?.[0]?.id, "data-ai18", "taxonomy-ai-data-ai18: owner contract drift");
}
{
  const owner = policy.owners.find((candidate) => candidate.id === "taxonomy-ai-data-ai20");
  assert.equal(owner?.workflowPath, ".github/workflows/data-ai20-authenticated-beta-controlled-activation.yml", "taxonomy-ai-data-ai20: owner workflow drift");
  assert.equal(owner?.contracts?.[0]?.id, "data-ai20", "taxonomy-ai-data-ai20: owner contract drift");
}
{
  const owner = policy.owners.find((candidate) => candidate.id === "taxonomy-ai-data-ai21");
  assert.equal(owner?.workflowPath, ".github/workflows/data-ai21-limited-beta-evidence-closure.yml", "taxonomy-ai-data-ai21: owner workflow drift");
  assert.equal(owner?.contracts?.[0]?.id, "data-ai21", "taxonomy-ai-data-ai21: owner contract drift");
}
{
  const owner = policy.owners.find((candidate) => candidate.id === "taxonomy-ai-data-ai22-live");
  assert.equal(owner?.workflowPath, ".github/workflows/data-ai22-live-provider-acceptance.yml", "taxonomy-ai-data-ai22-live: owner workflow drift");
  assert.equal(owner?.contracts?.[0]?.id, "data-ai22-live-provider-acceptance", "taxonomy-ai-data-ai22-live: owner contract drift");
}
{
  const owner = policy.owners.find((candidate) => candidate.id === "taxonomy-ai-data-ai23");
  assert.equal(owner?.workflowPath, ".github/workflows/data-ai23-authenticated-beta-ux.yml", "taxonomy-ai-data-ai23: owner workflow drift");
  assert.equal(owner?.contracts?.[0]?.id, "data-ai23", "taxonomy-ai-data-ai23: owner contract drift");
}
{
  const owner = policy.owners.find((candidate) => candidate.id === "taxonomy-ai-data-ai24");
  assert.equal(owner?.workflowPath, ".github/workflows/data-ai24-operational-observability.yml", "taxonomy-ai-data-ai24: owner workflow drift");
  assert.equal(owner?.contracts?.[0]?.id, "data-ai24", "taxonomy-ai-data-ai24: owner contract drift");
}
assert.ok(current.includes('value?.mode === "delegated"'));
assert.ok(resolver.includes('url.searchParams.set("head_sha", expectedSha)'));
assert.ok(resolver.includes('url.searchParams.set("event", expectedEvent)'));
assert.ok(resolver.includes("run.head_sha === expectedSha && run.event === expectedEvent"));
assert.ok(resolver.includes('run.conclusion !== "success"'));
assert.ok(resolver.includes('mode: "fallback"'));
assert.ok(audit.includes("execution_duplicate_units="), "overlap audit must distinguish execution duplicates from coverage overlap");

const cluster = phaseB.clusters?.["current-main-cross-cutting"];
assert.equal(cluster?.delegationPolicy, "docs/ci/consolidation-audits/current-main-delegation-policy.json");
assert.ok(
  phaseB.approvedAddedWorkflows.includes("data-ai-product-query-static.yml"),
  "Current Main delegation requires the canonical DATA-AI static workflow approval"
);
assert.ok(
  phaseB.approvedAddedWorkflows.includes("trust-phase5b-7d-static.yml"),
  "Current Main delegation requires the canonical TRUST 5B-7D static workflow approval"
);
assert.ok(
  cluster?.delegatedCanonicalOwners?.includes("trust-phase5b-7d-static.yml"),
  "Current Main delegation policy must expose TRUST 5B-7D canonical owner"
);
assert.ok(
  cluster?.delegatedCanonicalOwners?.includes("data-ai16-production-canary-closure.yml"),
  "Current Main delegation policy must expose data-ai16-production-canary-closure.yml"
);
assert.ok(
  cluster?.delegatedCanonicalOwners?.includes("data-ai18-authenticated-beta-runtime.yml"),
  "Current Main delegation policy must expose data-ai18-authenticated-beta-runtime.yml"
);
assert.ok(
  cluster?.delegatedCanonicalOwners?.includes("data-ai20-authenticated-beta-controlled-activation.yml"),
  "Current Main delegation policy must expose data-ai20-authenticated-beta-controlled-activation.yml"
);
assert.ok(
  cluster?.delegatedCanonicalOwners?.includes("data-ai21-limited-beta-evidence-closure.yml"),
  "Current Main delegation policy must expose data-ai21-limited-beta-evidence-closure.yml"
);
assert.ok(
  cluster?.delegatedCanonicalOwners?.includes("data-ai22-live-provider-acceptance.yml"),
  "Current Main delegation policy must expose data-ai22-live-provider-acceptance.yml"
);
assert.ok(
  cluster?.delegatedCanonicalOwners?.includes("data-ai23-authenticated-beta-ux.yml"),
  "Current Main delegation policy must expose data-ai23-authenticated-beta-ux.yml"
);
assert.ok(
  cluster?.delegatedCanonicalOwners?.includes("data-ai24-operational-observability.yml"),
  "Current Main delegation policy must expose data-ai24-operational-observability.yml"
);
assert.deepEqual(phaseB.approvedRetiredWorkflows, []);
const expectedWorkflowCount =
  phaseB.baselineWorkflowCount + phaseB.approvedAddedWorkflows.length - phaseB.approvedRetiredWorkflows.length;

console.log(`CURRENT_MAIN_DELEGATION=PASS delegated_contracts=${expected.length} canonical_groups=${policy.owners.length} direct_duplicate_execution=0 fallback_coverage=${expected.length} workflow_inventory=${expectedWorkflowCount}`);