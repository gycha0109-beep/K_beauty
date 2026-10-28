#!/usr/bin/env node
// D8E2: connected DB candidate snapshot -> offline real recommendation runtime.
// 176 raw rows != 176 authorized recommendation candidates. 10 null categories
// fail closed; the 2 newly projected sunscreen rows have NO admission grant here.
// Listing-price branches are hypotheses, NOT verified checkout or Production writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("../node-next-alias-loader.mjs", import.meta.url);
globalThis.fetch = async () => {
  throw new Error("R16I_D8E2_EXTERNAL_NETWORK_FORBIDDEN");
};

const { buildRecommendationProductFromSource } =
  await import("../../lib/product-source.js");
const { buildSkinMatchDecisionBundle } =
  await import("../../lib/skin-match-decision-engine.js");
const { projectProductWithOfferAuthority } =
  await import("../../lib/product-offer-read-path.js");
const { resolveProductPurchaseLink } =
  await import("../../lib/product-purchase-link.js");

const {
  admitRecommendationProductsWithDependencies,
  projectAdmittedRecommendationProducts,
  RECOMMENDATION_CANDIDATE_ADMISSION_TYPE
} = await import("../../lib/recommendation-candidate-admission-core.mjs");
const { noRecommendationAdmissionAuthority } =
  await import("../../lib/recommendation-admission-authority-contract.mjs");

const snapshot = JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/products-candidate-readonly-20261013.json", "utf8"
));
const frozen = JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/products-v1.json", "utf8"
));
const scenarios = JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/user-scenarios-v1.json", "utf8"
));
const TARGET = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const OFFICIAL = "https://www.snature.kr/product/detail.html?product_no=151";
const HWAHAE = "https://www.hwahae.co.kr/goods/45194";
const raw = snapshot.products;
assert.equal(snapshot.schema, "r16i-d8e2-candidate-db-readonly-snapshot-v1");
assert.equal(snapshot.serverDbIdentity, "UNATTESTED");
assert.equal(snapshot.authority, "NOT_A_PRODUCTION_RECOMMENDATION_ADMISSION_GRANT");
assert.equal(snapshot.count, 176);
assert.equal(raw.length, 176);
assert.equal(new Set(raw.map(p => p.id)).size, 176);
assert.equal(frozen.productCount, 164);
assert.equal(frozen.products.length, 164);
assert.equal(scenarios.scenarioCount, 12);
assert.equal(scenarios.scenarios.length, 12);
const frozenIds = new Set(frozen.products.map(p => p.id));
const liveIds = new Set(raw.map(p => p.id));
assert(frozen.products.every(p => liveIds.has(p.id)));
assert.equal(raw.filter(p => !frozenIds.has(p.id)).length, 12);
const newlyEligible = raw.filter(p => !frozenIds.has(p.id) && p.category != null);
assert.equal(newlyEligible.length, 2);
assert(newlyEligible.every(p => p.category === "sunscreen"));
assert.equal(raw.filter(p => p.category == null).length, 10);

// Negative-control only: simulate *missing* PF authority for all 12 new IDs.
// This is NOT an attestation of current Production grant/reject decisions.
let simulatedAuthorityReads = 0;
const conservativeAdmission = await admitRecommendationProductsWithDependencies(raw, {
  reader: async () => {
    simulatedAuthorityReads += 1;
    return noRecommendationAdmissionAuthority("NO_CURRENT_SUBJECT");
  }
});
assert.equal(conservativeAdmission.summary.enumeratedCount, 176);
assert.equal(conservativeAdmission.summary.legacyAdmittedCount, 164);
assert.equal(conservativeAdmission.summary.nonlegacyCheckedCount, 12);
assert.equal(conservativeAdmission.summary.nonlegacyGrantedCount, 0);
assert.equal(conservativeAdmission.summary.nonlegacyRejectedCount, 12);
assert.equal(simulatedAuthorityReads, 12);
assert.equal(conservativeAdmission.decisions.filter(d =>
  d.admissionType === RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED
).length, 12);
const conservativeIds = new Set(conservativeAdmission.decisions.filter(d =>
  d.admissionType !== RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED
).map(d => d.product.id));
assert.deepEqual([...conservativeIds].sort(), [...frozenIds].sort(),
  "synthetically rejected nonlegacy must not leak into admitted set");
