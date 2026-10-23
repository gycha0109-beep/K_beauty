/**
 * R2-R5 policy experiment: limited-fit shadow separated from governed Fact/G2.
 *
 * This is NOT a production admission, Fact confirmation or score adjustment.
 * Input is supplied by a future trusted server reader, never an end-user form.
 * Neither a branded URL nor a seller SKU is proof of formulation equivalence.
 */
export const CLEANSER_EVIDENCE_TIER_SHADOW_VERSION="cleanser-evidence-tier-shadow-v1";
export const CLEANSER_EVIDENCE_TIER=Object.freeze({
  REVIEW_HOLD:"REVIEW_HOLD",
  IDENTITY_ONLY:"IDENTITY_ONLY",
  LIMITED_FIT_SHADOW:"LIMITED_FIT_SHADOW"
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEYS=new Set(["texture","finish","user_reported_feel","user_reported_skin_type"]);
const VALUES=Object.freeze({
  texture:new Set(["gel","foam","cream","balm","oil","water","other"]),
  finish:new Set(["light","rich","non_greasy","other"]),
  user_reported_feel:new Set(["comfortable","dry_feeling","tight_feeling","other"]),
  user_reported_skin_type:new Set(["dry","oily","combination","sensitive","other"])
});
const SOURCE_KINDS=new Set(["review_aggregate","reviewed_product_description"]);
const isString=x=>typeof x==="string"&&x.trim().length>0;
const validDate=x=>isString(x)&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const FRESHNESS_DAYS=365;
function withinReviewWindow(date,now){
  if(!validDate(date))return false;
  const diff=now.getTime()-Date.parse(date);
  return diff>=0&&diff<=FRESHNESS_DAYS*86400000;
}
function validIdentity(e,product,now){
  return e?.product_id===product.id&&e?.market==="KR"&&
    e?.match_state==="reviewed_exact_product"&&
    ["review_capture","seller_product_page","brand_product_page"].includes(e?.source_kind)&&
    isString(e?.source_ref)&&isString(e?.reviewed_by)&&
    withinReviewWindow(e.reviewed_at,now)&&withinReviewWindow(e.observed_at,now);
}
function validSignal(s,product,now){
  return s?.product_id===product.id&&s?.market==="KR"&&
    KEYS.has(s.key)&&VALUES[s.key].has(s.value)&&
    SOURCE_KINDS.has(s.source_kind)&&isString(s.source_ref)&&
    isString(s.reviewed_by)&&withinReviewWindow(s.reviewed_at,now)&&
    withinReviewWindow(s.observed_at,now)&&
    s.review_state==="reviewed"&&
    (s.source_kind!=="review_aggregate"||(Number.isSafeInteger(s.sample_count)&&s.sample_count>=10))&&
    (s.source_kind!=="reviewed_product_description"||
      ["texture","finish"].includes(s.key));
}
const frozen=(x)=>Object.freeze(x);
const emptyLabels=frozen([]);
/**
 * A limited-tier outcome means only that a later approved ranking design could
 * evaluate these *bounded preference observations*. It is not an admission,
 * cannot be used as a full-skin score and does not assert product efficacy.
 */
export function evaluateCleanserEvidenceTierShadowV1({
  product,identityEvidence=null,preferenceSignals=[],conflictSignals=[],
  now=new Date("2026-10-23T00:00:00Z")
}={}){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime())||
    !Array.isArray(preferenceSignals)||preferenceSignals.length>100||
    !Array.isArray(conflictSignals)||conflictSignals.length>100)
    throw new TypeError("INVALID_EVIDENCE_TIER_INPUT");
  const validProduct=UUID.test(String(product?.id||""))&&product.category==="cleanser"&&
    isString(product.brand)&&isString(product.name)&&
    isString(product.normalized_brand)&&isString(product.normalized_name);
  const conflict=conflictSignals.some(x=>
    x==="PRODUCT_IDENTITY_COLLISION"||
    x==="EXACT_PRODUCT_CAPTURE_MISMATCH"||
    x==="PRODUCT_MARKET_AMBIGUOUS"
  );
  const reasons=[];
  if(!validProduct)reasons.push("CANONICAL_CLEANSER_IDENTITY_REQUIRED");
  if(conflict)reasons.push("PRODUCT_IDENTITY_CONFLICT_REVIEW_REQUIRED");
  let tier=CLEANSER_EVIDENCE_TIER.IDENTITY_ONLY;
  if(!validProduct||conflict)tier=CLEANSER_EVIDENCE_TIER.REVIEW_HOLD;
  const exactIdentity=validProduct&&validIdentity(identityEvidence,product,now);
  if(!exactIdentity)reasons.push("REVIEWED_PRODUCT_LEVEL_IDENTITY_REQUIRED_FOR_LIMITED_FIT");
  const accepted=validProduct?
    preferenceSignals.filter(x=>validSignal(x,product,now)):[];
  if(!accepted.length)reasons.push("REVIEWED_NONFACT_PREFERENCE_SIGNAL_REQUIRED");
  if(accepted.length!==preferenceSignals.length)
    reasons.push("UNREVIEWED_STALE_UNSCOPED_OR_FUNCTIONAL_SIGNAL_IGNORED");
  if(tier!==CLEANSER_EVIDENCE_TIER.REVIEW_HOLD&&exactIdentity&&accepted.length)
    tier=CLEANSER_EVIDENCE_TIER.LIMITED_FIT_SHADOW;
  // Never accept a fact-like property as a bounded preference dimension.
  const seen=new Set();
  const bounded=accepted.filter(x=>{
    const key=x.key+"|"+x.value;
    if(seen.has(key))return false;seen.add(key);return true;
  }).map(x=>frozen({key:x.key,value:x.value,source_kind:x.source_kind,
    source_ref:x.source_ref,qualified_as:"OBSERVATION_NOT_PRODUCT_FACT"}))
    .sort((a,b)=>(a.key+"|"+a.value).localeCompare(b.key+"|"+b.value,"en"));
  return frozen({
    version:CLEANSER_EVIDENCE_TIER_SHADOW_VERSION,
    product_id:validProduct?product.id:null,
    tier,
    manufacturer_direct_reply_required:false,
    exact_cross_size_formula_match_required_for_limited_fit:false,
    controlled_nonfact_signals:frozen(tier===CLEANSER_EVIDENCE_TIER.LIMITED_FIT_SHADOW?bounded:[]),
    fact_claims:emptyLabels,
    low_ph:"UNKNOWN",
    deep_cleansing:"UNKNOWN",
    cross_size_fact_reuse_authorized:false,
    independent_governed_fact_confirmation:"NOT_PERFORMED",
    reasons:frozen([...new Set(reasons)].sort()),
    shadow_limited_fit_candidate:tier===CLEANSER_EVIDENCE_TIER.LIMITED_FIT_SHADOW,
    actual_recommendation_candidate_admitted:false,
    runtime_score_modified:false,
    product_fact_created:false,
    source_binding_approved:false,
    g2_grant_issued:false,
    production_writes:0
  });
}
