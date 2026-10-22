import {
  evaluateCleanserInitialAdmissionPreflight,
} from "./cleanser-initial-admission-preflight-v1.mjs";
import {
  validateHwahaeReviewCaptureEnvelope,
} from "./hwahae-review-capture-provenance.js";

export const CLEANSER_GOVERNED_ADMISSION_SHADOW_VERSION =
  "cleanser-governed-initial-admission-shadow-v1";
const HEX64=/^[a-f0-9]{64}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_SEMANTIC_FIELDS=Object.freeze(["skin_types","concerns"]);
const hasText=v=>typeof v==="string"&&v.trim().length>0;
function exactHttps(a,b){
  try{
    const x=new URL(a),y=new URL(b);
    return x.protocol==="https:"&&y.protocol==="https:" &&
      !x.username&&!x.password&&!y.username&&!y.password &&
      x.hostname.toLowerCase()===y.hostname.toLowerCase() &&
      x.pathname.replace(/\/$/,"")===y.pathname.replace(/\/$/,"");
  }catch{return false}
}
function reviewIsSourceBound(review,product,field,now,subject,observations,officialBindings){
  if(!review||review.product_id!==product.id||review.field_name!==field ||
    review.review_state!=="confirmed" || review.confidence!=="high" ||
    !UUID.test(String(review.reviewed_by||"")) || !HEX64.test(String(review.evidence_digest||""))||
    !Array.isArray(review.evidence_refs)||!review.evidence_refs.length ||
    !Array.isArray(review.evidence_records)||!review.evidence_records.length) return false;
  const t=Date.parse(review.reviewed_at);
  if(!Number.isFinite(t)||t>now.getTime()||now.getTime()-t>180*86400000) return false;
  let parsed;
  try{parsed=JSON.parse(review.field_value)}catch{return false}
  const expected=product[field];
  if(!Array.isArray(parsed)||!Array.isArray(expected)||!parsed.length||
    parsed.some(x=>!hasText(x))||expected.some(x=>!hasText(x))) return false;
  return parsed.length===expected.length &&
    [...parsed].sort().every((v,i)=>v===[...expected].sort()[i]) &&
    review.evidence_records.some(row=>
      row&&row.source_authority==="product_specific_primary"&&
      row.product_id===product.id&&
      HEX64.test(String(row.content_digest||"")) &&
      (officialBindings||[]).some(binding=>
        binding?.product_id===product.id && binding.binding_state==="resolved" &&
        binding.product_scope_state==="product" &&
        typeof binding.source_name==="string" && /^[a-z0-9_]+_official$/.test(binding.source_name) &&
        exactHttps(row.official_source_url,binding.source_url) &&
        (observations||[]).some(obs=>
          obs?.product_id===product.id && obs.subject_id===subject?.subject_id &&
          obs.source_binding_id===binding.binding_id &&
          obs.source_content_digest===row.content_digest &&
          exactHttps(obs.canonical_locator,row.official_source_url)
        )
      ));
}
/**
 * Shadow-only authority evaluation: may propose future INITIAL eligibility,
 * but never issues recommendation G2 grants, changes runtime candidates,
 * or asserts scientific efficacy or universally safe use.
 *
 * All input MUST be materialized by a trusted server-side DB adapter.
 * A client-supplied metadata review or review envelope has no authority.
 */
export function evaluateCleanserGovernedAdmissionShadow(snapshot,{now=new Date()}={}){
  const preflight=evaluateCleanserInitialAdmissionPreflight({...snapshot,now});
  const product=snapshot?.product;
  const subject=snapshot?.subject;
  const blockers=[...preflight.blockers,...preflight.conflicts];
  if(preflight.state!=="AUTO_ADMISSION_PREFLIGHT_PASS") blockers.push("CLEANSER_PREFLIGHT_INCOMPLETE");
  const reviewRows=Array.isArray(snapshot?.metadataReviews)?snapshot.metadataReviews:[];
  for(const field of REQUIRED_SEMANTIC_FIELDS){
    const matches=reviewRows.filter(row=>row?.field_name===field && row.product_id===product?.id);
    if(matches.length!==1||!reviewIsSourceBound(matches[0],product,field,now,subject,snapshot?.observations,snapshot?.officialBindings))
      blockers.push("GOVERNED_RECOMMENDATION_METADATA_REQUIRED:"+field);
  }
  const capture=snapshot?.hwahaeCaptureEnvelope;
  const validation=capture?validateHwahaeReviewCaptureEnvelope(capture,{now}):{valid:false};
  if(!validation.valid||capture?.productId!==product?.id||
     !exactHttps(capture?.capture_source?.canonical_locator,product?.hwahae_url) ||
     !hasText(capture?.capture_source?.content_digest)){
    blockers.push("VERIFIED_HWAHAE_CAPTURE_ENVELOPE_REQUIRED");
  }
  // These fields are deliberately absent from the current DB corpus.
  // Preflight and provenance must be evaluated against the SAME current Subject.
  const scope=snapshot?.subjectScopeAttestation;
  if(!scope||scope.product_id!==product?.id||scope.subject_id!==subject?.subject_id ||
     scope.current_state!=="current"||scope.identity_status!=="resolved"||
     scope.market!=="KR"||!HEX64.test(String(scope.evidence_digest||""))||
     scope.authority!=="governed_exact_subject_identity"){
    blockers.push("CURRENT_SUBJECT_ATTESTATION_REQUIRED");
  }
  const reasons=Object.freeze([...new Set(blockers)].sort());
  return Object.freeze({
    version:CLEANSER_GOVERNED_ADMISSION_SHADOW_VERSION,
    productId:preflight.productId,
    decision:reasons.length?"NO_SHADOW_ELIGIBILITY":"SHADOW_ELIGIBLE_FOR_INITIAL_ADMISSION",
    shadowEligible:reasons.length===0,
    reasons,
    preflightState:preflight.state,
    reviewConfidence:preflight.reviewConfidence,
    actualAdmissionGranted:false,
    governedG2GrantIssued:false,
    runtimeCandidateIncluded:false,
    liveRankingChanged:false,
    productionWrites:0,
  });
}