const conservativeRaw = projectAdmittedRecommendationProducts(conservativeAdmission, p => p);
assert.equal(conservativeRaw.length, 164);
assert(conservativeRaw.every(p => frozenIds.has(p.id)));
// Infrastructure failure must throw, never transform into a silent admit/skip.
await assert.rejects(
  () => admitRecommendationProductsWithDependencies(raw, {
    reader: async () => noRecommendationAdmissionAuthority("PF_AUTHORITY_READ_FAILED")
  }),
  error => error?.code === "RECOMMENDATION_CANDIDATE_ADMISSION_INFRASTRUCTURE_FAILURE" &&
    error?.reason === "PF_AUTHORITY_READ_FAILED",
  "PF authority transport errors fail the entire source closed"
);
await assert.rejects(
  () => admitRecommendationProductsWithDependencies(raw, {}),
  error => error?.code === "RECOMMENDATION_CANDIDATE_ADMISSION_INFRASTRUCTURE_FAILURE" &&
    error?.reason === "PF_AUTHORITY_READER_REQUIRED",
  "missing PF reader does not silently authorize nonlegacy"
);

const before = raw.find(p => p.id === TARGET);
assert(before);
assert.equal(before.size_ml, 160);
assert.equal(before.price_min, 29900);
assert.equal(before.price_max, 29900);
assert.equal(before.unit_price_per_10ml, 1868.75);
assert.equal(before.buy_link, HWAHAE);

function makeAfter(listingPrice) {
  const changed = {
    ...before,
    size_ml: 80,
    price_min: listingPrice,
    price_max: listingPrice,
    unit_price_per_10ml: listingPrice / 8,
    buy_link: OFFICIAL
  };
  assert.deepEqual(changed.review_signals, before.review_signals);
  assert.deepEqual(changed.market_signals, before.market_signals);
  assert.deepEqual(changed.ingredient_signals, before.ingredient_signals);
  return changed;
}
function project(replacement) {
  const projected = raw.map(p =>
    buildRecommendationProductFromSource(p.id === TARGET ? replacement : p)
  );
  assert.equal(projected.filter(p => p === null).length, 10,
    "null-category rows must remain excluded from the category projector");
  const candidates = projected.filter(Boolean);
  assert.equal(candidates.length, 166, "166 structurally projectable, NOT admission-authorized");
  assert.equal(new Set(candidates.map(p => p.id)).size, 166);
  return candidates;
}
const oldProducts = project(before);
const conservativeBeforeProducts = conservativeRaw.map(p =>
  buildRecommendationProductFromSource(p)
);
assert.equal(conservativeBeforeProducts.length, 164);
assert(conservativeBeforeProducts.every(Boolean));


const originalProjected = oldProducts.find(p => p.id === TARGET);
assert(originalProjected);
assert.equal(originalProjected.buy_link, HWAHAE);
const branches = [
  { name: "OFFICIAL_LIST_PRICE_35000_NON_CHECKOUT", listingPrice: 35000 },
  { name: "OFFICIAL_MEMBER_DISPLAY_24500_NON_CHECKOUT", listingPrice: 24500 }
];
const results = [];

