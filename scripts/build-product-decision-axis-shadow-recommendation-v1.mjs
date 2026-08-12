#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  VERSION,
  assertConstraintUtilitySeparation,
  buildAxisIndex,
  evaluateShadowCandidate,
  sha256Json,
  stable,
} from "./product-evidence/product-decision-axis-shadow-recommendation-v1.mjs";

register("./node-next-alias-loader.mjs", import.meta.url);

const BASE_MAIN_SHA = process.env.V21_7_BASE_MAIN_SHA || "e2be97b9fcbf75ff43b6f7ecfe96a680aff4cb87";
const LEGACY_REFERENCE_SHA = "783afb91a964f5d762f46846f9ef854902b48e95";
const CLEANSER_AXIS_SHA256 = "fbddc761328f2caa5025a5867061866d17f16d24cb6566fe82d0796c20a4a0b4";
const CROSS_AXIS_SHA256 = "5dc5c7975be7474bf0767951ea63074ed60968faabee5fdb8734153ff698ab5e";
const LEGACY_PRODUCTS_SHA256 = "e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856";
const LEGACY_SCENARIOS_SHA256 = "7aa02ed3f1a264a67aee3d97c916b4a955a713fdbb173844d1727e9cfb1c918e";
const LEGACY_VERIFIER_BLOB = "2691ec68ee03780849c7d28e5c239682757f9e3d";
const DECISION_ENGINE_BLOB = "96ea6cdf396aef83d407a09bd54039413524c898";
const REFERENCE_ROOT = path.resolve(process.env.RECOMMENDATION_REFERENCE_ROOT || "_reference/recommendation");
const OUT_JSON = path.resolve("evidence/product-recommendation-shadow-v1/legacy-vs-decision-axis-shadow-v1.json");
const OUT_MD = path.resolve("docs/evidence/product-decision-axis-shadow-recommendation-v1.md");

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function idOf(value) {
  return value?.id ?? value?.product_id ?? value?.productId ?? null;
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
      score_breakdown: product.score_breakdown,
    })),
  };
}

function fingerprintSnapshot(snapshot, fingerprintCandidateExposureShadowValue) {
  return {
    actualRankingHash: sha256Json(snapshot.ranked.map((item) => [item.id, item.engine_score, item.score])),
    actualResponseHash: sha256Json(snapshot),
    scoreHash: sha256Json(snapshot.ranked.map((item) => [item.id, item.score_breakdown])),
    explanationHash: sha256Json(snapshot.ranked.map((item) => [item.id, item.reason, item.comparison_reason])),
    persistenceHash: sha256Json({
      topPick: snapshot.topPick,
      premiumReport: snapshot.premiumReport,
      morning: snapshot.morning,
      night: snapshot.night,
    }),
    candidatePolicyFingerprint: fingerprintCandidateExposureShadowValue(snapshot),
  };
}

function countBy(items, getter) {
  const counts = {};
  for (const item of items) {
    const key = getter(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, "en")));
}

