// D8K-5: strictly typed, offline-testable selected-option evidence DTO.
// This is NOT the authenticated database reader or the ingestion/review gate.
// It never grants seller-price publication or purchase CTA authority.
export const SELECTED_OPTION_EVIDENCE_READ_VERSION =
  "selected-offer-option-evidence-read-v1";
export const SELECTED_OPTION_EVIDENCE_PROJECTION_VERSION =
  "d8k5-selected-option-evidence-projection-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-z0-9][a-z0-9_:-]{0,95}$/;
const SELLER = /^[a-z][a-z0-9_-]{0,79}$/;
const HEX = /^[a-f0-9]{64}$/;
const KINDS = new Set(["single","multipack","kit"]);
const UNITS = new Set(["ml","g","ea"]);
const MAX_IDS = 64;
const MAX_ROWS = 256;
const MAX_GIFTS = 12;
const MAX_AGE = 2592000000;

function hold(reason, count = 0) {
  return {
    version: SELECTED_OPTION_EVIDENCE_PROJECTION_VERSION,
    status: "HOLD", reason, requestedProductCount: count,
    optionRowCount: 0, optionsByProduct: {},
    // The SQL output alone does not establish signed provenance or caller role.
    authenticatedServerReaderProven: false,
    observationEvidenceIndependentlyRechecked: false,
    selectedOptionPriceDisplayAuthorized: false,
    directCtaAuthorized: false, productionReleaseAuthorized: false
  };
}
function text(v,max=160) {
  return typeof v === "string" && v.length>0 && v.length<=max &&
    v.trim()===v && !/[\u0000-\u001f\u007f]/.test(v) ? v : null;
}
function uuid(v) { return typeof v==="string" && UUID.test(v) ? v.toLowerCase() : null; }
function money(v,positive=true) {
  return Number.isSafeInteger(v) && v >= (positive?1:0) && v <= 1000000000 ? v : null;
}
function time(v) {
  const x=text(v,48);
  if(!x || !/^\d{4}-\d{2}-\d{2}T/.test(x) || !/[Zz]|[+-]\d{2}:\d{2}$/.test(x)) return null;
  const t=Date.parse(x);
  return Number.isFinite(t) ? t : null;
}
function composition(v) {
  const size=v.unit_size, qty=v.quantity, unit=v.size_unit, kind=v.option_kind;
  if(!Number.isSafeInteger(size)||size<1||size>10000||
     !Number.isSafeInteger(qty)||qty<1||qty>10000||
     !UNITS.has(unit)||!KINDS.has(kind)||
     !Array.isArray(v.gifts)||v.gifts.length>MAX_GIFTS) return null;
  const gifts=[], ids=new Set();
  for(const g of v.gifts) {
    if(!g || typeof g!=="object" || Array.isArray(g) ||
       !text(g.skuId,96)||!TOKEN.test(g.skuId) ||
       !Number.isSafeInteger(g.quantity)||g.quantity<1||g.quantity>10000||
       ids.has(g.skuId)) return null;
    ids.add(g.skuId);gifts.push({skuId:g.skuId,quantity:g.quantity});
  }
  gifts.sort((a,b)=>a.skuId.localeCompare(b.skuId,"en"));
  if((kind==="single"&&(qty!==1||gifts.length))||
     (kind==="multipack"&&(qty<2||gifts.length))||
     (kind==="kit"&&!gifts.length)) return null;
  return Object.freeze({unitSize:size,sizeUnit:unit,quantity:qty,gifts});
}
/**
 * A structurally valid OPTION is still NOT evidence of who queried SQL,
 * approved its review, or whether the screenshot/receipt is authentic.
 * Return typed private candidates only; NEVER forward to a browser.
 */
