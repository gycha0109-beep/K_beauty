#!/usr/bin/env node
import assert from "node:assert/strict";
import { inspectTrustOfficialVariantScope } from "../lib/trust/official-variant-scope-v1.mjs";
import { classifyTrustOfficialCandidatePage,runTrustP2Discovery,selectTrustP2CandidateLocators } from "../lib/trust/official-product-discovery-p2-v1.mjs";
import { findTrustP2BOfficialPeerLinks } from "../lib/trust/official-peer-index-links-v1.mjs";
import fs from "node:fs";
import {
  assertTrustP2DCohort,cohortToTrustedDiscoveryRow,
  assessTrustP2DDiscovery,diagnoseTrustP2DSite,runTrustP2DFiveBrandPilot,
  summarizeTrustP2D,runTrustP2DCli,
} from "./trust-p2d-five-brand-pilot.mjs";
const cohort=JSON.parse(fs.readFileSync("evidence/trust/p2d-five-brand-cohort-v1.json","utf8"));
const sized={id:"bd98f785-15c8-4800-af64-d39c3ad873a0",brand:"아토팜",name:"MLE 로션",size_ml:600};
for(const size of [60,300]){
  const title="[신규회원특가] 아토팜 MLE 로션 "+size+"ml - 아토팜 공식몰";
  assert.equal(inspectTrustOfficialVariantScope(title,sized).status,"CATALOG_SIZE_MISMATCH");
  const classified=classifyTrustOfficialCandidatePage(Buffer.from("<title>"+title+"</title>"),sized);
  assert.equal(classified.status,"CATALOG_SIZE_MISMATCH");
  assert.equal(classified.variantScope.exactSkuVerified,false);
}
assert.equal(inspectTrustOfficialVariantScope("MLE 로션 300ml x2개",sized).status,"BUNDLE_VARIANT_REVIEW_REQUIRED");
assert.equal(inspectTrustOfficialVariantScope("MLE 로션 600ml",sized).status,"SIZE_MATCH_CANDIDATE");
const torrent={brand:"토리든",name:"다이브인 저분자 히알루론산 세럼"};
const index=Buffer.from('<a href="/goods/goods_view.php?goodsNo=58">[NEW] 토리든 다이브인 저분자 히알루론산 세럼 50ml</a>');
assert.deepEqual(findTrustP2BOfficialPeerLinks(index,"https://www.torriden.com/",torrent),[
  "https://www.torriden.com/goods/goods_view.php?goodsNo=58"]);
const beplain={brand:"비플레인",name:"녹두 모공 클리어링 필터 패드"};
// Mixed count and giveaway labels must never be treated as a single product.
assert.equal(findTrustP2BOfficialPeerLinks(Buffer.from('<a href="/m/product_detail.html?brand_uid=432">녹두 모공 클리어링 필터 패드 70매+10매</a>'),"https://www.beplain.co.kr/",beplain).length,0);
assert.equal(findTrustP2BOfficialPeerLinks(Buffer.from('<a href="/m/product_detail.html?brand_uid=432">녹두 모공 클리어링 필터 패드 70매</a>'),"https://www.beplain.co.kr/",beplain).length,1);
// Reject explicit wrong-volume, ambiguous/multipack and offer labels at the
// visible official-link stage, before consuming scarce page-fetch budget.
const linkTarget={brand:"아토팜",name:"MLE 로션",size_ml:600};
const peer="https://neopharmshop.co.kr/product/peer/2166";
const linkLabel=(label,href="/product/mle-lotion/888")=>
  Buffer.from('<a href="'+href+'">'+label+'</a>');
const discoverLabel=(label,href)=>
  findTrustP2BOfficialPeerLinks(linkLabel(label,href),peer,linkTarget);
