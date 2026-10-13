#!/usr/bin/env node
/**
 * Exact six first-party candidate URLs across four origins. All current
 * source bindings unchanged. Browser-index signals are diagnostic and never
 * equated with actual runner proof, Product Fact, Subject or market authority.
 */
import fs from "node:fs";
import {pathToFileURL} from "node:url";
import {fetchOfficialBytes} from "../lib/trust/official-source-fetch.mjs";
import {createTrustRobotsPolicy,strictOriginTransport}
  from "../lib/trust/official-product-discovery-p2-v1.mjs";
import {extractTrustP3OfficialProductCandidates}
  from "../lib/trust/official-product-extraction-p3-v1.mjs";
import {inspectTrustP3OfficialPageShape}
  from "../lib/trust/official-product-page-shape-p3-v1.mjs";
import {inspectTrustP3TemplateShape}
  from "../lib/trust/official-template-shape-p3-v1.mjs";

export const P3_LOCATOR_VERSION="trust-p3-official-locator-freshness-v1";
const FROZEN="evidence/trust/p3-official-locator-revalidation-cohort-v1.json";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMPTY={newSourceBindings:0,subjectWrites:0,factWrites:0,recommendationWrites:0,
  dbWrites:0,aiApiCalls:0,autoPromotionAuthorized:false};
const fail=e=>String(e?.message??"").startsWith("SOURCE_BLOCKED:")?"SOURCE_BLOCKED":
  String(e?.message??"").startsWith("TRANSIENT_FAILURE:")?"NETWORK_UNAVAILABLE":"SAFE_HOLD";
