import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  buildRecentInstabilityGuardMatrixContexts,
  evaluateRecentInstabilityGuardMatrix
} from "./run-recent-instability-guard-matrix.mjs";

function functionalSignals(labels) {
  return {
    functional: labels.map((label, index) => ({ label, count: index === 0 ? 5 : 1 }))
  };
}

function product(overrides = {}) {
  return {
    id: Object.prototype.hasOwnProperty.call(overrides, "id") ? overrides.id : "product-a",
    category: Object.prototype.hasOwnProperty.call(overrides, "category") ? overrides.category : "treatment",
    irritation_risk: Object.prototype.hasOwnProperty.call(overrides, "irritation_risk") ? overrides.irritation_risk : "low",
    sensitivity_safe: Object.prototype.hasOwnProperty.call(overrides, "sensitivity_safe") ? overrides.sensitivity_safe : true,
    ingredient_signals: overrides.ingredient_signals || functionalSignals(["skin hydration", "skin protection"]),
    ...overrides
  };
}

function capture({ id = "cap-a", completeness = "complete", products = [] } = {}) {
  return {
    captureVersion: "v1",
    captureId: id,
    candidateSource: {
      completeness,
      sourceStage: completeness === "complete" ? "post_score_candidate_pool" : "final_results_only",
      sourceCount: products.length,
      candidateIdentityMode: completeness === "complete" ? "product_row" : "product_id_only",
      products
    },
    survey: { safety: {} },
    goalPolicy: { rankingGoal: "acne", safetyGoal: "redness", recommendationGuard: "stabilize_first" }
  };
}

function buildMatrix() {
  return evaluateRecentInstabilityGuardMatrix({
    generatedAt: "2026-07-03T00:00:00.000Z",
    captures: [
      capture({
        id: "complete-a",
        products: [
          product({
            id: "safe-low",
            category: "toner_pad",
            irritation_risk: "low",
            sensitivity_safe: true,
            ingredient_signals: functionalSignals(["skin hydration", "skin protection", "tone_care"])
          }),
          product({
            id: "safe-medium",
            category: "serum",
            irritation_risk: "medium",
            sensitivity_safe: true,
            ingredient_signals: functionalSignals(["skin hydration", "skin protection", "whitening"])
          }),
          product({
            id: "unsafe-high",
            category: "treatment",
            irritation_risk: "high",
            sensitivity_safe: false,
            ingredient_signals: functionalSignals(["whitening", "exfoliation"])
          }),
          product({
            id: "metadata-missing",
            category: "essence",
            irritation_risk: undefined,
            sensitivity_safe: undefined,
            ingredient_signals: { functional: [] }
          }),
          product({
            id: "stabilizing",
            category: "moisturizer_cream",
            irritation_risk: "low",
            sensitivity_safe: true,
            ingredient_signals: functionalSignals(["skin hydration", "skin protection", "soothing/astringent"])
          }),
          product({
            id: "no-category",
            category: "",
            irritation_risk: "low",
            sensitivity_safe: true,
            ingredient_signals: functionalSignals(["skin hydration"])
          })
        ]
      })
    ],
    excludedFixtures: [{ reason: "final_results_only" }]
  });
}

function context(matrix, id) {
  return matrix.byContext.find((item) => item.contextId === id);
}

async function runCase(name, fn) {
  await fn();
  console.log(`ok - ${name}`);
}

await runCase("complete fixtures only are targeted and final-results-only is recorded as excluded", () => {
  const matrix = buildMatrix();

  assert.equal(matrix.sourceScope.includedCompleteCaptureCount, 1);
  assert.equal(matrix.sourceScope.excludedFixtureCount, 1);
  assert.equal(matrix.sourceScope.excludedFixturesByReason.final_results_only, 1);
});

await runCase("matrix creates at least 12 contexts", () => {
  assert.equal(buildRecentInstabilityGuardMatrixContexts().length, 12);
  assert.equal(buildMatrix().contexts.length, 12);
});

await runCase("unsafe high-risk products remain hard-block candidates under both high sensitivity and instability", () => {
  const matrix = buildMatrix();
  const item = context(matrix, "both_high_sensitivity_and_recent_instability__acne_redness");

  assert.ok(item.bySafetyMetadataProfile.unsafe_high_risk.hard_block_candidate > 0);
});

