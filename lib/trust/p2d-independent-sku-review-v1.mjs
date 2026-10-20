/**
 * P2 independent exact-SKU adjudication ledger (offline, read-only).
 *
 * Official discovery output remains locator/candidate evidence. The only route
 * to an independently adjudicated count is an external, two-reviewer record
 * tied to a frozen first-party page digest and the immutable catalog target.
 * This checks attestations and lineage, NOT the truth of an external source.
 * No Subject, Fact, market, formulation, license or binding authority follows.
 */
export const P2D_INDEPENDENT_REVIEW_CONTRACT="trust-p2d-independent-sku-review-v1";
const HASH=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MATCH="IDENTITY_CANDIDATE_REVIEW_REQUIRED";
const NON_SKU_HOLDS=Object.freeze({
  "닥터지":"OFFICIAL_ORIGIN_ACCESS_HOLD",
  "비플레인":"CATALOG_UNIT_AND_OFFER_RECONCILIATION_REQUIRED",
  "아토팜":"CATALOG_600ML_VS_OBSERVED_300ML_RECONCILIATION_REQUIRED",
  "토리든":"PRIMARY_OFFER_AND_SELECTED_50ML_NOT_PROVEN",
});
function invalid(reason){throw Error("P2D_INDEPENDENT_REVIEW_"+reason);}
function exactKeys(o,required,allowed=required){
  if(!o||typeof o!=="object"||Array.isArray(o)||
    !required.every(k=>Object.hasOwn(o,k))||
    Object.keys(o).some(k=>!allowed.includes(k)))invalid("INVALID_FIELDS");
}
function safeOfficialUrl(url,origin){
  if(typeof url!=="string")return false;
  try{
    const u=new URL(url);
    return u.origin===origin&&u.protocol==="https:"&&!u.username&&!u.password&&
      !u.hash&&(!u.port||u.port==="443");
  }catch{return false;}
}
function assertFrozen(cohort,observed){
  if(cohort?.contract!=="trust-p2d-five-brand-live-cohort-v2"||
    !Array.isArray(cohort.targets)||cohort.targets.length!==5||
    observed?.contract!=="trust-p2f6-public-pre-resolved-readonly-evidence-v1"||
    observed.frozenDenominator!==5||
    !Array.isArray(observed.outcomes)||observed.outcomes.length!==5||
    new Set(cohort.targets.map(t=>t.brand)).size!==5||
    new Set(cohort.targets.map(t=>t.productId)).size!==5||
    new Set(observed.outcomes.map(t=>t.brand)).size!==5)
    invalid("FROZEN_COHORT_MISMATCH");
  for(const t of cohort.targets){
    if(!UUID.test(t.productId)||!UUID.test(t.intakeId)||
      typeof t.name!=="string"||!t.name.trim()||
      !Number.isFinite(t.sizeMl)||t.sizeMl<=0||
      !observed.outcomes.some(o=>o.brand===t.brand))
      invalid("FROZEN_COHORT_MISMATCH");
    const o=observed.outcomes.find(o=>o.brand===t.brand);
    if(o.catalogSizeMl!==undefined&&o.catalogSizeMl!==t.sizeMl)
      invalid("CATALOG_QUANTITY_DRIFT");
    if(o.pageSha256!==undefined&&!HASH.test(o.pageSha256))
      invalid("OBSERVED_SOURCE_DIGEST_INVALID");
  }
}
/**
 * External human evidence references are not downloaded or parsed here.
 * Reviewer attestations must be independently checked before writing a
 * CONFIRMED review record into the ledger. Test fixtures are NOT evidence.
 */