function uniqueOverlapCases(evaluations) {
  const seen = new Set();
  const out = [];
  for (const evaluation of evaluations) {
    for (const overlap of evaluation.duplication.overlaps || []) {
      const key = `${evaluation.product_id}:${overlap.semantic_family}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ scenario_id: evaluation.scenario_id, product_id: evaluation.product_id, ...overlap });
    }
  }
  return out.sort((a, b) => `${a.product_id}:${a.semantic_family}`.localeCompare(`${b.product_id}:${b.semantic_family}`, "en"));
}

export async function buildArtifact() {
  const [
    { buildRecommendationProductFromSource },
    { buildSkinMatchDecisionBundle },
    { fingerprintCandidateExposureShadowValue },
  ] = await Promise.all([
    import("../lib/product-source.js"),
    import("../lib/skin-match-decision-engine.js"),
    import("../lib/candidate-exposure-policy-shadow.js"),
  ]);

  const [cleanserBytes, crossBytes, productsBytes, scenariosBytes, expectedBytes] = await Promise.all([
    readFile("evidence/product-decision-axis-v1/cleanser-product-decision-axis-v1.json"),
    readFile("evidence/product-decision-axis-v1/cross-category-product-decision-axis-v1.json"),
    readFile(path.join(REFERENCE_ROOT, "fixtures/recommendation-metadata/products-v1.json")),
    readFile(path.join(REFERENCE_ROOT, "fixtures/recommendation-metadata/user-scenarios-v1.json")),
    readFile(path.join(REFERENCE_ROOT, "evidence/recommendation-metadata-shadow/scenario-summary-v1.json")),
  ]);

  assert.equal(sha256Bytes(cleanserBytes), CLEANSER_AXIS_SHA256, "V2.1-5 cleanser axis artifact drift");
  assert.equal(sha256Bytes(crossBytes), CROSS_AXIS_SHA256, "V2.1-6 cross-category axis artifact drift");

  const cleanser = JSON.parse(cleanserBytes);
  const cross = JSON.parse(crossBytes);
  const productsFixture = JSON.parse(productsBytes);
  const scenarioFixture = JSON.parse(scenariosBytes);
  const expectedSummary = JSON.parse(expectedBytes);

  assert.equal(productsFixture.productCount, 164);
  assert.equal(productsFixture.canonicalFixtureSha256, LEGACY_PRODUCTS_SHA256);
  assert.equal(scenarioFixture.scenarioCount, 12);
  assert.equal(scenarioFixture.canonicalScenarioSha256, LEGACY_SCENARIOS_SHA256);
  assert.equal(cross.summary.products, 12);
  assert.equal(cross.summary.axis_outputs, 12);
  assert.equal(cross.summary.numeric_estimates, 0);
  assert.equal(cross.summary.null_estimates, 12);
  assert.equal(cross.summary.identity_blocked_products, 1);
  assert.ok(cleanser.products.every((product) => product.axes.every((axis) => axis.estimate === null)));
  assert.ok(cross.products.every((product) => product.axis.estimate === null));

  const axisIndex = buildAxisIndex(cleanser, cross);
  assert.ok([...axisIndex.values()].every((record) => record.fixture_only && record.hosted_current === false));

  const orderedRawProducts = [...productsFixture.products].sort((left, right) =>
    String(left.category).localeCompare(String(right.category), "en") ||
    String(left.brand).localeCompare(String(right.brand), "en") ||
    String(left.name).localeCompare(String(right.name), "en") ||
    String(left.id).localeCompare(String(right.id), "en")
  );
  const rawById = new Map(orderedRawProducts.map((product) => [String(product.id), product]));
  const recommendationProducts = orderedRawProducts.map(buildRecommendationProductFromSource);
  const expectedById = new Map(expectedSummary.scenarios.map((scenario) => [scenario.id, scenario]));
  const scenarioResults = [];
  const candidateEvaluations = [];

  for (const scenario of [...scenarioFixture.scenarios].sort((a, b) => a.id.localeCompare(b.id, "en"))) {
    const bundle = await buildSkinMatchDecisionBundle(scenario.answers, {
      products: recommendationProducts,
      includeCandidateSourceDiagnostics: true,
      locale: "ko",
    });
    const scoredProducts = bundle?.diagnostics?.candidateSource?.products || [];
    assert.equal(scoredProducts.length, 164, `${scenario.id}: current candidate source count`);
    const snapshot = publicSnapshot(bundle, scoredProducts);
    const actual = fingerprintSnapshot(snapshot, fingerprintCandidateExposureShadowValue);
    const expected = expectedById.get(scenario.id)?.legacyInvariance;
    assert.ok(expected, `${scenario.id}: frozen legacy baseline missing`);
    assert.equal(actual.actualRankingHash, expected.actualRankingHashBefore, `${scenario.id}: production ranking drift`);
    assert.equal(actual.actualResponseHash, expected.actualResponseHashBefore, `${scenario.id}: production public response drift`);
    assert.equal(actual.scoreHash, expected.scoreHashBefore, `${scenario.id}: production score drift`);
    assert.equal(actual.explanationHash, expected.explanationHashBefore, `${scenario.id}: production explanation drift`);
    assert.equal(actual.persistenceHash, expected.persistenceHashBefore, `${scenario.id}: production persistence drift`);
    assert.equal(actual.candidatePolicyFingerprint, expected.candidatePolicyFingerprintBefore, `${scenario.id}: CandidatePolicy drift`);

    const topPickId = String(idOf(bundle.topPick) ?? "");
    const top3List = [topPickId, ...((bundle.altPicks || []).map(idOf).filter(Boolean).map(String))];
    for (const item of scoredProducts.slice(0, 3)) {
      const id = String(idOf(item));
      if (!top3List.includes(id)) top3List.push(id);
    }
    const top3Ids = new Set(top3List.filter(Boolean).slice(0, 3));

    const scenarioEvaluations = scoredProducts.map((scoredProduct, index) => {
      const productId = String(idOf(scoredProduct));
      const rawProduct = rawById.get(productId);
      assert.ok(rawProduct, `${scenario.id}:${productId}: raw fixture product missing`);
      const evaluation = evaluateShadowCandidate({
        scenario,
        rawProduct,
        scoredProduct,
        legacyRank: index + 1,
        topPickId,
        top3Ids,
        axisRecord: axisIndex.get(productId) || null,
      });
      assertConstraintUtilitySeparation(evaluation);
      return evaluation;
    });
    candidateEvaluations.push(...scenarioEvaluations);
    scenarioResults.push({
      scenario_id: scenario.id,
      label: scenario.label,
      legacy_fingerprints: actual,
      shadow_state_counts: countBy(scenarioEvaluations, (item) => item.shadow.state),
      production_delta: {
        score: 0,
        ranking: 0,
        top_pick: 0,
        top3: 0,
        eligibility: 0,
        public_response: 0,
        persistence_projection: 0,
        candidate_policy_fingerprint: 0,
      },
    });
  }

  assert.equal(candidateEvaluations.length, 164 * 12);
  const p3 = cross.products.find((product) => product.pilot_id === "P3");
  assert.ok(p3, "Medicube P3 missing from V2.1-6 artifact");
  const p3Family = (p3.axis.signal_families || []).find((family) => family.signal_family === "exfoliating_active_identity");
  assert.ok(p3Family, "Medicube P3 active identity family missing");
  assert.equal(p3Family.raw_fact_count, 2);
  assert.equal(p3Family.contribution_units, 1);

  const overlapCases = uniqueOverlapCases(candidateEvaluations);
  assert.ok(overlapCases.length >= 1, "no real current-path semantic overlap case found");

  const stateCounts = countBy(candidateEvaluations, (item) => item.shadow.state);
  const axisMatchedProducts = [...new Set(candidateEvaluations.filter((item) => item.product_axis_inputs.length > 0).map((item) => item.product_id))].sort();
  const identityBlocked = candidateEvaluations.filter((item) => item.shadow.state === "IDENTITY_BLOCKED");
  const held = candidateEvaluations.filter((item) => item.shadow.state === "HELD_UNCALIBRATED");
  const noInput = candidateEvaluations.filter((item) => item.shadow.state === "NO_APPROVED_AXIS_INPUT");
  const computed = candidateEvaluations.filter((item) => item.shadow.state === "COMPUTED");
  assert.equal(computed.length, 0, "V2.1-7 cannot compute unapproved numeric shadow ranking");
  assert.ok(candidateEvaluations.every((item) => item.shadow.score === null && item.shadow.rank === null));
  assert.ok(candidateEvaluations.every((item) => item.utility.numeric_contribution === null));

  const artifact = {
    version: VERSION,
    stage: "V2.1-7 Shadow Recommendation",
    authority: {
      base_main_sha: BASE_MAIN_SHA,
      cleanser_axis_sha256: CLEANSER_AXIS_SHA256,
      cross_category_axis_sha256: CROSS_AXIS_SHA256,
      legacy_reference_sha: LEGACY_REFERENCE_SHA,
      legacy_products_canonical_sha256: LEGACY_PRODUCTS_SHA256,
      legacy_scenarios_canonical_sha256: LEGACY_SCENARIOS_SHA256,
      current_legacy_invariance_verifier_blob: LEGACY_VERIFIER_BLOB,
      current_decision_engine_blob: DECISION_ENGINE_BLOB,
    },
    shadow_contract: {
      production_replacement: false,
      counterfactual_numeric_lane: "DISABLED",
      numeric_policy_authorized: false,
      null_axis_numeric_contribution: "NOT_AUTHORIZED",
      constraints_before_utility: true,
      utility_can_override_block: false,
      direct_product_fact_to_score_edge: false,
      fixture_boundary: { fixture_only: true, hosted_current: false },
      catalog_adoption_inferred: false,
    },
    summary: {
      legacy_products: productsFixture.productCount,
      scenarios: scenarioFixture.scenarioCount,
      candidate_evaluations: candidateEvaluations.length,
      axis_fixture_products_matching_legacy_catalog: axisMatchedProducts.length,
      held_uncalibrated: held.length,
      no_approved_axis_input: noInput.length,
      identity_blocked: identityBlocked.length,
      computed: computed.length,
      shadow_state_counts: stateCounts,
      numeric_shadow_contributions: 0,
    },
    scenario_results: scenarioResults,
    candidate_evaluations: candidateEvaluations,
    duplication_audit: {
      audited_families: [
        "product_concern_metadata",
        "ingredient_signal",
        "review_signal",
        "market_signal",
        "hero_boost",
        "hard_penalty",
        "derived_metadata",
        "decision_axis",
      ],
      real_current_path_overlap_cases: overlapCases,
      medicube_p3: {
        product_id: p3.product_id,
        pilot_id: "P3",
        semantic_family: "exfoliating_active_identity",
        raw_fact_count: p3Family.raw_fact_count,
        contribution_units: p3Family.contribution_units,
        dedupe_result: "PASS_ONE_FAMILY_UNIT_NO_SHADOW_NUMERIC_STACKING",
      },
    },
    constraint_summary: {
      identity_blocked_candidates: identityBlocked.length,
      production_constraint_changes: 0,
      blocked_candidate_utility_revivals: 0,
    },
    utility_summary: {
      numeric_contributions: 0,
      held_uncalibrated: held.length,
      new_weights: 0,
    },
    uncalibrated_hold_summary: {
      total: held.length,
      rule: "estimate_null_cannot_create_numeric_score_contribution",
      counterfactual_numeric_lane: "COUNTERFACTUAL_NUMERIC_LANE_NOT_AUTHORIZED",
    },
    lineage_summary: {
      candidate_evaluations_with_axis_input: candidateEvaluations.filter((item) => item.product_axis_inputs.length > 0).length,
      applicable_axis_evaluations_with_lineage: candidateEvaluations.filter((item) => item.applicable_product_axes.length > 0).every((item) => item.lineage.length > 0),
      direct_product_fact_to_score_edges: 0,
    },
    production_invariance: {
      product_score_delta: 0,
      ranking_delta: 0,
      top_pick_delta: 0,
      top3_delta: 0,
      eligibility_delta: 0,
      public_response_delta: 0,
      explanation_projection_delta: 0,
      persistence_projection_delta: 0,
      candidate_policy_fingerprint_delta: 0,
      legacy_replay: "PASS",
    },
    lifecycle: {
      V21_7_SHADOW_RECOMMENDATION_OFFLINE_VERIFIED: true,
      OFFLINE_SHADOW_CONSUMPTION: true,
      PRODUCT_FACT_CATALOG_ADOPTED: false,
      CATALOG_ADOPTED: false,
      PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED: false,
      DECISION_AXIS_PRODUCTION_CONSUMPTION: false,
      RECOMMENDATION_SCORER_CHANGED: false,
      RECOMMENDATION_ACTIVATED: false,
      HOSTED_PRODUCT_FACT_WRITES_V21_7: 0,
    },
  };

  return stable(artifact);
}

export function renderMarkdown(artifact) {
  const s = artifact.summary;
  const p = artifact.production_invariance;
  const states = Object.entries(s.shadow_state_counts).map(([key, value]) => `- ${key}: ${value}`).join("\n");
  return `# V2.1-7 — Product Decision Axis Shadow Recommendation v1\n\n` +
    `## Boundary\n\n` +
    `This artifact compares the current durable Legacy Recommendation replay with an offline Decision-Axis shadow evaluation. It does not replace, import into, or mutate Production recommendation scoring.\n\n` +
    `- Base main: \`${artifact.authority.base_main_sha}\`\n` +
    `- Legacy products: ${s.legacy_products}\n` +
    `- Scenarios: ${s.scenarios}\n` +
    `- Candidate evaluations: ${s.candidate_evaluations}\n` +
    `- Axis-fixture products matching the legacy catalog: ${s.axis_fixture_products_matching_legacy_catalog}\n` +
    `- Numeric shadow contributions: ${s.numeric_shadow_contributions}\n\n` +
    `## Shadow states\n\n${states}\n\n` +
    `The current V2.1-5/V2.1-6 Decision Axes are not numerically calibrated. Therefore an axis with \`estimate=null\` is held rather than converted into a score, multiplier, penalty, or rank transition. \`HELD_UNCALIBRATED\` is an intentional success state.\n\n` +
    `## Constraint / Utility\n\n` +
    `Identity and conflict conditions are evaluated before Utility. A blocked candidate cannot be revived by positive Utility. No Production constraint is activated and no new numeric weight exists.\n\n` +
    `## Duplication ledger\n\n` +
    `The ledger audits product concern metadata, ingredient, review, market, hero, hard-penalty, derived-metadata, and Decision-Axis pathways. Semantic overlap is recorded without assuming evidence identity. Overlapping Decision-Axis signals remain non-additive while uncalibrated. Medicube P3 preserves two raw exfoliating active Facts but one \`exfoliating_active_identity\` family contribution unit.\n\n` +
    `## Production invariance\n\n` +
    `- score delta: ${p.product_score_delta}\n` +
    `- ranking delta: ${p.ranking_delta}\n` +
    `- Top Pick delta: ${p.top_pick_delta}\n` +
    `- Top3 delta: ${p.top3_delta}\n` +
    `- eligibility delta: ${p.eligibility_delta}\n` +
    `- public response delta: ${p.public_response_delta}\n` +
    `- persistence projection delta: ${p.persistence_projection_delta}\n` +
    `- CandidatePolicy fingerprint delta: ${p.candidate_policy_fingerprint_delta}\n\n` +
    `## Lifecycle\n\n` +
    `\`OFFLINE_SHADOW_CONSUMPTION = YES\`\n\n` +
    `\`DECISION_AXIS_PRODUCTION_CONSUMPTION = NO\`\n\n` +
    `\`RECOMMENDATION_SCORER_CHANGED = NO\`\n\n` +
    `\`RECOMMENDATION_ACTIVATED = NO\`\n\n` +
    `\`HOSTED_PRODUCT_FACT_WRITES_V21_7 = 0\`\n`;
}

export async function writeArtifacts() {
  const artifact = await buildArtifact();
  const json = `${JSON.stringify(artifact, null, 2)}\n`;
  const md = renderMarkdown(artifact);
  await mkdir(path.dirname(OUT_JSON), { recursive: true });
  await mkdir(path.dirname(OUT_MD), { recursive: true });
  await writeFile(OUT_JSON, json, "utf8");
  await writeFile(OUT_MD, md, "utf8");
  return {
    artifact,
    json_sha256: sha256Bytes(Buffer.from(json)),
    md_sha256: sha256Bytes(Buffer.from(md)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await writeArtifacts();
  console.log(`PASS build-product-decision-axis-shadow-recommendation-v1 products=${result.artifact.summary.legacy_products} scenarios=${result.artifact.summary.scenarios} evaluations=${result.artifact.summary.candidate_evaluations}`);
  console.log(`held_uncalibrated=${result.artifact.summary.held_uncalibrated} no_approved_axis_input=${result.artifact.summary.no_approved_axis_input} identity_blocked=${result.artifact.summary.identity_blocked} computed=${result.artifact.summary.computed}`);
  console.log(`json_sha256=${result.json_sha256}`);
  console.log(`md_sha256=${result.md_sha256}`);
  console.log("production_delta=0 hosted_writes=0 recommendation_activation=NO");
}