await runCase("safe low-risk products are collapsed exposure candidates, not hard blocks, under recent instability only", () => {
  const matrix = buildMatrix();
  const item = context(matrix, "recent_instability_only__acne_redness");

  assert.equal(item.bySafetyMetadataProfile.safe_low_risk.hard_block_candidate, 0);
  assert.ok(item.bySafetyMetadataProfile.safe_low_risk.collapsed_exposure_candidate > 0);
});

await runCase("baseline context does not apply recent-instability guard", () => {
  const matrix = buildMatrix();
  const item = context(matrix, "baseline_no_instability__redness_redness");

  assert.ok(item.decisions.no_guard > 0);
  assert.equal(item.decisions.hard_block_candidate, 0);
});

await runCase("metadata incomplete products go to insufficient data and metadata review", () => {
  const matrix = buildMatrix();
  const item = context(matrix, "recent_instability_only__redness_redness");

  assert.equal(item.bySafetyMetadataProfile.metadata_incomplete.hard_block_candidate, 0);
  assert.ok(item.bySafetyMetadataProfile.metadata_incomplete.insufficient_data > 0);
  assert.ok(item.implementationHints.needs_metadata_review > 0);
});

await runCase("stabilizing profile is not hard-blocked by hydration or barrier-support axes alone", () => {
  const matrix = buildMatrix();
  const item = context(matrix, "recent_instability_only__dehydration_redness");

  assert.equal(item.byFunctionalProfile.stabilizing_leaning.hard_block_candidate, 0);
});

await runCase("active profile with low-risk safe metadata is not automatically hard-blocked", () => {
  const matrix = buildMatrix();
  const item = context(matrix, "recent_instability_only__acne_redness");

  assert.equal(item.bySafetyMetadataProfile.safe_low_risk.hard_block_candidate, 0);
});

await runCase("category distribution keeps unknown category without making category a hard-block reason", () => {
  const matrix = buildMatrix();
  const item = context(matrix, "baseline_no_instability__acne_redness");

  assert.ok(item.byCategory.unknown.no_guard > 0);
  assert.equal(item.byCategory.unknown.hard_block_candidate, 0);
});

await runCase("output is deterministic for reordered products", () => {
  const first = buildMatrix();
  const second = evaluateRecentInstabilityGuardMatrix({
    generatedAt: "2026-07-03T00:00:00.000Z",
    captures: [
      capture({
        id: "complete-a",
        products: [...capture({
          products: [
            product({ id: "safe-low", category: "toner_pad", irritation_risk: "low", sensitivity_safe: true, ingredient_signals: functionalSignals(["skin hydration", "tone_care"]) }),
            product({ id: "unsafe-high", category: "treatment", irritation_risk: "high", sensitivity_safe: false, ingredient_signals: functionalSignals(["whitening", "exfoliation"]) }),
            product({ id: "metadata-missing", category: "essence", irritation_risk: undefined, sensitivity_safe: undefined, ingredient_signals: { functional: [] } })
          ]
        }).candidateSource.products].reverse()
      })
    ],
    excludedFixtures: [{ reason: "final_results_only" }]
  });

  assert.deepEqual(first.contexts.map((item) => item.contextId), second.contexts.map((item) => item.contextId));
  assert.equal(first.byContext[0].contextId, second.byContext[0].contextId);
});

await runCase("matrix output excludes raw and identifying data strings", () => {
  const raw = JSON.stringify(buildMatrix()).toLowerCase();
  [
    "raw form",
    "base64",
    "filename",
    "filepath",
    "email",
    "session",
    "cookie",
    "user-agent",
    "product name",
    "brand",
    "purchase url",
    "review text"
  ].forEach((token) => assert.equal(raw.includes(token), false, token));
});

await runCase("matrix script and policy helper are not wired into route, evaluator, or UI policy", async () => {
  const route = await readFile("app/api/analyze/route.js", "utf8");
  const evaluator = await readFile("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = await readFile("lib/functional-candidate-policy.js", "utf8");

  assert.equal(route.includes("run-recent-instability-guard-matrix"), false);
  assert.equal(evaluator.includes("recent-instability-guard-policy"), false);
  assert.equal(candidatePolicy.includes("recent-instability-guard-policy"), false);
});

await runCase("local matrix runner executes against current fixtures", () => {
  const output = execFileSync("node", ["scripts/run-recent-instability-guard-matrix.mjs"], {
    encoding: "utf8"
  });

  assert.ok(output.includes("recent-instability-guard-matrix summary"));
});
