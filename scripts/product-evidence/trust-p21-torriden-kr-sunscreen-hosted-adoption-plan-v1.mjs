#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

export const C=Object.freeze({
  version:"trust-p21-torriden-kr-sunscreen-hosted-adoption-plan-v1",
  sourceMain:"5091cba4e33ac181dacea7d0d1de00882f3bf2e9",
  p20Merge:"5091cba4e33ac181dacea7d0d1de00882f3bf2e9",
  p20Path:"evidence/product-fact-subject-coverage-v1/trust-p20-torriden-kr-identity-spf-pa-source-recovery-v1.json",
  p20Blob:"80e4e003edffb36434622997afa8a3c4cf631659",
  p20Version:"trust-p20-torriden-kr-identity-spf-pa-source-recovery-v1",
  registry:"product-fact-registry-cross-category-v1",
  subjectSerializer:"product-fact-subject-identity-v1",
  propositionSerializer:"product-fact-proposition-pilot-v1",
  fusion:"v2.1-4-product-fact-evidence-fusion-v1",
  product:"57e4a5ec-115d-4322-85a1-7976db669700",
  variant:"DIVE_IN_MOISTURE_SUN_CREAM_KR_60ML",
  revision:"trust-p20-torriden-252-current-upgraded",
  sourceRef:"trust-p21-source:57e4a5ec-115d-4322-85a1-7976db669700",
  sourceObservationVersion:"trust-p21-torriden-kr-spf-pa-source-observation-v1"
});

export const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const canonical=v=>JSON.stringify(stable(v));
export const digest=v=>crypto.createHash("sha256").update(typeof v==="string"?v:canonical(v)).digest("hex");
const need=(v,m)=>assert.ok(v,m);

export function buildCore(p20){
  need(p20.version===C.p20Version&&p20.stage==="TRUST-P20","P20 authority");
  need(p20.target.product_id===C.product&&p20.target.size_ml===60&&p20.target.market==="KR","P20 target");
  need(p20.adjudication.result==="KR_CURRENT_IDENTITY_REVISION_AND_DIRECT_SPF_PA_SOURCE_RECOVERED","P20 adjudication");
  need(p20.adjudication.production_write_authorized===false,"P20 research boundary");
  need(p20.fact_recovery.spf_value.status==="RECOVERED_SUPPORTED"&&p20.fact_recovery.uva_label.status==="RECOVERED_SUPPORTED","P20 recovered facts");
  need(p20.identity_adjudication.status==="RESOLVED_FOR_PLAN","P20 identity");
  need(p20.formulation_adjudication.status==="CURRENT_KR_PRESENTATION_RESOLVED_FOR_PLAN","P20 formulation");
  need(p20.formulation_adjudication.historical_pre_upgrade_formulation_equivalence_asserted===false,"no historical formula equivalence");
  need(p20.formulation_adjudication.cross_product_formula_transfer===false,"no cross-product formula transfer");

  const direct=p20.first_party_sources.find(x=>x.role==="current_kr_product_and_direct_fact_source");
  const legacy=p20.first_party_sources.find(x=>x.role==="catalog_exact_legacy_display_name_identity_route");
  const category=p20.first_party_sources.find(x=>x.role==="current_identity_disambiguation");
  need(direct&&legacy&&category,"P20 source set");
  need(direct.current_observation.presentation_name==="다이브인 모이스처 선크림 60ml","current presentation");
  need(direct.current_observation.package_direct_claim==="SPF50+ PA++++","direct claim");
  need(category.current_observation.cross_product_transfer_allowed===false,"distinct Mild Sun Cream boundary");

  const subjectIdentity={product_id:C.product,variant_key:C.variant,formulation_revision_key:C.revision,market_applicability:"KR",region_applicability:null,valid_from:null,valid_to:null};
  const subject={product_id:C.product,subject_semantic_key:digest(subjectIdentity),variant_key:C.variant,formulation_revision_key:C.revision,formulation_label:"토리든 다이브인 모이스처 선크림 60ml",market_applicability:"KR",region_applicability:null,identity_status:"resolved",current_state:"current",valid_from:null,valid_to:null};

  const sourceObservation={
    version:C.sourceObservationVersion,
    upstream_p20_artifact:C.p20Version,
    direct_fact_source:{canonical_locator:direct.url,publisher:direct.publisher,source_kind:"official_product_page",market:"KR",presentation_name:direct.current_observation.presentation_name,fill_size_ml:direct.current_observation.size_ml,package_english_name:direct.current_observation.package_english_name,direct_claim:direct.current_observation.package_direct_claim,product_image_url:direct.current_observation.product_image_url,detail_asset_namespace:direct.current_observation.detail_asset_namespace,current_detail_asset_url:direct.current_observation.current_detail_asset_url,current_detail_markers:direct.current_observation.current_detail_markers},
    identity_bridge:{legacy_catalog_identity_locator:legacy.url,legacy_presentation_name:legacy.current_observation.presentation_name,relation:p20.identity_adjudication.catalog_to_current_relation,historical_pre_upgrade_formulation_equivalence_asserted:false},
    disambiguation:{category_locator:category.url,distinct_mild_mineral_product:category.current_observation.distinct_mild_mineral_product,cross_product_transfer_allowed:false}
  };
  const source={source_ref:C.sourceRef,product_id:C.product,canonical_locator:direct.url,publisher:direct.publisher,source_kind:"official_product_page",source_market:"KR",binding_state:"exact_subject_match",binding_scope_relation:"equivalent",content_digest:digest(sourceObservation),digest_basis:`${C.sourceObservationVersion}-not-live-page-bytes`,companion_identity_source_urls:[legacy.url,category.url],accessed_at:p20.authority.researched_at};

  const proposition=(factKey,value,rawClaim,qualifier,valueType)=>{
    const scope={market:"KR",variant:C.variant};
    const propositionKey=digest({serializer_version:C.propositionSerializer,subject_semantic_key:subject.subject_semantic_key,registry_version:C.registry,fact_key:factKey,value_identity:value,scope,qualifier,parent_proposition_key:null});
    const canonicalEvidence=digest({version:"trust-p21-canonical-evidence-v1",upstream_p20_artifact:C.p20Version,product_id:C.product,subject_semantic_key:subject.subject_semantic_key,source_ref:C.sourceRef,source_content_digest:source.content_digest,fact_key:factKey,raw_claim:rawClaim,proposition_key:propositionKey,proposition_value_identity:value,scope,qualifier,evidence_class:"product_claim",evidence_authority:"product_specific_primary",support_direction:"supports"});
    return {product_id:C.product,subject_semantic_key:subject.subject_semantic_key,source_ref:C.sourceRef,fact_key:factKey,raw_claim:rawClaim,value,scope,qualifier,proposition_key:propositionKey,canonical_evidence_digest:canonicalEvidence,value_type:valueType,evidence_class:"product_claim",evidence_authority:"product_specific_primary",support_direction:"supports",negative_admissibility:"not_applicable",authority_ceiling:"product_specific_primary",fused_confidence:"high"};
  };
  return {subject,sourceObservation,source,propositions:[proposition("spf_value",50,"SPF50+",{plus_modifier:"plus"},"number"),proposition("uva_label","PA++++","PA++++",{},"enum")]};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const p20=JSON.parse(fs.readFileSync(C.p20Path,"utf8"));
  const core=buildCore(p20);
  console.log(JSON.stringify({ok:true,subject_key:core.subject.subject_semantic_key,source_digest:core.source.content_digest,propositions:core.propositions.map(x=>[x.fact_key,x.proposition_key,x.canonical_evidence_digest])},null,2));
}
