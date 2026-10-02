#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const path = "evidence/product-fact-catalog-expansion-v1/v21-8g2-a-required-fact-research-v1.json";
const d = JSON.parse(fs.readFileSync(path,"utf8"));

const stable = (value) => {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k => JSON.stringify(k)+":"+stable(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
};
const sha256 = (value) => crypto.createHash("sha256").update(stable(value)).digest("hex");

assert.equal(d.version,"v21-8g2-a-required-fact-research-v1");
assert.equal(d.stage,"V2.1-8G2-A");
assert.equal(d.source_main_sha,"00d11bb306d0138f09d8b9b1565d32e6022705a4");
assert.equal(d.registry.version,"product-fact-registry-cross-category-v1");
assert.equal(d.registry.registry_checksum,"79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575");
assert.equal(d.scope.products,3);
assert.equal(d.scope.tasks,6);
assert.equal(d.scope.evidence_write_authorized,false);
assert.equal(d.scope.fact_instance_write_authorized,false);
assert.equal(d.scope.confirmation_authorized,false);
assert.equal(d.scope.recommendation_activation_authorized,false);

const exactTasks = new Set([
"a125b39f-a53b-48f8-b1d9-26310a6daa84",
"66f0d4df-c1a8-4b67-869a-8ef8b5528779",
"f133d067-a5f6-44fc-a3f5-6b8706d35c9a",
"b1ee9a58-538d-4032-a0fe-690c1e82f751",
"cfc6f2e5-3d41-4c54-b973-308b06c37972",
"1b2062c6-9a3d-4fe4-b192-4c1ac06dda2c",
]);
assert.equal(d.scope.allowed_task_ids.length,6);
assert.deepEqual(new Set(d.scope.allowed_task_ids),exactTasks);
assert.equal(d.task_results.length,6);
assert.deepEqual(new Set(d.task_results.map(x=>x.task_id)),exactTasks);

const expectedDefinitions = new Map(Object.entries({
  deep_cleansing:"43e03202518cb69cbf63f08f8494f8f0aabf252dcf942a241c6aac636ed91fd7",
  low_ph:"2c695147eda6da905207cfa5d4c32e756ff0fa7726e04882f5da5a6f3f29bdcf",
  barrier_support_claim:"108ad711469c9018bc06560fce20257f05d32d3a4ed57571a4df5f653abc850d",
  primary_use_role:"7e12fb3509c5978f01ab1e7d53ec8a86311de4fa6ead83f0391237abe0044dca",
  contains_active:"7b6f785309dc34f6cd4042ebc7b108b49e118c364e633457c3baf53c77dcb7b3",
  product_format:"f04ee27fd5526ce0866693d146811324f0da4c323fd55f82e91c38ef9273fcc4",
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

const byFact = new Map(d.task_results.map(x=>[x.fact_key,x]));
assert.equal(byFact.get("low_ph").outcome,"DIRECT_EVIDENCE_FOUND");
assert.equal(byFact.get("low_ph").proposed_value,true);
assert.equal(byFact.get("low_ph").evidence_class,"product_claim");

assert.equal(byFact.get("deep_cleansing").outcome,"EVIDENCE_INSUFFICIENT");
assert.equal(byFact.get("deep_cleansing").proposed_value,null);

assert.equal(byFact.get("barrier_support_claim").outcome,"DIRECT_EVIDENCE_FOUND");
assert.equal(byFact.get("barrier_support_claim").proposed_value,true);
assert.equal(byFact.get("barrier_support_claim").evidence_class,"measurement");

assert.equal(byFact.get("primary_use_role").outcome,"DIRECT_EVIDENCE_FOUND");
assert.equal(byFact.get("primary_use_role").proposed_value,"local_area");
assert.equal(byFact.get("primary_use_role").evidence_class,"usage_instruction");

assert.equal(byFact.get("product_format").outcome,"DIRECT_EVIDENCE_FOUND");
assert.equal(byFact.get("product_format").proposed_value,"liquid");
assert.equal(byFact.get("product_format").evidence_class,"physical_characteristic");

assert.equal(byFact.get("contains_active").outcome,"EVIDENCE_INSUFFICIENT");
assert.equal(byFact.get("contains_active").proposed_value,null);

assert.equal(d.summary.direct_evidence_found,4);
assert.equal(d.summary.evidence_insufficient,2);
assert.equal(d.summary.identity_or_scope_blocked,0);
assert.equal(d.summary.evidence_db_writes,0);
assert.equal(d.summary.fact_instance_writes,0);
assert.equal(d.summary.recommendation_writes,0);
assert.equal(d.summary.product_fact_current_expected,95);
assert.equal(d.next_gate,"V2.1-8G2-B_REQUIRED_FACT_RESEARCH_DR_G_WELLAGE_BRINGGREEN_6_TASKS");

console.log(JSON.stringify({
  status:"PASS",
  stage:"V2.1-8G2-A",
  tasks:6,
  direct:4,
  insufficient:2,
  blocked:0,
  writes:{evidence:0,fact_instance:0,recommendation:0},
  decision:"V21_8G2_A_REQUIRED_FACT_RESEARCH_PASS_DIRECT4_INSUFFICIENT2"
},null,2));
