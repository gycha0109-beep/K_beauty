// D8K-8: offline seller-selected option capture and independent-review packet.
// A real seller screenshot/HTML/PDF must be archived independently; this
// pure contract validates metadata, NOT the content or its author's identity.
// NEVER use its output to grant a database write, public price or CTA.
import { resolveProductPurchaseLink } from "../product-purchase-link.js";
import { selectLatestOptionReviewHistoryShadow } from "./product-offer-review-history-shadow-v1.mjs";

export const D8K8_MANUAL_INTAKE_VERSION = "d8k8-manual-option-intake-v1";
export const D8K8_REVIEW_CHECK_KEYS = Object.freeze([
  "product_listing_scope", "selected_sku", "pack_gift_composition",
  "selected_option_price", "shipping_conditions", "capture_origin",
  "product_vs_offer_attribution"
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[a-z0-9][a-z0-9_:-]{0,95}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const MAX_AGE_MS=2592000000;
const SELLERS=new Set(["oliveyoung","hwahae","coupang","official"]);
const UNITS=new Set(["ml","g","ea"]);
const KINDS=new Set(["single","multipack","kit"]);
const validUUID=v=>typeof v==="string"&&UUID.test(v)?v.toLowerCase():null;
const key=v=>typeof v==="string"&&TOKEN.test(v)?v:null;
const label=(v,max=160)=>typeof v==="string"&&v.length>0&&v.length<=max&&
  v===v.trim()&&!/[\u0000-\u001f\u007f]/.test(v)?v:null;
const money=(v,zero=false)=>Number.isSafeInteger(v)&&v>=(zero?0:1)&&v<=1e9?v:null;
const date=v=>typeof v==="string"&&v.length<=48&&
  /^\d{4}-\d{2}-\d{2}T/.test(v)&&/(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&
  Number.isFinite(Date.parse(v))?Date.parse(v):null;
function hold(reason) {
  return Object.freeze({
    version:D8K8_MANUAL_INTAKE_VERSION,status:"HOLD",reason,
    privateObservationCandidate:null,privateReviewEvent:null,
    sourceFileVerified:false,reviewerAuthenticated:false,
    evidenceAuthenticityProven:false,parentOfferDatabaseVerified:false,
    productionWriteAuthorized:false,publicPriceAuthorized:false,
    directCtaAuthorized:false,releaseAuthorized:false
  });
}
function sourceIdentity(manifest) {
  // Reuse the existing brand/platform URL allowlist for supported channels.
  // This is OFFLINE string parsing only; no DNS, merchant request, link health,
  // account checkout or purchase CTA authorization.
  const raw=label(manifest.sourceUrl,2048);
  const seller=manifest.sellerKey;
  if(!raw||!SELLERS.has(seller))return false;
  let u;
  try{u=new URL(raw);}catch{return false;}
  if(u.protocol!=="https:"||u.username||u.password||
     u.hash||u.port||u.hostname.endsWith(".")||u.hostname!==u.hostname.toLowerCase())
    return false;
  if(!label(manifest.listingId,256))return false;
  if(seller==="oliveyoung") {
    if(!["oliveyoung.co.kr","www.oliveyoung.co.kr","m.oliveyoung.co.kr"].includes(u.hostname)||
      !/^\/store\/goods\/getGoodsDetail(?:\.do)?\/?$/i.test(u.pathname)||
      u.searchParams.get("goodsNo")!==manifest.listingId)return false;
    // No account/tokens/affiliate params archived as trusted identity.
    return [...u.searchParams.keys()].every(p=>p==="goodsNo")&&
      [...u.searchParams.keys()].length===1;
  }
  if(seller==="hwahae") {
    return u.hostname==="www.hwahae.co.kr"&&
      u.pathname==="/goods/"+manifest.listingId&&!u.search;
  }
  if(seller==="coupang") {
    // Only capture-identity syntax; existing DIRECT CTA policy does NOT
    // allow Coupang. No itemId/vendorItemId is inferred from product ID.
    return u.hostname==="www.coupang.com"&&
      u.pathname==="/vp/products/"+manifest.listingId&&!u.search;
  }
  // official sellers: require the EXISTING brand-to-host/path whitelist.
  // Never allow arbitrary HTTPS hosts or brand names as official proof.
  const parsed=resolveProductPurchaseLink({
    buyLink:raw,brand:manifest.brand,name:manifest.productName
  });
  return parsed.kind==="direct"&&parsed.source.startsWith("official:")&&
    !!key(manifest.listingId) &&
    (u.pathname.toLowerCase().split("/").filter(Boolean).at(-1)===
      manifest.listingId.toLowerCase()) && !u.search;
}
function composition(m) {
  if(!KINDS.has(m.optionKind)||!UNITS.has(m.sizeUnit)||
     !Number.isSafeInteger(m.unitSize)||m.unitSize<1||m.unitSize>10000||
     !Number.isSafeInteger(m.quantity)||m.quantity<1||m.quantity>10000||
     !Array.isArray(m.gifts)||m.gifts.length>12)return null;
  const gifts=[],known=new Set();
  for(const g of m.gifts) {
    if(!g||typeof g!=="object"||Array.isArray(g)||!key(g.skuId)||
       !Number.isSafeInteger(g.quantity)||g.quantity<1||g.quantity>10000||
       known.has(g.skuId))return null;
    known.add(g.skuId);gifts.push({skuId:g.skuId,quantity:g.quantity});
  }
  gifts.sort((a,b)=>a.skuId.localeCompare(b.skuId,"en"));
  if((m.optionKind==="single"&&(m.quantity!==1||gifts.length))||
     (m.optionKind==="multipack"&&(m.quantity<2||gifts.length))||
     (m.optionKind==="kit"&&!gifts.length))return null;
  return gifts;
}
/**
 * Contract for human-transcribed actual seller capture. A matching seller
 * URL and checksum do NOT verify pixels/content or offer-parent DB identity.
 */
export function inspectManualOptionCapture({
  manifest=null,actualArtifactSha256=null,nowIso=null,maxAgeMs=null
}={}) {
  if(!manifest||typeof manifest!=="object"||Array.isArray(manifest))
    return hold("CAPTURE_MANIFEST_REQUIRED");
  const productId=validUUID(manifest.productId),offerId=validUUID(manifest.offerId);
  const observationId=validUUID(manifest.observationId);
  const collector=key(manifest.collectorActorKey);
  const sku=key(manifest.variantId),sellerOption=key(manifest.sellerOptionKey);
  const digest=manifest.sourceEvidenceSha256;
  if(!productId||!offerId||!observationId||!collector||!sku||!sellerOption||
    !label(manifest.brand,80)||!label(manifest.productName,160)||
    !label(manifest.sellerName,160)||!key(manifest.sourceName)||
    !label(manifest.sourceRecordId,160)||!sourceIdentity(manifest)||
    typeof digest!=="string"||!DIGEST.test(digest))
    return hold("PRODUCT_LISTING_OR_CAPTURE_IDENTITY_UNRESOLVED");
  if(typeof actualArtifactSha256!=="string"||!DIGEST.test(actualArtifactSha256)||
    digest!==actualArtifactSha256)
    return hold("ARCHIVED_SOURCE_BYTES_DIGEST_MISMATCH");
  const amount=money(manifest.selectedOptionPriceKrw);
  const shippingBasis=manifest.shippingPriceBasis;
  const shipping=manifest.shippingPriceKrw===null?null:money(manifest.shippingPriceKrw,true);
  if(amount===null)return hold("SELECTED_OPTION_PRICE_INVALID");
  if(!((shippingBasis==="unknown"&&shipping===null)||
     (shippingBasis==="seller_published_flat"&&shipping!==null)))
    return hold("SHIPPING_BASIS_UNATTESTED");
  const gifts=composition(manifest);
  if(!gifts)return hold("SELECTED_SKU_PACK_COMPOSITION_INVALID");
  const now=date(nowIso),observed=date(manifest.observedAt);
  if(now===null||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||
    maxAgeMs>MAX_AGE_MS)return hold("FRESHNESS_POLICY_MISSING");
  if(observed===null||observed>now||now-observed>maxAgeMs)
    return hold("CAPTURE_STALE_OR_FUTURE");
  const privateObservationCandidate=Object.freeze({
    observation_id:observationId,offer_id:offerId,
    seller_option_key:sellerOption,variant_id:sku,
    option_kind:manifest.optionKind,unit_size:manifest.unitSize,
    size_unit:manifest.sizeUnit,quantity:manifest.quantity,
    gifts,selected_option_price_krw:amount,
    shipping_price_krw:shipping,shipping_price_basis:shippingBasis,
    observed_at:manifest.observedAt,source_name:manifest.sourceName,
    source_record_id:manifest.sourceRecordId,
    collector_actor_key:collector,source_evidence_sha256:digest
  });
  return Object.freeze({
    ...hold("INDEPENDENT_REVIEW_REQUIRED"),
    status:"CAPTURE_METADATA_MATCH_ONLY",productId,offerId,
    sourceIdentityClass:"OFFLINE_RECOGNIZED_LISTING_ONLY",
    privateObservationCandidate
  });
}
/**
 * An independent review packet remains untrusted until the authenticated
 * administrator checks source pixels, seller identity, real Product admission,
 * and persists append-only provenance under owner-approved DB permissions.
 */
export function prepareIndependentOptionReview({
  capture=null,review=null,nowIso=null,maxAgeMs=null
}={}) {
  if(capture?.status!=="CAPTURE_METADATA_MATCH_ONLY"||
     !capture.privateObservationCandidate)
    return hold("CAPTURE_NOT_READY_FOR_REVIEW");
  if(!review||typeof review!=="object"||Array.isArray(review))
    return Object.freeze({...hold("INDEPENDENT_REVIEW_NOT_SUBMITTED"),
      status:"AWAITING_INDEPENDENT_REVIEW",productId:capture.productId});
  const c=capture.privateObservationCandidate;
  const reviewId=validUUID(review.reviewId);
  const reviewer=key(review.reviewerActorKey);
  const reference=label(review.reviewerReference,160);
  const when=date(review.reviewedAt),now=date(nowIso),observed=date(c.observed_at);
  if(!reviewId||!reviewer||!reference||
     validUUID(review.observationId)!==c.observation_id||
     review.sourceEvidenceSha256!==c.source_evidence_sha256||
     !["verified","rejected"].includes(review.verdict)||
     now===null||when===null||observed===null||when<observed||when>now)
    return hold("REVIEW_IDENTITY_DIGEST_OR_TIME_MISMATCH");
  if(reviewer===c.collector_actor_key)
    return hold("COLLECTOR_CANNOT_SELF_REVIEW");
  if(review.verdict==="verified") {
    const checks=review.checks;
    if(!checks||typeof checks!=="object"||Array.isArray(checks)||
       Object.keys(checks).length!==D8K8_REVIEW_CHECK_KEYS.length||
       !D8K8_REVIEW_CHECK_KEYS.every(name=>checks[name]==="matched"))
      return hold("REVIEW_7_FIELD_ATTESTATION_INCOMPLETE");
  }
  const event=Object.freeze({
    review_id:reviewId,observation_id:c.observation_id,
    verdict:review.verdict,reviewer_reference:reference,
    reviewer_actor_key:reviewer,
    evidence_sha256:c.source_evidence_sha256,
    reviewed_at:review.reviewedAt
  });
  const shadow=selectLatestOptionReviewHistoryShadow({
    observations:[{
      observationId:c.observation_id,productId:capture.productId,
      offerId:c.offer_id,sellerOptionKey:c.seller_option_key,
      collectorActorKey:c.collector_actor_key,
      sourceEvidenceDigest:c.source_evidence_sha256,
      observedAt:c.observed_at,recordedAt:nowIso
    }],
    reviews:[{
      reviewId:event.review_id,observationId:event.observation_id,
      verdict:event.verdict,reviewerActorKey:event.reviewer_actor_key,
      evidenceDigest:event.evidence_sha256,
      reviewedAt:event.reviewed_at,createdAt:nowIso
    }],nowIso,maxAgeMs
  });
  if(shadow.status!=="AUDIT_SHADOW_ONLY"||
     shadow.optionSlots.length!==1||
     shadow.optionSlots[0].state!==(review.verdict==="verified"
       ?"STRUCTURAL_REVIEW_MATCH":"HOLD"))
    return hold("LATEST_REVIEW_HISTORY_CONTRACT_HOLD");
  return Object.freeze({
    ...hold("AUTHENTICATED_ADMIN_ATTESTATION_AND_DB_ADMISSION_NOT_PROVEN"),
    status:review.verdict==="rejected"?"REJECTION_PACKET_READY_NO_WRITE":
      "INDEPENDENT_REVIEW_PACKET_READY_NO_WRITE",
    productId:capture.productId,offerId:capture.offerId,
    privateObservationCandidate:c,
    privateReviewEvent:event,
    sevenFieldReviewComplete:review.verdict==="verified",
    shadowReviewReason:shadow.optionSlots[0].reason
  });
}
