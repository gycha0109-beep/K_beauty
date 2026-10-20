#!/usr/bin/env node
/**
 * One-time owner-approved P2-F7 Torriden 50ml official-page failure-stage
 * observation. Frozen five-product denominator. No HTML storage, AI, DB,
 * Subject, Fact, source binding, recommendation or catalog writes.
 *
 * The GitHub workflow is the only authorized live caller: main push with
 * explicit once-only marker, 1 official robots + at most 1 exact product TARGET_URL.
 */
import fs from "node:fs";
import {pathToFileURL} from "node:url";
import {
  assertTrustP2DCohort,runTrustP2DFiveBrandPilot,
} from "./trust-p2d-five-brand-pilot.mjs";
import {trustP2LiveFetchers}
  from "../lib/trust/official-product-discovery-p2-v1.mjs";

export const P2F7_CONTRACT="trust-p2f7-torriden-root-failure-observation-v1";
const TARGET="토리든";
const PRODUCT_ID="31015762-2741-4211-a553-3ceb7fdf32e8";
const ORIGIN="https://www.torriden.com";
const TARGET_URL="https://www.torriden.com/goods/goods_view.php?goodsNo=58";
const COHORT="evidence/trust/p2d-five-brand-cohort-v2.json";
const READINESS="evidence/trust/p2f6-ad-remeasurement-readiness-20261019.json";
const PRIOR="evidence/trust/p2f6-pre-resolved-readonly-observed-20261019.json";
const OUTFILE="artifacts/trust-p2f7-torriden-root-diagnostic.json";
const MARKER="P2F7-TORRIDEN-ROOT-DIAGNOSTIC-ONCE-20261020";
const ALLOWED_BRANDS=new Set([TARGET]);
const NO_WRITES=Object.freeze({
  productWrites:0,sourceBindings:0,subjectWrites:0,factWrites:0,
  dbWrites:0,recommendationWrites:0,aiApiCalls:0,brandOutreach:0,
});
function fail(code){throw new Error(code);}
function readJson(file){return JSON.parse(fs.readFileSync(file,"utf8"));}
const boundedCount=v=>Number.isInteger(v)&&v>=0&&v<=99?v:0;
const safeEnum=v=>typeof v==="string"&&/^[A-Z][A-Z0-9_]{0,75}$/.test(v)?v:null;

export function validateTrustP2F7TorridenScope(cohort,readiness,prior){
  assertTrustP2DCohort(cohort);
  if(cohort.contract!=="trust-p2d-five-brand-live-cohort-v2"||
    readiness?.contract!=="trust-p2f6-ad-remeasurement-readiness-v1"||
    prior?.contract!=="trust-p2f6-public-pre-resolved-readonly-evidence-v1"||
    prior.frozenDenominator!==5||
    prior.independentlyVerifiedExactSkuCount!==0||
    prior.observedRequests!==4||
    prior.successfulProductPageDownloads!==2||
    !Array.isArray(readiness.publicIndexReview)||
    readiness.publicIndexReview.length!==5||
    !Array.isArray(prior.outcomes)||prior.outcomes.length!==5)
    fail("P2F7_TORRIDEN_FROZEN_EVIDENCE_INVALID");
  const expectedBrands=["닥터지","비플레인","아토팜","이즈앤트리","토리든"];
  if(new Set(cohort.targets.map(x=>x.brand)).size!==5||
    expectedBrands.some(brand=>!cohort.targets.some(x=>x.brand===brand)||
      readiness.publicIndexReview.filter(x=>x.brand===brand).length!==1||
      prior.outcomes.filter(x=>x.brand===brand).length!==1))
    fail("P2F7_TORRIDEN_COHORT_CHANGED");
  const target=cohort.targets.find(x=>x.brand===TARGET);
  const indexed=readiness.publicIndexReview.find(x=>x.brand===TARGET);
  const observed=prior.outcomes.find(x=>x.brand===TARGET);
  if(target.productId!==PRODUCT_ID||target.sizeMl!==50||
    new URL(target.officialPeerUrl).origin!==ORIGIN||
    indexed.productId!==target.productId||indexed.catalogSizeMl!==50||
    indexed.eligibleForDirectProbe!==true||
    indexed.publicIndexOnly!==true||indexed.sourceUrl!==TARGET_URL||
    observed.state!=="BODY_MENTION_REVIEW_REQUIRED"||
    observed.pageStatus!=="BODY_NAME_MENTION_ONLY"||
    observed.primaryRootStatus!=="PRIMARY_ROOT_NOT_PROVEN"||
    observed.catalogSizeMl!==50||
    observed.exactSkuVerified!==false)
    fail("P2F7_TORRIDEN_LOCATOR_OR_BASELINE_CHANGED");
  for(const brand of expectedBrands.filter(x=>x!==TARGET)){
    const item=readiness.publicIndexReview.find(x=>x.brand===brand);
    const baseline=prior.outcomes.find(x=>x.brand===brand);
    if(brand==="닥터지"&&baseline.state!=="RETIRED_ORIGIN_HOLD")
      fail("P2F7_TORRIDEN_RETIRED_ORIGIN_NOT_HELD");
    if(item.productId!==cohort.targets.find(x=>x.brand===brand).productId||
      baseline.exactSkuVerified!==false)
      fail("P2F7_TORRIDEN_OTHER_PRODUCT_CHANGED");
  }
  return Object.freeze([Object.freeze({
    kind:"PRE_RESOLVED_OFFICIAL_PRODUCT_URL",
    source:"OPERATOR_SUPPLIED_PUBLIC_URL",productId:PRODUCT_ID,
    origin:ORIGIN,url:TARGET_URL,
  })]);
}

