#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-direct-evidence-ingest-preflight-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-official-evidence-research-v1.json";
const artifact = JSON.parse(fs.readFileSync(artifactPath,"utf8"));
const parent = JSON.parse(fs.readFileSync(parentPath,"utf8"));

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonical(value[key])]));
  }
  return value;
};
const sha256=(value)=>createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const gitBlob=(path)=>execFileSync("git",["hash-object",path],{encoding:"utf8"}).trim();

const PRODUCT="418e2bc1-7d6c-4334-9058-7af7ce159c6c";
const SUBJECT="c7e19978-5678-466b-ba69-f5936aeca5cc";
const BARRIER_TASK="b1430a7d-79bb-43a5-bfea-a19599441811";
const ROLE_TASK="cbdad075-35a1-476e-b3ac-6279b676e73e";

assert.equal(artifact.stage,"V2.1-8H-R13D");
assert.equal(artifact.decision,"BARRIER_SUPPORT_ATOPALM_P0_DIRECT_EVIDENCE_INGEST_PREFLIGHT_PASS");
assert.equal(artifact.parent_authority.r13c_path,parentPath);
assert.equal(gitBlob(parentPath),artifact.parent_authority.r13c_git_blob_sha);
assert.equal(parent.terminal,artifact.parent_authority.r13c_terminal);
assert.equal(parent.terminal,"BARRIER_SUPPORT_ATOPALM_P0_OFFICIAL_EVIDENCE_RESEARCH_DIRECT2");

assert.equal(artifact.target.product_id,PRODUCT);
assert.equal(artifact.target.subject_id,SUBJECT);
assert.equal(artifact.target.market,"KR");
assert.equal(artifact.target.identity_status,"resolved");
assert.equal(artifact.target.current_state,"current");
assert.match(artifact.target.official_source_locator,/product_no=3324/);
assert.equal(artifact.target.source_content_digest,"4dca54c0900e568bea4e856b1ad7be75f1cf07907406246b91f6d536b06c7c5b");

assert.equal(artifact.runtime_contract.ingest_function_sha256,"c5bf2429801f3f5811c41d3c39fbddff3eca2914bccb59f100321f369264b481");
assert.equal(artifact.runtime_contract.required_capability,"admin.products.review");
assert.equal(artifact.runtime_contract.security_definer,true);
assert.equal(artifact.runtime_contract.anon_execute,false);
assert.equal(artifact.runtime_contract.authenticated_execute,false);
assert.equal(artifact.runtime_contract.service_role_execute,true);

const parentSource=parent.source_captures.find((s)=>s.source_id==="atopalm_bundle_kr");
assert.ok(parentSource);
assert.equal(parentSource.product_id,PRODUCT);
assert.equal(parentSource.subject_id,SUBJECT);
assert.equal(parentSource.canonical_capture_digest,artifact.target.source_content_digest);

const parentTasks=new Map(parent.task_results.map((t)=>[t.task_id,t]));
const pBarrier=parentTasks.get(BARRIER_TASK);
const pRole=parentTasks.get(ROLE_TASK);
assert.ok(pBarrier); assert.ok(pRole);
assert.equal(pBarrier.outcome,"DIRECT_EVIDENCE_FOUND");
assert.equal(pBarrier.proposed_value,true);
assert.equal(pBarrier.evidence_class,"product_claim");
assert.equal(pRole.outcome,"DIRECT_EVIDENCE_FOUND");
assert.equal(pRole.proposed_value,"multi_area");
assert.equal(pRole.evidence_class,"usage_instruction");

assert.equal(artifact.registry_contract.version,"product-fact-registry-cross-category-v1");
assert.equal(artifact.registry_contract.checksum,"79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575");
assert.equal(artifact.registry_contract.candidates.length,2);

const barrier=artifact.digest_contract.barrier_support_claim;
const role=artifact.digest_contract.primary_use_role;
assert.equal(sha256(barrier.proposition.material),barrier.proposition.proposition_key);
assert.equal(barrier.proposition.proposition_key,"a1e01fd7508d83f2b251d33f59397f902a1ed20b4a09c51ed4dd3e3da7a639c5");
assert.equal(sha256(barrier.evidence.material),barrier.evidence.canonical_evidence_digest);
assert.equal(barrier.evidence.canonical_evidence_digest,"ce752257d8580d45028b225dba1e60cc82537eb47456a81968bd4334724ef503");
assert.equal(sha256(role.proposition.material),role.proposition.proposition_key);
assert.equal(role.proposition.proposition_key,"82e11e7bb7e999b242759f6ebdabcfb5fce4625ad0432e85144abbd64d2ce240");
assert.equal(sha256(role.evidence.material),role.evidence.canonical_evidence_digest);
assert.equal(role.evidence.canonical_evidence_digest,"6ff58a251ba9ba8cb5adb0a9bfe4b98afed5be510c55b7c30f75973ecde927fa");

const planned=artifact.planned_rpc;
assert.equal(planned.source.canonical_locator,parentSource.source_locator);
assert.equal(planned.source.content_digest,parentSource.canonical_capture_digest);
assert.equal(planned.source.market,"KR");
assert.equal(planned.binding.product_id,PRODUCT);
assert.equal(planned.binding.subject_id,SUBJECT);
assert.equal(planned.binding.binding_state,"exact_subject_match");
assert.equal(planned.binding.scope_relation,"equivalent");
assert.equal(planned.binding.presentation_metadata.bundle_units,2);
assert.equal(planned.binding.presentation_metadata.unit_size_ml,100);
assert.equal(planned.binding.presentation_metadata.total_size_ml,200);
assert.equal(planned.binding.identity_resolution_version,"v21-8h-r13a-official-identity-v1");
assert.equal(planned.candidates.length,2);

