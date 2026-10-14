#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {inspectTrustP3StrictPrimaryRoot as inspect}
  from "../lib/trust/official-primary-root-dom-p3-v1.mjs";
const p={id:"dd326b18-ea56-45fb-8571-42186b6c9159",
 name:"더마 UV365 레드 카밍 톤업 선스크린",
 name_en:"DERMA UV365 Red Calming Tone-up Sunscreen",size_ml:40};
const title='<h1>'+p.name_en+'</h1>';
const form='<form id="product-form"><select name="size">'+
  '<option value="40ml" selected>40ml</option><option value="25ml">25ml</option>'+
  '</select></form>';
const wrap=s=>'<html><body>'+s+'</body></html>';
const product=s=>'<section class="product-detail">'+s+'</section>';
const go=s=>inspect(Buffer.from(s),p);
const success=go(wrap(product('<div class="product-name">'+title+'</div>'+form)));
assert.equal(success.status,"SCOPED_NAME_AND_FORM_CANDIDATE");
assert.equal(success.parseComplete,true);
assert.equal(success.rootScopedNameCandidate,true);
assert.equal(success.matchedRoots,1);
assert.equal(success.matchedTitles,1);
assert.equal(success.ownedFormCount,1);
assert.equal(success.ownedOptionControlCount,1);
assert.equal(success.exactSkuVerified,false);
assert.equal(success.explicitlySelectedSizeVerified,false);
assert.equal(success.primaryRootAuthority,false);
assert.equal(success.subjectCreationAuthorized,false);
assert.equal(success.factConfirmationAuthorized,false);
assert.equal(success.sourceBindingAuthorized,false);
assert.equal(success.dbWrites,0);
assert.equal(success.aiApiCalls,0);
const cases=[
 ["form owned by unrelated root",wrap(product(title)+product(form)),"OWNER_FORM_UNPROVEN"],
 ["related product form",wrap(product(title)+'<aside>'+form+'</aside>'),"OWNER_FORM_UNPROVEN"],
 ["recommendation form within parent",wrap(product(title+'<div class="related-products">'+form+'</div>')),"OWNER_FORM_UNPROVEN"],
 ["other independent matched root",wrap(product(title+form)+product(title+form)),"PRIMARY_ROOT_AMBIGUOUS"],
 ["OG title only",wrap('<meta property="og:title" content="'+p.name_en+'">'+product(form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["JSON-LD only",wrap('<script type="application/ld+json">{"name":"'+p.name_en+'","size":"40ml"}</script>'+product(form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["title in anchor",wrap(product('<a href="/cross-sell">'+title+'</a>'+form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["nested form outside inner title root",wrap(product('<div class="item-detail">'+title+'</div>'+form)),"OWNER_FORM_UNPROVEN"],
 ["option without form",wrap(product(title+'<select><option selected>40ml</option></select>')),"OWNER_FORM_UNPROVEN"],
 ["sibling title in unmarked area",wrap(product(form)+'<h1>'+p.name_en+'</h1>'),"PRIMARY_ROOT_NOT_PROVEN"],
 ["source different name",wrap(product('<h1>Other official product</h1>'+form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["disabled selected still not authorized",wrap(product(title+'<form><select name="size"><option disabled selected>40ml</option></select></form>')),"SCOPED_NAME_AND_FORM_CANDIDATE"],
 ["malformed nested",wrap(product(title+'<div>'+form+'</section>')),"UNBALANCED_HTML"],
 ["unclosed tag",wrap('<div>'+product(title+form)),"UNBALANCED_HTML"],
 ["cross-sell embedded title",wrap(product('<div class="related-products">'+title+'</div>'+form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["only 1 main with title and form",wrap('<main>'+title+form+'</main>'),"SCOPED_NAME_AND_FORM_CANDIDATE"],
 ["two mains unmarked",wrap('<main>'+title+form+'</main><main>'+title+form+'</main>'),"PRIMARY_ROOT_NOT_PROVEN"],
 ["script injection fake html",wrap('<script>'+product(title+form)+'</script>'+product(form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["quote HTML spoof",wrap(product('<div data-test="'+title.replaceAll('"',"&quot;")+'">'+form+'</div>')),"PRIMARY_ROOT_NOT_PROVEN"],
 ["selfclosing bracketed void",wrap(product(title+'<input name="x" value=">" />'+form)),"SCOPED_NAME_AND_FORM_CANDIDATE"],
];
for(const [name,html,status] of cases){
 const r=go(html);
 assert.equal(r.status,status,name);
 assert.equal(r.exactSkuVerified,false,name);
 assert.equal(r.factConfirmationAuthorized,false,name);
 assert.equal(r.subjectCreationAuthorized,false,name);
 assert.equal(r.dbWrites,0,name);
 assert.equal(r.aiApiCalls,0,name);
}
const nested=go(wrap(product('<div class="item-detail">'+title+form+'</div>')));
assert.equal(nested.status,"SCOPED_NAME_AND_FORM_CANDIDATE");
assert.equal(nested.matchedRoots,1);
const hugeAttr=go(wrap(product('<div data-blob="'+('PRIVATE_VALUE<>'.repeat(500))+'"></div>'+title+form)));
assert.equal(hugeAttr.status,"OVERSIZED_TAG_STRUCTURE_UNCERTAIN");
assert.equal(hugeAttr.parseComplete,false);
assert.equal(hugeAttr.rootScopedNameCandidate,undefined);
const large=go(wrap(product('<div data-blob="'+('x'.repeat(650000))+'"></div>'+title+form)));
assert.equal(large.status,"TAG_SCAN_LIMIT");
const badAttr=go(wrap(product('<div class="product-name" class="another">'+title+'</div>'+form)));
assert.equal(badAttr.status,"AMBIGUOUS_ATTRIBUTES");
assert.throws(()=>go(""),/INVALID_INPUT/);
assert.throws(()=>inspect(Buffer.alloc(2*1024*1024+1),p),/INVALID_INPUT/);
assert.throws(()=>inspect(Buffer.from(wrap(product(title+form))),{...p,id:"invalid"}),/INVALID_INPUT/);
const many=go(wrap(product(title+form).repeat(130)));
assert.equal(many.status,"AMBIGUOUS_OR_EXCESSIVE_PRODUCT_NODES");
assert.equal(many.primaryRootAuthority,false);
const serialized=JSON.stringify(success);
for(const secret of [p.name_en,"product-detail","product-name","product-form","40ml","25ml"])
 assert.ok(!serialized.includes(secret),secret);
assert.deepEqual(success,go(wrap(product('<div class="product-name">'+title+'</div>'+form))));
const src=fs.readFileSync("lib/trust/official-primary-root-dom-p3-v1.mjs","utf8").toLowerCase();
for(const forbidden of [".insert(", ".upsert(", ".update(", ".delete(", ".rpc(",
  "supabase_service_role_key","openai","gemini"]){
  assert.ok(!src.includes(forbidden),"FORBIDDEN_SIDE_EFFECT "+forbidden);
}
console.log("TRUST_P3_STRICT_DOM_PRIMARY_ROOT_HOLD_POLICY_PASS");
