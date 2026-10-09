#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {createHash} from "node:crypto";
import {ASSETS,CONTRACT,captureR16HR3,detectImageFormat} from "./capture-barrier-support-p1-r16h-r3-snature-official-detail-assets-v1.mjs";
const jpg=Buffer.alloc(32);jpg.set([255,216,255,224]);
const gif=Buffer.concat([Buffer.from("GIF89a","ascii"),Buffer.alloc(26)]);
const webp=Buffer.alloc(32);webp.write("RIFF",0);webp.write("WEBP",8);
const get=(ext)=>ext==="jpg"?jpg:ext==="gif"?gif:webp;
assert.equal(ASSETS.length,15);
assert.deepEqual(ASSETS.map(x=>x.id),Array.from({length:15},(_,i)=>"snature_90ml_detail_"+String(i+2).padStart(2,"0")));
assert.deepEqual(ASSETS.map(x=>x.expected_extension),["jpg","jpg","webp","jpg","jpg","jpg","webp","jpg","gif","gif","jpg","gif","gif","gif","jpg"]);
for(const asset of ASSETS){
 assert.ok(asset.url.startsWith("https://www.snature.kr/web/upload/new_design/gelcream/90ml/260826/"));
 assert.equal(new URL(asset.url).pathname,asset.path);
 assert.equal(new URL(asset.url).username,"");
}
assert.equal(detectImageFormat(jpg),"jpg");
assert.equal(detectImageFormat(gif),"gif");
assert.equal(detectImageFormat(webp),"webp");
assert.equal(detectImageFormat(Buffer.from("<html>not an image</html>")),null);
const temp=await fs.mkdtemp(path.join(os.tmpdir(),"r16hr3-"));
try{
 const positive=await captureR16HR3({outputDir:path.join(temp,"positive"),clock:()=>"2026-10-09T12:00:00Z",
  context:{exact_checkout_sha:"a".repeat(40)},
  fetchAsset:async url=>{
   const t=ASSETS.find(x=>x.url===url);assert.ok(t);
   return {bytes:get(t.expected_extension),finalUrl:url,contentType:({"jpg":"image/jpeg","gif":"image/gif","webp":"image/webp"})[t.expected_extension]};
  }});
 assert.equal(positive.contract,CONTRACT);
 assert.equal(positive.execution.exact_checkout_sha,"a".repeat(40));
 assert.deepEqual(positive.summary,{attempted:15,captured:15,blocked:0,visual_content_reviewed:0,
  official_90ml_ingredient_panels_confirmed:0,formula_revision_confirmed:0,production_writes:0,registerable:0});
 for(const row of positive.assets){
  assert.equal(row.fetched,true);
  assert.equal(row.contains_official_90ml_ingredient_notice,"NOT_REVIEWED");
  assert.equal(row.content_reviewed,false);
  const raw=await fs.readFile(path.join(temp,"positive",row.artifact_file));
  assert.equal(row.raw_sha256,createHash("sha256").update(raw).digest("hex"));
  assert.equal(raw.length,row.byte_count);
 }
 assert.equal(positive.formulation_revision_key,null);
 assert.equal(positive.subject_semantic_key,null);
 assert.equal(positive.registration_authorized,false);
 assert.equal(positive.production_writes,0);
 const blocked=await captureR16HR3({outputDir:path.join(temp,"blocked"),fetchAsset:async url=>{
   const x=ASSETS.find(t=>t.url===url);
   if(x.id.endsWith("02"))throw Error("SOURCE_BLOCKED:http_404");
   if(x.id.endsWith("03"))return {bytes:jpg,contentType:"image/jpeg",finalUrl:"https://evil.invalid/"+x.id+".jpg"};
   return {bytes:Buffer.from("not an image, no magic"),contentType:"image/jpeg",finalUrl:url};
 }});
 assert.equal(blocked.summary.captured,0);
 assert.equal(blocked.summary.blocked,15);
 assert.equal(blocked.assets[0].failure_code,"SOURCE_BLOCKED:http_404");
 assert.equal(blocked.assets[1].failure_code,"SOURCE_BLOCKED:brand_asset_redirect");
 assert.ok(blocked.assets.slice(2).every(x=>x.failure_code==="SOURCE_BLOCKED:asset_mime_magic_mismatch"));
 assert.ok(blocked.assets.every(x=>x.raw_sha256===null&&x.artifact_file===null));
 const script=await fs.readFile("scripts/product-evidence/capture-barrier-support-p1-r16h-r3-snature-official-detail-assets-v1.mjs","utf8");
 for(const bad of ["SUPABASE_SERVICE_ROLE_KEY",".rpc(", ".insert(", ".upsert(","update public.","delete from "])assert.ok(!script.includes(bad));
 const workflow=await fs.readFile(".github/workflows/taxonomy-ai-r16d-source-capture.yml","utf8");
 assert.ok(workflow.includes("capture-barrier-support-p1-r16h-r3-snature-official-detail-assets-v1.mjs"));
 assert.ok(workflow.includes("r16h-r3-snature-firstparty-detail-images"));
 assert.ok(workflow.includes("retention-days: 7"));
 assert.ok(workflow.includes("R16HR3_EXACT_HEAD_SHA"));
 console.log(JSON.stringify({status:"PASS",stage:"R16H-R3",fixed_assets:15,existing_reviewed_assets:2,
  malicious_redirect_blocked:true,image_magic_guard:true,ingredient_authority_issued:false,production_writes:0}));
}finally{await fs.rm(temp,{recursive:true,force:true});}
