#!/usr/bin/env node
import assert from "node:assert/strict";
import {projectCleanserTrustReviewHandoffV1 as handoff} from "../lib/trust/cleanser-trust-review-handoff-v1.mjs";
const P="11111111-1111-4111-8111-111111111111";
const S="22222222-2222-4222-8222-222222222222";
const SOURCE="33333333-3333-4333-8333-333333333333";
const LINK="44444444-4444-4444-8444-444444444444";
const BY="55555555-5555-4555-8555-555555555555";
const BINDING="66666666-6666-4666-8666-666666666666";
const URL="https://manufacturer.example/cleanser?sku=150ml";
const fixture=()=>({
  product:{id:P,category:"cleanser"},
  intakes:[{id:"77777777-7777-4777-8777-777777777777",product_id:P,subject_id:S,market:"KR",
    identity_state:"EXACT_SUBJECT_FOUND"}],
  research_tasks:["deep_cleansing","low_ph"].map((fact_key,i)=>({
    id:i===0?"88888888-8888-4888-8888-888888888888":"99999999-9999-4999-8999-999999999999",
    product_id:P,subject_id:S,fact_key,state:"REVIEW_REQUIRED",blocker_code:null
  })),
  subjects:[{subject_id:S,product_id:P,identity_status:"resolved",current_state:"current",
    market_applicability:"KR",formulation_revision_key:"reviewed-r1"}],
  official_source_bindings:[{binding_id:BINDING,product_id:P,binding_state:"resolved",
    product_scope_state:"product",source_name:"manufacturer_official",source_url:URL}],
  source_subject_bindings:[{binding_id:LINK,source_id:SOURCE,product_id:P,subject_id:S,
    binding_state:"exact_subject_match",scope_relation:"equivalent",reviewed_by:BY,
    reviewed_at:"2026-10-22T00:00:00Z",
    presentation_metadata:{exact_sku_reviewed:true,verified_sku:"sku-150",
      verified_presentation_key:"reviewed-presentation-150",verified_market:"KR",exact_source_locator:URL}}],
  evidence_sources:[{source_id:SOURCE,source_kind:"official_product_page",
    canonical_locator:URL,market:"KR",content_digest:"a".repeat(64),
    external_snapshot_reference:"frozen:research/manufacturer150"}]
});
const good=handoff(fixture());
assert.equal(good.decision,"REVIEW_PACKET_READY");
assert.equal(good.existing_task_ids.length,2);
assert.equal(good.verified_source_subject_binding_id,LINK);
assert.equal(good.intake_created,0);
assert.equal(good.research_tasks_created,0);
assert.equal(good.facts_confirmed,0);
assert.equal(good.source_bindings_approved,0);
assert.equal(good.review_approval_granted,false);
assert.equal(good.recommendation_admission_granted,false);
assert.equal(good.current_fact_confirmation,"NOT_PERFORMED");
// Legacy 10 cleanser rows (existing intake/tasks, no governed Subject/Offer) stay on hold.
const liveShape=fixture();
liveShape.intakes[0].subject_id=null;
liveShape.intakes[0].identity_state="SUBJECT_CREATION_REQUIRED";
liveShape.intakes[0].market="KR";
liveShape.research_tasks.forEach(x=>{x.subject_id=null;x.blocker_code="SUBJECT_CREATION_REQUIRED"});
liveShape.subjects=[];
liveShape.official_source_bindings=[];
liveShape.source_subject_bindings=[];
liveShape.evidence_sources=[];
const hold=handoff(liveShape);
assert.equal(hold.decision,"REVIEW_REQUIRED");
assert.equal(hold.current_subject_id,null);
assert.deepEqual(hold.existing_task_fact_keys,["deep_cleansing","low_ph"]);
assert.equal(hold.production_writes,0);
assert.equal(hold.intake_created,0);
assert.equal(hold.research_tasks_created,0);
assert.ok(hold.reasons.includes("ONE_REVIEWED_CURRENT_KR_SUBJECT_REQUIRED"));
assert.ok(hold.reasons.includes("REVIEWED_EXACT_SOURCE_SUBJECT_SKU_LINK_REQUIRED"));
for(const mutate of [
  x=>{x.intakes[0].identity_state="SUBJECT_CREATION_REQUIRED"},
  x=>{x.intakes[0].subject_id=null},
  x=>{x.research_tasks[1].subject_id=null},
  x=>{x.research_tasks[0].fact_key="spf_value"},
  x=>{x.research_tasks=[x.research_tasks[0]]},
  x=>{x.subjects[0].current_state="historical"},
  x=>{x.subjects[0].formulation_revision_key=null},
  x=>{x.official_source_bindings[0].source_url=URL+"&other=1"},
  x=>{x.official_source_bindings[0].source_name="retailer"},
  x=>{x.evidence_sources[0].content_digest=null},
  x=>{x.evidence_sources[0].external_snapshot_reference=null},
  x=>{x.source_subject_bindings[0].scope_relation="narrower"},
  x=>{x.source_subject_bindings[0].reviewed_by=null},
  x=>{x.source_subject_bindings[0].presentation_metadata={verified_sku:"sku-150"}},
  x=>{x.source_subject_bindings[0].presentation_metadata.verified_market="US"},
  x=>{x.source_subject_bindings[0].presentation_metadata.exact_source_locator=URL+"&wrong=1"}
]){
 const x=fixture();mutate(x);const y=handoff(x);
 assert.equal(y.decision,"REVIEW_REQUIRED",JSON.stringify(y));
 assert.equal(y.facts_confirmed,0);
 assert.equal(y.recommendation_admission_granted,false);
}
for(const mutate of [
 x=>{x.research_tasks[0].product_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
 x=>{x.source_subject_bindings[0].product_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
 x=>{x.intakes=[null]}
]){
 const x=fixture();mutate(x);assert.throws(()=>handoff(x),TypeError);
}
assert.deepEqual(handoff(fixture()),good);
console.log("R3/C3 existing cleanser TRUST review handoff: PASS (no writes/no G2)");
