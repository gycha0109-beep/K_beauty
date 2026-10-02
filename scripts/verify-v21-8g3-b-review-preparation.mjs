#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const ROOT="evidence/product-fact-catalog-expansion-v1";
const parent=JSON.parse(fs.readFileSync(`${ROOT}/v21-8g3-a-controlled-evidence-ingest-v1.json`,"utf8"));
const d=JSON.parse(fs.readFileSync(`${ROOT}/v21-8g3-b-review-preparation-v1.json`,"utf8"));

assert.equal(parent.decision,"V21_8G3_A_CONTROLLED_EVIDENCE_INGEST_PASS");
assert.equal(d.version,"v21-8g3-b-review-preparation-v1");
assert.equal(d.stage,"V2.1-8G3-B");
assert.equal(d.production_main_sha,"fd94b141e4da1682d4f640a0d6b85de1c308488d");
assert.equal(d.parent.decision,parent.decision);
assert.equal(d.authority.registry_version,"product-fact-registry-cross-category-v1");
assert.equal(d.authority.review_policy_version,"v21-8g3-b-direct-evidence-review-v1");
assert.equal(d.authority.proposition_serializer_version,"product-fact-proposition-pilot-v1");
assert.equal(d.authority.fusion_policy_version,"v2.1-4-product-fact-evidence-fusion-v1");
assert.equal(d.authority.prepare_review_function_sha256,"9d0992369021a37a83c96561f8ad3d9e9b505a61771b7b5312fa35fc424dbff1");

assert.equal(d.rollback_probe.status,"PASS");
assert.deepEqual(d.rollback_probe.post_rollback,{assignments:0,audits:0,current:95});
assert.equal(d.execution.allowed_rpc,"admin_prepare_product_fact_review_v1");
assert.equal(d.execution.rpc_calls_committed,12);
assert.deepEqual(d.execution.sequence_per_proposition,["under_review","ready_for_confirm"]);

assert.equal(d.propositions.length,6);
assert.equal(new Set(d.propositions.map(x=>x.assignment_id)).size,6);
assert.equal(new Set(d.propositions.map(x=>x.evidence_id)).size,6);
assert.equal(new Set(d.propositions.map(x=>x.proposition_key)).size,6);
for(const x of d.propositions){
  assert.equal(x.operational_state,"ready_for_confirm");
  assert.equal(x.assigned_to,d.authority.actor_user_id);
  assert.equal(x.evidence_authority,"product_specific_primary");
  assert.equal(x.fused_confidence,"high");
  assert.match(x.fusion_input_digest,/^[0-9a-f]{64}$/);
  assert.equal(x.confirmation_preflight_payload.assignment_id,x.assignment_id);
  assert.equal(x.confirmation_preflight_payload.subject_id,x.subject_id);
  assert.equal(x.confirmation_preflight_payload.fact_key,x.fact_key);
  assert.equal(x.confirmation_preflight_payload.proposition_key,x.proposition_key);
  assert.equal(x.confirmation_preflight_payload.fusion_input_digest,x.fusion_input_digest);
  assert.deepEqual(x.confirmation_preflight_payload.supporting_evidence_ids,[x.evidence_id]);
  assert.deepEqual(x.confirmation_preflight_payload.opposing_evidence_ids,[]);
  assert.equal(x.confirmation_preflight_payload.authority_ceiling,"product_specific_primary");
  assert.equal(x.confirmation_preflight_payload.fused_confidence,"high");
  assert.equal(x.confirmation_preflight_payload.semantic_status,"supported");
  if(x.value_type==="boolean"){
    assert.equal(x.confirmation_preflight_payload.value_boolean,x.value);
    assert.equal(x.confirmation_preflight_payload.value_enum,null);
  }else{
    assert.equal(x.value_type,"enum");
    assert.equal(x.confirmation_preflight_payload.value_enum,x.value);
    assert.equal(x.confirmation_preflight_payload.value_boolean,null);
  }
}

assert.deepEqual(d.post_write,{
  assignments:6,
  ready_for_confirm:6,
  review_events:12,
  admin_audits:12,
  product_fact_current:95,
  target_fact_instances:0,
  target_confirmations:0,
  wave1_pristine:16
});
assert.equal(d.authority_boundary.review_preparation_complete,true);
assert.equal(d.authority_boundary.confirmation_preflight_called,false);
assert.equal(d.authority_boundary.confirmation_called,false);
assert.equal(d.authority_boundary.recommendation_activation_authorized,false);
assert.equal(d.authority_boundary.public_activation,false);
assert.equal(d.decision,"V21_8G3_B_REVIEW_PREPARATION_PASS");
assert.equal(d.next_gate,"V2.1-8G3-C_CONFIRMATION_PREFLIGHT_ONLY");

console.log(JSON.stringify({
  status:"PASS",
  stage:d.stage,
  assignments:d.post_write.assignments,
  ready_for_confirm:d.post_write.ready_for_confirm,
  events:d.post_write.review_events,
  currentFacts:d.post_write.product_fact_current,
  decision:d.decision
},null,2));
