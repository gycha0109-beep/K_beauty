/**
 * R16I D8F -> D8D pricing-scope shadow. Pure, read-only; never issues product,
 * offer, SKU, CTA, owner approval or price-authority mutations.
 *
 * 35,000 KRW is the displayed list price on the user-supplied official
 * checkout screenshot, NOT a structured owner-verdict field or perpetual
 * catalog price. The two saved evidence records attest checkout observations.
 */
export const R16I_PRICE_SCOPE_REVIEW_VERSION="r16i-price-scope-review-v1";
export const R16I_SCREEN_LIST_PRICE_OBSERVATION_KRW=35000;
const PRODUCT_ID="b639c8b4-6a61-440e-b4db-fac7381593ff";
const OFFICIAL_URL="https://www.snature.kr/product/detail.html?product_no=151";
const HWAHAE_URL="https://www.hwahae.co.kr/goods/45194";
const CONFIG=Object.freeze({
  official_single:Object.freeze({label:"공식몰 80ml 단품",selectedOption:"수분크림 80ml 1개",url:OFFICIAL_URL,quantity:1,creamUnitMl:80,giftSerumMl:0}),
  hwahae_bundle:Object.freeze({label:"화해 80ml×2 + 세럼 10ml 기획세트",selectedOption:"수분크림 80ml×2 + 세럼 10ml",url:HWAHAE_URL,quantity:2,creamUnitMl:80,giftSerumMl:10})
});
const baseProductValues=Object.freeze({
  "products.size_ml":160,"products.price_min":29900,
  "products.price_max":29900,"products.unit_price_per_10ml":1868.75,
  "products.buy_link":HWAHAE_URL
});
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const krw=x=>Number.isSafeInteger(x)&&x>0&&x<=100000000;
const blocked=(reason)=>Object.freeze({
  version:R16I_PRICE_SCOPE_REVIEW_VERSION,
  status:"BLOCKED",reason,
  product:null,offerCandidates:Object.freeze([]),
  canonicalPriceAuthority:false,ownerPricePolicyApproved:false,
  productionWritesAuthorized:false,executableSql:null
});

/**
 * view is the existing guarded D4 review; evidence and verdicts are already
 * loaded through the existing admin endpoints. This model deliberately does
 * not claim source-URL re-attestation (not returned by evidence GET).
 */
export function buildR16IPriceScopeReview({view,evidence,verdicts,nowIso}={}){
  if(!isObject(view)||view.decision!=="REVIEW_REQUIRED"||
    view.product_id!==PRODUCT_ID||view.live_read_verified!==true||
    view.revision_matches!==true||view.collision_free!==true||
    !Array.isArray(view.reviewed_fields)||
    !Array.isArray(evidence)||!Array.isArray(verdicts)||
    typeof nowIso!=="string"||!Number.isFinite(Date.parse(nowIso)))
    return blocked("GUARDED_VIEW_OR_TIME_MISSING");

  const before=new Map(view.reviewed_fields.map(row=>[
    row.entity+"."+row.field,row.before
  ]));
  for(const [key,value] of Object.entries(baseProductValues)){
    if(!before.has(key)||before.get(key)!==value)
      return blocked("PRODUCT_PRESTATE_OR_SCOPE_DRIFT");
  }
  const rows=[];
  const now=Date.parse(nowIso);
  for(const [sourceKey,scope] of Object.entries(CONFIG)){
    const exact=evidence.filter(row=>row?.sourceKey===sourceKey);
    if(exact.length!==1)return blocked("MISSING_OR_DUPLICATED_SELLER_EVIDENCE");
    const row=exact[0];
    if(row.selectedOption!==scope.selectedOption||
      !krw(row.claimedCheckoutPrice)||
      !Number.isFinite(Date.parse(row.capturedAt))||
      Date.parse(row.capturedAt)<now-30*86400000||
      Date.parse(row.capturedAt)>now+5*60000)
      return blocked("CHECKOUT_OPTION_PRICE_OR_FRESHNESS_INVALID");
    const linked=verdicts.filter(v=>v?.evidenceId===row.evidenceId);
    if(linked.length!==1||linked[0].verdict!=="VERIFIED")
      return blocked("OWNER_VERDICT_REQUIRED");
    rows.push(Object.freeze({
      sourceKey,
      label:scope.label,
      listingUrl:scope.url,
      selectedOption:scope.selectedOption,
      checkoutAmountKrW:row.claimedCheckoutPrice,
      checkoutPriceScope:"SELLER_SELECTED_OPTION_CHECKOUT_ONLY",
      creamUnitMl:scope.creamUnitMl,
      creamQuantity:scope.quantity,
      creamAggregateMl:scope.creamUnitMl*scope.quantity,
      giftSerumMl:scope.giftSerumMl,
      offerPriceCandidateKrW:row.claimedCheckoutPrice,
      offerInsertAuthorized:false,
      purchaseLinkTrusted:false
    }));
  }
  // The screen list price is a separate, mutable price observation, and is
  // never inferred to be the verified Product.price_min/max.
  const official=rows.find(row=>row.sourceKey==="official_single");
  const screenList=R16I_SCREEN_LIST_PRICE_OBSERVATION_KRW;
  if(screenList<official.checkoutAmountKrW)
    return blocked("LIST_PRICE_SCREEN_OBSERVATION_CONFLICT");
  return Object.freeze({
    version:R16I_PRICE_SCOPE_REVIEW_VERSION,
    status:"REVIEW_REQUIRED",
    reason:"CANONICAL_PRODUCT_PRICE_AND_CTA_POLICY_UNRESOLVED",
    product:Object.freeze({
      id:PRODUCT_ID,
      existingCreamVolumeMl:160,
      singlePresentationCandidateMl:80,
      creamSizeCanBeAppliedIndependently:false,
      canonicalPriceMinKrW:null,
      canonicalPriceMaxKrW:null,
      canonicalUnitPricePer10MlKrW:null,
      canonicalBuyLink:null,
      priceBasis:"UNDECIDED_NEITHER_LIST_NOR_CHECKOUT_AUTO_PROMOTED",
      productWriteAuthorized:false
    }),
    officialScreenListPriceKrW:screenList,
    officialScreenListPriceProvenance:"USER_SCREENSHOT_DISPLAY_ONLY_NOT_LEDGER_FIELD",
    officialDiscountObservedKrW:screenList-official.checkoutAmountKrW,
    offerCandidates:Object.freeze(rows),
    bundleComponentsAuthority:"SELECTED_OPTION_LABEL_ONLY_NOT_INDEPENDENT_SKU",
    sourceUrlReattestedInThisModel:false,
    canonicalPriceAuthority:false,
    ownerPricePolicyApproved:false,
    productionWritesAuthorized:false,
    executableSql:null
  });
}
