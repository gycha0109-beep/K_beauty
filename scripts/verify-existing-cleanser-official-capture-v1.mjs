#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  collectExistingCleanserOfficialCapture,
  evaluateExistingCleanserOfficialCapture,
  EXISTING_CLEANSER_OFFICIAL_CAPTURE_VERSION,
  OFFICIAL_RESEARCH_SOURCE_MODE,
} from "../lib/existing-cleanser-official-capture-v1.mjs";
const UUID="11111111-1111-4111-8111-111111111111";
function item(overrides={}) {
  return {id:UUID,category:"cleanser",brand:"Demo Brand",name:"Calm Cleanser 120ml",
    normalized_name:"Calm Cleanser",size_ml:120,source_url:"https://brand.example/products/calm",...overrides};
}
const base={product:item(),officialUrl:"https://brand.example/products/calm",
  finalUrl:"https://brand.example/products/calm",
  approvedBrandHosts:["brand.example"],capturedAt:"2026-02-05T11:00:00.000Z"};
function html(title, options={}) {
  const name=options.structuredProductName||title;
  return Buffer.from("<html><head><title>"+title+"</title>"+
    '<meta property="og:title" content="'+(options.ogTitle||title)+'">'+
    '<script type="application/ld+json">'+JSON.stringify({"@context":"https://schema.org",
      "@type":"Product",name,brand:{name:"Demo Brand"}})+"</script>"+
    "</head><body><h1>"+title+"</h1></body></html>");
}
function run(opts) {
  return evaluateExistingCleanserOfficialCapture({...base,htmlBytes:html("Demo Brand Calm Cleanser 120ml"),...opts});
}
const good=run({});
assert.equal(good.version,EXISTING_CLEANSER_OFFICIAL_CAPTURE_VERSION);
assert.equal(good.state,"RESEARCH_CANDIDATE_ONLY");
assert.equal(good.observation.productId,UUID);
assert.equal(good.observation.candidateCapacity.amount,120);
assert.equal(good.observation.candidateCapacity.unit,"ml");
assert.equal(good.observation.market,"KR");
assert.match(good.observation.contentDigest,/^[a-f0-9]{64}$/);
assert.equal(good.exactSubjectResolved,false);
assert.equal(good.productFactConfirmed,false);
assert.equal(good.grantIssued,false);
assert.equal(good.productionWrites,0);
assert.deepEqual(run({}),good,"deterministic candidate");
const gramProduct=item({name:"Mugtree Pack Cleanser 130g",normalized_name:"Mugtree Pack Cleanser",size_ml:null});
const gram=run({product:gramProduct,htmlBytes:html("Demo Brand Mugtree Pack Cleanser 130g")});
assert.equal(gram.state,"RESEARCH_CANDIDATE_ONLY");
assert.deepEqual(gram.observation.candidateCapacity,{amount:130,unit:"g"});
const alternateRetailer=item({
  source_url:"https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A0001"
});
const alternateOptIn=run({
  product:alternateRetailer,
  researchSourceMode:OFFICIAL_RESEARCH_SOURCE_MODE.ALTERNATE,
});
assert.equal(alternateOptIn.state,"RESEARCH_CANDIDATE_ONLY");
assert.equal(alternateOptIn.observation.catalogSourceAgreement,false);
assert.equal(alternateOptIn.observation.catalogSourceRelation,
  "ALTERNATE_OFFICIAL_SOURCE_PENDING_MANUAL_BINDING");
