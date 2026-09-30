#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_INTEGRATED_SHADOW_VERSION,
  buildSunscreenSemanticScoringContext,
  evaluateIntegratedSunscreenRecommendationShadow,
} from "../lib/sunscreen-integrated-recommendation-shadow.mjs";

const D2_PATH =
  "fixtures/data-ai29c-d2-sunscreen-initial-admission-v1.json";
const D1B_PATH =
  "fixtures/data-ai29c-d1b-sunscreen-semantic-projection-v1.json";
const PROTECTION_PATH =
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-c6g-prospective-protection-shadow-input-v1.json";

const d2 = JSON.parse(fs.readFileSync(D2_PATH, "utf8"));
const d1b = JSON.parse(fs.readFileSync(D1B_PATH, "utf8"));
const protection = JSON.parse(fs.readFileSync(PROTECTION_PATH, "utf8"));

function clone(value) {
  return structuredClone(value);
}

function evaluate(rawAnswers, semanticBundles = d1b.products) {
  return evaluateIntegratedSunscreenRecommendationShadow({
    authorityRows: d2.products,
    semanticBundles,
    protectionRecords: protection.records,
    readiness: protection.readiness,
    rawAnswers,
  });
}

assert.equal(
  SUNSCREEN_INTEGRATED_SHADOW_VERSION,
  "data-ai29c-d3-integrated-sunscreen-shadow-v1",
);
assert.equal(d2.productCount, 5);
assert.equal(d1b.product_count, 5);
assert.equal(protection.readiness.overall_decision, "SHADOW_SCORING_PARTIALLY_READY");

// D3-1: scorer-relevance context is derived from the actual scorer semantics.
// Tone-up and finish are always relevant under the current sunscreen scorer.
{
  const context = buildSunscreenSemanticScoringContext({
    skinType: "not_sure",
    sensitivity: "low",
  });
  assert.equal(context.toneUpRelevant, true);
  assert.equal(context.finishRelevant, true);
  assert.equal(context.sensitivityRelevant, false);
  assert.equal(context.whiteCastRelevant, false);
  assert.equal(context.eyeStingRelevant, false);
  assert.equal(context.pillingRelevant, false);
}

// D3-2: all five products have D2 admission authority, but current semantic
// coverage lets only Jojoba enter the actual scorer without default leakage.
const neutral = evaluate({
  skinType: "not_sure",
  sensitivity: "low",
  outdoorExposure: false,
  sunscreenIntent: true,
});
assert.equal(neutral.corpusCount, 5);
assert.equal(neutral.admittedCount, 5);
assert.equal(neutral.semanticEligibleCount, 1);
assert.equal(neutral.semanticBlockedCount, 4);
assert.equal(neutral.hardRejectedCount, 0);
assert.equal(neutral.scoredCount, 1);
assert.equal(neutral.appliedProtectionProductCount, 0);
assert.equal(neutral.maxProtectionDelta, 0);
assert.equal(neutral.integratedRankingReady, false);
assert.equal(neutral.numericScoreOrderChanged, false);
assert.equal(neutral.baselineRanked[0]?.name, "Jojoba Suncream");
assert.equal(neutral.baselineRanked[0]?.baselineScore, 4);
assert.equal(neutral.shadowRanked[0]?.shadowScore, 4);

// D3-3: outdoor=true applies only ready SPF/UVA axes after baseline scoring.
// Water remains zero/HOLD. The one currently scoreable product receives +6.
const outdoor = evaluate({
  skinType: "not_sure",
  sensitivity: "low",
  outdoorExposure: true,
  sunscreenIntent: true,
});
assert.equal(outdoor.admittedCount, 5);
assert.equal(outdoor.semanticEligibleCount, 1);
assert.equal(outdoor.scoredCount, 1);
assert.equal(outdoor.appliedProtectionProductCount, 1);
assert.equal(outdoor.maxProtectionDelta, 6);
assert.equal(outdoor.baselineRanked[0]?.baselineScore, 4);
assert.equal(outdoor.shadowRanked[0]?.shadowScore, 10);
assert.deepEqual(
  outdoor.shadowRanked[0]?.enabledProtectionAxes,
  ["spf", "uva"],
);
assert.ok(
  outdoor.shadowRanked[0]?.blockedProtectionAxes.includes(
    "waterResistance:water_resistance_intent_not_available",
  ),
);
assert.equal(outdoor.integratedRankingReady, false);

