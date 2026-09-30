#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_FEATURE_GATED_SHADOW_VERSION,
  buildHardRejectAuthorityRequirements,
  evaluateFeatureGatedIntegratedSunscreenShadow,
} from "../lib/sunscreen-feature-gated-integrated-shadow.mjs";

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
  return evaluateFeatureGatedIntegratedSunscreenShadow({
    authorityRows: d2.products,
    semanticBundles,
    protectionRecords: protection.records,
    readiness: protection.readiness,
    rawAnswers,
  });
}

assert.equal(
  SUNSCREEN_FEATURE_GATED_SHADOW_VERSION,
  "data-ai29c-d3r1-feature-gated-integrated-shadow-v1",
);
assert.equal(d2.productCount, 5);
assert.equal(d1b.product_count, 5);

// D3R1-1: neutral context has no unknown-driven hard-reject requirement.
assert.deepEqual(
  buildHardRejectAuthorityRequirements({
    skinType: "not_sure",
    sensitivity: "low",
    sunscreenIntent: true,
  }),
  [],
);

// D3R1-2: scorer-relevant two-sided axes are cohort-gated instead of
// converting unknown into a favorable/neutral product-level value.
const neutral = evaluate({
  skinType: "not_sure",
  sensitivity: "low",
  outdoorExposure: false,
  sunscreenIntent: true,
});
assert.equal(neutral.corpusCount, 5);
assert.equal(neutral.admittedCount, 5);
assert.equal(neutral.hardRejectAuthorityHoldCount, 0);
assert.equal(neutral.hardRejectedCount, 0);
assert.equal(neutral.scoredCount, 5);
assert.equal(neutral.integratedScoreComparisonReady, true);
assert.equal(neutral.productionOrderClaimReady, false);
assert.equal(neutral.cohortAxes.finish.active, false);
assert.equal(neutral.cohortAxes.finish.reason, "cohort_authority_incomplete");
assert.equal(neutral.cohortAxes.toneUp.active, false);
assert.equal(neutral.cohortAxes.toneUp.reason, "cohort_authority_incomplete");
assert.equal(neutral.cohortAxes.sensitivitySafe.relevant, false);
assert.equal(neutral.cohortAxes.whiteCast.relevant, false);
assert.equal(neutral.cohortAxes.eyeSting.relevant, false);
assert.equal(neutral.cohortAxes.pilling.relevant, false);
assert.equal(neutral.appliedProtectionProductCount, 0);
assert.ok(neutral.rows.every((row) => row.baselineScore === 0));

// D3R1-3: outdoor protection runs only after the feature-gated baseline.
// Current SPF/UVA authority differentiates all five without water.
const outdoor = evaluate({
  skinType: "not_sure",
  sensitivity: "low",
  outdoorExposure: true,
  sunscreenIntent: true,
});
assert.equal(outdoor.scoredCount, 5);
assert.equal(outdoor.appliedProtectionProductCount, 5);
assert.equal(outdoor.integratedScoreComparisonReady, true);
assert.equal(outdoor.productionOrderClaimReady, false);
assert.equal(outdoor.baselineTieCount, 5);
assert.deepEqual(outdoor.baselineTopSet.sort(), d2.products.map((p) => p.product.id).sort());
assert.deepEqual(outdoor.shadowTopSet, [
  "b576991e-79c9-4189-b6e9-527aeeb03566",
  "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
]);
assert.equal(outdoor.topScoreSetChanged, true);

const outdoorById = new Map(outdoor.rows.map((row) => [row.productId, row]));
assert.equal(
  outdoorById.get("a6994fcd-302f-4e63-acbe-91a3f17a5a65")?.protectionDelta,
  4,
);
assert.equal(
  outdoorById.get("b90bf992-07ae-4f49-a3a4-d90ea6d4a858")?.protectionDelta,
  8,
);
assert.equal(
  outdoorById.get("b576991e-79c9-4189-b6e9-527aeeb03566")?.protectionDelta,
  8,
);
assert.equal(
  outdoorById.get("7c709c04-e299-4ca6-be69-6aaf4a753f13")?.protectionDelta,
  6,
);
assert.equal(
  outdoorById.get("7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17")?.protectionDelta,
  6,
);
for (const row of outdoor.rows) {
  if (row.stage !== "scored") continue;
  assert.ok(row.enabledProtectionAxes.includes("spf"));
  assert.ok(row.enabledProtectionAxes.includes("uva"));
  assert.ok(
    row.blockedProtectionAxes.includes(
      "waterResistance:water_resistance_intent_not_available",
    ),
  );
}

// D3R1-4: one-sided positive authority stays usable. Unknown concern does not
// receive a positive match; known dehydration authority can.
const dehydration = evaluate({
  skinType: "not_sure",
  sensitivity: "low",
  mainConcern: "dehydration",
  mainConcerns: ["dehydration"],
  outdoorExposure: false,
  sunscreenIntent: true,
});
const dehydrationById = new Map(
  dehydration.rows.map((row) => [row.productId, row]),
);
assert.equal(
  dehydrationById.get("a6994fcd-302f-4e63-acbe-91a3f17a5a65")?.baselineScore,
  20,
);
assert.equal(
  dehydrationById.get("7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17")?.baselineScore,
  20,
);
assert.equal(
  dehydrationById.get("b90bf992-07ae-4f49-a3a4-d90ea6d4a858")?.baselineScore,
  0,
);

