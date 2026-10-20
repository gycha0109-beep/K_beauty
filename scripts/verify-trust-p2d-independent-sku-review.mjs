#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";
import {evaluateTrustP2DIndependentSkuReview} from "../lib/trust/p2d-independent-sku-review-v1.mjs";
import {reportTrustP2DIndependentSkuReview,
  validateTrustP2DReviewEvidenceFiles} from "./report-trust-p2d-independent-sku-review.mjs";

const load=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const cohort=load("evidence/trust/p2d-five-brand-cohort-v2.json");
const observed=load("evidence/trust/p2f6-pre-resolved-readonly-observed-20261019.json");
const index=load("evidence/trust/p2f6-ad-remeasurement-readiness-20261019.json");
const ledger=load("evidence/trust/p2d-independent-sku-review-ledger-v1.json");
const evaluate=(c=cohort,o=observed,i=index,l=ledger)=>
  evaluateTrustP2DIndependentSkuReview(c,o,i,l);
const original=evaluate();
assert.deepEqual(original,reportTrustP2DIndependentSkuReview());
assert.equal(original.denominator,5);
assert.equal(original.observedPageDownloads,2);
assert.equal(original.nameAndSizeCandidates,1);
assert.equal(original.independentlyAdjudicatedExactSkuCount,0);
assert.deepEqual(original.items.map(x=>x.nextGate),[
  "OFFICIAL_ORIGIN_ACCESS_HOLD",
  "CATALOG_UNIT_AND_OFFER_RECONCILIATION_REQUIRED",
  "CATALOG_600ML_VS_OBSERVED_300ML_RECONCILIATION_REQUIRED",
  "INDEPENDENT_SOURCE_AND_PACKAGE_REVIEW_REQUIRED",
  "PRIMARY_OFFER_AND_SELECTED_50ML_NOT_PROVEN",
]);
assert.equal(original.items.every(x=>!x.independentlyReviewedExactSku&&
  !x.subjectCreationAuthorized&&!x.factConfirmationAuthorized),true);
assert.equal(original.dbWrites+original.factWrites+original.subjectWrites+
  original.sourceBindingWrites,0);
assert.equal(original.notAutomaticallyVerified,true);
assert.equal(original.reviewerEvidenceExternallyCheckedByThisCode,false);

// Hypothetical, IN-MEMORY only: proves that the metric can legitimately rise
// after real outside-source evidence and two independent reviewers are filed.
// Synthetic reviewer documents never enter the committed production ledger.
const t=cohort.targets.find(x=>x.brand==="이즈앤트리");
const o=observed.outcomes.find(x=>x.brand===t.brand);
const i=index.publicIndexReview.find(x=>x.brand===t.brand);
const checks={
  primaryProductIdentity:true,singleSkuOffer:true,
  catalogQuantityAndUnit:true,selectedPackageOwnership:true,notBundleOrGift:true,
};
const reviewedAtUtc="2026-10-20T09:00:00Z";
const makeProof=(reviewerId)=>Buffer.from(JSON.stringify({
  contract:"trust-p2d-independent-sku-human-evidence-v1",
  productId:t.productId,intakeId:t.intakeId,
  catalogName:t.name,catalogSizeMl:t.sizeMl,
  pageSha256:o.pageSha256,pageUrl:i.sourceUrl,
  reviewerId,reviewedAtUtc,checks,
}));
const proof1=makeProof("independent-reviewer-alpha");
const proof2=makeProof("independent-reviewer-beta");
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const proofRefs=new Map([
  ["evidence/trust/independent-reviewer-alpha.json",proof1],
  ["evidence/trust/independent-reviewer-beta.json",proof2],
]);
const confirmation={
  productId:t.productId,intakeId:t.intakeId,brand:t.brand,
  decision:"EXACT_SKU_CONFIRMED",
  pageSha256:o.pageSha256,pageUrl:i.sourceUrl,
  catalogName:t.name,catalogSizeMl:t.sizeMl,checks,
  reviewers:[
    {reviewerId:"independent-reviewer-alpha",
      independentEvidenceRef:"evidence/trust/independent-reviewer-alpha.json",
      independentEvidenceSha256:hash(proof1),reviewedAtUtc},
    {reviewerId:"independent-reviewer-beta",
      independentEvidenceRef:"evidence/trust/independent-reviewer-beta.json",
      independentEvidenceSha256:hash(proof2),reviewedAtUtc},
  ],
};
const positive={...ledger,records:[confirmation]};
validateTrustP2DReviewEvidenceFiles(positive,p=>{
  if(!proofRefs.has(p))throw Error("missing");
  return proofRefs.get(p);
});
assert.equal(evaluate(cohort,observed,index,positive)
  .independentlyAdjudicatedExactSkuCount,1);
