#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureR16G, R16G_ASSETS, R16G_ASSET_CAPTURE_CONTRACT } from "./capture-barrier-support-p1-r16g-official-images-v1.mjs";

assert.equal(R16G_ASSETS.length, 3);
assert.deepEqual(R16G_ASSETS.map(x => x.id), [
  "snature_80ml_product_notice", "snature_90ml_detail_first", "snature_90ml_detail_last"
]);
for (const a of R16G_ASSETS) {
  assert.ok(a.path.startsWith("/web/upload/new_design/gelcream/"));
  assert.ok(!a.path.includes(".."));
}
const jpeg = Buffer.alloc(52, 0); jpeg.set([0xff,0xd8,0xff,0xe0],0);
const webp = Buffer.alloc(52, 0); webp.write("RIFF",0); webp.write("WEBP",8);
const bytes = new Map([
  [R16G_ASSETS[0].path, jpeg], [R16G_ASSETS[1].path, webp], [R16G_ASSETS[2].path, jpeg]
]);
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "r16g-img-"));
try {
 const positive = await captureR16G({
   outputDir:path.join(tmp, "pass"),
   clock:() => "2026-10-09T00:00:00Z",
   context:{exact_checkout_sha:"a".repeat(40),run_id:"987",run_attempt:"1"},
   fetchAsset: async url => ({
     finalUrl:url, bytes:bytes.get(new URL(url).pathname),
     contentType:url.endsWith(".webp")?"image/webp":"image/jpeg"
   })
 });
 assert.equal(positive.contract,R16G_ASSET_CAPTURE_CONTRACT);
 assert.equal(positive.execution.exact_checkout_sha,"a".repeat(40));
 assert.deepEqual(positive.summary,{
  attempted:3,captured:3,blocked:0,visual_content_reviewed:0,
  formulation_revision_confirmed:0,registerable:0,production_writes:0
 });
 for(const asset of positive.assets){
  assert.equal(asset.observed_raw_bytes,true);
  assert.equal(asset.decision,"RAW_OFFICIAL_IMAGE_CAPTURED_CONTENT_REVIEW_REQUIRED");
  assert.equal(asset.visual_content_reviewed,false);
  assert.equal(asset.product_identity_or_ingredient_panel_confirmed,false);
  const orig=bytes.get(new URL(asset.source_url).pathname);
  assert.equal(asset.sha256,createHash("sha256").update(orig).digest("hex"));
  assert.equal(Buffer.compare(await fs.readFile(path.join(tmp,"pass",asset.artifact_file)),orig),0);
 }
 assert.equal(positive.formulation_revision_key,null);
 assert.equal(positive.subject_semantic_key,null);
 assert.equal(positive.subject_registration_authorized,false);
 assert.equal(positive.production_writes,0);
 const blocked=await captureR16G({
  outputDir:path.join(tmp,"blocked"),
  fetchAsset:async url=>{
   if(url.includes("gel80ml_info"))throw new Error("TRANSIENT_FAILURE:asset_fetch_error");
   return {bytes:url.endsWith(".webp")?webp:jpeg,contentType:url.endsWith(".webp")?"image/webp":"image/jpeg",finalUrl:"https://example.com/redirect"};
  }
 });
 assert.equal(blocked.summary.captured,0);
 assert.equal(blocked.summary.blocked,3);
 assert.equal(blocked.assets[0].failure_code,"TRANSIENT_FAILURE:asset_fetch_error");
 assert.equal(blocked.assets[1].failure_code,"SOURCE_BLOCKED:unexpected_brand_host");
 assert.deepEqual(blocked.assets.map(x=>x.sha256),[null,null,null]);
 const disguised=await captureR16G({
  outputDir:path.join(tmp,"disguised"),
  fetchAsset:async url=>({bytes:Buffer.from("<html>this is not an image</html>xxxxxxxxxxxxx"),contentType:"image/jpeg",finalUrl:url})
 });
 assert.equal(disguised.summary.captured,0);
 assert.ok(disguised.assets.every(x=>x.failure_code==="SOURCE_BLOCKED:unsupported_image_magic_or_content_type"));
 const r16f=JSON.parse(await fs.readFile("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16f-firstparty-presentation-scope-audit-v1.json","utf8"));
 assert.equal(r16f.terminal,"R16F_OFFICIAL_80ML_90ML_PRESENTATION_SCOPE_MIXED_AND_REVISION_LINEAGE_UNBOUND_HOLD2");
 assert.equal(r16f.next_gate.stage,"V2.1-8H-R16G_P1_OFFICIAL_IMAGE_CONTENT_AND_MANUFACTURER_APPLICABILITY_RECOVERY");
 assert.deepEqual(new Set(R16G_ASSETS.map(x=>x.path)),new Set([
   r16f.targets[1].observations.detail_image_80ml_info,
   r16f.targets[1].observations.detail_image_90ml_example,
   "/web/upload/new_design/gelcream/90ml/260826/gelcream_17.jpg"
 ]));
 assert.equal(r16f.targets[1].identity_boundary.subject_semantic_key,null);
 const workflow=await fs.readFile(".github/workflows/taxonomy-ai-r16d-source-capture.yml","utf8");
 for(const token of [
  "capture-barrier-support-p1-r16g-official-images-v1.mjs",
  "verify-barrier-support-p1-r16g-official-images-v1.mjs",
  "r16g-p1-official-visual-assets",
  "R16G_EXACT_CHECKOUT_SHA",
  "retention-days: 7"
 ])assert.ok(workflow.includes(token),token);
 const source=await fs.readFile("scripts/product-evidence/capture-barrier-support-p1-r16g-official-images-v1.mjs","utf8");
 for(const banned of ["createClient(", ".rpc(", ".insert(", ".upsert(", "SUPABASE_SERVICE_ROLE_KEY", "service_role"])assert.ok(!source.includes(banned),banned);
 console.log(JSON.stringify({status:"PASS",stage:"R16G",assets:3,exact_raw_byte_sha256:true,network_malformation_fail_closed:true,all_formulation_authority_blocked:true,production_writes:0}));
} finally { await fs.rm(tmp,{recursive:true,force:true}); }
