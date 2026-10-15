// D8K-9: cross-join a D8K-8 offline evidence packet with EXACT catalog
// Product, product-scoped Offer RPC v2 and independent global listing/URL
// collision probes. Pure read-only diagnostic: inputs can be forged by a
// caller, so even a perfect match CANNOT grant server reads, writes, prices,
// recommendation admission, product-fact identity, or a purchase CTA.
export const D8K9_PARENT_BINDING_VERSION =
  "d8k9-parent-offer-identity-reconciliation-v1";
export const D8K9_PARENT_READ_CONTRACT =
  "product-offer-presentation-authority-read-v2";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_OFFERS=256;
const MAX_TIME_WINDOW_MS=3600000;
const id=v=>typeof v==="string"&&UUID.test(v)?v.toLowerCase():null;
const clean=(v,max=2048)=>typeof v==="string"&&v.length>0&&v.length<=max&&
  v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v)?v:null;
const date=v=>typeof v==="string"&&v.length<=48&&
  /^\d{4}-\d{2}-\d{2}T/.test(v)&&/(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&
  Number.isFinite(Date.parse(v))?Date.parse(v):null;
function hold(reason){
  return {
    contractVersion:D8K9_PARENT_BINDING_VERSION,status:"HOLD",reason,
    boundProductId:null,boundOfferId:null,
    matchedListingCount:0,priceEvidenceProjection:null,
    actualDbSnapshotAuthenticated:false,ownerSourceVerified:false,
    productFactSubjectProven:false,recommendationAdmissionProven:false,
    authenticatedReviewerProven:false,optionEvidenceAuthenticated:false,
    writeAuthorized:false,privateServerReadAuthorized:false,
    sellerPriceDisplayAuthorized:false,directCtaAuthorized:false,
    productionReleaseAuthorized:false
  };
}
function sameLocator(capture,review) {
  const o=capture?.privateObservationCandidate;
  const r=review?.privateObservationCandidate;
  if(!o||!r||!capture?.sourceLocator)return false;
  if(capture.status!=="CAPTURE_METADATA_MATCH_ONLY"||
     review.status!=="INDEPENDENT_REVIEW_PACKET_READY_NO_WRITE"||
     review.sevenFieldReviewComplete!==true||
     !id(capture.productId)||!id(capture.offerId)||
     capture.productId!==review.productId||
     capture.offerId!==review.offerId||
     !id(o.observation_id)||o.observation_id!==r.observation_id||
     !id(o.offer_id)||o.offer_id!==r.offer_id||
     o.source_evidence_sha256!==r.source_evidence_sha256||
     o.variant_id!==r.variant_id||
     o.seller_option_key!==r.seller_option_key||
     o.selected_option_price_krw!==r.selected_option_price_krw||
     o.shipping_price_krw!==r.shipping_price_krw||
     o.shipping_price_basis!==r.shipping_price_basis||
     o.unit_size!==r.unit_size||o.size_unit!==r.size_unit||
     o.quantity!==r.quantity||o.option_kind!==r.option_kind||
     JSON.stringify(o.gifts)!==JSON.stringify(r.gifts)||
     !review.privateReviewEvent||
     review.privateReviewEvent.verdict!=="verified"||
     review.privateReviewEvent.observation_id!==o.observation_id||
     review.privateReviewEvent.evidence_sha256!==o.source_evidence_sha256||
     review.privateReviewEvent.reviewer_actor_key===o.collector_actor_key)
    return false;
  const loc=capture.sourceLocator;
  return !!(clean(loc.brand,80)&&clean(loc.productName,160)&&
    clean(loc.sellerKey,80)&&clean(loc.sellerName,160)&&
    clean(loc.listingId,256)&&clean(loc.listingUrl)&&
    id(capture.productId)===id(review.productId)&&
    id(capture.offerId)===id(review.offerId));
}
/**
 * Same real listing URL. Coupang captured itemId/vendorItemId belong to
 * the selected SKU, while the parent Offer may be a *bare* product page.
 * Never collapse unrelated seller pages or ignore foreign option query IDs.
 */
function sameListingUrl(loc,stored) {
  const source=clean(loc.listingUrl),parent=clean(stored);
  if(!source||!parent)return false;
  if(loc.sellerKey!=="coupang")return source===parent;
  if(source===parent)return true;
  try{
    const c=new URL(source),p=new URL(parent);
    return c.protocol==="https:"&&p.protocol==="https:"&&
      c.hostname==="www.coupang.com"&&p.hostname===c.hostname&&
      c.pathname===p.pathname&&
      p.search===""&&p.hash===""&&!p.username&&!p.password&&
      p.port===""&&c.searchParams.has("itemId")&&
      c.searchParams.has("vendorItemId")&&
      [...c.searchParams.keys()].length===2;
  }catch{return false;}
}
function sameRowIdentity(a,b) {
  return !!(a&&b&&id(a.offer_id)&&id(b.offer_id)&&
    id(a.offer_id)===id(b.offer_id)&&
    id(a.product_id)===id(b.product_id)&&
    a.seller_key===b.seller_key&&
    a.listing_id===b.listing_id&&
    a.listing_url===b.listing_url);
}
/**
 * Inputs must be supplied by a separately approved read-only operator or
 * server workflow. JSON fields alone DO NOT attest where they came from.
 * Expect:
 *   snapshot = {
 *     observedAt, queryProductId,
 *     product: {id, brand, name, category, size_ml},
 *     offerRead: {read_contract_version, status, offers:[...v2 raw...]},
 *     bySellerListing:[...raw product_offers rows...],
 *     bySellerUrl:[...raw product_offers rows...]
 *   }
 * DO NOT make this function accessible to browser-selected raw RPC responses.
 */
export function reconcileManualOptionParentIdentity({
  capture=null,review=null,snapshot=null,nowIso=null,
  maxSnapshotAgeMs=300000
}={}) {
  if(!sameLocator(capture,review))
    return hold("CAPTURE_REVIEW_IDENTITY_INCONSISTENT");
  const locator=capture.sourceLocator;
  if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))
    return hold("PARENT_SNAPSHOT_MISSING");
  const now=date(nowIso),at=date(snapshot.observedAt);
  if(now===null||at===null||!Number.isSafeInteger(maxSnapshotAgeMs)||
     maxSnapshotAgeMs<1||maxSnapshotAgeMs>MAX_TIME_WINDOW_MS||
     at>now||now-at>maxSnapshotAgeMs)
    return hold("PARENT_SNAPSHOT_STALE_OR_TIME_UNKNOWN");
  const pid=id(capture.productId),oid=id(capture.offerId);
  if(snapshot.queryProductId!==pid)
    return hold("SNAPSHOT_PRODUCT_QUERY_NOT_BOUND");
  const product=snapshot.product;
  if(!product||id(product.id)!==pid||!clean(product.brand,80)||
     !clean(product.name,160)||!clean(product.category,80)||
     product.brand!==locator.brand||product.name!==locator.productName)
    return hold("CATALOG_PRODUCT_IDENTITY_MISMATCH");
  // A Product's base unit-size is NOT the bundle total. An old legacy 160ml
  // kit record MUST NOT be silently interpreted as an 80ml Product fact.
  if(capture.privateObservationCandidate.size_unit!=="ml"||
     !Number.isSafeInteger(product.size_ml)||product.size_ml<=0)
    return hold("CATALOG_PRODUCT_UNIT_SUBJECT_UNRESOLVED");
  if(product.size_ml!==capture.privateObservationCandidate.unit_size)
    return hold("CATALOG_UNIT_SIZE_VS_SELECTED_OPTION_CONFLICT");

  const result=snapshot.offerRead;
  if(!result||typeof result!=="object"||Array.isArray(result)||
     result.read_contract_version!==D8K9_PARENT_READ_CONTRACT||
     result.status!=="AUTHORITY_RESOLVED"||
     !Array.isArray(result.offers)||result.offers.length>MAX_OFFERS)
    return hold("PRODUCT_OFFER_V2_READ_CONTRACT_UNRESOLVED");
  const ids=new Set(),byListing=new Set(),byUrl=new Set();
  let parent=null;
  for(const row of result.offers) {
    const rowId=id(row?.offer_id);
    if(!row||!rowId||id(row.product_id)!==pid||
       !clean(row.seller_key,80)||!clean(row.listing_url)||
       (row.listing_id!==null&&!clean(row.listing_id,256)))
      return hold("PRODUCT_SCOPED_OFFER_ROW_INVALID");
    const listingIdentity=JSON.stringify([row.seller_key,row.listing_id]);
    const urlIdentity=JSON.stringify([row.seller_key,row.listing_url]);
    if(ids.has(rowId)||byUrl.has(urlIdentity)||
       (row.listing_id!==null&&byListing.has(listingIdentity)))
      return hold("PRODUCT_OFFER_ID_OR_LISTING_COLLISION");
    ids.add(rowId);byUrl.add(urlIdentity);
    if(row.listing_id!==null)byListing.add(listingIdentity);
    if(rowId===oid) parent=row;
  }
  if(!parent)return hold("PARENT_OFFER_NOT_FOUND_IN_PRODUCT_SCOPE");
  if(parent.seller_key!==locator.sellerKey||
     parent.seller_name!==locator.sellerName||
     parent.listing_id!==locator.listingId)
    return hold("PARENT_SELLER_OR_LISTING_ID_MISMATCH");
  if(!sameListingUrl(locator,parent.listing_url))
    return hold("PARENT_LISTING_URL_OR_SELECTED_VARIANT_MISMATCH");
  if(parent.offer_state!=="current"||
     parent.product_scope_state!=="product"||
     parent.market_code!=="KR"||parent.currency_code!=="KRW")
    return hold("PARENT_OFFER_NOT_CURRENT_OR_PRODUCT_SCOPED");
  if(parent.availability_state!=="in_stock")
    return hold("PARENT_OFFER_STOCK_NOT_CONFIRMED");
  if(parent.link_health_state!=="healthy")
    return hold("PARENT_OFFER_LINK_HEALTH_NOT_CONFIRMED");

  // The product-scoped RPC cannot prove global uniqueness. Independently
  // supplied SELECT results MUST match the exact parent on BOTH keys.
  const listing=snapshot.bySellerListing,urls=snapshot.bySellerUrl;
  if(!Array.isArray(listing)||!Array.isArray(urls)||
     listing.length!==1||urls.length!==1)
    return hold("GLOBAL_SELLER_LISTING_COLLISION_NOT_EXCLUDED");
  if(!sameRowIdentity(listing[0],parent)||!sameRowIdentity(urls[0],parent))
    return hold("GLOBAL_LISTING_OR_URL_ROW_DIVERGENCE");

  // The result is still NOT a trusted Product fact subject or reviewer proof.
  // Deliberately never return amount, URL, direct link or raw RPC records.
  return {
    ...hold("ACTUAL_DB_ORIGIN_AND_PRODUCT_FACT_AUTHORITY_NOT_PROVEN"),
    status:"PARENT_LISTING_MATCH_DIAGNOSTIC_ONLY",
    boundProductId:pid,boundOfferId:oid,matchedListingCount:1,
    sourceSellerClass:locator.sellerKey,
    sourceOptionIdentity:capture.privateObservationCandidate.seller_option_key
  };
}