export function validateTrustP3LocatorCohort(cohort){
  if(cohort?.contract!=="trust-p3-official-locator-revalidation-cohort-v1"||
    cohort?.targets?.length!==3||cohort.authority?.automaticPromotion!==false||
    cohort.authority?.newSourceBinding!==false)throw Error("P3_LOCATOR_COHORT_INVALID");
  const ids=new Set(),urls=new Set(),brands=new Set();
  for(const target of cohort.targets){
    if(!ID.test(target.productId)||!ID.test(target.officialSourceId)||
      !target.catalogName||!target.brand||
      !Number.isFinite(target.sizeMl)||target.sizeMl<=0||
      !Array.isArray(target.locators)||target.locators.length!==2||
      brands.has(target.brand)||ids.has(target.productId))
      throw Error("P3_LOCATOR_INVALID_TARGET");
    brands.add(target.brand);ids.add(target.productId);
    const roles=new Set();
    for(const page of target.locators){
      let url,idx;
      try{url=new URL(page.url);idx=new URL(page.indexedSource);}catch{throw Error("P3_LOCATOR_BAD_URL");}
      if(url.protocol!=="https:"||url.username||url.password||url.port||
        url.hash||!url.hostname.includes(".")||url.hostname==="localhost"||
        !/^(?:www\.torriden\.com|beautyofjoseon\.com|www\.aestura\.com|int\.aestura\.com)$/.test(url.hostname)||
        idx.hostname!==url.hostname||
        !["EXISTING_BOUND_SOURCE","ALTERNATE_OFFICIAL_CANDIDATE"].includes(page.role)||
        urls.has(url.href)||roles.has(page.role)||
        !page.indexedTitle||page.indexedTitleSizeMl!==target.sizeMl)
        throw Error("P3_LOCATOR_POLICY_OR_VARIANT_HOLD");
      urls.add(url.href);roles.add(page.role);
    }
  }
  return true;
}
const summarize=(candidate,shape,templateShape)=>({
  templateShape,
  gate:candidate.gate,
  identitySignal:candidate.identitySignal,
  variantStatus:candidate.variantStatus,
  sourceDigest:candidate.sourceDigest,
  primaryVariantProbe:candidate.primaryVariantProbe,
  diagnostic:shape,
  claimProposalStates:Object.fromEntries(Object.entries(candidate.findings)
    .map(([key,v])=>[key,v.state])),
  exactSkuVerified:false,sourceBindingAuthorized:false,
  factConfirmationAuthorized:false,
});
export async function observeTrustP3LocatorFreshness({
 execute=false,
 cohort=JSON.parse(fs.readFileSync(FROZEN,"utf8")),
 fetchRobots,fetchProduct,
}={}){
  validateTrustP3LocatorCohort(cohort);
  if(execute&&(typeof fetchRobots!=="function"||typeof fetchProduct!=="function"))
    throw Error("P3_LOCATOR_FETCH_BOUNDARY_REQUIRED");
  const rows=[],policyCache=new Map();
  for(const target of cohort.targets){
    for(const loc of target.locators){
      const origin=new URL(loc.url).origin;
      const row={productId:target.productId,brand:target.brand,role:loc.role,
        requestedUrl:loc.url,indexedObservation:loc.interpretation,
        status:"PLAN_ONLY",...EMPTY};
      if(execute){
        let policy=policyCache.get(origin);
        if(!policy){
          const robotsUrl=origin+"/robots.txt";
          try{
            const robot=await fetchRobots(robotsUrl,origin);
            if(robot.finalUrl!==robotsUrl)throw Error("P3_LOCATOR_ROBOTS_REDIRECT");
            policy=createTrustRobotsPolicy(robot.bytes);
            policyCache.set(origin,policy);
          }catch(error){
            policyCache.set(origin,{error:fail(error)});
            row.status="ROBOTS_UNAVAILABLE";
            row.failure=fail(error);
            rows.push(row);continue;
          }
        }
        if(policy.error){row.status="ROBOTS_UNAVAILABLE";row.failure=policy.error;rows.push(row);continue;}
        if(policy.delayBlocked||!policy.allowed(loc.url)){
          row.status="SOURCE_POLICY_HOLD";rows.push(row);continue;
        }
        try{
          const page=await fetchProduct(loc.url,origin,policy);
          if(page.finalUrl!==loc.url)throw Error("P3_LOCATOR_REDIRECT_HOLD");
          const product={id:target.productId,brand:target.brand,
            name:target.catalogName,name_en:target.catalogNameEn??null,size_ml:target.sizeMl};
          const candidate=extractTrustP3OfficialProductCandidates(page.bytes,product,
            {sourceUrl:loc.url,sourceKind:"official_product_page",robotsAllowed:true});
          const shape=inspectTrustP3OfficialPageShape(page.bytes,product,
            {contentType:page.contentType??""});
          row.status=candidate.gate==="EVIDENCE_CANDIDATE_ONLY"?
            "DIRECT_PRODUCT_CANDIDATE_REVIEW_REQUIRED":"IDENTITY_OR_VARIANT_REVIEW_REQUIRED";
          // Structural metadata is observability only; diagnostic failures
          // must not change identity, variant, policy or P3 claim gates.
          let templateShape;
          try {
            templateShape=inspectTrustP3TemplateShape(page.bytes,
              {contentType:page.contentType??""});
          } catch {
            templateShape={contract:"trust-p3-template-shape-v1",
              status:"DIAGNOSTIC_UNAVAILABLE",templateFamily:"UNDETERMINED",
              exactSkuVerified:false,subjectCreationAuthorized:false,
              factConfirmationAuthorized:false,dbWrites:0,aiApiCalls:0};
          }
          row.live=summarize(candidate,shape,templateShape);
        }catch(error){row.status="SOURCE_FETCH_HOLD";row.failure=fail(error);}
      }
      rows.push(row);
    }
  }
  const outcomes={};
  for(const row of rows)outcomes[row.status]=(outcomes[row.status]??0)+1;
  return {contract:P3_LOCATOR_VERSION,observedAt:new Date().toISOString(),
    mode:execute?"ROBOTS_GUARDED_READ_ONLY":"PLAN_ONLY_NO_NETWORK",
    summary:{targets:3,locators:6,requestedOrigins:4,processed:rows.length,outcomes,
      productCandidates:rows.filter(r=>r.status==="DIRECT_PRODUCT_CANDIDATE_REVIEW_REQUIRED").length,
      verifiedExactSkuCount:0,verifiedMarketCount:0,verifiedFormulationCount:0,...EMPTY},
    items:rows,readOnly:true,...EMPTY};
}
export async function runTrustP3LocatorCli(args=process.argv.slice(2)){
  if(args.some(arg=>arg!=="--execute"))throw Error("P3_LOCATOR_UNSUPPORTED_FLAG");
  const execute=args.includes("--execute");
  if(execute&&process.env.TRUST_P3_LOCATOR_LIVE_ENABLED!=="true")
    throw Error("P3_LOCATOR_LIVE_DISABLED");
  const result=await observeTrustP3LocatorFreshness({
    execute,
    fetchRobots:(url,origin)=>fetchOfficialBytes(url,strictOriginTransport(fetch,origin)),
    fetchProduct:(url,origin,policy)=>fetchOfficialBytes(url,
      strictOriginTransport(fetch,origin,policy)),
  });
  if(execute){
    fs.mkdirSync("artifacts",{recursive:true});
    fs.writeFileSync("artifacts/trust-p3-official-locator-freshness-result.json",
      JSON.stringify(result,null,2)+"\n");
  }
  if(process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      ["### TRUST P3 official locator freshness",
        "- Fixed existing+alternative candidate locators: 6",
        "- Outcomes: "+JSON.stringify(result.summary.outcomes),
        "- Verified exact SKU, Subject, Fact, ranking and database changes: 0"].join("\n")+"\n");
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await runTrustP3LocatorCli(),null,2));}
  catch(error){console.error(String(error?.message??"P3_LOCATOR_FAILURE").split(":")[0]);process.exitCode=1;}
}
