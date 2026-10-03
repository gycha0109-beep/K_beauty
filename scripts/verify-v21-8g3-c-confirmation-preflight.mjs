#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const ROOT="evidence/product-fact-catalog-expansion-v1";
const parent=JSON.parse(fs.readFileSync(`${ROOT}/v21-8g3-b-review-preparation-v1.json`,"utf8"));
const d=JSON.parse(fs.readFileSync(`${ROOT}/v21-8g3-c-confirmation-preflight-v1.json`,"utf8"));

assert.equal(parent.decision,"V21_8G3_B_REVIEW_PREPARATION_PASS");
assert.equal(d.version,"v21-8g3-c-confirmation-preflight-v1");
assert.equal(d.stage,"V2.1-8G3-C");
assert.equal(d.parent.decision,parent.decision);
assert.equal(d.parent_8g3b_merge_sha,"f10636cff39a5fd637e6e55f9bc1efec1dfd07a2");
assert.equal(d.authority.preflight_rpc,"admin_preflight_product_fact_confirmation_v1");
assert.equal(d.authority.preflight_function_sha256,"7d9ce38e47468fb1a419528256857e399a3d7e50e719f7bd449034c96019f59e");
assert.equal(d.authority.confirm_rpc,"admin_confirm_product_fact_v1");
assert.equal(d.authority.confirm_called,false);

assert.equal(d.execution.preflight_calls,6);
assert.equal(d.execution.ready_count,6);
assert.equal(d.execution.all_previous_current_null,true);
assert.equal(d.preflights.length,6);
assert.equal(new Set(d.preflights.map(x=>x.slug)).size,6);
assert.equal(new Set(d.preflights.map(x=>x.payload_digest)).size,6);
assert.equal(new Set(d.preflights.map(x=>x.prestate_digest)).size,6);

const expectedWriteSet={
  product_fact_current:1,
  product_fact_instances:1,
  product_fact_confirmations:1,
  product_fact_review_events:1,
  product_fact_evidence_links:1,
  product_fact_review_assignments_update:1
};
assert.deepEqual(d.execution.expected_write_set_if_later_confirmed,expectedWriteSet);

const parentBySlug=new Map(parent.propositions.map(x=>[x.slug,x]));
for(const pf of d.preflights){
  const p=parentBySlug.get(pf.slug);
  assert.ok(p,`parent proposition missing: ${pf.slug}`);
  assert.equal(pf.status,"ready");
  assert.equal(pf.proposition_key,p.proposition_key);
  assert.equal(pf.assignment_id,p.assignment_id);
  assert.equal(pf.evidence_id,p.evidence_id);
  assert.equal(pf.fusion_input_digest,p.fusion_input_digest);
  assert.match(pf.payload_digest,/^[0-9a-f]{64}$/);
  assert.match(pf.prestate_digest,/^[0-9a-f]{64}$/);
  assert.equal(p.confirmation_preflight_payload.supporting_evidence_ids.length,1);
  assert.equal(p.confirmation_preflight_payload.supporting_evidence_ids[0],pf.evidence_id);
  assert.deepEqual(p.confirmation_preflight_payload.opposing_evidence_ids,[]);
  assert.equal(p.confirmation_preflight_payload.semantic_status,"supported");
  assert.equal(p.confirmation_preflight_payload.authority_ceiling,"product_specific_primary");
  assert.equal(p.confirmation_preflight_payload.fused_confidence,"high");
}

assert.deepEqual(d.post_preflight_invariants,{
  product_fact_current:95,
  ready_assignments:6,
  review_events:12,
  target_fact_instances:0,
  target_confirmations:0,
  preflight_audits:0,
  wave1_pristine:16
});

assert.equal(d.authority_boundary.confirmation_preflight_complete,true);
assert.equal(d.authority_boundary.confirmation_authorized_in_8g3_c,false);
assert.equal(d.authority_boundary.confirmation_called,false);
assert.equal(d.authority_boundary.product_fact_materialized,false);
assert.equal(d.authority_boundary.recommendation_activation_authorized,false);
assert.equal(d.authority_boundary.public_activation,false);
assert.equal(d.decision,"V21_8G3_C_CONFIRMATION_PREFLIGHT_PASS");
assert.equal(d.stop_boundary,"STOP_BEFORE_8H_CONFIRMATION");
assert.equal(d.next_gate,"V2.1-8H_FINAL_PRODUCT_FACT_CONFIRMATION");

console.log(JSON.stringify({
  status:"PASS",
  stage:d.stage,
  ready:d.execution.ready_count,
  current:d.post_preflight_invariants.product_fact_current,
  factInstances:d.post_preflight_invariants.target_fact_instances,
  confirmations:d.post_preflight_invariants.target_confirmations,
  decision:d.decision,
  stop:d.stop_boundary
},null,2));
