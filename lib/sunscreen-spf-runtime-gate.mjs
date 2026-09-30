import {
  buildSunscreenProtectionShadowAdjustment,
} from "./sunscreen-protection-shadow-scoring.mjs";

export const SUNSCREEN_SPF_RUNTIME_GATE_VERSION =
  "data-ai29c-d5a-spf-runtime-gate-v1";

export const SUNSCREEN_SPF_RUNTIME_FLAG =
  "SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED";

export const SUNSCREEN_SPF_RUNTIME_DEFAULT_ENABLED = false;

function lookupProjection(protectionByProductId, productId) {
  if (protectionByProductId instanceof Map) {
    return protectionByProductId.get(productId) || null;
  }
  if (
    protectionByProductId &&
    typeof protectionByProductId === "object" &&
    !Array.isArray(protectionByProductId)
  ) {
    return protectionByProductId[productId] || null;
  }
  return null;
}

function hasEligibleSpfAuthority(projection) {
  return Boolean(
    projection?.spf?.eligible === true &&
      typeof projection?.spf?.bucket === "string" &&
      projection.spf.bucket.length > 0,
  );
}

function freezeRows(rows) {
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

export function parseSunscreenSpfRuntimeFlag(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  return String(value).trim() === "true";
}

export function applySunscreenSpfRuntimeGate({
  rankedProducts,
  enabled = SUNSCREEN_SPF_RUNTIME_DEFAULT_ENABLED,
  sunscreenIntent = false,
  outdoorExposure = false,
  protectionByProductId = null,
} = {}) {
  const baseline = Array.isArray(rankedProducts)
    ? rankedProducts
    : [];
  const flagEnabled = enabled === true;
  const requestEligible =
    flagEnabled &&
    sunscreenIntent === true &&
    outdoorExposure === true;

  const missingProductIds = requestEligible
    ? baseline
        .filter(
          (product) =>
            !hasEligibleSpfAuthority(
              lookupProjection(protectionByProductId, product?.id),
            ),
        )
        .map((product) => product.id)
        .sort()
    : [];

  const authorityComplete =
    requestEligible &&
    baseline.length > 0 &&
    missingProductIds.length === 0;

  let reason = "SPF_RUNTIME_FLAG_OFF";
  if (flagEnabled && sunscreenIntent !== true) {
    reason = "SUNSCREEN_INTENT_NOT_EXPLICIT";
  } else if (
    flagEnabled &&
    sunscreenIntent === true &&
    outdoorExposure !== true
  ) {
    reason = "OUTDOOR_EXPOSURE_NOT_EXPLICIT";
  } else if (requestEligible && baseline.length === 0) {
    reason = "NO_SAFE_SUNSCREEN_CANDIDATES";
  } else if (requestEligible && !authorityComplete) {
    reason = "COHORT_SPF_AUTHORITY_INCOMPLETE";
  } else if (authorityComplete) {
    reason = "SPF_AXIS_APPLIED";
  }

  if (!authorityComplete) {
    return Object.freeze({
      version: SUNSCREEN_SPF_RUNTIME_GATE_VERSION,
      flagEnabled,
      requestEligible,
      authorityComplete: false,
      axisApplied: false,
      reason,
      missingProductIds: Object.freeze(missingProductIds),
      products: freezeRows([...baseline]),
      adjustments: Object.freeze([]),
      rankableSignalAdded: false,
      limits: Object.freeze({
        uvaApplied: false,
        waterResistanceApplied: false,
        missingAuthorityTreatedAsLowProtection: false,
        rejectedCandidateResurrectionPossible: false,
        candidateAdmissionMutated: false,
        publicActivation: false,
        persistence: false,
      }),
    });
  }

  const adjustments = [];
  const products = baseline.map((product) => {
    const protection = lookupProjection(
      protectionByProductId,
      product.id,
    );
    const adjustment = buildSunscreenProtectionShadowAdjustment({
      baselineScore: product.score,
      protection,
      audit: {
        axes: {
          spf: { rankingUseful: true },
          uva: { rankingUseful: false },
          waterResistance: { rankingUseful: false },
        },
      },
      outdoorExposure: true,
    });

    adjustments.push(
      Object.freeze({
        productId: product.id,
        baselineScore: Number(product.score),
        spfBucket: protection.spf.bucket,
        spfDelta: adjustment.appliedAdjustments.spf,
        finalScore: adjustment.shadowScore,
        enabledAxes: adjustment.enabledAxes,
        blockedAxes: adjustment.blockedAxes,
      }),
    );

    return Object.freeze({
      ...product,
      score: adjustment.shadowScore,
    });
  });

  return Object.freeze({
    version: SUNSCREEN_SPF_RUNTIME_GATE_VERSION,
    flagEnabled,
    requestEligible,
    authorityComplete: true,
    axisApplied: true,
    reason,
    missingProductIds: Object.freeze([]),
    products: freezeRows(products),
    adjustments: Object.freeze(adjustments),
    rankableSignalAdded: true,
    limits: Object.freeze({
      uvaApplied: false,
      waterResistanceApplied: false,
      missingAuthorityTreatedAsLowProtection: false,
      rejectedCandidateResurrectionPossible: false,
      candidateAdmissionMutated: false,
      publicActivation: false,
      persistence: false,
    }),
  });
}
