#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const file="evidence/trust/p2d-five-catalog-owner-sourced-corrections-20261021.json";
const observed=JSON.parse(fs.readFileSync(file,"utf8"));
function verifyOwnerSourcedFacts(audit){
  assert.equal(audit.contract,"trust-p2d-five-brand-catalog-facts-owner-review-v1");
  assert.equal(audit.reviewModel.basicProductFacts,"SINGLE_OWNER_REVIEW");
  assert.equal(audit.reviewModel.secondReviewerRequired,false);
  assert.equal(audit.reviewModel.requiresOriginalHtmlCopy,false);
  assert.equal(audit.reviewModel.requiresTwoBlindReviewersForNormalCatalogUpdates,false);
  assert.equal(audit.dataScope.table,"public.products");
  assert.equal(audit.dataScope.dbSchemaChanged,false);
  assert.equal(audit.dataScope.subjectFactAuthorityPromoted,false);
  assert.equal(audit.dataScope.recommendationAdmissionChanged,false);
  assert.equal(audit.corrections.length,5);
  assert.equal(audit.otherSourceFollowups.length,2);
  const ids=new Set();
  for(const r of audit.corrections){
    assert.ok(!ids.has(r.productId));ids.add(r.productId);
    assert.ok(typeof r.name==="string"&&r.name.length>2);
    assert.ok(r.before.sizeMl>0&&r.after.sizeMl>0);
    assert.equal(r.officialSelectedOfferSkuFullyAdjudicated,false);
    assert.equal(new URL(r.after.sourceUrl).protocol,"https:");
    assert.ok(["BRAND_OFFICIAL_PRODUCT_PAGE","SECONDARY_HWAHAE_EXACT_NAME_CAPACITY"]
      .includes(r.sourceKind));
  }
  const pick=id=>audit.corrections.find(x=>x.productId===id);
  const b=pick("9b81da7a-649e-41ec-a22b-7e367c05afe4");
  assert.equal(b.before.sizeMl,340);assert.equal(b.after.sizeMl,180);
  assert.match(b.after.sourceUrl,/beplain\.co\.kr/);
  assert.match(b.commercialOfferScope,/70매\+10매/);
  const a=pick("bd98f785-15c8-4800-af64-d39c3ad873a0");
  assert.equal(a.before.sizeMl,600);assert.equal(a.after.sizeMl,300);
  assert.equal(a.after.unitPricePer10Ml,null);
  assert.equal(a.pricingFollowupNeeded,true);
  assert.match(a.commercialOfferScope,/300ml\+300ml/);
  const t=pick("fe5f7e61-19ea-4c5f-be1a-2c9c9fcf0978");
  assert.equal(t.after.sizeMl,300);
  assert.match(t.after.sourceUrl,/isntree\.com/);
  const serum=pick("31015762-2741-4211-a553-3ceb7fdf32e8");
  assert.equal(serum.after.sizeMl,50);
  assert.match(serum.after.sourceUrl,/goodsNo=58/);
  const dr=pick("4cbd41f3-1357-42c6-a6c7-6df0e90d54a7");
  assert.equal(dr.sourceKind,"SECONDARY_HWAHAE_EXACT_NAME_CAPACITY");
  assert.match(dr.name,/ EX$/);
  assert.match(dr.after.sourceUrl,/hwahae\.co\.kr/);
  assert.match(dr.commercialOfferScope,/DO NOT equate EX/);
  assert.equal(audit.outcome.legacyFiveCatalogRowsSourceLinked,5);
  assert.equal(audit.outcome.legacyFiveOfficialBrandSourcesLinked,4);
  assert.equal(audit.outcome.legacyFiveExactNameSecondaryOnly,1);
  assert.equal(audit.outcome.legacyFivePhysicalUnitCapacityCorrections,2);
  assert.equal(audit.outcome.originalFiveExactSelectedOfferSkuIndependentGoldClaimsAdded,0);
  assert.equal(audit.outcome.productFactAuthorityWrites,0);
  return true;
}
verifyOwnerSourcedFacts(observed);
for(const change of [
  x=>x.reviewModel.secondReviewerRequired=true,
  x=>x.corrections[0].after.sizeMl=340,
  x=>x.corrections[1].after.unitPricePer10Ml=1016.67,
  x=>x.corrections[4].sourceKind="BRAND_OFFICIAL_PRODUCT_PAGE",
  x=>x.corrections[4].after.sourceUrl="https://www.dr-g.co.kr/item/9826",
  x=>x.corrections[0].officialSelectedOfferSkuFullyAdjudicated=true,
  x=>x.outcome.originalFiveExactSelectedOfferSkuIndependentGoldClaimsAdded=5,
  x=>x.outcome.productFactAuthorityWrites=1,
]){
  const bad=structuredClone(observed);change(bad);
  assert.throws(()=>verifyOwnerSourcedFacts(bad));
}

