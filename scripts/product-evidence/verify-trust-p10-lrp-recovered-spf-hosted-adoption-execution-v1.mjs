#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";

const executionPath="evidence/product-fact-adoption-v1/trust-p10-lrp-recovered-spf-hosted-adoption-execution-v1.json";
const planPath="evidence/product-fact-adoption-v1/trust-p10-lrp-recovered-spf-hosted-adoption-plan-v1.json";
const execution=JSON.parse(fs.readFileSync(executionPath,"utf8"));
const plan=JSON.parse(fs.readFileSync(planPath,"utf8"));
const blob=p=>execFileSync("git",["hash-object",p],{encoding:"utf8"}).trim();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha=/^[0-9a-f]{64}$/;

assert.equal(execution.version,"trust-p10-lrp-recovered-spf-hosted-adoption-execution-v1");
assert.equal(execution.stage,"TRUST-P10_PHASE_B_EXECUTION_CLOSEOUT");
assert.equal(execution.status,"PRODUCTION_CONFIRMED");
assert.equal(execution.authority.phase_a_merge_sha,"d38d169059f32c97a1814b2dd4454ca50bf66c6b");
assert.equal(execution.authority.phase_a_plan_path,planPath);
assert.equal(execution.authority.phase_a_plan_blob_sha,"f9b5e5d5d5db5dc152aa19611b3f2b1fb5df38e5");
assert.equal(blob(planPath),execution.authority.phase_a_plan_blob_sha);
assert.equal(execution.authority.phase_a_plan_sha256,"ea9e640baf878c0f2fa8298c01a251dd0d240105f6958e567a389ffeba48d8d5");
assert.equal(plan.plan_content_sha256,execution.authority.phase_a_plan_sha256);
assert.equal(execution.authority.production_project_id,"bygrczggxfuisupcevaz");
assert.equal(execution.authority.registry_version,"product-fact-registry-cross-category-v1");
assert.equal(execution.admin_actor.user_id,"e1a59349-fe13-43ff-86ce-078c2dce0d99");
assert.equal(execution.admin_actor.role,"admin_owner");
assert.equal(execution.admin_actor.is_active,true);

for(const [k,v] of Object.entries({controlled_rpc_only:true,direct_product_fact_table_dml:false,schema_change:false,rpc_change:false,registry_change:false,recommendation_or_ranking_change:false,uva_label_write:false,uva_pf_to_pa_conversion:false})) assert.equal(execution.execution_policy[k],v,k);
assert.deepEqual(execution.production_prestate,{checked_at:"2026-09-11T04:50:23.424428+09:00",subjects:19,sources:19,bindings:19,evidence:47,fact_instances:47,review_assignments:47,confirmations:47,current:47,target_subjects:0,target_current:0,semantic_key_conflicts:0,source_locator_conflicts:0,evidence_digest_conflicts:0,open_assignment_conflicts:0,confirmation_request_conflicts:0});
assert.deepEqual(execution.production_poststate,{readback_at:"2026-09-11T04:52:06.884026+09:00",subjects:20,sources:20,bindings:20,evidence:48,fact_instances:48,evidence_links:48,review_assignments:48,confirmations:48,current:48,target_subjects:1,target_current:1,target_spf_current:1,target_uva_current:0});

assert.equal(execution.product.product_id,"9983f167-24e7-4223-bd86-446ce6ced31b");
assert.equal(execution.product.subject_semantic_key,plan.subjects[0].subject_semantic_key);
assert.equal(execution.product.variant_key,plan.subjects[0].variant_key);
assert.equal(execution.product.formulation_revision_key,plan.subjects[0].formulation_revision_key);
assert.match(execution.product.subject_id,uuid);
assert.equal(execution.source.canonical_locator,plan.sources[0].canonical_locator);
assert.equal(execution.source.content_digest,plan.sources[0].content_digest);
assert.equal(execution.source.source_market,"SI");
assert.match(execution.source.source_id,uuid);
assert.equal(execution.binding.binding_state,"exact_subject_match");
assert.equal(execution.binding.scope_relation,"narrower");
assert.equal(execution.binding.subject_market,"KR");
assert.equal(execution.binding.source_market,"SI");
assert.match(execution.binding.binding_id,uuid);

const fact=execution.fact;
assert.equal(fact.fact_key,"spf_value");
assert.equal(fact.proposition_key,plan.propositions[0].proposition_key);
assert.equal(fact.semantic_status,"supported");
assert.equal(fact.value_type,"number");
assert.equal(fact.value_number,50);
assert.equal(fact.value_enum,null);
assert.equal(fact.market,"KR");
assert.deepEqual(fact.qualifier,{plus_modifier:"plus"});
assert.equal(fact.authority_ceiling,"product_specific_primary");
assert.equal(fact.fused_confidence,"high");
assert.equal(fact.canonical_evidence_digest,plan.propositions[0].canonical_evidence_digest);
assert.equal(fact.evidence_link_role,"supporting");
for(const k of ["evidence_id","assignment_id","confirmation_id","fact_instance_id"]) assert.match(fact[k],uuid,k);
for(const k of ["proposition_key","fusion_input_digest","canonical_evidence_digest"]) assert.match(fact[k],sha,k);

assert.equal(execution.confirmation.preflight_status,"ready");
assert.equal(execution.confirmation.status,"confirmed");
assert.equal(execution.confirmation.idempotent,false);
assert.equal(execution.confirmation.previous_current,null);
for(const k of ["payload_digest","prestate_digest","result_digest"]) assert.match(execution.confirmation[k],sha,k);
assert.equal(execution.requests.confirmation,"trust-p10-b-lrp-spf-confirm-20260911-v1");
assert.equal(plan.exact_scope.propositions,1);
assert.deepEqual(plan.exact_scope.fact_keys,["spf_value"]);
assert.deepEqual(plan.exact_scope.blocked_fact_keys,["uva_label"]);
assert.equal(execution.production_poststate.target_uva_current,0);
assert.deepEqual(execution.invariants,{planned_delta_exact:true,runtime_ids_server_returned:true,current_lineage_exact:true,spf_value_exact:true,uva_label_remains_blocked:true,direct_product_fact_table_dml:false});

console.log(JSON.stringify({ok:true,stage:execution.stage,status:execution.status,product_id:execution.product.product_id,subject_id:execution.product.subject_id,spf_current:1,uva_current:0,current:48},null,2));
