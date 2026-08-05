import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";

register("./node-next-alias-loader.mjs", import.meta.url);

const [
  { buildRecommendationProductFromSource },
  { buildSkinMatchDecisionBundle },
  { fingerprintCandidateExposureShadowValue }
] = await Promise.all([
  import("../lib/product-source.js"),
  import("../lib/skin-match-decision-engine.js"),
  import("../lib/candidate-exposure-policy-shadow.js")
]);

const referenceRoot = path.resolve(
  process.env.RECOMMENDATION_REFERENCE_ROOT || "_reference/recommendation"
);
const productsFixture = JSON.parse(await readFile(
  path.join(referenceRoot, "fixtures/recommendation-metadata/products-v1.json"),
  "utf8"
));
const scenarioFixture = JSON.parse(await readFile(
  path.join(referenceRoot, "fixtures/recommendation-metadata/user-scenarios-v1.json"),
  "utf8"
));
const expectedSummary = JSON.parse(await readFile(
  path.join(referenceRoot, "evidence/recommendation-metadata-shadow/scenario-summary-v1.json"),
  "utf8"
));

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
function hash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}
function publicSnapshot(bundle, scoredProducts) {
  return {
    summary: bundle.summary,
    priority: bundle.priority,
    topPick: bundle.topPick,
    altPicks: bundle.altPicks,
    categoryPicks: bundle.categoryPicks,
    products: bundle.products,
    supportingConcerns: bundle.supportingConcerns,
    morning: bundle.morning,
    night: bundle.night,
    avoid: bundle.avoid,
    scoring: bundle.scoring,
    premiumReport: bundle.premiumReport,
    ranked: scoredProducts.map((product) => ({
      id: product.id,
      engine_score: product.engine_score,
      score: product.score,
      reason: product.reason,
      comparison_reason: product.comparison_reason,
      decision_meta: product.decision_meta,
      score_breakdown: product.score_breakdown
    }))
  };
}

assert.equal(productsFixture.productCount, 164);
assert.equal(scenarioFixture.scenarioCount, 12);
assert.equal(expectedSummary.productionInvariance.allActualRankingHashesMatch, true);
assert.equal(expectedSummary.productionInvariance.allActualResponseHashesMatch, true);
assert.equal(expectedSummary.productionInvariance.allScoreHashesMatch, true);
assert.equal(expectedSummary.productionInvariance.allExplanationHashesMatch, true);
assert.equal(expectedSummary.productionInvariance.allPersistenceHashesMatch, true);
assert.equal(expectedSummary.productionInvariance.allCandidatePolicyFingerprintsMatch, true);

const orderedProducts = [...productsFixture.products].sort((left, right) =>
  String(left.category).localeCompare(String(right.category), "en") ||
  String(left.brand).localeCompare(String(right.brand), "en") ||
  String(left.name).localeCompare(String(right.name), "en") ||
  String(left.id).localeCompare(String(right.id), "en")
);
const recommendationProducts = orderedProducts.map(buildRecommendationProductFromSource);
const expectedById = new Map(expectedSummary.scenarios.map((scenario) => [scenario.id, scenario]));
const results = [];

for (const scenario of [...scenarioFixture.scenarios].sort((a, b) => a.id.localeCompare(b.id, "en"))) {
  const bundle = await buildSkinMatchDecisionBundle(scenario.answers, {
    products: recommendationProducts,
    includeCandidateSourceDiagnostics: true,
    locale: "ko"
  });
  const scoredProducts = bundle?.diagnostics?.candidateSource?.products || [];
  assert.equal(scoredProducts.length, 164, `${scenario.id}: candidate source count`);
  const snapshot = publicSnapshot(bundle, scoredProducts);
  const expected = expectedById.get(scenario.id)?.legacyInvariance;
  assert(expected, `${scenario.id}: expected baseline missing`);

  const actual = {
    actualRankingHash: hash(snapshot.ranked.map((item) => [item.id, item.engine_score, item.score])),
    actualResponseHash: hash(snapshot),
    scoreHash: hash(snapshot.ranked.map((item) => [item.id, item.score_breakdown])),
    explanationHash: hash(snapshot.ranked.map((item) => [item.id, item.reason, item.comparison_reason])),
    persistenceHash: hash({
      topPick: snapshot.topPick,
      premiumReport: snapshot.premiumReport,
      morning: snapshot.morning,
      night: snapshot.night
    }),
    candidatePolicyFingerprint: fingerprintCandidateExposureShadowValue(snapshot)
  };

  assert.equal(actual.actualRankingHash, expected.actualRankingHashBefore, `${scenario.id}: ranking`);
  assert.equal(actual.actualResponseHash, expected.actualResponseHashBefore, `${scenario.id}: response`);
  assert.equal(actual.scoreHash, expected.scoreHashBefore, `${scenario.id}: scores`);
  assert.equal(actual.explanationHash, expected.explanationHashBefore, `${scenario.id}: explanations`);
  assert.equal(actual.persistenceHash, expected.persistenceHashBefore, `${scenario.id}: persistence`);
  assert.equal(
    actual.candidatePolicyFingerprint,
    expected.candidatePolicyFingerprintBefore,
    `${scenario.id}: CandidatePolicy fingerprint`
  );
  results.push({ id: scenario.id, ...actual });
}

console.log(
  `verify-skin-decision-recommendation-invariance: PASS ` +
  `products=${productsFixture.productCount} scenarios=${results.length} ` +
  `reference=${productsFixture.sourceBranchSha}`
);
