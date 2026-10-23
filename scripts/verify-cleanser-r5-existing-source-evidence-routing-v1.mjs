#!/usr/bin/env node
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assessCleanserExistingEvidenceRoutingV1 as assess}
  from "../lib/trust/cleanser-r5-existing-source-evidence-routing-v1.mjs";
const load=async f=>JSON.parse(await readFile("evidence/trust/"+f,"utf8"));
const [coverage,sourceAxes,replay]=await Promise.all([
load("cleanser-r5-real-input-coverage-20261024-v1.json"),
load("cleanser-r5-existing-source-axis-footprint-20261024-v1.json"),
load("cleanser-actual-review-score-replay-20261024-v1.json")
]);
const make=(x={})=>assess({coverage,sourceAxes,replay,...x});
const r=make();
assert.equal(r.product_count,10);
assert.deepEqual(r.totals,{
  mapped_review_candidates:6,review_unmapped:1,missing_capture:3,
  ingredient_market_aggregate_existing:7,missing_canonical_metadata:10
});
assert.equal(r.requires_new_reviewer_fields,false);
assert.equal(r.existing_score_axis_reused_without_new_score,true);
assert.equal(r.actual_live_full_engine_ranking_verified,false);
assert.equal(r.product_fact_grants,0);
assert.equal(r.g2_grants,0);
assert.equal(r.db_writes,0);
assert.ok(r.decisions.every(x=>x.missing_canonical_fields.length===6&&
 !x.capture_exact_kr_sku_proven&&!x.inferred_skin_types&&
 !x.inferred_irritation_safety&&!x.inferred_texture_finish&&
 !x.product_fact_authorized&&!x.new_recommendation_ranking_authorized&&
 !x.legacy_score_modified&&!x.g2_grant_issued&&x.production_writes===0));
const mung=r.decisions.find(x=>x.product_id.startsWith("4d5b22c7"));
assert.equal(mung.review_status,"REVIEW_TAGS_UNMAPPED_HOLD");
assert.equal(mung.sampled_market_review_count,2);
assert.equal(mung.existing_ingredient_skin_axis_count,3);
assert.equal(mung.supported_recommendation_metadata.skin_types,undefined);
for(const id of ["4f918d80","e3ebe3ff","fa793e6b"]){
 const x=r.decisions.find(x=>x.product_id.startsWith(id));
 assert.equal(x.review_status,"NO_HWAHAE_CAPTURE");
 assert.equal(x.market_and_ingredient_status,"NO_HWAHAE_CAPTURE");
}
const drg=r.decisions.find(x=>x.product_id.startsWith("11322a66"));
assert.equal(drg.review_status,"REUSE_CANONICAL_REVIEW_SCORE_ONLY");
assert.equal(drg.existing_review_score_cells,3);
const tamper=[
 v=>{v.coverage.records[0].recorded_features.skin_types=["sensitive"];},
 v=>{v.coverage.records[0].overall_product_suitability_verified=true;},
 v=>{v.coverage.records[0].g2_eligible=true;},
 v=>{v.sourceAxes.records[0].ingredient_skin_axis_count=-1;},
 v=>{v.sourceAxes.records[0].capture_url_same_string=false;},
 v=>{v.sourceAxes.records[0].exact_kr_sku_independently_verified=true;},
 v=>{v.sourceAxes.records[0].legal_source_usage_reviewed=true;},
 v=>{v.replay.products[0].g2_grants=1;},
 v=>{v.replay.products[0].score_profiles=[];},
 v=>{v.replay.products[0].product_id=v.replay.products[1].product_id;},
 v=>{v.coverage.feature_coverage.texture.present=1;},
 v=>{v.sourceAxes.records[0].mapped_positive_count=-2;},
 v=>{v.coverage.records.pop();},
];
for(const edit of tamper){
 const copy={coverage:structuredClone(coverage),sourceAxes:structuredClone(sourceAxes),
   replay:structuredClone(replay)};
 edit(copy);
 assert.throws(()=>assess(copy),TypeError);
}
console.log("R5 existing Hwahae source triage: PASS captured_ingredient=7 mapped_review=6 low_review=1 missing_capture=3 unknown_traits=10 grants=0 writes=0");
