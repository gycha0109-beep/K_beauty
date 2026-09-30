import "server-only";

import "@/lib/server/recommendation-candidate-admission-runtime";
import { getRecommendationProducts } from "@/lib/product-source";
import {
  rankStructuredProductQueryFromProducts
} from "@/lib/product-query-recommendation";
import {
  PRODUCT_QUERY_INTENT_SCHEMA_VERSION
} from "@/lib/product-query-intent-contract.mjs";
import {
  getRecommendationProtectionCredentialMode,
  readRecommendationSunscreenProtectionAuthorities
} from "@/lib/recommendation-sunscreen-protection-authority-reader";
import {
  RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS
} from "@/lib/recommendation-sunscreen-protection-authority-contract.mjs";
import {
  projectSunscreenProtectionAuthority
} from "@/lib/sunscreen-protection-projection.mjs";

export const PRODUCT_QUERY_SPF_PRODUCTION_SHADOW_VERSION =
  "data-ai29c-d5b-spf-production-shadow-v1";

function fixedIntent(overrides = {}) {
  return Object.freeze({
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
    confidence: "high",
    ...overrides
  });
}

function stableResultProjection(result) {
  return Object.freeze({
    status: result?.status || null,
    effectiveCategory: result?.effectiveCategory || null,
    candidateCount: Number(result?.candidateCount || 0),
    rankableSignals: Object.freeze(
      Array.isArray(result?.rankableSignals)
        ? [...result.rankableSignals]
        : []
    ),
    constraintStatus: result?.constraintStatus || null,
    unresolvedTerms: Object.freeze(
      Array.isArray(result?.unresolvedTerms)
        ? [...result.unresolvedTerms]
        : []
    ),
    results: Object.freeze(
      (Array.isArray(result?.results) ? result.results : []).map(
        (product) =>
          Object.freeze({
            id: product?.id || null,
            score: Number(product?.score || 0)
          })
      )
    )
  });
}

function orderIds(result) {
  return (Array.isArray(result?.results) ? result.results : []).map(
    (product) => product.id
  );
}

function compareResultOrder(left, right) {
  const leftIds = orderIds(left);
  const rightIds = orderIds(right);
  const rightPositions = new Map(
    rightIds.map((productId, index) => [productId, index])
  );

  let changedProductCount = 0;
  let maxRankShift = 0;
  leftIds.forEach((productId, index) => {
    const rightIndex = rightPositions.get(productId);
    if (!Number.isInteger(rightIndex)) return;
    const shift = Math.abs(index - rightIndex);
    if (shift > 0) changedProductCount += 1;
    maxRankShift = Math.max(maxRankShift, shift);
  });

  return Object.freeze({
    orderInvariant:
      JSON.stringify(leftIds) === JSON.stringify(rightIds),
    changedProductCount,
    maxRankShift,
    baselineOrder: Object.freeze(leftIds),
    shadowOrder: Object.freeze(rightIds)
  });
}

function summarizeSpfGate(result) {
  const spf = result?.runtimeGateEvidence?.spf || null;
  const deltas = Array.isArray(spf?.adjustments)
    ? spf.adjustments.map((row) => Number(row.spfDelta || 0))
    : [];

  return Object.freeze({
    present: Boolean(spf),
    flagEnabled: spf?.flagEnabled === true,
    requestEligible: spf?.requestEligible === true,
    authorityComplete: spf?.authorityComplete === true,
    axisApplied: spf?.axisApplied === true,
    reason: spf?.reason || null,
    missingProductIds: Object.freeze(
      Array.isArray(spf?.missingProductIds)
        ? [...spf.missingProductIds]
        : []
    ),
    distinctDeltas: Object.freeze(
      [...new Set(deltas)].sort((a, b) => a - b)
    ),
    adjustmentCount: deltas.length,
    uvaApplied: spf?.limits?.uvaApplied === true,
    waterResistanceApplied:
      spf?.limits?.waterResistanceApplied === true
  });
}

