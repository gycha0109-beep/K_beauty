#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
export const C=Object.freeze({
  version:"trust-p8-sunscreen-hosted-adoption-plan-v1",
  sourceMain:"e108ec4f0c4ac063d93f106592117456e415295c",
  p7Merge:"62ca540d22fa457bb064eca6e19fb12f1338495c",
  p7CaptureMain:"30a11e00273462391374dcc7efb16325cf018fcb",
  p7Path:"evidence/product-fact-subject-coverage-v1/trust-p7-sunscreen-stage-b-identity-source-research-v1.json",
  p7Blob:"7da1aef5d3b3bab446398aaa9656942180a17118",
  registry:"product-fact-registry-cross-category-v1",
  subjectSerializer:"product-fact-subject-identity-v1",
  propositionSerializer:"product-fact-proposition-pilot-v1",
  identityResolution:"trust-p7-sunscreen-stage-b-identity-v1",
  fusion:"v2.1-4-product-fact-evidence-fusion-v1",
  actor:"e1a59349-fe13-43ff-86ce-078c2dce0d99",
  blocked:"9983f167-24e7-4223-bd86-446ce6ced31b",
  output:"evidence/product-fact-adoption-v1/trust-p8-sunscreen-hosted-adoption-plan-v1.json"
});
export const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const canonical=v=>JSON.stringify(stable(v));
export const digest=v=>crypto.createHash("sha256").update(typeof v==="string"?v:canonical(v)).digest("hex");
export const pretty=v=>JSON.stringify(stable(v),null,2)+"\n";
const need=(x,m)=>assert.ok(x,m);
const gitBlob=p=>execFileSync("git",["hash-object",p],{cwd:ROOT,encoding:"utf8"}).trim();

