#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  PRESENTATION_OFFER_SHADOW_VERSION,
  PresentationOfferContractError,
  classifyPresentationOfferShadowV1 as classify
} from "../lib/catalog-presentation-offer-shadow-v1.mjs";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const SERUM = "22222222-2222-4222-8222-222222222222";
const product = { id: PRODUCT, normalized_brand: "lagom", normalized_name: "cleanser" };
const observed = "2026-10-23T00:00:00+09:00";
const ml = (amount, revision = "pack-1") => ({amount,unit:"ml",packaging:"tube",packaging_revision:revision});
const g = amount => ({amount,unit:"g",packaging:"jar",packaging_revision:"pack-1"});
const primary = (unit, quantity = 1) => ({role:"PRIMARY",product_id:PRODUCT,sku:"sku-primary",
  unit,quantity,evidence_refs:["official:sample"]});
const extra = (unit, quantity = 1) => ({role:"ADDITIONAL_SAME_PRODUCT",product_id:PRODUCT,
  sku:"sku-primary",unit,quantity,evidence_refs:["official:sample"]});
const gift = (unit, id = SERUM) => ({role:"GIFT",product_id:id,sku:"gift-10",unit,quantity:1,
  evidence_refs:["retailer:sample"]});
const listing = (id = "A", url = "https://shop.example/items/A") =>
  ({seller_key:"example", listing_id:id,listing_url:url,observed_at:observed,price_amount:20000,currency_code:"KRW"});
const read = (components, custom = {}) =>
  classify({product,listing:listing(),components,...custom});
const noWrite = x => {
  assert.equal(x.version,PRESENTATION_OFFER_SHADOW_VERSION);
  assert.equal(x.catalog_product_id,PRODUCT);
  assert.equal(x.formulation_identity,"FORMULA_UNRESOLVED");
  assert.equal(x.subject_id,null);
  assert.equal(x.comparable_unit_price,null);
  for(const k of ["catalog_product_creation_authorized","offer_write_authorized",
    "subject_write_authorized","fact_reuse_authorized","recommendation_change_authorized"])
    assert.equal(x[k],false,k);
};

// 120 vs 150 and 170 vs 220 preserve the same Product while each physical unit stays separate.
for(const [before,after] of [[120,150],[170,220]]) {
  const a=read([primary(ml(before))]), b=read([primary(ml(after))]);
  assert.equal(a.catalog_product_id,b.catalog_product_id);
  assert.notEqual(a.components[0].presentation_key,b.components[0].presentation_key);
  assert.equal(a.formulation_identity,"FORMULA_UNRESOLVED");
  noWrite(a);noWrite(b);
}
const mass=read([primary(g(130))]);
const volume=read([primary(ml(130))]);
assert.notEqual(mass.components[0].presentation_key,volume.components[0].presentation_key);
assert.equal(mass.components[0].unit.unit,"g");
assert.equal(volume.components[0].unit.unit,"ml");
// One 150ml physical tube x2: never infer one 300ml tube.
const twin=read([primary(ml(150),2)]);
assert.equal(twin.components[0].unit.amount,150);
assert.equal(twin.components[0].quantity,2);
assert.notEqual(twin.components[0].presentation_key,read([primary(ml(300))]).components[0].presentation_key);
// 1+1 remains two physical components without product insertion.
const bogo=read([primary(ml(150)),extra(ml(150))]);
assert.equal(bogo.components.length,2);
assert.equal(bogo.components[0].presentation_key,bogo.components[1].presentation_key);
noWrite(bogo);
// Gift and primary formula scopes remain distinct.
const withSerum=read([primary(ml(150)),gift(ml(10))]);
assert.notEqual(withSerum.components[0].presentation_key,withSerum.components[1].presentation_key);
assert.equal(withSerum.components.find(c=>c.role==="GIFT").product_id,SERUM);
noWrite(withSerum);
// A set with another product may share the primary Product but not its physical key.
const mixed=read([primary(ml(150)),{...gift(ml(50)),role:"OTHER_PRODUCT"}]);
assert.equal(mixed.catalog_product_id,PRODUCT);
assert.notEqual(mixed.components[0].presentation_key,mixed.components[1].presentation_key);
// Packaging revision distinct even when capacity is unchanged; do not invent formula continuity.
const redesigned=read([primary(ml(150,"pack-2"))]);
assert.notEqual(redesigned.components[0].presentation_key,read([primary(ml(150,"pack-1"))]).components[0].presentation_key);
assert.equal(redesigned.formulation_identity,"FORMULA_UNRESOLVED");
// Listing identity remains stable while composition/price/time observations are separately fingerprinted.
const old=read([primary(ml(150))]);
const changed=read([primary(ml(150)),gift(ml(10))]);
assert.equal(old.offer_key,changed.offer_key);
assert.notEqual(old.observation_key,changed.observation_key);
const repriced=classify({product,components:[primary(ml(150))],listing:{...listing(),price_amount:17000}});
assert.equal(old.offer_key,repriced.offer_key);
assert.notEqual(old.observation_key,repriced.observation_key);
// Stable seller listing ID persists across URL changes; changed IDs never silently alias even on redirect.
const moved=classify({product,components:[primary(ml(150))],
  listing:listing("A","https://shop.example/new/A"),
  prior_listing:{seller_key:"example",listing_id:"A",listing_url:"https://shop.example/items/A"}});
