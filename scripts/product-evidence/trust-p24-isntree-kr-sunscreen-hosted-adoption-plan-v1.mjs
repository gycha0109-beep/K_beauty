#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

export const C=Object.freeze({
  version:"trust-p24-isntree-kr-sunscreen-hosted-adoption-plan-v1",
  sourceMain:"b6a90a2cfb89d9e54b0fddd046a1c06c221475ff",
  p23Merge:"b6a90a2cfb89d9e54b0fddd046a1c06c221475ff",
  p23Path:"evidence/product-fact-subject-coverage-v1/trust-p23-isntree-kr-direct-image-spf-pa-source-recovery-v1.json",
  p23Blob:"3aeeba898a3586917ab511b3dd2db02c52ff4b78",
  p23Version:"trust-p23-isntree-kr-direct-image-spf-pa-source-recovery-v1",
  registry:"product-fact-registry-cross-category-v1",
  subjectSerializer:"product-fact-subject-identity-v1",
  propositionSerializer:"product-fact-proposition-pilot-v1",
  fusion:"v2.1-4-product-fact-evidence-fusion-v1",
  product:"336bb533-0fe4-4380-8b9f-ab16fb24b807",
  variant:"HYALURONIC_ACID_WATERY_SUN_GEL_KR_50ML",
  revision:"trust-p23-isntree-145-current",
  sourceRef:"trust-p24-source:336bb533-0fe4-4380-8b9f-ab16fb24b807",
  sourceObservationVersion:"trust-p24-isntree-kr-spf-pa-source-observation-v1"
});

export const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const canonical=v=>JSON.stringify(stable(v));
export const digest=v=>crypto.createHash("sha256").update(typeof v==="string"?v:canonical(v)).digest("hex");
const need=(v,m)=>assert.ok(v,m);

export function buildCore(p23){
  need(p23.version===C.p23Version&&p23.stage==="TRUST-P23","P23 authority");
  need(p23.target.product_id===C.product&&p23.target.size_ml===50&&p23.target.market==="KR","P23 target");
  need(p23.adjudication.result==="KR_EXACT_PRODUCT_AND_DIRECT_SPF_PA_IMAGE_SOURCE_RECOVERED","P23 adjudication");
  need(p23.adjudication.production_write_authorized===false,"P23 research boundary");
  need(p23.fact_recovery.spf_value.status==="RECOVERED_SUPPORTED"&&p23.fact_recovery.uva_label.status==="RECOVERED_SUPPORTED","P23 recovered facts");
  need(p23.identity_adjudication.status==="RESOLVED_FOR_PLAN","P23 identity");
  need(p23.formulation_adjudication.status==="DIRECT_KR_PRESENTATION_FACT_SOURCE_RECOVERED","P23 formulation");
  need(p23.formulation_adjudication.same_formulation_bridge_required===false,"no formulation bridge required");
  need(p23.formulation_adjudication.cross_market_formula_transfer===false,"no cross-market transfer");

  const page=p23.first_party_sources.find(x=>x.role==="exact_kr_product_and_detail_asset_parent");
  const asset=p23.first_party_sources.find(x=>x.role==="direct_spf_pa_fact_source");
  need(page&&asset,"P23 source set");
  need(page.current_observation.name==="히아루론산 워터리 선 젤 50ml","KR presentation");
  need(page.current_observation.size_ml===50,"KR size");
  need(page.current_observation.detail_asset_directly_linked===true,"page-linked asset");
  need(page.current_observation.direct_detail_asset_url===asset.url,"asset relation");
  need(asset.current_observation.direct_claim==="SPF50+ PA++++","direct claim");

  const subjectIdentity={product_id:C.product,variant_key:C.variant,formulation_revision_key:C.revision,market_applicability:"KR",region_applicability:null,valid_from:null,valid_to:null};
  const subject={product_id:C.product,subject_semantic_key:digest(subjectIdentity),variant_key:C.variant,formulation_revision_key:C.revision,formulation_label:"이즈앤트리 히아루론산 워터리 선 젤 50ml",market_applicability:"KR",region_applicability:null,identity_status:"resolved",current_state:"current",valid_from:null,valid_to:null};

  const sourceObservation={
    version:C.sourceObservationVersion,
    upstream_p23_artifact:C.p23Version,
    direct_fact_source:{canonical_locator:page.url,publisher:page.publisher,source_kind:"official_product_page",market:"KR",presentation_name:page.current_observation.name,fill_size_ml:page.current_observation.size_ml,package_english_name:asset.current_observation.product_name_on_package,direct_claim:asset.current_observation.direct_claim,detail_asset_url:asset.url,detail_asset_relation:p23.identity_adjudication.source_asset_relation,additional_package_marking:asset.current_observation.additional_package_marking},
    identity_context:{catalog_name:p23.target.catalog_name,official_kr_name:p23.target.official_kr_name,relation:p23.identity_adjudication.catalog_to_official_relation,cross_market_formula_transfer:false,global_formula_dependency:false}
  };
  const source={source_ref:C.sourceRef,product_id:C.product,canonical_locator:page.url,publisher:page.publisher,source_kind:"official_product_page",source_market:"KR",binding_state:"exact_subject_match",binding_scope_relation:"equivalent",content_digest:digest(sourceObservation),digest_basis:`${C.sourceObservationVersion}-not-live-page-bytes`,companion_evidence_asset_urls:[asset.url],accessed_at:p23.authority.researched_at};

  const proposition=(factKey,value,rawClaim,qualifier,valueType)=>{
    const scope={market:"KR",variant:C.variant};
    const propositionKey=digest({serializer_version:C.propositionSerializer,subject_semantic_key:subject.subject_semantic_key,registry_version:C.registry,fact_key:factKey,value_identity:value,scope,qualifier,parent_proposition_key:null});
    const canonicalEvidence=digest({version:"trust-p24-canonical-evidence-v1",upstream_p23_artifact:C.p23Version,product_id:C.product,subject_semantic_key:subject.subject_semantic_key,source_ref:C.sourceRef,source_content_digest:source.content_digest,fact_key:factKey,raw_claim:rawClaim,proposition_key:propositionKey,proposition_value_identity:value,scope,qualifier,evidence_class:"product_claim",evidence_authority:"product_specific_primary",support_direction:"supports"});
    return {product_id:C.product,subject_semantic_key:subject.subject_semantic_key,source_ref:C.sourceRef,fact_key:factKey,raw_claim:rawClaim,value,scope,qualifier,proposition_key:propositionKey,canonical_evidence_digest:canonicalEvidence,value_type:valueType,evidence_class:"product_claim",evidence_authority:"product_specific_primary",support_direction:"supports",negative_admissibility:"not_applicable",authority_ceiling:"product_specific_primary",fused_confidence:"high"};
  };
  return {subject,sourceObservation,source,propositions:[proposition("spf_value",50,"SPF50+",{plus_modifier:"plus"},"number"),proposition("uva_label","PA++++","PA++++",{},"enum")]};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const p23=JSON.parse(fs.readFileSync(C.p23Path,"utf8"));
  const core=buildCore(p23);
  console.log(JSON.stringify({ok:true,subject_key:core.subject.subject_semantic_key,source_digest:core.source.content_digest,propositions:core.propositions.map(x=>[x.fact_key,x.proposition_key,x.canonical_evidence_digest])},null,2));
}
