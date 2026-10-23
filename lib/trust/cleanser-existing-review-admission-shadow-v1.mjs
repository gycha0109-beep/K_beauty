/**
 * R3/R4: Evidence-aware review *contribution* classification only.
 *
 * Uses numeric output from the existing canonical review scorer. This module
 * never adds a new score, proves formula/pH/cleansing Fact, grants G2 access,
 * or decides a finished recommendation ranking.
 */
import {
  CATEGORY_CLASSIFICATION,
  classifyInitialAdmissionCategory,
} from "../../scripts/product-evidence/initial-admission-grant-policy-v1.mjs";

export const CLEANSER_REVIEW_ADMISSION_SHADOW_VERSION =
  "cleanser-existing-review-admission-shadow-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STATES=Object.freeze({
  NO_CAPTURE:"NO_CAPTURE_HOLD",
  UNMAPPED:"UNMAPPED_REVIEW_HOLD",
  POSITIVE:"POSITIVE_REVIEW_CONTRIBUTION_ONLY",
  NEGATIVE:"NEGATIVE_REVIEW_CAUTION_ONLY",
  NEUTRAL:"NO_REVIEW_SCORE_CONTRIBUTION",
});
const REQUIRED_PROFILE_IDS=Object.freeze(["dry_tight","oily_pores","sensitive_redness"]);
const SENTINEL="INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT";
const RAW_STATUSES=new Set([
  "REVIEW_SCORE_INPUT_CANDIDATE",
  "NO_TOP_THREE_MAPPED_REVIEW_TAGS",
  "NO_HWAHAE_REVIEW_CAPTURE",
]);
const freeze=Object.freeze;
function exactRecord(row){
  return row&&typeof row==="object"&&!Array.isArray(row)&&UUID.test(row.product_id)&&
    typeof row.product_name==="string"&&row.product_name.trim().length>0&&
    RAW_STATUSES.has(row.status)&&Number.isSafeInteger(row.top_three_mapped_entries)&&
    row.top_three_mapped_entries>=0&&
    row.full_skin_match_score_recomputed===false&&
    row.official_product_fact_confirmed===false&&row.g2_grants===0&&
    row.production_writes===0&&Array.isArray(row.score_profiles);
}
function classifyProfile(p){
  if(!Number.isFinite(p.review_signal_score)||
    Math.abs(p.review_signal_score)>10||
    !Number.isSafeInteger(p.contributing_tag_count)||
    p.contributing_tag_count<0||
    (p.review_signal_score!==0&&p.contributing_tag_count===0))
    throw new TypeError("CANONICAL_REVIEW_SCORE_INVALID");
  return p.review_signal_score>0?STATES.POSITIVE:
    p.review_signal_score<0?STATES.NEGATIVE:STATES.NEUTRAL;
}
export function evaluateCleanserReviewAdmissionShadowV1({
  actualReplay,cohortFootprint,expectedIds,
}={}){
  if(!actualReplay||actualReplay.version!=="cleanser-actual-existing-review-score-replay-v1"||
    actualReplay.score_component!=="review_signal_score_ONLY_not_total_recommendation_score"||
    !Array.isArray(actualReplay.products)||actualReplay.products.length!==10||
    actualReplay.summary?.actual_product_rows!==10||
    actualReplay.summary?.review_scorer_input_candidates!==6||
    actualReplay.summary?.review_capture_unmapped!==1||
    actualReplay.summary?.review_capture_missing!==3||
    actualReplay.summary?.admission_grants!==0||
    actualReplay.summary?.writes!==0||
    !cohortFootprint||
    cohortFootprint.version!=="cleanser-existing-hwahae-signal-footprint-v1"||
    !Array.isArray(cohortFootprint.records)||cohortFootprint.records.length!==10||
    !Array.isArray(expectedIds)||expectedIds.length!==10||
    new Set(expectedIds).size!==10||
    expectedIds.some(id=>!UUID.test(id))||
    CATEGORY_CLASSIFICATION.cleanser!==SENTINEL||
    classifyInitialAdmissionCategory("cleanser")!==SENTINEL)
      throw new TypeError("SHADOW_INPUT_OR_G2_PROTECTION_DRIFT");
  const expected=new Set(expectedIds);
  const actual=new Map(actualReplay.products.map(x=>[x.product_id,x]));
  const footprint=new Map(cohortFootprint.records.map(x=>[x.product_id,x]));
  if(actual.size!==10||footprint.size!==10||
    [...actual.keys()].some(id=>!expected.has(id))||
    [...footprint.keys()].some(id=>!expected.has(id)))
    throw new TypeError("EXACT_EXISTING_TEN_PRODUCT_IDS_REQUIRED");
  const decisions=expectedIds.map(id=>{
    const row=actual.get(id),saved=footprint.get(id);
    if(!exactRecord(row)||!saved||
      saved.product_id!==id||
      row.status!==saved.review_scorer_input_status||
      saved.production_recommendation_admitted!==false||
      saved.official_product_fact_confirmed!==false)
      throw new TypeError("SOURCE_SIGNAL_SCOPE_MISMATCH:"+id);
    const ready=row.status==="REVIEW_SCORE_INPUT_CANDIDATE";
    if(ready&&(row.top_three_mapped_entries<1||row.score_profiles.length!==3))
      throw new TypeError("SCORE_READINESS_INCOMPLETE:"+id);
    if(!ready&&(row.score_profiles.length!==0||
       row.top_three_mapped_entries!==0))
      throw new TypeError("HELD_PRODUCT_WITH_SCORE:"+id);
    const profileIds=new Set(row.score_profiles.map(x=>x.profile));
    if(ready&&(profileIds.size!==3||
      REQUIRED_PROFILE_IDS.some(p=>!profileIds.has(p))))
      throw new TypeError("UNEXPECTED_REVIEW_PROFILE_SET:"+id);
    const contexts=ready?
      row.score_profiles.map(p=>freeze({
        profile:p.profile,
        status:classifyProfile(p),
        observed_canonical_review_score:p.review_signal_score,
        contributing_tag_count:p.contributing_tag_count,
        product_fact_claim:"NONE",
        is_complete_skin_match_score:false,
        can_enter_ranking:false,
      })).sort((a,b)=>REQUIRED_PROFILE_IDS.indexOf(a.profile)-
        REQUIRED_PROFILE_IDS.indexOf(b.profile)):
      REQUIRED_PROFILE_IDS.map(profile=>freeze({
        profile,status:row.status==="NO_HWAHAE_REVIEW_CAPTURE"?STATES.NO_CAPTURE:STATES.UNMAPPED,
        observed_canonical_review_score:null,contributing_tag_count:0,
        product_fact_claim:"NONE",is_complete_skin_match_score:false,
        can_enter_ranking:false,
      }));
    return freeze({
      product_id:id,
      product_name:row.product_name,
      input_status:row.status,
      g2_category_policy:SENTINEL,
      source_identity_conflict_independently_cleared:false,
      manufacturer_formula_confirmation_required_for_nonfact_score:false,
      low_ph:"UNKNOWN",deep_cleansing:"UNKNOWN",
      contexts:freeze(contexts),
      legacy_review_score_reused_as_is:true,
      review_score_added_again:false,
      product_fact_created:false,
      functional_claims_authorized:false,
      g2_grant_issued:false,
      recommendation_admitted:false,
      database_writes:0,
    });
  });
  const counts={};
  for(const label of Object.values(STATES))counts[label]=
    decisions.reduce((n,d)=>n+d.contexts.filter(p=>p.status===label).length,0);
  if(Object.values(counts).reduce((a,b)=>a+b,0)!==30)
    throw new Error("TEN_TIMES_THREE_CONTEXTS_REQUIRED");
  return freeze({
    version:CLEANSER_REVIEW_ADMISSION_SHADOW_VERSION,
    product_count:10,
    profile_count:3,
    context_classification_totals:freeze(counts),
    candidate_review_signal_inputs:6,
    formal_skin_match_recommendation_count:0,
    production_admissions:0,
    g2_grants:0,
    product_facts_created:0,
    score_modifications:0,
    database_writes:0,
    decisions:freeze(decisions),
  });
}