assert.equal(moved.offer_key,old.offer_key);
const differentId=classify({product,components:[primary(ml(150))],
  listing:listing("B","https://shop.example/new/A"),
  prior_listing:{seller_key:"example",listing_id:"A",listing_url:"https://shop.example/items/A"}});
assert.notEqual(differentId.offer_key,old.offer_key);
assert.ok(differentId.reasons.includes("LISTING_ID_CHANGED_REVIEW_REQUIRED"));
const urlOnlyA=classify({product,components:[primary(ml(150))],
  listing:listing(null,"https://shop.example/items/A")});
const urlOnlyMoved=classify({product,components:[primary(ml(150))],
  listing:listing(null,"https://shop.example/redirect/A"),
  prior_listing:{seller_key:"example",listing_id:null,listing_url:"https://shop.example/items/A"}});
assert.notEqual(urlOnlyA.offer_key,urlOnlyMoved.offer_key);
assert.ok(urlOnlyMoved.reasons.includes("URL_CHANGE_WITHOUT_STABLE_SKU_REVIEW_REQUIRED"));
// Unverified promo or gift identity must hold and must never contaminate the primary Product.
const unknownGift=read([primary(ml(150)),{role:"UNKNOWN",product_id:null,sku:null,unit:null,
  quantity:1,evidence_refs:[]}]);
assert.equal(unknownGift.classification,"REVIEW_REQUIRED");
assert.ok(unknownGift.reasons.includes("COMPONENT_IDENTITY_UNRESOLVED"));
assert.ok(unknownGift.reasons.includes("COMPONENT_EVIDENCE_REQUIRED"));
const unresolvedSerum=read([primary(ml(150)),gift(ml(10),null)]);
assert.equal(unresolvedSerum.classification,"REVIEW_REQUIRED");
assert.ok(unresolvedSerum.reasons.includes("SECONDARY_PRODUCT_UNRESOLVED"));
assert.equal(unresolvedSerum.components.find(c=>c.role==="GIFT").presentation_key,null);
// Sheets vs millilitres and refills never silently collapse to a volume.
const pads=read([primary({amount:60,unit:"매",packaging:"pad_pack",packaging_revision:"v1"})]);
assert.equal(pads.components[0].unit.unit,"sheet");
assert.notEqual(pads.components[0].presentation_key,volume.components[0].presentation_key);
const refill=read([primary({...ml(150),packaging:"refill"})]);
assert.notEqual(refill.components[0].presentation_key,old.components[0].presentation_key);
// Input ordering or duplicated evidence references cannot perturb fingerprints.
const reordered=read([gift(ml(10)),primary(ml(150))]);
assert.equal(reordered.observation_key,withSerum.observation_key);
assert.deepEqual(read([primary(ml(150),1)]),read([primary(ml(150),1)]));
assert.equal(read([primary(ml(150,null))]).classification,"REVIEW_REQUIRED");
// Bad data must fail closed instead of making a guessed presentation or price.
for (const entry of [
  [[],undefined], [[{...primary(ml(150)),quantity:0}],undefined],
  [[{...primary(ml(150)),unit:ml(0)}],undefined],
  [[primary(ml(150)),primary(ml(150))],undefined],
  [[{...primary(ml(150)),product_id:SERUM}],undefined],
  [[primary(ml(150))],{listing:{...listing(),listing_url:"javascript:alert(1)"}}],
  [[primary(ml(150))],{listing:{...listing(),price_amount:-1}}],
]) {
  assert.throws(()=>read(entry[0],entry[1]||{}),PresentationOfferContractError);
}
console.log("Catalog presentation / offer R1-C1 shadow: PASS (offline, zero writes)");
