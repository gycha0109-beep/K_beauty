import assert from "node:assert/strict";
import {
  evaluateFunctionalRankingCandidate,
  FUNCTIONAL_RANKING_SCORE_WEIGHTS
} from "../lib/functional-ranking-contract.js";
import { resolveFunctionalGoalPolicy } from "../lib/functional-goal-policy.js";
import { resolveProductFunctionalProfile } from "../lib/product-functional-profile.js";

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

function goalPolicy(primaryConcern, priorityAxis = primaryConcern, safety = {}) {
  return resolveFunctionalGoalPolicy({
    surveyContract: {
      goals: { primaryConcern },
      safety
    },
    freeResultPriority: priorityAxis ? { axis: priorityAxis } : null
  });
}

function product(overrides = {}) {
  return {
    id: "fixture-product",
    category: "moisturizer_cream",
    product_form: "cream",
    skin_types: ["dry"],
    concerns: ["dehydration"],
    texture: "cream",
    finish: "dewy",
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

function evaluate({ product: inputProduct, surveyContract, policy, currentProductFindings } = {}) {
  const resolvedProduct = inputProduct || product();
  return evaluateFunctionalRankingCandidate({
    product: resolvedProduct,
    surveyContract: surveyContract || survey(),
    goalPolicy: policy || goalPolicy("dehydration", "dehydration"),
    productProfile: resolveProductFunctionalProfile(resolvedProduct),
    currentProductFindings
  });
}

function assertBreakdownShape(result) {
  const maxTotal = Object.values(FUNCTIONAL_RANKING_SCORE_WEIGHTS)
    .reduce((total, value) => total + value, 0);

  assert.equal(maxTotal, 100);
  assert.equal(result.scoreBreakdown.functionalFit.max, 30);
  assert.equal(result.scoreBreakdown.skinFit.max, 20);
  assert.equal(result.scoreBreakdown.safetyFit.max, 20);
  assert.equal(result.scoreBreakdown.preferenceFit.max, 10);
  assert.equal(result.scoreBreakdown.routineFit.max, 10);
  assert.equal(result.scoreBreakdown.evidenceQuality.max, 5);
  assert.equal(result.scoreBreakdown.reviewSignal.max, 5);
  assert.ok(Array.isArray(result.reasons));
  assert.ok(Array.isArray(result.penalties));

  if (result.totalScore != null) {
    assert.ok(result.totalScore >= 0);
    assert.ok(result.totalScore <= 100);
  }
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

runCase("hydration dry tight moisturizer passes with high functional and skin fit", () => {
  const result = evaluate();

  assert.equal(result.eligible, true);
  assert.equal(result.hardFilterStatus, "pass");
  assert.ok(result.scoreBreakdown.functionalFit.score >= 20);
  assert.ok(result.scoreBreakdown.skinFit.score >= 14);
  assert.ok(result.scoreBreakdown.safetyFit.score >= 16);
  assert.ok(result.reasons.length > 0);
  assertBreakdownShape(result);
});

runCase("pores exfoliation treatment scores higher than cleanser for active functional fit", () => {
  const contract = survey({
    skinState: {
      skinType: "oily",
      postWashFeeling: "still_oily",
      afternoonSkinChange: "more_oily"
    },
    goals: { primaryConcern: "pores" },
    safety: { drynessRisk: "low" },
    preferences: { preferredTexture: "gel" }
  });
  const policy = goalPolicy("pores", "pores", contract.safety);
  const treatment = product({
    id: "pores-treatment",
    category: "treatment",
    product_form: "serum",
    skin_types: ["oily"],
    concerns: ["pores"],
    texture: "gel",
    finish: "fresh",
    ingredient_signals: {
      functional: [{ label: "exfoliation", count: 8 }]
    }
  });
  const cleanser = product({
    id: "pores-cleanser",
    category: "cleanser",
    product_form: "gel",
    skin_types: ["oily"],
    concerns: ["pores"],
    texture: "gel",
    finish: "fresh",
    ingredient_signals: {
      functional: [{ label: "exfoliation", count: 8 }]
    }
  });
  const treatmentResult = evaluate({ product: treatment, surveyContract: contract, policy });
  const cleanserResult = evaluate({ product: cleanser, surveyContract: contract, policy });

  assert.equal(treatmentResult.hardFilterStatus, "pass");
  assert.equal(cleanserResult.hardFilterStatus, "pass");
  assert.ok(treatmentResult.scoreBreakdown.functionalFit.score > cleanserResult.scoreBreakdown.functionalFit.score);
});

runCase("high sensitivity redness and high irritation product is blocked", () => {
  const contract = survey({
    goals: { primaryConcern: "redness" },
    safety: {
      sensitivityRisk: "high",
      rednessRisk: "high",
      drynessRisk: "low"
    }
  });
  const result = evaluate({
    product: product({
      id: "high-irritation-active",
      concerns: ["redness"],
      irritation_risk: "high",
      sensitivity_safe: false,
      ingredient_signals: {
        functional: [{ label: "soothing/astringent", count: 4 }]
      }
    }),
    surveyContract: contract,
    policy: goalPolicy("redness", "redness", contract.safety)
  });

  assert.equal(result.eligible, false);
  assert.equal(result.hardFilterStatus, "blocked");
  assert.equal(result.totalScore, null);
  assert.ok(result.hardFilterReasons.length > 0);
});

runCase("high dryness recent change blocks aggressive tone-care active", () => {
  const contract = survey({
    goals: { primaryConcern: "uneven_tone" },
    safety: {
      sensitivityRisk: "medium",
      drynessRisk: "high",
      rednessRisk: "low",
      recentSkinChange: "yes",
      recentlyChangedProduct: "no"
    }
  });
  const result = evaluate({
    product: product({
      id: "tone-active",
      category: "treatment",
      concerns: ["uneven_tone"],
      texture: "lotion",
      ingredient_signals: {
        functional: [{ label: "whitening", count: 8 }]
      }
    }),
    surveyContract: contract,
    policy: goalPolicy("uneven_tone", "dehydration", contract.safety)
  });

  assert.equal(result.hardFilterStatus, "blocked");
  assert.ok(result.hardFilterReasons.some((reason) => reason.includes("Recent instability")));
});

runCase("sunscreen answered eyeSensitive true and high eye-sting is blocked", () => {
  const contract = survey({
    goals: { primaryConcern: "uv" },
    sunscreen: {
      sourceCompleteness: "answered",
      eyeSensitive: true,
      whiteCastHate: false,
      makeupUse: false,
      toneUpWanted: false
    }
  });
  const result = evaluate({
    product: product({
      id: "eye-sting-sunscreen",
      category: "sunscreen",
      concerns: ["uv"],
      texture: "lotion",
      finish: "natural",
      eye_sting: "high",
      white_cast: "none",
      pilling_risk: "low",
      ingredient_signals: {
        functional: [{ label: "uv protection", count: 5 }]
      }
    }),
    surveyContract: contract,
    policy: goalPolicy("uv", "uv", contract.safety)
  });

  assert.equal(result.hardFilterStatus, "blocked");
  assert.ok(result.hardFilterReasons.some((reason) => reason.includes("Eye sensitivity")));
});

runCase("sunscreen skipped false booleans do not create hard filter", () => {
  const contract = survey({
    goals: { primaryConcern: "uv" },
    sunscreen: {
      sourceCompleteness: "skipped",
      eyeSensitive: false,
      whiteCastHate: false,
      makeupUse: false,
      toneUpWanted: false
    }
  });
  const result = evaluate({
    product: product({
      id: "skipped-sunscreen",
      category: "sunscreen",
      concerns: ["uv"],
      eye_sting: "high",
      white_cast: "high",
      pilling_risk: "high",
      ingredient_signals: {
        functional: [{ label: "uv protection", count: 5 }]
      }
    }),
    surveyContract: contract,
    policy: goalPolicy("uv", "uv", contract.safety)
  });

  assert.equal(result.hardFilterStatus, "pass");
});

runCase("same-axis selected current product lowers routine fit without replacement judgment", () => {
  const result = evaluate({
    currentProductFindings: {
      findings: [
        {
          productId: "selected-hydration",
          relationToPlan: "supports_goal",
          sourceState: "selected"
        }
      ]
    }
  });

  assert.equal(result.hardFilterStatus, "pass");
  assert.ok(result.scoreBreakdown.routineFit.score < 6);
  assert.ok(result.penalties.some((penalty) => penalty.includes("similar purpose")));
  assert.equal(result.rankingContext.currentRoutineRelation, "supports_goal_existing");
});

runCase("sparse unevaluable product is insufficient data with low confidence", () => {
  const result = evaluate({
    product: {
      id: "sparse-product",
      category: "serum"
    }
  });

  assert.equal(result.eligible, false);
  assert.equal(result.hardFilterStatus, "insufficient_data");
  assert.equal(result.totalScore, null);
  assert.equal(result.confidence, "low");
});

runCase("primary pores and safety oiliness tension preserves ranking goal", () => {
  const contract = survey({
    goals: { primaryConcern: "pores" },
    safety: { drynessRisk: "low" }
  });
  const policy = goalPolicy("pores", "oiliness", contract.safety);
  const result = evaluate({
    product: product({
      id: "pores-tension-product",
      category: "treatment",
      concerns: ["pores"],
      ingredient_signals: {
        functional: [{ label: "exfoliation", count: 7 }]
      }
    }),
    surveyContract: contract,
    policy
  });

  assert.equal(result.rankingContext.rankingGoal, "pores");
  assert.equal(result.rankingContext.safetyGoal, "oiliness");
  assert.equal(result.rankingContext.hasTension, true);
});

runCase("score totals clamp and arrays are always present", () => {
  const result = evaluate();

  assertBreakdownShape(result);
  assert.ok(result.scoreBreakdown.totalBeforePenalty <= 100);
  assert.ok(result.scoreBreakdown.totalAfterPenalty <= 100);
});
