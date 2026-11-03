/**
 * Exact-ten R5 private-read baseline drift check (NO source text output).
 *
 * Compares only the READ-ONLY source provenance and aggregate shape captured
 * on 2026-10-24. This is NOT a checksum of content, a product SKU attestation,
 * a license review or a Product Fact validation. An unchanged count cannot
 * establish that individual review/ingredient values are unchanged.
 */
export const CLEANSER_R5_SOURCE_DRIFT_GUARD_VERSION =
  "cleanser-r5-private-source-footprint-drift-v1";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FAIL="R5_EXISTING_HWAHAE_SOURCE_FOOTPRINT_DRIFT";
const hasOwn=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const countObjectKeys=value=>{
  if(value==null)return 0;
  if(typeof value!=="object"||Array.isArray(value))throw new TypeError(FAIL);
  return Object.keys(value).length;
};
const countMappedEntries=value=>{
  if(value==null)return 0;
  if(!Array.isArray(value))throw new TypeError(FAIL);
  let count=0;
  for(const item of value){
    if(!item||typeof item!=="object"||Array.isArray(item)||
      (item.mapped!=null&&!Array.isArray(item.mapped)))
      throw new TypeError(FAIL);
    if(item.mapped?.length)count++;
  }
  return count;
};
const parseReviewCount=value=>{
  if(value==null)return null;
  if(typeof value!=="number"&&typeof value!=="string")throw new TypeError(FAIL);
  if(!/^(0|[1-9]\d*)$/.test(String(value)))throw new TypeError(FAIL);
  const number=Number(value);
  if(!Number.isSafeInteger(number))throw new TypeError(FAIL);
  return number;
};
export function verifyCleanserR5PrivateSourceDriftV1({products,footprint}={}){
  if(footprint?.version!=="cleanser-r5-existing-source-axis-footprint-v1"||
    !Array.isArray(footprint.records)||footprint.records.length!==10||
    !Array.isArray(products)||products.length!==10)
    throw new TypeError(FAIL);
  const byId=new Map(products.map(p=>[p?.id,p]));
  const frozenIds=new Set(footprint.records.map(row=>row?.product_id));
  if(byId.size!==10||frozenIds.size!==10||
    [...frozenIds].some(id=>typeof id!=="string"||!UUID.test(id)||!byId.has(id))||
    [...byId.keys()].some(id=>!frozenIds.has(id)))
    throw new TypeError(FAIL);
  let matched=0,captured=0;
  for(const expected of footprint.records){
    const p=byId.get(expected.product_id);
    if(!p||p.category!=="cleanser")throw new TypeError(FAIL);
    const review=p.review_signals, market=p.market_signals, ingredient=p.ingredient_signals;
    const urlMatches=typeof p.hwahae_url==="string"&&p.hwahae_url.length>0&&
      typeof market?.hwahae_review_page==="string"&&
      p.hwahae_url===market.hwahae_review_page;
    const observed={
      product_form_recorded:typeof p.product_form==="string"&&p.product_form.trim().length>0,
      cleansing_profile_recorded:typeof p.cleansing_profile==="string"&&p.cleansing_profile.trim().length>0,
      review_source_is_hwahae:review?.source==="hwahae_ai_review",
      ingredient_source_is_hwahae:ingredient?.source==="hwahae_visible_page",
      market_source_is_hwahae:market?.source==="hwahae_visible_page",
      capture_url_same_string:urlMatches,
      market_total_review_count:parseReviewCount(market?.review_count),
      mapped_positive_count:countMappedEntries(review?.positive),
      mapped_negative_count:countMappedEntries(review?.negative),
      ingredient_skin_axis_count:countObjectKeys(ingredient?.skin_type),
      ingredient_function_axis_count:countObjectKeys(ingredient?.functional_summary),
      ingredient_risk_bucket_count:countObjectKeys(ingredient?.risk)
    };
    for(const [key,value] of Object.entries(observed)){
      if(!hasOwn(expected,key)||expected[key]!==value)
        throw new TypeError(FAIL+":"+expected.product_id+":"+key);
    }
    captured+=Number(urlMatches);
    matched++;
  }
  if(captured!==7)throw new TypeError(FAIL);
  return Object.freeze({
    version:CLEANSER_R5_SOURCE_DRIFT_GUARD_VERSION,
    matched_products:matched,
    matched_capture_urls:captured,
    checked_only: "SOURCE_ORIGIN_AND_AGGREGATE_SHAPE",
    payload_content_unchanged_not_proven:true,
    exact_market_sku_not_proven:true,
    license_review_not_performed:true,
    raw_review_labels_exported:false,
    product_facts_confirmed:0,
    g2_grants:0,
    production_writes:0
  });
}
