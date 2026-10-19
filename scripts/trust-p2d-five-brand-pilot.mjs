#!/usr/bin/env node
/**
 * One-time five-brand real-source discovery measurement.
 * No Supabase credentials, database writes, scheduled job, source registration,
 * Product Fact, Subject or recommendation mutations. Output contains only
 * statuses, digests and candidate locators; never original page content.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runTrustP2Discovery,trustP2LiveFetchers,validateTrustP2PreResolvedLocators } from "../lib/trust/official-product-discovery-p2-v1.mjs";

export const P2D_CONTRACT="trust-p2d-five-brand-live-validation-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTHORITATIVE=false;
const GOOD=new Set(["STRUCTURED_NAME_CANDIDATE","TITLE_NAME_CANDIDATE","SCOPED_HEADING_CANDIDATE"]);
const WEAK=new Set(["BODY_NAME_MENTION_ONLY"]);
const KINDS=new Set(["official_product_page","brand_official_product_page","official_brand_product_page","official_brand_owner_product_page"]);
const COHORT_FILE="evidence/trust/p2d-five-brand-cohort-v2.json";
const FOUR_AUTH_FILE="evidence/trust/p2d-four-brand-live-authorizations-v1.json";
const RETIRED_ORIGIN_BRAND="닥터지";

export function assertTrustP2DCohort(cohort){
  if(!["trust-p2d-five-brand-live-cohort-v1","trust-p2d-five-brand-live-cohort-v2"].includes(cohort?.contract)||
    !Array.isArray(cohort.targets)||cohort.targets.length!==5)
    throw Error("P2D_INVALID_COHORT");
  const brands=new Set(),origins=new Set(),products=new Set();
  for(const item of cohort.targets){
    if(![item.productId,item.intakeId,item.peerProductId,item.peerBindingId,item.peerSourceId]
      .every(s=>UUID.test(s??""))||
      !item.name||!item.normalizedName||!item.brand||
      item.productId===item.peerProductId||
      !KINDS.has(item.peerKind))throw Error("P2D_INVALID_IDENTITY_SNAPSHOT");
    const origin=new URL(item.officialPeerUrl);
    if(origin.protocol!=="https:"||origin.username||origin.password||
      !origin.hostname.includes(".")||origin.hostname==="localhost"||
      /^(\d+\.){3}\d+$/.test(origin.hostname)||
      brands.has(item.brand)||origins.has(origin.origin)||products.has(item.productId))
      throw Error("P2D_INVALID_OR_DUPLICATE_BRAND");
    if(cohort.contract==="trust-p2d-five-brand-live-cohort-v2"&&
      (!Number.isFinite(item.sizeMl)||item.sizeMl<=0))throw Error("P2D_CATALOG_SIZE_SCOPE_INVALID");
    brands.add(item.brand);origins.add(origin.origin);products.add(item.productId);
  }
  return true;
}
/**
 * Operator and per-origin authorization are independent from robots.txt.
 * Even an APPROVED manifest cannot override a live robots/redirect/SSRF HOLD.
 * A template with HOLD or a changed cohort must fail before any HTTP fetch.
 */