function sanitizedPage(page){
  if(!page)return null;
  if(page.url!==TARGET_URL)fail("P2F7_TORRIDEN_UNEXPECTED_PAGE_URL");
  const root=page.primaryRootDiagnostic;
  const countKeys=[
    "rootMarkerCount","titleMarkerCount","rootBodyNameMentionCount",
    "matchedRootCount","matchedTitleCount","ownedFormCount",
    "ownedOptionControlCount",
  ];
  const detail=root&&typeof root==="object"?{
    status:safeEnum(root.status),
    holdStage:safeEnum(root.holdStage),
    parseComplete:root.parseComplete===true,
    selectedSizeStatus:safeEnum(root.selectedSizeStatus),
    scopedNameAndSizeCandidate:root.scopedNameAndSizeCandidate===true,
    exactSkuVerified:false,
    ...Object.fromEntries(countKeys.map(k=>[k,boundedCount(root[k])])),
  }:null;
  if(page.sha256!==null&&page.sha256!==undefined&&
    (typeof page.sha256!=="string"||!/^[a-f0-9]{64}$/.test(page.sha256)))
    fail("P2F7_TORRIDEN_INVALID_DIGEST");
  const fetch=page.fetchFailure;
  return {
    status:safeEnum(page.status),
    nameSignalStatus:safeEnum(page.nameSignalStatus),
    identitySurface:typeof page.identitySurface==="string"&&
      /^[a-z][a-z0-9_]{0,75}$/.test(page.identitySurface)?
      page.identitySurface:null,
    digest:page.sha256??null,
    variantStatus:safeEnum(page.variantScope?.status),
    unitOfferStatus:safeEnum(page.unitOfferScope?.status),
    fetchFailure:fetch?{
      reason:safeEnum(fetch.reason),
      httpStatus:Number.isInteger(fetch.httpStatus)&&
        fetch.httpStatus>=400&&fetch.httpStatus<=599?
        fetch.httpStatus:null,
    }:null,
    primaryRoot:detail,
  };
}