// D3-4: a known hard reject happens before protection and cannot be resurrected.
{
  const bundles = clone(d1b.products);
  const jojoba = bundles.find(
    (bundle) => bundle.productId === "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
  );
  jojoba.fields.white_cast = {
    state: "established",
    value: "high",
    confidence: "high",
  };

  const result = evaluate(
    {
      skinType: "not_sure",
      sensitivity: "low",
      outdoorExposure: true,
      sunscreenIntent: true,
      whiteCastHate: true,
      toneUpWanted: false,
    },
    bundles,
  );

  const row = result.rows.find(
    (item) => item.productId === "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
  );
  assert.equal(row?.stage, "hard_reject");
  assert.equal(row?.hardRejected, true);
  assert.equal(row?.protectionDelta, 0);
  assert.equal(row?.shadowScore, null);
  assert.ok(row?.blockers.includes("white_cast_high"));
  assert.equal(
    result.shadowRanked.some(
      (item) =>
        item.productId === "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
    ),
    false,
  );
}

// D3-5: request-specific uncertainty blocks rather than becoming a neutral
// score. Current five-product corpus has no fully established safety pair.
const sensitive = evaluate({
  skinType: "sensitive",
  sensitivity: "high",
  outdoorExposure: true,
  sunscreenIntent: true,
});
assert.equal(sensitive.admittedCount, 5);
assert.equal(sensitive.semanticEligibleCount, 0);
assert.equal(sensitive.scoredCount, 0);
assert.equal(sensitive.appliedProtectionProductCount, 0);
assert.equal(sensitive.integratedRankingReady, false);
assert.ok(
  sensitive.rows.every(
    (row) =>
      row.stage === "semantic_context" &&
      row.blockers.some((reason) =>
        reason.startsWith("SEMANTIC_UNCERTAINTY:sensitivityRelevant:"),
      ),
  ),
);

// D3-6: makeup relevance similarly fail-closes pilling uncertainty.
const makeup = evaluate({
  skinType: "not_sure",
  sensitivity: "low",
  makeupUse: true,
  outdoorExposure: true,
  sunscreenIntent: true,
});
assert.equal(makeup.semanticEligibleCount, 0);
assert.equal(makeup.scoredCount, 0);

// D3-7: no Production authority changes are introduced.
for (const [key, expected] of Object.entries({
  productionCandidateAdmissionWired: false,
  productionRankingChanged: false,
  productionCutoverAuthorized: false,
  outdoorRankableSignalAuthorized: false,
  publicActivation: false,
  waterResistanceApplied: false,
  hardRejectedCandidateResurrected: false,
  rawProductFallbackUsed: false,
  productionTieBreakerClaimed: false,
})) {
  assert.equal(neutral.limits[key], expected, `limit mismatch: ${key}`);
  assert.equal(outdoor.limits[key], expected, `limit mismatch: ${key}`);
}

const shadowSource = fs.readFileSync(
  "lib/sunscreen-integrated-recommendation-shadow.mjs",
  "utf8",
);
const admissionCore = fs.readFileSync(
  "lib/recommendation-candidate-admission-core.mjs",
  "utf8",
);
const productSource = fs.readFileSync("lib/product-source.js", "utf8");

assert.ok(
  shadowSource.includes('from "./recommendation-scoring.ts"'),
  "D3 must execute the existing Recommendation scorer, not a copied score formula",
);
assert.ok(
  shadowSource.includes("filterSunscreenCandidates"),
  "D3 must preserve hard-filter ordering",
);
assert.ok(
  shadowSource.includes("scoreSunscreenProduct"),
  "D3 must use the existing sunscreen baseline scorer",
);
assert.equal(
  shadowSource.includes("buildRecommendationProductFromSource"),
  false,
  "D3 must not use legacy Product null/default materialization",
);
assert.equal(
  admissionCore.includes("SUNSCREEN_INITIAL_ADMISSION_GRANT"),
  false,
  "D3 must not wire D2 authority into Production candidate admission",
);
assert.equal(
  productSource.includes("sunscreen-integrated-recommendation-shadow"),
  false,
  "D3 shadow must not alter Product source behavior",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D3",
    neutral: {
      admitted: neutral.admittedCount,
      semanticEligible: neutral.semanticEligibleCount,
      scored: neutral.scoredCount,
      rankingReady: neutral.integratedRankingReady,
    },
    outdoor: {
      admitted: outdoor.admittedCount,
      semanticEligible: outdoor.semanticEligibleCount,
      scored: outdoor.scoredCount,
      maxProtectionDelta: outdoor.maxProtectionDelta,
      rankingReady: outdoor.integratedRankingReady,
    },
    sensitive: {
      semanticEligible: sensitive.semanticEligibleCount,
      scored: sensitive.scoredCount,
    },
    makeup: {
      semanticEligible: makeup.semanticEligibleCount,
      scored: makeup.scoredCount,
    },
    conclusion: "HOLD_SEMANTIC_COVERAGE_INSUFFICIENT_FOR_INTEGRATED_RANKING",
  }),
);
