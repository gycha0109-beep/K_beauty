#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const matrix = JSON.parse(read("docs/ci/consolidation-audits/trust-5b-7d-runtime-matrix.json"));
const phaseB = JSON.parse(read("docs/ci/consolidation-audits/phase-b-policy.json"));
const canonicalPath = ".github/workflows/trust-phase5b-7d-static.yml";
const canonical = read(canonicalPath);
const count = (text, needle) => text.split(needle).length - 1;

const expected = {
  "trust-phase5b-subject-registration.yml": {
    "scripts": [
      "scripts/verify-trust-phase5b-subject-registration.mjs",
      "scripts/verify-product-fact-subject-registration-v1.mjs",
      "scripts/verify-trust-subject-resolution.mjs",
      "scripts/verify-trust-subject-resolution-presentation-hardening.mjs",
      "scripts/verify-trust-phase5-admin-queue.mjs"
    ],
    "runtime": [
      "supabase@",
      "db reset",
      "stop --workdir"
    ],
    "replay": false,
    "fallbackSteps": 4
  },
  "trust-phase6a-reentry.yml": {
    "scripts": [
      "scripts/verify-trust-phase6a-reentry.mjs",
      "scripts/verify-trust-research-worker.mjs",
      "scripts/verify-trust-subject-resolution.mjs",
      "scripts/verify-trust-subject-resolution-presentation-hardening.mjs",
      "scripts/verify-trust-phase5-admin-queue.mjs"
    ],
    "runtime": [
      "supabase@",
      "db reset",
      "stop --workdir"
    ],
    "replay": false,
    "fallbackSteps": 2
  },
  "trust-phase7c-phase4-compat.yml": {
    "scripts": [
      "scripts/verify-trust-phase4-controlled-evidence-adoption.mjs",
      "scripts/verify-trust-phase7c-legacy-research-readiness.mjs",
      "scripts/verify-trust-phase7c-phase4-legacy-compat.mjs",
      "scripts/verify-product-fact-controlled-write-v1.mjs",
      "scripts/verify-product-fact-subject-registration-v1.mjs"
    ],
    "runtime": [
      "supabase@",
      "db reset",
      "stop --workdir"
    ],
    "replay": true,
    "fallbackSteps": 1
  },
  "trust-phase7c-readiness.yml": {
    "scripts": [
      "scripts/verify-trust-research-worker.mjs",
      "scripts/verify-trust-phase6a-reentry.mjs",
      "scripts/verify-trust-phase7a-legacy-backfill-preflight.mjs",
      "scripts/verify-trust-phase7b-legacy-backfill-materialization.mjs",
      "scripts/verify-trust-phase7c-legacy-research-readiness.mjs"
    ],
    "runtime": [
      "supabase@",
      "db reset",
      "stop --workdir"
    ],
    "replay": false,
    "fallbackSteps": 1
  },
  "trust-phase7d-relational-adoption.yml": {
    "scripts": [
      "scripts/verify-trust-research-worker.mjs",
      "scripts/verify-trust-phase4-controlled-evidence-adoption.mjs",
      "scripts/verify-trust-phase7c-phase4-legacy-compat.mjs",
      "scripts/verify-trust-phase7d-relational-adoption.mjs",
      "scripts/verify-product-fact-controlled-write-v1.mjs"
    ],
    "runtime": [
      "supabase@",
      "db reset",
      "stop --workdir"
    ],
    "replay": true,
    "fallbackSteps": 1
  }
};

const canonicalScripts = [...new Set(Object.values(expected).flatMap((contract) => contract.scripts))];
assert.equal(canonicalScripts.length, 14, "TRUST canonical static script inventory drift");
for (const script of canonicalScripts) {
  assert.equal(count(canonical, `node ${script}`), 1, `${script}: canonical automatic execution must be exactly once`);
}
assert.equal(count(canonical, "npm ci --no-audit --no-fund"), 1, "TRUST canonical npm ci must execute exactly once");
assert.ok(canonical.includes("actions/checkout@v7"));
assert.ok(canonical.includes("actions/setup-node@v7"));
assert.ok(canonical.includes("node-version: 22"));
assert.ok(canonical.includes("workflow_dispatch:"));
assert.ok(canonical.includes("watchtower_track:"));

function containingStep(source, token) {
  const lines = source.split("\n");
  const index = lines.findIndex((line) => line.includes(token));
  assert.ok(index >= 0, `missing workflow command: ${token}`);
  let start = index;
  while (start >= 0 && !/^\s{6}- name:/.test(lines[start])) start -= 1;
  assert.ok(start >= 0, `missing step header for: ${token}`);
  let end = start + 1;
  while (end < lines.length && !/^\s{6}- name:/.test(lines[end])) end += 1;
  return lines.slice(start, end).join("\n");
}

