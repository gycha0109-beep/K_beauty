#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildSunscreenProtectionCorpusAudit
} from "../lib/sunscreen-protection-corpus-audit.mjs";
import {
  projectSunscreenProtectionAuthority
} from "../lib/sunscreen-protection-projection.mjs";
import {
  SUNSCREEN_PROTECTION_SHADOW_SCORING_VERSION,
  buildSunscreenProtectionShadowAdjustment
} from "../lib/sunscreen-protection-shadow-scoring.mjs";
import {
  PRODUCT_QUERY_INTENT_SCHEMA_VERSION
} from "../lib/product-query-intent-contract.mjs";
import {
  buildProductQueryExecutionPlan
} from "../lib/product-query-execution-contract.mjs";

function fact({
  factKey,
  valueNumber = null,
  valueUnit = null,
  valueEnum = null,
  qualifier = {}
}) {
  return {
    fact_key: factKey,
    semantic_status: "supported",
    authority_ceiling: "product_specific_primary",
    fused_confidence: "high",
    valid_to: null,
    value_number: valueNumber,
    value_unit: valueUnit,
    value_enum: valueEnum,
    qualifier
  };
}

function record(productId, { spf, uva, water } = {}) {
  const currentFacts = [];
  if (spf != null) {
    currentFacts.push(
      fact({
        factKey: "spf_value",
        valueNumber: spf,
        qualifier: { plus_modifier: spf >= 50 ? "plus" : "none" }
      })
    );
  }
  if (uva) {
    currentFacts.push(
      fact({
        factKey: "uva_label",
        valueEnum: uva
      })
    );
  }
  if (water != null) {
    currentFacts.push(
      fact({
        factKey: "water_resistance_duration",
        valueNumber: water,
        valueUnit: "minutes"
      })
    );
  }

  return {
    productId,
    authority: {
      status: "AUTHORITY_RESOLVED",
      authority: { currentFacts }
    }
  };
}

const productA = record("a", {
  spf: 50,
  uva: "PA++++",
  water: 80
});
const productB = record("b", {
  spf: 30,
  uva: "PA++",
  water: 40
});
const diverseAudit = buildSunscreenProtectionCorpusAudit([
  productA,
  productB
]);

assert.equal(diverseAudit.axes.spf.rankingUseful, true);
assert.equal(diverseAudit.axes.uva.rankingUseful, true);
assert.equal(diverseAudit.axes.waterResistance.rankingUseful, true);

const projectionA = projectSunscreenProtectionAuthority(productA);
const projectionB = projectSunscreenProtectionAuthority(productB);

const outdoorA = buildSunscreenProtectionShadowAdjustment({
  baselineScore: 60,
  protection: projectionA,
  audit: diverseAudit,
  outdoorExposure: true
});
const outdoorB = buildSunscreenProtectionShadowAdjustment({
  baselineScore: 64,
  protection: projectionB,
  audit: diverseAudit,
  outdoorExposure: true
});

assert.equal(
  outdoorA.version,
  SUNSCREEN_PROTECTION_SHADOW_SCORING_VERSION
);
assert.deepEqual(outdoorA.potentialAdjustments, {
  spf: 6,
  uva: 6,
  waterResistance: 10
});
assert.deepEqual(outdoorA.appliedAdjustments, {
  spf: 6,
  uva: 6,
  waterResistance: 0
});
assert.equal(outdoorA.shadowScore, 72);
assert.equal(outdoorB.shadowScore, 70);
assert.ok(
  outdoorA.shadowScore > outdoorB.shadowScore,
  "diverse governed SPF/UVA buckets must be able to move shadow ordering"
);
assert.ok(
  outdoorA.blockedAxes.includes(
    "waterResistance:water_resistance_intent_not_available"
  ),
  "water resistance must remain blocked in Phase B"
);

const controlA = buildSunscreenProtectionShadowAdjustment({
  baselineScore: 60,
  protection: projectionA,
  audit: diverseAudit,
  outdoorExposure: false
});
assert.deepEqual(controlA.appliedAdjustments, {
  spf: 0,
  uva: 0,
  waterResistance: 0
});
assert.equal(controlA.shadowScore, 60);

const unknownProjection = projectSunscreenProtectionAuthority({
  productId: "unknown",
  authority: {
    status: "NO_AUTHORITY",
    authority: null
  }
});
const unknownAdjustment = buildSunscreenProtectionShadowAdjustment({
  baselineScore: 55,
  protection: unknownProjection,
  audit: diverseAudit,
  outdoorExposure: true
});
assert.equal(unknownAdjustment.appliedTotal, 0);
assert.equal(
  unknownAdjustment.shadowScore,
  55,
  "unknown protection must never receive a negative adjustment"
);