assert.equal(discoverLabel("아토팜 MLE 로션 600ml").length,1);
assert.equal(discoverLabel("아토팜 MLE 로션").length,1);
assert.equal(discoverLabel("아토팜 MLE 로션 60ml").length,0);
assert.equal(discoverLabel("아토팜 MLE 로션 300ml").length,0);
assert.equal(discoverLabel("아토팜 MLE 로션 300ml 600ml").length,0);
assert.equal(discoverLabel("아토팜 MLE 로션 600ml x2").length,0);
assert.equal(discoverLabel("아토팜 MLE 로션 600ml+60ml").length,0);
assert.equal(discoverLabel("아토팜 MLE 로션 600ml 1+1").length,0);
assert.equal(discoverLabel("아토팜 MLE 로션 600ml 증정").length,0);
assert.equal(discoverLabel("아토팜 MLE 크림 600ml").length,0);
assert.equal(discoverLabel("아토팜 MLE 로션 600ml","https://other-brand.test/product/mle-lotion/888").length,0);
assert.equal(findTrustP2BOfficialPeerLinks(linkLabel("아토팜 MLE 로션 60ml"),peer,
  {brand:"아토팜",name:"MLE 로션"}).length,1); // Unknown size is unverified.

// A product-sized link after two vague labels must not lose the two-page
// network budget. Priority is only a locator ordering, NEVER SKU evidence.
const sizeFirst=Buffer.from([
  '<a href="/product/mle-lotion/9100">아토팜 MLE 로션</a>',
  '<a href="/product/mle-lotion/9200">아토팜 MLE 로션</a>',
  '<a href="/product/mle-lotion/9300">아토팜 MLE 로션 60ml</a>',
  '<a href="/product/mle-lotion/9400">아토팜 MLE 로션 600ml 1+1</a>',
  '<a href="/product/mle-lotion/9500">아토팜 MLE 로션 600ml</a>',
].join(""));
assert.deepEqual(findTrustP2BOfficialPeerLinks(sizeFirst,peer,linkTarget),[
  "https://neopharmshop.co.kr/product/mle-lotion/9500",
  "https://neopharmshop.co.kr/product/mle-lotion/9100",
]);
assert.deepEqual(findTrustP2BOfficialPeerLinks(sizeFirst,peer,
  {...linkTarget,size_ml:null}),[
  "https://neopharmshop.co.kr/product/mle-lotion/9100",
  "https://neopharmshop.co.kr/product/mle-lotion/9200",
]);
// An identical URL can be upgraded by a later explicit size label.
assert.deepEqual(findTrustP2BOfficialPeerLinks(Buffer.from([
  '<a href="/product/mle-lotion/9200">아토팜 MLE 로션</a>',
  '<a href="/product/mle-lotion/9100">아토팜 MLE 로션</a>',
  '<a href="/product/mle-lotion/9200">아토팜 MLE 로션 600ml</a>',
].join("")),peer,linkTarget,{max:1}),[
  "https://neopharmshop.co.kr/product/mle-lotion/9200",
]);
// Reject promotions and off-site links despite an otherwise matching quantity.
assert.deepEqual(findTrustP2BOfficialPeerLinks(Buffer.from([
  '<a href="https://other-brand.test/product/mle-lotion/9300">아토팜 MLE 로션 600ml</a>',
  '<a href="/product/mle-lotion/9400">아토팜 MLE 로션 600ml 증정</a>',
  '<a href="/product/mle-lotion/9500">아토팜 MLE 로션 600ml</a>',
].join("")),peer,linkTarget,{max:1}),[
  "https://neopharmshop.co.kr/product/mle-lotion/9500",
]);


// The frozen 600ml-vs-60/300ml failure also requires URL-scope
// discrimination on sitemap locators, before the two-page fetch ceiling.
const sitemapWrong60="https://neopharmshop.co.kr/product/mle-lotion-60ml/5000";
const sitemapWrong300="https://neopharmshop.co.kr/product/mle-lotion-300ml/3000";
const sitemapCorrect="https://neopharmshop.co.kr/product/mle-lotion-600ml/9000";
const sitemapUnknown="https://neopharmshop.co.kr/product/mle-lotion/9001";
const sitemapKit="https://neopharmshop.co.kr/product/mle-lotion-600ml-kit/9002";
assert.deepEqual(selectTrustP2CandidateLocators([],[
  sitemapWrong300,sitemapWrong60,sitemapCorrect,sitemapKit,
],linkTarget),[sitemapCorrect]);
assert.deepEqual(selectTrustP2CandidateLocators([],[
  sitemapUnknown,sitemapWrong60,sitemapWrong300,sitemapCorrect,
],linkTarget),[sitemapCorrect,sitemapUnknown]);
assert.deepEqual(selectTrustP2CandidateLocators([],[
  sitemapWrong300,sitemapWrong60,
],linkTarget),[]);
assert.deepEqual(selectTrustP2CandidateLocators([],[
  sitemapWrong300,sitemapCorrect,
],{...linkTarget,size_ml:null}),[sitemapWrong300,sitemapCorrect]);
assert.deepEqual(selectTrustP2CandidateLocators([],[
  "https://neopharmshop.co.kr/product/mle-lotion?variant=300ml",
  sitemapCorrect,
],linkTarget),[sitemapCorrect]);
assert.deepEqual(selectTrustP2CandidateLocators(
  [sitemapUnknown],[sitemapCorrect],linkTarget),[sitemapCorrect,sitemapUnknown]);
