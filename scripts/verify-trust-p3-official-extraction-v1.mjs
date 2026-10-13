#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractTrustP3OfficialProductCandidates as extract } from "../lib/trust/official-product-extraction-p3-v1.mjs";

const product={id:"31015762-2741-4211-a553-3ceb7fdf32e8",
  name:"다이브인 저분자 히알루론산 선크림",size_ml:50};
const sourceUrl="https://www.torriden.com/goods/goods_view.php?goodsNo=999";
const run=(html,options={})=>extract(Buffer.from(html),product,{
  sourceUrl,sourceKind:"official_product_page",robotsAllowed:true,...options});
const wrap=(inside,title="다이브인 저분자 히알루론산 선크림 50ml")=>
  '<title>'+title+'</title><main><h1>'+title+'</h1>'+
  '<section data-product-specs>'+inside+'</section></main>';
const positive=run(wrap(
  "<p>SPF50+ PA++++ / 유기자차</p><p>전성분: 정제수, 글리세린, 부틸렌글라이콜, 에탄올</p>"));
assert.equal(positive.gate,"EVIDENCE_CANDIDATE_ONLY");
assert.equal(positive.findings.spf.value,"SPF50+");
assert.equal(positive.findings.pa.value,"PA++++");
assert.equal(positive.findings.uvFilterType.value,"organic");
assert.deepEqual(positive.findings.inci.value,
  ["정제수","글리세린","부틸렌글라이콜","에탄올"]);
assert.equal(positive.factConfirmationAuthorized,false);
assert.equal(positive.subjectCreationAuthorized,false);
assert.equal(positive.dbWrites,0);
assert.equal(positive.aiApiCalls,0);
const sizeMismatch=run(wrap("SPF50+ PA++++ / 무기자차",
  "다이브인 저분자 히알루론산 선크림 70ml"));
assert.equal(sizeMismatch.gate,"VARIANT_REVIEW_REQUIRED");
assert.equal(sizeMismatch.findings.spf.value,null);
const policy=run(wrap("SPF50+ PA++++"),{robotsAllowed:false});
assert.equal(policy.gate,"SOURCE_POLICY_HOLD");
assert.equal(policy.findings.pa.value,null);
const nonOfficial=run(wrap("SPF50+ PA++++"),{sourceKind:"hwahae"});
assert.equal(nonOfficial.gate,"SOURCE_POLICY_HOLD");
const bodyOnly=run('<title>관련 상품</title><main><p>다이브인 저분자 히알루론산 선크림 50ml</p>'+
  '<section data-product-specs>SPF50+ PA++++</section></main>');
assert.equal(bodyOnly.gate,"IDENTITY_REVIEW_REQUIRED");
const promotional=run(wrap("<p>좋은 자외선차단제</p>"));
assert.equal(promotional.findings.spf.value,null);
assert.equal(promotional.findings.uvFilterType.value,null);
const inciNotUv=run(wrap("<p>전성분: 징크옥사이드, 정제수, 글리세린</p>"));
assert.equal(inciNotUv.findings.uvFilterType.value,null);
assert.equal(inciNotUv.inference.ingredientDerivedUvFilterType,null);
const negated=run(wrap("<p>SPF50+ 아닙니다 PA++++</p>"));
assert.equal(negated.findings.spf.value,null);
const conflict=run(wrap("<p>유기자차 혼합자차</p>"));
assert.equal(conflict.findings.uvFilterType.state,"CONFLICT_REVIEW_REQUIRED");
const related=run('<title>다이브인 저분자 히알루론산 선크림 50ml</title><main>'+
  '<h1>다이브인 저분자 히알루론산 선크림 50ml</h1>'+
  '<p>추천 상품: SPF50+ PA++++</p></main>');
assert.equal(related.findings.spf.value,null);
assert.equal(related.findings.pa.value,null);
const src=fs.readFileSync("lib/trust/official-product-extraction-p3-v1.mjs","utf8");
for(const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(", "openai", "gemini"]){
  assert.ok(!src.toLowerCase().includes(forbidden.toLowerCase()),forbidden);
}
console.log("TRUST_P3_OFFICIAL_DETERMINISTIC_EXTRACTION_PASS");
