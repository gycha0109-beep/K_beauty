#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const matrix = JSON.parse(read("docs/ci/consolidation-audits/trust-8b-8g-replay-matrix.json"));
const phaseB = JSON.parse(read("docs/ci/consolidation-audits/phase-b-policy.json"));
const decision = JSON.parse(read("docs/ci/consolidation-audits/trust-8b-8g-replay-decision.json"));
const materializer = read("scripts/materialize-product-fact-replay-baseline-v1.mjs");

const expected = {
  "trust-phase8b-source-verification.yml": {
    "authority": "phase8b-source-verification-ledger",
    "staticVerifier": "scripts/verify-trust-phase8b-source-verification.mjs",
    "replayBaselineMaterialization": true,
    "supabaseRuntime": true,
    "runtimeEvidence": [
      "tests/fixtures/trust-phase8b-source-verification/verify_trust_phase8b_source_verification_runtime.sql"
    ],
    "phaseMigrationTail": [
      "supabase/migrations/20260922010350_trust_phase8b_source_verification_ledger_v1.sql"
    ]
  },
  "trust-phase8c-revalidation.yml": {
    "authority": "phase8c-revalidation-transition",
    "staticVerifier": "scripts/verify-trust-phase8c-revalidation.mjs",
    "replayBaselineMaterialization": true,
    "supabaseRuntime": true,
    "runtimeEvidence": [
      "tests/fixtures/trust-phase4-controlled-evidence-adoption/verify_trust_phase4_runtime.sql",
      "tests/fixtures/trust-phase8c-revalidation/verify_trust_phase8c_revalidation_runtime.sql"
    ],
    "phaseMigrationTail": [
      "supabase/migrations/20260922011229_trust_phase8c_revalidation_transition_v1.sql",
      "supabase/migrations/20260922011324_trust_phase8c_revalidation_transition_index_hardening_v1.sql",
      "supabase/migrations/20260922012833_trust_phase8c_prestate_binding_hardening_v1.sql"
    ]
  },
  "trust-phase8d-revalidation.yml": {
    "authority": "phase8d-revalidation-research-bridge",
    "staticVerifier": "scripts/verify-trust-phase8d-revalidation.mjs",
    "replayBaselineMaterialization": true,
    "supabaseRuntime": true,
    "runtimeEvidence": [
      "tests/fixtures/trust-phase4-controlled-evidence-adoption/verify_trust_phase4_runtime.sql",
      "tests/fixtures/trust-phase8c-revalidation/verify_trust_phase8c_revalidation_runtime.sql",
      "tests/fixtures/trust-phase8d-revalidation/verify_trust_phase8d_revalidation_research_runtime.sql"
    ],
    "phaseMigrationTail": [
      "tests/fixtures/trust-phase8d-revalidation/20260922013450_trust_phase8d_fixture_adapter.sql",
      "supabase/migrations/20260922064822_trust_phase8d_revalidation_research_bridge_v1.sql"
    ]
  },
  "trust-phase8e-revalidation-adjudication.yml": {
    "authority": "phase8e-revalidation-adjudication",
    "staticVerifier": "scripts/verify-trust-phase8e-revalidation-adjudication.mjs",
    "replayBaselineMaterialization": true,
    "supabaseRuntime": true,
    "runtimeEvidence": [
      "tests/fixtures/trust-phase4-controlled-evidence-adoption/verify_trust_phase4_runtime.sql",
      "tests/fixtures/trust-phase8c-revalidation/verify_trust_phase8c_revalidation_runtime.sql",
      "tests/fixtures/trust-phase8d-revalidation/verify_trust_phase8d_revalidation_research_runtime.sql",
      "tests/fixtures/trust-phase8e-revalidation/verify_trust_phase8e_revalidation_adjudication_runtime.sql"
    ],
    "phaseMigrationTail": [
      "supabase/migrations/20260922064829_trust_phase8e_revalidation_adjudication_v1.sql"
    ]
  },
  "trust-phase8f-changed-semantic-replacement.yml": {
    "authority": "phase8f-changed-semantic-replacement",
    "staticVerifier": "scripts/verify-trust-phase8f-changed-semantic-replacement.mjs",
    "replayBaselineMaterialization": true,
    "supabaseRuntime": true,
    "runtimeEvidence": [
      "tests/fixtures/trust-phase4-controlled-evidence-adoption/verify_trust_phase4_runtime.sql",
      "tests/fixtures/trust-phase8c-revalidation/verify_trust_phase8c_revalidation_runtime.sql",
      "tests/fixtures/trust-phase8d-revalidation/verify_trust_phase8d_revalidation_research_runtime.sql",
      "tests/fixtures/trust-phase8f-revalidation/prepare_trust_phase8f_changed_candidate.sql",
      "tests/fixtures/trust-phase8f-revalidation/verify_trust_phase8f_changed_semantic_runtime.sql"
    ],
    "phaseMigrationTail": [
      "supabase/migrations/20260922064844_trust_phase8f_changed_semantic_replacement_v1.sql"
    ]
  },
  "trust-phase8g-source-verification.yml": {
    "authority": "phase8g-source-verification-comparability",
    "staticVerifier": "scripts/verify-trust-phase8g-source-verification-comparability.mjs",
    "replayBaselineMaterialization": true,
    "supabaseRuntime": true,
    "runtimeEvidence": [
      "tests/fixtures/trust-phase4-controlled-evidence-adoption/verify_trust_phase4_runtime.sql",
      "tests/fixtures/trust-phase8g-source-verification/verify_trust_phase8g_source_verification_runtime.sql"
    ],
    "phaseMigrationTail": [
      "supabase/migrations/20260924025307_trust_phase8g_source_verification_comparability_v1.sql",
      "supabase/migrations/20260924025341_trust_phase8g_profile_idempotency_hardening_v1.sql",
      "supabase/migrations/20260924104150_trust_phase8g_semantic_profile_contract_v1.sql",
      "supabase/migrations/20260924165109_trust_phase8g_claim_asset_profile_contract_v1.sql"
    ],
    "uniqueOperationalScripts": [
      "scripts/trust-source-verification-worker.mjs",
      "scripts/trust-source-verification-canary-capture.mjs",
      "scripts/trust-source-verification-diff-probe.mjs",
      "scripts/trust-source-semantic-cross-brand-probe.mjs",
      "scripts/trust-source-semantic-controlled-batch-probe.mjs",
      "scripts/trust-source-claim-asset-controlled-batch-probe.mjs",
      "scripts/trust-source-claim-asset-independent-verification-capture.mjs"
    ]
  }
};
const workflows = Object.keys(expected);
const replayScript = "scripts/materialize-product-fact-replay-baseline-v1.mjs";
const count = (text, needle) => text.split(needle).length - 1;

