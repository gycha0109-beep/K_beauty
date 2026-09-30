import {
  filterSunscreenCandidates,
  normalizeRecommendationAnswers,
  scoreSunscreenProduct,
} from "./recommendation-scoring.ts";
import {
  evaluateFeatureGatedIntegratedSunscreenShadow,
} from "./sunscreen-feature-gated-integrated-shadow.mjs";
import {
  buildSunscreenProtectionShadowAdjustment,
} from "./sunscreen-protection-shadow-scoring.mjs";

export const SUNSCREEN_MIXED_CORPUS_CALIBRATION_VERSION =
  "data-ai29c-d3r2-mixed-corpus-calibration-v1";

const TWO_SIDED_BREAKDOWN_KEYS = Object.freeze({
  finish: Object.freeze(["finish_match", "strong_penalty_adjustment"]),
  toneUp: Object.freeze(["tone_up_adjustment"]),
  sensitivitySafe: Object.freeze(["sensitivity_safe_adjustment"]),
  whiteCast: Object.freeze(["white_cast_adjustment"]),
  eyeSting: Object.freeze(["eye_sting_adjustment"]),
  pilling: Object.freeze(["pilling_adjustment"]),
});

const ALL_BREAKDOWN_KEYS = Object.freeze([
  "skin_type_match",
  "primary_concern_match",
  "secondary_concern_match",
  "finish_match",
  "filter_type_match",
  "sensitivity_safe_adjustment",
  "tone_up_adjustment",
  "white_cast_adjustment",
  "eye_sting_adjustment",
  "pilling_adjustment",
  "strong_penalty_adjustment",
]);

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
    const score = String(row[key]);
    counts.set(score, (counts.get(score) || 0) + 1);
  }
  let tiedRows = 0;
  for (const count of counts.values()) {
    if (count > 1) tiedRows += count;
  }
  return tiedRows;
}

