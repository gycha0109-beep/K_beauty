#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {extractP2SecondaryClaimAtoms,reportP2EvidenceFirstShadow}
  from "../lib/trust/p2-evidence-first-shadow-v1.mjs";
import {reportP2EvidenceFirstFrozen}
  from "./report-trust-p2-evidence-first-shadow.mjs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const cohort=read("evidence/trust/p2d-five-brand-cohort-v2.json");
const audit=read("evidence/trust/p2d-secondary-listing-unit-audit-20261020.json");
const prior=read("evidence/trust/p2f6-pre-resolved-readonly-observed-20261019.json");
const original=reportP2EvidenceFirstFrozen();
assert.deepEqual(original,reportP2EvidenceFirstShadow(cohort,audit,prior));
assert.equal(original.status,"READ_ONLY_SHADOW_NOT_PRODUCTION_AUTHORITY");
assert.deepEqual(original.counts,{
  realFrozenCases:5,catalogVsSingleUnitReview:2,
  capacityCorroborationLeads:1,catalogSourceLinkOfferReviews:1,
  independentlyAdjudicatedOfficialExactSku:0,
  realWorldIdentityAccuracy:null,realWorldAutoProcessingRate:null,
  accuracyEvaluationEligibleLabeledCases:0,
});
const selected=Object.fromEntries(original.rows.map(x=>[x.brand,x]));
const beplain=selected["비플레인"];
const atopalm=selected["아토팜"];
const isntree=selected["이즈앤트리"];
assert.equal(beplain.catalogAssertion.truthStatus,"UNVERIFIED_CATALOG_ASSERTION");
assert.deepEqual(beplain.observedSingleUnitMl,[180]);
assert.deepEqual(beplain.recordedPadCounts,[70]);
assert.equal(beplain.unitReviewLane,"CATALOG_VS_SINGLE_UNIT_LISTING_DISAGREEMENT");
assert.equal(atopalm.catalogAssertion.capacityValue,600);
assert.deepEqual(atopalm.observedSingleUnitMl,[300]);
assert.equal(atopalm.marketedMultipackCount,1);
assert.equal(atopalm.quantityClaims.filter(x=>
  x.dimension==="PHYSICAL_CONTAINER_CAPACITY").length,2);
assert.equal(atopalm.quantityClaims.filter(x=>
  x.dimension==="OFFER_PHYSICAL_UNIT_COUNT"&&x.value===2).length,1);
assert.equal(atopalm.quantityClaims.some(x=>
  x.dimension==="PHYSICAL_CONTAINER_CAPACITY"&&x.value===600),false);
assert.equal(isntree.unitReviewLane,"SECONDARY_CAPACITY_CORROBORATION_ONLY");
assert.equal(isntree.identityReviewLane,
  "HISTORICAL_OFFICIAL_TITLE_CANDIDATE_UNREVIEWABLE");
assert.equal(isntree.reviewIssues.includes(
  "OFFICIAL_PAGE_DIGEST_WITHOUT_RETAINED_CONTENT"),true);
assert.equal(isntree.reviewIssues.includes(
  "CATALOG_SOURCE_LINK_OFFER_MISMATCH"),true);
assert.equal(selected["토리든"].identityReviewLane,
  "BODY_NAME_MENTION_NOT_PRODUCT_IDENTITY");
assert.equal(selected["닥터지"].unitReviewLane,"NO_SECONDARY_CAPACITY_LEADS");
assert.equal(original.rows.every(x=>!x.officialExactSkuVerified&&
  !x.formulaVerified&&!x.catalogCorrectionAuthorized&&
  !x.factConfirmationAuthorized&&!x.sourceBindingAuthorized&&
  !x.subjectCreationAuthorized),true);
assert.equal(original.officialSiteRequests+original.dbWrites+
  original.catalogWrites+original.factWrites+original.subjectWrites+
  original.sourceBindingWrites+original.aiApiCalls,0);
