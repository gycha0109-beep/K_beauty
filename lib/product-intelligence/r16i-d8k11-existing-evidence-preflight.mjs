// D8K-11: pure, off-line R16I archived-evidence preflight.
// Validates actual bytes when supplied; does NOT access Supabase Storage,
// authenticate the reviewer or independently attest retailer screenshots.
// A positive result is a no-write REVIEW PACKET, NEVER database authority.
import { createHash } from "node:crypto";
import { D8K8_REVIEW_CHECK_KEYS } from "../commerce/product-offer-manual-review-intake-v1.mjs";

export const R16I_D8K11_VERSION="r16i-d8k11-existing-evidence-preflight-v1";
export const R16I_D8K11_PRODUCT_ID="b639c8b4-6a61-440e-b4db-fac7381593ff";
export const R16I_D8K11_SOURCE_IDENTITIES=Object.freeze({
  official_single:Object.freeze({
    url:"https://www.snature.kr/product/detail.html?product_no=151",
    option:"수분크림 80ml 1개",creamUnitMl:80,creamQuantity:1,
    giftSerumMl:0
  }),
  hwahae_bundle:Object.freeze({
    url:"https://www.hwahae.co.kr/goods/45194",
    option:"수분크림 80ml×2 + 세럼 10ml",creamUnitMl:80,
    creamQuantity:2,giftSerumMl:10
  })
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const ALLOWED_MIME=new Set(["image/png","image/jpeg","image/webp"]);
const MAX_BYTES=4194304;
const MAX_AGE_MS=2592000000;
const okUuid=v=>typeof v==="string"&&UUID.test(v);
const parsed=v=>typeof v==="string"&&v.length<=48&&
  /^\d{4}-\d{2}-\d{2}T/.test(v)&&/(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&
  Number.isFinite(Date.parse(v))?Date.parse(v):null;
const reason=v=>typeof v==="string"&&v.length>=12&&v.length<=1000&&
  v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
const safeInt=(v,zero=false)=>Number.isSafeInteger(v)&&v>=(zero?0:1)&&v<=100000000;
function hold(code,extra={}) {
  return Object.freeze({
    version:R16I_D8K11_VERSION,status:"HOLD",reason:code,
    evidenceCount:0,archiveBytesMatchedCount:0,reviewMetadataReadyCount:0,
    records:Object.freeze([]),
    ...extra,
    archivedFileAuthenticityProven:false,
    sellerPageCurrentlyAuthentic:false,reviewerAccountAuthenticated:false,
    legacySelfReviewProtectionVerified:false,
    existingOwnerVerdictVerified:false,productFactApproved:false,
    parentOfferBound:false,databaseWrites:0,pricePublicationAuthorized:false,
    directCtaAuthorized:false,releaseAuthorized:false
  });
}
function validMagic(bytes,mime) {
  if(mime==="image/png")
    return bytes.length>=8&&bytes.subarray(0,8).equals(
      Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==="image/jpeg")
    return bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(mime==="image/webp")
    return bytes.length>=12&&
      bytes.toString("ascii",0,4)==="RIFF"&&
      bytes.toString("ascii",8,12)==="WEBP";
  return false;
}
function inspectOne(entry,bytes,now,maxAgeMs,review=null) {
  if(!entry||typeof entry!=="object"||Array.isArray(entry)||
     !okUuid(entry.evidence_id)||
     entry.product_id!==R16I_D8K11_PRODUCT_ID||
     !Object.hasOwn(R16I_D8K11_SOURCE_IDENTITIES,entry.source_key))
    return {code:"EVIDENCE_PRODUCT_OR_SOURCE_IDENTITY_UNRESOLVED"};
  const expected=R16I_D8K11_SOURCE_IDENTITIES[entry.source_key];
  if(entry.source_url!==expected.url||
     entry.selected_option!==expected.option||
     entry.evidence_state!=="UNVERIFIED")
    return {code:"SOURCE_OPTION_OR_REVIEW_STATE_MISMATCH"};
  if(!safeInt(entry.checkout_price_krw)||!okUuid(entry.submitted_by))
    return {code:"CAPTURE_PRICE_OR_COLLECTOR_ID_MISSING"};
  const captureTime=parsed(entry.captured_at),createdTime=parsed(entry.created_at);
  if(captureTime===null||createdTime===null||createdTime<captureTime||
     captureTime>now||now-captureTime>maxAgeMs)
    return {code:"CAPTURE_STALE_OR_TIME_MISMATCH"};
  if(!ALLOWED_MIME.has(entry.mime_type)||
     !Number.isSafeInteger(entry.file_bytes)||
     entry.file_bytes<8||entry.file_bytes>MAX_BYTES||
     typeof entry.file_sha256!=="string"||!SHA.test(entry.file_sha256)||
     typeof entry.object_path!=="string"||entry.object_path.length>512||
     !entry.object_path.startsWith(R16I_D8K11_PRODUCT_ID+"/")||
     entry.object_path.includes("..")||
     !/^[a-z0-9\-/._]+$/.test(entry.object_path))
    return {code:"ARCHIVE_METADATA_INCOMPLETE"};
  // No bytes, no verified hash. A real Storage path and digest in DB by
  // themselves are merely references, not proof of file custody/content.
  if(bytes===null||bytes===undefined)
    return {code:"PRIVATE_ARCHIVE_BYTES_REQUIRED"};
  if(!Buffer.isBuffer(bytes)&&!(bytes instanceof Uint8Array))
    return {code:"ARCHIVE_BYTES_TYPE_UNSUPPORTED"};
  const buf=Buffer.from(bytes);
  if(buf.length!==entry.file_bytes||!validMagic(buf,entry.mime_type)||
     createHash("sha256").update(buf).digest("hex")!==entry.file_sha256)
    return {code:"ARCHIVE_BYTES_MAGIC_SIZE_OR_SHA_MISMATCH"};

  if(review===null||review===undefined)
    return {code:"INDEPENDENT_REVIEW_NOT_SUBMITTED",archivedBytesMatched:true};
  if(!review||typeof review!=="object"||Array.isArray(review)||
     review.evidence_id!==entry.evidence_id||!okUuid(review.reviewer_id)||
     review.reviewer_id===entry.submitted_by)
    return {code:"INDEPENDENT_REVIEWER_IDENTITY_NOT_SEPARATED",archivedBytesMatched:true};
  const reviewed=parsed(review.reviewed_at);
  if(reviewed===null||reviewed<captureTime||reviewed>now||
     !reason(review.reason)||review.verdict!=="VERIFIED")
    return {code:"REVIEW_VERDICT_REASON_OR_TIME_MISSING",archivedBytesMatched:true};
  const checks=review.checks;
  if(!checks||typeof checks!=="object"||Array.isArray(checks)||
     Object.keys(checks).length!==D8K8_REVIEW_CHECK_KEYS.length||
     !D8K8_REVIEW_CHECK_KEYS.every(k=>checks[k]==="matched"))
    return {code:"SEVEN_SOURCE_CHECKS_NOT_INDEPENDENTLY_ATTESTED",archivedBytesMatched:true};

  // A passed metadata packet is never an authenticated, independently
  // reviewed merchant fact; caller-controlled IDs/checkboxes are not
  // server-verified auth claims and screenshots may be fabricated.
  return {code:"REVIEW_METADATA_COMPLETE_NO_AUTHORITY",
    archivedBytesMatched:true,reviewMetadataReady:true};
}

/**
 * evidenceRows: exactly the two existing R16I admin evidence records
 * (operator-authorized source, NOT end-user untrusted payloads).
 * archivedBytesByEvidenceId: Map of evidence UUID -> privately accessed
 * original Buffer, never serialized in output.
 * reviewByEvidenceId: Map of evidence UUID -> candidate reviewer metadata.
 *
 * This function does not access Storage or persist anything. Never return
 * raw amounts, signed links, hashes, people IDs or archive paths.
 */
export function preflightExistingR16IEvidence({
  evidenceRows=null,archivedBytesByEvidenceId=null,
  reviewByEvidenceId=null,nowIso=null,maxAgeMs=604800000
}={}) {
  const now=parsed(nowIso);
  if(now===null||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<=0||
     maxAgeMs>MAX_AGE_MS)
    return hold("FRESHNESS_POLICY_INVALID");
  if(!Array.isArray(evidenceRows)||evidenceRows.length!==2)
    return hold("EXACT_TWO_DISTINCT_EVIDENCE_REQUIRED");
  const map=new Map(),seen=new Set();
  for(const e of evidenceRows) {
    if(!e||!okUuid(e.evidence_id)||seen.has(e.evidence_id)||
       !Object.hasOwn(R16I_D8K11_SOURCE_IDENTITIES,e.source_key)||
       map.has(e.source_key))
      return hold("DUPLICATE_OR_WRONG_EVIDENCE_SCOPE");
    map.set(e.source_key,e);seen.add(e.evidence_id);
  }
  if(!Object.keys(R16I_D8K11_SOURCE_IDENTITIES).every(k=>map.has(k)))
    return hold("BOTH_RETAILER_SOURCES_REQUIRED");
  const records=[];
  let archiveMatch=0,metadataReady=0;
  for(const source of Object.keys(R16I_D8K11_SOURCE_IDENTITIES)) {
    const e=map.get(source);
    const bytes=archivedBytesByEvidenceId instanceof Map?
      archivedBytesByEvidenceId.get(e.evidence_id):null;
    const review=reviewByEvidenceId instanceof Map?
      reviewByEvidenceId.get(e.evidence_id):null;
    const inspection=inspectOne(e,bytes,now,maxAgeMs,review);
    if(inspection.archivedBytesMatched)archiveMatch++;
    if(inspection.reviewMetadataReady)metadataReady++;
    records.push(Object.freeze({
      sourceKey:source,status:inspection.reviewMetadataReady?
        "REVIEW_METADATA_COMPLETE_NO_WRITE":"HOLD",
      reason:inspection.code,
      archivedBytesMatched:inspection.archivedBytesMatched===true,
      reviewMetadataReady:inspection.reviewMetadataReady===true,
      expectedCreamUnitMl:80,
      expectedCreamQuantity:R16I_D8K11_SOURCE_IDENTITIES[source].creamQuantity,
      expectedGiftSerumMl:R16I_D8K11_SOURCE_IDENTITIES[source].giftSerumMl
    }));
  }
  const bothMetadata=metadataReady===2;
  return hold(bothMetadata?
    "AUTHENTICATED_REVIEW_AND_PRODUCT_FACT_AUTHORITY_UNPROVEN":
    "EXISTING_ARCHIVE_OR_INDEPENDENT_REVIEW_INCOMPLETE",{
    status:bothMetadata?"TWO_REVIEW_METADATA_PACKETS_READY_NO_WRITE":"HOLD",
    evidenceCount:2,archiveBytesMatchedCount:archiveMatch,
    reviewMetadataReadyCount:metadataReady,
    records:Object.freeze(records)
  });
}
