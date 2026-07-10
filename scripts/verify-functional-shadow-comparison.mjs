import assert from "node:assert/strict";
import {
  buildExistingRecommendationSnapshot,
  resolveShadowAuditCandidateSource
} from "../lib/functional-shadow-adapter.js";
import { compareFunctionalShadowResults } from "../lib/functional-shadow-comparison.js";
import { buildFunctionalCandidateAudit } from "../lib/functional-candidate-audit.js";
import { resolveFunctionalGoalPolicy } from "../lib/functional-goal-policy.js";

function survey(overrides = {}) {
  return {
    skinState: {
      skinType: "dry",
      sensitivity: "low",
      postWashFeeling: "tight",
      afternoonSkinChange: "more_dry",
      ...(overrides.skinState || {})
    },
    goals: {
      primaryConcern: "dehydration",
      secondaryConcerns: [],
      ...(overrides.goals || {})
    },
    safety: {
      recentSkinChange: "no",
      recentlyChangedProduct: "no",
      sensitivityRisk: "low",
      drynessRisk: "high",
      rednessRisk: "low",
      ...(overrides.safety || {})
    },
    preferences: {
      preferredTexture: "cream",
      mostDislikedFeel: "sticky",
      ...(overrides.preferences || {})
    },
    sunscreen: {
      whiteCastHate: false,
      toneUpWanted: false,
      makeupUse: false,
      eyeSensitive: false,
      sourceCompleteness: "answered",
      ...(overrides.sunscreen || {})
    }
  };
}

function policy(contract = survey(), primaryConcern = contract.goals.primaryConcern, priorityAxis = primaryConcern) {
  return resolveFunctionalGoalPolicy({
    surveyContract: {
      goals: { primaryConcern },
      safety: contract.safety
    },
    freeResultPriority: priorityAxis ? { axis: priorityAxis } : null
  });
}

function product(overrides = {}) {
  return {
    id: "shadow-product",
    category: "moisturizer_cream",
    product_form: "cream",
    skin_types: ["dry"],
    concerns: ["dehydration"],
    texture: "cream",
    finish: "natural",
    irritation_risk: "low",
    sensitivity_safe: true,
    ingredient_signals: {
      functional: [
        { label: "skin hydration", count: 8 },
        { label: "moisture evaporation blocking", count: 4 }
      ]
    },
    market_signals: {
      review_count: 2000,
      rating: 4.5
    },
    ...overrides
  };
}

function existingResult({ topPick, supportingProducts = [], budgetAlternatives = [], coverage = "complete" } = {}) {
  return {
    candidateSourceCoverage: coverage,
    topPick,
    premiumReport: {
      supportingProducts,
      budgetAlternatives
    }
  };
}

function audit(products, contract = survey(), goalPolicy = policy(contract)) {
  return buildFunctionalCandidateAudit({
    products,
    surveyContract: contract,
    goalPolicy,
    options: {
      includeBlocked: true,
      includeInsufficientData: true,
      maxRankedCandidates: 20
    }
  });
}

function compare({ existing, products, contract = survey(), goalPolicy = policy(contract) }) {
  const existingSnapshot = buildExistingRecommendationSnapshot(existing);
  const functionalAudit = audit(products, contract, goalPolicy);

  return {
    existingSnapshot,
    functionalAudit,
    comparison: compareFunctionalShadowResults({
      existingSnapshot,
      functionalAudit
    })
  };
}

