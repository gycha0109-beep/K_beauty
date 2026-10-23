#!/usr/bin/env node
/**
 * R5 OFFLINE DIAGNOSTIC ONLY — actual Skin Match engine on existing 164 fixtures
 * plus 10 real-product identity/metadata snapshots whose original review text
 * is deliberately REDACTED. NOT a valid score, ranking, or admission for them.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {register} from "node:module";
register("./node-next-alias-loader.mjs",import.meta.url);
globalThis.fetch=async()=>{throw new Error("R5_PUBLIC_CI_NETWORK_FORBIDDEN")};
const [{buildRecommendationProductFromSource},{buildSkinMatchDecisionBundle},
 {classifyInitialAdmissionCategory}]=await Promise.all([
  import("../lib/product-source.js"),
  import("../lib/skin-match-decision-engine.js"),
  import("./product-evidence/initial-admission-grant-policy-v1.mjs")
 ]);
const read=async path=>JSON.parse(await readFile(path,"utf8"));
const [baseData,scenariosData,coverage,reviewReplay]=await Promise.all([
 read("fixtures/recommendation-metadata/products-v1.json"),
 read("fixtures/recommendation-metadata/user-scenarios-v1.json"),
 read("evidence/trust/cleanser-r5-real-input-coverage-20261024-v1.json"),
 read("evidence/trust/cleanser-actual-review-score-replay-20261024-v1.json")
]);
assert.equal(baseData.productCount,164);
assert.equal(scenariosData.scenarioCount,12);
assert.equal(coverage.version,"cleanser-r5-real-product-input-completeness-v1");
assert.equal(coverage.records.length,10);
assert.equal(reviewReplay.products.length,10);
assert.equal(classifyInitialAdmissionCategory("cleanser"),
 "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT");
const required=["skin_types","concerns","texture","finish","irritation_risk","sensitivity_safe"];
assert.ok(required.every(k=>
  coverage.feature_coverage[k]?.present===0&&
  coverage.feature_coverage[k]?.missing===10));
const corpus=baseData.products.map(buildRecommendationProductFromSource);
assert.ok(corpus.every(Boolean));
const originalIds=new Set(corpus.map(p=>p.id));
assert.equal(originalIds.size,164);
const cohort=new Set(coverage.records.map(p=>p.product_id));
assert.equal(cohort.size,10);
assert.ok([...cohort].every(id=>!originalIds.has(id)));
const incomplete=coverage.records.map(row=>{
 assert.deepEqual([...row.missing_or_empty_features].sort(),[...required].sort());
 assert.equal(row.overall_product_suitability_verified,false);
 assert.equal(row.g2_eligible,false);
 const raw={
  id:row.product_id,brand:row.brand,name:row.product_name,
  category:row.category,product_form:row.product_form,
  ...row.recorded_features,
  price_min:row.price_min,price_max:row.price_max,
  is_mens:row.is_mens,recommendation_tier:row.recommendation_tier,
  // Intentionally absent. Original AI-review label text and source pages
  // must never be committed in public repository fixtures.
  review_signals:null,ingredient_signals:null,market_signals:null
 };
 const normalized=buildRecommendationProductFromSource(raw);
 assert.ok(normalized&&normalized.category==="cleanser");
 assert.equal(normalized.id,row.product_id);
 assert.equal(normalized.review_signals,null);
 assert.equal(normalized.market_signals,null);
 assert.equal(normalized.ingredient_signals,null);
 // The original builder fills non-null fallbacks for missing critical metadata.
 assert.deepEqual(normalized.skin_types,["combination"]);
 assert.deepEqual(normalized.concerns,["dehydration"]);
 return normalized;
});
assert.ok(incomplete.every(Boolean));
const testProducts=[...corpus,...incomplete];
const fromDiagnostics=x=>x?.diagnostics?.candidateSource?.products||null;
const canonicalProjection=row=>JSON.stringify({
 engine_score:row.engine_score,score:row.score,
 score_breakdown:row.score_breakdown,decision_meta:row.decision_meta
});
const diffs=[],missingScores=[];
let verifiedScenarios=0,shadowProductComparisons=0,rankChangedScenarioCount=0;
for(const scenario of scenariosData.scenarios){
 const opts={locale:"ko",includeCandidateSourceDiagnostics:true};
 const [before,after]=await Promise.all([
  buildSkinMatchDecisionBundle(scenario.answers,{...opts,products:corpus}),
  buildSkinMatchDecisionBundle(scenario.answers,{...opts,products:testProducts})
 ]);
 const old=fromDiagnostics(before),expanded=fromDiagnostics(after);
 assert.equal(old?.length,164,scenario.id+": legacy corpus");
 assert.equal(expanded?.length,174,scenario.id+": sandbox-only candidate set");
 const byId=new Map(expanded.map(x=>[x.id,x]));
 assert.equal(byId.size,174);
 for(const p of old){
  const afterP=byId.get(p.id);
  if(!afterP||canonicalProjection(afterP)!==canonicalProjection(p))
   diffs.push({scenario:scenario.id,id:p.id});
 }
 const newRows=expanded.filter(x=>cohort.has(x.id));
 assert.equal(newRows.length,10);
 for(const x of newRows){
  const b=x.score_breakdown;
  assert.ok(b&&Number.isFinite(x.engine_score));
  assert.equal(b.engine_score,x.engine_score);
  assert.equal(b.reviewSignalScore,0);
  // The scorer executed, but missing data made the result ineligible for
  // release: never report x.engine_score as a real cleanser ranking.
  missingScores.push({scenario:scenario.id,id:x.id});
 }
 if(before.topPick?.id!==after.topPick?.id)rankChangedScenarioCount++;
 verifiedScenarios++;
 shadowProductComparisons+=newRows.length;
}
assert.deepEqual(diffs,[],"original 164 score breakdowns must remain identical");
assert.equal(verifiedScenarios,12);
assert.equal(shadowProductComparisons,120);
assert.equal(missingScores.length,120);
const nonzeroReviewCells=reviewReplay.products.flatMap(p=>p.score_profiles)
 .filter(p=>p.review_signal_score!==0).length;
assert.equal(nonzeroReviewCells,13);
const out={
 version:"cleanser-r5-full-engine-redacted-diagnostic-v1",
 scenario_count:verifiedScenarios,
 existing_legacy_products:corpus.length,
 appended_shadow_products:incomplete.length,
 full_engine_invocations:verifiedScenarios*2,
 new_shadow_product_scenario_scored:shadowProductComparisons,
 unchanged_legacy_score_breakdowns:diffs.length===0,
 redacted_review_nonzero_baseline_cells_missing:nonzeroReviewCells,
 all_new_products_missing_required_metadata:true,
 masked_review_input:true,
 new_product_engine_scores_publishable:false,
 new_product_ranks_publishable:false,
 ranking_changes_caused_by_unapproved_shadow_candidates:rankChangedScenarioCount,
 has_production_admission:false,has_g2_grant:false,
 existing_scoring_modified:false,db_writes:0
};
console.log("R5 real cleanser metadata / full engine sandbox: PASS "+JSON.stringify(out));
