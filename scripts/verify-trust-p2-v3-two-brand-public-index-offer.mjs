#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const panel=read("evidence/trust/p2v3-real-catalog-evaluation-panel-20261021.json");
const triage=read("evidence/trust/p2v3-two-primary-legacy-evidence-triage-20261021.json");
const audit=read("evidence/trust/p2v3-two-brand-public-index-offer-audit-20261021.json");
function verify(panel,triage,audit){
  assert.equal(audit.contract,"trust-p2v3-two-brand-public-index-offer-audit-v1");
  assert.equal(audit.scope,
    "TWO_USER_AUTHORIZED_FIRST_PARTY_ORIGINS_INDEXED_PUBLIC_OBSERVATIONS_ONLY");
  assert.equal(audit.findings.length,2);
  const a=audit.sourceAccess;
  assert.equal(a.directRobotsStatus,"UNAVAILABLE_FROM_AVAILABLE_TOOLS");
  assert.equal(a.robotsUrls.length,2);
  assert.ok(a.robotsUrls.every(x=>x.status==="UNAVAILABLE_NO_ACCESS_DECISION"));
  assert.equal(a.repositoryGovernedLiveProductFetchAttempts,0);
  assert.equal(a.directProductFetchesSucceeded,0);
  assert.equal(a.firstPartyOriginalHtmlBytesRetained,0);
  assert.equal(a.sourceUseLicenseGrantedByBrand,false);
  assert.equal(a.status,"NO_DIRECT_LIVE_CRAWL_OR_LICENSED_SOURCE_ARTIFACT");
  const s=audit.safety;
  assert.deepEqual(s,{
    officialSiteLiveFetches:0,dbWrites:0,catalogWrites:0,factWrites:0,
    subjectWrites:0,sourceBindingWrites:0,recommendationWrites:0,aiApiCalls:0,
  });
  const ids=new Set();
  for(const f of audit.findings){
    assert.ok(!ids.has(f.productId));ids.add(f.productId);
    const legacy=triage.reviewTargets.find(x=>x.productId===f.productId);
    const p=panel.records.find(x=>x.productId===f.productId);
    assert.ok(legacy&&p);
    assert.equal(f.catalogSizeMl,legacy.catalogSizeMl);
    assert.equal(f.catalogSizeMl,p.catalogSizeMl);
    assert.equal(f.brand,legacy.brand);
    assert.equal(f.officialRecordedLocator,legacy.officialLocator);
    assert.equal(new URL(f.indexedPrimaryPageUrl).hostname,
      new URL(f.officialRecordedLocator).hostname);
    assert.match(f.proofChannel,/PUBLIC_SEARCH_ENGINE_/);
    assert.equal(f.firstPartyCanonicalOwnershipConfirmed,false);
    assert.equal(f.exactSkuVerified,false);
    assert.equal(f.independentGoldReviewCount,0);
    assert.ok(f.typedObservedClaims.every(x=>
      ["PRODUCT_FAMILY","PHYSICAL_UNIT","SALE_OFFER"].includes(x.scope)&&
      typeof x.dimension==="string"&&typeof x.confidenceKind==="string"&&
      x.confidenceKind!=="INDEPENDENTLY_CONFIRMED_GOLD"));
  }
  assert.deepEqual([...ids].sort(),[
    "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
    "25b2763f-529f-4b2e-a436-2e0776279c55",
  ].sort());
  const claim=(f,scope,dimension)=>f.typedObservedClaims.find(x=>
    x.scope===scope&&x.dimension===dimension);
  const sid=audit.findings.find(x=>x.brand==="SIDMOOL");
  const boj=audit.findings.find(x=>x.brand==="뷰티오브조선");
  assert.equal(sid.catalogSizeMl,null);
  assert.equal(claim(sid,"PHYSICAL_UNIT","CAPACITY_ML")?.value,75);
  assert.equal(claim(sid,"SALE_OFFER","MULTI_QUANTITY_DISCOUNT")?.value,
    "BUY_TWO_10_PERCENT_DISCOUNT_LISTED");
  assert.equal(sid.selectedPurchaseOption,
    "NOT_PROVEN_INPUT_SELECT_OPTIONS_UNREADABLE");
  assert.equal(claim(sid,"PRODUCT_FAMILY","SPF")?.value,20);
  assert.equal(claim(sid,"PRODUCT_FAMILY","PA")?.value,"PA++");
  assert.equal(boj.catalogSizeMl,50);
  assert.equal(claim(boj,"PHYSICAL_UNIT","CAPACITY_ML")?.value,50);
  assert.deepEqual(claim(boj,"SALE_OFFER","PACKAGE_OPTIONS")?.value,
    ["1-Pack","2-Pack"]);
  assert.equal(claim(boj,"PRODUCT_FAMILY","FORMULA_UNCHANGED_CLAIM")
    ?.confidenceKind,"OFFICIAL_FAQ_ASSERTION_NOT_INDEPENDENT_FORMULATION_PROOF");
  assert.match(boj.selectedPurchaseOption,/NOT_INDEPENDENTLY_REPLAYABLE/);
  assert.equal(audit.accuracy.panelCandidateCount,20);
  assert.equal(audit.accuracy.newIndependentlyVerifiedGoldClaims,0);
  assert.equal(audit.accuracy.historicalExactOfficialSkuNumerator,0);
  assert.equal(audit.accuracy.historicalExactOfficialSkuDenominator,5);
  assert.equal(audit.accuracy.sourceIndexedFamilyCapacityLeads,2);
  assert.equal(audit.accuracy.actualRealWorldAccuracy,null);
  assert.ok(audit.holdReasons.includes("ROBOTS_PREFLIGHT_NOT_CONFIRMED"));
  assert.ok(audit.holdReasons.includes("OFFICIAL_SOURCE_COMMERCIAL_REUSE_NOT_AUTHORIZED"));
  assert.ok(audit.holdReasons.includes("EXACT_PURCHASE_VARIANT_MAPPING_NOT_PROVEN"));
}
verify(panel,triage,audit);
const clone=x=>structuredClone(x);
const invalid=(mutate)=>{
  const f=clone(audit);mutate(f);
  assert.throws(()=>verify(panel,triage,f));
};
invalid(x=>x.findings[0].exactSkuVerified=true);
invalid(x=>x.findings[0].firstPartyCanonicalOwnershipConfirmed=true);
invalid(x=>x.findings[1].independentGoldReviewCount=2);
invalid(x=>x.sourceAccess.sourceUseLicenseGrantedByBrand=true);
invalid(x=>x.safety.factWrites=1);
invalid(x=>x.findings.find(f=>f.brand==="SIDMOOL").catalogSizeMl=75);
invalid(x=>x.findings.find(f=>f.brand==="뷰티오브조선").typedObservedClaims
  .find(c=>c.scope==="PHYSICAL_UNIT"&&c.dimension==="CAPACITY_ML").value=100);
invalid(x=>x.findings.find(f=>f.brand==="뷰티오브조선").typedObservedClaims
  .find(c=>c.scope==="SALE_OFFER").value=["2-Pack"]);
console.log("TRUST_P2_V3_TWO_OFFICIAL_INDEX_OFFER_SEPARATION_NO_GOLD_ESCALATION_PASS");
