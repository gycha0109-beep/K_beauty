#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fetchOfficialBytes, sha256Hex } from "../../lib/trust/official-source-fetch.mjs";
import { decodeOfficialHtml } from "./capture-barrier-support-p1-r16d-official-sources-v1.mjs";

export const R16H_CONTRACT = "v21-8h-r16h-p1-innisfree-kr-40-70-first-party-ingredient-observation-v1";
export const R16H_FIXED_TARGETS = Object.freeze([
  Object.freeze({ id:"innisfree_bija_ex_40ml",product_id:"b72b0570-ee3f-4692-b45f-633b46ae3b64",sku:"34622",size_ml:40,
    url:"https://m.innisfree.com/kr/ko/dp/product/34622?inmPrdCatCd=UA",file:"innisfree_bija_ex_40ml.html" }),
  Object.freeze({ id:"innisfree_bija_ex_70ml",product_id:null,sku:"34623",size_ml:70,
    url:"https://m.innisfree.com/kr/ko/dp/product/34623",file:"innisfree_bija_ex_70ml.html" }),
]);
function compact(s){return String(s || "").normalize("NFKC").replace(/\s+/g,"").toLowerCase();}
export function extractOfficialKrBijaPanel(html,expectedSize) {
  const title = /<title\b[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || "";
  const titleMatch = compact(title).includes(compact("비자 시카 밤 EX")) &&
    new RegExp(String(expectedSize)+"(?:ml|mℓ|밀리리터)","i").test(compact(title));
  const source = /"화장품법에 따라 기재 표시하여야하는 모든 성분\s*"\s*,\s*("(?:\\.|[^"\\])*")/g;
  const labels = [];
  for (const match of html.matchAll(source)) {
    try {
      const value=JSON.parse(match[1]).trim();
      if(value)labels.push(value);
    }catch{}
  }
  const unique=[...new Set(labels)];
  const panel = unique.length===1 ? unique[0] : null;
  const ingredients = panel ? panel.split(/,\s+/).map(x=>x.trim()).filter(Boolean) : [];
  const valid = Boolean(titleMatch && panel && ingredients.length>=20 && ingredients.length<=100);
  return {
    title_excerpt:title.slice(0,180),expected_size_ml:expectedSize,
    exact_product_title_and_volume:titleMatch,unique_official_panel_count:unique.length,
    ingredient_panel_observed:valid,ingredient_count:valid?ingredients.length:0,
    ingredient_panel_text_sha256:valid?sha256Hex(Buffer.from(panel,"utf8")):null,
    ingredients:valid?ingredients:[],
    panel_text:valid?panel:null,
    formula_generation_or_lot_confirmed:false,
  };
}
function failCode(err){
  const message=String(err?.message||err||"");
  return /^(SOURCE_BLOCKED|TRANSIENT_FAILURE):/.test(message)?message.slice(0,160):"TRANSIENT_FAILURE:fetch_or_decode_error";
}
export async function captureR16H({outputDir,fetchBytes=fetchOfficialBytes,clock=()=>new Date().toISOString(),context={}}={}) {
  assert.ok(typeof outputDir==="string" && outputDir.length>0);
  await fs.mkdir(outputDir,{recursive:true});
  const manifest={
    contract:R16H_CONTRACT,observed_at:clock(),
    execution:{exact_checkout_sha:String(context.exact_checkout_sha||""),run_id:String(context.run_id||""),run_attempt:String(context.run_attempt||"")},
    source_kind:"READ_ONLY_FIRST_PARTY_KR_COMMERCE_HTML",
    first_party_ingredient_lists_do_not_establish_formula_revision:true,
    first_party_foreign_market_ingredients_not_automatic_kr_identity:true,
    formula_revision_key:null,subject_semantic_key:null,registration_authorized:false,production_writes:0,
    targets:[],
  };
  for(const t of R16H_FIXED_TARGETS){
    const row={id:t.id,source_url:t.url,product_id:t.product_id,official_product_id:t.sku,
      expected_size_ml:t.size_ml,source_captured:false,bytes_length:null,raw_sha256:null,artifact_file:null,
      panel:null,decision:"CAPTURE_BLOCKED"};
    try{
      const res=await fetchBytes(t.url);
      const url=new URL(res.finalUrl);
      if(url.protocol!=="https:" || !["m.innisfree.com","www.innisfree.com","innisfree.com"].includes(url.hostname.toLowerCase()) ||
          !url.pathname.includes("/dp/product/"+t.sku))throw Error("SOURCE_BLOCKED:official_sku_host_or_path_mismatch");
      if(!Buffer.isBuffer(res.bytes)|| !String(res.contentType).toLowerCase().includes("html"))throw Error("SOURCE_BLOCKED:invalid_html_bytes");
      const panel=extractOfficialKrBijaPanel(decodeOfficialHtml(res.bytes,res.contentType),t.size_ml);
      await fs.writeFile(path.join(outputDir,t.file),res.bytes);
      Object.assign(row,{source_captured:true,bytes_length:res.bytes.length,raw_sha256:sha256Hex(res.bytes),
        artifact_file:t.file,content_type:res.contentType,final_url:res.finalUrl,panel,
        decision:panel.ingredient_panel_observed?"EXACT_KR_OFFICIAL_INCI_OBSERVED":"KR_SOURCE_CAPTURED_PANEL_OR_SIZE_GAP"});
    }catch(err){row.failure_code=failCode(err);}
    manifest.targets.push(row);
  }
  const [a,b]=manifest.targets;
  const both=Boolean(a.panel?.ingredient_panel_observed&&b.panel?.ingredient_panel_observed);
  const fullSame=both && a.panel.ingredients.length===b.panel.ingredients.length &&
    a.panel.ingredients.every((s,i)=>compact(s)===compact(b.panel.ingredients[i]));
  manifest.comparison={
    both_exact_kr_panels_captured:both,identical_ordered_ingredient_name_list:both?fullSame:null,
    left_ingredient_count:a.panel?.ingredient_count||0,right_ingredient_count:b.panel?.ingredient_count||0,
    same_formula_established:false,formula_revision_date_established:false,lot_bound_identity_established:false,
    semantic_key_materialized:false,
    outcome:!both?"INSUFFICIENT_OFFICIAL_KR_PANEL_FOR_COMPARISON":fullSame?
      "SAME_ORDERED_FIRST_PARTY_KR_INCI_OBSERVED_FORMULA_REVISION_STILL_HOLD":
      "DIFFERENT_FIRST_PARTY_KR_INCI_OBSERVED_FORMULA_REVISION_STILL_HOLD",
  };
  manifest.summary={attempted:2,raw_sources_captured:manifest.targets.filter(t=>t.source_captured).length,
    ordered_lists_verified:manifest.targets.filter(t=>t.panel?.ingredient_panel_observed).length,
    formula_revision_confirmed:0,subjects_registered:0,production_writes:0};
  await fs.writeFile(path.join(outputDir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4||process.argv[2]!=="--output-dir")throw Error("Usage: --output-dir <dir>");
  captureR16H({outputDir:process.argv[3],context:{exact_checkout_sha:process.env.R16H_EXACT_CHECKOUT_SHA,
    run_id:process.env.GITHUB_RUN_ID,run_attempt:process.env.GITHUB_RUN_ATTEMPT}})
    .then(result=>console.log(JSON.stringify({summary:result.summary,comparison:result.comparison,
      targets:result.targets.map(x=>({id:x.id,decision:x.decision,raw_sha256:x.raw_sha256,ingredient_count:x.panel?.ingredient_count||0}))})))
    .catch(err=>{console.error(err);process.exitCode=1;});
}
