#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const path = "evidence/product-fact-catalog-expansion-v1/v21-8g2-c-required-fact-research-v1.json";
const d = JSON.parse(fs.readFileSync(path,"utf8"));

const stable = (value) => {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k => JSON.stringify(k)+":"+stable(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
};
const sha256 = (value) => crypto.createHash("sha256").update(stable(value)).digest("hex");

assert.equal(d.version,"v21-8g2-c-required-fact-research-v1");
assert.equal(d.stage,"V2.1-8G2-C");
assert.equal(d.source_main_sha,"98bf056a33858547d62b45dab7bd575da7bba33d");
assert.equal(d.registry.version,"product-fact-registry-cross-category-v1");
assert.equal(d.registry.registry_checksum,"79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575");
assert.equal(d.scope.products,2);
assert.equal(d.scope.tasks,4);
assert.equal(d.scope.evidence_write_authorized,false);
assert.equal(d.scope.fact_instance_write_authorized,false);
assert.equal(d.scope.confirmation_authorized,false);
assert.equal(d.scope.recommendation_activation_authorized,false);

const exactTasks = new Set([
"ec41b166-a5da-478c-8b67-371a2c081716",
"bfd3d47c-0fcf-4e80-8307-cf85581b4043",
"361d7e50-dc94-47b6-a770-b879fd67b6a7",
"a513f5fd-4ef0-4372-9272-5e6e8cd3366c",
]);
assert.equal(d.scope.allowed_task_ids.length,4);
assert.deepEqual(new Set(d.scope.allowed_task_ids),exactTasks);
assert.equal(d.task_results.length,4);
assert.deepEqual(new Set(d.task_results.map(x=>x.task_id)),exactTasks);

const expectedDefinitions = new Map(Object.entries({
  barrier_support_claim:"108ad711469c9018bc06560fce20257f05d32d3a4ed57571a4df5f653abc850d",
  primary_use_role:"7e12fb3509c5978f01ab1e7d53ec8a86311de4fa6ead83f0391237abe0044dca",
}));
const sourceIds = new Set(d.source_captures.map(x=>x.source_id));
assert.equal(sourceIds.size,d.source_captures.length);

for (const s of d.source_captures) {
  assert.equal(s.market,"KR");
  assert.ok(s.source_locator.startsWith("https://"));
  const material = {...s};
  delete material.source_id;
  delete material.canonical_capture_digest;
  assert.equal(sha256(material),s.canonical_capture_digest,`${s.source_id}: canonical source digest mismatch`);
}

for (const t of d.task_results) {
  assert.equal(t.outcome,"EVIDENCE_INSUFFICIENT");
  assert.equal(t.proposed_value,null);
  assert.equal(t.evidence_class,null);
  assert.equal(t.definition_checksum,expectedDefinitions.get(t.fact_key));
  assert.equal(t.identity_match,true);
  assert.equal(t.market_match,true);
  assert.equal(t.formulation_match,true);
  assert.ok(t.source_ids.length >= 1);
  for (const sid of t.source_ids) assert.ok(sourceIds.has(sid),`${t.task_id}: unknown source ${sid}`);
}

assert.equal(d.summary.direct_evidence_found,0);
assert.equal(d.summary.evidence_insufficient,4);
assert.equal(d.summary.identity_or_scope_blocked,0);
assert.equal(d.summary.evidence_db_writes,0);
assert.equal(d.summary.fact_instance_writes,0);
assert.equal(d.summary.recommendation_writes,0);
assert.equal(d.summary.product_fact_current_expected,95);
assert.equal(d.next_gate,"V2.1-8G2-CLOSE_WAVE1_REQUIRED_FACT_RESEARCH_AGGREGATE");

console.log(JSON.stringify({
  status:"PASS",
  stage:"V2.1-8G2-C",
  tasks:4,
  direct:0,
  insufficient:4,
  blocked:0,
  writes:{evidence:0,fact_instance:0,recommendation:0},
  decision:"V21_8G2_C_REQUIRED_FACT_RESEARCH_PASS_DIRECT0_INSUFFICIENT4"
},null,2));
