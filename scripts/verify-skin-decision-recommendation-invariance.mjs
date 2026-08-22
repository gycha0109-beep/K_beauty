import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

register("./node-next-alias-loader.mjs", import.meta.url);

globalThis.fetch = async () => {
  throw new Error("HISTORICAL_RECOMMENDATION_NETWORK_CALL_FORBIDDEN");
};

const engineRoot = path.resolve(process.env.RECOMMENDATION_ENGINE_ROOT || process.cwd());
const referenceRoot = path.resolve(process.env.RECOMMENDATION_REFERENCE_ROOT || "_reference/recommendation");
const semanticArtifactPath = path.resolve(
  process.env.RECOMMENDATION_SEMANTIC_ARTIFACT_PATH || "artifacts/recommendation/historical-semantic-invariance-v1.json"
);
const baselineArtifactPath = process.env.RECOMMENDATION_SEMANTIC_BASELINE_PATH
  ? path.resolve(process.env.RECOMMENDATION_SEMANTIC_BASELINE_PATH)
  : null;
const candidatePolicyReportPath = process.env.EVAL_R1_CANDIDATE_POLICY_REPORT
  ? path.resolve(process.env.EVAL_R1_CANDIDATE_POLICY_REPORT)
  : null;
const engineSha = process.env.RECOMMENDATION_ENGINE_SHA || "UNSPECIFIED_ENGINE_SHA";
const referenceSha = process.env.RECOMMENDATION_REFERENCE_SHA || "783afb91a964f5d762f46846f9ef854902b48e95";
const isEvalR1SemanticBaselineMaterialization =
  baselineArtifactPath === null &&
  Boolean(process.env.EVAL_R1_BASE_MAIN_SHA) &&
  engineSha === process.env.EVAL_R1_BASE_MAIN_SHA;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((key) => [key, stable(value[key])])
    );
  }
  return value;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function getProductId(value) {
  if (!value || typeof value !== "object") return null;
  const direct = value.id || value.productId || value.product_id;
  if (direct) return String(direct);
  if (value.product && typeof value.product === "object") return getProductId(value.product);
  return null;
}

const importEngine = (relativePath) => import(pathToFileURL(path.join(engineRoot, relativePath)).href);
const [
  { buildRecommendationProductFromSource },
  { buildSkinMatchDecisionBundle },
  { isProductEligibleForGenderPreference, normalizeRecommendationAnswers }
] = await Promise.all([
  importEngine("lib/product-source.js"),
  importEngine("lib/skin-match-decision-engine.js"),
  importEngine("lib/recommendation-scoring.ts")
]);

const [productsFixture, scenarioFixture, expectedSummary] = await Promise.all([
  readFile(path.join(referenceRoot, "fixtures/recommendation-metadata/products-v1.json"), "utf8").then(JSON.parse),
  readFile(path.join(referenceRoot, "fixtures/recommendation-metadata/user-scenarios-v1.json"), "utf8").then(JSON.parse),
  readFile(path.join(referenceRoot, "evidence/recommendation-metadata-shadow/scenario-summary-v1.json"), "utf8").then(JSON.parse)
]);

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

function semanticProjection(bundle, scoredProducts, normalizedAnswers) {
  const rankingOrderIds = scoredProducts.map((product) => String(product.id));
  const eligibleProductIds = recommendationProducts
    .filter((product) => isProductEligibleForGenderPreference(product, normalizedAnswers))
    .map((product) => String(product.id))
    .sort((left, right) => left.localeCompare(right, "en"));
  return {
    score: scoredProducts.map((product) => ({
      id: String(product.id),
      engine_score: product.engine_score ?? null,
      score: product.score ?? null,
      score_breakdown: stable(product.score_breakdown ?? null)
    })),
    ranking_order_ids: rankingOrderIds,
    top1_id: getProductId(bundle?.topPick),
    top3_ranked_ids: rankingOrderIds.slice(0, 3),
    eligible_product_ids: eligibleProductIds
  };
}