// D3R1-5: unknown semantics that can change hard reject remain fail-closed.
const dry = evaluate({
  skinType: "dry",
  sensitivity: "low",
  outdoorExposure: true,
  sunscreenIntent: true,
});
assert.ok(dry.scenario.hardRejectRequirements.includes("finish"));
assert.equal(dry.hardRejectAuthorityHoldCount, 4);
assert.equal(dry.scoredCount, 1);
assert.equal(dry.rows.find((row) => row.name === "Jojoba Suncream")?.stage, "scored");

const sensitive = evaluate({
  skinType: "sensitive",
  sensitivity: "high",
  outdoorExposure: true,
  sunscreenIntent: true,
});
assert.ok(sensitive.scenario.hardRejectRequirements.includes("irritation_risk"));
assert.equal(sensitive.hardRejectAuthorityHoldCount, 5);
assert.equal(sensitive.scoredCount, 0);

const makeup = evaluate({
  skinType: "not_sure",
  sensitivity: "low",
  makeupUse: true,
  outdoorExposure: true,
  sunscreenIntent: true,
});
assert.ok(makeup.scenario.hardRejectRequirements.includes("pilling_risk"));
assert.equal(makeup.hardRejectAuthorityHoldCount, 5);
assert.equal(makeup.scoredCount, 0);

const eye = evaluate({
  skinType: "not_sure",
  sensitivity: "low",
  eyeSensitive: true,
  outdoorExposure: true,
  sunscreenIntent: true,
});
assert.ok(eye.scenario.hardRejectRequirements.includes("eye_sting"));
assert.equal(eye.hardRejectAuthorityHoldCount, 1);
assert.equal(eye.scoredCount, 4);

const whiteCast = evaluate({
  skinType: "not_sure",
  sensitivity: "low",
  whiteCastHate: true,
  toneUpWanted: false,
  outdoorExposure: true,
  sunscreenIntent: true,
});
assert.ok(whiteCast.scenario.hardRejectRequirements.includes("white_cast"));
assert.equal(whiteCast.hardRejectAuthorityHoldCount, 2);

// D3R1-6: a known high hard-reject value still rejects before protection and
// cannot be resurrected.
{
  const bundles = clone(d1b.products);
  const jojoba = bundles.find(
    (bundle) =>
      bundle.productId === "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
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
      whiteCastHate: true,
      toneUpWanted: false,
      outdoorExposure: true,
      sunscreenIntent: true,
    },
    bundles,
  );
  const row = result.rows.find(
    (item) =>
      item.productId === "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
  );
  assert.equal(row?.stage, "hard_reject");
  assert.equal(row?.hardRejected, true);
  assert.equal(row?.protectionDelta, 0);
  assert.equal(row?.shadowScore, null);
  assert.ok(row?.blockers.includes("white_cast_high"));
}

// D3R1-7: Production boundaries remain frozen.
for (const [key, expected] of Object.entries({
  missingConvertedToFalse: false,
  unresolvedTwoSidedAxisComparedAsNeutral: false,
  hardRejectUnknownAllowedThrough: false,
  hardRejectedCandidateResurrected: false,
  waterResistanceApplied: false,
  rawProductFallbackUsed: false,
  productionCandidateAdmissionWired: false,
  productionRankingChanged: false,
  productionCutoverAuthorized: false,
  outdoorRankableSignalAuthorized: false,
  publicActivation: false,
})) {
  assert.equal(neutral.limits[key], expected, `neutral limit mismatch: ${key}`);
  assert.equal(outdoor.limits[key], expected, `outdoor limit mismatch: ${key}`);
}

const source = fs.readFileSync(
  "lib/sunscreen-feature-gated-integrated-shadow.mjs",
  "utf8",
);
const admissionCore = fs.readFileSync(
  "lib/recommendation-candidate-admission-core.mjs",
  "utf8",
);
const productSource = fs.readFileSync("lib/product-source.js", "utf8");

assert.ok(source.includes('from "./recommendation-scoring.ts"'));
assert.ok(source.includes("filterSunscreenCandidates"));
assert.ok(source.includes("scoreSunscreenProduct"));
assert.ok(source.includes("maskedSunscreenBreakdown"));
assert.equal(source.includes("buildRecommendationProductFromSource"), false);
assert.equal(
  admissionCore.includes("SUNSCREEN_INITIAL_ADMISSION_GRANT"),
  false,
);
assert.equal(
  productSource.includes("sunscreen-feature-gated-integrated-shadow"),
  false,
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D3R1",
    neutral: {
      admitted: neutral.admittedCount,
      scored: neutral.scoredCount,
      baselineTieCount: neutral.baselineTieCount,
      productionOrderClaimReady: neutral.productionOrderClaimReady,
    },
    outdoor: {
      scored: outdoor.scoredCount,
      appliedProtection: outdoor.appliedProtectionProductCount,
      baselineTopSet: outdoor.baselineTopSet,
      shadowTopSet: outdoor.shadowTopSet,
      topScoreSetChanged: outdoor.topScoreSetChanged,
      productionOrderClaimReady: outdoor.productionOrderClaimReady,
    },
    hardRejectAuthority: {
      dryHold: dry.hardRejectAuthorityHoldCount,
      sensitiveHold: sensitive.hardRejectAuthorityHoldCount,
      makeupHold: makeup.hardRejectAuthorityHoldCount,
      eyeHold: eye.hardRejectAuthorityHoldCount,
      whiteCastHold: whiteCast.hardRejectAuthorityHoldCount,
    },
    conclusion:
      "FEATURE_GATED_INTEGRATED_SCORE_COMPARISON_READY_PRODUCTION_ORDER_HOLD",
  }),
);
