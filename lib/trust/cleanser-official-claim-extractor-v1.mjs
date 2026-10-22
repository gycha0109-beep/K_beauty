/**
 * A bounded first-party product-heading/metadata CLAIM extractor.
 *
 * Not a chemistry measurement or a Product Fact confirmation. Extraction
 * must only run behind an existing governed exact-product official binding.
 * Generic page body, ingredient lists, reviews, FAQ and cross-sells are
 * excluded on purpose.
 */
export const CLEANSER_OFFICIAL_CLAIM_EXTRACTOR_VERSION =
  "cleanser-official-claim-extractor-v1";
const PRODUCT=/클렌저|클렌징|세안제|세안폼|폼\s*클렌저|포밍|팩클렌저|cleans(?:er|ing)|face\s*wash|wash\s*foam/i;
const GENERIC=/\b(?:top\s*\d+|best\s*\d+|faq)\b|추천\s*\d*종|비교|가이드|사용\s*꿀팁|reviews?|후기\s*모음/i;
const POSITIVE_PH=/약\s*산성|저\s*pH|low[\s-]*pH|mildly[\s-]*acidic/i;
const NEGATIVE_PH=/약\s*알칼리성|알칼리성|alkaline\s*(?:cleans(?:er|ing)|face\s*wash|foam)|alkaline[\s-]*pH/i;
const DEEP=/딥\s*클렌징|딥\s*클렌저|딥\s*클린(?:징)?|deep[\s-]*cleans(?:ing|er)|deep[\s-]*clean(?:ing)?/i;
const NEGATED=/아닌|아닙니다|아니며|않는|아님|없(?:음|는)|무관|without|not\s+(?:a\s+)?(?:deep|low)|non[\s-]*(?:deep|acidic)/i;
const read=v=>typeof v==="string"?v.normalize("NFKC").replace(/\s+/g," ").trim():"";
function scoped(value) {
  const s=read(value);
  return s.length>=5 && s.length<=450 && PRODUCT.test(s) && !GENERIC.test(s);
}
function build(factKey,row,match,value) {
  return Object.freeze({
    normalizedValue:value,
    evidenceClass:"product_claim",
    qualifier:Object.freeze({
      claim_scope:"official_product_heading_or_tied_description",
      source_surface:row.source,
      semantics:"explicit_product_claim_not_measurement",
    }),
    observedClaim:Object.freeze({
      matched_text:match[0],
      excerpt:row.value.slice(Math.max(0,match.index-80),
        Math.min(row.value.length,match.index+match[0].length+80)),
      extractor:CLEANSER_OFFICIAL_CLAIM_EXTRACTOR_VERSION,
      fact_key:factKey,
      source_surface:row.source,
      measurementProven:false,
      productFactConfirmed:false,
    }),
  });
}
export function extractStrictCleanserOfficialClaim(factKey,semanticSurfaces){
  if(factKey!=="low_ph"&&factKey!=="deep_cleansing")return null;
  const doc=semanticSurfaces?.document;
  if(!doc||typeof doc!=="object")return null;
  const heading=[
    ["og_title",doc.og_title],
    ["meta_title",doc.meta_title],
    ["title",doc.title],
  ].map(([source,value])=>({source,value:read(value)}))
    .filter(x=>scoped(x.value));
  if(!heading.length)return null;
  const values=[...heading];
  // Descriptions are only admissible when a product-specific heading exists.
  // They must themselves identify a cleanser, not a generic brand mission.
  for(const key of ["meta_description","og_description"]){
    const value=read(doc[key]);
    if(scoped(value))values.push({source:key,value});
  }
  let selected=null;
  for(const row of values){
    if(NEGATED.test(row.value))continue;
    if(factKey==="low_ph"){
      const positive=POSITIVE_PH.exec(row.value);
      const negative=NEGATIVE_PH.exec(row.value);
      if(positive&&negative)return null;
      if(!positive&&!negative)continue;
      const value=Boolean(positive);
      if(selected&&selected.normalizedValue!==value)return null;
      selected=selected||build(factKey,row,positive||negative,value);
    }else {
      const positive=DEEP.exec(row.value);
      if(!positive)continue;
      selected=selected||build(factKey,row,positive,true);
    }
  }
  return selected;
}
