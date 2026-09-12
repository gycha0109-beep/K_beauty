#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const EXECUTION="evidence/product-fact-adoption-v1/trust-p21-torriden-kr-sunscreen-hosted-adoption-execution-v1.json";
const PLAN="evidence/product-fact-adoption-v1/trust-p21-torriden-kr-sunscreen-hosted-adoption-plan-v1.json";
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const x=JSON.parse(fs.readFileSync(EXECUTION,"utf8"));
const plan=JSON.parse(fs.readFileSync(PLAN,"utf8"));
const {execution_content_sha256,...body}=x;

assert.equal(digest(body),execution_content_sha256,"execution content digest");
assert.equal(execution_content_sha256,"228c0ec458c8c618426a0ed54eb8e3f55744639f8a252f024541ab9547bc8e22");
assert.equal(x.version,"trust-p21-torriden-kr-sunscreen-hosted-adoption-execution-v1");
assert.equal(x.stage,"TRUST-P21");
assert.equal(x.phase,"B_CONTROLLED_PRODUCTION_EXECUTION_CLOSEOUT");
assert.equal(x.status,"PRODUCTION_CONFIRMED");

assert.equal(x.authority.plan_version,plan.version);
assert.equal(x.authority.plan_content_sha256,plan.plan_content_sha256);
assert.equal(x.authority.plan_content_sha256,"4919e32931538bc284d33b9db63fe85ad8f9a241a9b3e405f48ecae0944a9428");
assert.equal(x.authority.plan_merge_sha,"96dd876465cb3bdbc477794c7235042865884a70");
assert.equal(x.authority.plan_blob_sha,"71714d374ccc8160985733cb3ff8315f632ec9b6");
assert.equal(x.authority.registry_version,"product-fact-registry-cross-category-v1");
assert.equal(x.authority.fusion_policy_version,"v2.1-4-product-fact-evidence-fusion-v1");

assert.equal(x.target.product_id,"57e4a5ec-115d-4322-85a1-7976db669700");
assert.equal(x.target.subject_semantic_key,plan.subjects[0].subject_semantic_key);
assert.equal(x.target.variant_key,plan.subjects[0].variant_key);
assert.equal(x.target.formulation_revision_key,plan.subjects[0].formulation_revision_key);
assert.equal(x.target.market,"KR");

assert.equal(x.execution_policy.controlled_rpc_only,true);
assert.equal(x.execution_policy.direct_table_dml,false);
assert.equal(x.execution_policy.runtime_ids,"server_returned_only");
assert.equal(x.execution_policy.all_planned_confirmation_preflights_ready_before_any_confirm,true);
assert.equal(x.execution_policy.confirmations_executed_in_one_sql_statement,true);
assert.equal(x.execution_policy.confirmation_atomicity,"same_statement_transaction");
for(const k of ["schema_or_rpc_mutation","registry_mutation","recommendation_or_ranking_change","cross_product_inference","historical_pre_upgrade_formula_equivalence_asserted","mild_mineral_product_claim_transfer"]) assert.equal(x.execution_policy[k],false,k);

const countKeys=["subjects","sources","bindings","evidence","fact_instances","evidence_links","review_assignments","confirmations","current"];
for(const k of countKeys) assert.equal(x.poststate[k]-x.prestate[k],x.planned_delta[k],`planned delta ${k}`);
assert.deepEqual(countKeys.map(k=>x.prestate[k]),[22,23,23,52,52,52,52,52,52]);
assert.deepEqual(countKeys.map(k=>x.poststate[k]),[23,24,24,54,54,54,54,54,54]);
assert.equal(x.prestate.target_subjects,0);
assert.equal(x.prestate.target_current,0);
assert.equal(x.prestate.target_collision_rows,0);
assert.equal(x.poststate.target_subjects,1);
assert.equal(x.poststate.target_current,2);
assert.equal(x.poststate.target_confirmed_assignments,2);

