#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validateTrustP2F7TorridenScope,
  runTrustP2F7TorridenDiagnostic,
  runTrustP2F7TorridenCli,
} from "./trust-p2f7-torriden-root-one-time.mjs";

const cohort=JSON.parse(fs.readFileSync(
  "evidence/trust/p2d-five-brand-cohort-v2.json","utf8"));
const readiness=JSON.parse(fs.readFileSync(
  "evidence/trust/p2f6-ad-remeasurement-readiness-20261019.json","utf8"));
const prior=JSON.parse(fs.readFileSync(
  "evidence/trust/p2f6-pre-resolved-readonly-observed-20261019.json","utf8"));
const URL="https://www.torriden.com/goods/goods_view.php?goodsNo=58";
const ORIGIN="https://www.torriden.com";
const scoped=validateTrustP2F7TorridenScope(cohort,readiness,prior);
assert.equal(scoped.length,1);
assert.deepEqual(scoped.map(x=>x.url),[URL]);
assert.equal(scoped[0].origin,ORIGIN);
assert.equal(scoped[0].productId,
  cohort.targets.find(x=>x.brand==="토리든").productId);

const changedReadiness=structuredClone(readiness);
changedReadiness.publicIndexReview.find(x=>x.brand==="토리든").sourceUrl=
  "https://www.torriden.com/goods/goods_view.php?goodsNo=136";
assert.throws(()=>validateTrustP2F7TorridenScope(
  cohort,changedReadiness,prior),/P2F7_TORRIDEN_LOCATOR_OR_BASELINE_CHANGED/);
const changedCohort=structuredClone(cohort);
changedCohort.targets.find(x=>x.brand==="토리든").sizeMl=100;
assert.throws(()=>validateTrustP2F7TorridenScope(
  changedCohort,readiness,prior),/P2F7_TORRIDEN_LOCATOR_OR_BASELINE_CHANGED/);
const changedBaseline=structuredClone(prior);
changedBaseline.outcomes.find(x=>x.brand==="토리든").primaryRootStatus=
  "SCOPED_NAME_AND_FORM_CANDIDATE";
assert.throws(()=>validateTrustP2F7TorridenScope(
  cohort,readiness,changedBaseline),/P2F7_TORRIDEN_LOCATOR_OR_BASELINE_CHANGED/);

const title="<title>토리든 Torriden</title>";
const own=html=>"<html><head>"+title+"</head><body>"+
  '<section class="product-detail">'+html+"</section></body></html>";
const selected='<form id="product-form"><select name="size">'+
  '<option value="50ml" selected>50ml</option>'+
  '<option value="100ml">100ml</option></select></form>';
const named='<h3 class="goods-name">다이브인 저분자 히알루론산 세럼</h3>';
const robots=Buffer.from("User-agent: *\nAllow: /\n");
const calls=[];
const goodFetchers={
  fetchRobots:async(url,origin)=>{
    calls.push(["robots",url,origin]);
    return {bytes:robots,finalUrl:url};
  },
  fetchSitemap:async()=>{throw Error("SITEMAP_FORBIDDEN");},
  fetchPage:async(url,origin)=>{
    calls.push(["page",url,origin]);
    return {bytes:Buffer.from(own(named+selected)),finalUrl:url};
  },
};
const plan=await runTrustP2F7TorridenDiagnostic({
  execute:false,cohort,readiness,prior,fetchers:goodFetchers,paceMs:0,
});
assert.equal(plan.requestAttempts,0);
assert.equal(plan.productPagesFetched,0);
assert.equal(plan.frozenDenominator,5);
assert.equal(plan.page,null);
assert.equal(calls.length,0);

const scopedLiveMock=await runTrustP2F7TorridenDiagnostic({
  execute:true,cohort,readiness,prior,fetchers:goodFetchers,paceMs:0,
});
assert.equal(scopedLiveMock.requestAttempts,2);
assert.deepEqual(scopedLiveMock.requests,{robots:1,product:1,sitemap:0});
assert.deepEqual(calls,[["robots",ORIGIN+"/robots.txt",ORIGIN],
  ["page",URL,ORIGIN]]);
assert.equal(scopedLiveMock.productPagesFetched,1);
assert.equal(scopedLiveMock.targetState,"IDENTITY_CANDIDATE_REVIEW_REQUIRED");
assert.equal(scopedLiveMock.page.status,"SCOPED_HEADING_CANDIDATE");
assert.equal(scopedLiveMock.page.primaryRoot.status,
  "SCOPED_NAME_AND_FORM_CANDIDATE");
assert.equal(scopedLiveMock.page.primaryRoot.holdStage,
  "SCOPED_SELECTED_SIZE_SHADOW_ONLY");
assert.equal(scopedLiveMock.page.primaryRoot.selectedSizeStatus,
  "SELECTED_SIZE_MATCH_SHADOW_ONLY");
assert.equal(scopedLiveMock.page.primaryRoot.matchedRootCount,1);
assert.equal(scopedLiveMock.page.primaryRoot.matchedTitleCount,1);
assert.equal(scopedLiveMock.independentlyVerifiedExactSkuCount,0);
assert.deepEqual(scopedLiveMock.writes,{
  productWrites:0,sourceBindings:0,subjectWrites:0,factWrites:0,
  dbWrites:0,recommendationWrites:0,aiApiCalls:0,brandOutreach:0,
});

