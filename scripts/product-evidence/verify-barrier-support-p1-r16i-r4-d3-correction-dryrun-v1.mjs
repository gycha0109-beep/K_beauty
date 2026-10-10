#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateOfferCompositionShadow } from "../../lib/product-offer-composition-shadow.js";
import { simulateR16IR4D3Correction, R16I_R4_D3_VERSION } from "../../lib/product-offer-r16i-r4-d3-correction-dryrun.mjs";

const dir="evidence/product-decision-axis-non-numeric-shadow-v2/";
const read=x=>JSON.parse(fs.readFileSync(dir+x,"utf8"));
const snapshot=read("barrier-support-p1-r16i-r4-readonly-prestate-20261010.json");
const composition=evaluateOfferCompositionShadow(read("barrier-support-p1-r16i-r3-offer-composition-shadow-fixture-v1.json"));
const d1=read("barrier-support-p1-r16i-r4-d1-indexed-sources-20261010.json");
const d2=read("barrier-support-p1-r16i-r4-d2-source-readiness-20261011.json");
const fixture=read("barrier-support-p1-r16i-r4-d3-dryrun-input-20261011.json");
const run=(state=fixture,previous=d2,old=snapshot)=>
  simulateR16IR4D3Correction(old,composition,d1,previous,state);
const got=run();
assert.equal(fixture.contract_version,R16I_R4_D3_VERSION);
assert.equal(got.decision,"REVIEW_REQUIRED");
assert.equal(got.option_comparisons.length,3);
assert.equal(Object.isFrozen(got),true);
assert.equal(got.writes.length,0);
for(const field of ["approved_field_changes","selected_operator_option",
  "new_offer_id","new_subject_id","executable_sql","rollback_sql","optimistic_lock",
  "transaction_id","price_projection","review_projection","selected_checkout_option_id"]) {
  assert.equal(got[field],null,field);
}
for(const field of ["production_writes_authorized","offer_writes_authorized",
  "subject_writes_authorized","source_binding_writes_authorized",
  "ranking_writes_authorized","release_ready"]) assert.equal(got[field],false,field);
