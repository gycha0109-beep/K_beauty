import "server-only";

import { createHash } from "crypto";
import "@/lib/server/recommendation-candidate-admission-runtime";
import { getRecommendationProducts } from "@/lib/product-source";
import {
  compareRankedProducts,
  filterSunscreenCandidates,
  scoreSunscreenProduct
} from "@/lib/recommendation-scoring";
import {
  buildProductQueryExecutionPlan,
  filterProductQueryCandidates,
  projectProductForQueryScoring
} from "@/lib/product-query-execution-contract.mjs";
import { PRODUCT_QUERY_INTENT_SCHEMA_VERSION } from "@/lib/product-query-intent-contract.mjs";
import {
  getRecommendationProtectionCredentialMode,
  readRecommendationSunscreenProtectionAuthorities
} from "@/lib/recommendation-sunscreen-protection-authority-reader";
import {
  RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS
} from "@/lib/recommendation-sunscreen-protection-authority-contract.mjs";
import {
  buildSunscreenProtectionCorpusAudit
} from "@/lib/sunscreen-protection-corpus-audit.mjs";
import {
  projectSunscreenProtectionAuthority
} from "@/lib/sunscreen-protection-projection.mjs";
import {
  buildSunscreenProtectionShadowAdjustment
} from "@/lib/sunscreen-protection-shadow-scoring.mjs";

export const PRODUCT_QUERY_PROTECTION_SHADOW_CONTRACT_VERSION =
  "product-query-protection-shadow-v1";

function classifyAuthorityFailure(reason) {
  const value = String(reason || "");
  if (value === "PF_PROTECTION_AUTHORITY_CREDENTIAL_UNAVAILABLE") {
    return "credential_unavailable";
  }
  if (value === "PF_PROTECTION_AUTHORITY_READ_TIMEOUT") {
    return "read_timeout";
  }
  if (value === "PF_PROTECTION_AUTHORITY_READ_FAILED") {
    return "read_failed";
  }
  if (
    value.startsWith("MALFORMED_") ||
    value === "READ_CONTRACT_VERSION_MISMATCH" ||
    value === "AMBIGUOUS_CURRENT_FACT_KEY" ||
    value === "AMBIGUOUS_CURRENT_AUTHORITY" ||
    value === "STALE_CURRENT_FACT" ||
    value === "STALE_SUBJECT" ||
    value === "NON_CURRENT_SUBJECT"
  ) {
    return "malformed_or_stale_authority";
  }
  return "authority_unavailable_other";
}

function summarizeAuthorityFailures(records) {
  const counts = {
    credential_unavailable: 0,
    read_timeout: 0,
    read_failed: 0,
    malformed_or_stale_authority: 0,
    authority_unavailable_other: 0
  };

  for (const record of records) {
    if (
      record?.authority?.status ===
      RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS.RESOLVED
    ) {
      continue;
    }
    const bucket = classifyAuthorityFailure(record?.authority?.reason);
    counts[bucket] += 1;
  }

  return Object.freeze({ ...counts });
}

function intent(overrides = {}) {
  return {
    schema_version: PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
    category: null,
    skin_type: null,
    concerns: [],
    sensitivity: null,
    texture: null,
    disliked_feel: null,
    preferred_finish: null,
    post_wash_feeling: null,
    afternoon_skin_change: null,
    very_sensitive_period: null,
    sunscreen_intent: null,
    white_cast_hate: null,
    tone_up_wanted: null,
    eye_sensitive: null,
    makeup_use: null,
    outdoor_exposure: null,
    unresolved_terms: [],
    confidence: "high",
    ...overrides
  };
}

