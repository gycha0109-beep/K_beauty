#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
} from "../lib/product-query-intent-contract.mjs";
import {
  rankStructuredProductQueryFromProducts,
} from "../lib/product-query-recommendation.js";
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

function intent(overrides = {}) {
  return {
    schema_version: PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
    category: "sunscreen",
    skin_type: null,
    concerns: [],
    sensitivity: null,
    texture: null,
    disliked_feel: null,
    preferred_finish: null,
    post_wash_feeling: null,
    afternoon_skin_change: null,
    very_sensitive_period: null,
    sunscreen_intent: true,
    white_cast_hate: null,
    tone_up_wanted: null,
    eye_sensitive: null,
    makeup_use: null,
    outdoor_exposure: null,
    unresolved_terms: [],
    confidence: "high",
    ...overrides,
  };
}

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

// D5A-2: explicit OFF is behavior-identical to the pre-D5 call shape.
const baselineIntent = intent({
  skin_type: "oily",
  outdoor_exposure: true,
});
const beforeGate = rankStructuredProductQueryFromProducts(
  baselineIntent,
  products,
  { limit: 10 },
);
const explicitOff = rankStructuredProductQueryFromProducts(
  baselineIntent,
  products,
  {
    limit: 10,
    spfRuntimeGate: {
      enabled: false,
      protectionByProductId,
    },
  },
);
assert.deepEqual(explicitOff, beforeGate);

// D5A-3: outdoor exposure alone is still insufficient when the flag is OFF.
const outdoorOnly = intent({ outdoor_exposure: true });
const outdoorOff = rankStructuredProductQueryFromProducts(
  outdoorOnly,
  products,
  {
    limit: 10,
    spfRuntimeGate: {
      enabled: false,
      protectionByProductId,
    },
    includeRuntimeGateEvidence: true,
  },
);
assert.equal(outdoorOff.status, "insufficient_supported_intent");
assert.deepEqual(outdoorOff.rankableSignals, []);
assert.equal(outdoorOff.results.length, 0);
assert.equal(outdoorOff.runtimeGateEvidence, undefined);

// D5A-4: with the flag ON and complete SPF authority, explicit outdoor
// exposure becomes a bounded sunscreen rankable signal.
const outdoorOn = rankStructuredProductQueryFromProducts(
  outdoorOnly,
  products,
  {
    limit: 10,
    spfRuntimeGate: {
      enabled: true,
      protectionByProductId,
    },
    includeRuntimeGateEvidence: true,
  },
);
assert.equal(outdoorOn.status, "ranked");
assert.ok(outdoorOn.rankableSignals.includes("outdoor_exposure"));
assert.equal(outdoorOn.runtimeGateEvidence.spf.flagEnabled, true);
assert.equal(outdoorOn.runtimeGateEvidence.spf.requestEligible, true);
assert.equal(outdoorOn.runtimeGateEvidence.spf.authorityComplete, true);
assert.equal(outdoorOn.runtimeGateEvidence.spf.axisApplied, true);
assert.equal(
  outdoorOn.runtimeGateEvidence.spf.adjustments.length,
  14,
);
assert.equal(
  outdoorOn.runtimeGateEvidence.spf.missingProductIds.length,
  0,
);
assert.equal(
  outdoorOn.runtimeGateEvidence.spf.limits.uvaApplied,
  false,
);
assert.equal(
  outdoorOn.runtimeGateEvidence.spf.limits.waterResistanceApplied,
  false,
);

