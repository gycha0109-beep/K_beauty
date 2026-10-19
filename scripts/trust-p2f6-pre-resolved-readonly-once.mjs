#!/usr/bin/env node
/**
 * One-time, first-party, read-only P2-F6 A-D remeasurement.
 * Only two pre-vetted same-origin public product URLs: Isntree and Torriden.
 * Frozen five-product denominator; Dr.G retired; beplain/ATOPALM mismatch HOLD.
 * No ingestion manifest mutation, HTML storage, product/Fact/Subject/DB writes.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runTrustP2DFiveBrandPilot,assertTrustP2DCohort } from "./trust-p2d-five-brand-pilot.mjs";
import { trustP2LiveFetchers } from "../lib/trust/official-product-discovery-p2-v1.mjs";

export const TRUST_P2F6_ONE_TIME_CONTRACT="trust-p2f6-public-pre-resolved-readonly-v1";
const MANIFEST="evidence/trust/p2f6-ad-remeasurement-readiness-20261019.json";
const COHORT="evidence/trust/p2d-five-brand-cohort-v2.json";
const ARTIFACT="artifacts/trust-p2f6-pre-resolved-readonly-result.json";
const PACE_MS=1300;
const EXACT_URLS=new Map([
  ["이즈앤트리","https://isntree.com/product/%ED%99%94%ED%95%B4-1%EB%93%B1-%EC%B4%88%EC%A0%80%EB%B6%84%EC%9E%90-%ED%9E%88%EC%95%84%EB%A3%A8%EB%A1%A0%EC%82%B0-%ED%86%A0%EB%84%88-300ml/56/category/112/display/1/"],
  ["토리든","https://www.torriden.com/goods/goods_view.php?goodsNo=58"],
]);
const HELD=new Map([
  ["닥터지","RETIRED_ORIGIN_HOLD"],
  ["비플레인","UNIT_AND_OFFER_MISMATCH_REVIEW_REQUIRED"],
  ["아토팜","WRONG_SIZE_300ML_NOT_600ML"],
]);
function reject(code){throw Error(code);}
function loadJson(file){return JSON.parse(fs.readFileSync(file,"utf8"));}

export function validateTrustP2F6RemeasureScope(cohort,manifest){
  assertTrustP2DCohort(cohort);
  if(cohort.contract!=="trust-p2d-five-brand-live-cohort-v2"||
    manifest?.contract!=="trust-p2f6-ad-remeasurement-readiness-v1"||
    manifest.disposition!=="NO_NEW_GOVERNED_LIVE_MEASUREMENT"||
    manifest.cohort?.denominator!==5||
    !Array.isArray(manifest.publicIndexReview)||
    manifest.publicIndexReview.length!==5||
    manifest.historicalControlledBenchmark?.confirmedExactSkuCount!==0)
    reject("P2F6_READONLY_SCOPE_INVALID");
  const ids=new Set();
  const typed=[];
  for(const target of cohort.targets){
    const records=manifest.publicIndexReview.filter(x=>x.productId===target.productId);
    if(records.length!==1||ids.has(target.productId)||
      records[0].brand!==target.brand||
      records[0].catalogSizeMl!==target.sizeMl)
      reject("P2F6_READONLY_COHORT_OR_CATALOG_MISMATCH");
    ids.add(target.productId);
    const record=records[0];
    if(EXACT_URLS.has(target.brand)){
      const url=EXACT_URLS.get(target.brand);
      if(record.eligibleForDirectProbe!==true||record.publicIndexOnly!==true||
        record.sourceUrl!==url||new URL(url).origin!==
          new URL(target.officialPeerUrl).origin)
        reject("P2F6_READONLY_LOCATOR_NOT_FROZEN");
      typed.push(Object.freeze({
        kind:"PRE_RESOLVED_OFFICIAL_PRODUCT_URL",
        source:"OPERATOR_SUPPLIED_PUBLIC_URL",productId:target.productId,
        origin:new URL(url).origin,url,
      }));
    }else if(record.eligibleForDirectProbe!==false||
      record.decision!==HELD.get(target.brand))
      reject("P2F6_READONLY_HELD_PRODUCT_NOT_FROZEN");
  }
  if(typed.length!==2||new Set(typed.map(x=>x.origin)).size!==2)
    reject("P2F6_READONLY_TWO_ORIGIN_REQUIRED");
  return Object.freeze(typed);
}

/**
 * execute=false: plan only, zero callbacks.
 * execute=true: requires a separate guarded caller (CI gate or injected offline
 * tests); freezes two allowed hosts/URLs and max 1 robots + 1 page per host.
 */
