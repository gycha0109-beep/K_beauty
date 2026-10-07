#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-review-preparation-preflight-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-controlled-evidence-ingest-closeout-v1.json";

const artifact=JSON.parse(fs.readFileSync(artifactPath,"utf8"));
const parent=JSON.parse(fs.readFileSync(parentPath,"utf8"));
const gitBlob=(path)=>execFileSync("git",["hash-object",path],{encoding:"utf8"}).trim();

const ACTOR="e1a59349-fe13-43ff-86ce-078c2dce0d99";
const PRODUCT="418e2bc1-7d6c-4334-9058-7af7ce159c6c";
const SUBJECT="c7e19978-5678-466b-ba69-f5936aeca5cc";
const BARRIER="a1e01fd7508d83f2b251d33f59397f902a1ed20b4a09c51ed4dd3e3da7a639c5";
const ROLE="82e11e7bb7e999b242759f6ebdabcfb5fce4625ad0432e85144abbd64d2ce240";
const BARRIER_EVIDENCE="af1a47e6-e168-4492-8407-1072f9f7ff60";
const ROLE_EVIDENCE="73bd7367-857f-476b-a88e-5beae7347c8b";

assert.equal(artifact.stage,"V2.1-8H-R13F");
assert.equal(artifact.decision,"BARRIER_SUPPORT_ATOPALM_P0_REVIEW_PREPARATION_PREFLIGHT_PASS");
assert.equal(artifact.parent_authority.r13e_path,parentPath);
assert.equal(gitBlob(parentPath),artifact.parent_authority.r13e_git_blob_sha);
assert.equal(parent.decision,artifact.parent_authority.r13e_decision);
assert.equal(parent.next_gate.stage,"V2.1-8H-R13F_ATOPALM_REVIEW_PREPARATION_PREFLIGHT");

assert.equal(artifact.runtime_contract.prepare_review_function_sha256,"9d0992369021a37a83c96561f8ad3d9e9b505a61771b7b5312fa35fc424dbff1");
assert.equal(artifact.runtime_contract.anon_execute,false);
assert.equal(artifact.runtime_contract.authenticated_execute,false);
assert.equal(artifact.runtime_contract.service_role_execute,true);
assert.equal(artifact.runtime_contract.required_capability,"admin.products.review");
assert.equal(artifact.runtime_contract.review_policy_version,"v21-8g3-b-direct-evidence-review-v1");

assert.equal(artifact.registry_write_policies.length,2);
const policyMap=new Map(artifact.registry_write_policies.map((p)=>[p.fact_key,p]));
assert.deepEqual(policyMap.get("barrier_support_claim"),{
  registry_version:"product-fact-registry-cross-category-v1",
  fact_key:"barrier_support_claim",
  lineage_kind:"new",
  allowed:true,
  reason:"ALLOWED",
  policy_state:"active",
  policy_version:"data-ai29c-uva-r3d-registry-coexistence-v1",
  policy_digest:"6f3cbd77ba4501100cc637c2ac1300ccc0591563973a50c8d28a4b70503c6f6e",
  new_lineage_allowed:true,
  existing_lineage_allowed:true
});
assert.deepEqual(policyMap.get("primary_use_role"),{
  registry_version:"product-fact-registry-cross-category-v1",
  fact_key:"primary_use_role",
  lineage_kind:"new",
  allowed:true,
  reason:"ALLOWED",
  policy_state:"active",
  policy_version:"data-ai29c-uva-r3d-registry-coexistence-v1",
  policy_digest:"1ee29792af7acddc521916fedef250944d10e2a4c0a55ef75ba46a9d3ca03e46",
  new_lineage_allowed:true,
  existing_lineage_allowed:true
});

assert.equal(artifact.targets.length,2);
const targetMap=new Map(artifact.targets.map((t)=>[t.fact_key,t]));
const bt=targetMap.get("barrier_support_claim");
const rt=targetMap.get("primary_use_role");
assert.equal(bt.product_id,PRODUCT);
assert.equal(bt.subject_id,SUBJECT);
assert.equal(bt.evidence_id,BARRIER_EVIDENCE);
assert.equal(bt.proposition_key,BARRIER);
assert.equal(bt.value,true);
assert.equal(bt.evidence_class,"product_claim");
assert.equal(rt.product_id,PRODUCT);
assert.equal(rt.subject_id,SUBJECT);
assert.equal(rt.evidence_id,ROLE_EVIDENCE);
assert.equal(rt.proposition_key,ROLE);
assert.equal(rt.value,"multi_area");
assert.equal(rt.evidence_class,"usage_instruction");
for(const t of artifact.targets){
  assert.equal(t.evidence_authority,"product_specific_primary");
  assert.equal(t.confidence,"high");
  assert.equal(t.support_direction,"supports");
  assert.equal(t.task_state,"RESEARCH_PENDING");
  assert.equal(t.task_attempt_count,0);
  assert.equal(t.task_blocker_code,null);
}