export function inspectSelectedOptionEvidenceResponse({
  requestedProductIds=null, response=null, nowIso=null, maxAgeMs=null
}={}) {
  if(!Array.isArray(requestedProductIds)||!requestedProductIds.length||
     requestedProductIds.length>MAX_IDS) return hold("PRODUCT_ID_REQUEST_INVALID");
  const normalized=[];
  for(const raw of requestedProductIds) {
    const id=uuid(raw);
    if(!id) return hold("PRODUCT_ID_REQUEST_INVALID");
    normalized.push(id);
  }
  const ids=[...new Set(normalized)].sort();
  const now=time(nowIso);
  if(now===null||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>MAX_AGE)
    return hold("FRESHNESS_POLICY_NOT_SET",ids.length);
  if(!response||typeof response!=="object"||Array.isArray(response)||
     response.read_contract_version!==SELECTED_OPTION_EVIDENCE_READ_VERSION)
    return hold("READ_CONTRACT_MISMATCH",ids.length);
  if(response.status!=="AUTHORITY_RESOLVED")
    return hold("READ_AUTHORITY_UNRESOLVED",ids.length);
  if(!Array.isArray(response.options)||response.options.length>MAX_ROWS)
    return hold("OPTION_ROW_LIMIT_OR_SHAPE_INVALID",ids.length);

  const perProduct=Object.fromEntries(ids.map(id=>[id,[]]));
  const optionKeys=new Set(), observations=new Set(), reviews=new Set();
  for(const r of response.options) {
    if(!r||typeof r!=="object"||Array.isArray(r)) return hold("OPTION_ROW_INVALID",ids.length);
    const pid=uuid(r.product_id), offerId=uuid(r.offer_id);
    const observationId=uuid(r.observation_id), reviewId=uuid(r.review_id);
    const key=text(r.seller_option_key,96), variant=text(r.variant_id,96);
    const seller=text(r.seller_key,80), sellerName=text(r.seller_name,160);
    const listingId=text(r.listing_id,256), hash=text(r.evidence_sha256,64);
    const pack=composition(r);
    if(!pid||!perProduct[pid]||!offerId||!observationId||!reviewId||
       !key||!TOKEN.test(key)||!variant||!TOKEN.test(variant)||
       !seller||!SELLER.test(seller)||!sellerName||!listingId||
       !hash||!HEX.test(hash)||!pack||r.currency_code!=="KRW")
      return hold("OPTION_IDENTITY_OR_REVIEW_INVALID",ids.length);
    const price=money(r.selected_option_price_krw);
    const shipping=r.shipping_price_krw==null?null:money(r.shipping_price_krw,false);
    if(price===null||(r.shipping_price_krw!=null&&shipping===null))
      return hold("OPTION_PRICE_INVALID",ids.length);
    const obs=time(r.observed_at), reviewed=time(r.reviewed_at);
    if(obs===null||reviewed===null||obs>reviewed||reviewed>now||
       obs>now||now-obs>maxAgeMs)
      return hold("OPTION_PRICE_OR_REVIEW_STALE",ids.length);
    const identity=JSON.stringify([offerId,key]);
    if(optionKeys.has(identity)||observations.has(observationId)||
       reviews.has(reviewId)) return hold("DUPLICATE_OPTION_OBSERVATION_OR_REVIEW",ids.length);
    optionKeys.add(identity);observations.add(observationId);reviews.add(reviewId);
    perProduct[pid].push(Object.freeze({
      productId:pid, offerId, observationId, reviewId,
      sellerKey:seller,sellerName,listingId,
      optionIdentity:key,variantId:variant,
      optionKind:r.option_kind,packComposition:pack,
      observedPrice:price,shippingCost:shipping,
      currency:"KRW",observedAt:r.observed_at,reviewedAt:r.reviewed_at,
      evidenceDigest:hash,
      // Omitted: URL, seller-scoring, recommendation admission, link authority.
      ctaHref:null,ctaEnabled:false,
      independentlyAttested:false
    }));
  }
  for(const id of ids) {
    perProduct[id].sort((a,b)=>
      a.offerId.localeCompare(b.offerId,"en")||
      a.optionIdentity.localeCompare(b.optionIdentity,"en"));
    Object.freeze(perProduct[id]);
  }
  return {
    ...hold("SERVER_PROVENANCE_AND_REVIEW_GATE_REQUIRED",ids.length),
    status:"STRUCTURALLY_VALID_PRIVATE_CANDIDATES",
    optionRowCount:response.options.length,
    optionsByProduct:Object.freeze(perProduct)
  };
}
