#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
export const C=Object.freeze({
  version:"trust-p10-lrp-recovered-spf-hosted-adoption-plan-v1",
  sourceMain:"7bc1f1afaff626087498d843d4676c202ffdae10",
  p9Merge:"7bc1f1afaff626087498d843d4676c202ffdae10",
  p9Path:"evidence/product-fact-subject-coverage-v1/trust-p9-lrp-first-party-fact-source-recovery-v1.json",
  p9Blob:"1b245e26ac1e598a13474723a56909021b5425b9",
  p7Path:"evidence/product-fact-subject-coverage-v1/trust-p7-sunscreen-stage-b-identity-source-research-v1.json",
  p7Blob:"7da1aef5d3b3bab446398aaa9656942180a17118",
  registry:"product-fact-registry-cross-category-v1",
  subjectSerializer:"product-fact-subject-identity-v1",
  propositionSerializer:"product-fact-proposition-pilot-v1",
  identityResolution:"trust-p7-sunscreen-stage-b-identity-v1",
  sourceRecovery:"trust-p9-lrp-first-party-fact-source-recovery-v1",
  fusion:"v2.1-4-product-fact-evidence-fusion-v1",
  actor:"e1a59349-fe13-43ff-86ce-078c2dce0d99",
  product:"9983f167-24e7-4223-bd86-446ce6ced31b",
  output:"evidence/product-fact-adoption-v1/trust-p10-lrp-recovered-spf-hosted-adoption-plan-v1.json"
});
export const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const canonical=v=>JSON.stringify(stable(v));
export const digest=v=>crypto.createHash("sha256").update(typeof v==="string"?v:canonical(v)).digest("hex");
export const pretty=v=>JSON.stringify(stable(v),null,2)+"\n";
const need=(x,m)=>assert.ok(x,m);
const gitBlob=p=>execFileSync("git",["hash-object",p],{cwd:ROOT,encoding:"utf8"}).trim();

function buildSubject(p7Row,p9Row){
  const identity={
    product_id:C.product,
    variant_key:p7Row.identity.variant_key_proposal,
    formulation_revision_key:p7Row.identity.formulation_revision_key_proposal,
    market_applicability:p7Row.identity.market_applicability_proposal,
    region_applicability:p7Row.identity.region_applicability_proposal,
    valid_from:null,
    valid_to:null
  };
  need(p9Row.identity.variant_key_proposal===identity.variant_key,"P9/P7 variant drift");
  need(p9Row.identity.market_applicability_proposal===identity.market_applicability,"P9/P7 market drift");
  return {
    product_id:C.product,
    subject_semantic_key:digest(identity),
    variant_key:identity.variant_key,
    formulation_revision_key:identity.formulation_revision_key,
    formulation_label:`${p9Row.catalog.brand} ${p9Row.catalog.name} ${p9Row.catalog.size_ml}ml`,
    market_applicability:identity.market_applicability,
    region_applicability:identity.region_applicability,
    identity_status:"resolved",
    current_state:"current",
    valid_from:null,
    valid_to:null
  };
}

function sourceObservation(p9Row,source){
  return {
    version:"trust-p9-recovered-source-observation-v1",
    canonical_locator:source.url,
    publisher:source.publisher,
    source_kind:source.source_kind,
    source_market:source.market,
    identity_support:source.identity_support,
    machine_verifiable_fact_support:source.machine_verifiable_fact_support,
    scope_relation_to_subject_proposal:source.scope_relation_to_subject_proposal,
    observed_claims:source.observed_claims,
    companion_identity_sources:p9Row.sources.filter(x=>x.url!==source.url).map(x=>({
      url:x.url,
      publisher:x.publisher,
      market:x.market,
      identity_support:x.identity_support,
      machine_verifiable_fact_support:x.machine_verifiable_fact_support,
      scope_relation_to_subject_proposal:x.scope_relation_to_subject_proposal,
      observed_claims:x.observed_claims
    })),
    formulation_bridge:p9Row.formulation_bridge,
    p9_identity_basis:p9Row.identity.basis
  };
}

