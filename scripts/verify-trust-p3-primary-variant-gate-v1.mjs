#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {inspectTrustP3PrimaryProductVariant as inspect}
  from "../lib/trust/official-product-primary-variant-p3-v1.mjs";
import {extractTrustP3OfficialProductCandidates as extract}
  from "../lib/trust/official-product-extraction-p3-v1.mjs";

const product={id:"dd326b18-ea56-45fb-8571-42186b6c9159",brand:"에스트라",
 name:"더마 UV365 레드 카밍 톤업 선스크린",
 name_en:"DERMA UV365 Red Calming Tone-up Sunscreen",size_ml:40};
const sizeVariants=(a='<option value="40 ml" selected>40ml</option><option value="25 ml">25ml</option>')=>
  '<select name="options[Size]" class="product__variants">'+a+'</select>';
const title='<h1>'+product.name_en+'</h1>';
const main=(heading=title,options=sizeVariants())=>
  '<title>Aestura official product</title><main id="MainContent">'+heading+
  '<form class="product-form">'+options+'</form>'+
  '<section data-product-specs>SPF50+ PA++++</section></main>';
const candidate=html=>extract(Buffer.from(html),product,{
  sourceUrl:"https://int.aestura.com/products/derma-uv365-red-calming-tone-up-sunscreen",
  robotsAllowed:true,sourceKind:"official_product_page",
});
const p=inspect(Buffer.from(main()),product);
assert.equal(p.primaryTitleNameCandidate,true);
assert.equal(p.status,"SELECTED_SIZE_MATCH_CANDIDATE");
assert.deepEqual(p.selectedSizesMl,[40]);
assert.deepEqual(p.optionSizesMl,[40,25]);
assert.equal(p.variantCandidate,true);
assert.equal(p.exactSkuVerified,false);
assert.equal(p.factConfirmationAuthorized,false);
const positive=candidate(main());
assert.equal(positive.gate,"EVIDENCE_CANDIDATE_ONLY");
assert.equal(positive.variantStatus,"SELECTED_SIZE_MATCH_CANDIDATE");
assert.equal(positive.identitySignal,"SCOPED_SELECTED_VARIANT_CANDIDATE");
assert.equal(positive.findings.spf.value,"SPF50+");
assert.equal(positive.subjectCreationAuthorized,false);
assert.equal(positive.factConfirmationAuthorized,false);
assert.equal(positive.marketVerified,false);
assert.equal(positive.formulationVerified,false);
assert.equal(positive.dbWrites,0);
assert.equal(positive.aiApiCalls,0);

const cases=[
 ["unselected 40ml listing",main(title,'<select name="Size"><option>40ml</option><option>25ml</option></select>'),"VARIANT_REVIEW_REQUIRED"],
 ["wrong variant chosen",main(title,sizeVariants('<option value="40ml">40ml</option><option value="25ml" selected>25ml</option>')),"VARIANT_REVIEW_REQUIRED"],
 ["no variant selector",main(title,'<p>40ml and 25ml available</p>'),"VARIANT_REVIEW_REQUIRED"],
 ["only body name",main('<h1>Related products</h1><p>'+product.name_en+'</p>'),"IDENTITY_REVIEW_REQUIRED"],
 ["related product link",main('<h1>Other Product</h1><a>'+product.name_en+'</a>'),"IDENTITY_REVIEW_REQUIRED"],
 ["unrelated primary title",main('<h1>Other Product 40ml</h1>'),"IDENTITY_REVIEW_REQUIRED"],
 ["no main product scope",'<title>official</title><aside>'+title+sizeVariants()+'</aside>',"IDENTITY_REVIEW_REQUIRED"],
 ["OG title only",'<meta property="og:title" content="'+product.name_en+' 40ml">'+
    '<main><h1>Other</h1>'+sizeVariants()+'</main>',"IDENTITY_REVIEW_REQUIRED"],
 ["duplicate heading",main(title+title),"IDENTITY_REVIEW_REQUIRED"],
 ["two different selected options",main(title,sizeVariants(
   '<option selected>40ml</option><option selected>25ml</option>')),"VARIANT_REVIEW_REQUIRED"],
 ["bundled title",main(title).replace("<title>Aestura official product</title>",
   "<title>Aestura 40ml x2 pack</title>"),"VARIANT_REVIEW_REQUIRED"],
 ["explicit title size conflict",main(title).replace("<title>Aestura official product</title>",
   "<title>"+product.name_en+" 25ml</title>"),"VARIANT_REVIEW_REQUIRED"],
 ["unrelated checked radio",main(title,'<input type="radio" name="color" value="40ml" checked>'),"VARIANT_REVIEW_REQUIRED"],
 ["script-selected option",main(title,'<script>const selected="40ml"</script>'+
   '<select name="size"><option>40ml</option><option>25ml</option></select>'),"VARIANT_REVIEW_REQUIRED"],
 ["disabled selected",main(title,sizeVariants('<option value="40ml" selected disabled>40ml</option>')),
   "VARIANT_REVIEW_REQUIRED"],
];
for(const [label,html,gate] of cases){
 const got=candidate(html);
 assert.equal(got.gate,gate,label);
 assert.equal(got.findings.spf.value,null,label);
 assert.equal(got.factConfirmationAuthorized,false,label);
}
const checked=main(title,'<input type="radio" name="options[Size]" value="40ml" checked>'+
  '<input type="radio" name="options[Size]" value="25ml">');
assert.equal(candidate(checked).gate,"EVIDENCE_CANDIDATE_ONLY");
assert.equal(candidate(main()).primaryVariantProbe.hasMainContent,true);
assert.equal(candidate(main()).primaryVariantProbe.optionSizesMl.length,2);
assert.equal(candidate(main()).primaryVariantProbe.exactSkuVerified,false);
assert.equal(candidate(main()).subjectCreationAuthorized,false);
assert.equal(candidate(main()).factConfirmationAuthorized,false);
assert.equal(candidate(main()).authority,"PROPOSALS_ONLY_NO_FACT_OR_SUBJECT_CONFIRMATION");
assert.equal(candidate(main()).sourceUrl?.startsWith("https://int.aestura.com/"),true);
assert.equal(extract(Buffer.from(main()),product,{
  sourceUrl:"https://int.aestura.com/products/x",robotsAllowed:false,
  sourceKind:"official_product_page"}).gate,"SOURCE_POLICY_HOLD");
const baseline=JSON.parse(fs.readFileSync(
 "evidence/trust/p3-official-locator-live-verified-20261013.json","utf8"));
assert.equal(baseline.summary.directProductCandidates,0);
for(const path of ["lib/trust/official-product-primary-variant-p3-v1.mjs",
  "lib/trust/official-product-extraction-p3-v1.mjs"]){
 const src=fs.readFileSync(path,"utf8").toLowerCase();
 for(const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(",
    "supabase_service_role_key","openai","gemini"])assert.ok(!src.includes(forbidden),path+":"+forbidden);
}
console.log("TRUST_P3_SELECTED_VARIANT_TEMPLATE_NEGATIVES_PASS");
