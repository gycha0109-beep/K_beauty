#!/usr/bin/env node
/**
 * A single bounded LIVE robots.txt probe against a known official source.
 * No sitemap, product page, DB credentials, Fact or Subject writes.
 *
 * TRUST_P2C_ROBOTS_LIVE_ENABLED=true node scripts/trust-p2c-robots-smoke.mjs --execute
 */
import { pathToFileURL } from "node:url";
import { appendFileSync } from "node:fs";
import { fetchOfficialBytes } from "../lib/trust/official-source-fetch.mjs";
import { createTrustRobotsPolicy, strictOriginTransport } from "../lib/trust/official-product-discovery-p2-v1.mjs";

export const TRUST_P2C_ROBOTS_PROBE_VERSION="trust-p2c-robots-smoke-v1";
export const TRUST_P2C_OFFICIAL_ORIGIN="https://www.torriden.com";
const ROBOTS=TRUST_P2C_OFFICIAL_ORIGIN+"/robots.txt";
const SITEMAP=TRUST_P2C_OFFICIAL_ORIGIN+"/sitemap.xml";
const PRODUCT=TRUST_P2C_OFFICIAL_ORIGIN+"/goods/goods_view.php?goodsNo=136";
function fail(code){throw new Error(code);}
function normalizedError(error){
  const text=String(error?.message||"");
  if(text.startsWith("TRANSIENT_FAILURE:"))return "NETWORK_UNAVAILABLE";
  if(text.startsWith("SOURCE_BLOCKED:"))return "ROBOTS_ACCESS_BLOCKED";
  return "ROBOTS_FETCH_FAILED";
}
export async function probeTrustP2CRobots({execute=false,fetchRobots}={}){
  if(!execute)return {
    contract:TRUST_P2C_ROBOTS_PROBE_VERSION,status:"PLAN_ONLY",
    origin:TRUST_P2C_OFFICIAL_ORIGIN,requests:0,productPagesRequested:0,
    sourceConfirmed:false,aiApiCalls:0,factWrites:0,
  };
  if(typeof fetchRobots!=="function")fail("TRUST_P2C_FETCH_BOUNDARY_MISSING");
  try{
    const response=await fetchRobots(ROBOTS);
    if(response.finalUrl!==ROBOTS)fail("TRUST_P2C_ROBOTS_REDIRECT_SCOPE");
    const policy=createTrustRobotsPolicy(response.bytes);
    const sitemapAllowed=policy.allowed(SITEMAP);
    const productAllowed=policy.allowed(PRODUCT);
    return {
      contract:TRUST_P2C_ROBOTS_PROBE_VERSION,
      status:policy.delayBlocked?"CRAWL_DELAY_HOLD":
        !sitemapAllowed||!productAllowed?"ROBOTS_RESTRICTED":"ROBOTS_PERMIT_PATHS",
      origin:TRUST_P2C_OFFICIAL_ORIGIN,robotsVerified:true,
      sitemapAllowed,productAllowed,crawlDelayBlocked:policy.delayBlocked,
      robotsDigest:(await import("node:crypto")).createHash("sha256")
        .update(response.bytes).digest("hex"),
      requests:1,productPagesRequested:0,sourceConfirmed:false,
      aiApiCalls:0,factWrites:0,
    };
  }catch(error){
    return {
      contract:TRUST_P2C_ROBOTS_PROBE_VERSION,
      status:normalizedError(error),origin:TRUST_P2C_OFFICIAL_ORIGIN,
      robotsVerified:false,requests:1,productPagesRequested:0,
      sourceConfirmed:false,aiApiCalls:0,factWrites:0,
    };
  }
}
export async function runTrustP2CCommand(args=process.argv.slice(2)){
  if(args.some(a=>a!=="--execute"))fail("TRUST_P2C_UNSUPPORTED_FLAG");
  const execute=args.includes("--execute");
  if(execute&&process.env.TRUST_P2C_ROBOTS_LIVE_ENABLED!=="true")
    fail("TRUST_P2C_LIVE_DISABLED");
  const fetchRobots=async url=>fetchOfficialBytes(url,
    strictOriginTransport(fetch,TRUST_P2C_OFFICIAL_ORIGIN));
  const result=await probeTrustP2CRobots({execute,fetchRobots});
  if(process.env.GITHUB_STEP_SUMMARY){
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      "### TRUST P2-C actual robots policy probe\n"+
      "- Site: "+result.origin+"\n"+
      "- Status: **"+result.status+"**\n"+
      "- Product page requests: **0**\n"+
      "- Product evidence / Subject / Fact promotion: **0**\n");
  }
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await runTrustP2CCommand(),null,2));}
  catch(error){console.error(String(error?.message??"TRUST_P2C_FAILURE").split(":")[0]);process.exitCode=1;}
}