for (const branch of branches) {
  const hypothetical = makeAfter(branch.listingPrice);
  const nextProducts = project(hypothetical);
  const afterProjected = nextProducts.find(p => p.id === TARGET);
  assert(afterProjected);
  assert.equal(afterProjected.buy_link, "",
    "official snature URL has not been admitted into trusted direct-link sources");
  assert.equal(afterProjected.price_min, branch.listingPrice);
  assert.equal(afterProjected.price_max, branch.listingPrice);
  assert.deepEqual(afterProjected.review_signals, originalProjected.review_signals);
  assert.deepEqual(afterProjected.market_signals, originalProjected.market_signals);
  assert.equal(resolveProductPurchaseLink({
    buyLink: OFFICIAL, brand: hypothetical.brand, name: hypothetical.name
  }).kind, "fallback");

  const proposedHwahaeOffer = {
    product_id: TARGET,
    seller_key: "hwahae",
    seller_name: "화해",
    source_name: "hwahae",
    listing_id: "45194",
    listing_url: HWAHAE,
    price_amount: 29900,
    currency_code: "KRW",
    market_code: "KR",
    availability_state: "unknown",
    offer_state: "current",
    product_scope_state: "product_subject_unresolved",
    link_health_state: "unchecked"
  };
  const untrusted = projectProductWithOfferAuthority(
    { ...afterProjected, buy_link: OFFICIAL }, [proposedHwahaeOffer]
  );
  assert.equal(untrusted.buy_link, "");
  assert.equal(untrusted.price_min, branch.listingPrice);
  assert.equal(untrusted.price_max, branch.listingPrice);
  const spoofed = projectProductWithOfferAuthority(afterProjected, [
    { ...proposedHwahaeOffer, listing_url: "https://hwahae.co.kr.evil.test/goods/45194" }
  ]);
  assert.equal(spoofed.buy_link, "");
  assert.equal(spoofed.price_min, branch.listingPrice);

  let pairs = 0, changedScores = 0, changedRankings = 0;
  let changedTop1 = 0, changedTop3 = 0, changedCounts = 0;
  for (const scenario of scenarios.scenarios) {
    const [a, b] = await Promise.all([
      buildSkinMatchDecisionBundle(scenario.answers, {
        products: oldProducts, includeCandidateSourceDiagnostics: true, locale: "ko"
      }),
      buildSkinMatchDecisionBundle(scenario.answers, {
        products: nextProducts, includeCandidateSourceDiagnostics: true, locale: "ko"
      })
    ]);
    const x = a?.diagnostics?.candidateSource?.products;
    const y = b?.diagnostics?.candidateSource?.products;
    assert.equal(x?.length, 166);
    assert.equal(y?.length, 166);
    const oldIds = x.map(p => p.id), newIds = y.map(p => p.id);
    changedRankings += JSON.stringify(oldIds) !== JSON.stringify(newIds) ? 1 : 0;
    changedCounts += oldIds.length !== newIds.length ? 1 : 0;
    changedTop1 += (a.topPick?.id ?? a.topPick?.product?.id ?? null) !==
      (b.topPick?.id ?? b.topPick?.product?.id ?? null) ? 1 : 0;
    changedTop3 += JSON.stringify(oldIds.slice(0, 3)) !==
      JSON.stringify(newIds.slice(0, 3)) ? 1 : 0;
    const oldScore = new Map(x.map(p => [p.id, [p.engine_score ?? null, p.score ?? null]]));
    const newScore = new Map(y.map(p => [p.id, [p.engine_score ?? null, p.score ?? null]]));
    assert.deepEqual([...oldScore.keys()].sort(), [...newScore.keys()].sort());
    for (const [id, score] of oldScore) {
      pairs++;
      changedScores += JSON.stringify(score) !== JSON.stringify(newScore.get(id)) ? 1 : 0;
    }
  }
  assert.equal(pairs, 1992, "166 projected candidates x 12 scenarios");
  // Changing listing price alone must not silently alter Skin Match recommendation
  // semantics. A nonzero result is a blocking delta until explicitly reviewed.
  assert.equal(changedScores, 0, "unauthorized recommendation score delta");
  assert.equal(changedRankings, 0, "unauthorized recommendation rank delta");
  assert.equal(changedTop1, 0);
  assert.equal(changedTop3, 0);
  assert.equal(changedCounts, 0);
  // Real engine again under an explicit *synthetic* missing-authority fail-closed gate.
  // For 164 legacy rows this is 1,968 more scored comparisons per branch,
  // not a claim about currently deployed admission grants.
  const conservativeAfterProducts = conservativeRaw.map(p =>
    buildRecommendationProductFromSource(p.id === TARGET ? hypothetical : p)
  );
  assert.equal(conservativeAfterProducts.length, 164);
  let conservativePairs = 0, conservativeScoreChanges = 0;
  let conservativeRankChanges = 0, conservativeTop1Changes = 0;
  let conservativeTop3Changes = 0, conservativeCandidateCountChanges = 0;
  for (const scenario of scenarios.scenarios) {
    const [a, b] = await Promise.all([
      buildSkinMatchDecisionBundle(scenario.answers, {
        products: conservativeBeforeProducts,
        includeCandidateSourceDiagnostics: true, locale: "ko"
      }),
      buildSkinMatchDecisionBundle(scenario.answers, {
        products: conservativeAfterProducts,
        includeCandidateSourceDiagnostics: true, locale: "ko"
      })
    ]);
    const x = a?.diagnostics?.candidateSource?.products;
    const y = b?.diagnostics?.candidateSource?.products;
    assert.equal(x?.length, 164);
    assert.equal(y?.length, 164);
    const oldIds = x.map(p => p.id), newIds = y.map(p => p.id);
    conservativeRankChanges += JSON.stringify(oldIds) !== JSON.stringify(newIds) ? 1 : 0;
    conservativeCandidateCountChanges += oldIds.length !== newIds.length ? 1 : 0;
    conservativeTop1Changes += (a.topPick?.id ?? a.topPick?.product?.id ?? null) !==
      (b.topPick?.id ?? b.topPick?.product?.id ?? null) ? 1 : 0;
    conservativeTop3Changes += JSON.stringify(oldIds.slice(0, 3)) !==
      JSON.stringify(newIds.slice(0, 3)) ? 1 : 0;
    const byId = new Map(y.map(p => [p.id, [p.engine_score ?? null, p.score ?? null]]));
    for (const item of x) {
      conservativePairs += 1;
      conservativeScoreChanges += JSON.stringify([
        item.engine_score ?? null, item.score ?? null
      ]) !== JSON.stringify(byId.get(item.id)) ? 1 : 0;
    }
  }
  assert.equal(conservativePairs, 1968);
  assert.equal(conservativeScoreChanges, 0);
  assert.equal(conservativeRankChanges, 0);
  assert.equal(conservativeTop1Changes, 0);
  assert.equal(conservativeTop3Changes, 0);
  assert.equal(conservativeCandidateCountChanges, 0);
  results.push({
    conservativeFailClosedPairs: conservativePairs,
    conservativeScoreChanges, conservativeRankChanges,
    conservativeTop1Changes, conservativeTop3Changes,
    conservativeCandidateCountChanges,
    branch: branch.name, exampleDisplayPriceKrw: branch.listingPrice,
    hypotheticalUnitPricePer10ml: hypothetical.unit_price_per_10ml,
    pairs, changedScores, changedRankings, changedTop1, changedTop3, changedCounts
  });
}
console.log(JSON.stringify({
  status: "PASS", stage: "R16I_R4_D8E2_CONNECTED_CANDIDATE_DB_SNAPSHOT",
  source: "READ_ONLY_20261013_CANDIDATE_DB_UNATTESTED",
  rawCatalogRows: 176, frozenLegacyIds: 164, newRows: 12,
  structurallyProjectableRows: 166, nullCategoryRejectedRows: 10,
  newlyStructurallyProjectableRowsWithoutAdmissionEvidence: 2,
  actualProductionAdmittedCandidateCount: "UNVERIFIED",
  negativeControl: "SYNTHETIC_NO_CURRENT_SUBJECT_FOR_ALL_NEW_PRODUCTS_NOT_LIVE_AUTHORITY",
  syntheticAuthorityReads: simulatedAuthorityReads,
  syntheticLegacyAdmitted: conservativeAdmission.summary.legacyAdmittedCount,
  syntheticNonlegacyRejected: conservativeAdmission.summary.nonlegacyRejectedCount,
  totalScoredComparisonPairsAcrossBothProjections: 7920,
  actualAdmissionAuthorityRead: "DENIED_BY_CONNECTED_INTEGRATION_ROLE_42501_HOLD",
  comparisonScenarios: results,
  actualCheckoutPrice: "NOT_VERIFIED",
  offerCheckoutAndSellerSku: "HOLD",
  officialDirectPurchaseLink: "FALLBACK_HOLD",
  productionWrites: 0, releaseGateChanges: 0,
  ownerApproval: "NOT_GRANTED",
  fullD8E2ReleaseGate: "HOLD"
}, null, 2));
