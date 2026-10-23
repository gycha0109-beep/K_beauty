#!/usr/bin/env node
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {
 evaluateCleanserReviewAdmissionShadowV1 as evaluate
} from "../lib/trust/cleanser-existing-review-admission-shadow-v1.mjs";
import {
 classifyInitialAdmissionCategory,evaluateInitialAdmissionGrant
} from "./product-evidence/initial-admission-grant-policy-v1.mjs";
import {
  evaluateRecommendationCandidateAdmission,
  RECOMMENDATION_CANDIDATE_ADMISSION_TYPE
} from "../lib/recommendation-candidate-admission-core.mjs";
import {
  noRecommendationAdmissionAuthority
} from "../lib/recommendation-admission-authority-contract.mjs";
const replay=JSON.parse(await readFile(
 "evidence/trust/cleanser-actual-review-score-replay-20261024-v1.json","utf8"));
const footprint=JSON.parse(await readFile(
 "evidence/trust/cleanser-existing-hwahae-signal-footprint-20261024-v1.json","utf8"));
const ids=footprint.records.map(x=>x.product_id);
const run=(changes={})=>evaluate({actualReplay:replay,cohortFootprint:footprint,expectedIds:ids,...changes});
const result=run();
assert.equal(result.product_count,10);
assert.equal(result.profile_count,3);
assert.deepEqual(result.context_classification_totals,{
  NO_CAPTURE_HOLD:9,
  UNMAPPED_REVIEW_HOLD:3,
  POSITIVE_REVIEW_CONTRIBUTION_ONLY:4,
  NEGATIVE_REVIEW_CAUTION_ONLY:9,
  NO_REVIEW_SCORE_CONTRIBUTION:5,
});
assert.equal(result.formal_skin_match_recommendation_count,0);
assert.equal(result.production_admissions,0);
assert.equal(result.g2_grants,0);
assert.equal(result.product_facts_created,0);
assert.equal(result.score_modifications,0);
assert.equal(result.database_writes,0);
assert.equal(classifyInitialAdmissionCategory("cleanser"),
 "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT");