const flatAudit = buildSunscreenProtectionCorpusAudit([
  record("c", { spf: 50, uva: "PA++++" }),
  record("d", { spf: 50, uva: "PA++++" })
]);
assert.equal(flatAudit.axes.spf.rankingUseful, false);
assert.equal(flatAudit.axes.uva.rankingUseful, false);

const flatAdjustment = buildSunscreenProtectionShadowAdjustment({
  baselineScore: 61,
  protection: projectSunscreenProtectionAuthority(
    record("c", { spf: 50, uva: "PA++++" })
  ),
  audit: flatAudit,
  outdoorExposure: true
});
assert.equal(flatAdjustment.appliedTotal, 0);
assert.equal(flatAdjustment.shadowScore, 61);

const outdoorOnlyPlan = buildProductQueryExecutionPlan({
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
  outdoor_exposure: true,
  unresolved_terms: [],
  confidence: "high"
});
assert.equal(outdoorOnlyPlan.rankingEligible, false);
assert.equal(
  outdoorOnlyPlan.rankableSignals.includes("outdoor_exposure"),
  false,
  "Phase B must not promote outdoor_exposure into production rankable signals"
);

const service = fs.readFileSync(
  "lib/server/product-query-protection-shadow-service.js",
  "utf8"
);
const oldShadow = fs.readFileSync(
  "lib/server/product-query-shadow-service.js",
  "utf8"
);
const recommendation = fs.readFileSync(
  "lib/product-query-recommendation.js",
  "utf8"
);
const execution = fs.readFileSync(
  "lib/product-query-execution-contract.mjs",
  "utf8"
);
const route = fs.readFileSync(
  "app/api/internal/product-query-protection-shadow/route.js",
  "utf8"
);
const oidc = fs.readFileSync(
  "lib/product-query-protection-shadow-oidc.js",
  "utf8"
);
const reader = fs.readFileSync(
  "lib/recommendation-sunscreen-protection-authority-reader.js",
  "utf8"
);
const fallbackMigration = fs.readFileSync(
  "supabase/migrations/20260929002000_data_ai29c_shadow_transport_fallback.sql",
  "utf8"
);

assert.match(
  service,
  /readRecommendationSunscreenProtectionAuthorities/
);
assert.match(service, /baseline\.ranked\.map/);
assert.match(service, /filterSunscreenCandidates/);
assert.match(service, /strictCandidates\.length > 0/);
assert.doesNotMatch(
  recommendation,
  /product-query-protection-shadow|sunscreen-protection-shadow-scoring/
);
assert.doesNotMatch(
  execution,
  /product-query-protection-shadow|sunscreen-protection-shadow-scoring/
);
assert.match(oldShadow, /directProductFactRead:\s*false/);
assert.match(
  oidc,
  /urn:bejewely:data-ai29c:protection-shadow/
);
assert.match(
  oidc,
  /\.github\/workflows\/data-ai29c-protection-shadow\.yml/
);
assert.match(
  route,
  /productionRankingChanged === false/
);
assert.match(
  route,
  /productionCutoverAuthorized === false/
);
assert.match(
  reader,
  /MAX_BATCH_PRODUCT_IDS = 50/
);
assert.match(
  reader,
  /from unnest\(\$\{sql\.array\(uniqueIds, "uuid"\)\}\)/
);
assert.match(
  reader,
  /RECOMMENDATION_PROTECTION_SHADOW_FALLBACK_DATABASE_URL_ENV =\s*"RECOMMENDATION_ADMISSION_DATABASE_URL"/
);
assert.match(
  reader,
  /options\.allowShadowTransportFallback === true/
);
assert.match(
  service,
  /allowShadowTransportFallback:\s*true/
);
assert.match(
  fallbackMigration,
  /grant execute on function public\.read_recommendation_sunscreen_protection_authority_v1\(uuid\)[\s\S]*to recommendation_admission_runtime/i
);
assert.match(
  fallbackMigration,
  /DATA_AI29C_SHADOW_FALLBACK_RAW_PF_SELECT_FORBIDDEN/
);
assert.doesNotMatch(
  fallbackMigration,
  /grant\s+select[\s\S]{0,180}recommendation_admission_runtime/i
);
assert.doesNotMatch(
  recommendation,
  /RECOMMENDATION_ADMISSION_DATABASE_URL|allowShadowTransportFallback/
);
assert.doesNotMatch(
  execution,
  /RECOMMENDATION_ADMISSION_DATABASE_URL|allowShadowTransportFallback/
);

console.log("DATA-AI29C-B protection shadow verifier: PASS");
