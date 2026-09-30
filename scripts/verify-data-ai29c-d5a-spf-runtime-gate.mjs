#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  applySemanticAuthorityRecoveries,
  evaluateAuthorityCompleteMixedSubsetShadow,
} from "../lib/sunscreen-authority-complete-subset-shadow.mjs";
import {
  projectEstablishedSunscreenSemantics,
} from "../lib/sunscreen-recommendation-semantic-projection.mjs";
import {
  SUNSCREEN_SPF_RUNTIME_DEFAULT_ENABLED,
  SUNSCREEN_SPF_RUNTIME_FLAG,
  SUNSCREEN_SPF_RUNTIME_GATE_VERSION,
  applySunscreenSpfRuntimeGate,
  parseSunscreenSpfRuntimeFlag,
} from "../lib/sunscreen-spf-runtime-gate.mjs";

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

function buildMixedProducts() {
  const d3r3 = evaluateAuthorityCompleteMixedSubsetShadow({
    legacyProducts: legacy.products,
    authorityRows: d2.products,
    semanticBundles: d1b.products,
    recoveryFixture: recovery,
    protectionRecords: protection.records,
  });

  assert.equal(d3r3.mixedBaselineCount, 14);
  assert.equal(d3r3.scoreableNewProductIds.length, 3);

  const recovered = applySemanticAuthorityRecoveries(
    d1b.products,
    recovery,
  );
  const semanticById = new Map(
    recovered.map((bundle) => [bundle.productId, bundle]),
  );
  const authorityById = new Map(
    d2.products.map((row) => [row.product.id, row]),
  );

  const projectedNew = d3r3.scoreableNewProductIds.map((productId) => {
    const row = authorityById.get(productId);
    const bundle = semanticById.get(productId);
    assert.ok(row, `missing D2 authority row: ${productId}`);
    assert.ok(bundle, `missing semantic bundle: ${productId}`);

    const projection = projectEstablishedSunscreenSemantics({
      ...structuredClone(bundle),
      subjectId: row.subject.subjectId,
    });
    assert.equal(projection.envelope.envelopeReady, true);
    assert.ok(projection.projected);

    const s = projection.projected;
    return {
      id: row.product.id,
      name: row.product.name,
      brand: row.product.brand || "SIDMOOL",
      category: "sunscreen",
      skin_types: s.skin_types,
      concerns: s.concerns,
      texture: s.texture,
      finish: s.finish,
      uv_filter_type: s.uv_filter_type,
      sensitivity_safe: s.sensitivity_safe,
      irritation_risk: s.irritation_risk,
      tone_up: s.tone_up,
      white_cast: s.white_cast,
      eye_sting: s.eye_sting,
      pilling_risk: s.pilling_risk,
    };
  });

  return {
    d3r3,
    products: [...legacy.products, ...projectedNew],
  };
}

function buildProtectionMap() {
  return new Map(
    protection.records.map((record) => [
      record.product_id,
      {
        spf: {
          eligible: Boolean(record.spf_bucket),
          bucket: record.spf_bucket || null,
        },
        uva: {
          eligible: Boolean(record.uva_bucket),
          bucket: record.uva_bucket || null,
        },
        waterResistance: {
          eligible: Boolean(record.water_bucket),
          bucket: record.water_bucket || null,
        },
      },
    ]),
  );
}

const { d3r3, products } = buildMixedProducts();
const protectionByProductId = buildProtectionMap();

assert.equal(products.length, 14);
assert.equal(
  products.filter((product) => product.category === "sunscreen").length,
  14,
);

// D5A-1: flag contract is strict and default OFF.
assert.equal(
  SUNSCREEN_SPF_RUNTIME_GATE_VERSION,
  "data-ai29c-d5a-spf-runtime-gate-v1",
);
assert.equal(
  SUNSCREEN_SPF_RUNTIME_FLAG,
  "SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED",
);
assert.equal(SUNSCREEN_SPF_RUNTIME_DEFAULT_ENABLED, false);
assert.equal(parseSunscreenSpfRuntimeFlag(undefined), false);
assert.equal(parseSunscreenSpfRuntimeFlag(null), false);
assert.equal(parseSunscreenSpfRuntimeFlag(false), false);
assert.equal(parseSunscreenSpfRuntimeFlag("false"), false);
assert.equal(parseSunscreenSpfRuntimeFlag("TRUE"), false);
assert.equal(parseSunscreenSpfRuntimeFlag("true"), true);
assert.equal(parseSunscreenSpfRuntimeFlag(true), true);

