#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8");
const evidencePath="evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r2-existing-offer-composition-design-v1.json";
const docsPath="docs/evidence/v21-8h-r16i-r2-existing-offer-composition-architecture-v1.md";
const d=JSON.parse(read(evidencePath)),doc=read(docsPath);
const offerSql=read("supabase/migrations/20260910103000_product_offers_shadow_v1.sql");
const readPath=read("lib/product-offer-read-path.js");
const pf=read("docs/architecture/product-fact-subject-formulation-scope-v1.md");
const r16i=JSON.parse(read("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-snature-160ml-bundle-boundary-v1.json"));
assert.equal(d.contract_version,"r16i-r2-product-offer-composition-design-v1");
assert.equal(d.stage,"V2.1-8H-R16I_R2_EXISTING_OFFER_MODEL_REUSE");
assert.equal(d.verdict,"R16I_R2_REUSE_EXISTING_OFFERS_COMPOSITION_SHADOW_DESIGN_HOLD");
assert.equal(d.catalog_anchor.product_id,r16i.target.product_id);
assert.equal(d.catalog_anchor.legacy_size_ml,160);
assert.equal(d.catalog_anchor.legacy_price_min,29900);
assert.equal(d.catalog_anchor.legacy_price_max,29900);
assert.equal(d.catalog_anchor.legacy_unit_price_per_10ml,1868.75);
assert.equal(d.catalog_anchor.legacy_buy_link,r16i.target.source_binding);
assert.equal(d.catalog_anchor.source_binding.state,"resolved");
assert.equal(d.catalog_anchor.source_binding.scope,"product_subject_unresolved");
assert.equal(d.catalog_anchor.intake.identity_state,"SUBJECT_CREATION_REQUIRED");
assert.equal(d.catalog_anchor.intake.trust_state,"REVIEW_REQUIRED");
assert.equal(d.catalog_anchor.intake.subject_id,null);
assert.equal(d.catalog_anchor.subject_count,0);
const ext=d.existing_offer_infrastructure;
assert.equal(ext.product_offers_total_count_observed,73);
assert.equal(ext.matching_target_product_offers,0);
assert.equal(ext.matching_hwahae_listing_offers,0);
assert.equal(ext.new_offer_table_needed,false);
assert.equal(ext.new_workflow_needed,false);
assert.equal(ext.trusted_live_link_policy_has_hwahae,false);
assert.equal(ext.price_projection_automatically_authorized,false);
assert.match(offerSql,/create table if not exists public\.product_offers/i);
for(const field of ["offer_id","product_id","seller_key","listing_id","listing_url","price_amount","offer_state","product_scope_state"]){
 assert.match(offerSql,new RegExp("\\b"+field+"\\b"));
 assert.ok(ext.columns_available.includes(field),field);
}
for(const field of ext.missing_component_attributes){
 assert.ok(!new RegExp("\\b"+field+"\\s+(?:numeric|integer|text|uuid|smallint|jsonb)", "i").test(offerSql),field);
}
assert.match(readPath,/const TRUSTED_LINK_SOURCE_POLICIES = new Map/);
assert.match(readPath,/priceAuthority:\s*false/);
assert.ok(!readPath.includes('"hwahae"'));
assert.match(pf,/Commercial presentation/);
assert.match(pf,/different size[\s\S]{0,45}automatically different Product Fact subject/i);
const x=d.model_separation,parts=x.bundle_components;
assert.equal(x.product.product_id,d.catalog_anchor.product_id);
assert.equal(x.single_presentation.primary_container_volume_ml,80);
assert.equal(x.retailer_offer.listing_id,"45194");
assert.equal(x.retailer_offer.offer_id,null);
assert.equal(x.retailer_offer.offer_record_exists,false);
assert.equal(parts.length,2);
assert.equal(parts[0].role,"PRIMARY_PRODUCT");
assert.equal(parts[0].unit_volume_ml,80);
assert.equal(parts[0].quantity_inferred_from_retail_title,2);
assert.equal(parts[0].aggregate_volume_ml,160);
assert.equal(parts[0].physically_verified,false);
assert.equal(parts[1].role,"GIFT_OTHER_PRODUCT");
assert.equal(parts[1].product_id,null);
assert.equal(parts[1].unit_volume_ml,10);
assert.equal(parts[1].aggregate_volume_ml,10);
assert.equal(x.primary_offer_volume_ml,parts[0].unit_volume_ml*parts[0].quantity_inferred_from_retail_title);
assert.equal(x.total_mixed_component_volume_ml,x.primary_offer_volume_ml+parts[1].aggregate_volume_ml);
assert.equal(x.mixed_total_volume_as_single_product_volume_allowed,false);
assert.equal(d.price_policy.show_legacy_offer_price_as_80ml_single_price,false);
assert.equal(d.price_policy.derive_price_per_10ml_from_mixed_170ml,false);
assert.equal(d.catalog_anchor.legacy_price_min/d.catalog_anchor.legacy_size_ml*10,1868.75);
assert.equal(d.catalog_anchor.legacy_price_min/x.single_presentation.primary_container_volume_ml*10,3737.5);
assert.equal(d.alternatives.approved_design_direction,"REUSE_PRODUCT_OFFERS_AND_ADD_REVIEW_ONLY_COMPOSITION_ENVELOPE_FIRST");
assert.equal(d.alternatives.reject_new_offer_table.startsWith("Existing table"),true);
assert.deepEqual(d.future_operations.map(g=>g.gate),["R16I-R2","R16I-R3","R16I-R4","R16I-R5"]);
assert.ok(d.future_operations.every(g=>g.writes===0));
assert.ok(d.write_prerequisites.length>=6);
for(const k of ["catalog_rows_updated","offers_inserted","subject_rows_inserted","source_bindings_changed","intakes_changed","production_writes","recommendation_delta","review_signals_reassigned"]){
 assert.equal(d.safety[k],0,k);
}
assert.equal(d.safety.formula_key,null);
assert.equal(d.safety.subject_semantic_key,null);
for(const k of ["r16b_hold_preserved","r16h_hold_preserved","zeroid_hold_preserved"])assert.equal(d.safety[k],true);
assert.equal(d.safety.non_numeric_pda_candidates*d.safety.scenarios,d.safety.comparisons);
assert.equal(d.safety.comparisons,1968);
for(const label of [
 "R16I_R2_REUSE_EXISTING_OFFERS_COMPOSITION_SHADOW_DESIGN_HOLD",
 "public.product_offers",
 "80ml×2",
 "29,900원",
 "1,868.75원",
 "3,737.5원",
 "화해",
 "R16I-R5",
 "Production 쓰기 0",
])assert.ok(doc.includes(label),label);
console.log(JSON.stringify({status:"PASS",stage:"R16I-R2",reused_existing_offers:73,target_offers:0,bundle_components:2,unit_price_scope_fail_closed:true,new_table_or_workflow:false,subjects_registered:0,production_writes:0}));
