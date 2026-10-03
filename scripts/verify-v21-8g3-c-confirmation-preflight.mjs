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
assert.equal(d.authority.registry_version,"product-fact-registry-cross-category-v1");
assert.equal(d.authority.preflight_rpc,"admin_preflight_product_fact_confirmation_v1");
assert.equal(d.authority.preflight_function_sha256,"7d9ce38e47468fb1a419528256857e399a3d7e50e719f7bd449034c96019f59e");
assert.equal(d.authority.controlled_build_preflight_function_sha256,"b736e373ebbcf577f332626e9fab2d8715c87c8a69a931de2ba3727bcc102f16");
assert.equal(d.authority.confirmation_rpc_called,false);

assert.equal(d.execution.mode,"read_only_preflight");
assert.equal(d.execution.calls,6);
assert.equal(d.execution.statuses_ready,6);
assert.equal(d.execution.writes_committed,0);
assert.equal(d.execution.preflight_audits,0);

assert.equal(d.results.length,6);
assert.equal(new Set(d.results.map(x=>x.assignment_id)).size,6);
assert.equal(new Set(d.results.map(x=>x.proposition_key)).size,6);
for(const x of d.results){
  assert.equal(x.status,"ready");
  assert.equal(x.previous_current,null);
  assert.match(x.payload_digest,/^[0-9a-f]{64}$/);
  assert.match(x.prestate_digest,/^[0-9a-f]{64}$/);
  assert.match(x.fusion_input_digest,/^[0-9a-f]{64}$/);
  assert.deepEqual(x.expected_write_set,{
    product_fact_current:1,
    product_fact_instances:1,
    product_fact_confirmations:1,
    product_fact_review_events:1,
    product_fact_evidence_links:1,
    product_fact_review_assignments_update:1
  });
}

assert.deepEqual(d.post_preflight,{
  product_fact_current:95,
  confirmations_total:96,
  fact_instances_total:96,
  target_ready_for_confirm:6,
  target_fact_instances:0,
  target_confirmations:0,
  target_review_events:12,
  preflight_audits:0
});
assert.equal(d.authority_boundary.confirmation_preflight_complete,true);
assert.equal(d.authority_boundary.confirmation_called,false);
assert.equal(d.authority_boundary.product_fact_current_changed,false);
assert.equal(d.authority_boundary.recommendation_activation_authorized,false);
assert.equal(d.authority_boundary.public_activation,false);
assert.equal(d.decision,"V21_8G3_C_CONFIRMATION_PREFLIGHT_PASS");
assert.equal(d.next_gate,"PENDING_EXPLICIT_CONFIRMATION_AUTHORIZATION");

console.log(JSON.stringify({
  status:"PASS",
  stage:d.stage,
  preflights:d.execution.calls,
  ready:d.execution.statuses_ready,
  currentFacts:d.post_preflight.product_fact_current,
  decision:d.decision
},null,2));