assert.equal(matrix.schemaVersion, "bejewely-trust-8b-8g-replay-matrix-v1");
assert.equal(matrix.mode, "preserve-local-replay-materialization");
assert.equal(matrix.sharedReplayBaseline.crossWorkflowArtifactSharing, false);
assert.equal(matrix.invariants.crossWorkflowReplayArtifactOwners, 0);
assert.equal(workflows.length, 6);
assert.equal(matrix.invariants.replayMaterializationOwners, 6);
assert.equal(matrix.invariants.supabaseRuntimeOwners, 6);
assert.equal(matrix.invariants.phaseStaticVerifierOwners, 6);
assert.equal(matrix.invariants.workflowRetirementsAllowed, 0);
assert.equal(matrix.invariants.workflowRenamesAllowed, 0);
assert.equal(matrix.invariants.runtimeDelegationAllowed, 0);

assert.ok(materializer.includes('const PACKAGE_ROOT = path.join('), "replay materializer fixture authority missing");
assert.ok(materializer.includes('gitTreeMigrationEntries(manifest.pre_pf2_repository_sha)'), "replay materializer git-tree authority missing");
assert.ok(materializer.includes('output_must_be_under_repository_tmp'), "replay materializer output boundary missing");
assert.ok(materializer.includes('local_only: true'), "replay materializer local-only evidence missing");
assert.ok(materializer.includes('remote_commands_executed: false'), "replay materializer remote-command evidence missing");
assert.ok(!materializer.includes("fetch("), "replay materializer must remain network-independent");
assert.ok(!materializer.includes("supabase start"), "replay materializer must not own Supabase runtime");
assert.ok(!materializer.includes("psql "), "replay materializer must not own DB verification");