assert.equal(x.runtime.subject.subject_id,"750c298a-e085-4a29-aa24-2656fa7a5d6f");
assert.equal(x.runtime.source.source_id,"0faa9a86-8d74-495f-8fcb-ac47cb0529d6");
assert.equal(x.runtime.source.canonical_locator,plan.sources[0].canonical_locator);
assert.equal(x.runtime.source.content_digest,plan.sources[0].content_digest);
assert.equal(x.runtime.binding.binding_id,"f6f3617d-076a-415f-9bda-d4edf3febd9d");
assert.equal(x.runtime.binding.binding_state,"exact_subject_match");
assert.equal(x.runtime.binding.scope_relation,"equivalent");

const spf=x.runtime.spf_value;
const uva=x.runtime.uva_label;
assert.equal(spf.request_id,plan.request_ids.spf_confirmation);
assert.equal(uva.request_id,plan.request_ids.uva_confirmation);
assert.equal(spf.evidence_id,"20aff3db-fd46-48d5-b9c8-4eb7f97bdb31");
assert.equal(uva.evidence_id,"f06b5991-9d6b-42f8-a838-a1e68c364fe3");
assert.equal(spf.canonical_evidence_digest,plan.propositions.find(p=>p.fact_key==="spf_value").canonical_evidence_digest);
assert.equal(uva.canonical_evidence_digest,plan.propositions.find(p=>p.fact_key==="uva_label").canonical_evidence_digest);
assert.equal(spf.proposition_key,plan.propositions.find(p=>p.fact_key==="spf_value").proposition_key);
assert.equal(uva.proposition_key,plan.propositions.find(p=>p.fact_key==="uva_label").proposition_key);
assert.equal(spf.fact_instance_id,"393aefcc-6967-4fd2-895e-ff13915dbb2f");
assert.equal(uva.fact_instance_id,"07ea5c2d-70a7-4d24-84a4-2b3fd334a4ca");
assert.equal(spf.confirmation_id,"74d45976-b84f-4af8-84b1-0f7b25693bc6");
assert.equal(uva.confirmation_id,"72c15698-b06d-4883-a9b2-3c3f1c4c7d9d");
assert.equal(spf.fusion_input_digest,"7b1d43df3a078c25f12160462e484c4817eb7e138e7edef0698e9fe42ca0cad9");
assert.equal(uva.fusion_input_digest,"02bd8a013e2354e8b2987724a672b21000c7e4e95b7725d8c4866d37e3a2bce5");
assert.equal(spf.payload_digest,"40c6d868fbe88a9499e40740ad84a0258a23b51cfdcecf093d086e7d25e4de3f");
assert.equal(uva.payload_digest,"ca515e3c35e79e1057e4b36c70b47b1f1d5f5bf9b48e17c988f184ef58217540");
assert.equal(spf.prestate_digest,"86e6c813cf3bc0081a52e7f02f355bddc50383ff36258e3dd5ab78a3c55ffdfd");
assert.equal(uva.prestate_digest,"9ab3f9ec7f015a2d8dcceda164e2de595270318ac25ce3aa58555351d941dc34");
assert.equal(spf.result_digest,"18cd5223aca48d908b0e3896cbab47b621556133e5062162c8bd4fd9588a299f");
assert.equal(uva.result_digest,"63adb5a03c568890c17df8ce71d97d0686f8e1c2d768157fa1b3125b2452a9e6");
assert.equal(spf.value,50);
assert.deepEqual(spf.qualifier,{plus_modifier:"plus"});
assert.equal(uva.value,"PA++++");
assert.deepEqual(uva.qualifier,{});
for(const f of [spf,uva]){
  assert.equal(f.semantic_status,"supported");
  assert.equal(f.authority_ceiling,"product_specific_primary");
  assert.equal(f.fused_confidence,"high");
  assert.equal(f.previous_fact_instance_id,null);
}

assert.equal(x.closure.planned_delta_matched,true);
assert.equal(x.closure.spf_current,true);
assert.equal(x.closure.uva_current,true);
assert.equal(x.closure.legacy_goods173_identity_context_only,true);
assert.equal(x.closure.distinct_mild_sun_disjoint,true);
assert.equal(x.closure.additional_production_writes_after_execution,0);
assert.equal(x.closure.result,"TRUST_P21_PRODUCTION_ADOPTION_CONFIRMED");

console.log(JSON.stringify({ok:true,stage:x.stage,status:x.status,result:x.closure.result,execution_content_sha256},null,2));