async function materializeOnce() {
  const scenarios = [];
  let presentationOnlySelfTest = "NOT_RUN";
  let semanticMutationSelfTest = "NOT_RUN";

  for (const scenario of [...scenarioFixture.scenarios].sort((left, right) => left.id.localeCompare(right.id, "en"))) {
    const normalizedAnswers = normalizeRecommendationAnswers(scenario.answers);
    const bundle = await buildSkinMatchDecisionBundle(scenario.answers, {
      products: recommendationProducts,
      includeCandidateSourceDiagnostics: true,
      locale: "ko"
    });
    const scoredProducts = bundle?.diagnostics?.candidateSource?.products || [];
    assert.equal(scoredProducts.length, 164, `${scenario.id}: candidate source count`);

    const projection = semanticProjection(bundle, scoredProducts, normalizedAnswers);
    const expected = expectedById.get(scenario.id)?.legacyInvariance;
    assert(expected, `${scenario.id}: expected baseline missing`);
    const legacySnapshot = publicSnapshot(bundle, scoredProducts);

    if (presentationOnlySelfTest === "NOT_RUN") {
      const presentationBundle = { ...bundle, summary: "controlled presentation-only mutation" };
      const presentationProducts = scoredProducts.map((product, index) =>
        index === 0
          ? { ...product, reason: "controlled presentation-only mutation", comparison_reason: "controlled presentation-only mutation" }
          : product
      );
      assert.equal(
        hash(semanticProjection(presentationBundle, presentationProducts, normalizedAnswers)),
        hash(projection),
        "V1 presentation-only mutation must not change historical Recommendation semantic projection"
      );
      presentationOnlySelfTest = "PASS";

      const semanticProducts = scoredProducts.map((product, index) => {
        if (index !== 0) return product;
        const currentScore = typeof product.score === "number" ? product.score : 0;
        return { ...product, score: currentScore + 1 };
      });
      assert.notEqual(
        hash(semanticProjection(bundle, semanticProducts, normalizedAnswers)),
        hash(projection),
        "V2 real score mutation must change historical Recommendation semantic projection"
      );
      semanticMutationSelfTest = "DETECTED";
    }

    scenarios.push({
      id: scenario.id,
      projection_hash: hash(projection),
      score_hash: hash(projection.score),
      ranking_hash: hash(projection.ranking_order_ids),
      top1_hash: hash(projection.top1_id),
      top3_hash: hash(projection.top3_ranked_ids),
      eligibility_hash: hash(projection.eligible_product_ids),
      top1_id: projection.top1_id,
      top3_ranked_ids: projection.top3_ranked_ids,
      eligible_product_count: projection.eligible_product_ids.length,
      legacy_response_hash: hash(legacySnapshot),
      legacy_expected_response_hash: expected.actualResponseHashBefore
    });
  }

  const semanticOnly = scenarios.map((scenario) => ({
    id: scenario.id,
    projection_hash: scenario.projection_hash,
    score_hash: scenario.score_hash,
    ranking_hash: scenario.ranking_hash,
    top1_hash: scenario.top1_hash,
    top3_hash: scenario.top3_hash,
    eligibility_hash: scenario.eligibility_hash
  }));

  return {
    scenarios,
    semantic_hash: hash(semanticOnly),
    self_tests: {
      presentation_only_projection_invariant: presentationOnlySelfTest,
      real_semantic_delta_detected: semanticMutationSelfTest
    }
  };
}

const buildA = await materializeOnce();
const buildB = await materializeOnce();
assert.deepEqual(buildB, buildA, "Historical Recommendation materialization A/B must be deterministic");

let candidatePolicy = null;
if (candidatePolicyReportPath) {
  candidatePolicy = JSON.parse(await readFile(candidatePolicyReportPath, "utf8"));
  assert.equal(candidatePolicy.measurement_boundary, "candidate_exposure_policy_decision_semantics");
  assert.equal(candidatePolicy.semantic_delta, 0, "CandidatePolicy canonical semantic delta");
  assert.equal(candidatePolicy.verifier_self_tests?.explanation_only_projection_invariant, "PASS");
  assert.equal(candidatePolicy.verifier_self_tests?.actual_policy_semantic_delta_detected, "PASS");
}