const plannedMap=new Map(planned.candidates.map((c)=>[c.task_id,c]));
assert.equal(plannedMap.get(BARRIER_TASK).evidence.fact_key,"barrier_support_claim");
assert.equal(plannedMap.get(BARRIER_TASK).evidence.proposition_value_identity,true);
assert.equal(plannedMap.get(BARRIER_TASK).evidence.evidence_class,"product_claim");
assert.equal(plannedMap.get(BARRIER_TASK).evidence.canonical_evidence_digest,barrier.evidence.canonical_evidence_digest);
assert.equal(plannedMap.get(ROLE_TASK).evidence.fact_key,"primary_use_role");
assert.equal(plannedMap.get(ROLE_TASK).evidence.proposition_value_identity,"multi_area");
assert.equal(plannedMap.get(ROLE_TASK).evidence.evidence_class,"usage_instruction");
assert.equal(plannedMap.get(ROLE_TASK).evidence.canonical_evidence_digest,role.evidence.canonical_evidence_digest);

assert.deepEqual({
  target_source_rows:artifact.production_prestate.target_source_rows,
  target_subject_binding_rows:artifact.production_prestate.target_subject_binding_rows,
  target_proposition_evidence_rows:artifact.production_prestate.target_proposition_evidence_rows,
  target_subject_fact_instances:artifact.production_prestate.target_subject_fact_instances,
  target_subject_current_facts:artifact.production_prestate.target_subject_current_facts
},{
  target_source_rows:0,
  target_subject_binding_rows:0,
  target_proposition_evidence_rows:0,
  target_subject_fact_instances:0,
  target_subject_current_facts:0
});
assert.equal(artifact.production_prestate.target_tasks.length,2);
for(const t of artifact.production_prestate.target_tasks){
  assert.equal(t.state,"RESEARCH_PENDING");
  assert.equal(t.attempt_count,0);
  assert.equal(t.blocker_code,null);
  assert.equal(t.evidence_id,null);
  assert.equal(t.evidence_candidate_id,null);
}

assert.equal(artifact.rollback_probe.rpc_calls_attempted,2);
assert.equal(artifact.rollback_probe.rpc_calls_accepted,2);
assert.deepEqual(artifact.rollback_probe.first_rpc_insertions,{source:true,binding:true,evidence:true});
assert.deepEqual(artifact.rollback_probe.second_rpc_insertions,{source:false,binding:false,evidence:true});
assert.deepEqual(artifact.rollback_probe.in_transaction,{
  target_source_rows:1,
  target_binding_rows:1,
  target_evidence_rows:2,
  target_review_events:2,
  target_audit_rows:2,
  target_subject_fact_instances:0,
  target_subject_current_facts:0
});
assert.deepEqual(artifact.rollback_probe.post_rollback,{
  target_source_rows:0,
  target_binding_rows:0,
  target_evidence_rows:0,
  target_review_events:0,
  target_audit_rows:0,
  target_subject_fact_instances:0,
  target_subject_current_facts:0
});
assert.deepEqual(artifact.rollback_probe.final_global_counts,{
  product_fact_subjects:51,
  product_fact_current:105,
  fact_instances:106,
  confirmations:106,
  evidence_records:108
});

for(const [key,expected] of Object.entries({
  committed_source_writes:0,
  committed_binding_writes:0,
  committed_evidence_writes:0,
  committed_review_events:0,
  committed_audit_rows:0,
  committed_fact_instance_writes:0,
  committed_confirmation_writes:0,
  committed_recommendation_writes:0,
  review_preparation_authorized:false,
  confirmation_preflight_authorized:false,
  confirmation_authorized:false,
  recommendation_activation_authorized:false,
  public_activation:false,
  production_cutover_authorized:false
})){
  assert.equal(artifact.authority_boundary[key],expected,key);
}

assert.equal(artifact.next_gate.stage,"V2.1-8H-R13E_ATOPALM_CONTROLLED_EVIDENCE_INGEST");
assert.equal(artifact.next_gate.status,"NOT_EXECUTED");
assert.equal(artifact.next_gate.authorized_candidate_count,2);
assert.deepEqual(new Set(artifact.next_gate.authorized_task_ids),new Set([BARRIER_TASK,ROLE_TASK]));
assert.equal(artifact.next_gate.allowed_rpc,"admin_ingest_product_fact_evidence_v1");
assert.equal(artifact.next_gate.evidence_ingest_authorized,true);
assert.equal(artifact.next_gate.max_committed_source_writes,1);
assert.equal(artifact.next_gate.max_committed_binding_writes,1);
assert.equal(artifact.next_gate.max_committed_evidence_writes,2);
assert.equal(artifact.next_gate.review_preparation_authorized,false);
assert.equal(artifact.next_gate.confirmation_authorized,false);
assert.equal(artifact.next_gate.recommendation_activation_authorized,false);

console.log(JSON.stringify({
  status:"PASS",
  stage:artifact.stage,
  decision:artifact.decision,
  candidates:2,
  barrierProposition:barrier.proposition.proposition_key,
  roleProposition:role.proposition.proposition_key,
  rollbackResidue:0
}));
