#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PROSPECTIVE_PROTECTION_AXIS_SHADOW_VERSION,
  evaluateProspectiveProtectionAxisShadow
} from "../lib/sunscreen-protection-prospective-shadow.mjs";

const path =
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-c6g-prospective-protection-shadow-input-v1.json";
const snapshot = JSON.parse(fs.readFileSync(path, "utf8"));
const result = evaluateProspectiveProtectionAxisShadow(snapshot);

assert.equal(
  PROSPECTIVE_PROTECTION_AXIS_SHADOW_VERSION,
  "data-ai29c-c6g-prospective-protection-axis-shadow-v1",
);
assert.equal(result.inputVersion, snapshot.version);
assert.equal(result.rankingPurpose, "protection_axis_only");
assert.equal(result.corpusCount, 20);
assert.equal(result.readinessDecision, "SHADOW_SCORING_PARTIALLY_READY");
assert.deepEqual(result.readyAxes, ["spf", "uva"]);

assert.equal(result.outdoor.productCount, 20);
assert.equal(result.outdoor.appliedProtectionProductCount, 18);
assert.equal(result.outdoor.maxAppliedProtectionDelta, 12);
assert.deepEqual(result.outdoor.enabledAxes, ["spf", "uva"]);
assert.deepEqual(result.outdoor.scoreDistribution, {
  "0": 2,
  "4": 1,
  "6": 4,
  "8": 2,
  "12": 11,
});

const byId = new Map(
  result.outdoor.ranked.map((row) => [row.productId, row])
);
assert.equal(
  byId.get("a6994fcd-302f-4e63-acbe-91a3f17a5a65")?.appliedTotal,
  4,
);
assert.equal(
  byId.get("b90bf992-07ae-4f49-a3a4-d90ea6d4a858")?.appliedTotal,
  8,
);
assert.equal(
  byId.get("b576991e-79c9-4189-b6e9-527aeeb03566")?.appliedTotal,
  8,
);
assert.equal(
  byId.get("7c709c04-e299-4ca6-be69-6aaf4a753f13")?.appliedTotal,
  6,
);
assert.equal(
  byId.get("7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17")?.appliedTotal,
  6,
);
assert.equal(
  byId.get("4608b3b4-8b51-4464-b46e-380b05c1a3d7")?.appliedTotal,
  12,
);
assert.equal(
  byId.get("7e061f3a-e086-4700-8f09-98391008ecc5")?.appliedTotal,
  0,
);
assert.equal(
  byId.get("df32d800-2f16-4511-8efa-dc353ea1c2ef")?.appliedTotal,
  0,
);

for (const row of result.outdoor.ranked) {
  assert.equal(row.baselineRecommendationScoreUsed, false);
  assert.equal(row.appliedAdjustments.waterResistance, 0);
}

assert.equal(result.nonOutdoor.productCount, 20);
assert.equal(result.nonOutdoor.appliedProtectionProductCount, 0);
assert.equal(result.nonOutdoor.maxAppliedProtectionDelta, 0);
assert.deepEqual(result.nonOutdoor.enabledAxes, []);
assert.deepEqual(result.nonOutdoor.scoreDistribution, { "0": 20 });

assert.ok(Object.values(result.limits).every((value) => value === false));
assert.equal(snapshot.boundaries.recommendation_admission_mutated, false);
assert.equal(snapshot.boundaries.production_ranking_changed, false);
assert.equal(snapshot.boundaries.production_cutover_authorized, false);
assert.equal(snapshot.boundaries.outdoor_rankable_signal_authorized, false);
assert.equal(snapshot.boundaries.water_resistance_applied, false);

console.log("DATA_AI29C_C6G_PROSPECTIVE_PROTECTION_SHADOW=PASS");
console.log(
  "outdoor_distribution=0:2,4:1,6:4,8:2,12:11 non_outdoor=0:20",
);
