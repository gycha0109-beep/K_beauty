#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-confirmation-preflight-closeout-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-controlled-review-preparation-closeout-v1.json";

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const parent = JSON.parse(fs.readFileSync(parentPath, "utf8"));

const gitBlob = (path) =>
  execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim();

const assignmentId = "4eef7c5f-30d6-495e-a42b-a6cdeaacc380";
const evidenceId = "45b57536-0637-44e0-b427-bb55923c4812";
const propositionKey =
  "379a68e4b599cbcc5583b0a830b3718c3f5af0fc52ec62d4d823a728626834d2";
const fusionInputDigest =
  "61ad796e16ccdd844f2ec2e97c4d47053b6bfa1591830353e53d97efdaeacdf2";
const payloadDigest =
  "6a777a2bab29f38ba246db4d72b6f318465ddbf2fbd0b69bdedfb45dc75898d6";
const prestateDigest =
  "e3d9e16b9aa36cedc37a92911a0b9a62f58d1211af7b3c21bd32345a47915411";

assert.equal(artifact.stage, "V2.1-8H-R12F");
assert.equal(
  artifact.decision,
  "BARRIER_SUPPORT_P0_READY3_CONFIRMATION_PREFLIGHT_PASS"
);

assert.equal(artifact.parent_authority.r12e_path, parentPath);
assert.equal(
  gitBlob(parentPath),
  artifact.parent_authority.r12e_git_blob_sha
);
assert.equal(
  parent.decision,
  artifact.parent_authority.r12e_decision
);
assert.equal(
  parent.production_readback.assignment.operational_state,
  "ready_for_confirm"
);
assert.equal(parent.target.assignment_id, assignmentId);
assert.equal(parent.target.evidence_id, evidenceId);

assert.equal(
  artifact.authority.preflight_rpc,
  "admin_preflight_product_fact_confirmation_v1(uuid,text,jsonb)"
);
assert.equal(
  artifact.authority.preflight_function_sha256,
  "7d9ce38e47468fb1a419528256857e399a3d7e50e719f7bd449034c96019f59e"
);
assert.equal(
  artifact.authority.confirm_rpc,
  "admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)"
);
assert.equal(
  artifact.authority.confirm_function_sha256,
  "b143613eac0e27b7e223379f7b5c20179a89f2b4b04150463c84e880656dcf29"
);
assert.equal(artifact.authority.confirm_called, false);

assert.equal(artifact.target.assignment_id, assignmentId);
assert.equal(artifact.target.evidence_id, evidenceId);
assert.equal(artifact.target.proposition_key, propositionKey);
assert.equal(artifact.target.fact_key, "primary_use_role");
assert.equal(artifact.target.semantic_status, "supported");
assert.equal(artifact.target.value_type, "enum");
assert.equal(artifact.target.value, "multi_area");
assert.equal(
  artifact.target.authority_ceiling,
  "product_specific_primary"
);
assert.equal(artifact.target.fused_confidence, "high");

assert.equal(artifact.payload.assignment_id, assignmentId);
assert.equal(artifact.payload.proposition_key, propositionKey);
assert.equal(
  artifact.payload.proposition_serializer_version,
  "product-fact-proposition-pilot-v1"
);
assert.equal(artifact.payload.semantic_status, "supported");
assert.equal(artifact.payload.value_type, "enum");
assert.equal(artifact.payload.value_enum, "multi_area");
assert.equal(artifact.payload.value_boolean, null);
assert.equal(artifact.payload.value_number, null);
assert.equal(artifact.payload.value_unit, null);
assert.equal(artifact.payload.value_range_min, null);
assert.equal(artifact.payload.value_range_max, null);
assert.equal(artifact.payload.value_entity_identifier, null);
assert.equal(artifact.payload.market, "KR");
assert.equal(artifact.payload.region, null);
assert.equal(artifact.payload.locale, null);
assert.equal(artifact.payload.valid_from, null);
assert.equal(artifact.payload.valid_to, null);
assert.deepEqual(artifact.payload.qualifier, {});
assert.equal(artifact.payload.parent_fact_instance_id, null);
assert.equal(artifact.payload.parent_proposition_key, null);
assert.equal(
  artifact.payload.authority_ceiling,
  "product_specific_primary"
);
assert.equal(artifact.payload.fused_confidence, "high");
assert.equal(
  artifact.payload.fusion_policy_version,
  "v2.1-4-product-fact-evidence-fusion-v1"
);
assert.equal(artifact.payload.fusion_input_digest, fusionInputDigest);
assert.deepEqual(
  artifact.payload.supporting_evidence_ids,
  [evidenceId]
);
assert.deepEqual(artifact.payload.opposing_evidence_ids, []);

assert.equal(
  artifact.execution.request_id,
  "v21-8h-r12f-etude-role-preflight"
);
assert.equal(artifact.execution.status, "ready");
assert.equal(artifact.execution.actor_role, "admin_owner");
assert.equal(artifact.execution.payload_digest, payloadDigest);
assert.equal(artifact.execution.prestate_digest, prestateDigest);
assert.equal(
  artifact.execution.fusion_input_digest,
  fusionInputDigest
);
assert.equal(artifact.execution.previous_current, null);
assert.deepEqual(
  artifact.execution.supporting_evidence_ids,
  [evidenceId]
);
assert.deepEqual(artifact.execution.opposing_evidence_ids, []);
assert.deepEqual(artifact.execution.expected_write_set, {
  product_fact_current: 1,
  product_fact_instances: 1,
  product_fact_confirmations: 1,
  product_fact_review_events: 1,
  product_fact_evidence_links: 1,
  product_fact_review_assignments_update: 1
});

assert.deepEqual(artifact.post_preflight_readback, {
  assignment_state: "ready_for_confirm",
  assignment_event_count: 2,
  preflight_audit_count: 0,
  target_fact_instances: 0,
  target_current_facts: 0,
  target_confirmations: 0,
  target_evidence_links: 0,
  global_product_fact_current: 104,
  global_fact_instances: 105,
  global_confirmations: 105
});

assert.deepEqual(artifact.authority_boundary, {
  confirmation_preflight_complete: true,
  confirmation_authorized_in_r12f: false,
  confirmation_called: false,
  product_fact_materialized: false,
  recommendation_activation_authorized: false,
  public_activation: false
});

assert.equal(
  artifact.stop_boundary,
  "STOP_BEFORE_R12G_FINAL_CONFIRMATION"
);
assert.equal(
  artifact.next_gate.stage,
  "V2.1-8H-R12G_READY3_FINAL_PRODUCT_FACT_CONFIRMATION"
);
assert.equal(artifact.next_gate.status, "NOT_EXECUTED");
assert.equal(
  artifact.next_gate.candidate_assignment_id,
  assignmentId
);
assert.equal(
  artifact.next_gate.candidate_evidence_id,
  evidenceId
);
assert.equal(
  artifact.next_gate.preflight_payload_digest,
  payloadDigest
);
assert.equal(
  artifact.next_gate.preflight_prestate_digest,
  prestateDigest
);
assert.equal(
  artifact.next_gate.requires_fresh_prestate_revalidation,
  true
);
assert.equal(
  artifact.next_gate.allowed_rpc,
  "admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)"
);
assert.equal(
  artifact.next_gate.confirmation_execution_candidate,
  true
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
    payloadDigest,
    prestateDigest,
    zeroWrite: true
  })
);