// www and apex can both pass legacy host normalization, but cannot share
// a same-origin budget. Reject different origin before truncating candidates.
assert.deepEqual(selectTrustP2CandidateLocators([],[
  "https://www.neopharmshop.co.kr/product/mle-lotion-600ml/8000",
  sitemapCorrect,
],linkTarget,{origin:"https://neopharmshop.co.kr",max:1}),[sitemapCorrect]);
// Full read-only integration: three same-name size variants in a sitemap,
// including the correct 600ml after two wrong URLs. Broader in-memory
// consideration (<=12) must not expand network product-page requests (>2).
const sitemapFetchedPages=[];
const sitemapRun=await runTrustP2Discovery(cohortToTrustedDiscoveryRow({
  productId:sized.id,
  intakeId:"ddc5259a-e3d3-44b2-b4b8-ee14ed2dd491",
  peerProductId:"08b85f37-b1fa-42d7-893a-0d4facb17878",
  peerSourceId:"f493aa44-75dc-40b8-a179-b7d748bc7989",
  peerBindingId:"c70aadca-aecb-409a-9995-71016a2ef9d7",
  peerKind:"official_product_page",
  officialPeerUrl:peer,
}),{
  ...sized,name_en:"MLE Lotion",normalized_name:"MLE 로션",
},{
  fetchRobots:async url=>({bytes:Buffer.from("User-agent: *\nAllow: /\n"),finalUrl:url}),
  fetchSitemap:async url=>({bytes:Buffer.from("<urlset>"+[
    sitemapWrong300,sitemapWrong60,sitemapCorrect,sitemapKit,
  ].map(x=>"<url><loc>"+x+"</loc></url>").join("")+"</urlset>"),finalUrl:url}),
  fetchPage:async url=>{
    sitemapFetchedPages.push(url);
    return {bytes:url===peer?Buffer.from("<title>Official peer</title>"):
      Buffer.from("<title>MLE 로션 600ml</title>"),finalUrl:url};
  },
});
assert.deepEqual(sitemapFetchedPages,[peer,sitemapCorrect]);
assert.deepEqual(sitemapRun.sites[0].pages.map(p=>p.url),[sitemapCorrect]);
assert.equal(sitemapRun.officialProductEvidenceConfirmed,false);
assert.equal(sitemapRun.factWrites,0);
assert.equal(sitemapRun.subjectCreationAuthorized,false);

