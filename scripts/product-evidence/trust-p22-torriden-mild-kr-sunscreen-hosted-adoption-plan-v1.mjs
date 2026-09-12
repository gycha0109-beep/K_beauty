#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

export const C=Object.freeze({
  version:"trust-p22-torriden-mild-kr-sunscreen-hosted-adoption-plan-v1",
  sourceMain:"b5e34f2b0be6e70bd5046c8cec532c0d0dbb186c",
  dataOffer15Merge:"c8a871fbec97eaaf19baa956f0b08db6bf1d7ba5",
  dataOffer15Path:"evidence/data-offer15/torriden-136-catalog-source-offer-closure-v1.json",
  dataOffer15Blob:"8b18deb66ae6e0383d79e8dc276b36c0ce330910",
  dataOffer15Version:"data_offer15_catalog_source_offer_closure_v1",
  captureMerge:"30500ec5ad4c0e1ccd939e1c78a918a0b7eb27fa",
  captureRun:34546730051,
  captureArtifact:10179284044,
  capturePayloadSha:"f56a3a4592c766f972da2cfcc1e529aca2eb68e657a22c82b244c2f8b727beb7",
  captureBytes:175733,
  registry:"product-fact-registry-cross-category-v1",
  subjectSerializer:"product-fact-subject-identity-v1",
  propositionSerializer:"product-fact-proposition-pilot-v1",
  fusion:"v2.1-4-product-fact-evidence-fusion-v1",
  product:"08b85f37-b1fa-42d7-893a-0d4facb17878",
  variant:"DIVE_IN_MILD_SUN_CREAM_KR_60ML",
  revision:"trust-p22-torriden-136-current",
  sourceRef:"trust-p22-source:08b85f37-b1fa-42d7-893a-0d4facb17878",
  sourceObservationVersion:"trust-p22-torriden-mild-kr-spf-pa-source-observation-v1",
  officialPage:"https://www.torriden.com/goods/goods_view.php?goodsNo=136",
  asset:"https://ai.esmplus.com/torriden/product/dive-in/SUN/MildSunCream/01.jpg"
});

export const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const canonical=v=>JSON.stringify(stable(v));
export const digest=v=>crypto.createHash("sha256").update(typeof v==="string"?v:canonical(v)).digest("hex");
const need=(v,m)=>assert.ok(v,m);