assert.equal(evaluate(cohort,observed,index,positive)
  .items.find(x=>x.brand===t.brand).nextGate,"INDEPENDENT_REVIEW_ATTESTED");
assert.throws(()=>validateTrustP2DReviewEvidenceFiles(positive,()=>Buffer.from("{}")),
  /P2D_REVIEW_DOCUMENT_PROVENANCE_MISMATCH/);
assert.throws(()=>validateTrustP2DReviewEvidenceFiles(positive,()=>{throw Error("absent");}),
  /P2D_REVIEW_EVIDENCE_NOT_READABLE/);
const clone=x=>structuredClone(x);
function rejected(edit,reason){
  const input=clone(positive);edit(input.records[0],input);
  assert.throws(()=>evaluate(cohort,observed,index,input),reason);
}
rejected(r=>{r.pageSha256="0".repeat(64)},/NO_INDEPENDENTLY_REVIEWABLE_PAGE/);
rejected(r=>{r.pageUrl="https://evil.example.org/product"},/SOURCE_PROVENANCE_MISMATCH/);
rejected(r=>{r.pageUrl="http://isntree.com/product"},/SOURCE_PROVENANCE_MISMATCH/);
rejected(r=>{r.catalogSizeMl=50},/IDENTITY_OR_CATALOG_DRIFT/);
rejected(r=>{r.catalogName="Mismatched"},/IDENTITY_OR_CATALOG_DRIFT/);
rejected(r=>{r.checks.notBundleOrGift=false},/UNPROVEN_SKU_PREDICATE/);
rejected(r=>{r.reviewers[1].reviewerId=r.reviewers[0].reviewerId},
  /INDEPENDENT_REVIEW_PROVENANCE_INVALID/);
rejected(r=>{r.reviewers[1].independentEvidenceRef=r.reviewers[0].independentEvidenceRef},
  /INDEPENDENT_REVIEW_PROVENANCE_INVALID/);
rejected(r=>{r.reviewers.pop()},/TWO_INDEPENDENT_REVIEWS_REQUIRED/);
rejected(r=>{r.reviewers[0].independentEvidenceRef="../escape.json"},
  /INDEPENDENT_REVIEW_PROVENANCE_INVALID/);
rejected(r=>{r.productId=cohort.targets[0].productId},/IDENTITY_OR_CATALOG_DRIFT/);
rejected((r,whole)=>{whole.records.push(clone(r))},/UNKNOWN_OR_DUPLICATE_PRODUCT/);
const fakeObserved=clone(observed);
fakeObserved.outcomes.find(x=>x.brand===t.brand).state="BODY_MENTION_REVIEW_REQUIRED";
assert.throws(()=>evaluate(cohort,fakeObserved,index,positive),
  /NO_INDEPENDENTLY_REVIEWABLE_PAGE/);
const changedCatalog=clone(cohort);
changedCatalog.targets.find(x=>x.brand===t.brand).sizeMl=50;
assert.throws(()=>evaluate(changedCatalog,observed,index,positive),
  /CATALOG_QUANTITY_DRIFT/);
const sourceNotGranted=clone(index);
sourceNotGranted.publicIndexReview.find(x=>x.brand===t.brand).eligibleForDirectProbe=false;
assert.throws(()=>evaluate(cohort,observed,sourceNotGranted,positive),
  /SOURCE_PROVENANCE_MISMATCH/);
for(const brand of ["닥터지","비플레인","아토팜","토리든"]){
  const changed=clone(positive);
  changed.records[0].productId=cohort.targets.find(x=>x.brand===brand).productId;
  changed.records[0].brand=brand;
  assert.throws(()=>evaluate(cohort,observed,index,changed),
    /IDENTITY_OR_CATALOG_DRIFT|NO_INDEPENDENTLY_REVIEWABLE_PAGE/);
}
console.log("TRUST_P2D_INDEPENDENT_SKU_REVIEW_PATH_OFFLINE_PASS");
