#!/usr/bin/env node
// D8K-8 real local-file I/O smoke test with SYNTHETIC image bytes and
// untrusted metadata. No seller network, DB, persistent archive or publishing.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root=mkdtempSync(path.join(tmpdir(),"d8k8-cli-test-"));
const cli=path.resolve("scripts/product-evidence/prepare-d8k8-local-option-review-v1.mjs");
const sample=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWYQAAAAASUVORK5CYII=","base64");
const hash=createHash("sha256").update(sample).digest("hex");
const observationId=randomUUID();
const observedAt=new Date(Date.now()-2*3600000).toISOString();
const reviewedAt=new Date(Date.now()-3600000).toISOString();
const uuid=randomUUID;
const manifest={
  productId:uuid(),offerId:uuid(),observationId,
  brand:"SYNTHETIC TEST BRAND",productName:"SYNTHETIC ONLY",
  sellerKey:"hwahae",sellerName:"SYNTHETIC Hwahae listing shape",
  listingId:"45194",sourceUrl:"https://www.hwahae.co.kr/goods/45194",
  sellerOptionKey:"selected80",variantId:"sku80",
  optionKind:"single",unitSize:80,sizeUnit:"ml",quantity:1,gifts:[],
  selectedOptionPriceKrw:24500,shippingPriceKrw:null,
  shippingPriceBasis:"unknown",observedAt,
  sourceName:"manual_source_capture",
  sourceRecordId:"synthetic-cli1",collectorActorKey:"collector_one",
  sourceEvidenceSha256:hash
};
const keys=[
  "product_listing_scope","selected_sku","pack_gift_composition",
  "selected_option_price","shipping_conditions","capture_origin",
  "product_vs_offer_attribution"
];
const reviewer={
  reviewId:uuid(),observationId,verdict:"verified",
  reviewerReference:"synthetic_independent_reviewer",
  reviewerActorKey:"reviewer_two",sourceEvidenceSha256:hash,
  reviewedAt,checks:Object.fromEntries(keys.map(k=>[k,"matched"]))
};
const files={
  capture:path.join(root,"capture.json"),source:path.join(root,"source.png"),
  review:path.join(root,"review.json")
};
const write=(p,o)=>writeFileSync(p,JSON.stringify(o));
function run(extra=[],expectCode=0){
  const argv=[cli,"--manifest",files.capture,"--source",files.source,...extra];
  const child=spawnSync(process.execPath,argv,{
    encoding:"utf8",timeout:20000,maxBuffer:1000000,windowsHide:true
  });
  if(child.error)throw child.error;
  assert.equal(child.status,expectCode,child.stderr||child.stdout);
  const out=(child.stdout||child.stderr).trim();
  assert.ok(out.startsWith("{")&&out.endsWith("}"));
  assert.doesNotMatch(out,/https:\/\/www\.hwahae\.co\.kr|24500|synthetic-cli1/);
  return JSON.parse(out);
}
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{
  writeFileSync(files.source,sample);
  write(files.capture,manifest);write(files.review,reviewer);
  let out=run();
  eq(out.status,"AWAITING_INDEPENDENT_REVIEW");
  eq(out.localBytesDigestMatched,true);
  eq(out.sourceFilePersistedByTool,false);
  eq(out.sellerPricePublished,false);
  eq(out.dbWrites,0);
  out=run(["--review",files.review]);
  eq(out.status,"INDEPENDENT_REVIEW_PACKET_READY_NO_WRITE");
  eq(out.independentReviewMetadataReady,true);
  eq(out.reviewerIdentityAuthenticated,false);
  eq(out.productionReleaseAuthorized,false);
  eq(out.directCtaAuthorized,false);
  eq(out.sourceDigestPrefix,hash.slice(0,12));

  write(files.capture,{...manifest,sourceEvidenceSha256:"b".repeat(64)});
  out=run(["--review",files.review],1);
  eq(out.status,"HOLD");eq(out.reason,"ARCHIVED_SOURCE_BYTES_DIGEST_MISMATCH");
  write(files.capture,manifest);

  writeFileSync(files.source,Buffer.concat([sample,Buffer.from("tamper")]));
  out=run([],1);
  eq(out.reason,"ARCHIVED_SOURCE_BYTES_DIGEST_MISMATCH");
  writeFileSync(files.source,sample);

  write(files.review,{...reviewer,reviewerActorKey:"collector_one"});
  out=run(["--review",files.review],1);
  eq(out.reason,"COLLECTOR_CANNOT_SELF_REVIEW");
  write(files.review,reviewer);

  write(files.capture,{...manifest,sourceUrl:"https://evil.hwahae.co.kr/goods/45194"});
  out=run([],1);
  eq(out.reason,"PRODUCT_LISTING_OR_CAPTURE_IDENTITY_UNRESOLVED");
  write(files.capture,manifest);

  writeFileSync(files.source,Buffer.from("not a png"));
  out=run([],1);
  eq(out.status,"HOLD");
  eq(out.reason,"SOURCE_FILE_MAGIC_OR_SHAPE_INVALID");
  writeFileSync(files.source,sample);

  // Optional symlink rejection; Windows symlink permissions may forbid setup.
  const link=path.join(root,"linked.png");
  try{
    symlinkSync(files.source,link);
    const original=files.source;files.source=link;
    out=run([],1);
    eq(out.reason,"LOCAL_FILE_TYPE_OR_SIZE_UNSUPPORTED");
    files.source=original;
  }catch(error){
    files.source=path.join(root,"source.png");
    if(error?.code!=="EPERM"&&error?.code!=="EACCES")
      throw error;
  }

  const prohibited=path.join(root,".env.local");
  writeFileSync(prohibited,sample);
  const original=files.source;files.source=prohibited;
  out=run([],1);eq(out.reason,"PRIVATE_CREDENTIAL_FILE_FORBIDDEN");
  files.source=original;

  out=run(["--review",files.capture],1);
  eq(out.reason,"CAPTURE_AND_REVIEW_FILES_MUST_BE_DISTINCT");
  eq(readFileSync(files.source).equals(sample),true);
  console.log(JSON.stringify({
    status:"PASS",stage:"D8K8_LOCAL_EVIDENCE_BYTES_AND_REVIEW_CLI",
    assertions:checks,syntheticOnly:true,realSellerEvidence:false,
    localFilesWrittenOnlyInsideDisposableTestTemp:true,privateDataPrinted:false,
    productionDbWrites:0,pricePublished:false,serverReviewAuthority:false
  }));
}finally{
  rmSync(root,{recursive:true,force:true});
}
