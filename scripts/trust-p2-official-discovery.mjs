#!/usr/bin/env node
/**
 * One-product, read-only official discovery. CLI does not mutate production.
 *
 *   node scripts/trust-p2-official-discovery.mjs --product-id=<uuid>
 *   TRUST_P2_LIVE_DISCOVERY_ENABLED=true node scripts/trust-p2-official-discovery.mjs --product-id=<uuid> --execute
 *
 * Non-execute mode queries read-only catalog metadata and prints plans.
 * Live mode fetches robots, at most 2 sitemaps + 2 pages per origin,
 * across at most 2 official origins. No external search engines or AI.
 */
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { planTrustBrandOfficialFrontier } from "../lib/trust/brand-official-frontier-v1.mjs";
import {
  runTrustP2Discovery, trustP2LiveFetchers,
} from "../lib/trust/official-product-discovery-p2-v1.mjs";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(code){throw new Error(code);}
async function select(client,table,columns,{eq={},inIds=null,max=500}={}){
  let q=client.from(table).select(columns);
  for(const [k,v] of Object.entries(eq))q=q.eq(k,v);
  if(inIds)q=q.in(inIds[0],inIds[1]);
  const {data,error}=await q.limit(max+1);
  if(error||!Array.isArray(data)||data.length>max)
    fail("TRUST_P2_READ_FAILED_"+table.toUpperCase());
  return data;
}
export async function loadTrustP2OneProduct(client,productId){
  if(!UUID.test(productId??""))fail("TRUST_P2_PRODUCT_ID_INVALID");
  const target=(await select(client,"products",
    "id,brand,name,name_en,normalized_name,normalized_brand",
    {eq:{id:productId},max:1}))[0];
  if(!target||!target.normalized_brand)
    fail("TRUST_P2_PRODUCT_OR_BRAND_NOT_FOUND");
  const intakes=await select(client,"catalog_trust_intake",
    "id,product_id,identity_state,trust_state",
    {eq:{product_id:productId},max:5});
  if(intakes.length!==1||intakes[0].identity_state!=="SUBJECT_CREATION_REQUIRED"||
    intakes[0].trust_state!=="REVIEW_REQUIRED")
    fail("TRUST_P2_NOT_BLOCKED_IDENTITY_INTAKE");
  const products=await select(client,"products",
    "id,brand,name,name_en,normalized_name,normalized_brand",
    {eq:{normalized_brand:target.normalized_brand},max:500});
  if(!products.some(p=>p.id===productId))fail("TRUST_P2_BRAND_COHORT_INVALID");
  const peers=products.filter(p=>p.id!==productId).map(p=>p.id);
  const bindings=peers.length?await select(client,
    "product_evidence_source_subject_bindings",
    "binding_id,product_id,subject_id,source_id,binding_state,scope_relation",
    {inIds:["product_id",peers],max:500}):[];
  const sourceIds=[...new Set(bindings.map(b=>b.source_id))];
  const sources=sourceIds.length?await select(client,
    "product_evidence_sources","source_id,canonical_locator,source_kind",
    {inIds:["source_id",sourceIds],max:500}):[];
  const frontier=planTrustBrandOfficialFrontier({
    backlog:intakes,products,bindings,sources,
  });
  return {target,row:frontier.items[0],frontier};
}
export async function runTrustP2Cli(args=process.argv.slice(2)){
  const productArg=args.find(x=>x.startsWith("--product-id="));
  const id=productArg?.slice("--product-id=".length);
  if(!UUID.test(id??""))fail("TRUST_P2_PRODUCT_ID_REQUIRED");
  if(args.some(x=>!x.startsWith("--product-id=")&&x!=="--execute"))
    fail("TRUST_P2_UNSUPPORTED_FLAG");
  const execute=args.includes("--execute");
  if(execute&&process.env.TRUST_P2_LIVE_DISCOVERY_ENABLED!=="true")
    fail("TRUST_P2_LIVE_DISABLED");
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)fail("TRUST_P2_DB_CONFIG_REQUIRED");
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {target,row,frontier}=await loadTrustP2OneProduct(client,id);
  if(!execute){
    return {mode:"PLAN_ONLY_NO_NETWORK",productId:id,
      discoveryOriginCount:row.seedCount,
      discoveryOrigins:row.discoveryOrigins.map(x=>x.origin),
      status:row.status,readOnly:true,aiApiCalls:0};
  }
  if(frontier.withSeeds!==1) {
    return {mode:"EXECUTED_NO_ELIGIBLE_SITE",productId:id,
      discoveryOriginCount:0,readOnly:true,aiApiCalls:0};
  }
  const result=await runTrustP2Discovery(row,target,trustP2LiveFetchers());
  return {...result,mode:"LIVE_DISCOVERY_NO_AUTHORITY_WRITE"};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await runTrustP2Cli(),null,2));}
  catch(error){
    // Never print raw URLs, server-side credentials, stack traces or HTML.
    console.error(String(error?.message||"TRUST_P2_EXECUTION_FAILED").split(":")[0]);
    process.exitCode=1;
  }
}
