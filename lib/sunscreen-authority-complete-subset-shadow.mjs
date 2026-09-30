import {
  filterSunscreenCandidates,
  normalizeRecommendationAnswers,
  scoreSunscreenProduct,
} from "./recommendation-scoring.ts";
import {
  evaluateSunscreenInitialAdmissionGrant,
} from "./sunscreen-initial-admission-grant-policy.mjs";
import {
  projectEstablishedSunscreenSemantics,
} from "./sunscreen-recommendation-semantic-projection.mjs";
import {
  buildSunscreenProtectionShadowAdjustment,
} from "./sunscreen-protection-shadow-scoring.mjs";

export const SUNSCREEN_AUTHORITY_COMPLETE_SUBSET_SHADOW_VERSION =
  "data-ai29c-d3r3-authority-complete-subset-shadow-v1";

const REQUIRED_NEUTRAL_FIELDS = Object.freeze([
  "category_slot",
  "uv_filter_type",
  "finish",
  "tone_up",
]);

function clone(value) {
  return structuredClone(value);
}

function fieldEstablished(bundle, fieldName) {
  const field = bundle?.fields?.[fieldName];
  return field?.state === "established" && field?.value !== null;
}

export function applySemanticAuthorityRecoveries(
  semanticBundles,
  recoveryFixture,
) {
  const byProduct = new Map(
    (semanticBundles || []).map((bundle) => [
      bundle.productId,
      clone(bundle),
    ]),
  );

  for (const recovery of recoveryFixture?.recoveries || []) {
    const bundle = byProduct.get(recovery.productId);
    if (!bundle) {
      throw new Error(
        `d3r3_recovery_product_missing:${recovery.productId}`,
      );
    }
    bundle.fields[recovery.fieldName] = {
      state: recovery.state,
      value: recovery.value,
      confidence: recovery.confidence,
      reviewId: recovery.reviewId,
    };
  }

  return Object.freeze(
    [...byProduct.values()].map((bundle) => Object.freeze(bundle)),
  );
}

export function evaluateNeutralSemanticAuthorityCompleteness(bundle) {
  const missingFields = REQUIRED_NEUTRAL_FIELDS.filter(
    (fieldName) => !fieldEstablished(bundle, fieldName),
  );
  return Object.freeze({
    productId: bundle?.productId || null,
    requiredFields: REQUIRED_NEUTRAL_FIELDS,
    complete: missingFields.length === 0,
    missingFields: Object.freeze(missingFields),
  });
}

