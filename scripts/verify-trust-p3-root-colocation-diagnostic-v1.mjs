#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {inspectTrustP3TemplateShape as inspect}
  from "../lib/trust/official-template-shape-p3-v1.mjs";
const run=html=>inspect(Buffer.from(html));
const name='<div class="goods_name">PRIVATE_TARGET_NAME</div>';
const options='<form><select class="product-option"><option>25ml</option>'+
  '<option>40ml</option></select></form>';
const wrap=body=>'<div class="goods_detail">'+body+'</div>';
const valid=run(wrap(name+options));
assert.equal(valid.scanStatus,"COMPLETE");
assert.equal(valid.rootColocation.total,1);
assert.equal(valid.rootColocation.withScopedTitle,1);
assert.equal(valid.rootColocation.withVariantControl,1);
assert.equal(valid.rootColocation.withTitleAndVariant,1);
assert.equal(valid.rootColocation.withTitleVariantAndForm,1);
assert.equal(valid.rootColocation.byMarkerFamily.goodsDetail.withTitleAndVariant,1);
assert.equal(valid.rootColocation.validatedPrimaryRoot,false);
assert.equal(valid.exactSkuVerified,false);
assert.equal(valid.factConfirmationAuthorized,false);
assert.equal(valid.subjectCreationAuthorized,false);

const unrelated=run(wrap(name)+wrap(options));
assert.equal(unrelated.rootColocation.withTitleAndVariant,0);
assert.equal(unrelated.rootColocation.withVariantControl,1);
assert.equal(unrelated.rootColocation.withScopedTitle,1);
const twins=run(wrap(name+options)+wrap(name+options));
assert.equal(twins.rootColocation.withTitleAndVariant,2);
assert.equal(twins.rootColocation.validatedPrimaryRoot,false);
const recommendations=run('<main><nav>'+wrap(name+options)+'</nav>'+
  '<div class="related-products">'+wrap(name+options)+'</div>'+
  '<section class="product_detail">'+name+options+'</section></main>');
assert.equal(recommendations.rootColocation.withTitleAndVariant,1);
assert.equal(recommendations.rootColocation.excludedRegionRoots,2);
assert.equal(recommendations.rootColocation.validatedPrimaryRoot,false);
const nested=run(wrap('<div class="item_detail">'+name+options+'</div>'));
assert.equal(nested.rootColocation.withTitleAndVariant,2);
assert.equal(nested.rootColocation.byMarkerFamily.goodsDetail.withTitleAndVariant,1);
assert.equal(nested.rootColocation.byMarkerFamily.itemDetail.withTitleAndVariant,1);
const relatedInRoot=run(wrap('<div class="related-products">'+name+'</div>'+options));
assert.equal(relatedInRoot.rootColocation.withTitleAndVariant,0);
const anchor=run(wrap('<a href="/different"><div class="goods_name">'+
  'PRIVATE_TARGET_NAME</div></a>'+options));
assert.equal(anchor.rootColocation.withTitleAndVariant,0);
const script=run('<script>'+wrap(name+options)+'</script>'+
  '<!-- '+wrap(name+options)+' -->'+wrap(name));
assert.equal(script.rootColocation.withTitleAndVariant,0);
const long=run(wrap('<div data-confidential="'+('SENSITIVE_TAG>'.repeat(1000))+
  '">'+name+options+'</div>'));
assert.equal(long.scanStatus,"COMPLETE_WITH_SKIPPED_OVERSIZED_TAGS");
assert.equal(long.countsComplete,false);
assert.equal(long.rootColocation.validatedPrimaryRoot,false);
const combined=JSON.stringify([valid,unrelated,twins,recommendations,nested,relatedInRoot,anchor,script,long]);
for(const privateValue of ["PRIVATE_TARGET_NAME","SENSITIVE_TAG","goods_detail",
  "related-products","40ml","25ml"]){
 assert.ok(!combined.includes(privateValue),"NO_RAW_SOURCE_VALUE: "+privateValue);
}
assert.ok([valid,twins,relatedInRoot].every(x=>x.dbWrites===0&&x.aiApiCalls===0));
const source=fs.readFileSync("lib/trust/official-template-shape-p3-v1.mjs","utf8").toLowerCase();
for(const s of [".insert(", ".upsert(", ".update(", ".delete(", ".rpc(",
  "supabase_service_role_key","openai","gemini"])assert.ok(!source.includes(s),s);
console.log("TRUST_P3_ROOT_COLOCATION_METADATA_ONLY_PASS");
