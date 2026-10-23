#!/usr/bin/env node
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  CLEANSER_EVIDENCE_TIER_SHADOW_VERSION as VERSION,
  CLEANSER_EVIDENCE_TIER as TIER,
  evaluateCleanserEvidenceTierShadowV1 as evaluate
} from "../lib/trust/cleanser-evidence-tier-shadow-v1.mjs";
const date="2026-10-23T00:00:00Z",now=new Date(date);
const fixture=JSON.parse(await readFile(
  "evidence/trust/cleanser-authority-next-actions-20261023.json","utf8"));
assert.equal(fixture.rows.length,10);
const product=x=>({id:x.id,brand:x.brand,name:x.name,category:"cleanser",
  normalized_brand:x.brand,normalized_name:x.name});
const ten=fixture.rows.map(x=>evaluate({product:product(x),now}));
assert.equal(ten.length,10);
assert.ok(ten.every(x=>x.version===VERSION&&x.tier===TIER.IDENTITY_ONLY&&
  x.shadow_limited_fit_candidate===false&&x.low_ph==="UNKNOWN"&&
  x.deep_cleansing==="UNKNOWN"&&x.g2_grant_issued===false&&
  x.production_writes===0));
const example=fixture.rows.find(x=>x.hwahae_signals_present===true);
assert.ok(example,"live data contains seven unreviewed Hwahae aggregates");
const p=product(example);
const identity={product_id:p.id,market:"KR",match_state:"reviewed_exact_product",
  source_kind:"review_capture",source_ref:"synthetic:hwahae:capture:001",
  reviewed_by:"trusted-reviewer:fixture",reviewed_at:date,observed_at:date};
const signal={product_id:p.id,market:"KR",key:"texture",value:"gel",
  source_kind:"review_aggregate",source_ref:"synthetic:review-aggregate:001",
  reviewed_by:"trusted-reviewer:fixture",reviewed_at:date,observed_at:date,
  sample_count:20,review_state:"reviewed"};
const reviewCase=({product:prod=p,identityEvidence=identity,
  preferenceSignals=[signal],conflictSignals=[],time=now}={})=>
  evaluate({product:prod,identityEvidence,preferenceSignals,conflictSignals,now:time});
const accepted=reviewCase();
assert.equal(accepted.tier,TIER.LIMITED_FIT_SHADOW);
assert.equal(accepted.shadow_limited_fit_candidate,true);
assert.equal(accepted.manufacturer_direct_reply_required,false);
assert.equal(accepted.exact_cross_size_formula_match_required_for_limited_fit,false);
assert.deepEqual(accepted.controlled_nonfact_signals,
  [{key:"texture",value:"gel",source_kind:"review_aggregate",
    source_ref:"synthetic:review-aggregate:001",
    qualified_as:"OBSERVATION_NOT_PRODUCT_FACT"}]);
assert.deepEqual(accepted.fact_claims,[]);
assert.equal(accepted.low_ph,"UNKNOWN");
assert.equal(accepted.deep_cleansing,"UNKNOWN");
for(const k of ["actual_recommendation_candidate_admitted","runtime_score_modified",
  "product_fact_created","source_binding_approved","g2_grant_issued",
  "cross_size_fact_reuse_authorized"])assert.equal(accepted[k],false,k);
assert.equal(accepted.production_writes,0);
// Existing raw signals by themselves cannot get a recommendation or Fact tier.
const unreviewed=reviewCase({identityEvidence:null,preferenceSignals:[signal]});
assert.equal(unreviewed.tier,TIER.IDENTITY_ONLY);
const onlyCapture=reviewCase({preferenceSignals:[]});
assert.equal(onlyCapture.tier,TIER.IDENTITY_ONLY);
// Blacklisted fact-like claims and blocked sensitive/safety claims are ignored.
const toxicSignals=[
  {...signal,key:"low_ph",value:"true"},
  {...signal,key:"deep_cleansing",value:"high"},
  {...signal,key:"irritation_safe",value:"true"},
  {...signal,key:"skin_types",value:"sensitive"},
  {...signal,key:"user_reported_skin_type",value:"sensitive",
    source_kind:"reviewed_product_description"}
];
const bad=reviewCase({preferenceSignals:toxicSignals});
assert.equal(bad.tier,TIER.IDENTITY_ONLY);
assert.equal(bad.low_ph,"UNKNOWN");
assert.equal(bad.deep_cleansing,"UNKNOWN");
assert.equal(bad.controlled_nonfact_signals.length,0);
// Even with an otherwise reviewed signal, a product/scope/collision mismatch
// can never move an unrelated or ambiguous cleanser to a limited tier.
for(const s of [
 {...signal,product_id:fixture.rows[1].id},
 {...signal,market:"US"},
 {...signal,source_ref:""},
 {...signal,review_state:"pending"},
 {...signal,reviewed_by:""},
 {...signal,reviewed_at:"2025-01-01T00:00:00Z"},
 {...signal,sample_count:1},
 {...signal,source_kind:"retailer_claim"},
 {...signal,key:"user_reported_skin_type",source_kind:"reviewed_product_description"},
]){
 const x=reviewCase({preferenceSignals:[s]});
 assert.equal(x.tier,TIER.IDENTITY_ONLY,JSON.stringify(s));
}
assert.equal(reviewCase({identityEvidence:{...identity,product_id:fixture.rows[1].id}})
  .tier,TIER.IDENTITY_ONLY);