const followup=JSON.parse(fs.readFileSync(
  "evidence/trust/p2d-atopalm-price-drg-ex-owner-followup-20261021.json",
  "utf8"));
const checkFollowup=x=>{
  assert.equal(x.contract,"trust-p2d-atopalm-price-drg-ex-owner-followup-v1");
  assert.equal(x.reviewModel,"ONE_OWNER_PUBLIC_PRODUCT_FACTS_AND_SOURCE_URL");
  const p=x.atopalm;
  assert.equal(p.productId,"bd98f785-15c8-4800-af64-d39c3ad873a0");
  assert.equal(p.physicalCapacityMl,300);
  assert.equal(p.officialSingleProductId,"2184");
  assert.equal(p.officialSinglePriceKrw,34500);
  assert.equal(p.officialTwoPackPriceKrw,64500);
  assert.equal(p.officialTwoPackContainerCount,2);
  assert.equal(p.officialTwoPackIndividualVolumeMl,300);
  assert.equal(p.newPriceMinKrw,34500);
  assert.equal(p.newPriceMaxKrw,34500);
  assert.equal(p.newUnitPricePer10Ml,
    (p.officialSinglePriceKrw/p.physicalCapacityMl)*10);
  assert.equal(p.oldUnitPricePer10Ml,null);
  assert.equal(p.sqlUpdateVerifiedByReturning,true);
  assert.equal(p.productOffersActiveForThisProduct,0);
  assert.equal(new URL(p.sourceUrlUnchanged).hostname,
    "neopharmshop.co.kr");
  assert.equal(new URL(p.officialSingleProductUrl).hostname,
    "www.neopharmshop.co.kr");
  assert.notEqual(p.officialTwoPackUrl,p.officialSingleProductUrl);
  const d=x.doctorG;
  assert.equal(d.productId,"4cbd41f3-1357-42c6-a6c7-6df0e90d54a7");
  assert.equal(d.catalogSizeMl,70);
  assert.equal(d.jarPhysicalCapacityMl,70);
  assert.equal(d.tubePhysicalCapacityMl,70);
  assert.equal(d.catalogPackagingType,null);
  assert.equal(d.canonicalSourceUrlSwitched,false);
  assert.equal(d.packagingVariantAutomaticallySelected,false);
  assert.equal(d.otherProductsEXOrNonEXMerged,false);
  assert.equal(d.officialBrandShopProductUrlVerified,false);
  assert.equal(d.retailerListingsAreManufacturerOwnDomain,false);
  assert.match(d.retainedProductSourceUrl,/hwahae.co.kr/);
  assert.equal(new URL(d.brandOperatedRetailerJarUrl).hostname,
    "shinsegaemall.ssg.com");
  assert.equal(new URL(d.brandOperatedRetailerTubeUrl).hostname,
    "shinsegaemall.ssg.com");
  assert.notEqual(d.brandOperatedRetailerJarUrl,
    d.brandOperatedRetailerTubeUrl);
  assert.deepEqual(x.releaseScope,{
    productFactWrites:0,subjectWrites:0,sourceBindingWrites:0,
    recommendationWrites:0,schemaChanges:0,crawlerRequests:0,
    categoryWrites:0,
  });
};
checkFollowup(followup);
for(const change of [
  x=>x.atopalm.newUnitPricePer10Ml=575,
  x=>x.atopalm.officialTwoPackContainerCount=1,
  x=>x.atopalm.newPriceMinKrw=30000,
  x=>x.doctorG.packagingVariantAutomaticallySelected=true,
  x=>x.doctorG.catalogPackagingType="tube",
  x=>x.doctorG.officialBrandShopProductUrlVerified=true,
  x=>x.doctorG.canonicalSourceUrlSwitched=true,
  x=>x.releaseScope.productFactWrites=1,
]){
  const copy=structuredClone(followup);change(copy);
  assert.throws(()=>checkFollowup(copy));
}
console.log("TRUST_P2D_ATOPALM_300ML_PRICE_AND_DRG_EX_VARIANT_FOLLOWUP_PASS");

console.log("TRUST_P2D_FIVE_OWNER_SOURCED_CATALOG_FACT_CORRECTIONS_PASS");
