#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const path = "evidence/product-fact-catalog-expansion-v1/v21-8g2-b-required-fact-research-v1.json";
const d = JSON.parse(fs.readFileSync(path,"utf8"));

const stable = (value) => {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k => JSON.stringify(k)+":"+stable(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
};
const sha256 = (value) => crypto.createHash("sha256").update(stable(value)).digest("hex");

assert.equal(d.version,"v21-8g2-b-required-fact-research-v1");
assert.equal(d.stage,"V2.1-8G2-B");
assert.equal(d.source_main_sha,"3c08e2dc85d597302dc2ebb6cbe7392a2f5b5465");
assert.equal(d.registry.version,"product-fact-registry-cross-category-v1");
assert.equal(d.registry.registry_checksum,"79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575");
assert.equal(d.scope.products,3);
assert.equal(d.scope.tasks,6);
assert.equal(d.scope.evidence_write_authorized,false);
assert.equal(d.scope.fact_instance_write_authorized,false);
assert.equal(d.scope.confirmation_authorized,false);
assert.equal(d.scope.recommendation_activation_authorized,false);

const exactTasks = new Set([
"cf143b70-f9ba-4d57-aa30-2e13da39de25",
"46f6bd75-3c64-4edb-ab38-92c1b5897b90",
"2d41d0f1-fd3e-4a8c-9bd3-35e8f1438459",
"64485266-e135-4f9a-baa0-9c9addf8669e",
"d181a158-d816-44a4-ae1c-6aa9c41414cc",
"e08328cc-3213-4970-8122-c9c62f2de987",
]);
assert.equal(d.scope.allowed_task_ids.length,6);
assert.deepEqual(new Set(d.scope.allowed_task_ids),exactTasks);
assert.equal(d.task_results.length,6);
assert.deepEqual(new Set(d.task_results.map(x=>x.task_id)),exactTasks);

const expectedDefinitions = new Map(Object.entries({
  barrier_support_claim:"108ad711469c9018bc06560fce20257f05d32d3a4ed57571a4df5f653abc850d",
  primary_use_role:"7e12fb3509c5978f01ab1e7d53ec8a86311de4fa6ead83f0391237abe0044dca",
}));
const allowedOutcomes = new Set(["DIRECT_EVIDENCE_FOUND","EVIDENCE_INSUFFICIENT","IDENTITY_OR_SCOPE_BLOCKED"]);
const sourceIds = new Set(d.source_captures.map(x=>x.source_id));
assert.equal(sourceIds.size,d.source_captures.length);

for (const s of d.source_captures) {
  assert.equal(s.market,"KR");
  assert.ok(s.source_locator.startsWith("https://"));
  assert.ok(s.canonical_capture_digest);
  const material = {...s};
  delete material.source_id;
  delete material.canonical_capture_digest;
  assert.equal(sha256(material),s.canonical_capture_digest,`${s.source_id}: canonical source digest mismatch`);
}

for (const t of d.task_results) {
  assert.ok(allowedOutcomes.has(t.outcome));
  assert.equal(t.definition_checksum,expectedDefinitions.get(t.fact_key));
  assert.equal(t.identity_match,true);
  assert.equal(t.market_match,true);
  assert.equal(t.formulation_match,true);
  assert.ok(t.source_ids.length >= 1);
  for (const sid of t.source_ids) assert.ok(sourceIds.has(sid),`${t.task_id}: unknown source ${sid}`);
  if (t.outcome === "DIRECT_EVIDENCE_FOUND") {
    assert.notEqual(t.proposed_value,null);
    assert.ok(t.evidence_class);
  } else {
    assert.equal(t.proposed_value,null);
    assert.equal(t.evidence_class,null);
  }
}

const byTask = new Map(d.task_results.map(x=>[x.task_id,x]));
const drgBarrier = byTask.get("cf143b70-f9ba-4d57-aa30-2e13da39de25");
assert.equal(drgBarrier.outcome,"DIRECT_EVIDENCE_FOUND");
assert.equal(drgBarrier.proposed_value,true);
assert.equal(drgBarrier.evidence_class,"product_claim");

const drgRole = byTask.get("46f6bd75-3c64-4edb-ab38-92c1b5897b90");
assert.equal(drgRole.outcome,"DIRECT_EVIDENCE_FOUND");
assert.equal(drgRole.proposed_value,"multi_area");
assert.equal(drgRole.evidence_class,"usage_instruction");

for (const taskId of [
  "2d41d0f1-fd3e-4a8c-9bd3-35e8f1438459",
  "64485266-e135-4f9a-baa0-9c9addf8669e",
  "d181a158-d816-44a4-ae1c-6aa9c41414cc",
  "e08328cc-3213-4970-8122-c9c62f2de987",
]) {
  assert.equal(byTask.get(taskId).outcome,"EVIDENCE_INSUFFICIENT");
  assert.equal(byTask.get(taskId).proposed_value,null);
  assert.equal(byTask.get(taskId).evidence_class,null);
}

assert.equal(d.summary.direct_evidence_found,2);
assert.equal(d.summary.evidence_insufficient,4);
assert.equal(d.summary.identity_or_scope_blocked,0);
assert.equal(d.summary.evidence_db_writes,0);
assert.equal(d.summary.fact_instance_writes,0);
assert.equal(d.summary.recommendation_writes,0);
assert.equal(d.summary.product_fact_current_expected,95);
assert.equal(d.next_gate,"V2.1-8G2-C_REQUIRED_FACT_RESEARCH_RUUVE_SCINIC_4_TASKS");

console.log(JSON.stringify({
  status:"PASS",
  stage:"V2.1-8G2-B",
  tasks:6,
  direct:2,
  insufficient:4,
  blocked:0,
  writes:{evidence:0,fact_instance:0,recommendation:0},
  decision:"V21_8G2_B_REQUIRED_FACT_RESEARCH_PASS_DIRECT2_INSUFFICIENT4"
},null,2));
