#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

export const C=Object.freeze({
  version:"trust-p15-drg-sunscreen-hosted-adoption-plan-v1",
  sourceMain:"d1a6c7fa8107e17a38edf6c1f8413124666948c0",
  p14Merge:"d1a6c7fa8107e17a38edf6c1f8413124666948c0",
  p14Path:"evidence/product-fact-subject-coverage-v1/trust-p14-drg-same-formulation-fact-source-recovery-v1.json",
  p14Blob:"67e934678f9d901b9be765c3aa74f423cf1365e8",
  p14Version:"trust-p14-drg-same-formulation-fact-source-recovery-v1",
  registry:"product-fact-registry-cross-category-v1",
  subjectSerializer:"product-fact-subject-identity-v1",
  propositionSerializer:"product-fact-proposition-pilot-v1",
  fusion:"v2.1-4-product-fact-evidence-fusion-v1",
  product:"dc1ef3f3-db1b-4c3f-954a-b18343e3d9f3",
  variant:"GREEN_MILD_UP_SUN_PLUS_KR_50ML",
  revision:"trust-p14-drg-9637-5174-current",
  formula:"307d5eb4714f4b015f7a8aeb135a6622a0cbd61ed417076ce059b7e2d7e8e6b8",
  sourceRef:"trust-p15-source:dc1ef3f3-db1b-4c3f-954a-b18343e3d9f3"
});
export const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const canonical=v=>JSON.stringify(stable(v));
export const digest=v=>crypto.createHash("sha256").update(typeof v==="string"?v:canonical(v)).digest("hex");

const need=(v,m)=>assert.ok(v,m);
const row=(p14,url)=>p14.first_party_sources.find(x=>x.url===url);

export function buildCore(p14){
  need(p14.version===C.p14Version&&p14.stage==="TRUST-P14","P14 authority");
  need(p14.target.product_id===C.product&&p14.target.size_ml===50&&p14.target.market==="KR","P14 target");
  need(p14.adjudication.result==="SAME_FORMULATION_FIRST_PARTY_FACT_SOURCE_RECOVERED","P14 adjudication");
  need(p14.adjudication.production_write_authorized===false,"P14 research boundary");
  need(p14.fact_recovery.spf_value.status==="RECOVERED_SUPPORTED"&&p14.fact_recovery.uva_label.status==="RECOVERED_SUPPORTED","P14 recovered facts");
  need(p14.same_formulation_bridge.status==="ESTABLISHED"&&p14.same_formulation_bridge.formula_digest===C.formula,"P14 bridge");

  const target=row(p14,"https://www.dr-g.co.kr/item/9637");
  const formula=row(p14,"https://www.dr-g.co.kr/item/5174");
  const direct=row(p14,"https://www.dr-g.co.kr/item/4415");
  need(target&&formula&&direct,"P14 source set");
  need(formula.current_observation.ingredient_count===36&&direct.current_observation.ingredient_count===36,"ingredient count");
  need(canonical(formula.current_observation.ingredients)===canonical(direct.current_observation.ingredients),"same formula list");
  need(digest(formula.current_observation.ingredients)===C.formula,"formula digest");
  need(direct.current_observation.direct_claim==="SPF50+ PA++++","direct claim");

  const subjectIdentity={product_id:C.product,variant_key:C.variant,formulation_revision_key:C.revision,market_applicability:"KR",region_applicability:null,valid_from:null,valid_to:null};
  const subject={product_id:C.product,subject_semantic_key:digest(subjectIdentity),variant_key:C.variant,formulation_revision_key:C.revision,formulation_label:"닥터지 그린 마일드 업 선 플러스 50ml",market_applicability:"KR",region_applicability:null,identity_status:"resolved",current_state:"current",valid_from:null,valid_to:null};

  const sourceObservation={
    version:"trust-p14-drg-recovered-source-observation-v1",
    upstream_p14_artifact:C.p14Version,
    direct_fact_source:{canonical_locator:direct.url,publisher:direct.publisher,source_kind:"official_product_page",market:"KR",presentation_name:direct.current_observation.name,fill_size_ml:direct.current_observation.size_ml,manufacturer:direct.current_observation.manufacturer,country:direct.current_observation.country,uv_functional_cosmetic:direct.current_observation.uv_functional_cosmetic,direct_claim:direct.current_observation.direct_claim,ingredient_count:direct.current_observation.ingredient_count,ingredient_order_sha256:direct.current_observation.ingredient_order_sha256},
    target_identity_source:{canonical_locator:target.url,presentation_name:target.current_observation.name,fill_size_ml:target.current_observation.size_ml},
    target_formula_source:{canonical_locator:formula.url,presentation_name:formula.current_observation.name,package:formula.current_observation.package,manufacturer:formula.current_observation.manufacturer,ingredient_count:formula.current_observation.ingredient_count,ingredient_order_sha256:formula.current_observation.ingredient_order_sha256},
    same_formulation_bridge:{status:"ESTABLISHED",formula_digest:C.formula,source_fill_size_ml:35,target_fill_size_ml:50,binding_state:"equivalent_presentation_match",scope_relation:"equivalent"}
  };
  const source={source_ref:C.sourceRef,product_id:C.product,canonical_locator:direct.url,publisher:direct.publisher,source_kind:"official_product_page",source_market:"KR",binding_state:"equivalent_presentation_match",binding_scope_relation:"equivalent",content_digest:digest(sourceObservation),digest_basis:"trust-p14-drg-recovered-source-observation-v1-not-live-page-bytes",companion_identity_source_urls:[target.url,formula.url],accessed_at:p14.authority.researched_at};

  const proposition=(factKey,value,rawClaim,qualifier,valueType)=>{
    const scope={market:"KR",variant:C.variant};
    const propositionKey=digest({serializer_version:C.propositionSerializer,subject_semantic_key:subject.subject_semantic_key,registry_version:C.registry,fact_key:factKey,value_identity:value,scope,qualifier,parent_proposition_key:null});
    const canonicalEvidence=digest({version:"trust-p15-canonical-evidence-v1",upstream_p14_artifact:C.p14Version,product_id:C.product,subject_semantic_key:subject.subject_semantic_key,source_ref:C.sourceRef,source_content_digest:source.content_digest,fact_key:factKey,raw_claim:rawClaim,proposition_key:propositionKey,proposition_value_identity:value,scope,qualifier,evidence_class:"product_claim",evidence_authority:"product_specific_primary",support_direction:"supports"});
    return {product_id:C.product,subject_semantic_key:subject.subject_semantic_key,source_ref:C.sourceRef,fact_key:factKey,raw_claim:rawClaim,value,scope,qualifier,proposition_key:propositionKey,canonical_evidence_digest:canonicalEvidence,value_type:valueType,evidence_class:"product_claim",evidence_authority:"product_specific_primary",support_direction:"supports",negative_admissibility:"not_applicable",authority_ceiling:"product_specific_primary",fused_confidence:"high"};
  };
  return {subject,sourceObservation,source,propositions:[proposition("spf_value",50,"SPF50+",{plus_modifier:"plus"},"number"),proposition("uva_label","PA++++","PA++++",{},"enum")]};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const p14=JSON.parse(fs.readFileSync(C.p14Path,"utf8"));
  const core=buildCore(p14);
  console.log(JSON.stringify({ok:true,subject_key:core.subject.subject_semantic_key,source_digest:core.source.content_digest,propositions:core.propositions.map(x=>[x.fact_key,x.proposition_key,x.canonical_evidence_digest])},null,2));
}
