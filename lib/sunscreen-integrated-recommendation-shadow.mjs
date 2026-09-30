import {
  filterSunscreenCandidates,
  normalizeRecommendationAnswers,
  scoreSunscreenProduct,
} from "./recommendation-scoring.ts";
import {
  evaluateSunscreenSemanticScoringEligibility,
  projectEstablishedSunscreenSemantics,
} from "./sunscreen-recommendation-semantic-projection.mjs";
import {
  evaluateSunscreenInitialAdmissionGrant,
} from "./sunscreen-initial-admission-grant-policy.mjs";
import {
  buildSunscreenProtectionShadowAdjustment,
} from "./sunscreen-protection-shadow-scoring.mjs";

export const SUNSCREEN_INTEGRATED_SHADOW_VERSION =
  "data-ai29c-d3-integrated-sunscreen-shadow-v1";

function isSensitiveSunscreenContext(answers) {
  return (
    answers.sensitivity === "high" ||
    answers.skinType === "sensitive" ||
    answers.verySensitivePeriod === true ||
    answers.mainConcern === "redness" ||
    answers.mainConcern === "barrier"
  );
}

export function buildSunscreenSemanticScoringContext(rawAnswers) {
  const answers = normalizeRecommendationAnswers(rawAnswers || {});
  const textureRelevant =
    Boolean(answers.preferredTexture) ||
    ["sticky", "greasy", "heavy"].includes(
      String(answers.mostDislikedFeel || ""),
    );

  return Object.freeze({
    sensitivityRelevant: isSensitiveSunscreenContext(answers),
    whiteCastRelevant: answers.whiteCastHate === true,
    eyeStingRelevant: answers.eyeSensitive === true,
    pillingRelevant: answers.makeupUse === true,

    // The current sunscreen scorer adjusts tone_up for both true and false.
    // Unknown tone_up would otherwise avoid either a bonus or a penalty.
    toneUpRelevant: true,

    // getExpectedSunscreenFinish() always resolves a target finish, falling
    // back to natural. Therefore unknown finish can never be passed through
    // the current scorer without turning missing into an implicit default.
    finishRelevant: true,

    // Texture is not part of SunscreenScoreBreakdown, but the underlying
    // canonical scorer can use it for preference/caution metadata. Gate it
    // whenever the current request makes that metadata meaningful.
    textureRelevant,
  });
}

function buildSemanticBundleForSubject(template, subjectId) {
  return {
    ...structuredClone(template),
    subjectId,
  };
}

function buildProjectedRecommendationProduct(authorityRow, semanticBundle) {
  const projection = projectEstablishedSunscreenSemantics(semanticBundle);
  if (!projection.envelope.envelopeReady || !projection.projected) {
    return null;
  }

  const semantic = projection.projected;

  // Only identity/display fields plus D1B-established semantics are projected.
  // Unresolved semantic fields remain absent; no legacy Product-row fallback.
  return {
    id: authorityRow.product.id,
    name: authorityRow.product.name,
    brand: authorityRow.product.brand || "SIDMOOL",
    category: semantic.category,
    skin_types: semantic.skin_types,
    concerns: semantic.concerns,
    texture: semantic.texture,
    finish: semantic.finish,
    uv_filter_type: semantic.uv_filter_type,
    sensitivity_safe: semantic.sensitivity_safe,
    irritation_risk: semantic.irritation_risk,
    tone_up: semantic.tone_up,
    white_cast: semantic.white_cast,
    eye_sting: semantic.eye_sting,
    pilling_risk: semantic.pilling_risk,
  };
}

function buildProtectionProjection(record) {
  return Object.freeze({
    spf: Object.freeze({
      bucket:
        typeof record?.spf_bucket === "string" ? record.spf_bucket : null,
    }),
    uva: Object.freeze({
      bucket:
        typeof record?.uva_bucket === "string" ? record.uva_bucket : null,
    }),
    waterResistance: Object.freeze({
      bucket:
        typeof record?.water_bucket === "string"
          ? record.water_bucket
          : null,
    }),
  });
}

