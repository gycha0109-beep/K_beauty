#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const PATH="evidence/product-fact-subject-coverage-v1/trust-p23-isntree-kr-direct-image-spf-pa-source-recovery-v1.json";
const P19="evidence/product-fact-subject-coverage-v1/trust-p19-isntree-kr-formulation-fact-source-recovery-boundary-v1.json";
const x=JSON.parse(fs.readFileSync(PATH,"utf8"));
const p19=JSON.parse(fs.readFileSync(P19,"utf8"));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");

assert.equal(p19.adjudication.next_gate,"FIRST_PARTY_KR_FORMULATION_OR_DIRECT_SPF_PA_SOURCE_RECOVERY_REQUIRED");
assert.equal(p19.adjudication.production_write_authorized,false);
assert.equal(x.version,"trust-p23-isntree-kr-direct-image-spf-pa-source-recovery-v1");
assert.equal(x.stage,"TRUST-P23");
assert.equal(x.phase,"RESEARCH_ONLY_KR_DIRECT_FIRST_PARTY_IMAGE_FACT_SOURCE_RECOVERY");
assert.equal(x.authority.upstream_p19_version,p19.version);
assert.equal(x.target.product_id,"336bb533-0fe4-4380-8b9f-ab16fb24b807");
assert.equal(x.target.market,"KR");
assert.equal(x.production_prestate.subject_count,0);
assert.equal(x.production_prestate.current_count,0);
assert.equal(x.production_prestate.kr_page_locator_rows,0);
assert.equal(x.production_prestate.detail_asset_locator_rows,0);
const page=x.first_party_sources.find(s=>s.role==="exact_kr_product_and_detail_asset_parent");
const asset=x.first_party_sources.find(s=>s.role==="direct_spf_pa_fact_source");
assert.ok(page&&asset);
assert.equal(page.market,"KR");
assert.equal(page.current_observation.name,"히아루론산 워터리 선 젤 50ml");
assert.equal(page.current_observation.size_ml,50);
assert.equal(page.current_observation.detail_asset_directly_linked,true);
assert.equal(page.current_observation.direct_detail_asset_url,asset.url);
assert.equal(asset.market,"KR");
assert.equal(asset.source_kind,"official_kr_product_detail_image_asset");
assert.equal(asset.current_observation.product_name_on_package,"HYALURONIC ACID WATERY SUN GEL");
assert.equal(asset.current_observation.fill_size_ml,50);
assert.equal(asset.current_observation.direct_claim,"SPF50+ PA++++");
assert.equal(asset.current_observation.claim_rendered_on_product_package,true);
assert.equal(x.identity_adjudication.status,"RESOLVED_FOR_PLAN");
assert.equal(x.identity_adjudication.source_asset_relation,"DIRECTLY_LINKED_FROM_EXACT_KR_PRODUCT_PAGE");
assert.equal(x.formulation_adjudication.status,"DIRECT_KR_PRESENTATION_FACT_SOURCE_RECOVERED");
assert.equal(x.formulation_adjudication.same_formulation_bridge_required,false);
assert.equal(x.formulation_adjudication.cross_market_formula_transfer,false);
assert.equal(x.formulation_adjudication.global_formula_dependency,false);
assert.equal(x.fact_recovery.spf_value.status,"RECOVERED_SUPPORTED");
assert.equal(x.fact_recovery.spf_value.raw_claim,"SPF50+");
assert.equal(x.fact_recovery.spf_value.value_number,50);
assert.deepEqual(x.fact_recovery.spf_value.qualifier,{plus_modifier:"plus"});
assert.equal(x.fact_recovery.uva_label.status,"RECOVERED_SUPPORTED");
assert.equal(x.fact_recovery.uva_label.raw_claim,"PA++++");
assert.equal(x.fact_recovery.uva_label.value_enum,"PA++++");
assert.equal(x.fact_recovery.spf_value.evidence_asset_url,asset.url);
assert.equal(x.fact_recovery.uva_label.evidence_asset_url,asset.url);
assert.equal(x.adjudication.result,"KR_EXACT_PRODUCT_AND_DIRECT_SPF_PA_IMAGE_SOURCE_RECOVERED");
assert.equal(x.adjudication.production_write_authorized,false);
assert.equal(x.adjudication.next_gate,"SEPARATE_DETERMINISTIC_HOSTED_ADOPTION_PLAN");
for(const k of ["hosted_product_fact_writes","direct_product_fact_dml","subject_registration_performed","schema_or_rpc_mutation","registry_mutation","recommendation_or_ranking_change","third_party_positive_fact_support","cross_market_formula_transfer","spf_inference","pa_inference"]){
  if(k==="hosted_product_fact_writes") assert.equal(x.invariants[k],0); else assert.equal(x.invariants[k],false);
}
const {research_content_sha256,...body}=x;
assert.equal(digest(body),research_content_sha256);
assert.equal(research_content_sha256,"dd8427421e06ff22a72aec067e066347fde2df9e084ed271c6b19addbaf52508");

console.log(JSON.stringify({ok:true,stage:x.stage,result:x.adjudication.result,spf:x.fact_recovery.spf_value.raw_claim,uva:x.fact_recovery.uva_label.raw_claim,research_content_sha256},null,2));
