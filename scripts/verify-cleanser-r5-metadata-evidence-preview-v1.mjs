#!/usr/bin/env node
/**
 * Offline R5 evidence-only preview: same ten frozen product identities and
 * source aggregate shape. Synthetic mapped tags, NOT actual review labels.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {register} from "node:module";
import {assessCleanserR5MetadataEvidencePreviewV1 as preview}
  from "../lib/trust/cleanser-r5-metadata-evidence-preview-v1.mjs";
register("./node-next-alias-loader.mjs",import.meta.url);
globalThis.fetch=async()=>{throw new Error("R5_METADATA_PREVIEW_CI_NETWORK_FORBIDDEN")};
const {buildRecommendationProductFromSource:normalize}=
  await import("../lib/product-source.js");
const read=async path=>JSON.parse(await readFile(path,"utf8"));
const [coverage,axes]=await Promise.all([
  read("evidence/trust/cleanser-r5-real-input-coverage-20261024-v1.json"),
  read("evidence/trust/cleanser-r5-existing-source-axis-footprint-20261024-v1.json")
]);
assert.equal(coverage.records.length,10);
assert.equal(axes.records.length,10);
const axisById=new Map(axes.records.map(x=>[x.product_id,x]));
const fixture=coverage.records.map(row=>{
  const source=axisById.get(row.product_id);
  assert.ok(source);
  const captured=source.capture_url_same_string;
  const path="https://example.invalid/readonly/"+row.product_id;
  const mappedPositive=Array.from({length:source.mapped_positive_count},(_,i)=>({
    mapped:[i===0?"dehydration":"fresh"],count:1
  }));
  const mappedNegative=Array.from({length:source.mapped_negative_count},()=>({
    mapped:["drying"],count:1
  }));
  return {
    id:row.product_id,brand:row.brand,name:row.product_name,category:row.category,
    product_form:row.product_form,...row.recorded_features,
    price_min:row.price_min,price_max:row.price_max,is_mens:row.is_mens,
    recommendation_tier:row.recommendation_tier,
    hwahae_url:captured?path:null,
    review_signals:captured?{
      source:"hwahae_ai_review",positive:mappedPositive,negative:mappedNegative
    }:null,
    market_signals:captured?{
      source:"hwahae_visible_page",review_count:source.market_total_review_count,
      hwahae_review_page:path
    }:null,
    ingredient_signals:captured?{source:"hwahae_visible_page"}:null
  };
});
const normalized=fixture.map(normalize);
assert.ok(normalized.every(x=>x?.category==="cleanser"));
const evaluate=(rawProducts=fixture,normalizedProducts=normalized)=>
  preview({rawProducts,normalizedProducts});
const result=evaluate();
assert.equal(result.product_count,10);
assert.equal(result.hwahae_captured,7);
assert.equal(result.mapped_review_top_three_products,6);
assert.equal(result.low_review_count_cautions,1);
assert.equal(result.canonical_fields_missing,60);
assert.equal(result.legacy_fallback_slots,60);
assert.equal(result.canonical_field_values_proposed,0);
assert.equal(result.canonical_field_values_written,0);
assert.equal(result.product_facts_confirmed,0);
assert.equal(result.g2_grants,0);
assert.equal(result.production_writes,0);
assert.equal(result.source_review_labels_exported,false);
assert.equal(result.source_urls_exported,false);
assert.ok(result.products.every(p=>p.canonical_fields_missing===6&&
  p.direct_product_metadata_writes===0&&!p.approved_recommendation&&
  Object.values(p.fields).every(f=>f.canonical_value===null&&
  !f.write_authorized&&!f.product_fact_authorized)));
assert.ok(result.products.every(p=>p.fields.sensitivity_safe.status==="UNKNOWN"));
const unread=result.products.find(x=>x.product_id.startsWith("4d5b22c7"));
assert.ok(unread.capture_exists&&!unread.mapped_review_top_three&&unread.low_review_count_caution);
assert.equal(unread.fields.sensitivity_safe.canonical_value,null);
const noCapture=result.products.find(x=>x.product_id.startsWith("e3ebe3ff"));
assert.ok(!noCapture.capture_exists);
assert.equal(noCapture.fields.skin_types.status,"UNKNOWN");
assert.equal(result.products.find(p=>p.product_id.startsWith("63a958c4"))
  .fields.irritation_risk.status,"NEGATIVE_REVIEW_CAUTION_ONLY");
assert.ok(!JSON.stringify(result).includes("https://"));
const invalid=[
  raw=>{raw[0].skin_types=["dry"];},
  (raw,scored)=>{scored[0].irritation_risk="low";},
  raw=>{raw[0].market_signals.hwahae_review_page="https://wrong.invalid";},
  raw=>{raw[0].review_signals.positive[0].mapped=[2];},
  raw=>{raw[0].id=raw[1].id;},
  raw=>{raw[0].category="serum";},
  raw=>{raw[0].review_signals.source="unknown";},
  raw=>{raw[0].market_signals.review_count="-1";},
  raw=>{raw.pop();}
];
for(const alter of invalid){
  const raw=structuredClone(fixture),scored=structuredClone(normalized);
  alter(raw,scored);
  assert.throws(()=>evaluate(raw,scored),TypeError);
}
console.log("R5 metadata evidence preview: PASS exact 10, stored 7, mapped 6, "+
  "low-review 1, fallback slots 60, safe UNKNOWN/Facts/G2/writes=0");