function types(comparison) {
  return comparison.divergences.map((item) => item.type);
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

runCase("complete overlap has rate 1 and high comparison confidence", () => {
  const products = [
    product({ id: "a-top" }),
    product({ id: "b-support" }),
    product({ id: "c-budget" })
  ];
  const { comparison } = compare({
    existing: existingResult({
      topPick: products[0],
      supportingProducts: [products[1]],
      budgetAlternatives: [products[2]]
    }),
    products
  });

  assert.equal(comparison.comparisonSummary.overlapRate, 1);
  assert.equal(comparison.comparisonSummary.topPickMatch, true);
  assert.equal(comparison.comparisonSummary.comparisonConfidence, "high");
});

runCase("existing selected product blocked creates blocked divergence with reason", () => {
  const contract = survey({
    goals: { primaryConcern: "redness" },
    safety: {
      sensitivityRisk: "high",
      rednessRisk: "high",
      drynessRisk: "low"
    }
  });
  const blocked = product({
    id: "blocked-existing",
    concerns: ["redness"],
    irritation_risk: "high",
    sensitivity_safe: false,
    ingredient_signals: {
      functional: [{ label: "soothing/astringent", count: 4 }]
    }
  });
  const { comparison } = compare({
    existing: existingResult({ topPick: blocked }),
    products: [blocked],
    contract,
    goalPolicy: policy(contract, "redness", "redness")
  });

  assert.ok(types(comparison).includes("existing_selected_but_blocked"));
  assert.equal(comparison.candidateStatusComparison.existingSelectedButBlocked[0], "blocked-existing");
  assert.ok(comparison.divergences.find((item) => item.type === "existing_selected_but_blocked").reasons.length > 0);
});

runCase("existing selected product insufficient data creates insufficient divergence", () => {
  const sparse = { id: "sparse-existing", category: "serum" };
  const { comparison } = compare({
    existing: existingResult({ topPick: sparse }),
    products: [sparse]
  });

  assert.ok(types(comparison).includes("existing_selected_but_insufficient_data"));
  assert.equal(comparison.candidateStatusComparison.existingSelectedButInsufficientData[0], "sparse-existing");
});

runCase("functional top candidate missing from existing is reported", () => {
  const products = [
    product({ id: "functional-winner" }),
    product({
      id: "legacy-pick",
      ingredient_signals: { functional: [{ label: "skin hydration", count: 1 }] },
      market_signals: null
    })
  ];
  const { comparison } = compare({
    existing: existingResult({ topPick: products[1] }),
    products
  });

  assert.ok(types(comparison).includes("functional_top_candidate_missing_from_existing"));
  assert.equal(comparison.candidateStatusComparison.functionalTopCandidatesNotInExisting[0], "functional-winner");
});

runCase("topPick mismatch records both top ids", () => {
  const products = [
    product({ id: "functional-top" }),
    product({
      id: "existing-top",
      ingredient_signals: { functional: [{ label: "skin hydration", count: 1 }] },
      market_signals: null
    })
  ];
  const { comparison } = compare({
    existing: existingResult({ topPick: products[1] }),
    products
  });

  assert.ok(types(comparison).includes("top_pick_mismatch"));
  assert.equal(comparison.topPickComparison.existingTopPickId, "existing-top");
  assert.equal(comparison.topPickComparison.functionalTopPickId, "functional-top");
  assert.equal(comparison.topPickComparison.matches, false);
});

runCase("category comparison separates existing and functional status distributions", () => {
  const blocked = product({
    id: "category-blocked",
    category: "treatment",
    irritation_risk: "high",
    sensitivity_safe: false
  });
  const sparse = { id: "category-sparse", category: "serum" };
  const contract = survey({
    safety: {
      sensitivityRisk: "high",
      drynessRisk: "low",
      rednessRisk: "high"
    }
  });
  const { comparison } = compare({
    existing: existingResult({
      topPick: product({ id: "category-ranked" }),
      supportingProducts: [blocked],
      budgetAlternatives: [sparse]
    }),
    products: [product({ id: "category-ranked" }), blocked, sparse],
    contract,
    goalPolicy: policy(contract)
  });

  assert.equal(comparison.categoryComparison.existing.moisturizer_cream, 1);
  assert.equal(comparison.categoryComparison.functionalRanked.moisturizer_cream, 1);
  assert.equal(comparison.categoryComparison.functionalBlocked.treatment, 1);
  assert.equal(comparison.categoryComparison.functionalInsufficientData.serum, 1);
});

runCase("candidate source incomplete produces low confidence note", () => {
  const existing = buildExistingRecommendationSnapshot({
    topPick: product({ id: "final-only" })
  });
  const source = resolveShadowAuditCandidateSource({
    existingRecommendationSnapshot: existing
  });
  const functionalAudit = audit(source.products);
  const comparison = compareFunctionalShadowResults({
    existingSnapshot: existing,
    functionalAudit
  });

  assert.equal(source.sourceType, "selected_result_snapshot");
  assert.ok(types(comparison).includes("candidate_source_incomplete"));
  assert.equal(comparison.comparisonSummary.comparisonConfidence, "low");
});

runCase("legacy result without product IDs does not throw and has low confidence", () => {
  const existing = buildExistingRecommendationSnapshot({
    topPick: { category: "serum" },
    candidateSourceCoverage: "complete"
  });
  const comparison = compareFunctionalShadowResults({
    existingSnapshot: existing,
    functionalAudit: audit([product({ id: "functional-only" })])
  });

  assert.ok(types(comparison).includes("no_comparable_product_ids"));
  assert.equal(comparison.comparisonSummary.comparisonConfidence, "low");
});

runCase("empty existing result compares against functional audit without throwing", () => {
  const existing = buildExistingRecommendationSnapshot({
    candidateSourceCoverage: "complete"
  });
  const comparison = compareFunctionalShadowResults({
    existingSnapshot: existing,
    functionalAudit: audit([product({ id: "functional-only" })])
  });

  assert.equal(comparison.comparisonSummary.existingUniqueCount, 0);
  assert.equal(comparison.comparisonSummary.overlapCount, 0);
  assert.ok(comparison.policyNotes.some((note) => note.includes("audit-only")));
});

runCase("comparison output stays deterministic when candidate input order changes", () => {
  const products = [
    product({ id: "det-a" }),
    product({ id: "det-b" }),
    product({ id: "det-c" })
  ];
  const existing = existingResult({
    topPick: products[0],
    supportingProducts: [products[1]],
    budgetAlternatives: [products[2]]
  });
  const first = compare({ existing, products }).comparison;
  const second = compare({ existing, products: products.slice().reverse() }).comparison;

  assert.deepEqual(first.comparisonSummary, second.comparisonSummary);
  assert.deepEqual(first.overlap, second.overlap);
  assert.deepEqual(first.divergences, second.divergences);
});