// D5A-2: the gate itself is behavior-identical when OFF.
const baselineRows = d3r3.mixedBaseline.map((row) => ({
  id: row.productId,
  score: row.baselineScore,
}));
const gateOff = applySunscreenSpfRuntimeGate({
  rankedProducts: baselineRows,
  enabled: false,
  sunscreenIntent: true,
  outdoorExposure: true,
  protectionByProductId,
});
assert.equal(gateOff.axisApplied, false);
assert.equal(gateOff.reason, "SPF_RUNTIME_FLAG_OFF");
assert.deepEqual(
  gateOff.products.map((row) => [row.id, row.score]),
  baselineRows.map((row) => [row.id, row.score]),
);

// D5A-3: non-outdoor never activates.
const nonOutdoor = applySunscreenSpfRuntimeGate({
  rankedProducts: baselineRows,
  enabled: true,
  sunscreenIntent: true,
  outdoorExposure: false,
  protectionByProductId,
});
assert.equal(nonOutdoor.axisApplied, false);
assert.equal(
  nonOutdoor.reason,
  "OUTDOOR_EXPOSURE_NOT_EXPLICIT",
);

// D5A-4: explicit outdoor + sunscreen intent + complete SPF authority activates
// SPF only across the complete 14-product comparable cohort.
const outdoorOn = applySunscreenSpfRuntimeGate({
  rankedProducts: baselineRows,
  enabled: true,
  sunscreenIntent: true,
  outdoorExposure: true,
  protectionByProductId,
});
assert.equal(outdoorOn.axisApplied, true);
assert.equal(outdoorOn.authorityComplete, true);
assert.equal(outdoorOn.adjustments.length, 14);
assert.equal(outdoorOn.missingProductIds.length, 0);
assert.equal(outdoorOn.rankableSignalAdded, true);

// D5A-5: the three comparable new products retain the D4 governed SPF deltas.
const adjustmentById = new Map(
  outdoorOn.adjustments.map((row) => [row.productId, row]),
);
assert.equal(
  adjustmentById.get(
    "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
  )?.spfDelta,
  2,
);
assert.equal(
  adjustmentById.get(
    "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
  )?.spfDelta,
  4,
);
assert.equal(
  adjustmentById.get(
    "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
  )?.spfDelta,
  4,
);

const legacyIds = new Set(legacy.products.map((product) => product.id));
const legacyAdjustments = outdoorOn.adjustments.filter((row) =>
  legacyIds.has(row.productId),
);
assert.equal(legacyAdjustments.length, 11);
assert.ok(legacyAdjustments.every((row) => row.spfDelta === 6));

// D5A-6: one missing SPF authority disables the entire axis. Missing is not
// converted into a low-protection +0 candidate while peers receive bonuses.
const incompleteMap = new Map(protectionByProductId);
incompleteMap.delete("9983f167-24e7-4223-bd86-446ce6ced31b");
const incomplete = applySunscreenSpfRuntimeGate({
  rankedProducts: baselineRows,
  enabled: true,
  sunscreenIntent: true,
  outdoorExposure: true,
  protectionByProductId: incompleteMap,
});
assert.equal(incomplete.axisApplied, false);
assert.equal(
  incomplete.reason,
  "COHORT_SPF_AUTHORITY_INCOMPLETE",
);
assert.deepEqual(
  incomplete.missingProductIds,
  ["9983f167-24e7-4223-bd86-446ce6ced31b"],
);
assert.deepEqual(
  incomplete.products.map((row) => [row.id, row.score]),
  baselineRows.map((row) => [row.id, row.score]),
);
assert.equal(
  incomplete.limits.missingAuthorityTreatedAsLowProtection,
  false,
);

