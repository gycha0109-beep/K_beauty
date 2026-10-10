#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateOfferCompositionShadow } from "../../lib/product-offer-composition-shadow.js";
import { evaluateR16IR4D2SourceReadiness, R16I_R4_D2_VERSION } from "../../lib/product-offer-r16i-r4-d2-source-readiness.mjs";

const load = p => JSON.parse(fs.readFileSync(p, "utf8"));
const dir = "evidence/product-decision-axis-non-numeric-shadow-v2/";
const pre = load(dir + "barrier-support-p1-r16i-r4-readonly-prestate-20261010.json");
const composition = evaluateOfferCompositionShadow(load(dir + "barrier-support-p1-r16i-r3-offer-composition-shadow-fixture-v1.json"));
const d1 = load(dir + "barrier-support-p1-r16i-r4-d1-indexed-sources-20261010.json");
const fixture = load(dir + "barrier-support-p1-r16i-r4-d2-source-readiness-20261011.json");
const clean = evaluateR16IR4D2SourceReadiness(pre, composition, d1, fixture);

assert.equal(fixture.contract_version,R16I_R4_D2_VERSION);
assert.equal(clean.decision, "REVIEW_REQUIRED");
assert.equal(clean.brand_source_tier,"HISTORICAL_FIRST_PARTY_CACHE_TEXT");
assert.equal(clean.retailer_source_tier,"SEARCH_ENGINE_INDEX_VARIANTS");
assert.equal(clean.brand_single_size_ml,80);
assert.equal(clean.retailer_cream_total_ml,160);
assert.equal(clean.retailer_gift_serum_ml,10);
assert.deepEqual(clean.review_sample_range,{
  min_indexed:43222,max_indexed:43482,sample_count:4,
  dispersion:260,delta_vs_legacy_min:1747,delta_vs_legacy_max:2007,reliable_live_total:false
});
assert.ok(clean.missing_evidence.length >= 9);
assert.equal(Object.isFrozen(clean), true);
assert.equal(Object.isFrozen(clean.review_sample_range), true);
for (const k of ["latest_checkout_price_krw","approved_single_price_krw","approved_bundle_price_krw",
  "current_review_count","approved_review_count","new_offer_id","new_subject_id","approved_after_values",
  "selected_checkout_option_id","operator_approval","raw_source_digest"]) assert.equal(clean[k],null,k);
for (const k of ["production_writes_authorized","source_binding_writes_authorized","offer_writes_authorized",
  "ranking_writes_authorized","price_projection_authorized","review_projection_authorized","release_ready"]) assert.equal(clean[k],false,k);