function buildProtectionAudit(readiness) {
  return Object.freeze({
    axes: Object.freeze({
      spf: Object.freeze({
        rankingUseful: readiness?.axes?.spf?.rankingUseful === true,
      }),
      uva: Object.freeze({
        rankingUseful: readiness?.axes?.uva?.rankingUseful === true,
      }),
      waterResistance: Object.freeze({
        rankingUseful:
          readiness?.axes?.waterResistance?.rankingUseful === true,
      }),
    }),
  });
}

function evaluateOne({
  authorityRow,
  semanticBundle,
  protectionRecord,
  readiness,
  answers,
  semanticContext,
}) {
  const grantInput = {
    product: authorityRow.product,
    taxonomy: authorityRow.taxonomy,
    subject: authorityRow.subject,
    registry: authorityRow.registry,
    currentFacts: authorityRow.currentFacts,
    semanticBundle,
  };
  const grant = evaluateSunscreenInitialAdmissionGrant(grantInput);

  if (!grant.grant) {
    return Object.freeze({
      productId: authorityRow.product.id,
      name: authorityRow.product.name,
      stage: "admission",
      admitted: false,
      semanticEligible: false,
      hardRejected: false,
      baselineScore: null,
      protectionDelta: 0,
      shadowScore: null,
      blockers: grant.reasons,
    });
  }

  const semanticEligibility =
    evaluateSunscreenSemanticScoringEligibility(
      semanticBundle,
      semanticContext,
    );

  if (!semanticEligibility.eligible) {
    return Object.freeze({
      productId: authorityRow.product.id,
      name: authorityRow.product.name,
      stage: "semantic_context",
      admitted: true,
      semanticEligible: false,
      hardRejected: false,
      baselineScore: null,
      protectionDelta: 0,
      shadowScore: null,
      blockers: semanticEligibility.blockers,
    });
  }

  const projectedProduct =
    buildProjectedRecommendationProduct(authorityRow, semanticBundle);
  if (!projectedProduct) {
    return Object.freeze({
      productId: authorityRow.product.id,
      name: authorityRow.product.name,
      stage: "projection",
      admitted: true,
      semanticEligible: false,
      hardRejected: false,
      baselineScore: null,
      protectionDelta: 0,
      shadowScore: null,
      blockers: Object.freeze(["SEMANTIC_PROJECTION_UNAVAILABLE"]),
    });
  }

  const filtered = filterSunscreenCandidates([projectedProduct], answers);
  if (filtered.strictCandidates.length === 0) {
    const rejected = filtered.rejected[0] || null;
    return Object.freeze({
      productId: authorityRow.product.id,
      name: authorityRow.product.name,
      stage: "hard_reject",
      admitted: true,
      semanticEligible: true,
      hardRejected: true,
      baselineScore: null,
      protectionDelta: 0,
      shadowScore: null,
      blockers: Object.freeze([
        ...(
          rejected?.sunscreen_debug?.hardRejectReasons ||
          ["SUNSCREEN_HARD_REJECT"]
        ),
      ]),
    });
  }

  const scored = scoreSunscreenProduct(
    filtered.strictCandidates[0],
    answers,
  );
  const baselineScore = Number(scored.score);
  const protection = buildSunscreenProtectionShadowAdjustment({
    baselineScore,
    protection: buildProtectionProjection(protectionRecord),
    audit: buildProtectionAudit(readiness),
    outdoorExposure: answers.outdoorExposure === true,
  });

  return Object.freeze({
    productId: authorityRow.product.id,
    name: authorityRow.product.name,
    stage: "scored",
    admitted: true,
    semanticEligible: true,
    hardRejected: false,
    baselineScore,
    protectionDelta: protection.appliedTotal,
    shadowScore: protection.shadowScore,
    sunscreenScoreBreakdown: Object.freeze({
      ...(scored.sunscreen_score_breakdown || {}),
    }),
    enabledProtectionAxes: protection.enabledAxes,
    blockedProtectionAxes: protection.blockedAxes,
    blockers: Object.freeze([]),
  });
}

