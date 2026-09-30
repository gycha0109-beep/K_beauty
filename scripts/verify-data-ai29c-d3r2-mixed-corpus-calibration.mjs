#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_MIXED_CORPUS_CALIBRATION_VERSION,
  evaluateMixedCorpusSunscreenCalibration,
} from "../lib/sunscreen-mixed-corpus-calibration.mjs";

const legacyFixture = JSON.parse(
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
const protection = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-c6g-prospective-protection-shadow-input-v1.json",
    "utf8",
  ),
);

const result = evaluateMixedCorpusSunscreenCalibration({
  legacyProducts: legacyFixture.products,
  authorityRows: d2.products,
  semanticBundles: d1b.products,
  protectionRecords: protection.records,
  readiness: protection.readiness,
  rawAnswers: {
    skinType: "not_sure",
    sensitivity: "low",
    sunscreenIntent: true,
    outdoorExposure: false,
    toneUpWanted: false,
    whiteCastHate: false,
    eyeSensitive: false,
    makeupUse: false,
  },
});

assert.equal(
  SUNSCREEN_MIXED_CORPUS_CALIBRATION_VERSION,
  "data-ai29c-d3r2-mixed-corpus-calibration-v1",
);
assert.equal(legacyFixture.observedFromProduction, true);
assert.equal(legacyFixture.productCount, 11);
assert.equal(legacyFixture.products.length, 11);
assert.equal(result.legacyCount, 11);
assert.equal(result.newGrantCount, 5);
assert.equal(result.newScoredCount, 5);
assert.equal(result.mixedBaselineCount, 16);

// D3R2-1: the same neutral request disables finish/tone-up for the new
// governed cohort because authority is incomplete.
assert.deepEqual(result.disabledRelevantAxes, ["finish", "toneUp"]);
assert.equal(result.newCohortAxes.finish.active, false);
assert.equal(result.newCohortAxes.toneUp.active, false);

// D3R2-2: new-only masking is not cross-cohort comparable because the frozen
// legacy scorer uses those same axes with non-zero contributions.
assert.ok(result.crossCohortLeakAxes.includes("finish"));
assert.ok(result.crossCohortLeakAxes.includes("toneUp"));
assert.ok(result.legacyAxisContribution.finish.nonZeroProducts > 0);
assert.ok(result.legacyAxisContribution.toneUp.nonZeroProducts > 0);
assert.equal(result.newOnlyMaskCrossCohortComparable, false);

// D3R2-3: masking the same axes across the whole mixed cohort fixes that
// asymmetry but changes legacy control scores/top-set, violating legacy-control
// comparability for an activation decision.
assert.equal(result.legacyScoreChangedCount, 5);
assert.equal(result.wholeMixedMaskPreservesLegacyControl, false);
assert.deepEqual(result.legacyControlTopSet, [
  "0bb742d2-df6b-49a7-8e29-8f76ae62ac0d",
  "9983f167-24e7-4223-bd86-446ce6ced31b",
  "cbcd06a2-de29-47ca-afd1-ab1d5de93903",
  "dc1ef3f3-db1b-4c3f-954a-b18343e3d9f3",
]);
assert.equal(result.legacyFairTopSet.length, 11);

// D3R2-4: the neutral fair mixed baseline becomes a 16-way numeric tie.
// Protection can discriminate it, but that is not a Production order claim.
assert.equal(result.mixedBaselineTieCount, 16);
assert.equal(result.mixedBaselineTopSet.length, 16);
assert.equal(result.mixedRankingComparable, false);
assert.equal(result.productionOrderClaimReady, false);

const expectedProtectionTop = new Set([
  "0bb742d2-df6b-49a7-8e29-8f76ae62ac0d",
  "25b2763f-529f-4b2e-a436-2e0776279c55",
  "2d3591f2-2216-4043-8493-a9492806ef8b",
  "336bb533-0fe4-4380-8b9f-ab16fb24b807",
  "57e4a5ec-115d-4322-85a1-7976db669700",
  "765b3ca1-6927-49b0-bee6-4138d03dd915",
  "cbcd06a2-de29-47ca-afd1-ab1d5de93903",
  "dc1ef3f3-db1b-4c3f-954a-b18343e3d9f3",
  "dd326b18-ea56-45fb-8571-42186b6c9159",
]);
assert.deepEqual(
  new Set(result.mixedShadowTopSet),
  expectedProtectionTop,
);

// D3R2-5: the 48-scenario matrix includes redness/barrier contexts that
// correctly become sensitivity-authority HOLD. Among the 36 contexts where all
// five are scoreable, no tie-free baseline exists.
assert.equal(result.scenarioMatrix.scenarioCount, 48);
assert.equal(result.scenarioMatrix.allFiveScoreableScenarioCount, 36);
assert.equal(result.scenarioMatrix.tieFreeAllFiveScenarioCount, 0);

const groups = result.scenarioMatrix.scoreSignatureGroups.map(
  (group) => new Set(group),
);
function hasGroup(ids) {
  const expected = new Set(ids);
  return groups.some(
    (group) =>
      group.size === expected.size &&
      [...expected].every((id) => group.has(id)),
  );
}
assert.ok(
  hasGroup([
    "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
    "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
  ]),
  "Physical Daily and Jojoba must remain score-equivalent across safe contexts",
);
assert.ok(
  hasGroup([
    "b576991e-79c9-4189-b6e9-527aeeb03566",
    "7c709c04-e299-4ca6-be69-6aaf4a753f13",
  ]),
  "Zinc and Bio Repair must remain score-equivalent across safe contexts",
);
assert.ok(
  hasGroup(["b90bf992-07ae-4f49-a3a4-d90ea6d4a858"]),
  "MIN JUNG GI must remain its own current score signature",
);

// D3R2-6: D3R2 stays shadow-only and does not pretend the existing Production
// tie-breaker can be reused after semantic-axis masking.
assert.deepEqual(result.limits, {
  productionCandidateAdmissionWired: false,
  productionRankingChanged: false,
  productionTieBreakerShadowed: false,
  productionCutoverAuthorized: false,
  outdoorRankableSignalAuthorized: false,
  publicActivation: false,
  waterResistanceApplied: false,
  persistence: false,
});

const source = fs.readFileSync(
  "lib/sunscreen-mixed-corpus-calibration.mjs",
  "utf8",
);
assert.ok(source.includes('from "./recommendation-scoring.ts"'));
assert.ok(source.includes("evaluateFeatureGatedIntegratedSunscreenShadow"));
assert.equal(source.includes("buildRecommendationProductFromSource"), false);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D3R2",
    legacyCount: result.legacyCount,
    newGrantCount: result.newGrantCount,
    disabledRelevantAxes: result.disabledRelevantAxes,
    crossCohortLeakAxes: result.crossCohortLeakAxes,
    legacyScoreChangedCount: result.legacyScoreChangedCount,
    mixedBaselineTieCount: result.mixedBaselineTieCount,
    mixedShadowTopCount: result.mixedShadowTopSet.length,
    scenarioCount: result.scenarioMatrix.scenarioCount,
    tieFreeAllFiveScenarioCount:
      result.scenarioMatrix.tieFreeAllFiveScenarioCount,
    conclusion:
      "MIXED_CORPUS_CALIBRATION_HOLD_CROSS_COHORT_COMPARABILITY",
  }),
);