let blockedCount=0;
function blocked(name, mutate, reason){
  const clone=structuredClone(fixture);mutate(clone);
  const out=evaluateR16IR4D2SourceReadiness(pre,composition,d1,clone);
  assert.equal(out.decision,"BLOCKED",name);
  assert.ok(out.reasons.includes(reason),name+" "+out.reasons.join(","));
  assert.equal(out.release_ready,false,name);
  assert.equal(out.production_writes_authorized,false,name);
  assert.equal(out.approved_after_values,null,name);
  assert.equal(out.review_sample_range,null,name);
  blockedCount++;
}
const authority="INVALID_D2_EVIDENCE_AUTHORITY";
const stale="HISTORICAL_BRAND_TEXT_NOT_TRUSTWORTHY_FOR_SCOPE";
const retailer="RETAILER_OPTION_REVIEW_OR_PRICE_SCOPE_INVALID";
const samples="INDEXED_REVIEW_SAMPLES_TAMPERED_OR_CONFLATED";
const db="D2_PRODUCTION_READBACK_DRIFT_OR_FALSE_LOCK";
blocked("false research date",x=>x.research_date_kr="2026-11-01",authority);
blocked("invalid product id",x=>x.product_id="00000000-0000-4000-8000-000000000099",authority);
blocked("claimed live brand page",x=>x.evidence_constraints.brand_text_is_live=true,authority);
blocked("claimed latest review",x=>x.evidence_constraints.review_count_is_latest_live=true,authority);
blocked("fake transaction lock",x=>x.evidence_constraints.fresh_transactional_lock=true,authority);
blocked("missing denial flag",x=>delete x.evidence_constraints.automatic_field_mutation,authority);
blocked("fake authority",x=>x.authority="LIVE_CHECKOUT",authority);
blocked("DB row already changed",x=>x.production_select.size_ml=80,db);
blocked("DB price shifted",x=>x.production_select.price_min=35000,db);
blocked("DB update revision drifted",x=>x.production_select.product_updated_at="2026-10-11T08:00:00+09:00",db);
blocked("pretend readback lock",x=>x.production_select.write_lock=true,db);
blocked("unexpected Offer created",x=>x.production_select.linked_offers=1,db);
blocked("fake subject count",x=>x.production_select.subjects=1,db);
blocked("brand price moved to bundle",x=>x.brand_page.visible_list_price_krw=29900,stale);
blocked("brand original text omitted",x=>x.brand_page.visible_text_has_checkout_caveat=false,stale);
blocked("fake archived raw text",x=>x.brand_page.raw_html_archived=true,stale);
blocked("fake live brand checkout",x=>x.brand_page.live_checkout_verified=true,stale);
blocked("fake current brand stock",x=>x.brand_page.current_stock_verified=true,stale);
blocked("unverified serum SKU claimed",x=>x.brand_page.gift_serum_10ml_sku_verified=true,stale);
blocked("retailer false 80ml single",x=>x.retailer_page.cream_units=1,retailer);
blocked("retailer false checkout",x=>x.retailer_page.live_checkout_verified=true,retailer);
blocked("retailer actual option forged",x=>x.retailer_page.selected_option_verified=true,retailer);
blocked("retailer gift identification forged",x=>x.retailer_page.gift_serum_sku_verified=true,retailer);
blocked("retailer raw HTML forged",x=>x.retailer_page.raw_html_archived=true,retailer);
blocked("review exact subject conflation",x=>x.retailer_page.review_single_subject_attributed=true,retailer);
blocked("promotion not acknowledged",x=>x.retailer_page.promotional_gift_claims_vary_across_index=false,retailer);
blocked("different count on same URL",x=>x.retailer_page.review_index_samples[2].review_count=44321,samples);
blocked("sample count artificially reduced",x=>x.retailer_page.review_index_samples.pop(),retailer);
blocked("sample source attribution changed",x=>x.retailer_page.review_index_samples[3].url="https://example.invalid",samples);
blocked("sample freshness invented",x=>x.retailer_page.review_index_samples[0].source_freshness_label="CURRENT",samples);
blocked("evidence caveats removed",x=>x.notes=[], "MISSING_EVIDENCE_LIMITATIONS");
const badD1=structuredClone(d1);badD1.current_price_authorized=true;
const first=evaluateR16IR4D2SourceReadiness(pre,composition,badD1,fixture);
assert.equal(first.decision,"BLOCKED");
assert.ok(first.reasons.includes("R4_D1_OR_PRESTATE_INVALID"));
blockedCount++;
const badProduct=structuredClone(pre);badProduct.product.size_ml=80;
const second=evaluateR16IR4D2SourceReadiness(badProduct,composition,d1,fixture);
assert.equal(second.decision,"BLOCKED");blockedCount++;
const moduleText=fs.readFileSync("lib/product-offer-r16i-r4-d2-source-readiness.mjs","utf8");
assert.doesNotMatch(moduleText,/\b(fetch|axios|createClient|postgres)\s*\(/);
assert.doesNotMatch(moduleText,/\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.rpc\s*\(/);
assert.doesNotMatch(moduleText,/process\.env|from\s+["']server-only/);
console.log(JSON.stringify({status:"PASS",stage:"R16I-R4-D2",
  source_readiness:clean.decision,blocked_mutations:blockedCount,
  distinct_review_snapshots:clean.review_sample_range.sample_count,
  review_index_spread:clean.review_sample_range.dispersion,
  origin_current_checkout_confirmed:false,production_writes:0
}));
