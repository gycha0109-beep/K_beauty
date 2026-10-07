#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-controlled-evidence-ingest-closeout-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-direct-evidence-ingest-preflight-v1.json";
const artifact = JSON.parse(fs.readFileSync(artifactPath,"utf8"));
const parent = JSON.parse(fs.readFileSync(parentPath,"utf8"));
const gitBlob=(path)=>execFileSync("git",["hash-object",path],{encoding:"utf8"}).trim();

const PRODUCT="418e2bc1-7d6c-4334-9058-7af7ce159c6c";
const SUBJECT="c7e19978-5678-466b-ba69-f5936aeca5cc";
const BARRIER_TASK="b1430a7d-79bb-43a5-bfea-a19599441811";
const ROLE_TASK="cbdad075-35a1-476e-b3ac-6279b676e73e";
const BARRIER_EVIDENCE="af1a47e6-e168-4492-8407-1072f9f7ff60";
const ROLE_EVIDENCE="73bd7367-857f-476b-a88e-5beae7347c8b";

assert.equal(artifact.stage,"V2.1-8H-R13E");
assert.equal(artifact.decision,"BARRIER_SUPPORT_ATOPALM_P0_CONTROLLED_EVIDENCE_INGEST_PASS");
assert.equal(artifact.parent_authority.r13d_path,parentPath);
assert.equal(gitBlob(parentPath),artifact.parent_authority.r13d_git_blob_sha);
assert.equal(parent.decision,artifact.parent_authority.r13d_decision);
assert.equal(parent.next_gate.stage,"V2.1-8H-R13E_ATOPALM_CONTROLLED_EVIDENCE_INGEST");
assert.equal(parent.next_gate.evidence_ingest_authorized,true);
assert.equal(parent.next_gate.authorized_candidate_count,2);
assert.equal(parent.next_gate.max_committed_source_writes,1);
assert.equal(parent.next_gate.max_committed_binding_writes,1);
assert.equal(parent.next_gate.max_committed_evidence_writes,2);

assert.equal(artifact.target.product_id,PRODUCT);
assert.equal(artifact.target.subject_id,SUBJECT);
assert.equal(artifact.target.market,"KR");

assert.equal(artifact.execution.candidates.length,2);
const execMap=new Map(artifact.execution.candidates.map((c)=>[c.task_id,c]));
const barrier=execMap.get(BARRIER_TASK);
const role=execMap.get(ROLE_TASK);
assert.ok(barrier); assert.ok(role);

assert.equal(barrier.request_id,"v21-8h-r13e-atopalm-barrier-ingest");
assert.equal(barrier.fact_key,"barrier_support_claim");
assert.equal(barrier.value,true);
assert.equal(barrier.evidence_class,"product_claim");
assert.equal(barrier.rpc_result_status,"evidence_recorded");
assert.equal(barrier.source_inserted,true);
assert.equal(barrier.binding_inserted,true);
assert.equal(barrier.evidence_inserted,true);
assert.equal(barrier.evidence_id,BARRIER_EVIDENCE);
assert.equal(barrier.proposition_key,parent.digest_contract.barrier_support_claim.proposition.proposition_key);
assert.equal(barrier.canonical_evidence_digest,parent.digest_contract.barrier_support_claim.evidence.canonical_evidence_digest);

assert.equal(role.request_id,"v21-8h-r13e-atopalm-role-ingest");
assert.equal(role.fact_key,"primary_use_role");
assert.equal(role.value,"multi_area");
assert.equal(role.evidence_class,"usage_instruction");
assert.equal(role.rpc_result_status,"evidence_recorded");
assert.equal(role.source_inserted,false);
assert.equal(role.binding_inserted,false);
assert.equal(role.evidence_inserted,true);
assert.equal(role.evidence_id,ROLE_EVIDENCE);
assert.equal(role.proposition_key,parent.digest_contract.primary_use_role.proposition.proposition_key);
assert.equal(role.canonical_evidence_digest,parent.digest_contract.primary_use_role.evidence.canonical_evidence_digest);

