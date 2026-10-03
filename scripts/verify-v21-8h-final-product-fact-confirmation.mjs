#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const ROOT="evidence/product-fact-catalog-expansion-v1";
const parent=JSON.parse(fs.readFileSync(`${ROOT}/v21-8g3-c-confirmation-preflight-v1.json`,"utf8"));
const d=JSON.parse(fs.readFileSync(`${ROOT}/v21-8h-final-product-fact-confirmation-v1.json`,"utf8"));

assert.equal(parent.decision,"V21_8G3_C_CONFIRMATION_PREFLIGHT_PASS");
assert.equal(d.version,"v21-8h-final-product-fact-confirmation-v1");
assert.equal(d.stage,"V2.1-8H");
assert.equal(d.gate,"V2.1-8H_FINAL_PRODUCT_FACT_CONFIRMATION");
assert.equal(d.parent.decision,parent.decision);
assert.equal(d.authority.registry_version,"product-fact-registry-cross-category-v1");
assert.equal(d.authority.confirm_rpc,"admin_confirm_product_fact_v1");
assert.equal(d.authority.confirm_function_sha256,"b143613eac0e27b7e223379f7b5c20179a89f2b4b04150463c84e880656dcf29");
assert.equal(d.authority.service_role_only,true);

assert.equal(d.execution.isolation_level,"serializable");
assert.equal(d.execution.transaction_mode,"all_or_nothing");
assert.equal(d.execution.confirmations_requested,6);
assert.equal(d.execution.confirmations_committed,6);
assert.equal(d.execution.stale_preflight_rechecks,6);
assert.equal(d.execution.stale_preflight_matches,6);
assert.equal(d.execution.rollback_on_any_mismatch,true);

assert.equal(d.confirmations.length,6);
assert.equal(new Set(d.confirmations.map(x=>x.request_id)).size,6);
assert.equal(new Set(d.confirmations.map(x=>x.assignment_id)).size,6);
assert.equal(new Set(d.confirmations.map(x=>x.proposition_key)).size,6);
assert.equal(new Set(d.confirmations.map(x=>x.confirmation_id)).size,6);
assert.equal(new Set(d.confirmations.map(x=>x.fact_instance_id)).size,6);

for(const x of d.confirmations){
  const frozen=parent.preflights.find(p=>p.slug===x.slug);
  assert.ok(frozen,`${x.slug}: frozen 8G3-C preflight missing`);
  assert.equal(x.status,"confirmed");
  assert.equal(x.authority_ceiling,"product_specific_primary");
  assert.equal(x.fused_confidence,"high");
  assert.equal(x.payload_digest,frozen.payload_digest);
  assert.equal(x.prestate_digest,frozen.prestate_digest);
  assert.equal(x.proposition_key,frozen.proposition_key);
  assert.equal(x.assignment_id,frozen.assignment_id);
  assert.equal(x.evidence_id,frozen.evidence_id);
  assert.match(x.confirmation_id,/^[0-9a-f-]{36}$/);
  assert.match(x.fact_instance_id,/^[0-9a-f-]{36}$/);
}

assert.deepEqual(d.post_write,{
  product_fact_current_before:95,
  product_fact_current_after:101,
  fact_instances_total_after:102,
  confirmations_total_after:102,
  target_current:6,
  target_fact_instances:6,
  target_confirmations:6,
  target_evidence_links:6,
  target_confirmed_assignments:6,
  target_fact_confirmed_events:6,
  target_admin_audits:6,
  wave1_tasks_total:16,
  wave1_tasks_pristine:16
});

assert.deepEqual(d.gpt_pilot_invariance,{
  evidence_candidate_tasks:3,
  adopted_evidence_tasks:0,
  current_facts:0,
  recommendations:0
});
assert.equal(d.authority_boundary.product_fact_confirmation_complete,true);
assert.equal(d.authority_boundary.recommendation_admission_authorized,false);
assert.equal(d.authority_boundary.recommendation_activation_authorized,false);
assert.equal(d.authority_boundary.public_activation,false);
assert.equal(d.authority_boundary.gpt_automation_authority_unchanged,true);
assert.equal(d.decision,"V21_8H_FINAL_PRODUCT_FACT_CONFIRMATION_PASS");
assert.equal(d.next_gate,"PENDING_SEPARATE_RECOMMENDATION_ADMISSION_AUTHORIZATION");

console.log(JSON.stringify({
  status:"PASS",
  stage:d.stage,
  confirmations:d.execution.confirmations_committed,
  currentFacts:d.post_write.product_fact_current_after,
  wave1Pristine:d.post_write.wave1_tasks_pristine,
  decision:d.decision
},null,2));