// Offline stage-gap regression: wrong-size sitemap locators are not useful
// candidates and must not prevent the already-budgeted homepage index probe.
const scopedRow=cohortToTrustedDiscoveryRow({
  productId:sized.id,
  intakeId:"ddc5259a-e3d3-44b2-b4b8-ee14ed2dd491",
  peerProductId:"08b85f37-b1fa-42d7-893a-0d4facb17878",
  peerSourceId:"f493aa44-75dc-40b8-a179-b7d748bc7989",
  peerBindingId:"c70aadca-aecb-409a-9995-71016a2ef9d7",
  peerKind:"official_product_page",
  officialPeerUrl:peer,
});
const scopedProduct={...sized,name_en:"MLE Lotion",normalized_name:"MLE 로션"};
const indexFallbackCalls=[];
const indexFallback=await runTrustP2Discovery(scopedRow,scopedProduct,{
  fetchRobots:async url=>({bytes:Buffer.from("User-agent: *\nAllow: /\n"),finalUrl:url}),
  fetchSitemap:async url=>({bytes:Buffer.from(
    "<urlset><url><loc>"+sitemapWrong300+"</loc></url></urlset>"),finalUrl:url}),
  fetchPage:async url=>{
    indexFallbackCalls.push(url);
    return {bytes:Buffer.from(url===peer?"<title>Official peer</title>":
      url==="https://neopharmshop.co.kr/"?
      '<a href="/product/mle-lotion-600ml/9000">아토팜 MLE 로션 600ml</a>':
      "<title>아토팜 MLE 로션 600ml</title>"),finalUrl:url};
  },
});
assert.deepEqual(indexFallbackCalls,[peer,"https://neopharmshop.co.kr/",sitemapCorrect]);
assert.deepEqual(indexFallback.sites[0].pages.map(p=>p.url),[sitemapCorrect]);
assert.equal(indexFallback.sites[0].homepageIndexStatus,"FETCHED");
assert.equal(indexFallback.factWrites,0);
// Two same-origin candidate URLs blocked by robots used to occupy both
// selection slots ahead of a policy-permitted matching 600ml URL.
const robotBlocked1="https://neopharmshop.co.kr/product/mle-lotion-600ml/1000";
const robotBlocked2="https://neopharmshop.co.kr/product/mle-lotion-600ml/2000";
const policyFetches=[];
const policyRun=await runTrustP2Discovery(scopedRow,scopedProduct,{
  fetchRobots:async url=>({bytes:Buffer.from(
    "User-agent: *\nDisallow: /product/mle-lotion-600ml/1000\n"+
    "Disallow: /product/mle-lotion-600ml/2000\nAllow: /\n"),finalUrl:url}),
  fetchSitemap:async url=>({bytes:Buffer.from("<urlset>"+[
    robotBlocked1,robotBlocked2,sitemapCorrect,
  ].map(link=>"<url><loc>"+link+"</loc></url>").join("")+"</urlset>"),finalUrl:url}),
  fetchPage:async url=>{
    policyFetches.push(url);
    return {bytes:Buffer.from(url===peer?"<title>Official peer</title>":
      "<title>아토팜 MLE 로션 600ml</title>"),finalUrl:url};
  },
});
assert.deepEqual(policyFetches,[peer,sitemapCorrect]);
assert.deepEqual(policyRun.sites[0].pages.map(p=>p.url),[sitemapCorrect]);
assert.equal(policyRun.subjectCreationAuthorized,false);
assert.equal(policyRun.officialProductEvidenceConfirmed,false);

// Named sitemap URL != eligible product-page locator. When only wrong-size
// links exist and the optional homepage adds none, record an explicit HOLD.
const noEligibleCalls=[];
const noEligible=await runTrustP2Discovery(scopedRow,scopedProduct,{
  fetchRobots:async url=>({bytes:Buffer.from("User-agent: *\nAllow: /\n"),finalUrl:url}),
  fetchSitemap:async url=>({bytes:Buffer.from(
    "<urlset><url><loc>"+sitemapWrong60+"</loc></url></urlset>"),finalUrl:url}),
  fetchPage:async url=>{
    noEligibleCalls.push(url);
    return {bytes:Buffer.from("<title>Unrelated peer or homepage</title>"),finalUrl:url};
  },
});
assert.deepEqual(noEligibleCalls,[peer,"https://neopharmshop.co.kr/"]);
assert.equal(noEligible.sites[0].status,"NO_ELIGIBLE_OFFICIAL_LOCATOR");
assert.deepEqual(noEligible.sites[0].pages,[]);
assert.equal(diagnoseTrustP2DSite(noEligible.sites[0]).reason,
  "NO_ELIGIBLE_OFFICIAL_LOCATOR");
assert.equal(noEligible.officialProductEvidenceConfirmed,false);

// P2-E5 boundary: Phase8H's 12-result output cap must not discard a
// catalog-scoped URL just because earlier scored sitemap URLs occupy 12 slots.
// Offline mocks exercise the REAL rediscovery ranking and final page fetch.
const makeSitemapXml=urls=>"<urlset>"+urls.map(url=>
  "<url><loc>"+url+"</loc></url>").join("")+"</urlset>";
const overTwelveWrong=Array.from({length:16},(_,i)=>
  "https://neopharmshop.co.kr/product/mle-lotion-300ml/"+(3000+i));