export const PRODUCT_QUERY_PROTECTION_SHADOW_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "outdoor_white_cast",
    intent: Object.freeze(intent({
      category: "sunscreen",
      skin_type: "oily",
      white_cast_hate: true,
      sunscreen_intent: true,
      outdoor_exposure: true
    })),
    expectedStatus: "ranked"
  }),
  Object.freeze({
    id: "outdoor_sensitive",
    intent: Object.freeze(intent({
      category: "sunscreen",
      sensitivity: "high",
      eye_sensitive: true,
      sunscreen_intent: true,
      outdoor_exposure: true
    })),
    expectedStatus: "ranked"
  }),
  Object.freeze({
    id: "non_outdoor_control",
    intent: Object.freeze(intent({
      category: "sunscreen",
      skin_type: "oily",
      white_cast_hate: true,
      sunscreen_intent: true,
      outdoor_exposure: false
    })),
    expectedStatus: "ranked"
  }),
  Object.freeze({
    id: "outdoor_only_fail_closed",
    intent: Object.freeze(intent({
      category: "sunscreen",
      sunscreen_intent: true,
      outdoor_exposure: true
    })),
    expectedStatus: "insufficient_supported_intent"
  })
]);

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function rankBaselineSunscreens(scenarioIntent, products) {
  const plan = buildProductQueryExecutionPlan(scenarioIntent);
  const candidates = filterProductQueryCandidates(products, plan);

  if (candidates.length === 0) {
    return Object.freeze({
      plan,
      status: "no_candidates",
      candidateCount: 0,
      rejectedIds: Object.freeze([]),
      ranked: Object.freeze([])
    });
  }

  if (!plan.rankingEligible) {
    return Object.freeze({
      plan,
      status: "insufficient_supported_intent",
      candidateCount: candidates.length,
      rejectedIds: Object.freeze([]),
      ranked: Object.freeze([])
    });
  }

  const scoringCandidates = candidates.map((product) =>
    projectProductForQueryScoring(product, plan, { sunscreen: true })
  );
  const filtered = filterSunscreenCandidates(
    scoringCandidates,
    plan.recommendationAnswers
  );
  const pool =
    filtered.strictCandidates.length > 0
      ? filtered.strictCandidates
      : filtered.penaltyOnlyCandidates;

  const ranked = pool
    .map((product) =>
      scoreSunscreenProduct(product, plan.recommendationAnswers)
    )
    .sort(compareRankedProducts);

  return Object.freeze({
    plan,
    status: ranked.length > 0 ? "ranked" : "no_safe_candidates",
    candidateCount: candidates.length,
    rejectedIds: Object.freeze(filtered.rejected.map((product) => product.id)),
    ranked: Object.freeze(ranked)
  });
}

function stableRankProjection(products) {
  return products.map((product) => Object.freeze({
    id: product.id,
    score: Number(product.score || 0)
  }));
}

function compareOrders(baselineRanked, shadowRanked) {
  const baselinePositions = new Map(
    baselineRanked.map((product, index) => [product.id, index])
  );
  const shadowPositions = new Map(
    shadowRanked.map((product, index) => [product.id, index])
  );

  let changedProductCount = 0;
  let maxRankShift = 0;
  for (const [productId, baselineIndex] of baselinePositions.entries()) {
    const shadowIndex = shadowPositions.get(productId);
    if (!Number.isInteger(shadowIndex)) continue;
    const shift = Math.abs(shadowIndex - baselineIndex);
    if (shift > 0) changedProductCount += 1;
    maxRankShift = Math.max(maxRankShift, shift);
  }

  const baselineTop5 = baselineRanked.slice(0, 5).map((item) => item.id);
  const shadowTop5 = shadowRanked.slice(0, 5).map((item) => item.id);
  const shadowTop5Set = new Set(shadowTop5);
  const top5OverlapCount = baselineTop5.filter((id) =>
    shadowTop5Set.has(id)
  ).length;

  return Object.freeze({
    baselineTop5: Object.freeze(baselineTop5),
    shadowTop5: Object.freeze(shadowTop5),
    top5OverlapCount,
    orderChanged:
      JSON.stringify(baselineRanked.map((item) => item.id)) !==
      JSON.stringify(shadowRanked.map((item) => item.id)),
    changedProductCount,
    maxRankShift
  });
}

function applyProtectionShadow(baseline, projectionByProductId, audit) {
  if (baseline.status !== "ranked") {
    return Object.freeze({
      shadowStatus: baseline.status,
      shadowRanked: Object.freeze([]),
      adjustments: Object.freeze([])
    });
  }

  const adjustments = baseline.ranked.map((product) => {
    const protection = projectionByProductId.get(product.id) || null;
    const adjustment = buildSunscreenProtectionShadowAdjustment({
      baselineScore: product.score,
      protection,
      audit,
      outdoorExposure: baseline.plan.intent.outdoor_exposure === true
    });

    return Object.freeze({
      productId: product.id,
      protection,
      adjustment
    });
  });

  const shadowRanked = baseline.ranked
    .map((product) => {
      const entry = adjustments.find((item) => item.productId === product.id);
      return {
        ...product,
        score: entry?.adjustment?.shadowScore ?? product.score
      };
    })
    .sort(compareRankedProducts);

  return Object.freeze({
    shadowStatus: shadowRanked.length > 0 ? "ranked" : "no_safe_candidates",
    shadowRanked: Object.freeze(shadowRanked),
    adjustments: Object.freeze(adjustments)
  });
}

