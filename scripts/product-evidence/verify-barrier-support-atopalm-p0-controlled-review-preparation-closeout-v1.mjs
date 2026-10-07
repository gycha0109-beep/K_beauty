#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-controlled-review-preparation-closeout-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-review-preparation-preflight-v1.json";

const artifact=JSON.parse(fs.readFileSync(artifactPath,"utf8"));
const parent=JSON.parse(fs.readFileSync(parentPath,"utf8"));
const gitBlob=(path)=>execFileSync("git",["hash-object",path],{encoding:"utf8"}).trim();

const BARRIER_PROP="a1e01fd7508d83f2b251d33f59397f902a1ed20b4a09c51ed4dd3e3da7a639c5";
const ROLE_PROP="82e11e7bb7e999b242759f6ebdabcfb5fce4625ad0432e85144abbd64d2ce240";
const BARRIER_ASSIGN="dc558642-3dfb-4fe4-8733-d69310f71c51";
const ROLE_ASSIGN="8148748f-aea3-43fb-9cf1-4d50ac01cca3";
const BARRIER_EVIDENCE="af1a47e6-e168-4492-8407-1072f9f7ff60";
const ROLE_EVIDENCE="73bd7367-857f-476b-a88e-5beae7347c8b";

assert.equal(artifact.stage,"V2.1-8H-R13G");
assert.equal(artifact.decision,"BARRIER_SUPPORT_ATOPALM_P0_CONTROLLED_REVIEW_PREPARATION_PASS");
assert.equal(artifact.parent_authority.r13f_path,parentPath);
assert.equal(gitBlob(parentPath),artifact.parent_authority.r13f_git_blob_sha);
assert.equal(parent.decision,artifact.parent_authority.r13f_decision);
assert.equal(parent.next_gate.stage,"V2.1-8H-R13G_ATOPALM_CONTROLLED_REVIEW_PREPARATION");
assert.equal(parent.next_gate.review_preparation_authorized,true);
assert.equal(parent.next_gate.authorized_proposition_count,2);

assert.equal(artifact.execution.rpc,"admin_prepare_product_fact_review_v1(uuid,text,jsonb)");
assert.equal(artifact.execution.review_policy_version,"v21-8g3-b-direct-evidence-review-v1");
assert.equal(artifact.execution.sequence.length,4);
assert.deepEqual(
  artifact.execution.sequence.map(x=>[x.fact_key,x.to_state]),
  [
    ["barrier_support_claim","under_review"],
    ["barrier_support_claim","ready_for_confirm"],
    ["primary_use_role","under_review"],
    ["primary_use_role","ready_for_confirm"]
  ]
);

assert.equal(artifact.targets.length,2);
const targetMap=new Map(artifact.targets.map(x=>[x.fact_key,x]));
assert.equal(targetMap.get("barrier_support_claim").assignment_id,BARRIER_ASSIGN);
assert.equal(targetMap.get("barrier_support_claim").evidence_id,BARRIER_EVIDENCE);
assert.equal(targetMap.get("barrier_support_claim").proposition_key,BARRIER_PROP);
assert.equal(targetMap.get("barrier_support_claim").value,true);
assert.equal(targetMap.get("primary_use_role").assignment_id,ROLE_ASSIGN);
assert.equal(targetMap.get("primary_use_role").evidence_id,ROLE_EVIDENCE);
assert.equal(targetMap.get("primary_use_role").proposition_key,ROLE_PROP);
assert.equal(targetMap.get("primary_use_role").value,"multi_area");

assert.equal(artifact.production_readback.assignments.length,2);
for(const a of artifact.production_readback.assignments){
  assert.equal(a.operational_state,"ready_for_confirm");
  assert.equal(a.review_policy_version,"v21-8g3-b-direct-evidence-review-v1");
}
assert.equal(artifact.production_readback.review_events.length,4);
assert.equal(artifact.production_readback.audits.length,4);
assert.equal(artifact.production_readback.tasks.length,2);
for(const t of artifact.production_readback.tasks){
  assert.equal(t.state,"RESEARCH_PENDING");
  assert.equal(t.attempt_count,0);
  assert.equal(t.blocker_code,null);
  assert.equal(t.evidence_id,null);
  assert.equal(t.evidence_candidate_id,null);
}

assert.deepEqual(artifact.production_counts,{
  product_fact_subjects:51,
  product_fact_current:105,
  fact_instances:106,
  confirmations:106,
  evidence_records:110,
  target_evidence_rows:2,
  target_ready_assignments:2,
  target_review_events:4,
  target_audits:4,
  target_fact_instances:0,
  target_current_facts:0,
  target_confirmations:0
});

assert.deepEqual(artifact.authority_boundary,{
  committed_review_assignment_writes:2,
  committed_review_event_writes:4,
  committed_audit_writes:4,
  committed_fact_instance_writes:0,
  committed_product_fact_current_writes:0,
  committed_confirmation_writes:0,
  committed_recommendation_writes:0,
  confirmation_preflight_authorized_for_current_stage:false,
  confirmation_authorized:false,
  recommendation_activation_authorized:false,
  public_activation:false,
  production_cutover_authorized:false
});

assert.equal(artifact.next_gate.stage,"V2.1-8H-R13H_ATOPALM_CONFIRMATION_PREFLIGHT_ONLY");
assert.equal(artifact.next_gate.status,"NOT_EXECUTED");
assert.equal(artifact.next_gate.candidates.length,2);
assert.deepEqual(
  new Set(artifact.next_gate.candidates.map(x=>x.assignment_id)),
  new Set([BARRIER_ASSIGN,ROLE_ASSIGN])
);
assert.deepEqual(
  new Set(artifact.next_gate.candidates.map(x=>x.evidence_id)),
  new Set([BARRIER_EVIDENCE,ROLE_EVIDENCE])
);
assert.equal(artifact.next_gate.allowed_rpc,"admin_preflight_product_fact_confirmation_v1");
assert.equal(artifact.next_gate.confirmation_preflight_authorized,true);
assert.equal(artifact.next_gate.confirmation_authorized,false);
assert.equal(artifact.next_gate.expected_confirmation_rpc,"admin_confirm_product_fact_v1");
assert.equal(artifact.next_gate.recommendation_activation_authorized,false);
assert.equal(artifact.next_gate.public_activation,false);

console.log(JSON.stringify({
  status:"PASS",
  stage:artifact.stage,
  decision:artifact.decision,
  readyAssignments:2,
  factWrites:0,
  currentWrites:0,
  confirmationWrites:0
}));
