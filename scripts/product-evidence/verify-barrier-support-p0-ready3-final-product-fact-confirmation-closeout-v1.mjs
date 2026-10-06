#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-final-product-fact-confirmation-closeout-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-confirmation-preflight-closeout-v1.json";

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const parent = JSON.parse(fs.readFileSync(parentPath, "utf8"));

const gitBlob = (path) =>
  execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim();

const assignmentId = "4eef7c5f-30d6-495e-a42b-a6cdeaacc380";
const evidenceId = "45b57536-0637-44e0-b427-bb55923c4812";
const confirmationId = "9947fc0b-2a75-43a5-8569-156dedcba5e1";
const factInstanceId = "3317cbd1-0d05-4342-ad75-d7acf49980d3";
const propositionKey =
  "379a68e4b599cbcc5583b0a830b3718c3f5af0fc52ec62d4d823a728626834d2";
const payloadDigest =
  "6a777a2bab29f38ba246db4d72b6f318465ddbf2fbd0b69bdedfb45dc75898d6";
const prestateDigest =
  "e3d9e16b9aa36cedc37a92911a0b9a62f58d1211af7b3c21bd32345a47915411";
const fusionDigest =
  "61ad796e16ccdd844f2ec2e97c4d47053b6bfa1591830353e53d97efdaeacdf2";

assert.equal(artifact.stage, "V2.1-8H-R12G");
assert.equal(
  artifact.decision,
  "BARRIER_SUPPORT_P0_READY3_FINAL_PRODUCT_FACT_CONFIRMATION_PASS"
);

assert.equal(artifact.parent_authority.r12f_path, parentPath);
assert.equal(gitBlob(parentPath), artifact.parent_authority.r12f_git_blob_sha);
assert.equal(parent.decision, artifact.parent_authority.r12f_decision);
assert.equal(parent.execution.payload_digest, payloadDigest);
assert.equal(parent.execution.prestate_digest, prestateDigest);
assert.equal(parent.execution.fusion_input_digest, fusionDigest);
assert.equal(parent.authority_boundary.confirmation_called, false);

assert.equal(
  artifact.authority.confirm_rpc,
  "admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)"
);
assert.equal(
  artifact.authority.confirm_function_sha256,
  "b143613eac0e27b7e223379f7b5c20179a89f2b4b04150463c84e880656dcf29"
);
assert.equal(artifact.authority.required_capability, "admin.products.review");
assert.equal(artifact.authority.service_role_only, true);

assert.equal(artifact.stale_revalidation.assignment_state, "ready_for_confirm");
assert.equal(artifact.stale_revalidation.subject_identity_status, "resolved");
assert.equal(artifact.stale_revalidation.subject_current_state, "current");
assert.equal(artifact.stale_revalidation.subject_market, "KR");
assert.equal(artifact.stale_revalidation.registry_write_allowed, true);
assert.equal(artifact.stale_revalidation.registry_write_reason, "ALLOWED");
assert.equal(artifact.stale_revalidation.current_evidence_count, 1);
assert.equal(artifact.stale_revalidation.target_fact_instances_before, 0);
assert.equal(artifact.stale_revalidation.target_current_before, 0);
assert.equal(artifact.stale_revalidation.target_confirmations_before, 0);
assert.equal(artifact.stale_revalidation.fusion_input_digest, fusionDigest);
assert.equal(artifact.stale_revalidation.final_preflight_status, "ready");
assert.equal(artifact.stale_revalidation.payload_digest, payloadDigest);
assert.equal(artifact.stale_revalidation.prestate_digest, prestateDigest);
assert.equal(artifact.stale_revalidation.previous_current, null);
assert.equal(artifact.stale_revalidation.digest_match_with_r12f, true);

