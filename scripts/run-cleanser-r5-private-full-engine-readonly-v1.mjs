#!/usr/bin/env node
/**
 * OWNER-ONLY opt-in R5 true full-input diagnostic.
 *
 * Exact existing 10 Supabase cleanser records (with original Hwahae summary
 * strings) are used ONLY in private process memory. GET-only PostgREST.
 * Nothing writes to DB or commits review texts, direct URLs or keys.
 * Full Skin Match runs on 164 frozen legacy + ten new rows OFFLINE.
 * No cleanser score/rank published until metadata/rights are reviewed.
 *
 * DO NOT run on public GitHub Actions or expose credentials.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {register} from "node:module";
import {createClient} from "@supabase/supabase-js";
import {createCleanserSelectOnlyFetchV1} from "../lib/trust/cleanser-hosted-select-only-transport-v1.mjs";
import {verifyCleanserEngineComponentSumV1,verifyCleanserReviewAxisParityV1} from "../lib/trust/cleanser-r5-score-reconciliation-v1.mjs";

if(process.argv.length!==2)throw new Error("R5_NO_FLAGS_OR_AUTHORITY_OVERRIDE_ALLOWED");
if(process.env.GITHUB_ACTIONS==="true"||process.env.CI==="true")
  throw new Error("R5_PRIVATE_FULL_SOURCE_RUN_FORBIDDEN_IN_CI");
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("AUTHORIZED_PRIVATE_SERVER_CREDENTIALS_REQUIRED");
register("./node-next-alias-loader.mjs",import.meta.url);
const networkFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw new Error("NON_SELECT_NETWORK_FORBIDDEN")};
const [
  {buildRecommendationProductFromSource},
  {buildSkinMatchDecisionBundle},
  {evaluateCleanserExistingHwahaeScoreShadowV1:inspectReview},
  {classifyInitialAdmissionCategory}
]=await Promise.all([
  import("../lib/product-source.js"),
  import("../lib/skin-match-decision-engine.js"),
  import("../lib/trust/cleanser-hwahae-existing-score-shadow-v1.mjs"),
  import("./product-evidence/initial-admission-grant-policy-v1.mjs")
]);
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const [productsFixture,scenariosFixture,coverage,expectedScores]=await Promise.all([
  read("fixtures/recommendation-metadata/products-v1.json"),
  read("fixtures/recommendation-metadata/user-scenarios-v1.json"),
  read("evidence/trust/cleanser-r5-real-input-coverage-20261024-v1.json"),
  read("evidence/trust/cleanser-actual-review-score-replay-20261024-v1.json")
]);
if(productsFixture.productCount!==164||scenariosFixture.scenarioCount!==12||
  coverage.version!=="cleanser-r5-real-product-input-completeness-v1"||
  coverage.records.length!==10||
  expectedScores.version!=="cleanser-actual-existing-review-score-replay-v1"||
  expectedScores.products.length!==10||
  classifyInitialAdmissionCategory("cleanser")!=="INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT")
  throw new Error("R5_FROZEN_SCOPE_OR_G2_POLICY_DRIFT");
const ids=coverage.records.map(r=>r.product_id);
if(new Set(ids).size!==10)throw new Error("R5_TEN_UNIQUE_PRODUCT_IDS_REQUIRED");
const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},
 global:{fetch:createCleanserSelectOnlyFetchV1({baseUrl:url,fetchImpl:networkFetch})}});
const columns=[
  "id","brand","name","category","product_form","skin_types","concerns",
  "texture","finish","irritation_risk","sensitivity_safe","is_mens","price_min",
  "price_max","recommendation_tier","hwahae_url","review_signals",
  "market_signals","ingredient_signals"
].join(",");
const {data,error}=await sb.from("products").select(columns).in("id",ids).limit(11);
if(error||!Array.isArray(data))throw new Error("R5_PRODUCTS_SELECT_FAILED:"+(error?.code||"UNKNOWN"));
if(data.length!==10||new Set(data.map(p=>p.id)).size!==10||
   data.some(p=>!ids.includes(p.id)))
  throw new Error("R5_EXACT_TEN_READ_ONLY_SCOPE_DRIFT");
const byId=new Map(data.map(p=>[p.id,p]));
const expectedById=new Map(expectedScores.products.map(p=>[p.product_id,p]));
const required=["skin_types","concerns","texture","finish","irritation_risk","sensitivity_safe"];
const raw=coverage.records.map(ref=>{
  const p=byId.get(ref.product_id),prior=expectedById.get(ref.product_id);
  if(!p||!prior||p.brand!==ref.brand||p.name!==ref.product_name||p.category!=="cleanser")
    throw new Error("R5_INPUT_PRODUCT_IDENTITY_DRIFT");
  for(const k of required){
    const v=p[k];
    if(!(v==null||(Array.isArray(v)&&v.length===0)))
      throw new Error("R5_NEW_METADATA_AVAILABLE_REVIEW_SCOPE_FIRST:"+k);
  }
  const rec=inspectReview({product:p});
  if(rec.status!==prior.status||
     JSON.stringify(rec.score_profiles)!==JSON.stringify(prior.score_profiles))
    throw new Error("R5_ACTUAL_CANONICAL_REVIEW_SCORE_DRIFT");
  return p;
});
const legacy=productsFixture.products.map(buildRecommendationProductFromSource);
const newProducts=raw.map(buildRecommendationProductFromSource);
if(legacy.some(x=>!x)||newProducts.some(x=>!x)||new Set([...legacy,...newProducts].map(x=>x.id)).size!==174)
  throw new Error("R5_PRODUCT_MAPPING_NOT_EXACT_174");
const corpus=[...legacy,...newProducts];
const getRows=b=>b?.diagnostics?.candidateSource?.products;
const sameBreakdown=p=>JSON.stringify({
 score:p.score,engine_score:p.engine_score,score_breakdown:p.score_breakdown,decision_meta:p.decision_meta
});
let legacyEqual=0,shadowScoresEvaluated=0,scenariosCompleted=0;
let reviewNonzeroCells=0,ingredientNonzeroCells=0,marketNonzeroCells=0;
for(const item of scenariosFixture.scenarios){
  const opts={locale:"ko",includeCandidateSourceDiagnostics:true};
  const [before,withNew]=await Promise.all([
    buildSkinMatchDecisionBundle(item.answers,{...opts,products:legacy}),
    buildSkinMatchDecisionBundle(item.answers,{...opts,products:corpus})
  ]);
  const oldRows=getRows(before),newRows=getRows(withNew);
  if(oldRows?.length!==164||newRows?.length!==174)
    throw new Error("R5_ENGINE_COHORT_LENGTH_DRIFT");
  const index=new Map(newRows.map(p=>[p.id,p]));
  for(const p of oldRows){
    if(sameBreakdown(p)!==sameBreakdown(index.get(p.id)))
      throw new Error("R5_LEGACY_SCORE_CHANGED");
    legacyEqual++;
  }
  for(const p of newRows.filter(p=>ids.includes(p.id))){
    const b=p.score_breakdown;
    verifyCleanserEngineComponentSumV1(p);
    if(b.reviewSignalScore!==0)reviewNonzeroCells++;
    if(b.ingredientSignalScore!==0)ingredientNonzeroCells++;
    if(b.marketConfidenceScore!==0)marketNonzeroCells++;
    shadowScoresEvaluated++;
  }
  scenariosCompleted++;
}
// Cross-check the live full-engine review axis against independently pinned
// original review-scorer replay for the SAME three skin contexts.
// This detects an altered/doubled/ignored review contribution even when
// a final-score sum looks arithmetically correct.
if(expectedScores.contexts?.length!==3||new Set(expectedScores.contexts.map(x=>x.id)).size!==3)
  throw new Error("R5_FROZEN_SKIN_CONTEXT_DRIFT");
let reviewAxisExactMatches=0,heldReviewAxisZeroMatches=0;
for(const context of expectedScores.contexts){
  const full=await buildSkinMatchDecisionBundle(context.answers,{
    locale:"ko",includeCandidateSourceDiagnostics:true,products:corpus
  });
  const rows=getRows(full);
  if(rows?.length!==174)throw new Error("R5_REVIEW_AXIS_ENGINE_SCOPE_DRIFT");
  const ix=new Map(rows.map(x=>[x.id,x]));
  for(const expected of expectedScores.products){
    const scored=ix.get(expected.product_id);
    if(!scored||!Number.isFinite(scored.score_breakdown?.reviewSignalScore))
      throw new Error("R5_REVIEW_AXIS_MISSING:"+expected.product_id);
    const recorded=expected.score_profiles.find(x=>x.profile===context.id);
    // A missing/unmapped capture is held as a review contribution of zero,
    // not an invented positive or an official efficacy Fact.
    const expectedComponent=recorded?.review_signal_score??0;
    verifyCleanserReviewAxisParityV1(scored,expectedComponent);
    if(recorded)reviewAxisExactMatches++;
    else heldReviewAxisZeroMatches++;
  }
}
assert.equal(reviewAxisExactMatches,18);
assert.equal(heldReviewAxisZeroMatches,12);
assert.equal(legacyEqual,164*12);
assert.equal(shadowScoresEvaluated,10*12);
assert.equal(scenariosCompleted,12);
console.log(JSON.stringify({
  version:"cleanser-r5-private-full-input-readonly-v1",
  verification:"PRIVATE_ACTUAL_SOURCE_SHADOW_ONLY",
  scenarios:scenariosCompleted,existing_product_score_breakdowns_unchanged:legacyEqual,
  appended_cleanser_score_breakdowns_checked:shadowScoresEvaluated,
  with_nonzero_review_component:reviewNonzeroCells,
  with_nonzero_ingredient_component:ingredientNonzeroCells,
  with_nonzero_market_component:marketNonzeroCells,
  actual_review_axis_exact_matches:reviewAxisExactMatches,
  held_review_axis_zero_matches:heldReviewAxisZeroMatches,
  actual_new_product_scores_or_ranks_published:false,
  full_product_suitability_approved:false,
  manufacturer_same_formula_granted:false,
  product_facts_confirmed:0,g2_grants:0,production_writes:0,
  raw_review_labels_exported:false,urls_exported:false,credentials_exported:false
},null,2));
