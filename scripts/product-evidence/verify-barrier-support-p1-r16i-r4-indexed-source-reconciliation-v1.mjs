#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateOfferCompositionShadow } from "../../lib/product-offer-composition-shadow.js";
import { evaluateR16IR4IndexedSourceReconciliation, R16I_R4_D1_VERSION } from "../../lib/product-offer-r16i-r4-indexed-source-reconciliation.mjs";
const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const snapshot = read("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r4-readonly-prestate-20261010.json");
const bundle = read("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r3-offer-composition-shadow-fixture-v1.json");
const fixture = read("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r4-d1-indexed-sources-20261010.json");
const composition = evaluateOfferCompositionShadow(bundle);
const observed = evaluateR16IR4IndexedSourceReconciliation(snapshot, composition, fixture);
assert.equal(fixture.contract_version, R16I_R4_D1_VERSION);
assert.equal(observed.decision, "REVIEW_REQUIRED");
assert.equal(observed.source_authority, "SEARCH_INDEX_DISPLAY_ONLY");
assert.equal(observed.indexed_brand_single_list_price_krw, 35000);
assert.equal(observed.indexed_brand_single_member_price_krw, 24500);
assert.equal(observed.indexed_retail_bundle_display_price_krw, 29900);
assert.equal(observed.indexed_retail_review_count, 43482);
assert.equal(observed.catalog_legacy_review_count, 41475);
assert.equal(observed.indexed_review_count_delta, 2007);
assert.equal(observed.single_list_price_per_10ml_display_only, 4375);
assert.equal(observed.single_member_price_per_10ml_display_only, 3062.5);
assert.equal(observed.bundle_price_per_10ml_display_only, 1868.75);
for (const field of [
  "checkout_price_krw", "approved_catalog_price_krw",
  "approved_catalog_volume_ml", "review_signal_projection", "approved_offer_id", "subject_id"
]) assert.equal(observed[field], null, field);
for (const field of [
  "production_writes_authorized", "ranking_writes_authorized",
  "auto_price_projection_authorized", "auto_review_projection_authorized",
  "operator_approved", "checkout_verified", "evidence_is_raw_html"
]) assert.equal(observed[field], false, field);

let rejected = 0;
function blocked(name, mutate, reason) {
  const idx = structuredClone(fixture);
  mutate(idx);
  const r = evaluateR16IR4IndexedSourceReconciliation(snapshot, composition, idx);
  assert.equal(r.decision, "BLOCKED", name);
  assert.ok(r.reasons.includes(reason), name);
  assert.equal(r.auto_price_projection_authorized, false, name);
  assert.equal(r.auto_review_projection_authorized, false, name);
  assert.equal(r.production_writes_authorized, false, name);
  assert.equal(r.checkout_price_krw, null, name);
  rejected++;
}
const authority = "INVALID_SEARCH_INDEX_AUTHORITY_CONTRACT";
const source = "PRESENTATION_SOURCE_OR_INDEXED_VALUES_MISMATCH";
const citing = "UNSCOPED_INDEX_CITATIONS_OR_CAVEATS";
blocked("pretend checkout verified", x=>x.actual_checkout_verified=true, authority);
blocked("pretend price current", x=>x.current_price_authorized=true, authority);
blocked("pretend raw source archived", x=>x.raw_html_captured=true, authority);
blocked("pretend review attribution resolved", x=>x.review_subject_attribution_verified=true, authority);
blocked("inject approval token", x=>x.approval_payload="signed", authority);
blocked("pretend source is checkout", x=>x.observation_channel="DIRECT_CHECKOUT", authority);
blocked("change research date", x=>x.research_date_kr="2026-10-11", authority);
blocked("replace brand SKU with kit", x=>x.official_single.product_no="45194", source);
blocked("blend brand price and kit price", x=>x.official_single.catalog_list_price_krw=29900, source);
blocked("affiliate URL into brand", x=>x.official_single.canonical_url="https://www.hwahae.co.kr/goods/45194", source);
blocked("retail kit 80ml single", x=>x.retailer_bundle.cream_quantity=1, source);
blocked("incorrect serum volume", x=>x.retailer_bundle.gift_serum_ml=20, source);
blocked("retail display price changed", x=>x.retailer_bundle.indexed_listing_price_krw=34500, source);
blocked("cached review count changed", x=>x.retailer_bundle.indexed_review_count=41475, source);
blocked("index transformed into live price", x=>x.retailer_bundle.selected_checkout_option_verified=true, source);
blocked("review assigned to single formula", x=>x.retailer_bundle.review_single_product_attribution_verified=true, source);
blocked("multiple offer choices hidden", x=>x.retailer_bundle.multiple_sale_options_observed=false, source);
blocked("wrong retailer listing", x=>x.retailer_bundle.listing_id="45195", source);
blocked("fabricated source citation", x=>x.citations[0].url="https://example.invalid", citing);
blocked("hide source caveats", x=>x.caveats=[], citing);
const shifted = structuredClone(snapshot);
shifted.product.market_signals.review_count = 43000;
const changedBaseline = evaluateR16IR4IndexedSourceReconciliation(shifted, composition, fixture);
assert.equal(changedBaseline.decision, "BLOCKED");
assert.ok(changedBaseline.reasons.includes("PRESTATE_OR_BUNDLE_SHADOW_INVALID"));
rejected++;
assert.equal(evaluateR16IR4IndexedSourceReconciliation(snapshot, null, fixture).decision,"BLOCKED");
rejected++;
const moduleText = fs.readFileSync("lib/product-offer-r16i-r4-indexed-source-reconciliation.mjs", "utf8");
assert.doesNotMatch(moduleText, /\b(fetch|axios|createClient|postgres)\s*\(/);
assert.doesNotMatch(moduleText, /\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.rpc\s*\(/);
assert.doesNotMatch(moduleText, /process\.env|from\s+["']server-only/);
console.log(JSON.stringify({
  status:"PASS",stage:"R16I-R4-D1",
  indexed_retail_count:observed.indexed_retail_review_count,
  legacy_count:observed.catalog_legacy_review_count,
  review_count_delta:observed.indexed_review_count_delta,
  distinct_presentation_price_scope:true,
  source_authority:observed.source_authority,
  blocked_cases:rejected,
  production_writes:0
}));