let comparison = null;
if (baselineArtifactPath) {
  const baseline = JSON.parse(await readFile(baselineArtifactPath, "utf8"));
  assert.equal(baseline.schema_version, "historical-recommendation-semantic-invariance-v1");
  assert.equal(baseline.reference_authority?.source_commit, referenceSha);
  const baselineById = new Map(baseline.scenarios.map((scenario) => [scenario.id, scenario]));
  const deltas = {
    projection_delta: 0,
    score_delta: 0,
    ranking_delta: 0,
    top1_delta: 0,
    top3_delta: 0,
    eligibility_delta: 0,
    candidate_policy_semantic_delta: candidatePolicy?.semantic_delta ?? 0
  };

  for (const scenario of buildA.scenarios) {
    const before = baselineById.get(scenario.id);
    assert(before, `${scenario.id}: historical semantic baseline`);
    if (scenario.projection_hash !== before.projection_hash) deltas.projection_delta += 1;
    if (scenario.score_hash !== before.score_hash) deltas.score_delta += 1;
    if (scenario.ranking_hash !== before.ranking_hash) deltas.ranking_delta += 1;
    if (scenario.top1_hash !== before.top1_hash) deltas.top1_delta += 1;
    if (scenario.top3_hash !== before.top3_hash) deltas.top3_delta += 1;
    if (scenario.eligibility_hash !== before.eligibility_hash) deltas.eligibility_delta += 1;
  }

  for (const [key, value] of Object.entries(deltas)) {
    assert.equal(value, 0, `Historical Recommendation semantic invariant ${key}`);
  }

  const firstLegacyPresentationDelta = buildA.scenarios.find(
    (scenario) => scenario.legacy_response_hash !== scenario.legacy_expected_response_hash
  ) || null;

  comparison = {
    ...deltas,
    baseline_semantic_hash: baseline.semantic_hash,
    candidate_semantic_hash: buildA.semantic_hash,
    semantic_hash_equal: baseline.semantic_hash === buildA.semantic_hash,
    first_legacy_presentation_delta: firstLegacyPresentationDelta
      ? {
          scenario_id: firstLegacyPresentationDelta.id,
          assertion: "actual.actualResponseHash === expected.actualResponseHashBefore",
          expected: firstLegacyPresentationDelta.legacy_expected_response_hash,
          actual: firstLegacyPresentationDelta.legacy_response_hash,
          classification: "PRESENTATION_ONLY_NOT_SEMANTIC_AUTHORITY"
        }
      : null
  };
  assert.equal(comparison.semantic_hash_equal, true, "Historical Recommendation aggregate semantic hash invariant");
} else if (!isEvalR1SemanticBaselineMaterialization) {
  for (const scenario of buildA.scenarios) {
    assert.equal(
      scenario.legacy_response_hash,
      scenario.legacy_expected_response_hash,
      `${scenario.id}: EVAL-P1 reference must reproduce frozen legacy response hash`
    );
  }
}

const artifact = {
  schema_version: "historical-recommendation-semantic-invariance-v1",
  stage: "EVAL-R1",
  engine_sha: engineSha,
  reference_authority: {
    stage: "EVAL-P1",
    source_commit: referenceSha,
    source_parent: "06cfcc99cc5ac488992713638658614108b3f2cb",
    preserved: true
  },
  measurement_boundary: {
    included: ["score", "ranking/order", "Top1", "Top3", "eligibility", "CandidatePolicy canonical semantics"],
    excluded: ["summary", "reason prose", "comparison_reason", "premiumReport copy", "surveyEvidence prose", "routine explanation", "UI/presentation strings", "authorized grounding correction text"]
  },
  deterministic: {
    build_a_hash: buildA.semantic_hash,
    build_b_hash: buildB.semantic_hash,
    byte_semantic_equality: JSON.stringify(stable(buildA)) === JSON.stringify(stable(buildB))
  },
  self_tests: buildA.self_tests,
  semantic_hash: buildA.semantic_hash,
  candidate_policy_semantic_hash: candidatePolicy?.candidate_hash ?? null,
  candidate_policy_semantic_delta: candidatePolicy?.semantic_delta ?? null,
  scenarios: buildA.scenarios,
  comparison
};

await mkdir(path.dirname(semanticArtifactPath), { recursive: true });
await writeFile(semanticArtifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(
  `verify-skin-decision-recommendation-invariance: PASS products=${productsFixture.productCount} scenarios=${buildA.scenarios.length} ` +
  `semantic_hash=${buildA.semantic_hash} mode=${baselineArtifactPath ? "compare" : "reference-materialize"}`
);
