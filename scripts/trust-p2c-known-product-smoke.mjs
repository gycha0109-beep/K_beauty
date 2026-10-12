#!/usr/bin/env node
/**
 * Real, one-known-SKU P2-C transfer/identity smoke. Two HTTP GETs total,
 * always robots first. No database, no store, no page text disclosure.
 * Product baseline comes from existing governed exact-subject binding.
 */
import { normalizeSemanticTextV1 } from "../lib/trust/official-source-semantic-adapter.mjs";
import { pathToFileURL } from "node:url";
import { appendFileSync } from "node:fs";
import { fetchOfficialBytes } from "../lib/trust/official-source-fetch.mjs";
import { createTrustRobotsPolicy,strictOriginTransport,
  classifyTrustOfficialCandidatePage } from "../lib/trust/official-product-discovery-p2-v1.mjs";

export const P2C_PRODUCT_SMOKE_VERSION="trust-p2c-known-sku-live-v1";
export const VERIFIED_BASELINE={
  id:"08b85f37-b1fa-42d7-893a-0d4facb17878",
  name:"다이브인 무기자차 마일드 선크림",
  origin:"https://www.torriden.com",
  locator:"https://www.torriden.com/goods/goods_view.php?goodsNo=136",
};
const maxBytes=2*1024*1024;
function errorCode(error){
  const msg=String(error?.message??"");
  if(msg.startsWith("TRANSIENT_FAILURE:"))return "NETWORK_UNAVAILABLE";
  if(msg.startsWith("SOURCE_BLOCKED:"))return "SOURCE_BLOCKED";
  return "REQUEST_FAILED";
}
export async function probeTrustP2CProduct({
  execute=false,fetchRobots,fetchPage,
}={}){
  const base={
    contract:P2C_PRODUCT_SMOKE_VERSION,productId:VERIFIED_BASELINE.id,
    sourceOrigin:VERIFIED_BASELINE.origin,
    marketVerified:false,formulationVerified:false,
    newProductIdentityVerified:false,subjectCreationAuthorized:false,
    factConfirmationAuthorized:false,productFactWrites:0,dbWrites:0,aiApiCalls:0,
  };
  if(!execute)return {...base,status:"PLAN_ONLY",requests:0};
  if(typeof fetchRobots!=="function"||typeof fetchPage!=="function")
    throw Error("TRUST_P2C_PRODUCT_FETCH_BOUNDARY_REQUIRED");
  let robots,policy;
  try {
    robots=await fetchRobots(VERIFIED_BASELINE.origin+"/robots.txt");
    if(robots.finalUrl!==VERIFIED_BASELINE.origin+"/robots.txt")
      throw Error("TRUST_P2C_ROBOTS_REDIRECT");
    policy=createTrustRobotsPolicy(robots.bytes);
  } catch(error) {
    return {...base,status:"ROBOTS_UNAVAILABLE",reason:errorCode(error),requests:1};
  }
  if(policy.delayBlocked||!policy.allowed(VERIFIED_BASELINE.locator))
    return {...base,status:"ROBOTS_HOLD",requests:1};
  try {
    const page=await fetchPage(VERIFIED_BASELINE.locator,policy);
    if(page.finalUrl!==VERIFIED_BASELINE.locator||page.bytes.length>maxBytes)
      throw Error("TRUST_P2C_PRODUCT_SCOPE_INVALID");
    const detected=classifyTrustOfficialCandidatePage(page.bytes,VERIFIED_BASELINE);
    // Diagnostic only: a product name in generic visible page text is NOT
    // eligible evidence or verification for an unknown/new product SKU.
    // Exclude non-visible script/style/template content before checking.
    const visible=normalizeSemanticTextV1(page.bytes.toString("utf8")
      .replace(/<!--[^]*?-->/g," ")
      .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ")
      .replace(/<[^>]+>/g," "));
    const knownNameVisible=visible.includes(VERIFIED_BASELINE.name);
    return {
      ...base,status:detected.status,
      pageDigest:detected.sha256,bytesRead:page.bytes.length,
      identitySurface:detected.identitySurface,
      metadataTitleMatched:["STRUCTURED_NAME_CANDIDATE","TITLE_NAME_CANDIDATE"]
        .includes(detected.status),
      scopedProductHeadingCandidate:detected.status==="SCOPED_HEADING_CANDIDATE",
      bodyMentionOnly:detected.status==="BODY_NAME_MENTION_ONLY",
      knownNameVisibleInNonScriptText:knownNameVisible,
      evidenceAdmissionAuthorized:false,
      sourceLocator:VERIFIED_BASELINE.locator,
      requests:2,
    };
  }catch(error){
    return {...base,status:errorCode(error),requests:2};
  }
}
export async function runTrustP2CProductCli(args=process.argv.slice(2)){
  if(args.some(a=>a!=="--execute"))throw Error("TRUST_P2C_UNSUPPORTED_FLAG");
  const enabled=args.includes("--execute");
  if(enabled&&process.env.TRUST_P2C_PRODUCT_LIVE_ENABLED!=="true")
    throw Error("TRUST_P2C_PRODUCT_LIVE_DISABLED");
  const guardedFetch=strictOriginTransport(fetch,VERIFIED_BASELINE.origin);
  const fetchRobots=url=>fetchOfficialBytes(url,guardedFetch);
  const fetchPage=(url,policy)=>fetchOfficialBytes(url,
    strictOriginTransport(fetch,VERIFIED_BASELINE.origin,policy));
  const result=await probeTrustP2CProduct({
    execute:enabled,fetchRobots,fetchPage,
  });
  if(process.env.GITHUB_STEP_SUMMARY){
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      ["### TRUST P2-C known product transfer pilot",
       "- Status: **"+result.status+"**",
       "- Product: known governed Torriden sunscreen",
       "- HTTP requests: "+result.requests+" (maximum 2)",
       "- Content stored/copy-published: 0",
       "- Authority writes: 0"].join("\n")+"\n");
  }
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try{console.log(JSON.stringify(await runTrustP2CProductCli(),null,2));}
  catch(error){console.error(String(error?.message??"TRUST_P2C_ERROR").split(":")[0]);process.exitCode=1;}
}
