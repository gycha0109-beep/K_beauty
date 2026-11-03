/**
 * R5: reuse CURRENT Hwahae aggregated axes but keep missing product traits
 * unknown; do not invent official efficacy/skin-safety facts.
 *
 * Inputs are readonly, redacted SELECT-derived evidence. This triage is NOT
 * a new review approval gate for the canonical legacy scorer or G2.
 */
export const CLEANSER_R5_SOURCE_ROUTING_VERSION =
  "cleanser-r5-existing-source-evidence-routing-v1";
const FIELDS=Object.freeze([
  "skin_types","concerns","texture","finish","irritation_risk","sensitivity_safe"
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const freeze=Object.freeze;
function matchSet(list,idField){
  if(!Array.isArray(list)||list.length!==10)return null;
  const map=new Map(list.map(x=>[x?.[idField],x]));
  return map.size===10&&[...map.keys()].every(x=>typeof x==="string"&&UUID.test(x))?map:null;
}
function integer(value){return Number.isSafeInteger(value)&&value>=0;}
export function assessCleanserExistingEvidenceRoutingV1({coverage,sourceAxes,replay}={}){
  if(coverage?.version!=="cleanser-r5-real-product-input-completeness-v1"||
     sourceAxes?.version!=="cleanser-r5-existing-source-axis-footprint-v1"||
     replay?.version!=="cleanser-actual-existing-review-score-replay-v1"||
     !FIELDS.every(k=>coverage.feature_coverage?.[k]?.present===0&&
       coverage.feature_coverage[k].missing===10)||
     replay.summary?.review_scorer_input_candidates!==6||
     replay.summary?.review_capture_unmapped!==1||
     replay.summary?.review_capture_missing!==3)
     throw new TypeError("SOURCE_PROJECTION_VERSION_OR_COHORT_DRIFT");
  const covers=matchSet(coverage.records,"product_id");
  const sources=matchSet(sourceAxes.records,"product_id");
  const scores=matchSet(replay.products,"product_id");
  if(!covers||!sources||!scores||
    [...covers.keys()].some(id=>!sources.has(id)||!scores.has(id)))
    throw new TypeError("EXACT_TEN_PRODUCT_SCOPE_REQUIRED");
  const decisions=[...covers].sort(([a],[b])=>a.localeCompare(b,"en")).map(([id,c])=>{
    const s=sources.get(id),p=scores.get(id);
    if(c.category!=="cleanser"||c.product_id!==id||s.product_id!==id||p.product_id!==id||
      c.overall_product_suitability_verified!==false||c.g2_eligible!==false||
      p.full_skin_match_score_recomputed!==false||
      p.official_product_fact_confirmed!==false||
      p.g2_grants!==0||p.production_writes!==0||
      s.legal_source_usage_reviewed!==false||
      s.exact_kr_sku_independently_verified!==false||
      !FIELDS.every(k=>c.missing_or_empty_features.includes(k)&&
        (c.recorded_features[k]===null||(Array.isArray(c.recorded_features[k])&&
          c.recorded_features[k].length===0))))
      throw new TypeError("RECORDED_TRAIT_OR_AUTHORITY_CONFLICT:"+id);
    const captured=s.review_source_is_hwahae===true&&
      s.market_source_is_hwahae===true&&
      s.ingredient_source_is_hwahae===true&&
      s.capture_url_same_string===true;
    const axes=[s.ingredient_skin_axis_count,
      s.ingredient_function_axis_count,s.ingredient_risk_bucket_count];
    if(axes.some(x=>!integer(x))||!integer(s.mapped_positive_count)||
      !integer(s.mapped_negative_count)||!integer(s.market_total_review_count??0)||
      !(s.market_total_review_count===null||integer(s.market_total_review_count))||
      (captured&&axes.some(x=>x===0))||
      (!captured&&axes.some(x=>x!==0))||
      (captured&&p.status==="NO_HWAHAE_REVIEW_CAPTURE")||
      (!captured&&p.status!=="NO_HWAHAE_REVIEW_CAPTURE"))
      throw new TypeError("SOURCE_AGGREGATE_OR_CAPTURE_CONFLICT:"+id);
    const ready=p.status==="REVIEW_SCORE_INPUT_CANDIDATE";
    if(ready&&(s.mapped_positive_count+s.mapped_negative_count===0||
       p.score_profiles.length!==3))
      throw new TypeError("MAPPED_REVIEW_EXPECTED:"+id);
    if(!ready&&p.score_profiles.length)
      throw new TypeError("REVIEW_SCORE_FOR_HELD_PRODUCT:"+id);
    const reviewStatus=ready?"REUSE_CANONICAL_REVIEW_SCORE_ONLY":
      captured?"REVIEW_TAGS_UNMAPPED_HOLD":"NO_HWAHAE_CAPTURE";
    const summaryStatus=captured?"REUSE_EXISTING_INGREDIENT_MARKET_AGGREGATES_ONLY":
      "NO_HWAHAE_CAPTURE";
    const nextAction=ready?"VALIDATE_PRODUCT_SCOPE_AND_METADATA_WITH_EXISTING_PIPELINE":
      captured?"REVIEW_LOW_SAMPLE_UNMAPPED_SIGNAL_WITH_EXISTING_FIXTURE":
        "REVIEW_EXISTING_CAPTURE_MAPPING_AND_ALLOWED_SOURCE";
    return freeze({
      product_id:id,
      product_name:p.product_name,
      review_status:reviewStatus,
      market_and_ingredient_status:summaryStatus,
      captured_source_url_strings_equal:captured,
      capture_exact_kr_sku_proven:false,
      sampled_market_review_count:s.market_total_review_count,
      existing_review_score_cells:p.score_profiles.length,
      existing_ingredient_skin_axis_count:s.ingredient_skin_axis_count,
      existing_ingredient_function_axis_count:s.ingredient_function_axis_count,
      existing_ingredient_risk_bucket_count:s.ingredient_risk_bucket_count,
      supported_recommendation_metadata:freeze({}),
      missing_canonical_fields:FIELDS,
      // Aggregates are permitted for existing review/ingredient score input,
      // NOT for writing new authoritative product skin-type/safety/texture.
      inferred_skin_types:false,
      inferred_irritation_safety:false,
      inferred_texture_finish:false,
      manufacturer_reply_mandatory_for_nonfact_score:false,
      product_fact_authorized:false,
      legacy_score_modified:false,
      new_recommendation_ranking_authorized:false,
      g2_grant_issued:false,
      production_writes:0,
      next_action:nextAction,
    });
  });
  const counts={
    mapped_review_candidates:decisions.filter(x=>x.review_status==="REUSE_CANONICAL_REVIEW_SCORE_ONLY").length,
    review_unmapped:decisions.filter(x=>x.review_status==="REVIEW_TAGS_UNMAPPED_HOLD").length,
    missing_capture:decisions.filter(x=>x.review_status==="NO_HWAHAE_CAPTURE").length,
    ingredient_market_aggregate_existing:decisions.filter(x=>x.market_and_ingredient_status==="REUSE_EXISTING_INGREDIENT_MARKET_AGGREGATES_ONLY").length,
    missing_canonical_metadata:decisions.filter(x=>x.missing_canonical_fields.length===6).length,
  };
  if(counts.mapped_review_candidates!==6||counts.review_unmapped!==1||
     counts.missing_capture!==3||counts.ingredient_market_aggregate_existing!==7||
     counts.missing_canonical_metadata!==10)
     throw new TypeError("SOURCE_COHORT_COUNTS_DRIFT");
  return freeze({
    version:CLEANSER_R5_SOURCE_ROUTING_VERSION,
    product_count:10,
    totals:freeze(counts),
    requires_new_reviewer_fields:false,
    existing_score_axis_reused_without_new_score:true,
    actual_live_full_engine_ranking_verified:false,
    product_fact_grants:0,g2_grants:0,db_writes:0,
    decisions:freeze(decisions)
  });
}
