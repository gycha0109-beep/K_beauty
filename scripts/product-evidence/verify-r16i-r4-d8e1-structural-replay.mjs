#!/usr/bin/env node
// D8E1: true existing Skin Match runtime, frozen 164-product fixture x 12 scenarios.
// This is a non-commercial *structural isolation* replay. No checkout-price facts
// are invented: historical price is held fixed solely to isolate size/link effects.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("../node-next-alias-loader.mjs", import.meta.url);

globalThis.fetch = async () => {
  throw new Error("R16I_D8E1_EXTERNAL_NETWORK_FORBIDDEN");
};

const {
  buildRecommendationProductFromSource
} = await import("../../lib/product-source.js");
const { buildSkinMatchDecisionBundle } = await import("../../lib/skin-match-decision-engine.js");
const {
  projectProductWithOfferAuthority
} = await import("../../lib/product-offer-read-path.js");
const {
  resolveProductPurchaseLink,
  projectProductPurchaseLink
} = await import("../../lib/product-purchase-link.js");

const fixture = JSON.parse(readFileSync("fixtures/recommendation-metadata/products-v1.json", "utf8"));
const scenarioFixture = JSON.parse(readFileSync("fixtures/recommendation-metadata/user-scenarios-v1.json", "utf8"));
const PRODUCT_ID = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const OFFICIAL_URL = "https://www.snature.kr/product/detail.html?product_no=151";
const HWAHAE_URL = "https://www.hwahae.co.kr/goods/45194";
assert.equal(fixture.productCount, 164, "frozen 164 catalog");
assert.equal(fixture.products.length, 164, "frozen exact 164 rows");
assert.equal(scenarioFixture.scenarioCount, 12, "12 real engine scenario inputs");
assert.equal(scenarioFixture.scenarios.length, 12);
const uniqueIds = new Set(fixture.products.map((p) => p.id));
assert.equal(uniqueIds.size, 164, "unique catalog rows");
const historicalTarget = fixture.products.find((p) => p.id === PRODUCT_ID);
assert(historicalTarget, "target product must exist in frozen catalog");
// The 2026-08-04 fixture did not carry buy_link; the link below is the
// independently observed 2026-10-13 read-only catalog value (same fixed ID).
assert.equal(Object.hasOwn(historicalTarget, "buy_link"), false);
const original = { ...historicalTarget, buy_link: HWAHAE_URL };
assert.equal(original.size_ml, 160);
assert.equal(original.price_min, 29900);
assert.equal(original.price_max, 29900);
assert.equal(original.unit_price_per_10ml, 1868.75);

// Only structural projection: unchanged *historic* price prevents unsupported
// claims about the current official 80ml checkout price or ranking authority.
const structural = {
  ...original,
  size_ml: 80,
  unit_price_per_10ml: null,
  buy_link: OFFICIAL_URL
};
assert.deepEqual(structural.review_signals, original.review_signals, "review population unchanged");
assert.deepEqual(structural.market_signals, original.market_signals, "market signals unchanged");
assert.deepEqual(structural.ingredient_signals, original.ingredient_signals, "ingredients unchanged");
assert.equal(structural.price_min, original.price_min, "price held unchanged ONLY for isolation");
assert.equal(structural.price_max, original.price_max);
const changedRawKeys = Object.keys(structural).filter((k) =>
  JSON.stringify(structural[k]) !== JSON.stringify(original[k])
).sort();
assert.deepEqual(changedRawKeys, ["buy_link", "size_ml", "unit_price_per_10ml"]);

function buildProducts(replacement) {
  const rows = fixture.products.map((product) =>
    buildRecommendationProductFromSource(product.id === PRODUCT_ID ? replacement : product)
  );
  assert.equal(rows.length, 164);
  assert(rows.every(Boolean), "frozen products remain admitted in source projection");
  return rows;
}
const beforeProducts = buildProducts(original);
const structuralProducts = buildProducts(structural);
const actualOriginal = beforeProducts.find((p) => p.id === PRODUCT_ID);
const actualStructural = structuralProducts.find((p) => p.id === PRODUCT_ID);
assert(actualOriginal && actualStructural);
assert.equal(actualOriginal.buy_link, HWAHAE_URL, "historical Hwahae direct link is admitted");
assert.equal(actualStructural.buy_link, "", "unregistered official single link is not admitted");
assert.equal(actualOriginal.price_min, 29900);
assert.equal(actualStructural.price_min, 29900);
assert.deepEqual(actualOriginal.market_signals, actualStructural.market_signals);
assert.deepEqual(actualOriginal.review_signals, actualStructural.review_signals);