const rankedLateCalls=[];
const rankedLate=await runTrustP2Discovery(scopedRow,scopedProduct,{
  fetchRobots:async url=>({bytes:Buffer.from("User-agent: *\nAllow: /\n"),finalUrl:url}),
  fetchSitemap:async url=>({bytes:Buffer.from(makeSitemapXml([
    ...overTwelveWrong,sitemapKit,sitemapCorrect,
  ])),finalUrl:url}),
  fetchPage:async url=>{
    rankedLateCalls.push(url);
    return {bytes:Buffer.from("<title>MLE 로션 600ml</title>"),finalUrl:url};
  },
});
assert.deepEqual(rankedLateCalls,[peer,sitemapCorrect]);
assert.deepEqual(rankedLate.sites[0].pages.map(p=>p.url),[sitemapCorrect]);
assert.equal(rankedLate.sites[0].homepageIndexStatus,"NOT_NEEDED");
assert.equal(rankedLate.factWrites,0);
assert.equal(rankedLate.officialProductEvidenceConfirmed,false);

// Even fourteen eligible but size-unknown entries ahead of explicit 600ml
// must not consume both page slots. The fallback remains unverified and bounded.
const overTwelveUnknown=Array.from({length:14},(_,i)=>
  "https://neopharmshop.co.kr/product/mle-lotion/"+(4000+i));
const rankedVagueCalls=[];
const rankedVague=await runTrustP2Discovery(scopedRow,scopedProduct,{
  fetchRobots:async url=>({bytes:Buffer.from("User-agent: *\nAllow: /\n"),finalUrl:url}),
  fetchSitemap:async url=>({bytes:Buffer.from(makeSitemapXml([
    ...overTwelveUnknown,sitemapCorrect,
  ])),finalUrl:url}),
  fetchPage:async url=>{
    rankedVagueCalls.push(url);
    return {bytes:Buffer.from("<title>MLE 로션 600ml</title>"),finalUrl:url};
  },
});
assert.deepEqual(rankedVagueCalls,[peer,sitemapCorrect,overTwelveUnknown[0]]);
assert.deepEqual(rankedVague.sites[0].pages.map(p=>p.url),[
  sitemapCorrect,overTwelveUnknown[0],
]);
assert.equal(rankedVague.sites[0].pages.length,2);
assert.equal(rankedVague.subjectCreationAuthorized,false);

// More than twelve denied 600ml URLs (and one www alias) must not crowd out
// the one safe same-origin catalog-size candidate. Robots is checked before
// ranking, not retroactively after the 12-item rediscovery cap.
const overTwelveBlocked=Array.from({length:15},(_,i)=>
  "https://neopharmshop.co.kr/product/mle-lotion-600ml/"+(6000+i));
const lateAllowed="https://neopharmshop.co.kr/product/mle-lotion-600ml/9900";
const blockedCalls=[];
const blockedTrial=await runTrustP2Discovery(scopedRow,scopedProduct,{
  fetchRobots:async url=>({bytes:Buffer.from(
    "User-agent: *\nDisallow: /product/mle-lotion-600ml/6\nAllow: /\n"),finalUrl:url}),
  fetchSitemap:async url=>({bytes:Buffer.from(makeSitemapXml([
    ...overTwelveBlocked,
    "https://www.neopharmshop.co.kr/product/mle-lotion-600ml/9800",
    lateAllowed,
  ])),finalUrl:url}),
  fetchPage:async url=>{
    blockedCalls.push(url);
    return {bytes:Buffer.from("<title>MLE 로션 600ml</title>"),finalUrl:url};
  },
});
assert.deepEqual(blockedCalls,[peer,lateAllowed]);
assert.deepEqual(blockedTrial.sites[0].pages.map(p=>p.url),[lateAllowed]);
assert.equal(blockedTrial.recommendationWrites,0);
assert.equal(blockedTrial.marketVerified,false);

