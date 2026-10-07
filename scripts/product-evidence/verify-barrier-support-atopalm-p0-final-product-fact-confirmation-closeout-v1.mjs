#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-final-product-fact-confirmation-closeout-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-confirmation-preflight-closeout-v1.json";
const artifact=JSON.parse(fs.readFileSync(artifactPath,"utf8"));
const parent=JSON.parse(fs.readFileSync(parentPath,"utf8"));
const gitBlob=(path)=>execFileSync("git",["hash-object",path],{encoding:"utf8"}).trim();

const barrierFact="324cc23b-62d6-4c7b-8276-85cdc89ef070";
const roleFact="1d35eaae-3166-4ad8-842f-4d36e743a22a";
const barrierConfirmation="bb9554a6-852b-4c18-b10f-e56ff39f30f6";
const roleConfirmation="06354e09-5122-417c-b3c7-ca64e078754a";

assert.equal(artifact.stage,"V2.1-8H-R13I");
assert.equal(artifact.decision,"BARRIER_SUPPORT_ATOPALM_P0_FINAL_PRODUCT_FACT_CONFIRMATION_PASS");
assert.equal(artifact.parent_authority.r13h_path,parentPath);
assert.equal(gitBlob(parentPath),artifact.parent_authority.r13h_git_blob_sha);
assert.equal(parent.decision,artifact.parent_authority.r13h_decision);
assert.equal(parent.stop_boundary,"STOP_BEFORE_R13I_FINAL_CONFIRMATION");
assert.equal(parent.next_gate.stage,"V2.1-8H-R13I_ATOPALM_FINAL_PRODUCT_FACT_CONFIRMATION");

assert.equal(artifact.authority.confirm_function_sha256,"b143613eac0e27b7e223379f7b5c20179a89f2b4b04150463c84e880656dcf29");
assert.equal(artifact.execution.isolation_level,"serializable");
assert.equal(artifact.execution.transaction_mode,"all-or-nothing");
assert.equal(artifact.execution.confirmations_requested,2);
assert.equal(artifact.execution.confirmations_committed,2);
assert.equal(artifact.execution.stale_preflight_rechecks,2);
assert.equal(artifact.execution.stale_preflight_matches,2);
assert.equal(artifact.execution.rollback_on_any_mismatch,true);

assert.equal(artifact.stale_revalidation.length,2);
for(const s of artifact.stale_revalidation){
  assert.equal(s.assignment_state,"ready_for_confirm");
  assert.equal(s.subject_identity_status,"resolved");
  assert.equal(s.subject_current_state,"current");
  assert.equal(s.subject_market,"KR");
  assert.equal(s.registry_write_allowed,true);
  assert.equal(s.registry_write_reason,"ALLOWED");
  assert.equal(s.current_evidence_count,1);
  assert.equal(s.target_fact_instances_before,0);
  assert.equal(s.target_current_before,0);
  assert.equal(s.target_confirmations_before,0);
  assert.equal(s.final_preflight_status,"ready");
  assert.equal(s.previous_current,null);
  assert.equal(s.digest_match_with_r13h,true);
}

assert.equal(artifact.confirmations.length,2);
const m=new Map(artifact.confirmations.map(x=>[x.fact_key,x]));
const b=m.get("barrier_support_claim");
const r=m.get("primary_use_role");
assert.ok(b); assert.ok(r);

assert.equal(b.value,true);
assert.equal(b.status,"confirmed");
assert.equal(b.fact_instance_id,barrierFact);
assert.equal(b.confirmation_id,barrierConfirmation);
assert.equal(b.value_type,"boolean");
assert.equal(b.value_boolean,true);
assert.equal(b.authority_ceiling,"product_specific_primary");
assert.equal(b.fused_confidence,"high");
assert.equal(b.payload_digest,"fc107c10634a788da789ab775857a3e33091a9375424cb5b0b8042a63d5c5ad1");
assert.equal(b.prestate_digest,"9587aa29bb4a39ff24f93e549f40f863527d9b1f5311d8e467f76d2ab83ee344");
assert.equal(b.result_digest,"989b60e23b919a4308bda320a6313bbd7b884e2f96d0ad26e539b4b75ccb236d");
assert.equal(b.previous_fact_instance_id,null);

assert.equal(r.value,"multi_area");
assert.equal(r.status,"confirmed");
assert.equal(r.fact_instance_id,roleFact);
assert.equal(r.confirmation_id,roleConfirmation);
assert.equal(r.value_type,"enum");
assert.equal(r.value_enum,"multi_area");
assert.equal(r.authority_ceiling,"product_specific_primary");
assert.equal(r.fused_confidence,"high");
assert.equal(r.payload_digest,"2abed6501c2a7c017e46f4b9a8cb9d27534afd58b8c4e69d4862d4b0e038cea9");
assert.equal(r.prestate_digest,"1e76ac3f6b9e85ae970c187d35e2b29e85263bd4b9592bfd73d6c10d8f8c67a3");
assert.equal(r.result_digest,"7590c595bf62ad65be89d57243cd2ad6175066b8d87081b08bf4afb445c871f7");
assert.equal(r.previous_fact_instance_id,null);

assert.deepEqual(artifact.production_counts,{
  product_fact_current_before:105,
  product_fact_current_after:107,
  fact_instances_before:106,
  fact_instances_after:108,
  confirmations_before:106,
  confirmations_after:108,
  evidence_records_before:110,
  evidence_records_after:110,
  global_evidence_links_after:108,
  target_current_before:0,
  target_current_after:2,
  target_fact_instances_before:0,
  target_fact_instances_after:2,
  target_confirmations_before:0,
  target_confirmations_after:2,
  target_evidence_links_before:0,
  target_evidence_links_after:2,
  target_confirmed_assignments_after:2,
  target_fact_confirmed_events_after:2,
  target_admin_audits_after:2
});

assert.equal(artifact.production_readback.assignments.length,2);
for(const a of artifact.production_readback.assignments) assert.equal(a.operational_state,"confirmed");
assert.equal(artifact.production_readback.current.length,2);
assert.equal(artifact.production_readback.evidence_links.length,2);
for(const l of artifact.production_readback.evidence_links) assert.equal(l.link_role,"supporting");
assert.equal(artifact.production_readback.research_tasks.length,2);
for(const t of artifact.production_readback.research_tasks){
  assert.equal(t.state,"RESEARCH_PENDING");
  assert.equal(t.blocker_code,null);
  assert.equal(t.attempt_count,0);
}

assert.deepEqual(artifact.authority_boundary,{
  product_fact_confirmation_complete:true,
  recommendation_admission_authorized:false,
  recommendation_activation_authorized:false,
  public_activation:false,
  production_cutover_authorized:false
});

assert.equal(artifact.follow_up.stage,"V2.1-8H-R13J_ATOPALM_POST_CONFIRMATION_PDA_RECOMMENDATION_INVARIANCE");
assert.equal(artifact.follow_up.status,"NOT_EXECUTED");
assert.equal(artifact.follow_up.separate_authority_required_for_recommendation_admission,true);
assert.equal(artifact.follow_up.separate_authority_required_for_recommendation_activation,true);

console.log(JSON.stringify({
  status:"PASS",
  stage:artifact.stage,
  decision:artifact.decision,
  confirmations:2,
  currentDelta:2,
  factDelta:2,
  recommendationWrites:0
}));