function buildSource(p9Row,researchedAt){
  const support=p9Row.accepted_fact_support.find(x=>x.fact_key==="spf_value");
  need(support,"P9 SPF support");
  const source=p9Row.sources.find(x=>x.url===support.evidence_source_url);
  need(source?.machine_verifiable_fact_support===true,"P9 fact source");
  need(source.scope_relation_to_subject_proposal==="broader","P9 source must be broader and narrowed to KR subject");
  const observation=sourceObservation(p9Row,source);
  return {
    source_ref:`trust-p10-source:${C.product}`,
    product_id:C.product,
    canonical_locator:source.url,
    publisher:source.publisher,
    source_kind:source.source_kind,
    source_market:source.market,
    binding_scope_relation:"narrower",
    content_digest:digest(observation),
    digest_basis:"trust-p9-recovered-source-observation-v1-not-live-page-bytes",
    companion_identity_source_urls:p9Row.sources.filter(x=>x.url!==source.url).map(x=>x.url),
    accessed_at:researchedAt
  };
}

function buildProposition(p9Row,subject,source){
  const support=p9Row.accepted_fact_support.find(x=>x.fact_key==="spf_value");
  need(support?.normalized_value===50,"P9 SPF normalized value");
  need(support.raw_claim==="SPF50+","P9 SPF raw claim");
  need(support.fact_market==="KR","P9 SPF fact market");
  const scope={market:"KR",variant:subject.variant_key};
  const qualifier={plus_modifier:"plus"};
  const propositionIdentity={
    serializer_version:C.propositionSerializer,
    subject_semantic_key:subject.subject_semantic_key,
    registry_version:C.registry,
    fact_key:"spf_value",
    value_identity:50,
    scope,
    qualifier,
    parent_proposition_key:null
  };
  const propositionKey=digest(propositionIdentity);
  const evidenceIdentity={
    version:"trust-p10-canonical-evidence-v1",
    upstream_p9_artifact:C.sourceRecovery,
    product_id:C.product,
    subject_semantic_key:subject.subject_semantic_key,
    source_ref:source.source_ref,
    source_content_digest:source.content_digest,
    fact_key:"spf_value",
    raw_claim:support.raw_claim,
    proposition_key:propositionKey,
    proposition_value_identity:50,
    scope,
    qualifier,
    evidence_class:"product_claim",
    evidence_authority:"product_specific_primary",
    support_direction:"supports"
  };
  return {
    product_id:C.product,
    subject_semantic_key:subject.subject_semantic_key,
    source_ref:source.source_ref,
    fact_key:"spf_value",
    raw_claim:support.raw_claim,
    value:50,
    scope,
    qualifier,
    proposition_key:propositionKey,
    canonical_evidence_digest:digest(evidenceIdentity),
    value_type:"number",
    evidence_class:"product_claim",
    evidence_authority:"product_specific_primary",
    support_direction:"supports",
    negative_admissibility:"not_applicable",
    authority_ceiling:"product_specific_primary",
    fused_confidence:1
  };
}