const v2=JSON.parse(fs.readFileSync("evidence/trust/p2d-five-brand-cohort-v2.json","utf8"));
assert.equal(assertTrustP2DCohort(v2),true);
assert.equal(v2.targets.find(x=>x.brand==="아토팜").sizeMl,600);
// Integration-level check: wrong-volume, bonus and kit links may appear on
// a governed peer page but must NOT consume any actual product-page fetches.
const atopalm=v2.targets.find(x=>x.brand==="아토팜");
const fetchedPages=[];
const correctUrl="https://neopharmshop.co.kr/product/mle-lotion-600ml/9000";
const wrongUrl="https://neopharmshop.co.kr/product/mle-lotion-60ml/9001";
const bonusUrl="https://neopharmshop.co.kr/product/mle-lotion-600ml-set/9002";
const peerFixture=Buffer.from([
  '<a href="'+wrongUrl+'">아토팜 MLE 로션 60ml</a>',
  '<a href="'+bonusUrl+'">아토팜 MLE 로션 600ml 1+1</a>',
  '<a href="'+correctUrl+'">아토팜 MLE 로션 600ml</a>',
].join(""));
const prefetch=await runTrustP2Discovery(cohortToTrustedDiscoveryRow(atopalm),{
  id:atopalm.productId,brand:atopalm.brand,name:atopalm.name,
  name_en:atopalm.nameEn,normalized_name:atopalm.normalizedName,
  size_ml:atopalm.sizeMl,
},{
  fetchRobots:async url=>({bytes:Buffer.from("User-agent: *\\nAllow: /\\n"),finalUrl:url}),
  fetchSitemap:async url=>({bytes:Buffer.from("<urlset></urlset>"),finalUrl:url}),
  fetchPage:async url=>{
    fetchedPages.push(url);
    return {bytes:url===atopalm.officialPeerUrl?peerFixture:
      Buffer.from("<title>아토팜 MLE 로션 600ml</title>"),finalUrl:url};
  },
});
assert.deepEqual(prefetch.sites[0].pages.map(p=>p.url),[correctUrl]);
// Exact ordered list: one governed peer read, then the single approved
// candidate page. Any extra/wrong-origin/wrong-quantity fetch fails.
assert.deepEqual(fetchedPages,[atopalm.officialPeerUrl,correctUrl]);
assert.equal(prefetch.factWrites,0);
assert.equal(prefetch.subjectCreationAuthorized,false);

assert.equal(assertTrustP2DCohort(cohort),true);
assert.equal(cohort.targets.length,5);
assert.equal(new Set(cohort.targets.map(t=>t.brand)).size,5);
assert.equal(new Set(cohort.targets.map(t=>new URL(t.officialPeerUrl).origin)).size,5);
for(const target of cohort.targets){
  const row=cohortToTrustedDiscoveryRow(target);
  assert.equal(row.discoveryOrigins.length,1);
  assert.equal(row.discoveryOrigins[0].evidenceRefs.length,1);
  assert.equal(row.discoveryOrigins[0].evidenceRefs[0].peerOfficialLocator,target.officialPeerUrl);
  assert.equal(row.subjectCreationAuthorized,false);
  assert.equal(row.marketVerified,false);
}
const duplicate=structuredClone(cohort);
duplicate.targets[1].brand=duplicate.targets[0].brand;
assert.throws(()=>assertTrustP2DCohort(duplicate),/P2D_INVALID_OR_DUPLICATE_BRAND/);
const authority=structuredClone(cohort);
authority.targets[0].peerKind="hwahae_review";
assert.throws(()=>assertTrustP2DCohort(authority),/P2D_INVALID_IDENTITY_SNAPSHOT/);

const BASE={
  readOnly:true,subjectCreationAuthorized:false,officialProductEvidenceConfirmed:false,
  factWrites:0,recommendationWrites:0,aiApiCalls:0,marketVerified:false,
  formulationVerified:false,
};
const page=(status,url="https://www.torriden.com/goods/goods_view.php?goodsNo=808")=>
  ({url,status,sha256:"f".repeat(64)});
