/**
 * P3 PR-D0 read-only acceptance funnel. Never changes a candidate, extracted
 * claim, Fact/Subject/Source authority, or the frozen six-URL source cohort.
 * Every emitted status is a fixed code; no source text/DOM/option value copied.
 */
export const TRUST_P3_FUNNEL_VERSION="trust-p3-readonly-funnel-v1";
export const TRUST_P3_FUNNEL_STAGES=Object.freeze([
  "NOT_EXECUTED","SOURCE_HOLD","ROOT_PARSER_HOLD","PRIMARY_ROOT_HOLD",
  "OWNED_FORM_HOLD","SIZE_NOT_EVALUATED","SIZE_SELECTION_HOLD",
  "SELECTED_SIZE_MATCH_SHADOW_ONLY",
]);
const FETCHED=new Set(["DIRECT_PRODUCT_CANDIDATE_REVIEW_REQUIRED",
  "IDENTITY_OR_VARIANT_REVIEW_REQUIRED"]);
const cap=n=>Math.min(Math.max(0,Number(n)||0),99);
const flags=(stage,readable)=>Object.freeze({
  contract:TRUST_P3_FUNNEL_VERSION,stage,
  htmlFetched:readable,
  primaryNameAndOwnedFormObserved:readable&&
    ["SIZE_NOT_EVALUATED","SIZE_SELECTION_HOLD","SELECTED_SIZE_MATCH_SHADOW_ONLY"].includes(stage),
  explicitSelectedSizeMatchObserved:stage==="SELECTED_SIZE_MATCH_SHADOW_ONLY",
  policyEligibilityAuthorized:false,
  selectedSizeVerified:false,exactSkuVerified:false,marketVerified:false,
  formulationVerified:false,sourceBindingAuthorized:false,
  subjectCreationAuthorized:false,factConfirmationAuthorized:false,
  recommendationWrites:0,dbWrites:0,aiApiCalls:0,
});
export function classifyTrustP3ReadOnlyFunnelRow(row){
  if(row?.status==="PLAN_ONLY")return flags("NOT_EXECUTED",false);
  if(!FETCHED.has(row?.status)||!row?.live)return flags("SOURCE_HOLD",false);
  const root=row.live.strictPrimaryRoot;
  if(root?.parseComplete!==true)return flags("ROOT_PARSER_HOLD",true);
  if(root.status==="OWNER_FORM_UNPROVEN")return flags("OWNED_FORM_HOLD",true);
  if(root.status!=="SCOPED_NAME_AND_FORM_CANDIDATE")
    return flags("PRIMARY_ROOT_HOLD",true);
  const selected=root.selectedVariantShadow;
  if(!selected||typeof selected.status!=="string")
    return flags("SIZE_NOT_EVALUATED",true);
  if(selected.status==="SELECTED_SIZE_MATCH_SHADOW_ONLY"&&
    selected.catalogSizeMatchShadow===true&&
    selected.exactSkuVerified===false&&selected.selectedSizeVerified===false)
    return flags("SELECTED_SIZE_MATCH_SHADOW_ONLY",true);
  return flags("SIZE_SELECTION_HOLD",true);
}
export function summarizeTrustP3ReadOnlyFunnel(rows){
  if(!Array.isArray(rows)||rows.length>25)
    throw Error("TRUST_P3_FUNNEL_INVALID_ROWS");
  const stageCounts=Object.fromEntries(TRUST_P3_FUNNEL_STAGES.map(k=>[k,0]));
  let fetched=0,ownerObserved=0,selectedObserved=0,legacyCandidate=0;
  for(const row of rows){
    const result=classifyTrustP3ReadOnlyFunnelRow(row);
    stageCounts[result.stage]++;
    if(result.htmlFetched)fetched++;
    if(result.primaryNameAndOwnedFormObserved)ownerObserved++;
    if(result.explicitSelectedSizeMatchObserved)selectedObserved++;
    if(result.htmlFetched&&row.live?.gate==="EVIDENCE_CANDIDATE_ONLY")
      legacyCandidate++;
  }
  return Object.freeze({
    contract:TRUST_P3_FUNNEL_VERSION,
    denominators:{officialLocators:cap(rows.length),htmlFetched:cap(fetched)},
    stageCounts:Object.fromEntries(Object.entries(stageCounts).map(([k,v])=>[k,cap(v)])),
    primaryNameAndOwnedFormObserved:cap(ownerObserved),
    explicitSelectedSizeMatchObserved:cap(selectedObserved),
    existingP3ReviewCandidates:cap(legacyCandidate),
    policyEligibilityAuthorized:false,
    verifiedExactSkuCount:0,verifiedMarketCount:0,verifiedFormulationCount:0,
    newSourceBindings:0,subjectWrites:0,factWrites:0,recommendationWrites:0,
    dbWrites:0,aiApiCalls:0,
  });
}
