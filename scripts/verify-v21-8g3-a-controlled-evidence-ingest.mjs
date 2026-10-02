#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const ROOT="evidence/product-fact-catalog-expansion-v1";
const parent=JSON.parse(fs.readFileSync(`${ROOT}/v21-8g3-0-evidence-ingest-contract-v1.json`,"utf8"));
const coexist=JSON.parse(fs.readFileSync(`${ROOT}/v21-8g3-0-r1-gpt-worker-coexistence-v1.json`,"utf8"));
const d=JSON.parse(fs.readFileSync(`${ROOT}/v21-8g3-a-controlled-evidence-ingest-v1.json`,"utf8"));

assert.equal(d.version,"v21-8g3-a-controlled-evidence-ingest-v1");
assert.equal(d.stage,"V2.1-8G3-A");
assert.equal(d.production_write_main_sha,"fd721425ffcc8d1eb24c23c84a649a8ac9cdf3f0");
assert.equal(d.integration_main_sha,"3749dd79e95b08d8a6311f40ee6c5fabbd49d8b1");
assert.equal(parent.decision,"V21_8G3_0_EVIDENCE_INGEST_CONTRACT_PREFLIGHT_PASS");
assert.equal(coexist.decision,"V21_8G3_0_R1_GPT_WORKER_COEXISTENCE_PASS");
assert.equal(d.parent_contract.decision,parent.decision);
assert.equal(d.coexistence_contract.decision,coexist.decision);

for(const [key,value] of Object.entries({
  admin_ingest_function_sha256:"c5bf2429801f3f5811c41d3c39fbddff3eca2914bccb59f100321f369264b481",
  admin_prepare_review_function_sha256:"9d0992369021a37a83c96561f8ad3d9e9b505a61771b7b5312fa35fc424dbff1",
  admin_preflight_confirmation_function_sha256:"7d9ce38e47468fb1a419528256857e399a3d7e50e719f7bd449034c96019f59e",
  controlled_build_preflight_function_sha256:"b736e373ebbcf577f332626e9fab2d8715c87c8a69a931de2ba3727bcc102f16",
  registry_write_admissibility_function_sha256:"0234789969fd824b975d58e166125220ff24e83717e12186723c58a5628a1743",
  canonical_json_function_sha256:"01420646597cd144a594c2eef7cdf46c13b1d67da0188c77e01d628664be27a5",
  sha256_json_function_sha256:"53d8226a25f3573d9e8f6f86fc4a2eb83938cfee6ea55f3a61fa0430595ca7ce",
  claim_gpt_catalog_research_tasks_v1_sha256:"2349b1d3e4593c89f9198d7b5302ecbc44d81b763efe7a8b2d37387447de551b",
  ingest_gpt_catalog_product_v1_sha256:"6d78cb35d8e3663987755876ff07a481c47bfce8750c8c494c3a4d25825eed12"
})) assert.equal(d.runtime_contract[key],value,key);

assert.equal(d.preflight.registry_version,"product-fact-registry-cross-category-v1");
assert.equal(d.preflight.registry_checksum,"79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575");
assert.equal(d.preflight.registry_write_policy_version,"data-ai29c-uva-r3d-registry-coexistence-v1");
assert.equal(d.preflight.ready_v1_tasks_total,16);
assert.equal(d.preflight.ready_v1_tasks_pristine,16);
assert.equal(d.preflight.ready_v2_tasks,0);
assert.equal(d.preflight.product_fact_current,95);
assert.equal(d.preflight.ready_evidence,0);
assert.equal(d.preflight.ready_fact_instances,0);
assert.equal(d.preflight.exact_target_sources,0);
assert.equal(d.preflight.exact_target_bindings,0);
assert.equal(d.preflight.exact_target_evidence,0);
assert.equal(d.preflight.ready_gpt_intake_runs,0);

