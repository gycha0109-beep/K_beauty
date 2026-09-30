#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_WATER_AXIS_REVIEW_VERSION,
  evaluateWaterAxisReview,
} from "../lib/sunscreen-water-axis-review.mjs";

const legacy = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d3r2-legacy-sunscreen-runtime-v1.json",
    "utf8",
  ),
);
const d2 = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d2-sunscreen-initial-admission-v1.json",
    "utf8",
  ),
);
const d1b = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d1b-sunscreen-semantic-projection-v1.json",
    "utf8",
  ),
);
const recovery = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d3r3-semantic-authority-recovery-v1.json",
    "utf8",
  ),
);
const protection = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-c6g-prospective-protection-shadow-input-v1.json",
    "utf8",
  ),
);
const wave2 = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-protection-expansion-wave-2-execution-v1.json",
    "utf8",
  ),
);

const result = evaluateWaterAxisReview({
  legacyProducts: legacy.products,
  authorityRows: d2.products,
  semanticBundles: d1b.products,
  recoveryFixture: recovery,
  protectionRecords: protection.records,
  wave2Execution: wave2,
});

assert.equal(
  SUNSCREEN_WATER_AXIS_REVIEW_VERSION,
  "data-ai29c-d4-water-axis-review-v1",
);

// D4-WATER-1: the full prospective sunscreen audit has zero governed water
// authority and zero discriminating buckets.
assert.equal(result.prospectiveCorpusCount, 20);
assert.deepEqual(result.prospectiveWater, {
  eligible_count: 0,
  coverage: 0,
  distinct_scoring_buckets: 0,
  gate_pass: false,
});

// D4-WATER-2: the D3R3 comparable mixed corpus also has zero water buckets.
assert.equal(result.comparableCorpusCount, 14);
assert.equal(result.mixedCoverage.eligibleCount, 0);
assert.equal(result.mixedCoverage.totalCount, 14);
assert.equal(result.mixedCoverage.complete, false);
assert.equal(result.mixedCoverage.missingProductIds.length, 14);

// D4-WATER-3: even if audit.rankingUseful were forced true in shadow input,
// current runtime intentionally applies no water score because there is no
// water-resistance user-intent contract.
assert.equal(result.runtimeControl.length, 14);
assert.ok(
  result.runtimeControl.every(
    (row) =>
      row.potentialWater === 0 &&
      row.appliedWater === 0 &&
      row.shadowScore === row.baselineScore &&
      row.enabledAxes.length === 0 &&
      row.blockedAxes.includes(
        "waterResistance:water_resistance_intent_not_available",
      ),
  ),
);

// D4-WATER-4: missing authority never means "not waterproof".
assert.equal(result.gates.missingNotConvertedToFalse, true);
assert.equal(result.limits.missingTreatedAsNonWaterproof, false);

// D4-WATER-5: water HOLD is independent and cannot block the already-passed
// SPF D4 review.
assert.equal(result.gates.spfReviewUnaffected, true);
assert.equal(result.nextGate.doesNotBlockSpfD5Review, true);

// D4-WATER-6: activation requires both governed facts and an explicit intent
// contract before a separate shadow calibration can even begin.
assert.deepEqual(result.nextGate, {
  requiresGovernedWaterAuthority: true,
  requiresWaterIntentContract: true,
  requiresSeparateShadowCalibration: true,
  doesNotBlockSpfD5Review: true,
});

assert.deepEqual(result.gates, {
  prospectiveAuthorityUnavailable: true,
  mixedAuthorityUnavailable: true,
  runtimeIntentUnavailable: true,
  missingNotConvertedToFalse: true,
  spfReviewUnaffected: true,
  productionStillFrozen: true,
});
assert.equal(result.holdRequired, true);
assert.equal(
  result.decision,
  "WATER_AXIS_D4_HOLD_NO_AUTHORITY_OR_INTENT_CONTRACT",
);
assert.deepEqual(result.limits, {
  missingTreatedAsNonWaterproof: false,
  waterIntentImplemented: false,
  waterAxisActivated: false,
  productionRankingChanged: false,
  productionCutoverAuthorized: false,
  publicActivation: false,
  persistence: false,
});

const scoring = fs.readFileSync(
  "lib/sunscreen-protection-shadow-scoring.mjs",
  "utf8",
);
assert.ok(
  scoring.includes(
    'blockedAxes.push("waterResistance:water_resistance_intent_not_available")',
  ),
);
assert.ok(
  scoring.includes("waterResistance: 0"),
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D4-WATER",
    prospectiveCorpusCount: result.prospectiveCorpusCount,
    prospectiveEligible: result.prospectiveWater.eligible_count,
    comparableCorpusCount: result.comparableCorpusCount,
    mixedEligible: result.mixedCoverage.eligibleCount,
    decision: result.decision,
  }),
);
