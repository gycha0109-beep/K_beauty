/**
 * Shadow-only bridge from the EXISTING Hwahae review_signals JSON to the
 * EXISTING Skin Match review scoring function. No parallel review contract.
 *
 * "Score input ready" != protected admission, proven formula or validated
 * product-level capture; full G2 and operational review remain separate.
 */
import {normalizeReviewSignals,computeReviewSignalScore} from "../review-signals.js";

export const CLEANSER_HWAHAE_REUSE_SHADOW_VERSION="cleanser-hwahae-existing-score-shadow-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const profiles=Object.freeze([
  {id:"dry_tight",answers:{skinType:"dry",mainConcern:"dehydration",mainConcerns:["barrier"],postWashFeeling:"tight",sensitivity:"medium"}},
  {id:"oily_pores",answers:{skinType:"oily",mainConcern:"oiliness",mainConcerns:["pores"],sensitivity:"low"}},
  {id:"sensitive_redness",answers:{skinType:"combination",mainConcern:"redness",mainConcerns:["barrier"],sensitivity:"high"}}
]);
function normalizedHwahaeLink(url){
  if(typeof url!=="string")return null;
  try{
    const parsed=new URL(url);
    if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.hash||![
      "hwahae.co.kr","www.hwahae.co.kr","m.hwahae.co.kr","hwahae.com","www.hwahae.com"
    ].includes(parsed.hostname))return null;
    return parsed.href;
  }catch{return null;}
}
function validProduct(p){
  return UUID.test(String(p?.id||""))&&p?.category==="cleanser"&&
    typeof p?.brand==="string"&&p.brand.trim()&&
    typeof p?.name==="string"&&p.name.trim();
}
const scoredProfileOutput=(reviewSignals,product)=>
  profiles.map(x=>{
    const score=computeReviewSignalScore(reviewSignals,x.answers,product);
    if(!Number.isFinite(score.total)||Math.abs(score.total)>10)
      throw new Error("LEGACY_REVIEW_SCORE_OUT_OF_BOUNDS");
    return Object.freeze({profile:x.id,review_signal_score:score.total,
      contributing_tag_count:score.details.length});
  });
export function evaluateCleanserExistingHwahaeScoreShadowV1({product}={}){
  if(!product||typeof product!=="object"||Array.isArray(product))
    throw new TypeError("PRODUCT_OBJECT_REQUIRED");
  const valid=Boolean(validProduct(product));
  const page=normalizedHwahaeLink(product.hwahae_url);
  const captured=normalizedHwahaeLink(product.market_signals?.hwahae_review_page);
  const hasReview=product.review_signals?.source==="hwahae_ai_review";
  const hasMarket=product.market_signals?.source==="hwahae_visible_page";
  const hasIngredient=product.ingredient_signals?.source==="hwahae_visible_page";
  const sourceMismatch=Boolean(page&&captured&&page!==captured);
  const normalized=valid&&hasReview?
    normalizeReviewSignals(product.review_signals,{
      category:product.category,product_form:product.product_form
    }):null;
  const positive=normalized?.positive||[];
  const negative=normalized?.negative||[];
  const topThreeMapped=(positive.slice(0,3).filter(x=>x.mapped.length>0).length+
    negative.slice(0,3).filter(x=>x.mapped.length>0).length);
  let status;
  if(!valid)status="INVALID_CATALOG_IDENTITY";
  else if(sourceMismatch)status="CAPTURE_URL_MISMATCH_HOLD";
  else if(!page||!captured||!hasReview||!hasMarket)
    status="NO_HWAHAE_REVIEW_CAPTURE";
  else if(!normalized||!topThreeMapped)
    status="NO_TOP_THREE_MAPPED_REVIEW_TAGS";
  else status="REVIEW_SCORE_INPUT_CANDIDATE";
  const scoreProfiles=status==="REVIEW_SCORE_INPUT_CANDIDATE"?
    scoredProfileOutput(product.review_signals,product):[];
  return Object.freeze({
    version:CLEANSER_HWAHAE_REUSE_SHADOW_VERSION,
    product_id:valid?product.id:null,
    status,
    review_summary_entry_count:positive.length+negative.length,
    top_three_mapped_entries:topThreeMapped,
    review_signal_date:typeof product.review_signals?.updated_at==="string"?
      product.review_signals.updated_at:null,
    market_review_count:hasMarket&&Number.isSafeInteger(Number(product.market_signals?.review_count))?
      Number(product.market_signals.review_count):null,
    ingredient_signal_recorded:hasIngredient,
    capture_url_string_match:Boolean(page&&captured&&page===captured),
    independently_verified_exact_sku:false,
    score_profiles:Object.freeze(scoreProfiles),
    score_type:"LEGACY_REVIEW_SIGNAL_ONLY_NOT_COMPLETE_SKIN_MATCH",
    legacy_market_or_ingredient_weights_recomputed:false,
    official_product_fact_proven:false,
    manufacturer_reply_required_for_nonfact_score:false,
    low_ph:"UNKNOWN",deep_cleansing:"UNKNOWN",
    actual_recommendation_candidate_admitted:false,
    g2_grant_issued:false,production_writes:0
  });
}