function sourceObservation(row,source){
  return {
    version:"trust-p7-frozen-source-observation-v1",
    canonical_locator:source.url,
    publisher:source.publisher,
    source_kind:source.source_kind,
    source_market:source.market,
    identity_support:source.identity_support,
    machine_verifiable_fact_support:source.machine_verifiable_fact_support,
    scope_relation_to_subject_proposal:source.scope_relation_to_subject_proposal,
    observed_claims:source.observed_claims,
    companion_identity_sources:row.sources.filter(x=>x.url!==source.url).map(x=>({
      url:x.url,publisher:x.publisher,market:x.market,identity_support:x.identity_support,
      machine_verifiable_fact_support:x.machine_verifiable_fact_support,
      scope_relation_to_subject_proposal:x.scope_relation_to_subject_proposal,observed_claims:x.observed_claims
    })),
    localized_name_adjudication:row.localized_name_adjudication??null,
    p7_identity_basis:row.identity.basis
  };
}
function buildSubject(row){
  const identity={
    product_id:row.product_id,variant_key:row.identity.variant_key_proposal,
    formulation_revision_key:row.identity.formulation_revision_key_proposal,
    market_applicability:row.identity.market_applicability_proposal,
    region_applicability:row.identity.region_applicability_proposal,valid_from:null,valid_to:null
  };
  return {
    product_id:row.product_id,subject_semantic_key:digest(identity),variant_key:identity.variant_key,
    formulation_revision_key:identity.formulation_revision_key,
    formulation_label:`${row.catalog.brand} ${row.catalog.name} ${row.catalog.size_ml}ml`,
    market_applicability:identity.market_applicability,region_applicability:null,
    identity_status:"resolved",current_state:"current",valid_from:null,valid_to:null
  };
}
function buildSource(row){
  const locator=row.accepted_fact_support[0].evidence_source_url;
  const source=row.sources.find(x=>x.url===locator);
  need(source?.machine_verifiable_fact_support===true,`${row.product_id}: fact source`);
  const observation=sourceObservation(row,source);
  return {
    source_ref:`trust-p8-source:${row.product_id}`,product_id:row.product_id,canonical_locator:source.url,
    publisher:source.publisher,source_kind:source.source_kind,source_market:source.market,
    binding_scope_relation:source.scope_relation_to_subject_proposal==="equivalent"?"equivalent":"narrower",
    content_digest:digest(observation),digest_basis:"trust-p7-frozen-source-observation-v1-not-live-page-bytes",
    companion_identity_source_urls:row.sources.filter(x=>x.url!==source.url).map(x=>x.url),
    accessed_at:"2026-09-10T21:12:00+09:00"
  };
}
function buildPropositions(row,subject,source){
  const market=row.identity.market_applicability_proposal??"GLOBAL";
  const scope={market,variant:row.identity.variant_key_proposal};
  return row.accepted_fact_support.map(f=>{
    const qualifier=f.fact_key==="spf_value"?{plus_modifier:"plus"}:{};
    const propositionIdentity={
      serializer_version:C.propositionSerializer,subject_semantic_key:subject.subject_semantic_key,
      registry_version:C.registry,fact_key:f.fact_key,value_identity:f.normalized_value,
      scope,qualifier,parent_proposition_key:null
    };
    const propositionKey=digest(propositionIdentity);
    const evidenceIdentity={
      version:"trust-p8-canonical-evidence-v1",upstream_p7_artifact:"trust-p7-sunscreen-stage-b-identity-source-research-v1",
      product_id:row.product_id,subject_semantic_key:subject.subject_semantic_key,source_ref:source.source_ref,
      source_content_digest:source.content_digest,fact_key:f.fact_key,raw_claim:f.raw_claim,
      proposition_key:propositionKey,proposition_value_identity:f.normalized_value,scope,qualifier,
      evidence_class:"product_claim",evidence_authority:"product_specific_primary",support_direction:"supports"
    };
    return {
      product_id:row.product_id,subject_semantic_key:subject.subject_semantic_key,source_ref:source.source_ref,
      fact_key:f.fact_key,raw_claim:f.raw_claim,value:f.normalized_value,scope,qualifier,
      proposition_key:propositionKey,canonical_evidence_digest:digest(evidenceIdentity),
      value_type:f.fact_key==="spf_value"?"number":"enum",evidence_class:"product_claim",
      evidence_authority:"product_specific_primary",support_direction:"supports",
      negative_admissibility:"not_applicable",authority_ceiling:"product_specific_primary",fused_confidence:1
    };
  });
}
export function buildPlan(p7){
  need(p7.version==="trust-p7-sunscreen-stage-b-identity-source-research-v1","P7 version");
  need(p7.stage==="TRUST-P7","P7 stage");
  need(p7.authority.source_main_sha===C.p7CaptureMain,"P7 capture");
  need(p7.authority.registry_version===C.registry,"P7 registry");
  need(p7.authority.subject_serializer===C.subjectSerializer,"P7 subject serializer");
  need(p7.authority.proposition_serializer===C.propositionSerializer,"P7 proposition serializer");
  need(p7.authority.identity_resolution_version===C.identityResolution,"P7 identity resolution");
  const eligible=p7.products.filter(x=>x.disposition==="ADOPTION_PREFLIGHT_ELIGIBLE");
  const blocked=p7.products.filter(x=>x.disposition==="FACT_SOURCE_RECOVERY_REQUIRED");
  need(eligible.length===3&&blocked.length===1&&blocked[0].product_id===C.blocked,"P7 scope");
  for(const row of eligible){
    need(row.identity.status==="resolved"&&row.identity.relation==="equivalent",`${row.product_id}: identity`);
    need(row.accepted_fact_support.length===2,`${row.product_id}: fact count`);
    need(row.accepted_fact_support.some(x=>x.fact_key==="spf_value"&&x.normalized_value===50),`${row.product_id}: SPF`);
    need(row.accepted_fact_support.some(x=>x.fact_key==="uva_label"&&x.normalized_value==="PA++++"),`${row.product_id}: UVA`);
  }
  const subjects=eligible.map(buildSubject);
  const sub=new Map(subjects.map(x=>[x.product_id,x]));
  const sources=eligible.map(buildSource);
  const src=new Map(sources.map(x=>[x.product_id,x]));
  const propositions=eligible.flatMap(row=>buildPropositions(row,sub.get(row.product_id),src.get(row.product_id)));
  const plan={
    version:C.version,stage:"TRUST-P8",phase:"A_DETERMINISTIC_PLAN_FREEZE",source_main_sha:C.sourceMain,
    authority:{
      upstream_p7_merge_sha:C.p7Merge,upstream_p7_capture_main_sha:C.p7CaptureMain,
      upstream_p7_artifact_path:C.p7Path,upstream_p7_blob_sha:C.p7Blob,registry_version:C.registry,
      subject_serializer_version:C.subjectSerializer,proposition_serializer_version:C.propositionSerializer,
      identity_resolution_version:C.identityResolution,fusion_policy_version:C.fusion
    },
    admin_actor:{user_id:C.actor,role:"admin_owner",is_active:true},
    hosted_prestate:{
      subjects:16,sources:16,bindings:16,evidence:41,fact_instances:41,review_assignments:41,
      confirmations:41,current:41,target_subjects:0,target_current:0,target_source_locators:0
    },
    exact_scope:{
      products:3,subjects:3,sources:3,bindings:3,propositions:6,fact_keys:["spf_value","uva_label"],
      eligible_product_ids:eligible.map(x=>x.product_id).sort(),excluded_product_ids:[C.blocked]
    },
    subjects:subjects.sort((a,b)=>a.product_id.localeCompare(b.product_id)),
    sources:sources.sort((a,b)=>a.product_id.localeCompare(b.product_id)),
    propositions:propositions.sort((a,b)=>a.product_id.localeCompare(b.product_id)||a.fact_key.localeCompare(b.fact_key)),
    phase_b_contract:{
      rpc_sequence:["admin_register_product_fact_subject_v1","admin_ingest_product_fact_evidence_v1","admin_prepare_product_fact_review_v1","admin_preflight_product_fact_confirmation_v1","admin_confirm_product_fact_v1"],
      runtime_ids:"server_returned_only",review_states:["under_review","ready_for_confirm"],
      all_six_preflight_before_any_confirm:true,direct_table_dml:false
    },
    phase_a_expected_writes:0,phase_b_execution_authorized:false,
    phase_b_planned_delta:{subjects:3,sources:3,bindings:3,evidence:6,fact_instances:6,evidence_links:6,review_assignments:6,confirmations:6,current:6},
    invariants:{la_roche_fact_inference:false,new_fact_kind:false,registry_mutation:false,schema_or_rpc_mutation:false,recommendation_or_ranking_change:false},
    next_gate:{status:"PHASE_A_FREEZE_ONLY",requires_exact_head_ci:true,requires_merge:true,requires_fresh_production_prestate:true,requires_all_six_confirmation_preflights_ready:true}
  };
  return {...plan,plan_content_sha256:digest(plan)};
}
function main(){
  assert.equal(gitBlob(C.p7Path),C.p7Blob,"P7 blob drift");
  const p7=JSON.parse(fs.readFileSync(path.join(ROOT,C.p7Path),"utf8"));
  const plan=buildPlan(p7);
  fs.writeFileSync(path.join(ROOT,C.output),pretty(plan));
  console.log(JSON.stringify({ok:true,stage:plan.stage,products:3,propositions:6,phase_a_writes:0,plan_content_sha256:plan.plan_content_sha256},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main();
