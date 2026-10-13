#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {inspectTrustP3TemplateShape as inspect,
  TRUST_P3_TEMPLATE_SHAPE_VERSION} from "../lib/trust/official-template-shape-p3-v1.mjs";
const make=(html,opts)=>inspect(Buffer.from(html),opts);
const sample='<html><head><meta property="og:title" content="Customer private info"></head>'+
  '<body><nav><a href="/x">다른상품 25ml</a></nav><div class="goods_detail" data-product-id="PRIVATE-PRODUCT-ID">'+
  '<div class="goods_name"><h1>Primary Product PRIVATE NAME</h1></div>'+
  '<form><select name="options[Size]"><option value="25ml">25ml</option>'+
  '<option selected value="40ml">40ml</option></select>'+
  '<input type="radio" name="size" value="40ml" checked></form></div>'+
  '<script>const PRIVATE_TOKEN="<h1>fake</h1>";</script>'+
  '<!-- <main><h1>test</h1></main> -->'+
  '<div class="related-products"><h1>Other</h1></div></body></html>';
const parsed=make(sample,{contentType:"text/html; charset=UTF-8"});
assert.equal(parsed.contract,TRUST_P3_TEMPLATE_SHAPE_VERSION);
assert.equal(parsed.scanStatus,"COMPLETE");
assert.equal(parsed.countsComplete,true);
assert.equal(parsed.oversizedTagCount,0);
assert.equal(parsed.mainCount,0);
assert.equal(parsed.productRootMarkerCounts.goodsDetail,1);
assert.ok(parsed.productRootCandidates>=1);
assert.equal(parsed.h1Count,2);
assert.equal(parsed.variantControlSurfaces.select,1);
assert.equal(parsed.variantControlSurfaces.option,2);
assert.equal(parsed.variantControlSurfaces.radio,1);
assert.equal(parsed.variantControlSurfaces.explicitSelectedOption,1);
assert.equal(parsed.variantControlSurfaces.explicitCheckedRadio,1);
assert.equal(parsed.primaryTitleSurfaces.scopedNameClass,1);
assert.equal(parsed.templateFamily,"UNDETERMINED");
assert.equal(parsed.exactSkuVerified,false);
assert.equal(parsed.marketVerified,false);
assert.equal(parsed.formulationVerified,false);
assert.equal(parsed.subjectCreationAuthorized,false);
assert.equal(parsed.factConfirmationAuthorized,false);
assert.equal(parsed.sourceBindingAuthorized,false);
assert.equal(parsed.dbWrites,0);
assert.equal(parsed.aiApiCalls,0);
assert.deepEqual(parsed,make(sample,{contentType:"text/html; charset=UTF-8"}));
const json=JSON.stringify(parsed);
for(const secret of ["PRIVATE","Primary Product","Customer","TOKEN","related-products","40ml","25ml",
 "options[Size]","selected value","goods_detail","script","다른상품"]){
  assert.ok(!json.includes(secret),"must never retain raw content: "+secret);
}
assert.match(parsed.sourceDigest,/^[a-f0-9]{64}$/);
assert.equal(parsed.htmlBytes,Buffer.byteLength(sample));
const gen=make('<main id="main"><article class="product-detail"><h1>One</h1>'+
   '<form class="product-option"><select><option disabled selected>30ml</option></select>'+
   '</form></article></main>');
assert.equal(gen.mainCount,1);
assert.equal(gen.primaryTitleSurfaces.h1WithinMain,1);
assert.equal(gen.primaryTitleSurfaces.h1WithinMarkedRoot,1);
assert.equal(gen.variantControlSurfaces.disabledSelected,1);
assert.equal(gen.variantControlSurfaces.explicitSelectedOption,0);
const fake=make('<script><main><div class="goods_detail"><h1>BAD</h1></div></main></script>'+
  '<style>.x { content: "<main>" }</style><template><h1>hidden</h1></template>'+
  '<!-- <div class="product-detail"></div> --><main><h1>Good</h1></main>');
assert.equal(fake.mainCount,1);
assert.equal(fake.h1Count,1);
assert.equal(fake.productRootCandidates,0);
const quoted=make('<main class="xx" data-product-id="PRIVATE> SECRET">'+
  '<h1 itemprop="name">X</h1></main>');
