#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fetchOfficialAssetBytes, sha256Hex } from "../../lib/trust/official-source-fetch.mjs";

export const CONTRACT = "v21-8h-r16h-r3-snature-firstparty-detail-asset-evidence-v1";
const HOSTS = new Set(["www.snature.kr","snature.kr","m.snature.kr"]);
const BASE = "https://www.snature.kr/web/upload/new_design/gelcream/90ml/260826/";
const SUFFIXES = Object.freeze(["02.jpg","03.jpg","04.webp","05.jpg","06.jpg","07.jpg","08.webp","09.jpg",
  "10.gif","11.gif","12.jpg","13.gif","14.gif","15.gif","16.jpg"]);
export const ASSETS = Object.freeze(SUFFIXES.map(suffix => Object.freeze({
  id: "snature_90ml_detail_" + suffix.slice(0,2),
  url: BASE+"gelcream_"+suffix,
  path: "/web/upload/new_design/gelcream/90ml/260826/gelcream_"+suffix,
  expected_extension:suffix.split(".")[1],
})));

export function detectImageFormat(bytes){
  if(bytes.length<16)return null;
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "jpg";
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "png";
  if(bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")return "webp";
  if(["GIF87a","GIF89a"].includes(bytes.toString("ascii",0,6)))return "gif";
  return null;
}
function code(error){
  const s=String(error?.message||error||"");
  return s.startsWith("SOURCE_BLOCKED:")||s.startsWith("TRANSIENT_FAILURE:")?s.slice(0,150):
    "TRANSIENT_FAILURE:asset_fetch_error";
}

export async function captureR16HR3({outputDir,fetchAsset=fetchOfficialAssetBytes,context={},clock=()=>new Date().toISOString()}={}){
  assert.ok(typeof outputDir==="string"&&outputDir.length>0);
  await fs.mkdir(outputDir,{recursive:true});
  const result={
    contract:CONTRACT,
    captured_at:clock(),
    execution:{exact_checkout_sha:String(context.exact_checkout_sha||""),run_id:String(context.run_id||""),run_attempt:String(context.run_attempt||"")},
    first_party_domain:"www.snature.kr",
    upstream_official_html_artifact_id:11600769958,
    upstream_official_image_artifact_id:11608812161,
    intended_product_id:"5848640c-84ca-4079-9d9e-8f3113159fe1",
    official_product_presentation:"80ml",
    path_label_is_not_verified_product_presentation:true,
    no_visual_contents_claimed:true,
    formulation_revision_key:null,
    subject_semantic_key:null,
    registration_authorized:false,
    production_writes:0,
    assets:[],
  };
  for(const target of ASSETS){
    const entry={
      id:target.id,url:target.url,expected_extension:target.expected_extension,
      fetched:false,verified_image_magic:false,
      byte_count:null,raw_sha256:null,artifact_file:null,content_reviewed:false,
      contains_official_90ml_ingredient_notice:"NOT_REVIEWED",decision:"CAPTURE_BLOCKED"
    };
    try{
      const response=await fetchAsset(target.url);
      const final=new URL(response.finalUrl);
      if(final.protocol!=="https:"||!HOSTS.has(final.hostname.toLowerCase())||!final.pathname.startsWith("/web/upload/new_design/gelcream/90ml/260826/"))throw Error("SOURCE_BLOCKED:brand_asset_redirect");
      if(!Buffer.isBuffer(response.bytes))throw Error("SOURCE_BLOCKED:asset_missing_binary");
      const ext=detectImageFormat(response.bytes);
      const ctype=String(response.contentType||"").toLowerCase();
      if(!ext||ext!==target.expected_extension||!ctype.startsWith("image/") ||
          !({"jpg":"image/jpeg","webp":"image/webp","gif":"image/gif"}[ext]===ctype.split(";")[0].trim()))throw Error("SOURCE_BLOCKED:asset_mime_magic_mismatch");
      const name=target.id+"."+ext;
      await fs.writeFile(path.join(outputDir,name),response.bytes);
      Object.assign(entry,{
        fetched:true,verified_image_magic:true,byte_count:response.bytes.byteLength,
        raw_sha256:sha256Hex(response.bytes),artifact_file:name,
        final_url:response.finalUrl,content_type:response.contentType,
        decision:"OFFICIAL_ASSET_BYTES_CAPTURED_VISUAL_INSPECTION_REQUIRED"
      });
    }catch(e){
      entry.failure_code=code(e);
    }
    result.assets.push(entry);
  }
  result.summary={
    attempted:ASSETS.length,
    captured:result.assets.filter(x=>x.fetched).length,
    blocked:result.assets.filter(x=>!x.fetched).length,
    visual_content_reviewed:0,
    official_90ml_ingredient_panels_confirmed:0,
    formula_revision_confirmed:0,
    production_writes:0,
    registerable:0
  };
  await fs.writeFile(path.join(outputDir,"manifest.json"),JSON.stringify(result,null,2)+"\n");
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4||process.argv[2]!=="--output-dir")throw Error("Usage: --output-dir <dir>");
  captureR16HR3({outputDir:process.argv[3],context:{exact_checkout_sha:process.env.R16HR3_EXACT_HEAD_SHA,run_id:process.env.GITHUB_RUN_ID,run_attempt:process.env.GITHUB_RUN_ATTEMPT}})
    .then(result=>console.log(JSON.stringify({summary:result.summary,blocked:result.assets.filter(a=>!a.fetched).map(a=>({id:a.id,code:a.failure_code}))})))
    .catch(error=>{console.error(error);process.exitCode=1;});
}