// D5A-5: the three comparable new products retain the D4 governed SPF deltas.
const adjustmentById = new Map(
  outdoorOn.runtimeGateEvidence.spf.adjustments.map((row) => [
    row.productId,
    row,
  ]),
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
const legacyAdjustments =
  outdoorOn.runtimeGateEvidence.spf.adjustments.filter((row) =>
    legacyIds.has(row.productId),
  );
assert.equal(legacyAdjustments.length, 11);
assert.ok(
  legacyAdjustments.every((row) => row.spfDelta === 6),
);

// D5A-6: one missing SPF authority disables the entire axis. Missing is not
// converted to a low-protection +0 candidate inside an otherwise active cohort.
const incompleteMap = new Map(protectionByProductId);
incompleteMap.delete("9983f167-24e7-4223-bd86-446ce6ced31b");
const incomplete = rankStructuredProductQueryFromProducts(
  outdoorOnly,
  products,
  {
    limit: 10,
    spfRuntimeGate: {
      enabled: true,
      protectionByProductId: incompleteMap,
    },
    includeRuntimeGateEvidence: true,
  },
);
assert.equal(incomplete.status, "insufficient_supported_intent");
assert.deepEqual(incomplete.rankableSignals, []);
assert.equal(incomplete.results.length, 0);
assert.equal(incomplete.runtimeGateEvidence.spf.axisApplied, false);
assert.equal(
  incomplete.runtimeGateEvidence.spf.reason,
  "COHORT_SPF_AUTHORITY_INCOMPLETE",
);
assert.deepEqual(
  incomplete.runtimeGateEvidence.spf.missingProductIds,
  ["9983f167-24e7-4223-bd86-446ce6ced31b"],
);
assert.equal(
  incomplete.runtimeGateEvidence.spf.limits
    .missingAuthorityTreatedAsLowProtection,
  false,
);

// D5A-7: non-outdoor requests cannot receive the SPF axis even when enabled.
const nonOutdoor = rankStructuredProductQueryFromProducts(
  intent({ skin_type: "oily", outdoor_exposure: false }),
  products,
  {
    limit: 10,
    spfRuntimeGate: {
      enabled: true,
      protectionByProductId,
    },
    includeRuntimeGateEvidence: true,
  },
);
assert.equal(nonOutdoor.status, "ranked");
assert.equal(nonOutdoor.runtimeGateEvidence.spf.axisApplied, false);
assert.equal(
  nonOutdoor.runtimeGateEvidence.spf.reason,
  "OUTDOOR_EXPOSURE_NOT_EXPLICIT",
);
assert.equal(
  nonOutdoor.rankableSignals.includes("outdoor_exposure"),
  false,
);

// D5A-8: SPF overlay is post-hard-reject. A dry-context soft-matte legacy
// sunscreen must not receive an adjustment or reappear after rejection.
const dryOutdoor = rankStructuredProductQueryFromProducts(
  intent({
    skin_type: "dry",
    concerns: ["dehydration"],
    outdoor_exposure: true,
  }),
  products,
  {
    limit: 10,
    spfRuntimeGate: {
      enabled: true,
      protectionByProductId,
    },
    includeRuntimeGateEvidence: true,
  },
);
const dryRejectedId =
  "2d3591f2-2216-4043-8493-a9492806ef8b";
assert.equal(dryOutdoor.status, "ranked");
assert.equal(dryOutdoor.runtimeGateEvidence.spf.axisApplied, true);
assert.equal(
  dryOutdoor.runtimeGateEvidence.spf.adjustments.some(
    (row) => row.productId === dryRejectedId,
  ),
  false,
);
assert.equal(
  dryOutdoor.results.some(
    (product) => product.id === dryRejectedId,
  ),
  false,
);

// D5A-9: direct gate contract never activates UVA/water and never mutates
// candidate admission/public persistence boundaries.
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

const recommendationSource = fs.readFileSync(
  "lib/product-query-recommendation.js",
  "utf8",
);
assert.ok(
  recommendationSource.includes(
    "applySunscreenSpfRuntimeGate",
  ),
);
assert.ok(
  recommendationSource.includes(
    "spfRuntimeGateDefault: false",
  ),
);
assert.equal(
  recommendationSource.includes("readRecommendationSunscreenProtection"),
  false,
  "shared ranking module must not gain direct Product Fact transport",
);
assert.equal(
  recommendationSource.includes("SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED"),
  false,
  "shared ranking module must not read environment directly",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D5A",
    flag: SUNSCREEN_SPF_RUNTIME_FLAG,
    defaultEnabled: SUNSCREEN_SPF_RUNTIME_DEFAULT_ENABLED,
    mixedCorpusCount: products.length,
    outdoorOnlyOffStatus: outdoorOff.status,
    outdoorOnlyOnStatus: outdoorOn.status,
    spfAuthorityComplete:
      outdoorOn.runtimeGateEvidence.spf.authorityComplete,
    legacyUniformDelta: [
      ...new Set(legacyAdjustments.map((row) => row.spfDelta)),
    ],
    decision:
      "D5A_RUNTIME_GATE_IMPLEMENTED_DEFAULT_OFF_D5B_REQUIRED",
  }),
);
