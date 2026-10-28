#!/usr/bin/env node
// D8H: 176-row candidate snapshot NULL price what-if; NOT Product pricing policy.
// 166 = structurally projectable ONLY; 164 = synthetic legacy-only negative control.
// Neither projection attests actual Production recommendation admission.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("../node-next-alias-loader.mjs", import.meta.url);
globalThis.fetch = async () => {
  throw new Error("R16I_D8H_176_ROW_NULL_PRICE_EXTERNAL_NETWORK_FORBIDDEN");
};
const { buildRecommendationProductFromSource } =
  await import("../../lib/product-source.js");
const { buildSkinMatchDecisionBundle } =
  await import("../../lib/skin-match-decision-engine.js");
const { projectProductWithOfferAuthority } =
  await import("../../lib/product-offer-read-path.js");

const candidate = JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/products-candidate-readonly-20261013.json", "utf8"
));
const frozen = JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/products-v1.json", "utf8"
));
const scenarios = JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/user-scenarios-v1.json", "utf8"
));
const ID = "b639c8b4-6a61-440e-b4db-fac7381593ff";
assert.equal(candidate.schema, "r16i-d8e2-candidate-db-readonly-snapshot-v1");
assert.equal(candidate.serverDbIdentity, "UNATTESTED");
assert.equal(candidate.authority, "NOT_A_PRODUCTION_RECOMMENDATION_ADMISSION_GRANT");
assert.equal(candidate.count, 176);
assert.equal(candidate.products.length, 176);
assert.equal(frozen.productCount, 164);
assert.equal(frozen.products.length, 164);
assert.equal(scenarios.scenarioCount, 12);
assert.equal(scenarios.scenarios.length, 12);
const frozenIds = new Set(frozen.products.map(row => row.id));
assert.equal(frozenIds.size, 164);
const newRows = candidate.products.filter(row => !frozenIds.has(row.id));
assert.equal(newRows.length, 12);
assert.equal(newRows.filter(row => row.category == null).length, 10);
assert.equal(newRows.filter(row => row.category != null).length, 2);

const original = candidate.products.find(row => row.id === ID);
assert(original);
assert.equal(original.size_ml, 160);
assert.equal(original.price_min, 29900);
assert.equal(original.price_max, 29900);
assert.equal(original.unit_price_per_10ml, 1868.75);
assert.equal(original.buy_link, "https://www.hwahae.co.kr/goods/45194");
const hypothetical = {
  ...original,
  size_ml: 80, price_min: null, price_max: null,
  unit_price_per_10ml: null, buy_link: null
};
for (const field of ["review_signals", "market_signals", "ingredient_signals"]) {
  assert.deepEqual(original[field], hypothetical[field]);
}
assert.deepEqual(
  Object.keys(hypothetical)
    .filter(key => JSON.stringify(original[key]) !== JSON.stringify(hypothetical[key]))
    .sort(),
  ["buy_link", "price_max", "price_min", "size_ml", "unit_price_per_10ml"].sort()
);
const dualSellerCandidates = [
  {
    product_id: ID, source_name: "official_single", seller_key: "snature",
    listing_url: "https://www.snature.kr/product/detail.html?product_no=151",
    price_amount: 24500, offer_state: "current", currency_code: "KRW",
    market_code: "KR", availability_state: "unknown",
    product_scope_state: "product_subject_unresolved"
  },
  {
    product_id: ID, source_name: "hwahae_bundle", seller_key: "hwahae",
    listing_url: "https://www.hwahae.co.kr/goods/45194",
    price_amount: 29900, offer_state: "current", currency_code: "KRW",
    market_code: "KR", availability_state: "unknown",
    product_scope_state: "product_subject_unresolved"
  }
];
function project(raw, replacement) {
  const mapped = raw.map(row =>
    buildRecommendationProductFromSource(row.id === ID ? replacement : row));
  return mapped.filter(Boolean);
}
const allBefore = project(candidate.products, original);
const allAfter = project(candidate.products, hypothetical);
assert.equal(allBefore.length, 166);
assert.equal(allAfter.length, 166);
const legacyRaw = candidate.products.filter(row => frozenIds.has(row.id));
assert.equal(legacyRaw.length, 164);
const conservativeBefore = project(legacyRaw, original);
const conservativeAfter = project(legacyRaw, hypothetical);
assert.equal(conservativeBefore.length, 164);
assert.equal(conservativeAfter.length, 164);
for (const products of [allAfter, conservativeAfter]) {
  const target = products.find(p => p.id === ID);
  assert(target);
  assert.equal(target.price_min, null);
  assert.equal(target.price_max, null);
  assert.equal(target.price_range, "", "unknown Product price must have no inferred price band");
  assert.equal(target.buy_link, "");
  const fromOffers = projectProductWithOfferAuthority(target, dualSellerCandidates);
  assert.equal(fromOffers.price_min, null);
  assert.equal(fromOffers.price_max, null);
  assert.equal(fromOffers.buy_link, "", "unbound Offers may not promote legacy CTA");
}