export function buildPlan(p9,p7){
  need(p9.version===C.sourceRecovery,"P9 version");
  need(p9.stage==="TRUST-P9","P9 stage");
  need(p9.product.product_id===C.product,"P9 product");
  need(p9.product.disposition==="PARTIAL_FACT_SOURCE_RECOVERY","P9 disposition");
  need(p9.product.accepted_fact_support.length===1,"P9 accepted fact count");
  need(p9.product.accepted_fact_support[0].fact_key==="spf_value","P9 SPF-only recovery");
  need(p9.product.blocked_fact_support.length===1&&p9.product.blocked_fact_support[0].fact_key==="uva_label","P9 UVA blocked");
  need(p9.invariants.uva_pf_to_pa_conversion_allowed===false,"P9 no UVA conversion");
  need(p7.version==="trust-p7-sunscreen-stage-b-identity-source-research-v1","P7 version");
  const p7Row=p7.products.find(x=>x.product_id===C.product);
  need(p7Row?.identity.status==="resolved"&&p7Row.identity.relation==="equivalent","P7 identity");
  need(p7Row.identity.formulation_revision_key_proposal,"P7 formulation revision");

  const subject=buildSubject(p7Row,p9.product);
  const source=buildSource(p9.product,p9.authority.researched_at);
  const proposition=buildProposition(p9.product,subject,source);
  const plan={
    version:C.version,
    stage:"TRUST-P10",
    phase:"A_DETERMINISTIC_PLAN_FREEZE",
    source_main_sha:C.sourceMain,
    authority:{
      upstream_p9_merge_sha:C.p9Merge,
      upstream_p9_artifact_path:C.p9Path,
      upstream_p9_blob_sha:C.p9Blob,
      upstream_p7_artifact_path:C.p7Path,
      upstream_p7_blob_sha:C.p7Blob,
      registry_version:C.registry,
      subject_serializer_version:C.subjectSerializer,
      proposition_serializer_version:C.propositionSerializer,
      identity_resolution_version:C.identityResolution,
      source_recovery_version:C.sourceRecovery,
      fusion_policy_version:C.fusion
    },
    admin_actor:{user_id:C.actor,role:"admin_owner",is_active:true},
    hosted_prestate:{
      subjects:19,sources:19,bindings:19,evidence:47,fact_instances:47,review_assignments:47,
      confirmations:47,current:47,target_subjects:0,target_current:0,target_source_locators:0
    },
    exact_scope:{
      products:1,subjects:1,sources:1,bindings:1,propositions:1,
      fact_keys:["spf_value"],blocked_fact_keys:["uva_label"],eligible_product_ids:[C.product]
    },
    subjects:[subject],
    sources:[source],
    propositions:[proposition],
    blocked_facts:[{
      product_id:C.product,
      fact_key:"uva_label",
      disposition:"FACT_SOURCE_RECOVERY_REQUIRED",
      observed_same_formula_claim:"UVA-PF 46",
      required_value_kind:"direct_pa_label",
      inference_prohibited:"UVA-PF 46 -> PA++++"
    }],
    phase_b_contract:{
      rpc_sequence:["admin_register_product_fact_subject_v1","admin_ingest_product_fact_evidence_v1","admin_prepare_product_fact_review_v1","admin_preflight_product_fact_confirmation_v1","admin_confirm_product_fact_v1"],
      runtime_ids:"server_returned_only",
      review_states:["under_review","ready_for_confirm"],
      all_planned_confirmation_preflights_before_any_confirm:true,
      direct_table_dml:false
    },
    phase_a_expected_writes:0,
    phase_b_execution_authorized:false,
    phase_b_planned_delta:{subjects:1,sources:1,bindings:1,evidence:1,fact_instances:1,evidence_links:1,review_assignments:1,confirmations:1,current:1},
    invariants:{
      uva_label_inference:false,
      uva_pf_to_pa_conversion:false,
      new_fact_kind:false,
      registry_mutation:false,
      schema_or_rpc_mutation:false,
      recommendation_or_ranking_change:false,
      cross_market_source_narrowed_to_kr:true
    },
    next_gate:{
      status:"PHASE_A_FREEZE_ONLY",
      requires_exact_head_ci:true,
      requires_merge:true,
      requires_fresh_production_prestate:true,
      requires_all_planned_confirmation_preflights_ready:true,
      eligible_fact_keys:["spf_value"],
      blocked_fact_keys:["uva_label"]
    }
  };
  return {...plan,plan_content_sha256:digest(plan)};
}

function main(){
  assert.equal(gitBlob(C.p9Path),C.p9Blob,"P9 blob authority drift");
  assert.equal(gitBlob(C.p7Path),C.p7Blob,"P7 blob authority drift");
  const p9=JSON.parse(fs.readFileSync(path.join(ROOT,C.p9Path),"utf8"));
  const p7=JSON.parse(fs.readFileSync(path.join(ROOT,C.p7Path),"utf8"));
  const plan=buildPlan(p9,p7);
  fs.writeFileSync(path.join(ROOT,C.output),pretty(plan));
  console.log(JSON.stringify({ok:true,stage:plan.stage,products:1,propositions:1,phase_a_writes:0,plan_content_sha256:plan.plan_content_sha256},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main();
