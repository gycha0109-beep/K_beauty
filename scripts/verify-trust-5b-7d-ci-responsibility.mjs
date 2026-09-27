#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const matrix = JSON.parse(read("docs/ci/consolidation-audits/trust-5b-7d-runtime-matrix.json"));
const phaseB = JSON.parse(read("docs/ci/consolidation-audits/phase-b-policy.json"));

const expected = {
  "trust-phase5b-subject-registration.yml": {
    scripts: [
      "scripts/verify-trust-phase5b-subject-registration.mjs",
      "scripts/verify-product-fact-subject-registration-v1.mjs",
      "scripts/verify-trust-subject-resolution.mjs",
      "scripts/verify-trust-subject-resolution-presentation-hardening.mjs",
      "scripts/verify-trust-phase5-admin-queue.mjs",
    ],
    runtime: ["supabase@", "db reset", "stop --workdir"],
    replay: false,
  },
  "trust-phase6a-reentry.yml": {
    scripts: [
      "scripts/verify-trust-phase6a-reentry.mjs",
      "scripts/verify-trust-research-worker.mjs",
      "scripts/verify-trust-subject-resolution.mjs",
      "scripts/verify-trust-subject-resolution-presentation-hardening.mjs",
      "scripts/verify-trust-phase5-admin-queue.mjs",
    ],
    runtime: ["supabase@", "db reset", "stop --workdir"],
    replay: false,
  },
  "trust-phase7c-phase4-compat.yml": {
    scripts: [
      "scripts/verify-trust-phase4-controlled-evidence-adoption.mjs",
      "scripts/verify-trust-phase7c-legacy-research-readiness.mjs",
      "scripts/verify-trust-phase7c-phase4-legacy-compat.mjs",
      "scripts/verify-product-fact-controlled-write-v1.mjs",
      "scripts/verify-product-fact-subject-registration-v1.mjs",
    ],
    runtime: ["supabase@", "db reset", "stop --workdir"],
    replay: true,
  },
  "trust-phase7c-readiness.yml": {
    scripts: [
      "scripts/verify-trust-research-worker.mjs",
      "scripts/verify-trust-phase6a-reentry.mjs",
      "scripts/verify-trust-phase7a-legacy-backfill-preflight.mjs",
      "scripts/verify-trust-phase7b-legacy-backfill-materialization.mjs",
      "scripts/verify-trust-phase7c-legacy-research-readiness.mjs",
    ],
    runtime: ["supabase@", "db reset", "stop --workdir"],
    replay: false,
  },
  "trust-phase7d-relational-adoption.yml": {
    scripts: [
      "scripts/verify-trust-research-worker.mjs",
      "scripts/verify-trust-phase4-controlled-evidence-adoption.mjs",
      "scripts/verify-trust-phase7c-phase4-legacy-compat.mjs",
      "scripts/verify-trust-phase7d-relational-adoption.mjs",
      "scripts/verify-product-fact-controlled-write-v1.mjs",
    ],
    runtime: ["supabase@", "db reset", "stop --workdir"],
    replay: true,
  },
};

assert.equal(matrix.schemaVersion, "bejewely-trust-5b-7d-runtime-matrix-v1");
assert.equal(matrix.mode, "audit-only");
assert.equal(Object.keys(matrix.workflows).length, 5);
assert.equal(matrix.invariants.supabaseRuntimeOwners, 5);
assert.equal(matrix.invariants.replayRuntimeOwners, 2);
assert.equal(matrix.invariants.workflowRetirementsAllowed, 0);
assert.equal(matrix.invariants.workflowRenamesAllowed, 0);

let supabaseOwners = 0;
let replayOwners = 0;
for (const [workflow, contract] of Object.entries(expected)) {
  const path = `.github/workflows/${workflow}`;
  const source = read(path);
  const declared = matrix.workflows[workflow];

  assert.ok(declared, `${workflow}: missing runtime-matrix entry`);
  assert.equal(declared.staticPrerequisites.length, contract.scripts.length, `${workflow}: static prerequisite count drift`);
  for (const script of contract.scripts) {
    assert.ok(source.includes(script), `${workflow}: missing frozen static prerequisite ${script}`);
    assert.ok(declared.staticPrerequisites.includes(script), `${workflow}: runtime matrix missing ${script}`);
  }
  for (const token of contract.runtime) {
    assert.ok(source.includes(token), `${workflow}: runtime authority missing ${token}`);
  }
  supabaseOwners += 1;

  const hasReplay = source.includes("scripts/materialize-product-fact-replay-baseline-v1.mjs");
  assert.equal(hasReplay, contract.replay, `${workflow}: replay ownership drift`);
  assert.equal(declared.replayBaselineMaterialization, contract.replay, `${workflow}: replay matrix drift`);
  if (contract.replay) replayOwners += 1;

  assert.equal(
    declared.phaseSpecificRuntime.length > 0,
    true,
    `${workflow}: phase-specific runtime authority must remain explicit`,
  );
  for (const runtimePath of declared.phaseSpecificRuntime) {
    assert.ok(source.includes(runtimePath), `${workflow}: phase-specific runtime evidence missing ${runtimePath}`);
  }
}

assert.equal(supabaseOwners, 5);
assert.equal(replayOwners, 2);

const cluster = phaseB.clusters?.["trust-5b-7d"];
assert.equal(cluster?.mode, "audit-only");
assert.equal(cluster?.runtimeMatrix, "docs/ci/consolidation-audits/trust-5b-7d-runtime-matrix.json");
assert.deepEqual(cluster?.workflows, Object.keys(expected));
for (const workflow of Object.keys(expected)) {
  assert.ok(!(phaseB.approvedRetiredWorkflows || []).includes(workflow), `${workflow}: B-5A must not retire workflows`);
}

const expectedWorkflowCount =
  phaseB.baselineWorkflowCount +
  (phaseB.approvedAddedWorkflows || []).length -
  (phaseB.approvedRetiredWorkflows || []).length;

console.log(
  `TRUST_5B_7D_CI_RESPONSIBILITY=PASS mode=audit-only workflows=5 supabase_runtime_owners=${supabaseOwners} replay_runtime_owners=${replayOwners} workflow_retired=0 workflow_inventory=${expectedWorkflowCount}`,
);
