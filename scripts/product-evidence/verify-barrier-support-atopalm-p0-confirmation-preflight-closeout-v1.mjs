#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-confirmation-preflight-closeout-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-controlled-review-preparation-closeout-v1.json";

const artifact=JSON.parse(fs.readFileSync(artifactPath,"utf8"));
const parent=JSON.parse(fs.readFileSync(parentPath,"utf8"));
const gitBlob=(path)=>execFileSync("git",["hash-object",path],{encoding:"utf8"}).trim();

const BARRIER_ASSIGN="dc558642-3dfb-4fe4-8733-d69310f71c51";
const ROLE_ASSIGN="8148748f-aea3-43fb-9cf1-4d50ac01cca3";
const BARRIER_EVIDENCE="af1a47e6-e168-4492-8407-1072f9f7ff60";
const ROLE_EVIDENCE="73bd7367-857f-476b-a88e-5beae7347c8b";
const BARRIER_PROP="a1e01fd7508d83f2b251d33f59397f902a1ed20b4a09c51ed4dd3e3da7a639c5";
const ROLE_PROP="82e11e7bb7e999b242759f6ebdabcfb5fce4625ad0432e85144abbd64d2ce240";

assert.equal(artifact.stage,"V2.1-8H-R13H");
assert.equal(artifact.decision,"BARRIER_SUPPORT_ATOPALM_P0_CONFIRMATION_PREFLIGHT_PASS");
assert.equal(artifact.parent_authority.r13g_path,parentPath);
assert.equal(gitBlob(parentPath),artifact.parent_authority.r13g_git_blob_sha);
assert.equal(parent.decision,artifact.parent_authority.r13g_decision);
assert.equal(parent.next_gate.stage,"V2.1-8H-R13H_ATOPALM_CONFIRMATION_PREFLIGHT_ONLY");
assert.equal(parent.next_gate.confirmation_preflight_authorized,true);
assert.equal(parent.next_gate.confirmation_authorized,false);

assert.equal(artifact.authority.preflight_rpc,"admin_preflight_product_fact_confirmation_v1(uuid,text,jsonb)");
assert.equal(artifact.authority.preflight_function_sha256,"7d9ce38e47468fb1a419528256857e399a3d7e50e719f7bd449034c96019f59e");
assert.equal(artifact.authority.preflight_helper_sha256,"b736e373ebbcf577f332626e9fab2d8715c87c8a69a931de2ba3727bcc102f16");
assert.equal(artifact.authority.confirm_rpc,"admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)");
assert.equal(artifact.authority.confirm_function_sha256,"b143613eac0e27b7e223379f7b5c20179a89f2b4b04150463c84e880656dcf29");
assert.equal(artifact.authority.anon_execute,false);
assert.equal(artifact.authority.authenticated_execute,false);
assert.equal(artifact.authority.service_role_execute,true);
assert.equal(artifact.authority.confirm_called,false);

assert.equal(artifact.candidates.length,2);
const m=new Map(artifact.candidates.map(x=>[x.fact_key,x]));
const b=m.get("barrier_support_claim");
const r=m.get("primary_use_role");
assert.ok(b); assert.ok(r);

assert.equal(b.assignment_id,BARRIER_ASSIGN);
assert.equal(b.evidence_id,BARRIER_EVIDENCE);
assert.equal(b.proposition_key,BARRIER_PROP);
assert.equal(b.semantic_status,"supported");
assert.equal(b.value_type,"boolean");
assert.equal(b.value,true);
assert.equal(b.payload.value_boolean,true);
assert.equal(b.payload.value_enum,null);
assert.equal(b.payload.market,"KR");
assert.equal(b.payload.authority_ceiling,"product_specific_primary");
assert.equal(b.payload.fused_confidence,"high");
assert.equal(b.payload.fusion_policy_version,"v2.1-4-product-fact-evidence-fusion-v1");
assert.equal(b.payload.fusion_input_digest,"51c863da9e5b26764539ca6af70a3d8a8c44d113093fc15078b49356b2e8f5cf");
assert.deepEqual(b.payload.supporting_evidence_ids,[BARRIER_EVIDENCE]);
assert.deepEqual(b.payload.opposing_evidence_ids,[]);
assert.equal(b.execution.status,"ready");
assert.equal(b.execution.actor_role,"admin_owner");
assert.equal(b.execution.payload_digest,"fc107c10634a788da789ab775857a3e33091a9375424cb5b0b8042a63d5c5ad1");
assert.equal(b.execution.prestate_digest,"9587aa29bb4a39ff24f93e549f40f863527d9b1f5311d8e467f76d2ab83ee344");
assert.equal(b.execution.previous_current,null);