function projectedProduct(authorityRow, bundle) {
  const projection = projectEstablishedSunscreenSemantics(bundle);
  if (!projection.envelope.envelopeReady || !projection.projected) {
    return null;
  }
  const semantic = projection.projected;
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

function scoreExistingProduct(product, answers) {
  const filtered = filterSunscreenCandidates([product], answers);
  if (filtered.strictCandidates.length !== 1) {
    return Object.freeze({
      productId: product.id,
      name: product.name,
      cohort: "legacy",
      stage: "hard_reject",
      baselineScore: null,
      blockers: Object.freeze(
        filtered.rejected[0]?.sunscreen_debug?.hardRejectReasons || [],
      ),
    });
  }
  const scored = scoreSunscreenProduct(
    filtered.strictCandidates[0],
    answers,
  );
  return Object.freeze({
    productId: product.id,
    name: product.name,
    cohort: "legacy",
    stage: "scored",
    baselineScore: Number(scored.score),
    blockers: Object.freeze([]),
  });
}

function scoreNewProduct(authorityRow, bundle, answers) {
  const grant = evaluateSunscreenInitialAdmissionGrant({
    product: authorityRow.product,
    taxonomy: authorityRow.taxonomy,
    subject: authorityRow.subject,
    registry: authorityRow.registry,
    currentFacts: authorityRow.currentFacts,
    semanticBundle: bundle,
  });
  if (!grant.grant) {
    return Object.freeze({
      productId: authorityRow.product.id,
      name: authorityRow.product.name,
      cohort: "new_grant",
      stage: "admission_hold",
      baselineScore: null,
      blockers: grant.reasons,
    });
  }

  const authority = evaluateNeutralSemanticAuthorityCompleteness(bundle);
  if (!authority.complete) {
    return Object.freeze({
      productId: authorityRow.product.id,
      name: authorityRow.product.name,
      cohort: "new_grant",
      stage: "semantic_hold",
      baselineScore: null,
      blockers: Object.freeze(
        authority.missingFields.map(
          (fieldName) =>
            `NEUTRAL_SCORING_AUTHORITY_MISSING:${fieldName}`,
        ),
      ),
    });
  }

  const product = projectedProduct(authorityRow, bundle);
  if (!product) {
    return Object.freeze({
      productId: authorityRow.product.id,
      name: authorityRow.product.name,
      cohort: "new_grant",
      stage: "projection_hold",
      baselineScore: null,
      blockers: Object.freeze(["SEMANTIC_PROJECTION_UNAVAILABLE"]),
    });
  }

  const filtered = filterSunscreenCandidates([product], answers);
  if (filtered.strictCandidates.length !== 1) {
    return Object.freeze({
      productId: authorityRow.product.id,
      name: authorityRow.product.name,
      cohort: "new_grant",
      stage: "hard_reject",
      baselineScore: null,
      blockers: Object.freeze(
        filtered.rejected[0]?.sunscreen_debug?.hardRejectReasons || [],
      ),
    });
  }

  const scored = scoreSunscreenProduct(
    filtered.strictCandidates[0],
    answers,
  );
  return Object.freeze({
    productId: authorityRow.product.id,
    name: authorityRow.product.name,
    cohort: "new_grant",
    stage: "scored",
    baselineScore: Number(scored.score),
    blockers: Object.freeze([]),
  });
}

function protectionAudit({ spf, uva }) {
  return Object.freeze({
    axes: Object.freeze({
      spf: Object.freeze({ rankingUseful: spf === true }),
      uva: Object.freeze({ rankingUseful: uva === true }),
      waterResistance: Object.freeze({ rankingUseful: false }),
    }),
  });
}

function protectionProjection(record) {
  return Object.freeze({
    spf: Object.freeze({ bucket: record?.spf_bucket || null }),
    uva: Object.freeze({ bucket: record?.uva_bucket || null }),
    waterResistance: Object.freeze({
      bucket: record?.water_bucket || null,
    }),
  });
}

function applyAxisShadow(rows, protectionById, axis) {
  const audit = protectionAudit({
    spf: axis === "spf",
    uva: axis === "uva",
  });
  return Object.freeze(
    rows.map((row) => {
      const record = protectionById.get(row.productId);
      const adjustment = buildSunscreenProtectionShadowAdjustment({
        baselineScore: row.baselineScore,
        protection: protectionProjection(record),
        audit,
        outdoorExposure: true,
      });
      return Object.freeze({
        ...row,
        protectionDelta: adjustment.appliedTotal,
        shadowScore: adjustment.shadowScore,
      });
    }),
  );
}

function topSet(rows, key) {
  if (rows.length === 0) return Object.freeze([]);
  const top = Math.max(...rows.map((row) => Number(row[key])));
  return Object.freeze(
    rows
      .filter((row) => Number(row[key]) === top)
      .map((row) => row.productId)
      .sort(),
  );
}

function authorityCoverage(rows, protectionById, bucketKey) {
  const eligible = rows.filter(
    (row) => Boolean(protectionById.get(row.productId)?.[bucketKey]),
  );
  return Object.freeze({
    eligibleCount: eligible.length,
    totalCount: rows.length,
    complete: eligible.length === rows.length,
    missingProductIds: Object.freeze(
      rows
        .filter(
          (row) => !protectionById.get(row.productId)?.[bucketKey],
        )
        .map((row) => row.productId)
        .sort(),
    ),
  });
}

export function evaluateAuthorityCompleteMixedSubsetShadow({
  legacyProducts,
  authorityRows,
  semanticBundles,
  recoveryFixture,
  protectionRecords,
}) {
  const answers = normalizeRecommendationAnswers({
    skinType: "not_sure",
    sensitivity: "low",
    sunscreenIntent: true,
    outdoorExposure: false,
    toneUpWanted: false,
    whiteCastHate: false,
    eyeSensitive: false,
    makeupUse: false,
  });

  const recoveredBundles = applySemanticAuthorityRecoveries(
    semanticBundles,
    recoveryFixture,
  );
  const bundleByProduct = new Map(
    recoveredBundles.map((bundle) => [bundle.productId, bundle]),
  );

  const legacyRows = (legacyProducts || []).map((product) =>
    scoreExistingProduct(product, answers),
  );
  const newRows = (authorityRows || []).map((authorityRow) =>
    scoreNewProduct(
      authorityRow,
      bundleByProduct.get(authorityRow.product.id),
      answers,
    ),
  );

  const scoredLegacy = legacyRows.filter(
    (row) => row.stage === "scored",
  );
  const scoredNew = newRows.filter((row) => row.stage === "scored");
  const mixedBaseline = Object.freeze([
    ...scoredLegacy,
    ...scoredNew,
  ]);

  const protectionById = new Map(
    (protectionRecords || []).map((record) => [
      record.product_id,
      record,
    ]),
  );
  const spfCoverage = authorityCoverage(
    mixedBaseline,
    protectionById,
    "spf_bucket",
  );
  const uvaCoverage = authorityCoverage(
    mixedBaseline,
    protectionById,
    "uva_bucket",
  );

  const spfShadow = applyAxisShadow(
    mixedBaseline,
    protectionById,
    "spf",
  );
  const uvaNaiveShadow = applyAxisShadow(
    mixedBaseline,
    protectionById,
    "uva",
  );

  const baselineTopSet = topSet(mixedBaseline, "baselineScore");
  const spfTopSet = topSet(spfShadow, "shadowScore");
  const uvaNaiveTopSet = topSet(
    uvaNaiveShadow,
    "shadowScore",
  );

  return Object.freeze({
    version: SUNSCREEN_AUTHORITY_COMPLETE_SUBSET_SHADOW_VERSION,
    neutralRequiredFields: REQUIRED_NEUTRAL_FIELDS,
    legacyCount: legacyRows.length,
    newGrantCount: newRows.length,
    newScoreableCount: scoredNew.length,
    newHeldCount: newRows.length - scoredNew.length,
    scoreableNewProductIds: Object.freeze(
      scoredNew.map((row) => row.productId).sort(),
    ),
    heldNew: Object.freeze(
      newRows
        .filter((row) => row.stage !== "scored")
        .map((row) =>
          Object.freeze({
            productId: row.productId,
            name: row.name,
            stage: row.stage,
            blockers: row.blockers,
          }),
        ),
    ),
    mixedBaselineCount: mixedBaseline.length,
    baselineTopSet,
    spfCoverage,
    uvaCoverage,
    spfTopSet,
    uvaNaiveTopSet,
    spfTopSetPreserved:
      JSON.stringify(baselineTopSet) === JSON.stringify(spfTopSet),
    uvaNaiveTopSetPreserved:
      JSON.stringify(baselineTopSet) ===
      JSON.stringify(uvaNaiveTopSet),
    spfMixedRankingSafe:
      spfCoverage.complete === true,
    uvaMixedRankingSafe:
      uvaCoverage.complete === true,
    legacyRows: Object.freeze(legacyRows),
    newRows: Object.freeze(newRows),
    mixedBaseline,
    spfShadow,
    uvaNaiveShadow,
    limits: Object.freeze({
      productionCandidateAdmissionWired: false,
      productionRankingChanged: false,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
      publicActivation: false,
      waterResistanceApplied: false,
      missingProtectionAuthorityTreatedAsLow: false,
      persistence: false,
    }),
  });
}
