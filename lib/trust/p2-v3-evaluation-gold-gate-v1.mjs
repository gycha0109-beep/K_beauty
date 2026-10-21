/**
 * P2 v3 gold-label evaluation gate — offline ONLY.
 *
 * Catalog size/source are assertions, not gold labels. Review document hashes
 * establish artifact integrity, not independent external factual accuracy.
 * A scorable record needs a reviewable source artifact plus two independent
 * reviewers blind to model predictions; otherwise fail closed.
 */
import {createHash} from "node:crypto";
export const P2V3_GOLD_GATE="trust-p2-v3-independent-gold-ledger-v1";
const PANEL="trust-p2-v3-real-catalog-candidate-panel-v1";
const COHORT="trust-p2d-five-brand-live-cohort-v2";
const dimensions={
  FAMILY_IDENTITY:new Set(["SAME_PRODUCT_FAMILY","DIFFERENT_PRODUCT_FAMILY"]),
  PHYSICAL_UNIT_CAPACITY:new Set(["CATALOG_MATCH","CATALOG_CONFLICT"]),
  OFFER_COMPOSITION:new Set(["SINGLE_CONTAINER","MULTIPACK_SAME_UNIT","MIXED_BUNDLE"]),
  CATALOG_SOURCE_OFFER:new Set(["SAME_SELECTED_OFFER","DIFFERENT_SELECTED_OFFER"]),
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const evidencePath=/^evidence\/trust\/p2v3-review\/[a-zA-Z0-9_.-]+\.json$/;
const fail=x=>{throw Error("P2V3_GOLD_GATE_"+x);};
const clean=(x,keys)=>x&&typeof x==="object"&&!Array.isArray(x)&&
  Object.keys(x).length===keys.length&&
  keys.every(k=>Object.hasOwn(x,k));
const validUrl=x=>{try{
  const u=new URL(x);return u.protocol==="https:"&&
    !u.username&&!u.password&&!u.hash;
}catch{return false;}};
function asEvidenceJson(ref,sha,readBytes){
  if(!evidencePath.test(ref)||!SHA.test(sha)||typeof readBytes!=="function")
    fail("REVIEW_ARTIFACT_UNAVAILABLE");
  let bytes,data;
  try{
    bytes=readBytes(ref);
    if(typeof bytes==="string")bytes=Buffer.from(bytes,"utf8");
    if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>65536)
      fail("REVIEW_ARTIFACT_BYTES_INVALID");
    if(createHash("sha256").update(bytes).digest("hex")!==sha)
      fail("REVIEW_ARTIFACT_HASH_MISMATCH");
    data=JSON.parse(bytes.toString("utf8"));
  }catch(e){
    if(String(e?.message).startsWith("P2V3_GOLD_GATE_"))throw e;
    fail("REVIEW_ARTIFACT_UNREADABLE");
  }
  return data;
}
export function validateP2V3CandidatePanel(panel,stress){
  if(panel?.contract!==PANEL||panel.evaluationGroup!==
    "STRATIFIED_CATEGORY_CANDIDATES"||!Array.isArray(panel.records)||
    panel.records.length!==20||
    panel.selectionQuotas?.categoryCount!==10||
    panel.selectionQuotas?.perCategory!==2||
    panel.operationalSafety?.dbWrites!==0||
    panel.operationalSafety?.firstPartyNetworkRequests!==0||
    panel.operationalSafety?.officialExactSkuConfirmed!==0||
    panel.operationalSafety?.manualGoldLabelsConfirmed!==0||
    panel.operationalSafety?.databaseReadOnly!==true||
    stress?.contract!==COHORT||!Array.isArray(stress.targets)||
    stress.targets.length!==5)fail("INVALID_CANDIDATE_PANEL");
  const blocked=new Set(stress.targets.map(x=>x.productId));
  if(blocked.size!==5)fail("INVALID_STRESS_HOLDOUT");
  const ids=new Set(),categories=new Map();
  for(const x of panel.records){
    if(!clean(x,["productId","brand","name","category","catalogSizeMl",
      "catalogSourceUrlPresent","catalogAssertionUnverified"])||
      !UUID.test(x.productId)||ids.has(x.productId)||blocked.has(x.productId)||
      typeof x.brand!=="string"||!x.brand.trim()||
      typeof x.name!=="string"||!x.name.trim()||
      typeof x.category!=="string"||!x.category.trim()||
      (x.catalogSizeMl!==null&&
        (typeof x.catalogSizeMl!=="number"||
          !Number.isFinite(x.catalogSizeMl)||x.catalogSizeMl<=0))||
      typeof x.catalogSourceUrlPresent!=="boolean"||
      x.catalogAssertionUnverified!==true)
      fail("INVALID_OR_LEAKED_CANDIDATE");
    ids.add(x.productId);
    categories.set(x.category,(categories.get(x.category)??0)+1);
  }
  if(categories.size!==10||[...categories.values()].some(x=>x!==2))
    fail("CATEGORY_QUOTA_NOT_MET");
  return Object.freeze({
    candidateCount:20,categoryCount:categories.size,
    catalogSourceUrlPresent:panel.records.filter(x=>
      x.catalogSourceUrlPresent).length,
    missingCatalogQuantity:panel.records.filter(x=>
      x.catalogSizeMl===null).length,
    stressHoldoutCount:5,
  });
}
export function evaluateP2V3GoldReadiness(panel,stress,ledger,
  {readBytes,predictions=[]}={}){
  const sample=validateP2V3CandidatePanel(panel,stress);
  if(ledger?.contract!==P2V3_GOLD_GATE||
    ledger.panelContract!==PANEL||!Array.isArray(ledger.records)||
    ledger.records.length>sample.candidateCount*4||
    !Array.isArray(predictions)||predictions.length>sample.candidateCount*4)
    fail("INVALID_GOLD_LEDGER");
  const ids=new Set(panel.records.map(x=>x.productId));
  const covered=new Set(),gold=new Map(),predicted=new Map();
  for(const r of ledger.records){
    if(!clean(r,["productId","dimension","goldValue","source","reviewers"])||
      !ids.has(r.productId)||!dimensions[r.dimension]?.has(r.goldValue)||
      covered.has(r.productId+"|"+r.dimension)||
      !clean(r.source,["ref","sha256"])||
      !Array.isArray(r.reviewers)||r.reviewers.length!==2)
      fail("INVALID_ADJUDICATION_RECORD");
    const source=asEvidenceJson(r.source.ref,r.source.sha256,readBytes);
    if(!clean(source,["contract","productId","dimension","sourceKind",
        "sourceUrl","reviewScope","observedClaim"])||
      source.contract!=="trust-p2-v3-reviewable-source-excerpt-v1"||
      source.productId!==r.productId||source.dimension!==r.dimension||
      !["LICENSED_FIRST_PARTY_EXCERPT","REVIEWER_AUTHORIZED_PACKAGING_PHOTO_NOT_STORED",
        "AUTHORIZED_INDEPENDENT_SOURCE_EXCERPT"].includes(source.sourceKind)||
      !validUrl(source.sourceUrl)||!String(source.reviewScope).trim()||
      !String(source.observedClaim).trim())
      fail("SOURCE_ARTIFACT_SCOPE_INVALID");
    const reviewers=new Set(),reviewFiles=new Set();
    for(const reviewer of r.reviewers){
      if(!clean(reviewer,["reviewerId","ref","sha256"])||
        !/^[a-z0-9_.-]{3,64}$/i.test(reviewer.reviewerId)||
        reviewers.has(reviewer.reviewerId)||reviewFiles.has(reviewer.ref)||
        reviewer.ref===r.source.ref)
        fail("TWO_DISTINCT_REVIEWS_REQUIRED");
      reviewers.add(reviewer.reviewerId);reviewFiles.add(reviewer.ref);
      const review=asEvidenceJson(reviewer.ref,reviewer.sha256,readBytes);
      if(!clean(review,["contract","reviewerId","productId","dimension",
        "adjudicatedValue","sourceSha256","blindToModelOutput"])||
        review.contract!=="trust-p2-v3-human-claim-review-v1"||
        review.reviewerId!==reviewer.reviewerId||
        review.productId!==r.productId||review.dimension!==r.dimension||
        review.adjudicatedValue!==r.goldValue||
        review.sourceSha256!==r.source.sha256||
        review.blindToModelOutput!==true)
        fail("REVIEW_DISAGREEMENT_OR_INVALID_ATTESTATION");
    }
    const key=r.productId+"|"+r.dimension;covered.add(key);gold.set(key,r.goldValue);
  }
  for(const p of predictions){
    if(!clean(p,["productId","dimension","value"])||
      !ids.has(p.productId)||!dimensions[p.dimension]||
      (p.value!=="ABSTAIN"&&!dimensions[p.dimension].has(p.value)))
      fail("INVALID_PREDICTION");
    const key=p.productId+"|"+p.dimension;
    if(predicted.has(key))fail("DUPLICATE_PREDICTION");
    predicted.set(key,p.value);
  }
  let attempted=0,correct=0,abstained=0;
  for(const [key,value] of gold){
    const p=predicted.get(key)??"ABSTAIN";
    if(p==="ABSTAIN")abstained++;
    else{
      attempted++;
      if(p===value)correct++;
    }
  }
  return Object.freeze({
    contract:P2V3_GOLD_GATE,
    evaluatedGroup:"STRATIFIED_CATEGORY_CANDIDATES",
    sample,
    scorableIndependentlyAttestedClaims:gold.size,
    unreviewedCandidateProducts:sample.candidateCount-
      new Set([...gold.keys()].map(x=>x.split("|")[0])).size,
    predictionsOnGold:attempted,
    abstentionsOnGold:abstained,
    correctOnGold:correct,
    claimAccuracyOnAttempted:attempted?correct/attempted:null,
    coverageOnGold:gold.size?attempted/gold.size:null,
    // Distinct from SKU accuracy: only annotated dimensions may be scored.
    officialExactSkuConfirmed:0,
    externalSourceAuthenticityProvenByCode:false,
    reviewerIndependenceProvenByCode:false,
    unknownGoldCountMeansNoAccuracy:true,
    dbWrites:0,sourceBindingWrites:0,subjectWrites:0,factWrites:0,
    officialSiteRequests:0,aiApiCalls:0,
  });
}