export function assertTrustP2DFourBrandLiveAuthorization(approval,cohort,{now=Date.now()}={}){
  assertTrustP2DCohort(cohort);
  const targets=cohort.targets.filter(x=>x.brand!==RETIRED_ORIGIN_BRAND);
  if(targets.length!==4||cohort.targets.filter(x=>x.brand===RETIRED_ORIGIN_BRAND).length!==1||
    approval?.contract!=="trust-p2d-four-brand-live-authorizations-v1"||
    approval.decision!=="APPROVED"||approval.denominator!==5||
    approval.eligibleBrands!==4||approval.excludedBrand!==RETIRED_ORIGIN_BRAND||
    approval.writesAllowed!==0||
    !Array.isArray(approval.sites)||approval.sites.length!==4)
    throw Error("P2D_FOUR_SITE_POLICY_HOLD");
  const matched=new Set(),approvedBrands=new Set();
  for(const record of approval.sites){
    const item=targets.find(t=>t.brand===record?.brand);
    if(!item||matched.has(record.brand)||
      record.origin!==new URL(item.officialPeerUrl).origin||
      record.productId!==item.productId||
      !["boolean"].includes(typeof record.termsAndLicensingApproved)||
      !["boolean"].includes(typeof record.robotsFirstPreflightAuthorized)||
      !["boolean"].includes(typeof record.pacingReviewed))
      throw Error("P2D_FOUR_SITE_POLICY_HOLD");
    matched.add(record.brand);
    const fullyReviewed=record.termsAndLicensingApproved&&
      record.robotsFirstPreflightAuthorized&&record.pacingReviewed;
    if(fullyReviewed){
      if(typeof record.reviewer!=="string"||!record.reviewer.trim()||
        typeof record.reviewEvidence!=="string"||!record.reviewEvidence.trim())
        throw Error("P2D_FOUR_SITE_POLICY_HOLD");
      approvedBrands.add(record.brand);
    }
    // Partially reviewed or denied origins remain held, never contacted.
  }
  if(matched.size!==4||approvedBrands.size===0)
    throw Error("P2D_FOUR_SITE_POLICY_HOLD");
  const operator=approval.operatorApproval;
  if(operator?.approved!==true||
    typeof operator.approver!=="string"||!operator.approver.trim()||
    typeof operator.approvalReference!=="string"||!operator.approvalReference.trim()||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(operator.executionWindowStartUtc??"")||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(operator.executionWindowEndUtc??""))
    throw Error("P2D_FOUR_OPERATOR_APPROVAL_REQUIRED");
  const start=Date.parse(operator.executionWindowStartUtc);
  const end=Date.parse(operator.executionWindowEndUtc);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||
    end-start>6*60*60*1000||!Number.isFinite(now)||now<start||now>end)
    throw Error("P2D_FOUR_EXECUTION_WINDOW_CLOSED");
  return approvedBrands;
}

export function cohortToTrustedDiscoveryRow(item){
  const origin=new URL(item.officialPeerUrl).origin;
  return {
    intakeId:item.intakeId,productId:item.productId,
    status:"BRAND_OFFICIAL_DISCOVERY_SEEDS",seedCount:1,
    marketVerified:false,subjectCreationAuthorized:false,
    discoveryOrigins:[{origin,sourceCount:1,evidenceRefs:[{
      sourceId:item.peerSourceId,bindingId:item.peerBindingId,
      knownProductId:item.peerProductId,officialKind:item.peerKind,
      peerOfficialLocator:item.officialPeerUrl,
    }]}],
  };
}
function safePublicFailure(err){
  const reason=String(err?.message??"");
  if(reason.startsWith("TRANSIENT_FAILURE:"))return "NETWORK_UNAVAILABLE";
  if(reason.startsWith("SOURCE_BLOCKED:"))return "POLICY_OR_SOURCE_BLOCKED";
  return "RUN_FAILED_CLOSED";
}
/**
 * Compact, read-only diagnosis of a single already-completed official-source
 * exploration. No new fetches and no elevation of unverified candidates.
 * Statuses describe the observed failure stage, not the website's true cause.
 */