function evaluateScenario(scenario, products, projectionByProductId, audit) {
  const baseline = rankBaselineSunscreens(scenario.intent, products);
  const shadow = applyProtectionShadow(
    baseline,
    projectionByProductId,
    audit
  );
  const comparison = compareOrders(
    baseline.ranked,
    shadow.shadowRanked
  );

  const appliedProtectionProductCount = shadow.adjustments.filter(
    (entry) => entry.adjustment.appliedTotal > 0
  ).length;
  const maxAppliedProtectionDelta = shadow.adjustments.reduce(
    (max, entry) => Math.max(max, entry.adjustment.appliedTotal),
    0
  );
  const enabledAxes = Array.from(
    new Set(
      shadow.adjustments.flatMap(
        (entry) => entry.adjustment.enabledAxes || []
      )
    )
  ).sort();
  const blockedAxes = Array.from(
    new Set(
      shadow.adjustments.flatMap(
        (entry) => entry.adjustment.blockedAxes || []
      )
    )
  ).sort();

  const failures = [];
  if (baseline.status !== scenario.expectedStatus) {
    failures.push("baseline_status_mismatch");
  }
  if (shadow.shadowStatus !== baseline.status) {
    failures.push("shadow_status_changed");
  }
  if (
    baseline.status === "insufficient_supported_intent" &&
    shadow.shadowRanked.length !== 0
  ) {
    failures.push("shadow_resurrected_insufficient_intent");
  }
  if (
    shadow.shadowRanked.some((product) =>
      baseline.rejectedIds.includes(product.id)
    )
  ) {
    failures.push("shadow_resurrected_rejected_candidate");
  }

  return Object.freeze({
    id: scenario.id,
    baselineStatus: baseline.status,
    shadowStatus: shadow.shadowStatus,
    candidateCount: baseline.candidateCount,
    baselineFingerprint: fingerprint(stableRankProjection(baseline.ranked)),
    shadowFingerprint: fingerprint(stableRankProjection(shadow.shadowRanked)),
    baselineTop5: comparison.baselineTop5,
    shadowTop5: comparison.shadowTop5,
    top5OverlapCount: comparison.top5OverlapCount,
    orderChanged: comparison.orderChanged,
    changedProductCount: comparison.changedProductCount,
    maxRankShift: comparison.maxRankShift,
    appliedProtectionProductCount,
    maxAppliedProtectionDelta,
    enabledAxes: Object.freeze(enabledAxes),
    blockedAxes: Object.freeze(blockedAxes),
    pass: failures.length === 0,
    failures: Object.freeze(failures)
  });
}

export async function runProductQueryProtectionShadowEvaluation() {
  const products = await getRecommendationProducts();
  const sunscreenProducts = products.filter(
    (product) => product?.category === "sunscreen"
  );
  const credentialMode = getRecommendationProtectionCredentialMode({
    allowShadowTransportFallback: true
  });
  const protectionRecords =
    await readRecommendationSunscreenProtectionAuthorities(
      sunscreenProducts.map((product) => product.id),
      { allowShadowTransportFallback: true }
    );
  const authorityFailureCounts = summarizeAuthorityFailures(protectionRecords);
  const authorityResolvedCount = protectionRecords.filter(
    (record) =>
      record.authority?.status ===
      RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS.RESOLVED
  ).length;
  const audit = buildSunscreenProtectionCorpusAudit(protectionRecords);
  const projections = protectionRecords.map(
    projectSunscreenProtectionAuthority
  );
  const projectionByProductId = new Map(
    projections.map((projection) => [projection.productId, projection])
  );

  const scenarios = PRODUCT_QUERY_PROTECTION_SHADOW_SCENARIOS.map(
    (scenario) =>
      evaluateScenario(
        scenario,
        products,
        projectionByProductId,
        audit
      )
  );

  const enabledAxes = Array.from(
    new Set(scenarios.flatMap((scenario) => scenario.enabledAxes))
  ).sort();
  const allScenarioChecksPass = scenarios.every(
    (scenario) => scenario.pass
  );

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_PROTECTION_SHADOW_CONTRACT_VERSION,
    sunscreenCorpusCount: sunscreenProducts.length,
    authorityResolvedCount,
    credentialMode,
    authorityFailureCounts,
    audit,
    enabledAxes: Object.freeze(enabledAxes),
    scenarioCount: scenarios.length,
    allScenarioChecksPass,
    scenarios: Object.freeze(scenarios),
    limits: Object.freeze({
      productionRankingChanged: false,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
      publicActivation: false,
      persistence: false,
      profileRead: false,
      historyRead: false,
      productionWrite: false,
      recommendationLogWrite: false
    })
  });
}
