#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-controlled-review-preparation-closeout-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-review-preparation-preflight-v1.json";

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const parent = JSON.parse(fs.readFileSync(parentPath, "utf8"));

const gitBlob = (path) =>
  execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim();

const assignmentId = "4eef7c5f-30d6-495e-a42b-a6cdeaacc380";
const evidenceId = "45b57536-0637-44e0-b427-bb55923c4812";
const propositionKey =
  "379a68e4b599cbcc5583b0a830b3718c3f5af0fc52ec62d4d823a728626834d2";
const actor = "e1a59349-fe13-43ff-86ce-078c2dce0d99";

assert.equal(artifact.stage, "V2.1-8H-R12E");
assert.equal(
  artifact.decision,
  "BARRIER_SUPPORT_P0_READY3_CONTROLLED_REVIEW_PREPARATION_PASS"
);

assert.equal(artifact.parent_authority.r12d_path, parentPath);
assert.equal(
  gitBlob(parentPath),
  artifact.parent_authority.r12d_git_blob_sha
);
assert.equal(
  parent.decision,
  artifact.parent_authority.r12d_decision
);

assert.equal(parent.next_gate.review_preparation_authorized, true);
assert.equal(parent.next_gate.confirmation_preflight_authorized, false);
assert.equal(parent.next_gate.confirmation_authorized, false);
assert.deepEqual(
  parent.next_gate.required_sequence,
  ["under_review", "ready_for_confirm"]
);
assert.deepEqual(
  parent.next_gate.authorized_proposition_keys,
  [propositionKey]
);

assert.equal(
  artifact.execution.rpc,
  "admin_prepare_product_fact_review_v1(uuid,text,jsonb)"
);
assert.equal(
  artifact.execution.review_policy_version,
  "v21-8g3-b-direct-evidence-review-v1"
);
assert.equal(artifact.execution.actor_user_id, actor);
assert.equal(
  artifact.execution.required_capability,
  "admin.products.review"
);
assert.deepEqual(
  artifact.execution.sequence.map((entry) => entry.to_state),
  ["under_review", "ready_for_confirm"]
);
assert.deepEqual(
  artifact.execution.sequence.map((entry) => entry.request_id),
  [
    "v21-8h-r12e-etude-role-under",
    "v21-8h-r12e-etude-role-ready"
  ]
);

assert.equal(artifact.target.assignment_id, assignmentId);
assert.equal(artifact.target.evidence_id, evidenceId);
assert.equal(artifact.target.proposition_key, propositionKey);
assert.equal(artifact.target.fact_key, "primary_use_role");
assert.equal(artifact.target.value, "multi_area");

assert.deepEqual(artifact.production_readback.assignment, {
  operational_state: "ready_for_confirm",
  assigned_to: actor,
  review_policy_version: "v21-8g3-b-direct-evidence-review-v1",
  created_at: "2026-10-06T13:46:57.823239+09:00",
  updated_at: "2026-10-06T13:46:57.823239+09:00"
});

assert.equal(artifact.production_readback.review_events.length, 2);
const prepared = artifact.production_readback.review_events.find(
  (event) => event.event_kind === "review_assignment_prepared"
);
const transitioned = artifact.production_readback.review_events.find(
  (event) => event.event_kind === "review_assignment_transitioned"
);

assert.ok(prepared);
assert.ok(transitioned);

assert.deepEqual(
  {
    event_id: prepared.event_id,
    reason_code: prepared.reason_code,
    request_id: prepared.request_id,
    from_state: prepared.from_state,
    to_state: prepared.to_state,
    evidence_id: prepared.evidence_id,
    fact_instance_id: prepared.fact_instance_id,
    confirmation_id: prepared.confirmation_id
  },
  {
    event_id: "ad0e4af8-54b0-4bae-8352-44ea8f66e09d",
    reason_code: "v21_8h_r12e_direct_evidence_under_review",
    request_id: "v21-8h-r12e-etude-role-under",
    from_state: null,
    to_state: "under_review",
    evidence_id: null,
    fact_instance_id: null,
    confirmation_id: null
  }
);

