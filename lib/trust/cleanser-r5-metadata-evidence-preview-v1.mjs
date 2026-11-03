/**
 * R5 read-only metadata evidence preview for the ten existing cleansers.
 * Catalog names and existing Hwahae review signals are observation sources,
 * not canonical suitability traits, Product Facts or G2 admission authority.
 * No review labels, URLs, formulas or credentials are emitted.
 */
export const CLEANSER_R5_METADATA_PREVIEW_VERSION="cleanser-r5-metadata-evidence-preview-v1";
const FIELDS=Object.freeze(["skin_types","concerns","texture","finish","irritation_risk","sensitivity_safe"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FALLBACKS=Object.freeze({
  skin_types:["combination"],concerns:["dehydration"],texture:"watery",
  finish:"natural",irritation_risk:"medium",sensitivity_safe:false
});
const CONCERN_TAGS=new Set(["dehydration","barrier","oiliness","acne_safe","redness","acne"]);
const TEXTURE_TAGS=new Set(["lightweight","sticky","texture_mismatch","rich_texture","watery_texture","viscous_texture","texture_issue","non_heavy"]);
const FINISH_TAGS=new Set(["fresh","non_sticky","non_slippery","sticky","oily_finish","heavy_finish"]);
const CAUTION_TAGS=new Set(["sensitivity_risk","irritation_risk","acne_risk","drying"]);
const fail=reason=>{throw new TypeError("R5_METADATA_EVIDENCE_PREVIEW_INVALID:"+reason)};
const missing=value=>value==null||(Array.isArray(value)&&value.length===0);
const tagsFrom=entries=>{
  if(!Array.isArray(entries))fail("REVIEW_ITEMS_NOT_ARRAY");
  const tags=new Set();
  // Keep the existing review scorer's top-three interpretation; no new
  // review weight, sample count or reviewer authority is introduced.
  for(const entry of entries.slice(0,3)){
    if(!entry||typeof entry!=="object"||!Array.isArray(entry.mapped))
      fail("REVIEW_TAG_MAP_INVALID");
    for(const tag of entry.mapped){
      if(typeof tag!=="string")fail("REVIEW_TAG_NOT_STRING");
      tags.add(tag);
    }
  }
  return tags;
};
const includes=(tags,allow)=>[...tags].some(tag=>allow.has(tag));
const parseCount=value=>{
  if(value==null)return null;
  if(!/^(0|[1-9]\\d*)$/.test(String(value)))fail("MARKET_REVIEW_COUNT_INVALID");
  const count=Number(value);
  if(!Number.isSafeInteger(count))fail("MARKET_REVIEW_COUNT_OVERFLOW");
  return count;
};
const observation=(status,source)=>Object.freeze({
  status,source,canonical_value:null,write_authorized:false,product_fact_authorized:false
});
export function assessCleanserR5MetadataEvidencePreviewV1({rawProducts,normalizedProducts}={}){
  if(!Array.isArray(rawProducts)||rawProducts.length!==10||
     !Array.isArray(normalizedProducts)||normalizedProducts.length!==10)
    fail("EXACT_TEN_REQUIRED");
  const ids=new Set(rawProducts.map(p=>p?.id));
  const mapped=new Map(normalizedProducts.map(p=>[p?.id,p]));
  if(ids.size!==10||mapped.size!==10||
    [...ids].some(id=>typeof id!=="string"||!UUID.test(id)||!mapped.has(id)))
    fail("COHORT_ID_MISMATCH");
  const statusCounts=Object.fromEntries(FIELDS.map(f=>[f,{
    UNKNOWN:0,REVIEW_TENDENCY_ONLY:0,NAME_FORM_HINT_ONLY:0,
    NEGATIVE_REVIEW_CAUTION_ONLY:0
  }]));
  let capturedCount=0,mappedReviewCount=0,lowReviewCautions=0;
  const products=rawProducts.map(raw=>{
    const normalized=mapped.get(raw.id);
    if(raw.category!=="cleanser"||normalized?.category!=="cleanser")
      fail("CATEGORY_MISMATCH");
    for(const field of FIELDS){
      if(!Object.hasOwn(raw,field)||!missing(raw[field]))
        fail("CANONICAL_TRAIT_ALREADY_PRESENT:"+field);
      if(JSON.stringify(normalized[field])!==JSON.stringify(FALLBACKS[field]))
        fail("LEGACY_SOURCE_FALLBACK_CHANGED:"+field);
    }
    const review=raw.review_signals,market=raw.market_signals,ingredient=raw.ingredient_signals;
    const captured=review?.source==="hwahae_ai_review"&&
      market?.source==="hwahae_visible_page"&&
      ingredient?.source==="hwahae_visible_page"&&
      typeof raw.hwahae_url==="string"&&raw.hwahae_url.length>0&&
      raw.hwahae_url===market.hwahae_review_page;
    if(!captured&&[review,market,ingredient,raw.hwahae_url].some(v=>v!=null))
      fail("PARTIAL_OR_MISMATCHED_CAPTURE");
    const positive=captured?tagsFrom(review.positive):new Set();
    const negative=captured?tagsFrom(review.negative):new Set();
    const totalReviewCount=captured?parseCount(market.review_count):null;
    const hasMappedTopThree=captured&&(positive.size>0||negative.size>0);
    const nameFormHint=typeof raw.name==="string"&&
      /(젤|폼|크림|gel|foam|cream)/i.test(raw.name);
    const textureTendency=includes(positive,TEXTURE_TAGS)||includes(negative,TEXTURE_TAGS);
    const finishTendency=includes(positive,FINISH_TAGS)||includes(negative,FINISH_TAGS);
    const caution=includes(negative,CAUTION_TAGS);
    const fields=Object.freeze({
      skin_types:observation("UNKNOWN",captured?"INGREDIENT_AGGREGATE_NOT_CANONICAL":"NO_HWAHAE_CAPTURE"),
      concerns:observation(includes(positive,CONCERN_TAGS)?"REVIEW_TENDENCY_ONLY":"UNKNOWN",
        captured?"HWAHAE_MAPPED_REVIEW_TAGS":"NO_HWAHAE_CAPTURE"),
      texture:observation(textureTendency?"REVIEW_TENDENCY_ONLY":nameFormHint?"NAME_FORM_HINT_ONLY":"UNKNOWN",
        textureTendency?"HWAHAE_MAPPED_REVIEW_TAGS":nameFormHint?"CATALOG_PRODUCT_NAME":"NONE"),
      finish:observation(finishTendency?"REVIEW_TENDENCY_ONLY":"UNKNOWN",
        finishTendency?"HWAHAE_MAPPED_REVIEW_TAGS":"NONE"),
      irritation_risk:observation(caution?"NEGATIVE_REVIEW_CAUTION_ONLY":"UNKNOWN",
        caution?"HWAHAE_NEGATIVE_REVIEW_TAGS":"NONE"),
      sensitivity_safe:observation("UNKNOWN",
        caution?"NEGATIVE_REVIEW_CAUTION_NOT_SAFETY_FACT":"NOT_VERIFIED")
    });
    for(const field of FIELDS)statusCounts[field][fields[field].status]++;
    capturedCount+=Number(captured);
    mappedReviewCount+=Number(hasMappedTopThree);
    lowReviewCautions+=Number(captured&&totalReviewCount!=null&&totalReviewCount<=2);
    return Object.freeze({
      product_id:raw.id,capture_exists:captured,mapped_review_top_three:hasMappedTopThree,
      low_review_count_caution:captured&&totalReviewCount!=null&&totalReviewCount<=2,
      canonical_fields_missing:6,legacy_fallback_slots:6,fields,
      direct_product_metadata_writes:0,approved_recommendation:false
    });
  });
  return Object.freeze({
    version:CLEANSER_R5_METADATA_PREVIEW_VERSION,product_count:10,
    hwahae_captured:capturedCount,mapped_review_top_three_products:mappedReviewCount,
    low_review_count_cautions:lowReviewCautions,
    canonical_fields_missing:60,legacy_fallback_slots:60,
    canonical_field_values_proposed:0,canonical_field_values_written:0,
    field_evidence_status_counts:statusCounts,
    source_review_labels_exported:false,source_urls_exported:false,
    product_facts_confirmed:0,g2_grants:0,production_writes:0,
    products:Object.freeze(products)
  });
}
