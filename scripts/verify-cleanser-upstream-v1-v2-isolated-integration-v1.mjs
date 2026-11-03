#!/usr/bin/env node
/**
 * Isolation test runs the byte-identical original v1 from draft PR #1390
 * alongside the main-based v2. The ten current records are a REDACTED
 * SELECT-only authority footprint, not ten complete live v1 input snapshots.
 * All unretained web URLs, reviews and ingredient aggregates are omitted;
 * they must NOT be reported as absent in the live DB.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {evaluateCleanserInitialAdmissionPreflight as v1}
  from "../lib/cleanser-initial-admission-preflight-v1.mjs";
import {compareExistingTenCleanserPreflightsV1 as compareTen}
  from "../lib/cleanser-ten-preflight-v1-v2-diff-v1.mjs";
import {compareCleanserInitialPreflightV1V2Shadow as compareV2}
  from "../lib/cleanser-preflight-v2-shadow-v1.mjs";

const path="evidence/trust/cleanser-ten-integration-authority-footprint-20261023.json";
const footprint=JSON.parse(await readFile(path,"utf8"));
assert.equal(footprint.version,"cleanser-ten-integration-authority-footprint-v1");
assert.equal(footprint.products.length,10);
const ten=footprint.products;
const ids=ten.map(x=>x.id);
assert.equal(new Set(ids).size,10);
assert.ok(ten.every(p=>p.identity_state==="SUBJECT_CREATION_REQUIRED"&&
  p.trust_state==="REVIEW_REQUIRED"&&
  p.tasks===2&&p.subjects===0&&p.resolved_official_bindings===0&&
  p.official_observations===0&&p.offers===0));
const cohort={
  expected_product_ids:ids,
  products:ten.map(p=>({
    id:p.id,brand:p.brand,name:p.name,normalized_brand:p.normalized_brand,
    normalized_name:p.normalized_name,category:p.category,size_ml:p.size_ml,
    // These are REDACTED from committed footprint, not missing in live DB.
    source_url:null,hwahae_url:null,
    review_signals:null,market_signals:null,ingredient_signals:null,
    skin_types:null,concerns:null
  })),
  subjects:[],official_bindings:[],observations:[],confirmed_facts:[],
  governed_formula_pairs:[],
  catalog_products:ten.map(({id,normalized_brand,normalized_name})=>({
    id,normalized_brand,normalized_name
  }))
};
const assessed=await compareTen({cohort,evaluateV1:v1,now:new Date("2026-10-23T00:00:00Z")});
assert.equal(assessed.total,10);
assert.equal(assessed.v1_capacity_block_count,10);
assert.equal(assessed.v2_capacity_scope_reconciled_count,0);
assert.equal(assessed.v2_review_required_count,10);
assert.equal(assessed.admission_grants,0);
assert.equal(assessed.production_writes,0);
for(const row of assessed.results) {
  for(const blocker of [
    "CURRENT_EXACT_SUBJECT_REQUIRED",
    "RESOLVED_OFFICIAL_SOURCE_BINDING_REQUIRED",
    "CURRENT_OFFICIAL_IDENTITY_OBSERVATION_REQUIRED",
    "VERIFIED_EXACT_CAPACITY_REQUIRED",
    "GOVERNED_CURRENT_FACT_REQUIRED"
  ]) assert.ok(row.v1_blockers.includes(blocker),row.product_id+" "+blocker);
  assert.equal(row.v2_state,"REVIEW_REQUIRED");
  assert.equal(row.exact_presentation_verified,false);
  assert.equal(row.formula_decision,"FORMULA_UNRESOLVED");
}
// Independent exact original-v1 positive control. All these data are synthetic.
const productId="11111111-1111-4111-8111-111111111111";
const subjectId="22222222-2222-4222-8222-222222222222";
const bindingId="33333333-3333-4333-8333-333333333333";
const source120="44444444-4444-4444-8444-444444444444";
const source150="55555555-5555-4555-8555-555555555555";
const reviewedBy="66666666-6666-4666-8666-666666666666";
const baseUrl="https://brand.example/items/cleanser";
const url120=baseUrl+"?sku=120";
const url150=baseUrl+"?sku=150";
const hwahae="https://www.hwahae.co.kr/products/246810";
const now=new Date("2026-10-23T00:00:00Z"),digest="a".repeat(64);
const subject={subject_id:subjectId,product_id:productId,identity_status:"resolved",
  current_state:"current",market_applicability:"KR",formulation_revision_key:"reviewed-v1"};
const product={
  id:productId,category:"cleanser",brand:"Synthetic Brand",
  name:"Cleanser 120ml",normalized_brand:"synthetic",normalized_name:"cleanser",
  size_ml:120,source_url:url150,hwahae_url:hwahae,
  skin_types:["combination"],concerns:["dehydration"],
  review_signals:{source:"hwahae_ai_review",positive:[],negative:[],updated_at:"2026-10-22"},
  market_signals:{source:"hwahae_visible_page",review_count:0,rating:null,
    hwahae_review_page:hwahae,updated_at:"2026-10-22"},
  ingredient_signals:{source:"hwahae_visible_page",total_ingredients:2,
    risk:{low:2,medium:0,high:0,unknown:0},
    skin_type:{dry:{positive:0,negative:0},oily:{positive:0,negative:0},
      sensitive:{positive:0,negative:0}},updated_at:"2026-10-22"}
};
const officialBindings=[{binding_id:bindingId,product_id:productId,
  binding_state:"resolved",product_scope_state:"product",
  source_name:"brand_official",source_url:url150}];
const observations=[{product_id:productId,subject_id:subjectId,source_binding_id:bindingId,
  canonical_locator:url150,market:"KR",source_kind:"brand_official_product_page",
  source_content_digest:digest,fetched_at:"2026-10-22T00:00:00Z",
  product_identity_observation:{product_id:productId,subject_id:subjectId,
    exact_catalog_product_binding:true,verified_variant_state:"exact",
    verified_capacity_amount:150,verified_capacity_unit:"ml",verified_sku:"sku-150",
    verified_presentation_key:"presentation-sku-150"}}];
const makeFact=(key,which,letter)=>({
  subject_id:subjectId,fact_key:key,proposition_key:letter.repeat(64),
  confirmation_id:which[0],fact_instance_id:which[1],
  registry_version:"product-fact-registry-cross-category-v1",
  semantic_status:"supported",authority_ceiling:"product_specific_primary",
  fused_confidence:"high",valid_from:"2026-10-01",valid_to:null,
  confirmation:{status:"confirmed",confirmation_id:which[0],fact_instance_id:which[1],
    subject_id:subjectId,fact_key:key,proposition_key:letter.repeat(64),
    registry_version:"product-fact-registry-cross-category-v1",
    semantic_status:"supported",authority_ceiling:"product_specific_primary",
    fused_confidence:"high"}
});
const confirmedFacts=[
  makeFact("low_ph",["77777777-7777-4777-8777-777777777777",
    "88888888-8888-4888-8888-888888888888"],"a"),
  makeFact("deep_cleansing",["99999999-9999-4999-8999-999999999999",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],"b")
];
const snapshot={product,subject,officialBindings,observations,confirmedFacts,
  catalogProducts:[{id:productId,normalized_brand:product.normalized_brand,
    normalized_name:product.normalized_name}],now};
const original=v1(snapshot);
assert.deepEqual(original.blockers,["VERIFIED_EXACT_CAPACITY_REQUIRED"]);
assert.equal(original.state,"RESEARCH_OR_EVIDENCE_REQUIRED");
assert.equal(original.admissionGranted,false);
function side(sku,amount,url,sourceId) {
  return {
    requested_presentation:{product_id:productId,market:"KR",sku,
      presentation_key:"presentation-"+sku,capacity_amount:amount,capacity_unit:"ml"},
    source_subject_binding:{product_id:productId,subject_id:subjectId,
      source_id:sourceId,binding_state:"equivalent_presentation_match",
      scope_relation:"equivalent",reviewed_by:reviewedBy,reviewed_at:"2026-10-22T00:00:00Z",
      presentation_metadata:{exact_sku_reviewed:true,verified_sku:sku,
        verified_presentation_key:"presentation-"+sku,verified_market:"KR",
        exact_source_locator:url,verified_amount:amount,verified_unit:"ml"}},
    evidence_source:{source_id:sourceId,source_kind:"official_product_page",
      publisher:"Manufacturer",canonical_locator:url,content_digest:digest,market:"KR",
      external_snapshot_reference:"frozen:synthetic-"+sku},
    subject:{...subject}
  };
}
const pairs={left:side("sku-120",120,url120,source120),
  right:side("sku-150",150,url150,source150)};
const newResult=compareV2({v1_preflight:original,product,subject,
  official_bindings:officialBindings,observations,
  requested_presentation:pairs.right.requested_presentation,
  governed_formula_sources:pairs,now});
assert.equal(newResult.v2_state,"SHADOW_CAPACITY_SCOPE_RECONCILED");
assert.equal(newResult.formula_decision,"SAME_FORMULA_CONFIRMED");
assert.equal(newResult.admission_granted,false);
assert.equal(newResult.source_subject_fact_reuse_authorized,false);
assert.equal(newResult.production_writes,0);
// A true formulation discontinuity or unknown left unit cannot be reconciled.
const changed=structuredClone(pairs);
changed.right.subject.subject_id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
changed.right.source_subject_binding.subject_id=changed.right.subject.subject_id;
const bad=compareV2({v1_preflight:original,product,subject,
  official_bindings:officialBindings,observations,
  requested_presentation:changed.right.requested_presentation,
  governed_formula_sources:changed,now});
assert.equal(bad.v2_state,"REVIEW_REQUIRED");
assert.equal(bad.admission_granted,false);
console.log("Original #1390 v1 + #1401 v2 isolated integration: PASS "+
  "redacted_actual_cohort=10 authoritative_HOLD=10 "+
  "synthetic_cross_size_reconciliation=PASS grants=0 writes=0 "+
  "(redacted cohort != complete live v1 read)");