const syntheticHwahaeOffer = Object.freeze({
  product_id: PRODUCT_ID,
  seller_key: "hwahae",
  seller_name: "화해",
  source_name: "hwahae",
  listing_id: "45194",
  listing_url: HWAHAE_URL,
  price_amount: null, // NO real checkout observation: never inject a number.
  currency_code: "KRW",
  market_code: "KR",
  availability_state: "unknown",
  offer_state: "current",
  product_scope_state: "product_subject_unresolved",
  link_health_state: "unchecked"
});
const blockedOffer = projectProductWithOfferAuthority({
  ...actualStructural,
  buy_link: OFFICIAL_URL
}, [syntheticHwahaeOffer]);
assert.equal(blockedOffer.buy_link, "", "untrusted Hwahae Offer must not gain link authority");
assert.equal(blockedOffer.price_min, actualStructural.price_min, "untrusted Offer price cannot override Product");
assert.equal(blockedOffer.price_max, actualStructural.price_max);
const officialLink = resolveProductPurchaseLink({
  buyLink: OFFICIAL_URL, brand: original.brand, name: original.name
});
assert.equal(officialLink.kind, "fallback", "S Nature official link currently lacks registered source");
const fallback = projectProductPurchaseLink(blockedOffer);
assert.equal(new URL(fallback.buy_link).hostname, "search.shopping.naver.com");
const maliciousOffer = projectProductWithOfferAuthority(actualStructural, [
  { ...syntheticHwahaeOffer, listing_url: "https://hwahae.co.kr.evil.test/goods/45194" }
]);
assert.equal(maliciousOffer.buy_link, "", "hostname spoofing cannot create a direct link");
assert.equal(maliciousOffer.price_min, actualStructural.price_min);

function scoreVector(decision) {
  const products = decision?.diagnostics?.candidateSource?.products;
  assert.equal(products?.length, 164, "actual scoring runtime enumerated full fixture");
  return products.map((p) => [p.id, p.engine_score ?? null, p.score ?? null]);
}
function id(value) {
  return value?.id ?? value?.product?.id ?? null;
}
let evaluatedProductScenarios = 0;
let scoreChanges = 0;
let rankChanges = 0;
let top1Changes = 0;
let top3Changes = 0;
let candidateCountChanges = 0;
const categoryCounts = new Map();

for (const scenario of [...scenarioFixture.scenarios].sort((a, b) => a.id.localeCompare(b.id))) {
  const [before, after] = await Promise.all([
    buildSkinMatchDecisionBundle(scenario.answers, {
      products: beforeProducts,
      includeCandidateSourceDiagnostics: true,
      locale: "ko"
    }),
    buildSkinMatchDecisionBundle(scenario.answers, {
      products: structuralProducts,
      includeCandidateSourceDiagnostics: true,
      locale: "ko"
    })
  ]);
  const oldScores = scoreVector(before);
  const newScores = scoreVector(after);
  const oldIds = oldScores.map((r) => r[0]);
  const newIds = newScores.map((r) => r[0]);
  assert.equal(new Set(oldIds).size, 164);
  assert.equal(new Set(newIds).size, 164);
  candidateCountChanges += oldScores.length !== newScores.length ? 1 : 0;
  rankChanges += JSON.stringify(oldIds) !== JSON.stringify(newIds) ? 1 : 0;
  top1Changes += id(before.topPick) !== id(after.topPick) ? 1 : 0;
  top3Changes += JSON.stringify(oldIds.slice(0, 3)) !== JSON.stringify(newIds.slice(0, 3)) ? 1 : 0;
  const oldById = new Map(oldScores.map((entry) => [entry[0], entry]));
  const newById = new Map(newScores.map((entry) => [entry[0], entry]));
  assert.deepEqual([...newById.keys()].sort(), [...oldById.keys()].sort(), "candidate identity invariance");
  for (const product of beforeProducts) {
    evaluatedProductScenarios++;
    const key = String(product.category);
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
    if (JSON.stringify(oldById.get(product.id)) !== JSON.stringify(newById.get(product.id))) {
      scoreChanges++;
    }
  }
}
assert.equal(evaluatedProductScenarios, 1968, "164 x 12 actual engine-scored comparisons");
assert.equal(candidateCountChanges, 0, "candidate cardinality invariant");
assert.equal(scoreChanges, 0, "no unapproved score change from structural-only correction");
assert.equal(rankChanges, 0, "no unapproved rank change from structural-only correction");
assert.equal(top1Changes, 0);
assert.equal(top3Changes, 0);

console.log(JSON.stringify({
  status: "PASS",
  stage: "R16I-R4-D8E1_STRUCTURAL_ONLY",
  verificationScope: "HISTORICAL_164_PRODUCTS_X_12_SCENARIOS",
  engine: "buildSkinMatchDecisionBundle",
  evaluatedProductScenarios,
  scenarioCount: scenarioFixture.scenarioCount,
  productCount: fixture.productCount,
  scoreChanges, rankChanges, top1Changes, top3Changes, candidateCountChanges,
  categoryProductScenarioCounts: Object.fromEntries([...categoryCounts].sort(([a],[b])=>a.localeCompare(b))),
  changedRawKeys,
  checkoutPriceEvidence: "NOT_PROVIDED",
  afterCheckoutPrice: "NOT_ASSUMED",
  officialPurchaseLink: "FALLBACK_NOT_DIRECT_HOLD",
  hwahaeOfferPurchaseLink: "NOT_ADMITTED_BY_SOURCE_POLICY",
  recommendationProductionAuthority: "UNCHANGED",
  productionDbWrites: 0,
  d8e2CheckoutPriceAndFullCatalogRegression: "NOT_EXECUTED_HOLD"
}, null, 2));
