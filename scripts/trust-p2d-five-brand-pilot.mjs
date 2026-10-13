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
import { runTrustP2Discovery,trustP2LiveFetchers } from "../lib/trust/official-product-discovery-p2-v1.mjs";

export const P2D_CONTRACT="trust-p2d-five-brand-live-validation-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTHORITATIVE=false;
const GOOD=new Set(["STRUCTURED_NAME_CANDIDATE","TITLE_NAME_CANDIDATE","SCOPED_HEADING_CANDIDATE"]);
const WEAK=new Set(["BODY_NAME_MENTION_ONLY"]);
const KINDS=new Set(["official_product_page","brand_official_product_page","official_brand_product_page","official_brand_owner_product_page"]);
const COHORT_FILE="evidence/trust/p2d-five-brand-cohort-v2.json";

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
  const mismatched=pages.filter(p=>p.status==="CATALOG_SIZE_MISMATCH"||p.status==="BUNDLE_VARIANT_REVIEW_REQUIRED"||p.status==="SIZE_CONFLICT_REVIEW_REQUIRED");
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
}={}){
  assertTrustP2DCohort(cohort);
  const rows=[];
  for(const target of cohort.targets){
    const row=cohortToTrustedDiscoveryRow(target);
    const product={
      id:target.productId,name:target.name,brand:target.brand,size_ml:target.sizeMl??null,
      name_en:target.nameEn,normalized_name:target.normalizedName,
    };
    let assessment;
    if(!execute){
      assessment={state:"PLAN_ONLY",pagesFetched:0,scopedCandidates:0,
        bodyOnlyMentions:0,siteStatus:[],verifiedSourceBindings:0};
    }else {
      try {
        // Existing P2 owns robots, same-origin safety, per-site URL limits,
        // sitemap/peer discovery, and exact product heading candidate checks.
        const discovery=await runTrustP2Discovery(row,product,fetchers);
        assessment=assessTrustP2DDiscovery(discovery);
        // Diagnostic-only provenance. The source HTML is never persisted.
        // These locators are unverified and cannot authorize a Subject or Fact.
        assessment.sourceDiagnostics=discovery.sites.map(site=>({
          origin:site.origin,status:site.status,
          peerIndexCandidateCount:site.peerIndexCandidateCount??0,
          candidateCount:site.candidateCount??0,
          homepageIndexStatus:site.homepageIndexStatus??"NOT_RECORDED",
          observations:(site.observations??[]).map(o=>({
            kind:o.kind,status:o.status,fetched:o.fetched,
          })),
          pages:(site.pages??[]).map(page=>({
            url:page.url,status:page.status,
            title:page.title??null,identitySurface:page.identitySurface??null,
            sha256:page.sha256??null,
            nameSignalStatus:page.nameSignalStatus??null,
            variantScope:page.variantScope??null,
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
    mode:execute?"FIVE_OFFICIAL_BRANDS_NO_WRITES":"PLAN_ONLY_NO_NETWORK",
    officialCohortSource:cohort.baselineDate,
    summary:summarizeTrustP2D(rows),items:rows,
  };
}
export async function runTrustP2DCli(args=process.argv.slice(2)){
  if(args.some(a=>a!=="--execute"))throw Error("P2D_UNSUPPORTED_CLI_FLAG");
  const execute=args.includes("--execute");
  if(execute&&process.env.TRUST_P2D_FIVE_BRAND_LIVE_ENABLED!=="true")
    throw Error("P2D_LIVE_DISABLED");
  const result=await runTrustP2DFiveBrandPilot({execute});
  if(process.env.GITHUB_STEP_SUMMARY){
    const lines=["### TRUST P2-D five-brand independent official-source measurement",
      "- Products: "+result.summary.processedProducts+" / 5",
      "- Identity candidate products (not verified SKUs): "+result.summary.identityCandidateProducts,
      "- Official pages fetched: "+result.summary.officialPagesFetched,
      "- Outcome counts: "+JSON.stringify(result.summary.statusCounts),
      "- Market/formulation/Subject/Product Fact/recommendation writes: 0"];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n");
  }
  if(execute){
    const filename="artifacts/trust-p2d-five-brand-result.json";
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    fs.writeFileSync(filename,JSON.stringify(result,null,2)+"\n");
  }
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await runTrustP2DCli(),null,2));}
  catch(e){console.error(String(e?.message??"P2D_FAILURE").split(":")[0]);process.exitCode=1;}
}
