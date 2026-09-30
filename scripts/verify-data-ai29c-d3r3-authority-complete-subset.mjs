#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_AUTHORITY_COMPLETE_SUBSET_SHADOW_VERSION,
  applySemanticAuthorityRecoveries,
  evaluateAuthorityCompleteMixedSubsetShadow,
  evaluateNeutralSemanticAuthorityCompleteness,
} from "../lib/sunscreen-authority-complete-subset-shadow.mjs";

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

assert.equal(
  SUNSCREEN_AUTHORITY_COMPLETE_SUBSET_SHADOW_VERSION,
  "data-ai29c-d3r3-authority-complete-subset-shadow-v1",
);
assert.equal(recovery.observedFromProduction, true);
assert.equal(recovery.recoveryCount, 3);
assert.equal(recovery.recoveries.length, 3);

// D3R3-1: governed recoveries are exact and do not fabricate the two
// still-unresolved finishes.
const recovered = applySemanticAuthorityRecoveries(
  d1b.products,
  recovery,
);
const recoveredById = new Map(
  recovered.map((bundle) => [bundle.productId, bundle]),
);

const physical = recoveredById.get(
  "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
);
assert.equal(physical.fields.finish.state, "established");
assert.equal(physical.fields.finish.value, "dewy");
assert.equal(physical.fields.tone_up.state, "established");
assert.equal(physical.fields.tone_up.value, true);

const minJungGi = recoveredById.get(
  "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
);
assert.equal(minJungGi.fields.finish.state, "established");
assert.equal(minJungGi.fields.finish.value, "soft_matte");

for (const id of [
  "b576991e-79c9-4189-b6e9-527aeeb03566",
  "7c709c04-e299-4ca6-be69-6aaf4a753f13",
]) {
  assert.equal(
    recoveredById.get(id).fields.finish.state,
    "reviewed_not_established",
  );
  assert.equal(recoveredById.get(id).fields.finish.value, null);
}

// D3R3-2: neutral current-scorer authority requires exactly category,
// UV filter, finish and tone-up. Recovery creates a 3-product complete subset.
const completeness = recovered.map((bundle) =>
  evaluateNeutralSemanticAuthorityCompleteness(bundle),
);
const completeIds = completeness
  .filter((row) => row.complete)
  .map((row) => row.productId)
  .sort();

assert.deepEqual(completeIds, [
  "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
  "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
  "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
]);

const result = evaluateAuthorityCompleteMixedSubsetShadow({
  legacyProducts: legacy.products,
  authorityRows: d2.products,
  semanticBundles: d1b.products,
  recoveryFixture: recovery,
  protectionRecords: protection.records,
});

// D3R3-3: 11 legacy + 3 fully comparable new products use the unchanged
// current sunscreen scorer. Zinc/Bio remain explicit semantic holds.
assert.equal(result.legacyCount, 11);
assert.equal(result.newGrantCount, 5);
assert.equal(result.newScoreableCount, 3);
assert.equal(result.newHeldCount, 2);
assert.equal(result.mixedBaselineCount, 14);
assert.deepEqual(result.scoreableNewProductIds, completeIds);

const heldById = new Map(
  result.heldNew.map((row) => [row.productId, row]),
);
for (const id of [
  "b576991e-79c9-4189-b6e9-527aeeb03566",
  "7c709c04-e299-4ca6-be69-6aaf4a753f13",
]) {
  assert.equal(heldById.get(id)?.stage, "semantic_hold");
  assert.ok(
    heldById
      .get(id)
      ?.blockers.includes("NEUTRAL_SCORING_AUTHORITY_MISSING:finish"),
  );
}

const newRows = new Map(
  result.newRows.map((row) => [row.productId, row]),
);
assert.equal(
  newRows.get("a6994fcd-302f-4e63-acbe-91a3f17a5a65")
    ?.baselineScore,
  -8,
);
assert.equal(
  newRows.get("b90bf992-07ae-4f49-a3a4-d90ea6d4a858")
    ?.baselineScore,
  -8,
);
assert.equal(
  newRows.get("7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17")
    ?.baselineScore,
  4,
);

// D3R3-4: neutral baseline cross-cohort comparison no longer requires
// masking legacy semantics. Existing legacy top-set remains the current one.
assert.deepEqual(result.baselineTopSet, [
  "0bb742d2-df6b-49a7-8e29-8f76ae62ac0d",
  "9983f167-24e7-4223-bd86-446ce6ced31b",
  "cbcd06a2-de29-47ca-afd1-ab1d5de93903",
  "dc1ef3f3-db1b-4c3f-954a-b18343e3d9f3",
]);

// D3R3-5: SPF authority is complete in the 14-product comparable subset.
// SPF-only shadow preserves the neutral top-set.
assert.deepEqual(result.spfCoverage, {
  eligibleCount: 14,
  totalCount: 14,
  complete: true,
  missingProductIds: [],
});
assert.equal(result.spfMixedRankingSafe, true);
assert.deepEqual(result.spfTopSet, result.baselineTopSet);
assert.equal(result.spfTopSetPreserved, true);

// D3R3-6: UVA authority is NOT complete. LRP and SKIN1004 are missing UVA.
// A naive +0 treatment would alter the top set and therefore is forbidden.
assert.equal(result.uvaCoverage.eligibleCount, 12);
assert.equal(result.uvaCoverage.totalCount, 14);
assert.equal(result.uvaCoverage.complete, false);
assert.deepEqual(result.uvaCoverage.missingProductIds, [
  "9983f167-24e7-4223-bd86-446ce6ced31b",
  "fdf06871-db8e-4e73-a48c-c057c5ce925d",
]);
assert.equal(result.uvaMixedRankingSafe, false);
assert.deepEqual(result.uvaNaiveTopSet, [
  "0bb742d2-df6b-49a7-8e29-8f76ae62ac0d",
  "cbcd06a2-de29-47ca-afd1-ab1d5de93903",
  "dc1ef3f3-db1b-4c3f-954a-b18343e3d9f3",
]);
assert.equal(result.uvaNaiveTopSetPreserved, false);

// D3R3-7: D3R3 remains a shadow. Missing UVA is not silently interpreted
// as low protection and no Production authority is changed.
assert.deepEqual(result.limits, {
  productionCandidateAdmissionWired: false,
  productionRankingChanged: false,
  productionCutoverAuthorized: false,
  outdoorRankableSignalAuthorized: false,
  publicActivation: false,
  waterResistanceApplied: false,
  missingProtectionAuthorityTreatedAsLow: false,
  persistence: false,
});

for (const value of Object.values(recovery.limits)) {
  assert.equal(value, false);
}

const source = fs.readFileSync(
  "lib/sunscreen-authority-complete-subset-shadow.mjs",
  "utf8",
);
assert.ok(source.includes('from "./recommendation-scoring.ts"'));
assert.ok(source.includes("filterSunscreenCandidates"));
assert.ok(source.includes("scoreSunscreenProduct"));
assert.equal(source.includes("buildRecommendationProductFromSource"), false);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D3R3",
    recoveryCount: recovery.recoveryCount,
    neutralComparableNewCount: result.newScoreableCount,
    mixedBaselineCount: result.mixedBaselineCount,
    spfCoverage: result.spfCoverage,
    uvaCoverage: result.uvaCoverage,
    spfTopSetPreserved: result.spfTopSetPreserved,
    uvaNaiveTopSetPreserved: result.uvaNaiveTopSetPreserved,
    conclusion:
      "AUTHORITY_COMPLETE_SUBSET_READY_SPF_COMPARABLE_UVA_HOLD",
  }),
);
