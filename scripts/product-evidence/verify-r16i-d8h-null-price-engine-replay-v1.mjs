#!/usr/bin/env node
// R16I D8H A-policy WHAT-IF ONLY, using the real Skin Match engine.
// No Product pricing policy is selected or applied by this test.
// The "after" state is synthetic, read-only, and NOT operationally approved.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("../node-next-alias-loader.mjs", import.meta.url);
globalThis.fetch = async () => {
  throw new Error("R16I_D8H_NULL_PRICE_SHADOW_EXTERNAL_NETWORK_FORBIDDEN");
};
const { buildRecommendationProductFromSource } =
  await import("../../lib/product-source.js");
const { buildSkinMatchDecisionBundle } =
  await import("../../lib/skin-match-decision-engine.js");
const { projectProductWithOfferAuthority } =
  await import("../../lib/product-offer-read-path.js");

const catalog = JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/products-v1.json", "utf8"));
const scenarioSet = JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/user-scenarios-v1.json", "utf8"));
const ID = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const LEGACY_HWAHAE = "https://www.hwahae.co.kr/goods/45194";
assert.equal(catalog.productCount, 164);
assert.equal(catalog.products.length, 164);
assert.equal(scenarioSet.scenarioCount, 12);
assert.equal(scenarioSet.scenarios.length, 12);
const stored = catalog.products.find(p => p.id === ID);
assert(stored);
assert.equal(stored.size_ml, 160);
assert.equal(stored.price_min, 29900);
assert.equal(stored.price_max, 29900);
const before = { ...stored, buy_link: LEGACY_HWAHAE };
const after = {
  ...before, size_ml: 80, price_min: null, price_max: null,
  unit_price_per_10ml: null, buy_link: null
};
for (const field of ["review_signals", "market_signals", "ingredient_signals"]) {
  assert.deepEqual(before[field], after[field], field + " authority unchanged");
}
assert.deepEqual(
  Object.keys(after).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).sort(),
  ["buy_link", "price_max", "price_min", "size_ml", "unit_price_per_10ml"].sort()
);

function project(replacement) {
  const rows = catalog.products.map(row =>
    buildRecommendationProductFromSource(row.id === ID ? replacement : row));
  assert.equal(rows.length, 164);
  assert(rows.every(Boolean));
  return rows;
}
const beforeProducts = project(before);
const afterProducts = project(after);
const changed = afterProducts.find(row => row.id === ID);
assert(changed);
assert.equal(changed.price_min, null);
assert.equal(changed.price_max, null);
assert.equal(changed.buy_link, "");
// This proves a CURRENT null-price visual incompatibility; it is not accepted
// as an approved Product price policy or a passing end-user UI result.
assert.equal(changed.price_range, "$$", "current null price maps to fabricated middle band");
const legacy = beforeProducts.find(row => row.id === ID);
assert.equal(legacy.price_min, 29900);
assert.equal(legacy.price_range, "$$");
for (let i = 0; i < 164; i++) {
  if (beforeProducts[i].id !== ID) {
    assert.deepEqual(beforeProducts[i], afterProducts[i], "other product unchanged");
  }
}
const twoSellerOffers = [
  { product_id: ID, source_name: "official_single", seller_key: "snature",
    listing_url: "https://www.snature.kr/product/detail.html?product_no=151",
    offer_state: "current", market_code: "KR", currency_code: "KRW",
    availability_state: "unknown", product_scope_state: "product_subject_unresolved",
    price_amount: 24500 },
  { product_id: ID, source_name: "hwahae_bundle", seller_key: "hwahae",
    listing_url: LEGACY_HWAHAE, offer_state: "current", market_code: "KR",
    currency_code: "KRW", availability_state: "unknown",
    product_scope_state: "product_subject_unresolved", price_amount: 29900 }
];
const projectedOffer = projectProductWithOfferAuthority(changed, twoSellerOffers);
assert.equal(projectedOffer.price_min, null);
assert.equal(projectedOffer.price_max, null);
assert.equal(projectedOffer.buy_link, "");

