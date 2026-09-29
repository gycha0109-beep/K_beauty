import {
  buildSunscreenProtectionShadowAdjustment
} from "./sunscreen-protection-shadow-scoring.mjs";

export const PROSPECTIVE_PROTECTION_AXIS_SHADOW_VERSION =
  "data-ai29c-c6g-prospective-protection-axis-shadow-v1";

function normalizeReadyAudit(readiness) {
  return Object.freeze({
    axes: Object.freeze({
      spf: Object.freeze({
        rankingUseful: readiness?.axes?.spf?.rankingUseful === true
      }),
      uva: Object.freeze({
        rankingUseful: readiness?.axes?.uva?.rankingUseful === true
      }),
      waterResistance: Object.freeze({
        rankingUseful:
          readiness?.axes?.waterResistance?.rankingUseful === true
      })
    })
  });
}

function protectionProjection(record) {
  return Object.freeze({
    spf: Object.freeze({
      bucket:
        typeof record?.spf_bucket === "string" ? record.spf_bucket : null
    }),
    uva: Object.freeze({
      bucket:
        typeof record?.uva_bucket === "string" ? record.uva_bucket : null
    }),
    waterResistance: Object.freeze({
      bucket:
        typeof record?.water_bucket === "string"
          ? record.water_bucket
          : null
    })
  });
}

function scoreDistribution(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = String(row.appliedTotal);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.freeze(
    Object.fromEntries(
      [...counts.entries()].sort(
        ([a], [b]) => Number(a) - Number(b)
      )
    )
  );
}

function evaluateScenario(records, audit, outdoorExposure) {
  const rows = records.map((record) => {
    const protection = protectionProjection(record);
    const adjustment = buildSunscreenProtectionShadowAdjustment({
      baselineScore: 0,
      protection,
      audit,
      outdoorExposure
    });

    return Object.freeze({
      productId: record.product_id,
      brand: record.brand,
      name: record.name,
      inclusionPath: record.inclusion_path,
      baselineRecommendationScoreUsed: false,
      protection,
      potentialAdjustments: adjustment.potentialAdjustments,
      appliedAdjustments: adjustment.appliedAdjustments,
      appliedTotal: adjustment.appliedTotal,
      enabledAxes: adjustment.enabledAxes,
      blockedAxes: adjustment.blockedAxes
    });
  });

  const ranked = [...rows].sort((a, b) =>
    b.appliedTotal - a.appliedTotal ||
    a.productId.localeCompare(b.productId)
  );
  const enabledAxes = Array.from(
    new Set(rows.flatMap((row) => row.enabledAxes))
  ).sort();

  return Object.freeze({
    outdoorExposure,
    productCount: rows.length,
    appliedProtectionProductCount: rows.filter(
      (row) => row.appliedTotal > 0
    ).length,
    maxAppliedProtectionDelta: rows.reduce(
      (max, row) => Math.max(max, row.appliedTotal),
      0
    ),
    enabledAxes: Object.freeze(enabledAxes),
    scoreDistribution: scoreDistribution(rows),
    ranked: Object.freeze(ranked)
  });
}

export function evaluateProspectiveProtectionAxisShadow(snapshot) {
  const records = Array.isArray(snapshot?.records)
    ? snapshot.records
    : [];
  const readiness = snapshot?.readiness || null;

  if (
    snapshot?.version !==
      "data-ai29c-c6g-prospective-protection-shadow-input-v1" ||
    records.length === 0 ||
    readiness?.overall_decision !==
      "SHADOW_SCORING_PARTIALLY_READY" ||
    snapshot?.boundaries?.protection_axis_only !== true ||
    snapshot?.boundaries?.recommendation_baseline_score_used !== false
  ) {
    throw new Error("prospective_protection_shadow_input_invalid");
  }

  const audit = normalizeReadyAudit(readiness);
  const outdoor = evaluateScenario(records, audit, true);
  const nonOutdoor = evaluateScenario(records, audit, false);

  return Object.freeze({
    version: PROSPECTIVE_PROTECTION_AXIS_SHADOW_VERSION,
    inputVersion: snapshot.version,
    rankingPurpose: "protection_axis_only",
    corpusCount: records.length,
    readinessDecision: readiness.overall_decision,
    readyAxes: Object.freeze([...(readiness.ready_axes || [])]),
    outdoor,
    nonOutdoor,
    limits: Object.freeze({
      recommendationBaselineScoreUsed: false,
      recommendationAdmissionMutated: false,
      productionRankingChanged: false,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
      publicActivation: false,
      persistence: false
    })
  });
}
