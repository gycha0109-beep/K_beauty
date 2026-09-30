import {
  filterSunscreenCandidates,
  normalizeRecommendationAnswers,
  scoreSunscreenProduct,
} from "./recommendation-scoring.ts";
import {
  evaluateSunscreenSemanticEnvelope,
  projectEstablishedSunscreenSemantics,
} from "./sunscreen-recommendation-semantic-projection.mjs";
import {
  evaluateSunscreenInitialAdmissionGrant,
} from "./sunscreen-initial-admission-grant-policy.mjs";
import {
  buildSunscreenProtectionShadowAdjustment,
} from "./sunscreen-protection-shadow-scoring.mjs";

export const SUNSCREEN_FEATURE_GATED_SHADOW_VERSION =
  "data-ai29c-d3r1-feature-gated-integrated-shadow-v1";

const TWO_SIDED_SCORE_FIELDS = Object.freeze({
  finish: "finish",
  toneUp: "tone_up",
  sensitivitySafe: "sensitivity_safe",
  whiteCast: "white_cast",
  eyeSting: "eye_sting",
  pilling: "pilling_risk",
});

function field(bundle, key) {
  return bundle?.fields?.[key] || {
    state: "not_reviewed",
    value: null,
    confidence: "unknown",
  };
}

function isEstablished(bundle, key) {
  const current = field(bundle, key);
  return current.state === "established" && current.value !== null;
}

function isSensitiveContext(answers) {
  return (
    answers.sensitivity === "high" ||
    answers.skinType === "sensitive" ||
    answers.verySensitivePeriod === true ||
    answers.mainConcern === "redness" ||
    answers.mainConcern === "barrier"
  );
}

function primaryConcern(answers) {
  return answers.mainConcerns?.[0] || answers.mainConcern || null;
}

export function buildHardRejectAuthorityRequirements(rawAnswers) {
  const answers = normalizeRecommendationAnswers(rawAnswers || {});
  const required = [];

  if (isSensitiveContext(answers)) {
    required.push("irritation_risk");
  }

  if (answers.eyeSensitive) {
    required.push("eye_sting");
  }

  if (answers.makeupUse) {
    required.push("pilling_risk");
  }

  if (!answers.toneUpWanted && answers.whiteCastHate) {
    required.push("white_cast");
  }

  if (
    answers.skinType === "dry" &&
    primaryConcern(answers) !== "oiliness"
  ) {
    required.push("finish");
  }

  return Object.freeze([...new Set(required)].sort());
}

function buildSemanticBundleForSubject(template, subjectId) {
  return {
    ...structuredClone(template),
    subjectId,
  };
}

function buildProjectedProduct(authorityRow, semanticBundle) {
  const projection = projectEstablishedSunscreenSemantics(semanticBundle);
  if (!projection.envelope.envelopeReady || !projection.projected) {
    return null;
  }

  const s = projection.projected;

  return {
    id: authorityRow.product.id,
    name: authorityRow.product.name,
    brand: authorityRow.product.brand || "SIDMOOL",
    category: s.category,
    skin_types: s.skin_types,
    concerns: s.concerns,
    texture: s.texture,
    finish: s.finish,
    uv_filter_type: s.uv_filter_type,
    sensitivity_safe: s.sensitivity_safe,
    irritation_risk: s.irritation_risk,
    tone_up: s.tone_up,
    white_cast: s.white_cast,
    eye_sting: s.eye_sting,
    pilling_risk: s.pilling_risk,
  };
}

function buildProtectionProjection(record) {
  return {
    spf: { bucket: record?.spf_bucket || null },
    uva: { bucket: record?.uva_bucket || null },
    waterResistance: { bucket: record?.water_bucket || null },
  };
}

function buildProtectionAudit(readiness) {
  return {
    axes: {
      spf: { rankingUseful: readiness?.axes?.spf?.rankingUseful === true },
      uva: { rankingUseful: readiness?.axes?.uva?.rankingUseful === true },
      waterResistance: {
        rankingUseful:
          readiness?.axes?.waterResistance?.rankingUseful === true,
      },
    },
  };
}

function axisRelevant(answers) {
  return Object.freeze({
    finish: true,
    toneUp: true,
    sensitivitySafe: isSensitiveContext(answers),
    whiteCast: answers.whiteCastHate === true,
    eyeSting: answers.eyeSensitive === true,
    pilling: answers.makeupUse === true,
  });
}

function buildCohortAxisState(scored, answers) {
  const relevant = axisRelevant(answers);
  const state = {};

  for (const [axis, semanticField] of Object.entries(
    TWO_SIDED_SCORE_FIELDS,
  )) {
    const complete =
      scored.length > 0 &&
      scored.every((row) => isEstablished(row.semanticBundle, semanticField));

    state[axis] = Object.freeze({
      relevant: relevant[axis] === true,
      complete,
      active: relevant[axis] === true && complete,
      semanticField,
      reason:
        relevant[axis] !== true
          ? "not_relevant"
          : complete
            ? "complete_authority"
            : "cohort_authority_incomplete",
    });
  }

  return Object.freeze(state);
}

