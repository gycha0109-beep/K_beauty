#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const EXEC="evidence/product-fact-adoption-v1/trust-p12-boj-original-uva-hosted-adoption-execution-v1.json";
const P12="evidence/product-fact-adoption-v1/trust-p12-boj-original-uva-hosted-adoption-plan-v1.json";
const P12A="evidence/product-fact-adoption-v1/trust-p12a-boj-original-uva-plan-correction-v1.json";
const e=JSON.parse(fs.readFileSync(EXEC,"utf8"));
const p12=JSON.parse(fs.readFileSync(P12,"utf8"));
const p12a=JSON.parse(fs.readFileSync(P12A,"utf8"));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha=/^[0-9a-f]{64}$/;

assert.equal(e.version,"trust-p12-boj-original-uva-hosted-adoption-execution-v1");
assert.equal(e.stage,"TRUST-P12_PHASE_B_EXECUTION_CLOSEOUT");
assert.equal(e.status,"PRODUCTION_CONFIRMED");
const {execution_content_sha256,...withoutDigest}=e;
assert.equal(digest(withoutDigest),execution_content_sha256);
assert.equal(execution_content_sha256,"fdf9ae0669d8d8b0aabcb4e0a4ed20e34cf0c8840464f60207c5ed59ef4a758c");

assert.equal(e.authority.execution_capture_main_sha,"4bc0b36fd831d91508a097b9b196ffd2ce1050cb");
assert.equal(e.authority.p12_plan_merge_sha,"90e6f6c35efe553e91a4cee068e4138ce652f10c");
assert.equal(e.authority.p12a_correction_merge_sha,"4bc0b36fd831d91508a097b9b196ffd2ce1050cb");
assert.equal(p12.plan_content_sha256,e.authority.p12_plan_sha256);
assert.equal(p12a.plan_content_sha256,e.authority.p12a_correction_sha256);
assert.equal(p12a.subject.market_applicability,null);
assert.equal(p12a.fact_scope.market,"GLOBAL");
assert.equal(p12a.retained_deterministic_identity.proposition_key,e.fact.proposition_key);
assert.equal(p12a.retained_deterministic_identity.source_content_digest,e.fact.source_content_digest);
assert.equal(p12a.retained_deterministic_identity.canonical_evidence_digest,e.fact.canonical_evidence_digest);

assert.equal(e.admin_actor.role,"admin_owner");
assert.equal(e.admin_actor.is_active,true);
assert.equal(e.execution_policy.direct_product_fact_table_dml,false);
assert.equal(e.execution_policy.controlled_rpc_only,true);
assert.equal(e.execution_policy.subject_registration_performed,false);
assert.equal(e.execution_policy.fresh_preflight_ready_before_confirm,true);
assert.equal(e.execution_policy.p12_authority_correction_applied_before_first_write,true);
for(const k of ["schema_change","rpc_change","registry_change","recommendation_or_ranking_change"]) assert.equal(e.execution_policy[k],false);

assert.deepEqual(e.expected_delta,{bindings:1,confirmations:1,current:1,evidence:1,evidence_links:1,fact_instances:1,review_assignments:1,sources:1,subjects:0});
for(const k of ["subjects","sources","bindings","evidence","fact_instances","evidence_links","review_assignments","confirmations","current"]){
  assert.equal(e.poststate[k]-e.prestate[k],e.expected_delta[k],`delta ${k}`);
}
assert.equal(e.prestate.subject_market_applicability,null);
assert.equal(e.prestate.target_uva_current,0);
assert.equal(e.prestate.target_spf_current,1);
assert.equal(e.prestate.target_proposition_current,0);
assert.equal(e.prestate.target_source_digest_rows,0);
assert.equal(e.prestate.target_evidence_digest_rows,0);
assert.equal(e.prestate.target_open_assignments,0);
assert.equal(e.prestate.target_confirmation_request_conflicts,0);
assert.equal(e.poststate.target_subjects,1);
assert.equal(e.poststate.target_spf_current,1);
assert.equal(e.poststate.target_uva_current,1);
assert.equal(e.poststate.assignment_state,"confirmed");
assert.equal(e.poststate.provenance_exact,true);
assert.equal(e.poststate.value_contract_exact,true);

