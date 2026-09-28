#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  normalizeRecommendationSunscreenProtectionAuthorityPayload
} from "../lib/recommendation-sunscreen-protection-authority-contract.mjs";
import {
  SUNSCREEN_PROTECTION_CORPUS_AUDIT_VERSION,
  buildSunscreenProtectionCorpusAudit
} from "../lib/sunscreen-protection-corpus-audit.mjs";

const registryVersion = "product-fact-registry-cross-category-v1";
const registryChecksum = "d".repeat(64);

function uuid(index, lane = 8) {
  return `00000000-0000-4000-${lane}000-${String(index).padStart(12, "0")}`;
}

function proposition(index) {
  return index.toString(16).padStart(64, "0");
}

function buildFact({
  productIndex,
  subjectId,
  factIndex,
  factKey,
  valueType,
  valueNumber = null,
  valueUnit = null,
  valueEnum = null,
  qualifier = {},
  market = "KR"
}) {
  return {
    proposition_key: proposition(productIndex * 10 + factIndex),
    fact_instance_id: uuid(productIndex * 10 + factIndex, 8),
    subject_id: subjectId,
    confirmation_id: uuid(productIndex * 10 + factIndex, 9),
    fact_key: factKey,
    registry_version: registryVersion,
    proposition_serializer_version: "product-fact-proposition-v1",
    semantic_status: "supported",
    value_type: valueType,
    value_number: valueNumber,
    value_unit: valueUnit,
    value_enum: valueEnum,
    market,
    region: null,
    locale: null,
    qualifier,
    authority_ceiling: "product_specific_primary",
    fused_confidence: "high",
    valid_from: null,
    valid_to: null
  };
}

function buildAuthority(productIndex, { uva = true, water = null, plus = true } = {}) {
  const productId = uuid(productIndex, 8);
  const subjectId = uuid(500 + productIndex, 8);
  const facts = [
    buildFact({
      productIndex,
      subjectId,
      factIndex: 1,
      factKey: "spf_value",
      valueType: "number",
      valueNumber: 50,
      qualifier: { plus_modifier: plus ? "plus" : "none" }
    })
  ];

  if (uva) {
    facts.push(
      buildFact({
        productIndex,
        subjectId,
        factIndex: 2,
        factKey: "uva_label",
        valueType: "enum",
        valueEnum: "PA++++"
      })
    );
  }

  if (water != null) {
    facts.push(
      buildFact({
        productIndex,
        subjectId,
        factIndex: 3,
        factKey: "water_resistance_duration",
        valueType: "number_unit",
        valueNumber: water,
        valueUnit: "minutes",
        qualifier: {
          metric: "water_resistance",
          method_context: "declared",
          timepoint: "duration"
        }
      })
    );
  }

  const payload = {
    read_contract_version: "recommendation-sunscreen-protection-authority-read-v1",
    status: "AUTHORITY_RESOLVED",
    product: {
      product_id: productId,
      category: "sunscreen"
    },
    subject: {
      subject_id: subjectId,
      product_id: productId,
      subject_identity_serializer_version: "product-fact-subject-v1",
      identity_status: "resolved",
      identity_resolution_version: "product-fact-identity-v1",
      current_state: "current",
      market_applicability: "KR",
      region_applicability: null,
      valid_from: null,
      valid_to: null
    },
    registry: {
      registry_version: registryVersion,
      registry_checksum: registryChecksum,
      identity_serializer_version: "product-fact-subject-v1"
    },
    current_facts: facts
  };

  return {
    productId,
    authority: normalizeRecommendationSunscreenProtectionAuthorityPayload(payload)
  };
}

const currentCorpus = Array.from({ length: 12 }, (_, index) =>
  buildAuthority(index + 1, {
    uva: index < 10,
    water: null,
    plus: index !== 5
  })
);

const audit = buildSunscreenProtectionCorpusAudit(currentCorpus);

assert.equal(audit.version, SUNSCREEN_PROTECTION_CORPUS_AUDIT_VERSION);
assert.equal(audit.totalProducts, 12);
assert.equal(audit.invalidRecordCount, 0);
assert.equal(audit.duplicateProductCount, 0);

assert.equal(audit.axes.spf.governedCount, 12);
assert.equal(audit.axes.spf.eligibleCount, 12);
assert.equal(audit.axes.spf.eligibleCoverage, 1);
assert.equal(audit.axes.spf.coveragePass, true);
assert.equal(audit.axes.spf.distinctScoringBuckets, 1);
assert.deepEqual(audit.axes.spf.bucketCounts, {
  spf_50_plus_band: 12
});
assert.equal(audit.axes.spf.discriminationPass, false);
assert.equal(audit.axes.spf.rankingUseful, false);
assert.equal(audit.axes.spf.decision, "HOLD");

assert.equal(audit.axes.uva.governedCount, 10);
assert.equal(audit.axes.uva.eligibleCount, 10);
assert.equal(audit.axes.uva.eligibleCoverage, 10 / 12);
assert.equal(audit.axes.uva.coveragePass, true);
assert.equal(audit.axes.uva.distinctScoringBuckets, 1);
assert.deepEqual(audit.axes.uva.bucketCounts, {
  uva_high: 10
});
assert.equal(audit.axes.uva.discriminationPass, false);
assert.equal(audit.axes.uva.rankingUseful, false);
assert.equal(audit.axes.uva.decision, "HOLD");

assert.equal(audit.axes.waterResistance.governedCount, 0);
assert.equal(audit.axes.waterResistance.eligibleCount, 0);
assert.equal(audit.axes.waterResistance.eligibleCoverage, 0);
assert.equal(audit.axes.waterResistance.coveragePass, false);
assert.equal(audit.axes.waterResistance.distinctScoringBuckets, 0);
assert.equal(audit.axes.waterResistance.rankingUseful, false);
assert.equal(audit.axes.waterResistance.decision, "HOLD");

assert.deepEqual(audit.readyAxes, []);
assert.equal(audit.overallDecision, "HOLD_NO_DISCRIMINATING_AXIS");
assert.equal(audit.rankingBehaviorChanged, false);
assert.equal(audit.productionCutoverAuthorized, false);
assert.equal(audit.outdoorRankableSignalAuthorized, false);

const futureWaterCorpus = Array.from({ length: 12 }, (_, index) =>
  buildAuthority(index + 20, {
    uva: true,
    water: index < 3 ? 80 : index < 7 ? 40 : null
  })
);
const futureAudit = buildSunscreenProtectionCorpusAudit(futureWaterCorpus);

assert.equal(futureAudit.axes.waterResistance.eligibleCount, 7);
assert.equal(futureAudit.axes.waterResistance.coveragePass, true);
assert.equal(futureAudit.axes.waterResistance.distinctScoringBuckets, 2);
assert.equal(futureAudit.axes.waterResistance.discriminationPass, true);
assert.equal(futureAudit.axes.waterResistance.rankingUseful, true);
assert.ok(futureAudit.readyAxes.includes("waterResistance"));
assert.equal(
  futureAudit.productionCutoverAuthorized,
  false,
  "Phase A audit readiness must never authorize production cutover"
);

console.log(
  JSON.stringify({
    stage: "DATA-AI29C-A",
    result: "PASS",
    currentCorpus: {
      products: audit.totalProducts,
      spf: audit.axes.spf,
      uva: audit.axes.uva,
      waterResistance: audit.axes.waterResistance,
      overallDecision: audit.overallDecision
    }
  })
);