assert.equal(alternateOptIn.trustedSourceAuthorized,false);
assert.equal(alternateOptIn.grantIssued,false);
const normalSame=run({});
assert.equal(normalSame.observation.catalogSourceAgreement,true);
const withQuery=item({source_url:"https://brand.example/products/calm?variant=120"});
const queryConflict=run({product:withQuery});
assert.ok(queryConflict.reasons.includes("SOURCE_REDIRECT_OR_CATALOG_BINDING_MISMATCH"));
const withQueryExact=run({
  product:withQuery,
  officialUrl:"https://brand.example/products/calm?variant=120",
  finalUrl:"https://brand.example/products/calm?variant=120",
});
assert.equal(withQueryExact.state,"RESEARCH_CANDIDATE_ONLY");
assert.equal(withQueryExact.observation.catalogSourceAgreement,true);
const cases=[
  ["retailer",{
    product:item({source_url:"https://www.oliveyoung.co.kr/store/goods/detail?id=1"}),
    officialUrl:"https://www.oliveyoung.co.kr/store/goods/detail?id=1",
    finalUrl:"https://www.oliveyoung.co.kr/store/goods/detail?id=1",
    approvedBrandHosts:["www.oliveyoung.co.kr"]
  },"SECONDARY_RETAILER_NOT_OFFICIAL_SOURCE"],
  ["no-permission",{approvedBrandHosts:[]},"OFFICIAL_HOST_NOT_AUTHORIZED_FOR_RESEARCH"],
  ["retailer-without-alternate-optin",{
    product:alternateRetailer,
  },"SOURCE_REDIRECT_OR_CATALOG_BINDING_MISMATCH"],
  ["unknown-research-mode",{
    researchSourceMode:"BYPASS",
  },"UNKNOWN_RESEARCH_SOURCE_MODE"],
  ["alternate-redirect-query",{
    product:alternateRetailer,
    researchSourceMode:OFFICIAL_RESEARCH_SOURCE_MODE.ALTERNATE,
    finalUrl:"https://brand.example/products/calm?differentSku=999",
  },"SOURCE_REDIRECT_OR_CATALOG_BINDING_MISMATCH"],
  ["redirect-other",{finalUrl:"https://fake.example/products/calm"},"SOURCE_REDIRECT_OR_CATALOG_BINDING_MISMATCH"],
  ["redirect-other-path",{finalUrl:"https://brand.example/products/other"},"SOURCE_REDIRECT_OR_CATALOG_BINDING_MISMATCH"],
  ["wrong-size",{htmlBytes:html("Demo Brand Calm Cleanser 200ml")},"HOLD_EXACT_CAPACITY_NOT_OBSERVED"],
  ["wrong-unit",{htmlBytes:html("Demo Brand Calm Cleanser 120g")},"HOLD_EXACT_CAPACITY_NOT_OBSERVED"],
  ["bundle",{htmlBytes:html("Demo Brand Calm Cleanser 120ml 1+1")},"HOLD_BUNDLE_OR_PACKAGING_AMBIGUITY"],
  ["multi",{htmlBytes:html("Demo Brand Calm Cleanser 120ml / 200ml")},"HOLD_VARIANT_SIZE_CONFLICT"],
  ["no-brand",{htmlBytes:html("Calm Cleanser 120ml")},"HOLD_BRAND_NOT_OBSERVED_IN_IDENTITY"],
  ["no-product",{htmlBytes:html("Demo Brand Hydrating Toner 120ml")},"HOLD_EXACT_NAME_NOT_OBSERVED"],
  ["empty-bytes",{htmlBytes:Buffer.alloc(0)},"CAPTURE_BYTES_INVALID_SIZE"],
  ["huge",{htmlBytes:Buffer.alloc(2*1024*1024+1)},"CAPTURE_BYTES_INVALID_SIZE"],
  ["null-bytes",{htmlBytes:null},"CAPTURE_BYTES_REQUIRED"],
  ["wrong-category",{product:item({category:"sunscreen"})},"INVALID_CANONICAL_PRODUCT"],
  ["invalid-id",{product:item({id:"fake-id"})},"INVALID_CANONICAL_PRODUCT"],
  ["invalid-source",{officialUrl:"http://brand.example/products/calm"},"UNSAFE_OR_MISSING_SOURCE"],
  ["future-timestamp",{capturedAt:"2099-01-01T00:00:00Z"},"INVALID_CAPTURE_TIMESTAMP"],
];
for (const [name,change,code] of cases) {
  const out=run(change);
  assert.equal(out.state,"HOLD",name);
  assert.ok(out.reasons.includes(code),name+" "+out.reasons);
  assert.equal(out.grantIssued,false,name);
}
let requested=false;
const denied=await collectExistingCleanserOfficialCapture({
  product:item(),approvedBrandHosts:["brand.example"],siteUseAuthorized:false,
  fetchImpl:async()=>{requested=true;throw new Error("FETCH_MUST_NOT_BE_CALLED");}
});
assert.equal(denied.state,"HOLD");
assert.deepEqual(denied.reasons,["SITE_USE_AUTHORIZATION_REQUIRED"]);
assert.equal(requested,false);
const unapproved=await collectExistingCleanserOfficialCapture({
  product:item(),siteUseAuthorized:true,approvedBrandHosts:[],
  fetchImpl:async()=>{requested=true;throw new Error("FETCH_MUST_NOT_BE_CALLED");}
});
assert.deepEqual(unapproved.reasons,["OFFICIAL_SOURCE_NOT_APPROVED"]);
assert.equal(requested,false);
console.log(JSON.stringify({status:"PASS",version:EXISTING_CLEANSER_OFFICIAL_CAPTURE_VERSION,
  positiveCases:5,negativeCases:cases.length+4,
  actualWebCalls:0,actualApprovals:0,productionWrites:0},null,2));
