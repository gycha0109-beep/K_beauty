#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sha256Hex } from "../../lib/trust/official-source-fetch.mjs";
import { R16H_FIXED_TARGETS,extractOfficialKrBijaPanel,captureR16H } from "./capture-barrier-support-p1-r16h-innisfree-kr-comparison-v1.mjs";

assert.deepEqual(R16H_FIXED_TARGETS.map(x=>x.sku),["34622","34623"]);
const list=["정제수","프로판다이올","글리세린","사이클로펜타실록세인","스쿠알란","사이클로헥사실록세인",
"세테아릴알코올","판테놀","1,2-헥산다이올","C12-16알코올","폴리솔베이트60","다이아이소스테아릴말레이트",
"하이드록시에틸아크릴레이트/소듐아크릴로일다이메틸타우레이트코폴리머","팔미틱애씨드","아크릴레이트/C10-30알킬아크릴레이트크로스폴리머",
"하이드로제네이티드레시틴","트로메타민","세테아릴글루코사이드","비자나무씨오일(1,000ppm)","다이소듐이디티에이",
"솔비탄아이소스테아레이트","마데카소사이드","아시아티코사이드","마데카식애씨드","아시아틱애씨드","글루코오스"];
assert.equal(list.length,26);
const makeHtml=(size,names=list)=>'<html><head><title>비자 시카 밤 EX '+(size===70?'[대용량]':'')+'('+size+'mL) | 이니스프리</title></head><body><script type="application/json">["90090","화장품법에 따라 기재 표시하여야하는 모든 성분  ",'+JSON.stringify(names.join(", "))+']</script></body></html>';
for(const size of [40,70]){
 const p=extractOfficialKrBijaPanel(makeHtml(size),size);
 assert.equal(p.exact_product_title_and_volume,true);
 assert.equal(p.unique_official_panel_count,1);
 assert.equal(p.ingredient_count,26);
 assert.deepEqual(p.ingredients,list);
 assert.equal(p.ingredient_panel_observed,true);
 assert.equal(p.formula_generation_or_lot_confirmed,false);
 assert.equal(p.ingredient_panel_text_sha256,sha256Hex(Buffer.from(list.join(", "),"utf8")));
}
assert.equal(extractOfficialKrBijaPanel(makeHtml(70),40).ingredient_panel_observed,false);
assert.equal(extractOfficialKrBijaPanel(makeHtml(40).replace("화장품법에 따라 기재 표시하여야하는 모든 성분","다른 속성"),40).ingredient_panel_observed,false);
const dir=await fs.mkdtemp(path.join(os.tmpdir(),"r16h-"));
try{
 const normal=await captureR16H({outputDir:path.join(dir,"normal"),clock:()=> "2026-10-09T18:00:00Z",
  context:{exact_checkout_sha:"a".repeat(40)},
  fetchBytes:async url=>{
   const t=R16H_FIXED_TARGETS.find(x=>x.url===url);
   assert.ok(t);
   return {bytes:Buffer.from(makeHtml(t.size_ml)),finalUrl:url,contentType:"text/html; charset=UTF-8"};
  }});
 assert.deepEqual(normal.summary,{attempted:2,raw_sources_captured:2,ordered_lists_verified:2,
   formula_revision_confirmed:0,subjects_registered:0,production_writes:0});
 assert.equal(normal.comparison.identical_ordered_ingredient_name_list,true);
 assert.equal(normal.comparison.outcome,"SAME_ORDERED_FIRST_PARTY_KR_INCI_OBSERVED_FORMULA_REVISION_STILL_HOLD");
 assert.equal(normal.comparison.same_formula_established,false);
 assert.equal(normal.comparison.semantic_key_materialized,false);
 for(const row of normal.targets){
  const bytes=await fs.readFile(path.join(dir,"normal",row.artifact_file));
  assert.equal(row.raw_sha256,sha256Hex(bytes));
  assert.equal(row.panel.ingredient_count,26);
 }
 assert.equal(normal.registration_authorized,false);
 assert.equal(normal.formula_revision_key,null);
 assert.equal(normal.subject_semantic_key,null);
 const changed=await captureR16H({outputDir:path.join(dir,"different"),fetchBytes:async url=>{
   const t=R16H_FIXED_TARGETS.find(x=>x.url===url);
   return {bytes:Buffer.from(makeHtml(t.size_ml,t.size_ml===70?["진짜 다른 전성분",...list]:list)),
     finalUrl:url,contentType:"text/html"};
 }});
 assert.equal(changed.comparison.identical_ordered_ingredient_name_list,false);
 assert.equal(changed.comparison.same_formula_established,false);
 const blocked=await captureR16H({outputDir:path.join(dir,"blocked"),fetchBytes:async url=>{
   const t=R16H_FIXED_TARGETS.find(x=>x.url===url);
   if(t.size_ml===70)throw Error("SOURCE_BLOCKED:http_403");
   return {bytes:Buffer.from(makeHtml(t.size_ml)),finalUrl:url,contentType:"text/html"};
 }});
 assert.equal(blocked.summary.raw_sources_captured,1);
 assert.equal(blocked.comparison.identical_ordered_ingredient_name_list,null);
 assert.equal(blocked.targets[1].raw_sha256,null);
 assert.equal(blocked.targets[1].failure_code,"SOURCE_BLOCKED:http_403");
 const hostile=await captureR16H({outputDir:path.join(dir,"redirect"),fetchBytes:async url=>{
   const t=R16H_FIXED_TARGETS.find(x=>x.url===url);
   return {bytes:Buffer.from(makeHtml(t.size_ml)),finalUrl:"https://evil.invalid/dp/product/"+t.sku,contentType:"text/html"};
 }});
 assert.equal(hostile.summary.raw_sources_captured,0);
 assert.ok(hostile.targets.every(x=>x.failure_code==="SOURCE_BLOCKED:official_sku_host_or_path_mismatch"));
 const scope=await fs.readFile("docs/architecture/product-fact-subject-formulation-scope-v1.md","utf8");
 assert.ok(scope.includes("Commercial presentation"));
 // The browser and runner have not yet acquired a live 70ml KR response.
 // This is an offline source-verification guard, not hosted ingredient evidence.
 const self=await fs.readFile("scripts/product-evidence/capture-barrier-support-p1-r16h-innisfree-kr-comparison-v1.mjs","utf8");
 for(const token of ["SUPABASE_SERVICE_ROLE_KEY",".rpc(", ".insert(", ".upsert("])assert.ok(!self.includes(token));
 const research=JSON.parse(await fs.readFile("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16h-web-first-source-conflict-v1.json","utf8"));
 assert.equal(research.terminal,"R16H_WEB_FIRST_FORMULATION_EQUIVALENCE_UNPROVEN_SOURCE_CONFLICT_HOLD2");
 assert.equal(research.innisfree.kr_70.raw_ing_count,null);
 assert.equal(research.innisfree.kr_70.actual_html_captured,false);
 assert.equal(research.innisfree.my_70.title_volume,"70ml");
 assert.equal(research.innisfree.my_70.spec_table_volume,"40 mL");
 assert.equal(research.innisfree.my_70.seed_oil_name,"Birch Seed Oil");
 assert.equal(research.innisfree.au_40.seed_oil_name,"Torreya Nucifera Seed Oil");
 assert.equal(research.innisfree.exact_kr_40_70_ingredient_equality,"NOT_EVALUABLE_KR_70_PANEL_NOT_CAPTURED");
 assert.equal(research.snature.official_80.total_ingredients,25);
 assert.equal(research.snature.official_80.first_ingredient,"정제수");
 assert.equal(research.snature.merchant_90_water_first.first_ingredient,"정제수");
 assert.ok(research.snature.merchant_90_blue_agave_first.first_ingredient.startsWith("블루아가베잎추출물"));
 assert.equal(research.snature.exact_80_90_formula_equivalence,"NOT_PROVEN");
 assert.equal(research.summary.revision_keys,0);
 assert.equal(research.summary.semantic_keys,0);
 assert.equal(research.summary.production_writes,0);
 assert.equal(research.summary.non_numeric_pda_cases,1968);
 const report=await fs.readFile("docs/evidence/v21-8h-r16h-web-first-ingredient-source-conflict-v1.md","utf8");
 for(const text of ["Birch Seed Oil","Torreya Nucifera Seed Oil","500,000ppm","R16H_R2_CAPTURE_KR_70ML_AND_RECOVER_OFFICIAL_90ML_PANEL"])assert.ok(report.includes(text));
 console.log(JSON.stringify({status:"PASS",stage:"R16H",offline_fixture_lists:26,exact_sku_guards:true,
  list_equal_and_difference_guard:true,blocked_fetch_and_redirect_guard:true,
  authoritative_formula_revision_established:false,production_writes:0}));
}finally{await fs.rm(dir,{recursive:true,force:true});}