assert.equal(reviewCase({conflictSignals:["PRODUCT_IDENTITY_COLLISION"]})
  .tier,TIER.REVIEW_HOLD);
assert.equal(reviewCase({conflictSignals:["EXACT_PRODUCT_CAPTURE_MISMATCH"]})
  .tier,TIER.REVIEW_HOLD);
assert.equal(reviewCase({product:{...p,category:"sunscreen"}}).tier,TIER.REVIEW_HOLD);
assert.equal(reviewCase({product:{...p,id:"invalid"}}).tier,TIER.REVIEW_HOLD);
// A retailer description with a verified exact product match may inform
// a texture preference, but never a claim about measured cleansing strength.
const description={...signal,key:"texture",value:"foam",
  source_kind:"reviewed_product_description",sample_count:undefined};
assert.equal(reviewCase({preferenceSignals:[description]}).tier,TIER.LIMITED_FIT_SHADOW);
assert.equal(reviewCase({preferenceSignals:[{...description,key:"user_reported_skin_type",value:"oily"}]})
  .tier,TIER.IDENTITY_ONLY);

const conflicting=reviewCase({preferenceSignals:[signal,{...signal,value:"foam",
  source_ref:"synthetic:review-aggregate:002"}]});
assert.equal(conflicting.tier,TIER.IDENTITY_ONLY);
assert.ok(conflicting.reasons.includes("CONFLICTING_REVIEWED_PREFERENCE_SIGNALS_HELD"));
assert.deepEqual(conflicting.controlled_nonfact_signals,[]);
const differentAxis=reviewCase({preferenceSignals:[signal,
  {...signal,key:"finish",value:"light",source_ref:"synthetic:review-aggregate:003"}]});
assert.equal(differentAxis.tier,TIER.LIMITED_FIT_SHADOW);
assert.equal(differentAxis.controlled_nonfact_signals.length,2);
const run=spawnSync(process.execPath,["scripts/run-cleanser-tiered-policy-existing-ten-v1.mjs"],
  {encoding:"utf8",maxBuffer:1024*1024});
assert.equal(run.status,0,run.stderr);
const full=JSON.parse(run.stdout);
assert.equal(full.total,10);
assert.equal(full.identity_only,10);
assert.equal(full.review_aggregate_recorded,7);
assert.equal(full.unmapped_or_missing_review_aggregate,3);
assert.equal(full.limited_fit_shadow_eligible,0);
assert.equal(full.production_admissions,0);
assert.equal(full.manufacturer_direct_reply_is_mandatory_for_limited_fit,false);
assert.ok(full.products.every(x=>x.low_ph==="UNKNOWN"&&x.deep_cleansing==="UNKNOWN"));
const injected=spawnSync(process.execPath,
  ["scripts/run-cleanser-tiered-policy-existing-ten-v1.mjs","--approve-all"],
  {encoding:"utf8",maxBuffer:1024*1024});
assert.notEqual(injected.status,0);

for(const invalid of [{now:"today"},{preferenceSignals:{}},{conflictSignals:"bad"}]){
 assert.throws(()=>evaluate({product:p,...invalid}),TypeError);
}
console.log("Cleanser graded non-Fact admission shadow: PASS real 10 identity-only "+
  "7 unreviewed Hwahae flags not promoted; synthetic reviewed limited-fit PASS "+
  "unknown facts preserved; G2 grants=0 writes=0");
