import assert from "node:assert/strict";
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

function policy(primaryConcern = "dehydration", priorityAxis = primaryConcern, safety = {}) {
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
    id: "base-product",
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

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

runCase("normal candidates are sorted with rank and deterministic fallback", () => {
  const products = [
    product({
      id: "rank-c",
      ingredient_signals: { functional: [{ label: "skin hydration", count: 2 }] },
      market_signals: null
    }),
    product({ id: "rank-a" }),
    product({
      id: "rank-b",
      ingredient_signals: {
        functional: [
          { label: "skin hydration", count: 8 },
          { label: "moisture evaporation blocking", count: 4 }
        ]
      },
      market_signals: {
        review_count: 2000,
        rating: 4.5
      }
    })
  ];
  const audit = buildFunctionalCandidateAudit({
    products,
    surveyContract: survey(),
    goalPolicy: policy(),
    options: { maxRankedCandidates: 10 }
  });

  assert.equal(audit.rankedCandidates.length, 3);
  assert.deepEqual(audit.rankedCandidates.map((item) => item.rank), [1, 2, 3]);
  assert.ok(audit.rankedCandidates[0].evaluation.totalScore >= audit.rankedCandidates[1].evaluation.totalScore);
  assert.equal(audit.rankedCandidates[0].product.id, "rank-a");
  assert.equal(audit.rankedCandidates[1].product.id, "rank-b");
  assert.equal(audit.summary.rankedCount, 3);
  assert.equal(audit.summary.returnedRankedCount, 3);
});

runCase("same score uses confidence before deterministic fallback", () => {
  const contract = survey({
    skinState: {
      skinType: "dry",
      postWashFeeling: "comfortable",
      afternoonSkinChange: "mostly_same"
    },
    safety: { drynessRisk: "low" }
  });
  const audit = buildFunctionalCandidateAudit({
    products: [
      product({
        id: "confidence-medium",
        sensitivity_safe: null,
        irritation_risk: null,
        ingredient_signals: {
          functional: [{ label: "skin hydration", count: 8 }]
        },
        market_signals: { review_count: 20000, rating: 4.7 }
      }),
      product({
        id: "confidence-high",
        sensitivity_safe: null,
        irritation_risk: null,
        ingredient_signals: {
          functional: [
            { label: "skin hydration", count: 8 },
            { label: "moisture evaporation blocking", count: 4 }
          ]
        },
        market_signals: { review_count: 20000, rating: 4.7 }
      })
    ],
    surveyContract: contract,
    goalPolicy: policy("dehydration", "dehydration", contract.safety)
  });

  assert.equal(audit.rankedCandidates[0].evaluation.totalScore, audit.rankedCandidates[1].evaluation.totalScore);
  assert.equal(audit.rankedCandidates[0].evaluation.confidence, "high");
  assert.equal(audit.rankedCandidates[1].evaluation.confidence, "medium");
  assert.equal(audit.rankedCandidates[0].product.id, "confidence-high");
});

runCase("blocked product is separated and reason distribution is counted", () => {
  const contract = survey({
    goals: { primaryConcern: "redness" },
    safety: {
      sensitivityRisk: "high",
      rednessRisk: "high",
      drynessRisk: "low"
    }
  });
  const audit = buildFunctionalCandidateAudit({
    products: [
      product({
        id: "blocked-irritation",
        concerns: ["redness"],
        irritation_risk: "high",
        sensitivity_safe: false,
        ingredient_signals: {
          functional: [{ label: "soothing/astringent", count: 4 }]
        }
      }),
      product({ id: "safe-candidate" })
    ],
    surveyContract: contract,
    goalPolicy: policy("redness", "redness", contract.safety),
    options: { includeBlocked: true }
  });

  assert.equal(audit.rankedCandidates.some((item) => item.product.id === "blocked-irritation"), false);
  assert.equal(audit.blockedCandidates.length, 1);
  assert.equal(audit.blockedCandidates[0].productId, "blocked-irritation");
  assert.ok(audit.summary.hardFilterReasonDistribution.sensitivity_high_irritation_conflict >= 1);
});

runCase("insufficient data product is separated with low confidence", () => {
  const audit = buildFunctionalCandidateAudit({
    products: [{ id: "sparse", category: "serum" }],
    surveyContract: survey(),
    goalPolicy: policy()
  });

  assert.equal(audit.rankedCandidates.length, 0);
  assert.equal(audit.insufficientDataCandidates.length, 1);
  assert.equal(audit.insufficientDataCandidates[0].confidence, "low");
  assert.equal(audit.summary.insufficientDataCount, 1);
});

runCase("answered sunscreen hard filter blocks high eye-sting product", () => {
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
  const audit = buildFunctionalCandidateAudit({
    products: [
      product({
        id: "blocked-sunscreen",
        category: "sunscreen",
        concerns: ["uv"],
        eye_sting: "high",
        ingredient_signals: {
          functional: [{ label: "uv protection", count: 5 }]
        }
      })
    ],
    surveyContract: contract,
    goalPolicy: policy("uv", "uv", contract.safety),
    options: { includeBlocked: true }
  });

  assert.equal(audit.blockedCandidates.length, 1);
  assert.ok(audit.summary.hardFilterReasonDistribution.sunscreen_eye_sting_conflict >= 1);
});

runCase("skipped sunscreen preferences do not hard filter false-only answers", () => {
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
  const audit = buildFunctionalCandidateAudit({
    products: [
      product({
        id: "skipped-sunscreen",
        category: "sunscreen",
        concerns: ["uv"],
        eye_sting: "high",
        white_cast: "high",
        pilling_risk: "high",
        ingredient_signals: {
          functional: [{ label: "uv protection", count: 5 }]
        }
      })
    ],
    surveyContract: contract,
    goalPolicy: policy("uv", "uv", contract.safety)
  });

  assert.equal(audit.rankedCandidates.length, 1);
  assert.equal(audit.summary.blockedCount, 0);
});

runCase("current routine duplicate lowers routine fit without replacement judgment", () => {
  const audit = buildFunctionalCandidateAudit({
    products: [product({ id: "duplicate-candidate" })],
    surveyContract: survey(),
    goalPolicy: policy(),
    currentProductFindings: {
      findings: [
        {
          productId: "current-hydration",
          relationToPlan: "duplicate_axis",
          sourceState: "selected"
        }
      ]
    }
  });
  const candidate = audit.rankedCandidates[0];

  assert.equal(candidate.evaluation.hardFilterStatus, "pass");
  assert.ok(candidate.evaluation.scoreBreakdown.routineFit.score < 6);
  assert.equal(candidate.evaluation.rankingContext.currentRoutineRelation, "duplicate_axis");
  assert.equal(
    candidate.evaluation.penalties.some((penalty) => penalty.toLowerCase().includes("replace")),
    false
  );
});

runCase("rankingGoal and safetyGoal tension are preserved in summary", () => {
  const contract = survey({
    skinState: {
      skinType: "oily",
      postWashFeeling: "comfortable",
      afternoonSkinChange: "more_oily"
    },
    goals: { primaryConcern: "pores" },
    safety: { drynessRisk: "low" }
  });
  const goalPolicy = policy("pores", "oiliness", contract.safety);
  const audit = buildFunctionalCandidateAudit({
    products: [
      product({
        id: "pores-candidate",
        category: "treatment",
        concerns: ["pores"],
        texture: "gel",
        finish: "fresh",
        ingredient_signals: {
          functional: [{ label: "exfoliation", count: 8 }]
        }
      })
    ],
    surveyContract: contract,
    goalPolicy
  });

  assert.equal(audit.summary.rankingContext.rankingGoal, "pores");
  assert.equal(audit.summary.rankingContext.safetyGoal, "oiliness");
  assert.equal(audit.summary.rankingContext.hasTension, true);
});

runCase("category allowlist and denylist skip products without blocking them", () => {
  const products = [
    product({ id: "allowed-serum", category: "serum" }),
    product({ id: "denied-sunscreen", category: "sunscreen" }),
    product({ id: "excluded-cleanser", category: "cleanser" })
  ];
  const audit = buildFunctionalCandidateAudit({
    products,
    surveyContract: survey(),
    goalPolicy: policy(),
    options: {
      includeBlocked: true,
      categoryAllowlist: ["serum", "sunscreen"],
      categoryDenylist: ["sunscreen"]
    }
  });

  assert.deepEqual(audit.rankedCandidates.map((item) => item.product.id), ["allowed-serum"]);
  assert.equal(audit.blockedCandidates.length, 0);
  assert.equal(audit.summary.skippedCount, 2);
  assert.equal(audit.summary.skippedReasonDistribution.category_denylist, 1);
  assert.equal(audit.summary.skippedReasonDistribution.category_allowlist, 1);
});

runCase("maxRankedCandidates limits returned list and tracks truncation", () => {
  const audit = buildFunctionalCandidateAudit({
    products: [
      product({ id: "max-a" }),
      product({ id: "max-b" }),
      product({ id: "max-c" })
    ],
    surveyContract: survey(),
    goalPolicy: policy(),
    options: { maxRankedCandidates: 2 }
  });

  assert.equal(audit.summary.rankedCount, 3);
  assert.equal(audit.summary.returnedRankedCount, 2);
  assert.equal(audit.summary.truncatedRankedCount, 1);
  assert.equal(audit.rankedCandidates.length, 2);
});

runCase("empty, null, and malformed inputs do not throw and counts stay consistent", () => {
  const emptyAudit = buildFunctionalCandidateAudit({
    products: [],
    surveyContract: survey(),
    goalPolicy: policy()
  });

  assert.equal(emptyAudit.summary.totalInputCount, 0);
  assert.equal(emptyAudit.summary.evaluatedCount, 0);

  const malformedAudit = buildFunctionalCandidateAudit({
    products: [null, "bad", {}, { id: "missing-category" }],
    surveyContract: survey(),
    goalPolicy: policy()
  });

  assert.equal(malformedAudit.summary.totalInputCount, 4);
  assert.equal(malformedAudit.summary.skippedCount, 2);
  assert.equal(malformedAudit.summary.evaluatedCount, 2);
  assert.equal(malformedAudit.summary.insufficientDataCount, 2);
  assert.equal(malformedAudit.insufficientDataCandidates.length, 2);
});