assert.equal(artifact.production_ids.source_id,"35cd1f0d-575b-4807-8977-41a635cd5a4b");
assert.equal(artifact.production_ids.binding_id,"058b9f34-6c8b-4595-84ed-8fed87e78c5f");
assert.equal(artifact.production_ids.barrier_evidence_id,BARRIER_EVIDENCE);
assert.equal(artifact.production_ids.role_evidence_id,ROLE_EVIDENCE);

assert.equal(artifact.production_readback.source.canonical_locator,parent.planned_rpc.source.canonical_locator);
assert.equal(artifact.production_readback.source.content_digest,parent.planned_rpc.source.content_digest);
assert.equal(artifact.production_readback.source.market,"KR");
assert.equal(artifact.production_readback.binding.binding_state,"exact_subject_match");
assert.equal(artifact.production_readback.binding.scope_relation,"equivalent");
assert.equal(artifact.production_readback.binding.bundle_units,2);
assert.equal(artifact.production_readback.binding.unit_size_ml,100);
assert.equal(artifact.production_readback.binding.total_size_ml,200);

assert.equal(artifact.production_readback.evidence.length,2);
const evidenceMap=new Map(artifact.production_readback.evidence.map((e)=>[e.fact_key,e]));
const bEv=evidenceMap.get("barrier_support_claim");
const rEv=evidenceMap.get("primary_use_role");
assert.equal(bEv.evidence_id,BARRIER_EVIDENCE);
assert.equal(bEv.proposition_value_identity,true);
assert.equal(bEv.evidence_class,"product_claim");
assert.equal(bEv.canonical_evidence_digest,barrier.canonical_evidence_digest);
assert.equal(rEv.evidence_id,ROLE_EVIDENCE);
assert.equal(rEv.proposition_value_identity,"multi_area");
assert.equal(rEv.evidence_class,"usage_instruction");
assert.equal(rEv.canonical_evidence_digest,role.canonical_evidence_digest);

assert.equal(artifact.production_readback.tasks.length,2);
for(const t of artifact.production_readback.tasks){
  assert.equal(t.state,"RESEARCH_PENDING");
  assert.equal(t.attempt_count,0);
  assert.equal(t.blocker_code,null);
  assert.equal(t.evidence_id,null);
  assert.equal(t.evidence_candidate_id,null);
}

assert.deepEqual(artifact.production_counts,{
  product_fact_subjects_before:51,
  product_fact_subjects_after:51,
  product_fact_current_before:105,
  product_fact_current_after:105,
  fact_instances_before:106,
  fact_instances_after:106,
  confirmations_before:106,
  confirmations_after:106,
  evidence_records_before:108,
  evidence_records_after:110,
  target_fact_instances:0,
  target_current_facts:0,
  target_review_assignments:0,
  target_assignment_events:0,
  target_confirmations:0
});

assert.deepEqual(artifact.authority_boundary,{
  committed_source_writes:1,
  committed_binding_writes:1,
  committed_evidence_writes:2,
  committed_review_events:2,
  committed_audit_rows:2,
  committed_review_assignments:0,
  committed_fact_instance_writes:0,
  committed_product_fact_current_writes:0,
  committed_confirmation_writes:0,
  committed_recommendation_writes:0,
  review_preparation_authorized:false,
  confirmation_preflight_authorized:false,
  confirmation_authorized:false,
  recommendation_activation_authorized:false,
  public_activation:false,
  production_cutover_authorized:false
});

assert.equal(artifact.next_gate.stage,"V2.1-8H-R13F_ATOPALM_REVIEW_PREPARATION_PREFLIGHT");
assert.equal(artifact.next_gate.status,"NOT_EXECUTED");
assert.deepEqual(new Set(artifact.next_gate.candidate_evidence_ids),new Set([BARRIER_EVIDENCE,ROLE_EVIDENCE]));
assert.equal(artifact.next_gate.review_preparation_authorized,false);
assert.equal(artifact.next_gate.confirmation_preflight_authorized,false);
assert.equal(artifact.next_gate.confirmation_authorized,false);
assert.equal(artifact.next_gate.recommendation_activation_authorized,false);

console.log(JSON.stringify({
  status:"PASS",
  stage:artifact.stage,
  decision:artifact.decision,
  evidenceWrites:2,
  evidenceBefore:108,
  evidenceAfter:110,
  factWrites:0,
  currentWrites:0,
  confirmationWrites:0
}));