assert.deepEqual(artifact.transition_contract.required_sequence,["under_review","ready_for_confirm"]);
assert.equal(artifact.transition_contract.direct_new_to_ready_for_confirm_forbidden,true);
assert.equal(artifact.transition_contract.assigned_to,ACTOR);
assert.equal(artifact.transition_contract.per_proposition_independent_assignment,true);

assert.equal(artifact.planned_rpcs.length,4);
assert.deepEqual(
  artifact.planned_rpcs.map((x)=>[x.payload.fact_key,x.payload.operational_state]),
  [
    ["barrier_support_claim","under_review"],
    ["barrier_support_claim","ready_for_confirm"],
    ["primary_use_role","under_review"],
    ["primary_use_role","ready_for_confirm"]
  ]
);
for(const entry of artifact.planned_rpcs){
  assert.equal(entry.payload.product_id,PRODUCT);
  assert.equal(entry.payload.subject_id,SUBJECT);
  assert.equal(entry.payload.registry_version,"product-fact-registry-cross-category-v1");
  assert.equal(entry.payload.assigned_to,ACTOR);
  assert.equal(entry.payload.review_policy_version,"v21-8g3-b-direct-evidence-review-v1");
}

assert.deepEqual(artifact.production_prestate,{
  product_fact_subjects:51,
  product_fact_current:105,
  fact_instances:106,
  confirmations:106,
  evidence_records:110,
  target_evidence_rows:2,
  target_review_assignments:0,
  target_fact_instances:0,
  target_current_facts:0,
  target_confirmations:0
});

assert.equal(artifact.rollback_probe.rpc_calls_attempted,4);
assert.equal(artifact.rollback_probe.rpc_calls_accepted,4);
assert.deepEqual(artifact.rollback_probe.in_transaction,{
  target_assignments:2,
  ready_for_confirm_assignments:2,
  assignment_review_events:4,
  admin_audits:4,
  target_fact_instances:0,
  target_current_facts:0,
  target_confirmations:0
});
assert.deepEqual(artifact.rollback_probe.post_rollback,{
  target_assignments:0,
  assignment_review_events:0,
  admin_audits:0,
  target_fact_instances:0,
  target_current_facts:0,
  target_confirmations:0,
  target_evidence_rows:2
});
assert.deepEqual(artifact.rollback_probe.final_global_counts,{
  product_fact_subjects:51,
  product_fact_current:105,
  fact_instances:106,
  confirmations:106,
  evidence_records:110
});

assert.deepEqual(artifact.authority_boundary,{
  committed_review_assignment_writes:0,
  committed_review_event_writes:0,
  committed_audit_writes:0,
  committed_fact_instance_writes:0,
  committed_product_fact_current_writes:0,
  committed_confirmation_writes:0,
  committed_recommendation_writes:0,
  review_preparation_authorized_for_current_stage:false,
  confirmation_preflight_authorized:false,
  confirmation_authorized:false,
  recommendation_activation_authorized:false,
  public_activation:false,
  production_cutover_authorized:false
});

assert.equal(artifact.next_gate.stage,"V2.1-8H-R13G_ATOPALM_CONTROLLED_REVIEW_PREPARATION");
assert.equal(artifact.next_gate.status,"NOT_EXECUTED");
assert.equal(artifact.next_gate.authorized_proposition_count,2);
assert.deepEqual(new Set(artifact.next_gate.authorized_proposition_keys),new Set([BARRIER,ROLE]));
assert.equal(artifact.next_gate.allowed_rpc,"admin_prepare_product_fact_review_v1");
assert.deepEqual(artifact.next_gate.required_sequence,["under_review","ready_for_confirm"]);
assert.equal(artifact.next_gate.max_committed_review_assignments,2);
assert.equal(artifact.next_gate.max_committed_review_events,4);
assert.equal(artifact.next_gate.review_preparation_authorized,true);
assert.equal(artifact.next_gate.confirmation_preflight_authorized,false);
assert.equal(artifact.next_gate.confirmation_authorized,false);
assert.equal(artifact.next_gate.recommendation_activation_authorized,false);

console.log(JSON.stringify({
  status:"PASS",
  stage:artifact.stage,
  decision:artifact.decision,
  propositions:2,
  rollbackResidue:0
}));