assert.equal(d.execution.isolation_level,"serializable");
assert.equal(d.execution.product_fact_current_lock,"share");
assert.equal(d.execution.frozen_wave1_task_row_locks,16);
assert.equal(d.execution.allowed_rpc,"admin_ingest_product_fact_evidence_v1");
assert.equal(d.execution.rpc_calls_attempted,6);
assert.equal(d.execution.rpc_calls_committed,6);
assert.deepEqual(d.execution.forbidden_rpcs_called,[]);
assert.deepEqual(d.execution.request_ids,parent.candidates.map(x=>x.request_id));

assert.equal(d.sources.length,4);
assert.equal(d.bindings.length,4);
assert.equal(d.evidence.length,6);
assert.equal(new Set(d.sources.map(x=>x.source_id)).size,4);
assert.equal(new Set(d.bindings.map(x=>x.binding_id)).size,4);
assert.equal(new Set(d.evidence.map(x=>x.evidence_id)).size,6);
assert.equal(new Set(d.evidence.map(x=>x.request_id)).size,6);

const parentByRequest=new Map(parent.candidates.map(x=>[x.request_id,x]));
for(const e of d.evidence){
  const frozen=parentByRequest.get(e.request_id);
  assert.ok(frozen,`missing frozen request: ${e.request_id}`);
  assert.equal(e.fact_key,frozen.rpc_payload.evidence.fact_key);
  assert.equal(e.proposition_key,frozen.proposition_key);
  assert.equal(e.canonical_evidence_digest,frozen.canonical_evidence_digest);
}
for(const s of d.sources){
  const frozen=parent.sources.find(x=>x.source_ref===s.source_ref);
  assert.ok(frozen,`missing frozen source: ${s.source_ref}`);
  assert.equal(s.content_digest,frozen.payload.content_digest);
  assert.equal(s.market,"KR");
}

const sourceIds=new Set(d.sources.map(x=>x.source_id));
const bindingIds=new Set(d.bindings.map(x=>x.binding_id));
for(const b of d.bindings) assert.ok(sourceIds.has(b.source_id));
for(const e of d.evidence) {
  const frozen=parentByRequest.get(e.request_id);
  const binding=d.bindings.find(b=>b.subject_id===frozen.rpc_payload.binding.subject_id);
  assert.ok(binding);
  assert.ok(bindingIds.has(binding.binding_id));
}

assert.equal(d.audit.action,"admin.product_fact.evidence_ingested");
assert.equal(d.audit.records,6);
assert.equal(d.audit.audit_ids.length,6);
assert.equal(new Set(d.audit.audit_ids).size,6);

assert.deepEqual(d.post_write_invariants,{
  unique_sources:4,
  unique_bindings:4,
  evidence_records:6,
  product_fact_current:95,
  target_fact_instances:0,
  target_review_assignments:0,
  ready_v1_tasks_pristine:16,
  ready_v2_tasks:0,
  ready_gpt_intake_runs:0
});

assert.equal(d.authority_boundary.evidence_materialization_complete,true);
assert.equal(d.authority_boundary.review_preparation_authorized_for_8g3_a,false);
assert.equal(d.authority_boundary.confirmation_preflight_authorized_for_8g3_a,false);
assert.equal(d.authority_boundary.confirmation_authorized_for_8g3_a,false);
assert.equal(d.authority_boundary.recommendation_activation_authorized,false);
assert.equal(d.authority_boundary.public_activation,false);
assert.equal(d.decision,"V21_8G3_A_CONTROLLED_EVIDENCE_INGEST_PASS");
assert.equal(d.next_gate,"V2.1-8G3-B_PRODUCT_FACT_REVIEW_PREPARATION");

console.log(JSON.stringify({
  status:"PASS",
  stage:d.stage,
  sources:d.sources.length,
  bindings:d.bindings.length,
  evidence:d.evidence.length,
  currentFacts:d.post_write_invariants.product_fact_current,
  factInstances:d.post_write_invariants.target_fact_instances,
  reviewAssignments:d.post_write_invariants.target_review_assignments,
  decision:d.decision
},null,2));
