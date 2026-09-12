#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const executionPath="evidence/product-fact-adoption-v1/trust-p18-skin1004-uv-us-spf-hosted-adoption-execution-v1.json";
const planPath="evidence/product-fact-adoption-v1/trust-p18-skin1004-uv-us-spf-hosted-adoption-plan-v1.json";
const x=JSON.parse(fs.readFileSync(executionPath,"utf8"));
const p=JSON.parse(fs.readFileSync(planPath,"utf8"));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash("sha256").update(typeof v==="string"?v:JSON.stringify(stable(v))).digest("hex");

assert.equal(x.version,"trust-p18-skin1004-uv-us-spf-hosted-adoption-execution-v1");
assert.equal(x.stage,"TRUST-P18_PHASE_B_EXECUTION_CLOSEOUT");
assert.equal(x.status,"PRODUCTION_CONFIRMED");
assert.equal(x.authority.p18_plan_merge_sha,"cb4afbc04156c458fa3a4a7e5f747f7187304d70");
assert.equal(x.authority.p18_plan_blob_sha,"93bcaf7d99f09f3257d36b64962e127b03406f16");
assert.equal(x.authority.p18_plan_sha256,"e0a6d654b85179b1031a6c95b13d28d731747b831bfeeb57a66b4a5527f95b96");
assert.equal(p.version,"trust-p18-skin1004-uv-us-spf-hosted-adoption-plan-v1");
assert.equal(p.plan_content_sha256,x.authority.p18_plan_sha256);
assert.equal(p.phase_a_expected_writes,0);
assert.equal(p.phase_b_execution_authorized,false);

assert.equal(x.subject.product_id,"fdf06871-db8e-4e73-a48c-c057c5ce925d");
assert.equal(x.subject.subject_id,"9dcd611d-e353-47f5-b349-e1f22d73551e");
assert.equal(x.subject.subject_semantic_key,"6ea35ff44d90264c4cb8f845b1f04f28adc794872220f41e4cc9e03d13561320");
assert.equal(x.subject.market_applicability,"US");
assert.equal(x.source_binding.source_id,"f72a2781-2d6a-45f1-82a6-c33674088523");
assert.equal(x.source_binding.binding_id,"903517b0-c91b-4802-9f51-88b0d305a164");
assert.equal(x.source_binding.binding_state,"exact_subject_match");
assert.equal(x.source_binding.scope_relation,"equivalent");
assert.equal(x.source_binding.source_content_digest,"e30e828daffd28c7656b63e8bf0bfa2555c9590ab9647c29eba6c2695a6c0603");

assert.equal(x.fact.fact_key,"spf_value");
assert.equal(x.fact.proposition_key,"6b04db0623d15da37c2cfb58168a41cc00dd735c775d28f7f7a2aa715122075a");
assert.equal(x.fact.canonical_evidence_digest,"d4d15e6142f9c6a64b4cf7531169ef0aeeb49d2b6edc21650d5e361c8415eb6c");
assert.equal(x.fact.evidence_id,"3385ad77-ff6e-4a4f-bb37-d25d611df7f2");
assert.equal(x.fact.assignment_id,"3641cdbc-86ba-4b9f-b7fc-8bb2d7b221f5");
assert.equal(x.fact.fact_instance_id,"304b8be8-e80a-49a5-9ceb-dfafef6b0828");
assert.equal(x.fact.confirmation_id,"eea66ab9-abee-46c5-bb57-e3f9f119e5b3");
assert.equal(x.fact.value_type,"number");
assert.equal(x.fact.value_number,50);
assert.deepEqual(x.fact.qualifier,{plus_modifier:"none"});
assert.equal(x.fact.market,"US");
assert.equal(x.fact.preflight.status,"ready");
assert.equal(x.fact.preflight.payload_digest,"71a7f7e1013594497801a19ce9ea618fdefdc42c9d40b4e27d922dc762d313a9");
assert.equal(x.fact.preflight.prestate_digest,"5a5275875c65b8535980a7f58a80326919cff3ba8de4a47932848e13e1126fec");
assert.equal(x.fact.preflight.previous_current,null);
assert.equal(x.fact.fusion_input_digest,"7fa996cd048c10ed34d206ef730ba10560eb73f24f89bec88f7543c16b118185");
assert.equal(x.fact.result_digest,"be7d40c09ead322b03a3d49c2ba7e0c6177d33d4fb94890f91a5ede0bb98dceb");
assert.equal(x.fact.assignment_state,"confirmed");
assert.equal(x.fact.evidence_link_count,1);

for (const key of ["subjects","sources","bindings","evidence","fact_instances","evidence_links","review_assignments","confirmations","current"]) {
  assert.equal(x.poststate[key]-x.prestate[key],x.expected_delta[key],key);
}
assert.equal(x.poststate.target_subjects,1);
assert.equal(x.poststate.target_spf_current,1);
assert.equal(x.poststate.target_uva_current,0);
assert.equal(x.execution_policy.controlled_rpc_only,true);
assert.equal(x.execution_policy.direct_product_fact_table_dml,false);
assert.equal(x.execution_policy.uva_write_performed,false);
assert.equal(x.execution_policy.broad_spectrum_to_pa_conversion,false);
assert.equal(x.execution_policy.cross_formula_pa_transfer,false);
assert.equal(x.execution_policy.kr_scope_inference,false);
assert.equal(x.execution_policy.global_scope_inference,false);

const {execution_content_sha256,...withoutDigest}=x;
assert.equal(digest(withoutDigest),execution_content_sha256);
assert.equal(execution_content_sha256,"63aa3d21eb2fd0412ec49268825ccc7a709b2c7412c4dd0e4225fb3498b50808");

console.log(JSON.stringify({
  ok:true,
  stage:x.stage,
  subject_id:x.subject.subject_id,
  source_id:x.source_binding.source_id,
  evidence_id:x.fact.evidence_id,
  fact_instance_id:x.fact.fact_instance_id,
  confirmation_id:x.fact.confirmation_id,
  result_digest:x.fact.result_digest,
  execution_content_sha256
},null,2));