function assessed(siteStatus,pages){
  return assessTrustP2DDiscovery({...BASE,sites:[{
    status:siteStatus,pages,origin:"https://www.torriden.com",
  }]});
}
assert.equal(assessed("ROBOTS_UNAVAILABLE",[]).state,"SOURCE_POLICY_HOLD");
assert.equal(assessed("ROBOTS_DISALLOWED",[]).state,"SOURCE_POLICY_HOLD");
assert.equal(assessed("NO_SAFE_CANDIDATE",[]).state,"NO_PRODUCT_PAGE");
// The live diagnostic path preserves only locator/status/title/digest; no raw pages.
const diagnosticMock={
  fetchRobots:async()=>({bytes:Buffer.from("User-agent: *\\nAllow: /\\n")}),
  fetchSitemap:async url=>({bytes:Buffer.from(url.endsWith("sitemap.xml")?
    '<urlset><url><loc>https://neopharmshop.co.kr/product/mle-%EB%A1%9C%EC%85%98/3000</loc></url></urlset>':
    "<urlset></urlset>"),finalUrl:url}),
  fetchPage:async url=>({bytes:Buffer.from("<title>MLE 로션 - 아토팜</title>"),finalUrl:url}),
};
const diagnosticCohort=structuredClone(cohort);
diagnosticCohort.targets[0].officialPeerUrl="https://neopharmshop.co.kr/product/peer/2166";
// The other 4 domains are intentionally not contacted in this deterministic fixture.
const mock=await runTrustP2DFiveBrandPilot({execute:true,cohort,fetchers:diagnosticMock});
assert.equal(mock.items.length,5);
assert.equal(mock.items[0].assessment.sourceDiagnostics.length,1);
assert.ok(Array.isArray(mock.items[0].assessment.sourceDiagnostics[0].pages));
assert.equal(JSON.stringify(mock).includes("<title>"),false);
assert.equal(mock.summary.dbWrites,0);
// Offline-only stage diagnosis: distinguish source access, sitemap/index
// discovery, wrong variants and page identity without any network request.
const diagnosticSite=(overrides={})=>({
  status:"NO_SAFE_CANDIDATE",pages:[],observations:[],
  homepageIndexStatus:"NOT_NEEDED",peerIndexCandidateCount:0,...overrides,
});
const siteReason=(site)=>diagnoseTrustP2DSite(site).reason;
assert.equal(siteReason(diagnosticSite({status:"ROBOTS_UNAVAILABLE"})),
  "ROBOTS_UNAVAILABLE_HOLD");
assert.equal(siteReason(diagnosticSite({status:"ROBOTS_DISALLOWED"})),
  "ROBOTS_DISALLOWED_HOLD");
assert.equal(siteReason(diagnosticSite({status:"CRAWL_DELAY_NOT_SUPPORTED"})),
  "ROBOTS_PACING_HOLD");
assert.equal(siteReason(diagnosticSite({observations:[{kind:"sitemap",status:"FETCHED"}],
  homepageIndexStatus:"FETCHED"})),"NO_ELIGIBLE_OFFICIAL_INDEX_LINK");
assert.equal(siteReason(diagnosticSite({observations:[{kind:"sitemap",status:"FETCHED"}]})),
  "NO_MATCHING_SITEMAP_URL");
assert.equal(siteReason(diagnosticSite({observations:[{kind:"sitemap",status:"SOURCE_BLOCKED"}]})),
  "SITEMAP_FETCH_HOLD");
assert.equal(siteReason(diagnosticSite({homepageIndexStatus:"SOURCE_BLOCKED"})),
  "OFFICIAL_INDEX_FETCH_HOLD");
assert.equal(siteReason(diagnosticSite({pages:[{status:"SOURCE_BLOCKED"}]})),
  "PRODUCT_PAGE_FETCH_HOLD");
assert.equal(siteReason(diagnosticSite({pages:[{status:"IDENTITY_UNRESOLVED",
  sha256:"a".repeat(64)}]})),"FETCHED_PAGE_IDENTITY_UNRESOLVED");
assert.equal(siteReason(diagnosticSite({pages:[{status:"CATALOG_SIZE_MISMATCH",
  sha256:"a".repeat(64)}]})),"WRONG_VARIANT_PAGE_HOLD");
assert.equal(siteReason(diagnosticSite({pages:[{status:"STRUCTURED_NAME_CANDIDATE",
  sha256:"a".repeat(64)}]})),"NAME_CANDIDATE_REVIEW_ONLY");
const counts=diagnoseTrustP2DSite(diagnosticSite({
  observations:[{kind:"sitemap",status:"FETCHED"},{kind:"sitemap",status:"SOURCE_BLOCKED"}],
  peerIndexCandidateCount:1,
  pages:[{status:"CATALOG_SIZE_MISMATCH",sha256:"a".repeat(64)}],
}));
assert.equal(counts.sitemapFetchedCount,1);
assert.equal(counts.sitemapUnavailableCount,1);
assert.equal(counts.peerLinkCandidateCount,1);
assert.equal(counts.wrongVariantCount,1);
assert.equal(counts.pagesFetchedCount,1);
assert.equal(counts.verifiedExactSkuCount,0);
assert.equal(counts.sourceBindingAuthorized,false);
assert.equal(Object.isFrozen(counts),true);
assert.throws(()=>diagnoseTrustP2DSite({pages:null}),
  /P2D_INVALID_SITE_DIAGNOSTIC/);