for(const d of result.decisions){
 assert.equal(d.contexts.length,3);
 assert.equal(d.legacy_review_score_reused_as_is,true);
 assert.equal(d.review_score_added_again,false);
 assert.equal(d.recommendation_admitted,false);
 assert.equal(d.product_fact_created,false);
 assert.equal(d.g2_grant_issued,false);
 assert.equal(d.low_ph,"UNKNOWN");
 assert.equal(d.deep_cleansing,"UNKNOWN");
 assert.ok(d.contexts.every(x=>x.can_enter_ranking===false&&
   x.product_fact_claim==="NONE"&&x.is_complete_skin_match_score===false));
}
const drg=result.decisions.find(x=>x.product_id.startsWith("11322a66"));
const zeroid=result.decisions.find(x=>x.product_id.startsWith("fb7ca4ea"));
const laRoche=result.decisions.find(x=>x.product_id.startsWith("63a958c4"));
const mug=result.decisions.find(x=>x.product_id.startsWith("4d5b22c7"));
const lagom=result.decisions.find(x=>x.product_id.startsWith("e3ebe3ff"));
const context=(x,profile)=>x.contexts.find(y=>y.profile===profile);
assert.equal(context(drg,"dry_tight").status,"POSITIVE_REVIEW_CONTRIBUTION_ONLY");
assert.equal(context(drg,"dry_tight").observed_canonical_review_score,4.7);
assert.equal(context(zeroid,"dry_tight").observed_canonical_review_score,0.9);
assert.equal(context(laRoche,"dry_tight").status,"NEGATIVE_REVIEW_CAUTION_ONLY");
assert.equal(context(laRoche,"dry_tight").observed_canonical_review_score,-5.3);
assert.equal(context(drg,"oily_pores").status,"NO_REVIEW_SCORE_CONTRIBUTION");
assert.equal(context(mug,"dry_tight").status,"UNMAPPED_REVIEW_HOLD");
assert.equal(context(lagom,"dry_tight").status,"NO_CAPTURE_HOLD");
// Guard the original protected G2 semantics with a wholly synthetic no-Fact
// input: cleanser never becomes a granted candidate from review score alone.
const g2=evaluateInitialAdmissionGrant({
 product:{id:drg.product_id,category:"cleanser",canonicalProduct:true,identityStatus:"resolved"},
 subject:{},authority:{},currentFacts:[],pda:{}
});
assert.equal(g2.decision,"NO_GRANT");
assert.equal(g2.grant,false);
assert.ok(g2.reasons.includes("INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT"));
// Existing actual admission core continues to reject absent governed authority.
const prod={id:drg.product_id,category:"cleanser"};
const protectedDecision=await evaluateRecommendationCandidateAdmission(prod,{
 reader:async()=>noRecommendationAdmissionAuthority("PRODUCT_FACT_AUTHORITY_NOT_APPROVED")
});
assert.equal(protectedDecision.admissionType,RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED);
assert.equal(protectedDecision.g2,null);
// Adversarial: swapping signals between product IDs or forged nonzero score
// must never make a valid shadow decision.
for(const mutate of [
 x=>{x.actualReplay.products[0].product_id=x.actualReplay.products[1].product_id},
 x=>{x.actualReplay.products[0].score_profiles[0].review_signal_score=11},
 x=>{x.actualReplay.products[0].score_profiles[0].review_signal_score=NaN},
 x=>{x.actualReplay.products[0].score_profiles[0].contributing_tag_count=0},
 x=>{x.actualReplay.products[0].score_profiles[0].profile="unknown"},
 x=>{x.actualReplay.products[0].g2_grants=1},
 x=>{x.actualReplay.products[0].official_product_fact_confirmed=true},
 x=>{x.actualReplay.products[0].full_skin_match_score_recomputed=true},
 x=>{x.actualReplay.products[1].score_profiles=[{profile:"dry_tight",review_signal_score:1,contributing_tag_count:1}]},
 x=>{x.cohortFootprint.records[0].review_scorer_input_status="NO_HWAHAE_REVIEW_CAPTURE"},
 x=>{x.expectedIds.pop()},
]){
 const v={actualReplay:structuredClone(replay),
   cohortFootprint:structuredClone(footprint),expectedIds:[...ids]};
 mutate(v);
 assert.throws(()=>run(v));
}
assert.deepEqual(run({expectedIds:[...ids].reverse()}).context_classification_totals,
 result.context_classification_totals);
const cli=spawnSync(process.execPath,["scripts/run-cleanser-existing-review-admission-shadow-v1.mjs"],{encoding:"utf8",maxBuffer:1024*1024});
assert.equal(cli.status,0,cli.stderr);
const readable=JSON.parse(cli.stdout);
assert.equal(readable.summary.existing_products,10);
assert.equal(readable.summary.skin_contexts,3);
assert.equal(readable.summary.review_signal_input_candidates,6);
assert.equal(readable.summary.actual_new_recommendation_admissions,0);
assert.equal(readable.summary.g2_grants,0);
assert.equal(readable.summary.score_changes,0);
assert.equal(readable.summary.production_writes,0);
assert.equal(readable.product_reviews.length,10);
assert.ok(readable.product_reviews.every(x=>x.by_context.length===3&&
 x.by_context.every(c=>c.actually_recommended===false&&c.added_as_new_score===false)));
const noFlags=spawnSync(process.execPath,
 ["scripts/run-cleanser-existing-review-admission-shadow-v1.mjs","--approve"],
 {encoding:"utf8",maxBuffer:1024*1024});
assert.notEqual(noFlags.status,0);
console.log("R3/R4 cleanser non-Fact admission shadow: PASS real 10x3 profiles, "+
 "positive=4 caution=9 neutral=5 unmapped=3 missing=9, "+
 "strict production G2 cleanser NO_GRANT, zero actual admissions/writes");