export function diagnoseTrustP2DSite(site){
  if(!site||!Array.isArray(site.pages)||
    (site.observations!==undefined&&!Array.isArray(site.observations)))
    throw Error("P2D_INVALID_SITE_DIAGNOSTIC");
  const observations=site.observations??[];
  const pages=site.pages;
  const sitemapFetchedCount=observations.filter(o=>
    o?.kind==="sitemap"&&o.status==="FETCHED").length;
  const sitemapUnavailableCount=observations.filter(o=>
    o?.kind==="sitemap"&&o.status!=="FETCHED").length;
  const pagesFetchedCount=pages.filter(p=>typeof p.sha256==="string").length;
  const wrongVariantCount=pages.filter(p=>[
    "CATALOG_SIZE_MISMATCH","BUNDLE_VARIANT_REVIEW_REQUIRED",
    "SIZE_CONFLICT_REVIEW_REQUIRED",
    "UNIT_AND_OFFER_MISMATCH_REVIEW_REQUIRED",
    "UNIT_MISMATCH_REVIEW_REQUIRED",
    "OFFER_COMPOSITION_REVIEW_REQUIRED",
  ].includes(p.status)).length;
  const positiveCandidateCount=pages.filter(p=>GOOD.has(p.status)).length;
  const sourceStatus=String(site.status??"");
  const indexStatus=String(site.homepageIndexStatus??"NOT_RECORDED");
  let reason;
  if(sourceStatus==="ROBOTS_UNAVAILABLE")reason="ROBOTS_UNAVAILABLE_HOLD";
  else if(sourceStatus==="ROBOTS_DISALLOWED")reason="ROBOTS_DISALLOWED_HOLD";
  else if(sourceStatus==="CRAWL_DELAY_NOT_SUPPORTED")reason="ROBOTS_PACING_HOLD";
  else if(sourceStatus==="NO_ELIGIBLE_OFFICIAL_LOCATOR")reason="NO_ELIGIBLE_OFFICIAL_LOCATOR";
  else if(sourceStatus==="NO_ELIGIBLE_PRE_RESOLVED_LOCATOR")reason="NO_ELIGIBLE_PRE_RESOLVED_LOCATOR";
  else if(wrongVariantCount>0)reason="WRONG_VARIANT_PAGE_HOLD";
  else if(positiveCandidateCount>0)reason="NAME_CANDIDATE_REVIEW_ONLY";
  else if(pages.some(p=>["SOURCE_BLOCKED","TRANSIENT_FAILURE"].includes(p.status)))
    reason="PRODUCT_PAGE_FETCH_HOLD";
  else if(pagesFetchedCount>0)reason="FETCHED_PAGE_IDENTITY_UNRESOLVED";
  else if(pages.length>0)reason="PRODUCT_PAGE_NOT_CONFIRMED";
  else if(indexStatus==="FETCHED")reason="NO_ELIGIBLE_OFFICIAL_INDEX_LINK";
  else if(sitemapFetchedCount>0)reason="NO_MATCHING_SITEMAP_URL";
  else if(indexStatus==="SOURCE_BLOCKED"||
    indexStatus==="TRANSIENT_FAILURE")reason="OFFICIAL_INDEX_FETCH_HOLD";
  else if(sitemapUnavailableCount>0)reason="SITEMAP_FETCH_HOLD";
  else reason="NO_USABLE_DISCOVERY_EVIDENCE";
  return Object.freeze({
    reason,sourceStatus,
    sitemapFetchedCount,sitemapUnavailableCount,
    indexStatus,
    peerLinkCandidateCount:Math.max(0,Math.min(2,
      Number.isInteger(site.peerIndexCandidateCount)?site.peerIndexCandidateCount:0)),
    candidatePageCount:pages.length,
    pagesFetchedCount,wrongVariantCount,positiveCandidateCount,
    verifiedExactSkuCount:0,sourceBindingAuthorized:false,
  });
}