let replayOwners = 0;
let runtimeOwners = 0;
let staticOwners = 0;
for (const [workflow, contract] of Object.entries(expected)) {
  const source = read(`.github/workflows/${workflow}`);
  const declared = matrix.workflows[workflow];

  assert.ok(source.includes(contract.staticVerifier), `${workflow}: phase static verifier missing`);
  assert.equal(declared.staticVerifier, contract.staticVerifier, `${workflow}: static verifier matrix drift`);
  staticOwners += 1;

  assert.equal(count(source, replayScript), 1, `${workflow}: replay baseline materialization count drift`);
  assert.equal(declared.replayBaselineMaterialization, true);
  replayOwners += 1;

  for (const token of ["supabase@", "db reset", "stop --workdir"]) {
    assert.ok(source.includes(token), `${workflow}: Supabase runtime authority missing ${token}`);
  }
  assert.equal(declared.supabaseRuntime, true);
  runtimeOwners += 1;

  assert.ok(
    source.indexOf(replayScript) < source.indexOf("supabase@"),
    `${workflow}: replay baseline must be materialized before Supabase runtime`,
  );

  for (const runtimePath of contract.runtimeEvidence) {
    assert.ok(source.includes(runtimePath), `${workflow}: runtime evidence missing ${runtimePath}`);
  }
  for (const migrationPath of contract.phaseMigrationTail) {
    assert.ok(source.includes(migrationPath), `${workflow}: phase migration tail missing ${migrationPath}`);
  }
}

const phase8g = read(".github/workflows/trust-phase8g-source-verification.yml");
for (const script of expected["trust-phase8g-source-verification.yml"].uniqueOperationalScripts) {
  assert.ok(phase8g.includes(script), `TRUST 8G unique operational script missing: ${script}`);
}

assert.equal(replayOwners, 6);
assert.equal(runtimeOwners, 6);
assert.equal(staticOwners, 6);

const cluster = phaseB.clusters?.["trust-8b-8g-replay"];
assert.equal(cluster?.mode, "preserve-local-replay-materialization");
assert.equal(cluster?.runtimeMatrix, "docs/ci/consolidation-audits/trust-8b-8g-replay-matrix.json");
assert.deepEqual(cluster?.workflows, workflows);
assert.equal(cluster?.decisionRecord, "docs/ci/consolidation-audits/trust-8b-8g-replay-decision.json");
assert.equal(decision.decision, "preserve-local-replay-materialization");
assert.equal(decision.observedReference.workflow, "trust-phase8g-source-verification.yml");
assert.ok(decision.observedReference.materializationDurationMs < 1000, "reference replay materialization must remain sub-second evidence");
assert.ok(decision.observedReference.supabaseRuntimeWindowMs > 60000, "reference Supabase runtime window evidence drift");
assert.ok(decision.prohibitedByCurrentDecision.includes("new canonical replay artifact workflow"));
for (const workflow of workflows) {
  assert.ok(!(phaseB.approvedRetiredWorkflows || []).includes(workflow), `${workflow}: B-6A must not retire workflows`);
}

const expectedWorkflowCount =
  phaseB.baselineWorkflowCount +
  (phaseB.approvedAddedWorkflows || []).length -
  (phaseB.approvedRetiredWorkflows || []).length;

console.log(
  `TRUST_8B_8G_REPLAY_RESPONSIBILITY=PASS mode=local-preserved workflows=6 replay_materialization_owners=${replayOwners} cross_workflow_artifacts=0 supabase_runtime_owners=${runtimeOwners} phase_static_verifier_owners=${staticOwners} runtime_delegation=0 workflow_retired=0 workflow_inventory=${expectedWorkflowCount}`,
);
