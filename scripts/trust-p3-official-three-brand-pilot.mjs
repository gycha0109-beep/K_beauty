#!/usr/bin/env node
/**
 * Single-use policy-gated P3 live observation. Three pre-governed existing
 * sunscreen subjects; no catalog intake, confirmation or Supabase credentials.
 * Never persists fetched HTML or full ingredient text.
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { fetchOfficialBytes } from "../lib/trust/official-source-fetch.mjs";
import { createTrustRobotsPolicy,strictOriginTransport } from "../lib/trust/official-product-discovery-p2-v1.mjs";
import { extractTrustP3OfficialProductCandidates } from "../lib/trust/official-product-extraction-p3-v1.mjs";

export const TRUST_P3_LIVE_COHORT_VERSION="trust-p3-three-brand-live-observation-v1";
const FILE="evidence/trust/p3-official-three-brand-live-cohort-v1.json";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const empty={dbWrites:0,subjectWrites:0,factWrites:0,recommendationWrites:0,aiApiCalls:0,
  factConfirmationAuthorized:false,subjectCreationAuthorized:false};

export function assertTrustP3Cohort(cohort){
  if(cohort?.contract!=="trust-p3-three-brand-official-observation-cohort-v1"||
     cohort.targets?.length!==3)throw Error("TRUST_P3_LIVE_COHORT_INVALID");
  const ids=new Set(),origins=new Set();
  for(const target of cohort.targets){
    const url=new URL(target.officialUrl);
    if(![target.productId,target.sourceId,target.subjectId].every(id=>UUID.test(id??""))||
      !target.name||!target.brand||!Number.isFinite(target.sizeMl)||target.sizeMl<=0||
      target.sourceKind!=="official_product_page"||
      target.bindingState!=="exact_subject_match"||target.scopeRelation!=="equivalent"||
      url.protocol!=="https:"||url.username||url.password||
      url.port||ids.has(target.productId)||origins.has(url.origin))
      throw Error("TRUST_P3_LIVE_COHORT_UNGOVERNED");
    ids.add(target.productId);origins.add(url.origin);
  }
  return true;
}
function failureCode(error){
  const m=String(error?.message??"");
  return m.startsWith("TRANSIENT_FAILURE:")?"NETWORK_UNAVAILABLE":
    m.startsWith("SOURCE_BLOCKED:")?"SOURCE_BLOCKED":"SAFE_FAILURE_HOLD";
}
function summarized(candidate){
  const fields={};
  for(const [name,row] of Object.entries(candidate.findings??{})){
    fields[name]={state:row.state};
    if(["spf","pa","uvFilterType"].includes(name)&&row.value){
      fields[name].value=row.value;
    }
    if(name==="inci"&&Array.isArray(row.value)){
      fields[name].ingredientCount=row.value.length;
    }
  }
  return {
    gate:candidate.gate,identitySignal:candidate.identitySignal,
    variantStatus:candidate.variantStatus,sourceDigest:candidate.sourceDigest,
    scopedSpecificationSections:candidate.scopedSpecificationSections,
    fields,authority:candidate.authority,
    factConfirmationAuthorized:false,subjectCreationAuthorized:false,
  };
}
export async function observeTrustP3OfficialThreeBrand({
 execute=false,cohort=JSON.parse(fs.readFileSync(FILE,"utf8")),
 fetchRobots,fetchProduct,
}={}){
  assertTrustP3Cohort(cohort);
  const rows=[];
  for(const t of cohort.targets){
    const u=new URL(t.officialUrl);
    const row={productId:t.productId,brand:t.brand,sourceId:t.sourceId,
      sourceUrl:t.officialUrl,sourceOrigin:u.origin,
      status:"PLAN_ONLY",requests:0,...empty};
    if(execute){
      if(typeof fetchRobots!=="function"||typeof fetchProduct!=="function")
        throw Error("TRUST_P3_LIVE_FETCHERS_MISSING");
      let policy;
      try{
        const robotUrl=u.origin+"/robots.txt";
        row.requests++;
        const robot=await fetchRobots(robotUrl,u.origin);
        if(robot.finalUrl!==robotUrl)throw Error("TRUST_P3_ROBOTS_REDIRECT");
        policy=createTrustRobotsPolicy(robot.bytes);
      }catch(error){
        row.status="ROBOTS_UNAVAILABLE";row.failure=failureCode(error);
        rows.push(row);continue;
      }
      if(policy.delayBlocked||!policy.allowed(t.officialUrl)){
        row.status="SOURCE_POLICY_HOLD";rows.push(row);continue;
      }
      try{
        row.requests++;
        const response=await fetchProduct(t.officialUrl,u.origin,policy);
        if(response.finalUrl!==t.officialUrl)throw Error("TRUST_P3_UNEXPECTED_REDIRECT");
        const product={id:t.productId,brand:t.brand,name:t.name,
          name_en:t.nameEn??null,size_ml:t.sizeMl};
        const candidate=extractTrustP3OfficialProductCandidates(response.bytes,product,{
          sourceUrl:t.officialUrl,sourceKind:t.sourceKind,robotsAllowed:true});
        row.status=candidate.gate;
        row.evidence=summarized(candidate);
      }catch(error){
        row.status="SOURCE_FETCH_HOLD";row.failure=failureCode(error);
      }
    }
    rows.push(row);
  }
  const states={};
  for(const row of rows)states[row.status]=(states[row.status]??0)+1;
  return {
    contract:TRUST_P3_LIVE_COHORT_VERSION,
    observedAt:new Date().toISOString(),execute,
    summary:{products:3,attempted:execute?3:0,states,
      eligibleCandidatePages:rows.filter(r=>r.status==="EVIDENCE_CANDIDATE_ONLY").length,
      observedDirectSpf:rows.filter(r=>r.evidence?.fields.spf?.state==="DIRECT_CLAIM_CANDIDATE").length,
      observedDirectPa:rows.filter(r=>r.evidence?.fields.pa?.state==="DIRECT_CLAIM_CANDIDATE").length,
      ...empty},
    items:rows,readOnly:true,fullyVerifiedExactSkuCount:0,
    marketVerifiedFromPageCount:0,formulationVerifiedFromPageCount:0,
  };
}
export async function runTrustP3ThreeBrandCli(args=process.argv.slice(2)){
  if(args.some(a=>a!=="--execute"))throw Error("TRUST_P3_LIVE_UNSUPPORTED_FLAG");
  const execute=args.includes("--execute");
  if(execute&&process.env.TRUST_P3_OFFICIAL_LIVE_ENABLED!=="true")
    throw Error("TRUST_P3_LIVE_DISABLED");
  const result=await observeTrustP3OfficialThreeBrand({
    execute,
    fetchRobots:(url,origin)=>fetchOfficialBytes(url,strictOriginTransport(fetch,origin)),
    fetchProduct:(url,origin,policy)=>fetchOfficialBytes(url,
      strictOriginTransport(fetch,origin,policy)),
  });
  if(execute){
    fs.mkdirSync("artifacts",{recursive:true});
    fs.writeFileSync("artifacts/trust-p3-official-three-brand-result.json",
      JSON.stringify(result,null,2)+"\n");
  }
  if(process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      ["### TRUST P3 read-only official sunscreen observation",
      "- Products: 3",
      "- Candidate pages: "+result.summary.eligibleCandidatePages,
      "- Outcome: "+JSON.stringify(result.summary.states),
      "- AI API, Product Fact, Subject, Recommendation and DB writes: 0"].join("\n")+"\n");
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await runTrustP3ThreeBrandCli(),null,2));}
  catch(error){console.error(String(error?.message??"TRUST_P3_LIVE_ERROR").split(":")[0]);process.exitCode=1;}
}