assert.ok(mock.items.every(item=>item.assessment.sourceDiagnostics.every(site=>
  site.stageDiagnosis?.sourceBindingAuthorized===false)));
assert.equal(JSON.stringify(mock).includes("<title>"),false);

assert.equal(assessed("CANDIDATES_DISCOVERED",[page("SCOPED_HEADING_CANDIDATE")]).state,
 "IDENTITY_CANDIDATE_REVIEW_REQUIRED");
assert.equal(assessed("CANDIDATES_DISCOVERED",[page("BODY_NAME_MENTION_ONLY")]).state,
 "BODY_MENTION_REVIEW_REQUIRED");
assert.equal(assessed("CANDIDATES_DISCOVERED",[page("IDENTITY_UNRESOLVED")]).state,
 "NO_MATCHING_PRODUCT_IDENTITY");
assert.equal(assessed("CANDIDATES_DISCOVERED",[
 page("STRUCTURED_NAME_CANDIDATE"),page("SCOPED_HEADING_CANDIDATE"),
]).distinctCandidateLocators,1);
assert.throws(()=>assessTrustP2DDiscovery({...BASE,factWrites:1,sites:[]}),
 /P2D_UNSAFE_DISCOVERY_RESULT/);
const plan=await runTrustP2DFiveBrandPilot({execute:false,cohort});
assert.equal(plan.summary.processedProducts,5);
assert.equal(plan.summary.officialPagesFetched,0);
assert.equal(plan.summary.aiApiCalls,0);
assert.equal(plan.summary.dbWrites,0);
assert.equal(plan.summary.identityCandidateProducts,0);
assert.equal(plan.mode,"PLAN_ONLY_NO_NETWORK");
assert.equal(plan.items.every(x=>x.subjectCreationAuthorized===false),true);
const five=cohort.targets.map((t,i)=>({
  productId:t.productId,assessment:i===0
    ?assessed("CANDIDATES_DISCOVERED",[page("SCOPED_HEADING_CANDIDATE")])
    :i===1
      ?assessed("CANDIDATES_DISCOVERED",[page("BODY_NAME_MENTION_ONLY")])
      :i===2?assessed("CANDIDATES_DISCOVERED",[page("IDENTITY_UNRESOLVED")])
        :assessed("ROBOTS_UNAVAILABLE",[]),
}));
const summary=summarizeTrustP2D(five);
assert.equal(summary.identityCandidateProducts,1);
assert.equal(summary.productIdentificationRate,0.2);
assert.equal(summary.falsePositiveVerifiedCount,undefined);
assert.equal(summary.zeroFalsePositiveAssertionNotMade,true);
assert.equal(summary.factWrites,0);
assert.throws(()=>summarizeTrustP2D(five.slice(0,4)),/P2D_INVALID_REPORT_ROWS/);
const previous=process.env.TRUST_P2D_FIVE_BRAND_LIVE_ENABLED;
delete process.env.TRUST_P2D_FIVE_BRAND_LIVE_ENABLED;
try{
  await assert.rejects(()=>runTrustP2DCli(["--execute"]),/P2D_LIVE_DISABLED/);
}finally{
  if(previous===undefined)delete process.env.TRUST_P2D_FIVE_BRAND_LIVE_ENABLED;
  else process.env.TRUST_P2D_FIVE_BRAND_LIVE_ENABLED=previous;
}
const source=fs.readFileSync("scripts/trust-p2d-five-brand-pilot.mjs","utf8");
for(const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(",
 "SUPABASE_SERVICE_ROLE_KEY","openai","gemini"]){
  assert.ok(!source.toLowerCase().includes(forbidden.toLowerCase()),"P2D forbidden call "+forbidden);
}
assert.match(source,/runTrustP2Discovery/);
assert.match(source,/trustP2LiveFetchers/);
assert.match(source,/zeroFalsePositiveAssertionNotMade:true/);
console.log("TRUST_P2D_FIVE_BRAND_COHORT_AND_ASSESSMENT_PASS");
