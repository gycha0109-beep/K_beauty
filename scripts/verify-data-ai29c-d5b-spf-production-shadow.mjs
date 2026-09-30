#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateAuthorityCompleteMixedSubsetShadow,
} from "../lib/sunscreen-authority-complete-subset-shadow.mjs";
import {
  applySunscreenSpfRuntimeGate,
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

const d3r3 = evaluateAuthorityCompleteMixedSubsetShadow({
  legacyProducts: legacy.products,
  authorityRows: d2.products,
  semanticBundles: d1b.products,
  recoveryFixture: recovery,
  protectionRecords: protection.records,
});

function protectionMap(productIds) {
  const allowed = new Set(productIds);
  return new Map(
    protection.records
      .filter((record) => allowed.has(record.product_id))
      .map((record) => [
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

function sortedByScoreThenId(rows) {
  return [...rows]
    .sort(
      (a, b) =>
        Number(b.score) - Number(a.score) ||
        String(a.id).localeCompare(String(b.id)),
    )
    .map((row) => row.id);
}

function allFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...allFiles(full));
    else out.push(full);
  }
  return out;
}

// D5B-1: current Production sunscreen control cohort is frozen legacy 11.
assert.equal(legacy.products.length, 11);
const legacyIds = legacy.products.map((product) => product.id);
const legacyRows = d3r3.legacyRows
  .filter((row) => row.stage === "scored")
  .map((row) => ({
    id: row.productId,
    score: row.baselineScore,
  }));
assert.equal(legacyRows.length, 11);

const legacyGate = applySunscreenSpfRuntimeGate({
  rankedProducts: legacyRows,
  enabled: true,
  sunscreenIntent: true,
  outdoorExposure: true,
  protectionByProductId: protectionMap(legacyIds),
});
assert.equal(legacyGate.axisApplied, true);
assert.equal(legacyGate.authorityComplete, true);
assert.equal(legacyGate.adjustments.length, 11);
assert.deepEqual(
  [...new Set(legacyGate.adjustments.map((row) => row.spfDelta))],
  [6],
);

// Adding the same +6 to every legacy candidate cannot change relative order.
assert.deepEqual(
  sortedByScoreThenId(legacyRows),
  sortedByScoreThenId(legacyGate.products),
);

// D5B-2: the mixed 14 corpus remains the discrimination proof.
assert.equal(d3r3.mixedBaselineCount, 14);
const mixedRows = d3r3.mixedBaseline.map((row) => ({
  id: row.productId,
  score: row.baselineScore,
}));
const mixedIds = mixedRows.map((row) => row.id);
const mixedGate = applySunscreenSpfRuntimeGate({
  rankedProducts: mixedRows,
  enabled: true,
  sunscreenIntent: true,
  outdoorExposure: true,
  protectionByProductId: protectionMap(mixedIds),
});
assert.equal(mixedGate.axisApplied, true);
assert.equal(mixedGate.authorityComplete, true);
assert.equal(mixedGate.adjustments.length, 14);

const mixedDelta = new Map(
  mixedGate.adjustments.map((row) => [
    row.productId,
    row.spfDelta,
  ]),
);
assert.equal(
  mixedDelta.get("a6994fcd-302f-4e63-acbe-91a3f17a5a65"),
  2,
);
assert.equal(
  mixedDelta.get("b90bf992-07ae-4f49-a3a4-d90ea6d4a858"),
  4,
);
assert.equal(
  mixedDelta.get("7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17"),
  4,
);

const heldIds = new Set(d3r3.heldNew.map((row) => row.productId));
assert.equal(heldIds.size, 2);
assert.ok(
  mixedGate.adjustments.every(
    (row) => !heldIds.has(row.productId),
  ),
);

// D5B-3: missing authority is cohort-wide fail-closed.
const missingMap = protectionMap(mixedIds);
missingMap.delete("9983f167-24e7-4223-bd86-446ce6ced31b");
const missingGate = applySunscreenSpfRuntimeGate({
  rankedProducts: mixedRows,
  enabled: true,
  sunscreenIntent: true,
  outdoorExposure: true,
  protectionByProductId: missingMap,
});
assert.equal(missingGate.axisApplied, false);
assert.equal(
  missingGate.reason,
  "COHORT_SPF_AUTHORITY_INCOMPLETE",
);
assert.deepEqual(
  missingGate.missingProductIds,
  ["9983f167-24e7-4223-bd86-446ce6ced31b"],
);

// D5B-4: server shadow uses actual admitted Production corpus and governed
// authority reads, rather than duplicating scorer logic.
const servicePath =
  "lib/server/product-query-spf-production-shadow-service.js";
const service = fs.readFileSync(servicePath, "utf8");
assert.ok(service.includes('import "server-only"'));
assert.ok(service.includes("getRecommendationProducts"));
assert.ok(
  service.includes(
    "readRecommendationSunscreenProtectionAuthorities",
  ),
);
assert.ok(service.includes("projectSunscreenProtectionAuthority"));
assert.ok(
  service.includes("rankStructuredProductQueryFromProducts"),
);
assert.ok(
  service.includes("allowShadowTransportFallback: true"),
);
assert.ok(service.includes("enabled: false"));
assert.ok(service.includes("enabled: true"));
assert.ok(
  service.includes("exactStableProjection: offParity"),
);
assert.ok(service.includes("orderInvariant"));
assert.ok(
  service.includes('"D5B_CURRENT_PRODUCTION_SHADOW_PASS"'),
);

assert.equal(service.includes("extractProductQueryIntent"), false);
assert.equal(
  service.includes("runNaturalLanguageProductQueryShadow"),
  false,
);
assert.equal(service.includes("OPENAI_API_KEY"), false);
assert.ok(service.includes("fixedStructuredIntentOnly: true"));
assert.ok(service.includes("providerInvoked: false"));
assert.ok(service.includes("rawQueryAccepted: false"));

for (const boundary of [
  "profileRead: false",
  "historyRead: false",
  "productionWrite: false",
  "recommendationLogWrite: false",
  "liveNewSunscreenAdmission: false",
  "productionRankingChanged: false",
  "productionCutoverAuthorized: false",
  "outdoorRankableSignalAuthorized: false",
  "publicActivation: false",
  "uvaActivated: false",
  "waterResistanceApplied: false",
  "persistence: false",
]) {
  assert.ok(
    service.includes(boundary),
    "missing D5B boundary: " + boundary,
  );
}

// D5B service must not be reachable from an API route yet.
for (const file of allFiles("app/api")) {
  if (!/\.(js|mjs|cjs|ts|tsx)$/.test(file)) continue;
  const source = fs.readFileSync(file, "utf8");
  assert.equal(
    source.includes(
      "product-query-spf-production-shadow-service",
    ),
    false,
    "D5B service unexpectedly routed by " + file,
  );
}

const recommendation = fs.readFileSync(
  "lib/product-query-recommendation.js",
  "utf8",
);
assert.ok(
  recommendation.includes("spfRuntimeGateDefault: false"),
);
assert.equal(
  recommendation.includes(
    "process.env.SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED",
  ),
  false,
);

const productSource = fs.readFileSync("lib/product-source.js", "utf8");
assert.equal(
  productSource.includes("SUNSCREEN_INITIAL_ADMISSION_GRANT"),
  false,
);
assert.equal(
  productSource.includes(
    "read_sunscreen_recommendation_semantic_bundle_v1",
  ),
  false,
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D5B",
    currentProductionSunscreenControlCount: legacyRows.length,
    legacyDistinctSpfDeltas: [
      ...new Set(
        legacyGate.adjustments.map((row) => row.spfDelta),
      ),
    ],
    legacyOrderInvariant: true,
    mixedComparableCount: mixedRows.length,
    mixedNewDeltas: {
      physicalDaily: mixedDelta.get(
        "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
      ),
      minJungGi: mixedDelta.get(
        "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
      ),
      jojoba: mixedDelta.get(
        "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
      ),
    },
    decision:
      "D5B_PRODUCTION_EQUIVALENT_SHADOW_CONTRACT_READY_NO_ACTIVATION",
  }),
);
