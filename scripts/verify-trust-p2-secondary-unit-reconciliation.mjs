#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {summarizeTrustP2SecondaryListingUnits} from "../lib/trust/p2d-secondary-unit-reconciliation-v1.mjs";
import {reportTrustP2SecondaryListingUnits} from "./report-trust-p2-secondary-unit-reconciliation.mjs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const cohort=read("evidence/trust/p2d-five-brand-cohort-v2.json");
const audit=read("evidence/trust/p2d-secondary-listing-unit-audit-20261020.json");
const result=reportTrustP2SecondaryListingUnits();
assert.deepEqual(result,summarizeTrustP2SecondaryListingUnits(cohort,audit));
assert.equal(result.frozenDenominator,5);
assert.equal(result.secondaryCorroborationReviewProducts,1);
assert.equal(result.catalogSingleContainerConflictReviewProducts,2);
assert.equal(result.independentlyVerifiedOfficialExactSkuCount,0);
assert.equal(result.catalogSourceOfferMismatchReviewProducts,1);
assert.equal(result.items.find(x=>x.brand==="이즈앤트리").catalogSourceOfferStatus,
  "CATALOG_SOURCE_POINTS_TO_300ML_PLUS_200ML_REFILL_PUMP_BUNDLE");
assert.equal(result.items.length,5);
assert.deepEqual(result.items.map(x=>x.stage),[
  "NO_SECONDARY_LISTING_EVIDENCE",
  "CATALOG_SINGLE_CONTAINER_VOLUME_CONFLICT_REVIEW",
  "CATALOG_SINGLE_CONTAINER_VOLUME_CONFLICT_REVIEW",
  "SECONDARY_SINGLE_UNIT_CORROBORATION_REVIEW_ONLY",
  "NO_SECONDARY_LISTING_EVIDENCE",
]);
assert.deepEqual(result.items.map(x=>x.multiContainerListings),[0,0,1,0,0]);
assert.equal(result.items.every(x=>!x.independentlyVerifiedOfficialExactSku&&
  !x.catalogCorrectionAuthorized&&!x.subjectCreationAuthorized&&
  !x.factConfirmationAuthorized),true);
assert.equal(result.firstPartyFetches+result.robotsFetches+result.dbWrites+
  result.sourceBindingWrites+result.subjectWrites+result.factWrites+
  result.aiApiCalls,0);
const clone=x=>structuredClone(x);
function invalidAudit(mutate,re){
  const v=clone(audit);mutate(v);
  assert.throws(()=>summarizeTrustP2SecondaryListingUnits(cohort,v),re);
}
const pathFor=brand=>x=>x.cases.find(t=>t.brand===brand);
invalidAudit(x=>pathFor("이즈앤트리")(x).catalogSizeMl=500,/CATALOG_SCOPE_DRIFT/);
invalidAudit(x=>pathFor("비플레인")(x).sources[0].unitVolumeMl=0,/INVALID_SECONDARY_LISTING/);
invalidAudit(x=>{pathFor("비플레인")(x).sources[0].unitVolumeMl=null;
  pathFor("비플레인")(x).sources[0].sheetCount=null;},/INVALID_SECONDARY_LISTING/);
invalidAudit(x=>pathFor("아토팜")(x).sources[1].physicalContainerCount=0,/INVALID_SECONDARY_LISTING/);
invalidAudit(x=>pathFor("이즈앤트리")(x).sources[0].url=
  "https://isntree.com/product/56",/INVALID_SECONDARY_LISTING/);
invalidAudit(x=>pathFor("비플레인")(x).sources[1].provider="Kurly",/INVALID_SECONDARY_LISTING/);
invalidAudit(x=>pathFor("비플레인")(x).sources[1].url=
  pathFor("비플레인")(x).sources[0].url,/INVALID_SECONDARY_LISTING/);
invalidAudit(x=>pathFor("이즈앤트리")(x).sources[0].listingEvidence=
  "GOVERNED_OFFICIAL_SOURCE",/INVALID_SECONDARY_LISTING/);
invalidAudit(x=>x.cases.push(clone(x.cases[0])),/INVALID_MANIFEST/);
invalidAudit(x=>x.safety.dbWrites=1,/INVALID_MANIFEST/);
invalidAudit(x=>x.catalogReadOnlyCheck.writes=1,/CATALOG_SNAPSHOT_NOT_READONLY/);
invalidAudit(x=>pathFor("이즈앤트리")(x).catalogReadOnly.sourceUrl=
  "https://isntree.com/product/56",/CATALOG_SOURCE_AUDIT_INVALID/);
invalidAudit(x=>pathFor("아토팜")(x).catalogReadOnly.sourceUrl=
  "https://www.hwahae.co.kr/goods/74200",/CATALOG_SOURCE_AUDIT_INVALID/);
const brokenCohort=clone(cohort);
brokenCohort.targets.find(x=>x.brand==="아토팜").sizeMl=300;
assert.throws(()=>summarizeTrustP2SecondaryListingUnits(brokenCohort,audit),
  /CATALOG_SCOPE_DRIFT/);
// 300ml x 2 is NEVER a 600ml container. It stays a separate multi-container
// listing even when its total liquid volume is 600ml.
const atopalm=result.items.find(x=>x.brand==="아토팜");
assert.equal(atopalm.catalogSizeMl,600);
assert.equal(atopalm.singleContainerMatchingListings,0);
assert.equal(atopalm.conflictingSingleContainerListings,1);
assert.equal(atopalm.multiContainerListings,1);
// Two independent secondary 300ml single-product offers may corroborate a
// product-level review lead, never a governed manufacturer SKU/selected form.
const isn=result.items.find(x=>x.brand==="이즈앤트리");
assert.equal(isn.singleContainerMatchingListings,2);
assert.equal(isn.independentlyVerifiedOfficialExactSku,false);
console.log("TRUST_P2_SECONDARY_UNIT_RECONCILIATION_FROZEN_OFFLINE_PASS");
