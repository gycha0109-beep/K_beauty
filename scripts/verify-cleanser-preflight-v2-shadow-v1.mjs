#!/usr/bin/env node
import assert from "node:assert/strict";
import {compareCleanserInitialPreflightV1V2Shadow as compare} from "../lib/cleanser-preflight-v2-shadow-v1.mjs";
const P="11111111-1111-4111-8111-111111111111",S="22222222-2222-4222-8222-222222222222";
const sourceId="33333333-3333-4333-8333-333333333333",by="44444444-4444-4444-8444-444444444444";
const bindingId="55555555-5555-4555-8555-555555555555";
const now=new Date("2026-10-23T00:00:00Z");
const digest="a".repeat(64),sourceUrl="https://brand.example/product?sku=150";
const makeSide=(sku,capacity,loc)=>({
  requested_presentation:{product_id:P,market:"KR",sku,presentation_key:"presentation-"+sku,
    capacity_amount:capacity,capacity_unit:"ml"},
  source_subject_binding:{product_id:P,subject_id:S,source_id:sourceId,
    binding_state:"equivalent_presentation_match",scope_relation:"equivalent",
    reviewed_by:by,reviewed_at:"2026-10-20T00:00:00Z",
    presentation_metadata:{exact_sku_reviewed:true,verified_sku:sku,
      verified_presentation_key:"presentation-"+sku,verified_market:"KR",
      exact_source_locator:loc,verified_amount:capacity,verified_unit:"ml"}},
  evidence_source:{source_id:sourceId,source_kind:"official_product_page",
    publisher:"Official Manufacturer",market:"KR",canonical_locator:loc,
    content_digest:digest,external_snapshot_reference:"archive:reviewed-"+sku},
  subject:{subject_id:S,product_id:P,identity_status:"resolved",current_state:"current",
    market_applicability:"KR",formulation_revision_key:"v1-review"}
});
function fixture(){
  const left=makeSide("sku-120",120,"https://brand.example/product?sku=120");
  const right=makeSide("sku-150",150,sourceUrl);
  const subject={...left.subject};
  const product={id:P,category:"cleanser",size_ml:120};
  const requested_presentation={...right.requested_presentation};
  return {
    v1_preflight:{version:"cleanser-initial-admission-preflight-v1",
      productId:P,state:"RESEARCH_OR_EVIDENCE_REQUIRED",
      blockers:["VERIFIED_EXACT_CAPACITY_REQUIRED"],conflicts:[],
      admissionGranted:false,recommendationRuntimeActivated:false},
    product,subject,requested_presentation,
    official_bindings:[{binding_id:bindingId,product_id:P,binding_state:"resolved",
      product_scope_state:"product",source_name:"brand_official",source_url:sourceUrl}],
    observations:[{product_id:P,subject_id:S,source_binding_id:bindingId,
      canonical_locator:sourceUrl,market:"KR",source_kind:"brand_official_product_page",
      source_content_digest:digest,fetched_at:"2026-10-22T00:00:00Z",
      product_identity_observation:{product_id:P,subject_id:S,exact_catalog_product_binding:true,
        verified_variant_state:"exact",verified_sku:"sku-150",
        verified_presentation_key:"presentation-sku-150",
        verified_capacity_amount:150,verified_capacity_unit:"ml"}}],
    governed_formula_sources:{left,right},now
  };
}
const valid=compare(fixture());
assert.equal(valid.v1_state,"RESEARCH_OR_EVIDENCE_REQUIRED");
assert.equal(valid.v2_state,"SHADOW_CAPACITY_SCOPE_RECONCILED");
assert.equal(valid.v1_capacity_blocked,true);
assert.equal(valid.formula_decision,"SAME_FORMULA_CONFIRMED");
assert.deepEqual(valid.v2_remaining_blockers,[]);
assert.equal(valid.observed_presentation_verified,true);
assert.equal(valid.source_subject_fact_reuse_authorized,false);
assert.equal(valid.admission_granted,false);
assert.equal(valid.governed_g2_grant_issued,false);
assert.equal(valid.runtime_candidate_included,false);
assert.equal(valid.production_writes,0);
// Unknown formula, wrong unit, different URL query/digest/SKU, missing review and source always HOLD.
for(const mutate of [
 x=>{x.governed_formula_sources=null},
 x=>{x.governed_formula_sources.left.source_subject_binding.reviewed_by=null},
 x=>{x.governed_formula_sources.right.subject.subject_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
 x=>{x.governed_formula_sources.right.source_subject_binding.subject_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
 x=>{x.governed_formula_sources.left.requested_presentation.capacity_amount=170},
 x=>{x.governed_formula_sources.left.source_subject_binding.presentation_metadata.verified_amount=220},
 x=>{x.governed_formula_sources.right.source_subject_binding.presentation_metadata.verified_amount=300},
 x=>{x.requested_presentation.capacity_amount=220},
 x=>{x.requested_presentation.capacity_unit="g"},
 x=>{x.requested_presentation.sku="fake-sku"},
 x=>{x.requested_presentation.presentation_key="fake-presentation"},
 x=>{x.governed_formula_sources.right.evidence_source.content_digest="b".repeat(64)},
 x=>{x.governed_formula_sources.right.evidence_source.canonical_locator=sourceUrl+"&sku_extra=another"},
 x=>{x.observations[0].product_identity_observation.verified_sku="wrong"},
 x=>{x.observations[0].source_content_digest="b".repeat(64)},
 x=>{x.observations[0].canonical_locator=sourceUrl+"&wrong=1"},
 x=>{x.observations[0].fetched_at="2020-10-22T00:00:00Z"},
 x=>{x.observations[0].product_identity_observation.verified_variant_state="unknown"},
 x=>{x.official_bindings=[]},
 x=>{x.subject.identity_status="ambiguous"},
 x=>{x.v1_preflight.blockers.push("GOVERNED_CURRENT_FACT_REQUIRED")},
 x=>{x.v1_preflight.conflicts.push("CANONICAL_DUPLICATE_OR_VARIANT_COLLISION")},
 x=>{x.observations.push(structuredClone(x.observations[0]))}
]) {
  const f=fixture();mutate(f);
  const y=compare(f);
  assert.equal(y.v2_state,"REVIEW_REQUIRED",JSON.stringify(y));
  assert.ok(y.v2_remaining_blockers.length);
  assert.equal(y.admission_granted,false);
}
const noCapacity=fixture();
noCapacity.v1_preflight.blockers=[];
noCapacity.v1_preflight.state="AUTO_ADMISSION_PREFLIGHT_PASS";
assert.equal(compare(noCapacity).v2_state,"REVIEW_REQUIRED");
assert.equal(compare(noCapacity).v1_capacity_blocked,false);
for(const mutate of [
 x=>{x.v1_preflight.version="other"},
 x=>{x.v1_preflight.productId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
 x=>{x.product.category="sunscreen"},
 x=>{x.official_bindings=null}
]){
 const f=fixture();mutate(f);assert.throws(()=>compare(f),TypeError);
}
assert.deepEqual(compare(fixture()),valid);
console.log("Cleanser R4/C4 v2 capacity-versus-formulation scoped shadow: PASS (v1 injected, zero grants)");
