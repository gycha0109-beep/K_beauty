#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const execution=read("evidence/product-fact-adoption-v1/trust-p8-sunscreen-hosted-adoption-execution-v1.json");
const plan=read("evidence/product-fact-adoption-v1/trust-p8-sunscreen-hosted-adoption-plan-v1.json");
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha=/^[0-9a-f]{64}$/;
const eligible=["2d3591f2-2216-4043-8493-a9492806ef8b","765b3ca1-6927-49b0-bee6-4138d03dd915","dd326b18-ea56-45fb-8571-42186b6c9159"].sort();
const blocked="9983f167-24e7-4223-bd86-446ce6ced31b";

assert.equal(execution.version,"trust-p8-sunscreen-hosted-adoption-execution-v1");
assert.equal(execution.stage,"TRUST-P8_PHASE_B_EXECUTION_CLOSEOUT");
assert.equal(execution.status,"PRODUCTION_CONFIRMED");
assert.equal(execution.authority.phase_a_merge_sha,"ed2b5204f4bd48207e7881974d8041610fabd547");
assert.equal(execution.authority.phase_a_plan_sha256,"305a49987c32382a36e0585ee2e41ce652395e182079db6544f4c73cfe963c8d");
assert.equal(plan.plan_content_sha256,execution.authority.phase_a_plan_sha256);
assert.deepEqual([...plan.exact_scope.eligible_product_ids].sort(),eligible);
assert.deepEqual(plan.exact_scope.excluded_product_ids,[blocked]);
assert.equal(execution.admin_actor.user_id,"e1a59349-fe13-43ff-86ce-078c2dce0d99");
assert.equal(execution.admin_actor.role,"admin_owner");
assert.equal(execution.admin_actor.is_active,true);
assert.equal(execution.execution_policy.direct_product_fact_table_dml,false);
assert.equal(execution.execution_policy.controlled_rpc_only,true);
assert.equal(execution.execution_policy.all_six_fresh_ready_before_any_confirm,true);
for(const key of ["schema_change","rpc_change","registry_change","recommendation_or_ranking_change"]) assert.equal(execution.execution_policy[key],false);
assert.equal(execution.fresh_preflight.status,"6_OF_6_READY");
assert.equal(execution.fresh_preflight.digests_match_prior,true);

assert.deepEqual(execution.phase_a_frozen_prestate,{subjects:16,sources:16,bindings:16,evidence:41,fact_instances:41,review_assignments:41,confirmations:41,current:41});
assert.deepEqual(execution.confirmation_prestate,{subjects:19,sources:19,bindings:19,evidence:47,fact_instances:41,review_assignments:47,confirmations:41,current:41,target_current:0,target_confirmation_request_conflicts:0});
assert.deepEqual(execution.production_poststate,{subjects:19,sources:19,bindings:19,evidence:47,fact_instances:47,evidence_links:47,review_assignments:47,confirmations:47,current:47});

assert.equal(execution.facts.length,6);
assert.deepEqual([...new Set(execution.facts.map(x=>x.product_id))].sort(),eligible);
assert.equal(new Set(execution.facts.map(x=>x.subject_id)).size,3);
assert.equal(new Set(execution.facts.map(x=>x.source_id)).size,3);
assert.equal(new Set(execution.facts.map(x=>x.binding_id)).size,3);
for(const key of ["evidence_id","assignment_id","proposition_key","request_id","confirmation_id","fact_instance_id"]) assert.equal(new Set(execution.facts.map(x=>x[key])).size,6,key);
assert.ok(!execution.facts.some(x=>x.product_id===blocked));

for(const fact of execution.facts){
  for(const key of ["product_id","subject_id","source_id","binding_id","evidence_id","assignment_id","confirmation_id","fact_instance_id"]) assert.match(fact[key],uuid,`${fact.label} ${key}`);
  for(const key of ["subject_semantic_key","proposition_key","fusion_input_digest","payload_digest","prestate_digest","result_digest"]) assert.match(fact[key],sha,`${fact.label} ${key}`);
  assert.ok(fact.request_id.startsWith("trust-p8-b-"));
  assert.ok(["GLOBAL","KR"].includes(fact.market));
  if(fact.product_id==="765b3ca1-6927-49b0-bee6-4138d03dd915") assert.equal(fact.market,"GLOBAL"); else assert.equal(fact.market,"KR");
  if(fact.fact_key==="spf_value"){
    assert.equal(fact.value_type,"number");
    assert.equal(fact.value_number,50);
    assert.equal(fact.value_enum,null);
    assert.deepEqual(fact.qualifier,{plus_modifier:"plus"});
  } else {
    assert.equal(fact.fact_key,"uva_label");
    assert.equal(fact.value_type,"enum");
    assert.equal(fact.value_number,null);
    assert.equal(fact.value_enum,"PA++++");
    assert.deepEqual(fact.qualifier,{});
  }
}
for(const productId of eligible){
  const rows=execution.facts.filter(x=>x.product_id===productId);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(x=>x.fact_key).sort(),["spf_value","uva_label"]);
}
const excluded=execution.product_poststate.find(x=>x.product_id===blocked);
assert.ok(excluded);
assert.equal(excluded.subject_count,0);
assert.equal(excluded.current_count,0);
assert.equal(excluded.status,"FACT_SOURCE_RECOVERY_REQUIRED_EXCLUDED");
for(const productId of eligible){
  const p=execution.product_poststate.find(x=>x.product_id===productId);
  assert.ok(p);
  assert.equal(p.subject_count,1);
  assert.equal(p.current_count,2);
}
assert.deepEqual(execution.invariants,{target_fact_count:6,target_confirmation_count:6,target_current_count:6,spf_values_exact:true,uva_values_exact:true,provenance_exact:true,la_roche_excluded:true});

console.log(JSON.stringify({ok:true,stage:execution.stage,status:execution.status,products:3,facts:6,confirmations:6,current:47,excluded_product_id:blocked},null,2));