// D5A-7: hard-rejected/held candidates are outside this gate by contract.
// D3R3's comparable baseline contains only scored candidates, while the two
// semantic HOLD products remain excluded.
const heldIds = new Set(
  d3r3.heldNew.map((row) => row.productId),
);
assert.equal(heldIds.size, 2);
assert.ok(
  outdoorOn.adjustments.every(
    (row) => !heldIds.has(row.productId),
  ),
);
assert.equal(
  outdoorOn.limits.rejectedCandidateResurrectionPossible,
  false,
);

// D5A-8: Product Query integration is structurally post-filter/post-score,
// default OFF, and only promotes outdoor_exposure when the SPF gate applied.
const recommendationSource = fs.readFileSync(
  "lib/product-query-recommendation.js",
  "utf8",
);
const filterIndex = recommendationSource.indexOf(
  "filterSunscreenCandidates",
);
const scoreIndex = recommendationSource.indexOf(
  "scoreSunscreenProduct",
);
const gateIndex = recommendationSource.indexOf(
  "applySunscreenSpfRuntimeGate({",
);
assert.ok(filterIndex >= 0);
assert.ok(scoreIndex > filterIndex);
assert.ok(gateIndex > scoreIndex);
assert.ok(
  recommendationSource.includes(
    "options?.spfRuntimeGate?.enabled === true",
  ),
);
assert.ok(
  recommendationSource.includes(
    'new Set([...plan.rankableSignals, "outdoor_exposure"])',
  ),
);
assert.ok(
  recommendationSource.includes(
    "spfRuntimeGateDefault: false",
  ),
);
assert.equal(
  recommendationSource.includes(
    "readRecommendationSunscreenProtection",
  ),
  false,
  "shared ranking module must not gain direct Product Fact transport",
);
assert.equal(
  recommendationSource.includes(
    "SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED",
  ),
  false,
  "shared ranking module must not read environment directly",
);

// D5A-9: direct gate contract never activates UVA/water.
const direct = applySunscreenSpfRuntimeGate({
  rankedProducts: [
    { id: "a", score: 10 },
    { id: "b", score: 10 },
  ],
  enabled: true,
  sunscreenIntent: true,
  outdoorExposure: true,
  protectionByProductId: new Map([
    [
      "a",
      {
        spf: { eligible: true, bucket: "spf_50_plus_band" },
        uva: { eligible: true, bucket: "uva_high" },
        waterResistance: {
          eligible: true,
          bucket: "water_80_plus",
        },
      },
    ],
    [
      "b",
      {
        spf: { eligible: true, bucket: "spf_30_49" },
        uva: { eligible: true, bucket: "uva_high" },
        waterResistance: {
          eligible: true,
          bucket: "water_80_plus",
        },
      },
    ],
  ]),
});
assert.equal(direct.axisApplied, true);
assert.deepEqual(
  direct.adjustments.map((row) => row.spfDelta),
  [6, 4],
);
assert.ok(
  direct.adjustments.every(
    (row) =>
      row.enabledAxes.length === 1 &&
      row.enabledAxes[0] === "spf" &&
      row.blockedAxes.includes("uva:not_ranking_useful") &&
      row.blockedAxes.includes(
        "waterResistance:water_resistance_intent_not_available",
      ),
  ),
);
assert.deepEqual(direct.limits, {
  uvaApplied: false,
  waterResistanceApplied: false,
  missingAuthorityTreatedAsLowProtection: false,
  rejectedCandidateResurrectionPossible: false,
  candidateAdmissionMutated: false,
  publicActivation: false,
  persistence: false,
});

// D5A-10: D4 authority proof remains the prerequisite snapshot.
assert.equal(d3r3.spfCoverage.complete, true);
assert.equal(d3r3.spfCoverage.eligibleCount, 14);
assert.equal(d3r3.spfCoverage.totalCount, 14);
assert.equal(d3r3.spfMixedRankingSafe, true);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D5A",
    flag: SUNSCREEN_SPF_RUNTIME_FLAG,
    defaultEnabled: SUNSCREEN_SPF_RUNTIME_DEFAULT_ENABLED,
    mixedCorpusCount: products.length,
    spfAuthorityComplete: outdoorOn.authorityComplete,
    legacyUniformDelta: [
      ...new Set(legacyAdjustments.map((row) => row.spfDelta)),
    ],
    decision:
      "D5A_RUNTIME_GATE_IMPLEMENTED_DEFAULT_OFF_D5B_REQUIRED",
  }),
);
