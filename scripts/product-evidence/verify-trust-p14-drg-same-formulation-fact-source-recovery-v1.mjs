#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const path="evidence/product-fact-subject-coverage-v1/trust-p14-drg-same-formulation-fact-source-recovery-v1.json";
const p=JSON.parse(fs.readFileSync(path,"utf8"));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash("sha256").update(typeof v==="string"?v:JSON.stringify(stable(v))).digest("hex");

assert.equal(p.version,"trust-p14-drg-same-formulation-fact-source-recovery-v1");
assert.equal(p.stage,"TRUST-P14");
assert.equal(p.phase,"RESEARCH_ONLY_FACT_SOURCE_RECOVERY");
assert.equal(p.authority.source_main_sha,"4ab3db71f71c2353bd0a4177543eca6c975b31da");
assert.equal(p.target.product_id,"dc1ef3f3-db1b-4c3f-954a-b18343e3d9f3");
assert.equal(p.target.size_ml,50);
assert.equal(p.production_prestate.subject_count,0);
assert.equal(p.production_prestate.current_count,0);

const expectedFormula="307d5eb4714f4b015f7a8aeb135a6622a0cbd61ed417076ce059b7e2d7e8e6b8";
const s50=p.first_party_sources.find(x=>x.url==="https://www.dr-g.co.kr/item/5174");
const s35=p.first_party_sources.find(x=>x.url==="https://www.dr-g.co.kr/item/4415");
assert.ok(s50);
assert.ok(s35);
assert.equal(s50.current_observation.ingredient_count,36);
assert.equal(s35.current_observation.ingredient_count,36);
assert.deepEqual(s50.current_observation.ingredients,s35.current_observation.ingredients);
assert.equal(digest(s50.current_observation.ingredients),expectedFormula);
assert.equal(digest(s35.current_observation.ingredients),expectedFormula);
assert.equal(s35.current_observation.direct_claim,"SPF50+ PA++++");
assert.equal(p.same_formulation_bridge.status,"ESTABLISHED");
assert.equal(p.same_formulation_bridge.formula_digest,expectedFormula);

assert.equal(p.fact_recovery.spf_value.status,"RECOVERED_SUPPORTED");
assert.equal(p.fact_recovery.spf_value.value_number,50);
assert.deepEqual(p.fact_recovery.spf_value.qualifier,{plus_modifier:"plus"});
assert.equal(p.fact_recovery.uva_label.status,"RECOVERED_SUPPORTED");
assert.equal(p.fact_recovery.uva_label.value_enum,"PA++++");
assert.equal(p.adjudication.result,"SAME_FORMULATION_FIRST_PARTY_FACT_SOURCE_RECOVERED");
assert.equal(p.adjudication.production_write_authorized,false);
assert.equal(p.adjudication.next_gate,"SEPARATE_DETERMINISTIC_HOSTED_ADOPTION_PLAN");

assert.equal(p.invariants.hosted_product_fact_writes,0);
assert.equal(p.invariants.direct_product_fact_dml,false);
assert.equal(p.invariants.subject_registration_performed,false);
assert.equal(p.invariants.schema_or_rpc_mutation,false);
assert.equal(p.invariants.registry_mutation,false);
assert.equal(p.invariants.recommendation_or_ranking_change,false);
assert.equal(p.invariants.third_party_positive_fact_support,false);
assert.equal(p.invariants.no_cross_formula_inference,true);

const {research_content_sha256,...withoutDigest}=p;
assert.equal(digest(withoutDigest),research_content_sha256);
assert.equal(research_content_sha256,"45fef40117bdf347bff542dbc4d19f9058be7bf82a1ed3dd341bc96a6f922f8c");

console.log(JSON.stringify({ok:true,stage:p.stage,product_id:p.target.product_id,bridge:p.same_formulation_bridge.status,formula_digest:expectedFormula,spf:p.fact_recovery.spf_value.status,uva:p.fact_recovery.uva_label.status,production_writes:p.invariants.hosted_product_fact_writes,next_gate:p.adjudication.next_gate},null,2));