function maskedSunscreenBreakdown(raw, axes) {
  const out = {
    skin_type_match: Number(raw.skin_type_match || 0),
    primary_concern_match: Number(raw.primary_concern_match || 0),
    secondary_concern_match: Number(raw.secondary_concern_match || 0),

    finish_match: axes.finish.active
      ? Number(raw.finish_match || 0)
      : 0,

    filter_type_match: Number(raw.filter_type_match || 0),

    sensitivity_safe_adjustment: axes.sensitivitySafe.active
      ? Number(raw.sensitivity_safe_adjustment || 0)
      : 0,

    tone_up_adjustment: axes.toneUp.active
      ? Number(raw.tone_up_adjustment || 0)
      : 0,

    white_cast_adjustment: axes.whiteCast.active
      ? Number(raw.white_cast_adjustment || 0)
      : 0,

    eye_sting_adjustment: axes.eyeSting.active
      ? Number(raw.eye_sting_adjustment || 0)
      : 0,

    pilling_adjustment: axes.pilling.active
      ? Number(raw.pilling_adjustment || 0)
      : 0,

    // The only numeric strong-penalty cases in the current scorer are
    // finish-driven oily/dewy and dry/soft-matte conflicts.
    strong_penalty_adjustment: axes.finish.active
      ? Number(raw.strong_penalty_adjustment || 0)
      : 0,
  };

  out.total = Object.values(out).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );

  return Object.freeze(out);
}

function scoreOnlyOrder(rows, key) {
  return Object.freeze(
    [...rows].sort(
      (left, right) =>
        Number(right[key]) - Number(left[key]) ||
        left.productId.localeCompare(right.productId),
    ),
  );
}

function scoreTieCount(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = String(row[key]);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  let ties = 0;
  for (const count of counts.values()) {
    if (count > 1) ties += count;
  }
  return ties;
}

function topScoreSet(rows, key) {
  if (rows.length === 0) return Object.freeze([]);
  const top = Math.max(...rows.map((row) => Number(row[key])));
  return Object.freeze(
    rows
      .filter((row) => Number(row[key]) === top)
      .map((row) => row.productId)
      .sort(),
  );
}

