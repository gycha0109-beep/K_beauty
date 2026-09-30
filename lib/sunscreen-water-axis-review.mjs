import {
  evaluateAuthorityCompleteMixedSubsetShadow,
} from "./sunscreen-authority-complete-subset-shadow.mjs";
import {
  buildSunscreenProtectionShadowAdjustment,
} from "./sunscreen-protection-shadow-scoring.mjs";

export const SUNSCREEN_WATER_AXIS_REVIEW_VERSION =
  "data-ai29c-d4-water-axis-review-v1";

function mixedWaterCoverage(rows, protectionRecords) {
  const byId = new Map(
    (protectionRecords || []).map((record) => [
      record.product_id,
      record,
    ]),
  );
  const eligible = rows.filter((row) =>
    Boolean(byId.get(row.productId)?.water_bucket),
  );
  return Object.freeze({
    eligibleCount: eligible.length,
    totalCount: rows.length,
    complete: eligible.length === rows.length,
    missingProductIds: Object.freeze(
      rows
        .filter((row) => !byId.get(row.productId)?.water_bucket)
        .map((row) => row.productId)
        .sort(),
    ),
  });
}

function runtimeWaterControl(rows, protectionRecords) {
  const byId = new Map(
    (protectionRecords || []).map((record) => [
      record.product_id,
      record,
    ]),
  );
  return Object.freeze(
    rows.map((row) => {
      const record = byId.get(row.productId);
      const adjustment = buildSunscreenProtectionShadowAdjustment({
        baselineScore: row.baselineScore,
        protection: {
          spf: { bucket: record?.spf_bucket || null },
          uva: { bucket: record?.uva_bucket || null },
          waterResistance: {
            bucket: record?.water_bucket || null,
          },
        },
        audit: {
          axes: {
            spf: { rankingUseful: false },
            uva: { rankingUseful: false },
            waterResistance: { rankingUseful: true },
          },
        },
        outdoorExposure: true,
      });
      return Object.freeze({
        productId: row.productId,
        baselineScore: row.baselineScore,
        potentialWater:
          adjustment.potentialAdjustments.waterResistance,
        appliedWater:
          adjustment.appliedAdjustments.waterResistance,
        shadowScore: adjustment.shadowScore,
        enabledAxes: adjustment.enabledAxes,
        blockedAxes: adjustment.blockedAxes,
      });
    }),
  );
}

export function evaluateWaterAxisReview({
  legacyProducts,
  authorityRows,
  semanticBundles,
  recoveryFixture,
  protectionRecords,
  wave2Execution,
}) {
  const d3r3 = evaluateAuthorityCompleteMixedSubsetShadow({
    legacyProducts,
    authorityRows,
    semanticBundles,
    recoveryFixture,
    protectionRecords,
  });

  const prospectiveWater =
    wave2Execution?.authoritative_post_wave_audit
      ?.waterResistance || null;
  const mixedCoverage = mixedWaterCoverage(
    d3r3.mixedBaseline,
    protectionRecords,
  );
  const runtimeControl = runtimeWaterControl(
    d3r3.mixedBaseline,
    protectionRecords,
  );

  const runtimeIntentUnavailable = runtimeControl.every(
    (row) =>
      row.appliedWater === 0 &&
      row.shadowScore === row.baselineScore &&
      row.enabledAxes.length === 0 &&
      row.blockedAxes.includes(
        "waterResistance:water_resistance_intent_not_available",
      ),
  );

  const gates = Object.freeze({
    prospectiveAuthorityUnavailable:
      prospectiveWater?.eligible_count === 0 &&
      prospectiveWater?.coverage === 0 &&
      prospectiveWater?.distinct_scoring_buckets === 0 &&
      prospectiveWater?.gate_pass === false,
    mixedAuthorityUnavailable:
      mixedCoverage.eligibleCount === 0 &&
      mixedCoverage.complete === false,
    runtimeIntentUnavailable,
    missingNotConvertedToFalse: true,
    spfReviewUnaffected: true,
    productionStillFrozen:
      d3r3.limits.productionCandidateAdmissionWired === false &&
      d3r3.limits.productionRankingChanged === false &&
      d3r3.limits.productionCutoverAuthorized === false &&
      d3r3.limits.outdoorRankableSignalAuthorized === false &&
      d3r3.limits.publicActivation === false &&
      d3r3.limits.waterResistanceApplied === false,
  });

  const holdRequired = Object.values(gates).every(Boolean);

  return Object.freeze({
    version: SUNSCREEN_WATER_AXIS_REVIEW_VERSION,
    prospectiveCorpusCount:
      wave2Execution?.authoritative_post_wave_audit
        ?.sunscreen_count ?? null,
    comparableCorpusCount: d3r3.mixedBaselineCount,
    prospectiveWater,
    mixedCoverage,
    runtimeControl,
    gates,
    holdRequired,
    decision: holdRequired
      ? "WATER_AXIS_D4_HOLD_NO_AUTHORITY_OR_INTENT_CONTRACT"
      : "WATER_AXIS_D4_REVIEW_INVALID",
    nextGate: Object.freeze({
      requiresGovernedWaterAuthority: true,
      requiresWaterIntentContract: true,
      requiresSeparateShadowCalibration: true,
      doesNotBlockSpfD5Review: true,
    }),
    limits: Object.freeze({
      missingTreatedAsNonWaterproof: false,
      waterIntentImplemented: false,
      waterAxisActivated: false,
      productionRankingChanged: false,
      productionCutoverAuthorized: false,
      publicActivation: false,
      persistence: false,
    }),
  });
}
