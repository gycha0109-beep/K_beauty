#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_WATER_INTENT_CONTRACT_VERSION,
  SUNSCREEN_WATER_INTENT_FIELD,
  SUNSCREEN_WATER_INTENT_RECOMMENDATION_KEY,
  SUNSCREEN_WATER_INTENT_STATE,
  normalizeSunscreenWaterIntent,
  evaluateSunscreenWaterIntentControl,
} from "../lib/sunscreen-water-intent-contract.mjs";

const fixture = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-water-a-intent-contract-v1.json",
    "utf8",
  ),
);

assert.equal(
  SUNSCREEN_WATER_INTENT_CONTRACT_VERSION,
  "sunscreen-water-intent-contract-v1",
);
assert.equal(SUNSCREEN_WATER_INTENT_FIELD, "water_resistance_needed");
assert.equal(
  SUNSCREEN_WATER_INTENT_RECOMMENDATION_KEY,
  "waterResistanceNeeded",
);

assert.deepEqual(normalizeSunscreenWaterIntent(true), {
  ok: true,
  error: null,
  value: true,
  state: SUNSCREEN_WATER_INTENT_STATE.REQUIRED,
  rankingIntentAvailable: true,
});
assert.deepEqual(normalizeSunscreenWaterIntent(false), {
  ok: true,
  error: null,
  value: false,
  state: SUNSCREEN_WATER_INTENT_STATE.NOT_REQUIRED,
  rankingIntentAvailable: false,
});
assert.deepEqual(normalizeSunscreenWaterIntent(null), {
  ok: true,
  error: null,
  value: null,
  state: SUNSCREEN_WATER_INTENT_STATE.UNKNOWN,
  rankingIntentAvailable: false,
});
assert.equal(normalizeSunscreenWaterIntent("true").ok, false);

const outdoorOnly = evaluateSunscreenWaterIntentControl({
  waterResistanceNeeded: null,
  outdoorExposure: true,
});
assert.equal(outdoorOnly.state, SUNSCREEN_WATER_INTENT_STATE.UNKNOWN);
assert.equal(outdoorOnly.rankingIntentAvailable, false);
assert.equal(outdoorOnly.derivedFromOutdoorExposure, false);
assert.equal(
  outdoorOnly.blockReason,
  "water_resistance_intent_not_available",
);

const waterOnly = evaluateSunscreenWaterIntentControl({
  waterResistanceNeeded: true,
  outdoorExposure: false,
});
assert.equal(waterOnly.state, SUNSCREEN_WATER_INTENT_STATE.REQUIRED);
assert.equal(waterOnly.rankingIntentAvailable, true);
assert.equal(waterOnly.derivedFromOutdoorExposure, false);
assert.equal(waterOnly.blockReason, null);

const explicitlyNotNeeded = evaluateSunscreenWaterIntentControl({
  waterResistanceNeeded: false,
  outdoorExposure: true,
});
assert.equal(
  explicitlyNotNeeded.state,
  SUNSCREEN_WATER_INTENT_STATE.NOT_REQUIRED,
);
assert.equal(explicitlyNotNeeded.rankingIntentAvailable, false);
assert.equal(
  explicitlyNotNeeded.blockReason,
  "water_resistance_not_requested",
);

assert.equal(fixture.version, "data-ai29c-water-a-intent-contract-v1");
assert.equal(fixture.contractVersion, SUNSCREEN_WATER_INTENT_CONTRACT_VERSION);
assert.equal(fixture.canonicalField, SUNSCREEN_WATER_INTENT_FIELD);
assert.equal(
  fixture.recommendationAnswerKey,
  SUNSCREEN_WATER_INTENT_RECOMMENDATION_KEY,
);
assert.equal(fixture.valueType, "nullable_boolean");
assert.equal(
  fixture.ownershipRules.outdoorExposureDoesNotImplyWaterResistanceNeed,
  true,
);
assert.equal(fixture.ownershipRules.missingDoesNotBecomeFalse, true);
assert.equal(
  fixture.ownershipRules.falseDoesNotClassifyProductsAsNonWaterproof,
  true,
);
assert.equal(fixture.ownershipRules.beachWordAloneDoesNotForceTrue, true);
assert.equal(fixture.ownershipRules.sportsWordAloneDoesNotForceTrue, true);

assert.deepEqual(
  fixture.examples.map((example) => example.expected),
  [true, true, null, null, false],
);

assert.deepEqual(fixture.runtimeBoundary, {
  productQueryIntentSchemaMutated: false,
  providerPromptMutated: false,
  recommendationAnswersMutated: false,
  protectionScorerWired: false,
  waterAuthorityRequiredForFutureRanking: true,
  waterAxisActivated: false,
});
assert.ok(
  Object.values(fixture.productionBoundary).every((value) => value === false),
);
assert.equal(
  fixture.decision,
  "WATER_A_CANONICAL_INTENT_CONTRACT_FROZEN_RUNTIME_NOT_WIRED",
);

const productQueryIntentSource = fs.readFileSync(
  "lib/product-query-intent-contract.mjs",
  "utf8",
);
assert.equal(
  productQueryIntentSource.includes('"water_resistance_needed"'),
  false,
  "WATER-A must not mutate the live Product Query intent schema",
);

const scorerSource = fs.readFileSync(
  "lib/sunscreen-protection-shadow-scoring.mjs",
  "utf8",
);
assert.equal(
  scorerSource.includes("sunscreen-water-intent-contract"),
  false,
  "WATER-A must not wire the new intent contract into scoring",
);
assert.ok(
  scorerSource.includes(
    '"waterResistance:water_resistance_intent_not_available"',
  ),
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-WATER-A",
    contractVersion: SUNSCREEN_WATER_INTENT_CONTRACT_VERSION,
    liveSchemaMutated: false,
    scorerWired: false,
    decision: fixture.decision,
  }),
);