assert.equal(r.assignment_id,ROLE_ASSIGN);
assert.equal(r.evidence_id,ROLE_EVIDENCE);
assert.equal(r.proposition_key,ROLE_PROP);
assert.equal(r.semantic_status,"supported");
assert.equal(r.value_type,"enum");
assert.equal(r.value,"multi_area");
assert.equal(r.payload.value_boolean,null);
assert.equal(r.payload.value_enum,"multi_area");
assert.equal(r.payload.market,"KR");
assert.equal(r.payload.authority_ceiling,"product_specific_primary");
assert.equal(r.payload.fused_confidence,"high");
assert.equal(r.payload.fusion_policy_version,"v2.1-4-product-fact-evidence-fusion-v1");
assert.equal(r.payload.fusion_input_digest,"0fed8f311336a2f6a16628a5f4c992baeaecdd43234fa6176494e40e9837ba0e");
assert.deepEqual(r.payload.supporting_evidence_ids,[ROLE_EVIDENCE]);
assert.deepEqual(r.payload.opposing_evidence_ids,[]);
assert.equal(r.execution.status,"ready");
assert.equal(r.execution.actor_role,"admin_owner");
assert.equal(r.execution.payload_digest,"2abed6501c2a7c017e46f4b9a8cb9d27534afd58b8c4e69d4862d4b0e038cea9");
assert.equal(r.execution.prestate_digest,"1e76ac3f6b9e85ae970c187d35e2b29e85263bd4b9592bfd73d6c10d8f8c67a3");
assert.equal(r.execution.previous_current,null);

for(const c of artifact.candidates){
  assert.equal(c.payload.proposition_serializer_version,"product-fact-proposition-pilot-v1");
  assert.equal(c.execution.fusion_input_digest,c.payload.fusion_input_digest);
  assert.deepEqual(c.execution.expected_write_set,{
    product_fact_current:1,
    product_fact_instances:1,
    product_fact_confirmations:1,
    product_fact_review_events:1,
    product_fact_evidence_links:1,
    product_fact_review_assignments_update:1
  });
}

assert.deepEqual(artifact.post_preflight_readback,{
  assignments:[
    {assignment_id:BARRIER_ASSIGN,fact_key:"barrier_support_claim",operational_state:"ready_for_confirm",assignment_event_count:2},
    {assignment_id:ROLE_ASSIGN,fact_key:"primary_use_role",operational_state:"ready_for_confirm",assignment_event_count:2}
  ],
  preflight_audit_count:0,
  target_fact_instances:0,
  target_current_facts:0,
  target_confirmations:0,
  target_evidence_links:0,
  global_product_fact_current:105,
  global_fact_instances:106,
  global_confirmations:106,
  global_evidence_records:110
});

assert.deepEqual(artifact.authority_boundary,{
  confirmation_preflight_complete:true,
  confirmation_authorized_in_r13h:false,
  confirmation_called:false,
  product_fact_materialized:false,
  recommendation_activation_authorized:false,
  public_activation:false,
  production_cutover_authorized:false
});

assert.equal(artifact.stop_boundary,"STOP_BEFORE_R13I_FINAL_CONFIRMATION");
assert.equal(artifact.next_gate.stage,"V2.1-8H-R13I_ATOPALM_FINAL_PRODUCT_FACT_CONFIRMATION");
assert.equal(artifact.next_gate.status,"NOT_EXECUTED");
assert.equal(artifact.next_gate.candidates.length,2);
assert.equal(artifact.next_gate.requires_fresh_prestate_revalidation,true);
assert.equal(artifact.next_gate.allowed_rpc,"admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)");
assert.equal(artifact.next_gate.confirmation_execution_candidate,true);
assert.equal(artifact.next_gate.recommendation_activation_authorized,false);
assert.equal(artifact.next_gate.public_activation,false);

const ng=new Map(artifact.next_gate.candidates.map(x=>[x.fact_key,x]));
assert.equal(ng.get("barrier_support_claim").preflight_payload_digest,b.execution.payload_digest);
assert.equal(ng.get("barrier_support_claim").preflight_prestate_digest,b.execution.prestate_digest);
assert.equal(ng.get("primary_use_role").preflight_payload_digest,r.execution.payload_digest);
assert.equal(ng.get("primary_use_role").preflight_prestate_digest,r.execution.prestate_digest);

console.log(JSON.stringify({
  status:"PASS",
  stage:artifact.stage,
  decision:artifact.decision,
  candidates:2,
  zeroWrite:true,
  stopBoundary:artifact.stop_boundary
}));
