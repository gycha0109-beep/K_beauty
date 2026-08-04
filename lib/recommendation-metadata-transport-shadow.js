import {
  ADMIN_V1_UNSUPPORTED_METADATA_FIELDS,
  PRODUCT_METADATA_VERSION,
  RECOMMENDATION_METADATA_TRANSPORT_VERSION,
  getRecommendationMetadataTransport
} from "./recommendation-metadata-transport.js";

export const RECOMMENDATION_METADATA_SHADOW_VERSION =
  "recommendation-metadata-transport-shadow-v1";
const ENGINE_VERSION = "skin-match-v2";
const REDNESS_DEEP_CLEAN_PENALTY = -18;

function text(value) {
  return String(value || "").trim();
}

function productId(product) {
  return text(product?.id || product?.productId || product?.product_id);
}

function productScore(product) {
  const value = Number(product?.engine_score ?? product?.score ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function productSlot(product) {
  return text(product?.decision_meta?.slot || product?.recommendation_slot || product?.category_family);
}

function rankMap(products) {
  return new Map(products.map((product, index) => [productId(product), index + 1]));
}

function topIds(products, count = 3) {
  return products.slice(0, count).map(productId);
}

function sameIds(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getRednessTotal(canonicalState) {
  const candidates = [
    canonicalState?.freeResult?.scoring?.concernScores?.redness?.total,
    canonicalState?.decisionBundle?.context?.skinState?.concernScores?.redness,
    canonicalState?.context?.skinState?.concernScores?.redness
  ];

  for (const value of candidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return 0;
}

function isHeuristicDeepCleanser(product) {
  const combined = [product?.id, product?.name, product?.notes, product?.standout_reason]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    productSlot(product) === "cleanser" &&
    (combined.includes("deep clean") ||
      combined.includes("pore deep") ||
      combined.includes("clarified finish") ||
      combined.includes("perfect whip"))
  );
}

function buildCommonDiagnostic({
  evaluatedAt,
  category,
  scenario,
  legacyRank,
  candidateRank,
  scoreDelta = 0,
  topPickChanged,
  top3Changed,
  hardGateChanged,
  explanationChanged = false,
  envelope,
  metadataUsed
}) {
  return {
    version: RECOMMENDATION_METADATA_SHADOW_VERSION,
    engineVersion: ENGINE_VERSION,
    productMetadataVersion: PRODUCT_METADATA_VERSION,
    evaluatedAt,
    category,
    scenario,
    legacyRank,
    candidateRank,
    scoreDelta,
    topPickChanged,
    top3Changed,
    hardGateChanged,
    explanationChanged,
    unknownMetadataCount: envelope?.metadataMissing?.length || 0,
    metadataUsed,
    metadataMissing: envelope?.metadataMissing || [],
    metadataInvalid: envelope?.metadataInvalid || [],
    metadataFallbacksApplied: envelope?.metadataFallbacksApplied || []
  };
}

function buildCleanserShadow(products, canonicalState, evaluatedAt) {
  const rednessActive = getRednessTotal(canonicalState) >= 18;
  const legacyRanks = rankMap(products);
  const shadowRows = products.map((product, index) => {
    const envelope = getRecommendationMetadataTransport(product);
    const structuredDeepClean = envelope?.metadata?.cleansing_profile === "deep_clean";
    const heuristicDeepClean = isHeuristicDeepCleanser(product);
    const legacyPenalty = rednessActive && heuristicDeepClean
      ? REDNESS_DEEP_CLEAN_PENALTY
      : 0;
    const candidatePenalty = rednessActive && structuredDeepClean
      ? REDNESS_DEEP_CLEAN_PENALTY
      : 0;

    return {
      product,
      legacyIndex: index,
      envelope,
      structuredDeepClean,
      heuristicDeepClean,
      legacyPenalty,
      candidatePenalty,
      candidateScore: productScore(product) - legacyPenalty + candidatePenalty
    };
  });
  const candidateOrder = [...shadowRows]
    .sort((left, right) =>
      right.candidateScore - left.candidateScore || left.legacyIndex - right.legacyIndex
    )
    .map((row) => row.product);
  const candidateRanks = rankMap(candidateOrder);
  const topPickChanged = productId(products[0]) !== productId(candidateOrder[0]);
  const top3Changed = !sameIds(topIds(products), topIds(candidateOrder));

  const scenarioNames = [
    "redness_only",
    "redness_sensitivity",
    "redness_barrier",
    "redness_post_cleanse_dryness",
    "recent_instability"
  ];

  return scenarioNames.map((scenario) => ({
    scenario,
    rednessPenaltyConditionActive: rednessActive,
    extraScenarioSignalsChangePenalty: false,
    legacyTop1: productId(products[0]) || null,
    candidateTop1: productId(candidateOrder[0]) || null,
    legacyTop3: topIds(products),
    candidateTop3: topIds(candidateOrder),
    products: shadowRows
      .filter((row) => productSlot(row.product) === "cleanser")
      .map((row) => ({
        ...buildCommonDiagnostic({
          evaluatedAt,
          category: "cleanser",
          scenario,
          legacyRank: legacyRanks.get(productId(row.product)) || null,
          candidateRank: candidateRanks.get(productId(row.product)) || null,
          scoreDelta: row.candidatePenalty - row.legacyPenalty,
          topPickChanged,
          top3Changed,
          hardGateChanged: row.legacyPenalty !== row.candidatePenalty,
          envelope: row.envelope,
          metadataUsed: ["cleansing_profile"]
        }),
        productId: productId(row.product),
        structuredDeepClean: row.structuredDeepClean,
        heuristicDeepClean: row.heuristicDeepClean,
        metadataHeuristicConflict:
          row.structuredDeepClean !== row.heuristicDeepClean,
        legacyPenalty: row.legacyPenalty,
        candidatePenalty: row.candidatePenalty
      }))
  }));
}

function classifyBalm(envelope) {
  const metadata = envelope?.metadata || {};
  const unknown =
    metadata.is_primary_moisturizer == null || metadata.balm_usage_scope == null;
  const localUse = ["local_area", "eye_lip"].includes(metadata.balm_usage_scope);
  const reviewRequired =
    unknown ||
    (Array.isArray(metadata.balm_caution_tags) && metadata.balm_caution_tags.length > 0) ||
    metadata.balm_research_confidence == null ||
    metadata.balm_research_confidence === "low";

  if (unknown) return { classification: "metadata_unknown", reviewRequired };
  if (metadata.is_primary_moisturizer === false || localUse) {
    return { classification: "supporting_or_local_use", reviewRequired };
  }
  if (reviewRequired) return { classification: "review_required", reviewRequired };
  return { classification: "primary_moisturizer_candidate", reviewRequired };
}

function buildEligibilityScenario(products, evaluatedAt, scenario, isEligible) {
  const moisturizerProducts = products.filter((product) => productSlot(product) === "moisturizer");
  const legacyRanks = rankMap(moisturizerProducts);
  const eligibleProducts = moisturizerProducts.filter(isEligible);
  const candidateRanks = rankMap(eligibleProducts);
  const legacyTop1 = productId(moisturizerProducts[0]) || null;
  const candidateTop1 = productId(eligibleProducts[0]) || null;
  const legacyTop3 = topIds(moisturizerProducts);
  const candidateTop3 = topIds(eligibleProducts);
  const topPickChanged = legacyTop1 !== candidateTop1;
  const top3Changed = !sameIds(legacyTop3, candidateTop3);

  return {
    scenario,
    legacyTop1,
    candidateTop1,
    legacyTop3,
    candidateTop3,
    legacyPrimaryCandidateCount: moisturizerProducts.length,
    candidatePrimaryCandidateCount: eligibleProducts.length,
    topPickChanged,
    top3Changed,
    products: moisturizerProducts
      .filter((product) => text(product?.category) === "moisturizer_balm")
      .map((product) => {
        const envelope = getRecommendationMetadataTransport(product);
        const metadata = envelope?.metadata || {};
        const classification = classifyBalm(envelope);
        const candidatePrimaryEligible = isEligible(product);
        return {
          ...buildCommonDiagnostic({
            evaluatedAt,
            category: "moisturizer_balm",
            scenario,
            legacyRank: legacyRanks.get(productId(product)) || null,
            candidateRank: candidateRanks.get(productId(product)) || null,
            topPickChanged,
            top3Changed,
            hardGateChanged: !candidatePrimaryEligible,
            envelope,
            metadataUsed: [
              "is_primary_moisturizer",
              "balm_usage_scope",
              "balm_caution_tags",
              "balm_research_confidence"
            ]
          }),
          productId: productId(product),
          isPrimaryMoisturizer: metadata.is_primary_moisturizer ?? null,
          balmUsageScope: metadata.balm_usage_scope ?? null,
          legacyPrimaryEligible: true,
          candidatePrimaryEligible,
          eligibilityReason: candidatePrimaryEligible
            ? classification.classification
            : scenario === "candidate_a_primary_flag"
              ? "is_primary_moisturizer_false"
              : "local_or_eye_lip_scope",
          classification: classification.classification,
          reviewRequired: classification.reviewRequired
        };
      })
  };
}

function buildBalmShadow(products, evaluatedAt) {
  return [
    buildEligibilityScenario(
      products,
      evaluatedAt,
      "candidate_a_primary_flag",
      (product) => {
        const metadata = getRecommendationMetadataTransport(product)?.metadata || {};
        return metadata.is_primary_moisturizer !== false;
      }
    ),
    buildEligibilityScenario(
      products,
      evaluatedAt,
      "candidate_b_usage_scope",
      (product) => {
        const metadata = getRecommendationMetadataTransport(product)?.metadata || {};
        return !["local_area", "eye_lip"].includes(metadata.balm_usage_scope);
      }
    )
  ];
}

function buildSunscreenShadow(products, evaluatedAt) {
  const sunscreenProducts = products.filter((product) => productSlot(product) === "sunscreen");
  const legacyRanks = rankMap(sunscreenProducts);
  const eligibility = new Map();

  for (const product of sunscreenProducts) {
    const metadata = getRecommendationMetadataTransport(product)?.metadata || {};
    eligibility.set(
      productId(product),
      Boolean(text(metadata.spf_value) && text(metadata.uva_label))
    );
  }

  const candidateProducts = sunscreenProducts.filter((product) => eligibility.get(productId(product)));
  const candidateRanks = rankMap(candidateProducts);
  const legacyTop1 = productId(sunscreenProducts[0]) || null;
  const candidateTop1 = productId(candidateProducts[0]) || null;
  const legacyTop3 = topIds(sunscreenProducts);
  const candidateTop3 = topIds(candidateProducts);
  const topPickChanged = legacyTop1 !== candidateTop1;
  const top3Changed = !sameIds(legacyTop3, candidateTop3);

  return {
    scenario: "protection_metadata_primary_eligibility",
    legacyTop1,
    candidateTop1,
    legacyTop3,
    candidateTop3,
    topPickChanged,
    top3Changed,
    products: sunscreenProducts.map((product) => {
      const envelope = getRecommendationMetadataTransport(product);
      const metadata = envelope?.metadata || {};
      const spfPresent = Boolean(text(metadata.spf_value));
      const uvaPresent = Boolean(text(metadata.uva_label));
      const waterResistanceKnown = metadata.water_resistant_minutes != null;
      const protectionMetadataComplete = spfPresent && uvaPresent;
      const candidatePrimaryEligible = eligibility.get(productId(product));
      return {
        ...buildCommonDiagnostic({
          evaluatedAt,
          category: "sunscreen",
          scenario: "protection_metadata_primary_eligibility",
          legacyRank: legacyRanks.get(productId(product)) || null,
          candidateRank: candidateRanks.get(productId(product)) || null,
          topPickChanged,
          top3Changed,
          hardGateChanged: !candidatePrimaryEligible,
          envelope,
          metadataUsed: ["spf_value", "uva_label", "water_resistant_minutes"]
        }),
        productId: productId(product),
        spfPresent,
        uvaPresent,
        waterResistanceKnown,
        protectionMetadataComplete,
        legacyPrimaryEligible: true,
        candidatePrimaryEligible,
        eligibilityReason: candidatePrimaryEligible
          ? "spf_and_uva_present"
          : !spfPresent && !uvaPresent
            ? "spf_and_uva_unknown"
            : !spfPresent
              ? "spf_unknown"
              : "uva_unknown"
      };
    })
  };
}

export function buildRecommendationMetadataTransportShadow({
  candidates,
  canonicalState,
  evaluatedAt = new Date().toISOString()
} = {}) {
  const products = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  const before = products.map((product) => ({
    id: productId(product),
    score: productScore(product),
    reason: product?.reason,
    comparisonReason: product?.comparison_reason
  }));

  const result = {
    version: RECOMMENDATION_METADATA_SHADOW_VERSION,
    transportVersion: RECOMMENDATION_METADATA_TRANSPORT_VERSION,
    engineVersion: ENGINE_VERSION,
    productMetadataVersion: PRODUCT_METADATA_VERSION,
    evaluatedAt,
    mode: "shadow_only",
    actualMutation: false,
    cleanser: buildCleanserShadow(products, canonicalState, evaluatedAt),
    balm: buildBalmShadow(products, evaluatedAt),
    sunscreen: buildSunscreenShadow(products, evaluatedAt),
    adminV1: {
      changed: false,
      unsupportedMetadataFields: ADMIN_V1_UNSUPPORTED_METADATA_FIELDS,
      adminV2Required: true,
      parityRisk: "existing_rows_may_be_complete_while_new_v1_imports_omit_metadata"
    }
  };

  const after = products.map((product) => ({
    id: productId(product),
    score: productScore(product),
    reason: product?.reason,
    comparisonReason: product?.comparison_reason
  }));

  return Object.freeze({
    ...result,
    productionInvariance: Object.freeze({
      candidateOrderMatch: sameIds(before.map((item) => item.id), after.map((item) => item.id)),
      candidateScoresMatch: sameIds(
        before.map((item) => `${item.id}:${item.score}`),
        after.map((item) => `${item.id}:${item.score}`)
      ),
      explanationsMatch: sameIds(
        before.map((item) => `${item.id}:${item.reason || ""}:${item.comparisonReason || ""}`),
        after.map((item) => `${item.id}:${item.reason || ""}:${item.comparisonReason || ""}`)
      )
    })
  });
}