assert.deepEqual(
  {
    event_id: transitioned.event_id,
    reason_code: transitioned.reason_code,
    request_id: transitioned.request_id,
    from_state: transitioned.from_state,
    to_state: transitioned.to_state,
    evidence_id: transitioned.evidence_id,
    fact_instance_id: transitioned.fact_instance_id,
    confirmation_id: transitioned.confirmation_id
  },
  {
    event_id: "01e29ff1-5558-4aa0-b794-2acdaa4c32c8",
    reason_code: "v21_8h_r12e_direct_evidence_ready_for_confirm",
    request_id: "v21-8h-r12e-etude-role-ready",
    from_state: "under_review",
    to_state: "ready_for_confirm",
    evidence_id: null,
    fact_instance_id: null,
    confirmation_id: null
  }
);

assert.equal(artifact.production_readback.audits.length, 2);
assert.deepEqual(
  artifact.production_readback.audits.map((audit) => audit.request_id).sort(),
  [
    "v21-8h-r12e-etude-role-ready",
    "v21-8h-r12e-etude-role-under"
  ]
);
for (const audit of artifact.production_readback.audits) {
  assert.equal(audit.action, "admin.product_fact.review_prepared");
  assert.equal(audit.target_type, "product_fact_review_assignment");
  assert.equal(audit.target_id, assignmentId);
}

assert.deepEqual(artifact.production_readback.task, {
  state: "RESEARCH_PENDING",
  blocker_code: null,
  attempt_count: 0,
  registry_version: "product-fact-registry-cross-category-v1"
});

assert.equal(artifact.production_counts.product_fact_subjects, 50);
assert.equal(artifact.production_counts.product_fact_current, 104);
assert.equal(artifact.production_counts.fact_instances, 105);
assert.equal(artifact.production_counts.confirmations, 105);
assert.equal(artifact.production_counts.evidence_records, 108);
assert.equal(artifact.production_counts.target_evidence_rows, 1);
assert.equal(artifact.production_counts.target_ready_assignments, 1);
assert.equal(artifact.production_counts.target_fact_instances, 0);
assert.equal(artifact.production_counts.target_current_facts, 0);
assert.equal(artifact.production_counts.target_confirmations, 0);

for (const [key, expected] of Object.entries({
  committed_review_assignment_writes: 1,
  committed_review_event_writes: 2,
  committed_audit_writes: 2,
  committed_fact_instance_writes: 0,
  committed_product_fact_current_writes: 0,
  committed_confirmation_writes: 0,
  committed_recommendation_writes: 0,
  confirmation_preflight_authorized_for_current_stage: false,
  confirmation_authorized: false,
  recommendation_activation_authorized: false,
  public_activation: false
})) {
  assert.equal(artifact.authority_boundary[key], expected, key);
}

assert.equal(
  artifact.next_gate.stage,
  "V2.1-8H-R12F_READY3_CONFIRMATION_PREFLIGHT_ONLY"
);
assert.equal(artifact.next_gate.status, "NOT_EXECUTED");
assert.deepEqual(
  artifact.next_gate.candidate_assignment_ids,
  [assignmentId]
);
assert.deepEqual(
  artifact.next_gate.candidate_evidence_ids,
  [evidenceId]
);
assert.equal(
  artifact.next_gate.allowed_rpc,
  "admin_preflight_product_fact_confirmation_v1"
);
assert.equal(artifact.next_gate.confirmation_preflight_authorized, true);
assert.equal(artifact.next_gate.confirmation_authorized, false);
assert.equal(
  artifact.next_gate.expected_confirmation_rpc,
  "admin_confirm_product_fact_v1"
);
assert.equal(
  artifact.next_gate.recommendation_activation_authorized,
  false
);
assert.equal(artifact.next_gate.public_activation, false);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: artifact.stage,
    decision: artifact.decision,
    assignmentId,
    evidenceId,
    finalState: artifact.production_readback.assignment.operational_state,
    targetFactInstances: artifact.production_counts.target_fact_instances,
    targetConfirmations: artifact.production_counts.target_confirmations
  })
);