assert.equal(artifact.confirmation.status, "confirmed");
assert.equal(artifact.confirmation.idempotent, false);
assert.equal(artifact.confirmation.assignment_id, assignmentId);
assert.equal(artifact.confirmation.evidence_id, evidenceId);
assert.equal(artifact.confirmation.confirmation_id, confirmationId);
assert.equal(artifact.confirmation.fact_instance_id, factInstanceId);
assert.equal(artifact.confirmation.proposition_key, propositionKey);
assert.equal(artifact.confirmation.fact_key, "primary_use_role");
assert.equal(artifact.confirmation.semantic_status, "supported");
assert.equal(artifact.confirmation.value_type, "enum");
assert.equal(artifact.confirmation.value_enum, "multi_area");
assert.equal(artifact.confirmation.market, "KR");
assert.equal(
  artifact.confirmation.authority_ceiling,
  "product_specific_primary"
);
assert.equal(artifact.confirmation.fused_confidence, "high");
assert.equal(artifact.confirmation.fusion_input_digest, fusionDigest);
assert.equal(artifact.confirmation.payload_digest, payloadDigest);
assert.equal(artifact.confirmation.prestate_digest, prestateDigest);
assert.equal(
  artifact.confirmation.result_digest,
  "cfe5d6b14a2e150d8bdda0536ec794ed301431e0fdd39a70ebfcbf3b2e548784"
);
assert.equal(artifact.confirmation.previous_fact_instance_id, null);

assert.equal(
  artifact.production_readback.fact_instance.fact_instance_id,
  factInstanceId
);
assert.equal(
  artifact.production_readback.fact_instance.semantic_status,
  "supported"
);
assert.equal(
  artifact.production_readback.fact_instance.value_enum,
  "multi_area"
);
assert.equal(
  artifact.production_readback.fact_instance.supersedes_fact_instance_id,
  null
);
assert.equal(
  artifact.production_readback.current.fact_instance_id,
  factInstanceId
);
assert.equal(
  artifact.production_readback.current.confirmation_id,
  confirmationId
);
assert.equal(
  artifact.production_readback.evidence_link.evidence_id,
  evidenceId
);
assert.equal(
  artifact.production_readback.evidence_link.link_role,
  "supporting"
);
assert.equal(
  artifact.production_readback.assignment.operational_state,
  "confirmed"
);
assert.equal(artifact.production_readback.review_event_count, 3);
assert.equal(artifact.production_readback.confirmation_event_count, 1);
assert.equal(
  artifact.production_readback.audit_action,
  "admin.product_fact.confirmed"
);

assert.deepEqual(artifact.production_counts, {
  product_fact_subjects: 50,
  product_fact_current_before: 104,
  product_fact_current_after: 105,
  fact_instances_before: 105,
  fact_instances_after: 106,
  confirmations_before: 105,
  confirmations_after: 106,
  evidence_records_after: 108,
  evidence_links_after: 106,
  target_fact_instances_after: 1,
  target_current_after: 1,
  target_confirmation_events_after: 1,
  target_evidence_links_after: 1
});

assert.equal(
  artifact.research_task_invariance.task_id,
  "39449932-6c41-4762-bf39-e6848c9ad09a"
);
assert.equal(artifact.research_task_invariance.state, "RESEARCH_PENDING");
assert.equal(artifact.research_task_invariance.blocker_code, null);
assert.equal(artifact.research_task_invariance.attempt_count, 0);
assert.equal(
  artifact.research_task_invariance.intentionally_not_mutated_by_confirmation,
  true
);

assert.deepEqual(artifact.authority_boundary, {
  product_fact_confirmation_complete: true,
  recommendation_admission_authorized: false,
  recommendation_activation_authorized: false,
  public_activation: false,
  production_cutover_authorized: false
});

assert.equal(artifact.follow_up.status, "NOT_EXECUTED");
assert.equal(
  artifact.follow_up.separate_authority_required_for_recommendation_admission,
  true
);
assert.equal(
  artifact.follow_up.separate_authority_required_for_recommendation_activation,
  true
);

console.log(JSON.stringify({
  status: "PASS",
  stage: artifact.stage,
  decision: artifact.decision,
  confirmationId,
  factInstanceId,
  assignmentId,
  evidenceId,
  recommendationActivation: false
}));