export async function runProductQuerySpfProductionShadow() {
  const products = await getRecommendationProducts();
  const sunscreenProducts = products.filter(
    (product) => product?.category === "sunscreen"
  );

  const credentialMode = getRecommendationProtectionCredentialMode({
    allowShadowTransportFallback: true
  });
  const authorityRecords =
    await readRecommendationSunscreenProtectionAuthorities(
      sunscreenProducts.map((product) => product.id),
      { allowShadowTransportFallback: true }
    );

  const authorityResolvedCount = authorityRecords.filter(
    (record) =>
      record?.authority?.status ===
      RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS.RESOLVED
  ).length;

  const projections = authorityRecords.map(
    projectSunscreenProtectionAuthority
  );
  const projectionByProductId = new Map(
    projections.map((projection) => [
      projection.productId,
      projection
    ])
  );
  const spfEligibleCount = projections.filter(
    (projection) => projection?.spf?.eligible === true
  ).length;

  // Existing Production-ranked request. This has a pre-existing rankable
  // signal (skin_type), so explicit OFF must be behavior-identical.
  const parityIntent = fixedIntent({ skin_type: "oily" });
  const baseline = rankStructuredProductQueryFromProducts(
    parityIntent,
    products,
    { limit: 10 }
  );
  const explicitOff = rankStructuredProductQueryFromProducts(
    parityIntent,
    products,
    {
      limit: 10,
      spfRuntimeGate: {
        enabled: false,
        protectionByProductId: projectionByProductId
      }
    }
  );
  const shadowOn = rankStructuredProductQueryFromProducts(
    parityIntent,
    products,
    {
      limit: 10,
      spfRuntimeGate: {
        enabled: true,
        protectionByProductId: projectionByProductId
      },
      includeRuntimeGateEvidence: true
    }
  );

  const baselineProjection = stableResultProjection(baseline);
  const explicitOffProjection =
    stableResultProjection(explicitOff);
  const offParity =
    JSON.stringify(baselineProjection) ===
    JSON.stringify(explicitOffProjection);

  const rankedComparison = compareResultOrder(
    baseline,
    shadowOn
  );
  const rankedGate = summarizeSpfGate(shadowOn);

  // Outdoor-only stays shadow-only. It demonstrates that D5A can make
  // outdoor_exposure rankable only when SPF authority is cohort-complete.
  const outdoorOnlyIntent = fixedIntent();
  const outdoorOnlyOff = rankStructuredProductQueryFromProducts(
    outdoorOnlyIntent,
    products,
    { limit: 10 }
  );
  const outdoorOnlyOn = rankStructuredProductQueryFromProducts(
    outdoorOnlyIntent,
    products,
    {
      limit: 10,
      spfRuntimeGate: {
        enabled: true,
        protectionByProductId: projectionByProductId
      },
      includeRuntimeGateEvidence: true
    }
  );

  return Object.freeze({
    version: PRODUCT_QUERY_SPF_PRODUCTION_SHADOW_VERSION,
    currentRecommendationCorpusCount: products.length,
    currentSunscreenCorpusCount: sunscreenProducts.length,
    authorityResolvedCount,
    spfEligibleCount,
    credentialMode,
    parity: Object.freeze({
      baselineStatus: baseline.status,
      explicitOffStatus: explicitOff.status,
      exactStableProjection: offParity
    }),
    rankedOutdoorShadow: Object.freeze({
      baselineStatus: baseline.status,
      shadowStatus: shadowOn.status,
      gate: rankedGate,
      comparison: rankedComparison
    }),
    outdoorOnlyShadow: Object.freeze({
      offStatus: outdoorOnlyOff.status,
      onStatus: outdoorOnlyOn.status,
      offRankableSignals: Object.freeze([
        ...(outdoorOnlyOff.rankableSignals || [])
      ]),
      onRankableSignals: Object.freeze([
        ...(outdoorOnlyOn.rankableSignals || [])
      ]),
      gate: summarizeSpfGate(outdoorOnlyOn)
    }),
    decision:
      offParity &&
      authorityResolvedCount === sunscreenProducts.length &&
      spfEligibleCount === sunscreenProducts.length &&
      rankedGate.axisApplied &&
      rankedComparison.orderInvariant
        ? "D5B_CURRENT_PRODUCTION_SHADOW_PASS"
        : "D5B_CURRENT_PRODUCTION_SHADOW_HOLD",
    limits: Object.freeze({
      fixedStructuredIntentOnly: true,
      providerInvoked: false,
      rawQueryAccepted: false,
      profileRead: false,
      historyRead: false,
      productionWrite: false,
      recommendationLogWrite: false,
      liveNewSunscreenAdmission: false,
      productionRankingChanged: false,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
      publicActivation: false,
      uvaActivated: false,
      waterResistanceApplied: false,
      persistence: false
    })
  });
}