assert.equal(matrix.schemaVersion, "bejewely-trust-5b-7d-runtime-matrix-v1");
assert.equal(matrix.mode, "canonical-static-delegation");
assert.equal(matrix.canonicalStaticOwner, "trust-phase5b-7d-static.yml");
assert.equal(Object.keys(matrix.workflows).length, 5);
assert.equal(matrix.invariants.supabaseRuntimeOwners, 5);
assert.equal(matrix.invariants.replayRuntimeOwners, 2);
assert.equal(matrix.invariants.canonicalStaticOwners, 1);
assert.equal(matrix.invariants.automaticStaticDuplicateExecutions, 0);
assert.equal(matrix.invariants.manualStaticFallbackOwners, 5);

let supabaseOwners = 0;
let replayOwners = 0;
for (const [workflow, contract] of Object.entries(expected)) {
  const path = `.github/workflows/${workflow}`;
  const source = read(path);
  const declared = matrix.workflows[workflow];

  assert.ok(declared, `${workflow}: missing runtime-matrix entry`);
  assert.equal(declared.automaticStaticExecution, "delegated-to-canonical");
  assert.equal(declared.manualStaticFallback, true);
  assert.ok(source.includes("actions: read"), `${workflow}: Actions read permission required for canonical gate`);
  assert.ok(source.includes("run: node scripts/await-ci-workflow.mjs"), `${workflow}: same-head canonical gate required`);
  assert.ok(source.includes("CANONICAL_WORKFLOW_PATH: .github/workflows/trust-phase5b-7d-static.yml"));
  assert.ok(source.includes("EXPECTED_EVENT: ${{ github.event_name }}"));
  assert.ok(source.includes("if: github.event_name != 'workflow_dispatch'"));
  assert.ok(
    count(source, "if: github.event_name == 'workflow_dispatch'") >= contract.fallbackSteps,
    `${workflow}: manual fallback condition count drift`,
  );

  assert.equal(declared.staticPrerequisites.length, contract.scripts.length, `${workflow}: static prerequisite count drift`);
  for (const script of contract.scripts) {
    assert.ok(declared.staticPrerequisites.includes(script), `${workflow}: runtime matrix missing ${script}`);
    const step = containingStep(source, `node ${script}`);
    assert.ok(
      step.includes("if: github.event_name == 'workflow_dispatch'"),
      `${workflow}: ${script} must execute locally only for workflow_dispatch`,
    );
  }

  for (const token of contract.runtime) {
    assert.ok(source.includes(token), `${workflow}: runtime authority missing ${token}`);
  }
  supabaseOwners += 1;

  const hasReplay = source.includes("scripts/materialize-product-fact-replay-baseline-v1.mjs");
  assert.equal(hasReplay, contract.replay, `${workflow}: replay ownership drift`);
  assert.equal(declared.replayBaselineMaterialization, contract.replay, `${workflow}: replay matrix drift`);
  if (contract.replay) replayOwners += 1;

  for (const runtimePath of declared.phaseSpecificRuntime) {
    assert.ok(source.includes(runtimePath), `${workflow}: phase-specific runtime evidence missing ${runtimePath}`);
  }
  assert.ok(
    source.indexOf("Wait for canonical TRUST 5B-7D static contract") < source.indexOf("db reset"),
    `${workflow}: canonical gate must precede DB runtime`,
  );
}

assert.equal(supabaseOwners, 5);
assert.equal(replayOwners, 2);

const waiter = read("scripts/await-ci-workflow.mjs");
assert.ok(waiter.includes('url.searchParams.set("head_sha", expectedSha)'));
assert.ok(waiter.includes("run.head_sha === expectedSha"));
assert.ok(waiter.includes("run.event === expectedEvent"));
assert.ok(waiter.includes('run.conclusion === "success"'));
assert.ok(waiter.includes("throw new Error"), "canonical gate must fail closed");

const cluster = phaseB.clusters?.["trust-5b-7d"];
assert.equal(cluster?.mode, "canonical-static-delegation");
assert.equal(cluster?.runtimeMatrix, "docs/ci/consolidation-audits/trust-5b-7d-runtime-matrix.json");
assert.equal(cluster?.canonicalStaticOwner, "trust-phase5b-7d-static.yml");
assert.deepEqual(cluster?.workflows, Object.keys(expected));
assert.ok(phaseB.approvedAddedWorkflows.includes("trust-phase5b-7d-static.yml"));
for (const workflow of Object.keys(expected)) {
  assert.ok(!(phaseB.approvedRetiredWorkflows || []).includes(workflow), `${workflow}: runtime workflow must remain active`);
}

const expectedWorkflowCount =
  phaseB.baselineWorkflowCount +
  (phaseB.approvedAddedWorkflows || []).length -
  (phaseB.approvedRetiredWorkflows || []).length;

console.log(
  `TRUST_5B_7D_CI_RESPONSIBILITY=PASS mode=canonical-static canonical_static=1 automatic_static_duplicates=0 manual_fallback_owners=5 supabase_runtime_owners=${supabaseOwners} replay_runtime_owners=${replayOwners} workflow_retired=0 workflow_inventory=${expectedWorkflowCount}`,
);
