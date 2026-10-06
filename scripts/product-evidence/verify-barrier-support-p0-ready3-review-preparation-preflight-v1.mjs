#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-review-preparation-preflight-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-controlled-evidence-ingest-closeout-v1.json";

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const parent = JSON.parse(fs.readFileSync(parentPath, "utf8"));

const gitBlob = (path) =>
  execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim();

const propositionKey =
  "379a68e4b599cbcc5583b0a830b3718c3f5af0fc52ec62d4d823a728626834d2";
const evidenceId = "45b57536-0637-44e0-b427-bb55923c4812";
const actor = "e1a59349-fe13-43ff-86ce-078c2dce0d99";

assert.equal(artifact.stage, "V2.1-8H-R12D");
assert.equal(
  artifact.decision,
  "BARRIER_SUPPORT_P0_READY3_REVIEW_PREPARATION_PREFLIGHT_PASS"
);

assert.equal(artifact.parent_authority.r12c_path, parentPath);
assert.equal(
  gitBlob(parentPath),
  artifact.parent_authority.r12c_git_blob_sha
);
assert.equal(
  parent.decision,
  artifact.parent_authority.r12c_decision
);

assert.equal(
  artifact.runtime_contract.prepare_review_function_sha256,
  "9d0992369021a37a83c96561f8ad3d9e9b505a61771b7b5312fa35fc424dbff1"
);
assert.equal(artifact.runtime_contract.anon_execute, false);
assert.equal(artifact.runtime_contract.authenticated_execute, false);
assert.equal(artifact.runtime_contract.service_role_execute, true);
assert.equal(
  artifact.runtime_contract.review_policy_version,
  "v21-8g3-b-direct-evidence-review-v1"
);
assert.equal(
  artifact.runtime_contract.required_capability,
  "admin.products.review"
);

assert.deepEqual(artifact.registry_write_policy, {
  registry_version: "product-fact-registry-cross-category-v1",
  fact_key: "primary_use_role",
  lineage_kind: "new",
  allowed: true,
  reason: "ALLOWED",
  policy_state: "active",
  policy_version: "data-ai29c-uva-r3d-registry-coexistence-v1",
  policy_digest: "1ee29792af7acddc521916fedef250944d10e2a4c0a55ef75ba46a9d3ca03e46",
  new_lineage_allowed: true,
  existing_lineage_allowed: true
});

assert.equal(artifact.target.evidence_id, evidenceId);
assert.equal(artifact.target.proposition_key, propositionKey);
assert.equal(artifact.target.fact_key, "primary_use_role");
assert.equal(artifact.target.value, "multi_area");
assert.equal(artifact.target.evidence_class, "usage_instruction");
assert.equal(
  artifact.target.evidence_authority,
  "product_specific_primary"
);
assert.equal(artifact.target.confidence, "high");
assert.equal(artifact.target.support_direction, "supports");
assert.equal(artifact.target.task_state, "RESEARCH_PENDING");
assert.equal(artifact.target.task_attempt_count, 0);
assert.equal(artifact.target.task_blocker_code, null);

assert.deepEqual(
  artifact.transition_contract.required_sequence,
  ["under_review", "ready_for_confirm"]
);
assert.equal(
  artifact.transition_contract.direct_new_to_ready_for_confirm_forbidden,
  true
);
assert.equal(artifact.transition_contract.assigned_to, actor);

assert.equal(artifact.planned_rpcs.length, 2);
assert.deepEqual(
  artifact.planned_rpcs.map((entry) => entry.payload.operational_state),
  ["under_review", "ready_for_confirm"]
);

for (const entry of artifact.planned_rpcs) {
  assert.equal(
    entry.payload.product_id,
    artifact.target.product_id
  );
  assert.equal(
    entry.payload.subject_id,
    artifact.target.subject_id
  );
  assert.equal(
    entry.payload.registry_version,
    artifact.registry_write_policy.registry_version
  );
  assert.equal(entry.payload.fact_key, "primary_use_role");
  assert.equal(entry.payload.proposition_key, propositionKey);
  assert.equal(entry.payload.assigned_to, actor);
  assert.equal(
    entry.payload.review_policy_version,
    artifact.runtime_contract.review_policy_version
  );
}

assert.equal(artifact.production_prestate.target_evidence_rows, 1);
assert.equal(artifact.production_prestate.target_review_assignments, 0);
assert.equal(artifact.production_prestate.target_fact_instances, 0);
assert.equal(artifact.production_prestate.target_current_facts, 0);
assert.equal(artifact.production_prestate.target_confirmations, 0);

assert.equal(artifact.rollback_probe.rpc_calls_attempted, 2);
assert.equal(artifact.rollback_probe.rpc_calls_accepted, 2);
assert.deepEqual(artifact.rollback_probe.in_transaction, {
  target_assignments: 1,
  ready_for_confirm_assignments: 1,
  assignment_review_events: 2,
  admin_audits: 2,
  target_fact_instances: 0,
  target_current_facts: 0,
  target_confirmations: 0
});
assert.deepEqual(artifact.rollback_probe.post_rollback, {
  target_assignments: 0,
  assignment_review_events: 0,
  admin_audits: 0,
  target_fact_instances: 0,
  target_current_facts: 0,
  target_confirmations: 0,
  target_evidence_rows: 1
});

for (const [key, expected] of Object.entries({
  committed_review_assignment_writes: 0,
  committed_review_event_writes: 0,
  committed_audit_writes: 0,
  committed_fact_instance_writes: 0,
  committed_product_fact_current_writes: 0,
  committed_confirmation_writes: 0,
  committed_recommendation_writes: 0,
  review_preparation_authorized_for_current_stage: false,
  confirmation_preflight_authorized: false,
  confirmation_authorized: false,
  recommendation_activation_authorized: false,
  public_activation: false
})) {
  assert.equal(artifact.authority_boundary[key], expected, key);
}

assert.equal(
  artifact.next_gate.stage,
  "V2.1-8H-R12E_READY3_CONTROLLED_REVIEW_PREPARATION"
);
assert.equal(artifact.next_gate.status, "NOT_EXECUTED");
assert.equal(artifact.next_gate.authorized_proposition_count, 1);
assert.deepEqual(
  artifact.next_gate.authorized_proposition_keys,
  [propositionKey]
);
assert.equal(
  artifact.next_gate.allowed_rpc,
  "admin_prepare_product_fact_review_v1"
);
assert.deepEqual(
  artifact.next_gate.required_sequence,
  ["under_review", "ready_for_confirm"]
);
assert.equal(artifact.next_gate.review_preparation_authorized, true);
assert.equal(
  artifact.next_gate.confirmation_preflight_authorized,
  false
);
assert.equal(artifact.next_gate.confirmation_authorized, false);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: artifact.stage,
    decision: artifact.decision,
    evidenceId,
    propositionKey,
    rollbackResidue: 0
  })
);
