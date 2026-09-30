import {
  evaluateAuthorityCompleteMixedSubsetShadow,
} from "./sunscreen-authority-complete-subset-shadow.mjs";
import {
  buildSunscreenProtectionShadowAdjustment,
} from "./sunscreen-protection-shadow-scoring.mjs";

export const SUNSCREEN_SPF_AXIS_ACTIVATION_REVIEW_VERSION =
  "data-ai29c-d4-spf-axis-activation-review-v1";

function tieAwareRank(rows, key, productId) {
  const row = rows.find((item) => item.productId === productId);
  if (!row) return null;
  const score = Number(row[key]);
  return 1 + rows.filter((item) => Number(item[key]) > score).length;
}

function productRankShifts(baselineRows, shadowRows, productIds) {
  return Object.freeze(
    productIds.map((productId) => {
      const baseline = baselineRows.find(
        (row) => row.productId === productId,
      );
      const shadow = shadowRows.find(
        (row) => row.productId === productId,
      );
      const baselineRank = tieAwareRank(
        baselineRows,
        "baselineScore",
        productId,
      );
      const shadowRank = tieAwareRank(
        shadowRows,
        "shadowScore",
        productId,
      );
      return Object.freeze({
        productId,
        name: baseline?.name || shadow?.name || null,
        baselineScore: baseline?.baselineScore ?? null,
        spfDelta: shadow?.protectionDelta ?? null,
        shadowScore: shadow?.shadowScore ?? null,
        baselineRank,
        shadowRank,
        rankShift:
          baselineRank == null || shadowRank == null
            ? null
            : shadowRank - baselineRank,
      });
    }),
  );
}

function nonOutdoorControl(rows, protectionRecords) {
  const protectionById = new Map(
    (protectionRecords || []).map((record) => [
      record.product_id,
      record,
    ]),
  );

  return Object.freeze(
    rows.map((row) => {
      const record = protectionById.get(row.productId);
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
            spf: { rankingUseful: true },
            uva: { rankingUseful: false },
            waterResistance: { rankingUseful: false },
          },
        },
        outdoorExposure: false,
      });

      return Object.freeze({
        productId: row.productId,
        baselineScore: row.baselineScore,
        appliedTotal: adjustment.appliedTotal,
        shadowScore: adjustment.shadowScore,
        enabledAxes: adjustment.enabledAxes,
        blockedAxes: adjustment.blockedAxes,
      });
    }),
  );
}