const id = row => row?.id ?? row?.product?.id ?? null;
const ids = rows => (rows || []).map(id);
async function compare(label, beforeRows, afterRows, expected) {
  const results = {
    label, productCount: expected, scenarios: 0, comparedCandidates: 0,
    scoreDeltas: 0, rankDeltas: 0, topPickDeltas: 0,
    topThreeDeltas: 0, candidateCountDeltas: 0,
    budgetAlternativeIdDeltas: 0, budgetAlternativePayloadDeltas: 0,
    targetBudgetAppearancesBefore: 0, targetBudgetAppearancesAfter: 0,
    budgetDifferenceScenarios: []
  };
  for (const scenario of [...scenarios.scenarios].sort((a,b) =>
    a.id.localeCompare(b.id))) {
    const [a,b] = await Promise.all([
      buildSkinMatchDecisionBundle(scenario.answers, {
        products: beforeRows, locale: "ko", includeCandidateSourceDiagnostics: true
      }),
      buildSkinMatchDecisionBundle(scenario.answers, {
        products: afterRows, locale: "ko", includeCandidateSourceDiagnostics: true
      })
    ]);
    results.scenarios++;
    const left = a.diagnostics?.candidateSource?.products;
    const right = b.diagnostics?.candidateSource?.products;
    assert.equal(left?.length, expected);
    assert.equal(right?.length, expected);
    const leftIds = ids(left), rightIds = ids(right);
    results.candidateCountDeltas += left.length !== right.length ? 1 : 0;
    results.rankDeltas += JSON.stringify(leftIds) !== JSON.stringify(rightIds) ? 1 : 0;
    results.topPickDeltas += id(a.topPick) !== id(b.topPick) ? 1 : 0;
    results.topThreeDeltas += JSON.stringify(leftIds.slice(0,3)) !==
      JSON.stringify(rightIds.slice(0,3)) ? 1 : 0;
    const newScores = new Map(right.map(p => [
      p.id, [p.engine_score ?? null, p.score ?? null]
    ]));
    for (const p of left) {
      assert(newScores.has(p.id));
      results.comparedCandidates++;
      results.scoreDeltas += JSON.stringify([p.engine_score ?? null, p.score ?? null]) !==
        JSON.stringify(newScores.get(p.id)) ? 1 : 0;
    }
    const oldBudget = a.premiumReport?.budgetAlternatives || [];
    const newBudget = b.premiumReport?.budgetAlternatives || [];
    const oldBudgetIds = ids(oldBudget), newBudgetIds = ids(newBudget);
    const identityChanged = JSON.stringify(oldBudgetIds) !== JSON.stringify(newBudgetIds);
    const payloadChanged = JSON.stringify(oldBudget) !== JSON.stringify(newBudget);
    results.budgetAlternativeIdDeltas += identityChanged ? 1 : 0;
    results.budgetAlternativePayloadDeltas += payloadChanged ? 1 : 0;
    results.targetBudgetAppearancesBefore += oldBudgetIds.filter(x=>x===ID).length;
    results.targetBudgetAppearancesAfter += newBudgetIds.filter(x=>x===ID).length;
    if (identityChanged) results.budgetDifferenceScenarios.push({
      scenarioId: scenario.id, beforeIds: oldBudgetIds, afterIds: newBudgetIds
    });
  }
  assert.equal(results.scenarios, 12);
  assert.equal(results.comparedCandidates, expected * 12);
  assert.equal(results.scoreDeltas, 0, "no unapproved score change");
  assert.equal(results.rankDeltas, 0, "no unapproved rank change");
  assert.equal(results.topPickDeltas, 0);
  assert.equal(results.topThreeDeltas, 0);
  assert.equal(results.candidateCountDeltas, 0);
  return results;
}
const observed = await compare(
  "STRUCTURAL_166_NOT_ADMISSION_AUTHORIZED", allBefore, allAfter, 166
);
const syntheticConservative = await compare(
  "LEGACY_164_SYNTHETIC_NEW_ROW_DENIAL_NOT_PRODUCTION",
  conservativeBefore, conservativeAfter, 164
);
console.log(JSON.stringify({
  status: "PASS_WITH_BUDGET_CONSUMER_HOLD",
  stage: "R16I_D8H_NULL_PRICE_176_CANDIDATE_SHADOW",
  source: "READ_ONLY_20261013_CANDIDATE_DB_UNATTESTED",
  catalogRows: 176, structurallyProjectableRows: 166,
  syntheticConservativeLegacyRows: 164, rejectedNullCategories: 10,
  nonlegacyProductAdmission: "NOT_ATTESTED",
  observed, syntheticConservative,
  productWrites: 0, offerWrites: 0,
  canonicalProductPricePolicy: "NOT_APPROVED",
  priceBandForNull: "EMPTY_NO_INFERRED_BAND",
  runtimeDbIdentity: "UNATTESTED",
  releaseAuthorized: false
}));
