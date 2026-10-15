#!/usr/bin/env node
// Temp-file/Node child-process smoke test; all bytes, actor ids and prices
// are SYNTHETIC. No private Storage access or remote network.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync,writeFileSync,symlinkSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve,join } from "node:path";
import { spawnSync } from "node:child_process";
import {
 R16I_D8K11_PRODUCT_ID,R16I_D8K11_SOURCE_IDENTITIES
} from "../../lib/product-intelligence/r16i-d8k11-existing-evidence-preflight.mjs";
const root=mkdtempSync(join(tmpdir(),"d8k11-evidence-cli-"));
const cli=resolve("scripts/product-evidence/check-d8k11-local-existing-archives-v1.mjs");
const officialId="97adb21c-3be4-4654-bce7-54b5dabb2423";
const bundleId="e0feb0e9-69f2-4ebf-bd14-0ccb320b3707";
const collector="00000000-0000-4000-8000-000000000011";
const reviewer="00000000-0000-4000-8000-000000000012";
const fakeOfficial=Buffer.concat([
 Buffer.from([137,80,78,71,13,10,26,10]),
 Buffer.from("SYNTHETIC_PNG_MAGIC_ONLY_OFFICIAL")
]);
const fakeBundle=Buffer.concat([
 Buffer.from([137,80,78,71,13,10,26,10]),
 Buffer.from("SYNTHETIC_PNG_MAGIC_ONLY_BUNDLE")
]);
const sha=b=>createHash("sha256").update(b).digest("hex");
const captured=new Date(Date.now()-7200000).toISOString();
const created=new Date(Date.now()-3600000).toISOString();
const reviewed=new Date(Date.now()-900000).toISOString();
const files={
 metadata:join(root,"metadata.json"),official:join(root,"official.png"),
 hwahae:join(root,"hwahae.png"),reviews:join(root,"review.json")
};
const evidence=[
 ["official_single",officialId,fakeOfficial,24500],
 ["hwahae_bundle",bundleId,fakeBundle,29900]
].map(([key,id,bytes,price])=>({
 evidence_id:id,product_id:R16I_D8K11_PRODUCT_ID,
 source_key:key,source_url:R16I_D8K11_SOURCE_IDENTITIES[key].url,
 selected_option:R16I_D8K11_SOURCE_IDENTITIES[key].option,
 checkout_price_krw:price,captured_at:captured,created_at:created,
 evidence_state:"UNVERIFIED",submitted_by:collector,
 file_sha256:sha(bytes),file_bytes:bytes.length,mime_type:"image/png",
 object_path:R16I_D8K11_PRODUCT_ID+"/"+id+".png"
}));
const checkKeys=[
 "product_listing_scope","selected_sku","pack_gift_composition",
 "selected_option_price","shipping_conditions","capture_origin",
 "product_vs_offer_attribution"
];
const reviews=[officialId,bundleId].map(evidence_id=>({
 evidence_id,reviewer_id:reviewer,verdict:"VERIFIED",
 reviewed_at:reviewed,reason:"Synthetic independent review only",
 checks:Object.fromEntries(checkKeys.map(k=>[k,"matched"]))
}));
const write=(path,data)=>writeFileSync(path,JSON.stringify(data));
function run(includeReviews=true,expectedCode=0){
 const args=[cli,"--metadata",files.metadata,
  "--official",files.official,"--hwahae",files.hwahae];
 if(includeReviews)args.push("--reviews",files.reviews);
 const child=spawnSync(process.execPath,args,{
  encoding:"utf8",timeout:15000,maxBuffer:1024*1024,windowsHide:true
 });
 if(child.error)throw child.error;
 assert.equal(child.status,expectedCode,"Unexpected native CLI status");
 const output=child.stdout.trim();
 assert.ok(output.startsWith("{")&&output.endsWith("}"),
  "CLI must emit exactly one redacted JSON object to stdout");
 for(const sensitive of [
   officialId,bundleId,collector,reviewer,"24500","29900",
   sha(fakeOfficial),sha(fakeBundle),"source_url","object_path",root
 ])assert.ok(!output.includes(sensitive),"Raw private data escaped CLI");
 return JSON.parse(output);
}
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
try{
 writeFileSync(files.official,fakeOfficial);
 writeFileSync(files.hwahae,fakeBundle);
 write(files.metadata,{evidenceRows:evidence});
 write(files.reviews,{reviews});

 let result=run();
 eq(result.status,"TWO_REVIEW_METADATA_PACKETS_READY_NO_WRITE");
 eq(result.archiveBytesMatchedCount,2);
 eq(result.reviewMetadataReadyCount,2);
 eq(result.verifiedSellerPricesPublished,0);
 eq(result.productionDbWrites,0);
 eq(result.releaseAuthorized,false);
 eq(result.records[0].expectedCreamQuantity,1);
 eq(result.records[1].expectedCreamQuantity,2);
 eq(result.records[1].expectedGiftSerumMl,10);

 result=run(false,1);
 eq(result.status,"HOLD");
 eq(result.archiveBytesMatchedCount,2);
 eq(result.reviewMetadataReadyCount,0);
 eq(result.records[0].reason,"INDEPENDENT_REVIEW_NOT_SUBMITTED");

 writeFileSync(files.official,Buffer.concat([fakeOfficial,Buffer.from("tamper")]));
 result=run(true,1);
 eq(result.status,"HOLD");
 eq(result.records[0].reason,"ARCHIVE_BYTES_MAGIC_SIZE_OR_SHA_MISMATCH");
 writeFileSync(files.official,fakeOfficial);

 write(files.reviews,{reviews:reviews.map((r,i)=>i===0?{...r,reviewer_id:collector}:r)});
 result=run(true,1);
 eq(result.records[0].reason,"INDEPENDENT_REVIEWER_IDENTITY_NOT_SEPARATED");
 write(files.reviews,{reviews});

 write(files.metadata,{evidenceRows:[evidence[0],evidence[0]]});
 result=run(true,1);
 eq(result.reason,"TWO_DISTINCT_R16I_SOURCES_REQUIRED");
 write(files.metadata,{evidenceRows:evidence});

 const original=files.official;
 writeFileSync(files.official,Buffer.from("non image"));
 result=run(true,1);
 eq(result.records[0].reason,"ARCHIVE_BYTES_MAGIC_SIZE_OR_SHA_MISMATCH");
 writeFileSync(files.official,fakeOfficial);

 const symlink=join(root,"indirect.png");
 try{
  symlinkSync(files.official,symlink);
  files.official=symlink;
  result=run(true,1);
  eq(result.reason,"LOCAL_FILE_TYPE_OR_SIZE_UNSUPPORTED");
 }catch(error){
  if(error?.code!=="EPERM"&&error?.code!=="EACCES")
    throw error;
 }finally{files.official=original}

 writeFileSync(join(root,".env.local"),fakeOfficial);
 files.official=join(root,".env.local");
 result=run(true,1);
 eq(result.reason,"POTENTIAL_SECRET_FILE_FORBIDDEN");
 files.official=original;

 const v=spawnSync(process.execPath,[cli,"--help"],{
  encoding:"utf8",timeout:15000,windowsHide:true
 });
 eq(v.status,0);
 eq(v.stdout.includes("Never share files"),true);
 console.log(JSON.stringify({
  status:"PASS",stage:"D8K11_LOCAL_PRIVATE_ARCHIVE_CLI_SMOKE",
  assertions:checks,syntheticOnly:true,actualArchiveBytesReceived:false,
  reviewerIdentityAuthenticated:false,privateDataPrinted:false,
  fileWritesOnlyInDisposableTemp:true,productionDbWrites:0,
  pricePublished:false,releaseAuthorized:false
 }));
}finally{
 rmSync(root,{recursive:true,force:true});
}
