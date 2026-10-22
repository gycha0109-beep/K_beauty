import { validateHwahaeReviewCaptureEnvelope } from "./hwahae-review-capture-provenance.js";

/**
 * READ-ONLY: derive a publisher capture only from an existing governed Product
 * Evidence Source record + exact Subject binding. A JSON signal aggregate in
 * products is never a substitute for provenance. No source rows are created.
 */
export const CLEANSER_HWAHAE_GOVERNED_CAPTURE_READER_VERSION =
  "cleanser-hwahae-governed-capture-reader-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST=/^[0-9a-f]{64}$/i;
function exactLocator(a,b){
  try{
    const x=new URL(a),y=new URL(b);
    if(x.protocol!=="https:"||y.protocol!=="https:"||x.username||y.username||
      x.password||y.password||x.hash||y.hash)return false;
    return x.hostname.toLowerCase()===y.hostname.toLowerCase() &&
      x.pathname.replace(/\/$/,"")===y.pathname.replace(/\/$/,"") &&
      x.search===y.search;
  }catch{return false}
}
const usable=value=>!!value&&typeof value==="object"&&!Array.isArray(value);
export function materializeGovernedCleanserHwahaeCapture({
  product,subject,evidenceSources=[],sourceSubjectBindings=[],now=new Date(),
}={}){
  if(!UUID.test(String(product?.id||""))||product.category!=="cleanser"||
    !UUID.test(String(subject?.subject_id||""))||subject.product_id!==product.id||
    subject.current_state!=="current"||subject.identity_status!=="resolved"||
    subject.market_applicability!=="KR"||!Number.isFinite(now?.getTime?.())){
    return null;
  }
  const candidates=[];
  for(const source of evidenceSources){
    if(source?.publisher!=="hwahae"||source.source_kind!=="product_review_aggregate"||
      source.market!=="KR"||!UUID.test(String(source.source_id||""))||
      !DIGEST.test(String(source.content_digest||""))||
      !exactLocator(source.canonical_locator,product.hwahae_url)||
      !usable(source.source_metadata?.capture_envelope))continue;
    const observedAt=Date.parse(source.observed_at);
    if(!Number.isFinite(observedAt)||observedAt>now.getTime()||
      now.getTime()-observedAt>180*86400000)continue;
    // Verify the independently retained source-page evidence reference rather
    // than reserializing today's review_signals into fabricated "capture".
    if(typeof source.external_snapshot_reference!=="string"||
      source.external_snapshot_reference.trim().length===0)continue;
    const bindings=sourceSubjectBindings.filter(row=>
      row?.source_id===source.source_id&&row.product_id===product.id&&
      row.subject_id===subject.subject_id&&row.binding_state==="exact_subject_match"&&
      row.scope_relation==="equivalent");
    if(bindings.length!==1)continue;
    const envelope=source.source_metadata.capture_envelope;
    if(envelope.productId!==product.id||
      !exactLocator(envelope.capture_source?.canonical_locator,source.canonical_locator)||
      envelope.capture_source?.content_digest!==source.content_digest||
      Date.parse(envelope.capture_source?.observed_at)!==observedAt)continue;
    const validation=validateHwahaeReviewCaptureEnvelope(envelope,{now});
    if(!validation.valid)continue;
    candidates.push(envelope);
  }
  // Multiple valid sources might describe different captures; choose none
  // rather than arbitrarily elevating a possibly stale/replaced snapshot.
  return candidates.length===1?structuredClone(candidates[0]):null;
}