export async function runTrustP2F6Remeasure({
  execute=false,
  cohort=loadJson(COHORT),
  manifest=loadJson(MANIFEST),
  fetchers=trustP2LiveFetchers(),
  paceMs=PACE_MS,
}={}){
  if(typeof execute!=="boolean"||!Number.isFinite(paceMs)||paceMs<0||
    !fetchers||typeof fetchers.fetchRobots!=="function"||
    typeof fetchers.fetchPage!=="function")
    reject("P2F6_READONLY_ARGUMENT_INVALID");
  const typed=validateTrustP2F6RemeasureScope(cohort,manifest);
  const origins=new Map(typed.map(x=>[x.origin,x.url]));
  const counters=new Map([...origins.keys()].map(origin=>[origin,{robots:0,page:0,sitemap:0}]));
  let lastAt=0;
  const pace=async()=>{
    if(paceMs===0)return;
    const delay=Math.max(0,paceMs-(Date.now()-lastAt));
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    lastAt=Date.now();
  };
  const enforce=(kind,url,origin)=>{
    const allowed=origins.get(origin);
    if(!allowed||typeof url!=="string"||
      (kind==="robots"?url!==origin+"/robots.txt":url!==allowed))
      reject("P2F6_READONLY_UNEXPECTED_URL_OR_ORIGIN");
    const counts=counters.get(origin);
    if(counts[kind]>=1)reject("P2F6_READONLY_REQUEST_BUDGET_EXCEEDED");
    counts[kind]++;
  };
  const guarded={
    fetchRobots:async(url,origin)=>{
      enforce("robots",url,origin);await pace();
      return fetchers.fetchRobots(url,origin);
    },
    fetchSitemap:async()=>reject("P2F6_READONLY_SITEMAP_NOT_AUTHORIZED"),
    fetchPage:async(url,origin,policy)=>{
      enforce("page",url,origin);await pace();
      return fetchers.fetchPage(url,origin,policy);
    },
  };
  // No source callbacks before cohort and frozen two-URL validation above.
  const run=await runTrustP2DFiveBrandPilot({
    execute,cohort,holdRetiredDrG:true,
    approvedBrands:execute?new Set(EXACT_URLS.keys()):null,
    preResolvedLocators:typed,
    fetchers:guarded,
  });
  if(run.items.length!==5||run.summary.processedProducts!==5||
    run.summary.confirmedExactSkuCount!==0||
    run.summary.subjectWrites!==0||run.summary.factWrites!==0||
    run.summary.dbWrites!==0||run.summary.recommendationWrites!==0||
    run.summary.aiApiCalls!==0||
    run.items.find(x=>x.brand==="닥터지")?.assessment.state!=="RETIRED_ORIGIN_HOLD")
    reject("P2F6_READONLY_UNSAFE_RESULT");
  const requestCounts=[...counters].map(([origin,counts])=>({
    origin,robots:counts.robots,page:counts.page,sitemap:counts.sitemap,
  }));
  const attempts=requestCounts.reduce((sum,x)=>sum+x.robots+x.page+x.sitemap,0);
  if(attempts>(execute?4:0)||requestCounts.some(x=>x.robots>1||x.page>1||x.sitemap!==0))
    reject("P2F6_READONLY_REQUEST_TOTAL_EXCEEDED");
  const result={
    contract:TRUST_P2F6_ONE_TIME_CONTRACT,observedAt:run.observedAt,
    executionMode:execute?"LIVE_ROBOTS_FIRST_READONLY":"OFFLINE_PLAN_ONLY",
    frozenDenominator:5,retiredOriginHold:"닥터지",
    heldCatalogProducts:["비플레인","아토팜"],
    eligibleDirectOrigins:2,requestBudget:4,requestAttempts:attempts,
    requestCounts,summary:run.summary,items:run.items,
    historicalBaseline:{httpRequests:28,productPagesFetched:2,verifiedExactSkuCount:0},
    newIndependentExactSkuVerifications:0,
    nameCandidatesNotSkuProof:true,siteTermsOrReuseLicenseInferred:false,
    sourceBindingAuthorized:false,subjectCreationAuthorized:false,
    factConfirmationAuthorized:false,dbWrites:0,aiApiCalls:0,
  };
  return Object.freeze(result);
}
export async function runTrustP2F6RemeasureCli(args=process.argv.slice(2)){
  if(args.length>1||args.some(x=>!["--plan","--execute"].includes(x)))
    reject("P2F6_READONLY_UNSUPPORTED_CLI_FLAG");
  const execute=args.includes("--execute");
  if(execute&&(
    process.env.TRUST_P2F6_ONE_TIME_LIVE_ENABLED!=="true"||
    process.env.GITHUB_EVENT_NAME!=="push"||
    process.env.GITHUB_REF!=="refs/heads/main"
  ))reject("P2F6_READONLY_MAIN_ONE_TIME_AUTHORIZATION_REQUIRED");
  const result=await runTrustP2F6Remeasure({execute});
  if(execute){
    fs.mkdirSync(path.dirname(ARTIFACT),{recursive:true});
    fs.writeFileSync(ARTIFACT,JSON.stringify(result,null,2)+"\n");
  }
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const result=await runTrustP2F6RemeasureCli();
    console.log("TRUST_P2F6_READONLY_RESULT="+JSON.stringify({
      contract:result.contract,executionMode:result.executionMode,
      frozenDenominator:result.frozenDenominator,
      requestAttempts:result.requestAttempts,
      pagesFetched:result.summary.officialPagesFetched,
      identityCandidateProducts:result.summary.identityCandidateProducts,
      independentExactSkuVerified:result.newIndependentExactSkuVerifications,
      statusCounts:result.summary.statusCounts,
    }));
  }catch(error){
    console.error(String(error?.message??"P2F6_READONLY_EXECUTION_HOLD").split(":")[0]);
    process.exitCode=1;
  }
}