const plainFetchers={...goodFetchers,
  fetchPage:async url=>({bytes:Buffer.from(own(
    '<p class="normal-description">다이브인 저분자 히알루론산 세럼</p>'+
    selected)),finalUrl:url}),
};
const weak=await runTrustP2F7TorridenDiagnostic({
  execute:true,cohort,readiness,prior,fetchers:plainFetchers,paceMs:0,
});
assert.equal(weak.targetState,"BODY_MENTION_REVIEW_REQUIRED");
assert.equal(weak.page.primaryRoot.status,"PRIMARY_ROOT_NOT_PROVEN");
assert.equal(weak.page.primaryRoot.holdStage,
  "ROOT_BODY_NAME_WITHOUT_SCOPED_TITLE_HOLD");
assert.equal(weak.page.primaryRoot.titleMarkerCount,0);
assert.equal(weak.page.primaryRoot.rootBodyNameMentionCount,1);
assert.equal(weak.page.primaryRoot.scopedNameAndSizeCandidate,false);
const noSelection=await runTrustP2F7TorridenDiagnostic({
  execute:true,cohort,readiness,prior,paceMs:0,
  fetchers:{...goodFetchers,fetchPage:async url=>({
    bytes:Buffer.from(own(named+selected.replace(" selected",""))),finalUrl:url,
  })},
});
assert.notEqual(noSelection.page?.status,"SCOPED_HEADING_CANDIDATE");
assert.equal(noSelection.page?.primaryRoot?.holdStage,
  "SELECTED_SIZE_SHADOW_NOT_MATCHED_HOLD");
assert.equal(noSelection.page?.primaryRoot?.selectedSizeStatus,
  "NO_EXPLICIT_SELECTED_SIZE_HOLD");

const disallowedCalls=[];
const disallowed=await runTrustP2F7TorridenDiagnostic({
  execute:true,cohort,readiness,prior,paceMs:0,
  fetchers:{
    fetchRobots:async url=>{
      disallowedCalls.push(url);
      return {bytes:Buffer.from("User-agent: *\nDisallow: /\n"),finalUrl:url};
    },
    fetchSitemap:async()=>{throw Error("SITEMAP_FORBIDDEN");},
    fetchPage:async()=>{throw Error("DISALLOWED_PAGE_MUST_NOT_FETCH");},
  },
});
assert.deepEqual(disallowedCalls,[ORIGIN+"/robots.txt"]);
assert.equal(disallowed.requestAttempts,1);
assert.equal(disallowed.productPagesFetched,0);
assert.equal(disallowed.page,null);
assert.equal(disallowed.targetState,"SOURCE_POLICY_HOLD");
assert.equal(disallowed.requestDisposition,"PAGE_NOT_REQUESTED_POLICY_HOLD");

const blocked=await runTrustP2F7TorridenDiagnostic({
  execute:true,cohort,readiness,prior,paceMs:0,
  fetchers:{...goodFetchers,
    fetchPage:async()=>{throw Error("SOURCE_BLOCKED:http_403");}},
});
assert.equal(blocked.requestAttempts,2);
assert.equal(blocked.productPagesFetched,0);
assert.equal(blocked.page.status,"SOURCE_BLOCKED");
assert.equal(blocked.page.fetchFailure.reason,"HTTP_ACCESS_REJECTED");
assert.equal(blocked.page.fetchFailure.httpStatus,403);

for(const result of [scopedLiveMock,weak,noSelection,disallowed,blocked]){
  assert.equal(result.frozenDenominator,5);
  assert.deepEqual(result.excludedProductBrands,
    ["닥터지","비플레인","아토팜","이즈앤트리"]);
  assert.equal(result.retiredDrGNoRequests,true);
  assert.equal(result.requestBudget,2);
  assert.equal(result.requests.sitemap,0);
  assert.equal(result.sourceBindingAuthorized,false);
  assert.equal(result.subjectCreationAuthorized,false);
  assert.equal(result.factConfirmationAuthorized,false);
  assert.equal(result.commercialIngestionAuthorized,false);
  assert.equal(result.independentlyVerifiedExactSkuCount,0);
  const snapshot=JSON.stringify(result);
  for(const secret of ["<html","<h3","<form","normal-description",
    "goods-name","User-agent:", "script>", "password", "API_KEY"]){
    assert.ok(!snapshot.includes(secret),"No raw HTML or secrets in evidence: "+secret);
  }
}
const oldEnable=process.env.TRUST_P2F7_TORRIDEN_ONE_TIME_LIVE_ENABLED;
const oldMarker=process.env.TRUST_P2F7_MAIN_PUSH_MARKER;
const oldEvent=process.env.GITHUB_EVENT_NAME;
const oldRef=process.env.GITHUB_REF;
try{
  delete process.env.TRUST_P2F7_TORRIDEN_ONE_TIME_LIVE_ENABLED;
  await assert.rejects(()=>runTrustP2F7TorridenCli(["--execute"]),
    /P2F7_TORRIDEN_MAIN_ONE_TIME_GATE_REQUIRED/);
  assert.throws(()=>validateTrustP2F7TorridenScope(
    cohort,readiness,{...prior,observedRequests:5}),
  /P2F7_TORRIDEN_FROZEN_EVIDENCE_INVALID/);
}finally{
  for(const [name,value] of [
    ["TRUST_P2F7_TORRIDEN_ONE_TIME_LIVE_ENABLED",oldEnable],
    ["TRUST_P2F7_MAIN_PUSH_MARKER",oldMarker],
    ["GITHUB_EVENT_NAME",oldEvent],["GITHUB_REF",oldRef],
  ]){
    if(value===undefined)delete process.env[name];
    else process.env[name]=value;
  }
}
console.log("TRUST_P2F7_TORRIDEN_SINGLE_ORIGIN_OFFLINE_GUARDS_PASS");