/** Dry run calls no network callbacks; live is supplied by a separate CI gate. */
export async function runTrustP2F7TorridenDiagnostic({
  execute=false,
  cohort=readJson(COHORT),
  readiness=readJson(READINESS),
  prior=readJson(PRIOR),
  fetchers=trustP2LiveFetchers(),
  paceMs=1300,
}={}){
  if(typeof execute!=="boolean"||!Number.isFinite(paceMs)||paceMs<0||
    !fetchers||typeof fetchers.fetchRobots!=="function"||
    typeof fetchers.fetchPage!=="function")
    fail("P2F7_TORRIDEN_INVALID_ARGUMENT");
  const locators=validateTrustP2F7TorridenScope(cohort,readiness,prior);
  const counts={robots:0,page:0,sitemap:0};
  let lastAt=0;
  const paced=async()=>{
    if(!paceMs)return;
    const delay=Math.max(0,paceMs-(Date.now()-lastAt));
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    lastAt=Date.now();
  };
  const guard=(kind,url,origin)=>{
    if(origin!==ORIGIN||
      (kind==="robots"?url!==ORIGIN+"/robots.txt":url!==TARGET_URL))
      fail("P2F7_TORRIDEN_ORIGIN_OR_LOCATOR_HOLD");
    if(counts[kind]>=1)fail("P2F7_TORRIDEN_REQUEST_BUDGET_HOLD");
    counts[kind]++;
  };
  const guarded={
    fetchRobots:async(url,origin)=>{
      guard("robots",url,origin);await paced();
      return fetchers.fetchRobots(url,origin);
    },
    fetchSitemap:async()=>fail("P2F7_TORRIDEN_SITEMAP_FORBIDDEN"),
    fetchPage:async(url,origin,policy)=>{
      guard("page",url,origin);await paced();
      return fetchers.fetchPage(url,origin,policy);
    },
  };
  const result=await runTrustP2DFiveBrandPilot({
    execute,cohort,holdRetiredDrG:true,
    approvedBrands:execute?ALLOWED_BRANDS:null,
    preResolvedLocators:locators,fetchers:guarded,
  });
  const count=counts.robots+counts.page+counts.sitemap;
  const target=result.items.find(x=>x.productId===PRODUCT_ID);
  const other=result.items.filter(x=>x.productId!==PRODUCT_ID);
  if(result.items.length!==5||result.summary.selectedProducts!==5||
    result.summary.processedProducts!==5||
    result.summary.confirmedExactSkuCount!==0||
    result.summary.factWrites!==0||result.summary.subjectWrites!==0||
    result.summary.dbWrites!==0||result.summary.recommendationWrites!==0||
    result.summary.aiApiCalls!==0||
    result.summary.attemptedProducts!==(execute?1:0)||
    result.summary.sitePolicyHoldProducts!==(execute?3:0)||
    result.summary.retiredOriginHoldProducts!==1||
    !target||other.length!==4||
    other.find(x=>x.brand==="닥터지")?.assessment.state!=="RETIRED_ORIGIN_HOLD"||
    (execute&&other.some(x=>x.brand!=="닥터지"&&
      x.assessment.state!=="SITE_POLICY_HOLD"))||
    count>(execute?2:0)||
    counts.robots>1||counts.page>1||counts.sitemap!==0||
    (counts.page===1&&counts.robots!==1))
    fail("P2F7_TORRIDEN_UNSAFE_OUTPUT");
  const diagnostics=target.assessment.sourceDiagnostics??[];
  if(diagnostics.length>1)fail("P2F7_TORRIDEN_EXTRA_SITE_FORBIDDEN");
  const site=diagnostics[0]??null;
  if(site&&(site.origin!==ORIGIN||site.pages?.length>1||
    (site.pages??[]).some(x=>x.url!==TARGET_URL)))
    fail("P2F7_TORRIDEN_UNEXPECTED_SITE");
  const observedPage=sanitizedPage(site?.pages?.[0]??null);
  const output=Object.freeze({
    contract:P2F7_CONTRACT,observedAt:result.observedAt,
    executionMode:execute?"GOVERNED_FIRST_PARTY_READONLY":"OFFLINE_PLAN_ONLY",
    frozenDenominator:5,scopedBrand:TARGET,expectedCatalogSizeMl:50,
    scopedOrigin:ORIGIN,scopedUrl:TARGET_URL,retiredDrGNoRequests:true,
    excludedProductBrands:["닥터지","비플레인","아토팜","이즈앤트리"],
    requestBudget:2,requestAttempts:count,
    requests:{robots:counts.robots,product:counts.page,sitemap:0},
    productPagesFetched:target.assessment.pagesFetched??0,
    targetState:safeEnum(target.assessment.state),
    stageDiagnosis:site?{
      reason:safeEnum(site.stageDiagnosis?.reason),
      siteStatus:safeEnum(site.status),
      candidatePageCount:boundedCount(site.stageDiagnosis?.candidatePageCount),
      pagesFetchedCount:boundedCount(site.stageDiagnosis?.pagesFetchedCount),
    }:null,
    page:observedPage,
    previousControlledRun:{httpRequests:4,downloadedPages:2,
      torridenState:"BODY_MENTION_REVIEW_REQUIRED",
      torridenRoot:"PRIMARY_ROOT_NOT_PROVEN",
      independentlyVerifiedExactSkuCount:0},
    independentlyVerifiedExactSkuCount:0,
    candidateIsNotVerifiedSku:true,
    sourceBindingAuthorized:false,subjectCreationAuthorized:false,
    factConfirmationAuthorized:false,commercialIngestionAuthorized:false,
    writes:NO_WRITES,
  });
  return output;
}

export async function runTrustP2F7TorridenCli(args=process.argv.slice(2)){
  if(args.length>1||args.some(a=>!["--execute","--plan"].includes(a)))
    fail("P2F7_TORRIDEN_INVALID_CLI");
  const execute=args.includes("--execute");
  if(execute&&(
    process.env.TRUST_P2F7_TORRIDEN_ONE_TIME_LIVE_ENABLED!=="true"||
    process.env.GITHUB_EVENT_NAME!=="push"||
    process.env.GITHUB_REF!=="refs/heads/main"||
    process.env.TRUST_P2F7_MAIN_PUSH_MARKER!==MARKER
  ))fail("P2F7_TORRIDEN_MAIN_ONE_TIME_GATE_REQUIRED");
  const result=await runTrustP2F7TorridenDiagnostic({execute});
  if(execute){
    fs.mkdirSync("artifacts",{recursive:true});
    fs.writeFileSync(OUTFILE,JSON.stringify(result,null,2)+"\n");
  }
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const result=await runTrustP2F7TorridenCli();
    // The full record is only in the status-only artifact, not the log.
    console.log("TRUST_P2F7_TORRIDEN_RESULT="+JSON.stringify({
      contract:result.contract,executionMode:result.executionMode,
      requestAttempts:result.requestAttempts,
      productPagesFetched:result.productPagesFetched,
      targetState:result.targetState,
      rootStatus:result.page?.primaryRoot?.status??null,
      rootHoldStage:result.page?.primaryRoot?.holdStage??null,
      selectedSizeStatus:result.page?.primaryRoot?.selectedSizeStatus??null,
      independentlyVerifiedExactSkuCount:0,
      writes:0,
    }));
  }catch(error){
    const msg=String(error?.message??"P2F7_TORRIDEN_SAFE_FAILURE");
    console.error(safeEnum(msg)??"P2F7_TORRIDEN_SAFE_FAILURE");
    process.exitCode=1;
  }
}