const entry=audit.cases.find(x=>x.brand==="비플레인").sources[0];
const atoms=extractP2SecondaryClaimAtoms(entry);
assert.deepEqual(atoms.map(x=>[x.dimension,x.scope,x.value,x.unit]),[
  ["OFFER_PHYSICAL_UNIT_COUNT","SALE_OFFER",1,"container"],
  ["PHYSICAL_CONTAINER_CAPACITY","PHYSICAL_UNIT",180,"ml"],
  ["PHYSICAL_CONTAINER_PAD_COUNT","PHYSICAL_UNIT",70,"sheet"],
]);
assert.equal(atoms.every(x=>x.sourceClass==="THIRD_PARTY_INDEX_LEAD"&&
  !x.officialSourceVerified&&!x.originalEvidenceBytesRetained),true);
// Counterfactuals are artificial and NEVER enter the measured five-case report.
const clone=x=>structuredClone(x);
const counterfactual=(mutate)=>{
  const copy=clone(audit);mutate(copy);
  return reportP2EvidenceFirstShadow(cohort,copy,prior);
};
const product=brand=>a=>a.cases.find(c=>c.brand===brand);
assert.equal(counterfactual(a=>{
  product("아토팜")(a).sources[0].unitVolumeMl=600;
}).rows.find(x=>x.brand==="아토팜").unitReviewLane,
  "SINGLE_SECONDARY_CAPACITY_LEAD");
// Synthetic 300ml x 2 alone is NEVER a matching single physical 600ml
// product even though the total liquid content is 600ml.
assert.equal(counterfactual(a=>{
  product("아토팜")(a).sources=a.cases.find(x=>x.brand==="아토팜")
    .sources.filter(x=>x.physicalContainerCount===2);
}).rows.find(x=>x.brand==="아토팜").unitReviewLane,
  "ONLY_NON_COMPARABLE_OR_MULTIPACK_LEADS");
// A genuine second independent retailer showing a 300ml single item must
// not cancel a known 180ml listing as though they were the same SKU.
assert.equal(counterfactual(a=>{
  const item=product("비플레인")(a);
  item.sources[1].unitVolumeMl=340;
}).rows.find(x=>x.brand==="비플레인").unitReviewLane,
  "CATALOG_VS_SINGLE_UNIT_LISTING_DISAGREEMENT");
function rejected(mutate,error){
  const a=clone(audit);mutate(a);
  assert.throws(()=>reportP2EvidenceFirstShadow(cohort,a,prior),error);
}
rejected(a=>product("비플레인")(a).catalogSizeMl=180,/CATALOG_OR_COHORT_MISMATCH/);
rejected(a=>a.cases.push(clone(a.cases[0])),/FROZEN_OR_AUTHORITY_DRIFT/);
rejected(a=>a.cases[0].productId="fake",/FROZEN_OR_AUTHORITY_DRIFT|UNKNOWN_FROZEN_INPUT|CATALOG_OR_COHORT_MISMATCH/);
rejected(a=>product("이즈앤트리")(a).sources[1].provider="ShinsegaeDFS",/SECONDARY_PROVENANCE_INVALID/);
rejected(a=>product("아토팜")(a).sources[1].url=
  "https://neopharmshop.co.kr/product/mle",/SECONDARY_PROVENANCE_INVALID/);
rejected(a=>product("아토팜")(a).sources[1].unitVolumeMl=0,/UNSAFE_OR_AMBIGUOUS_LISTING/);
rejected(a=>product("비플레인")(a).sources[0].listingEvidence=
  "OFFICIAL_CONFIRMED",/UNSAFE_OR_AMBIGUOUS_LISTING/);
rejected(a=>a.safety.firstPartyFetches=1,/FROZEN_OR_AUTHORITY_DRIFT/);
rejected(a=>a.catalogReadOnlyCheck.writes=1,/FROZEN_OR_AUTHORITY_DRIFT/);
const changedCohort=clone(cohort);
changedCohort.targets.find(x=>x.brand==="이즈앤트리").sizeMl=999;
assert.throws(()=>reportP2EvidenceFirstShadow(changedCohort,audit,prior),
  /CATALOG_OR_COHORT_MISMATCH/);
const changedHistorical=clone(prior);
changedHistorical.outcomes.find(x=>x.brand==="이즈앤트리").brand="새브랜드";
assert.throws(()=>reportP2EvidenceFirstShadow(cohort,audit,changedHistorical),
  /CATALOG_OR_COHORT_MISMATCH|UNKNOWN_FROZEN_INPUT/);
console.log("TRUST_P2_EVIDENCE_FIRST_SHADOW_FROZEN_REAL_5_SYNTHETIC_NEGATIVES_PASS");