function sameSet(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function evaluateFeatureGatedIntegratedSunscreenShadow({
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
    throw new Error("feature_gated_sunscreen_shadow_input_invalid");
  }

  const answers = normalizeRecommendationAnswers(rawAnswers || {});
  const hardRejectRequirements =
    buildHardRejectAuthorityRequirements(answers);
  const bundleByProduct = new Map(
    bundles.map((bundle) => [bundle.productId, bundle]),
  );
  const protectionByProduct = new Map(
    protection.map((record) => [record.product_id, record]),
  );

  const staged = [];

  for (const authorityRow of rows) {
    const template = bundleByProduct.get(authorityRow.product.id);
    if (!template) {
      throw new Error(
        `feature_gated_shadow_semantic_missing:${authorityRow.product.id}`,
      );
    }

    const semanticBundle = buildSemanticBundleForSubject(
      template,
      authorityRow.subject.subjectId,
    );
    const envelope = evaluateSunscreenSemanticEnvelope(semanticBundle);

    const grant = evaluateSunscreenInitialAdmissionGrant({
      product: authorityRow.product,
      taxonomy: authorityRow.taxonomy,
      subject: authorityRow.subject,
      registry: authorityRow.registry,
      currentFacts: authorityRow.currentFacts,
      semanticBundle,
    });

    if (!grant.grant) {
      staged.push({
        productId: authorityRow.product.id,
        name: authorityRow.product.name,
        stage: "admission",
        admitted: false,
        semanticBundle,
        blockers: [...grant.reasons],
      });
      continue;
    }

    if (!envelope.envelopeReady) {
      staged.push({
        productId: authorityRow.product.id,
        name: authorityRow.product.name,
        stage: "semantic_envelope",
        admitted: true,
        semanticBundle,
        blockers: ["SEMANTIC_ENVELOPE_NOT_READY"],
      });
      continue;
    }

    const missingHardRejectAuthority = hardRejectRequirements.filter(
      (fieldName) => !isEstablished(semanticBundle, fieldName),
    );

    if (missingHardRejectAuthority.length > 0) {
      staged.push({
        productId: authorityRow.product.id,
        name: authorityRow.product.name,
        stage: "hard_reject_authority_hold",
        admitted: true,
        semanticBundle,
        blockers: missingHardRejectAuthority.map(
          (fieldName) =>
            `HARD_REJECT_AUTHORITY_UNKNOWN:${fieldName}`,
        ),
      });
      continue;
    }

    const projectedProduct = buildProjectedProduct(
      authorityRow,
      semanticBundle,
    );

    if (!projectedProduct) {
      staged.push({
        productId: authorityRow.product.id,
        name: authorityRow.product.name,
        stage: "projection",
        admitted: true,
        semanticBundle,
        blockers: ["SEMANTIC_PROJECTION_UNAVAILABLE"],
      });
      continue;
    }

    const filtered = filterSunscreenCandidates(
      [projectedProduct],
      answers,
    );

    if (filtered.strictCandidates.length === 0) {
      const rejected = filtered.rejected[0];
      staged.push({
        productId: authorityRow.product.id,
        name: authorityRow.product.name,
        stage: "hard_reject",
        admitted: true,
        semanticBundle,
        projectedProduct,
        hardRejected: true,
        blockers: [
          ...(
            rejected?.sunscreen_debug?.hardRejectReasons ||
            ["SUNSCREEN_HARD_REJECT"]
          ),
        ],
      });
      continue;
    }

    const scored = scoreSunscreenProduct(
      filtered.strictCandidates[0],
      answers,
    );

    staged.push({
      productId: authorityRow.product.id,
      name: authorityRow.product.name,
      stage: "raw_scored",
      admitted: true,
      semanticBundle,
      projectedProduct,
      hardRejected: false,
      rawScore: Number(scored.score),
      rawBreakdown: Object.freeze({
        ...(scored.sunscreen_score_breakdown || {}),
      }),
      blockers: [],
    });
  }

  const rawScored = staged.filter(
    (row) => row.stage === "raw_scored",
  );
  const axes = buildCohortAxisState(rawScored, answers);
  const audit = buildProtectionAudit(readiness);

  const finalized = staged.map((row) => {
    if (row.stage !== "raw_scored") {
      return Object.freeze({
        ...row,
        baselineScore: null,
        protectionDelta: 0,
        shadowScore: null,
      });
    }

    const masked = maskedSunscreenBreakdown(
      row.rawBreakdown,
      axes,
    );
    const protectionAdjustment =
      buildSunscreenProtectionShadowAdjustment({
        baselineScore: masked.total,
        protection: buildProtectionProjection(
          protectionByProduct.get(row.productId),
        ),
        audit,
        outdoorExposure: answers.outdoorExposure === true,
      });

    return Object.freeze({
      ...row,
      stage: "scored",
      maskedBreakdown: masked,
      baselineScore: masked.total,
      protectionDelta: protectionAdjustment.appliedTotal,
      shadowScore: protectionAdjustment.shadowScore,
      enabledProtectionAxes: protectionAdjustment.enabledAxes,
      blockedProtectionAxes: protectionAdjustment.blockedAxes,
    });
  });

  const scored = finalized.filter(
    (row) => row.stage === "scored",
  );
  const baselineRanked = scoreOnlyOrder(scored, "baselineScore");
  const shadowRanked = scoreOnlyOrder(scored, "shadowScore");
  const baselineTopSet = topScoreSet(scored, "baselineScore");
  const shadowTopSet = topScoreSet(scored, "shadowScore");
  const baselineTieCount = scoreTieCount(scored, "baselineScore");
  const shadowTieCount = scoreTieCount(scored, "shadowScore");

  return Object.freeze({
    version: SUNSCREEN_FEATURE_GATED_SHADOW_VERSION,
    scenario: Object.freeze({
      answers,
      hardRejectRequirements,
    }),
    corpusCount: rows.length,
    admittedCount: finalized.filter((row) => row.admitted).length,
    hardRejectAuthorityHoldCount: finalized.filter(
      (row) => row.stage === "hard_reject_authority_hold",
    ).length,
    hardRejectedCount: finalized.filter(
      (row) => row.stage === "hard_reject",
    ).length,
    scoredCount: scored.length,
    cohortAxes: axes,
    baselineTieCount,
    shadowTieCount,
    baselineTopSet,
    shadowTopSet,
    topScoreSetChanged: !sameSet(baselineTopSet, shadowTopSet),
    integratedScoreComparisonReady: scored.length >= 2,
    productionOrderClaimReady:
      scored.length >= 2 &&
      baselineTieCount === 0 &&
      shadowTieCount === 0,
    appliedProtectionProductCount: scored.filter(
      (row) => row.protectionDelta > 0,
    ).length,
    rows: Object.freeze(finalized),
    baselineRanked,
    shadowRanked,
    limits: Object.freeze({
      missingConvertedToFalse: false,
      unresolvedTwoSidedAxisComparedAsNeutral: false,
      hardRejectUnknownAllowedThrough: false,
      hardRejectedCandidateResurrected: false,
      waterResistanceApplied: false,
      rawProductFallbackUsed: false,
      productionCandidateAdmissionWired: false,
      productionRankingChanged: false,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
      publicActivation: false,
    }),
  });
}
