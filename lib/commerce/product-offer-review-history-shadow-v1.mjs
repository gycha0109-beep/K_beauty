// D8K-6: pure offline replica of latest-option/latest-review selection.
// NO trusted reviewer identity, evidence retrieval, DB access, commerce grant
// or amount/URL projection can be established by this module.
export const OPTION_REVIEW_HISTORY_SHADOW_VERSION =
  "d8k6-option-review-history-shadow-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[a-z0-9][a-z0-9_:-]{0,95}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MAX_OBSERVATIONS = 512;
const MAX_REVIEWS = 2048;
const MAX_AGE_MS = 2592000000;
const integer = n => Number.isSafeInteger(n);
const uuid = s => typeof s==="string" && UUID.test(s) ? s.toLowerCase() : null;
const actor = s => typeof s==="string" && KEY.test(s) ? s : null;
const timestamp = s => {
  if(typeof s!=="string"||s.length>48||!/^\d{4}-\d{2}-\d{2}T/.test(s)||
     !/(?:Z|[+-]\d{2}:\d{2})$/.test(s)) return null;
  const n=Date.parse(s);
  return Number.isFinite(n)?n:null;
};
const hold = (reason, observationsExamined=0) => ({
  version: OPTION_REVIEW_HISTORY_SHADOW_VERSION,
  status:"HOLD",reason,observationsExamined,optionSlots:[],
  latestEligibleOptionCount:0,
  actualSourceProvenanceVerified:false,actualReviewerIndependenceVerified:false,
  serverDbRoleAuthorized:false,pricePublicationAuthorized:false,
  purchaseCtaAuthorized:false,productionReleaseAuthorized:false
});
const lex=(a,b)=>a.localeCompare(b,"en");
const sortRecent=(a,b)=>b.when-a.when||b.recorded-a.recorded||lex(b.id,a.id);

export function selectLatestOptionReviewHistoryShadow({
  observations=null,reviews=null,nowIso=null,maxAgeMs=null
}={}) {
  if(!Array.isArray(observations)||observations.length>MAX_OBSERVATIONS||
     !Array.isArray(reviews)||reviews.length>MAX_REVIEWS)
    return hold("AUDIT_INPUT_LIMIT_OR_SHAPE");
  const now=timestamp(nowIso);
  if(now===null||!integer(maxAgeMs)||maxAgeMs<1||maxAgeMs>MAX_AGE_MS)
    return hold("FRESHNESS_BOUNDARY_NOT_DEFINED");

  const byIdentity=new Map();
  const obsIds=new Set(), historyIdentities=new Set();
  const byObsId=new Map();
  for(const row of observations) {
    const id=uuid(row?.observationId),pid=uuid(row?.productId);
    const offer=uuid(row?.offerId),key=actor(row?.sellerOptionKey);
    const collector=actor(row?.collectorActorKey);
    const digest=row?.sourceEvidenceDigest;
    const when=timestamp(row?.observedAt),recorded=timestamp(row?.recordedAt);
    if(!id||!pid||!offer||!key||!collector||
       typeof digest!=="string"||!DIGEST.test(digest)||
       when===null||recorded===null||when>recorded||recorded>now)
      return hold("OBSERVATION_IDENTITY_OR_SOURCE_INVALID",observations.length);
    const identity=JSON.stringify([offer,key]);
    const historyKey=JSON.stringify([offer,key,when]);
    if(obsIds.has(id)||historyIdentities.has(historyKey))
      return hold("DUPLICATE_OBSERVATION_HISTORY",observations.length);
    obsIds.add(id);historyIdentities.add(historyKey);
    const normalized={id,productId:pid,offerId:offer,sellerOptionKey:key,
      collectorActorKey:collector,sourceEvidenceDigest:digest,when,recorded};
    byObsId.set(id,normalized);
    if(!byIdentity.has(identity))byIdentity.set(identity,[]);
    byIdentity.get(identity).push(normalized);
  }
  const reviewByObs=new Map(),reviewIds=new Set(),reviewTimes=new Set();
  for(const row of reviews) {
    const id=uuid(row?.reviewId),obs=uuid(row?.observationId);
    const reviewer=actor(row?.reviewerActorKey);
    const when=timestamp(row?.reviewedAt),recorded=timestamp(row?.createdAt);
    const digest=row?.evidenceDigest;
    if(!id||!obs||!byObsId.has(obs)||!reviewer||
      (row?.verdict!=="verified"&&row?.verdict!=="rejected")||
      typeof digest!=="string"||!DIGEST.test(digest)||
      when===null||recorded===null||when>recorded||recorded>now)
      return hold("REVIEW_EVENT_INVALID_OR_ORPHANED",observations.length);
    const reviewTimeKey=JSON.stringify([obs,when]);
    if(reviewIds.has(id)||reviewTimes.has(reviewTimeKey))
      return hold("DUPLICATE_REVIEW_EVENT",observations.length);
    reviewIds.add(id);reviewTimes.add(reviewTimeKey);
    const normalized={id,observationId:obs,reviewerActorKey:reviewer,
      verdict:row.verdict,evidenceDigest:digest,when,recorded};
    if(!reviewByObs.has(obs))reviewByObs.set(obs,[]);
    reviewByObs.get(obs).push(normalized);
  }

  const optionSlots=[];
  for(const history of byIdentity.values()) {
    history.sort(sortRecent);
    const latest=history[0];
    const events=reviewByObs.get(latest.id)||[];
    events.sort(sortRecent);
    const review=events[0]||null;
    let state="HOLD",reason="NO_LATEST_OBSERVATION_REVIEW";
    if(latest.when>now||now-latest.when>maxAgeMs)
      reason="LATEST_OBSERVATION_STALE";
    else if(review?.verdict==="rejected")
      reason="LATEST_REVIEW_REVOKED";
    else if(review) {
      if(review.when<latest.when)
        reason="REVIEW_PREDATES_OBSERVATION";
      else if(review.reviewerActorKey===latest.collectorActorKey)
        reason="REVIEWER_EQUALS_COLLECTOR";
      else if(review.evidenceDigest!==latest.sourceEvidenceDigest)
        reason="REVIEW_DIGEST_MISMATCH";
      else {
        state="STRUCTURAL_REVIEW_MATCH";
        reason="SERVER_REVIEW_IDENTITY_AND_SOURCE_NOT_PROVEN";
      }
    }
    optionSlots.push(Object.freeze({
      productId:latest.productId,
      offerId:latest.offerId,
      sellerOptionKey:latest.sellerOptionKey,
      latestObservationId:latest.id,
      latestReviewId:review?.id||null,
      state,reason,
      // No seller prices/shipping/links are serialized even for a match.
      observedPrice:null,shippingCost:null,ctaHref:null
    }));
  }
  optionSlots.sort((a,b)=>lex(a.productId,b.productId)||
    lex(a.offerId,b.offerId)||lex(a.sellerOptionKey,b.sellerOptionKey));
  return {
    ...hold("SOURCE_AND_ACTOR_PROVENANCE_NOT_PROVEN",observations.length),
    status:"AUDIT_SHADOW_ONLY",
    optionSlots,
    latestEligibleOptionCount:optionSlots.filter(s=>
      s.state==="STRUCTURAL_REVIEW_MATCH").length
  };
}