assert.equal(e.fact.product_id,"25b2763f-529f-4b2e-a436-2e0776279c55");
assert.equal(e.fact.subject_id,"0865df81-9cd9-438c-8167-380b932c1dc0");
assert.equal(e.fact.subject_semantic_key,"2f5345df7de1decc70af71677652186cb9c2d61e215240a03b29f5e23d1ece44");
assert.equal(e.fact.subject_market_applicability,null);
assert.equal(e.fact.fact_key,"uva_label");
assert.equal(e.fact.value_type,"enum");
assert.equal(e.fact.value_enum,"PA++++");
assert.equal(e.fact.market,"GLOBAL");
assert.equal(e.fact.region,null);
assert.equal(e.fact.locale,null);
assert.deepEqual(e.fact.qualifier,{});
assert.equal(e.fact.semantic_status,"supported");
assert.equal(e.fact.authority_ceiling,"product_specific_primary");
assert.equal(e.fact.fused_confidence,"high");
assert.equal(e.fact.binding_state,"exact_subject_match");
assert.equal(e.fact.scope_relation,"equivalent");
assert.equal(e.fact.preflight.status,"ready");
assert.equal(e.fact.preflight.previous_current,null);

for(const k of ["product_id","subject_id","source_id","binding_id","evidence_id","assignment_id","confirmation_id","fact_instance_id"]) assert.match(e.fact[k],uuid,k);
for(const k of ["proposition_key","source_content_digest","canonical_evidence_digest","fusion_input_digest","result_digest"]) assert.match(e.fact[k],sha,k);
for(const k of ["payload_digest","prestate_digest"]) assert.match(e.fact.preflight[k],sha,k);
assert.equal(e.fact.proposition_key,"ea34c1e334b846df861b198bd658c3ce1a98d422433e66d0b3e3d7c584915f01");
assert.equal(e.fact.source_content_digest,"e09425390b1fbf0e9c4eb4c4a3d1b2854f25d6a7de82a99f57a56a575184e7c9");
assert.equal(e.fact.canonical_evidence_digest,"95920464b02a26fa8e31ab057fbbc2157cbb761f0a7eed91d8db7df8121cdb69");
assert.equal(e.fact.fusion_input_digest,"fc4ee6bacd655607e4bc775ca0dea8ff7e9508e0dbbdd8c78ee8e2acb6bcfe98");
assert.equal(e.fact.preflight.payload_digest,"9519f05a0e8374dfe113b6e9560bb44e5356e8437628daa39ecb1f27a63ea76f");
assert.equal(e.fact.preflight.prestate_digest,"14661fa82be98d4128b8061cad08c9eb5e100e031e0edd12c302f234223d790a");
assert.equal(e.fact.result_digest,"b787fb3ec5010fa3664acc5d01d67c50ec3b4581a45baae5680f79bb182e13b0");

assert.deepEqual(e.review_events.map(x=>x.event_kind),["evidence_ingested","review_assignment_prepared","review_assignment_transitioned","fact_confirmed"]);
assert.deepEqual(e.review_events.map(x=>x.reason_code),["controlled_ingest","trust_p12a_boj_uva_under_review","trust_p12a_boj_uva_ready_for_confirm","controlled_confirmation"]);
assert.equal(e.closure.p12_phase_b,"CONFIRMED");
assert.equal(e.closure.boj_original_relief_sun_product_fact_coverage,"SPF_AND_UVA_CURRENT");

console.log(JSON.stringify({ok:true,stage:e.stage,status:e.status,product_id:e.fact.product_id,subject_id:e.fact.subject_id,fact_key:e.fact.fact_key,value:e.fact.value_enum,confirmation_id:e.fact.confirmation_id,fact_instance_id:e.fact.fact_instance_id,poststate:e.poststate,execution_content_sha256:e.execution_content_sha256},null,2));