const [a,b,c]=got.option_comparisons;
assert.equal(a.option,"A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION");
assert.equal(a.product_before.id,snapshot.product.id);
assert.deepEqual(a.product_after_preview,a.product_before);
assert.equal(a.product_before.size_ml,160);
assert.equal(a.product_before.price_min,29900);
assert.equal(a.product_before.unit_price_per_10ml,1868.75);
assert.equal(a.physical_presentation_preview.brand_single_cream_ml,80);
assert.equal(a.physical_presentation_preview.retailer_cream_total_ml,160);
assert.equal(a.physical_presentation_preview.serum_gift_separate_ml,10);
assert.equal(a.physical_presentation_preview.formulation_identity,null);
assert.equal(a.offer_preview.product_id,a.product_before.id);
assert.equal(a.offer_preview.listing_id,"45194");
assert.equal(a.offer_preview.price_amount,null);
assert.equal(a.offer_preview.availability_state,"unknown");
assert.equal(a.offer_preview.product_scope_state,"product_subject_unresolved");
assert.equal(a.offer_preview.approved_for_insert,false);
assert.equal(a.catalog_correction_complete,false);
assert.equal(a.actual_offer_insert_approved,false);
assert.equal(a.approved_review_count,null);
assert.equal(b.option,"B_SINGLE_PRESENTATION_CATALOG_CORRECTION");
assert.equal(b.hypothetical_wrong_unit_price_if_kit_price_reused,3737.5);
assert.equal(b.hypothetical_wrong_price_is_authoritative,false);
assert.equal(b.approved_unit_price_per_10ml,null);
assert.equal(c.status,"HOLD_MIXED_PRODUCT_AND_OFFER_IDENTITY");
assert.equal(c.approved_new_subject_id,null);
let rejected=0;
function blocked(label,mutate,reason){
  const doc=structuredClone(fixture);mutate(doc);
  const o=run(doc);
  assert.equal(o.decision,"BLOCKED",label);
  assert.ok(o.reasons.includes(reason),label);
  assert.equal(o.writes.length,0,label);
  assert.equal(o.option_comparisons,null,label);
  assert.equal(o.approved_field_changes,null,label);
  assert.equal(o.release_ready,false,label);
  rejected++;
}
const authority="D3_EVIDENCE_OR_AUTHORITY_CONTRACT_INVALID";
const prod="TARGET_PRODUCT_READBACK_OR_COLLISION_DRIFT";
const seller="RETAILER_OPTION_OR_SEARCH_INDEX_AUTHORITY_INVALID";
const brand="BRAND_SINGLE_PRESENTATION_AUTHORITY_INVALID";
blocked("fake operator decision",x=>x.authority.operator_field_level_approval=true,authority);
blocked("fake production authorization",x=>x.authority.production_mutation_allowed=true,authority);
blocked("fake checkout",x=>x.authority.actual_checkout_captured=true,authority);
blocked("fake transaction lock",x=>x.authority.transactional_concurrency_guard=true,authority);
blocked("fake rollback proof",x=>x.authority.rollback_proven=true,authority);
blocked("fake recommendation release",x=>x.authority.recommendation_release_approved=true,authority);
blocked("missing security denial",x=>delete x.authority.production_mutation_allowed,authority);
blocked("extra approval payload",x=>x.operator_approval="signed",authority);
blocked("incorrect product",x=>x.product_id="00000000-0000-4000-8000-000000000099",authority);
blocked("fake checkout schema",x=>x.verified_schema.nullable_price_amount=false,authority);
blocked("incorrect schema uniqueness",x=>x.verified_schema.unique_seller_listing_id=false,authority);
blocked("freshness claim on source",x=>x.source_kind="LIVE_CHECKOUT",authority);
blocked("unsupported study date",x=>x.observed_at_kr="2026-10-01T06:04:51+09:00",authority);
blocked("product revision drift",x=>x.product_revision="2026-10-11T06:00:00+09:00",authority);
blocked("product volume now single",x=>x.production_readback.size_ml=80,prod);
blocked("catalog price overwritten",x=>x.production_readback.price_min=35000,prod);
blocked("unit price wrong",x=>x.production_readback.unit_price_per_10ml=3737.5,prod);
blocked("legacy buy link changed",x=>x.production_readback.buy_link="https://example.invalid",prod);
blocked("unexpected offer collision",x=>x.production_readback.in_scope_offer_count=1,prod);
blocked("new subject already created",x=>x.production_readback.in_scope_subject_count=1,prod);
blocked("source binding gone",x=>x.production_readback.in_scope_binding_count=0,prod);
blocked("fake SQL lock",x=>x.production_readback.transaction_lock=true,prod);
blocked("review overwritten",x=>x.production_readback.review_count=43612,prod);
blocked("wrong seller listing",x=>x.seller_source.listing_id="45195",seller);
blocked("wrong seller url",x=>x.seller_source.listing_url="https://example.invalid/goods/45194",seller);
blocked("wrong seller scope",x=>x.seller_source.indexed_cream_quantity=1,seller);
blocked("serum included as 80ml",x=>x.seller_source.indexed_serum_gift_ml=80,seller);
blocked("index upgraded to live",x=>x.seller_source.newly_discovered_search_result.source_kind="ACTUAL_CHECKOUT",seller);
blocked("cached count presented as altered",x=>x.seller_source.newly_discovered_search_result.review_count=50000,seller);
blocked("seller option forged",x=>x.seller_source.live_option_selection_verified=true,seller);
blocked("seller checkout forged",x=>x.seller_source.checkout_price_verified=true,seller);
blocked("retailer sku forged",x=>x.seller_source.component_sku_verified=true,seller);
blocked("review attribution forged",x=>x.seller_source.review_subject_attribution_verified=true,seller);
blocked("brand volume wrong",x=>x.brand_source.indexed_single_ml=160,brand);
blocked("brand single price replaced by kit",x=>x.brand_source.indexed_list_price_krw=29900,brand);
blocked("brand checkout forged",x=>x.brand_source.live_checkout_verified=true,brand);
blocked("brand cache denied",x=>x.brand_source.source_kind="CHECKOUT",brand);
const upstream=structuredClone(d2);upstream.production_select.price_min=100;
const badUpstream=run(fixture,upstream);
assert.equal(badUpstream.decision,"BLOCKED");
assert.deepEqual(badUpstream.reasons,["UPSTREAM_R4_A_D2_PRESTATE_INVALID"]);
assert.equal(badUpstream.writes.length,0);rejected++;
const drift=structuredClone(snapshot);drift.product.updated_at="2026-10-11T06:00:00+09:00";
const drifted=run(fixture,d2,drift);
assert.equal(drifted.decision,"BLOCKED");rejected++;
const source=fs.readFileSync("lib/product-offer-r16i-r4-d3-correction-dryrun.mjs","utf8");
assert.doesNotMatch(source,/\b(fetch|axios|createClient|postgres)\s*\(/);
assert.doesNotMatch(source,/\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.rpc\s*\(/);
assert.doesNotMatch(source,/process\.env|from\s+["']server-only/);
console.log(JSON.stringify({
  status:"PASS",stage:"R16I-R4-D3",option_count:got.option_comparisons.length,
  negative_cases_blocked:rejected,option_a_product_id_preserved:true,
  offer_price_preview:null,seller_option_verified:false,
  production_writes:got.writes.length,review_count_auto_projection:false
}));