function topScoreSet(rows, key) {
  if (rows.length === 0) return Object.freeze([]);
  const max = Math.max(...rows.map((row) => Number(row[key])));
  return Object.freeze(
    rows
      .filter((row) => Number(row[key]) === max)
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

function currentLegacyRows(legacyProducts, rawAnswers) {
  const answers = normalizeRecommendationAnswers(rawAnswers || {});
  const filtered = filterSunscreenCandidates(legacyProducts, answers);

  return Object.freeze(
    filtered.strictCandidates.map((product) => {
      const scored = scoreSunscreenProduct(product, answers);
      return Object.freeze({
        productId: product.id,
        name: product.name,
        brand: product.brand,
        rawScore: Number(scored.score),
        rawBreakdown: Object.freeze({
          ...(scored.sunscreen_score_breakdown || {}),
        }),
      });
    }),
  );
}

function maskedBreakdown(raw, cohortAxes) {
  const result = {};
  for (const key of ALL_BREAKDOWN_KEYS) {
    result[key] = Number(raw?.[key] || 0);
  }

  for (const [axis, keys] of Object.entries(TWO_SIDED_BREAKDOWN_KEYS)) {
    const axisActive = cohortAxes?.[axis]?.active === true;
    if (axisActive) continue;
    for (const key of keys) {
      result[key] = 0;
    }
  }

  result.total = ALL_BREAKDOWN_KEYS.reduce(
    (sum, key) => sum + Number(result[key] || 0),
    0,
  );

  return Object.freeze(result);
}

function maskLegacyRows(legacyRows, cohortAxes) {
  return Object.freeze(
    legacyRows.map((row) => {
      const breakdown = maskedBreakdown(row.rawBreakdown, cohortAxes);
      return Object.freeze({
        ...row,
        maskedBreakdown: breakdown,
        fairBaselineScore: breakdown.total,
      });
    }),
  );
}

function legacyAxisContributionSummary(legacyRows) {
  const summary = {};
  for (const [axis, keys] of Object.entries(TWO_SIDED_BREAKDOWN_KEYS)) {
    let nonZeroProducts = 0;
    let absoluteContribution = 0;
    for (const row of legacyRows) {
      const contribution = keys.reduce(
        (sum, key) => sum + Number(row.rawBreakdown?.[key] || 0),
        0,
      );
      if (contribution !== 0) nonZeroProducts += 1;
      absoluteContribution += Math.abs(contribution);
    }
    summary[axis] = Object.freeze({
      nonZeroProducts,
      absoluteContribution,
    });
  }
  return Object.freeze(summary);
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

function protectionProjection(record) {
  return Object.freeze({
    spf: Object.freeze({ bucket: record?.spf_bucket || null }),
    uva: Object.freeze({ bucket: record?.uva_bucket || null }),
    waterResistance: Object.freeze({
      bucket: record?.water_bucket || null,
    }),
  });
}

function applyProtection(rows, protectionByProduct, readiness, outdoorExposure) {
  const audit = buildProtectionAudit(readiness);
  return Object.freeze(
    rows.map((row) => {
      const adjustment = buildSunscreenProtectionShadowAdjustment({
        baselineScore: row.fairBaselineScore,
        protection: protectionProjection(
          protectionByProduct.get(row.productId),
        ),
        audit,
        outdoorExposure,
      });

      return Object.freeze({
        ...row,
        protectionDelta: adjustment.appliedTotal,
        shadowScore: adjustment.shadowScore,
        enabledProtectionAxes: adjustment.enabledAxes,
        blockedProtectionAxes: adjustment.blockedAxes,
      });
    }),
  );
}

function buildAllScoreableScenarioMatrix() {
  const scenarios = [];
  const skinTypes = ["not_sure", "oily", "combination"];
  const concerns = [
    null,
    "dehydration",
    "redness",
    "oiliness",
    "barrier",
    "uneven_tone",
    "pores",
    "acne",
  ];

  for (const skinType of skinTypes) {
    for (const concern of concerns) {
      for (const toneUpWanted of [false, true]) {
        scenarios.push(
          Object.freeze({
            skinType,
            sensitivity: "low",
            mainConcern: concern,
            mainConcerns: concern ? [concern] : [],
            toneUpWanted,
            sunscreenIntent: true,
            outdoorExposure: false,
            whiteCastHate: false,
            eyeSensitive: false,
            makeupUse: false,
          }),
        );
      }
    }
  }

  return Object.freeze(scenarios);
}

function signatureGroups(productVectors) {
  const bySignature = new Map();
  for (const [productId, vector] of productVectors.entries()) {
    const signature = vector.join("|");
    const group = bySignature.get(signature) || [];
    group.push(productId);
    bySignature.set(signature, group);
  }
  return Object.freeze(
    [...bySignature.values()]
      .map((ids) => Object.freeze([...ids].sort()))
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
}

function evaluateNewCohortScenarioMatrix({
  authorityRows,
  semanticBundles,
  protectionRecords,
  readiness,
}) {
  const scenarios = buildAllScoreableScenarioMatrix();
  const vectors = new Map(
    authorityRows.map((row) => [row.product.id, []]),
  );
  let allFiveScoreableScenarioCount = 0;
  let tieFreeAllFiveScenarioCount = 0;

  for (const scenario of scenarios) {
    const result = evaluateFeatureGatedIntegratedSunscreenShadow({
      authorityRows,
      semanticBundles,
      protectionRecords,
      readiness,
      rawAnswers: scenario,
    });

    if (result.scoredCount === authorityRows.length) {
      allFiveScoreableScenarioCount += 1;
      if (result.baselineTieCount === 0) {
        tieFreeAllFiveScenarioCount += 1;
      }
    }

    const byId = new Map(
      result.rows.map((row) => [row.productId, row]),
    );
    for (const row of authorityRows) {
      const scored = byId.get(row.product.id);
      vectors.get(row.product.id).push(
        scored?.baselineScore == null
          ? "HOLD"
          : String(scored.baselineScore),
      );
    }
  }

  return Object.freeze({
    scenarioCount: scenarios.length,
    allFiveScoreableScenarioCount,
    tieFreeAllFiveScenarioCount,
    scoreSignatureGroups: signatureGroups(vectors),
  });
}

export function evaluateMixedCorpusSunscreenCalibration({
  legacyProducts,
  authorityRows,
  semanticBundles,
  protectionRecords,
  readiness,
  rawAnswers,
}) {
  if (
    !Array.isArray(legacyProducts) ||
    legacyProducts.length === 0 ||
    !Array.isArray(authorityRows) ||
    authorityRows.length === 0
  ) {
    throw new Error("mixed_corpus_calibration_input_invalid");
  }

  const newShadow = evaluateFeatureGatedIntegratedSunscreenShadow({
    authorityRows,
    semanticBundles,
    protectionRecords,
    readiness,
    rawAnswers,
  });

  const legacyControl = currentLegacyRows(
    legacyProducts,
    rawAnswers,
  );
  const legacyMasked = maskLegacyRows(
    legacyControl,
    newShadow.cohortAxes,
  );
  const legacyAxisContribution =
    legacyAxisContributionSummary(legacyControl);

  const disabledRelevantAxes = Object.entries(newShadow.cohortAxes)
    .filter(([, state]) => state.relevant && !state.active)
    .map(([axis]) => axis)
    .sort();

  const crossCohortLeakAxes = disabledRelevantAxes.filter(
    (axis) =>
      Number(legacyAxisContribution?.[axis]?.nonZeroProducts || 0) > 0,
  );

  const legacyScoreChangedCount = legacyMasked.filter(
    (row) => row.rawScore !== row.fairBaselineScore,
  ).length;

  const legacyControlTopSet = topScoreSet(
    legacyControl.map((row) => ({
      ...row,
      controlScore: row.rawScore,
    })),
    "controlScore",
  );
  const legacyFairTopSet = topScoreSet(
    legacyMasked,
    "fairBaselineScore",
  );

  const newFairRows = newShadow.rows
    .filter((row) => row.stage === "scored")
    .map((row) =>
      Object.freeze({
        productId: row.productId,
        name: row.name,
        cohort: "new_grant",
        fairBaselineScore: row.baselineScore,
      }),
    );

  const legacyFairRows = legacyMasked.map((row) =>
    Object.freeze({
      productId: row.productId,
      name: row.name,
      cohort: "legacy",
      fairBaselineScore: row.fairBaselineScore,
    }),
  );

  const mixedBaselineRows = Object.freeze([
    ...legacyFairRows,
    ...newFairRows,
  ]);
  const protectionByProduct = new Map(
    (protectionRecords || []).map((record) => [
      record.product_id,
      record,
    ]),
  );
  const mixedOutdoorRows = applyProtection(
    mixedBaselineRows,
    protectionByProduct,
    readiness,
    true,
  );

  const mixedBaselineTieCount = scoreTieCount(
    mixedBaselineRows,
    "fairBaselineScore",
  );
  const mixedShadowTieCount = scoreTieCount(
    mixedOutdoorRows,
    "shadowScore",
  );

  const scenarioMatrix = evaluateNewCohortScenarioMatrix({
    authorityRows,
    semanticBundles,
    protectionRecords,
    readiness,
  });

  const newOnlyMaskCrossCohortComparable =
    crossCohortLeakAxes.length === 0;
  const wholeMixedMaskPreservesLegacyControl =
    legacyScoreChangedCount === 0 &&
    sameSet(legacyControlTopSet, legacyFairTopSet);

  const mixedRankingComparable =
    newShadow.scoredCount >= 2 &&
    newOnlyMaskCrossCohortComparable &&
    wholeMixedMaskPreservesLegacyControl &&
    mixedBaselineTieCount === 0;

  return Object.freeze({
    version: SUNSCREEN_MIXED_CORPUS_CALIBRATION_VERSION,
    legacyCount: legacyProducts.length,
    newGrantCount: authorityRows.length,
    newScoredCount: newShadow.scoredCount,
    mixedBaselineCount: mixedBaselineRows.length,
    newCohortAxes: newShadow.cohortAxes,
    disabledRelevantAxes: Object.freeze(disabledRelevantAxes),
    legacyAxisContribution,
    crossCohortLeakAxes: Object.freeze(crossCohortLeakAxes),
    newOnlyMaskCrossCohortComparable,
    legacyScoreChangedCount,
    legacyControlTopSet,
    legacyFairTopSet,
    wholeMixedMaskPreservesLegacyControl,
    mixedBaselineTieCount,
    mixedShadowTieCount,
    mixedBaselineTopSet: topScoreSet(
      mixedBaselineRows,
      "fairBaselineScore",
    ),
    mixedShadowTopSet: topScoreSet(
      mixedOutdoorRows,
      "shadowScore",
    ),
    mixedRankingComparable,
    productionOrderClaimReady:
      mixedRankingComparable && mixedShadowTieCount === 0,
    scenarioMatrix,
    legacyControl: scoreOnlyOrder(
      legacyControl.map((row) => ({
        ...row,
        controlScore: row.rawScore,
      })),
      "controlScore",
    ),
    legacyFairMasked: scoreOnlyOrder(
      legacyMasked,
      "fairBaselineScore",
    ),
    mixedBaseline: scoreOnlyOrder(
      mixedBaselineRows,
      "fairBaselineScore",
    ),
    mixedOutdoorShadow: scoreOnlyOrder(
      mixedOutdoorRows,
      "shadowScore",
    ),
    limits: Object.freeze({
      productionCandidateAdmissionWired: false,
      productionRankingChanged: false,
      productionTieBreakerShadowed: false,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
      publicActivation: false,
      waterResistanceApplied: false,
      persistence: false,
    }),
  });
}
