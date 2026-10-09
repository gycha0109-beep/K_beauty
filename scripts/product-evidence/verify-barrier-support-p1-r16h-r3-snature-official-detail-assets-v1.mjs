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
 const audit=JSON.parse(await fs.readFile("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16h-r3-snature-official-image-review-v1.json","utf8"));
 assert.equal(audit.stage,"R16H-R3");
 assert.equal(audit.artifact_id,11618211091);
 assert.equal(audit.head_sha,"18b7875d46916ec802f0f01dfd3fe091d747ac6c");
 assert.equal(audit.artifact_sha256,"4cef66598d10c55f0f5135433091abfed7e9eabd3782d21a4e1e1d266d2cdb82");
 assert.equal(audit.firstparty_image_paths_total,17);
 assert.equal(audit.prior_reviewed,2);
 assert.equal(audit.newly_fetched,15);
 assert.equal(audit.newly_sha256_verified,15);
 assert.equal(audit.newly_blocked,0);
 assert.equal(audit.animated_files,7);
 assert.equal(audit.official_90ml_legal_ingredient_panel_found,false);
 assert.equal(audit.official_90ml_manufacture_or_lot_info_found,false);
 assert.equal(audit.official_80ml_ingredient_count,25);
 assert.equal(audit.official_80ml_first_ingredient,"정제수");
 assert.equal(audit.retailer_claims_are_not_formulation_authority,true);
 assert.equal(audit.folder_name_is_not_formula_revision,true);
 assert.equal(audit.formulation_revision_key,null);
 assert.equal(audit.subject_semantic_key,null);
 assert.equal(audit.subject_registration_authorized,false);
 assert.equal(audit.production_writes,0);
 assert.equal(audit.pda_evaluations,1968);
 assert.equal(audit.archived_asset_checks.length,15);
 assert.deepEqual(audit.archived_asset_checks.map(x=>x.index),Array.from({length:15},(_,i)=>i+2));
 for(const row of audit.archived_asset_checks){
   assert.match(row.sha256,/^[0-9a-f]{64}$/);
   assert.ok(row.bytes>0&&row.bytes<8388608);
   assert.equal(row.independently_verified,true);
 }
 assert.equal(new Set(audit.archived_asset_checks.map(x=>x.sha256)).size,15);
 assert.equal(audit.decision,"R16H_R3_OFFICIAL_IMAGES_17_17_INSPECTED_90ML_LEGAL_PANEL_NOT_RECOVERED_HOLD");
 const report=await fs.readFile("docs/evidence/v21-8h-r16h-r3-snature-official-image-full-review-v1.md","utf8");
 for(const keyword of ["#11618211091","17개","15/15","500,000ppm","R16H-R4","formulation_revision_key=null"])assert.ok(report.includes(keyword),keyword);
 console.log(JSON.stringify({status:"PASS",stage:"R16H-R3",fixed_assets:15,existing_reviewed_assets:2,
  malicious_redirect_blocked:true,image_magic_guard:true,ingredient_authority_issued:false,production_writes:0}));
}finally{await fs.rm(temp,{recursive:true,force:true});}