/** Every non-empty identity signal is an unverified candidate, never a Fact. */
export function assessTrustP2DDiscovery(run){
  if(!run||run.readOnly!==true||run.subjectCreationAuthorized!==false||
    run.officialProductEvidenceConfirmed!==false||run.factWrites!==0||
    run.recommendationWrites!==0||run.aiApiCalls!==0||run.marketVerified!==false||
    run.formulationVerified!==false||!Array.isArray(run.sites))
    throw Error("P2D_UNSAFE_DISCOVERY_RESULT");
  const pages=run.sites.flatMap(s=>s.pages??[]);
  const good=pages.filter(p=>GOOD.has(p.status));
  const weak=pages.filter(p=>WEAK.has(p.status));
  const mismatched=pages.filter(p=>[
    "CATALOG_SIZE_MISMATCH","BUNDLE_VARIANT_REVIEW_REQUIRED",
    "SIZE_CONFLICT_REVIEW_REQUIRED",
    "UNIT_AND_OFFER_MISMATCH_REVIEW_REQUIRED",
    "UNIT_MISMATCH_REVIEW_REQUIRED",
    "OFFER_COMPOSITION_REVIEW_REQUIRED",
  ].includes(p.status));
  const candidateResult=good.length?"IDENTITY_CANDIDATE_REVIEW_REQUIRED":
    mismatched.length?"VARIANT_REVIEW_REQUIRED":
    weak.length?"BODY_MENTION_REVIEW_REQUIRED":
    pages.length?"NO_MATCHING_PRODUCT_IDENTITY":"NO_PRODUCT_PAGE";
  const blocked=run.sites.some(s=>["ROBOTS_UNAVAILABLE","ROBOTS_DISALLOWED","CRAWL_DELAY_NOT_SUPPORTED"].includes(s.status));
  const state=blocked&&!pages.length?"SOURCE_POLICY_HOLD":candidateResult;
  return {
    state,
    siteStatus:run.sites.map(s=>s.status).slice(0,2),
    pagesFetched:pages.filter(p=>typeof p.sha256==="string").length,
    scopedCandidates:good.length,
    variantMismatchPages:mismatched.length,
    bodyOnlyMentions:weak.length,
    distinctCandidateLocators:new Set(good.map(p=>p.url)).size,
    verifiedSourceBindings:0,verifiedMarkets:0,verifiedFormulations:0,
    falsePositiveVerifiedCount:null, // no external ground truth adjudication here
  };
}
export function summarizeTrustP2D(rows){
  if(!Array.isArray(rows)||rows.length!==5||
    new Set(rows.map(x=>x.productId)).size!==5)
    throw Error("P2D_INVALID_REPORT_ROWS");
  const states={};let fetched=0,candidates=0,mentions=0;
  for(const row of rows){
    states[row.assessment.state]=(states[row.assessment.state]??0)+1;
    fetched+=row.assessment.pagesFetched??0;
    candidates+=row.assessment.scopedCandidates??0;
    mentions+=row.assessment.bodyOnlyMentions??0;
  }
  return {
    selectedProducts:5,processedProducts:rows.length,
    brands:5,officialPagesFetched:fetched,
    variantMismatchPages:rows.reduce((n,r)=>n+(r.assessment.variantMismatchPages??0),0),
    identityCandidateProducts:rows.filter(x=>x.assessment.scopedCandidates>0).length,
    productIdentificationRate:rows.filter(x=>x.assessment.scopedCandidates>0).length/5,
    candidatePages:candidates,bodyOnlyMentions:mentions,
    statusCounts:states,confirmedExactSkuCount:0,
    verifiedMarketCount:0,verifiedFormulationCount:0,
    zeroFalsePositiveAssertionNotMade:true,aiApiCalls:0,
    factWrites:0,subjectWrites:0,recommendationWrites:0,dbWrites:0,
  };
}
export async function runTrustP2DFiveBrandPilot({
 execute=false,fetchers=trustP2LiveFetchers(),
 cohort=JSON.parse(fs.readFileSync(COHORT_FILE,"utf8")),
 holdRetiredDrG=false,approvedBrands=null,preResolvedLocators=[],
}={}){
  assertTrustP2DCohort(cohort);
  // Validate all entries, including those for held origins, before any network.
  if(!Array.isArray(preResolvedLocators)||preResolvedLocators.length>8||
    preResolvedLocators.some(x=>!cohort.targets.some(t=>
      t.productId===x?.productId&&t.brand!==RETIRED_ORIGIN_BRAND)))
    throw Error("P2D_PRE_RESOLVED_COHORT_SCOPE_INVALID");
  for(const target of cohort.targets){
    validateTrustP2PreResolvedLocators(
      preResolvedLocators.filter(x=>x.productId===target.productId),
      cohortToTrustedDiscoveryRow(target),{id:target.productId});
  }
  if(holdRetiredDrG&&execute&&
    (!(approvedBrands instanceof Set)||approvedBrands.size===0||
      [...approvedBrands].some(brand=>brand===RETIRED_ORIGIN_BRAND||
        !cohort.targets.some(t=>t.brand===brand))))
    throw Error("P2D_FOUR_APPROVED_ORIGINS_REQUIRED");
  if(typeof holdRetiredDrG!=="boolean"||
    (holdRetiredDrG&&cohort.targets.filter(t=>t.brand===RETIRED_ORIGIN_BRAND).length!==1))
    throw Error("P2D_FOUR_HOLD_MODE_INVALID");
  const rows=[];
  for(const target of cohort.targets){
    const row=cohortToTrustedDiscoveryRow(target);
    const product={
      id:target.productId,name:target.name,brand:target.brand,size_ml:target.sizeMl??null,
      name_en:target.nameEn,normalized_name:target.normalizedName,
    };
    let assessment;
    if(holdRetiredDrG&&target.brand===RETIRED_ORIGIN_BRAND){
      // Retained in the five-product denominator, but no robots/site/page fetch.
      assessment={state:"RETIRED_ORIGIN_HOLD",reason:"OFFICIAL_STOREFRONT_CLOSED_REVIEW_REQUIRED",
        pagesFetched:0,scopedCandidates:0,bodyOnlyMentions:0,siteStatus:[],
        verifiedSourceBindings:0};
    }else if(!execute){
      assessment={state:"PLAN_ONLY",pagesFetched:0,scopedCandidates:0,
        bodyOnlyMentions:0,siteStatus:[],verifiedSourceBindings:0};
    }else if(holdRetiredDrG&&!approvedBrands.has(target.brand)){
      assessment={state:"SITE_POLICY_HOLD",reason:"NO_SITE_SPECIFIC_APPROVAL",
        pagesFetched:0,scopedCandidates:0,bodyOnlyMentions:0,siteStatus:[],
        verifiedSourceBindings:0};
    }else {
      try {
        // Existing P2 owns robots, same-origin safety, per-site URL limits,
        // sitemap/peer discovery, and exact product heading candidate checks.
        const discovery=await runTrustP2Discovery(row,product,{
          ...fetchers,preResolvedLocators:preResolvedLocators.filter(x=>
            x.productId===target.productId),
        });
        assessment=assessTrustP2DDiscovery(discovery);
        // Diagnostic-only provenance. The source HTML is never persisted.
        // These locators are unverified and cannot authorize a Subject or Fact.
        assessment.sourceDiagnostics=discovery.sites.map(site=>({
          origin:site.origin,status:site.status,
          locatorMode:site.locatorMode??"AUTO_DISCOVERED",
          peerIndexCandidateCount:site.peerIndexCandidateCount??0,
          candidateCount:site.candidateCount??0,
          homepageIndexStatus:site.homepageIndexStatus??"NOT_RECORDED",
          stageDiagnosis:diagnoseTrustP2DSite(site),
          observations:(site.observations??[]).map(o=>({
            kind:o.kind,status:o.status,fetched:o.fetched,
          })),
          pages:(site.pages??[]).map(page=>({
            url:page.url,status:page.status,
            locatorMode:page.locatorMode??"AUTO_DISCOVERED",
            fetchFailure:page.fetchFailure??null,
            title:page.title??null,identitySurface:page.identitySurface??null,
            sha256:page.sha256??null,
            nameSignalStatus:page.nameSignalStatus??null,
            variantScope:page.variantScope??null,
            unitOfferScope:page.unitOfferScope??null,
            primaryRootDiagnostic:page.primaryRootDiagnostic??null,
          })),
        }));
      }catch(e){
        assessment={state:"SAFE_EXECUTION_FAILURE",reason:safePublicFailure(e),
          pagesFetched:0,scopedCandidates:0,bodyOnlyMentions:0,
          siteStatus:[],verifiedSourceBindings:0};
      }
    }
    rows.push({
      productId:target.productId,brand:target.brand,name:target.name,
      officialOrigin:row.discoveryOrigins[0].origin,
      assessment,
      subjectCreationAuthorized:AUTHORITATIVE,
      factConfirmationAuthorized:AUTHORITATIVE,
    });
  }
  return {
    contract:P2D_CONTRACT,observedAt:new Date().toISOString(),
    mode:holdRetiredDrG
      ?execute?"FOUR_OFFICIAL_BRANDS_DRG_HOLD_NO_WRITES":"FOUR_PLAN_ONLY_DRG_HOLD_NO_NETWORK"
      :execute?"FIVE_OFFICIAL_BRANDS_NO_WRITES":"PLAN_ONLY_NO_NETWORK",
    officialCohortSource:cohort.baselineDate,
    summary:holdRetiredDrG?{
      ...summarizeTrustP2D(rows),eligibleProducts:4,
      attemptedProducts:execute?approvedBrands.size:0,
      approvedOriginProducts:execute?approvedBrands.size:0,
      sitePolicyHoldProducts:execute?4-approvedBrands.size:0,
      retiredOriginHoldProducts:1,
      heldBrand:RETIRED_ORIGIN_BRAND,denominatorUnchanged:5,
    }:summarizeTrustP2D(rows),
    items:rows,
  };
}
export async function runTrustP2DCli(args=process.argv.slice(2)){
  const recognized=new Set(["--execute","--plan-four","--execute-four"]);
  if(args.some(a=>!recognized.has(a))||new Set(args).size!==args.length||
    args.length>1)throw Error("P2D_UNSUPPORTED_CLI_FLAG");
  const executeFive=args.includes("--execute");
  const executeFour=args.includes("--execute-four");
  const fourMode=executeFour||args.includes("--plan-four");
  const execute=executeFive||executeFour;
  if(executeFive&&process.env.TRUST_P2D_FIVE_BRAND_LIVE_ENABLED!=="true")
    throw Error("P2D_LIVE_DISABLED");
  let approvedBrands=null;
  if(executeFour){
    if(process.env.TRUST_P2D_FOUR_BRAND_LIVE_ENABLED!=="true")
      throw Error("P2D_FOUR_LIVE_DISABLED");
    // Mandatory approval is loaded and verified BEFORE constructing fetchers.
    const approval=JSON.parse(fs.readFileSync(FOUR_AUTH_FILE,"utf8"));
    const cohort=JSON.parse(fs.readFileSync(COHORT_FILE,"utf8"));
    approvedBrands=assertTrustP2DFourBrandLiveAuthorization(approval,cohort);
  }
  const result=await runTrustP2DFiveBrandPilot({
    execute,holdRetiredDrG:fourMode,approvedBrands,
  });
  if(process.env.GITHUB_STEP_SUMMARY){
    const lines=["### TRUST P2-D five-product baseline / bounded official-source measurement",
      "- Products in frozen denominator: "+result.summary.processedProducts+" / 5",
      "- Actual eligible products: "+(result.summary.eligibleProducts??5),
      "- Identity candidate products (not verified SKUs): "+result.summary.identityCandidateProducts,
      "- Official pages fetched: "+result.summary.officialPagesFetched,
      "- Outcome counts: "+JSON.stringify(result.summary.statusCounts),
      "- Market/formulation/Subject/Product Fact/recommendation writes: 0"];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n");
  }
  if(execute){
    const filename=executeFour
      ?"artifacts/trust-p2d-four-brand-result.json"
      :"artifacts/trust-p2d-five-brand-result.json";
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    fs.writeFileSync(filename,JSON.stringify(result,null,2)+"\n");
  }
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await runTrustP2DCli(),null,2));}
  catch(e){console.error(String(e?.message??"P2D_FAILURE").split(":")[0]);process.exitCode=1;}
}