export function buildCore(dataOffer15){
  need(dataOffer15.schema_version===C.dataOffer15Version,"DATA-OFFER15 schema");
  need(dataOffer15.production?.project_id==="bygrczggxfuisupcevaz","Production project");
  const p=dataOffer15.production?.product;
  need(p?.product_id===C.product,"target Product");
  need(p?.name==="다이브인 무기자차 마일드 선크림"&&p?.category==="sunscreen","target identity");
  const candidate=dataOffer15.production?.candidate;
  need(candidate?.matched_product_id===C.product&&candidate?.review_status==="promoted"&&candidate?.identity_resolution_state==="resolved","candidate resolution");
  const review=dataOffer15.production?.review;
  need(review?.approved_product_id===C.product&&review?.status==="approved","manual catalog approval");
  const officialBinding=dataOffer15.production?.source_bindings?.find(x=>x.source_name==="torriden_official"&&x.external_type==="goods"&&x.external_id==="136");
  need(officialBinding?.product_id===C.product,"official binding target");
  need(officialBinding?.source_url===C.officialPage&&officialBinding?.binding_state==="resolved","official binding");
  need(officialBinding?.binding_method==="manual_catalog_identity_convergence_v1"&&officialBinding?.product_scope_state==="product","official binding authority");
  need(officialBinding?.market_code==="KR"&&officialBinding?.locale==="ko-KR","official binding scope");
  need(dataOffer15.production?.raw_seller_observation?.capture_provenance?.workflow_run_id===C.captureRun,"capture run");
  need(dataOffer15.production?.raw_seller_observation?.capture_provenance?.artifact_id===C.captureArtifact,"capture artifact");
  need(dataOffer15.production?.raw_seller_observation?.capture_provenance?.merged_main_sha===C.captureMerge,"capture merge");
  need(dataOffer15.production?.raw_seller_observation?.capture_provenance?.payload_sha256===C.capturePayloadSha,"capture digest");
  need(dataOffer15.production?.raw_seller_observation?.capture_provenance?.payload_bytes===C.captureBytes,"capture bytes");
  need(dataOffer15.production?.product_fact_scope?.target_product_subject_count===0,"upstream target subject boundary");
  need(dataOffer15.production?.product_fact_scope?.target_product_current_fact_count===0,"upstream target current boundary");
  need(dataOffer15.authority_boundary?.product_fact_authority_granted===false,"upstream Product Fact authority boundary");
  need(dataOffer15.authorized_deltas?.target_product_fact_current===0,"upstream Product Fact zero write");

  const subjectIdentity={product_id:C.product,variant_key:C.variant,formulation_revision_key:C.revision,market_applicability:"KR",region_applicability:null,valid_from:null,valid_to:null};
  const subject={product_id:C.product,subject_semantic_key:digest(subjectIdentity),variant_key:C.variant,formulation_revision_key:C.revision,formulation_label:"토리든 다이브인 무기자차 마일드 선크림 60ml",market_applicability:"KR",region_applicability:null,identity_status:"resolved",current_state:"current",valid_from:null,valid_to:null};

  const sourceObservation={
    version:C.sourceObservationVersion,
    upstream_identity_artifact:C.dataOffer15Version,
    upstream_capture:{workflow_run_id:C.captureRun,artifact_id:C.captureArtifact,merged_main_sha:C.captureMerge,payload_sha256:C.capturePayloadSha,payload_bytes:C.captureBytes},
    direct_fact_source:{canonical_locator:C.officialPage,publisher:"Torriden / (주)토리든",source_kind:"official_product_page",market:"KR",presentation_name:"다이브인 무기자차 마일드 선크림 60ml",fill_size_ml:60,package_english_name:"DIVE IN Mild Sun Cream",direct_claim:"SPF50+ PA++++",direct_claim_asset_url:C.asset,asset_reference_present_in_captured_html:true},
    identity_binding:{product_source_binding_id:officialBinding.binding_id,listing_id:"136",binding_state:officialBinding.binding_state,binding_method:officialBinding.binding_method,product_scope_state:officialBinding.product_scope_state,market_code:officialBinding.market_code,locale:officialBinding.locale},
    disambiguation:{distinct_from_product_id:"57e4a5ec-115d-4322-85a1-7976db669700",cross_product_transfer_allowed:false}
  };
  const source={source_ref:C.sourceRef,product_id:C.product,canonical_locator:C.officialPage,publisher:"Torriden / (주)토리든",source_kind:"official_product_page",source_market:"KR",binding_state:"exact_subject_match",binding_scope_relation:"equivalent",content_digest:digest(sourceObservation),digest_basis:`${C.sourceObservationVersion}-not-live-page-bytes`,direct_claim_asset_url:C.asset,accessed_at:dataOffer15.production.raw_seller_observation.observed_at};

  const proposition=(factKey,value,rawClaim,qualifier,valueType)=>{
    const scope={market:"KR",variant:C.variant};
    const propositionKey=digest({serializer_version:C.propositionSerializer,subject_semantic_key:subject.subject_semantic_key,registry_version:C.registry,fact_key:factKey,value_identity:value,scope,qualifier,parent_proposition_key:null});
    const canonicalEvidence=digest({version:"trust-p22-canonical-evidence-v1",upstream_identity_artifact:C.dataOffer15Version,product_id:C.product,subject_semantic_key:subject.subject_semantic_key,source_ref:C.sourceRef,source_content_digest:source.content_digest,fact_key:factKey,raw_claim:rawClaim,proposition_key:propositionKey,proposition_value_identity:value,scope,qualifier,evidence_class:"product_claim",evidence_authority:"product_specific_primary",support_direction:"supports"});
    return {product_id:C.product,subject_semantic_key:subject.subject_semantic_key,source_ref:C.sourceRef,fact_key:factKey,raw_claim:rawClaim,value,scope,qualifier,proposition_key:propositionKey,canonical_evidence_digest:canonicalEvidence,value_type:valueType,evidence_class:"product_claim",evidence_authority:"product_specific_primary",support_direction:"supports",negative_admissibility:"not_applicable",authority_ceiling:"product_specific_primary",fused_confidence:"high"};
  };

  return {subject,sourceObservation,source,propositions:[proposition("spf_value",50,"SPF50+",{plus_modifier:"plus"},"number"),proposition("uva_label","PA++++","PA++++",{},"enum")]};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const dataOffer15=JSON.parse(fs.readFileSync(C.dataOffer15Path,"utf8"));
  const core=buildCore(dataOffer15);
  console.log(JSON.stringify({ok:true,subject_key:core.subject.subject_semantic_key,source_digest:core.source.content_digest,propositions:core.propositions.map(x=>[x.fact_key,x.proposition_key,x.canonical_evidence_digest])},null,2));
}