function sortNumericScore(rows, key) {
  return Object.freeze(
    [...rows].sort(
      (left, right) =>
        Number(right[key]) - Number(left[key]) ||
        left.productId.localeCompare(right.productId),
    ),
  );
}

function orderChangedByNumericScore(baselineRanked, shadowRanked) {
  if (baselineRanked.length !== shadowRanked.length) return false;
  return baselineRanked.some(
    (row, index) => row.productId !== shadowRanked[index]?.productId,
  );
}

export function evaluateIntegratedSunscreenRecommendationShadow({
  authorityRows,
  semanticBundles,
  protectionRecords,
  readiness,
  rawAnswers,
}) {
  const rows = Array.isArray(authorityRows) ? authorityRows : [];
  const bundles = Array.isArray(semanticBundles) ? semanticBundles : [];
  const protection = Array.isArray(protectionRecords)
    ? protectionRecords
    : [];

  if (
    rows.length === 0 ||
    bundles.length === 0 ||
    readiness?.overall_decision !== "SHADOW_SCORING_PARTIALLY_READY"
  ) {
    throw new Error("integrated_sunscreen_shadow_input_invalid");
  }

  const bundleByProduct = new Map(
    bundles.map((bundle) => [bundle.productId, bundle]),
  );
  const protectionByProduct = new Map(
    protection.map((record) => [record.product_id, record]),
  );
  const answers = normalizeRecommendationAnswers(rawAnswers || {});
  const semanticContext =
    buildSunscreenSemanticScoringContext(answers);

  const evaluated = rows.map((authorityRow) => {
    const template = bundleByProduct.get(authorityRow.product.id);
    if (!template) {
      throw new Error(
        `integrated_sunscreen_shadow_semantic_missing:${authorityRow.product.id}`,
      );
    }
    const semanticBundle = buildSemanticBundleForSubject(
      template,
      authorityRow.subject.subjectId,
    );
    return evaluateOne({
      authorityRow,
      semanticBundle,
      protectionRecord: protectionByProduct.get(authorityRow.product.id),
      readiness,
      answers,
      semanticContext,
    });
  });

  const scored = evaluated.filter(
    (row) => row.stage === "scored" && row.shadowScore != null,
  );
  const baselineRanked = sortNumericScore(scored, "baselineScore");
  const shadowRanked = sortNumericScore(scored, "shadowScore");
  const hardRejected = evaluated.filter((row) => row.hardRejected);
  const semanticBlocked = evaluated.filter(
    (row) => row.stage === "semantic_context",
  );

  const uniqueBaselineScores = new Set(
    scored.map((row) => String(row.baselineScore)),
  );
  const baselineScoreTieCount =
    scored.length - uniqueBaselineScores.size;

  return Object.freeze({
    version: SUNSCREEN_INTEGRATED_SHADOW_VERSION,
    scenario: Object.freeze({
      answers,
      semanticContext,
    }),
    corpusCount: rows.length,
    admittedCount: evaluated.filter((row) => row.admitted).length,
    semanticEligibleCount: evaluated.filter(
      (row) => row.semanticEligible,
    ).length,
    semanticBlockedCount: semanticBlocked.length,
    hardRejectedCount: hardRejected.length,
    scoredCount: scored.length,
    appliedProtectionProductCount: scored.filter(
      (row) => row.protectionDelta > 0,
    ).length,
    maxProtectionDelta: scored.reduce(
      (max, row) => Math.max(max, row.protectionDelta),
      0,
    ),
    baselineScoreTieCount,
    numericScoreOrderChanged: orderChangedByNumericScore(
      baselineRanked,
      shadowRanked,
    ),
    integratedRankingReady:
      scored.length >= 2 && baselineScoreTieCount === 0,
    rows: Object.freeze(evaluated),
    baselineRanked,
    shadowRanked,
    limits: Object.freeze({
      productionCandidateAdmissionWired: false,
      productionRankingChanged: false,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
      publicActivation: false,
      waterResistanceApplied: false,
      hardRejectedCandidateResurrected: false,
      rawProductFallbackUsed: false,
      productionTieBreakerClaimed: false,
    }),
  });
}