function id(item) { return item?.id ?? item?.product?.id ?? null; }
function ids(items) { return (items || []).map(id); }
const counters = {
  scenarios: 0, comparedCandidates: 0, candidateCountDeltas: 0,
  scoreDeltas: 0, rankingDeltas: 0, topPickDeltas: 0,
  topThreeDeltas: 0, budgetAlternativeListDeltas: 0,
  budgetAlternativeTargetAppearancesBefore: 0,
  budgetAlternativeTargetAppearancesAfter: 0,
  targetTopPickScenarios: 0
};
for (const scenario of [...scenarioSet.scenarios].sort((a,b) => a.id.localeCompare(b.id))) {
  const [oldDecision, newDecision] = await Promise.all([
    buildSkinMatchDecisionBundle(scenario.answers, {
      products: beforeProducts, locale: "ko", includeCandidateSourceDiagnostics: true
    }),
    buildSkinMatchDecisionBundle(scenario.answers, {
      products: afterProducts, locale: "ko", includeCandidateSourceDiagnostics: true
    })
  ]);
  counters.scenarios++;
  const oldScored = oldDecision.diagnostics?.candidateSource?.products;
  const newScored = newDecision.diagnostics?.candidateSource?.products;
  assert.equal(oldScored?.length, 164);
  assert.equal(newScored?.length, 164);
  counters.candidateCountDeltas += oldScored.length !== newScored.length ? 1 : 0;
  counters.rankingDeltas += JSON.stringify(ids(oldScored)) !== JSON.stringify(ids(newScored)) ? 1 : 0;
  counters.topPickDeltas += id(oldDecision.topPick) !== id(newDecision.topPick) ? 1 : 0;
  counters.topThreeDeltas += JSON.stringify(ids(oldScored.slice(0,3))) !==
    JSON.stringify(ids(newScored.slice(0,3))) ? 1 : 0;
  counters.targetTopPickScenarios += id(oldDecision.topPick) === ID ? 1 : 0;
  const newScores = new Map(newScored.map(row => [
    row.id, [row.engine_score ?? null, row.score ?? null]
  ]));
  for (const row of oldScored) {
    assert(newScores.has(row.id));
    counters.comparedCandidates++;
    counters.scoreDeltas += JSON.stringify([row.engine_score ?? null, row.score ?? null]) !==
      JSON.stringify(newScores.get(row.id)) ? 1 : 0;
  }
  const oldBudget = oldDecision.premiumReport?.budgetAlternatives || [];
  const newBudget = newDecision.premiumReport?.budgetAlternatives || [];
  counters.budgetAlternativeListDeltas += JSON.stringify(oldBudget) !== JSON.stringify(newBudget) ? 1 : 0;
  counters.budgetAlternativeTargetAppearancesBefore += oldBudget.filter(row => row.id === ID).length;
  counters.budgetAlternativeTargetAppearancesAfter += newBudget.filter(row => row.id === ID).length;
}
assert.equal(counters.comparedCandidates, 1968);
assert.equal(counters.candidateCountDeltas, 0, "NO candidate count drift");
assert.equal(counters.scoreDeltas, 0, "NO score authority drift in null-price shadow");
assert.equal(counters.rankingDeltas, 0, "NO ranking drift in null-price shadow");
assert.equal(counters.topPickDeltas, 0);
assert.equal(counters.topThreeDeltas, 0);
console.log(JSON.stringify({
  status: "PASS_STRUCTURAL_SHADOW_WITH_PRICE_UI_HOLD",
  stage: "R16I_D8H_NULL_PRICE_REAL_ENGINE_REPLAY",
  scope: "FROZEN_164x12_SYNTHETIC_A_OPTION_NOT_APPROVED",
  counters,
  knownBlockers: [
    "UNKNOWN_PRICE_PROJECTED_AS_DOLLAR_DOLLAR",
    "PREMIUM_NULL_NUMERIC_COERCION_NOT_RUNTIME_VERIFIED",
    "CANNOT_EQUATE_CHECKOUT_OBSERVATION_TO_CANONICAL_PRODUCT_PRICE"
  ],
  productWrites: 0, offerWrites: 0, rankingPolicyChanged: false,
  productionPricePolicyApproved: false, releaseAuthorized: false
}));