assert.equal(quoted.mainCount,1);
assert.equal(quoted.primaryTitleSurfaces.itempropName,1);
assert.equal(quoted.productRootMarkerCounts.productDataAttribute,1);
assert.throws(()=>inspect(Buffer.alloc(0)),/INVALID_BYTES/);
assert.throws(()=>inspect(Buffer.alloc(2*1024*1024+1)),/INVALID_BYTES/);
assert.throws(()=>make("<main></main>",{contentType:"application/json"}),/NON_HTML/);
assert.throws(()=>make("<main></main>",{contentType:"x".repeat(513)}),/BAD_CONTENT_TYPE/);
const malformed=make('<main><div class="broken"');
assert.equal(malformed.scanStatus,"MALFORMED_OR_OVERSIZED_TAG");
const overflow=make("<"+'x'.repeat(2100)+">");
assert.equal(overflow.scanStatus,"COMPLETE_WITH_SKIPPED_OVERSIZED_TAGS");
assert.equal(overflow.countsComplete,false);
assert.equal(overflow.oversizedTagCount,1);
const followed=make('<main><div class="goods_detail" data-secret="'+
  ('DO_NOT_PERSIST_PRIVATE> <h1>spoof</h1> '.repeat(125))+
  '"><h1>REAL</h1><form><select><option selected>40ml</option></select></form></div></main>');
assert.equal(followed.scanStatus,"COMPLETE_WITH_SKIPPED_OVERSIZED_TAGS");
assert.equal(followed.oversizedTagCount,1);
assert.equal(followed.mainCount,1);
assert.equal(followed.h1Count,1);
assert.equal(followed.primaryTitleSurfaces.h1WithinMain,1);
assert.equal(followed.productRootMarkerCounts.goodsDetail,0);
assert.equal(followed.variantControlSurfaces.explicitSelectedOption,1);
assert.ok(!JSON.stringify(followed).includes("DO_NOT_PERSIST_PRIVATE"));
assert.equal(followed.exactSkuVerified,false);
assert.equal(followed.factConfirmationAuthorized,false);
const longOption=make('<main><select><option value="40ml" selected data-json="'+
  'x'.repeat(6000)+'">40ml</option></select></main>');
assert.equal(longOption.scanStatus,"COMPLETE_WITH_SKIPPED_OVERSIZED_TAGS");
assert.equal(longOption.variantControlSurfaces.option,1);
assert.equal(longOption.variantControlSurfaces.explicitSelectedOption,0);
assert.equal(longOption.countsComplete,false);
const tooLong=make('<main><div data-json="'+('a'.repeat(140000))+'"><h1>x</h1></div></main>');
assert.equal(tooLong.scanStatus,"TAG_SCAN_LIMIT_REACHED");
assert.equal(tooLong.countsComplete,false);
assert.equal(tooLong.h1Count,0);
const tooMany=make('<main>'+('<div data-json="'+('x'.repeat(2200))+'"></div>').repeat(129)+'</main>');
assert.equal(tooMany.scanStatus,"OVERSIZED_TAG_COUNT_LIMIT_REACHED");
assert.equal(tooMany.countsComplete,false);
assert.equal(tooMany.oversizedTagCount,129);
const unclosed=make("<script>var secret=true");
assert.equal(unclosed.scanStatus,"MALFORMED_RAW_BLOCK");
const cap=make("<main>"+"<div></div>".repeat(10100)+"</main>");
assert.equal(cap.scanStatus,"TAG_LIMIT_REACHED");
assert.ok(cap.scannedTags<=20000);
const nested=make("<div>".repeat(514)+"<h1>x</h1>");
assert.equal(nested.scanStatus,"NESTING_LIMIT_REACHED");
const code=fs.readFileSync("lib/trust/official-template-shape-p3-v1.mjs","utf8").toLowerCase();
for(const forbidden of [".insert(",".upsert(",".update(",".delete(",".rpc(",
 "openai","gemini","supabase_service_role_key"]){
  assert.ok(!code.includes(forbidden),forbidden);
}
console.log("TRUST_P3_TEMPLATE_SHAPE_READONLY_PASS");
