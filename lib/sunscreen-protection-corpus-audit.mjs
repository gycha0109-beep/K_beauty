import {
  RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS,
  isProtectionFactRankingAuthorityEligible
} from "./recommendation-sunscreen-protection-authority-contract.mjs";

export const SUNSCREEN_PROTECTION_CORPUS_AUDIT_VERSION =
  "sunscreen-protection-corpus-audit-v1";

export const SUNSCREEN_PROTECTION_AXIS_POLICY = Object.freeze({
  spf: Object.freeze({
    factKey: "spf_value",
    minimumEligibleCoverage: 0.9,
    minimumDistinctScoringBuckets: 2
  }),
  uva: Object.freeze({
    factKey: "uva_label",
    minimumEligibleCoverage: 0.8,
    minimumDistinctScoringBuckets: 2
  }),
  waterResistance: Object.freeze({
    factKey: "water_resistance_duration",
    minimumEligibleCoverage: 0.5,
    minimumDistinctScoringBuckets: 2
  })
});

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bucketSpf(fact) {
  const value = finiteNumber(fact?.value_number);
  if (value == null || value <= 0) return null;
  if (value >= 50) return "spf_50_plus_band";
  if (value >= 30) return "spf_30_49";
  if (value >= 15) return "spf_15_29";
  return "spf_below_15";
}

function bucketUva(fact) {
  const value = fact?.value_enum;
  if (value === "PA++++") return "uva_high";
  if (value === "PA+++" || value === "UVA-PF-declared") {
    return "uva_medium_high";
  }
  if (value === "PA++") return "uva_medium";
  if (value === "PA+") return "uva_low";
  return null;
}

function bucketWaterResistance(fact) {
  const value = finiteNumber(fact?.value_number);
  if (value == null || value <= 0 || fact?.value_unit !== "minutes") return null;
  if (value >= 80) return "water_80_plus";
  if (value >= 40) return "water_40_79";
  return "water_1_39";
}

function bucketForAxis(axis, fact) {
  if (axis === "spf") return bucketSpf(fact);
  if (axis === "uva") return bucketUva(fact);
  return bucketWaterResistance(fact);
}

function normalizeProductId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function currentFacts(record) {
  if (
    record?.authority?.status !==
      RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS.RESOLVED ||
    !record.authority.authority ||
    !Array.isArray(record.authority.authority.currentFacts)
  ) {
    return [];
  }

  return record.authority.authority.currentFacts;
}

function evaluateAxis(records, axis) {
  const policy = SUNSCREEN_PROTECTION_AXIS_POLICY[axis];
  let governedCount = 0;
  let eligibleCount = 0;
  let malformedBucketCount = 0;
  let ambiguousCount = 0;
  const bucketCounts = new Map();

  for (const record of records) {
    const matches = currentFacts(record).filter(
      (fact) => fact?.fact_key === policy.factKey
    );

    if (matches.length > 1) {
      ambiguousCount += 1;
      continue;
    }
    if (matches.length === 0) continue;

    governedCount += 1;
    const fact = matches[0];

    if (!isProtectionFactRankingAuthorityEligible(fact)) continue;

    const bucket = bucketForAxis(axis, fact);
    if (!bucket) {
      malformedBucketCount += 1;
      continue;
    }

    eligibleCount += 1;
    bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);
  }

  const totalProducts = records.length;
  const governedCoverage = ratio(governedCount, totalProducts);
  const eligibleCoverage = ratio(eligibleCount, totalProducts);
  const distinctScoringBuckets = bucketCounts.size;
  const coveragePass =
    eligibleCoverage >= policy.minimumEligibleCoverage;
  const discriminationPass =
    distinctScoringBuckets >= policy.minimumDistinctScoringBuckets;
  const rankingUseful =
    coveragePass &&
    discriminationPass &&
    ambiguousCount === 0 &&
    malformedBucketCount === 0;

  return Object.freeze({
    factKey: policy.factKey,
    totalProducts,
    governedCount,
    governedCoverage,
    eligibleCount,
    eligibleCoverage,
    missingCount: totalProducts - governedCount,
    ambiguousCount,
    malformedBucketCount,
    distinctScoringBuckets,
    bucketCounts: Object.freeze(
      Object.fromEntries([...bucketCounts.entries()].sort(([a], [b]) =>
        a.localeCompare(b)
      ))
    ),
    minimumEligibleCoverage: policy.minimumEligibleCoverage,
    minimumDistinctScoringBuckets:
      policy.minimumDistinctScoringBuckets,
    coveragePass,
    discriminationPass,
    rankingUseful,
    decision: rankingUseful ? "READY_FOR_SHADOW_SCORING" : "HOLD"
  });
}

export function buildSunscreenProtectionCorpusAudit(records) {
  const input = Array.isArray(records) ? records : [];
  const normalized = [];
  const seen = new Set();
  let invalidRecordCount = 0;
  let duplicateProductCount = 0;

  for (const record of input) {
    const productId = normalizeProductId(record?.productId);
    if (!productId || !record?.authority || typeof record.authority !== "object") {
      invalidRecordCount += 1;
      continue;
    }
    if (seen.has(productId)) {
      duplicateProductCount += 1;
      continue;
    }
    seen.add(productId);
    normalized.push(
      Object.freeze({
        productId,
        authority: record.authority
      })
    );
  }

  const axes = Object.freeze({
    spf: evaluateAxis(normalized, "spf"),
    uva: evaluateAxis(normalized, "uva"),
    waterResistance: evaluateAxis(normalized, "waterResistance")
  });

  const readyAxes = Object.entries(axes)
    .filter(([, value]) => value.rankingUseful)
    .map(([key]) => key);

  return Object.freeze({
    version: SUNSCREEN_PROTECTION_CORPUS_AUDIT_VERSION,
    totalInputRecords: input.length,
    totalProducts: normalized.length,
    invalidRecordCount,
    duplicateProductCount,
    axes,
    readyAxes: Object.freeze(readyAxes),
    overallDecision:
      invalidRecordCount > 0 || duplicateProductCount > 0
        ? "HOLD_INVALID_INPUT"
        : readyAxes.length > 0
          ? "SHADOW_SCORING_PARTIALLY_READY"
          : "HOLD_NO_DISCRIMINATING_AXIS",
    rankingBehaviorChanged: false,
    productionCutoverAuthorized: false,
    outdoorRankableSignalAuthorized: false
  });
}