function validateConfirmation(r,target,observation,source){
  exactKeys(r,["productId","intakeId","brand","decision","pageSha256",
    "pageUrl","catalogName","catalogSizeMl","checks","reviewers"]);
  if(r.productId!==target.productId||r.intakeId!==target.intakeId||
    r.brand!==target.brand||r.catalogName!==target.name||
    r.catalogSizeMl!==target.sizeMl||r.decision!=="EXACT_SKU_CONFIRMED")
    invalid("IDENTITY_OR_CATALOG_DRIFT");
  if(observation.state!==MATCH||observation.exactSkuVerified!==false||
    !HASH.test(r.pageSha256)||r.pageSha256!==observation.pageSha256)
    invalid("NO_INDEPENDENTLY_REVIEWABLE_PAGE");
  const origin=new URL(target.officialPeerUrl).origin;
  if(!safeOfficialUrl(r.pageUrl,origin)||r.pageUrl!==source.sourceUrl||
    source.eligibleForDirectProbe!==true||source.productId!==target.productId||
    source.catalogSizeMl!==target.sizeMl)
    invalid("SOURCE_PROVENANCE_MISMATCH");
  exactKeys(r.checks,["primaryProductIdentity","singleSkuOffer",
    "catalogQuantityAndUnit","selectedPackageOwnership","notBundleOrGift"]);
  if(Object.values(r.checks).some(x=>x!==true))
    invalid("UNPROVEN_SKU_PREDICATE");
  if(!Array.isArray(r.reviewers)||r.reviewers.length!==2)
    invalid("TWO_INDEPENDENT_REVIEWS_REQUIRED");
  const reviewerIds=new Set(),proofRefs=new Set();
  for(const reviewer of r.reviewers){
    exactKeys(reviewer,["reviewerId","independentEvidenceRef",
      "independentEvidenceSha256","reviewedAtUtc"]);
    if(typeof reviewer.reviewerId!=="string"||
      !/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(reviewer.reviewerId)||
      reviewerIds.has(reviewer.reviewerId)||
      typeof reviewer.independentEvidenceRef!=="string"||
      !/^evidence\/trust\/[a-zA-Z0-9/_.-]+\.json$/.test(reviewer.independentEvidenceRef)||
      reviewer.independentEvidenceRef.includes("..")||
      proofRefs.has(reviewer.independentEvidenceRef)||
      !HASH.test(reviewer.independentEvidenceSha256)||
      typeof reviewer.reviewedAtUtc!=="string"||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(reviewer.reviewedAtUtc)||
      !Number.isFinite(Date.parse(reviewer.reviewedAtUtc)))
      invalid("INDEPENDENT_REVIEW_PROVENANCE_INVALID");
    reviewerIds.add(reviewer.reviewerId);
    proofRefs.add(reviewer.independentEvidenceRef);
  }
}
/**
 * Reports the independently adjudicated metric separately from automatic
 * discovery. This is neither auto-identity classification nor publication
 * clearance. Frozen historical observations stay unmodified.
 */
export function evaluateTrustP2DIndependentSkuReview(cohort,observed,index,ledger){
  assertFrozen(cohort,observed);
  if(index?.contract!=="trust-p2f6-ad-remeasurement-readiness-v1"||
    !Array.isArray(index.publicIndexReview)||index.publicIndexReview.length!==5||
    ledger?.contract!==P2D_INDEPENDENT_REVIEW_CONTRACT||
    ledger.cohortContract!==cohort.contract||
    ledger.observationContract!==observed.contract||
    !Array.isArray(ledger.records)||ledger.records.length>5)
    invalid("MANIFEST_INVALID");
  const seen=new Set(),reviewed=new Set();
  for(const r of ledger.records){
    const target=cohort.targets.find(t=>t.productId===r?.productId);
    if(!target||seen.has(r.productId))invalid("UNKNOWN_OR_DUPLICATE_PRODUCT");
    seen.add(r.productId);
    const observation=observed.outcomes.find(o=>o.brand===target.brand);
    const source=index.publicIndexReview.find(s=>s.brand===target.brand);
    if(!source)invalid("MISSING_FROZEN_SOURCE");
    validateConfirmation(r,target,observation,source);
    reviewed.add(target.productId);
  }
  const items=cohort.targets.map(target=>{
    const o=observed.outcomes.find(x=>x.brand===target.brand);
    const independentlyReviewed=reviewed.has(target.productId);
    const nextGate=independentlyReviewed?"INDEPENDENT_REVIEW_ATTESTED":
      NON_SKU_HOLDS[target.brand]??(o.state===MATCH?
        "INDEPENDENT_SOURCE_AND_PACKAGE_REVIEW_REQUIRED":
        "PRIMARY_PRODUCT_IDENTITY_AND_SELECTED_OFFER_REVIEW_REQUIRED");
    return Object.freeze({
      productId:target.productId,brand:target.brand,
      catalogSizeMl:target.sizeMl,observedState:o.state,nextGate,
      independentlyReviewedExactSku:independentlyReviewed,
      subjectCreationAuthorized:false,factConfirmationAuthorized:false,
    });
  });
  return Object.freeze({
    contract:P2D_INDEPENDENT_REVIEW_CONTRACT,
    denominator:5,observedPageDownloads:observed.successfulProductPageDownloads,
    nameAndSizeCandidates:observed.identityNameAndSizeCandidateProducts,
    independentlyAdjudicatedExactSkuCount:reviewed.size,
    notAutomaticallyVerified:true,
    reviewerEvidenceExternallyCheckedByThisCode:false,
    subjectWrites:0,factWrites:0,sourceBindingWrites:0,dbWrites:0,
    marketVerifiedCount:0,formulationVerifiedCount:0,
    items,
  });
}