export function evaluateSpfAxisActivationReview({
  legacyProducts,
  authorityRows,
  semanticBundles,
  recoveryFixture,
  protectionRecords,
}) {
  const d3r3 = evaluateAuthorityCompleteMixedSubsetShadow({
    legacyProducts,
    authorityRows,
    semanticBundles,
    recoveryFixture,
    protectionRecords,
  });

  const nonOutdoor = nonOutdoorControl(
    d3r3.mixedBaseline,
    protectionRecords,
  );

  const legacyIds = new Set(
    d3r3.legacyRows
      .filter((row) => row.stage === "scored")
      .map((row) => row.productId),
  );
  const newIds = new Set(d3r3.scoreableNewProductIds);
  const heldIds = new Set(
    d3r3.heldNew.map((row) => row.productId),
  );

  const legacyOutdoor = d3r3.spfShadow.filter((row) =>
    legacyIds.has(row.productId),
  );
  const newOutdoor = d3r3.spfShadow.filter((row) =>
    newIds.has(row.productId),
  );

  const legacyDeltas = Object.freeze(
    legacyOutdoor.map((row) => row.protectionDelta),
  );
  const distinctLegacyDeltas = Object.freeze(
    [...new Set(legacyDeltas)].sort((a, b) => a - b),
  );

  const shadowIds = new Set(
    d3r3.spfShadow.map((row) => row.productId),
  );
  const heldLeakedIntoShadow = [...heldIds].filter((id) =>
    shadowIds.has(id),
  );

  const nonOutdoorDeltaZero = nonOutdoor.every(
    (row) =>
      row.appliedTotal === 0 &&
      row.shadowScore === row.baselineScore &&
      row.enabledAxes.length === 0,
  );

  const spfOnlyOutdoor = d3r3.spfShadow.every(
    (row) =>
      row.enabledProtectionAxes == null ||
      (Array.isArray(row.enabledProtectionAxes) &&
        row.enabledProtectionAxes.length === 1 &&
        row.enabledProtectionAxes[0] === "spf"),
  );

  const legacyUniformDelta =
    legacyOutdoor.length === legacyIds.size &&
    distinctLegacyDeltas.length === 1 &&
    distinctLegacyDeltas[0] === 6;

  const legacyRelativeOrderInvariant = legacyUniformDelta;

  const newRankShifts = productRankShifts(
    d3r3.mixedBaseline,
    d3r3.spfShadow,
    d3r3.scoreableNewProductIds,
  );

  const maxAbsoluteNewRankShift = Math.max(
    0,
    ...newRankShifts
      .map((row) => Math.abs(Number(row.rankShift)))
      .filter(Number.isFinite),
  );

  const gates = Object.freeze({
    authorityCoverageComplete:
      d3r3.spfCoverage.complete === true &&
      d3r3.spfCoverage.eligibleCount ===
        d3r3.spfCoverage.totalCount,
    explicitOutdoorOnly: nonOutdoorDeltaZero,
    baselineTopSetPreserved:
      d3r3.spfTopSetPreserved === true,
    legacyRelativeOrderInvariant,
    hardRejectAndSemanticHoldsExcluded:
      heldLeakedIntoShadow.length === 0,
    waterDisabled: d3r3.limits.waterResistanceApplied === false,
    productionStillFrozen:
      d3r3.limits.productionCandidateAdmissionWired === false &&
      d3r3.limits.productionRankingChanged === false &&
      d3r3.limits.productionCutoverAuthorized === false &&
      d3r3.limits.outdoorRankableSignalAuthorized === false &&
      d3r3.limits.publicActivation === false,
  });

  const reviewPass = Object.values(gates).every(Boolean);

  return Object.freeze({
    version: SUNSCREEN_SPF_AXIS_ACTIVATION_REVIEW_VERSION,
    axis: "spf",
    d3r3Version: d3r3.version,
    comparableCorpusCount: d3r3.mixedBaselineCount,
    legacyCount: legacyIds.size,
    newComparableCount: newIds.size,
    heldNewCount: heldIds.size,
    coverage: d3r3.spfCoverage,
    baselineTopSet: d3r3.baselineTopSet,
    spfTopSet: d3r3.spfTopSet,
    legacyDeltas,
    distinctLegacyDeltas,
    newRankShifts,
    maxAbsoluteNewRankShift,
    nonOutdoor,
    heldLeakedIntoShadow: Object.freeze(heldLeakedIntoShadow),
    gates,
    reviewPass,
    decision: reviewPass
      ? "SPF_AXIS_D4_REVIEW_PASS_D5_MANUAL_APPROVAL_REQUIRED"
      : "SPF_AXIS_D4_REVIEW_HOLD",
    d5Proposal: Object.freeze({
      axis: "spf",
      defaultEnabled: false,
      requiredFlag: "SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED",
      trigger: "outdoorExposure === true",
      comparableSubsetOnly: true,
      rollback: "set SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED=false",
      uvaIncluded: false,
      waterResistanceIncluded: false,
      manualApprovalRequired: true,
    }),
    limits: Object.freeze({
      runtimeFlagImplemented: false,
      productionCandidateAdmissionWired: false,
      productionRankingChanged: false,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
      publicActivation: false,
      uvaActivated: false,
      waterResistanceApplied: false,
      persistence: false,
    }),
  });
}
